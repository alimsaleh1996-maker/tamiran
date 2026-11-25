<?php
declare(strict_types=1);
// CLI-only fixtures. Never installed publicly; only an explicitly named synthetic DB/shop is accepted.
if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
$config=require __DIR__.'/../private/config.php';$db=$config['db']??[];
if(($db['host']??'')!=='127.0.0.1'||!preg_match('/^tamiran_[a-z_]*test$/D',(string)($db['name']??'')))throw new RuntimeException('Synthetic loopback test database required');
$pdo=new PDO('mysql:host=127.0.0.1;port='.(int)$db['port'].';dbname='.$db['name'].';charset=utf8mb4',$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$caseId=(int)($argv[1]??0);$mode=$argv[2]??'';
$s=$pdo->prepare("SELECT c.id,c.shop_id,w.id AS workflow_id FROM repair_cases c JOIN repair_shops s ON s.id=c.shop_id JOIN repair_case_workflows w ON w.case_id=c.id WHERE c.id=? AND s.name LIKE 'TEST-TECH-DESK-%'");$s->execute([$caseId]);$case=$s->fetch(PDO::FETCH_ASSOC);if(!$case)throw new RuntimeException('Case outside synthetic test scope');
if($mode==='policy'){
    [$profile,$inventory,$qc]=array_slice($argv,3)+['','',''];
    if(!in_array($profile,['solo','pro'],true)||!in_array($inventory,['off','simple','pro'],true)||!in_array($qc,['off','simple','independent'],true))throw new RuntimeException('Invalid synthetic policy');
    $pdo->prepare('UPDATE repair_cases SET product_profile_snapshot=?,inventory_mode_snapshot=?,qc_mode_snapshot=? WHERE id=?')->execute([$profile,$inventory,$qc,$caseId]);
}elseif($mode==='audit-fail'){
    // Per-case failure injection; removed by audit-reset in a finally block.
    $pdo->exec("CREATE TRIGGER test_tech_audit_failure BEFORE INSERT ON tamiran_audit_log FOR EACH ROW BEGIN IF NEW.entity_public_id=(SELECT public_id FROM repair_cases WHERE id=".$caseId.") THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic audit rollback'; END IF; END");
}elseif($mode==='transition-audit-fail'){
    $pdo->exec("CREATE TRIGGER test_tech_audit_failure BEFORE INSERT ON tamiran_audit_log FOR EACH ROW BEGIN IF NEW.action_code='workflow.transition' AND NEW.entity_public_id=(SELECT public_id FROM repair_cases WHERE id=".$caseId.") THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic assignment transition rollback'; END IF; END");
}elseif($mode==='audit-reset'){$pdo->exec('DROP TRIGGER IF EXISTS test_tech_audit_failure');
}elseif($mode==='counts'){
    $s=$pdo->prepare("SELECT (SELECT COUNT(*) FROM repair_case_events WHERE case_id=:c1 AND event_type='technical_activity') AS activities,(SELECT COUNT(*) FROM repair_warranties wa JOIN repair_deliveries d ON d.id=wa.delivery_id WHERE d.case_id=:c2) AS warranties");$s->execute(['c1'=>$caseId,'c2'=>$caseId]);echo json_encode($s->fetch(PDO::FETCH_ASSOC));exit;
}else throw new RuntimeException('Unknown fixture mode');
echo 'Synthetic fixture updated';
