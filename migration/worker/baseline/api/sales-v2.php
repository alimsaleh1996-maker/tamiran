<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require dirname(__DIR__, 2) . '/private/product-service.php';

function sv2_text(mixed $value, int $max): string
{
    $text=trim((string)$value);
    if((function_exists('mb_strlen')?mb_strlen($text):strlen($text))>$max) throw new TamiranApiException('متن واردشده بیش از حد طولانی است.');
    return $text;
}

function sv2_date(mixed $value): string
{
    $date=(string)$value;
    $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
    if(!$parsed||$parsed->format('Y-m-d')!==$date) throw new TamiranApiException('تاریخ معتبر نیست.');
    return $date;
}

function sv2_number(PDO $pdo): string
{
    $statement=$pdo->prepare('SELECT COUNT(*) FROM tamiran_sales_invoices WHERE invoice_number=:number');
    for($i=0;$i<30;$i++){
        $number='SI-'.date('Y').'-'.random_int(100000,999999);
        $statement->execute(['number'=>$number]);
        if((int)$statement->fetchColumn()===0) return $number;
    }
    throw new TamiranApiException('ساخت شماره یکتای فاکتور انجام نشد.',409);
}

function sv2_catalog(PDO $pdo): array
{
    $rows=$pdo->query("SELECT c.*,v.version_code,v.unit_price FROM tamiran_price_catalog c LEFT JOIN tamiran_price_versions v ON v.id=(SELECT pv.id FROM tamiran_price_versions pv WHERE pv.catalog_id=c.id AND pv.is_active=1 AND pv.effective_from<=NOW() AND (pv.effective_to IS NULL OR pv.effective_to>NOW()) ORDER BY pv.effective_from DESC,pv.id DESC LIMIT 1) WHERE c.is_active=1 ORDER BY c.item_type,c.name")->fetchAll();
    return array_map(static fn(array $row):array=>[
        'productKey'=>$row['product_key'],'name'=>$row['name'],'itemType'=>$row['item_type'],
        'billingPeriod'=>$row['billing_period'],'taxRate'=>(float)$row['tax_rate'],
        'entitlementEffect'=>json_decode((string)$row['entitlement_effect_json'],true)?:[],
        'priceVersion'=>$row['version_code'],'unitPrice'=>$row['unit_price']===null?null:(int)$row['unit_price'],
    ],$rows);
}

function sv2_catalog_map(PDO $pdo): array
{
    $map=[];
    foreach(sv2_catalog($pdo) as $item) $map[$item['productKey'].'|'.$item['billingPeriod']]=$item;
    return $map;
}

function sv2_entitlements(array $items, array $shop): array
{
    $result=[
        'productProfile'=>(string)$shop['product_profile'],'users'=>(int)$shop['max_users'],'branches'=>(int)$shop['max_branches'],
        'inventoryMode'=>(string)$shop['inventory_mode'],'qcMode'=>(string)$shop['qc_mode'],
        'modules'=>json_decode((string)$shop['modules_json'],true)?:['repair'],
    ];
    foreach($items as $item){
        $effect=$item['entitlementPayload'];
        if(isset($effect['product_profile'])) $result['productProfile']=(string)$effect['product_profile'];
        if(isset($effect['users_included'])) $result['users']=(int)$effect['users_included'];
        if(isset($effect['branches_included'])) $result['branches']=(int)$effect['branches_included'];
        if(isset($effect['users_limit_delta'])) $result['users']+=(int)$effect['users_limit_delta']*(int)$item['quantity'];
        if(isset($effect['branches_limit_delta'])) $result['branches']+=(int)$effect['branches_limit_delta']*(int)$item['quantity'];
        if(isset($effect['inventory_mode']))$result['inventoryMode']=(string)$effect['inventory_mode'];
        if(isset($effect['qc_mode']))$result['qcMode']=(string)$effect['qc_mode'];
        if(isset($effect['module'])) $result['modules'][]=(string)$effect['module'];
    }
    $result['modules']=array_values(array_unique(array_merge(['repair'],$result['modules'])));
    return $result;
}

function sv2_prepare_items(PDO $pdo, array $rawItems, string $period, string $overrideReason): array
{
    if(count($rawItems)<1||count($rawItems)>30) throw new TamiranApiException('حداقل یک قلم فاکتور لازم است.');
    $catalog=sv2_catalog_map($pdo);
    $prepared=[];
    foreach($rawItems as $raw){
        if(!is_array($raw)) throw new TamiranApiException('ساختار قلم فاکتور معتبر نیست.');
        $key=trim((string)($raw['productKey']??''));
        $lookup=$key.'|'.$period;
        $entry=$catalog[$lookup]??$catalog[$key.'|annual']??null;
        if(!is_array($entry)) throw new TamiranApiException("قلم {$key} در کاتالوگ قیمت فعال نیست.",409);
        $quantity=max(1,min(1000,(int)($raw['quantity']??1)));
        $catalogPrice=$entry['unitPrice'];
        $override=array_key_exists('unitPrice',$raw)&&$raw['unitPrice']!==null&&$catalogPrice!==null&&(int)$raw['unitPrice']!==(int)$catalogPrice;
        if($catalogPrice===null&&!array_key_exists('unitPrice',$raw)) throw new TamiranApiException("برای {$entry['name']} هنوز نسخه قیمت تعریف نشده است.",409);
        if(($override||$catalogPrice===null)&&$overrideReason==='') throw new TamiranApiException('برای تغییر قیمت کاتالوگ، علت Override الزامی است.');
        $unitPrice=$override||$catalogPrice===null?max(0,(int)$raw['unitPrice']):(int)$catalogPrice;
        $discount=max(0,(int)($raw['discountAmount']??0));
        $base=$quantity*$unitPrice;
        if($discount>$base) throw new TamiranApiException('تخفیف ردیف بیشتر از مبلغ آن است.');
        $taxRate=(float)$entry['taxRate'];
        $tax=(int)round(($base-$discount)*$taxRate/100);
        $prepared[]=[
            'productKey'=>$key,'itemType'=>$entry['itemType'],'priceVersion'=>$entry['priceVersion']??'override',
            'descriptionSnapshot'=>$entry['name'],'quantity'=>$quantity,'unitPrice'=>$unitPrice,
            'discountAmount'=>$discount,'taxRate'=>$taxRate,'taxAmount'=>$tax,'lineTotal'=>$base-$discount+$tax,
            'entitlementPayload'=>$entry['entitlementEffect'],'priceOverride'=>$override||$catalogPrice===null,'overrideReason'=>($override||$catalogPrice===null)?$overrideReason:null,
        ];
    }
    return $prepared;
}

function sv2_sync_paid(PDO $pdo, int $invoiceId): array
{
    $sum=$pdo->prepare('SELECT COALESCE(SUM(amount),0) FROM tamiran_sales_payments WHERE invoice_id=:invoice');
    $sum->execute(['invoice'=>$invoiceId]);
    $paid=(int)$sum->fetchColumn();
    $invoice=$pdo->prepare('SELECT total_amount,status FROM tamiran_sales_invoices WHERE id=:id FOR UPDATE');
    $invoice->execute(['id'=>$invoiceId]);
    $row=$invoice->fetch();
    if(!is_array($row)) throw new TamiranApiException('فاکتور پیدا نشد.',404);
    if($paid>(int)$row['total_amount']) throw new TamiranApiException('جمع پرداخت‌ها از مبلغ فاکتور بیشتر است.',409);
    $status=$row['status']==='cancelled'?'cancelled':($paid>=(int)$row['total_amount']?'paid':($paid>0?'partial':($row['status']==='draft'?'draft':'issued')));
    $pdo->prepare('UPDATE tamiran_sales_invoices SET paid_amount=:paid,status=:status WHERE id=:id')->execute(['paid'=>$paid,'status'=>$status,'id'=>$invoiceId]);
    return ['paidAmount'=>$paid,'status'=>$status,'balance'=>(int)$row['total_amount']-$paid];
}

function sv2_provision(PDO $pdo, array $invoice, int $actorId): array
{
    $pdo->prepare("UPDATE tamiran_sales_invoices SET provisioning_status='processing',provisioning_error=NULL WHERE id=:id")->execute(['id'=>$invoice['id']]);
    try{
        $pdo->beginTransaction();
        $shopStatement=$pdo->prepare('SELECT * FROM repair_shops WHERE id=:id FOR UPDATE');
        $shopStatement->execute(['id'=>$invoice['shop_id']]);
        $shop=$shopStatement->fetch();
        if(!is_array($shop)) throw new TamiranApiException('تعمیرگاه فاکتور پیدا نشد.',404);
        $snapshot=json_decode((string)$invoice['product_snapshot_json'],true)?:[];
        $config=tamiran_product_config((string)$snapshot['productProfile'],$snapshot['modules']??['repair'],[
            'maxUsers'=>$snapshot['maxUsers']??$shop['max_users'],'maxBranches'=>$snapshot['maxBranches']??$shop['max_branches'],'inventoryMode'=>$snapshot['inventoryMode']??$shop['inventory_mode'],'qcMode'=>$snapshot['qcMode']??$shop['qc_mode'],
        ]);
        $reason='Provisioning فاکتور '.$invoice['invoice_number'];
        if((string)$shop['product_profile']!==(string)$config['productProfile']){
            tamiran_product_change_service($pdo,$shop,$config,$actorId,$reason,'sales-invoice-product-change:'.$invoice['id'],['source'=>'sales_invoice'],(int)$invoice['id']);
        }else{
        tamiran_product_apply($pdo,$shop,$config,$actorId,$reason,(int)$invoice['id']);
        }
        $pdo->prepare("UPDATE tamiran_sales_invoices SET provisioning_status='active',activation_status='activated',activated_at=COALESCE(activated_at,NOW()) WHERE id=:id")->execute(['id'=>$invoice['id']]);
        tamiran_audit($pdo,(int)$invoice['shop_id'],null,$actorId,'ENTITLEMENT_PROVISION_COMPLETED','tamiran_sales_invoice',(string)$invoice['public_id'],null,['invoiceNumber'=>$invoice['invoice_number']]);
        $pdo->commit();
        tamiran_log('info','ENTITLEMENT_PROVISION_COMPLETED',['invoice_id'=>$invoice['id'],'actor'=>$actorId]);
        return ['status'=>'active'];
    }catch(Throwable $error){
        if($pdo->inTransaction()) $pdo->rollBack();
        $pdo->prepare("UPDATE tamiran_sales_invoices SET provisioning_status='failed',provisioning_error=:error WHERE id=:id")->execute(['error'=>substr($error->getMessage(),0,1000),'id'=>$invoice['id']]);
        tamiran_log('error','ENTITLEMENT_PROVISION_FAILED',['invoice_id'=>$invoice['id'],'actor'=>$actorId,'error'=>$error->getMessage()]);
        return ['status'=>'failed','error'=>$error->getMessage()];
    }
}

function sv2_invoice_rows(PDO $pdo): array
{
    $rows=$pdo->query('SELECT i.*,s.name AS shop_name,s.public_shop_code AS shop_code,u.display_name AS created_by FROM tamiran_sales_invoices i JOIN repair_shops s ON s.id=i.shop_id JOIN tamiran_users u ON u.id=i.created_by_user_id ORDER BY i.id DESC LIMIT 500')->fetchAll();
    $itemStatement=$pdo->prepare('SELECT * FROM tamiran_sales_invoice_items WHERE invoice_id=:invoice ORDER BY id');
    $paymentStatement=$pdo->prepare('SELECT p.*,u.display_name AS actor_name FROM tamiran_sales_payments p JOIN tamiran_users u ON u.id=p.created_by_user_id WHERE p.invoice_id=:invoice ORDER BY p.paid_at,p.id');
    $result=[];
    foreach($rows as $row){
        $itemStatement->execute(['invoice'=>$row['id']]);
        $lineItems=array_map(static fn(array $item):array=>[
            'id'=>(int)$item['id'],'productKey'=>$item['product_key'],'type'=>$item['item_type'],
            'code'=>$item['product_key'],'title'=>$item['description_snapshot'],'descriptionSnapshot'=>$item['description_snapshot'],
            'priceVersion'=>$item['price_version'],'quantity'=>(float)$item['quantity'],'unitPrice'=>(int)$item['unit_price'],
            'discountAmount'=>(int)$item['discount_amount'],'taxRate'=>(float)$item['tax_rate'],'taxAmount'=>(int)$item['tax_amount'],
            'lineTotal'=>(int)$item['line_total'],'totalPrice'=>(int)$item['line_total'],'priceOverride'=>(bool)$item['price_override'],
            'entitlementPayload'=>json_decode((string)$item['entitlement_payload'],true)?:[],
        ],$itemStatement->fetchAll());
        $paymentStatement->execute(['invoice'=>$row['id']]);
        $payments=array_map(static fn(array $payment):array=>[
            'id'=>(int)$payment['id'],'publicId'=>$payment['public_id'],'amount'=>(int)$payment['amount'],
            'method'=>$payment['payment_method'],'reference'=>$payment['reference'],'paidAt'=>$payment['paid_at'],
            'note'=>$payment['note'],'actor'=>$payment['actor_name'],
        ],$paymentStatement->fetchAll());
        $result[]=[
            'id'=>(int)$row['id'],'publicId'=>$row['public_id'],'invoiceNumber'=>$row['invoice_number'],
            'shopId'=>(int)$row['shop_id'],'shopName'=>$row['shop_name'],'shopCode'=>$row['shop_code'],
            'operationType'=>$row['operation_type'],'productProfile'=>$row['product_profile'],
            'productSnapshot'=>json_decode((string)$row['product_snapshot_json'],true)?:[],
            'activationStatus'=>$row['activation_status'],'provisioningStatus'=>$row['provisioning_status'],
            'provisioningError'=>$row['provisioning_error'],'plan'=>$row['plan_code'],'repairType'=>$row['repair_type_code'],
            'modules'=>json_decode((string)$row['modules_json'],true)?:[],'items'=>$lineItems,'payments'=>$payments,
            'billingPeriod'=>$row['billing_period'],'issueDate'=>$row['issue_date'],'dueDate'=>$row['due_date'],
            'periodStart'=>$row['period_start'],'periodEnd'=>$row['period_end'],'description'=>$row['description'],
            'subtotalAmount'=>(int)$row['subtotal_amount'],'discountAmount'=>(int)$row['discount_amount'],
            'taxAmount'=>(int)$row['tax_amount'],'totalAmount'=>(int)$row['total_amount'],'paidAmount'=>(int)$row['paid_amount'],
            'status'=>$row['status'],'notes'=>$row['notes']??'','internalNotes'=>$row['internal_notes']??'',
            'createdBy'=>$row['created_by'],'createdAt'=>$row['created_at'],'updatedAt'=>$row['updated_at'],
        ];
    }
    return $result;
}

tamiran_api(static function():array{
    $actor=tamiran_require_central_admin();
    $pdo=tamiran_db();
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET') return [
        'summary'=>[
            'invoices'=>(int)$pdo->query("SELECT COUNT(*) FROM tamiran_sales_invoices WHERE status<>'cancelled'")->fetchColumn(),
            'paid'=>(int)$pdo->query("SELECT COALESCE(SUM(paid_amount),0) FROM tamiran_sales_invoices WHERE status<>'cancelled'")->fetchColumn(),
            'receivable'=>(int)$pdo->query("SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM tamiran_sales_invoices WHERE status IN('issued','partial')")->fetchColumn(),
            'overdue'=>(int)$pdo->query("SELECT COUNT(*) FROM tamiran_sales_invoices WHERE due_date<CURRENT_DATE() AND status IN('issued','partial')")->fetchColumn(),
        ],
        'catalog'=>sv2_catalog($pdo),'invoices'=>sv2_invoice_rows($pdo),
    ];
    if($method!=='POST') throw new TamiranApiException('فاکتور صادرشده قابل ویرایش مستقیم نیست.',405);
    tamiran_require_csrf();
    $input=tamiran_json_body();
    $action=(string)($input['action']??'create_invoice');

    if($action==='record_payment'){
        $invoiceId=(int)($input['invoiceId']??0);$amount=(int)($input['amount']??0);$key=trim((string)($input['idempotencyKey']??''));
        $methodCode=(string)($input['method']??'other');
        if($invoiceId<1||$amount<1||$key===''||!in_array($methodCode,['cash','bank_transfer','pos','online_gateway','other'],true)) throw new TamiranApiException('اطلاعات پرداخت معتبر نیست.');
        $existing=$pdo->prepare('SELECT id FROM tamiran_sales_payments WHERE invoice_id=:invoice AND idempotency_key=:key');$existing->execute(['invoice'=>$invoiceId,'key'=>$key]);
        if($existing->fetchColumn()!==false) return ['replayed'=>true];
        $paidAt=(string)($input['paidAt']??date('Y-m-d H:i:s'));
        $pdo->beginTransaction();
        try{
            $pdo->prepare('INSERT INTO tamiran_sales_payments(public_id,invoice_id,amount,payment_method,reference,paid_at,note,idempotency_key,created_by_user_id) VALUES(:public,:invoice,:amount,:method,:reference,:paid_at,:note,:key,:actor)')->execute([
                'public'=>tamiran_id(),'invoice'=>$invoiceId,'amount'=>$amount,'method'=>$methodCode,'reference'=>sv2_text($input['reference']??'',190)?:null,'paid_at'=>$paidAt,'note'=>sv2_text($input['note']??'',1000)?:null,'key'=>$key,'actor'=>$actor['id'],
            ]);
            $result=sv2_sync_paid($pdo,$invoiceId);
            $invoiceShop=$pdo->prepare('SELECT shop_id,public_id FROM tamiran_sales_invoices WHERE id=:id');$invoiceShop->execute(['id'=>$invoiceId]);$invoiceAudit=$invoiceShop->fetch();if(is_array($invoiceAudit))tamiran_audit($pdo,(int)$invoiceAudit['shop_id'],null,(int)$actor['id'],'SALES_PAYMENT_RECORDED','tamiran_sales_invoice',(string)$invoiceAudit['public_id'],null,['amount'=>$amount,'method'=>$methodCode,'reference'=>sv2_text($input['reference']??'',190)]);
            $pdo->commit();
        }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
        tamiran_log('info','SALES_PAYMENT_RECORDED',['invoice_id'=>$invoiceId,'amount'=>$amount,'actor'=>$actor['id']]);
        return ['recorded'=>true]+$result;
    }

    if($action==='retry_provision'){
        $invoiceId=(int)($input['invoiceId']??0);$statement=$pdo->prepare('SELECT * FROM tamiran_sales_invoices WHERE id=:id');$statement->execute(['id'=>$invoiceId]);$invoice=$statement->fetch();
        if(!is_array($invoice)) throw new TamiranApiException('فاکتور پیدا نشد.',404);
        if(in_array($invoice['status'],['draft','cancelled'],true)) throw new TamiranApiException('این فاکتور آماده فعال‌سازی نیست.',409);
        return ['provisioning'=>sv2_provision($pdo,$invoice,(int)$actor['id'])];
    }

    if($action!=='create_invoice') throw new TamiranApiException('عملیات فروش معتبر نیست.');
    $shopId=(int)($input['shopId']??0);$idempotency=trim((string)($input['idempotencyKey']??''));
    if($shopId<1||$idempotency===''||strlen($idempotency)>160) throw new TamiranApiException('تعمیرگاه و کلید یکتای فاکتور الزامی است.');
    $existing=$pdo->prepare('SELECT invoice_number,provisioning_status FROM tamiran_sales_invoices WHERE shop_id=:shop AND idempotency_key=:key');$existing->execute(['shop'=>$shopId,'key'=>$idempotency]);$replay=$existing->fetch();
    if(is_array($replay)) return ['created'=>true,'replayed'=>true,'invoiceNumber'=>$replay['invoice_number'],'provisioningStatus'=>$replay['provisioning_status']];
    $shopStatement=$pdo->prepare('SELECT * FROM repair_shops WHERE id=:id');$shopStatement->execute(['id'=>$shopId]);$shop=$shopStatement->fetch();
    if(!is_array($shop)) throw new TamiranApiException('خریدار معتبر نیست.',404);
    $period=(string)($input['billingPeriod']??'annual');
    if(!in_array($period,['monthly','quarterly','semiannual','annual','custom'],true)) throw new TamiranApiException('دوره فاکتور معتبر نیست.');
    $overrideReason=sv2_text($input['priceOverrideReason']??'',1000);
    $items=sv2_prepare_items($pdo,is_array($input['items']??null)?$input['items']:[],$period,$overrideReason);
    $entitlements=sv2_entitlements($items,$shop);
    $subtotal=array_sum(array_map(static fn(array $i):int=>$i['quantity']*$i['unitPrice'],$items));
    $lineDiscount=array_sum(array_column($items,'discountAmount'));$lineTax=array_sum(array_column($items,'taxAmount'));
    $invoiceDiscount=max(0,(int)($input['discountAmount']??0));
    $discountReason=sv2_text($input['discountReason']??'',1000);
    if($invoiceDiscount>0&&$discountReason==='')throw new TamiranApiException('دلیل تخفیف الزامی است.');
    $discountBase=max(1,$subtotal-$lineDiscount);
    $sensitiveDiscount=$invoiceDiscount/$discountBase>0.20;
    if($sensitiveDiscount&&empty($input['discountManagerApproved']))throw new TamiranApiException('تخفیف بیش از ۲۰٪ نیازمند تأیید صریح مدیر مرکزی است.',403);
    if($invoiceDiscount>($subtotal-$lineDiscount)) throw new TamiranApiException('تخفیف فاکتور بیش از مبلغ اقلام است.');
    $total=$subtotal-$lineDiscount-$invoiceDiscount+$lineTax;
    $status=(string)($input['status']??'issued');if(!in_array($status,['draft','issued'],true))$status='issued';
    $operation=(string)($input['operationType']??'new_sale');
    if(!in_array($operation,['new_sale','renewal','upgrade','add_module','increase_capacity','renewal_product_change','contract_correction'],true)) throw new TamiranApiException('نوع عملیات فروش معتبر نیست.');
    $issue=sv2_date($input['issueDate']??'');$due=sv2_date($input['dueDate']??'');$start=sv2_date($input['periodStart']??'');$end=sv2_date($input['periodEnd']??'');
    if($due<$issue||$end<$start) throw new TamiranApiException('ترتیب تاریخ‌ها معتبر نیست.');
    $invoiceNumber=sv2_number($pdo);$publicId=tamiran_id();
    $productConfig=tamiran_product_config($entitlements['productProfile'],$entitlements['modules'],['maxUsers'=>$entitlements['users'],'maxBranches'=>$entitlements['branches'],'inventoryMode'=>$entitlements['inventoryMode'],'qcMode'=>$input['qcMode']??$entitlements['qcMode']]);
    $snapshot=tamiran_product_snapshot($productConfig);
    $pdo->beginTransaction();
    try{
        $pdo->prepare("INSERT INTO tamiran_sales_invoices(public_id,invoice_number,shop_id,operation_type,idempotency_key,product_profile,product_snapshot_json,activation_status,provisioning_status,plan_code,repair_type_code,modules_json,items_json,billing_period,issue_date,due_date,period_start,period_end,description,subtotal_amount,discount_amount,tax_amount,total_amount,paid_amount,status,discount_reason,notes,internal_notes,created_by_user_id) VALUES(:public,:number,:shop,:operation,:key,:product,:snapshot,'pending',:provisioning,:plan,:repair_type,:modules,:items,:period,:issue,:due,:start,:end,:description,:subtotal,:discount,:tax,:total,0,:status,:discount_reason,:notes,:internal_notes,:actor)")->execute([
            'public'=>$publicId,'number'=>$invoiceNumber,'shop'=>$shopId,'operation'=>$operation,'key'=>$idempotency,'product'=>$productConfig['productProfile'],'snapshot'=>json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'provisioning'=>$status==='draft'?'not_applied':'scheduled','plan'=>$productConfig['plan'],'repair_type'=>$shop['repair_type'],'modules'=>json_encode($productConfig['modules'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'items'=>json_encode($items,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'period'=>$period,'issue'=>$issue,'due'=>$due,'start'=>$start,'end'=>$end,'description'=>sv2_text($input['description']??implode('، ',array_column($items,'descriptionSnapshot')),240),'subtotal'=>$subtotal,'discount'=>$lineDiscount+$invoiceDiscount,'tax'=>$lineTax,'total'=>$total,'status'=>$status,'discount_reason'=>$discountReason?:null,'notes'=>sv2_text($input['description']??'',8000)?:null,'internal_notes'=>sv2_text($input['internalNotes']??'',8000)?:null,'actor'=>$actor['id'],
        ]);
        $invoiceId=(int)$pdo->lastInsertId();
        $itemInsert=$pdo->prepare('INSERT INTO tamiran_sales_invoice_items(invoice_id,product_key,item_type,price_version,description_snapshot,quantity,unit_price,discount_amount,tax_rate,tax_amount,line_total,entitlement_payload,price_override,override_reason) VALUES(:invoice,:key,:type,:version,:description,:quantity,:unit_price,:discount,:tax_rate,:tax,:total,:entitlement,:override,:reason)');
        foreach($items as $item)$itemInsert->execute(['invoice'=>$invoiceId,'key'=>$item['productKey'],'type'=>$item['itemType'],'version'=>$item['priceVersion']??'override','description'=>$item['descriptionSnapshot'],'quantity'=>$item['quantity'],'unit_price'=>$item['unitPrice'],'discount'=>$item['discountAmount'],'tax_rate'=>$item['taxRate'],'tax'=>$item['taxAmount'],'total'=>$item['lineTotal'],'entitlement'=>json_encode($item['entitlementPayload'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'override'=>$item['priceOverride']?1:0,'reason'=>$item['overrideReason']]);
        tamiran_audit($pdo,$shopId,null,(int)$actor['id'],$status==='draft'?'SALES_INVOICE_DRAFTED':'SALES_INVOICE_ISSUED','tamiran_sales_invoice',$publicId,null,['invoiceNumber'=>$invoiceNumber,'operationType'=>$operation,'total'=>$total,'status'=>$status]);
        if($invoiceDiscount>0)tamiran_audit($pdo,$shopId,null,(int)$actor['id'],'DISCOUNT_APPLIED','tamiran_sales_invoice',$publicId,null,['amount'=>$invoiceDiscount,'reason'=>$discountReason,'managerApproved'=>$sensitiveDiscount,'thresholdPercent'=>20]);
        foreach($items as$item)if($item['priceOverride'])tamiran_audit($pdo,$shopId,null,(int)$actor['id'],'PRICE_OVERRIDDEN','tamiran_sales_invoice',$publicId,null,['productKey'=>$item['productKey'],'unitPrice'=>$item['unitPrice'],'reason'=>$item['overrideReason']]);
        $pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    tamiran_log('info','SALES_INVOICE_ISSUED',['invoice_id'=>$invoiceId,'invoice_number'=>$invoiceNumber,'actor'=>$actor['id']]);
    $provisioning=['status'=>$status==='draft'?'not_applied':'scheduled'];
    if($status!=='draft'&&!empty($input['provisionNow'])){
        $statement=$pdo->prepare('SELECT * FROM tamiran_sales_invoices WHERE id=:id');$statement->execute(['id'=>$invoiceId]);$provisioning=sv2_provision($pdo,$statement->fetch(),(int)$actor['id']);
    }
    return ['created'=>true,'replayed'=>false,'invoiceNumber'=>$invoiceNumber,'invoiceId'=>$invoiceId,'provisioningStatus'=>$provisioning['status'],'entitlementResult'=>$entitlements];
});
