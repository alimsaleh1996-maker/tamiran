<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require dirname(__DIR__, 2) . '/private/product-service.php';

function product_change_shop(PDO $pdo, int $shopId, bool $forUpdate = false): array
{
    $suffix = $forUpdate ? ' FOR UPDATE' : '';
    $statement = $pdo->prepare('SELECT * FROM repair_shops WHERE id=:id LIMIT 1' . $suffix);
    $statement->execute(['id' => $shopId]);
    $shop = $statement->fetch();
    if (!is_array($shop)) throw new TamiranApiException('تعمیرگاه پیدا نشد.', 404);
    return $shop;
}

function product_change_count(PDO $pdo, string $sql, int $shopId): int
{
    $statement = $pdo->prepare($sql);
    $statement->execute(['shop' => $shopId]);
    return (int) $statement->fetchColumn();
}

function product_change_precheck(PDO $pdo, array $shop, string $target): array
{
    if (!in_array($target, TAMIRAN_PRODUCTS, true)) throw new TamiranApiException('محصول مقصد معتبر نیست.');
    $shopId = (int) $shop['id'];
    $current = (string) $shop['product_profile'];
    $modules = json_decode((string) $shop['modules_json'], true) ?: ['repair'];
    $openCases = product_change_count($pdo, "SELECT COUNT(*) FROM repair_cases WHERE shop_id=:shop AND status NOT IN ('delivered','cancelled')", $shopId);
    $activeUsers = product_change_count($pdo, 'SELECT COUNT(*) FROM tamiran_users WHERE shop_id=:shop AND is_active=1', $shopId);
    $activeBranches = product_change_count($pdo, 'SELECT COUNT(*) FROM repair_branches WHERE shop_id=:shop AND is_active=1', $shopId);
    $featureOverrides = product_change_count($pdo, 'SELECT COUNT(*) FROM tamiran_shop_feature_overrides WHERE shop_id=:shop AND is_enabled=1 AND (expires_at IS NULL OR expires_at>NOW())', $shopId);
    $inventoryRows = product_change_count($pdo, 'SELECT COUNT(*) FROM repair_inventory_items WHERE shop_id=:shop', $shopId);
    $qcOpen = product_change_count($pdo, "SELECT COUNT(*) FROM repair_case_workflows WHERE shop_id=:shop AND process_status IN ('qc_pending','qc_rework','qc_conditional')", $shopId);
    $openProCases = product_change_count($pdo, "SELECT COUNT(*) FROM repair_cases WHERE shop_id=:shop AND product_profile_snapshot='pro' AND status NOT IN ('delivered','cancelled')", $shopId);
    $blockers = [];
    $warnings = [];
    if ($current === $target) $blockers[] = ['code' => 'ALREADY_ON_PRODUCT', 'message' => 'تعمیرگاه هم‌اکنون روی همین محصول است.', 'action' => null];
    if ($target === 'solo') {
        if ($activeUsers > 1) $blockers[] = ['code' => 'EXTRA_USERS', 'message' => "{$activeUsers} کاربر فعال وجود دارد.", 'action' => 'کاربران اضافه را غیرفعال کنید.'];
        if ($activeBranches > 1) $blockers[] = ['code' => 'MULTI_BRANCH', 'message' => "{$activeBranches} شعبه فعال وجود دارد.", 'action' => 'شعب اضافه را تعیین تکلیف کنید.'];
        if (in_array('multi_branch', $modules, true)) $blockers[] = ['code' => 'MULTI_BRANCH_MODULE', 'message' => 'قابلیت چندشعبه‌ای فعال است.', 'action' => 'قابلیت چندشعبه‌ای را غیرفعال کنید.'];
        if ($qcOpen > 0) $blockers[] = ['code' => 'OPEN_INDEPENDENT_QC', 'message' => "{$qcOpen} پرونده در جریان QC قرار دارد.", 'action' => 'QC پرونده‌ها را کامل کنید.'];
        if ($openProCases > 0) $blockers[] = ['code' => 'OPEN_PRO_CASES', 'message' => "{$openProCases} پرونده باز با گردش Pro وجود دارد.", 'action' => 'پرونده‌های باز Pro را ببندید.'];
    } elseif ($openCases > 0) {
        $warnings[] = ['code' => 'OPEN_SOLO_CASES_PRESERVED', 'message' => "{$openCases} پرونده باز گردش فعلی خود را حفظ می‌کنند."];
    }
    if ($inventoryRows > 0 && !in_array('inventory', $modules, true)) {
        $warnings[] = ['code' => 'INVENTORY_DATA_PRESERVED', 'message' => 'تاریخچه انبار حفظ می‌شود و قابلیت جدیدی خودکار فعال نخواهد شد.'];
    }
    return [
        'allowed' => count($blockers) === 0,
        'currentProduct' => $current,
        'targetProduct' => $target,
        'warnings' => $warnings,
        'blockers' => $blockers,
        'impact' => [
            'openCases' => $openCases,
            'users' => $activeUsers,
            'branches' => $activeBranches,
            'inventoryState' => (string) $shop['inventory_mode'],
            'qcState' => (string) $shop['qc_mode'],
            'featureOverrides' => $featureOverrides,
            'modules' => array_values(array_map('strval', $modules)),
            'preserved' => ['shop_id','public_shop_code','receipt_counter','customers','devices','repair_cases','financial_ledger','files','messages','audit','sms','portal_data'],
            'enabledByProduct' => $target === 'pro' ? ['multi_user','advanced_roles','technician_assignment','professional_workflow','independent_qc_support','advanced_permissions'] : ['solo_workflow'],
            'addonsRemainIndependent' => ['inventory','warranty','multi_branch','analytics'],
        ],
    ];
}

function product_change_operation_row(array $row): array
{
    return [
        'id' => (int) $row['id'], 'publicId' => $row['public_id'],
        'sourceProduct' => $row['source_product'], 'targetProduct' => $row['target_product'],
        'state' => $row['state'], 'result' => json_decode((string) ($row['result_json'] ?? 'null'), true),
        'failureCode' => $row['failure_code'], 'failureMessage' => $row['failure_message'],
        'createdAt' => $row['created_at'], 'completedAt' => $row['completed_at'],
    ];
}

tamiran_api(static function (): array {
    $actor = tamiran_require_central_admin();
    $pdo = tamiran_db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $shopId = (int) ($_GET['shop_id'] ?? 0);
        $target = (string) ($_GET['target'] ?? '');
        $shop = product_change_shop($pdo, $shopId);
        $check = product_change_precheck($pdo, $shop, $target);
        $historyStatement = $pdo->prepare('SELECT * FROM tamiran_product_change_operations WHERE shop_id=:shop ORDER BY id DESC LIMIT 25');
        $historyStatement->execute(['shop' => $shopId]);
        $check['history'] = array_map('product_change_operation_row', $historyStatement->fetchAll());
        return $check;
    }

    if ($method !== 'POST') throw new TamiranApiException('روش درخواست پشتیبانی نمی‌شود.', 405);
    tamiran_require_csrf();
    $input = tamiran_json_body();
    $shopId = (int) ($input['shopId'] ?? 0);
    $target = (string) ($input['targetProduct'] ?? '');
    $idempotency = trim((string) ($input['idempotencyKey'] ?? ''));
    $reason = trim((string) ($input['reason'] ?? ''));
    if ($shopId < 1 || !in_array($target, TAMIRAN_PRODUCTS, true)) throw new TamiranApiException('درخواست تغییر محصول معتبر نیست.');
    if ($idempotency === '' || strlen($idempotency) > 160) throw new TamiranApiException('کلید یکتای عملیات الزامی است.');
    if ($reason === '' || (function_exists('mb_strlen') ? mb_strlen($reason) : strlen($reason)) > 1000) throw new TamiranApiException('علت تغییر محصول الزامی است.');

    $existing = $pdo->prepare('SELECT * FROM tamiran_product_change_operations WHERE shop_id=:shop AND idempotency_key=:idempotency LIMIT 1');
    $existing->execute(['shop' => $shopId, 'idempotency' => $idempotency]);
    $existingRow = $existing->fetch();
    if (is_array($existingRow)) return ['replayed' => true, 'operation' => product_change_operation_row($existingRow)];

    $shop = product_change_shop($pdo, $shopId);
    $precheck = product_change_precheck($pdo, $shop, $target);
    if (!$precheck['allowed']) throw new TamiranApiException('تغییر محصول به‌علت وابستگی‌های فعال امکان‌پذیر نیست.', 409);
    $settings = is_array($input['settings'] ?? null) ? $input['settings'] : [];
    $snapshot = [
        'productProfile' => $shop['product_profile'], 'plan' => $shop['plan_code'],
        'operationMode' => $shop['operation_mode'], 'inventoryMode' => $shop['inventory_mode'],
        'qcMode' => $shop['qc_mode'], 'modules' => json_decode((string) $shop['modules_json'], true) ?: ['repair'],
        'featureFlags' => json_decode((string) $shop['feature_flags_json'], true) ?: [],
        'maxUsers' => (int) $shop['max_users'], 'maxBranches' => (int) $shop['max_branches'],
        'publicShopCode' => $shop['public_shop_code'], 'receiptCounter' => (int) $shop['receipt_counter'],
    ];
    $publicId = tamiran_id();
    $insert = $pdo->prepare("INSERT INTO tamiran_product_change_operations(public_id,shop_id,actor_user_id,idempotency_key,source_product,target_product,state,settings_json,precheck_json,snapshot_json) VALUES(:public,:shop,:actor,:idempotency,:source,:target,'pending',:settings,:precheck,:snapshot)");
    $insert->execute([
        'public' => $publicId, 'shop' => $shopId, 'actor' => $actor['id'], 'idempotency' => $idempotency,
        'source' => $shop['product_profile'], 'target' => $target,
        'settings' => json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        'precheck' => json_encode($precheck, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        'snapshot' => json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
    ]);
    $operationId = (int) $pdo->lastInsertId();

    try {
        $pdo->beginTransaction();
        $lockedShop = product_change_shop($pdo, $shopId, true);
        $lockedCheck = product_change_precheck($pdo, $lockedShop, $target);
        if (!$lockedCheck['allowed']) throw new TamiranApiException('شرایط تغییر محصول در زمان اجرا تغییر کرده است.', 409);
        $pdo->prepare("UPDATE tamiran_product_change_operations SET state='processing',started_at=NOW() WHERE id=:id")->execute(['id' => $operationId]);
        $modules = json_decode((string) $lockedShop['modules_json'], true) ?: ['repair'];
        $config = tamiran_product_config($target, $modules, [
            'maxUsers' => $settings['maxUsers'] ?? ($target === 'pro' ? max(2, (int) $lockedShop['max_users']) : 1),
            'maxBranches' => $settings['maxBranches'] ?? ($target === 'pro' ? max(1, (int) $lockedShop['max_branches']) : 1),
            'qcMode' => $settings['qcMode'] ?? ($target === 'pro' ? 'independent' : 'off'),
        ]);
        tamiran_product_apply($pdo, $lockedShop, $config, (int) $actor['id'], $reason, null);
        if($target==='pro'){
            $assignment=(string)($settings['assignmentMode']??'manual');
            if(!in_array($assignment,['manual','default','auto'],true))throw new TamiranApiException('روش تخصیص پرونده معتبر نیست.');
            $approval=(string)($settings['customerApprovalPolicy']??'threshold');
            if(!in_array($approval,['threshold','always','manual'],true))throw new TamiranApiException('سیاست تأیید مشتری معتبر نیست.');
            $upsert=$pdo->prepare("INSERT INTO repair_shop_settings(shop_id,setting_key,value_json) VALUES(:shop,:key,:value) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=NOW()");
            $upsert->execute(['shop'=>$shopId,'key'=>'assignment_policy','value'=>json_encode(['mode'=>$assignment],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
            $upsert->execute(['shop'=>$shopId,'key'=>'customer_approval_policy','value'=>json_encode(['mode'=>$approval],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        }
        $result = [
            'productProfile' => $target, 'setupRequired' => $target === 'pro',
            'setupSteps' => $target === 'pro' ? ['users_roles','workflow_qc','modules'] : [],
            'preservedOpenCases' => (int) $lockedCheck['impact']['openCases'],
        ];
        $pdo->prepare("UPDATE tamiran_product_change_operations SET state='completed',result_json=:result,completed_at=NOW() WHERE id=:id")
            ->execute(['result' => json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'id' => $operationId]);
        $pdo->commit();
        tamiran_log('info', 'PRODUCT_UPGRADED', ['shop_id' => $shopId, 'from' => $shop['product_profile'], 'to' => $target, 'operation' => $publicId, 'actor' => $actor['id']]);
        return ['replayed' => false, 'operation' => ['publicId' => $publicId, 'state' => 'completed', 'result' => $result]];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $pdo->prepare("UPDATE tamiran_product_change_operations SET state='failed',failure_code=:code,failure_message=:message,completed_at=NOW() WHERE id=:id")
            ->execute(['code' => 'PRODUCT_CHANGE_FAILED', 'message' => substr($error->getMessage(), 0, 1000), 'id' => $operationId]);
        throw $error;
    }
});
