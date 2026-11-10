<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once tamiran_private_root() . '/v2-core.php';
$smsService=tamiran_private_root().'/sms-service.php';
if(is_file($smsService)) require_once $smsService;

function workflow_v2_technician_view(array $row, array $allowedTransitions): array
{
    $status=(string)$row['process_status'];
    $waiting=['awaiting_customer_approval','awaiting_parts','qc_pending','finance_pending','awaiting_assignment','reception'];
    $completed=['ready_for_delivery','returned_unrepaired','delivered','cancelled','closed'];
    $group=in_array($status,$completed,true)?'completed':(in_array($status,$waiting,true)?'waiting':'action_required');
    $labels=[
        'reception'=>'در انتظار ارجاع','awaiting_assignment'=>'در انتظار تخصیص','assigned'=>'نیاز به شروع بررسی','diagnosing'=>'نیاز به ثبت نتیجه بررسی',
        'estimate_pending'=>'نیاز به ثبت برآورد','awaiting_customer_approval'=>'منتظر پاسخ مشتری','awaiting_parts'=>'منتظر قطعه','repairing'=>'در حال تعمیر',
        'parts_closeout'=>'نیاز به تعیین تکلیف قطعات','qc_pending'=>'منتظر QC','qc_rework'=>'بازکاری QC','qc_conditional'=>'قبول مشروط QC',
        'finance_pending'=>'منتظر تکمیل مالی','ready_for_delivery'=>'مسئولیت فنی انجام شد','returned_unrepaired'=>'مختومه بدون تعمیر','delivered'=>'تحویل‌شده','cancelled'=>'لغوشده','closed'=>'بسته‌شده',
    ];
    $actions=[
        'assigned'=>['key'=>'start_diagnosis','label'=>'شروع بررسی','target'=>'diagnosing'],
        'diagnosing'=>['key'=>'record_diagnosis','label'=>'ثبت نتیجه بررسی','target'=>'estimate_pending'],
        'estimate_pending'=>['key'=>'create_estimate','label'=>'ثبت برآورد','target'=>null],
        'repairing'=>['key'=>'complete_repair','label'=>'تکمیل تعمیر','target'=>in_array('parts_closeout',$allowedTransitions,true)?'parts_closeout':(in_array('qc_pending',$allowedTransitions,true)?'qc_pending':(in_array('finance_pending',$allowedTransitions,true)?'finance_pending':null))],
        'parts_closeout'=>['key'=>'close_parts','label'=>'تعیین تکلیف قطعات','target'=>null],
        'qc_rework'=>['key'=>'start_rework','label'=>'شروع بازکاری','target'=>'repairing'],
    ];
    $primary=$actions[$status]??null;
    if(is_array($primary)&&$primary['target']!==null&&!in_array($primary['target'],$allowedTransitions,true))$primary=null;
    $flags=[];
    if($status==='qc_rework')$flags[]='qc_rework';
    if(($row['case_kind']??'')==='warranty_return')$flags[]='warranty';
    if($status==='awaiting_parts')$flags[]='waiting_part';
    if(!empty($row['promised_at'])&&strtotime((string)$row['promised_at'])<time()&&!in_array($status,$completed,true))$flags[]='sla_overdue';
    return[
        'group'=>$group,'statusLabel'=>$labels[$status]??$status,'priority'=>$status==='qc_rework'?100:(in_array('sla_overdue',$flags,true)?90:50),
        'primaryAction'=>$primary,'secondaryActions'=>['add_note','add_photo'],'flags'=>$flags,
        'allowedActions'=>array_values(array_map(static fn(string$target):array=>['key'=>'transition','target'=>$target],$allowedTransitions)),
    ];
}

function workflow_v2_payload(PDO $pdo,array $scope,?int $caseId=null,?string $query=null): array
{
    $where='w.shop_id=:shop AND w.branch_id=:branch';
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']];
    if($caseId!==null){$where.=' AND w.case_id=:case';$params['case']=$caseId;}
    $query=trim((string)$query);
    if($query!==''){
        if((function_exists('mb_strlen')?mb_strlen($query):strlen($query))>120)throw new TamiranApiException('عبارت جستجو بیش از حد طولانی است.');
        $receiptDigits=tamiran_digits($query);
        $receiptFilter='';
        $trackingFilter='';
        $trackingToken='';
        $urlQuery=parse_url($query,PHP_URL_QUERY);
        if(is_string($urlQuery)){
            $urlParams=[];
            parse_str($urlQuery,$urlParams);
            if(is_string($urlParams['portal']??null))$trackingToken=(string)$urlParams['portal'];
        }elseif(preg_match('/^[A-Za-z0-9_-]{32,128}$/',$query)){
            $trackingToken=$query;
        }
        if(preg_match('/^[A-Za-z0-9_-]{32,128}$/',$trackingToken)){
            $trackingFilter=' OR c.tracking_token_hash=:query_tracking_hash';
            $params['query_tracking_hash']=hash('sha256',$trackingToken);
        }
        if(preg_match('/^\d{12}$/',$receiptDigits)){
            $receiptFilter=" OR REPLACE(c.public_receipt_no,'-','')=:query_receipt_normalized";
            $params['query_receipt_normalized']=$receiptDigits;
        }elseif(preg_match('/^\d{1,6}$/',$receiptDigits)){
            $receiptFilter=' OR c.receipt_sequence=:query_receipt_sequence';
            $params['query_receipt_sequence']=(int)$receiptDigits;
        }
        $where.=' AND (c.receipt_number LIKE :query_receipt'.$receiptFilter.$trackingFilter.' OR cu.mobile LIKE :query_mobile OR c.identifier_snapshot LIKE :query_identifier OR c.model_snapshot LIKE :query_model OR c.brand_snapshot LIKE :query_brand OR cu.full_name LIKE :query_customer)';
        $queryPattern='%'.$query.'%';
        $params['query_receipt']=$queryPattern;
        $params['query_mobile']=$queryPattern;
        $params['query_identifier']=$queryPattern;
        $params['query_model']=$queryPattern;
        $params['query_brand']=$queryPattern;
        $params['query_customer']=$queryPattern;
    }
    if($scope['role']==='technician'){$where.=' AND (w.primary_technician_user_id=:actor OR EXISTS(SELECT 1 FROM repair_case_assignments a WHERE a.workflow_id=w.id AND a.technician_user_id=:actor2 AND a.ended_at IS NULL))';$params['actor']=$scope['actor']['id'];$params['actor2']=$scope['actor']['id'];}
    $statement=$pdo->prepare("SELECT w.*,c.public_id AS case_public_id,c.receipt_number,c.declared_issue,c.device_type_snapshot,c.brand_snapshot,c.model_snapshot,c.identifier_snapshot,c.product_profile_snapshot,c.inventory_mode_snapshot,c.qc_mode_snapshot,c.feature_flags_snapshot_json,c.created_at AS accepted_at,cu.full_name AS customer_name,cu.mobile AS customer_mobile,u.display_name AS technician_name FROM repair_case_workflows w INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN repair_customers cu ON cu.id=c.customer_id LEFT JOIN tamiran_users u ON u.id=w.primary_technician_user_id WHERE {$where} ORDER BY w.updated_at DESC LIMIT 500");
    $statement->execute($params);$rows=$statement->fetchAll();$defaultPolicy=v2_product_policy($pdo,$scope);$maps=v2_workflow_maps($defaultPolicy);
    $manualPartsByCase=[];$latestEstimateByCase=[];
    $caseIds=array_values(array_unique(array_map(static fn(array $row):int=>(int)$row['case_id'],$rows)));
    if($caseIds!==[]){
        $placeholders=implode(',',array_fill(0,count($caseIds),'?'));
        $manualPartsStatement=$pdo->prepare("SELECT case_id,public_id,title,quantity,purchase_unit_cost,sale_unit_price,note,created_at FROM repair_case_manual_parts WHERE shop_id=? AND case_id IN ({$placeholders}) ORDER BY id");
        $manualPartsStatement->execute(array_merge([(int)$scope['shop_id']],$caseIds));
        foreach($manualPartsStatement->fetchAll() as $part)$manualPartsByCase[(int)$part['case_id']][]=[
            'publicId'=>$part['public_id'],'title'=>$part['title'],'quantity'=>(float)$part['quantity'],
            'purchaseUnitCost'=>(int)$part['purchase_unit_cost'],'saleUnitPrice'=>(int)$part['sale_unit_price'],
            'note'=>$part['note']??'','createdAt'=>$part['created_at'],
        ];
        $estimateStatement=$pdo->prepare("SELECT e.case_id,e.public_id,e.status,e.total_amount,e.sent_at FROM repair_estimates e INNER JOIN (SELECT case_id,MAX(revision) AS revision FROM repair_estimates WHERE case_id IN ({$placeholders}) GROUP BY case_id) latest ON latest.case_id=e.case_id AND latest.revision=e.revision WHERE e.case_id IN ({$placeholders})");
        $estimateStatement->execute(array_merge($caseIds,$caseIds));
        foreach($estimateStatement->fetchAll() as $estimate)$latestEstimateByCase[(int)$estimate['case_id']]=[
            'publicId'=>$estimate['public_id'],'status'=>$estimate['status'],'totalAmount'=>(int)$estimate['total_amount'],'sentAt'=>$estimate['sent_at'],
        ];
    }
    $cases=[];
    foreach($rows as $row){
        $allowedTransitions=v2_workflow_maps(v2_product_policy($pdo,$scope,$row))[$row['workflow_code']][$row['process_status']]??[];
        $customerConsent=json_decode((string)($row['customer_consent_json']??'{}'),true);
        $dataHandling=is_array($customerConsent)?(string)($customerConsent['dataHandling']??'no_erasure'):'no_erasure';
        if(!in_array($dataHandling,['no_erasure','coordinate_first','erase_authorized'],true))$dataHandling='no_erasure';
        $cases[]=[
            'id'=>(int)$row['case_id'],'publicId'=>$row['case_public_id'],'workflowPublicId'=>$row['public_id'],'receiptNumber'=>$row['receipt_number'],
            'workflowCode'=>$row['workflow_code'],'caseKind'=>$row['case_kind'],'status'=>$row['process_status'],'lockVersion'=>(int)$row['lock_version'],
            'isLocked'=>$row['locked_at']!==null,'customerName'=>$row['customer_name'],
            'customerMobile'=>in_array($scope['role'],['repair_manager','reception','finance_cashier'],true)?$row['customer_mobile']:'',
            'deviceTitle'=>trim($row['device_type_snapshot'].' '.$row['brand_snapshot'].' '.$row['model_snapshot']),
            'identifier'=>$row['identifier_snapshot']??'','declaredIssue'=>$row['declared_issue'],'dataHandling'=>$dataHandling,'technicianName'=>$row['technician_name']??'',
            'primaryTechnicianUserId'=>$row['primary_technician_user_id']===null?null:(int)$row['primary_technician_user_id'],
            'preapprovedAmount'=>(int)$row['preapproved_amount'],'promisedAt'=>$row['promised_at'],'acceptedAt'=>$row['accepted_at'],
            'allowedTransitions'=>$allowedTransitions,
            'mainState'=>v2_main_state((string)$row['process_status']),'holdReason'=>v2_hold_reason((string)$row['process_status']),
            'closureOutcome'=>v2_closure_outcome((string)$row['process_status']),'closureReason'=>$row['terminal_reason']??null,
            'technicianView'=>workflow_v2_technician_view($row,$allowedTransitions),
            'blockers'=>v2_case_blockers($pdo,$scope,$row),
            'productProfile'=>$row['product_profile_snapshot'],'inventoryMode'=>$row['inventory_mode_snapshot'],'qcMode'=>$row['qc_mode_snapshot'],
            'manualParts'=>$manualPartsByCase[(int)$row['case_id']]??[],
            'latestEstimate'=>$latestEstimateByCase[(int)$row['case_id']]??null,
            'updatedAt'=>$row['updated_at'],
        ];
    }
    $usersStatement=$pdo->prepare("SELECT DISTINCT u.id,u.display_name,ub.branch_role_code AS role FROM tamiran_users u INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.shop_id=:shop AND ub.branch_id=:branch AND ub.is_active=1 AND u.is_active=1 AND ub.branch_role_code IN ('technician','quality_control','repair_manager') ORDER BY u.display_name");
    $usersStatement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $assignmentWhere='w.shop_id=:assignment_shop AND w.branch_id=:assignment_branch';$assignmentParams=['assignment_shop'=>$scope['shop_id'],'assignment_branch'=>$scope['branch_id']];if($scope['role']==='technician'){$assignmentWhere.=' AND a.technician_user_id=:assignment_actor';$assignmentParams['assignment_actor']=$scope['actor']['id'];}$assignments=$pdo->prepare("SELECT a.*,w.case_id,c.receipt_number,u.display_name AS technician_name FROM repair_case_assignments a INNER JOIN repair_case_workflows w ON w.id=a.workflow_id INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN tamiran_users u ON u.id=a.technician_user_id WHERE {$assignmentWhere} ORDER BY a.created_at DESC LIMIT 1000");$assignments->execute($assignmentParams);
    $handoverWhere='w.shop_id=:handover_shop AND w.branch_id=:handover_branch';$handoverParams=['handover_shop'=>$scope['shop_id'],'handover_branch'=>$scope['branch_id']];if($scope['role']==='technician'){$handoverWhere.=' AND (h.from_user_id=:handover_actor OR h.to_user_id=:handover_actor2)';$handoverParams['handover_actor']=$scope['actor']['id'];$handoverParams['handover_actor2']=$scope['actor']['id'];}$handovers=$pdo->prepare("SELECT h.*,w.case_id,c.receipt_number,fu.display_name AS from_user_name,tu.display_name AS to_user_name FROM repair_case_handovers h INNER JOIN repair_case_workflows w ON w.id=h.workflow_id INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN tamiran_users fu ON fu.id=h.from_user_id INNER JOIN tamiran_users tu ON tu.id=h.to_user_id WHERE {$handoverWhere} ORDER BY h.requested_at DESC LIMIT 500");$handovers->execute($handoverParams);
    return ['cases'=>$cases,'users'=>$usersStatement->fetchAll(),'assignments'=>$assignments->fetchAll(),'handovers'=>$handovers->fetchAll(),'workflowMaps'=>$maps,'productPolicy'=>$defaultPolicy,'serverTime'=>gmdate('c')];
}

function workflow_v2_assign(PDO $pdo,array $scope,array $input): array
{
    v2_require_permission($scope,'case.assign',['reception'],'تخصیص پرونده برای نقش فعلی مجاز نیست.');
    $caseId=(int)($input['caseId']??0);$technicianId=(int)($input['technicianUserId']??0);
    $pdo->beginTransaction();
    try{
        $row=v2_case($pdo,$scope,$caseId,true);
        if($row['locked_at']!==null) throw new TamiranApiException('پرونده بسته قابل تخصیص نیست.',409);if((int)$row['primary_technician_user_id']>0&&(int)$row['primary_technician_user_id']!==$technicianId&&!in_array($row['process_status'],['reception','awaiting_assignment'],true))throw new TamiranApiException('تغییر تکنسین مسئول پس از شروع پرونده فقط با تحویل رسمی انجام می‌شود.',409);
        $check=$pdo->prepare("SELECT u.id FROM tamiran_users u INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.id=:user AND u.shop_id=:shop AND ub.branch_id=:branch AND ub.is_active=1 AND u.is_active=1 AND ub.branch_role_code IN ('technician','repair_manager') LIMIT 1");
        $check->execute(['user'=>$technicianId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
        if($check->fetchColumn()===false) throw new TamiranApiException('تکنسین فعال این شعبه پیدا نشد.',409);
        $pdo->prepare("UPDATE repair_case_assignments SET ended_at=NOW() WHERE workflow_id=:workflow AND assignment_type='primary' AND ended_at IS NULL")->execute(['workflow'=>$row['id']]);
        $pdo->prepare("INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,created_by_user_id,started_at,accepted_at) VALUES(:public,:workflow,:technician,'primary','مسئول اصلی تعمیر',:actor,NOW(),NOW())")
            ->execute(['public'=>tamiran_id(),'workflow'=>$row['id'],'technician'=>$technicianId,'actor'=>$scope['actor']['id']]);
        $pdo->prepare('UPDATE repair_case_workflows SET primary_technician_user_id=:technician,lock_version=lock_version+1 WHERE id=:id')->execute(['technician'=>$technicianId,'id'=>$row['id']]);
        $pdo->prepare('UPDATE repair_cases SET assigned_to_user_id=:technician,row_version=row_version+1 WHERE id=:case')->execute(['technician'=>$technicianId,'case'=>$caseId]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.assign','repair_case',$row['case_public_id'],['technician'=>$row['primary_technician_user_id']],['technician'=>$technicianId],v2_text($input['reason']??'تخصیص پرونده','علت',1000));
        v2_notify($pdo,$scope,$technicianId,'case_assigned','پرونده جدید به شما تخصیص یافت','رسید '.$row['receipt_number'],'repair_case',$row['case_public_id']);
        $oldStatus=$row['process_status'];$pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    if(in_array($oldStatus,['reception','awaiting_assignment'],true)){
        $fresh=v2_case($pdo,$scope,$caseId);return v2_transition($pdo,$scope,$caseId,'assigned','تخصیص تکنسین',(int)$fresh['lock_version']);
    }
    return v2_case($pdo,$scope,$caseId);
}

function workflow_v2_active_technician(PDO $pdo,array $scope,int $userId):void
{
    $check=$pdo->prepare("SELECT COUNT(*) FROM tamiran_users u INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.id=:user AND u.shop_id=:shop AND u.is_active=1 AND ub.branch_id=:branch AND ub.is_active=1 AND ub.branch_role_code IN ('technician','repair_manager')");$check->execute(['user'=>$userId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);if((int)$check->fetchColumn()<1)throw new TamiranApiException('مسئول فنی فعال این شعبه پیدا نشد.',409);
}

function workflow_v2_add_collaborator(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'case.collaborator.manage',[],'افزودن همکار فقط برای مدیر یا دسترسی مجاز است.');$caseId=(int)($input['caseId']??0);$technicianId=(int)($input['technicianUserId']??0);$task=v2_text($input['taskTitle']??'','وظیفه همکار',240);$model=(string)($input['compensationModel']??'fixed');$fixed=max(0,(int)($input['fixedFee']??0));$labor=(float)($input['laborPercent']??0);$part=(float)($input['partSalePercent']??0);if(!in_array($model,['fixed','labor_percent','mixed'],true)||$labor<0||$labor>100||$part<0||$part>100)throw new TamiranApiException('مدل یا درصد اجرت معتبر نیست.');workflow_v2_active_technician($pdo,$scope,$technicianId);$pdo->beginTransaction();try{$case=v2_case($pdo,$scope,$caseId,true);if($case['locked_at']!==null)throw new TamiranApiException('پرونده بسته قابل تخصیص نیست.',409);if((int)$case['primary_technician_user_id']===$technicianId)throw new TamiranApiException('تکنسین مسئول اصلی را به‌عنوان همکار ثبت نکنید.',409);$duplicate=$pdo->prepare("SELECT COUNT(*) FROM repair_case_assignments WHERE workflow_id=:workflow AND technician_user_id=:technician AND ended_at IS NULL");$duplicate->execute(['workflow'=>$case['id'],'technician'=>$technicianId]);if((int)$duplicate->fetchColumn()>0)throw new TamiranApiException('این تکنسین هم‌اکنون در پرونده فعال است.',409);$public=tamiran_id();$pdo->prepare("INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,compensation_model,fixed_fee,labor_percent,part_sale_percent,part_percent_approved_by_user_id,started_at,accepted_at,created_by_user_id) VALUES(:public,:workflow,:technician,'collaborator',:task,:model,:fixed,:labor,:part,:part_approver,NOW(),NOW(),:actor)")->execute(['public'=>$public,'workflow'=>$case['id'],'technician'=>$technicianId,'task'=>$task,'model'=>$model,'fixed'=>$fixed,'labor'=>$labor,'part'=>$part,'part_approver'=>$part>0?$scope['actor']['id']:null,'actor'=>$scope['actor']['id']]);tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.collaborator.add','repair_case',$case['case_public_id'],null,['technicianUserId'=>$technicianId,'task'=>$task,'compensationModel'=>$model,'fixedFee'=>$fixed,'laborPercent'=>$labor,'partSalePercent'=>$part]);v2_notify($pdo,$scope,$technicianId,'case_collaboration','وظیفه جدید در پرونده','رسید '.$case['receipt_number'].'؛ '.$task,'repair_case',$case['case_public_id']);$pdo->commit();}catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}return['created'=>true,'publicId'=>$public];
}

function workflow_v2_handover_request(PDO $pdo,array $scope,array $input):array
{
    $caseId=(int)($input['caseId']??0);$toUserId=(int)($input['toUserId']??0);$reason=v2_text($input['reason']??'','علت تحویل پرونده',1000);$partsDisposition=(string)($input['partsDisposition']??'');$hotDisposition=(string)($input['hotReturnsDisposition']??'');$allowed=['transfer_to_new','remain_with_previous','settle_before_handover'];if(!in_array($partsDisposition,$allowed,true)||!in_array($hotDisposition,$allowed,true))throw new TamiranApiException('تعیین تکلیف قطعات و داغی الزامی است.');workflow_v2_active_technician($pdo,$scope,$toUserId);$pdo->beginTransaction();try{$case=v2_case($pdo,$scope,$caseId,true);$fromUserId=(int)$case['primary_technician_user_id'];if($case['locked_at']!==null||$fromUserId<1)throw new TamiranApiException('پرونده بسته یا بدون مسئول است.',409);if($scope['role']!=='repair_manager'&&$fromUserId!==(int)$scope['actor']['id'])throw new TamiranApiException('فقط تکنسین مسئول یا مدیر می‌تواند تحویل رسمی بسازد.',403);if($fromUserId===$toUserId)throw new TamiranApiException('تحویل‌گیرنده باید با مسئول فعلی متفاوت باشد.',409);$duplicate=$pdo->prepare("SELECT COUNT(*) FROM repair_case_handovers WHERE workflow_id=:workflow AND status='requested' FOR UPDATE");$duplicate->execute(['workflow'=>$case['id']]);if((int)$duplicate->fetchColumn()>0)throw new TamiranApiException('برای پرونده یک تحویل در انتظار تأیید وجود دارد.',409);$issues=$pdo->prepare("SELECT public_id,quantity,status FROM repair_part_issues WHERE case_id=:case AND technician_user_id=:technician AND status NOT IN ('consumed','returned') FOR UPDATE");$issues->execute(['case'=>$caseId,'technician'=>$fromUserId]);$issueRows=$issues->fetchAll();$hot=$pdo->prepare("SELECT public_id,quantity,status FROM repair_hot_returns WHERE case_id=:case AND technician_user_id=:technician AND status<>'settled' FOR UPDATE");$hot->execute(['case'=>$caseId,'technician'=>$fromUserId]);$hotRows=$hot->fetchAll();$assets=['partsDisposition'=>$partsDisposition,'hotReturnsDisposition'=>$hotDisposition,'partIssues'=>$issueRows,'hotReturns'=>$hotRows,'toolsNote'=>v2_text($input['toolsNote']??'','تعیین تکلیف ابزار',2000,false)];$public=tamiran_id();$pdo->prepare("INSERT INTO repair_case_handovers(public_id,workflow_id,from_user_id,to_user_id,status,reason,assets_json) VALUES(:public,:workflow,:from_user,:to_user,'requested',:reason,:assets)")->execute(['public'=>$public,'workflow'=>$case['id'],'from_user'=>$fromUserId,'to_user'=>$toUserId,'reason'=>$reason,'assets'=>v2_json($assets)]);tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.handover.request','repair_case',$case['case_public_id'],['primaryTechnicianUserId'=>$fromUserId],['requestedTechnicianUserId'=>$toUserId,'assets'=>$assets],$reason);v2_notify($pdo,$scope,$toUserId,'case_handover_requested','تحویل پرونده منتظر تأیید شماست','رسید '.$case['receipt_number'],'repair_case_handover',$public);$pdo->commit();}catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}return['created'=>true,'publicId'=>$public];
}

function workflow_v2_handover_decide(PDO $pdo,array $scope,array $input):array
{
    $public=v2_text($input['publicId']??'','تحویل پرونده',80);$action=(string)($input['decision']??'');if(!in_array($action,['accept','manager_force','cancel'],true))throw new TamiranApiException('تصمیم تحویل معتبر نیست.');$decisionReason=v2_text($input['reason']??'','علت تصمیم',1000,$action==='manager_force'||$action==='cancel');$pdo->beginTransaction();try{$statement=$pdo->prepare("SELECT h.*,w.case_id,w.shop_id,w.branch_id,w.public_id AS workflow_public_id,c.public_id AS case_public_id,c.receipt_number FROM repair_case_handovers h INNER JOIN repair_case_workflows w ON w.id=h.workflow_id INNER JOIN repair_cases c ON c.id=w.case_id WHERE h.public_id=:public AND w.shop_id=:shop AND w.branch_id=:branch AND h.status='requested' FOR UPDATE");$statement->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$handover=$statement->fetch();if(!is_array($handover))throw new TamiranApiException('تحویل پرونده قابل تصمیم نیست.',409);if($action==='accept'&&(int)$handover['to_user_id']!==(int)$scope['actor']['id'])throw new TamiranApiException('فقط تکنسین تحویل‌گیرنده می‌تواند دریافت را تأیید کند.',403);if($action==='manager_force'&&$scope['role']!=='repair_manager')throw new TamiranApiException('قطعی‌کردن اجباری فقط برای مدیر مجاز است.',403);if($action==='cancel'&&$scope['role']!=='repair_manager'&&(int)$handover['from_user_id']!==(int)$scope['actor']['id'])throw new TamiranApiException('لغو تحویل برای نقش فعلی مجاز نیست.',403);if($action==='cancel'){$pdo->prepare("UPDATE repair_case_handovers SET status='cancelled',decided_by_user_id=:actor,decided_at=NOW() WHERE id=:id")->execute(['actor'=>$scope['actor']['id'],'id'=>$handover['id']]);tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.handover.cancel','repair_case',$handover['case_public_id'],['handover'=>'requested'],['handover'=>'cancelled'],$decisionReason);$pdo->commit();return['decided'=>true,'status'=>'cancelled'];}$assets=json_decode((string)$handover['assets_json'],true);if(!is_array($assets))throw new TamiranApiException('اطلاعات تحویل پرونده ناقص است.',409);if(($assets['partsDisposition']??'')==='settle_before_handover'){$open=$pdo->prepare("SELECT COUNT(*) FROM repair_part_issues WHERE case_id=:case AND technician_user_id=:technician AND status NOT IN ('consumed','returned')");$open->execute(['case'=>$handover['case_id'],'technician'=>$handover['from_user_id']]);if((int)$open->fetchColumn()>0)throw new TamiranApiException('قطعات مسئول قبلی هنوز تعیین‌تکلیف نشده‌اند.',409);}if(($assets['hotReturnsDisposition']??'')==='settle_before_handover'){$open=$pdo->prepare("SELECT COUNT(*) FROM repair_hot_returns WHERE case_id=:case AND technician_user_id=:technician AND status<>'settled'");$open->execute(['case'=>$handover['case_id'],'technician'=>$handover['from_user_id']]);if((int)$open->fetchColumn()>0)throw new TamiranApiException('تعهد داغی مسئول قبلی هنوز باز است.',409);}workflow_v2_active_technician($pdo,$scope,(int)$handover['to_user_id']);$pdo->prepare("UPDATE repair_case_assignments SET ended_at=NOW() WHERE workflow_id=:workflow AND assignment_type='primary' AND ended_at IS NULL")->execute(['workflow'=>$handover['workflow_id']]);$pdo->prepare("INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,started_at,accepted_at,created_by_user_id) VALUES(:public,:workflow,:technician,'primary','مسئول اصلی پس از تحویل رسمی',NOW(),NOW(),:actor)")->execute(['public'=>tamiran_id(),'workflow'=>$handover['workflow_id'],'technician'=>$handover['to_user_id'],'actor'=>$scope['actor']['id']]);if(($assets['partsDisposition']??'')==='transfer_to_new')$pdo->prepare("UPDATE repair_part_issues SET technician_user_id=:to_user WHERE case_id=:case AND technician_user_id=:from_user AND status NOT IN ('consumed','returned')")->execute(['to_user'=>$handover['to_user_id'],'case'=>$handover['case_id'],'from_user'=>$handover['from_user_id']]);if(($assets['hotReturnsDisposition']??'')==='transfer_to_new')$pdo->prepare("UPDATE repair_hot_returns SET technician_user_id=:to_user,updated_at=NOW() WHERE case_id=:case AND technician_user_id=:from_user AND status<>'settled'")->execute(['to_user'=>$handover['to_user_id'],'case'=>$handover['case_id'],'from_user'=>$handover['from_user_id']]);$status=$action==='manager_force'?'manager_forced':'accepted';$pdo->prepare('UPDATE repair_case_handovers SET status=:status,decided_by_user_id=:actor,decided_at=NOW() WHERE id=:id')->execute(['status'=>$status,'actor'=>$scope['actor']['id'],'id'=>$handover['id']]);$pdo->prepare('UPDATE repair_case_workflows SET primary_technician_user_id=:technician,lock_version=lock_version+1 WHERE id=:workflow')->execute(['technician'=>$handover['to_user_id'],'workflow'=>$handover['workflow_id']]);$pdo->prepare('UPDATE repair_cases SET assigned_to_user_id=:technician,row_version=row_version+1 WHERE id=:case')->execute(['technician'=>$handover['to_user_id'],'case'=>$handover['case_id']]);tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.handover.'.$status,'repair_case',$handover['case_public_id'],['primaryTechnicianUserId'=>(int)$handover['from_user_id']],['primaryTechnicianUserId'=>(int)$handover['to_user_id'],'assets'=>$assets],$decisionReason??$handover['reason']);v2_notify($pdo,$scope,(int)$handover['to_user_id'],'case_handover_completed','مسئولیت پرونده به شما منتقل شد','رسید '.$handover['receipt_number'],'repair_case',$handover['case_public_id']);$pdo->commit();}catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}return['decided'=>true,'status'=>$status];
}

function workflow_v2_migrate_case_to_pro(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'case.workflow.migrate',[],'تغییر گردش پرونده فقط برای مدیر مجاز است.');
    if($scope['product_profile']!=='pro')throw new TamiranApiException('ابتدا تعمیرگاه را به Tamiran Pro ارتقا دهید.',409);
    $caseId=(int)($input['caseId']??0);
    $reason=v2_text($input['reason']??'','علت تغییر گردش پرونده',1000);
    $idempotency=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه یکتا',160);
    $existing=$pdo->prepare("SELECT metadata_json FROM repair_case_stage_events e INNER JOIN repair_case_workflows w ON w.id=e.workflow_id WHERE w.shop_id=:shop AND w.case_id=:case AND e.idempotency_key=:key LIMIT 1");
    $existing->execute(['shop'=>$scope['shop_id'],'case'=>$caseId,'key'=>'workflow-migrate:'.$idempotency]);
    if($existing->fetchColumn()!==false)return['migrated'=>true,'replayed'=>true];
    $pdo->beginTransaction();
    try{
        $case=v2_case($pdo,$scope,$caseId,true);
        if($case['locked_at']!==null)throw new TamiranApiException('پرونده بسته قابل تغییر گردش نیست.',409);
        if((string)$case['product_profile_snapshot']!=='solo')throw new TamiranApiException('این پرونده از قبل گردش Pro دارد.',409);
        $candidate=$case;
        $candidate['product_profile_snapshot']='pro';
        $candidate['inventory_mode_snapshot']=$scope['inventory_mode'];
        $candidate['qc_mode_snapshot']=$scope['qc_mode'];
        $policy=v2_product_policy($pdo,$scope,$candidate);
        $map=v2_workflow_maps($policy);
        if(!array_key_exists((string)$case['process_status'],$map[(string)$case['workflow_code']]??[])){
            throw new TamiranApiException('مرحله فعلی پرونده با گردش Pro سازگار نیست.',409);
        }
        $before=['productProfile'=>'solo','inventoryMode'=>$case['inventory_mode_snapshot'],'qcMode'=>$case['qc_mode_snapshot'],'status'=>$case['process_status']];
        $after=['productProfile'=>'pro','inventoryMode'=>$scope['inventory_mode'],'qcMode'=>$scope['qc_mode'],'status'=>$case['process_status']];
        $pdo->prepare('UPDATE repair_cases SET product_profile_snapshot=\'pro\',inventory_mode_snapshot=:inventory,qc_mode_snapshot=:qc,row_version=row_version+1 WHERE id=:case')->execute(['inventory'=>$scope['inventory_mode'],'qc'=>$scope['qc_mode'],'case'=>$caseId]);
        $pdo->prepare("INSERT INTO repair_case_stage_events(public_id,workflow_id,from_status,to_status,actor_user_id,reason,metadata_json,idempotency_key,started_at,ended_at) VALUES(:public,:workflow,:from_status,:to_status,:actor,:reason,:metadata,:key,NOW(),NOW())")->execute(['public'=>tamiran_id(),'workflow'=>$case['id'],'from_status'=>$case['process_status'],'to_status'=>$case['process_status'],'actor'=>$scope['actor']['id'],'reason'=>$reason,'metadata'=>v2_json(['event'=>'CASE_WORKFLOW_UPGRADED','before'=>$before,'after'=>$after]),'key'=>'workflow-migrate:'.$idempotency]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'CASE_WORKFLOW_UPGRADED','repair_case',$case['case_public_id'],$before,$after,$reason);
        $pdo->commit();
    }catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
    return['migrated'=>true,'replayed'=>false];
}

function workflow_v2_add_manual_part(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'case.part.record',['technician'],'ثبت قطعه برای نقش فعلی مجاز نیست.');
    $caseId=(int)($input['caseId']??0);
    $title=v2_text($input['title']??'','نام قطعه',240);
    $quantity=(float)($input['quantity']??0);
    $purchase=max(0,(int)($input['purchaseUnitCost']??0));
    $sale=max(0,(int)($input['saleUnitPrice']??0));
    $note=v2_text($input['note']??'','توضیح قطعه',1000,false);
    $idempotency=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه یکتا',160);
    if($quantity<=0||$quantity>10000||$sale<1)throw new TamiranApiException('تعداد و قیمت فروش قطعه معتبر نیست.');
    $existing=$pdo->prepare('SELECT public_id FROM repair_case_manual_parts WHERE shop_id=:shop AND idempotency_key=:key LIMIT 1');$existing->execute(['shop'=>$scope['shop_id'],'key'=>$idempotency]);$public=$existing->fetchColumn();if(is_string($public))return['created'=>true,'replayed'=>true,'publicId'=>$public];
    $pdo->beginTransaction();
    try{
        $case=v2_case($pdo,$scope,$caseId,true);
        if($case['locked_at']!==null)throw new TamiranApiException('پرونده بسته قابل تغییر نیست.',409);
        if((string)$case['inventory_mode_snapshot']!=='off')throw new TamiranApiException('برای این پرونده قطعه باید از گردش انبار ثبت شود.',409);
        if($scope['role']==='technician'&&(int)$case['primary_technician_user_id']!==(int)$scope['actor']['id'])throw new TamiranApiException('فقط تکنسین مسئول می‌تواند قطعه مصرفی را ثبت کند.',403);
        $public=tamiran_id();
        $pdo->prepare('INSERT INTO repair_case_manual_parts(public_id,shop_id,case_id,title,quantity,purchase_unit_cost,sale_unit_price,note,idempotency_key,created_by_user_id) VALUES(:public,:shop,:case,:title,:quantity,:purchase,:sale,:note,:key,:actor)')->execute(['public'=>$public,'shop'=>$scope['shop_id'],'case'=>$caseId,'title'=>$title,'quantity'=>$quantity,'purchase'=>$purchase,'sale'=>$sale,'note'=>$note,'key'=>$idempotency,'actor'=>$scope['actor']['id']]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'CASE_MANUAL_PART_RECORDED','repair_case',$case['case_public_id'],null,['partPublicId'=>$public,'title'=>$title,'quantity'=>$quantity,'purchaseUnitCost'=>$purchase,'saleUnitPrice'=>$sale]);
        $pdo->commit();
    }catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
    return['created'=>true,'replayed'=>false,'publicId'=>$public];
}

function workflow_v2_estimate(PDO $pdo,array $scope,array $input): array
{
    v2_require_permission($scope,'estimate.manage',['technician','reception'],'ثبت برآورد برای نقش فعلی مجاز نیست.');
    $caseId=(int)($input['caseId']??0);$items=is_array($input['items']??null)?$input['items']:[];
    if($items===[]||count($items)>100)throw new TamiranApiException('حداقل یک ردیف معتبر برای برآورد لازم است.');
    $pdo->beginTransaction();
    try{
        $row=v2_case($pdo,$scope,$caseId,true);if($row['locked_at']!==null)throw new TamiranApiException('پرونده بسته قابل برآورد نیست.',409);
        if($scope['role']==='technician')v2_transition_role_allowed($pdo,$scope,$row,'estimate_pending');
        $revisionStatement=$pdo->prepare('SELECT COALESCE(MAX(revision),0)+1 FROM repair_estimates WHERE case_id=:case FOR UPDATE');$revisionStatement->execute(['case'=>$caseId]);$revision=(int)$revisionStatement->fetchColumn();
        $subtotal=0;$taxTotal=0;$discountTotal=0;$normalized=[];
        foreach($items as $item){
            $type=(string)($item['type']??'');if(!in_array($type,['part','labor','diagnostic','other'],true))throw new TamiranApiException('نوع ردیف برآورد معتبر نیست.');
            $title=v2_text($item['title']??'','عنوان ردیف',240);$quantity=(float)($item['quantity']??1);$unit=max(0,(int)($item['unitPrice']??0));$discount=max(0,(int)($item['discountAmount']??0));$taxRate=(float)($item['taxRate']??0);
            if($quantity<=0||$taxRate<0||$taxRate>100)throw new TamiranApiException('تعداد یا مالیات ردیف معتبر نیست.');
            $base=(int)round($quantity*$unit);if($discount>$base)throw new TamiranApiException('تخفیف از مبلغ ردیف بیشتر است.');
            if($discount>0&&$scope['role']!=='repair_manager')throw new TamiranApiException('ثبت تخفیف فقط برای مدیر مجاز است.',403);
            $tax=(int)round(($base-$discount)*$taxRate/100);$line=$base-$discount+$tax;
            $subtotal+=$base;$discountTotal+=$discount;$taxTotal+=$tax;$normalized[]=[$type,$item['referenceId']??null,$title,$quantity,$unit,$discount,$taxRate,$tax,$line];
        }
        $diagnostic=max(0,(int)($input['diagnosticFee']??0));$total=$subtotal-$discountTotal+$taxTotal+$diagnostic;$requiresCustomerApproval=$total>(int)$row['preapproved_amount'];$status=$requiresCustomerApproval?'draft':'approved';
        $number='EST-'.$scope['shop_id'].'-'.$caseId.'-'.$revision;$public=tamiran_id();
        $pdo->prepare('UPDATE repair_estimates SET status=\'superseded\' WHERE case_id=:case AND status IN (\'draft\',\'sent\',\'explanation_requested\')')->execute(['case'=>$caseId]);
        $pdo->prepare("INSERT INTO repair_estimates(public_id,shop_id,case_id,estimate_number,status,diagnostic_fee,subtotal_amount,discount_amount,tax_amount,total_amount,valid_until,customer_note,internal_note,revision,created_by_user_id,decided_at) VALUES(:public,:shop,:case,:number,:status,:diagnostic,:subtotal,:discount,:tax,:total,:valid_until,:customer_note,:internal_note,:revision,:creator,:decided_at)")
            ->execute(['public'=>$public,'shop'=>$scope['shop_id'],'case'=>$caseId,'number'=>$number,'status'=>$status,'diagnostic'=>$diagnostic,'subtotal'=>$subtotal,'discount'=>$discountTotal,'tax'=>$taxTotal,'total'=>$total,'valid_until'=>$input['validUntil']??null,'customer_note'=>v2_text($input['customerNote']??'','یادداشت مشتری',4000,false),'internal_note'=>v2_text($input['internalNote']??'','یادداشت داخلی',4000,false),'revision'=>$revision,'creator'=>$scope['actor']['id'],'decided_at'=>$requiresCustomerApproval?null:date('Y-m-d H:i:s')]);
        $estimateId=(int)$pdo->lastInsertId();$insert=$pdo->prepare('INSERT INTO repair_estimate_items(estimate_id,item_type,reference_id,title,quantity,unit_price,discount_amount,tax_rate,tax_amount,line_total) VALUES(:estimate,:type,:reference,:title,:quantity,:unit,:discount,:tax_rate,:tax,:line)');
        foreach($normalized as $line)$insert->execute(['estimate'=>$estimateId,'type'=>$line[0],'reference'=>$line[1],'title'=>$line[2],'quantity'=>$line[3],'unit'=>$line[4],'discount'=>$line[5],'tax_rate'=>$line[6],'tax'=>$line[7],'line'=>$line[8]]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'estimate.create','repair_estimate',$public,null,['total'=>$total,'revision'=>$revision,'status'=>$status],v2_text($input['reason']??'برآورد پس از عیب‌یابی','علت',1000));$pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    return ['publicId'=>$public,'totalAmount'=>$total,'revision'=>$revision,'requiresCustomerApproval'=>$requiresCustomerApproval];
}

function workflow_v2_update_promise(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'case.promise.update',['technician','reception'],'تغییر موعد مجاز نیست.');
    $caseId=(int)($input['caseId']??0);
    $promised=v2_text($input['promisedAt']??'','موعد',40);
    $parsed=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$promised,new DateTimeZone('UTC'));
    if(!$parsed||$parsed->format('Y-m-d H:i:s')!==$promised)throw new TamiranApiException('موعد وعده‌داده‌شده معتبر نیست.');
    $reason=v2_text($input['reason']??'تغییر وعده','علت',1000);
    $pdo->beginTransaction();
    try{
        $row=v2_case($pdo,$scope,$caseId,true);
        if($row['locked_at']!==null)throw new TamiranApiException('پرونده بسته قابل تغییر نیست.',409);
        if($scope['role']==='technician'&&(int)$row['primary_technician_user_id']!==(int)$scope['actor']['id'])throw new TamiranApiException('فقط تکنسین مسئول می‌تواند موعد را تغییر دهد.',403);
        $pdo->prepare('UPDATE repair_case_workflows SET promised_at=:promised,lock_version=lock_version+1 WHERE id=:id')->execute(['promised'=>$promised,'id'=>$row['id']]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.promise.update','repair_case',$row['case_public_id'],['promisedAt'=>$row['promised_at']],['promisedAt'=>$promised],$reason);
        $pdo->commit();
    }catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
    return['updated'=>true];
}

function workflow_v2_estimate_decide(PDO $pdo,array $scope,array $input): array
{
    $public=v2_text($input['estimatePublicId']??'','برآورد',80);$decision=(string)($input['decision']??'');$channel=(string)($input['channel']??'');
    if(!in_array($decision,['approved','rejected','explanation_requested'],true)||!in_array($channel,['recorded_phone','sms_otp','in_person_signature','secure_portal'],true))throw new TamiranApiException('تصمیم یا روش تأیید معتبر نیست.');
    $statement=$pdo->prepare('SELECT e.*,c.public_id AS case_public_id,cu.mobile FROM repair_estimates e INNER JOIN repair_cases c ON c.id=e.case_id INNER JOIN repair_customers cu ON cu.id=c.customer_id WHERE e.public_id=:public AND e.shop_id=:shop LIMIT 1');$statement->execute(['public'=>$public,'shop'=>$scope['shop_id']]);$estimate=$statement->fetch();if(!is_array($estimate))throw new TamiranApiException('برآورد پیدا نشد.',404);
    v2_case($pdo,$scope,(int)$estimate['case_id']);
    if(in_array($channel,['recorded_phone','in_person_signature'],true)&&!v2_has_permission($scope,'estimate.record_customer_decision',['reception']))throw new TamiranApiException('ثبت این روش تأیید برای نقش فعلی مجاز نیست.',403);
    $mobile=tamiran_mobile((string)$estimate['mobile']);
    if(in_array($channel,['sms_otp','secure_portal'],true)){
        if(!function_exists('tamiran_sms_verify_otp'))throw new TamiranApiException('سرویس OTP پیکربندی نشده است.',503);
        $verified=tamiran_sms_verify_otp($pdo,$scope['shop_id'],'estimate',(string)$public,$mobile,(string)($input['otpRequestId']??''),(string)($input['otpCode']??''));
        if(!$verified)throw new TamiranApiException('کد یک‌بارمصرف معتبر نیست.',403);
    }
    $pdo->beginTransaction();
    try{
        $lock=$pdo->prepare('SELECT status FROM repair_estimates WHERE id=:id FOR UPDATE');$lock->execute(['id'=>$estimate['id']]);$status=$lock->fetchColumn();if(!in_array($status,['sent','explanation_requested'],true))throw new TamiranApiException('این برآورد در وضعیت قابل تصمیم نیست.',409);
        $pdo->prepare('UPDATE repair_estimates SET status=:decision,decided_at=NOW() WHERE id=:id')->execute(['decision'=>$decision,'id'=>$estimate['id']]);
        $approvalPublic=tamiran_id();$pdo->prepare('INSERT INTO repair_estimate_approvals(public_id,estimate_id,decision,channel,customer_mobile,otp_request_id,recorded_by_user_id,decision_reason,evidence_json) VALUES(:public,:estimate,:decision,:channel,:mobile,:otp,:actor,:reason,:evidence)')
            ->execute(['public'=>$approvalPublic,'estimate'=>$estimate['id'],'decision'=>$decision,'channel'=>$channel,'mobile'=>$mobile,'otp'=>$input['otpRequestId']??null,'actor'=>$scope['actor']['id'],'reason'=>v2_text($input['reason']??'','علت تصمیم',1000,false),'evidence'=>v2_json($input['evidence']??[])]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'estimate.decision','repair_estimate',$public,['status'=>$status],['status'=>$decision,'channel'=>$channel],v2_text($input['reason']??'','علت',1000,false));$pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    $transitionedCase=null;
    if($decision==='rejected'){
        $case=v2_case($pdo,$scope,(int)$estimate['case_id']);
        if($case['process_status']==='awaiting_customer_approval'){
            $rejectionReason=v2_text($input['reason']??'','علت رد برآورد',1000)??'رد برآورد توسط مشتری';
            $transitionedCase=v2_transition(
                $pdo,
                $scope,
                (int)$estimate['case_id'],
                'returned_unrepaired',
                $rejectionReason,
                (int)$case['lock_version'],
                'estimate-rejected:'.$approvalPublic,
                true
            );
        }
    }
    return ['decided'=>true,'decision'=>$decision,'approvalPublicId'=>$approvalPublic,'case'=>$transitionedCase];
}

tamiran_api(static function():array{
    $pdo=tamiran_db();$scope=v2_scope();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET')return workflow_v2_payload($pdo,$scope,isset($_GET['caseId'])?(int)$_GET['caseId']:null,isset($_GET['q'])?(string)$_GET['q']:null);
    if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);
    tamiran_require_csrf();$input=tamiran_json_body();$action=(string)($input['action']??'');
    return match($action){
        'transition'=>['case'=>v2_transition($pdo,$scope,(int)($input['caseId']??0),(string)($input['target']??''),v2_text($input['reason']??'','علت',1000,false),(int)($input['lockVersion']??-1),v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه یکتا',160))],
        'assign'=>['case'=>workflow_v2_assign($pdo,$scope,$input)],
        'collaborator_add'=>workflow_v2_add_collaborator($pdo,$scope,$input),
        'handover_request'=>workflow_v2_handover_request($pdo,$scope,$input),
        'handover_decide'=>workflow_v2_handover_decide($pdo,$scope,$input),
        'migrate_case_to_pro'=>workflow_v2_migrate_case_to_pro($pdo,$scope,$input),
        'manual_part_add'=>workflow_v2_add_manual_part($pdo,$scope,$input),
        'estimate_create'=>['estimate'=>workflow_v2_estimate($pdo,$scope,$input)],
        'estimate_send'=>(function()use($pdo,$scope,$input){v2_require_permission($scope,'estimate.send',['reception','technician'],'ارسال برآورد مجاز نیست.');$public=v2_text($input['estimatePublicId']??'','برآورد',80);$lookup=$pdo->prepare('SELECT case_id FROM repair_estimates WHERE public_id=:public AND shop_id=:shop LIMIT 1');$lookup->execute(['public'=>$public,'shop'=>$scope['shop_id']]);$caseId=$lookup->fetchColumn();if($caseId===false)throw new TamiranApiException('برآورد پیدا نشد.',404);$case=v2_case($pdo,$scope,(int)$caseId);if($scope['role']==='technician')v2_transition_role_allowed($pdo,$scope,$case,'estimate_pending');$update=$pdo->prepare("UPDATE repair_estimates SET status='sent',sent_at=NOW() WHERE public_id=:public AND shop_id=:shop AND status='draft'");$update->execute(['public'=>$public,'shop'=>$scope['shop_id']]);if($update->rowCount()!==1)throw new TamiranApiException('برآورد قابل ارسال نیست.',409);return ['sent'=>true];})(),
        'estimate_decide'=>['approval'=>workflow_v2_estimate_decide($pdo,$scope,$input)],
        'update_promise'=>workflow_v2_update_promise($pdo,$scope,$input),
        default=>throw new TamiranApiException('عملیات فرایندی معتبر نیست.'),
    };
});
