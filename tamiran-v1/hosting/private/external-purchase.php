<?php
declare(strict_types=1);

function external_purchase_rows(PDO $pdo, array $scope, ?int $caseId): array
{
    $where=$caseId===null?'':'AND w.case_id=:case';
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']];
    if ($caseId!==null) $params['case']=$caseId;
    $statement=$pdo->prepare("SELECT e.metadata_json,c.receipt_number,w.case_id
        FROM repair_case_events e JOIN repair_case_workflows w ON w.case_id=e.case_id
        JOIN repair_cases c ON c.id=w.case_id
        WHERE w.shop_id=:shop AND w.branch_id=:branch AND e.event_type='external_purchase_state' $where
        ORDER BY e.id DESC");
    $statement->execute($params);
    $rows=[];
    while ($event=$statement->fetch()) {
        $entry=json_decode((string)$event['metadata_json'],true);
        if (!is_array($entry)||!isset($entry['publicId'])||isset($rows[$entry['publicId']])) continue;
        if ($entry['status']==='bought'&&!empty($entry['receivedAt'])) $entry['status']='received';
        $rows[$entry['publicId']]=$entry+['caseId'=>(int)$event['case_id'],'receiptNumber'=>$event['receipt_number']];
    }
    return $rows;
}

function external_purchase_can_add_catalog(array $scope):bool
{
    return $scope['role']==='repair_manager'
        || ($scope['role']==='technician' && in_array('inventory.catalog.create',$scope['permissions'],true));
}

function external_purchase_view(PDO $pdo, array $scope, ?int $caseId, bool $summary=false): array
{
    $manager=$scope['role']==='repair_manager';
    if ($caseId===null && !$manager) throw new TamiranApiException('صف مجوز خرید تنها برای مدیر است.',403);
    if ($caseId!==null) {
        $case=v2_case($pdo,$scope,$caseId);
        v2_require_case_access($pdo,$scope,$case);
        v2_require_permission($scope,'case.part.record',['technician'],'مشاهده خرید قطعه مجاز نیست.');
    }
    $records=external_purchase_rows($pdo,$scope,$caseId);
    if ($caseId===null) $records=array_filter($records,static fn(array $r):bool=>in_array($r['status'],['pending','returning'],true));
    $ownCommitted=0;
    foreach ($records as &$record) {
        if ((int)$record['requestedBy']===(int)$scope['actor']['id']&&!in_array($record['status'],['rejected','cancelled'],true)) $ownCommitted+=(int)$record['total'];
        if (!$manager) unset($record['unitCost'],$record['total']);
    }
    unset($record);
    $items=[];
    if ($caseId!==null&&!$summary) {
        $catalog=$pdo->prepare('SELECT id,item_code AS code,title,sale_price AS salePrice FROM repair_inventory_items WHERE shop_id=:shop AND is_active=1 ORDER BY title,id LIMIT 500');
        $catalog->execute(['shop'=>$scope['shop_id']]);
        while ($item=$catalog->fetch()) {
            $items[]=['id'=>(int)$item['id'],'code'=>$item['code'],'title'=>$item['title'],'salePrice'=>(int)$item['salePrice']];
        }
    }
    $canManageCatalog=$caseId!==null && external_purchase_can_add_catalog($scope);
    $categories=[];
    if ($canManageCatalog) {
        $query=$pdo->prepare("SELECT DISTINCT category FROM repair_inventory_items
            WHERE shop_id=:shop AND is_active=1 AND category IS NOT NULL AND category<>'' ORDER BY category");
        $query->execute(['shop'=>$scope['shop_id']]);
        $categories=$query->fetchAll(PDO::FETCH_COLUMN);
    }
    $rules=operations_policy($pdo,(int)$scope['shop_id']);
    return ['rows'=>array_values($records),'catalog'=>$items,'policy'=>$manager?'free':$rules['purchase'],
        'canManageCatalog'=>$canManageCatalog,'canPriceCatalog'=>$canManageCatalog&&$manager,'catalogCategories'=>$categories,'ownCommitted'=>$ownCommitted,'ownLimit'=>(int)($rules['purchaseLimits'][(int)$scope['actor']['id']]??0)];
}

function external_purchase_catalog(PDO $pdo,array $scope,int $caseId,mixed $search):array
{
    $case=v2_case($pdo,$scope,$caseId);
    v2_require_case_access($pdo,$scope,$case);
    v2_require_permission($scope,'case.part.record',['technician'],'جست‌وجوی قطعه مجاز نیست.');
    $query=v2_text($search,'جست‌وجوی قطعات',120,false);
    $term='%'.strtr((string)$query,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
    $catalog=$pdo->prepare("SELECT id,item_code AS code,title,sale_price AS salePrice
        FROM repair_inventory_items WHERE shop_id=:shop AND is_active=1
        AND (title LIKE :title ESCAPE '!' OR item_code LIKE :code ESCAPE '!' OR category LIKE :category ESCAPE '!')
        ORDER BY title,id LIMIT 20");
    $catalog->execute(['shop'=>$scope['shop_id'],'title'=>$term,'code'=>$term,'category'=>$term]);
    return ['items'=>array_map(static fn($item)=>array_replace($item,['id'=>(int)$item['id'],'salePrice'=>(int)$item['salePrice']]),$catalog->fetchAll())];
}

function external_purchase_requires_customer_authorization(PDO $pdo,array $case,array $records,int $saleAmount):void
{
    $cost=technician_cost_state($pdo,$case);
    $committed=0;
    foreach ($records as $record) {
        if (in_array($record['status'],['bought','received'],true)) $committed+=(int)$record['salePrice']*(int)$record['quantity'];
    }
    $limit=$cost['capAmount'];
    if ($cost['estimatePublicId']!==null) {
        if (!$cost['authorized']) throw new TamiranApiException('پیش از خرید، تأیید معتبر هزینه مشتری را تکمیل کنید.',409);
        $estimate=$pdo->prepare('SELECT status,total_amount FROM repair_estimates WHERE public_id=:public AND case_id=:case');
        $estimate->execute(['public'=>$cost['estimatePublicId'],'case'=>$case['case_id']]);
        $quote=$estimate->fetch();
        if (($quote['status']??'')==='approved') $limit=max($limit,(int)$quote['total_amount']);
    }
    $fixed=$cost['totalAmount']-max($cost['partsAmount'],$cost['quotedPartsAmount']);
    if ($fixed+max($cost['quotedPartsAmount'],$cost['partsAmount']+$committed+$saleAmount)>$limit) {
        throw new TamiranApiException('مجموع هزینه قطعات از مبلغ مجاز مشتری بیشتر است. برآورد را اصلاح کنید.',409);
    }
}

function external_purchase_event(PDO $pdo, array $scope, array $case, array $record, ?string $reason=null): void
{
    $description=match($record['status']){
        'pending'=>'درخواست مجوز خرید قطعه خارج از انبار',
        'approved'=>'مجوز خرید قطعه خارج از انبار',
        'rejected'=>'رد خرید قطعه خارج از انبار',
        'bought'=>'ثبت خرید واقعی قطعه خارج از انبار',
        'received'=>'دریافت فیزیکی قطعه خرید خارج از انبار',
        'used'=>'مصرف قطعه خارج از انبار',
        'returning'=>'درخواست تعیین تکلیف قطعه خارج از انبار',
        'returned'=>'تعیین تکلیف فیزیکی قطعه خارج از انبار ثبت شد',
        'cancelled'=>'لغو خرید قطعه خارج از انبار',
    };
    // Keep the existing open-purchase status recognizable to earlier releases on rollback.
    $stored=$record;
    if ($stored['status']==='received') {
        $stored['status']='bought';
        $stored['receivedAt']=gmdate('c');
    }
    $pdo->prepare("INSERT INTO repair_case_events(case_id,actor_user_id,event_type,description,metadata_json)
        VALUES(:case,:actor,'external_purchase_state',:description,:metadata)")
        ->execute(['case'=>$case['case_id'],'actor'=>$scope['actor']['id'],'description'=>$description.' — '.$record['title'],'metadata'=>v2_json($stored)]);
    tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],
        'case.external_purchase.'.$record['status'],'repair_case',$case['case_public_id'],null,$record,$reason);
}

/** Lock the case before reading commitments, including in a concurrent request from the same technician. */
function external_purchase_change(PDO $pdo, array $scope, array $input): array
{
    $caseId=(int)($input['caseId']??0);
    $action=(string)($input['decision']??'');
    $key=v2_text($input['idempotencyKey']??'','شناسه درخواست خرید',160);
    $manager=$scope['role']==='repair_manager';
    $reason=v2_text($input['reason']??'','توضیح عملیات خرید',1000,in_array($action,['reject','return','confirm_return','cancel'],true))??'';
    if (!in_array($action,['request','approve','reject','buy','receive','use','return','confirm_return','cancel'],true)) {
        throw new TamiranApiException('عملیات خرید معتبر نیست.');
    }
    if (!$manager && in_array($action,['approve','reject','confirm_return'],true)) throw new TamiranApiException('تصمیم درباره مجوز فقط با مدیر است.',403);
    v2_require_permission($scope,'case.part.record',['technician'],'ثبت خرید قطعه مجاز نیست.');
    $pdo->beginTransaction();
    try {
        $case=v2_case($pdo,$scope,$caseId,true);
        technician_access($pdo,$scope,$case,true);
        $actor=(int)$scope['actor']['id'];
        $payload=['decision'=>$action,'reason'=>$reason];
        if ($action==='request') {
            $payload['lines']=$input['lines']??null;
            if (($input['purchase']??false)===true) $payload['purchase']=true;
        } else {
            $payload['publicId']=v2_text($input['publicId']??'','شناسه خرید',80);
        }
        if ($action==='return') {
            $payload['disposition']=(string)($input['disposition']??'supplier');
            if (!in_array($payload['disposition'],['supplier','stock','damage','nonrecoverable'],true)) {
                throw new TamiranApiException('تعیین تکلیف برگشت قطعه معتبر نیست.');
            }
        }
        if ($old=technician_replay($pdo,$case,$scope,'external_purchase_operation',$key,$payload)) {
            $pdo->commit();
            return $old;
        }
        technician_editable($case);
        $records=external_purchase_rows($pdo,$scope,$caseId);
        if ($action==='request') {
            $lines=$payload['lines'];
            if (!is_array($lines)||$lines===[]||count($lines)>30) throw new TamiranApiException('بین یک تا ۳۰ ردیف خرید لازم است.');
            $catalog=$pdo->prepare('SELECT title,sale_price,hot_return_required FROM repair_inventory_items WHERE id=:item AND shop_id=:shop AND is_active=1');
            $entryTotal=0;
            $entries=[];
            foreach ($lines as $line) {
                if (!is_array($line)) throw new TamiranApiException('ردیف خرید معتبر نیست.');
                $quantity=filter_var($line['quantity']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>10000]]);
                $cost=technician_money($line['unitCost']??0);
                if ($quantity===false||$cost<1) throw new TamiranApiException('تعداد و بهای خرید باید مثبت باشند.');
                $itemId=(int)($line['itemId']??0);
                $catalog->execute(['item'=>$itemId,'shop'=>$scope['shop_id']]);
                $item=$catalog->fetch();
                if (!is_array($item)) throw new TamiranApiException('قطعه در بانک کالای این تعمیرگاه پیدا نشد.',404);
                $amount=$quantity*$cost;
                $entryTotal+=$amount;
                if ($entryTotal>1000000000000) throw new TamiranApiException('مبلغ خرید خارج از محدوده است.');
                $entries[]=['publicId'=>tamiran_id(),'itemId'=>$itemId,'title'=>$item['title'],'quantity'=>$quantity,
                    'unitCost'=>$cost,'total'=>$amount,'salePrice'=>(int)$item['sale_price'],'requestedBy'=>$actor,
                    'requestedAt'=>gmdate('c'),'coreRequired'=>(bool)$item['hot_return_required']];
            }
            $committed=0;
            foreach ($records as $record) {
                if ((int)$record['requestedBy']===$actor&&!in_array($record['status'],['rejected','cancelled'],true)) $committed+=(int)$record['total'];
            }
            $rules=operations_policy($pdo,(int)$scope['shop_id']);
            $needApproval=!$manager&&($rules['purchase']==='approval'
                || ($rules['purchase']==='limit'&&$committed+$entryTotal>(int)($rules['purchaseLimits'][$actor]??0)));
            $status=$needApproval?'pending':'approved';
            if (!$needApproval&&!empty($payload['purchase'])) {
                $saleAmount=array_sum(array_map(static fn($entry)=>$entry['salePrice']*$entry['quantity'],$entries));
                external_purchase_requires_customer_authorization($pdo,$case,$records,$saleAmount);
                $status='bought';
            }
            foreach ($entries as $entry) external_purchase_event($pdo,$scope,$case,$entry+['status'=>$status],$reason);
            $result=['status'=>$status,'publicIds'=>array_column($entries,'publicId')];
        } else {
            $record=$records[$payload['publicId']]??null;
            if (!is_array($record)) throw new TamiranApiException('خرید برای این پرونده پیدا نشد.',404);
            $from=[
                'approve'=>['pending'],'reject'=>['pending'],'buy'=>['approved'],
                'receive'=>['bought'],'use'=>['received'],'return'=>['received'],'confirm_return'=>['returning'],'cancel'=>['pending','approved'],
            ];
            if (!in_array($record['status'],$from[$action],true)) throw new TamiranApiException('این خرید در مرحله مناسب عملیات نیست.',409);
            if (!$manager && in_array($action,['buy','cancel'],true)&&(int)$record['requestedBy']!==$actor) {
                throw new TamiranApiException('خرید یا لغو مجوز فقط برای درخواست‌کننده یا مدیر مجاز است.',403);
            }
            if ($action==='buy') external_purchase_requires_customer_authorization($pdo,$case,$records,(int)$record['salePrice']*(int)$record['quantity']);
            $status=match($action){'approve'=>'approved','reject'=>'rejected','buy'=>'bought','receive'=>'received','use'=>'used','return'=>'returning','confirm_return'=>'returned','cancel'=>'cancelled'};
            if ($action==='use') {
                $insert=$pdo->prepare('INSERT INTO repair_case_manual_parts(public_id,shop_id,case_id,title,quantity,purchase_unit_cost,sale_unit_price,note,idempotency_key,created_by_user_id)
                    VALUES(:public,:shop,:case,:title,:quantity,:cost,:sale,:note,:key,:actor)');
                $insert->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'case'=>$caseId,'title'=>$record['title'],
                    'quantity'=>$record['quantity'],'cost'=>$record['unitCost'],'sale'=>$record['salePrice'],
                    'note'=>'قطعه خرید خارج از انبار','key'=>'external-purchase:'.$record['publicId'],'actor'=>$actor]);
                if (!empty($record['coreRequired'])&&v2_product_policy($pdo,$scope,$case)['hotReturn']) {
                    $pdo->prepare("INSERT INTO repair_hot_returns(public_id,shop_id,branch_id,case_id,item_id,technician_user_id,quantity,status,notes)
                        VALUES(:public,:shop,:branch,:case,:item,:actor,:quantity,'pending_return','مصرف قطعه خرید خارج از انبار')")
                        ->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId,
                            'item'=>$record['itemId'],'actor'=>$actor,'quantity'=>$record['quantity']]);
                }
            }
            if ($action==='return') $record['disposition']=$payload['disposition'];
            if ($action==='confirm_return'&&($record['disposition']??'')==='stock') {
                $record['receivingLedger']=external_purchase_receive_into_stock($pdo,$scope,$case,$record,$reason);
            }
            $record['status']=$status;
            $record['decisionNote']=$reason;
            external_purchase_event($pdo,$scope,$case,$record,$reason);
            $result=['status'=>$status];
        }
        $event=technician_event($pdo,$scope,$case,'external_purchase_operation',$key,$payload,$result);
        $pdo->commit();
        return $event;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function external_purchase_receive_into_stock(PDO $pdo,array $scope,array $case,array $record,string $reason):string
{
    v2_require_capability(v2_product_policy($pdo,$scope,$case),'inventoryEnabled','انبار در این پرونده فعال نیست.');
    $warehouse=$pdo->prepare('SELECT id FROM repair_warehouses WHERE shop_id=:shop AND branch_id=:branch AND is_main=1 AND is_active=1 LIMIT 1 FOR UPDATE');
    $warehouse->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $id=(int)$warehouse->fetchColumn();
    if (!$id) throw new TamiranApiException('انبار اصلی شعبه پیدا نشد.',409);
    $pdo->prepare('INSERT INTO repair_branch_stock(shop_id,branch_id,warehouse_id,item_id,physical_quantity,reserved_quantity,average_unit_cost)
        VALUES(:shop,:branch,:warehouse,:item,0,0,0) ON DUPLICATE KEY UPDATE item_id=item_id')
        ->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'warehouse'=>$id,'item'=>$record['itemId']]);
    $stock=v2_stock_mutate($pdo,$scope,$id,(int)$record['itemId'],(int)$record['quantity'],0,'receipt',
        'external_purchase',$record['publicId'],$reason,(int)$case['case_id'],(int)$record['unitCost']);
    return $stock['ledgerPublicId'];
}

function external_purchase_add_catalog(PDO $pdo,array $scope,array $input):array
{
    if (!external_purchase_can_add_catalog($scope)) throw new TamiranApiException('مجوز تعریف قطعه برای این کاربر فعال نیست.',403);
    $manager=$scope['role']==='repair_manager';
    $caseId=v2_queue_id($input,'caseId');
    if (!$manager && $caseId===null) throw new TamiranApiException('تعریف قطعه توسط تکنسین باید از داخل پرونده انجام شود.',403);
    $code=v2_text($input['code']??'','کد کالا',80);
    $title=v2_text($input['title']??'','نام کالا',180);
    $category=v2_text($input['category']??'','دسته‌بندی',120,false);
    $price=technician_money($input['salePrice']??0);
    if (!$manager && $price!==0) throw new TamiranApiException('تعیین قیمت فروش کالا به مجوز مدیر نیاز دارد.',403);
    $pdo->beginTransaction();
    try {
        if ($caseId!==null) {
            $case=v2_case($pdo,$scope,$caseId,true);
            v2_require_case_access($pdo,$scope,$case);
            technician_editable($case);
        }
        $matches=v2_catalog_collisions($pdo,$scope,$code,$title);
        if ($matches!==[]) {
            $match=$matches[0];
            if (count($matches)===1 && $match['title']===$title && $match['item_code']===$code && $match['is_active']) {
                $pdo->commit();
                return ['id'=>(int)$match['id'],'created'=>false,'salePrice'=>(int)$match['sale_price']];
            }
            throw new TamiranApiException('نام یا کد کالا تکراری است.',409);
        }
        if (!$manager && $category!==null) {
            $existingCategory=$pdo->prepare('SELECT category FROM repair_inventory_items
                WHERE shop_id=:shop AND category=:category AND is_active=1 LIMIT 1');
            $existingCategory->execute(['shop'=>$scope['shop_id'],'category'=>$category]);
            $category=$existingCategory->fetchColumn();
            if ($category===false) throw new TamiranApiException('یک دسته‌بندی موجود در بانک قطعات انتخاب کنید.',422);
        }
        $public=tamiran_id();
        $pdo->prepare('INSERT INTO repair_inventory_items(public_id,shop_id,item_code,title,category,sale_price,hot_evidence_rules_json)
            VALUES(:public,:shop,:code,:title,:category,:price,:rules)')
            ->execute(['public'=>$public,'shop'=>$scope['shop_id'],'code'=>$code,'title'=>$title,'category'=>$category,
                'price'=>$price,'rules'=>v2_json(['serial'=>false,'image'=>false,'condition'=>true])]);
        $id=(int)$pdo->lastInsertId();
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],$scope['actor']['id'],'inventory.catalog.create','repair_inventory_item',
            $public,null,['code'=>$code,'title'=>$title,'category'=>$category,'salePrice'=>$price,'caseId'=>$caseId]);
        $pdo->commit();
        return ['id'=>$id,'created'=>true,'salePrice'=>$price];
    } catch(Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
