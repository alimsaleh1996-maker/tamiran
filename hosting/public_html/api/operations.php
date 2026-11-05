<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once tamiran_private_root() . '/v2-core.php';

const TAMIRAN_CASE_STATUSES = [
    'awaiting_assignment', 'assigned', 'diagnosing', 'repairing', 'awaiting_part',
    'awaiting_customer', 'ready_for_delivery', 'returned', 'delivered', 'cancelled',
];

function operations_required(array $input, string $key, int $maxLength): string
{
    $value = trim((string) ($input[$key] ?? ''));
    if ($value === '') throw new TamiranApiException("فیلد {$key} الزامی است.");
    $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    if ($length > $maxLength) throw new TamiranApiException("فیلد {$key} بیش از حد طولانی است.");
    return $value;
}

function operations_optional(mixed $value, int $maxLength): ?string
{
    $normalized = trim((string) $value);
    if ($normalized === '') return null;
    $length = function_exists('mb_strlen') ? mb_strlen($normalized) : strlen($normalized);
    if ($length > $maxLength) throw new TamiranApiException('مقدار واردشده بیش از حد طولانی است.');
    return $normalized;
}

function operations_require_role(array $scope, array $roles, string $message): void
{
    if (!in_array((string) ($scope['actor']['role'] ?? ''), $roles, true)) {
        throw new TamiranApiException($message, 403);
    }
}

function operations_digits(string $value): string
{
    return preg_replace('/[^0-9]/', '', strtr($value, [
        '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
        '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
    ])) ?? '';
}

function operations_appearance_options(PDO $pdo, int $shopId): array
{
    $defaults = ['بدون ایراد ظاهری','خط‌وخش','ترک یا شکستگی','فرورفتگی','آثار ضربه','آثار آب‌خوردگی','تغییر رنگ یا سوختگی','بازشدگی قبلی'];
    $statement = $pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='receipt_template' LIMIT 1");
    $statement->execute(['shop'=>$shopId]);
    $decoded = json_decode((string)($statement->fetchColumn() ?: ''), true);
    $configured = is_array($decoded) && is_array($decoded['appearanceOptions'] ?? null)
        ? array_values(array_unique(array_filter(array_map(static fn($value): string => trim((string)$value), $decoded['appearanceOptions']))))
        : [];
    return $configured === [] ? $defaults : $configured;
}

function operations_scope(PDO $pdo): array
{
    $actor = tamiran_require_actor();
    if (($actor['role'] ?? '') === 'central_admin' || !is_array($actor['shop'] ?? null)) {
        throw new TamiranApiException('عملیات تعمیرگاه فقط از فضای همان تعمیرگاه قابل انجام است.', 403);
    }
    $shopId = (int) $actor['shop']['id'];
    if (!is_array($actor['branch'] ?? null)) throw new TamiranApiException('شعبه نشست معتبر نیست؛ دوباره وارد سامانه شوید.', 401);
    $branch = $pdo->prepare(
        'SELECT b.id, b.branch_code, b.name
         FROM repair_branches b INNER JOIN tamiran_user_branches ub ON ub.branch_id = b.id AND ub.user_id = :user_id
         WHERE b.id = :branch_id AND b.shop_id = :shop_id AND b.is_active = 1 LIMIT 1'
    );
    $branch->execute(['user_id' => (int) $actor['id'], 'branch_id' => (int) $actor['branch']['id'], 'shop_id' => $shopId]);
    $branchRow = $branch->fetch();
    if (!is_array($branchRow)) throw new TamiranApiException('شعبه فعالی برای کاربر تعریف نشده است.', 409);
    return [
        'actor' => $actor,
        'shop_id' => $shopId,
        'shop_code' => (string) $actor['shop']['code'],
        'branch_id' => (int) $branchRow['id'],
        'branch_code' => (string) $branchRow['branch_code'],
        'plan' => (string)($actor['shop']['plan'] ?? 'light'),
        'product_profile' => (string)($actor['shop']['productProfile'] ?? 'pro'),
        'inventory_mode' => (string)($actor['shop']['inventoryMode'] ?? 'off'),
        'qc_mode' => (string)($actor['shop']['qcMode'] ?? 'off'),
        'feature_flags' => (array)($actor['shop']['featureFlags'] ?? []),
    ];
}

function operations_case_select(): string
{
    return <<<'SQL'
SELECT c.*, b.branch_code,
       customer.full_name AS customer_name, customer.mobile AS customer_mobile, customer.national_code,
       customer.province AS customer_province, customer.city AS customer_city, customer.address AS customer_address, customer.postal_code AS customer_postal_code,
       c.device_type_snapshot AS device_type_title, c.brand_snapshot AS brand_title,
       c.model_snapshot AS model_title, c.identifier_snapshot AS identifier_value, c.color_snapshot,
       workflow.id AS workflow_id, workflow.promised_at, workflow.customer_consent_json,
       final_invoice.total_amount AS invoice_total_amount,
       assignee.display_name AS assigned_to_name, creator.display_name AS created_by_name, deliverer.display_name AS delivered_by_name
FROM repair_cases c
INNER JOIN repair_branches b ON b.id = c.branch_id
INNER JOIN repair_customers customer ON customer.id = c.customer_id
INNER JOIN repair_customer_devices device ON device.id = c.device_id
LEFT JOIN tamiran_users assignee ON assignee.id = c.assigned_to_user_id
INNER JOIN tamiran_users creator ON creator.id = c.created_by_user_id
LEFT JOIN tamiran_users deliverer ON deliverer.id = c.delivered_by_user_id
LEFT JOIN repair_case_workflows workflow ON workflow.case_id = c.id
LEFT JOIN repair_invoices final_invoice ON final_invoice.case_id = c.id
SQL;
}

function operations_events(PDO $pdo, int $shopId, array $caseIds): array
{
    if ($caseIds === []) return [];
    $placeholders = implode(',', array_fill(0, count($caseIds), '?'));
    $statement = $pdo->prepare(
        "SELECT timeline.id,timeline.case_id,timeline.event_type,timeline.from_status,timeline.to_status,
                timeline.description,timeline.created_at,u.display_name AS actor_name
         FROM (
             SELECT e.id,e.case_id,e.event_type,e.from_status,e.to_status,e.description,e.created_at,e.actor_user_id
             FROM repair_case_events e INNER JOIN repair_cases c ON c.id=e.case_id
             WHERE c.shop_id=? AND e.case_id IN ({$placeholders})
             UNION ALL
             SELECT -CAST(stage.id AS SIGNED) AS id,workflow.case_id,'workflow_transition' AS event_type,
                    NULL AS from_status,NULL AS to_status,
                    COALESCE(NULLIF(stage.reason,''),'مرحله پرونده تغییر کرد.') AS description,
                    stage.created_at,stage.actor_user_id
             FROM repair_case_stage_events stage
             INNER JOIN repair_case_workflows workflow ON workflow.id=stage.workflow_id
             WHERE workflow.shop_id=? AND workflow.case_id IN ({$placeholders})
         ) timeline
         INNER JOIN tamiran_users u ON u.id=timeline.actor_user_id
         ORDER BY timeline.created_at DESC,timeline.id DESC"
    );
    $statement->execute(array_merge([$shopId], $caseIds, [$shopId], $caseIds));
    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $grouped[(int) $row['case_id']][] = [
            'id' => (int) $row['id'],
            'eventType' => $row['event_type'],
            'fromStatus' => $row['from_status'],
            'toStatus' => $row['to_status'],
            'description' => $row['description'],
            'actorName' => $row['actor_name'],
            'createdAt' => $row['created_at'],
        ];
    }
    return $grouped;
}

function operations_case_to_api(array $row, string $role, array $events = []): array
{
    $accessories = json_decode((string) $row['accessories_json'], true);
    $appearanceStates = json_decode((string) ($row['appearance_states_json'] ?? '[]'), true);
    $trackingUrl = '';
    if (in_array($role, ['repair_manager','reception'], true) && !empty($row['tracking_token_ciphertext'])) {
        $trackingUrl = '/?portal=' . tamiran_decrypt_secret((string)$row['tracking_token_ciphertext']);
    }
    return [
        'id' => (int) $row['id'],
        'expectedVersion' => (int)$row['row_version'],
        'hasWorkflow' => $row['workflow_id'] !== null,
        'publicId' => $row['public_id'],
        'caseUuid' => $row['case_uuid'] ?? '',
        'receiptNumber' => $row['receipt_number'],
        'receiptSequence' => isset($row['receipt_sequence']) ? (int)$row['receipt_sequence'] : null,
        'trackingUrl' => $trackingUrl,
        'branchCode' => $row['branch_code'],
        'customerId' => (int) $row['customer_id'],
        'customerName' => $row['customer_name'],
        'customerMobile' => in_array($role, ['repair_manager','reception'], true) ? $row['customer_mobile'] : '',
        'nationalCode' => in_array($role, ['repair_manager','reception'], true) ? ($row['national_code'] ?? '') : '',
        'customerAddress' => in_array($role, ['repair_manager','reception'], true) ? ($row['customer_address'] ?? '') : '',
        'customerProvince' => in_array($role, ['repair_manager','reception'], true) ? ($row['customer_province'] ?? '') : '',
        'customerCity' => in_array($role, ['repair_manager','reception'], true) ? ($row['customer_city'] ?? '') : '',
        'customerPostalCode' => in_array($role, ['repair_manager','reception'], true) ? ($row['customer_postal_code'] ?? '') : '',
        'deviceId' => (int) $row['device_id'],
        'deviceType' => $row['device_type_title'],
        'brand' => $row['brand_title'],
        'model' => $row['model_title'],
        'identifier' => $row['identifier_value'] ?? '',
        'color' => $row['color_snapshot'] ?? '',
        'declaredIssue' => $row['declared_issue'],
        'accessories' => is_array($accessories) ? array_values($accessories) : [],
        'appearanceStates' => is_array($appearanceStates) ? array_values($appearanceStates) : [],
        'receptionNotes' => $row['reception_notes'] ?? '',
        'status' => $row['status'],
        'result' => $row['result'] ?? '',
        'operationReport' => $row['operation_report'] ?? '',
        'deliveryAmount' => $row['invoice_total_amount'] === null
            ? (int)($row['delivery_amount'] ?? 0)
            : (int)$row['invoice_total_amount'],
        'deliveredToName' => $row['delivered_to_name'] ?? '',
        'deliveryNotes' => $row['delivery_notes'] ?? '',
        'assignedToUserId' => $row['assigned_to_user_id'] === null ? null : (int) $row['assigned_to_user_id'],
        'assignedToName' => $row['assigned_to_name'] ?? '',
        'createdByName' => $row['created_by_name'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'deliveredAt' => $row['delivered_at'],
        'deliveredByName' => $row['delivered_by_name'] ?? '',
        'promisedAt' => $row['promised_at'] ?? null,
        'dataHandling' => (json_decode((string)($row['customer_consent_json'] ?? '{}'), true)['dataHandling'] ?? 'no_erasure'),
        'events' => $events,
    ];
}

function operations_customer_lookup(PDO $pdo, array $scope, string $mobile): array
{
    operations_require_role($scope, ['repair_manager','reception'], 'مشاهده سابقه مشتری فقط برای مدیر یا پذیرش مجاز است.');
    if (!preg_match('/^09\d{9}$/', $mobile)) throw new TamiranApiException('شماره موبایل مشتری معتبر نیست.');
    $customerStatement = $pdo->prepare('SELECT id,full_name,mobile,secondary_mobile,national_code,province,city,address,postal_code FROM repair_customers WHERE shop_id=:shop AND mobile=:mobile LIMIT 1');
    $customerStatement->execute(['shop'=>$scope['shop_id'],'mobile'=>$mobile]);
    $customer = $customerStatement->fetch();
    if (!is_array($customer)) return ['customer'=>null];
    $devicesStatement = $pdo->prepare(
        "SELECT d.id,d.row_version,d.device_model_id,d.device_type_title,d.brand_title,d.model_title,d.identifier_value,d.color_title,d.last_accepted_at,
                latest.receipt_number,latest.declared_issue,latest.status,latest.updated_at
         FROM repair_customer_devices d
         LEFT JOIN repair_cases latest ON latest.id=(SELECT c.id FROM repair_cases c WHERE c.device_id=d.id AND c.shop_id=:case_shop ORDER BY c.created_at DESC,c.id DESC LIMIT 1)
         WHERE d.shop_id=:device_shop AND d.customer_id=:customer ORDER BY COALESCE(d.last_accepted_at,d.created_at) DESC,d.id DESC"
    );
    $devicesStatement->execute(['case_shop'=>$scope['shop_id'],'device_shop'=>$scope['shop_id'],'customer'=>(int)$customer['id']]);
    $devices = array_map(static fn(array $row): array => [
        'id'=>(int)$row['id'], 'expectedDeviceVersion'=>(int)$row['row_version'], 'deviceModelId'=>$row['device_model_id']===null?null:(int)$row['device_model_id'],
        'deviceType'=>(string)$row['device_type_title'], 'brand'=>(string)$row['brand_title'], 'model'=>(string)$row['model_title'],
        'identifier'=>(string)($row['identifier_value']??''), 'color'=>(string)($row['color_title']??''), 'lastReceipt'=>(string)($row['receipt_number']??''),
        'lastVisit'=>(string)($row['updated_at']??$row['last_accepted_at']??''), 'lastIssue'=>(string)($row['declared_issue']??''),
        'lastStatus'=>$row['status']??null,
    ], $devicesStatement->fetchAll());
    return ['customer'=>[
        'id'=>(int)$customer['id'], 'name'=>(string)$customer['full_name'], 'mobile'=>(string)$customer['mobile'],
        'nationalCode'=>(string)($customer['national_code']??''), 'address'=>(string)($customer['address']??''),
        'province'=>(string)($customer['province']??''), 'city'=>(string)($customer['city']??''), 'postalCode'=>(string)($customer['postal_code']??''),
        'secondaryMobile'=>(string)($customer['secondary_mobile']??''), 'devices'=>$devices,
    ]];
}

function operations_cases(PDO $pdo, array $scope, ?int $caseId = null, int $offset = 0): array
{
    if (($scope['actor']['role'] ?? '') === 'warehouse_keeper') return [];
    $sql = operations_case_select() . ' WHERE c.shop_id = :shop_id AND c.branch_id = :branch_id';
    $params = ['shop_id' => $scope['shop_id'], 'branch_id' => $scope['branch_id']];
    if (in_array((string) ($scope['actor']['role'] ?? ''), ['technician', 'quality_control'], true)) {
        $sql .= ' AND c.assigned_to_user_id = :actor_id';
        $params['actor_id'] = (int) $scope['actor']['id'];
    }
    if ($caseId !== null) {
        $sql .= ' AND c.id = :case_id';
        $params['case_id'] = $caseId;
    }
    $sql .= ' ORDER BY c.updated_at DESC, c.id DESC LIMIT 250 OFFSET '.max(0,$offset);
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    $events = operations_events($pdo, $scope['shop_id'], array_map(static fn (array $row): int => (int) $row['id'], $rows));
    $role = (string) ($scope['actor']['role'] ?? '');
    return array_map(static fn (array $row): array => operations_case_to_api($row, $role, $events[(int) $row['id']] ?? []), $rows);
}

function operations_users(PDO $pdo, array $scope): array
{
    $statement = $pdo->prepare(
        'SELECT u.id, u.display_name, u.role_code, u.is_active FROM tamiran_users u
         INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.branch_id=:branch_id
         WHERE u.shop_id=:shop_id ORDER BY u.is_active DESC, u.display_name'
    );
    $statement->execute(['shop_id' => $scope['shop_id'], 'branch_id' => $scope['branch_id']]);
    return array_map(static fn (array $row): array => [
        'id' => (int) $row['id'], 'displayName' => $row['display_name'], 'role' => $row['role_code'], 'isActive' => (bool) $row['is_active'],
    ], $statement->fetchAll());
}

function operations_inventory(PDO $pdo, array $scope): array
{
    $statement = $pdo->prepare('SELECT * FROM repair_inventory_items WHERE shop_id = :shop_id ORDER BY is_active DESC, title');
    $statement->execute(['shop_id' => $scope['shop_id']]);
    return array_map(static fn (array $row): array => [
        'id'=>(int)$row['id'], 'publicId'=>$row['public_id'], 'code'=>$row['item_code'], 'title'=>$row['title'], 'category'=>$row['category'] ?? '',
        'physicalQuantity'=>(int)$row['physical_quantity'], 'reservedQuantity'=>(int)$row['reserved_quantity'], 'minimumQuantity'=>(int)$row['minimum_quantity'],
        'hotReturnRequired'=>(bool)$row['hot_return_required'], 'isActive'=>(bool)$row['is_active'], 'updatedAt'=>$row['updated_at'],
    ], $statement->fetchAll());
}

function operations_movements(PDO $pdo, array $scope): array
{
    $statement = $pdo->prepare(
        'SELECT m.*, item.item_code, item.title AS item_title, c.receipt_number, u.display_name AS actor_name
         FROM repair_inventory_movements m INNER JOIN repair_inventory_items item ON item.id=m.item_id
         LEFT JOIN repair_cases c ON c.id=m.case_id INNER JOIN tamiran_users u ON u.id=m.actor_user_id
         WHERE m.shop_id=:shop_id AND m.branch_id=:branch_id ORDER BY m.created_at DESC, m.id DESC LIMIT 250'
    );
    $statement->execute(['shop_id'=>$scope['shop_id'], 'branch_id'=>$scope['branch_id']]);
    return array_map(static fn (array $row): array => [
        'id'=>(int)$row['id'], 'publicId'=>$row['public_id'], 'itemId'=>(int)$row['item_id'], 'itemCode'=>$row['item_code'], 'itemTitle'=>$row['item_title'],
        'receiptNumber'=>$row['receipt_number'] ?? '', 'movementType'=>$row['movement_type'], 'quantity'=>(int)$row['quantity'],
        'reference'=>$row['reference_code'] ?? '', 'notes'=>$row['notes'] ?? '', 'actorName'=>$row['actor_name'], 'createdAt'=>$row['created_at'],
    ], $statement->fetchAll());
}

function operations_part_requests(PDO $pdo, array $scope): array
{
    $limitedToActor = in_array((string) ($scope['actor']['role'] ?? ''), ['technician','quality_control'], true);
    $sql =
        'SELECT r.*, c.receipt_number, item.item_code, item.title AS item_title, u.display_name AS requester_name
         FROM repair_part_requests r INNER JOIN repair_cases c ON c.id=r.case_id LEFT JOIN repair_inventory_items item ON item.id=r.item_id
         INNER JOIN tamiran_users u ON u.id=r.requested_by_user_id WHERE r.shop_id=:shop_id AND r.branch_id=:branch_id
         ' . ($limitedToActor ? 'AND r.requested_by_user_id=:actor_id ' : '') . 'ORDER BY r.updated_at DESC, r.id DESC LIMIT 250';
    $statement = $pdo->prepare($sql);
    $params = ['shop_id'=>$scope['shop_id'], 'branch_id'=>$scope['branch_id']];
    if ($limitedToActor) $params['actor_id'] = (int) $scope['actor']['id'];
    $statement->execute($params);
    return array_map(static fn (array $row): array => [
        'id'=>(int)$row['id'], 'publicId'=>$row['public_id'], 'receiptNumber'=>$row['receipt_number'], 'itemCode'=>$row['item_code'] ?? 'خارج از انبار',
        'itemTitle'=>$row['item_title'] ?? 'قطعه خارج از فهرست', 'quantity'=>(int)$row['quantity'], 'requestedByName'=>$row['requester_name'],
        'status'=>$row['status'], 'notes'=>$row['notes'] ?? '', 'createdAt'=>$row['created_at'], 'updatedAt'=>$row['updated_at'],
    ], $statement->fetchAll());
}

function operations_hot_returns(PDO $pdo, array $scope): array
{
    $limitedToActor = in_array((string) ($scope['actor']['role'] ?? ''), ['technician','quality_control'], true);
    $sql =
        'SELECT h.*, c.receipt_number, item.item_code, item.title AS item_title, u.display_name AS technician_name
         FROM repair_hot_returns h INNER JOIN repair_cases c ON c.id=h.case_id INNER JOIN repair_inventory_items item ON item.id=h.item_id
         INNER JOIN tamiran_users u ON u.id=h.technician_user_id WHERE h.shop_id=:shop_id AND h.branch_id=:branch_id
         ' . ($limitedToActor ? 'AND h.technician_user_id=:actor_id ' : '') . 'ORDER BY h.updated_at DESC, h.id DESC LIMIT 250';
    $statement = $pdo->prepare($sql);
    $params = ['shop_id'=>$scope['shop_id'], 'branch_id'=>$scope['branch_id']];
    if ($limitedToActor) $params['actor_id'] = (int) $scope['actor']['id'];
    $statement->execute($params);
    return array_map(static fn (array $row): array => [
        'id'=>(int)$row['id'], 'publicId'=>$row['public_id'], 'receiptNumber'=>$row['receipt_number'], 'itemCode'=>$row['item_code'],
        'itemTitle'=>$row['item_title'], 'technicianName'=>$row['technician_name'], 'quantity'=>(int)$row['quantity'], 'status'=>$row['status'],
        'notes'=>$row['notes'] ?? '', 'createdAt'=>$row['created_at'], 'updatedAt'=>$row['updated_at'],
    ], $statement->fetchAll());
}

/** Dashboard counts cover the full authorized scope, independent of list pages. */
function operations_summary(PDO $pdo, array $scope, bool $inventoryEnabled): array
{
    $role=(string)$scope['actor']['role'];
    $where='c.shop_id=:shop AND c.branch_id=:branch';
    $params=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']];
    if(in_array($role,['technician','quality_control'],true)){
        $where.=' AND c.assigned_to_user_id=:actor';$params['actor']=$scope['actor']['id'];
    }
    if($role==='warehouse_keeper')$where.=' AND 1=0';
    $statement=$pdo->prepare("SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN c.status NOT IN ('delivered','cancelled') THEN 1 ELSE 0 END),0) AS active_cases,
        COALESCE(SUM(CASE WHEN c.status='awaiting_assignment' THEN 1 ELSE 0 END),0) AS awaiting_assignment,
        COALESCE(SUM(CASE WHEN c.status='ready_for_delivery' THEN 1 ELSE 0 END),0) AS ready_for_delivery,
        COALESCE(SUM(CASE WHEN c.status='delivered' AND c.delivered_at>=UTC_DATE() AND c.delivered_at<DATE_ADD(UTC_DATE(),INTERVAL 1 DAY) THEN 1 ELSE 0 END),0) AS delivered_today
        FROM repair_cases c WHERE {$where}");
    $statement->execute($params);$row=$statement->fetch();
    $openHotReturns=0;
    if($inventoryEnabled&&in_array($role,['repair_manager','technician','quality_control','warehouse_keeper'],true)){
        $hotWhere="h.shop_id=:shop AND h.branch_id=:branch AND h.status<>'settled'";
        $hotParams=['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']];
        if(in_array($role,['technician','quality_control'],true)){$hotWhere.=' AND h.technician_user_id=:actor';$hotParams['actor']=$scope['actor']['id'];}
        $hot=$pdo->prepare("SELECT COUNT(*) FROM repair_hot_returns h JOIN repair_cases c ON c.id=h.case_id AND c.shop_id=h.shop_id AND c.branch_id=h.branch_id WHERE {$hotWhere}");
        $hot->execute($hotParams);$openHotReturns=(int)$hot->fetchColumn();
    }
    return ['total'=>(int)$row['total'],'summary'=>[
        'activeCases'=>(int)$row['active_cases'],'awaitingAssignment'=>(int)$row['awaiting_assignment'],
        'readyForDelivery'=>(int)$row['ready_for_delivery'],'deliveredToday'=>(int)$row['delivered_today'],
        'openHotReturns'=>$openHotReturns,
    ]];
}

function operations_snapshot(PDO $pdo, array $scope, int $caseOffset = 0): array
{
    $role = (string) ($scope['actor']['role'] ?? '');
    $manager = $role === 'repair_manager';
    $technical = in_array($role, ['technician','quality_control'], true);
    $warehouse = $role === 'warehouse_keeper';
    $policy = v2_product_policy($pdo,$scope);
    $inventoryEnabled = (bool)($policy['inventoryEnabled'] ?? false);
    $cases = operations_cases($pdo, $scope, null, $caseOffset);
    $counts = operations_summary($pdo,$scope,$inventoryEnabled);
    $hotReturns = $inventoryEnabled && ($manager || $technical || $warehouse) ? operations_hot_returns($pdo, $scope) : [];
    return [
        'summary' => $counts['summary'],
        'casesPage' => ['offset'=>$caseOffset,'limit'=>250,'returned'=>count($cases),'total'=>$counts['total'],'hasMore'=>$caseOffset+count($cases)<$counts['total']],
        'cases' => $cases,
        'users' => in_array($role, ['repair_manager','reception'], true) ? operations_users($pdo, $scope) : [],
        'inventory' => $inventoryEnabled && ($manager || $technical || $warehouse) ? operations_inventory($pdo, $scope) : [],
        'movements' => $inventoryEnabled && ($manager || $warehouse) ? operations_movements($pdo, $scope) : [],
        'partRequests' => $inventoryEnabled && ($manager || $technical || $warehouse) ? operations_part_requests($pdo, $scope) : [],
        'hotReturns' => ($manager || $technical || $warehouse) ? $hotReturns : [],
        'receptionDrafts' => in_array($role,['repair_manager','reception'],true) ? operations_reception_drafts($pdo,$scope) : [],
        'productPolicy' => $policy,
    ];
}

function operations_draft_payload(string $encoded): array
{
    $envelope=json_decode($encoded,true,64,JSON_THROW_ON_ERROR);
    if(is_array($envelope)&&($envelope['format']??null)==='tamiran-draft-v1') {
        $value=json_decode(tamiran_decrypt_secret((string)($envelope['ciphertext']??'')),true,64,JSON_THROW_ON_ERROR);
        if(!is_array($value))throw new TamiranApiException('پیش‌نویس رمزگذاری‌شده معتبر نیست.',409);
        return $value;
    }
    // Import compatibility: existing plaintext drafts are encrypted on the next save.
    return is_array($envelope)?$envelope:[];
}

function operations_reception_drafts(PDO $pdo,array $scope):array
{
    $statement=$pdo->prepare("SELECT public_id,payload_json,idempotency_key,expires_at,created_at,updated_at,row_version FROM repair_reception_drafts WHERE shop_id=:shop AND branch_id=:branch AND created_by_user_id=:actor AND status='active' AND expires_at>NOW() ORDER BY updated_at DESC LIMIT 20");
    $statement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'actor'=>$scope['actor']['id']]);
    return array_map(static fn(array$row):array=>[
        'publicId'=>$row['public_id'],'version'=>(int)$row['row_version'],'payload'=>operations_draft_payload((string)$row['payload_json']),
        'idempotencyKey'=>$row['idempotency_key'],'expiresAt'=>$row['expires_at'],'createdAt'=>$row['created_at'],'updatedAt'=>$row['updated_at'],
    ],$statement->fetchAll());
}

function operations_version(array $input, string $key = 'expectedVersion'): int
{
    if (!isset($input[$key]) || !is_int($input[$key]) || $input[$key] < 0)
        throw new TamiranApiException('نسخه معتبر رکورد الزامی است.', 400);
    return $input[$key];
}

function operations_save_reception_draft(PDO $pdo,array $scope,array $input):array
{
    tamiran_require_csrf();
    operations_require_role($scope,['repair_manager','reception'],'ذخیره پیش‌نویس پذیرش مجاز نیست.');
    $key=operations_required($input,'idempotencyKey',160);
    $expected=operations_version($input);
    $payload=is_array($input['payload']??null)?$input['payload']:[];
    $encoded=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    if(strlen($encoded)>65536)throw new TamiranApiException('حجم پیش‌نویس پذیرش بیش از حد مجاز است.',413);
    $encoded=json_encode(['format'=>'tamiran-draft-v1','ciphertext'=>tamiran_encrypt_secret($encoded)],JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $daysStatement=$pdo->prepare('SELECT reception_draft_days FROM tamiran_data_retention_policies WHERE shop_id=:shop LIMIT 1');
    $daysStatement->execute(['shop'=>$scope['shop_id']]);$days=max(1,min(90,(int)($daysStatement->fetchColumn()?:30)));
    $pdo->beginTransaction();
    try {
        $select=$pdo->prepare('SELECT public_id,branch_id,created_by_user_id,status,row_version,expires_at FROM repair_reception_drafts WHERE shop_id=:shop AND idempotency_key=:idempotency LIMIT 1 FOR UPDATE');
        $select->execute(['shop'=>$scope['shop_id'],'idempotency'=>$key]);$row=$select->fetch();
        if(is_array($row)) {
            if((int)$row['branch_id']!==$scope['branch_id'] || (int)$row['created_by_user_id']!==(int)$scope['actor']['id'])
                throw new TamiranApiException('پیش‌نویس در این حساب و شعبه قابل تغییر نیست.',403);
            if($row['status']!=='active' || strtotime($row['expires_at'])<=time() || (int)$row['row_version']!==$expected)
                throw new TamiranApiException('پیش‌نویس هم‌زمان تغییر کرده یا دیگر فعال نیست؛ تازه‌سازی کنید.',409);
            $public=$row['public_id'];
            $update=$pdo->prepare("UPDATE repair_reception_drafts SET payload_json=:payload,row_version=row_version+1,expires_at=DATE_ADD(NOW(),INTERVAL {$days} DAY),updated_at=NOW() WHERE public_id=:public AND row_version=:version AND status='active'");
            $update->execute(['payload'=>$encoded,'public'=>$public,'version'=>$expected]);
            if($update->rowCount()!==1)throw new TamiranApiException('نسخه پیش‌نویس تغییر کرده است.',409);
        } else {
            if($expected!==0)throw new TamiranApiException('نسخه آغاز پیش‌نویس معتبر نیست.',409);
            $public=tamiran_id();
            $pdo->prepare("INSERT INTO repair_reception_drafts(public_id,shop_id,branch_id,created_by_user_id,payload_json,idempotency_key,status,row_version,expires_at) VALUES(:public,:shop,:branch,:actor,:payload,:idempotency,'active',1,DATE_ADD(NOW(),INTERVAL {$days} DAY))")
                ->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'actor'=>$scope['actor']['id'],'payload'=>$encoded,'idempotency'=>$key]);
        }
        $select=$pdo->prepare('SELECT expires_at,row_version FROM repair_reception_drafts WHERE public_id=:public');$select->execute(['public'=>$public]);$saved=$select->fetch();
        $pdo->commit();
        return ['saved'=>true,'publicId'=>$public,'expiresAt'=>$saved['expires_at'],'version'=>(int)$saved['row_version']];
    } catch(Throwable $error) { if($pdo->inTransaction())$pdo->rollBack();throw $error; }
}

function operations_discard_reception_draft(PDO $pdo,array $scope,array $input):array
{
    tamiran_require_csrf();
    operations_require_role($scope,['repair_manager','reception'],'حذف پیش‌نویس پذیرش مجاز نیست.');
    $public=operations_required($input,'draftPublicId',80);$expected=operations_version($input);
    $statement=$pdo->prepare("UPDATE repair_reception_drafts SET status='discarded',row_version=row_version+1,updated_at=NOW() WHERE public_id=:public AND shop_id=:shop AND branch_id=:branch AND created_by_user_id=:actor AND row_version=:version AND status='active'");
    $statement->execute(['public'=>$public,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'actor'=>$scope['actor']['id'],'version'=>$expected]);
    if($statement->rowCount()!==1)throw new TamiranApiException('پیش‌نویس فعال با این نسخه پیدا نشد؛ تازه‌سازی کنید.',409);
    return['discarded'=>true];
}

function operations_validate_assignee(PDO $pdo, int $shopId, int $branchId, int $userId): array
{
    $statement = $pdo->prepare(
        "SELECT u.id,u.display_name,u.role_code FROM tamiran_users u
         INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.branch_id=:branch_id
         WHERE u.id=:id AND u.shop_id=:shop_id AND u.is_active=1
           AND u.role_code IN ('repair_manager','technician','quality_control') LIMIT 1"
    );
    $statement->execute(['id'=>$userId, 'shop_id'=>$shopId, 'branch_id'=>$branchId]);
    $user = $statement->fetch();
    if (!is_array($user)) throw new TamiranApiException('کاربر مقصد در این تعمیرگاه فعال نیست.', 409);
    return $user;
}

function operations_resolve_initial_assignee(PDO $pdo, array $scope, ?int $requestedId, bool $forceQueue): ?int
{
    if ($requestedId !== null) operations_validate_assignee($pdo, $scope['shop_id'], $scope['branch_id'], $requestedId);

    $policyStatement = $pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='assignment_policy' LIMIT 1");
    $policyStatement->execute(['shop'=>$scope['shop_id']]);
    $policy = json_decode((string)($policyStatement->fetchColumn() ?: ''), true);
    $branchPolicy = is_array($policy) && is_array($policy['branches'] ?? null) && is_array($policy['branches'][(string)$scope['branch_id']] ?? null)
        ? $policy['branches'][(string)$scope['branch_id']]
        : [];
    $autoSingle = !array_key_exists('autoAssignSingleTechnician', $branchPolicy) || !empty($branchPolicy['autoAssignSingleTechnician']);

    $eligibleStatement = $pdo->prepare(
        "SELECT u.id,ub.branch_role_code AS role_code FROM tamiran_users u
         INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.branch_id=:branch AND ub.shop_id=u.shop_id AND ub.is_active=1
         WHERE u.shop_id=:shop AND u.is_active=1 AND ub.branch_role_code='technician'
         ORDER BY u.id"
    );
    $eligibleStatement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $eligible = $eligibleStatement->fetchAll();
    $technicians = array_values(array_filter($eligible, static fn(array $user): bool => $user['role_code'] === 'technician'));

    if ($autoSingle && count($technicians) === 1) return (int)$technicians[0]['id'];
    if ($autoSingle && $technicians === [] && count($eligible) === 1) return (int)$eligible[0]['id'];
    if ($forceQueue) return null;
    if ($requestedId !== null) return $requestedId;

    $defaultId = (int)($branchPolicy['defaultTechnicianId'] ?? 0);
    if ($defaultId > 0) {
        foreach ($eligible as $user) {
            if ((int)$user['id'] === $defaultId) return $defaultId;
        }
        tamiran_log('warning','assignment_default_unavailable',[
            'shop_id'=>$scope['shop_id'],'branch_id'=>$scope['branch_id'],'default_technician_id'=>$defaultId,
        ]);
    }
    return null;
}

function operations_canonical_value(mixed $value): mixed
{
    if (!is_array($value)) return $value;
    if (!array_is_list($value)) ksort($value, SORT_STRING);
    foreach ($value as $key => $child) $value[$key] = operations_canonical_value($child);
    return $value;
}

function operations_replay_case(PDO $pdo, array $scope, string $key, string $fingerprint): ?array
{
    $statement=$pdo->prepare('SELECT id,branch_id,created_by_user_id,reception_request_hash FROM repair_cases WHERE shop_id=:shop AND idempotency_key=:idempotency LIMIT 1');
    $statement->execute(['shop'=>$scope['shop_id'],'idempotency'=>$key]);$row=$statement->fetch();
    if(!is_array($row))return null;
    if((int)$row['branch_id']!==$scope['branch_id'] || (int)$row['created_by_user_id']!==(int)$scope['actor']['id'])
        throw new TamiranApiException('این شناسه پذیرش متعلق به حساب و شعبه جاری نیست.',403);
    if(!is_string($row['reception_request_hash']) || !hash_equals($row['reception_request_hash'],$fingerprint))
        throw new TamiranApiException('شناسه پذیرش قبلاً برای اطلاعات متفاوت استفاده شده است.',409);
    $existing=operations_cases($pdo,$scope,(int)$row['id'])[0]??null;
    if(!is_array($existing))throw new TamiranApiException('پرونده پذیرش قابل بازیابی نیست.',409);
    return ['created'=>false,'replayed'=>true,'repairCase'=>$existing];
}

function operations_create_case(PDO $pdo, array $scope, array $input): array
{
    tamiran_require_csrf();
    operations_require_role($scope, ['repair_manager','reception'], 'ثبت پذیرش فقط برای مدیر تعمیرگاه یا مسئول پذیرش مجاز است.');
    $customerName = operations_required($input, 'customerName', 180);
    $mobile = tamiran_mobile(operations_required($input, 'customerMobile', 20));
    $secondaryMobile = trim((string)($input['secondaryMobile'] ?? '')) === '' ? null : tamiran_mobile((string)$input['secondaryMobile']);
    if ($secondaryMobile === $mobile) $secondaryMobile = null;
    $nationalCode = operations_digits((string)($input['nationalCode'] ?? ''));
    $customerAddress = operations_optional($input['customerAddress'] ?? '', 1000);
    $customerProvince = operations_optional($input['customerProvince'] ?? '', 100);
    $customerCity = operations_optional($input['customerCity'] ?? '', 100);
    $customerPostalCode = operations_digits((string)($input['customerPostalCode'] ?? ''));
    if ($customerPostalCode !== '' && !preg_match('/^\d{10}$/', $customerPostalCode)) throw new TamiranApiException('کد پستی باید ۱۰ رقم باشد.');
    $addressPolicyStatement = $pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='customer_address_policy' LIMIT 1");
    $addressPolicyStatement->execute(['shop'=>$scope['shop_id']]);
    $addressPolicy = json_decode((string)($addressPolicyStatement->fetchColumn() ?: '{}'), true) ?: [];
    if (!empty($addressPolicy['required']) && ($customerProvince === null || $customerCity === null || $customerAddress === null || $customerPostalCode === '')) {
        throw new TamiranApiException('استان، شهر، آدرس و کد پستی مشتری برای این تعمیرگاه الزامی است.');
    }
    if ($nationalCode !== '' && !tamiran_validate_national_code($nationalCode)) throw new TamiranApiException('کد ملی مشتری معتبر نیست.');
    if (!empty($scope['actor']['shop']['nationalCodeRequired']) && $nationalCode === '') throw new TamiranApiException('ثبت کد ملی برای این تعمیرگاه اجباری است.');
    $modelId = (int)($input['deviceModelId'] ?? 0);
    $modelStatement = $pdo->prepare(
        'SELECT m.id, m.title AS model, b.title AS brand, t.title AS type FROM repair_device_models m
         INNER JOIN repair_device_brands b ON b.id=m.brand_id INNER JOIN repair_device_types t ON t.id=b.device_type_id
         WHERE m.id=:id AND t.shop_id=:shop_id AND m.is_active=1 AND b.is_active=1 AND t.is_active=1 LIMIT 1'
    );
    $modelStatement->execute(['id'=>$modelId, 'shop_id'=>$scope['shop_id']]);
    $model = $modelStatement->fetch();
    if (!is_array($model)) throw new TamiranApiException('نوع، برند و مدل باید از فهرست فعال تنظیمات انتخاب شود.', 409);
    $declaredIssue = operations_required($input, 'declaredIssue', 4000);
    $identifier = operations_optional($input['identifier'] ?? '', 180);
    $color = operations_optional($input['color'] ?? '', 80);
    $colorSetting=$pdo->prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=:shop AND setting_key='device_colors' LIMIT 1");
    $colorSetting->execute(['shop'=>$scope['shop_id']]);
    $configuredColors=json_decode((string)($colorSetting->fetchColumn()?:'[]'),true);
    if($color!==null&&is_array($configuredColors)&&$configuredColors!==[]){
        $activeColorNames=[];
        foreach($configuredColors as$configuredColor)if(is_array($configuredColor)&&($configuredColor['active']??true)!==false)$activeColorNames[]=trim((string)($configuredColor['name']??''));
        if(!in_array($color,$activeColorNames,true))throw new TamiranApiException('رنگ دستگاه باید از فهرست فعال تنظیمات انتخاب شود.',409);
    }
    $normalizedIdentifier = $identifier === null ? null : strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $identifier) ?? '');
    $promisedAt = operations_optional($input['promisedAt'] ?? '', 40);
    if ($promisedAt !== null) {
        $parsedPromise = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $promisedAt, new DateTimeZone('UTC'));
        if (!$parsedPromise || $parsedPromise->format('Y-m-d H:i:s') !== $promisedAt) throw new TamiranApiException('موعد وعده‌داده‌شده معتبر نیست.');
    }
    $receptionNotes = operations_optional($input['receptionNotes'] ?? '', 4000);
    $consent = is_array($input['customerConsent'] ?? null) ? $input['customerConsent'] : [];
    $dataHandling = (string)($consent['dataHandling'] ?? '');
    if (!in_array($dataHandling, ['no_erasure','coordinate_first','erase_authorized'], true)) throw new TamiranApiException('انتخاب مجوز حذف اطلاعات دستگاه الزامی است.');
    $accessories = is_array($input['accessories'] ?? null) ? array_values(array_slice(array_filter(array_map(static fn ($value): string => trim((string)$value), $input['accessories'])), 0, 40)) : [];
    $appearanceStates = is_array($input['appearanceStates'] ?? null)
        ? array_values(array_slice(array_unique(array_filter(array_map(static fn($value): ?string => operations_optional($value, 120), $input['appearanceStates']))), 0, 40))
        : [];
    $allowedAppearanceStates = operations_appearance_options($pdo, $scope['shop_id']);
    foreach ($appearanceStates as $appearanceState) {
        if (!in_array($appearanceState, $allowedAppearanceStates, true)) throw new TamiranApiException('وضعیت ظاهری باید از فهرست فعال تنظیمات انتخاب شود.', 409);
    }
    $caseIdempotency=operations_optional($input['idempotencyKey']??($_SERVER['HTTP_X_IDEMPOTENCY_KEY']??''),160);
    if($caseIdempotency===null)$caseIdempotency=hash('sha256',implode('|',[$scope['shop_id'],$scope['actor']['id'],$mobile,$normalizedIdentifier??'',trim((string)($input['declaredIssue']??'')),(string)floor(time()/30)]));
    $fingerprint=hash('sha256',json_encode(operations_canonical_value($input),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    $replay=operations_replay_case($pdo,$scope,$caseIdempotency,$fingerprint);if($replay!==null)return $replay;
    $acceptance=$input['receiptAcceptance']??null;
    if(!is_array($acceptance)||($acceptance['accepted']??false)!==true||!is_string($acceptance['publicId']??null)||!is_string($acceptance['contentSha256']??null)||!preg_match('/^[a-f0-9]{64}$/',$acceptance['contentSha256']))throw new TamiranApiException('پذیرش نسخه نمایش‌داده‌شده شرایط الزامی است.',400);
    $policy=v2_product_policy($pdo,$scope);
    $requestedAssigneeId = isset($input['assignedToUserId']) && (int)$input['assignedToUserId'] > 0 ? (int)$input['assignedToUserId'] : null;
    $assignmentMode = (string)($input['assignmentMode'] ?? 'automatic');
    if (!in_array($assignmentMode, ['automatic','queue'], true)) throw new TamiranApiException('روش تخصیص اولیه معتبر نیست.');
    $assignedId = $policy['assignmentRequired'] ? operations_resolve_initial_assignee($pdo, $scope, $requestedAssigneeId, $assignmentMode === 'queue') : null;

    $pdo->beginTransaction();
    try {
        $draftPublic=trim((string)($input['draftPublicId']??''));
        if($draftPublic!==''){
            $draftVersion=operations_version($input,'draftExpectedVersion');
            $draft=$pdo->prepare('SELECT status,row_version,expires_at FROM repair_reception_drafts WHERE public_id=:public AND shop_id=:shop AND branch_id=:branch AND created_by_user_id=:actor AND idempotency_key=:key LIMIT 1 FOR UPDATE');
            $draft->execute(['public'=>$draftPublic,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'actor'=>$scope['actor']['id'],'key'=>$caseIdempotency]);$draftRow=$draft->fetch();
            if(!is_array($draftRow)||$draftRow['status']!=='active'||strtotime($draftRow['expires_at'])<=time()||(int)$draftRow['row_version']!==$draftVersion)throw new TamiranApiException('پیش‌نویس برای ثبت نهایی فعال یا هم‌نسخه نیست.',409);
        }

        $customerStatement = $pdo->prepare('SELECT id FROM repair_customers WHERE shop_id=:shop_id AND mobile=:mobile LIMIT 1 FOR UPDATE');
        $customerStatement->execute(['shop_id'=>$scope['shop_id'], 'mobile'=>$mobile]);
        $customerId = (int)$customerStatement->fetchColumn();
        if ($customerId > 0) {
            $pdo->prepare('UPDATE repair_customers SET full_name=:name, secondary_mobile=COALESCE(:secondary,secondary_mobile), national_code=COALESCE(:national,national_code), province=COALESCE(:province,province), city=COALESCE(:city,city), address=COALESCE(:address,address), postal_code=COALESCE(:postal,postal_code) WHERE id=:id')->execute([
                'name'=>$customerName, 'secondary'=>$secondaryMobile, 'national'=>$nationalCode ?: null, 'province'=>$customerProvince, 'city'=>$customerCity, 'address'=>$customerAddress, 'postal'=>$customerPostalCode ?: null, 'id'=>$customerId,
            ]);
        } else {
            $pdo->prepare('INSERT INTO repair_customers(public_id,shop_id,full_name,mobile,secondary_mobile,national_code,province,city,address,postal_code) VALUES(:public,:shop,:name,:mobile,:secondary,:national,:province,:city,:address,:postal)')->execute([
                'public'=>tamiran_id(), 'shop'=>$scope['shop_id'], 'name'=>$customerName, 'mobile'=>$mobile, 'secondary'=>$secondaryMobile, 'national'=>$nationalCode ?: null, 'province'=>$customerProvince, 'city'=>$customerCity, 'address'=>$customerAddress, 'postal'=>$customerPostalCode ?: null,
            ]);
            $customerId = (int)$pdo->lastInsertId();
        }

        $previousDeviceId = (int)($input['previousDeviceId'] ?? 0);
        if ($previousDeviceId > 0) {
            $expectedDeviceVersion=operations_version($input,'expectedDeviceVersion');
            $deviceCheck = $pdo->prepare('SELECT id,row_version FROM repair_customer_devices WHERE id=:id AND shop_id=:shop AND customer_id=:customer LIMIT 1 FOR UPDATE');
            $deviceCheck->execute(['id'=>$previousDeviceId, 'shop'=>$scope['shop_id'], 'customer'=>$customerId]);
            $deviceRow=$deviceCheck->fetch();$deviceId=is_array($deviceRow)?(int)$deviceRow['id']:0;
            if(is_array($deviceRow)&&(int)$deviceRow['row_version']!==$expectedDeviceVersion)throw new TamiranApiException('اطلاعات دستگاه هم‌زمان تغییر کرده است؛ سابقه را تازه‌سازی کنید.',409);
            if ($deviceId < 1) throw new TamiranApiException('دستگاه قبلی برای این مشتری معتبر نیست.', 409);
            $pdo->prepare('UPDATE repair_customer_devices SET device_model_id=:model,device_type_title=:type,brand_title=:brand,model_title=:model_title,color_title=:color,identifier_value=COALESCE(:identifier,identifier_value),normalized_identifier=COALESCE(:normalized,normalized_identifier),row_version=row_version+1,last_accepted_at=NOW() WHERE id=:id')->execute([
                'model'=>$modelId, 'type'=>$model['type'], 'brand'=>$model['brand'], 'model_title'=>$model['model'], 'color'=>$color, 'identifier'=>$identifier, 'normalized'=>$normalizedIdentifier, 'id'=>$deviceId,
            ]);
        } else {
            if ($normalizedIdentifier !== null && $normalizedIdentifier !== '') {
                $duplicate = $pdo->prepare('SELECT id,customer_id FROM repair_customer_devices WHERE shop_id=:shop AND normalized_identifier=:identifier LIMIT 1 FOR UPDATE');
                $duplicate->execute(['shop'=>$scope['shop_id'],'identifier'=>$normalizedIdentifier]);
                $existingDevice = $duplicate->fetch();
                if (is_array($existingDevice)) throw new TamiranApiException('این IMEI/سریال قبلاً ثبت شده است؛ همان دستگاه را از سابقه مشتری انتخاب و مالکیت را بررسی کنید.',409);
            }
            $pdo->prepare('INSERT INTO repair_customer_devices(public_id,shop_id,customer_id,device_model_id,device_type_title,brand_title,model_title,color_title,identifier_value,normalized_identifier,ownership_verification_json,details_json,last_accepted_at) VALUES(:public,:shop,:customer,:model,:type,:brand,:model_title,:color,:identifier,:normalized_identifier,:ownership,:details,NOW())')->execute([
                'public'=>tamiran_id(), 'shop'=>$scope['shop_id'], 'customer'=>$customerId, 'model'=>$modelId, 'type'=>$model['type'], 'brand'=>$model['brand'], 'model_title'=>$model['model'],
                'color'=>$color, 'identifier'=>$identifier, 'normalized_identifier'=>$normalizedIdentifier, 'ownership'=>json_encode(new stdClass(), JSON_UNESCAPED_UNICODE),
                'details'=>json_encode(new stdClass(), JSON_UNESCAPED_UNICODE),
            ]);
            $deviceId = (int)$pdo->lastInsertId();
        }

        $counter = $pdo->prepare('SELECT public_shop_code,receipt_counter FROM repair_shops WHERE id=:shop FOR UPDATE');
        $counter->execute(['shop'=>$scope['shop_id']]);
        $counterRow = $counter->fetch();
        if (!is_array($counterRow) || !preg_match('/^\d{6}$/', (string)$counterRow['public_shop_code'])) {
            throw new TamiranApiException('کد عمومی شش‌رقمی تعمیرگاه آماده نیست؛ Patch نسخه Beta 4 را اجرا کنید.', 503);
        }
        $nextNumber = (int)$counterRow['receipt_counter'] + 1;
        $pdo->prepare('UPDATE repair_shops SET receipt_counter=:number WHERE id=:shop')->execute(['number'=>$nextNumber,'shop'=>$scope['shop_id']]);
        $receiptNumber = (string)$counterRow['public_shop_code'] . '-' . str_pad((string)$nextNumber, 6, '0', STR_PAD_LEFT);
        $caseUuid = tamiran_uuid_v7();
        $trackingToken = tamiran_tracking_token();
        $trackingTokenHash = hash('sha256', $trackingToken);
        $status = $policy['profile']==='solo' ? 'diagnosing' : ($assignedId === null ? 'awaiting_assignment' : 'assigned');
        $pdo->prepare('INSERT INTO repair_cases(public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,public_receipt_no,receipt_number,tracking_token_hash,tracking_token_ciphertext,product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,feature_flags_snapshot_json,idempotency_key,reception_request_hash,device_type_snapshot,brand_snapshot,model_snapshot,color_snapshot,identifier_snapshot,declared_issue,accessories_json,appearance_states_json,reception_notes,status,assigned_to_user_id,created_by_user_id) VALUES(:public,:case_uuid,:shop,:branch,:customer,:device,:receipt_sequence,:public_receipt,:receipt,:tracking_hash,:tracking_ciphertext,:product_profile,:inventory_mode,:qc_mode,:feature_flags,:idempotency,:request_hash,:device_type,:brand,:model_title,:color,:identifier_snapshot,:issue,:accessories,:appearance,:notes,:status,:assignee,:creator)')->execute([
            'public'=>tamiran_id(), 'case_uuid'=>$caseUuid, 'shop'=>$scope['shop_id'], 'branch'=>$scope['branch_id'], 'customer'=>$customerId, 'device'=>$deviceId,
            'receipt_sequence'=>$nextNumber, 'public_receipt'=>$receiptNumber, 'receipt'=>$receiptNumber,
            'tracking_hash'=>$trackingTokenHash, 'tracking_ciphertext'=>tamiran_encrypt_secret($trackingToken),
            'product_profile'=>$policy['profile'],'inventory_mode'=>$policy['inventoryMode'],'qc_mode'=>$policy['qcMode'],'feature_flags'=>json_encode($scope['feature_flags'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),'idempotency'=>$caseIdempotency,'request_hash'=>$fingerprint,
            'device_type'=>$model['type'], 'brand'=>$model['brand'], 'model_title'=>$model['model'], 'color'=>$color, 'identifier_snapshot'=>$identifier,
            'issue'=>$declaredIssue, 'accessories'=>json_encode($accessories, JSON_UNESCAPED_UNICODE), 'appearance'=>json_encode($appearanceStates, JSON_UNESCAPED_UNICODE), 'notes'=>$receptionNotes,
            'status'=>$status, 'assignee'=>$assignedId, 'creator'=>(int)$scope['actor']['id'],
        ]);
        $caseId = (int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO repair_portal_tokens(public_id,shop_id,case_id,token_hash,expires_at,created_by_user_id) VALUES(:public,:shop,:case,:hash,DATE_ADD(NOW(),INTERVAL 400 DAY),:actor)")->execute([
            'public'=>tamiran_id(),'shop'=>$scope['shop_id'],'case'=>$caseId,'hash'=>$trackingTokenHash,'actor'=>(int)$scope['actor']['id'],
        ]);
        $term=$pdo->prepare('SELECT id,public_id,title,body_text,content_sha256 FROM repair_receipt_term_versions WHERE shop_id=:shop AND is_active=1 AND effective_from<=NOW() AND (effective_to IS NULL OR effective_to>NOW()) ORDER BY version_number DESC LIMIT 1 FOR UPDATE');
        $term->execute(['shop'=>$scope['shop_id']]);
        $termRow=$term->fetch();
        if(!is_array($termRow))throw new TamiranApiException('نسخه فعال شرایط پذیرش تنظیم نشده است.',409);
        if(!hash_equals((string)$termRow['public_id'],$acceptance['publicId'])||!hash_equals((string)$termRow['content_sha256'],$acceptance['contentSha256'])||!hash_equals((string)$termRow['content_sha256'],hash('sha256',(string)$termRow['body_text'])))throw new TamiranApiException('شرایط پذیرش تغییر کرده است؛ متن فعال را دوباره تأیید کنید.',409);
        $acceptanceMethod=(string)($consent['acceptanceMethod']??'recorded_consent');
        if($acceptanceMethod==='sms_otp')throw new TamiranApiException('پذیرش پیامکی بدون تأیید مستقل OTP مجاز نیست.',409);
        if(!in_array($acceptanceMethod,['digital_signature','in_person_signature','recorded_consent'],true))throw new TamiranApiException('روش پذیرش شرایط معتبر نیست.');
        $pdo->prepare('INSERT INTO repair_case_receipt_terms(public_id,case_id,term_version_id,accepted_by_name,acceptance_method,evidence_json) VALUES(:public,:case,:term,:name,:method,:evidence)')->execute([
            'public'=>tamiran_id(),'case'=>$caseId,'term'=>$termRow['id'],'name'=>$customerName,'method'=>$acceptanceMethod,
            'evidence'=>json_encode(['termTitle'=>$termRow['title'],'contentSha256'=>$termRow['content_sha256'],'details'=>$consent['evidence']??new stdClass()],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
        ]);
        $workflowCode = preg_match('/(کامپیوتر|رایانه|لپ.?تاپ|computer|laptop)/iu', (string)$model['type']) ? 'computer_laptop' : 'mobile_tablet';
        $processStatus = $policy['profile']==='solo' ? 'diagnosing' : ($assignedId === null ? 'awaiting_assignment' : 'assigned');
        $temporarySecret = trim((string)($input['temporaryDeviceSecret'] ?? ''));
        if (strlen($temporarySecret) > 500) throw new TamiranApiException('رمز موقت دستگاه بیش از حد طولانی است.');
        $workflowPublicId = tamiran_id();
        $pdo->prepare('INSERT INTO repair_case_workflows(public_id,shop_id,branch_id,case_id,workflow_code,process_status,primary_technician_user_id,preapproved_amount,diagnostic_fee_policy_json,customer_consent_json,promised_at,temporary_device_secret_ciphertext,temporary_secret_expires_at) VALUES(:public,:shop,:branch,:case,:workflow,:status,:technician,:preapproved,:diagnostic,:consent,:promised,:secret,:secret_expires)')->execute([
            'public'=>$workflowPublicId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId,'workflow'=>$workflowCode,'status'=>$processStatus,
            'technician'=>$assignedId,'preapproved'=>max(0,(int)($input['preapprovedAmount']??0)),
            'diagnostic'=>json_encode(is_array($input['diagnosticFeePolicy']??null)?$input['diagnosticFeePolicy']:['source'=>'shop_service_policy'],JSON_UNESCAPED_UNICODE),
            'consent'=>json_encode($consent,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
            'promised'=>$promisedAt,
            'secret'=>$temporarySecret === '' ? null : tamiran_encrypt_secret($temporarySecret),
            'secret_expires'=>$temporarySecret === '' ? null : date('Y-m-d H:i:s', time()+7*86400),
        ]);
        $workflowId=(int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO repair_case_stage_events(public_id,workflow_id,from_status,to_status,actor_user_id,reason,metadata_json,idempotency_key,started_at) VALUES(:public,:workflow,NULL,:status,:actor,:reason,:metadata,:idempotency,NOW())')->execute([
            'public'=>tamiran_id(),'workflow'=>$workflowId,'status'=>$processStatus,'actor'=>(int)$scope['actor']['id'],'reason'=>'ثبت پذیرش نسخه ۲.۰','metadata'=>json_encode(['receiptNumber'=>$receiptNumber,'productProfile'=>$policy['profile']],JSON_UNESCAPED_UNICODE),'idempotency'=>'case-create:'.$caseIdempotency,
        ]);
        if ($assignedId !== null) {
            $pdo->prepare("INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,created_by_user_id,started_at,accepted_at) VALUES(:public,:workflow,:technician,'primary','مسئول اصلی تعمیر',:creator,NOW(),NOW())")
                ->execute(['public'=>tamiran_id(),'workflow'=>$workflowId,'technician'=>$assignedId,'creator'=>(int)$scope['actor']['id']]);
        }
        $pdo->prepare('UPDATE repair_device_models SET usage_count=usage_count+1 WHERE id=:id')->execute(['id'=>$modelId]);
        $description = $policy['profile']==='solo' ? 'پذیرش سبک ثبت شد و پرونده وارد بررسی شد.' : ($assignedId === null ? 'پذیرش ثبت شد و پرونده در انتظار تخصیص قرار گرفت.' : 'پذیرش ثبت و پرونده به کاربر منتخب ارجاع شد.');
        $pdo->prepare('INSERT INTO repair_case_events(case_id,actor_user_id,event_type,from_status,to_status,description,metadata_json) VALUES(:case,:actor,:type,NULL,:status,:description,:metadata)')->execute([
            'case'=>$caseId, 'actor'=>(int)$scope['actor']['id'], 'type'=>'case_created', 'status'=>$status, 'description'=>$description,
            'metadata'=>json_encode(['receiptNumber'=>$receiptNumber,'assignedToUserId'=>$assignedId], JSON_UNESCAPED_UNICODE),
        ]);
        if($draftPublic!==''){
            $draftUpdate=$pdo->prepare("UPDATE repair_reception_drafts SET status='submitted',submitted_case_id=:case,row_version=row_version+1,updated_at=NOW() WHERE public_id=:public AND shop_id=:shop AND branch_id=:branch AND created_by_user_id=:actor AND row_version=:version AND status='active'");
            $draftUpdate->execute(['case'=>$caseId,'public'=>$draftPublic,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'actor'=>$scope['actor']['id'],'version'=>$draftVersion]);
            if($draftUpdate->rowCount()!==1)throw new TamiranApiException('نسخه پیش‌نویس هنگام ثبت تغییر کرد.',409);
        }
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],(int)$scope['actor']['id'],'case.create','repair_case',(string)$caseId,null,['receiptNumber'=>$receiptNumber,'requestHash'=>$fingerprint]);
        $pdo->commit();
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if($error->getCode()==='23000'){$replay=operations_replay_case($pdo,$scope,$caseIdempotency,$fingerprint);if($replay!==null)return $replay;}
        throw $error;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    $case = operations_cases($pdo, $scope, $caseId)[0] ?? null;
    if (!is_array($case)) throw new TamiranApiException('پرونده ثبت شد اما بازیابی آن انجام نشد.', 500);
    tamiran_log('info','repair_case_created',['receipt_number'=>$receiptNumber,'shop_code'=>$scope['shop_code'],'actor'=>$scope['actor']['displayName']]);
    return ['created'=>true,'repairCase'=>$case];
}

function operations_update_case(PDO $pdo, array $scope, array $input): array
{
    tamiran_require_csrf();
    $id = (int)($input['id'] ?? 0);
    $currentStatement = $pdo->prepare('SELECT * FROM repair_cases WHERE id=:id AND shop_id=:shop AND branch_id=:branch LIMIT 1');
    $currentStatement->execute(['id'=>$id,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $current = $currentStatement->fetch();
    if (!is_array($current)) throw new TamiranApiException('پرونده پیدا نشد.',404);
    if(operations_version($input)!==(int)$current['row_version'])throw new TamiranApiException('نسخه پرونده تغییر کرده است؛ تازه‌سازی کنید.',409);
    if (array_key_exists('status',$input) || array_key_exists('assignedToUserId',$input)) {
        $workflowCheck=$pdo->prepare('SELECT id FROM repair_case_workflows WHERE case_id=:case LIMIT 1');
        $workflowCheck->execute(['case'=>$id]);
        if ($workflowCheck->fetchColumn() !== false) throw new TamiranApiException('تغییر مرحله یا مسئول پرونده نسخه ۲ فقط از گردش کار و تحویل رسمی مجاز است.',409);
    }
    $role = (string) ($scope['actor']['role'] ?? '');
    operations_require_role($scope, ['repair_manager','reception','technician','quality_control'], 'نقش فعلی اجازه تغییر پرونده را ندارد.');
    if (in_array($role, ['technician','quality_control'], true) && (int) ($current['assigned_to_user_id'] ?? 0) !== (int) $scope['actor']['id']) {
        throw new TamiranApiException('این پرونده به شما ارجاع نشده است.', 403);
    }
    if ($role === 'reception' && (array_key_exists('result', $input) || array_key_exists('operationReport', $input))) {
        throw new TamiranApiException('ثبت نتیجه و گزارش عملیات برای نقش پذیرش مجاز نیست.', 403);
    }
    if (in_array($role, ['technician','quality_control'], true) && array_key_exists('assignedToUserId', $input)) {
        throw new TamiranApiException('تغییر مسئول پرونده فقط برای مدیر یا پذیرش مجاز است.', 403);
    }
    if (in_array($role, ['technician','quality_control'], true)
        && (array_key_exists('deliveryAmount', $input) || array_key_exists('deliveredToName', $input) || array_key_exists('deliveryNotes', $input))) {
        throw new TamiranApiException('ویرایش اطلاعات مالی و تحویل برای کارتابل فنی مجاز نیست.', 403);
    }
    $newStatus = array_key_exists('status',$input) ? (string)$input['status'] : (string)$current['status'];
    if (!in_array($newStatus,TAMIRAN_CASE_STATUSES,true)) throw new TamiranApiException('وضعیت پرونده معتبر نیست.');
    $transitions = [
        'awaiting_assignment'=>['assigned','cancelled'], 'assigned'=>['diagnosing','returned','cancelled'], 'diagnosing'=>['repairing','awaiting_part','awaiting_customer','ready_for_delivery','cancelled'],
        'repairing'=>['awaiting_part','awaiting_customer','ready_for_delivery','cancelled'], 'awaiting_part'=>['repairing','ready_for_delivery','cancelled'],
        'awaiting_customer'=>['repairing','ready_for_delivery','cancelled'], 'ready_for_delivery'=>['delivered','returned'], 'returned'=>['assigned','diagnosing'], 'delivered'=>[], 'cancelled'=>[],
    ];
    if ($newStatus !== $current['status'] && !in_array($newStatus,$transitions[$current['status']] ?? [],true)) throw new TamiranApiException('این تغییر وضعیت برای پرونده مجاز نیست.',409);
    if ($role === 'reception' && $newStatus !== $current['status'] && !in_array($newStatus, ['assigned','delivered','returned','cancelled'], true)) {
        throw new TamiranApiException('این تغییر وضعیت در دسترسی پذیرش مجاز نیست.', 403);
    }
    if (in_array($role, ['technician','quality_control'], true) && $newStatus !== $current['status'] && !in_array($newStatus, ['diagnosing','repairing','awaiting_part','awaiting_customer','ready_for_delivery'], true)) {
        throw new TamiranApiException('این تغییر وضعیت در کارتابل فنی مجاز نیست.', 403);
    }
    $assignedId = array_key_exists('assignedToUserId',$input) ? ((int)$input['assignedToUserId'] ?: null) : ($current['assigned_to_user_id'] === null ? null : (int)$current['assigned_to_user_id']);
    if ($assignedId !== null) operations_validate_assignee($pdo,$scope['shop_id'],$scope['branch_id'],$assignedId);
    if ($newStatus === 'awaiting_assignment' && $assignedId !== null) $newStatus='assigned';
    if($newStatus!==$current['status']) {
        $guard=$pdo->prepare('SELECT id FROM repair_case_workflows WHERE case_id=:case LIMIT 1');$guard->execute(['case'=>$id]);
        if($guard->fetchColumn()!==false)throw new TamiranApiException('تغییر مرحله پرونده نسخه ۲ فقط از موتور فرایند مجاز است.',409);
    }
    $result = trim((string)($input['result'] ?? $current['result'] ?? '')) ?: null;
    if ($result !== null && !in_array($result,['repaired','not_repaired'],true)) throw new TamiranApiException('نتیجه تعمیر معتبر نیست.');
    $report = trim((string)($input['operationReport'] ?? $current['operation_report'] ?? '')) ?: null;
    if ($report !== null && (function_exists('mb_strlen') ? mb_strlen($report) : strlen($report)) > 12000) throw new TamiranApiException('گزارش عملیات بیش از حد طولانی است.');
    if ($newStatus === 'ready_for_delivery' && ($result === null || $report === null)) throw new TamiranApiException('نتیجه و گزارش عملیات برای ارسال به تحویل الزامی است.',409);
    $deliveryAmount = array_key_exists('deliveryAmount',$input) ? max(0,(int)$input['deliveryAmount']) : (int)($current['delivery_amount'] ?? 0);
    $deliveredToName = operations_optional($input['deliveredToName'] ?? ($current['delivered_to_name'] ?? ''), 180);
    $deliveryNotes = operations_optional($input['deliveryNotes'] ?? ($current['delivery_notes'] ?? ''), 4000);
    if ($newStatus === 'delivered' && !in_array($role,['repair_manager','reception'],true)) throw new TamiranApiException('ثبت تحویل فقط برای مدیر یا پذیرش مجاز است.',403);
    if ($newStatus === 'delivered' && $deliveredToName === null) throw new TamiranApiException('نام تحویل‌گیرنده الزامی است.');
    $description = operations_optional($input['reason'] ?? '', 1000) ?? ($newStatus !== $current['status'] ? 'وضعیت پرونده تغییر کرد.' : 'مسئول یا اطلاعات عملیاتی پرونده به‌روزرسانی شد.');
    if ($newStatus === 'delivered') {
        $description = 'دستگاه به '.$deliveredToName.' تحویل شد. مبلغ نهایی: '.number_format($deliveryAmount).' ریال.' . ($deliveryNotes ? ' توضیحات: '.$deliveryNotes : '');
    }

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare('UPDATE repair_cases SET status=:status,assigned_to_user_id=:assignee,result=:result,operation_report=:report,delivery_amount=:delivery_amount,delivered_to_name=:delivered_to,delivery_notes=:delivery_notes,delivered_by_user_id=:deliverer,delivered_at=:delivered,row_version=row_version+1 WHERE id=:id AND row_version=:row_version');
        $update->execute([
            'status'=>$newStatus,'assignee'=>$assignedId,'result'=>$result,'report'=>$report,
            'delivery_amount'=>$deliveryAmount,'delivered_to'=>$deliveredToName,'delivery_notes'=>$deliveryNotes,
            'deliverer'=>$newStatus==='delivered'?(int)$scope['actor']['id']:$current['delivered_by_user_id'],
            'delivered'=>$newStatus==='delivered'?date('Y-m-d H:i:s'):$current['delivered_at'],'id'=>$id,'row_version'=>(int)($current['row_version']??0),
        ]);
        if ($update->rowCount() !== 1) throw new TamiranApiException('پرونده هم‌زمان توسط کاربر دیگری تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.',409);
        $pdo->prepare('INSERT INTO repair_case_events(case_id,actor_user_id,event_type,from_status,to_status,description,metadata_json) VALUES(:case,:actor,:type,:from_status,:to_status,:description,:metadata)')->execute([
            'case'=>$id,'actor'=>(int)$scope['actor']['id'],'type'=>$newStatus!==$current['status']?'status_changed':'case_updated',
            'from_status'=>$current['status'],'to_status'=>$newStatus,'description'=>$description,
            'metadata'=>json_encode(['assignedToUserId'=>$assignedId,'result'=>$result,'deliveryAmount'=>$deliveryAmount,'deliveredToName'=>$newStatus==='delivered'?$deliveredToName:null],JSON_UNESCAPED_UNICODE),
        ]);
        tamiran_audit($pdo,$scope['shop_id'],$scope['branch_id'],(int)$scope['actor']['id'],'case.update','repair_case',(string)$id,['version'=>$current['row_version'],'status'=>$current['status']],['version'=>(int)$current['row_version']+1,'status'=>$newStatus]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    $case = operations_cases($pdo,$scope,$id)[0] ?? null;
    return ['updated'=>true,'repairCase'=>$case];
}

function operations_create_inventory_item(PDO $pdo, array $scope, array $input): array
{
    tamiran_require_csrf();
    operations_require_role($scope, ['repair_manager'], 'تعریف کالا فقط برای مدیر تعمیرگاه مجاز است.');
    v2_require_capability(v2_product_policy($pdo,$scope),'inventoryEnabled','ماژول انبار برای این تعمیرگاه فعال نیست.');
    $code = operations_required($input,'code',80);
    $title = operations_required($input,'title',180);
    $category = operations_optional($input['category'] ?? '', 120);
    $physical = max(0,(int)($input['physicalQuantity'] ?? 0));
    $minimum = max(0,(int)($input['minimumQuantity'] ?? 0));
    $hot = !empty($input['hotReturnRequired']) ? 1 : 0;
    $publicId = tamiran_id();
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('INSERT INTO repair_inventory_items(public_id,shop_id,item_code,title,category,physical_quantity,reserved_quantity,minimum_quantity,hot_return_required,hot_evidence_rules_json,is_active) VALUES(:public,:shop,:code,:title,:category,:physical,0,:minimum,:hot,:hot_rules,1)');
        $statement->execute(['public'=>$publicId,'shop'=>$scope['shop_id'],'code'=>$code,'title'=>$title,'category'=>$category,'physical'=>$physical,'minimum'=>$minimum,'hot'=>$hot,'hot_rules'=>json_encode(is_array($input['hotEvidenceRules']??null)?$input['hotEvidenceRules']:['serial'=>false,'image'=>false,'condition'=>true],JSON_UNESCAPED_UNICODE)]);
        $itemId = (int)$pdo->lastInsertId();
        $warehouse=$pdo->prepare('SELECT id FROM repair_warehouses WHERE shop_id=:shop AND branch_id=:branch AND is_main=1 AND is_active=1 LIMIT 1 FOR UPDATE');
        $warehouse->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
        $warehouseId=(int)$warehouse->fetchColumn();
        if($warehouseId<1) throw new TamiranApiException('انبار اصلی شعبه تعریف نشده است.',409);
        $pdo->prepare('INSERT INTO repair_branch_stock(shop_id,branch_id,warehouse_id,item_id,physical_quantity,reserved_quantity,average_unit_cost) VALUES(:shop,:branch,:warehouse,:item,:physical,0,:cost)')->execute([
            'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'warehouse'=>$warehouseId,'item'=>$itemId,'physical'=>$physical,'cost'=>max(0,(int)($input['purchasePrice']??0)),
        ]);
        if ($physical > 0) {
            $movement = $pdo->prepare("INSERT INTO repair_inventory_movements(public_id,shop_id,branch_id,item_id,case_id,movement_type,quantity,reference_code,notes,actor_user_id) VALUES(:public,:shop,:branch,:item,NULL,'in',:quantity,:reference,:notes,:actor)");
            $movement->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'item'=>$itemId,'quantity'=>$physical,'reference'=>'INITIAL-'.$publicId,'notes'=>'موجودی اولیه هنگام تعریف کالا ثبت شد.','actor'=>(int)$scope['actor']['id']]);
            $pdo->prepare("INSERT INTO repair_inventory_ledger(public_id,shop_id,branch_id,warehouse_id,item_id,case_id,movement_type,physical_delta,reserved_delta,unit_cost,balance_physical,balance_reserved,reference_type,reference_public_id,reason,actor_user_id) VALUES(:public,:shop,:branch,:warehouse,:item,NULL,'receipt',:physical,0,:cost,:balance,0,'initial_stock',:reference,:reason,:actor)")->execute([
                'public'=>tamiran_id(),'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'warehouse'=>$warehouseId,'item'=>$itemId,'physical'=>$physical,
                'cost'=>max(0,(int)($input['purchasePrice']??0)),'balance'=>$physical,'reference'=>$publicId,'reason'=>'ثبت موجودی اولیه','actor'=>(int)$scope['actor']['id'],
            ]);
        }
        $pdo->commit();
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($error->getCode()==='23000') throw new TamiranApiException('کد کالا در این تعمیرگاه تکراری است.',409);
        throw $error;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    tamiran_log('info','inventory_item_created',['item_code'=>$code,'shop_code'=>$scope['shop_code'],'actor'=>$scope['actor']['displayName']]);
    return ['created'=>true];
}

function operations_create_part_request(PDO $pdo, array $scope, array $input): array
{
    tamiran_require_csrf();
    operations_require_role($scope, ['repair_manager','technician','quality_control'], 'ثبت درخواست قطعه برای نقش فعلی مجاز نیست.');
    v2_require_capability(v2_product_policy($pdo,$scope),'inventoryEnabled','ماژول انبار برای این تعمیرگاه فعال نیست.');
    $caseId = (int)($input['caseId'] ?? 0);
    $itemId = (int)($input['itemId'] ?? 0);
    $quantity = max(1,(int)($input['quantity'] ?? 1));
    $notes = operations_optional($input['notes'] ?? '', 2000);
    $caseStatement = $pdo->prepare("SELECT id,status,assigned_to_user_id FROM repair_cases WHERE id=:id AND shop_id=:shop AND branch_id=:branch AND status NOT IN ('delivered','cancelled') LIMIT 1");
    $caseStatement->execute(['id'=>$caseId,'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id']]);
    $case = $caseStatement->fetch();
    if (!is_array($case)) throw new TamiranApiException('پرونده فعال پیدا نشد.',404);
    if (in_array((string) $scope['actor']['role'], ['technician','quality_control'], true) && (int) ($case['assigned_to_user_id'] ?? 0) !== (int) $scope['actor']['id']) {
        throw new TamiranApiException('درخواست قطعه فقط برای پرونده ارجاع‌شده به شما مجاز است.', 403);
    }
    $itemStatement = $pdo->prepare('SELECT id,title FROM repair_inventory_items WHERE id=:id AND shop_id=:shop AND is_active=1 LIMIT 1');
    $itemStatement->execute(['id'=>$itemId,'shop'=>$scope['shop_id']]);
    $item = $itemStatement->fetch();
    if (!is_array($item)) throw new TamiranApiException('کالای فعال انبار پیدا نشد.',404);
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare("INSERT INTO repair_part_requests(public_id,shop_id,branch_id,case_id,item_id,requested_by_user_id,quantity,status,notes) VALUES(:public,:shop,:branch,:case,:item,:actor,:quantity,'pending',:notes)");
        $statement->execute(['public'=>tamiran_id(),'shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'case'=>$caseId,'item'=>$itemId,'actor'=>(int)$scope['actor']['id'],'quantity'=>$quantity,'notes'=>$notes]);
        $event = $pdo->prepare('INSERT INTO repair_case_events(case_id,actor_user_id,event_type,from_status,to_status,description,metadata_json) VALUES(:case,:actor,:type,:from_status,:to_status,:description,:metadata)');
        $event->execute(['case'=>$caseId,'actor'=>(int)$scope['actor']['id'],'type'=>'part_requested','from_status'=>$case['status'],'to_status'=>$case['status'],'description'=>'درخواست قطعه ثبت شد: '.$item['title'],'metadata'=>json_encode(['itemId'=>$itemId,'quantity'=>$quantity],JSON_UNESCAPED_UNICODE)]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    tamiran_log('info','part_request_created',['case_id'=>$caseId,'item_id'=>$itemId,'actor'=>$scope['actor']['displayName']]);
    return ['created'=>true];
}

tamiran_api(static function (): array {
    $pdo = tamiran_db();
    $scope = operations_scope($pdo);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        $customerMobile = operations_digits((string)($_GET['customerMobile'] ?? ''));
        if ($customerMobile !== '') return operations_customer_lookup($pdo,$scope,$customerMobile);
        $receipt = trim((string)($_GET['receipt'] ?? ''));
        if ($receipt !== '') {
            $normalizedReceipt = operations_digits($receipt);
            $statement = $pdo->prepare('SELECT id FROM repair_cases WHERE shop_id=:shop AND branch_id=:branch AND (REPLACE(public_receipt_no,\'-\',\'\')=:receipt OR receipt_sequence=:sequence) LIMIT 1');
            $statement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'receipt'=>$normalizedReceipt,'sequence'=>(int)$normalizedReceipt]);
            $caseId = (int)$statement->fetchColumn();
            if ($caseId < 1) throw new TamiranApiException('رسید پیدا نشد.',404);
            $visibleCase = operations_cases($pdo,$scope,$caseId)[0] ?? null;
            if (!is_array($visibleCase)) throw new TamiranApiException('این پرونده به حساب شما ارجاع نشده است.',403);
            return ['repairCase'=>$visibleCase];
        }
        $offset=$_GET['caseOffset']??'0';
        if(!is_string($offset)||!preg_match('/^(0|[1-9][0-9]{0,6})$/',$offset))throw new TamiranApiException('شماره صفحه پرونده‌ها معتبر نیست.',400);
        return operations_snapshot($pdo,$scope,(int)$offset);
    }
    tamiran_require_writable_actor($scope['actor']);
    $input = tamiran_json_body();
    if ($method === 'POST' && ($input['action'] ?? '') === 'create_case') return operations_create_case($pdo,$scope,$input);
    if ($method === 'POST' && ($input['action'] ?? '') === 'save_reception_draft') return operations_save_reception_draft($pdo,$scope,$input);
    if ($method === 'POST' && ($input['action'] ?? '') === 'discard_reception_draft') return operations_discard_reception_draft($pdo,$scope,$input);
    if ($method === 'POST' && ($input['action'] ?? '') === 'create_inventory_item') return operations_create_inventory_item($pdo,$scope,$input);
    if ($method === 'POST' && ($input['action'] ?? '') === 'create_part_request') return operations_create_part_request($pdo,$scope,$input);
    if ($method === 'PATCH') return operations_update_case($pdo,$scope,$input);
    throw new TamiranApiException('روش درخواست مجاز نیست.',405);
});
