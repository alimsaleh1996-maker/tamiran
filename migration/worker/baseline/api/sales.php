<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require dirname(__DIR__, 2) . '/private/product-service.php';

function sales_json_list(mixed $value): array
{
    if (is_array($value)) return array_values($value);
    if (!is_string($value) || trim($value) === '') return [];
    $decoded = json_decode($value, true);
    return is_array($decoded) ? array_values($decoded) : [];
}

function sales_text(mixed $value, int $maxLength): string
{
    $text = trim((string) $value);
    $length = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
    if ($length > $maxLength) throw new TamiranApiException('متن فاکتور بیش از حد طولانی است.');
    return $text;
}

function sales_date(mixed $value): string
{
    $date = (string) $value;
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new TamiranApiException('یکی از تاریخ‌های فاکتور معتبر نیست.');
    return $date;
}

function sales_invoice_number(PDO $pdo): string
{
    $statement = $pdo->prepare('SELECT COUNT(*) FROM tamiran_sales_invoices WHERE invoice_number=:number');
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $number = date('Ymd') . '-' . random_int(100000, 999999);
        $statement->execute(['number'=>$number]);
        if ((int) $statement->fetchColumn() === 0) return $number;
    }
    throw new TamiranApiException('ساخت شماره یکتای فاکتور انجام نشد؛ دوباره تلاش کنید.', 409);
}

function sales_invoice_items(array $input, array $shop, array $productConfig): array
{
    $rawItems = $input['items'] ?? null;
    if (!is_array($rawItems) || count($rawItems) < 1 || count($rawItems) > 20) throw new TamiranApiException('حداقل یک ردیف معتبر برای فاکتور لازم است.');
    $shopModules = array_map('strval', $productConfig['modules']);
    $productLabels = ['solo'=>'تعمیران Solo','pro'=>'تعمیران Pro'];
    $planLabels = ['light' => 'اشتراک پایه تعمیران', 'professional' => 'اشتراک حرفه‌ای تعمیران', 'business' => 'اشتراک سازمانی تعمیران'];
    $repairTypeLabels = ['digital' => 'راه‌اندازی و شخصی‌سازی کالای دیجیتال', 'appliance' => 'راه‌اندازی و شخصی‌سازی لوازم خانگی', 'automotive' => 'راه‌اندازی و شخصی‌سازی خودرو', 'motorcycle' => 'راه‌اندازی و شخصی‌سازی موتورسیکلت', 'generic' => 'راه‌اندازی و شخصی‌سازی تعمیرگاه عمومی'];
    $moduleLabels = ['repair' => 'ماژول مدیریت تعمیرات', 'inventory' => 'ماژول انبار قطعات', 'finance' => 'ماژول مدیریت مالی', 'customer_portal' => 'ماژول پرتال مشتری', 'multi_branch' => 'ماژول مدیریت چندشعبه‌ای', 'sms' => 'ماژول پیامک و اطلاع‌رسانی'];
    $seen = [];
    $items = [];
    foreach ($rawItems as $raw) {
        if (!is_array($raw)) throw new TamiranApiException('ساختار یکی از ردیف‌های فاکتور معتبر نیست.');
        $type = (string) ($raw['type'] ?? '');
        $code = trim((string) ($raw['code'] ?? ''));
        if (!in_array($type, ['product', 'plan', 'repair_type', 'module'], true) || $code === '') throw new TamiranApiException('نوع ردیف فاکتور معتبر نیست.');
        $unique = $type . ':' . $code;
        if (isset($seen[$unique])) throw new TamiranApiException('ردیف تکراری در فاکتور وجود دارد.');
        $seen[$unique] = true;
        if ($type === 'product' && $code !== (string)$productConfig['productProfile']) throw new TamiranApiException('محصول فاکتور با محصول انتخاب‌شده یکسان نیست.');
        if ($type === 'plan' && $code !== (string) $productConfig['plan']) throw new TamiranApiException('پلن داخلی فاکتور با محصول انتخاب‌شده یکسان نیست.');
        if ($type === 'repair_type' && $code !== (string) $shop['repair_type']) throw new TamiranApiException('نوع صنفی فاکتور با تعمیرگاه یکسان نیست.');
        if ($type === 'module' && !in_array($code, $shopModules, true)) throw new TamiranApiException('یکی از ماژول‌های فاکتور برای این تعمیرگاه فعال نیست.');
        $quantity = max(1, min(100, (int) ($raw['quantity'] ?? 1)));
        $unitPrice = max(0, min(1000000000000, (int) ($raw['unitPrice'] ?? 0)));
        if ($type === 'product') $title = $productLabels[$code] ?? 'محصول تعمیران';
        elseif ($type === 'plan') $title = $planLabels[$code] ?? 'اشتراک سفارشی تعمیران';
        elseif ($type === 'repair_type') $title = $repairTypeLabels[$code] ?? 'راه‌اندازی صنفی تعمیرگاه';
        else $title = $moduleLabels[$code] ?? trim((string)($raw['title'] ?? 'ماژول سامانه'));
        $items[] = ['type' => $type, 'code' => $code, 'title' => $title, 'quantity' => $quantity, 'unitPrice' => $unitPrice, 'totalPrice' => $quantity * $unitPrice];
    }
    if (!isset($seen['product:'.$productConfig['productProfile']])) throw new TamiranApiException('ردیف محصول Solo یا Pro در فاکتور الزامی است.');
    return $items;
}

function sales_invoice_row(array $row): array
{
    $items = sales_json_list($row['items_json'] ?? null);
    if ($items === []) {
        $items = [['type' => 'product', 'code' => $row['product_profile'], 'title' => $row['description'], 'quantity' => 1, 'unitPrice' => (int) $row['subtotal_amount'], 'totalPrice' => (int) $row['subtotal_amount']]];
    }
    return [
        'id' => (int) $row['id'],
        'publicId' => $row['public_id'],
        'invoiceNumber' => $row['invoice_number'],
        'shopId' => (int) $row['shop_id'],
        'shopName' => $row['shop_name'],
        'shopCode' => $row['shop_code'],
        'plan' => $row['plan_code'],
        'productProfile' => $row['product_profile'],
        'productSnapshot' => json_decode((string)$row['product_snapshot_json'],true) ?: [],
        'activationStatus' => $row['activation_status'],
        'activatedAt' => $row['activated_at'],
        'repairType' => $row['repair_type_code'] ?? $row['shop_repair_type'] ?? 'generic',
        'modules' => array_map('strval', sales_json_list($row['modules_json'] ?? '[]')),
        'items' => $items,
        'billingPeriod' => $row['billing_period'],
        'issueDate' => $row['issue_date'],
        'dueDate' => $row['due_date'],
        'periodStart' => $row['period_start'],
        'periodEnd' => $row['period_end'],
        'description' => $row['description'],
        'subtotalAmount' => (int) $row['subtotal_amount'],
        'discountAmount' => (int) $row['discount_amount'],
        'taxAmount' => (int) $row['tax_amount'],
        'totalAmount' => (int) $row['total_amount'],
        'paidAmount' => (int) $row['paid_amount'],
        'status' => $row['status'],
        'notes' => $row['notes'] ?? '',
        'createdBy' => $row['created_by'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function sales_status(int $total, int $paid, string $requested): string
{
    if ($requested === 'cancelled') return 'cancelled';
    if ($requested === 'draft') return 'draft';
    if ($paid >= $total && $total > 0) return 'paid';
    if ($paid > 0) return 'partial';
    return 'issued';
}

tamiran_api(static function (): array {
    $actor = tamiran_require_central_admin();
    $pdo = tamiran_db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $rows = $pdo->query(
            'SELECT i.*, s.name AS shop_name, s.public_shop_code AS shop_code, s.repair_type AS shop_repair_type, u.display_name AS created_by
             FROM tamiran_sales_invoices i
             JOIN repair_shops s ON s.id = i.shop_id
             JOIN tamiran_users u ON u.id = i.created_by_user_id
             ORDER BY i.issue_date DESC, i.id DESC LIMIT 500'
        )->fetchAll();
        return [
            'summary' => [
                'invoices' => (int) $pdo->query("SELECT COUNT(*) FROM tamiran_sales_invoices WHERE status <> 'cancelled'")->fetchColumn(),
                'paid' => (int) $pdo->query("SELECT COALESCE(SUM(paid_amount), 0) FROM tamiran_sales_invoices WHERE status <> 'cancelled'")->fetchColumn(),
                'receivable' => (int) $pdo->query("SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM tamiran_sales_invoices WHERE status IN ('issued','partial')")->fetchColumn(),
                'overdue' => (int) $pdo->query("SELECT COUNT(*) FROM tamiran_sales_invoices WHERE due_date < CURRENT_DATE() AND status IN ('issued','partial')")->fetchColumn(),
                'solo' => (int) $pdo->query("SELECT COUNT(*) FROM repair_shops WHERE product_profile='solo'")->fetchColumn(),
                'pro' => (int) $pdo->query("SELECT COUNT(*) FROM repair_shops WHERE product_profile='pro'")->fetchColumn(),
            ],
            'offerings' => tamiran_product_offerings($pdo),
            'invoices' => array_map('sales_invoice_row', $rows),
        ];
    }

    tamiran_require_csrf();
    $input = tamiran_json_body();

    if ($method === 'POST') {
        $shopId = (int) ($input['shopId'] ?? 0);
        $shopStatement = $pdo->prepare('SELECT id,name,shop_code,plan_code,repair_type,modules_json,product_profile,operation_mode,inventory_mode,qc_mode,max_users,max_branches FROM repair_shops WHERE id=:id LIMIT 1');
        $shopStatement->execute(['id' => $shopId]);
        $shop = $shopStatement->fetch();
        if (!is_array($shop)) throw new TamiranApiException('خریدار فاکتور معتبر نیست.', 404);
        $issueDate = sales_date($input['issueDate'] ?? '');
        $dueDate = sales_date($input['dueDate'] ?? '');
        $periodStart = sales_date($input['periodStart'] ?? '');
        $periodEnd = sales_date($input['periodEnd'] ?? '');
        if ($dueDate < $issueDate || $periodEnd < $periodStart) throw new TamiranApiException('ترتیب تاریخ‌های فاکتور معتبر نیست.');
        $period = (string) ($input['billingPeriod'] ?? 'annual');
        if (!in_array($period, ['monthly', 'quarterly', 'semiannual', 'annual', 'custom'], true)) throw new TamiranApiException('دوره صورتحساب معتبر نیست.');
        $productProfile=(string)($input['productProfile']??$shop['product_profile']);
        $rawInvoiceItems=is_array($input['items']??null)?$input['items']:[];
        $requestedModules=['repair'];
        foreach($rawInvoiceItems as $rawItem) if(is_array($rawItem)&&($rawItem['type']??'')==='module') $requestedModules[]=(string)($rawItem['code']??'');
        $requestedModules=tamiran_product_modules($requestedModules);
        $productConfig=tamiran_product_config($productProfile,$requestedModules,[
            'maxUsers'=>$input['maxUsers']??$shop['max_users'],'maxBranches'=>$input['maxBranches']??$shop['max_branches'],
            'qcMode'=>$input['qcMode']??$shop['qc_mode'],
        ]);
        tamiran_product_assert_transition($pdo,$shop,$productConfig);
        $items = sales_invoice_items($input, $shop, $productConfig);
        $subtotal = array_reduce($items, static fn(int $sum, array $item): int => $sum + (int) $item['totalPrice'], 0);
        $discount = max(0, (int) ($input['discountAmount'] ?? 0));
        $tax = max(0, (int) ($input['taxAmount'] ?? 0));
        if ($subtotal < 1) throw new TamiranApiException('مبلغ پایه فاکتور باید بیشتر از صفر باشد.');
        if ($discount > $subtotal) throw new TamiranApiException('تخفیف نمی‌تواند بیشتر از مبلغ پایه باشد.');
        $total = $subtotal - $discount + $tax;
        $paid = max(0, (int) ($input['paidAmount'] ?? 0));
        if ($paid > $total) throw new TamiranApiException('مبلغ پرداخت‌شده نمی‌تواند از مبلغ نهایی بیشتر باشد.');
        $requestedStatus = (string) ($input['status'] ?? 'issued');
        $status = sales_status($total, $paid, $requestedStatus);
        $invoiceNumber = sales_invoice_number($pdo);
        $description = sales_text($input['description'] ?? '', 240);
        if ($description === '') {
            $fallbackDescription = implode('، ', array_column($items, 'title'));
            $description = function_exists('mb_substr') ? mb_substr($fallbackDescription, 0, 240) : substr($fallbackDescription, 0, 240);
        }
        $notes = sales_text($input['notes'] ?? '', 8000);
        $invoiceModules = $productConfig['modules'];
        $activationStatus=$status==='draft'?'pending':'activated';
        $snapshot=tamiran_product_snapshot($productConfig);
        $transitionReason=sales_text($input['productChangeReason']??('فروش و فعال‌سازی محصول '.$productProfile.' با فاکتور '.$invoiceNumber),1000);

        $pdo->beginTransaction();
        try {
        $statement = $pdo->prepare('INSERT INTO tamiran_sales_invoices (public_id,invoice_number,shop_id,idempotency_key,product_profile,product_snapshot_json,activation_status,activated_at,plan_code,repair_type_code,modules_json,items_json,billing_period,issue_date,due_date,period_start,period_end,description,subtotal_amount,discount_amount,tax_amount,total_amount,paid_amount,status,notes,created_by_user_id) VALUES (:public_id,:number,:shop_id,:idempotency,:product,:snapshot,:activation_status,:activated_at,:plan,:repair_type,:modules,:items,:period,:issue_date,:due_date,:period_start,:period_end,:description,:subtotal,:discount,:tax,:total,:paid,:status,:notes,:created_by)');
        $statement->execute([
            'public_id' => tamiran_id(),
            'number' => $invoiceNumber,
            'shop_id' => $shopId,
            'idempotency' => 'legacy-' . tamiran_id(),
            'product'=>$productProfile,'snapshot'=>json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
            'activation_status'=>$activationStatus,'activated_at'=>$activationStatus==='activated'?date('Y-m-d H:i:s'):null,
            'plan' => $productConfig['plan'],
            'repair_type' => $shop['repair_type'],
            'modules' => json_encode($invoiceModules, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'items' => json_encode($items, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'period' => $period,
            'issue_date' => $issueDate,
            'due_date' => $dueDate,
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'description' => $description,
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'total' => $total,
            'paid' => $paid,
            'status' => $status,
            'notes' => $notes ?: null,
            'created_by' => $actor['id'],
        ]);
        $invoiceId=(int)$pdo->lastInsertId();
        if($activationStatus==='activated') tamiran_product_apply($pdo,$shop,$productConfig,(int)$actor['id'],$transitionReason,$invoiceId);
        $pdo->commit();
        } catch(Throwable $error) {
            if($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        tamiran_log('info', 'sales_invoice_created', ['invoice_number' => $invoiceNumber, 'shop_code' => $shop['shop_code'], 'actor' => $actor['displayName']]);
        return ['created' => true, 'invoiceNumber' => $invoiceNumber, 'productProfile'=>$productProfile, 'activationStatus'=>$activationStatus];
    }

    if ($method === 'PATCH') {
        $id = (int) ($input['id'] ?? 0);
        $statement = $pdo->prepare('SELECT * FROM tamiran_sales_invoices WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $current = $statement->fetch();
        if (!is_array($current)) throw new TamiranApiException('فاکتور پیدا نشد.', 404);
        $paid = max(0, (int) ($input['paidAmount'] ?? $current['paid_amount']));
        $total = (int) $current['total_amount'];
        if ($paid > $total) throw new TamiranApiException('مبلغ پرداخت‌شده نمی‌تواند از مبلغ نهایی بیشتر باشد.');
        $requestedStatus = (string) ($input['status'] ?? $current['status']);
        if (!in_array($requestedStatus, ['draft', 'issued', 'partial', 'paid', 'cancelled'], true)) throw new TamiranApiException('وضعیت فاکتور معتبر نیست.');
        $status = sales_status($total, $paid, $requestedStatus);
        $dueDate = sales_date($input['dueDate'] ?? $current['due_date']);
        $notes = sales_text($input['notes'] ?? $current['notes'] ?? '', 8000);
        $activationStatus=(string)$current['activation_status'];
        $activate=$activationStatus==='pending' && !in_array($status,['draft','cancelled'],true);
        $nextActivation=$status==='cancelled'&&$activationStatus==='pending'?'cancelled':($activate?'activated':$activationStatus);
        $pdo->beginTransaction();
        try {
            if($activate){
                $shopStatement=$pdo->prepare('SELECT * FROM repair_shops WHERE id=:id FOR UPDATE');
                $shopStatement->execute(['id'=>$current['shop_id']]);
                $shop=$shopStatement->fetch();
                if(!is_array($shop)) throw new TamiranApiException('تعمیرگاه فاکتور پیدا نشد.',404);
                $snapshot=json_decode((string)$current['product_snapshot_json'],true)?:[];
                $config=tamiran_product_config((string)$current['product_profile'],$snapshot['modules']??sales_json_list($current['modules_json']),$snapshot);
                tamiran_product_apply($pdo,$shop,$config,(int)$actor['id'],'فعال‌سازی فاکتور پیش‌نویس '.$current['invoice_number'],$id);
            }
            $pdo->prepare('UPDATE tamiran_sales_invoices SET due_date=:due_date,paid_amount=:paid,status=:status,notes=:notes,activation_status=:activation,activated_at=IF(:activation_flag=1,COALESCE(activated_at,NOW()),activated_at) WHERE id=:id')->execute([
                'id'=>$id,'due_date'=>$dueDate,'paid'=>$paid,'status'=>$status,'notes'=>$notes?:null,
                'activation'=>$nextActivation,'activation_flag'=>$activate?1:0,
            ]);
            $pdo->commit();
        } catch(Throwable $error) {
            if($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        tamiran_log('info', 'sales_invoice_updated', ['invoice_id' => $id, 'status' => $status, 'actor' => $actor['displayName']]);
        return ['updated' => true, 'activationStatus'=>$nextActivation];
    }

    throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
});
