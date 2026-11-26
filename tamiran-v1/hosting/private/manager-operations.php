<?php
declare(strict_types=1);

function manager_operations_report(PDO $pdo, array $scope, mixed $from, mixed $to): array
{
    if ($scope['role']!=='repair_manager') throw new TamiranApiException('گزارش عملکرد فقط برای مدیر تعمیرگاه است.',403);
    $from=v2_text($from,'تاریخ آغاز گزارش',10);
    $to=v2_text($to,'تاریخ پایان گزارش',10);
    $start=DateTimeImmutable::createFromFormat('!Y-m-d',$from,new DateTimeZone('Asia/Tehran'));
    $end=DateTimeImmutable::createFromFormat('!Y-m-d',$to,new DateTimeZone('Asia/Tehran'));
    if (!$start||!$end||$start->format('Y-m-d')!==$from||$end->format('Y-m-d')!==$to||$end<$start||$start->diff($end)->days>366) {
        throw new TamiranApiException('بازه گزارش معتبر نیست؛ حداکثر یک سال را انتخاب کنید.');
    }
    $utc=new DateTimeZone('UTC');
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],
        'from'=>$start->setTimezone($utc)->format('Y-m-d H:i:s'),
        'to'=>$end->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s')];
    $who=$pdo->prepare("SELECT u.id,u.display_name FROM tamiran_users u JOIN tamiran_user_branches b
        ON b.user_id=u.id AND b.shop_id=u.shop_id WHERE u.shop_id=:shop AND b.branch_id=:branch
        AND b.branch_role_code IN ('technician','repair_manager') ORDER BY u.display_name");
    $who->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $report=[];
    while ($u=$who->fetch()) {
        $report[$u['id']]=['id'=>(int)$u['id'],'name'=>$u['display_name'],'active'=>0,'delivered'=>0,
            'repaired'=>0,'unrepaired'=>0,'technicalFailures'=>0,'qcRuns'=>0,'qcFailures'=>0,'transferReasons'=>[],'stageTimes'=>[],'withInitialDue'=>0,'onTime'=>0];
    }
    $queries=[
        ['active',"SELECT w.primary_technician_user_id AS user_id,COUNT(*) AS amount FROM repair_case_workflows w
            WHERE w.shop_id=:shop AND w.branch_id=:branch
            AND w.process_status NOT IN ('ready_for_delivery','returned_unrepaired','delivered','cancelled','closed')
            GROUP BY w.primary_technician_user_id",false],
        ['delivered',"SELECT w.primary_technician_user_id AS user_id,COUNT(*) AS amount FROM repair_case_workflows w JOIN repair_cases c ON c.id=w.case_id
            WHERE w.shop_id=:shop AND w.branch_id=:branch AND c.delivered_at>=:from AND c.delivered_at<:to
            GROUP BY w.primary_technician_user_id",true],
        ['repaired',"SELECT COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.response.technicianId')) AS UNSIGNED),e.actor_user_id) AS user_id,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.payload.result'))='repaired') AS amount,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.payload.result'))='not_repaired') AS unrepaired,
            SUM(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.payload.result'))='not_repaired'
                AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.payload.reasonCode'))='technical_failure') AS technicalFailures
            FROM repair_case_workflows w JOIN repair_case_events e ON e.case_id=w.case_id
            WHERE w.shop_id=:shop AND w.branch_id=:branch AND e.event_type='technical_finish' AND e.created_at>=:from AND e.created_at<:to
            AND NOT EXISTS(SELECT 1 FROM repair_case_events later WHERE later.case_id=e.case_id AND later.event_type='technical_finish' AND later.id>e.id)
            GROUP BY user_id",true],
        ['qcRuns',"SELECT q.repaired_by_user_id AS user_id,COUNT(*) AS amount, SUM(q.result='failed') AS qcFailures
            FROM repair_case_workflows w JOIN repair_qc_runs q ON q.case_id=w.case_id
            WHERE w.shop_id=:shop AND w.branch_id=:branch AND q.completed_at>=:from AND q.completed_at<:to
            GROUP BY q.repaired_by_user_id",true],
    ];
    foreach ($queries as [$metric,$sql,$timed]) {
        $statement=$pdo->prepare($sql);
        $statement->execute($timed?$params:array_intersect_key($params,['shop'=>true,'branch'=>true]));
        while ($row=$statement->fetch()) {
            $id=$row['user_id'];
            if (!isset($report[$id])) continue;
            $report[$id][$metric]=(int)$row['amount'];
            foreach (['unrepaired','technicalFailures','qcFailures'] as $key) if (isset($row[$key])) $report[$id][$key]=(int)$row[$key];
        }
    }
    $reasons=$pdo->prepare("SELECT h.from_user_id AS user_id,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(h.assets_json,'$.reasonLabel')),'بدون دسته‌بندی') AS label,COUNT(*) AS amount
        FROM repair_case_workflows w JOIN repair_case_handovers h ON h.workflow_id=w.id
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND h.status='accepted' AND h.decided_at>=:from AND h.decided_at<:to
        GROUP BY h.from_user_id,label ORDER BY amount DESC");
    $reasons->execute($params);
    while ($row=$reasons->fetch()) {
        if (isset($report[$row['user_id']])) $report[$row['user_id']]['transferReasons'][]=['label'=>$row['label'],'count'=>(int)$row['amount']];
    }
    $time=$pdo->prepare("SELECT COALESCE((SELECT a.technician_user_id FROM repair_case_assignments a WHERE a.workflow_id=w.id
            AND a.assignment_type='primary' AND a.started_at<=e.started_at AND (a.ended_at IS NULL OR a.ended_at>=e.started_at)
            ORDER BY a.started_at DESC,a.id DESC LIMIT 1),w.primary_technician_user_id) AS user_id,
        e.to_status, ROUND(AVG(TIMESTAMPDIFF(SECOND,e.started_at,e.ended_at))) AS average
        FROM repair_case_workflows w JOIN repair_case_stage_events e ON e.workflow_id=w.id
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND e.started_at>=:from AND e.started_at<:to AND e.ended_at IS NOT NULL
        AND e.to_status IN ('diagnosing','repairing','awaiting_customer_approval','awaiting_parts')
        GROUP BY user_id,e.to_status");
    $time->execute($params);
    while ($row=$time->fetch()) {
        if (isset($report[$row['user_id']])) $report[$row['user_id']]['stageTimes'][$row['to_status']]=(int)$row['average'];
    }
    $transferWait=$pdo->prepare("SELECT h.from_user_id AS user_id,
        ROUND(AVG(TIMESTAMPDIFF(SECOND,h.requested_at,h.decided_at))) AS average
        FROM repair_case_workflows w JOIN repair_case_handovers h ON h.workflow_id=w.id
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND h.status='accepted' AND h.decided_at>=:from AND h.decided_at<:to
        GROUP BY h.from_user_id");
    $transferWait->execute($params);
    while ($row=$transferWait->fetch()) {
        if (isset($report[$row['user_id']])) $report[$row['user_id']]['stageTimes']['transfer']=$row['average'];
    }
    $purchaseWait=$pdo->prepare("SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.requestedBy')) AS UNSIGNED) AS user_id,
        ROUND(AVG(TIMESTAMPDIFF(SECOND,p.created_at,a.created_at))) AS average
        FROM repair_case_workflows w JOIN repair_case_events p ON p.case_id=w.case_id
        JOIN repair_case_events a ON a.case_id=p.case_id AND a.id>p.id AND a.event_type='external_purchase_state'
            AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.publicId'))=JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.publicId'))
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND p.event_type='external_purchase_state'
        AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.status'))='pending'
        AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.status'))='approved' AND a.created_at>=:from AND a.created_at<:to
        GROUP BY user_id");
    $purchaseWait->execute($params);
    while ($row=$purchaseWait->fetch()) {
        if (isset($report[$row['user_id']])) $report[$row['user_id']]['stageTimes']['purchase']=$row['average'];
    }
    $deadline=$pdo->prepare("SELECT outcome.user_id,COUNT(*) AS samples,SUM(outcome.completed_at<=outcome.due_at) AS on_time FROM (
        SELECT COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.response.technicianId')) AS UNSIGNED),e.actor_user_id) AS user_id,
            e.created_at AS completed_at,
            CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(initial.metadata_json,'$.promisedAt')),'null') AS DATETIME) AS due_at
        FROM repair_case_workflows w JOIN repair_case_events e ON e.case_id=w.case_id
        JOIN repair_case_stage_events initial ON initial.workflow_id=w.id AND initial.from_status IS NULL
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND e.event_type='technical_finish'
        AND e.created_at>=:from AND e.created_at<:to
        AND NOT EXISTS(SELECT 1 FROM repair_case_events later WHERE later.case_id=e.case_id AND later.event_type='technical_finish' AND later.id>e.id)
        ) outcome WHERE outcome.due_at IS NOT NULL GROUP BY outcome.user_id");
    $deadline->execute($params);
    while ($row=$deadline->fetch()) {
        if (!isset($report[$row['user_id']])) continue;
        $report[$row['user_id']]['withInitialDue']=(int)$row['samples'];
        $report[$row['user_id']]['onTime']=(int)$row['on_time'];
    }
    return ['from'=>$from,'to'=>$to,'rows'=>array_values($report)];
}

function manager_update_case(PDO $pdo,array $scope,array $input):array
{
    if ($scope['role']!=='repair_manager') throw new TamiranApiException('تغییر اولویت تنها برای مدیر مجاز است.',403);
    $caseId=(int)($input['caseId']??0);
    $key=v2_text($input['idempotencyKey']??'','شناسه تغییر پرونده',160);
    $priority=(string)($input['priority']??'');
    if (!in_array($priority,['normal','urgent','critical'],true)) throw new TamiranApiException('اولویت معتبر نیست.');
    $reason=v2_text($input['reason']??'','علت تغییر اولویت یا موعد',1000);
    $promised=v2_text($input['promisedAt']??'','موعد',40,false);
    if ($promised!==null) {
        $parsed=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$promised,new DateTimeZone('UTC'));
        if (!$parsed||$parsed->format('Y-m-d H:i:s')!==$promised) throw new TamiranApiException('موعد معتبر نیست.');
    }
    $pdo->beginTransaction();
    try {
        $case=v2_case($pdo,$scope,$caseId,true);
        $payload=['priority'=>$priority,'promisedAt'=>$promised,'description'=>$reason,
            'previousPromisedAt'=>$case['promised_at']];
        $existing=$pdo->prepare("SELECT metadata_json FROM repair_case_events WHERE case_id=:case AND event_type='manager_priority'
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.idempotencyKey'))=:key LIMIT 1");
        $existing->execute(['case'=>$caseId,'key'=>$key]);
        if ($old=$existing->fetchColumn()) {
            $previous=json_decode($old,true);
            $payload['previousPromisedAt']=$previous['payload']['previousPromisedAt']??null;
            $replay=technician_replay($pdo,$case,$scope,'manager_priority',$key,$payload);
            $pdo->commit();
            return $replay;
        }
        if ($case['locked_at']!==null||(int)$case['lock_version']!==(int)($input['lockVersion']??-1)) {
            throw new TamiranApiException('پرونده قفل شده یا اطلاعات آن تغییر کرده است؛ تازه‌سازی کنید.',409);
        }
        $pdo->prepare('UPDATE repair_case_workflows SET promised_at=COALESCE(:due,promised_at),lock_version=lock_version+1 WHERE id=:id')
            ->execute(['due'=>$promised,'id'=>$case['id']]);
        $result=technician_event($pdo,$scope,$case,'manager_priority',$key,$payload);
        $pdo->commit();
        return $result;
    } catch(Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

/** Filter all branch workflows before applying the page limit. */
function manager_followup_queue(PDO $pdo,array $scope,mixed $filter,mixed $offset):array
{
    if ($scope['role']!=='repair_manager') throw new TamiranApiException('صف پیگیری فقط برای مدیر تعمیرگاه است.',403);
    $filter=is_string($filter)?$filter:'all';
    $offset=filter_var($offset,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);
    if (!in_array($filter,['all','customer','parts','pickup','late'],true)||$offset===false) {
        throw new TamiranApiException('فیلتر یا صفحهٔ پیگیری معتبر نیست.');
    }
    $hours=operations_policy($pdo,(int)$scope['shop_id'])['followHours'];
    $now=gmdate('Y-m-d H:i:s');
    $base="SELECT w.case_id,w.process_status,w.wait_started_at,w.promised_at,c.receipt_number,
        CONCAT_WS(' ',c.device_type_snapshot,c.brand_snapshot,c.model_snapshot) AS device,
        u.display_name AS technician,
        (SELECT MAX(e.started_at) FROM repair_case_stage_events e WHERE e.workflow_id=w.id AND e.to_status=w.process_status) AS stage_started_at
        FROM repair_case_workflows w JOIN repair_cases c ON c.id=w.case_id AND c.shop_id=w.shop_id
        LEFT JOIN tamiran_users u ON u.id=w.primary_technician_user_id
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND c.delivered_at IS NULL
        AND w.process_status NOT IN ('closed','cancelled','delivered')";
    $eligible="SELECT q.*,
        CASE WHEN q.process_status='awaiting_customer_approval' AND q.wait_started_at<=:customer THEN q.wait_started_at END AS customer,
        CASE WHEN q.process_status='awaiting_parts' AND q.wait_started_at<=:parts THEN q.wait_started_at END AS parts,
        CASE WHEN q.process_status IN ('ready_for_delivery','returned_unrepaired') AND q.stage_started_at<=:pickup THEN q.stage_started_at END AS pickup,
        CASE WHEN q.process_status NOT IN ('ready_for_delivery','returned_unrepaired') AND q.promised_at<:now THEN q.promised_at END AS late
        FROM ($base) q";
    $condition=match($filter){
        'customer'=>'customer IS NOT NULL','parts'=>'parts IS NOT NULL','pickup'=>'pickup IS NOT NULL','late'=>'late IS NOT NULL',
        default=>'customer IS NOT NULL OR parts IS NOT NULL OR pickup IS NOT NULL OR late IS NOT NULL',
    };
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'now'=>$now];
    foreach (['customer','parts','pickup'] as $name) $params[$name]=gmdate('Y-m-d H:i:s',time()-(int)$hours[$name]*3600);
    $query=$pdo->prepare("SELECT * FROM ($eligible) eligible WHERE $condition
        ORDER BY LEAST(COALESCE(customer,'9999-01-01'),COALESCE(parts,'9999-01-01'),
        COALESCE(pickup,'9999-01-01'),COALESCE(late,'9999-01-01')),case_id LIMIT 101 OFFSET $offset");
    $query->execute($params);
    $rows=$query->fetchAll();
    $more=count($rows)>100;
    $entries=[];
    $serverTime=time();
    foreach (array_slice($rows,0,100) as $row) {
        $reasons=[];
        foreach (['customer','parts','pickup','late'] as $name) {
            if ($row[$name]!==null) $reasons[]=['name'=>$name,'elapsedSeconds'=>max(0,$serverTime-strtotime($row[$name].' UTC'))];
        }
        $entries[]=['caseId'=>(int)$row['case_id'],'receiptNumber'=>$row['receipt_number'],'deviceTitle'=>$row['device'],
            'technicianName'=>$row['technician']??'','statusLabel'=>workflow_v2_technician_view($row,[])['statusLabel'],'reasons'=>$reasons];
    }
    return ['rows'=>$entries,'nextOffset'=>$more?$offset+100:null];
}
