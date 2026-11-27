<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
require $argv[1].'/public_html/api/bootstrap.php';
$pdo=tamiran_db();
$base=(int)$argv[2]; $technician=(int)$argv[3]; $item=(int)$argv[4]; $oldItem=(int)$argv[5];
$data=$pdo->prepare("SELECT c.* FROM repair_cases c JOIN repair_shops s ON s.id=c.shop_id
    WHERE c.id=? AND s.name LIKE 'TEST-QUEUE-%'");
$data->execute([$base]);
$case=$data->fetch();
if (!$case) throw new RuntimeException('Synthetic queue shop required');
$shop=(int)$case['shop_id']; $branch=(int)$case['branch_id']; $actor=(int)$case['created_by_user_id'];
$cloneCase=$pdo->prepare("INSERT INTO repair_cases(public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,
    public_receipt_no,receipt_number,tracking_token_hash,tracking_token_ciphertext,product_profile_snapshot,inventory_mode_snapshot,
    qc_mode_snapshot,feature_flags_snapshot_json,idempotency_key,device_type_snapshot,brand_snapshot,model_snapshot,declared_issue,
    accessories_json,appearance_states_json,status,assigned_to_user_id,created_by_user_id,created_at,updated_at,delivered_at)
    SELECT :public,UUID(),shop_id,:branch,customer_id,device_id,:seq,:receipt,:receipt,:tracking,tracking_token_ciphertext,
    product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,feature_flags_snapshot_json,:key,device_type_snapshot,
    brand_snapshot,model_snapshot,:issue,accessories_json,appearance_states_json,:legacy,:technician,created_by_user_id,:time,:time,:delivered
    FROM repair_cases WHERE id=:source");
$cloneWorkflow=$pdo->prepare("INSERT INTO repair_case_workflows(public_id,shop_id,branch_id,case_id,workflow_code,case_kind,
    process_status,primary_technician_user_id,preapproved_amount,diagnostic_fee_policy_json,customer_consent_json,promised_at,
    wait_started_at,wait_reason,created_at,updated_at)
    SELECT :public,shop_id,:branch,:case,workflow_code,case_kind,:status,:technician,20000000,diagnostic_fee_policy_json,
    customer_consent_json,:promise,:waiting,:reason,:time,:time FROM repair_case_workflows WHERE case_id=:source");
$assign=$pdo->prepare("INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,
    created_by_user_id,started_at,accepted_at) VALUES(?,?,?,'primary','آزمون صف',?,?,?)");
$req=$pdo->prepare("INSERT INTO repair_part_requests(public_id,shop_id,branch_id,case_id,item_id,requested_by_user_id,
    quantity,status,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?,?)");
$old='2020-01-01 08:00:00'; $recent=gmdate('Y-m-d H:i:s',time()-60); $oldDue='2020-01-02 08:00:00';
$run=bin2hex(random_bytes(4)); $prefix='QB-'.$run;
$records=[];
$pdo->beginTransaction();
try {
    $pdo->prepare("INSERT INTO repair_branches(shop_id,branch_code,name,business_hours_json)
        VALUES(?,?,?, '{}')")->execute([$shop,$run,'شعبهٔ جدا برای آزمون']);
    $otherBranch=(int)$pdo->lastInsertId();
    $clone=function(int $n,string $status,?int $owner,int $where,string $time,bool $late=false,bool $receipt=false,bool $delivered=false) use(
        $pdo,$cloneCase,$cloneWorkflow,$assign,$base,$actor,$prefix,$oldDue,$old,&$records):int {
        $legacy=match($status){
            'awaiting_assignment','reception'=>'awaiting_assignment','assigned'=>'assigned','diagnosing'=>'diagnosing',
            'awaiting_parts'=>'awaiting_part','awaiting_customer_approval'=>'awaiting_customer','ready_for_delivery'=>'ready_for_delivery',
            'returned_unrepaired'=>'returned','closed','delivered'=>'delivered','cancelled'=>'cancelled',default=>'repairing'
        };
        $number=$prefix.'-'.str_pad((string)$n,4,'0',STR_PAD_LEFT);
        $cloneCase->execute(['public'=>tamiran_id(),'branch'=>$where,'seq'=>900000+$n,'receipt'=>$number,
            'tracking'=>hash('sha256',$number),'key'=>$number,'issue'=>'دادهٔ مصنوعی صف '.$number,'legacy'=>$legacy,
            'technician'=>$owner,'time'=>$time,'delivered'=>$delivered?$time:null,'source'=>$base]);
        $id=(int)$pdo->lastInsertId();
        $wait=match($status){'awaiting_parts'=>'part','awaiting_customer_approval'=>'customer',default=>null};
        $cloneWorkflow->execute(['public'=>tamiran_id(),'branch'=>$where,'case'=>$id,'status'=>$status,'technician'=>$owner,
            'promise'=>$late?$oldDue:null,'waiting'=>$wait?$time:null,'reason'=>$wait,'time'=>$time,'source'=>$base]);
        $workflow=(int)$pdo->lastInsertId();
        if ($owner!==null) $assign->execute([tamiran_id(),$workflow,$owner,$actor,$receipt?$old:$time,$receipt?null:$time]);
        $records[]=['id'=>$id,'receipt'=>$number,'status'=>$status,'technician'=>$owner,'branch'=>$where,'late'=>$late,
            'receiptPending'=>$receipt,'delivered'=>$delivered];
        return $id;
    };
    $oldPart=$clone(1,'awaiting_parts',$technician,$branch,$old);
    $pdo->prepare("INSERT INTO repair_estimates(public_id,shop_id,case_id,estimate_number,status,total_amount,created_by_user_id)
        VALUES(?,?,?,?,'approved',20000000,?)")->execute([tamiran_id(),$shop,$oldPart,$prefix,$actor]);
    $oldAssigned=$clone(2,'repairing',$technician,$branch,$old);
    $other=$clone(3,'awaiting_parts',$technician,$otherBranch,$old);
    $oldRequests=[];
    for($n=0;$n<2;$n++) {
        $req->execute([tamiran_id(),$shop,$branch,$oldPart,$oldItem,$technician,'pending',$old,$old]);
        $oldRequests[]=(int)$pdo->lastInsertId();
    }
    $req->execute([tamiran_id(),$shop,$otherBranch,$other,$oldItem,$technician,'pending',$old,$old]);
    $hot=$clone(4,'parts_closeout',$technician,$branch,$recent);
    $hotQuery=$pdo->prepare("INSERT INTO repair_hot_returns(public_id,shop_id,branch_id,case_id,item_id,technician_user_id) VALUES(?,?,?,?,?,?)");
    for($n=0;$n<2;$n++) $hotQuery->execute([tamiran_id(),$shop,$branch,$hot,$item,$technician]);
    $statuses=['awaiting_assignment','ready_for_delivery','returned_unrepaired','cancelled','closed','delivered','qc_pending',
        'qc_conditional','qc_rework','finance_pending','awaiting_customer_approval','diagnosing','estimate_pending','assigned'];
    foreach($statuses as $n=>$state) $clone(5+$n,$state,$n<6?null:$technician,$branch,$recent,$state==='diagnosing',
        $state==='assigned',$state==='delivered');
    $clone(19,'returned_unrepaired',null,$branch,$recent,false,false,true);
    $clone(20,'awaiting_parts',null,$branch,$recent);
    for($n=21;$n<=640;$n++) {
        $id=$clone($n,$n>610?'closed':'repairing',$technician,$branch,$recent);
        if ($n<=570) for($i=0;$i<2;$i++) $req->execute([tamiran_id(),$shop,$branch,$id,$item,$technician,
            $i?'pending':'needs_supply',$recent,$recent]);
    }
    $pdo->prepare('UPDATE repair_cases SET created_at=?,updated_at=? WHERE id=?')->execute([$old,$old,$base]);
    $pdo->prepare('UPDATE repair_case_workflows SET created_at=?,updated_at=? WHERE case_id=?')->execute([$old,$old,$base]);
    $pdo->commit();
    echo json_encode(compact('records','oldPart','oldAssigned','oldRequests','other','shop','branch','hot','prefix'),JSON_THROW_ON_ERROR);
} catch(Throwable $error) {
    $pdo->rollBack();
    throw $error;
}
