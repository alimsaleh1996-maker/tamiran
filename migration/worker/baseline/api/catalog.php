<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function catalog_rows(PDO $pdo, int $shopId): array
{
    $statement = $pdo->prepare(
        'SELECT m.id,m.title AS model,b.id AS brand_id,b.title AS brand,t.id AS type_id,t.title AS type,m.usage_count,m.is_active
         FROM repair_device_models m INNER JOIN repair_device_brands b ON b.id=m.brand_id
         INNER JOIN repair_device_types t ON t.id=b.device_type_id
         WHERE t.shop_id=:shop ORDER BY t.title,b.title,m.title'
    );
    $statement->execute(['shop'=>$shopId]);
    return $statement->fetchAll();
}

function catalog_value(array $input, string $key, int $maxLength): string
{
    $value = trim((string) ($input[$key] ?? ''));
    $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    if ($value === '' || $length > $maxLength) throw new TamiranApiException('نوع، برند و مدل را کامل و کوتاه وارد کنید.');
    return $value;
}

tamiran_api(static function (): array {
    $actor = tamiran_require_actor();
    if (($actor['role'] ?? '') === 'central_admin' || !is_array($actor['shop'] ?? null)) {
        throw new TamiranApiException('کاتالوگ هر تعمیرگاه از فضای خودش مدیریت می‌شود.', 403);
    }
    $shopId = (int) $actor['shop']['id'];
    $pdo = tamiran_db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') return ['items'=>catalog_rows($pdo, $shopId)];

    if (($actor['role'] ?? '') !== 'repair_manager') throw new TamiranApiException('تغییر نوع، برند و مدل فقط برای مدیر تعمیرگاه مجاز است.', 403);
    tamiran_require_csrf();
    tamiran_require_writable_actor($actor);
    $input = tamiran_json_body();

    if ($method === 'POST') {
        $type = catalog_value($input, 'type', 120);
        $brand = catalog_value($input, 'brand', 120);
        $model = catalog_value($input, 'model', 160);
        $pdo->beginTransaction();
        try {
            $typeStatement = $pdo->prepare('INSERT INTO repair_device_types(shop_id,title) VALUES(:shop,:title) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),is_active=1');
            $typeStatement->execute(['shop'=>$shopId, 'title'=>$type]);
            $typeId = (int) $pdo->lastInsertId();
            $brandStatement = $pdo->prepare('INSERT INTO repair_device_brands(device_type_id,title) VALUES(:type,:title) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),is_active=1');
            $brandStatement->execute(['type'=>$typeId, 'title'=>$brand]);
            $brandId = (int) $pdo->lastInsertId();
            $modelStatement = $pdo->prepare('INSERT INTO repair_device_models(brand_id,title) VALUES(:brand,:title)');
            $modelStatement->execute(['brand'=>$brandId, 'title'=>$model]);
            $pdo->commit();
        } catch (PDOException $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($error->getCode() === '23000') throw new TamiranApiException('این ترکیب نوع، برند و مدل قبلاً ثبت شده است.', 409);
            throw $error;
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        tamiran_log('info', 'catalog_model_created', ['shop_id'=>$shopId, 'actor_id'=>$actor['id']]);
        return ['created'=>true, 'items'=>catalog_rows($pdo, $shopId)];
    }

    if ($method === 'PATCH') {
        $id = (int) ($input['id'] ?? 0);
        if ($id < 1) throw new TamiranApiException('مدل معتبر نیست.');
        $statement = $pdo->prepare(
            'SELECT m.usage_count FROM repair_device_models m INNER JOIN repair_device_brands b ON b.id=m.brand_id
             INNER JOIN repair_device_types t ON t.id=b.device_type_id WHERE m.id=:id AND t.shop_id=:shop LIMIT 1'
        );
        $statement->execute(['id'=>$id, 'shop'=>$shopId]);
        $model = $statement->fetch();
        if (!is_array($model)) throw new TamiranApiException('مدل پیدا نشد.', 404);
        if (!empty($input['delete'])) {
            if ((int) $model['usage_count'] > 0) throw new TamiranApiException('مدل دارای گردش تعمیراتی قابل حذف نیست.', 409);
            $pdo->prepare('DELETE FROM repair_device_models WHERE id=:id')->execute(['id'=>$id]);
        } else {
            $pdo->prepare('UPDATE repair_device_models SET is_active=:active WHERE id=:id')->execute(['id'=>$id, 'active'=>!empty($input['active']) ? 1 : 0]);
        }
        tamiran_log('info', 'catalog_model_updated', ['shop_id'=>$shopId, 'model_id'=>$id, 'actor_id'=>$actor['id']]);
        return ['updated'=>true, 'items'=>catalog_rows($pdo, $shopId)];
    }

    throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
});
