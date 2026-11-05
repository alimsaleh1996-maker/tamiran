<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/private/product-service.php';

const TAMIRAN_PLANS = ['light','professional','business'];
const TAMIRAN_SHOP_SIZES = ['personal','small','medium','large'];
const TAMIRAN_MODULES = ['repair','inventory','finance','customer_portal','multi_branch','sms','warranty','analytics','accounting_integration'];

function admin_text(mixed $value, string $label, int $maxLength): string
{
    $text = trim((string) $value);
    $length = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
    if ($text === '' || $length > $maxLength) throw new TamiranApiException("{$label} معتبر نیست.");
    return $text;
}

function admin_date(mixed $value, string $label): string
{
    $date = (string) $value;
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new TamiranApiException("{$label} معتبر نیست.");
    return $date;
}

function admin_modules(mixed $value): array
{
    $modules = is_array($value) ? array_values(array_unique(array_map('strval', $value))) : ['repair'];
    if (!in_array('repair', $modules, true)) $modules[] = 'repair';
    foreach ($modules as $module) {
        if (!in_array($module, TAMIRAN_MODULES, true)) throw new TamiranApiException('یکی از ماژول‌های انتخاب‌شده معتبر نیست.');
    }
    return $modules;
}

function admin_shop_summary(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'publicId' => $row['public_id'],
        'code' => $row['public_shop_code'],
        'internalCode' => $row['shop_code'],
        'publicShopCode' => $row['public_shop_code'],
        'name' => $row['name'],
        'repairType' => $row['repair_type'],
        'typeLocked' => (bool) $row['repair_type_locked'],
        'size' => $row['size_profile'],
        'plan' => $row['plan_code'],
        'operationMode' => $row['operation_mode'],
        'productProfile' => $row['product_profile'],
        'inventoryMode' => $row['inventory_mode'],
        'qcMode' => $row['qc_mode'],
        'featureFlags' => json_decode((string)$row['feature_flags_json'],true) ?: [],
        'inventoryCostMethod' => $row['inventory_cost_method'],
        'modules' => json_decode((string) $row['modules_json'], true) ?: [],
        'status' => tamiran_license_state($row),
        'lifecycleStatus' => $row['lifecycle_status'],
        'startedAt' => $row['license_started_at'],
        'expiresAt' => $row['license_expires_at'],
        'nationalCodeRequired' => (bool) $row['national_code_required'],
        'maxUsers' => (int) $row['max_users'],
        'maxBranches' => (int) $row['max_branches'],
        'userCount' => (int) ($row['user_count'] ?? 0),
        'branchCount' => (int) ($row['branch_count'] ?? 0),
        'openTickets' => (int) ($row['open_tickets'] ?? 0),
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function admin_module_changes(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT change_log.*, shop.name AS shop_name, shop.public_shop_code AS shop_code, actor.display_name AS actor_name
         FROM tamiran_shop_module_changes change_log
         INNER JOIN repair_shops shop ON shop.id=change_log.shop_id
         INNER JOIN tamiran_users actor ON actor.id=change_log.actor_user_id
         ORDER BY change_log.created_at DESC, change_log.id DESC LIMIT 500'
    )->fetchAll();
    return array_map(static function(array $row): array {
        return [
            'id'=>(int)$row['id'], 'shopId'=>(int)$row['shop_id'], 'shopName'=>(string)$row['shop_name'], 'shopCode'=>(string)$row['shop_code'],
            'actorName'=>(string)$row['actor_name'], 'previousModules'=>json_decode((string)$row['previous_modules_json'],true)?:[],
            'newModules'=>json_decode((string)$row['new_modules_json'],true)?:[], 'addedModules'=>json_decode((string)$row['added_modules_json'],true)?:[],
            'removedModules'=>json_decode((string)$row['removed_modules_json'],true)?:[], 'reason'=>(string)$row['change_reason'],
            'context'=>(string)($row['change_context']??'manual'), 'relatedPlan'=>(string)($row['related_plan_code']??''),
            'invoiceNumber'=>(string)($row['related_invoice_number']??''), 'licenseExpiresAt'=>(string)($row['related_license_expires_at']??''),
            'createdAt'=>(string)$row['created_at'],
        ];
    }, $rows);
}

function admin_random_shop_code(PDO $pdo): string
{
    $statement = $pdo->prepare('SELECT COUNT(*) FROM repair_shops WHERE shop_code = :code');
    for ($attempt = 0; $attempt < 100; $attempt++) {
        $code = (string) random_int(1000, 9999);
        $statement->execute(['code' => $code]);
        if ((int) $statement->fetchColumn() === 0) return $code;
    }
    throw new TamiranApiException('ظرفیت کدهای چهاررقمی تکمیل شده است.', 409);
}

function admin_random_public_shop_code(PDO $pdo): string
{
    $statement = $pdo->prepare('SELECT COUNT(*) FROM repair_shops WHERE public_shop_code=:code');
    for ($attempt = 0; $attempt < 100; $attempt++) {
        $code = (string) random_int(100000, 999999);
        $statement->execute(['code'=>$code]);
        if ((int)$statement->fetchColumn() === 0) return $code;
    }
    throw new TamiranApiException('تولید کد عمومی یکتای تعمیرگاه انجام نشد.', 409);
}

function admin_temporary_password(): string
{
    $alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    $password='Tmp!';
    for($index=0;$index<16;$index++)$password.=$alphabet[random_int(0,strlen($alphabet)-1)];
    return $password;
}

tamiran_api(static function (): array {
    $actor = tamiran_require_central_admin();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $pdo = tamiran_db();

    if ($method === 'GET') {
        $schemaCheck=$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='repair_shops' AND COLUMN_NAME IN ('product_profile','inventory_mode','qc_mode','feature_flags_json')");
        if((int)$schemaCheck->fetchColumn()!==4){
            throw new TamiranApiException('ساختار دیتابیس Beta 2 کامل نیست؛ فایل database/UPGRADE_BETA1_TO_BETA2.sql را یک‌بار Import کنید.',503);
        }
        $beta3Columns=$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tamiran_sales_invoices' AND COLUMN_NAME IN ('product_profile','product_snapshot_json','activation_status','activated_at')");
        $beta3Tables=$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('tamiran_product_offerings','tamiran_shop_product_changes')");
        if((int)$beta3Columns->fetchColumn()!==4||(int)$beta3Tables->fetchColumn()!==2){
            throw new TamiranApiException('ساختار دیتابیس Beta 3 کامل نیست؛ فایل database/UPGRADE_BETA2_TO_BETA3.sql را Import کنید.',503);
        }
        $beta4ReceiptColumns=$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='repair_shops' AND COLUMN_NAME IN ('public_shop_code','receipt_counter')) OR (TABLE_NAME='repair_cases' AND COLUMN_NAME IN ('case_uuid','receipt_sequence','public_receipt_no','tracking_token_hash','tracking_token_ciphertext')))");
        if((int)$beta4ReceiptColumns->fetchColumn()!==7){
            throw new TamiranApiException('ساختار دیتابیس Beta 4 کامل نیست؛ فایل database/UPGRADE_BETA3_TO_BETA4.sql را Import کنید.',503);
        }
        $rows = $pdo->query(
            "SELECT s.*,
                    (SELECT COUNT(*) FROM tamiran_users u WHERE u.shop_id = s.id) AS user_count,
                    (SELECT COUNT(*) FROM repair_branches b WHERE b.shop_id = s.id) AS branch_count,
                    (SELECT COUNT(*) FROM repair_support_tickets t WHERE t.shop_id = s.id AND t.status IN ('open','in_progress','waiting_shop')) AS open_tickets
             FROM repair_shops s
             ORDER BY s.created_at DESC"
        )->fetchAll();
        $shops = array_map('admin_shop_summary', $rows);
        $expiring = count(array_filter($shops, static fn (array $shop): bool => $shop['status'] === 'active' && strtotime($shop['expiresAt']) <= strtotime('+30 days')));
        return [
            'summary' => [
                'shops' => count($shops),
                'active' => count(array_filter($shops, static fn (array $shop): bool => $shop['status'] === 'active')),
                'expiring' => $expiring,
                'users' => (int) $pdo->query('SELECT COUNT(*) FROM tamiran_users')->fetchColumn(),
                'branches' => (int) $pdo->query('SELECT COUNT(*) FROM repair_branches')->fetchColumn(),
                'tickets' => (int) $pdo->query("SELECT COUNT(*) FROM repair_support_tickets WHERE status IN ('open','in_progress','waiting_shop')")->fetchColumn(),
            ],
            'shops' => $shops,
            'moduleChanges' => admin_module_changes($pdo),
        ];
    }

    tamiran_require_csrf();
    $input = tamiran_json_body();

    if ($method === 'POST') {
        $idempotency=trim((string)($input['idempotencyKey']??($_SERVER['HTTP_X_IDEMPOTENCY_KEY']??'')));
        if($idempotency===''||strlen($idempotency)>160)throw new TamiranApiException('شناسه یکتای ساخت تعمیرگاه الزامی است.');
        $operation=$pdo->prepare('SELECT * FROM tamiran_shop_create_operations WHERE actor_user_id=:actor AND idempotency_key=:idempotency LIMIT 1');
        $operation->execute(['actor'=>$actor['id'],'idempotency'=>$idempotency]);$existingOperation=$operation->fetch();
        if(is_array($existingOperation)){
            if($existingOperation['state']==='completed'){
                $stored=json_decode((string)$existingOperation['result_json'],true)?:[];
                return ['created'=>true,'replayed'=>true,'shopCode'=>(string)($stored['shopCode']??''),'publicShopCode'=>(string)($stored['publicShopCode']??''),'managerMobile'=>(string)($stored['managerMobile']??''),'temporaryPassword'=>tamiran_decrypt_secret((string)($stored['temporaryPasswordCiphertext']??''))];
            }
            throw new TamiranApiException($existingOperation['state']==='failed'?'ساخت قبلی ناموفق بوده است؛ فرم را بررسی و با شناسه جدید دوباره ثبت کنید.':'درخواست ساخت همین تعمیرگاه در حال پردازش است.',409);
        }
        $operationPublic=tamiran_id();
        foreach (['name', 'repairType', 'managerName', 'expiresAt'] as $key) {
            if (trim((string) ($input[$key] ?? '')) === '') throw new TamiranApiException("فیلد {$key} الزامی است.");
        }
        $managerMobile = tamiran_mobile((string) ($input['managerMobile'] ?? $input['managerPhone'] ?? ''));
        $temporaryPassword=admin_temporary_password();
        tamiran_validate_new_password($temporaryPassword);
        $name = admin_text($input['name'] ?? '', 'نام تعمیرگاه', 180);
        $managerName = admin_text($input['managerName'] ?? '', 'نام مدیر', 180);
        $branchName = admin_text($input['branchName'] ?? 'شعبه مرکزی', 'نام شعبه', 180);
        $expiresAt = admin_date($input['expiresAt'] ?? '', 'تاریخ انقضا');
        $mobileStatement = $pdo->prepare('SELECT id FROM tamiran_users WHERE username=:username OR phone=:phone LIMIT 1');
        $mobileStatement->execute(['username'=>$managerMobile, 'phone'=>$managerMobile]);
        if ($mobileStatement->fetchColumn() !== false) throw new TamiranApiException('این شماره موبایل قبلاً برای حساب دیگری ثبت شده است.', 409);
        $code = admin_random_shop_code($pdo);
        $publicShopCode = admin_random_public_shop_code($pdo);
        $type = (string) $input['repairType'];
        if (!in_array($type, ['digital', 'appliance', 'automotive', 'motorcycle', 'generic'], true)) throw new TamiranApiException('نوع تعمیرگاه معتبر نیست.');
        $size = (string) ($input['size'] ?? 'small');
        if (!in_array($size, TAMIRAN_SHOP_SIZES, true)) throw new TamiranApiException('اندازه تعمیرگاه معتبر نیست.');
        $plan = (string) ($input['plan'] ?? 'light');
        if (!in_array($plan, TAMIRAN_PLANS, true)) throw new TamiranApiException('پلن تعمیرگاه معتبر نیست.');
        $modules = admin_modules($input['modules'] ?? ['repair']);
        $productProfile=(string)($input['productProfile']??'pro');
        $productConfig=tamiran_product_config($productProfile,$modules,$input);
        $plan=$productConfig['plan'];
        $operationMode=$productConfig['operationMode'];
        $inventoryMode=$productConfig['inventoryMode'];
        $qcMode=$productConfig['qcMode'];
        $modules=$productConfig['modules'];
        $featureFlags=is_array($input['featureFlags']??null)?$input['featureFlags']:[];
        $maxUsers = $productConfig['maxUsers'];
        $maxBranches = $productConfig['maxBranches'];
        $managerEmail = trim((string) ($input['managerEmail'] ?? ''));
        if ($managerEmail !== '' && (strlen($managerEmail) > 190 || filter_var($managerEmail, FILTER_VALIDATE_EMAIL) === false)) throw new TamiranApiException('ایمیل مدیر معتبر نیست.');

        $pdo->prepare("INSERT INTO tamiran_shop_create_operations(public_id,actor_user_id,idempotency_key,state,request_snapshot_json) VALUES(:public,:actor,:idempotency,'processing',:snapshot)")
            ->execute(['public'=>$operationPublic,'actor'=>$actor['id'],'idempotency'=>$idempotency,'snapshot'=>json_encode(['name'=>$name,'repairType'=>$type,'productProfile'=>$productProfile,'inventoryMode'=>$inventoryMode,'qcMode'=>$qcMode,'managerMobile'=>$managerMobile],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);

        $pdo->beginTransaction();
        try {
            $workflowSettings = [
                'mobile_tablet'=>['estimate'=>'above_preapproval','parts'=>$inventoryMode!=='off','qc'=>$qcMode!=='off'],
                'computer_laptop'=>['estimate'=>'above_preapproval','parts'=>$inventoryMode!=='off','qc'=>$qcMode!=='off'],
            ];
            $statement = $pdo->prepare('INSERT INTO repair_shops (public_id, shop_code, public_shop_code, receipt_counter, name, repair_type, size_profile, plan_code, operation_mode, product_profile, inventory_mode, qc_mode, inventory_cost_method, allow_self_qc, allow_delivery_with_balance, workflow_settings_json, tax_settings_json, feature_flags_json, modules_json, national_code_required, license_started_at, license_expires_at, max_users, max_branches) VALUES (:public_id, :code, :public_shop_code, 0, :name, :type, :size, :plan, :operation_mode, :product_profile, :inventory_mode, :qc_mode, :cost_method, :self_qc, :delivery_balance, :workflow_settings, :tax_settings, :feature_flags, :modules, :national, :started, :expires, :max_users, :max_branches)');
            $statement->execute([
                'public_id' => tamiran_id(),
                'code' => $code,
                'public_shop_code' => $publicShopCode,
                'name' => $name,
                'type' => $type,
                'size' => $size,
                'plan' => $plan,
                'operation_mode'=>$operationMode,
                'product_profile'=>$productProfile,
                'inventory_mode'=>$inventoryMode,
                'qc_mode'=>$qcMode,
                'cost_method'=>'weighted_average',
                'self_qc'=>!empty($input['allowSelfQc']) ? 1 : 0,
                'delivery_balance'=>!empty($input['allowDeliveryWithBalance']) ? 1 : 0,
                'workflow_settings'=>json_encode($workflowSettings, JSON_UNESCAPED_UNICODE),
                'tax_settings'=>json_encode(['defaultRate'=>0,'perLine'=>true], JSON_UNESCAPED_UNICODE),
                'feature_flags'=>json_encode($featureFlags,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
                'modules' => json_encode($modules, JSON_UNESCAPED_UNICODE),
                'national' => !empty($input['nationalCodeRequired']) ? 1 : 0,
                'started' => date('Y-m-d'),
                'expires' => $expiresAt,
                'max_users' => $maxUsers,
                'max_branches' => $maxBranches,
            ]);
            $shopId = (int) $pdo->lastInsertId();
            $branch = $pdo->prepare('INSERT INTO repair_branches (shop_id, branch_code, name, is_default, business_hours_json) VALUES (:shop_id, :code, :name, 1, :hours)');
            $branch->execute(['shop_id' => $shopId, 'code' => 'MAIN', 'name' => $branchName, 'hours'=>json_encode(['sat'=>['08:00','18:00'],'sun'=>['08:00','18:00'],'mon'=>['08:00','18:00'],'tue'=>['08:00','18:00'],'wed'=>['08:00','18:00'],'thu'=>['08:00','14:00']], JSON_UNESCAPED_UNICODE)]);
            $branchId = (int) $pdo->lastInsertId();
            $user = $pdo->prepare("INSERT INTO tamiran_users (shop_id, username, display_name, phone, email, password_hash, role_code) VALUES (:shop_id, :username, :name, :phone, :email, :password_hash, 'repair_manager')");
            $user->execute([
                'shop_id' => $shopId,
                'username' => $managerMobile,
                'name' => $managerName,
                'phone' => $managerMobile,
                'email' => $managerEmail ?: null,
                'password_hash' => tamiran_password_hash($temporaryPassword),
            ]);
            $userId = (int) $pdo->lastInsertId();
            $pdo->prepare('UPDATE tamiran_users SET must_change_password=1 WHERE id=:id')->execute(['id'=>$userId]);
            $pdo->prepare('INSERT INTO tamiran_data_retention_policies(shop_id,updated_by_user_id) VALUES(:shop,:actor)')->execute(['shop'=>$shopId,'actor'=>$userId]);
            $defaultTerms='مشتری صحت مشخصات دستگاه و لوازم همراه را تأیید می‌کند. دسترسی فنی فقط در محدوده خدمت مجاز است و مسئولیت تهیه نسخه پشتیبان از داده‌ها با مشتری است، مگر اینکه خدمت جداگانه‌ای ثبت شده باشد.';
            $pdo->prepare('INSERT INTO repair_receipt_term_versions(public_id,shop_id,version_number,title,body_text,content_sha256,is_active,created_by_user_id) VALUES(:public,:shop,1,:title,:body,:hash,1,:actor)')->execute([
                'public'=>tamiran_id(),'shop'=>$shopId,'title'=>'شرایط پذیرش نسخه ۱','body'=>$defaultTerms,
                'hash'=>hash('sha256',$defaultTerms),'actor'=>$userId,
            ]);
            $pdo->prepare('INSERT INTO tamiran_user_branches (shop_id,user_id,branch_id,branch_role_code,permissions_json) VALUES (:shop_id,:user_id,:branch_id,\'repair_manager\',:permissions)')->execute([
                'shop_id'=>$shopId,'user_id'=>$userId,'branch_id'=>$branchId,'permissions'=>json_encode(['*'],JSON_UNESCAPED_UNICODE),
            ]);
            $warehousePublicId = tamiran_id();
            $pdo->prepare('INSERT INTO repair_warehouses(public_id,shop_id,branch_id,title,is_main,is_active) VALUES(:public,:shop,:branch,:title,1,1)')->execute([
                'public'=>$warehousePublicId,'shop'=>$shopId,'branch'=>$branchId,'title'=>'انبار اصلی',
            ]);
            foreach (['mobile_tablet'=>'کنترل کیفیت موبایل و تبلت','computer_laptop'=>'کنترل کیفیت کامپیوتر و لپ‌تاپ'] as $workflowCode=>$templateTitle) {
                $pdo->prepare("INSERT INTO repair_qc_templates(public_id,shop_id,workflow_code,title,source,is_active,created_by_user_id) VALUES(:public,:shop,:workflow,:title,'tamiran_standard',1,:actor)")
                    ->execute(['public'=>tamiran_id(),'shop'=>$shopId,'workflow'=>$workflowCode,'title'=>$templateTitle,'actor'=>$userId]);
                $templateId = (int)$pdo->lastInsertId();
                $qcItem = $pdo->prepare('INSERT INTO repair_qc_template_items(template_id,code,title,input_type,is_required,requires_evidence_on_fail,sort_order) VALUES(:template,:code,:title,\'pass_fail\',1,1,:sort)');
                $items = $workflowCode === 'mobile_tablet'
                    ? ['power'=>'روشن‌شدن و پایداری','display'=>'نمایشگر و لمس','connectivity'=>'شبکه و ارتباطات','charge'=>'شارژ و باتری']
                    : ['power'=>'راه‌اندازی و پایداری','display'=>'تصویر و خروجی‌ها','ports'=>'درگاه‌ها و ارتباطات','stress'=>'تست عملکرد و دما'];
                $sort = 0;
                foreach ($items as $itemCode=>$itemTitle) $qcItem->execute(['template'=>$templateId,'code'=>$itemCode,'title'=>$itemTitle,'sort'=>++$sort]);
            }
            $moduleLog = $pdo->prepare("INSERT INTO tamiran_shop_module_changes(shop_id,actor_user_id,previous_modules_json,new_modules_json,added_modules_json,removed_modules_json,change_reason,change_context,related_plan_code,related_invoice_number,related_license_expires_at) VALUES(:shop,:actor,:previous,:new,:added,:removed,:reason,'initial_setup',:plan,NULL,:expires)");
            $moduleLog->execute([
                'shop'=>$shopId, 'actor'=>(int)$actor['id'], 'previous'=>'[]',
                'new'=>json_encode($modules,JSON_UNESCAPED_UNICODE), 'added'=>json_encode($modules,JSON_UNESCAPED_UNICODE),
                'removed'=>'[]', 'reason'=>'تعریف اولیه ماژول‌ها هنگام ایجاد تعمیرگاه', 'plan'=>$plan, 'expires'=>$expiresAt,
            ]);
            tamiran_product_sync_modules($pdo,$shopId,$modules,(int)$actor['id'],'initial_setup');
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $pdo->prepare("UPDATE tamiran_shop_create_operations SET state='failed',failure_code=:code,failure_message=:message WHERE public_id=:public")->execute(['code'=>(string)$exception->getCode(),'message'=>substr($exception->getMessage(),0,1000),'public'=>$operationPublic]);
            if ($exception->getCode() === '23000') throw new TamiranApiException('کد تصادفی یا شماره موبایل مدیر تکراری شد؛ دوباره تلاش کنید.', 409);
            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $pdo->prepare("UPDATE tamiran_shop_create_operations SET state='failed',failure_code=:code,failure_message=:message WHERE public_id=:public")->execute(['code'=>(string)$exception->getCode(),'message'=>substr($exception->getMessage(),0,1000),'public'=>$operationPublic]);
            throw $exception;
        }
        $operationResult=['shopCode'=>$publicShopCode,'publicShopCode'=>$publicShopCode,'managerMobile'=>$managerMobile,'temporaryPasswordCiphertext'=>tamiran_encrypt_secret($temporaryPassword)];
        $pdo->prepare("UPDATE tamiran_shop_create_operations SET state='completed',result_json=:result WHERE public_id=:public")->execute(['result'=>json_encode($operationResult,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),'public'=>$operationPublic]);
        tamiran_log('info', 'repair_shop_created', ['shop_code' => $code, 'actor' => $actor['displayName']]);
        return ['created' => true, 'replayed'=>false, 'shopCode' => $publicShopCode, 'publicShopCode'=>$publicShopCode,'managerMobile'=>$managerMobile,'temporaryPassword'=>$temporaryPassword];
    }

    if ($method === 'PATCH') {
        $id = (int) ($input['id'] ?? 0);
        if ($id < 1) throw new TamiranApiException('تعمیرگاه معتبر نیست.');
        if (array_key_exists('repairType', $input)) throw new TamiranApiException('نوع تعمیرگاه پس از ایجاد قابل تغییر نیست.', 409);

        $statement = $pdo->prepare('SELECT * FROM repair_shops WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $current = $statement->fetch();
        if (!is_array($current)) throw new TamiranApiException('تعمیرگاه پیدا نشد.', 404);
        $name = admin_text($input['name'] ?? $current['name'], 'نام تعمیرگاه', 180);
        $size = (string)($input['size'] ?? $current['size_profile']);
        if (!in_array($size, ['personal','small','medium','large'], true)) throw new TamiranApiException('اندازه تعمیرگاه معتبر نیست.');
        $productProfile=(string)($input['productProfile']??$current['product_profile']);
        $requestedModules=admin_modules($input['modules'] ?? (json_decode((string)$current['modules_json'],true) ?: ['repair']));
        $productConfig=tamiran_product_config($productProfile,$requestedModules,[
            'maxUsers'=>$input['maxUsers']??$current['max_users'],'maxBranches'=>$input['maxBranches']??$current['max_branches'],
            'qcMode'=>$input['qcMode']??$current['qc_mode'],
        ]);
        $productChanged=$productProfile!==(string)$current['product_profile'];
        if ($productChanged) throw new TamiranApiException('تغییر Solo/Pro فقط از مسیر سرویس تغییر محصول مجاز است.', 409);
        $productReason=trim((string)($input['productChangeReason']??''));
        if ($productChanged && ($productReason==='' || (function_exists('mb_strlen')?mb_strlen($productReason):strlen($productReason))>1000)) throw new TamiranApiException('علت تغییر محصول Solo/Pro الزامی است.');
        tamiran_product_assert_transition($pdo,$current,$productConfig);
        $maxUsers = $productConfig['maxUsers'];
        $maxBranches = $productConfig['maxBranches'];
        $userCountStatement = $pdo->prepare('SELECT COUNT(*) FROM tamiran_users WHERE shop_id = :id');
        $userCountStatement->execute(['id' => $id]);
        if ($maxUsers < (int) $userCountStatement->fetchColumn()) throw new TamiranApiException('سقف کاربران نمی‌تواند از تعداد کاربران فعلی کمتر باشد.');
        $branchCountStatement = $pdo->prepare('SELECT COUNT(*) FROM repair_branches WHERE shop_id = :id');
        $branchCountStatement->execute(['id' => $id]);
        if ($maxBranches < (int) $branchCountStatement->fetchColumn()) throw new TamiranApiException('سقف شعب نمی‌تواند از تعداد شعب فعلی کمتر باشد.');
        $status = (string) ($input['status'] ?? $current['lifecycle_status']);
        if (!in_array($status, ['active', 'suspended', 'read_only'], true)) throw new TamiranApiException('وضعیت تعمیرگاه معتبر نیست.');
        $expiresAt = admin_date($input['expiresAt'] ?? $current['license_expires_at'], 'تاریخ انقضا');
        $plan = $productConfig['plan'];
        $previousModules = admin_modules(json_decode((string) $current['modules_json'], true) ?: ['repair']);
        $modules = $productConfig['modules'];
        sort($previousModules);
        sort($modules);
        $modulesChanged = $modules !== $previousModules;
        $moduleReason = trim((string)($input['moduleChangeReason'] ?? ''));
        $moduleInvoice = trim((string)($input['moduleInvoiceNumber'] ?? ''));
        $moduleContext = trim((string)($input['moduleChangeContext'] ?? 'manual'));
        if (!in_array($moduleContext, ['manual','plan_change','invoice','renewal'], true)) throw new TamiranApiException('نوع ارتباط تغییر ماژول معتبر نیست.');
        if ($modulesChanged && ($moduleReason === '' || (function_exists('mb_strlen') ? mb_strlen($moduleReason) : strlen($moduleReason)) > 1000)) {
            throw new TamiranApiException('علت تغییر ماژول‌ها الزامی است و باید حداکثر ۱۰۰۰ کاراکتر باشد.');
        }
        if ((function_exists('mb_strlen') ? mb_strlen($moduleInvoice) : strlen($moduleInvoice)) > 64) throw new TamiranApiException('شماره فاکتور مرتبط معتبر نیست.');
        if ($modulesChanged && $moduleContext === 'invoice' && $moduleInvoice === '') throw new TamiranApiException('برای تغییر مبتنی بر فاکتور، شماره فاکتور الزامی است.');
        if ($modulesChanged && $moduleContext === 'plan_change' && $plan === (string)$current['plan_code']) throw new TamiranApiException('برای ارتباط با تغییر پلن، سطح اشتراک نیز باید تغییر کند.');
        if ($modulesChanged && $moduleContext === 'renewal' && $expiresAt === (string)$current['license_expires_at']) throw new TamiranApiException('برای ارتباط با تمدید، تاریخ انقضا نیز باید تغییر کند.');
        if ($modulesChanged && $moduleContext === 'invoice') {
            $invoiceStatement = $pdo->prepare('SELECT id FROM tamiran_sales_invoices WHERE shop_id=:shop AND invoice_number=:invoice LIMIT 1');
            $invoiceStatement->execute(['shop'=>$id, 'invoice'=>$moduleInvoice]);
            if ($invoiceStatement->fetchColumn() === false) throw new TamiranApiException('فاکتور واردشده برای این تعمیرگاه پیدا نشد.', 409);
        }

        $pdo->beginTransaction();
        try {
            $update = $pdo->prepare('UPDATE repair_shops SET name=:name,size_profile=:size,license_expires_at=:expires,lifecycle_status=:status,national_code_required=:national WHERE id=:id');
            $update->execute([
                'id' => $id, 'name' => $name, 'size'=>$size, 'expires' => $expiresAt, 'status' => $status,
                'national' => array_key_exists('nationalCodeRequired', $input) ? (!empty($input['nationalCodeRequired']) ? 1 : 0) : (int) $current['national_code_required'],
            ]);
            tamiran_product_apply($pdo,$current,$productConfig,(int)$actor['id'],$productReason!==''?$productReason:($moduleReason!==''?$moduleReason:'به‌روزرسانی تنظیمات محصول'),null);
            if ($modulesChanged) {
                $added = array_values(array_diff($modules,$previousModules));
                $removed = array_values(array_diff($previousModules,$modules));
                $log = $pdo->prepare('INSERT INTO tamiran_shop_module_changes(shop_id,actor_user_id,previous_modules_json,new_modules_json,added_modules_json,removed_modules_json,change_reason,change_context,related_plan_code,related_invoice_number,related_license_expires_at) VALUES(:shop,:actor,:previous,:new,:added,:removed,:reason,:context,:plan,:invoice,:expires)');
                $log->execute([
                    'shop'=>$id, 'actor'=>(int)$actor['id'], 'previous'=>json_encode($previousModules,JSON_UNESCAPED_UNICODE),
                    'new'=>json_encode($modules,JSON_UNESCAPED_UNICODE), 'added'=>json_encode($added,JSON_UNESCAPED_UNICODE),
                    'removed'=>json_encode($removed,JSON_UNESCAPED_UNICODE), 'reason'=>$moduleReason, 'context'=>$moduleContext,
                    'plan'=>$moduleContext === 'plan_change' ? $plan : null, 'invoice'=>$moduleInvoice?:null,
                    'expires'=>$moduleContext === 'renewal' ? $expiresAt : null,
                ]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        tamiran_log('info', 'repair_shop_updated', ['shop_id' => $id, 'actor' => $actor['displayName'], 'modules_changed'=>$modulesChanged, 'module_change_reason'=>$modulesChanged?$moduleReason:null]);
        return ['updated' => true, 'modulesChanged'=>$modulesChanged, 'productChanged'=>$productChanged];
    }

    throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
});
