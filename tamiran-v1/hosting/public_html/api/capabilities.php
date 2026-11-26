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
    $module = trim((string)($input['module'] ?? ''));
    $catalog = tamiran_capability_catalog();
    if (!isset($catalog[$module]) || !$catalog[$module]['sellable']) throw new TamiranApiException('قابلیت انتخاب‌شده معتبر نیست.');
    if (!tamiran_capability_discoverable($actor)) throw new TamiranApiException('مشاهده یا درخواست قابلیت برای این نقش مجاز نیست.', 403);
    if ($action === 'event') {
        tamiran_capability_event($pdo, (int)$actor['shop']['id'], $module, (string)($input['event'] ?? ''), (int)$actor['id'], is_array($input['metadata'] ?? null) ? $input['metadata'] : []);
        return ['recorded'=>true];
    }
    if ($action !== 'request_activation') throw new TamiranApiException('عملیات قابلیت معتبر نیست.');
    $reason = trim((string)($input['reason'] ?? ''));
    if ((function_exists('mb_strlen') ? mb_strlen($reason) : strlen($reason)) > 1000) throw new TamiranApiException('توضیح درخواست بیش از حد طولانی است.');
    $shopId = (int)$actor['shop']['id'];
    $pdo->beginTransaction();
    try {
        $pdo->prepare('SELECT id FROM repair_shops WHERE id=:shop FOR UPDATE')->execute(['shop'=>$shopId]);
        $item = tamiran_capability_find(tamiran_capability_snapshot($pdo, $actor), $module);
        if (is_array($item) && ($item['access'] ?? '') === 'granted') throw new TamiranApiException('این قابلیت هم‌اکنون فعال است.', 409);
        $existing = $pdo->prepare("SELECT public_id FROM tamiran_module_activation_requests WHERE repair_shop_id=:shop AND module_key=:module AND status='pending' LIMIT 1");
        $existing->execute(['shop'=>$shopId,'module'=>$module]);
        $publicId = $existing->fetchColumn();
        if (!is_string($publicId)) {
            $publicId = tamiran_id();
            $statement = $pdo->prepare("INSERT INTO tamiran_module_activation_requests(public_id,repair_shop_id,module_key,status,reason,requested_by_user_id,created_at,updated_at) VALUES(:public,:shop,:module,'pending',:reason,:actor,NOW(),NOW())");
            $statement->execute(['public'=>$publicId,'shop'=>$shopId,'module'=>$module,'reason'=>$reason?:null,'actor'=>(int)$actor['id']]);
            tamiran_capability_event($pdo, $shopId, $module, 'module_activation_requested', (int)$actor['id'], ['requestId'=>$publicId]);
            tamiran_audit($pdo, $shopId, isset($actor['branch']['id']) ? (int)$actor['branch']['id'] : null, (int)$actor['id'], 'module.activation.requested', 'module_activation_request', $publicId, null, ['module'=>$module,'status'=>'pending'], $reason?:'درخواست فعال‌سازی');
        }
        $pdo->commit();
        return ['requested'=>true,'requestId'=>$publicId];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
});
