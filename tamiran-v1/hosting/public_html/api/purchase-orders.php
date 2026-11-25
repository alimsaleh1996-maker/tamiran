<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once tamiran_private_root() . '/capability-service.php';

const TAMIRAN_PURCHASE_STATUSES = ['requested','approved','ordered','received','rejected','cancelled'];

function purchase_scope(PDO $pdo): array
{
    $actor = tamiran_require_actor();
    if (!is_array($actor['shop'] ?? null) || !is_array($actor['branch'] ?? null)) {
        throw new TamiranApiException('سفارش خرید فقط در فضای تعمیرگاه در دسترس است.', 403);
    }
    tamiran_capability_require($pdo, $actor, 'inventory', 'ماژول انبار برای این تعمیرگاه فعال نیست.');
    $role = (string) ($actor['role'] ?? '');
    if (!in_array($role, ['repair_manager','technician','warehouse_keeper'], true)) {
        throw new TamiranApiException('نقش فعلی به سفارش خرید دسترسی ندارد.', 403);
    }
    $statement = $pdo->prepare(
        'SELECT b.id FROM repair_branches b INNER JOIN tamiran_user_branches ub ON ub.branch_id=b.id AND ub.user_id=:user
         WHERE b.id=:branch AND b.shop_id=:shop AND b.is_active=1 LIMIT 1'
    );
    $statement->execute(['user'=>(int)$actor['id'], 'branch'=>(int)$actor['branch']['id'], 'shop'=>(int)$actor['shop']['id']]);
    if ($statement->fetchColumn() === false) throw new TamiranApiException('شعبه نشست معتبر نیست.', 401);
    return ['actor'=>$actor, 'role'=>$role, 'shop_id'=>(int)$actor['shop']['id'], 'branch_id'=>(int)$actor['branch']['id']];
}

function purchase_optional(mixed $value, int $maxLength): ?string
{
    $value = trim((string)$value);
    if ($value === '') return null;
    $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    if ($length > $maxLength) throw new TamiranApiException('متن واردشده بیش از حد طولانی است.');
    return $value;
}

function purchase_list(PDO $pdo, array $scope): array
{
    $sql = "SELECT p.*, requester.display_name AS requester_name, handler.display_name AS handler_name,
                   CASE WHEN i.physical_quantity>i.reserved_quantity THEN i.physical_quantity-i.reserved_quantity ELSE 0 END AS available_quantity
            FROM repair_purchase_orders p
            INNER JOIN repair_inventory_items i ON i.id=p.item_id AND i.shop_id=p.shop_id
            INNER JOIN tamiran_users requester ON requester.id=p.requested_by_user_id
            LEFT JOIN tamiran_users handler ON handler.id=p.handled_by_user_id
            WHERE p.shop_id=:shop AND p.branch_id=:branch";
    $params = ['shop'=>$scope['shop_id'], 'branch'=>$scope['branch_id']];
    if ($scope['role'] === 'technician') {
        $sql .= ' AND p.requested_by_user_id=:actor';
        $params['actor'] = (int)$scope['actor']['id'];
    }
    $sql .= ' ORDER BY p.updated_at DESC,p.id DESC LIMIT 250';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return array_map(static fn(array $row): array => [
        'id'=>(int)$row['id'], 'publicId'=>$row['public_id'], 'itemId'=>(int)$row['item_id'],
        'itemCode'=>$row['item_code_snapshot'], 'itemTitle'=>$row['item_title_snapshot'],
        'quantity'=>(int)$row['quantity'], 'availableQuantity'=>(int)$row['available_quantity'],
        'priority'=>$row['priority'], 'status'=>$row['status'], 'notes'=>$row['notes'] ?? '',
        'managerNotes'=>$row['manager_notes'] ?? '', 'requestedByName'=>$row['requester_name'],
        'handledByName'=>$row['handler_name'] ?? '', 'createdAt'=>$row['created_at'], 'updatedAt'=>$row['updated_at'],
    ], $statement->fetchAll());
}

function purchase_create(PDO $pdo, array $scope, array $input): array
{
    tamiran_require_csrf();
    $itemId = (int)($input['itemId'] ?? 0);
    $quantity = (int)($input['quantity'] ?? 0);
    if ($quantity < 1 || $quantity > 1000000) throw new TamiranApiException('تعداد سفارش باید بین ۱ تا ۱٬۰۰۰٬۰۰۰ باشد.');
    $priority = (string)($input['priority'] ?? 'normal');
    if (!in_array($priority, ['normal','urgent'], true)) throw new TamiranApiException('اولویت سفارش معتبر نیست.');
    $notes = purchase_optional($input['notes'] ?? '', 2000);
    $pdo->beginTransaction();
    try {
        $itemStatement = $pdo->prepare('SELECT id,item_code,title,physical_quantity,reserved_quantity FROM repair_inventory_items WHERE id=:id AND shop_id=:shop AND is_active=1 LIMIT 1 FOR UPDATE');
        $itemStatement->execute(['id'=>$itemId, 'shop'=>$scope['shop_id']]);
        $item = $itemStatement->fetch();
        if (!is_array($item)) throw new TamiranApiException('کالای فعال انبار پیدا نشد.', 404);
        if (((int)$item['physical_quantity'] - (int)$item['reserved_quantity']) > 0) {
            throw new TamiranApiException('این کالا موجودی قابل تخصیص دارد؛ سفارش خرید فقط برای کالای ناموجود مجاز است.', 409);
        }
        $duplicate = $pdo->prepare("SELECT id FROM repair_purchase_orders WHERE shop_id=:shop AND branch_id=:branch AND item_id=:item AND requested_by_user_id=:actor AND status IN ('requested','approved','ordered') LIMIT 1");
        $duplicate->execute(['shop'=>$scope['shop_id'], 'branch'=>$scope['branch_id'], 'item'=>$itemId, 'actor'=>(int)$scope['actor']['id']]);
        if ($duplicate->fetchColumn() !== false) throw new TamiranApiException('برای این کالا یک سفارش خرید باز از طرف شما وجود دارد.', 409);
        $publicId = tamiran_id();
        $statement = $pdo->prepare("INSERT INTO repair_purchase_orders(public_id,shop_id,branch_id,item_id,item_code_snapshot,item_title_snapshot,requested_by_user_id,quantity,priority,status,notes) VALUES(:public,:shop,:branch,:item,:code,:title,:actor,:quantity,:priority,'requested',:notes)");
        $statement->execute(['public'=>$publicId, 'shop'=>$scope['shop_id'], 'branch'=>$scope['branch_id'], 'item'=>$itemId,
            'code'=>$item['item_code'], 'title'=>$item['title'], 'actor'=>(int)$scope['actor']['id'], 'quantity'=>$quantity, 'priority'=>$priority, 'notes'=>$notes]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    tamiran_log('info', 'purchase_order_created', ['public_id'=>$publicId, 'item_id'=>$itemId, 'user_id'=>(int)$scope['actor']['id']]);
    return ['created'=>true, 'publicId'=>$publicId];
}

function purchase_update(PDO $pdo, array $scope, array $input): array
{
    tamiran_require_csrf();
    if (!in_array($scope['role'], ['repair_manager','warehouse_keeper'], true)) {
        throw new TamiranApiException('تغییر وضعیت سفارش فقط برای مدیر یا انباردار مجاز است.', 403);
    }
    $id = (int)($input['id'] ?? 0);
    $newStatus = (string)($input['status'] ?? '');
    if (!in_array($newStatus, TAMIRAN_PURCHASE_STATUSES, true)) throw new TamiranApiException('وضعیت سفارش معتبر نیست.');
    $managerNotes = purchase_optional($input['managerNotes'] ?? '', 2000);
    $transitions = [
        'requested'=>['approved','rejected','cancelled'], 'approved'=>['ordered','rejected','cancelled'],
        'ordered'=>['received','cancelled'], 'received'=>[], 'rejected'=>[], 'cancelled'=>[],
    ];
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT * FROM repair_purchase_orders WHERE id=:id AND shop_id=:shop AND branch_id=:branch LIMIT 1 FOR UPDATE');
        $statement->execute(['id'=>$id, 'shop'=>$scope['shop_id'], 'branch'=>$scope['branch_id']]);
        $order = $statement->fetch();
        if (!is_array($order)) throw new TamiranApiException('سفارش خرید پیدا نشد.', 404);
        if ($newStatus === $order['status'] || !in_array($newStatus, $transitions[$order['status']] ?? [], true)) {
            throw new TamiranApiException('این تغییر وضعیت برای سفارش مجاز نیست.', 409);
        }
        $pdo->prepare('UPDATE repair_purchase_orders SET status=:status,manager_notes=:notes,handled_by_user_id=:handler WHERE id=:id')
            ->execute(['status'=>$newStatus, 'notes'=>$managerNotes, 'handler'=>(int)$scope['actor']['id'], 'id'=>$id]);
        if ($newStatus === 'received') {
            $pdo->prepare('UPDATE repair_inventory_items SET physical_quantity=physical_quantity+:quantity WHERE id=:item AND shop_id=:shop')
                ->execute(['quantity'=>(int)$order['quantity'], 'item'=>(int)$order['item_id'], 'shop'=>$scope['shop_id']]);
            $pdo->prepare("INSERT INTO repair_inventory_movements(public_id,shop_id,branch_id,item_id,case_id,movement_type,quantity,reference_code,notes,actor_user_id) VALUES(:public,:shop,:branch,:item,NULL,'in',:quantity,:reference,:notes,:actor)")
                ->execute(['public'=>tamiran_id(), 'shop'=>$scope['shop_id'], 'branch'=>$scope['branch_id'], 'item'=>(int)$order['item_id'],
                    'quantity'=>(int)$order['quantity'], 'reference'=>'PO-'.$order['public_id'], 'notes'=>'ورود موجودی از سفارش خرید', 'actor'=>(int)$scope['actor']['id']]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    tamiran_log('info', 'purchase_order_status_changed', ['id'=>$id, 'status'=>$newStatus, 'user_id'=>(int)$scope['actor']['id']]);
    return ['updated'=>true];
}

tamiran_api(static function (): array {
    $pdo = tamiran_db();
    $scope = purchase_scope($pdo);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') return ['orders'=>purchase_list($pdo, $scope)];
    tamiran_require_writable_actor($scope['actor']);
    $input = tamiran_json_body();
    if ($method === 'POST') return purchase_create($pdo, $scope, $input);
    if ($method === 'PATCH') return purchase_update($pdo, $scope, $input);
    throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
});
