<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function price_catalog_rows(PDO $pdo): array
{
    $rows = $pdo->query(
        "SELECT c.*,v.version_code,v.unit_price,v.effective_from,v.effective_to
         FROM tamiran_price_catalog c
         LEFT JOIN tamiran_price_versions v ON v.id=(
           SELECT pv.id FROM tamiran_price_versions pv
           WHERE pv.catalog_id=c.id AND pv.is_active=1 AND pv.effective_from<=NOW()
             AND (pv.effective_to IS NULL OR pv.effective_to>NOW())
           ORDER BY pv.effective_from DESC,pv.id DESC LIMIT 1
         ) ORDER BY c.item_type,c.name"
    )->fetchAll();
    return array_map(static fn(array $row): array => [
        'id'=>(int)$row['id'],'productKey'=>$row['product_key'],'name'=>$row['name'],
        'itemType'=>$row['item_type'],'billingPeriod'=>$row['billing_period'],
        'taxRate'=>(float)$row['tax_rate'],'entitlementEffect'=>json_decode((string)$row['entitlement_effect_json'],true)?:[],
        'active'=>(bool)$row['is_active'],'priceVersion'=>$row['version_code'],'unitPrice'=>$row['unit_price']===null?null:(int)$row['unit_price'],
        'effectiveFrom'=>$row['effective_from'],'effectiveTo'=>$row['effective_to'],
    ], $rows);
}

tamiran_api(static function (): array {
    $actor=tamiran_require_central_admin();
    $pdo=tamiran_db();
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET') return ['items'=>price_catalog_rows($pdo)];
    if($method!=='POST') throw new TamiranApiException('روش درخواست مجاز نیست.',405);
    tamiran_require_csrf();
    $input=tamiran_json_body();
    $catalogId=(int)($input['catalogId']??0);
    $version=trim((string)($input['versionCode']??''));
    $price=(int)($input['unitPrice']??-1);
    $effective=(string)($input['effectiveFrom']??'');
    if($catalogId<1||$version===''||strlen($version)>40||$price<0) throw new TamiranApiException('نسخه قیمت معتبر نیست.');
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$effective);
    if(!$date||$date->format('Y-m-d')!==$effective) throw new TamiranApiException('تاریخ شروع قیمت معتبر نیست.');
    $pdo->beginTransaction();
    try {
        $catalog=$pdo->prepare('SELECT id FROM tamiran_price_catalog WHERE id=:catalog AND is_active=1 FOR UPDATE');
        $catalog->execute(['catalog'=>$catalogId]);
        if($catalog->fetchColumn()===false) throw new TamiranApiException('آیتم فعال کاتالوگ پیدا نشد.',404);
        $pdo->prepare('UPDATE tamiran_price_versions SET is_active=0,effective_to=COALESCE(effective_to,NOW()) WHERE catalog_id=:catalog AND is_active=1')->execute(['catalog'=>$catalogId]);
        $pdo->prepare(
            'INSERT INTO tamiran_price_versions(catalog_id,version_code,unit_price,effective_from,effective_to,is_active)
             VALUES(:catalog,:version,:price,:effective,NULL,1)
             ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price),effective_from=VALUES(effective_from),effective_to=NULL,is_active=1'
        )->execute(['catalog'=>$catalogId,'version'=>$version,'price'=>$price,'effective'=>$effective.' 00:00:00']);
        $pdo->commit();
    } catch (Throwable $error) {
        if($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    tamiran_log('info','PRICE_VERSION_CREATED',['catalog_id'=>$catalogId,'version'=>$version,'actor'=>$actor['id']]);
    return ['updated'=>true,'items'=>price_catalog_rows($pdo)];
});
