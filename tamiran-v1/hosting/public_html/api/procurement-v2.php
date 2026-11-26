<?php
declare(strict_types=1);

require __DIR__.'/bootstrap.php';
require_once tamiran_private_root().'/v2-core.php';

function procurement_payload(PDO $pdo,array $scope):array
{
    v2_require_permission($scope,'procurement.view',['warehouse_keeper','finance_cashier'],'مشاهده تدارکات مجاز نیست.');
    $suppliers=$pdo->prepare('SELECT id,public_id,name,mobile,phone,national_id,address,notes,is_active FROM repair_suppliers WHERE shop_id=:shop ORDER BY is_active DESC,name');$suppliers->execute(['shop'=>$scope['shop_id']]);
    $documents=$pdo->prepare('SELECT d.*,s.name AS supplier_name,u.display_name AS creator_name FROM repair_purchase_documents d INNER JOIN repair_suppliers s ON s.id=d.supplier_id INNER JOIN tamiran_users u ON u.id=d.created_by_user_id WHERE d.shop_id=:shop AND d.branch_id=:branch ORDER BY d.updated_at DESC LIMIT 500');$documents->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $docs=$documents->fetchAll();$itemsStatement=$pdo->prepare('SELECT x.*,i.item_code,i.title AS item_title FROM repair_purchase_document_items x INNER JOIN repair_inventory_items i ON i.id=x.item_id WHERE x.purchase_document_id=:document ORDER BY x.id');
    $links=$pdo->prepare('SELECT l.part_request_id,r.case_id,c.receipt_number,l.allocated_quantity FROM repair_purchase_request_links l
        JOIN repair_part_requests r ON r.id=l.part_request_id JOIN repair_cases c ON c.id=r.case_id
        WHERE l.purchase_item_id=:item ORDER BY r.id');
    foreach($docs as &$doc) {
        $itemsStatement->execute(['document'=>$doc['id']]);
        $doc['items']=$itemsStatement->fetchAll();
        foreach($doc['items'] as &$item) {
            $links->execute(['item'=>$item['id']]);
            $item['requests']=$links->fetchAll();
        }
        unset($item);
    }
    unset($doc);
    return ['suppliers'=>$suppliers->fetchAll(),'documents'=>$docs];
}

function procurement_supplier(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'procurement.supplier.manage',['warehouse_keeper'],'تعریف تأمین‌کننده مجاز نیست.');$name=v2_text($input['name']??'','نام تأمین‌کننده',180);$public=tamiran_id();$pdo->prepare('INSERT INTO repair_suppliers(public_id,shop_id,name,mobile,phone,national_id,address,notes) VALUES(:public,:shop,:name,:mobile,:phone,:national,:address,:notes)')->execute(['public'=>$public,'shop'=>$scope['shop_id'],'name'=>$name,'mobile'=>trim((string)($input['mobile']??''))===''?null:tamiran_mobile((string)$input['mobile']),'phone'=>v2_text($input['phone']??'','تلفن',20,false),'national'=>v2_text($input['nationalId']??'','شناسه ملی',20,false),'address'=>v2_text($input['address']??'','آدرس',1000,false),'notes'=>v2_text($input['notes']??'','توضیحات',4000,false)]);return ['created'=>true,'publicId'=>$public];
}

function procurement_create(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'procurement.create',['warehouse_keeper'],'ساخت سفارش خرید فقط برای انباردار یا مدیر مجاز است.');
    if($scope['role']==='technician') throw new TamiranApiException('تکنسین فقط درخواست قطعه ثبت می‌کند.',403);
    $supplierId=(int)($input['supplierId']??0);
    $items=$input['items']??null;
    if($supplierId<1||!is_array($items)||$items===[]||count($items)>200) throw new TamiranApiException('تأمین‌کننده و ردیف‌های سفارش الزامی است.');
    $pdo->beginTransaction();
    try {
        $supplier=$pdo->prepare('SELECT id FROM repair_suppliers WHERE id=:id AND shop_id=:shop AND is_active=1');
        $supplier->execute(['id'=>$supplierId,'shop'=>$scope['shop_id']]);
        if(!$supplier->fetchColumn()) throw new TamiranApiException('تأمین‌کننده فعال پیدا نشد.',404);
        $pdo->prepare('SELECT id FROM repair_shops WHERE id=:shop FOR UPDATE')->execute(['shop'=>$scope['shop_id']]);
        $sequence=$pdo->prepare('SELECT COUNT(*)+1 FROM repair_purchase_documents WHERE shop_id=:shop');
        $sequence->execute(['shop'=>$scope['shop_id']]);
        $number='PO-'.$scope['shop_id'].'-'.str_pad((string)$sequence->fetchColumn(),6,'0',STR_PAD_LEFT);
        $subtotal=0;
        $discountTotal=0;
        $taxTotal=0;
        $normalized=[];
        $caseRequest=$pdo->prepare("SELECT r.id,r.case_id,r.quantity-r.reserved_quantity AS remaining FROM repair_part_requests r
            WHERE r.id=:request AND r.shop_id=:shop AND r.branch_id=:branch AND r.item_id=:item
              AND r.status IN ('pending','needs_supply','reserved','partially_delivered')
              AND NOT EXISTS (SELECT 1 FROM repair_purchase_request_links l JOIN repair_purchase_document_items pi ON pi.id=l.purchase_item_id
                JOIN repair_purchase_documents pd ON pd.id=pi.purchase_document_id
                WHERE l.part_request_id=r.id AND pd.status NOT IN ('received','rejected','cancelled')) FOR UPDATE");
        foreach($items as $line) {
            $itemId=(int)($line['itemId']??0);
            $quantity=(int)($line['quantity']??0);
            $price=(int)($line['unitPrice']??0);
            $discount=(int)($line['discountAmount']??0);
            $tax=(int)($line['taxAmount']??0);
            $allocations=$line['allocations']??null;
            if($allocations===null && is_array($line['partRequestIds']??null)){
                $allocations=array_map(static fn($id)=>['requestId'=>$id],$line['partRequestIds']);
            }
            if($itemId<1||isset($normalized[$itemId])||$quantity<1||$quantity>1000000||$price<0||$price>1000000000000||
                $discount<0||$tax<0||$tax>1000000000000||!is_array($allocations)||$allocations===[]||count($allocations)>200) {
                throw new TamiranApiException('هر ردیف سفارش باید مقدار معتبر و حداقل یک درخواست قطعه داشته باشد.');
            }
            $base=$quantity*$price;
            if($discount>$base) throw new TamiranApiException('تخفیف ردیف معتبر نیست.');
            if($discount>0&&$scope['role']!=='repair_manager') throw new TamiranApiException('تخفیف فقط توسط مدیر مجاز است.',403);
            if($subtotal+$base>9000000000000000) throw new TamiranApiException('مبلغ سفارش خارج از محدوده مجاز است.');
            $links=[];
            $remaining=$quantity;
            foreach($allocations as $allocation) {
                $requestId=(int)($allocation['requestId']??0);
                if($requestId<1||isset($links[$requestId])) throw new TamiranApiException('درخواست قطعه معتبر نیست یا تکرار شده است.');
                $caseRequest->execute(['request'=>$requestId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'item'=>$itemId]);
                $request=$caseRequest->fetch();
                if(!$request) throw new TamiranApiException('درخواست باز و هم‌کالا در این شعبه پیدا نشد یا قبلاً سفارش داده شده است.',409);
                technician_editable(v2_case($pdo,$scope,(int)$request['case_id'],true));
                $allocated=isset($allocation['quantity'])?(int)$allocation['quantity']:min($remaining,(int)$request['remaining']);
                if($allocated<1||$allocated>$remaining||$allocated>(int)$request['remaining']) {
                    throw new TamiranApiException('تعداد سفارش بیشتر از مانده درخواست یا سهم ردیف است.',409);
                }
                $links[$requestId]=$allocated;
                $remaining-=$allocated;
            }
            if($remaining!==0) throw new TamiranApiException('تمام تعداد ردیف باید به درخواست‌های قطعه تخصیص داده شود.',409);
            $subtotal+=$base;
            $discountTotal+=$discount;
            $taxTotal+=$tax;
            $normalized[$itemId]=[$quantity,$price,$discount,$tax,$base-$discount+$tax,$links];
        }
        $total=$subtotal-$discountTotal+$taxTotal;
        $public=tamiran_id();
        $pdo->prepare("INSERT INTO repair_purchase_documents(public_id,document_number,shop_id,branch_id,supplier_id,status,order_date,expected_at,subtotal_amount,discount_amount,tax_amount,total_amount,origin_reason,manager_notes,created_by_user_id)
            VALUES(:public,:number,:shop,:branch,:supplier,'awaiting_approval',:order_date,:expected,:subtotal,:discount,:tax,:total,:reason,:notes,:actor)")
            ->execute(['public'=>$public,'number'=>$number,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'supplier'=>$supplierId,'order_date'=>$input['orderDate']??date('Y-m-d'),'expected'=>$input['expectedAt']??null,'subtotal'=>$subtotal,'discount'=>$discountTotal,'tax'=>$taxTotal,'total'=>$total,'reason'=>v2_text($input['originReason']??'کسری موجودی پرونده','علت اصلی درخواست',1000),'notes'=>v2_text($input['managerNotes']??'','یادداشت مدیر',4000,false),'actor'=>$scope['actor']['id']]);
        $documentId=(int)$pdo->lastInsertId();
        $insert=$pdo->prepare('INSERT INTO repair_purchase_document_items(public_id,purchase_document_id,item_id,quantity,unit_price,discount_amount,tax_amount,line_total) VALUES(:public,:document,:item,:quantity,:price,:discount,:tax,:total)');
        $link=$pdo->prepare('INSERT INTO repair_purchase_request_links(purchase_item_id,part_request_id,allocated_quantity) VALUES(:item,:request,:quantity)');
        $mark=$pdo->prepare("UPDATE repair_part_requests SET status='needs_supply',source_type='purchase'
            WHERE id=:request AND reserved_quantity=delivered_quantity AND status IN ('pending','needs_supply')");
        foreach($normalized as $itemId=>[$quantity,$price,$discount,$tax,$lineTotal,$links]) {
            $insert->execute(['public'=>tamiran_id(),'document'=>$documentId,'item'=>$itemId,'quantity'=>$quantity,'price'=>$price,'discount'=>$discount,'tax'=>$tax,'total'=>$lineTotal]);
            $purchaseItemId=(int)$pdo->lastInsertId();
            foreach($links as $requestId=>$allocated) {
                $link->execute(['item'=>$purchaseItemId,'request'=>$requestId,'quantity'=>$allocated]);
                $mark->execute(['request'=>$requestId]);
            }
        }
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'purchase.create','repair_purchase_document',$public,null,['number'=>$number,'total'=>$total]);
        $pdo->commit();
        return ['created'=>true,'publicId'=>$public,'documentNumber'=>$number];
    } catch(Throwable $error) {
        if($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function procurement_approve(PDO $pdo,array $scope,array $input):array
{
    if($scope['role']!=='repair_manager')throw new TamiranApiException('تأیید سفارش فقط برای مدیر مجاز است.',403);$public=v2_text($input['publicId']??'','سفارش',80);$reason=v2_text($input['reason']??'','علت',1000,false);$pdo->beginTransaction();try{$statement=$pdo->prepare('SELECT d.*,s.operation_mode FROM repair_purchase_documents d INNER JOIN repair_shops s ON s.id=d.shop_id WHERE d.public_id=:public AND d.shop_id=:shop AND d.branch_id=:branch FOR UPDATE');$statement->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);$doc=$statement->fetch();if(!is_array($doc)||$doc['status']!=='awaiting_approval')throw new TamiranApiException('سفارش قابل تأیید نیست.',409);if((int)$doc['created_by_user_id']===(int)$scope['actor']['id']&&$doc['operation_mode']==='multi_user')throw new TamiranApiException('در حالت چندنفره سازنده سفارش نمی‌تواند همان سفارش را تأیید کند.',409);if((int)$doc['created_by_user_id']===(int)$scope['actor']['id']&&$reason===null)throw new TamiranApiException('خودتأییدی در حالت تک‌نفره فقط با ثبت علت مجاز است.');$pdo->prepare("UPDATE repair_purchase_documents SET status='approved',approved_by_user_id=:actor,updated_at=NOW() WHERE id=:id")->execute(['actor'=>$scope['actor']['id'],'id'=>$doc['id']]);tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'purchase.approve','repair_purchase_document',$public,['status'=>$doc['status']],['status'=>'approved','selfApproval'=>(int)$doc['created_by_user_id']===(int)$scope['actor']['id']],$reason);$pdo->commit();}catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}return ['approved'=>true];
}

function procurement_receive(PDO $pdo,array $scope,array $input):array
{
    v2_require_permission($scope,'procurement.receive',['warehouse_keeper'],'دریافت سفارش فقط برای انباردار یا مدیر مجاز است.');
    $public=v2_text($input['publicId']??'','سفارش',80);
    $key=v2_text($input['idempotencyKey']??'','شناسه دریافت',160,false);
    $lines=$input['items']??null;
    if(!is_array($lines)||$lines===[]||count($lines)>200) throw new TamiranApiException('اقلام دریافتی الزامی است.');
    $signature=hash('sha256',v2_json($input));
    $pdo->beginTransaction();
    try {
        $statement=$pdo->prepare('SELECT * FROM repair_purchase_documents WHERE public_id=:public AND shop_id=:shop AND branch_id=:branch FOR UPDATE');
        $statement->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
        $doc=$statement->fetch();
        if(!$doc) throw new TamiranApiException('سفارش قابل دریافت نیست.',409);
        if($key!==null) {
            $replay=$pdo->prepare("SELECT after_json FROM tamiran_audit_log
                WHERE shop_id=:shop AND branch_id=:branch AND actor_user_id=:actor AND action_code='purchase.receive'
                  AND entity_type='repair_purchase_document' AND entity_public_id=:public
                  AND JSON_UNQUOTE(JSON_EXTRACT(after_json,'$.key'))=:retry LIMIT 1");
            $replay->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'actor'=>$scope['actor']['id'],'public'=>$public,'retry'=>$key]);
            if($saved=$replay->fetchColumn()) {
                $saved=json_decode($saved,true);
                if($saved['signature']!==$signature) throw new TamiranApiException('داده‌های ثبت مجدد دریافت با درخواست قبلی متفاوت است.',409);
                $pdo->commit();
                return ['received'=>true,'status'=>$saved['status'],'receiptPublicId'=>$saved['receipt'],'replayed'=>true];
            }
        }
        if(!in_array($doc['status'],['approved','ordered','partially_received'],true)) throw new TamiranApiException('سفارش قابل دریافت نیست.',409);
        $warehouse=$pdo->prepare('SELECT id FROM repair_warehouses WHERE shop_id=:shop AND branch_id=:branch AND is_main=1 AND is_active=1 LIMIT 1');
        $warehouse->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
        $warehouseId=(int)$warehouse->fetchColumn();
        if($warehouseId<1) throw new TamiranApiException('انبار اصلی شعبه پیدا نشد.',409);
        $receiptPublic=tamiran_id();
        $pdo->prepare('INSERT INTO repair_purchase_receipts(public_id,purchase_document_id,received_by_user_id,delivery_reference,notes) VALUES(:public,:document,:actor,:reference,:notes)')
            ->execute(['public'=>$receiptPublic,'document'=>$doc['id'],'actor'=>$scope['actor']['id'],'reference'=>v2_text($input['deliveryReference']??'','شماره تحویل',160,false),'notes'=>v2_text($input['notes']??'','توضیحات',4000,false)]);
        $receiptId=(int)$pdo->lastInsertId();
        $items=$pdo->prepare('SELECT * FROM repair_purchase_document_items WHERE id=:id AND purchase_document_id=:document FOR UPDATE');
        $seen=[];
        foreach($lines as $line) {
            $id=(int)($line['purchaseItemId']??0);
            $accepted=(int)($line['acceptedQuantity']??0);
            $defective=(int)($line['defectiveQuantity']??0);
            $extra=(int)($line['extraQuantity']??0);
            if($id<1||isset($seen[$id])||min($accepted,$defective,$extra)<0||max($accepted,$defective,$extra)>1000000||$accepted+$defective+$extra<1) {
                throw new TamiranApiException('ردیف دریافت خالی، نامعتبر یا تکراری است.');
            }
            $seen[$id]=true;
            $items->execute(['id'=>$id,'document'=>$doc['id']]);
            $item=$items->fetch();
            if(!$item) throw new TamiranApiException('ردیف خرید معتبر نیست.',409);
            $remaining=(int)$item['quantity']-(int)$item['received_quantity']-(int)$item['defective_quantity'];
            if($accepted+$defective>$remaining) throw new TamiranApiException('تعداد دریافت‌شده از مانده سفارش بیشتر است.',409);
            $pdo->prepare('INSERT INTO repair_purchase_receipt_items(receipt_id,purchase_item_id,accepted_quantity,defective_quantity,extra_quantity,unit_cost,notes)
                VALUES(:receipt,:item,:accepted,:defective,:extra,:cost,:notes)')
                ->execute(['receipt'=>$receiptId,'item'=>$id,'accepted'=>$accepted,'defective'=>$defective,'extra'=>$extra,'cost'=>$item['unit_price'],'notes'=>v2_text($line['notes']??'','توضیح ردیف',2000,false)]);
            $pdo->prepare('UPDATE repair_purchase_document_items SET received_quantity=received_quantity+:accepted,defective_quantity=defective_quantity+:defective WHERE id=:id')
                ->execute(['accepted'=>$accepted,'defective'=>$defective,'id'=>$id]);
            if($accepted+$extra>0) {
                $pdo->prepare('INSERT INTO repair_branch_stock(shop_id,branch_id,warehouse_id,item_id,physical_quantity,reserved_quantity,average_unit_cost)
                    VALUES(:shop,:branch,:warehouse,:item,0,0,0) ON DUPLICATE KEY UPDATE item_id=VALUES(item_id)')
                    ->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'warehouse'=>$warehouseId,'item'=>$item['item_id']]);
                v2_stock_mutate($pdo,$scope,$warehouseId,(int)$item['item_id'],$accepted+$extra,0,'receipt','purchase_receipt',$receiptPublic,'دریافت سفارش خرید',null,(int)$item['unit_price']);
            }
            if($accepted>0) procurement_allocate_receipt($pdo,$scope,$warehouseId,$item,$accepted);
        }
        $remaining=$pdo->prepare('SELECT COUNT(*) FROM repair_purchase_document_items WHERE purchase_document_id=:document AND received_quantity+defective_quantity<quantity');
        $remaining->execute(['document'=>$doc['id']]);
        $status=(int)$remaining->fetchColumn()>0?'partially_received':'received';
        $pdo->prepare('UPDATE repair_purchase_documents SET status=:status,supplier_invoice_number=COALESCE(:invoice,supplier_invoice_number),invoice_file_id=COALESCE(:file,invoice_file_id),updated_at=NOW() WHERE id=:id')
            ->execute(['status'=>$status,'invoice'=>v2_text($input['supplierInvoiceNumber']??'','شماره فاکتور',120,false),'file'=>(int)($input['invoiceFileId']??0)?:null,'id'=>$doc['id']]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'purchase.receive','repair_purchase_document',$public,['status'=>$doc['status']],['status'=>$status,'receipt'=>$receiptPublic,'key'=>$key,'signature'=>$signature]);
        $pdo->commit();
        return ['received'=>true,'status'=>$status,'receiptPublicId'=>$receiptPublic];
    } catch(Throwable $error) {
        if($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function procurement_allocate_receipt(PDO $pdo,array $scope,int $warehouseId,array $item,int $available):void
{
    $links=$pdo->prepare("SELECT l.allocated_quantity,r.id,r.public_id,r.case_id,r.quantity,r.reserved_quantity,r.delivered_quantity,r.requested_by_user_id
        FROM repair_purchase_request_links l JOIN repair_part_requests r ON r.id=l.part_request_id
        JOIN repair_case_workflows w ON w.case_id=r.case_id AND w.shop_id=r.shop_id AND w.branch_id=r.branch_id
        WHERE l.purchase_item_id=:item AND r.shop_id=:shop AND r.branch_id=:branch AND w.locked_at IS NULL
          AND r.status IN ('pending','needs_supply','reserved','partially_delivered')
        ORDER BY r.id FOR UPDATE");
    $links->execute(['item'=>$item['id'],'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $count=$pdo->prepare("SELECT COALESCE(SUM(reserved_delta),0) FROM repair_inventory_ledger
        WHERE shop_id=:shop AND branch_id=:branch AND reference_type='purchase_allocation' AND reference_public_id=:reference");
    $update=$pdo->prepare("UPDATE repair_part_requests SET status=:status,source_type='branch_stock',
        reserved_quantity=reserved_quantity+:quantity,reservation_expires_at=DATE_ADD(NOW(),INTERVAL 48 HOUR),reservation_expired_at=NULL WHERE id=:id");
    foreach($links->fetchAll() as $link) {
        if($available===0) break;
        $reference=$item['public_id'].':'.$link['public_id'];
        $count->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'reference'=>$reference]);
        $take=min($available,(int)$link['allocated_quantity']-(int)$count->fetchColumn(),(int)$link['quantity']-(int)$link['reserved_quantity']);
        if($take<1) continue;
        v2_stock_mutate($pdo,$scope,$warehouseId,(int)$item['item_id'],0,$take,'reserve','purchase_allocation',$reference,'رزرو از دریافت سفارش خرید',(int)$link['case_id']);
        $update->execute(['status'=>(int)$link['delivered_quantity']>0?'partially_delivered':'reserved','quantity'=>$take,'id'=>$link['id']]);
        v2_notify($pdo,$scope,(int)$link['requested_by_user_id'],'purchased_part_received','قطعهٔ خریداری‌شده برای پرونده رزرو شد','تعداد '.$take.' · درخواست '.$link['public_id'],'repair_part_request',$link['public_id']);
        $available-=$take;
    }
}

tamiran_api(static function():array{$pdo=tamiran_db();$scope=v2_scope();v2_require_capability(v2_product_policy($pdo,$scope),'procurement','سفارش خرید فقط در حالت انبار حرفه‌ای فعال است.');$method=$_SERVER['REQUEST_METHOD']??'GET';if($method==='GET')return procurement_payload($pdo,$scope);if($method!=='POST')throw new TamiranApiException('روش درخواست مجاز نیست.',405);tamiran_require_csrf();$input=tamiran_json_body();return match((string)($input['action']??'')){'supplier_create'=>procurement_supplier($pdo,$scope,$input),'document_create'=>procurement_create($pdo,$scope,$input),'approve'=>procurement_approve($pdo,$scope,$input),'receive'=>procurement_receive($pdo,$scope,$input),default=>throw new TamiranApiException('عملیات سفارش خرید معتبر نیست.'),};});
