<?php
declare(strict_types=1);

function manager_pulse(PDO $pdo,array $scope):array
{
    if ($scope['role']!=='repair_manager') throw new TamiranApiException('نبض تعمیرگاه فقط برای مدیر تعمیرگاه است.',403);
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']];
    $receipt=v2_receipt_pending_since_sql();
    $params['receipt_cutoff']=gmdate('Y-m-d H:i:s',time()-operations_policy($pdo,(int)$scope['shop_id'])['followHours']['receipt']*3600);
    $work=$pdo->prepare("SELECT w.process_status,w.primary_technician_user_id AS technician_id,COUNT(*) AS amount,
        SUM(($receipt) IS NOT NULL) AS receipt_pending,
        SUM(($receipt)<=:receipt_cutoff) AS receipt_overdue,
        SUM(w.promised_at IS NOT NULL AND w.promised_at<UTC_TIMESTAMP()
            AND w.process_status NOT IN ('ready_for_delivery','returned_unrepaired')) AS overdue
        FROM repair_case_workflows w INNER JOIN repair_cases c ON c.id=w.case_id AND c.shop_id=w.shop_id
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND c.delivered_at IS NULL
        AND w.process_status NOT IN ('closed','cancelled','delivered')
        GROUP BY w.process_status,w.primary_technician_user_id");
    $work->execute($params);
    $users=$pdo->prepare("SELECT u.id,u.display_name FROM tamiran_users u INNER JOIN tamiran_user_branches b
        ON b.user_id=u.id AND b.shop_id=u.shop_id WHERE b.shop_id=:shop AND b.branch_id=:branch
        AND b.branch_role_code='technician' AND u.is_active=1 ORDER BY u.display_name,u.id");
    $users->execute(array_intersect_key($params,['shop'=>true,'branch'=>true]));
    $technicians=[];
    while ($user=$users->fetch()) {
        $id=(int)$user['id'];
        $technicians[$id]=['id'=>$id,'name'=>$user['display_name'],'active'=>0,'awaitingReceipt'=>0,'overdue'=>0];
    }
    $stages=[];$unreceived=0;$overdue=0;$receiptOverdue=0;
    while ($row=$work->fetch()) {
        $stage=$row['process_status'];$id=(int)$row['technician_id'];
        $stages[$stage]=($stages[$stage]??0)+(int)$row['amount'];
        $unreceived+=(int)$row['receipt_pending'];$overdue+=(int)$row['overdue'];$receiptOverdue+=(int)$row['receipt_overdue'];
        if (!isset($technicians[$id])||in_array($stage,['ready_for_delivery','returned_unrepaired'],true)) continue;
        $technicians[$id]['active']+=(int)$row['amount'];
        $technicians[$id]['awaitingReceipt']+=(int)$row['receipt_pending'];
        $technicians[$id]['overdue']+=(int)$row['overdue'];
    }
    $hot=$pdo->prepare("SELECT COUNT(*) FROM repair_hot_returns WHERE shop_id=:shop AND branch_id=:branch
        AND status IN ('pending_return','waiting_review','rejected')");
    $hot->execute(array_intersect_key($params,['shop'=>true,'branch'=>true]));
    return ['stages'=>(object)$stages,'technicians'=>array_values($technicians),'awaitingReceipt'=>$unreceived,
        'overdue'=>$overdue,'receiptOverdue'=>$receiptOverdue,'openHotReturns'=>(int)$hot->fetchColumn()];
}

function manager_operations_report(PDO $pdo, array $scope, mixed $from, mixed $to, ?array $detail=null): array
{
    if ($scope['role']!=='repair_manager') throw new TamiranApiException('گزارش عملکرد فقط برای مدیر تعمیرگاه است.',403);
    $params=manager_report_dates($scope,$from,$to);
    $sources=manager_report_sources();
    if ($detail!==null) return manager_report_cases($pdo,$params,$sources,$detail);
    $who=$pdo->prepare("SELECT u.id,u.display_name FROM tamiran_users u JOIN tamiran_user_branches b
        ON b.user_id=u.id AND b.shop_id=u.shop_id WHERE u.shop_id=:shop AND b.branch_id=:branch
        AND b.branch_role_code IN ('technician','repair_manager') ORDER BY u.display_name");
    $who->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $report=[];
    while ($u=$who->fetch()) {
        $report[$u['id']]=['id'=>(int)$u['id'],'name'=>$u['display_name'],'active'=>0,'delivered'=>0,
            'assigned'=>0,'repaired'=>0,'unrepaired'=>0,'technicalFailures'=>0,'trend'=>[],'completedCases'=>[],'qcRuns'=>0,'qcFailures'=>0,'transferReasons'=>[],'stageTimes'=>[],'withInitialDue'=>0,'onTime'=>0];
    }
    foreach (['active','assigned','delivered','qcRuns','completed','stageTime','transfer','purchase','deadline'] as $metric) {
        [$sql,$timed]=$sources[$metric];
        $query=$pdo->prepare($sql);
        $query->execute(manager_report_params($params,$timed));
        $totals=[];
        while ($row=$query->fetch()) {
            $id=$row['user_id'];
            if (!isset($report[$id])) continue;
            switch ($metric) {
                case 'completed':
                    $result=$row['result']==='repaired'?'repaired':'unrepaired';
                    $report[$id][$result]++;
                    if ($result==='unrepaired'&&$row['reason']==='technical_failure') $report[$id]['technicalFailures']++;
                    $day=$row['local_day'];
                    $report[$id]['trend'][$day]=($report[$id]['trend'][$day]??0)+1;
                    if (count($report[$id]['completedCases'])<50) $report[$id]['completedCases'][]=[
                        'id'=>(int)$row['case_id'],'receiptNumber'=>$row['receipt_number'],'result'=>$result,
                    ];
                    break;
                case 'qcRuns':
                    $report[$id]['qcRuns']++;
                    $report[$id]['qcFailures']+=(int)$row['sample_value'];
                    break;
                case 'deadline':
                    $report[$id]['withInitialDue']++;
                    $report[$id]['onTime']+=(int)$row['sample_value'];
                    break;
                case 'stageTime':
                case 'transfer':
                case 'purchase':
                    $label=$metric==='stageTime'?$row['sample_label']:$metric;
                    $totals[$id][$label][0]=($totals[$id][$label][0]??0)+(int)$row['sample_value'];
                    $totals[$id][$label][1]=($totals[$id][$label][1]??0)+1;
                    if ($metric==='transfer') {
                        $reason=$row['sample_label'];
                        $report[$id]['transferReasons'][$reason]=($report[$id]['transferReasons'][$reason]??0)+1;
                    }
                    break;
                default:
                    $report[$id][$metric]++;
            }
        }
        foreach ($totals as $id=>$groups) foreach ($groups as $label=>[$seconds,$count]) {
            $report[$id]['stageTimes'][$label]=(int)round($seconds/$count);
        }
    }
    foreach ($report as &$row) {
        arsort($row['transferReasons']);
        $row['transferReasons']=array_map(static fn($label,$count)=>['label'=>(string)$label,'count'=>$count],
            array_keys($row['transferReasons']),array_values($row['transferReasons']));
    }
    unset($row);
    return ['from'=>$from,'to'=>$to,'rows'=>array_values($report)];
}

function manager_report_dates(array $scope,mixed $from,mixed $to):array
{
    $from=v2_text($from,'تاریخ آغاز گزارش',10);
    $to=v2_text($to,'تاریخ پایان گزارش',10);
    $start=DateTimeImmutable::createFromFormat('!Y-m-d',$from,new DateTimeZone('Asia/Tehran'));
    $end=DateTimeImmutable::createFromFormat('!Y-m-d',$to,new DateTimeZone('Asia/Tehran'));
    if (!$start||!$end||$start->format('Y-m-d')!==$from||$end->format('Y-m-d')!==$to||$end<$start||$start->diff($end)->days>366) {
        throw new TamiranApiException('بازه گزارش معتبر نیست؛ حداکثر یک سال را انتخاب کنید.');
    }
    $utc=new DateTimeZone('UTC');
    return ['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],
        'from'=>$start->setTimezone($utc)->format('Y-m-d H:i:s'),
        'to'=>$end->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s')];
}

function manager_report_params(array $params,bool $timed):array
{
    return $timed?$params:array_intersect_key($params,['shop'=>true,'branch'=>true]);
}

function manager_report_sources():array
{
    $scope='w.shop_id=:shop AND w.branch_id=:branch';
    $technician="COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.response.technicianId')) AS UNSIGNED),e.actor_user_id)";
    $result="JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.payload.result'))";
    $reason="JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.payload.reasonCode'))";
    $finishes="FROM repair_case_workflows w JOIN repair_case_events e ON e.case_id=w.case_id
        JOIN repair_cases c ON c.id=w.case_id AND c.shop_id=w.shop_id
        WHERE $scope AND e.event_type='technical_finish' AND e.created_at>=:from AND e.created_at<:to
        AND NOT EXISTS(SELECT 1 FROM repair_case_events later WHERE later.case_id=e.case_id AND later.event_type='technical_finish' AND later.id>e.id)";
    $initialDue="(SELECT CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(initial.metadata_json,'$.promisedAt')),'null') AS DATETIME)
        FROM repair_case_stage_events initial WHERE initial.workflow_id=w.id AND initial.from_status IS NULL ORDER BY initial.id LIMIT 1)";
    return [
        'active'=>["SELECT w.case_id,w.primary_technician_user_id AS user_id FROM repair_case_workflows w
            WHERE $scope AND w.process_status NOT IN ('ready_for_delivery','returned_unrepaired','delivered','cancelled','closed')",false],
        'assigned'=>["SELECT w.case_id,a.technician_user_id AS user_id
            FROM repair_case_workflows w JOIN repair_case_assignments a ON a.workflow_id=w.id
            WHERE $scope AND a.assignment_type='primary' AND a.started_at>=:from AND a.started_at<:to
            AND NOT EXISTS(SELECT 1 FROM repair_case_assignments earlier WHERE earlier.workflow_id=w.id AND earlier.assignment_type='primary' AND earlier.id<a.id)",true],
        'delivered'=>["SELECT w.case_id,w.primary_technician_user_id AS user_id FROM repair_case_workflows w JOIN repair_cases c ON c.id=w.case_id
            WHERE $scope AND c.delivered_at>=:from AND c.delivered_at<:to",true],
        'qcRuns'=>["SELECT w.case_id,q.repaired_by_user_id AS user_id,COALESCE(q.result='failed',0) AS sample_value
            FROM repair_case_workflows w JOIN repair_qc_runs q ON q.case_id=w.case_id
            WHERE $scope AND q.completed_at>=:from AND q.completed_at<:to",true],
        'completed'=>["SELECT w.case_id,$technician AS user_id,$result AS result,$reason AS reason,
            DATE(DATE_ADD(e.created_at,INTERVAL 210 MINUTE)) AS local_day,c.receipt_number
            $finishes AND $result IN ('repaired','not_repaired') ORDER BY e.created_at DESC,e.id DESC",true],
        'deadline'=>["SELECT w.case_id,$technician AS user_id,e.created_at<=$initialDue AS sample_value
            $finishes AND $initialDue IS NOT NULL",true],
        'stageTime'=>["SELECT w.case_id,COALESCE((SELECT a.technician_user_id FROM repair_case_assignments a WHERE a.workflow_id=w.id
            AND a.assignment_type='primary' AND a.started_at<=e.started_at AND (a.ended_at IS NULL OR a.ended_at>=e.started_at)
            ORDER BY a.started_at DESC,a.id DESC LIMIT 1),w.primary_technician_user_id) AS user_id,
            e.to_status AS sample_label,TIMESTAMPDIFF(SECOND,e.started_at,e.ended_at) AS sample_value
            FROM repair_case_workflows w JOIN repair_case_stage_events e ON e.workflow_id=w.id
            WHERE $scope AND e.started_at>=:from AND e.started_at<:to AND e.ended_at IS NOT NULL
            AND e.to_status IN ('diagnosing','repairing','awaiting_customer_approval','awaiting_parts')",true],
        'transfer'=>["SELECT w.case_id,h.from_user_id AS user_id,
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(h.assets_json,'$.reasonLabel')),'بدون دسته‌بندی') AS sample_label,
            TIMESTAMPDIFF(SECOND,h.requested_at,h.decided_at) AS sample_value
            FROM repair_case_workflows w JOIN repair_case_handovers h ON h.workflow_id=w.id
            WHERE $scope AND h.status='accepted' AND h.decided_at>=:from AND h.decided_at<:to",true],
        'purchase'=>["SELECT w.case_id,CAST(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.requestedBy')) AS UNSIGNED) AS user_id,
            TIMESTAMPDIFF(SECOND,p.created_at,a.created_at) AS sample_value
            FROM repair_case_workflows w JOIN repair_case_events p ON p.case_id=w.case_id
            JOIN repair_case_events a ON a.case_id=p.case_id AND a.id>p.id AND a.event_type='external_purchase_state'
                AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.publicId'))=JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.publicId'))
            WHERE $scope AND p.event_type='external_purchase_state'
            AND JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.status'))='pending'
            AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.status'))='approved' AND a.created_at>=:from AND a.created_at<:to",true],
    ];
}

function manager_report_cases(PDO $pdo,array $params,array $sources,array $detail):array
{
    $metric=(string)($detail['metric']??'');
    $user=filter_var($detail['technician']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $offset=filter_var($detail['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);
    $variant=v2_text($detail['variant']??'','جزئیات شاخص',180,false);
    [$source,$where]=match($metric) {
        'repaired'=>['completed',"s.result='repaired'"],
        'unrepaired'=>['completed',"s.result='not_repaired'"],
        'success'=>['completed',"(s.result='repaired' OR s.reason='technical_failure')"],
        'nonTechnical'=>['completed',"s.result='not_repaired' AND COALESCE(s.reason,'')<>'technical_failure'"],
        'qcFailures'=>['qcRuns','s.sample_value=1'],
        'onTime'=>['deadline','s.sample_value=1'],
        default=>[$metric,'1=1'],
    };
    if ($user===false||$offset===false||!isset($sources[$source])) throw new TamiranApiException('شاخص یا صفحه گزارش معتبر نیست.');
    [$sql,$timed]=$sources[$source];
    $params=manager_report_params($params,$timed)+['user'=>$user];
    if ($variant!==null&&in_array($source,['stageTime','transfer','completed'],true)) {
        $where.=$source==='completed'?' AND s.local_day=:variant':' AND s.sample_label=:variant';
        $params['variant']=$variant;
    }
    $q=$pdo->prepare("SELECT s.case_id,c.receipt_number,CONCAT_WS(' ',c.brand_snapshot,c.model_snapshot) AS device,COUNT(*) AS samples
        FROM ($sql) s JOIN repair_cases c ON c.id=s.case_id WHERE s.user_id=:user AND $where
        GROUP BY s.case_id,c.receipt_number,c.brand_snapshot,c.model_snapshot ORDER BY s.case_id DESC LIMIT 51 OFFSET $offset");
    $q->execute($params);
    $rows=$q->fetchAll();$more=count($rows)>50;
    return ['rows'=>array_map(static fn($row)=>['id'=>(int)$row['case_id'],'receiptNumber'=>$row['receipt_number'],'deviceTitle'=>$row['device'],
        'samples'=>(int)$row['samples']],array_slice($rows,0,50)),'nextOffset'=>$more?$offset+50:null];
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
    if (!in_array($filter,['all','customer','parts','pickup','receipt','late'],true)||$offset===false) {
        throw new TamiranApiException('فیلتر یا صفحهٔ پیگیری معتبر نیست.');
    }
    $hours=operations_policy($pdo,(int)$scope['shop_id'])['followHours'];
    $now=gmdate('Y-m-d H:i:s');
    $receipt=v2_receipt_pending_since_sql();
    $base="SELECT ($receipt) AS receipt_started_at,w.case_id,w.process_status,w.wait_started_at,w.promised_at,c.receipt_number,
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
        CASE WHEN q.receipt_started_at<=:receipt THEN q.receipt_started_at END AS receipt,
        CASE WHEN q.process_status NOT IN ('ready_for_delivery','returned_unrepaired') AND q.promised_at<:now THEN q.promised_at END AS late
        FROM ($base) q";
    $condition=match($filter){
        'customer'=>'customer IS NOT NULL','parts'=>'parts IS NOT NULL','pickup'=>'pickup IS NOT NULL','late'=>'late IS NOT NULL','receipt'=>'receipt IS NOT NULL',
        default=>'customer IS NOT NULL OR parts IS NOT NULL OR pickup IS NOT NULL OR receipt IS NOT NULL OR late IS NOT NULL',
    };
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'now'=>$now];
    foreach (['customer','parts','pickup','receipt'] as $name) $params[$name]=gmdate('Y-m-d H:i:s',time()-(int)$hours[$name]*3600);
    $query=$pdo->prepare("SELECT * FROM ($eligible) eligible WHERE $condition
        ORDER BY LEAST(COALESCE(customer,'9999-01-01'),COALESCE(parts,'9999-01-01'),
        COALESCE(pickup,'9999-01-01'),COALESCE(receipt,'9999-01-01'),COALESCE(late,'9999-01-01')),case_id LIMIT 101 OFFSET $offset");
    $query->execute($params);
    $rows=$query->fetchAll();
    $more=count($rows)>100;
    $entries=[];
    $serverTime=time();
    foreach (array_slice($rows,0,100) as $row) {
        $reasons=[];
        foreach (['customer','parts','pickup','receipt','late'] as $name) {
            if ($row[$name]!==null) $reasons[]=['name'=>$name,'elapsedSeconds'=>max(0,$serverTime-strtotime($row[$name].' UTC'))];
        }
        $entries[]=['caseId'=>(int)$row['case_id'],'receiptNumber'=>$row['receipt_number'],'deviceTitle'=>$row['device'],
            'technicianName'=>$row['technician']??'','statusLabel'=>workflow_v2_technician_view($row+['physical_receipt_pending'=>$row['receipt_started_at']!==null],[])['statusLabel'],'reasons'=>$reasons];
    }
    return ['rows'=>$entries,'nextOffset'=>$more?$offset+100:null];
}
