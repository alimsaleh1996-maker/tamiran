<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once tamiran_private_root() . '/capability-service.php';

tamiran_api(static function (): array {
    $pdo = tamiran_db();
    $actor = tamiran_require_actor();
    if (!is_array($actor['shop'] ?? null)) throw new TamiranApiException('فضای تعمیرگاه انتخاب نشده است.', 403);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        return tamiran_capability_snapshot($pdo, $actor);
    }
    if ($method !== 'POST') throw new TamiranApiException('متد درخواست مجاز نیست.', 405);
    tamiran_require_csrf();
    $input = tamiran_json_body();
    $action = (string)($input['action'] ?? '');
    if ($action === 'request_activation') throw new TamiranApiException('فعال‌سازی ماژول از پنل مدیر کل سامانه انجام می‌شود.', 410);
    $module = trim((string)($input['module'] ?? ''));
    $catalog = tamiran_capability_catalog();
    if (!isset($catalog[$module]) || !$catalog[$module]['sellable']) throw new TamiranApiException('قابلیت انتخاب‌شده معتبر نیست.');
    if (!tamiran_capability_discoverable($actor)) throw new TamiranApiException('مشاهده یا درخواست قابلیت برای این نقش مجاز نیست.', 403);
    if ($action === 'event') {
        tamiran_capability_event($pdo, (int)$actor['shop']['id'], $module, (string)($input['event'] ?? ''), (int)$actor['id'], is_array($input['metadata'] ?? null) ? $input['metadata'] : []);
        return ['recorded'=>true];
    }
    throw new TamiranApiException('عملیات قابلیت معتبر نیست.');
});
