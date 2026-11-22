<?php
declare(strict_types=1);

/** Hosting-only technical workspace. Amounts at this boundary are integer rials. */
function technician_money(mixed $value): int
{
    if (!is_int($value) && !(is_string($value) && preg_match('/^\d{1,13}$/D', $value))) throw new TamiranApiException('مبلغ باید ریال صحیح و نامنفی باشد.');
    $amount=(int)$value;
    if ($amount<0 || $amount>1000000000000) throw new TamiranApiException('مبلغ خارج از محدوده مجاز است.');
    return $amount;
}
function technician_purchase_allowed(array $scope): bool
{
    return in_array($scope['role'],['repair_manager','finance_cashier','warehouse_keeper'],true) || in_array('finance.view',$scope['permissions'],true);
}
function technician_access(PDO $pdo,array $scope,array $case,bool $primary=false): void
{
    v2_require_permission($scope,'case.note',['technician'],'ثبت عملیات فنی مجاز نیست.');
    v2_require_case_access($pdo,$scope,$case);
    if ($primary && $scope['role']==='technician' && (int)$case['primary_technician_user_id']!==(int)$scope['actor']['id']) throw new TamiranApiException('این عملیات فقط برای تکنسین مسئول مجاز است.',403);
}
function technician_editable(array $case): void
{
    if ($case['locked_at']!==null || !in_array($case['process_status'],['reception','awaiting_assignment','assigned','diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_rework'],true)) throw new TamiranApiException('مسئولیت فنی این پرونده پایان یافته یا پرونده قفل است.',409);
}
/** Existing immutable event table provides replay records under the case row lock. */
function technician_replay(PDO $pdo,array $case,array $scope,string $event,string $key,array $payload): ?array
{
    $s=$pdo->prepare("SELECT id,actor_user_id,metadata_json FROM repair_case_events WHERE case_id=:case AND event_type=:event AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.idempotencyKey'))=:key LIMIT 1");
    $s->execute(['case'=>$case['case_id'],'event'=>$event,'key'=>$key]);$old=$s->fetch();
    if (!is_array($old)) return null;
    $meta=json_decode($old['metadata_json'],true);
    if ((int)$old['actor_user_id']!==(int)$scope['actor']['id'] || v2_json($meta['payload']??null)!==v2_json($payload)) throw new TamiranApiException('شناسه درخواست قبلاً با اطلاعات دیگری استفاده شده است.',409);
    return ['recorded'=>true,'replayed'=>true,'id'=>(int)$old['id']]+($meta['response']??[]);
}
function technician_event(PDO $pdo,array $scope,array $case,string $event,string $key,array $payload,array $response=[]): array
{
    $meta=['idempotencyKey'=>$key,'payload'=>$payload,'actorName'=>$scope['actor']['displayName']??$scope['actor']['display_name']??'','response'=>$response];
    $pdo->prepare('INSERT INTO repair_case_events(case_id,actor_user_id,event_type,description,metadata_json) VALUES(:case,:actor,:event,:description,:metadata)')->execute(['case'=>$case['case_id'],'actor'=>$scope['actor']['id'],'event'=>$event,'description'=>$payload['description']??$payload['report']??$payload['title']??$event,'metadata'=>v2_json($meta)]);
    $id=(int)$pdo->lastInsertId();
    tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],$event,'repair_case',$case['case_public_id'],null,['eventId'=>$id,'payload'=>$payload]);
    return ['recorded'=>true,'replayed'=>false,'id'=>$id]+$response;
}
function technician_activities(PDO $pdo,array $scope,int $caseId,int $before=0): array
{
    $case=v2_case($pdo,$scope,$caseId);v2_require_case_access($pdo,$scope,$case);
    $s=$pdo->prepare("SELECT e.id,e.description,e.metadata_json,e.created_at,u.display_name FROM repair_case_events e LEFT JOIN tamiran_users u ON u.id=e.actor_user_id WHERE e.case_id=:case AND e.event_type='technical_activity'".($before>0?' AND e.id<:before':'').' ORDER BY e.id DESC LIMIT 51');
    $params=['case'=>$caseId];if($before>0)$params['before']=$before;$s->execute($params);$rows=$s->fetchAll();$more=count($rows)>50;$rows=array_slice($rows,0,50);$items=[];
    foreach($rows as $row){$meta=json_decode($row['metadata_json'],true);$items[]=['id'=>(int)$row['id'],'title'=>$meta['payload']['title']??'فعالیت فنی','description'=>$row['description'],'observation'=>$meta['payload']['observation']??'','attachments'=>$meta['payload']['attachments']??[],'actorName'=>($meta['actorName']??'')?:$row['display_name'],'createdAt'=>$row['created_at']];}
    return ['activities'=>$items,'nextBeforeId'=>$more?(int)end($rows)['id']:null];
}
function technician_activity_add(PDO $pdo,array $scope,array $input): array
{
    $caseId=(int)($input['caseId']??0);$key=v2_text($input['idempotencyKey']??'','شناسه فعالیت',160);
    $payload=['title'=>v2_text($input['title']??'','عنوان فعالیت',240),'description'=>v2_text($input['description']??'','شرح فعالیت',4000),'observation'=>v2_text($input['observation']??'','نتیجه یا مشاهده',4000,false)??'','attachments'=>array_values(array_unique(is_array($input['attachments']??null)?$input['attachments']:[]))];
    if(count($payload['attachments'])>10)throw new TamiranApiException('حداکثر ده پیوست برای فعالیت مجاز است.');
    $pdo->beginTransaction();try{
        $case=v2_case($pdo,$scope,$caseId,true);technician_access($pdo,$scope,$case);
        if($old=technician_replay($pdo,$case,$scope,'technical_activity',$key,$payload)){$pdo->commit();return $old;}
        technician_editable($case);
        foreach($payload['attachments'] as $file){$q=$pdo->prepare("SELECT id FROM tamiran_private_files WHERE public_id=:public AND case_id=:case AND shop_id=:shop AND branch_id=:branch AND purpose NOT IN ('identity','signature')");$q->execute(['public'=>v2_text($file,'پیوست',80),'case'=>$caseId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);if(!$q->fetchColumn())throw new TamiranApiException('پیوست متعلق به این پرونده نیست.',403);}
        $result=technician_event($pdo,$scope,$case,'technical_activity',$key,$payload);$pdo->commit();return $result;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
/** Stock and manual references have separate durable namespaces; only consumed stock is billable. */
function technician_billable_parts(PDO $pdo,int $caseId): array
{
    $s=$pdo->prepare("SELECT i.id AS referenceId,i.title,SUM(x.quantity) AS quantity,i.sale_price AS saleUnitPrice,i.purchase_price AS purchaseUnitCost FROM repair_part_issues x JOIN repair_inventory_items i ON i.id=x.item_id WHERE x.case_id=:case AND x.status='consumed' GROUP BY i.id,i.title,i.sale_price,i.purchase_price ORDER BY i.id");$s->execute(['case'=>$caseId]);$parts=[];
    foreach($s->fetchAll() as $part)$parts[]=['sourceType'=>'stock','sourceKey'=>'stock:'.$part['referenceId'],'type'=>'part','discountAmount'=>0,'taxRate'=>0,'warrantyDays'=>30]+$part;
    $s=$pdo->prepare('SELECT id AS referenceId,title,quantity,sale_unit_price AS saleUnitPrice,purchase_unit_cost AS purchaseUnitCost FROM repair_case_manual_parts WHERE case_id=:case ORDER BY id');$s->execute(['case'=>$caseId]);
    foreach($s->fetchAll() as $part)$parts[]=['sourceType'=>'manual','sourceKey'=>'manual:'.$part['referenceId'],'type'=>'part','discountAmount'=>0,'taxRate'=>0,'warrantyDays'=>30]+$part;
    return $parts;
}
function technician_cost_state(PDO $pdo,array $case): array
{
    $s=$pdo->prepare('SELECT * FROM repair_estimates WHERE case_id=:case ORDER BY revision DESC,id DESC LIMIT 1');$s->execute(['case'=>$case['case_id']]);$e=$s->fetch();
    $actual=0;foreach(technician_billable_parts($pdo,(int)$case['case_id']) as $part)$actual+=(int)round((float)$part['quantity']*(int)$part['saleUnitPrice']);
    // Open requests are a cost commitment, not consumption. Count only their unfinalized remainder.
    $s=$pdo->prepare("SELECT COALESCE(SUM(GREATEST(0,r.quantity-r.consumed_quantity-r.returned_quantity)*i.sale_price),0) FROM repair_part_requests r JOIN repair_inventory_items i ON i.id=r.item_id WHERE r.case_id=:case AND r.status NOT IN ('consumed','returned','rejected','cancelled')");$s->execute(['case'=>$case['case_id']]);$actual+=(int)$s->fetchColumn();
    $nonpart=0;$quotedParts=0;
    if(is_array($e)){$s=$pdo->prepare('SELECT item_type,line_total FROM repair_estimate_items WHERE estimate_id=:estimate');$s->execute(['estimate'=>$e['id']]);foreach($s->fetchAll() as $line){if($line['item_type']==='part')$quotedParts+=(int)$line['line_total'];else $nonpart+=(int)$line['line_total'];}$nonpart+=(int)$e['diagnostic_fee'];}
    $total=$nonpart+max($actual,$quotedParts);$cap=(int)$case['preapproved_amount'];
    $valid=is_array($e) && !in_array($e['status'],['rejected','explanation_requested','superseded'],true) && (empty($e['valid_until'])||strtotime($e['valid_until'])>=time()) && ($total<=$cap || ($e['status']==='approved'&&$total<=(int)$e['total_amount']));
    $state=!is_array($e)?'needs_estimate':($e['status']==='rejected'?'rejected':($valid?'approved':(($total>(int)$e['total_amount']||$e['status']==='explanation_requested')?'needs_revision':'waiting_customer')));
    return ['state'=>$state,'authorized'=>$valid,'totalAmount'=>$total,'partsAmount'=>$actual,'capAmount'=>$cap,'estimatePublicId'=>is_array($e)?$e['public_id']:null];
}
function technician_require_cost(PDO $pdo,array $case): void
{
    if(!technician_cost_state($pdo,$case)['authorized'])throw new TamiranApiException('برای ادامه تعمیر، برآورد معتبر و مجوز هزینه لازم است؛ برآورد یا تأیید مشتری را تکمیل کنید.',409);
}
function technician_unrepaired(PDO $pdo,array $case): bool
{
    if(($case['result']??'')!=='not_repaired')return false;
    $s=$pdo->prepare("SELECT id FROM repair_case_events WHERE case_id=:case AND event_type='technical_finish' AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.payload.result'))='not_repaired' LIMIT 1");$s->execute(['case'=>$case['case_id']]);return $s->fetchColumn()!==false;
}
function technician_finish(PDO $pdo,array $scope,array $input): array
{
    $key=v2_text($input['idempotencyKey']??'','شناسه نتیجه',160);$outcome=(string)($input['result']??'');
    if(!in_array($outcome,['repaired','not_repaired'],true))throw new TamiranApiException('نتیجه تعمیر را انتخاب کنید.');
    $payload=['result'=>$outcome,'report'=>v2_text($input['report']??'','گزارش نهایی',8000),'reason'=>v2_text($input['reason']??'','علت عدم تعمیر',1000,$outcome==='not_repaired')??''];
    $pdo->beginTransaction();try{
        $case=v2_case($pdo,$scope,(int)($input['caseId']??0),true);technician_access($pdo,$scope,$case,true);
        if($old=technician_replay($pdo,$case,$scope,'technical_finish',$key,$payload)){$pdo->commit();return $old;}
        technician_editable($case);
        if((int)$case['lock_version']!==(int)($input['lockVersion']??-1))throw new TamiranApiException('پرونده تغییر کرده؛ تازه‌سازی کنید. پیش‌نویس شما محفوظ است.',409);
        if(!in_array($case['process_status'],['diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_rework'],true))throw new TamiranApiException('ابتدا بررسی دستگاه را شروع کنید.',409);
        $parts=v2_open_part_blockers($pdo,(int)$case['case_id']);if($parts!==[])throw new TamiranApiException('ابتدا قطعات را تعیین تکلیف کنید: '.implode('، ',$parts),409);
        if($outcome==='repaired'){if(!in_array($case['process_status'],['repairing','parts_closeout','qc_rework'],true))throw new TamiranApiException('ابتدا مجوز هزینه و مرحله تعمیر را تکمیل کنید.',409);technician_require_cost($pdo,$case);}
        $policy=v2_product_policy($pdo,$scope,$case);$target=$outcome==='repaired'?($policy['qcEnabled']?'qc_pending':'finance_pending'):'finance_pending';
        $pdo->prepare('UPDATE repair_cases SET result=:result,operation_report=:report,row_version=row_version+1 WHERE id=:case')->execute(['result'=>$outcome,'report'=>$payload['report'],'case'=>$case['case_id']]);
        if($outcome==='not_repaired'){
            $charges=technician_unrepaired_amount($pdo,(int)$case['case_id']);
            if($charges===0&&v2_terminal_finance_blockers($pdo,(int)$case['case_id'])===[])$target='returned_unrepaired';
            $billedLabor=$pdo->prepare("SELECT COUNT(*) FROM repair_invoice_items ii JOIN repair_invoices i ON i.id=ii.invoice_id WHERE i.case_id=:case AND i.status<>'voided' AND ii.item_type NOT IN ('diagnostic','part') AND ii.line_total>0");$billedLabor->execute(['case'=>$case['case_id']]);if((int)$billedLabor->fetchColumn()>0)throw new TamiranApiException('فاکتور قبلی اجرت تعمیر دارد؛ ابتدا مالی باید سند اصلاحی مجاز ثبت کند.',409);
        }
        $result=technician_event($pdo,$scope,$case,'technical_finish',$key,$payload,['target'=>$target]);
        // This trusted argument is never accepted from the transition HTTP action.
        v2_transition($pdo,$scope,(int)$case['case_id'],$target,$outcome==='repaired'?'تعمیر شد؛ گزارش نهایی در پرونده ثبت شد':mb_substr('تعمیر نشد؛ '.$payload['reason'],0,1000),(int)$case['lock_version'],'technical-finish:'.$key,true,true);
        $pdo->commit();return $result;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function technician_projection(PDO $pdo,array $scope,int $caseId): array
{
    $case=v2_case($pdo,$scope,$caseId);v2_require_case_access($pdo,$scope,$case);$policy=v2_product_policy($pdo,$scope,$case);
    $write=in_array($scope['role'],['repair_manager','technician'],true)&&$case['locked_at']===null&&in_array($case['process_status'],['reception','awaiting_assignment','assigned','diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_rework'],true);
    $primary=$scope['role']==='repair_manager'||(int)$case['primary_technician_user_id']===(int)$scope['actor']['id'];
    $parts=technician_billable_parts($pdo,$caseId);if(!technician_purchase_allowed($scope))foreach($parts as &$part)unset($part['purchaseUnitCost']);unset($part);
    return ['cost'=>technician_cost_state($pdo,$case),'parts'=>$parts,'activities'=>technician_activities($pdo,$scope,$caseId),'report'=>$case['operation_report']??'','result'=>$case['result'],'permissions'=>['activity'=>$write,'parts'=>$write&&$primary,'finish'=>$write&&$primary,'purchase'=>technician_purchase_allowed($scope),'stock'=>$policy['stockPartsAvailable']]];
}

function technician_manual_part(PDO $pdo,array $scope,array $input): array
{
    v2_require_permission($scope,'case.part.record',['technician'],'ثبت قطعه مجاز نیست.');
    $caseId=(int)($input['caseId']??0);$key=v2_text($input['idempotencyKey']??'','شناسه قطعه',160);
    $q=$input['quantity']??0;
    if(!is_numeric($q)||!is_finite((float)$q)||(float)$q<=0||(float)$q>10000||round((float)$q,3)!==(float)$q)throw new TamiranApiException('تعداد قطعه با حداکثر سه رقم اعشار معتبر است.');
    $payload=['title'=>v2_text($input['title']??'','نام قطعه',240),'quantity'=>(float)$q,'purchaseUnitCost'=>technician_money($input['purchaseUnitCost']??0),'saleUnitPrice'=>technician_money($input['saleUnitPrice']??0),'note'=>v2_text($input['note']??'','توضیح قطعه',1000,false)??''];
    if(!technician_purchase_allowed($scope)&&$payload['purchaseUnitCost']!==0)throw new TamiranApiException('ثبت قیمت خرید در دسترسی شما نیست.',403);
    if($payload['quantity']*max($payload['purchaseUnitCost'],$payload['saleUnitPrice'])>1000000000000)throw new TamiranApiException('جمع مبلغ قطعه خارج از محدوده است.');
    $pdo->beginTransaction();try{
        $case=v2_case($pdo,$scope,$caseId,true);technician_access($pdo,$scope,$case,true);
        // Legacy unique shop key is checked after case authorization, including its exact content.
        $s=$pdo->prepare('SELECT * FROM repair_case_manual_parts WHERE shop_id=:shop AND idempotency_key=:key');$s->execute(['shop'=>$scope['shop_id'],'key'=>$key]);$old=$s->fetch();
        if(is_array($old)){
            if((int)$old['case_id']!==$caseId||(int)$old['created_by_user_id']!==(int)$scope['actor']['id']||$old['title']!==$payload['title']||(float)$old['quantity']!==$payload['quantity']||(int)$old['purchase_unit_cost']!==$payload['purchaseUnitCost']||(int)$old['sale_unit_price']!==$payload['saleUnitPrice']||($old['note']??'')!==$payload['note'])throw new TamiranApiException('شناسه قطعه قبلاً با اطلاعات دیگری استفاده شده است.',409);
            $pdo->commit();return ['created'=>true,'replayed'=>true,'publicId'=>$old['public_id']];
        }
        technician_editable($case);$public=tamiran_id();
        $pdo->prepare('INSERT INTO repair_case_manual_parts(public_id,shop_id,case_id,title,quantity,purchase_unit_cost,sale_unit_price,note,idempotency_key,created_by_user_id) VALUES(:public,:shop,:case,:title,:quantity,:purchase,:sale,:note,:key,:actor)')->execute(['public'=>$public,'shop'=>$scope['shop_id'],'case'=>$caseId,'title'=>$payload['title'],'quantity'=>$payload['quantity'],'purchase'=>$payload['purchaseUnitCost'],'sale'=>$payload['saleUnitPrice'],'note'=>$payload['note'],'key'=>$key,'actor'=>$scope['actor']['id']]);
        technician_event($pdo,$scope,$case,'technical_manual_part',$key,$payload,['publicId'=>$public]);$pdo->commit();return ['created'=>true,'replayed'=>false,'publicId'=>$public];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function technician_stock_request(PDO $pdo,array $scope,array $input): array
{
    v2_require_permission($scope,'part.request',['technician'],'ثبت درخواست قطعه مجاز نیست.');
    $caseId=(int)($input['caseId']??0);$quantity=$input['quantity']??0;
    if(filter_var($quantity,FILTER_VALIDATE_INT)===false||(int)$quantity<1||(int)$quantity>100000)throw new TamiranApiException('تعداد صحیح قطعه لازم است.');
    $key=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه درخواست',160);
    $payload=['itemId'=>(int)($input['itemId']??0),'quantity'=>(int)$quantity,'notes'=>v2_text($input['notes']??'','توضیح درخواست',2000,false)??''];
    $pdo->beginTransaction();try{
        $case=v2_case($pdo,$scope,$caseId,true);technician_access($pdo,$scope,$case,true);
        if($old=technician_replay($pdo,$case,$scope,'technical_stock_request',$key,$payload)){$pdo->commit();return $old;}
        technician_editable($case);
        $s=$pdo->prepare('SELECT i.id FROM repair_inventory_items i JOIN repair_branch_stock s ON s.item_id=i.id AND s.shop_id=i.shop_id WHERE i.id=:item AND i.shop_id=:shop AND s.branch_id=:branch AND i.is_active=1');$s->execute(['item'=>$payload['itemId'],'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);if(!$s->fetchColumn())throw new TamiranApiException('قطعه فعال در موجودی این شعبه پیدا نشد.',404);
        $public=tamiran_id();$pdo->prepare("INSERT INTO repair_part_requests(public_id,shop_id,branch_id,case_id,item_id,requested_by_user_id,quantity,status,notes) VALUES(:public,:shop,:branch,:case,:item,:actor,:quantity,'pending',:notes)")->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId,'item'=>$payload['itemId'],'actor'=>$scope['actor']['id'],'quantity'=>$payload['quantity'],'notes'=>$payload['notes']]);
        $result=technician_event($pdo,$scope,$case,'technical_stock_request',$key,$payload,['created'=>true,'publicId'=>$public]);
        if(in_array($case['process_status'],['diagnosing','estimate_pending','awaiting_customer_approval','repairing'],true))v2_transition($pdo,$scope,$caseId,'awaiting_parts','درخواست قطعه؛ مصرف پس از تحویل انبار ثبت می‌شود',(int)$case['lock_version'],'part-request:'.$public,true,true);
        $pdo->commit();return $result;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function technician_unrepaired_amount(PDO $pdo,int $caseId): int
{
    $s=$pdo->prepare('SELECT id,diagnostic_fee FROM repair_estimates WHERE case_id=:case ORDER BY revision DESC,id DESC LIMIT 1');$s->execute(['case'=>$caseId]);$e=$s->fetch();$amount=0;
    if(is_array($e)){$amount=(int)$e['diagnostic_fee'];$s=$pdo->prepare("SELECT COALESCE(SUM(line_total),0) FROM repair_estimate_items WHERE estimate_id=:estimate AND item_type='diagnostic'");$s->execute(['estimate'=>$e['id']]);$amount+=(int)$s->fetchColumn();}
    foreach(technician_billable_parts($pdo,$caseId) as $part)$amount+=(int)round((float)$part['quantity']*(int)$part['saleUnitPrice']);
    return $amount;
}
