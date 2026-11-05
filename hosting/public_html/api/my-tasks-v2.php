<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';
require_once tamiran_private_root().'/v2-core.php';

function my_tasks_case_rows(PDO $pdo,array $scope):array
{
    $role=$scope['role'];$actorId=(int)$scope['actor']['id'];
    $where='w.shop_id=:shop AND w.branch_id=:branch AND w.locked_at IS NULL';
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']];
    if($role==='technician'){
        $where.=' AND (w.primary_technician_user_id=:actor OR EXISTS(SELECT 1 FROM repair_case_assignments a WHERE a.workflow_id=w.id AND a.technician_user_id=:actor2 AND a.ended_at IS NULL))';
        $params['actor']=$actorId;$params['actor2']=$actorId;
    }elseif($role==='quality_control'){
        $where.=" AND w.process_status IN ('qc_pending','qc_conditional')";
    }elseif($role==='warehouse_keeper'){
        $where.=" AND EXISTS(SELECT 1 FROM repair_part_requests pr WHERE pr.case_id=w.case_id AND pr.status IN ('pending','needs_supply','reserved','partially_delivered','delivered'))";
    }elseif($role==='finance_cashier'){
        $where.=" AND w.process_status IN ('finance_pending','ready_for_delivery')";
    }elseif($role==='reception'){
        $where.=" AND w.process_status IN ('awaiting_customer_approval','finance_pending','ready_for_delivery')";
    }
    $statement=$pdo->prepare(
        "SELECT w.case_id,w.public_id AS workflow_public_id,w.workflow_code,w.process_status,w.promised_at,w.updated_at,w.locked_at,
                c.public_id AS case_public_id,c.receipt_number,c.product_profile_snapshot,c.inventory_mode_snapshot,
                c.qc_mode_snapshot,c.feature_flags_snapshot_json,cu.full_name AS customer_name,
                u.display_name AS technician_name,
                CASE WHEN w.promised_at IS NOT NULL AND w.promised_at<NOW() THEN 1 ELSE 0 END AS is_overdue
         FROM repair_case_workflows w
         INNER JOIN repair_cases c ON c.id=w.case_id AND c.shop_id=w.shop_id
         INNER JOIN repair_customers cu ON cu.id=c.customer_id AND cu.shop_id=w.shop_id
         LEFT JOIN tamiran_users u ON u.id=w.primary_technician_user_id
         WHERE {$where} ORDER BY is_overdue DESC,COALESCE(w.promised_at,w.updated_at),w.id LIMIT 500"
    );
    $statement->execute($params);$rows=$statement->fetchAll();
    foreach($rows as &$row){
        $policy=v2_product_policy($pdo,$scope,$row);$maps=v2_workflow_maps($policy);
        $row['case_id']=(int)$row['case_id'];$row['is_overdue']=(bool)$row['is_overdue'];
        $row['allowedTransitions']=$maps[$row['workflow_code']][$row['process_status']]??[];
        $row['blockers']=v2_case_blockers($pdo,$scope,$row);
        $row['productPolicy']=$policy;
    }
    unset($row);return$rows;
}

tamiran_api(static function():array{
    $pdo=tamiran_db();$scope=v2_scope();$tasks=my_tasks_case_rows($pdo,$scope);$counts=[];
    foreach($tasks as $task)$counts[$task['process_status']]=($counts[$task['process_status']]??0)+1;
    return['tasks'=>$tasks,'counts'=>$counts,'total'=>count($tasks),'generatedAt'=>gmdate('c')];
});
