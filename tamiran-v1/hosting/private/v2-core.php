<?php
declare(strict_types=1);

require_once __DIR__ . '/sms-service.php';

/** Tamiran 2.0 server-side process engine. This file is outside public_html. */

function v2_scope(): array
{
    $actor = tamiran_require_writable_actor();
    if (!is_array($actor['shop'] ?? null) || !is_array($actor['branch'] ?? null)) {
        throw new TamiranApiException('برای این عملیات باید وارد فضای یک شعبه شوید.', 403);
    }
    return [
        'actor'=>$actor, 'shop_id'=>(int)$actor['shop']['id'], 'branch_id'=>(int)$actor['branch']['id'],
        'role'=>(string)$actor['role'], 'permissions'=>(array)($actor['permissions'] ?? []),
        'plan'=>(string)($actor['shop']['plan'] ?? 'light'),
        'product_profile'=>(string)($actor['shop']['productProfile'] ?? 'pro'),
        'inventory_mode'=>(string)($actor['shop']['inventoryMode'] ?? 'off'),
        'qc_mode'=>(string)($actor['shop']['qcMode'] ?? 'off'),
        'feature_flags'=>(array)($actor['shop']['featureFlags'] ?? []),
    ];
}

function v2_has_permission(array $scope, string $permission, array $roles = []): bool
{
    if ($scope['role'] === 'repair_manager' || in_array('*', $scope['permissions'], true)) return true;
    return in_array($scope['role'], $roles, true) || in_array($permission, $scope['permissions'], true);
}

function v2_require_permission(array $scope, string $permission, array $roles, string $message): void
{
    if (!v2_has_permission($scope, $permission, $roles)) throw new TamiranApiException($message, 403);
}

function v2_text(mixed $value, string $label, int $max, bool $required = true): ?string
{
    $text = trim((string)$value);
    $length = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
    if (($required && $text === '') || $length > $max) throw new TamiranApiException("{$label} معتبر نیست.");
    return $text === '' ? null : $text;
}

/** A delivery retry is readable only within the authenticated branch and case. */
function v2_delivery_replay(PDO $pdo, array $scope, int $caseId, string $idempotency): ?array
{
    $statement = $pdo->prepare('SELECT d.public_id,d.case_id,c.receipt_number FROM repair_deliveries d INNER JOIN repair_cases c ON c.id=d.case_id WHERE d.shop_id=:shop AND c.branch_id=:branch AND d.idempotency_key=:idempotency LIMIT 1');
    $statement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'idempotency'=>$idempotency]);
    $row = $statement->fetch();
    if (!is_array($row)) return null;
    if ((int)$row['case_id'] !== $caseId) {
        throw new TamiranApiException('شناسه یکتای تحویل قبلاً برای پرونده دیگری استفاده شده است.', 409);
    }
    return ['delivered'=>true,'replayed'=>true,'publicId'=>$row['public_id'],'receiptNumber'=>$row['receipt_number']];
}

function v2_json(mixed $value): string
{
    return json_encode(is_array($value) ? $value : new stdClass(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function v2_product_policy(PDO $pdo, array $scope, ?array $case = null): array
{
    $profile=(string)($case['product_profile_snapshot']??$scope['product_profile']??'pro');
    $inventory=(string)($case['inventory_mode_snapshot']??$scope['inventory_mode']??'off');
    $qc=(string)($case['qc_mode_snapshot']??$scope['qc_mode']??'off');
    if(!in_array($profile,['solo','pro'],true))$profile='pro';
    if(!in_array($inventory,['off','simple','pro'],true))$inventory='off';
    if(!in_array($qc,['off','simple','independent'],true))$qc='off';
    if($profile==='solo'&&$inventory==='pro')$inventory='simple';
    if($profile==='solo'&&$qc==='independent')$qc='simple';

    $flags=$case===null?(array)($scope['feature_flags']??[]):(json_decode((string)($case['feature_flags_snapshot_json']??'{}'),true)?:[]);
    $allowed=[];
    $statement=$pdo->prepare('SELECT capability_code,is_allowed FROM tamiran_plan_entitlements WHERE plan_code=:plan AND effective_from<=NOW() AND (effective_to IS NULL OR effective_to>NOW())');
    $statement->execute(['plan'=>(string)($scope['plan']??'light')]);
    foreach($statement->fetchAll()as$row)$allowed[(string)$row['capability_code']]=(bool)$row['is_allowed'];
    $overrides=$pdo->prepare('SELECT capability_code,is_enabled FROM tamiran_shop_feature_overrides WHERE shop_id=:shop AND (expires_at IS NULL OR expires_at>NOW())');
    $overrides->execute(['shop'=>$scope['shop_id']]);
    foreach($overrides->fetchAll()as$row){$code=(string)$row['capability_code'];$allowed[$code]=(bool)$row['is_enabled'];}
    foreach($flags as$code=>$enabled)if($enabled===false)$allowed[(string)$code]=false;

    // Commercial module state is authoritative for both current and archived
    // cases. A case snapshot preserves data, but cannot re-enable new
    // operations after an entitlement is locked, expired or suspended.
    $moduleStatement=$pdo->prepare("SELECT module_key,state,expires_at FROM tamiran_shop_modules WHERE repair_shop_id=:shop");
    $moduleStatement->execute(['shop'=>$scope['shop_id']]);
    $moduleStates=[];
    foreach($moduleStatement->fetchAll()as$row){
        $state=(string)$row['state'];
        if($state==='trial'&&!empty($row['expires_at'])&&strtotime((string)$row['expires_at'])<time())$state='expired';
        $moduleStates[(string)$row['module_key']]=$state;
    }
    $commerciallyActive=static fn(string$key):bool=>in_array($moduleStates[$key]??($key==='repair'?'active':'locked'),['active','trial'],true);
    if(!$commerciallyActive('inventory')){$allowed['module.inventory.simple']=false;$allowed['module.inventory.pro']=false;$allowed['module.procurement']=false;$allowed['module.hot_return']=false;}
    if(!$commerciallyActive('repair')){$allowed['module.qc.simple']=false;$allowed['module.qc.independent']=false;}

    $enabled=static fn(string$code):bool=>($allowed[$code]??false)===true;
    return[
        'profile'=>$profile,'inventoryMode'=>$inventory,'qcMode'=>$qc,
        'assignmentRequired'=>$profile==='pro',
        'inventoryEnabled'=>$inventory!=='off'&&$enabled('module.inventory.simple'),
        'stockPartsAvailable'=>$enabled('module.inventory.simple'),
        'inventoryPro'=>$inventory==='pro'&&$enabled('module.inventory.pro'),
        'qcEnabled'=>$qc!=='off'&&$enabled('module.qc.simple'),
        'independentQc'=>$qc==='independent'&&$profile==='pro'&&$enabled('module.qc.independent'),
        'procurement'=>$inventory==='pro'&&$enabled('module.inventory.pro')&&$enabled('module.procurement'),
        'hotReturn'=>$inventory==='pro'&&$enabled('module.inventory.pro')&&$enabled('module.hot_return'),
        'financeEnabled'=>$commerciallyActive('finance')&&$enabled('core.finance'),
        'smsEnabled'=>$commerciallyActive('sms')&&$enabled('platform.sms_otp'),
        'warrantyEnabled'=>$commerciallyActive('warranty'),
        'multiBranchEnabled'=>$profile==='pro'&&$commerciallyActive('multi_branch')&&$enabled('module.multi_branch'),
        'capabilities'=>$allowed,
    ];
}

function v2_require_capability(array $policy,string $capability,string $message):void
{
    $enabled=$policy[$capability]??($policy['capabilities'][$capability]??false);
    if($enabled!==true)throw new TamiranApiException($message,403);
}

function v2_workflow_maps(array $policy=[]): array
{
    $profile=(string)($policy['profile']??'pro');
    $inventoryPro=(bool)($policy['inventoryPro']??true);
    $qcEnabled=(bool)($policy['qcEnabled']??true);
    $afterRepair=$inventoryPro?'parts_closeout':($qcEnabled?'qc_pending':'finance_pending');
    $afterParts=$qcEnabled?'qc_pending':'finance_pending';

    if($profile==='solo'){
        $map=[
            'reception'=>['diagnosing','estimate_pending','repairing','cancelled'],
            'awaiting_assignment'=>['diagnosing','estimate_pending','repairing','cancelled'],
            'assigned'=>['diagnosing','cancelled'],
            'diagnosing'=>['estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','returned_unrepaired','cancelled'],
            'estimate_pending'=>['awaiting_customer_approval','repairing','awaiting_parts','returned_unrepaired','cancelled'],
            'awaiting_customer_approval'=>['repairing','awaiting_parts','returned_unrepaired','cancelled'],
            'awaiting_parts'=>['repairing','awaiting_customer_approval','returned_unrepaired','cancelled'],
            'repairing'=>array_values(array_unique([$afterRepair,'awaiting_parts','awaiting_customer_approval','cancelled'])),
            'parts_closeout'=>[$afterParts,'repairing'],
            'qc_pending'=>['qc_rework','qc_conditional','finance_pending'],
            'qc_rework'=>['repairing'],'qc_conditional'=>['finance_pending'],'finance_pending'=>['ready_for_delivery','returned_unrepaired'],
            'ready_for_delivery'=>[],'returned_unrepaired'=>[],'delivered'=>['closed'],'cancelled'=>[],'closed'=>[],
        ];
    }else{
        $map=[
            'reception'=>['awaiting_assignment','assigned','cancelled'],'awaiting_assignment'=>['assigned','cancelled'],
            'assigned'=>['diagnosing','cancelled'],'diagnosing'=>['estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','returned_unrepaired','cancelled'],
            'estimate_pending'=>['awaiting_customer_approval','repairing','awaiting_parts','returned_unrepaired','cancelled'],
            'awaiting_customer_approval'=>['repairing','awaiting_parts','returned_unrepaired','cancelled'],
            'awaiting_parts'=>['repairing','awaiting_customer_approval','returned_unrepaired','cancelled'],
            'repairing'=>array_values(array_unique([$afterRepair,'awaiting_parts','awaiting_customer_approval','cancelled'])),
            'parts_closeout'=>[$afterParts,'repairing'],
            'qc_pending'=>['qc_rework','qc_conditional','finance_pending'],'qc_rework'=>['repairing'],
            'qc_conditional'=>['finance_pending'],'finance_pending'=>['ready_for_delivery','returned_unrepaired'],'ready_for_delivery'=>[],
            'returned_unrepaired'=>[],'delivered'=>['closed'],'cancelled'=>[],'closed'=>[],
        ];
    }
    return['mobile_tablet'=>$map,'computer_laptop'=>$map];
}

function v2_legacy_status(string $status): string
{
    return match ($status) {
        'reception','awaiting_assignment'=>'awaiting_assignment', 'assigned'=>'assigned', 'diagnosing','estimate_pending'=>'diagnosing',
        'awaiting_customer_approval'=>'awaiting_customer', 'awaiting_parts'=>'awaiting_part',
        'repairing','parts_closeout','qc_pending','qc_rework','qc_conditional','finance_pending'=>'repairing',
        'ready_for_delivery'=>'ready_for_delivery', 'returned_unrepaired'=>'returned', 'delivered','closed'=>'delivered', 'cancelled'=>'cancelled',
        default=>'awaiting_assignment',
    };
}

function v2_main_state(string $status): string
{
    return match ($status) {
        'reception','awaiting_assignment','assigned' => 'received',
        'diagnosing','estimate_pending','awaiting_customer_approval' => 'reviewing',
        'awaiting_parts','repairing','parts_closeout','qc_pending','qc_rework','qc_conditional','finance_pending' => 'in_progress',
        'ready_for_delivery' => 'ready_for_delivery',
        default => 'closed',
    };
}

function v2_hold_reason(string $status): ?string
{
    return match ($status) {
        'awaiting_customer_approval' => 'customer',
        'awaiting_parts' => 'part',
        'qc_pending' => 'qc',
        'finance_pending' => 'finance',
        'awaiting_assignment' => 'assignment',
        default => null,
    };
}

function v2_closure_outcome(string $status): ?string
{
    return match ($status) {
        'delivered','closed' => 'delivered',
        'returned_unrepaired' => 'unrepaired',
        'cancelled' => 'cancelled',
        default => null,
    };
}

function v2_case(PDO $pdo, array $scope, int $caseId, bool $lock = false): array
{
    $sql = 'SELECT w.*,c.public_id AS case_public_id,c.receipt_number,c.customer_id,c.device_id,c.declared_issue,c.accessories_json,
                   c.operation_report,c.result,c.reception_notes,c.created_at AS accepted_at,cu.full_name AS customer_name,cu.mobile AS customer_mobile,
                   cu.secondary_mobile,cu.address AS customer_address,c.device_type_snapshot,c.brand_snapshot,c.model_snapshot,c.identifier_snapshot,c.delivered_at,
                   c.product_profile_snapshot,c.inventory_mode_snapshot,c.qc_mode_snapshot,c.feature_flags_snapshot_json,
                   u.display_name AS technician_name
            FROM repair_case_workflows w INNER JOIN repair_cases c ON c.id=w.case_id AND c.shop_id=w.shop_id
            INNER JOIN repair_customers cu ON cu.id=c.customer_id AND cu.shop_id=w.shop_id
            LEFT JOIN tamiran_users u ON u.id=w.primary_technician_user_id
            WHERE w.case_id=:case AND w.shop_id=:shop AND w.branch_id=:branch LIMIT 1' . ($lock ? ' FOR UPDATE' : '');
    $statement=$pdo->prepare($sql);
    $statement->execute(['case'=>$caseId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $row=$statement->fetch();
    if(!is_array($row)) throw new TamiranApiException('پرونده نسخه ۲ پیدا نشد.',404);
    return $row;
}

function v2_open_part_blockers(PDO $pdo, int $caseId): array
{
    $blockers=[];
    $statement=$pdo->prepare("SELECT COUNT(*) FROM repair_part_requests WHERE case_id=:case AND status NOT IN ('consumed','returned','rejected','cancelled')");
    $statement->execute(['case'=>$caseId]);
    if((int)$statement->fetchColumn()>0) $blockers[]='درخواست قطعه تعیین‌تکلیف‌نشده';
    $statement=$pdo->prepare("SELECT COUNT(*) FROM repair_part_issues WHERE case_id=:case AND status NOT IN ('consumed','returned')");
    $statement->execute(['case'=>$caseId]);
    if((int)$statement->fetchColumn()>0) $blockers[]='قطعه تحویلی مصرف یا مرجوع نشده';
    $statement=$pdo->prepare("SELECT COUNT(*) FROM repair_hot_returns WHERE case_id=:case AND status<>'settled'");
    $statement->execute(['case'=>$caseId]);
    if((int)$statement->fetchColumn()>0) $blockers[]='تعهد داغی باز';
    return $blockers;
}

function v2_route_after_parts(PDO $pdo,array $scope,int $caseId,string $idempotency):bool
{
    $case=v2_case($pdo,$scope,$caseId);
    if(v2_open_part_blockers($pdo,$caseId)!==[])return false;
    $target=null;
    if($case['process_status']==='awaiting_parts'){if(!technician_cost_state($pdo,$case)['authorized'])return false;$target='repairing';}
    if($case['process_status']==='parts_closeout'){
        if(($case['result']??'')!=='repaired'||trim((string)($case['operation_report']??''))===''||!technician_cost_state($pdo,$case)['authorized'])return false;
        $policy=v2_product_policy($pdo,$scope,$case);
        $targets=v2_workflow_maps($policy)[(string)$case['workflow_code']]['parts_closeout']??[];
        foreach($targets as$candidate)if($candidate!=='repairing'){$target=$candidate;break;}
    }
    if($target===null)return false;
    v2_transition($pdo,$scope,$caseId,$target,'تعیین تکلیف قطعات تکمیل و پرونده خودکار وارد مرحله بعد شد',(int)$case['lock_version'],$idempotency.':route',true);
    return true;
}

function inventory_v2_route_after_parts(PDO $pdo,array $scope,int $caseId,string $idempotency):bool
{
    return v2_route_after_parts($pdo,$scope,$caseId,$idempotency);
}

function v2_qc_blockers(PDO $pdo, int $caseId): array
{
    $statement=$pdo->prepare('SELECT result,customer_acknowledged_at,manager_override FROM repair_qc_runs WHERE case_id=:case ORDER BY completed_at DESC,id DESC LIMIT 1');
    $statement->execute(['case'=>$caseId]);
    $row=$statement->fetch();
    if(!is_array($row)) return ['QC ثبت نشده'];
    if($row['result']==='failed') return ['آخرین QC مردود است'];
    if($row['result']==='conditional' && $row['customer_acknowledged_at']===null) return ['محدودیت QC مشروط توسط مشتری تأیید نشده'];
    return [];
}

function v2_finance_blockers(PDO $pdo, int $caseId): array
{
    $statement=$pdo->prepare("SELECT i.id,i.status,i.total_amount,i.paid_amount,i.refunded_amount,
        (SELECT COUNT(*) FROM repair_receivables r WHERE r.invoice_id=i.id AND r.status IN ('open','partially_paid','overdue')) AS receivable
        FROM repair_invoices i WHERE i.case_id=:case LIMIT 1");
    $statement->execute(['case'=>$caseId]);
    $invoice=$statement->fetch();
    if(!is_array($invoice) || $invoice['status']==='draft') return ['فاکتور نهایی صادر نشده'];
    if($invoice['status']==='voided') return [];
    $balance=(int)$invoice['total_amount']-((int)$invoice['paid_amount']-(int)$invoice['refunded_amount']);
    if($balance>0 && (int)$invoice['receivable']<1) return ['مانده مالی یا مطالبه مدیر تعیین‌تکلیف نشده'];
    return [];
}

function v2_terminal_finance_blockers(PDO $pdo, int $caseId): array
{
    $statement=$pdo->prepare('SELECT status FROM repair_invoices WHERE case_id=:case LIMIT 1');$statement->execute(['case'=>$caseId]);$status=$statement->fetchColumn();
    if($status===false) return [];
    return v2_finance_blockers($pdo,$caseId);
}

function v2_case_blockers(PDO $pdo, array $scope, array $row): array
{
    if($row['locked_at']!==null || in_array((string)$row['process_status'],['returned_unrepaired','delivered','cancelled','closed'],true)){
        return ['parts'=>[],'qc'=>[],'finance'=>[]];
    }
    $caseId=(int)$row['case_id'];
    $policy=v2_product_policy($pdo,$scope,$row);
    return [
        'parts'=>v2_open_part_blockers($pdo,$caseId),
        'qc'=>$policy['qcEnabled']&&!technician_unrepaired($pdo,$row)?v2_qc_blockers($pdo,$caseId):[],
        'finance'=>v2_finance_blockers($pdo,$caseId),
    ];
}

function v2_transition_role_allowed(PDO $pdo, array $scope, array $row, string $target): void
{
    if($scope['role']==='repair_manager') return;
    $roleTargets=[
        'reception'=>['awaiting_assignment','assigned','awaiting_customer_approval','returned_unrepaired','cancelled'],
        'technician'=>['diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_pending','finance_pending'],
        'quality_control'=>['qc_rework','qc_conditional','finance_pending'],
        'finance_cashier'=>['ready_for_delivery'],
    ];
    if(!in_array($target,$roleTargets[$scope['role']]??[],true) && !in_array('workflow.transition.'.$target,$scope['permissions'],true)) {
        throw new TamiranApiException('نقش فعلی اجازه این انتقال فرایندی را ندارد.',403);
    }
    if($scope['role']==='technician' && (int)$row['primary_technician_user_id']!==(int)$scope['actor']['id']) {
        $collaborator=$pdo->prepare('SELECT COUNT(*) FROM repair_case_assignments WHERE workflow_id=:workflow AND technician_user_id=:user AND ended_at IS NULL');
        $collaborator->execute(['workflow'=>$row['id'],'user'=>$scope['actor']['id']]);
        if((int)$collaborator->fetchColumn()<1) throw new TamiranApiException('این پرونده به شما تخصیص ندارد.',403);
    }
}

function v2_transition(PDO $pdo, array $scope, int $caseId, string $target, ?string $reason, int $expectedVersion, ?string $idempotencyKey=null, bool $automatic=false, bool $technicalFinish=false, bool $insideTransaction=false): array
{
    $ownsTransaction = !$technicalFinish && !$insideTransaction;
    if (!$ownsTransaction && !$pdo->inTransaction()) {
        throw new LogicException('Workflow transition requires its enclosing transaction');
    }
    if($ownsTransaction)$pdo->beginTransaction();
    try {
        $row=v2_case($pdo,$scope,$caseId,true);
        $policy=v2_product_policy($pdo,$scope,$row);
        // Authorization precedes replay: a guessed prior key grants no access.
        if(!$automatic)v2_transition_role_allowed($pdo,$scope,$row,$target);
        $idempotencyKey=v2_text($idempotencyKey??tamiran_request_id(),'شناسه یکتای انتقال',160);
        $existing=$pdo->prepare('SELECT to_status FROM repair_case_stage_events WHERE workflow_id=:workflow AND idempotency_key=:idempotency LIMIT 1');
        $existing->execute(['workflow'=>$row['id'],'idempotency'=>$idempotencyKey]);
        $existingTarget=$existing->fetchColumn();
        if($existingTarget!==false){if((string)$existingTarget!==$target)throw new TamiranApiException('شناسه یکتا قبلاً برای انتقال دیگری استفاده شده است.',409);if($ownsTransaction)$pdo->commit();return v2_case($pdo,$scope,$caseId);}
        if((int)$row['lock_version']!==$expectedVersion) throw new TamiranApiException('پرونده هم‌زمان تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.',409);
        if($row['locked_at']!==null || in_array($row['process_status'],['returned_unrepaired','cancelled','closed'],true)) {
            throw new TamiranApiException('پرونده بسته قابل بازگشایی یا ویرایش مستقیم نیست؛ پرونده مرتبط یا سند اصلاحی بسازید.',409);
        }
        $maps=v2_workflow_maps($policy);
        if(!$technicalFinish&&!in_array($target,$maps[$row['workflow_code']][$row['process_status']]??[],true)) throw new TamiranApiException('این انتقال در گردش صنف پرونده مجاز نیست.',409);
        if(in_array($target,['cancelled','returned_unrepaired'],true) && $reason===null) throw new TamiranApiException('علت بستن پرونده الزامی است.');
        if($policy['assignmentRequired']&&!in_array($target,['awaiting_assignment','cancelled','returned_unrepaired'],true)) {
            if((int)$row['primary_technician_user_id']<1) throw new TamiranApiException('پرونده باید تکنسین مسئول فعال داشته باشد.',409);
            $activeTechnician=$pdo->prepare("SELECT COUNT(*) FROM tamiran_users u INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.id=:user AND u.shop_id=:shop AND u.is_active=1 AND ub.branch_id=:branch AND ub.is_active=1 AND ub.branch_role_code IN ('technician','repair_manager')");$activeTechnician->execute(['user'=>$row['primary_technician_user_id'],'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);if((int)$activeTechnician->fetchColumn()<1)throw new TamiranApiException('مسئول فنی پرونده فعال یا مجاز در این شعبه نیست.',409);
        }

        $unrepaired=technician_unrepaired($pdo,$row);
        if(in_array($target,['qc_pending','finance_pending'],true)&&in_array($row['process_status'],['repairing','parts_closeout','qc_rework'],true)){
            if($scope['role']==='technician'&&(int)$row['primary_technician_user_id']!==(int)$scope['actor']['id'])throw new TamiranApiException('ثبت نتیجه نهایی فقط برای تکنسین مسئول مجاز است.',403);
            if(!$unrepaired&&(($row['result']??'')!=='repaired'||trim((string)($row['operation_report']??''))===''))throw new TamiranApiException('ابتدا نتیجه و گزارش نهایی تعمیر را ثبت کنید.',409);
        }
        if($target==='repairing' || (!$unrepaired&&in_array($target,['qc_pending','finance_pending'],true)&&in_array($row['process_status'],['repairing','parts_closeout','qc_rework'],true)))technician_require_cost($pdo,$row);
        if($target==='returned_unrepaired'){
            $amount=technician_unrepaired_amount($pdo,$caseId);
            $invoice=$pdo->prepare('SELECT id FROM repair_invoices WHERE case_id=:case');$invoice->execute(['case'=>$caseId]);
            if($amount>0&&!$invoice->fetchColumn())throw new TamiranApiException('ابتدا هزینه عیب‌یابی و قطعات مصرف‌شده در مالی تعیین تکلیف شود.',409);
        }
        if(in_array($target,['qc_pending','finance_pending','ready_for_delivery','cancelled','returned_unrepaired'],true)) {
            $partBlockers=v2_open_part_blockers($pdo,$caseId);
            if($partBlockers!==[]) throw new TamiranApiException('قطعات پرونده تعیین‌تکلیف نشده‌اند: '.implode('، ',$partBlockers),409);
        }
        if(in_array($target,['cancelled','returned_unrepaired'],true)) {
            $terminalFinance=v2_terminal_finance_blockers($pdo,$caseId);
            if($terminalFinance!==[]) throw new TamiranApiException('تعیین تکلیف مالی پیش از بستن پرونده الزامی است: '.implode('، ',$terminalFinance),409);
        }
        if($policy['qcEnabled']&&!$unrepaired&&in_array($target,['finance_pending','ready_for_delivery'],true)) {
            $qcBlockers=v2_qc_blockers($pdo,$caseId);
            if($qcBlockers!==[]) throw new TamiranApiException('کنترل کیفیت تکمیل نیست: '.implode('، ',$qcBlockers),409);
        }
        if($target==='ready_for_delivery'&&$unrepaired)throw new TamiranApiException('پرونده تعمیرنشده باید از مسیر برگشت بدون تعمیر تحویل شود.',409);
        if($target==='ready_for_delivery') {
            $financeBlockers=v2_finance_blockers($pdo,$caseId);
            if($financeBlockers!==[]) throw new TamiranApiException('مالی پرونده تکمیل نیست: '.implode('، ',$financeBlockers),409);
        }
        $now=date('Y-m-d H:i:s');
        $terminal=in_array($target,['cancelled','returned_unrepaired'],true);
        $holdReason=v2_hold_reason($target);
        $wasWaiting=$row['wait_started_at']!==null;
        $externalWaitIncrement=$wasWaiting&&$holdReason===null?max(0,time()-strtotime((string)$row['wait_started_at'])):0;
        $update=$pdo->prepare('UPDATE repair_case_workflows SET process_status=:target,terminal_reason=:terminal,locked_at=:locked,wait_reason=:wait_reason,wait_started_at=:wait_started,external_wait_seconds=external_wait_seconds+:wait_increment,lock_version=lock_version+1,updated_at=NOW() WHERE id=:id AND lock_version=:version');
        $update->execute(['target'=>$target,'terminal'=>$terminal?$reason:null,'locked'=>$terminal?$now:null,'wait_reason'=>$holdReason==='customer'?'customer':($holdReason==='part'?'part':($holdReason===null?null:'other')),'wait_started'=>$holdReason!==null?($wasWaiting?$row['wait_started_at']:$now):null,'wait_increment'=>$externalWaitIncrement,'id'=>$row['id'],'version'=>$expectedVersion]);
        if($update->rowCount()!==1) throw new TamiranApiException('پرونده هم‌زمان تغییر کرده است.',409);
        $pdo->prepare('UPDATE repair_case_stage_events SET ended_at=NOW() WHERE workflow_id=:workflow AND ended_at IS NULL')->execute(['workflow'=>$row['id']]);
        $pdo->prepare('INSERT INTO repair_case_stage_events(public_id,workflow_id,from_status,to_status,actor_user_id,reason,metadata_json,idempotency_key,started_at) VALUES(:public,:workflow,:from_status,:to_status,:actor,:reason,:metadata,:idempotency,NOW())')->execute([
            'public'=>tamiran_id(),'workflow'=>$row['id'],'from_status'=>$row['process_status'],'to_status'=>$target,'actor'=>$scope['actor']['id'],'reason'=>$reason,'metadata'=>v2_json(['requestId'=>tamiran_request_id(),'mainState'=>v2_main_state($target),'holdReason'=>$holdReason,'closureOutcome'=>v2_closure_outcome($target)]),'idempotency'=>$idempotencyKey,
        ]);
        $pdo->prepare('UPDATE repair_cases SET status=:legacy,row_version=row_version+1 WHERE id=:case')->execute(['legacy'=>v2_legacy_status($target),'case'=>$caseId]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'workflow.transition','repair_case',(string)$row['case_public_id'],['status'=>$row['process_status'],'version'=>$row['lock_version']],['status'=>$target,'version'=>$expectedVersion+1],$reason);
        if($ownsTransaction)$pdo->commit();
    } catch(Throwable $error) {
        if($ownsTransaction&&$pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    return v2_case($pdo,$scope,$caseId);
}

function v2_financial_event(PDO $pdo,array $scope,array $case,?int $invoiceId,string $eventType,int $customerBalanceDelta,int $cashDelta,int $directCostDelta,string $referenceType,string $referencePublicId,string $idempotencyKey,array $metadata=[]):string
{
    $allowed=['invoice_issued','payment_received','refund_issued','discount_applied','part_cost_posted','technician_commission_accrued','receivable_opened','payment_reversed','adjustment'];
    if(!in_array($eventType,$allowed,true))throw new TamiranApiException('نوع رویداد مالی معتبر نیست.',500);
    $public=tamiran_id();
    $pdo->prepare('INSERT INTO repair_financial_ledger(public_id,shop_id,branch_id,case_id,customer_id,invoice_id,event_type,customer_balance_delta,cash_delta,direct_cost_delta,reference_type,reference_public_id,idempotency_key,metadata_json,created_by_user_id) VALUES(:public,:shop,:branch,:case,:customer,:invoice,:event,:balance,:cash,:cost,:reference_type,:reference_public,:idempotency,:metadata,:actor)')->execute([
        'public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$case['case_id'],'customer'=>$case['customer_id'],'invoice'=>$invoiceId,
        'event'=>$eventType,'balance'=>$customerBalanceDelta,'cash'=>$cashDelta,'cost'=>$directCostDelta,'reference_type'=>$referenceType,
        'reference_public'=>$referencePublicId,'idempotency'=>v2_text($idempotencyKey,'شناسه یکتای رویداد مالی',160),'metadata'=>v2_json($metadata),'actor'=>$scope['actor']['id'],
    ]);
    return$public;
}

function v2_notify(PDO $pdo, array $scope, int $userId, string $event, string $title, string $body, ?string $entityType=null, ?string $entityPublicId=null): void
{
    $pdo->prepare('INSERT INTO tamiran_notifications(public_id,shop_id,branch_id,recipient_user_id,event_code,title,body,entity_type,entity_public_id) VALUES(:public,:shop,:branch,:recipient,:event,:title,:body,:type,:entity)')
        ->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'recipient'=>$userId,'event'=>$event,'title'=>$title,'body'=>$body,'type'=>$entityType,'entity'=>$entityPublicId]);
}

function v2_stock_mutate(PDO $pdo, array $scope, int $warehouseId, int $itemId, int $physicalDelta, int $reservedDelta, string $movement, string $referenceType, string $referencePublicId, string $reason, ?int $caseId=null, int $unitCost=0): array
{
    $select=$pdo->prepare('SELECT physical_quantity,reserved_quantity,average_unit_cost,row_version FROM repair_branch_stock WHERE shop_id=:shop AND branch_id=:branch AND warehouse_id=:warehouse AND item_id=:item FOR UPDATE');
    $select->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'warehouse'=>$warehouseId,'item'=>$itemId]);
    $row=$select->fetch();
    if(!is_array($row)) throw new TamiranApiException('موجودی کالا در انبار شعبه تعریف نشده است.',404);
    $physical=(int)$row['physical_quantity']+$physicalDelta;
    $reserved=(int)$row['reserved_quantity']+$reservedDelta;
    if($physical<0) throw new TamiranApiException('موجودی فیزیکی نمی‌تواند منفی شود.',409);
    if($reserved<0 || $reserved>$physical) throw new TamiranApiException('رزرو نمی‌تواند منفی یا بیشتر از موجودی فیزیکی باشد.',409);
    $methodStatement=$pdo->prepare('SELECT inventory_cost_method FROM repair_shops WHERE id=:shop LIMIT 1');$methodStatement->execute(['shop'=>$scope['shop_id']]);$costMethod=(string)$methodStatement->fetchColumn();
    $average=(int)$row['average_unit_cost'];
    if($physicalDelta>0 && $unitCost>0) {
        $oldPhysical=(int)$row['physical_quantity'];
        $average=$costMethod==='last_purchase'?$unitCost:(int)round((($oldPhysical*$average)+($physicalDelta*$unitCost))/max(1,$oldPhysical+$physicalDelta));
        if($costMethod==='fifo'){
            $pdo->prepare('INSERT INTO repair_inventory_cost_layers(public_id,shop_id,warehouse_id,item_id,source_public_id,received_quantity,remaining_quantity,unit_cost) VALUES(:public,:shop,:warehouse,:item,:source,:quantity,:quantity2,:cost)')
                ->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'warehouse'=>$warehouseId,'item'=>$itemId,'source'=>$referencePublicId,'quantity'=>$physicalDelta,'quantity2'=>$physicalDelta,'cost'=>$unitCost]);
        }
    } elseif($physicalDelta<0 && $costMethod==='fifo') {
        $remaining=-$physicalDelta;$costTotal=0;
        $layers=$pdo->prepare('SELECT id,remaining_quantity,unit_cost FROM repair_inventory_cost_layers WHERE shop_id=:shop AND warehouse_id=:warehouse AND item_id=:item AND remaining_quantity>0 ORDER BY received_at,id FOR UPDATE');
        $layers->execute(['shop'=>$scope['shop_id'],'warehouse'=>$warehouseId,'item'=>$itemId]);
        foreach($layers->fetchAll() as $layer){if($remaining<1)break;$take=min($remaining,(int)$layer['remaining_quantity']);$pdo->prepare('UPDATE repair_inventory_cost_layers SET remaining_quantity=remaining_quantity-:take WHERE id=:id')->execute(['take'=>$take,'id'=>$layer['id']]);$costTotal+=$take*(int)$layer['unit_cost'];$remaining-=$take;}
        $unitCost=$remaining===0?(int)round($costTotal/max(1,-$physicalDelta)):$average;
    }
    $pdo->prepare('UPDATE repair_branch_stock SET physical_quantity=:physical,reserved_quantity=:reserved,average_unit_cost=:average,row_version=row_version+1 WHERE warehouse_id=:warehouse AND item_id=:item')
        ->execute(['physical'=>$physical,'reserved'=>$reserved,'average'=>$average,'warehouse'=>$warehouseId,'item'=>$itemId]);
    $public=tamiran_id();
    $pdo->prepare('INSERT INTO repair_inventory_ledger(public_id,shop_id,branch_id,warehouse_id,item_id,case_id,movement_type,physical_delta,reserved_delta,unit_cost,balance_physical,balance_reserved,reference_type,reference_public_id,reason,actor_user_id) VALUES(:public,:shop,:branch,:warehouse,:item,:case,:movement,:physical_delta,:reserved_delta,:unit_cost,:physical,:reserved,:reference_type,:reference_public,:reason,:actor)')
        ->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'warehouse'=>$warehouseId,'item'=>$itemId,'case'=>$caseId,'movement'=>$movement,'physical_delta'=>$physicalDelta,'reserved_delta'=>$reservedDelta,'unit_cost'=>$unitCost,'physical'=>$physical,'reserved'=>$reserved,'reference_type'=>$referenceType,'reference_public'=>$referencePublicId,'reason'=>$reason,'actor'=>$scope['actor']['id']]);
    return ['physicalQuantity'=>$physical,'reservedQuantity'=>$reserved,'availableQuantity'=>$physical-$reserved,'averageUnitCost'=>$average,'ledgerPublicId'=>$public];
}


/** Device identity is scoped to one case; the initial reception event is immutable history. */
function v2_identity_value(string $value, string $deviceType, bool $required = true): ?string
{
    $value=trim(strtr($value,array_combine(preg_split('//u','۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789'))));
    if($value===''){if($required)throw new TamiranApiException('ثبت سریال یا IMEI معتبر دستگاه پیش از تحویل الزامی است.',422);return null;}
    if(mb_strlen($value)>180 || preg_match('/^(?:[-?]+|0+|ندارد|نامشخص|بدون سریال|unknown|n\/a)$/iu',$value))throw new TamiranApiException('شناسه دستگاه معتبر نیست؛ سریال واقعی یا IMEI را وارد کنید.',422);
    if(preg_match('/(موبایل|تبلت|تلفن همراه|mobile|tablet|phone)/iu',$deviceType)){
        $value=preg_replace('/[\s-]+/u','',$value);
        if(!preg_match('/^[0-9]{15}$/',$value)||preg_match('/^(.)\1+$/',$value))throw new TamiranApiException('IMEI باید ۱۵ رقم معتبر باشد.',422);
        $sum=0;for($i=0;$i<15;$i++){$digit=(int)$value[$i];if($i%2===1){$digit*=2;if($digit>9)$digit-=9;}$sum+=$digit;}
        if($sum%10!==0)throw new TamiranApiException('رقم کنترل IMEI صحیح نیست؛ شناسه را از روی دستگاه دوباره بررسی کنید.',422);
    }
    return $value;
}
function v2_identity_normalized(string $value): string
{
    return mb_strtoupper(preg_replace('/[^\p{L}\p{N}]/u','',$value)??'');
}
function v2_delivery_identity(PDO $pdo,array $scope,array $case,array $input): array
{
    $value=v2_identity_value((string)($input['deviceIdentifier']??''),(string)$case['device_type_snapshot']);
    if(($input['identityConfirmed']??false)!==true)throw new TamiranApiException('تطبیق شناسه با دستگاه تحویلی را تأیید کنید.',422);
    $old=trim((string)($case['identifier_snapshot']??''));
    $reason=trim((string)($input['identifierChangeReason']??''));
    if($old!==''&&v2_identity_normalized($old)!==v2_identity_normalized($value)){
        if($scope['role']!=='repair_manager'||$reason===''||mb_strlen($reason)>1000)throw new TamiranApiException('تغییر شناسه ثبت‌شده فقط توسط مدیر و با ثبت علت مانند تعویض برد مجاز است.',403);
    }
    $device=$pdo->prepare('SELECT id,row_version,identifier_value FROM repair_customer_devices WHERE id=:id AND shop_id=:shop FOR UPDATE');
    $device->execute(['id'=>$case['device_id'],'shop'=>$scope['shop_id']]);$currentDevice=$device->fetch();if(!$currentDevice)throw new TamiranApiException('دستگاه پرونده پیدا نشد.',409);
    $deviceIdentifier=trim((string)($currentDevice['identifier_value']??''));
    if($deviceIdentifier!==''&&v2_identity_normalized($deviceIdentifier)!==v2_identity_normalized($value)&&($scope['role']!=='repair_manager'||$reason===''||mb_strlen($reason)>1000))throw new TamiranApiException('شناسه فعلی این دستگاه متفاوت است؛ اصلاح فقط توسط مدیر و با ثبت علت مجاز است.',403);
    $normalized=v2_identity_normalized($value);
    $duplicate=$pdo->prepare('SELECT id FROM repair_customer_devices WHERE shop_id=:shop AND normalized_identifier=:identifier AND id<>:device LIMIT 1 FOR UPDATE');
    $duplicate->execute(['shop'=>$scope['shop_id'],'identifier'=>$normalized,'device'=>$case['device_id']]);if($duplicate->fetchColumn()!==false)throw new TamiranApiException('این شناسه متعلق به دستگاه دیگری است؛ مالکیت و سابقه را بررسی کنید.',409);
    if($old!==$value){
        $pdo->prepare('UPDATE repair_cases SET identifier_snapshot=:value WHERE id=:id')->execute(['value'=>$value,'id'=>$case['case_id']]);
        $pdo->prepare('UPDATE repair_customer_devices SET identifier_value=:value,normalized_identifier=:normalized,row_version=row_version+1 WHERE id=:id')->execute(['value'=>$value,'normalized'=>$normalized,'id'=>$case['device_id']]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'device.identity.record','repair_case',$case['case_public_id'],['identifier'=>$old],['identifier'=>$value,'reason'=>$reason]);
    }
    return ['identifier'=>$value,'previousIdentifier'=>$old,'changeReason'=>$reason,'confirmed'=>true];
}


/** File and note access must enforce technician assignment, not just shop membership. */
function v2_require_case_access(PDO $pdo,array $scope,array $case): void
{
    if($scope['role']!=='technician')return;
    if((int)$case['primary_technician_user_id']===(int)$scope['actor']['id'])return;
    $statement=$pdo->prepare('SELECT COUNT(*) FROM repair_case_assignments WHERE workflow_id=:workflow AND technician_user_id=:user AND ended_at IS NULL');
    $statement->execute(['workflow'=>$case['id'],'user'=>$scope['actor']['id']]);
    if((int)$statement->fetchColumn()<1)throw new TamiranApiException('این پرونده به شما تخصیص ندارد.',403);
}

require_once __DIR__.'/technician-service.php';
