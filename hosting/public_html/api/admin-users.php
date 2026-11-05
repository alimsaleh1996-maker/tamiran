<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const TAMIRAN_SHOP_ROLES = ['repair_manager', 'reception', 'technician', 'quality_control', 'warehouse_keeper', 'finance_cashier'];

function admin_user_mobile(string $value): string
{
    return tamiran_mobile($value);
}

function admin_user_clean_email(string $value): ?string
{
    $email = trim($value);
    if ($email === '') return null;
    if (strlen($email) > 190 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new TamiranApiException('نشانی ایمیل معتبر نیست.');
    }
    return $email;
}

function admin_user_display_name(mixed $value): string
{
    $name = trim((string) $value);
    $length = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
    if ($name === '' || $length > 180) throw new TamiranApiException('نام و نام خانوادگی معتبر نیست.');
    return $name;
}

function admin_user_assert_mobile_available(PDO $pdo, string $mobile, int $exceptId = 0): void
{
    $statement = $pdo->prepare('SELECT id FROM tamiran_users WHERE (username=:username OR phone=:phone) AND id<>:except LIMIT 1');
    $statement->execute(['username'=>$mobile, 'phone'=>$mobile, 'except'=>$exceptId]);
    if ($statement->fetchColumn() !== false) throw new TamiranApiException('این شماره موبایل قبلاً برای حساب دیگری ثبت شده است.', 409);
}

function admin_user_branch_ids(PDO $pdo, int $shopId, mixed $value): array
{
    $ids = is_array($value) ? array_values(array_unique(array_filter(array_map('intval', $value), static fn (int $id): bool => $id > 0))) : [];
    if (count($ids) > 100) throw new TamiranApiException('تعداد شعب انتخاب‌شده بیش از حد مجاز است.');
    if ($ids === []) {
        $statement = $pdo->prepare('SELECT id FROM repair_branches WHERE shop_id = :shop_id AND is_active = 1 ORDER BY is_default DESC, id ASC LIMIT 1');
        $statement->execute(['shop_id' => $shopId]);
        $defaultId = (int) $statement->fetchColumn();
        if ($defaultId < 1) throw new TamiranApiException('این تعمیرگاه شعبه فعالی ندارد.', 409);
        return [$defaultId];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $statement = $pdo->prepare("SELECT id FROM repair_branches WHERE shop_id = ? AND is_active = 1 AND id IN ({$placeholders})");
    $statement->execute(array_merge([$shopId], $ids));
    $valid = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    if (count($valid) !== count($ids)) throw new TamiranApiException('یک یا چند شعبه برای این تعمیرگاه معتبر نیست.');
    return $valid;
}

function admin_user_assign_branches(PDO $pdo, int $shopId, int $userId, string $role, array $branchIds, array $permissions = []): void
{
    $pdo->prepare('DELETE FROM tamiran_user_branches WHERE user_id = :user_id')->execute(['user_id' => $userId]);
    if ($branchIds === []) return;
    $statement = $pdo->prepare('INSERT INTO tamiran_user_branches (shop_id,user_id,branch_id,branch_role_code,permissions_json,is_active) VALUES (:shop_id,:user_id,:branch_id,:role,:permissions,1)');
    $permissionJson = json_encode(array_values(array_unique(array_map('strval',$permissions))), JSON_UNESCAPED_UNICODE);
    foreach ($branchIds as $branchId) $statement->execute(['shop_id'=>$shopId,'user_id'=>$userId,'branch_id'=>$branchId,'role'=>$role,'permissions'=>$permissionJson]);
}

function admin_user_payload(PDO $pdo): array
{
    $users = $pdo->query(
        'SELECT u.id, u.shop_id, u.username, u.display_name, u.phone, u.email, u.role_code, u.is_active, u.created_at, u.updated_at, u.last_login_at,
                s.name AS shop_name, s.public_shop_code AS shop_code
         FROM tamiran_users u
         LEFT JOIN repair_shops s ON s.id = u.shop_id
         ORDER BY u.created_at DESC, u.id DESC'
    )->fetchAll();
    $branches = $pdo->query('SELECT id, shop_id, branch_code, name, is_default, is_active FROM repair_branches ORDER BY shop_id, is_default DESC, name')->fetchAll();
    $links = $pdo->query('SELECT user_id, branch_id FROM tamiran_user_branches ORDER BY user_id, branch_id')->fetchAll();
    $branchMap = [];
    foreach ($links as $link) $branchMap[(int) $link['user_id']][] = (int) $link['branch_id'];

    return [
        'users' => array_map(static function (array $row) use ($branchMap): array {
            $id = (int) $row['id'];
            return [
                'id' => $id,
                'shopId' => $row['shop_id'] === null ? null : (int) $row['shop_id'],
                'shopName' => $row['shop_name'] ?? 'مدیریت مرکزی تعمیران',
                'shopCode' => $row['shop_code'] ?? 'TAMIRAN',
                'username' => $row['phone'] ?: $row['username'],
                'displayName' => $row['display_name'],
                'phone' => $row['phone'] ?? '',
                'email' => $row['email'] ?? '',
                'role' => $row['role_code'],
                'isActive' => (bool) $row['is_active'],
                'branchIds' => $branchMap[$id] ?? [],
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at'],
                'lastLoginAt' => $row['last_login_at'],
            ];
        }, $users),
        'branches' => array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'shopId' => (int) $row['shop_id'],
            'code' => $row['branch_code'],
            'name' => $row['name'],
            'isDefault' => (bool) $row['is_default'],
            'isActive' => (bool) $row['is_active'],
        ], $branches),
    ];
}

tamiran_api(static function (): array {
    $actor = tamiran_require_central_admin();
    $pdo = tamiran_db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') return admin_user_payload($pdo);

    tamiran_require_csrf();
    $input = tamiran_json_body();

    if ($method === 'POST') {
        $shopId = (int) ($input['shopId'] ?? 0);
        if ($shopId < 1) throw new TamiranApiException('تعمیرگاه کاربر را مشخص کنید.');
        $shopStatement = $pdo->prepare('SELECT id, shop_code, max_users FROM repair_shops WHERE id = :id LIMIT 1');
        $shopStatement->execute(['id' => $shopId]);
        $shop = $shopStatement->fetch();
        if (!is_array($shop)) throw new TamiranApiException('تعمیرگاه پیدا نشد.', 404);
        $countStatement = $pdo->prepare('SELECT COUNT(*) FROM tamiran_users WHERE shop_id = :shop_id');
        $countStatement->execute(['shop_id' => $shopId]);
        if ((int) $countStatement->fetchColumn() >= (int) $shop['max_users']) throw new TamiranApiException('ظرفیت کاربران این تعمیرگاه تکمیل شده است.', 409);

        $displayName = admin_user_display_name($input['displayName'] ?? '');
        $mobile = admin_user_mobile((string) ($input['mobile'] ?? $input['phone'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $role = (string) ($input['role'] ?? '');
        tamiran_validate_new_password($password);
        if (!in_array($role, TAMIRAN_SHOP_ROLES, true)) throw new TamiranApiException('نقش کاربر معتبر نیست.');
        admin_user_assert_mobile_available($pdo, $mobile);
        $branchIds = admin_user_branch_ids($pdo, $shopId, $input['branchIds'] ?? []);

        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare('INSERT INTO tamiran_users (shop_id, username, display_name, phone, email, password_hash, role_code, is_active) VALUES (:shop_id, :username, :display_name, :phone, :email, :password_hash, :role, :is_active)');
            $statement->execute([
                'shop_id' => $shopId,
                'username' => $mobile,
                'display_name' => $displayName,
                'phone' => $mobile,
                'email' => admin_user_clean_email((string) ($input['email'] ?? '')),
                'password_hash' => tamiran_password_hash($password),
                'role' => $role,
                'is_active' => !array_key_exists('isActive', $input) || !empty($input['isActive']) ? 1 : 0,
            ]);
            $userId = (int) $pdo->lastInsertId();
            admin_user_assign_branches($pdo, $shopId, $userId, $role, $branchIds, is_array($input['permissions'] ?? null) ? $input['permissions'] : []);
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($exception->getCode() === '23000') throw new TamiranApiException('این شماره موبایل قبلاً استفاده شده است.', 409);
            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
        tamiran_log('info', 'admin_user_created', ['shop_code' => $shop['shop_code'], 'user_id' => $userId, 'actor' => $actor['displayName']]);
        return ['created' => true];
    }

    if ($method === 'PATCH') {
        $id = (int) ($input['id'] ?? 0);
        if ($id < 1) throw new TamiranApiException('کاربر معتبر نیست.');
        $statement = $pdo->prepare('SELECT * FROM tamiran_users WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $current = $statement->fetch();
        if (!is_array($current)) throw new TamiranApiException('کاربر پیدا نشد.', 404);

        $displayName = admin_user_display_name($input['displayName'] ?? $current['display_name']);
        $mobile = admin_user_mobile((string) ($input['mobile'] ?? $input['phone'] ?? $current['phone'] ?? $current['username']));
        admin_user_assert_mobile_available($pdo, $mobile, $id);
        $email = admin_user_clean_email((string) ($input['email'] ?? $current['email'] ?? ''));
        $isCentral = $current['shop_id'] === null || $current['role_code'] === 'central_admin';
        $role = $isCentral ? 'central_admin' : (string) ($input['role'] ?? $current['role_code']);
        $isActive = $isCentral && $id === (int) $actor['id'] ? true : (!array_key_exists('isActive', $input) ? (bool) $current['is_active'] : !empty($input['isActive']));
        if (!$isCentral && !in_array($role, TAMIRAN_SHOP_ROLES, true)) throw new TamiranApiException('نقش کاربر معتبر نیست.');

        if (!$isCentral && $current['role_code'] === 'repair_manager' && (!$isActive || $role !== 'repair_manager')) {
            $managerStatement = $pdo->prepare("SELECT COUNT(*) FROM tamiran_users WHERE shop_id = :shop_id AND role_code = 'repair_manager' AND is_active = 1 AND id <> :id");
            $managerStatement->execute(['shop_id' => $current['shop_id'], 'id' => $id]);
            if ((int) $managerStatement->fetchColumn() === 0) throw new TamiranApiException('هر تعمیرگاه باید حداقل یک مدیر فعال داشته باشد.', 409);
        }

        $newPassword = (string) ($input['newPassword'] ?? '');
        if ($newPassword !== '') tamiran_validate_new_password($newPassword);
        $branchIds = $isCentral ? [] : admin_user_branch_ids($pdo, (int) $current['shop_id'], $input['branchIds'] ?? []);
        $transferToUserId=(int)($input['transferToUserId']??0);
        if(!$isCentral&&!$isActive&&(bool)$current['is_active']){
            $open=$pdo->prepare("SELECT COUNT(*) FROM repair_case_workflows WHERE shop_id=:shop AND primary_technician_user_id=:user AND locked_at IS NULL");$open->execute(['shop'=>$current['shop_id'],'user'=>$id]);$openCount=(int)$open->fetchColumn();
            if($openCount>0&&$transferToUserId<1)throw new TamiranApiException('این کاربر پرونده فعال دارد؛ کاربر جایگزین را برای انتقال مسئولیت مشخص کنید.',409);
            if($transferToUserId>0){$replacement=$pdo->prepare("SELECT u.id FROM tamiran_users u INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.id=:user AND u.shop_id=:shop AND u.is_active=1 AND ub.branch_role_code='technician' LIMIT 1");$replacement->execute(['user'=>$transferToUserId,'shop'=>$current['shop_id']]);if($replacement->fetchColumn()===false)throw new TamiranApiException('کاربر جایگزین باید تکنسین فعال همین تعمیرگاه باشد.',409);}
        }

        $pdo->beginTransaction();
        try {
            $sql = 'UPDATE tamiran_users SET username = :username, display_name = :display_name, phone = :phone, email = :email, role_code = :role, is_active = :is_active';
            $params = ['id' => $id, 'username' => $mobile, 'display_name' => $displayName, 'phone' => $mobile, 'email' => $email, 'role' => $role, 'is_active' => $isActive ? 1 : 0];
            if ($newPassword !== '') {
                $sql .= ', password_hash = :password_hash';
                $params['password_hash'] = tamiran_password_hash($newPassword);
            }
            $sql .= ' WHERE id = :id';
            $pdo->prepare($sql)->execute($params);
            if(!$isCentral&&!$isActive){
                if($transferToUserId>0){$pdo->prepare('UPDATE repair_case_workflows SET primary_technician_user_id=:replacement,lock_version=lock_version+1 WHERE shop_id=:shop AND primary_technician_user_id=:user AND locked_at IS NULL')->execute(['replacement'=>$transferToUserId,'shop'=>$current['shop_id'],'user'=>$id]);$pdo->prepare("UPDATE repair_cases SET assigned_to_user_id=:replacement,row_version=row_version+1 WHERE shop_id=:shop AND assigned_to_user_id=:user AND status NOT IN ('delivered','cancelled')")->execute(['replacement'=>$transferToUserId,'shop'=>$current['shop_id'],'user'=>$id]);$pdo->prepare('UPDATE repair_case_assignments SET ended_at=NOW() WHERE technician_user_id=:user AND ended_at IS NULL')->execute(['user'=>$id]);}
                $deactivationReason=trim((string)($input['deactivationReason']??'غیرفعال‌سازی توسط مدیر مرکزی'));if($deactivationReason===''||strlen($deactivationReason)>1000)throw new TamiranApiException('علت غیرفعال‌سازی معتبر نیست.');
                $pdo->prepare('UPDATE tamiran_users SET active_session_hash=NULL,deactivated_at=NOW(),deactivation_reason=:reason WHERE id=:id')->execute(['reason'=>$deactivationReason,'id'=>$id]);
            }
            if (!$isCentral) admin_user_assign_branches($pdo, (int)$current['shop_id'], $id, $role, $branchIds, is_array($input['permissions'] ?? null) ? $input['permissions'] : []);
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($exception->getCode() === '23000') throw new TamiranApiException('این شماره موبایل قبلاً استفاده شده است.', 409);
            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
        tamiran_log('info', 'admin_user_updated', ['user_id' => $id, 'actor' => $actor['displayName']]);
        return ['updated' => true];
    }

    throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
});
