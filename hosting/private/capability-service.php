<?php
declare(strict_types=1);

/**
 * Commercial entitlement + RBAC + discoverability projection.
 *
 * Feature flags only describe whether code is technically available. They do
 * not grant a shop access. Access is granted solely by tamiran_shop_modules.
 */

function tamiran_capability_catalog(): array
{
    return [
        'repair' => ['label'=>'مدیریت تعمیرات','description'=>'پذیرش، پرونده و گردش اصلی تعمیر','scope'=>'both','core'=>true,'sellable'=>false],
        'inventory' => ['label'=>'انبار قطعات','description'=>'موجودی، رزرو، درخواست و گردش قطعات','scope'=>'both','core'=>false,'sellable'=>true],
        'finance' => ['label'=>'مالی پرونده','description'=>'هزینه‌ها، دریافت‌ها و مانده هر پرونده','scope'=>'both','core'=>false,'sellable'=>true],
        'customer_portal' => ['label'=>'پرتال مشتری','description'=>'پیگیری امن وضعیت تعمیر برای مشتری','scope'=>'both','core'=>false,'sellable'=>true],
        'sms' => ['label'=>'پیامک رویدادها','description'=>'اعلان مرحله‌های مهم پرونده به مشتری','scope'=>'both','core'=>false,'sellable'=>true],
        'warranty' => ['label'=>'گارانتی شرکتی','description'=>'تشخیص پوشش براساس سریال و سابقه کامل گارانتی','scope'=>'both','core'=>false,'sellable'=>true],
        'multi_branch' => ['label'=>'چندشعبه‌ای','description'=>'مدیریت شعب و گزارش تلفیقی','scope'=>'pro','core'=>false,'sellable'=>true],
        'analytics' => ['label'=>'گزارش‌های حرفه‌ای','description'=>'تحلیل SLA، بهره‌وری و روند عملیات','scope'=>'pro','core'=>false,'sellable'=>true],
        'accounting_integration' => ['label'=>'اتصال حسابداری','description'=>'خروجی و یکپارچگی مالی کنترل‌شده','scope'=>'pro','core'=>false,'sellable'=>true],
        'sla' => ['label'=>'SLA حرفه‌ای','description'=>'اولویت‌بندی، هشدار و پایش زمان تعهد','scope'=>'pro','core'=>false,'sellable'=>true],
        'api' => ['label'=>'API سازمانی','description'=>'دسترسی برنامه‌نویسی‌شده و ممیزی‌شده','scope'=>'pro','core'=>false,'sellable'=>true],
    ];
}

function tamiran_capability_discoverable(array $actor): bool
{
    if (($actor['role'] ?? '') === 'repair_manager') return true;
    $permissions = (array)($actor['permissions'] ?? []);
    return in_array('*', $permissions, true) || in_array('modules.discover', $permissions, true);
}

function tamiran_capability_permission(array $actor, string $module): string
{
    $role = (string)($actor['role'] ?? '');
    $permissions = (array)($actor['permissions'] ?? []);
    if ($role === 'repair_manager' || in_array('*', $permissions, true) || in_array($module . '.manage', $permissions, true)) return 'manage';
    if (in_array($module . '.view', $permissions, true) || in_array($module . '.use', $permissions, true)) return 'use';

    $roles = [
        'repair'=>['reception','technician','quality_control','warehouse_keeper','finance_cashier'],
        'inventory'=>['technician','warehouse_keeper'],
        'finance'=>['finance_cashier'],
        'customer_portal'=>['reception'],
        'sms'=>['reception'],
        'warranty'=>['reception','technician','quality_control'],
        'accounting_integration'=>['finance_cashier'],
    ];
    return in_array($role, $roles[$module] ?? [], true) ? 'use' : 'none';
}

function tamiran_capability_sync_legacy(PDO $pdo, array $actor): void
{
    if (!is_array($actor['shop'] ?? null)) return;
    $shopId = (int)$actor['shop']['id'];
    $legacy = array_values(array_unique(array_merge(['repair'], array_map('strval', (array)($actor['shop']['modules'] ?? [])))));
    $statement = $pdo->prepare(
        "INSERT IGNORE INTO tamiran_shop_modules(repair_shop_id,module_key,state,source,started_at,config_json,updated_by_user_id)
         VALUES(:shop,:module,'active','legacy_migration',NOW(),JSON_OBJECT(),:actor)"
    );
    foreach ($legacy as $module) {
        if (isset(tamiran_capability_catalog()[$module])) {
            $statement->execute(['shop'=>$shopId,'module'=>$module,'actor'=>(int)$actor['id']]);
        }
    }
}

function tamiran_capability_snapshot(PDO $pdo, array $actor): array
{
    if (!is_array($actor['shop'] ?? null)) return ['productProfile'=>null,'discoverable'=>false,'modules'=>[]];
    tamiran_capability_sync_legacy($pdo, $actor);
    $shopId = (int)$actor['shop']['id'];
    $profile = in_array(($actor['shop']['productProfile'] ?? ''), ['solo','pro'], true) ? (string)$actor['shop']['productProfile'] : 'pro';
    $featureFlags = (array)($actor['shop']['featureFlags'] ?? []);
    $statement = $pdo->prepare('SELECT module_key,state,source,started_at,expires_at,config_json FROM tamiran_shop_modules WHERE repair_shop_id=:shop');
    $statement->execute(['shop'=>$shopId]);
    $states = [];
    foreach ($statement->fetchAll() as $row) $states[(string)$row['module_key']] = $row;
    $discoverable = tamiran_capability_discoverable($actor);
    $result = [];
    foreach (tamiran_capability_catalog() as $key=>$definition) {
        if ($definition['scope'] !== 'both' && $definition['scope'] !== $profile) continue;
        $row = $states[$key] ?? null;
        $state = $definition['core'] ? 'active' : (string)($row['state'] ?? 'locked');
        if ($state === 'trial' && !empty($row['expires_at']) && strtotime((string)$row['expires_at']) < time()) $state = 'expired';
        // Technical rollout flags may disable code, but can never activate access.
        $technicalFlag = $featureFlags['module.' . $key] ?? $featureFlags[$key] ?? true;
        if ($technicalFlag === false && in_array($state, ['active','trial'], true)) $state = 'suspended';
        $permission = tamiran_capability_permission($actor, $key);
        $granted = in_array($state, ['active','trial'], true) && $permission !== 'none';
        $catalogVisible = !$definition['core'] && $definition['sellable'] && $discoverable && !$granted;
        $trialDays = null;
        if ($state === 'trial' && !empty($row['expires_at'])) $trialDays = max(0, (int)ceil((strtotime((string)$row['expires_at']) - time()) / 86400));
        $result[] = [
            'module'=>$key,'label'=>$definition['label'],'description'=>$definition['description'],
            'entitlement'=>$state,'permission'=>$permission,
            'navigation'=>$granted ? 'visible' : 'hidden',
            'catalog'=>$catalogVisible ? 'visible' : 'hidden',
            'access'=>$granted ? 'granted' : ($permission === 'none' ? 'denied' : 'locked'),
            'cta'=>$catalogVisible ? 'request_activation' : null,
            'trialDaysRemaining'=>$trialDays,'expiresAt'=>$row['expires_at'] ?? null,
        ];
    }
    return ['productProfile'=>$profile,'discoverable'=>$discoverable,'modules'=>$result,'generatedAt'=>gmdate('c')];
}

function tamiran_capability_find(array $snapshot, string $module): ?array
{
    foreach ((array)($snapshot['modules'] ?? []) as $item) if (($item['module'] ?? '') === $module) return $item;
    return null;
}

function tamiran_capability_require(PDO $pdo, array $actor, string $module, string $message = 'این قابلیت برای حساب شما فعال نیست.'): array
{
    $item = tamiran_capability_find(tamiran_capability_snapshot($pdo, $actor), $module);
    if (!is_array($item) || ($item['access'] ?? '') !== 'granted') throw new TamiranApiException($message, 403);
    return $item;
}

function tamiran_capability_event(PDO $pdo, int $shopId, string $module, string $event, int $actorId, array $metadata = []): void
{
    $allowed = ['module_catalog_opened','module_card_viewed','module_upgrade_cta_clicked','module_activation_requested','module_activated','contextual_upsell_viewed','contextual_upsell_clicked','trial_started','trial_expired','module_disabled','module_renewed'];
    if (!in_array($event, $allowed, true)) throw new TamiranApiException('رویداد قابلیت معتبر نیست.');
    $statement = $pdo->prepare('INSERT INTO tamiran_module_events(repair_shop_id,module_key,event_type,actor_id,metadata_json,created_at) VALUES(:shop,:module,:event,:actor,:metadata,NOW())');
    $statement->execute(['shop'=>$shopId,'module'=>$module,'event'=>$event,'actor'=>$actorId,'metadata'=>json_encode($metadata, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)]);
}
