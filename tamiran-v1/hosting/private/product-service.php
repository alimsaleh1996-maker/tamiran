<?php
declare(strict_types=1);

const TAMIRAN_PRODUCTS = ['solo','pro'];

function tamiran_product_modules(mixed $value): array
{
    $allowed = ['repair','inventory','finance','customer_portal','multi_branch','sms','warranty','analytics','accounting_integration'];
    $modules = is_array($value) ? array_values(array_unique(array_map('strval', $value))) : ['repair'];
    if (!in_array('repair', $modules, true)) $modules[] = 'repair';
    foreach ($modules as $module) if (!in_array($module, $allowed, true)) throw new TamiranApiException('یکی از ماژول‌های محصول معتبر نیست.');
    sort($modules);
    return $modules;
}

function tamiran_product_config(string $profile, array $modules, array $requested = []): array
{
    if (!in_array($profile, TAMIRAN_PRODUCTS, true)) throw new TamiranApiException('محصول انتخاب‌شده معتبر نیست.');
    $modules = tamiran_product_modules($modules);
    $inventoryMode=(string)($requested['inventoryMode']??(in_array('inventory',$modules,true)?($profile==='solo'?'simple':'pro'):'off'));
    $qcMode=(string)($requested['qcMode']??($profile==='solo'?'off':'independent'));
    if(!in_array($inventoryMode,['off','simple','pro'],true))throw new TamiranApiException('حالت انبار معتبر نیست.');
    if(!in_array($qcMode,['off','simple','independent'],true))throw new TamiranApiException('حالت کنترل کیفیت معتبر نیست.');
    if($profile==='solo'&&$inventoryMode==='pro')throw new TamiranApiException('انبار حرفه‌ای فقط در Tamiran Pro قابل استفاده است.');
    if($profile==='solo'&&$qcMode==='independent')throw new TamiranApiException('کنترل کیفیت مستقل فقط در Tamiran Pro قابل استفاده است.');
    if($inventoryMode==='off')$modules=array_values(array_diff($modules,['inventory']));
    elseif(!in_array('inventory',$modules,true))$modules[]='inventory';
    sort($modules);
    if ($profile === 'solo') {
        $modules = array_values(array_diff($modules, ['multi_branch','analytics','accounting_integration']));
        return [
            'productProfile'=>'solo','plan'=>'light','operationMode'=>'single_user','modules'=>$modules,
            'inventoryMode'=>$inventoryMode,
            'qcMode'=>$qcMode,
            'maxUsers'=>1,'maxBranches'=>1,
        ];
    }
    $maxUsers = max(2, min(1000, (int)($requested['maxUsers'] ?? 10)));
    $maxBranches = max(1, min(100, (int)($requested['maxBranches'] ?? 1)));
    return [
        'productProfile'=>'pro','plan'=>in_array('multi_branch',$modules,true)?'business':'professional','operationMode'=>'multi_user','modules'=>$modules,
        'inventoryMode'=>$inventoryMode,
        'qcMode'=>$qcMode,
        'maxUsers'=>$maxUsers,'maxBranches'=>$maxBranches,
    ];
}

function tamiran_product_snapshot(array $config): array
{
    return [
        'productProfile'=>$config['productProfile'],'plan'=>$config['plan'],'operationMode'=>$config['operationMode'],
        'inventoryMode'=>$config['inventoryMode'],'qcMode'=>$config['qcMode'],'modules'=>$config['modules'],
        'maxUsers'=>$config['maxUsers'],'maxBranches'=>$config['maxBranches'],
    ];
}

function tamiran_product_sync_modules(PDO $pdo, int $shopId, array $modules, int $actorId, string $source = 'product_change'): void
{
    $modules = tamiran_product_modules($modules);
    $known = ['repair','inventory','finance','customer_portal','multi_branch','sms','warranty','analytics','accounting_integration'];
    $upsert = $pdo->prepare(
        "INSERT INTO tamiran_shop_modules(repair_shop_id,module_key,state,source,started_at,expires_at,config_json,updated_by_user_id)
         VALUES(:shop,:module,:state,:source,IF(:state_started='active',NOW(),NULL),NULL,JSON_OBJECT(),:actor)
         ON DUPLICATE KEY UPDATE state=VALUES(state),source=VALUES(source),started_at=IF(VALUES(state)='active',COALESCE(started_at,NOW()),started_at),updated_by_user_id=VALUES(updated_by_user_id)"
    );
    foreach ($known as $module) {
        $active = in_array($module, $modules, true);
        // Disabled module data remains intact; only new operations are locked.
        $upsert->execute(['shop'=>$shopId,'module'=>$module,'state'=>$active?'active':'suspended','state_started'=>$active?'active':'suspended','source'=>$source,'actor'=>$actorId]);
    }
}

function tamiran_product_assert_transition(PDO $pdo, array $shop, array $config): void
{
    if ($config['productProfile'] !== 'solo') return;
    $users = $pdo->prepare('SELECT COUNT(*) FROM tamiran_users WHERE shop_id=:shop AND is_active=1');
    $users->execute(['shop'=>$shop['id']]);
    $branches = $pdo->prepare('SELECT COUNT(*) FROM repair_branches WHERE shop_id=:shop AND is_active=1');
    $branches->execute(['shop'=>$shop['id']]);
    if ((int)$users->fetchColumn() > 1 || (int)$branches->fetchColumn() > 1) {
        throw new TamiranApiException('تبدیل به Solo فقط پس از غیرفعال‌کردن کاربران و شعب اضافه ممکن است.', 409);
    }
}

function tamiran_product_change_precheck(PDO $pdo, array $shop, string $target): array
{
    if(!in_array($target,TAMIRAN_PRODUCTS,true))throw new TamiranApiException('محصول مقصد معتبر نیست.');
    $shopId=(int)$shop['id'];
    $count=static function(string $sql)use($pdo,$shopId):int{$statement=$pdo->prepare($sql);$statement->execute(['shop'=>$shopId]);return(int)$statement->fetchColumn();};
    $modules=json_decode((string)$shop['modules_json'],true)?:['repair'];
    $openCases=$count("SELECT COUNT(*) FROM repair_cases WHERE shop_id=:shop AND status NOT IN ('delivered','cancelled')");
    $activeUsers=$count('SELECT COUNT(*) FROM tamiran_users WHERE shop_id=:shop AND is_active=1');
    $activeBranches=$count('SELECT COUNT(*) FROM repair_branches WHERE shop_id=:shop AND is_active=1');
    $qcOpen=$count("SELECT COUNT(*) FROM repair_case_workflows WHERE shop_id=:shop AND process_status IN ('qc_pending','qc_rework','qc_conditional')");
    $openProCases=$count("SELECT COUNT(*) FROM repair_cases WHERE shop_id=:shop AND product_profile_snapshot='pro' AND status NOT IN ('delivered','cancelled')");
    $blockers=[];$warnings=[];
    if((string)$shop['product_profile']===$target)$blockers[]=['code'=>'ALREADY_ON_PRODUCT','message'=>'تعمیرگاه هم‌اکنون روی همین محصول است.','action'=>null];
    if($target==='solo'){
        if($activeUsers>1)$blockers[]=['code'=>'EXTRA_USERS','message'=>"{$activeUsers} کاربر فعال وجود دارد.",'action'=>'کاربران اضافه را غیرفعال کنید.'];
        if($activeBranches>1)$blockers[]=['code'=>'MULTI_BRANCH','message'=>"{$activeBranches} شعبه فعال وجود دارد.",'action'=>'شعب اضافه را تعیین تکلیف کنید.'];
        if(in_array('multi_branch',$modules,true))$blockers[]=['code'=>'MULTI_BRANCH_MODULE','message'=>'قابلیت چندشعبه‌ای فعال است.','action'=>'قابلیت چندشعبه‌ای را غیرفعال کنید.'];
        if($qcOpen>0)$blockers[]=['code'=>'OPEN_INDEPENDENT_QC','message'=>"{$qcOpen} پرونده در جریان QC قرار دارد.",'action'=>'QC پرونده‌ها را کامل کنید.'];
        if($openProCases>0)$blockers[]=['code'=>'OPEN_PRO_CASES','message'=>"{$openProCases} پرونده باز با گردش Pro وجود دارد.",'action'=>'پرونده‌های باز Pro را ببندید.'];
    }elseif($openCases>0)$warnings[]=['code'=>'OPEN_CASES_PRESERVED','message'=>"{$openCases} پرونده باز گردش فعلی خود را حفظ می‌کنند."];
    return['allowed'=>$blockers===[],'currentProduct'=>(string)$shop['product_profile'],'targetProduct'=>$target,'blockers'=>$blockers,'warnings'=>$warnings,'impact'=>['openCases'=>$openCases,'users'=>$activeUsers,'branches'=>$activeBranches,'inventoryState'=>(string)$shop['inventory_mode'],'qcState'=>(string)$shop['qc_mode'],'modules'=>array_values($modules)]];
}

function tamiran_product_change_service(PDO $pdo,array $shop,array $config,int $actorId,string $reason,string $idempotency,array $settings=[],?int $invoiceId=null):array
{
    $target=(string)$config['productProfile'];
    $existing=$pdo->prepare('SELECT public_id,state,result_json FROM tamiran_product_change_operations WHERE shop_id=:shop AND idempotency_key=:key LIMIT 1');
    $existing->execute(['shop'=>$shop['id'],'key'=>$idempotency]);
    $row=$existing->fetch();
    if(is_array($row))return['replayed'=>true,'publicId'=>$row['public_id'],'state'=>$row['state'],'result'=>json_decode((string)($row['result_json']??'null'),true)];
    $check=tamiran_product_change_precheck($pdo,$shop,$target);
    if(!$check['allowed'])throw new TamiranApiException('تغییر محصول به‌علت وابستگی‌های فعال امکان‌پذیر نیست.',409);
    $snapshot=['productProfile'=>$shop['product_profile'],'plan'=>$shop['plan_code'],'operationMode'=>$shop['operation_mode'],'inventoryMode'=>$shop['inventory_mode'],'qcMode'=>$shop['qc_mode'],'modules'=>json_decode((string)$shop['modules_json'],true)?:['repair'],'maxUsers'=>(int)$shop['max_users'],'maxBranches'=>(int)$shop['max_branches'],'publicShopCode'=>$shop['public_shop_code'],'receiptCounter'=>(int)$shop['receipt_counter']];
    $public=tamiran_id();
    $pdo->prepare("INSERT INTO tamiran_product_change_operations(public_id,shop_id,actor_user_id,idempotency_key,source_product,target_product,state,settings_json,precheck_json,snapshot_json,started_at) VALUES(:public,:shop,:actor,:key,:source,:target,'processing',:settings,:precheck,:snapshot,NOW())")->execute(['public'=>$public,'shop'=>$shop['id'],'actor'=>$actorId,'key'=>$idempotency,'source'=>$shop['product_profile'],'target'=>$target,'settings'=>json_encode($settings,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'precheck'=>json_encode($check,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'snapshot'=>json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    tamiran_product_apply($pdo,$shop,$config,$actorId,$reason,$invoiceId);
    $result=['productProfile'=>$target,'setupRequired'=>$target==='pro','setupSteps'=>$target==='pro'?['users_roles','workflow_qc','modules']:[],'preservedOpenCases'=>(int)$check['impact']['openCases']];
    $pdo->prepare("UPDATE tamiran_product_change_operations SET state='completed',result_json=:result,completed_at=NOW() WHERE public_id=:public")->execute(['result'=>json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'public'=>$public]);
    tamiran_log('info',$target==='pro'?'PRODUCT_UPGRADED':'PRODUCT_DOWNGRADED',['shop_id'=>$shop['id'],'from'=>$shop['product_profile'],'to'=>$target,'operation'=>$public,'actor'=>$actorId,'invoice_id'=>$invoiceId]);
    return['replayed'=>false,'publicId'=>$public,'state'=>'completed','result'=>$result];
}

function tamiran_product_apply(PDO $pdo, array $shop, array $config, int $actorId, string $reason, ?int $invoiceId = null): bool
{
    $previous = [
        'productProfile'=>(string)$shop['product_profile'],'plan'=>(string)$shop['plan_code'],
        'operationMode'=>(string)$shop['operation_mode'],'inventoryMode'=>(string)$shop['inventory_mode'],
        'qcMode'=>(string)$shop['qc_mode'],'modules'=>json_decode((string)$shop['modules_json'],true) ?: ['repair'],
        'maxUsers'=>(int)$shop['max_users'],'maxBranches'=>(int)$shop['max_branches'],
    ];
    $next = tamiran_product_snapshot($config);
    if ($previous == $next) return false;
    $reason = trim($reason);
    if ($reason === '' || (function_exists('mb_strlen') ? mb_strlen($reason) : strlen($reason)) > 1000) {
        throw new TamiranApiException('علت تغییر محصول الزامی است و باید حداکثر ۱۰۰۰ کاراکتر باشد.');
    }
    tamiran_product_assert_transition($pdo, $shop, $config);
    $update = $pdo->prepare('UPDATE repair_shops SET product_profile=:product,plan_code=:plan,operation_mode=:operation,inventory_mode=:inventory,qc_mode=:qc,modules_json=:modules,max_users=:users,max_branches=:branches WHERE id=:id');
    $update->execute([
        'product'=>$config['productProfile'],'plan'=>$config['plan'],'operation'=>$config['operationMode'],
        'inventory'=>$config['inventoryMode'],'qc'=>$config['qcMode'],
        'modules'=>json_encode($config['modules'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
        'users'=>$config['maxUsers'],'branches'=>$config['maxBranches'],'id'=>$shop['id'],
    ]);
    tamiran_product_sync_modules($pdo, (int)$shop['id'], $config['modules'], $actorId, $invoiceId === null ? 'product_change' : 'invoice');
    $log = $pdo->prepare('INSERT INTO tamiran_shop_product_changes(public_id,shop_id,actor_user_id,previous_product,new_product,previous_config_json,new_config_json,change_reason,related_invoice_id) VALUES(:public,:shop,:actor,:previous_product,:new_product,:previous_config,:new_config,:reason,:invoice)');
    $log->execute([
        'public'=>tamiran_id(),'shop'=>$shop['id'],'actor'=>$actorId,'previous_product'=>$previous['productProfile'],
        'new_product'=>$config['productProfile'],'previous_config'=>json_encode($previous,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
        'new_config'=>json_encode($next,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'reason'=>$reason,'invoice'=>$invoiceId,
    ]);
    return true;
}

function tamiran_product_offerings(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM tamiran_product_offerings WHERE is_active=1 ORDER BY FIELD(product_code,\'solo\',\'pro\')')->fetchAll();
    return array_map(static fn(array $row): array => [
        'code'=>$row['product_code'],'title'=>$row['title'],'description'=>$row['description'],
        'defaultPlan'=>$row['default_plan_code'],'includedModules'=>json_decode((string)$row['included_modules_json'],true) ?: [],
        'allowedModules'=>json_decode((string)$row['allowed_modules_json'],true) ?: [],'limits'=>json_decode((string)$row['limits_json'],true) ?: [],
        'prices'=>json_decode((string)$row['prices_json'],true) ?: [],'features'=>json_decode((string)$row['feature_summary_json'],true) ?: [],
    ], $rows);
}
