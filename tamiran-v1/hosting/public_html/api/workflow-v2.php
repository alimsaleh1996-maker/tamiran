<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once tamiran_private_root() . '/v2-core.php';
$smsService=tamiran_private_root().'/sms-service.php';
if(is_file($smsService)) require_once $smsService;

function workflow_v2_technician_view(array $row, array $allowedTransitions): array
{
    $status=(string)$row['process_status'];
    $receiptPending = !empty($row['physical_receipt_pending']);
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
    if ($receiptPending) {
        $group = 'action_required';
        $labels[$status] = 'منتظر تأیید دریافت';
        $primary = ['key'=>'receive_device','label'=>'تأیید دریافت دستگاه','target'=>null];
    }
    $flags=[];
    if($status==='qc_rework')$flags[]='qc_rework';
    if(($row['case_kind']??'')==='warranty_return')$flags[]='warranty';
    if($status==='awaiting_parts')$flags[]='waiting_part';
    if(!empty($row['promised_at'])&&strtotime((string)$row['promised_at'])<time()&&!in_array($status,$completed,true))$flags[]='sla_overdue';
    $manualPriority=$row['manager_priority']??'normal';
    $priority=match($manualPriority){'critical'=>95,'urgent'=>80,default=>50};
    if ($status==='qc_rework') $priority=100;
    elseif (in_array('sla_overdue',$flags,true)) $priority=max($priority,90);
    return[
        'group'=>$group,'statusLabel'=>$labels[$status]??$status,'priority'=>$priority,
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
        $where.=' AND (c.receipt_number LIKE :query_receipt'.$receiptFilter.$trackingFilter.' OR cu.mobile LIKE :query_mobile OR c.identifier_snapshot LIKE :query_identifier OR c.serial_number_snapshot LIKE :query_serial OR c.imei_snapshot LIKE :query_imei OR c.model_snapshot LIKE :query_model OR c.brand_snapshot LIKE :query_brand OR cu.full_name LIKE :query_customer)';
        $queryPattern='%'.$query.'%';
        $params['query_receipt']=$queryPattern;
        $params['query_mobile']=$queryPattern;
        $params['query_identifier']=$queryPattern;
        $params['query_serial']=$queryPattern;
        $params['query_imei']=$queryPattern;
        $params['query_model']=$queryPattern;
        $params['query_brand']=$queryPattern;
        $params['query_customer']=$queryPattern;
    }
    if($scope['role']==='technician'){$where.=' AND (w.primary_technician_user_id=:actor OR EXISTS(SELECT 1 FROM repair_case_assignments a WHERE a.workflow_id=w.id AND a.technician_user_id=:actor2 AND a.ended_at IS NULL))';$params['actor']=$scope['actor']['id'];$params['actor2']=$scope['actor']['id'];}
    $receiptPendingSql = v2_receipt_pending_sql();
    $statement=$pdo->prepare("SELECT w.*,(SELECT JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.payload.priority'))
        FROM repair_case_events e WHERE e.case_id=w.case_id AND e.event_type='manager_priority' ORDER BY e.id DESC LIMIT 1) AS manager_priority,{$receiptPendingSql} AS physical_receipt_pending,(SELECT ie.metadata_json FROM repair_case_stage_events ie WHERE ie.workflow_id=w.id AND ie.from_status IS NULL ORDER BY ie.id LIMIT 1) AS reception_identity_event,c.public_id AS case_public_id,c.receipt_number,c.declared_issue,c.device_type_snapshot,c.brand_snapshot,c.model_snapshot,c.identifier_snapshot,c.serial_number_snapshot,c.imei_snapshot,c.product_profile_snapshot,c.inventory_mode_snapshot,c.qc_mode_snapshot,c.feature_flags_snapshot_json,c.created_at AS accepted_at,c.delivered_at,(SELECT MAX(e.started_at) FROM repair_case_stage_events e WHERE e.workflow_id=w.id AND e.to_status IN ('ready_for_delivery','returned_unrepaired')) AS pickup_started_at,cu.full_name AS customer_name,cu.mobile AS customer_mobile,u.display_name AS technician_name FROM repair_case_workflows w INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN repair_customers cu ON cu.id=c.customer_id LEFT JOIN tamiran_users u ON u.id=w.primary_technician_user_id WHERE {$where} ORDER BY w.updated_at DESC LIMIT 500");
    $statement->execute($params);$rows=$statement->fetchAll();$defaultPolicy=v2_product_policy($pdo,$scope);$maps=v2_workflow_maps($defaultPolicy);
    $manualPartsByCase=[];$latestEstimateByCase=[];
    $caseIds=array_values(array_unique(array_map(static fn(array $row):int=>(int)$row['case_id'],$rows)));
    if($caseIds!==[]){
        $placeholders=implode(',',array_fill(0,count($caseIds),'?'));
        $manualPartsStatement=$pdo->prepare("SELECT case_id,public_id,title,quantity,purchase_unit_cost,sale_unit_price,note,created_at FROM repair_case_manual_parts WHERE shop_id=? AND case_id IN ({$placeholders}) ORDER BY id");
        $manualPartsStatement->execute(array_merge([(int)$scope['shop_id']],$caseIds));
        foreach($manualPartsStatement->fetchAll() as $part)$manualPartsByCase[(int)$part['case_id']][]=[
            'publicId'=>$part['public_id'],'title'=>$part['title'],'quantity'=>(float)$part['quantity'],
            'purchaseUnitCost'=>technician_purchase_allowed($scope)?(int)$part['purchase_unit_cost']:0,'saleUnitPrice'=>(int)$part['sale_unit_price'],
            'note'=>$part['note']??'','createdAt'=>$part['created_at'],
        ];
        $estimateStatement=$pdo->prepare("SELECT e.case_id,e.public_id,e.status,e.total_amount,e.sent_at,
            (SELECT COALESCE(SUM(i.line_total),0) FROM repair_estimate_items i WHERE i.estimate_id=e.id AND i.item_type='part') AS parts_amount,
            (SELECT COALESCE(SUM(i.line_total),0) FROM repair_estimate_items i WHERE i.estimate_id=e.id AND i.item_type='labor') AS labor_amount
            FROM repair_estimates e INNER JOIN (SELECT case_id,MAX(revision) AS revision FROM repair_estimates WHERE case_id IN ({$placeholders}) GROUP BY case_id) latest ON latest.case_id=e.case_id AND latest.revision=e.revision WHERE e.case_id IN ({$placeholders})");
        $estimateStatement->execute(array_merge($caseIds,$caseIds));
        foreach($estimateStatement->fetchAll() as $estimate)$latestEstimateByCase[(int)$estimate['case_id']]=[
            'publicId'=>$estimate['public_id'],'status'=>$estimate['status'],'totalAmount'=>(int)$estimate['total_amount'],'sentAt'=>$estimate['sent_at'],
            'partsAmount'=>(int)$estimate['parts_amount'],'laborAmount'=>(int)$estimate['labor_amount'],
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
            'receiptPending'=>!empty($row['physical_receipt_pending']),'isLocked'=>$row['locked_at']!==null,'customerName'=>$row['customer_name'],
            'customerMobile'=>in_array($scope['role'],['repair_manager','reception','finance_cashier'],true)?$row['customer_mobile']:'',
            'deviceTitle'=>trim($row['device_type_snapshot'].' '.$row['brand_snapshot'].' '.$row['model_snapshot']),
            'initialIdentityReason'=>(json_decode((string)($row['reception_identity_event']??'{}'),true)['identity']['unavailableReason']??''),'identifier'=>$row['identifier_snapshot']??'','serialNumber'=>$row['serial_number_snapshot']??'','imei'=>$row['imei_snapshot']??'','declaredIssue'=>$row['declared_issue'],'declaredIssues'=>technician_declared_issues($row['reception_identity_event']??null,$row['declared_issue']),'dataHandling'=>$dataHandling,'technicianName'=>$row['technician_name']??'',
            'primaryTechnicianUserId'=>$row['primary_technician_user_id']===null?null:(int)$row['primary_technician_user_id'],
            'preapprovedAmount'=>(int)$row['preapproved_amount'],'promisedAt'=>$row['promised_at'],'waitStartedAt'=>$row['wait_started_at'],'acceptedAt'=>$row['accepted_at'],
            'allowedTransitions'=>$allowedTransitions,
            'mainState'=>v2_main_state((string)$row['process_status']),'holdReason'=>v2_hold_reason((string)$row['process_status']),
            'closureOutcome'=>v2_closure_outcome((string)$row['process_status']),'closureReason'=>$row['terminal_reason']??null,
            'technicianView'=>workflow_v2_technician_view($row,$allowedTransitions),
            'blockers'=>v2_case_blockers($pdo,$scope,$row),
            'productProfile'=>$row['product_profile_snapshot'],'inventoryMode'=>$row['inventory_mode_snapshot'],'qcMode'=>$row['qc_mode_snapshot'],
            'manualParts'=>$manualPartsByCase[(int)$row['case_id']]??[],
            'latestEstimate'=>$latestEstimateByCase[(int)$row['case_id']]??null,
            'updatedAt'=>$row['updated_at'],'priority'=>$row['manager_priority']??'normal','deliveredAt'=>$row['delivered_at'],'pickupStartedAt'=>$row['pickup_started_at'],
        ];
    }
    $usersStatement=$pdo->prepare("SELECT DISTINCT u.id,u.display_name,ub.branch_role_code AS role FROM tamiran_users u INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.shop_id=:shop AND ub.branch_id=:branch AND ub.is_active=1 AND u.is_active=1 AND ub.branch_role_code IN ('technician','quality_control','repair_manager') ORDER BY u.display_name");
    $usersStatement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $assignmentWhere='w.shop_id=:assignment_shop AND w.branch_id=:assignment_branch';$assignmentParams=['assignment_shop'=>$scope['shop_id'],'assignment_branch'=>$scope['branch_id']];if($scope['role']==='technician'){$assignmentWhere.=' AND a.technician_user_id=:assignment_actor';$assignmentParams['assignment_actor']=$scope['actor']['id'];}$assignments=$pdo->prepare("SELECT a.*,w.case_id,c.receipt_number,u.display_name AS technician_name FROM repair_case_assignments a INNER JOIN repair_case_workflows w ON w.id=a.workflow_id INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN tamiran_users u ON u.id=a.technician_user_id WHERE {$assignmentWhere} ORDER BY a.created_at DESC LIMIT 1000");$assignments->execute($assignmentParams);
    $handoverWhere='w.shop_id=:handover_shop AND w.branch_id=:handover_branch';$handoverParams=['handover_shop'=>$scope['shop_id'],'handover_branch'=>$scope['branch_id']];if($scope['role']==='technician'){$handoverWhere.=' AND (h.from_user_id=:handover_actor OR h.to_user_id=:handover_actor2)';$handoverParams['handover_actor']=$scope['actor']['id'];$handoverParams['handover_actor2']=$scope['actor']['id'];}$handovers=$pdo->prepare("SELECT h.*,w.case_id,c.receipt_number,fu.display_name AS from_user_name,tu.display_name AS to_user_name FROM repair_case_handovers h INNER JOIN repair_case_workflows w ON w.id=h.workflow_id INNER JOIN repair_cases c ON c.id=w.case_id INNER JOIN tamiran_users fu ON fu.id=h.from_user_id INNER JOIN tamiran_users tu ON tu.id=h.to_user_id WHERE {$handoverWhere} ORDER BY h.requested_at DESC LIMIT 500");$handovers->execute($handoverParams);
    $policy=operations_policy($pdo,(int)$scope['shop_id']);
    if ($scope['role']!=='repair_manager') {
        $id=(int)$scope['actor']['id'];
        $policy['purchaseLimits']=array_intersect_key($policy['purchaseLimits'],[$id=>true]);
    }
    return ['cases'=>$cases,'users'=>$usersStatement->fetchAll(),'assignments'=>$assignments->fetchAll(),'handovers'=>$handovers->fetchAll(),'workflowMaps'=>$maps,'productPolicy'=>$defaultPolicy,'operationsPolicy'=>$policy,'serverTime'=>gmdate('c')];
}

function workflow_v2_assign(PDO $pdo, array $scope, array $input): array
{
    v2_require_permission($scope, 'case.assign', ['reception'], 'تخصیص پرونده برای نقش فعلی مجاز نیست.');
    $caseId = (int) ($input['caseId'] ?? 0);
    $technicianId = (int) ($input['technicianUserId'] ?? 0);
    $reason = v2_text($input['reason'] ?? 'تخصیص پرونده', 'علت', 1000);
    $key = v2_text($input['idempotencyKey'] ?? '', 'شناسه تخصیص', 160, false);
    $payload = ['technicianUserId' => $technicianId, 'reason' => $reason];

    $pdo->beginTransaction();
    try {
        $case = v2_case($pdo, $scope, $caseId, true);
        if ($key !== null && technician_replay($pdo, $case, $scope, 'technical_assignment', $key, $payload)) {
            $pdo->commit();
            return $case;
        }
        if ($case['locked_at'] !== null) {
            throw new TamiranApiException('پرونده بسته قابل تخصیص نیست.', 409);
        }
        $initial = in_array($case['process_status'], ['reception', 'awaiting_assignment'], true);
        $previous = (int) $case['primary_technician_user_id'];
        if ($previous > 0 && $previous !== $technicianId) {
            throw new TamiranApiException('تغییر تکنسین مسئول فقط با تحویل رسمی انجام می‌شود.', 409);
        }
        // Legacy clients may retry an already completed assignment without a key.
        if ($previous > 0 && !$initial) {
            $pdo->commit();
            return $case;
        }
        if (isset($input['lockVersion']) && (int) $input['lockVersion'] !== (int) $case['lock_version']) {
            throw new TamiranApiException('پرونده تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.', 409);
        }
        technician_editable($case, requireReceipt: false);
        workflow_v2_active_technician($pdo, $scope, $technicianId);
        if ($previous === 0) {
            $pdo->prepare("UPDATE repair_case_assignments SET ended_at=NOW() WHERE workflow_id=:workflow AND assignment_type='primary' AND ended_at IS NULL")
                ->execute(['workflow' => $case['id']]);
            $pdo->prepare("INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,created_by_user_id,started_at,accepted_at) VALUES(:public,:workflow,:technician,'primary','مسئول اصلی تعمیر',:actor,NOW(),NULL)")
                ->execute(['public' => tamiran_id(), 'workflow' => $case['id'], 'technician' => $technicianId, 'actor' => $scope['actor']['id']]);
            $pdo->prepare('UPDATE repair_case_workflows SET primary_technician_user_id=:technician,lock_version=lock_version+1 WHERE id=:id')
                ->execute(['technician' => $technicianId, 'id' => $case['id']]);
            $pdo->prepare('UPDATE repair_cases SET assigned_to_user_id=:technician,row_version=row_version+1 WHERE id=:case')
                ->execute(['technician' => $technicianId, 'case' => $caseId]);
            tamiran_audit($pdo, $scope['shop_id'], $scope['branch_id'], $scope['actor']['id'], 'case.assign', 'repair_case', $case['case_public_id'], ['technician' => null], ['technician' => $technicianId], $reason);
            v2_notify($pdo, $scope, $technicianId, 'case_assigned', 'پرونده جدید به شما تخصیص یافت', 'رسید '.$case['receipt_number'], 'repair_case', $case['case_public_id']);
        }
        $fresh = v2_case($pdo, $scope, $caseId);
        if ($initial) {
            // case.assign already authorized this server-controlled transition.
            $fresh = v2_transition($pdo, $scope, $caseId, 'assigned', $reason, (int) $fresh['lock_version'], automatic: true, insideTransaction: true);
        }
        if ($key !== null) {
            technician_event($pdo, $scope, $case, 'technical_assignment', $key, $payload);
        }
        $pdo->commit();
        return $fresh;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
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
    $caseId=(int)($input['caseId']??0);
    $toUserId=(int)($input['toUserId']??0);
    $reason=v2_text($input['reason']??'','توضیحات ارجاع',800,false)??'';
    $reasonId=v2_text($input['reasonId']??'','شناسه علت ارجاع',48,false)??'other';
    $partsDisposition=(string)($input['partsDisposition']??'');
    $hotDisposition=(string)($input['hotReturnsDisposition']??'');
    $allowed=['transfer_to_new','remain_with_previous','settle_before_handover'];
    if (!in_array($partsDisposition,$allowed,true)||!in_array($hotDisposition,$allowed,true)) {
        throw new TamiranApiException('تعیین تکلیف قطعات و داغی الزامی است.');
    }
    $key=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه ارجاع',160);
    $payload=['toUserId'=>$toUserId,'reason'=>$reason,'partsDisposition'=>$partsDisposition,'hotReturnsDisposition'=>$hotDisposition,
        'toolsNote'=>v2_text($input['toolsNote']??'','تعیین تکلیف ابزار',2000,false)??''];
    if (isset($input['reasonId'])) $payload['reasonId']=$reasonId;
    $pdo->beginTransaction();
    try {
        $case=v2_case($pdo,$scope,$caseId,true);
        $fromUserId=(int)$case['primary_technician_user_id'];
        if ($fromUserId<1) throw new TamiranApiException('پرونده مسئول ندارد.',409);
        $manager=$scope['role']==='repair_manager';
        if (!$manager && ($scope['role']!=='technician'||$fromUserId!==(int)$scope['actor']['id'])) {
            throw new TamiranApiException('فقط تکنسین مسئول یا مدیر می‌تواند تحویل رسمی بسازد.',403);
        }
        if ($old=technician_replay($pdo,$case,$scope,'technical_referral_request',$key,$payload)) {
            $pdo->commit();
            return $old;
        }
        if ($fromUserId===$toUserId) throw new TamiranApiException('تحویل‌گیرنده باید با مسئول فعلی متفاوت باشد.',409);
        if ($case['product_profile_snapshot']==='solo') throw new TamiranApiException('ارجاع بین تکنسین‌ها در پرونده Solo فعال نیست.',409);
        $rules=operations_policy($pdo,(int)$scope['shop_id']);
        if (!$manager && $rules['handover']==='disabled') throw new TamiranApiException('ارجاع در این تعمیرگاه فقط توسط مدیر ثبت می‌شود.',403);
        $labels=array_column(array_filter($rules['reasons'],static fn(array $r): bool=>$r['active']), 'title','id');
        if (!isset($labels[$reasonId])||($reasonId==='other'&&$reason==='')) throw new TamiranApiException('علت معتبر ارجاع و توضیح سایر موارد لازم است.');
        $label=isset($input['reasonId'])?$labels[$reasonId].($reason!==''?' — '.$reason:''):$reason;
        workflow_v2_active_technician($pdo,$scope,$toUserId);
        technician_editable($case, requireReceipt: false);
        $duplicate=$pdo->prepare("SELECT id FROM repair_case_handovers WHERE workflow_id=:workflow AND status='requested' LIMIT 1 FOR UPDATE");
        $duplicate->execute(['workflow'=>$case['id']]);
        if ($duplicate->fetchColumn()!==false) throw new TamiranApiException('برای پرونده یک تحویل در انتظار تأیید وجود دارد.',409);
        $issues=$pdo->prepare("SELECT public_id,quantity,status FROM repair_part_issues WHERE case_id=:case AND technician_user_id=:technician AND status NOT IN ('consumed','returned') FOR UPDATE");
        $issues->execute(['case'=>$caseId,'technician'=>$fromUserId]);
        $hot=$pdo->prepare("SELECT public_id,quantity,status FROM repair_hot_returns WHERE case_id=:case AND technician_user_id=:technician AND status<>'settled' FOR UPDATE");
        $hot->execute(['case'=>$caseId,'technician'=>$fromUserId]);
        $assets=['receiptVersion'=>1,'reasonId'=>$reasonId,'reasonLabel'=>$labels[$reasonId],
            'managerApprovalRequired'=>!$manager && $rules['handover']==='manager',
            'partsDisposition'=>$partsDisposition,'hotReturnsDisposition'=>$hotDisposition,
            'partIssues'=>$issues->fetchAll(),'hotReturns'=>$hot->fetchAll(),'toolsNote'=>$payload['toolsNote']];
        $public=tamiran_id();
        $pdo->prepare("INSERT INTO repair_case_handovers(public_id,workflow_id,from_user_id,to_user_id,status,reason,assets_json) VALUES(:public,:workflow,:from_user,:to_user,'requested',:reason,:assets)")
            ->execute(['public'=>$public,'workflow'=>$case['id'],'from_user'=>$fromUserId,'to_user'=>$toUserId,'reason'=>$label,'assets'=>v2_json($assets)]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.handover.request','repair_case',$case['case_public_id'],['primaryTechnicianUserId'=>$fromUserId],['requestedTechnicianUserId'=>$toUserId,'assets'=>$assets],$label);
        if (!$assets['managerApprovalRequired']) v2_notify($pdo,$scope,$toUserId,'case_handover_requested','تحویل پرونده منتظر تأیید شماست','رسید '.$case['receipt_number'],'repair_case_handover',$public);
        $result=['created'=>true,'publicId'=>$public,'requiresManagerApproval'=>$assets['managerApprovalRequired']];
        technician_event($pdo,$scope,$case,'technical_referral_request',$key,$payload,$result);
        $pdo->commit();
        return $result;
    } catch(Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function workflow_v2_handover_row(PDO $pdo, array $scope, string $public, bool $lock): array
{
    $statement = $pdo->prepare(
        'SELECT h.*,w.case_id,c.public_id AS case_public_id,c.receipt_number,fu.display_name AS from_user_name,tu.display_name AS to_user_name
         FROM repair_case_handovers h INNER JOIN repair_case_workflows w ON w.id=h.workflow_id
         INNER JOIN repair_cases c ON c.id=w.case_id AND c.shop_id=w.shop_id
         INNER JOIN tamiran_users fu ON fu.id=h.from_user_id INNER JOIN tamiran_users tu ON tu.id=h.to_user_id
         WHERE h.public_id=:public AND w.shop_id=:shop AND w.branch_id=:branch' . ($lock ? ' FOR UPDATE' : '')
    );
    $statement->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $handover = $statement->fetch();
    if (!is_array($handover)) throw new TamiranApiException('رسید ارجاع پیدا نشد.', 404);
    return $handover;
}

function workflow_v2_handover_snapshot(PDO $pdo, array $scope, array $handover, array $case, array $assets, bool $lock): array
{
    $params = ['case'=>$case['case_id'],'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'technician'=>$handover['from_user_id']];
    $issues = $pdo->prepare("SELECT i.public_id AS publicId, COALESCE(k.title,'قطعه'), i.quantity,i.status
        FROM repair_part_issues i LEFT JOIN repair_inventory_items k ON k.id=i.item_id AND k.shop_id=i.shop_id
        WHERE i.case_id=:case AND i.shop_id=:shop AND i.branch_id=:branch AND i.technician_user_id=:technician
        AND i.status NOT IN ('consumed','returned') ORDER BY i.id" . ($lock ? ' FOR UPDATE' : ''));
    $issues->execute($params);
    $outstanding = $issues->fetchAll(PDO::FETCH_NUM);
    $hot = $pdo->prepare("SELECT h.public_id AS publicId, COALESCE(k.title,'قطعه'), h.quantity,h.status
        FROM repair_hot_returns h LEFT JOIN repair_inventory_items k ON k.id=h.item_id AND k.shop_id=h.shop_id
        WHERE h.case_id=:case AND h.shop_id=:shop AND h.branch_id=:branch AND h.technician_user_id=:technician
        AND h.status<>'settled' ORDER BY h.id" . ($lock ? ' FOR UPDATE' : ''));
    $hot->execute($params);
    $rows = static fn(array $rows): array => array_map(
        static fn(array $row): array => ['publicId'=>$row[0],'title'=>$row[1],'quantity'=>(int)$row[2],'status'=>$row[3]],
        $rows
    );
    $installed = array_map(
        static fn(array $part): array => ['publicId'=>$part['sourceKey'],'title'=>$part['title'],'quantity'=>(int)$part['quantity'],'status'=>'consumed'],
        technician_billable_parts($pdo, (int)$case['case_id'])
    );
    $accessories = json_decode((string)$case['accessories_json'], true);
    $activity = $pdo->prepare("SELECT id,description AS text FROM repair_case_events
        WHERE case_id=:case AND event_type='technical_activity' ORDER BY id DESC LIMIT 8");
    $activity->execute(['case'=>$case['case_id']]);
    return [
        'publicId'=>$handover['public_id'],
        'receiptNumber'=>$handover['receipt_number'],
        'deviceTitle'=>trim($case['device_type_snapshot'].' '.$case['brand_snapshot'].' '.$case['model_snapshot']),
        'identifier'=>$case['identifier_snapshot'],
        'fromName'=>$handover['from_user_name'],
        'toName'=>$handover['to_user_name'],
        'reason'=>$handover['reason'],
        'accessories'=>is_array($accessories)?array_values($accessories):[],
        'partIssues'=>$rows($outstanding),
        'activities'=>$activity->fetchAll(),
        'installedParts'=>$installed,
        'hotReturns'=>$rows($hot->fetchAll(PDO::FETCH_NUM)),
        'partsDisposition'=>$assets['partsDisposition'] ?? '',
        'hotReturnsDisposition'=>$assets['hotReturnsDisposition'] ?? '',
        'toolsNote'=>$assets['toolsNote'] ?? null,
    ];
}

function workflow_v2_handover_receipt(PDO $pdo, array $scope, mixed $value): array
{
    $public = v2_text($value, 'ارجاع پرونده', 80);
    $handover = workflow_v2_handover_row($pdo, $scope, $public, false);
    $actor = (int)$scope['actor']['id'];
    if ($scope['role'] !== 'repair_manager' && !in_array($actor, [(int)$handover['from_user_id'],(int)$handover['to_user_id']], true)) {
        throw new TamiranApiException('مشاهدهٔ این رسید برای شما مجاز نیست.', 403);
    }
    $assets = json_decode((string)$handover['assets_json'], true, flags: JSON_THROW_ON_ERROR);
    if ($handover['status']==='accepted' && isset($assets['acceptedReceipt'])) {
        return ['receipt'=>$assets['acceptedReceipt'],'status'=>'accepted','revision'=>null,'discrepancy'=>null];
    }
    if (!empty($assets['managerApprovalRequired'])&&empty($assets['managerApprovedAt'])&&$scope['role']!=='repair_manager') {
        throw new TamiranApiException('رسید پس از تأیید مدیر در دسترس است.',409);
    }
    $case = v2_case($pdo, $scope, (int)$handover['case_id']);
    $receipt = workflow_v2_handover_snapshot($pdo, $scope, $handover, $case, $assets, false);
    return ['receipt'=>$receipt,'status'=>$handover['status'],'revision'=>workflow_v2_handover_revision($receipt, $assets),
        'discrepancy'=>$assets['discrepancy'] ?? null];
}

function workflow_v2_handover_revision(array $receipt, array $assets): string
{
    return hash('sha256', v2_json([$receipt,$assets['discrepancy'] ?? null]));
}

function workflow_v2_handover_checklist(array $receipt): array
{
    return ['device',
        ...array_column($receipt['partIssues'], 'publicId'),
        ...array_column($receipt['installedParts'], 'publicId'),
        ...array_column($receipt['hotReturns'], 'publicId'),
    ];
}

function workflow_v2_handover_decide(PDO $pdo, array $scope, array $input): array
{
    $public = v2_text($input['publicId']??'', 'تحویل پرونده', 80);
    $action = (string)($input['decision']??'');
    if ($action==='manager_force') throw new TamiranApiException('انتقال مسئولیت به تأیید دریافت تکنسین مقصد نیاز دارد.', 409);
    if (!in_array($action,['accept','cancel','report_discrepancy','resolve_discrepancy','approve_request'],true)) {
        throw new TamiranApiException('تصمیم تحویل معتبر نیست.');
    }
    $decisionReason = v2_text($input['reason']??'', 'علت تصمیم', 1000, !in_array($action,['accept','approve_request'],true));
    $actor = (int)$scope['actor']['id'];
    $manager = $scope['role']==='repair_manager';
    $pdo->beginTransaction();
    try {
        $handover = workflow_v2_handover_row($pdo, $scope, $public, true);
        $recipient = $actor===(int)$handover['to_user_id'];
        $sender = $actor===(int)$handover['from_user_id'];
        $allowed = match($action) {
            'accept','report_discrepancy'=>$recipient,
            'resolve_discrepancy','approve_request'=>$manager,
            'cancel'=>$manager || $sender,
        };
        if (!$allowed) throw new TamiranApiException('ثبت این تصمیم برای شما مجاز نیست.', 403);
        if ($action==='accept' && $handover['status']==='accepted') {
            $pdo->commit();
            return ['decided'=>true,'status'=>'accepted','replayed'=>true];
        }
        if ($handover['status']!=='requested') throw new TamiranApiException('تحویل پرونده قابل تصمیم نیست.', 409);
        if ($action==='cancel') {
            $pdo->prepare("UPDATE repair_case_handovers SET status='cancelled',decided_by_user_id=:actor,decided_at=NOW() WHERE id=:id")
                ->execute(['actor'=>$actor,'id'=>$handover['id']]);
            tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$actor,'case.handover.cancel','repair_case',$handover['case_public_id'],['handover'=>'requested'],['handover'=>'cancelled'],$decisionReason);
            $pdo->commit();
            return ['decided'=>true,'status'=>'cancelled'];
        }

        $caseLock = v2_case($pdo, $scope, (int)$handover['case_id'], true);
        technician_editable($caseLock, requireReceipt: false);
        if ((int)$caseLock['primary_technician_user_id']!==(int)$handover['from_user_id']) {
            throw new TamiranApiException('مسئول پرونده پس از ثبت درخواست تغییر کرده است؛ درخواست قبلی را لغو کنید.', 409);
        }
        $assets = json_decode((string)$handover['assets_json'], true, flags: JSON_THROW_ON_ERROR);
        $waitingApproval=!empty($assets['managerApprovalRequired'])&&empty($assets['managerApprovedAt']);
        if ($action==='approve_request') {
            if (!empty($assets['managerApprovedAt'])) {
                $pdo->commit();
                return ['approved'=>true,'status'=>'requested','replayed'=>true];
            }
            if (!$waitingApproval) throw new TamiranApiException('این درخواست به تأیید مدیر نیاز ندارد.',409);
            workflow_v2_active_technician($pdo,$scope,(int)$handover['to_user_id']);
            $assets['managerApprovedAt']=gmdate('c');
            $assets['managerApprovedBy']=$actor;
            $pdo->prepare('UPDATE repair_case_handovers SET assets_json=:assets WHERE id=:id')
                ->execute(['assets'=>v2_json($assets),'id'=>$handover['id']]);
            tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$actor,'case.handover.approve_request','repair_case_handover',$public,null,['approvedAt'=>$assets['managerApprovedAt']],$decisionReason);
            v2_notify($pdo,$scope,(int)$handover['to_user_id'],'case_handover_requested','ارجاع تأیید شد؛ دستگاه را تحویل بگیرید','رسید '.$handover['receipt_number'],'repair_case_handover',$public);
            $pdo->commit();
            return ['approved'=>true,'status'=>'requested'];
        }
        if ($waitingApproval) throw new TamiranApiException('ارجاع ابتدا باید به تأیید مدیر برسد.',409);
        $openDiscrepancy = isset($assets['discrepancy']) && !isset($assets['discrepancy']['resolvedAt']);
        if ($action==='report_discrepancy' || $action==='resolve_discrepancy') {
            $report = $action==='report_discrepancy';
            $before = $assets['discrepancy'] ?? null;
            if ($openDiscrepancy && $report && $before['reason']===$decisionReason) {
                $pdo->commit();
                return ['decided'=>true,'status'=>'requested','replayed'=>true];
            }
            if ($openDiscrepancy===$report) {
                throw new TamiranApiException($report?'مغایرت قبلی در انتظار بررسی مدیر است.':'مغایرت بازی برای بررسی وجود ندارد.',409);
            }
            $assets['discrepancy'] = $report
                ? ['reason'=>$decisionReason,'reportedAt'=>gmdate('c'),'reportedBy'=>$actor]
                : $before + ['resolution'=>$decisionReason,'resolvedAt'=>gmdate('c'),'resolvedBy'=>$actor];
            $pdo->prepare('UPDATE repair_case_handovers SET assets_json=:assets WHERE id=:id')
                ->execute(['assets'=>v2_json($assets),'id'=>$handover['id']]);
            tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$actor,'case.handover.'.$action,'repair_case_handover',$public,$before,$assets['discrepancy'],$decisionReason);
            if (!$report) {
                v2_notify($pdo,$scope,(int)$handover['to_user_id'],'case_handover_discrepancy_resolved','مغایرت تحویل دستگاه بررسی شد','رسید '.$handover['receipt_number'],'repair_case_handover',$public);
            }
            $pdo->commit();
            return ['decided'=>true,'status'=>'requested'];
        }
        if ($openDiscrepancy) throw new TamiranApiException('مدیر باید ابتدا مغایرت تحویل را بررسی کند.', 409);
        $receipt = workflow_v2_handover_snapshot($pdo, $scope, $handover, $caseLock, $assets, true);
        $revision = $input['receiptRevision'] ?? null;
        if (!empty($assets['receiptVersion']) && (!is_string($revision) || !hash_equals(workflow_v2_handover_revision($receipt, $assets), $revision))) {
            throw new TamiranApiException('اطلاعات رسید تازه شده است. رسید را دوباره باز و بررسی کنید.', 409);
        }
        if (!empty($assets['receiptVersion']) && ($input['checkedItems'] ?? null)!==workflow_v2_handover_checklist($receipt)) {
            throw new TamiranApiException('تمام اقلام رسید را تأیید کنید یا مغایرت گزارش دهید.', 409);
        }
        if ($receipt['partsDisposition']==='settle_before_handover' && $receipt['partIssues']!==[]) {
            throw new TamiranApiException('قطعات مسئول قبلی هنوز تعیین‌تکلیف نشده‌اند.', 409);
        }
        if ($receipt['hotReturnsDisposition']==='settle_before_handover' && $receipt['hotReturns']!==[]) {
            throw new TamiranApiException('تعهد داغی مسئول قبلی هنوز باز است.', 409);
        }
        $assets['acceptedReceipt'] = $receipt;
        workflow_v2_active_technician($pdo,$scope,(int)$handover['to_user_id']);
        $pdo->prepare("UPDATE repair_case_assignments SET ended_at=NOW() WHERE workflow_id=:workflow AND assignment_type='primary' AND ended_at IS NULL")->execute(['workflow'=>$handover['workflow_id']]);
        $pdo->prepare("INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,started_at,accepted_at,created_by_user_id) VALUES(:public,:workflow,:technician,'primary','مسئول اصلی پس از تحویل رسمی',NOW(),NOW(),:actor)")->execute(['public'=>tamiran_id(),'workflow'=>$handover['workflow_id'],'technician'=>$handover['to_user_id'],'actor'=>$scope['actor']['id']]);
        if(($assets['partsDisposition']??'')==='transfer_to_new')$pdo->prepare("UPDATE repair_part_issues SET technician_user_id=:to_user WHERE case_id=:case AND technician_user_id=:from_user AND status NOT IN ('consumed','returned')")->execute(['to_user'=>$handover['to_user_id'],'case'=>$handover['case_id'],'from_user'=>$handover['from_user_id']]);
        if(($assets['hotReturnsDisposition']??'')==='transfer_to_new')$pdo->prepare("UPDATE repair_hot_returns SET technician_user_id=:to_user,updated_at=NOW() WHERE case_id=:case AND technician_user_id=:from_user AND status<>'settled'")->execute(['to_user'=>$handover['to_user_id'],'case'=>$handover['case_id'],'from_user'=>$handover['from_user_id']]);$status='accepted';
        $pdo->prepare('UPDATE repair_case_handovers SET assets_json=:assets WHERE id=:id')->execute(['assets'=>v2_json($assets),'id'=>$handover['id']]);
        $pdo->prepare('UPDATE repair_case_handovers SET status=:status,decided_by_user_id=:actor,decided_at=NOW() WHERE id=:id')->execute(['status'=>$status,'actor'=>$scope['actor']['id'],'id'=>$handover['id']]);
        $pdo->prepare('UPDATE repair_case_workflows SET primary_technician_user_id=:technician,lock_version=lock_version+1 WHERE id=:workflow')->execute(['technician'=>$handover['to_user_id'],'workflow'=>$handover['workflow_id']]);
        $pdo->prepare('UPDATE repair_cases SET assigned_to_user_id=:technician,row_version=row_version+1 WHERE id=:case')->execute(['technician'=>$handover['to_user_id'],'case'=>$handover['case_id']]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.handover.'.$status,'repair_case',$handover['case_public_id'],['primaryTechnicianUserId'=>(int)$handover['from_user_id']],['primaryTechnicianUserId'=>(int)$handover['to_user_id'],'assets'=>$assets],$decisionReason??$handover['reason']);
        v2_notify($pdo,$scope,(int)$handover['to_user_id'],'case_handover_completed','مسئولیت پرونده به شما منتقل شد','رسید '.$handover['receipt_number'],'repair_case',$handover['case_public_id']);
        $pdo->commit();
        return ['decided'=>true,'status'=>$status];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
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
    return technician_manual_part($pdo,$scope,$input);
}

function workflow_v2_check_finance_reapproval(PDO $pdo,array $scope,array $case):void
{
    v2_require_permission($scope,'finance.issue',['finance_cashier'],'درخواست تأیید مبلغ فاکتور مجاز نیست.');
    v2_require_case_access($pdo,$scope,$case);
    if ($case['locked_at']!==null||!in_array($case['process_status'],['finance_pending','qc_conditional'],true)) {
        throw new TamiranApiException('پرونده در مرحله قابل اصلاح مالی نیست.',409);
    }
    $invoice=$pdo->prepare('SELECT id FROM repair_invoices WHERE case_id=:case');
    $invoice->execute(['case'=>$case['case_id']]);
    if ($invoice->fetchColumn()!==false) throw new TamiranApiException('فاکتور قطعی از مسیر اصلاح مالی تغییر می‌کند.',409);
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
        $financeReapproval=($input['financeReapproval']??false)===true;
        if ($financeReapproval) {
            workflow_v2_check_finance_reapproval($pdo,$scope,$row);
            if ((int)($input['lockVersion']??-1)!==(int)$row['lock_version']) {
                throw new TamiranApiException('پرونده تغییر کرده است؛ آن را تازه‌سازی کنید.',409);
            }
        } else technician_editable($row);
        $key=v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه برآورد',160);
        $estimatePayload=['items'=>$items,'diagnosticFee'=>technician_money($input['diagnosticFee']??0)];
        if($old=technician_replay($pdo,$row,$scope,'technical_estimate',$key,$estimatePayload)){$pdo->commit();return $old['estimate'];}
        $revisionStatement=$pdo->prepare('SELECT COALESCE(MAX(revision),0)+1 FROM repair_estimates WHERE case_id=:case FOR UPDATE');$revisionStatement->execute(['case'=>$caseId]);$revision=(int)$revisionStatement->fetchColumn();
        $subtotal=0;$taxTotal=0;$discountTotal=0;$normalized=[];
        foreach($items as $item){
            $type=(string)($item['type']??'');if(!in_array($type,['part','labor','diagnostic','other'],true))throw new TamiranApiException('نوع ردیف برآورد معتبر نیست.');
            $title=v2_text($item['title']??'','عنوان ردیف',240);$quantity=(float)($item['quantity']??1);$unit=technician_money($item['unitPrice']??0);$discount=max(0,(int)($item['discountAmount']??0));$taxRate=(float)($item['taxRate']??0);
            if(!is_finite($quantity)||$quantity<=0||$quantity>10000||!is_finite($taxRate)||$taxRate<0||$taxRate>100)throw new TamiranApiException('تعداد یا مالیات ردیف معتبر نیست.');
            $base=(int)round($quantity*$unit);if($discount>$base)throw new TamiranApiException('تخفیف از مبلغ ردیف بیشتر است.');
            if($discount>0&&$scope['role']!=='repair_manager')throw new TamiranApiException('ثبت تخفیف فقط برای مدیر مجاز است.',403);
            $tax=(int)round(($base-$discount)*$taxRate/100);$line=$base-$discount+$tax;
            $subtotal+=$base;$discountTotal+=$discount;$taxTotal+=$tax;$normalized[]=[$type,$item['referenceId']??null,$title,$quantity,$unit,$discount,$taxRate,$tax,$line];
        }
        $diagnostic=technician_money($input['diagnosticFee']??0);$total=$subtotal-$discountTotal+$taxTotal+$diagnostic;$approvalLimit=technician_customer_approval_limit($pdo,$caseId)??(int)$row['preapproved_amount'];
        $requiresCustomerApproval=$total>$approvalLimit;$status=$requiresCustomerApproval?'draft':'approved';
        if ($financeReapproval&&$total<=case_invoice_authorized_amount($pdo,$row)) {
            throw new TamiranApiException('مبلغ جدید در محدوده مجوز فعلی است.',409);
        }
        if($total>1000000000000)throw new TamiranApiException('جمع برآورد خارج از محدوده است.');
        $number='EST-'.$scope['shop_id'].'-'.$caseId.'-'.$revision;$public=tamiran_id();
        $pdo->prepare('UPDATE repair_estimates SET status=\'superseded\' WHERE case_id=:case AND status IN (\'draft\',\'sent\',\'explanation_requested\')')->execute(['case'=>$caseId]);
        $pdo->prepare("INSERT INTO repair_estimates(public_id,shop_id,case_id,estimate_number,status,diagnostic_fee,subtotal_amount,discount_amount,tax_amount,total_amount,valid_until,customer_note,internal_note,revision,created_by_user_id,decided_at) VALUES(:public,:shop,:case,:number,:status,:diagnostic,:subtotal,:discount,:tax,:total,:valid_until,:customer_note,:internal_note,:revision,:creator,:decided_at)")
            ->execute(['public'=>$public,'shop'=>$scope['shop_id'],'case'=>$caseId,'number'=>$number,'status'=>$status,'diagnostic'=>$diagnostic,'subtotal'=>$subtotal,'discount'=>$discountTotal,'tax'=>$taxTotal,'total'=>$total,'valid_until'=>$input['validUntil']??null,'customer_note'=>v2_text($input['customerNote']??'','یادداشت مشتری',4000,false),'internal_note'=>v2_text($input['internalNote']??'','یادداشت داخلی',4000,false),'revision'=>$revision,'creator'=>$scope['actor']['id'],'decided_at'=>$requiresCustomerApproval?null:date('Y-m-d H:i:s')]);
        $estimateId=(int)$pdo->lastInsertId();$insert=$pdo->prepare('INSERT INTO repair_estimate_items(estimate_id,item_type,reference_id,title,quantity,unit_price,discount_amount,tax_rate,tax_amount,line_total) VALUES(:estimate,:type,:reference,:title,:quantity,:unit,:discount,:tax_rate,:tax,:line)');
        foreach($normalized as $line)$insert->execute(['estimate'=>$estimateId,'type'=>$line[0],'reference'=>$line[1],'title'=>$line[2],'quantity'=>$line[3],'unit'=>$line[4],'discount'=>$line[5],'tax_rate'=>$line[6],'tax'=>$line[7],'line'=>$line[8]]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'estimate.create','repair_estimate',$public,null,['total'=>$total,'revision'=>$revision,'status'=>$status],v2_text($input['reason']??'برآورد پس از عیب‌یابی','علت',1000));technician_event($pdo,$scope,$row,'technical_estimate',$key,$estimatePayload,['estimate'=>['publicId'=>$public,'totalAmount'=>$total,'revision'=>$revision,'requiresCustomerApproval'=>$requiresCustomerApproval]]);$pdo->commit();
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
        if (in_array($row['process_status'],['diagnosing','estimate_pending','qc_rework'],true)&&$parsed->getTimestamp()<=time()) {
            throw new TamiranApiException('زمان تقریبی اتمام باید پس از زمان فعلی باشد.');
        }
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
    $case=v2_case($pdo,$scope,(int)$estimate['case_id']);
    v2_require_case_access($pdo,$scope,$case);
    $method=operations_policy($pdo,(int)$scope['shop_id'])['approval'];
    if (($method==='sms'&&!in_array($channel,['sms_otp','secure_portal'],true))
        || ($method==='phone'&&$channel!=='recorded_phone')) {
        throw new TamiranApiException('این روش در سیاست تأیید تعمیرگاه فعال نیست.',409);
    }
    if(in_array($channel,['recorded_phone','in_person_signature'],true)&&!v2_has_permission($scope,'estimate.record_customer_decision',['reception']))throw new TamiranApiException('ثبت این روش تأیید برای نقش فعلی مجاز نیست.',403);
    if($channel==='in_person_signature'||($channel==='recorded_phone'&&$decision!=='approved'))v2_text($input['reason']??'','شرح مستند تصمیم مشتری',1000);
    $mobile=tamiran_mobile((string)$estimate['mobile']);
    if(in_array($channel,['sms_otp','secure_portal'],true)){
        if(!function_exists('tamiran_sms_verify_otp'))throw new TamiranApiException('سرویس OTP پیکربندی نشده است.',503);
        $verified=tamiran_sms_verify_otp($pdo,$scope['shop_id'],'estimate',(string)$public,$mobile,(string)($input['otpRequestId']??''),(string)($input['otpCode']??''));
        if(!$verified)throw new TamiranApiException('کد یک‌بارمصرف معتبر نیست.',403);
    }
    $pdo->beginTransaction();
    try{
        $caseLock=v2_case($pdo,$scope,(int)$estimate['case_id'],true);if($caseLock['locked_at']!==null)throw new TamiranApiException('پرونده بسته است.',409);
        $latest=$pdo->prepare('SELECT id FROM repair_estimates WHERE case_id=:case ORDER BY revision DESC,id DESC LIMIT 1');$latest->execute(['case'=>$estimate['case_id']]);if((int)$latest->fetchColumn()!==(int)$estimate['id'])throw new TamiranApiException('برآورد جدیدتری ثبت شده است.',409);
        $lock=$pdo->prepare('SELECT status,(valid_until IS NULL OR valid_until>UTC_TIMESTAMP()) AS valid FROM repair_estimates WHERE id=:id FOR UPDATE');
        $lock->execute(['id'=>$estimate['id']]);
        $current=$lock->fetch();
        $status=$current['status']??null;
        if(empty($current['valid'])||!in_array($status,['sent','explanation_requested'],true)){
            throw new TamiranApiException('این برآورد در وضعیت قابل تصمیم نیست یا اعتبار آن پایان یافته است.',409);
        }
        $pdo->prepare('UPDATE repair_estimates SET status=:decision,decided_at=NOW() WHERE id=:id')->execute(['decision'=>$decision,'id'=>$estimate['id']]);
        $approvalPublic=tamiran_id();$pdo->prepare('INSERT INTO repair_estimate_approvals(public_id,estimate_id,decision,channel,customer_mobile,otp_request_id,recorded_by_user_id,decision_reason,evidence_json) VALUES(:public,:estimate,:decision,:channel,:mobile,:otp,:actor,:reason,:evidence)')
            ->execute(['public'=>$approvalPublic,'estimate'=>$estimate['id'],'decision'=>$decision,'channel'=>$channel,'mobile'=>$mobile,'otp'=>$input['otpRequestId']??null,'actor'=>$scope['actor']['id'],'reason'=>v2_text($input['reason']??'','علت تصمیم',1000,false),'evidence'=>v2_json($input['evidence']??[])]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'estimate.decision','repair_estimate',$public,['status'=>$status],['status'=>$decision,'channel'=>$channel],v2_text($input['reason']??'','علت',1000,false));$pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    $transitionedCase=null; // Rejection preserves an open technical case until parts and charges are resolved.
    return ['decided'=>true,'decision'=>$decision,'approvalPublicId'=>$approvalPublic,'case'=>$transitionedCase];
}


function workflow_v2_activity(PDO $pdo,array $scope,int $caseId): array
{
    $case=v2_case($pdo,$scope,$caseId);v2_require_case_access($pdo,$scope,$case);
    $statement=$pdo->prepare("SELECT e.id,e.event_type,e.description,e.created_at,u.display_name AS actorName FROM repair_case_events e INNER JOIN tamiran_users u ON u.id=e.actor_user_id WHERE e.case_id=:case ORDER BY e.id DESC LIMIT 100");
    $statement->execute(['case'=>$caseId]);$events=$statement->fetchAll();
    $stages=$pdo->prepare("SELECT -CAST(e.id AS SIGNED) AS id,'workflow' AS event_type,e.reason AS description,e.created_at,u.display_name AS actorName FROM repair_case_stage_events e INNER JOIN tamiran_users u ON u.id=e.actor_user_id WHERE e.workflow_id=:workflow ORDER BY e.id DESC LIMIT 100");
    $stages->execute(['workflow'=>$case['id']]);$events=array_merge($events,$stages->fetchAll());usort($events,static fn($a,$b)=>strcmp($b['created_at'],$a['created_at']));return ['events'=>array_slice($events,0,100)];
}
function workflow_v2_problem_report(PDO $pdo,array $scope,array $input,bool $followup=false): array
{
    if ($followup&&$scope['role']!=='repair_manager') throw new TamiranApiException('پیگیری مدیریتی فقط برای مدیر تعمیرگاه است.',403);
    v2_require_permission($scope,'case.note',['technician','reception'],'ثبت گزارش مشکل مجاز نیست.');
    $event=$followup?'manager_followup_note':'problem_report';
    $caseId=(int)($input['caseId']??0);$text=v2_text($input['message']??'','شرح مشکل',4000);$key=v2_text($input['idempotencyKey']??'','شناسه گزارش',160);
    $pdo->beginTransaction();
    try{
        $case=v2_case($pdo,$scope,$caseId,true);v2_require_case_access($pdo,$scope,$case);
        $existing=$pdo->prepare("SELECT description FROM repair_case_events WHERE case_id=:case AND event_type=:event AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.idempotencyKey'))=:key LIMIT 1");$existing->execute(['case'=>$caseId,'key'=>$key,'event'=>$event]);$old=$existing->fetchColumn();
        if($old!==false){if($old!==$text)throw new TamiranApiException('شناسه گزارش قبلاً با متن دیگری ثبت شده است.',409);$pdo->commit();return ['recorded'=>true,'replayed'=>true];}
        if($case['locked_at']!==null && !($followup&&$case['process_status']==='returned_unrepaired'&&$case['delivered_at']===null))throw new TamiranApiException('پرونده مختومه قابل ویرایش نیست.',409);
        $pdo->prepare("INSERT INTO repair_case_events(case_id,actor_user_id,event_type,description,metadata_json) VALUES(:case,:actor,:event,:message,:metadata)")->execute(['case'=>$caseId,'actor'=>$scope['actor']['id'],'event'=>$event,'message'=>$text,'metadata'=>v2_json(['idempotencyKey'=>$key])]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'case.'.$event,'repair_case',$case['case_public_id'],null,['message'=>$text]);$pdo->commit();return ['recorded'=>true,'replayed'=>false];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function workflow_v2_estimate_send(PDO $pdo,array $scope,array $input): array
{
    v2_require_permission($scope,'estimate.send',['reception','technician'],'ارسال برآورد مجاز نیست.');
    $public=v2_text($input['estimatePublicId']??'','برآورد',80);
    $q=$pdo->prepare('SELECT case_id FROM repair_estimates WHERE public_id=:public AND shop_id=:shop');$q->execute(['public'=>$public,'shop'=>$scope['shop_id']]);$caseId=$q->fetchColumn();
    if($caseId===false)throw new TamiranApiException('برآورد پیدا نشد.',404);
    $pdo->beginTransaction();try{
        $case=v2_case($pdo,$scope,(int)$caseId,true);v2_require_case_access($pdo,$scope,$case);
        if($scope['role']==='technician')v2_transition_role_allowed($pdo,$scope,$case,'estimate_pending');
        if (($input['financeReapproval']??false)===true) workflow_v2_check_finance_reapproval($pdo,$scope,$case);
        else technician_editable($case);
        $q=$pdo->prepare('SELECT public_id,status FROM repair_estimates WHERE case_id=:case ORDER BY revision DESC,id DESC LIMIT 1 FOR UPDATE');$q->execute(['case'=>$caseId]);$estimate=$q->fetch();
        if(!is_array($estimate)||$estimate['public_id']!==$public||!in_array($estimate['status'],['draft','sent','approved'],true))throw new TamiranApiException('برآورد جاری قابل ارسال نیست.',409);
        if($estimate['status']==='draft'){
            $pdo->prepare("UPDATE repair_estimates SET status='sent',sent_at=NOW() WHERE public_id=:public AND shop_id=:shop")->execute(['public'=>$public,'shop'=>$scope['shop_id']]);
            tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'estimate.send','repair_estimate',$public,['status'=>'draft'],['status'=>'sent']);
        }
        $pdo->commit();return ['sent'=>true,'replayed'=>$estimate['status']!=='draft'];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

tamiran_api(static function():array{
    $pdo=tamiran_db();$scope=v2_scope();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'&&isset($_GET['managerPulse']))return manager_pulse($pdo,$scope);
    if($method==='GET'&&isset($_GET['managerQueue']))return manager_case_queue($pdo,$scope,$_GET);
    if($method==='GET'&&isset($_GET['managerQueueOptions'])){
        v2_require_permission($scope,'repair_operations.view',[],'مشاهده صف ارجاع مجاز نیست.');
        return workflow_v2_payload($pdo,$scope,0);
    }
    if($method==='GET'&&isset($_GET['managerFollowups']))return manager_followup_queue($pdo,$scope,$_GET['filter']??'all',$_GET['offset']??0);
    if($method==='GET'&&isset($_GET['managerReport']))return manager_operations_report($pdo,$scope,$_GET['from']??'',$_GET['to']??'',isset($_GET['metric'])?$_GET:null);
    if($method==='GET'&&isset($_GET['externalCatalog']))return external_purchase_catalog($pdo,$scope,(int)($_GET['caseId']??0),$_GET['q']??'');
    if($method==='GET'&&isset($_GET['externalPurchase']))return external_purchase_view($pdo,$scope,isset($_GET['caseId'])?(int)$_GET['caseId']:null,($_GET['summary']??'')==='1');
    if($method==='GET'&&isset($_GET['handoverReceipt']))return workflow_v2_handover_receipt($pdo,$scope,$_GET['handoverReceipt']);
    if($method==='GET'&&($_GET['technical']??'')==='1')return technician_projection($pdo,$scope,(int)($_GET['caseId']??0));
    if($method==='GET'&&($_GET['technicalActivities']??'')==='1')return technician_activities($pdo,$scope,(int)($_GET['caseId']??0),(int)($_GET['beforeId']??0));
    if($method==='GET'&&($_GET['activity']??'')==='1')return workflow_v2_activity($pdo,$scope,(int)($_GET['caseId']??0));
    if($method==='GET')return workflow_v2_payload($pdo,$scope,isset($_GET['caseId'])?(int)$_GET['caseId']:null,isset($_GET['q'])?(string)$_GET['q']:null);
    if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);
    tamiran_require_csrf();$input=tamiran_json_body();$action=(string)($input['action']??'');
    return match($action){
        'external_catalog_add'=>external_purchase_add_catalog($pdo,$scope,$input),
        'external_purchase'=>external_purchase_change($pdo,$scope,$input),
        'technical_diagnosis'=>technician_diagnosis($pdo,$scope,$input),
        'technical_device_password'=>technician_device_password($pdo,$scope,(int)($input['caseId']??0)),
        'technical_receive'=>technician_confirm_receipt($pdo,$scope,$input),
        'technical_activity'=>technician_activity_add($pdo,$scope,$input),
        'technical_finish'=>technician_finish($pdo,$scope,$input),
        'invoice_correct'=>case_invoice_correct($pdo,$scope,$input),
        'manager_update_case'=>manager_update_case($pdo,$scope,$input),
        'followup_note'=>workflow_v2_problem_report($pdo,$scope,$input,true),
        'problem_report'=>workflow_v2_problem_report($pdo,$scope,$input),
        'transition'=>['case'=>v2_transition($pdo,$scope,(int)($input['caseId']??0),(string)($input['target']??''),v2_text($input['reason']??'','علت',1000,false),(int)($input['lockVersion']??-1),v2_text($input['idempotencyKey']??tamiran_request_id(),'شناسه یکتا',160))],
        'assign'=>['case'=>workflow_v2_assign($pdo,$scope,$input)],
        'collaborator_add'=>workflow_v2_add_collaborator($pdo,$scope,$input),
        'handover_request'=>workflow_v2_handover_request($pdo,$scope,$input),
        'handover_decide'=>workflow_v2_handover_decide($pdo,$scope,$input),
        'migrate_case_to_pro'=>workflow_v2_migrate_case_to_pro($pdo,$scope,$input),
        'manual_part_add'=>workflow_v2_add_manual_part($pdo,$scope,$input),
        'estimate_create'=>['estimate'=>workflow_v2_estimate($pdo,$scope,$input)],
        'estimate_send'=>workflow_v2_estimate_send($pdo,$scope,$input),
        'estimate_decide'=>['approval'=>workflow_v2_estimate_decide($pdo,$scope,$input)],
        'update_promise'=>workflow_v2_update_promise($pdo,$scope,$input),
        default=>throw new TamiranApiException('عملیات فرایندی معتبر نیست.'),
    };
});
