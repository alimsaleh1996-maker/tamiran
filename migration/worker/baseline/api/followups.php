<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function followup_role_to_fa(string $role): string
{
    return match ($role) {
        'technician' => 'تکنسین',
        'reception' => 'پذیرش',
        'quality_control' => 'کنترل کیفیت',
        default => 'مدیر تعمیرگاه',
    };
}

function followup_status_to_fa(string $status): string
{
    return match ($status) {
        'new' => 'جدید',
        'seen' => 'دیده‌شده',
        'in_progress' => 'در حال پیگیری',
        'done' => 'انجام‌شده',
        default => $status,
    };
}

function followup_required(array $input, string $key, int $maxLength): string
{
    $value = trim((string) ($input[$key] ?? ''));
    if ($value === '') throw new TamiranApiException("فیلد {$key} الزامی است.");
    $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    if ($length > $maxLength) throw new TamiranApiException("فیلد {$key} بیش از حد طولانی است.");
    return $value;
}

function followup_due_at(string $label): ?string
{
    $now = new DateTimeImmutable('now');
    return match ($label) {
        'تا ۲ ساعت آینده' => $now->modify('+2 hours')->format('Y-m-d H:i:s'),
        'امروز تا ساعت ۱۶:۰۰' => $now->setTime(16, 0)->format('Y-m-d H:i:s'),
        'قبل از شروع تعمیر', 'قبل از تحویل مشتری' => $now->modify('+1 day')->format('Y-m-d H:i:s'),
        default => null,
    };
}

function followup_due_label(mixed $value): string
{
    $label = trim((string) $value);
    if (!in_array($label, ['تا ۲ ساعت آینده','امروز تا ساعت ۱۶:۰۰','قبل از شروع تعمیر','قبل از تحویل مشتری'], true)) {
        throw new TamiranApiException('زمان یادآوری معتبر نیست.');
    }
    return $label;
}

function followup_scope(PDO $pdo): array
{
    $actor = tamiran_require_actor();
    if (($actor['role'] ?? '') === 'central_admin' || !is_array($actor['shop'] ?? null)) {
        throw new TamiranApiException('پیگیری مشتری فقط از فضای همان تعمیرگاه قابل انجام است.', 403);
    }
    $shopId = (int) $actor['shop']['id'];
    if (!is_array($actor['branch'] ?? null)) throw new TamiranApiException('شعبه نشست معتبر نیست؛ دوباره وارد سامانه شوید.', 401);
    $statement = $pdo->prepare(
        'SELECT b.id, b.branch_code FROM repair_branches b
         INNER JOIN tamiran_user_branches ub ON ub.branch_id=b.id AND ub.user_id=:user
         WHERE b.id=:branch AND b.shop_id=:shop AND b.is_active=1 LIMIT 1'
    );
    $statement->execute(['user'=>(int)$actor['id'], 'branch'=>(int)$actor['branch']['id'], 'shop'=>$shopId]);
    $branch = $statement->fetch();
    if (!is_array($branch)) throw new TamiranApiException('شعبه فعالی برای کاربر تعریف نشده است.', 409);
    return [
        'actor'=>$actor,
        'shop_id'=>$shopId,
        'branch_id'=>(int)$branch['id'],
        'repair_shop_code'=>(string)$actor['shop']['code'],
        'branch_code'=>(string)$branch['branch_code'],
    ];
}

function followup_select_sql(): string
{
    return <<<'SQL'
SELECT f.id AS followup_id,f.public_id,f.assigned_to_user_id,f.owner_role,f.owner_name,f.due_label,f.due_at,f.reminder_at,
       f.status,f.requires_acknowledgement,m.case_id,m.receipt_id,m.device_title,m.customer_name,m.message_text,
       m.message_kind,m.priority,m.created_by,m.created_at,assignee.display_name AS assignee_name
FROM repair_followups f
INNER JOIN repair_case_messages m ON m.id=f.message_id
LEFT JOIN tamiran_users assignee ON assignee.id=f.assigned_to_user_id
WHERE f.repair_shop_code=:repair_shop_code AND f.branch_code=:branch_code
SQL;
}

function followup_histories(PDO $pdo, array $ids): array
{
    if ($ids === []) return [];
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $statement = $pdo->prepare(
        "SELECT a.followup_id,a.activity_type,a.body,a.created_at,actor.display_name actor_name,target.display_name target_name
         FROM repair_followup_activity a INNER JOIN tamiran_users actor ON actor.id=a.actor_user_id
         LEFT JOIN tamiran_users target ON target.id=a.target_user_id
         WHERE a.followup_id IN ({$placeholders}) ORDER BY a.created_at ASC,a.id ASC"
    );
    $statement->execute($ids);
    $result = [];
    foreach ($statement->fetchAll() as $row) {
        $result[(int)$row['followup_id']][] = [
            'type'=>$row['activity_type'], 'actorName'=>$row['actor_name'], 'targetName'=>$row['target_name'] ?? '',
            'body'=>$row['body'] ?? '', 'createdAt'=>$row['created_at'],
        ];
    }
    return $result;
}

function followup_to_api(array $row, array $history = []): array
{
    $overdue = $row['status'] !== 'done' && $row['due_at'] !== null && strtotime((string)$row['due_at']) < time();
    return [
        'id'=>(string)$row['public_id'], 'receiptId'=>(string)$row['receipt_id'], 'device'=>(string)$row['device_title'],
        'customer'=>(string)$row['customer_name'], 'message'=>(string)$row['message_text'], 'kind'=>(string)$row['message_kind'],
        'priority'=>(string)$row['priority'], 'status'=>(string)$row['status'], 'ownerRole'=>followup_role_to_fa((string)$row['owner_role']),
        'ownerName'=>(string)($row['assignee_name'] ?: $row['owner_name']),
        'assignedToUserId'=>$row['assigned_to_user_id'] === null ? null : (int)$row['assigned_to_user_id'],
        'createdBy'=>(string)$row['created_by'], 'createdAt'=>(string)$row['created_at'], 'dueLabel'=>(string)$row['due_label'],
        'overdue'=>$overdue, 'requiresAcknowledgement'=>(bool)$row['requires_acknowledgement'], 'history'=>$history,
    ];
}

function followup_find(PDO $pdo, string $publicId, array $scope): array
{
    $limited = in_array((string) ($scope['actor']['role'] ?? ''), ['technician','quality_control'], true);
    $statement = $pdo->prepare(followup_select_sql() . ' AND f.public_id=:public' . ($limited ? ' AND f.assigned_to_user_id=:actor_id' : '') . ' LIMIT 1');
    $params = ['repair_shop_code'=>$scope['repair_shop_code'],'branch_code'=>$scope['branch_code'],'public'=>$publicId];
    if ($limited) $params['actor_id'] = (int) $scope['actor']['id'];
    $statement->execute($params);
    $row = $statement->fetch();
    if (!is_array($row)) throw new TamiranApiException('پیگیری پیدا نشد.', 404);
    $history = followup_histories($pdo, [(int)$row['followup_id']]);
    return followup_to_api($row, $history[(int)$row['followup_id']] ?? []);
}

function followup_get(PDO $pdo, array $scope): array
{
    $limited = in_array((string) ($scope['actor']['role'] ?? ''), ['technician','quality_control'], true);
    $statement = $pdo->prepare(followup_select_sql() . ($limited ? ' AND f.assigned_to_user_id=:actor_id' : '') . " ORDER BY (f.status='done') ASC,COALESCE(f.reminder_at,f.due_at) ASC,m.created_at DESC LIMIT 250");
    $params = ['repair_shop_code'=>$scope['repair_shop_code'],'branch_code'=>$scope['branch_code']];
    if ($limited) $params['actor_id'] = (int) $scope['actor']['id'];
    $statement->execute($params);
    $rows = $statement->fetchAll();
    $histories = followup_histories($pdo, array_map(static fn(array $row): int => (int)$row['followup_id'], $rows));
    return array_map(static fn(array $row): array => followup_to_api($row, $histories[(int)$row['followup_id']] ?? []), $rows);
}

function followup_user(PDO $pdo, int $shopId, int $branchId, int $userId): array
{
    $statement = $pdo->prepare(
        'SELECT u.id,u.display_name,u.role_code FROM tamiran_users u
         INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.branch_id=:branch
         WHERE u.id=:id AND u.shop_id=:shop AND u.is_active=1 LIMIT 1'
    );
    $statement->execute(['id'=>$userId,'shop'=>$shopId,'branch'=>$branchId]);
    $user = $statement->fetch();
    if (!is_array($user)) throw new TamiranApiException('کاربر مقصد در این تعمیرگاه فعال نیست.', 409);
    return $user;
}

function followup_activity(PDO $pdo, int $followupId, int $actorId, ?int $targetId, string $type, ?string $body): void
{
    $statement = $pdo->prepare('INSERT INTO repair_followup_activity(followup_id,actor_user_id,target_user_id,activity_type,body,metadata_json) VALUES(:followup,:actor,:target,:type,:body,:metadata)');
    $statement->execute(['followup'=>$followupId,'actor'=>$actorId,'target'=>$targetId,'type'=>$type,'body'=>$body,'metadata'=>json_encode(new stdClass(),JSON_UNESCAPED_UNICODE)]);
}

function followup_post(PDO $pdo, array $scope): array
{
    tamiran_require_csrf();
    tamiran_require_writable_actor($scope['actor']);
    if (!in_array((string) ($scope['actor']['role'] ?? ''), ['repair_manager','reception'], true)) {
        throw new TamiranApiException('ثبت و ارجاع پیگیری فقط برای مدیر یا پذیرش مجاز است.', 403);
    }
    $input = tamiran_json_body();
    $kind = followup_required($input,'kind',32);
    $priority = followup_required($input,'priority',32);
    if (!in_array($kind,['information','action','customer_callback'],true)) throw new TamiranApiException('نوع پیام معتبر نیست.');
    if (!in_array($priority,['normal','important','urgent'],true)) throw new TamiranApiException('اهمیت پیام معتبر نیست.');
    $receipt = followup_required($input,'receiptId',80);
    $customerMobile = tamiran_mobile((string)($input['customerMobile'] ?? ''));
    $caseStatement = $pdo->prepare(
        'SELECT c.id,c.receipt_number,customer.full_name customer_name,
                COALESCE(NULLIF(c.device_type_snapshot,\'\'),device.device_type_title) device_type_title,
                COALESCE(NULLIF(c.brand_snapshot,\'\'),device.brand_title) brand_title,
                COALESCE(NULLIF(c.model_snapshot,\'\'),device.model_title) model_title
         FROM repair_cases c INNER JOIN repair_customers customer ON customer.id=c.customer_id INNER JOIN repair_customer_devices device ON device.id=c.device_id
         WHERE c.shop_id=:shop AND c.branch_id=:branch AND c.receipt_number=:receipt AND customer.mobile=:mobile LIMIT 1'
    );
    $caseStatement->execute(['shop'=>$scope['shop_id'],'branch'=>$scope['branch_id'],'receipt'=>$receipt,'mobile'=>$customerMobile]);
    $case = $caseStatement->fetch();
    if (!is_array($case)) throw new TamiranApiException('شماره قبض و موبایل با یک پرونده مطابقت ندارند.', 404);
    $assigneeId = (int)($input['assignedToUserId'] ?? 0);
    if ($assigneeId < 1) throw new TamiranApiException('کاربر مسئول پیگیری را انتخاب کنید.');
    $assignee = followup_user($pdo,$scope['shop_id'],$scope['branch_id'],$assigneeId);
    $ownerRole = (string) $assignee['role_code'];
    if (!in_array($ownerRole, ['repair_manager','reception','technician','quality_control'], true)) throw new TamiranApiException('نقش کاربر مقصد معتبر نیست.', 409);
    $dueLabel = followup_due_label($input['dueLabel'] ?? '');
    $dueAt = followup_due_at($dueLabel);
    $publicId = 'FU-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
    $actor = $scope['actor'];
    $pdo->beginTransaction();
    try {
        $message = $pdo->prepare(
            'INSERT INTO repair_case_messages(case_id,created_by_user_id,repair_shop_code,branch_code,receipt_id,device_title,customer_name,message_text,message_kind,priority,source,created_by,created_at)
             VALUES(:case,:creator,:shop_code,:branch_code,:receipt,:device,:customer,:message,:kind,:priority,:source,:created_by,NOW())'
        );
        $message->execute([
            'case'=>(int)$case['id'],'creator'=>(int)$actor['id'],'shop_code'=>$scope['repair_shop_code'],'branch_code'=>$scope['branch_code'],
            'receipt'=>$case['receipt_number'],'device'=>trim($case['device_type_title'].' '.$case['brand_title'].' '.$case['model_title']),
            'customer'=>$case['customer_name'],'message'=>followup_required($input,'message',4000),'kind'=>$kind,'priority'=>$priority,
            'source'=>'customer_call','created_by'=>$actor['displayName'],
        ]);
        $messageId = (int)$pdo->lastInsertId();
        $followup = $pdo->prepare(
            'INSERT INTO repair_followups(public_id,repair_shop_code,branch_code,message_id,assigned_to_user_id,owner_role,owner_name,due_label,due_at,reminder_at,status,requires_acknowledgement,created_at,updated_at)
             VALUES(:public,:shop_code,:branch_code,:message,:assignee,:role,:owner,:label,:due,:reminder,\'new\',:ack,NOW(),NOW())'
        );
        $followup->execute([
            'public'=>$publicId,'shop_code'=>$scope['repair_shop_code'],'branch_code'=>$scope['branch_code'],'message'=>$messageId,
            'assignee'=>$assigneeId,'role'=>$ownerRole,'owner'=>$assignee['display_name'],'label'=>$dueLabel,'due'=>$dueAt,'reminder'=>$dueAt,
            'ack'=>!empty($input['requiresAcknowledgement'])?1:0,
        ]);
        $followupId = (int)$pdo->lastInsertId();
        followup_activity($pdo,$followupId,(int)$actor['id'],$assigneeId,'created','پیگیری مشتری ثبت و ارجاع شد.');
        $event = $pdo->prepare('INSERT INTO repair_followup_events(followup_id,from_status,to_status,actor_name,occurred_at) VALUES(:followup,NULL,\'new\',:actor,NOW())');
        $event->execute(['followup'=>$followupId,'actor'=>$actor['displayName']]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    tamiran_log('info','followup_created',['public_id'=>$publicId,'receipt_id'=>$receipt,'assigned_to_user_id'=>$assigneeId]);
    return followup_find($pdo,$publicId,$scope);
}

function followup_patch(PDO $pdo, array $scope): array
{
    tamiran_require_csrf();
    tamiran_require_writable_actor($scope['actor']);
    $input = tamiran_json_body();
    $publicId = followup_required($input,'id',80);
    $currentStatement = $pdo->prepare(
        'SELECT f.id,f.status,f.assigned_to_user_id,f.owner_role,f.owner_name,f.due_label,f.due_at FROM repair_followups f
         WHERE f.public_id=:public AND f.repair_shop_code=:shop_code AND f.branch_code=:branch_code LIMIT 1'
    );
    $currentStatement->execute(['public'=>$publicId,'shop_code'=>$scope['repair_shop_code'],'branch_code'=>$scope['branch_code']]);
    $current = $currentStatement->fetch();
    if (!is_array($current)) throw new TamiranApiException('پیگیری پیدا نشد.',404);
    $role = (string) ($scope['actor']['role'] ?? '');
    if (!in_array($role, ['repair_manager','reception','technician','quality_control'], true)) throw new TamiranApiException('نقش فعلی اجازه تغییر پیگیری را ندارد.', 403);
    if (in_array($role, ['technician','quality_control'], true) && (int) $current['assigned_to_user_id'] !== (int) $scope['actor']['id']) {
        throw new TamiranApiException('این پیگیری به شما ارجاع نشده است.', 403);
    }
    $status = array_key_exists('status',$input) ? (string)$input['status'] : (string)$current['status'];
    if (!in_array($status,['new','seen','in_progress','done'],true)) throw new TamiranApiException('وضعیت پیگیری معتبر نیست.');
    $allowed = ['new'=>['seen','in_progress','done'],'seen'=>['in_progress','done'],'in_progress'=>['done'],'done'=>[]];
    if ($status !== $current['status'] && !in_array($status,$allowed[$current['status']] ?? [],true)) throw new TamiranApiException('این تغییر وضعیت مجاز نیست.',409);
    $assigneeId = array_key_exists('assignedToUserId',$input) ? (int)$input['assignedToUserId'] : (int)$current['assigned_to_user_id'];
    if ($assigneeId < 1) throw new TamiranApiException('پیگیری باید مسئول فعال داشته باشد.');
    $dueLabel = array_key_exists('dueLabel',$input) ? followup_due_label($input['dueLabel']) : (string)$current['due_label'];
    if (in_array($role, ['technician','quality_control'], true) && ($assigneeId !== (int) $current['assigned_to_user_id'] || $dueLabel !== (string) $current['due_label'])) {
        throw new TamiranApiException('تغییر مسئول یا زمان یادآوری فقط برای مدیر یا پذیرش مجاز است.', 403);
    }
    $assignee = followup_user($pdo,$scope['shop_id'],$scope['branch_id'],$assigneeId);
    $ownerRoleDb = (string) $assignee['role_code'];
    $dueAt = $dueLabel === $current['due_label'] ? $current['due_at'] : followup_due_at($dueLabel);
    $comment = trim((string)($input['comment'] ?? ''));
    if ((function_exists('mb_strlen') ? mb_strlen($comment) : strlen($comment)) > 4000) throw new TamiranApiException('متن پاسخ بیش از حد طولانی است.');
    $timeColumn = match($status){'seen'=>'seen_at','in_progress'=>'started_at','done'=>'completed_at',default=>null};
    $timeSql = $timeColumn ? ",{$timeColumn}=COALESCE({$timeColumn},NOW())" : '';
    $actor = $scope['actor'];
    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare("UPDATE repair_followups SET status=:status,assigned_to_user_id=:assignee,owner_role=:role,owner_name=:owner,due_label=:label,due_at=:due,reminder_at=:reminder,updated_at=NOW(){$timeSql} WHERE id=:id");
        $update->execute(['status'=>$status,'assignee'=>$assigneeId,'role'=>$ownerRoleDb,'owner'=>$assignee['display_name'],'label'=>$dueLabel,'due'=>$dueAt,'reminder'=>$dueAt,'id'=>(int)$current['id']]);
        if ($assigneeId !== (int)$current['assigned_to_user_id']) followup_activity($pdo,(int)$current['id'],(int)$actor['id'],$assigneeId,'assigned','مسئول پیگیری تغییر کرد.');
        if ($dueLabel !== $current['due_label']) followup_activity($pdo,(int)$current['id'],(int)$actor['id'],$assigneeId,'reminder_changed',$dueLabel);
        if ($comment !== '') followup_activity($pdo,(int)$current['id'],(int)$actor['id'],$assigneeId,'commented',$comment);
        if ($status !== $current['status']) {
            followup_activity($pdo,(int)$current['id'],(int)$actor['id'],$assigneeId,'status_changed','وضعیت از «'.followup_status_to_fa((string)$current['status']).'» به «'.followup_status_to_fa($status).'» تغییر کرد.');
            $event=$pdo->prepare('INSERT INTO repair_followup_events(followup_id,from_status,to_status,actor_name,occurred_at) VALUES(:followup,:from_status,:to_status,:actor,NOW())');
            $event->execute(['followup'=>(int)$current['id'],'from_status'=>$current['status'],'to_status'=>$status,'actor'=>$actor['displayName']]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    tamiran_log('info','followup_updated',['public_id'=>$publicId,'status'=>$status,'assigned_to_user_id'=>$assigneeId]);
    return followup_find($pdo,$publicId,$scope);
}

tamiran_api(static function(): array {
    $pdo = tamiran_db();
    $scope = followup_scope($pdo);
    return match($_SERVER['REQUEST_METHOD'] ?? 'GET') {
        'GET' => followup_get($pdo,$scope),
        'POST' => followup_post($pdo,$scope),
        'PATCH' => followup_patch($pdo,$scope),
        default => throw new TamiranApiException('روش درخواست مجاز نیست.',405),
    };
});
