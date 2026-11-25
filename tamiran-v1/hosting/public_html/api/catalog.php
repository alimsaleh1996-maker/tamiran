<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once tamiran_private_root().'/catalog-similarity.php';

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

    if ($method === 'POST' && ($input['action'] ?? '') === 'import') {
        $rows=$input['rows']??null;
        if(!is_array($rows)||!array_is_list($rows)||count($rows)<1||count($rows)>500)throw new TamiranApiException('فایل باید بین ۱ تا ۵۰۰ ردیف داشته باشد.',422);
        $validated=[];
        foreach($rows as $index=>$row){
            if(!is_array($row))throw new TamiranApiException('ردیف '.($index+2).' معتبر نیست.',422);
            try{$validated[]=['type'=>catalog_value($row,'type',120),'brand'=>catalog_value($row,'brand',120),'model'=>catalog_value($row,'model',160),'sourceRow'=>max(2,min(100000,(int)($row['sourceRow']??($index+2))))];}
            catch(TamiranApiException $error){throw new TamiranApiException('ردیف '.($index+2).': '.$error->getMessage(),422);}
        }
        $pdo->beginTransaction();
        try{
            $lock=$pdo->prepare('SELECT id FROM repair_shops WHERE id=:shop FOR UPDATE');$lock->execute(['shop'=>$shopId]);
            $existing=catalog_rows($pdo,$shopId);$insertable=[];$matches=[];
            foreach($validated as $row){
                $match=catalog_existing_match($row,$existing);
                if($match!==null){
                    $name=$match['item']['type'].' / '.$match['item']['brand'].' / '.$match['item']['model'];
                    if($match['kind']==='similar')throw new TamiranApiException('ردیف '.$row['sourceRow'].': نام مشابه «'.$name.'» موجود است؛ فایل را اصلاح کنید. هیچ ردیفی وارد نشد.',409);
                    $matches[]=['sourceRow'=>$row['sourceRow'],'existing'=>$match['item']];continue;
                }
                $row=catalog_existing_spelling($row,$existing);$insertable[]=$row;$existing[]=$row;
            }
            $type=$pdo->prepare('INSERT INTO repair_device_types(shop_id,title) VALUES(:shop,:title) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');
            $brand=$pdo->prepare('INSERT INTO repair_device_brands(device_type_id,title) VALUES(:type,:title) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');
            $model=$pdo->prepare('INSERT INTO repair_device_models(brand_id,title) VALUES(:brand,:title) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');
            $created=0;
            foreach($insertable as $row){
                $type->execute(['shop'=>$shopId,'title'=>$row['type']]);$typeId=(int)$pdo->lastInsertId();
                $brand->execute(['type'=>$typeId,'title'=>$row['brand']]);$brandId=(int)$pdo->lastInsertId();
                $model->execute(['brand'=>$brandId,'title'=>$row['model']]);if($model->rowCount()===1)$created++;
            }
            tamiran_audit($pdo,$shopId,(int)$actor['branch']['id'],(int)$actor['id'],'catalog.import','repair_shop',(string)$shopId,null,['rows'=>count($validated),'created'=>$created,'duplicates'=>count($validated)-$created]);
            $pdo->commit();
        }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
        return ['created'=>$created,'duplicates'=>count($validated)-$created,'matches'=>$matches,'items'=>catalog_rows($pdo,$shopId)];
    }

    if ($method === 'POST') {
        $type = catalog_value($input, 'type', 120);
        $brand = catalog_value($input, 'brand', 120);
        $model = catalog_value($input, 'model', 160);
        $pdo->beginTransaction();
        try {
            $lock=$pdo->prepare('SELECT id FROM repair_shops WHERE id=:shop FOR UPDATE');$lock->execute(['shop'=>$shopId]);
            $existing=catalog_rows($pdo,$shopId);$row=['type'=>$type,'brand'=>$brand,'model'=>$model];$match=catalog_existing_match($row,$existing);
            if($match!==null)throw new TamiranApiException('کالای یکسان یا مشابه «'.$match['item']['type'].' / '.$match['item']['brand'].' / '.$match['item']['model'].'» قبلاً تعریف شده است.',409);
            $row=catalog_existing_spelling($row,$existing);$type=$row['type'];$brand=$row['brand'];$model=$row['model'];
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
