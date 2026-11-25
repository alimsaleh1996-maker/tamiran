<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const TAMIRAN_PREAUTH_TTL = 180;

function auth_profile_from_row(array $row): array
{
    $isCentral = ($row['role_code'] ?? '') === 'central_admin' && ($row['shop_id'] ?? null) === null;
    return [
        'id' => (int) $row['user_id'],
        'displayName' => (string) $row['display_name'],
        'role' => (string) ($row['branch_role_code'] ?? $row['role_code']),
        'primaryRole' => (string) $row['role_code'],
        'mustChangePassword' => (bool)($row['must_change_password'] ?? false),
        'permissions' => $isCentral ? ['*'] : (json_decode((string)($row['permissions_json'] ?? '[]'), true) ?: []),
        'isCentralAdmin' => $isCentral,
        'branch' => $isCentral ? null : [
            'id' => (int) $row['branch_id'],
            'code' => (string) $row['branch_code'],
            'name' => (string) $row['branch_name'],
        ],
        'shop' => $isCentral ? null : [
            'id' => (int) $row['shop_id'],
            'code' => (string) $row['shop_code'],
            'publicCode' => (string)($row['public_shop_code'] ?? ''),
            'name' => (string) $row['shop_name'],
            'repairType' => (string) $row['repair_type'],
            'plan' => (string) $row['plan_code'],
            'modules' => json_decode((string)($row['modules_json']??'[]'),true)?:['repair'],
            'productProfile' => (string)($row['product_profile']??'pro'),
            'operationMode' => (string)($row['operation_mode']??'multi_user'),
            'inventoryMode' => (string)($row['inventory_mode']??'off'),
            'qcMode' => (string)($row['qc_mode']??'off'),
            'featureFlags' => json_decode((string)($row['feature_flags_json']??'{}'),true)?:[],
            'licenseStatus' => tamiran_license_state($row),
            'expiresAt' => (string) $row['license_expires_at'],
            'nationalCodeRequired' => (bool) $row['national_code_required'],
        ],
    ];
}

function auth_throttle_key(string $scope, string $value): string
{
    return hash('sha256', $scope . '|' . $value);
}

function auth_throttle_scopes(string $mobile): array
{
    return [
        ['key' => auth_throttle_key('mobile', $mobile), 'kind' => 'mobile'],
        ['key' => auth_throttle_key('ip', tamiran_client_ip()), 'kind' => 'ip'],
    ];
}

function auth_throttle_check(PDO $pdo, string $mobile): void
{
    $statement = $pdo->prepare('SELECT blocked_until FROM tamiran_auth_throttles WHERE scope_key=:scope LIMIT 1');
    foreach (auth_throttle_scopes($mobile) as $scope) {
        $statement->execute(['scope' => $scope['key']]);
        $blockedUntil = $statement->fetchColumn();
        if (is_string($blockedUntil) && strtotime($blockedUntil) > time()) {
            header('Retry-After: 60');
            throw new TamiranApiException('تعداد تلاش‌های ورود بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.', 429);
        }
    }
}

function auth_throttle_failure(PDO $pdo, string $mobile): void
{
    $pdo->beginTransaction();
    try {
        $seed = $pdo->prepare('INSERT IGNORE INTO tamiran_auth_throttles(scope_key,failed_attempts,window_started_at) VALUES(:scope,0,NOW())');
        $select = $pdo->prepare('SELECT failed_attempts,window_started_at FROM tamiran_auth_throttles WHERE scope_key=:scope FOR UPDATE');
        $update = $pdo->prepare('UPDATE tamiran_auth_throttles SET failed_attempts=:failures,window_started_at=:window_started,blocked_until=:blocked,updated_at=NOW() WHERE scope_key=:scope');
        foreach (auth_throttle_scopes($mobile) as $scope) {
            $seed->execute(['scope'=>$scope['key']]);
            $select->execute(['scope' => $scope['key']]);
            $current = $select->fetch();
            $windowExpired = !is_array($current) || strtotime((string) $current['window_started_at']) < strtotime('-15 minutes');
            $failures = $windowExpired ? 1 : ((int) $current['failed_attempts'] + 1);
            $blockSeconds = 0;
            if ($scope['kind'] === 'mobile') {
                $blockSeconds = $failures >= 8 ? 900 : ($failures === 7 ? 300 : ($failures === 6 ? 60 : ($failures === 5 ? 30 : 0)));
            } else {
                $blockSeconds = $failures >= 25 ? 900 : ($failures >= 15 ? 60 : 0);
            }
            $blocked = $blockSeconds > 0 ? date('Y-m-d H:i:s', time() + $blockSeconds) : null;
            $update->execute([
                'scope'=>$scope['key'], 'failures'=>$failures,
                'window_started'=>$windowExpired ? date('Y-m-d H:i:s') : $current['window_started_at'], 'blocked'=>$blocked,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    usleep(random_int(120000, 240000));
}

function auth_throttle_success(PDO $pdo, string $mobile): void
{
    $delete = $pdo->prepare('DELETE FROM tamiran_auth_throttles WHERE scope_key=:scope');
    foreach (auth_throttle_scopes($mobile) as $scope) $delete->execute(['scope'=>$scope['key']]);
    if (random_int(1, 100) === 1) {
        $pdo->exec("DELETE FROM tamiran_auth_throttles WHERE updated_at < (NOW() - INTERVAL 2 DAY)");
    }
}

function auth_validate_captcha(string $answer): bool
{
    tamiran_csrf_token();
    $captcha = $_SESSION['tamiran_captcha'] ?? null;
    unset($_SESSION['tamiran_captcha']);
    if (!is_array($captcha) || (int) ($captcha['expires_at'] ?? 0) < time()) return false;
    $normalized = strtoupper(preg_replace('/[^A-Z0-9]/', '', $answer) ?? '');
    return $normalized !== '' && hash_equals((string) ($captcha['answer_hash'] ?? ''), hash('sha256', $normalized));
}

function auth_candidate_users(PDO $pdo, string $mobile): array
{
    $columnCheck = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tamiran_users' AND COLUMN_NAME='must_change_password'"
    );
    $columnCheck->execute();
    $mustChangeSelect = (int)$columnCheck->fetchColumn() > 0
        ? 'u.must_change_password'
        : '0 AS must_change_password';
    $statement = $pdo->prepare(
        "SELECT u.id AS user_id,u.display_name,u.role_code,u.password_hash,{$mustChangeSelect},s.id AS shop_id,s.shop_code,s.public_shop_code,s.name AS shop_name,
                s.repair_type,s.plan_code,s.modules_json,s.product_profile,s.operation_mode,s.inventory_mode,s.qc_mode,s.feature_flags_json,
                s.lifecycle_status,s.license_expires_at,s.national_code_required
         FROM tamiran_users u LEFT JOIN repair_shops s ON s.id=u.shop_id
         WHERE u.is_active=1 AND (u.username=:username OR u.phone=:phone)
           AND ((u.shop_id IS NULL AND u.role_code='central_admin')
             OR (u.shop_id IS NOT NULL AND u.role_code<>'central_admin' AND s.lifecycle_status<>'suspended'))
         ORDER BY (u.role_code='central_admin') DESC,u.id ASC LIMIT 20"
    );
    $statement->execute(['username'=>$mobile, 'phone'=>$mobile]);
    return $statement->fetchAll();
}

function auth_contexts(PDO $pdo, array $users): array
{
    $contexts = [];
    $statement = $pdo->prepare(
        'SELECT b.id AS branch_id,b.branch_code,b.name AS branch_name,ub.branch_role_code,ub.permissions_json
         FROM repair_branches b INNER JOIN tamiran_user_branches ub ON ub.branch_id=b.id
         WHERE ub.user_id=:user_id AND ub.shop_id=b.shop_id AND ub.is_active=1 AND b.shop_id=:shop_id AND b.is_active=1
         ORDER BY b.is_default DESC,b.id ASC'
    );
    foreach ($users as $user) {
        if (($user['shop_id'] ?? null) === null) {
            $contexts[] = $user;
            continue;
        }
        $statement->execute(['user_id'=>$user['user_id'], 'shop_id'=>$user['shop_id']]);
        foreach ($statement->fetchAll() as $branch) $contexts[] = array_merge($user, $branch);
    }
    return $contexts;
}

function auth_begin_actor(PDO $pdo, array $row, string $mobile): array
{
    $actor = auth_profile_from_row($row);
    tamiran_csrf_token();
    $sessionToken=null;
    $pdo->beginTransaction();
    try {
    if (($row['role_code'] ?? '') !== 'central_admin' && ($row['shop_id'] ?? null) !== null) {
        $sessionToken = bin2hex(random_bytes(32));
        $previousHash = $pdo->prepare('SELECT active_session_hash FROM tamiran_users WHERE id=:id FOR UPDATE');
        $previousHash->execute(['id'=>$row['user_id']]);
        $replacedHash = $previousHash->fetchColumn();
        $pdo->prepare('UPDATE tamiran_users SET active_session_hash=:hash,last_login_at=NOW() WHERE id=:id')
            ->execute(['hash'=>hash('sha256', $sessionToken), 'id'=>$row['user_id']]);
        if (is_string($replacedHash) && $replacedHash !== '') {
            $pdo->prepare("INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,user_agent) VALUES(:public,:shop,:user,'revoked',:hash,:request,:ip,:agent)")
                ->execute(['public'=>tamiran_id(),'shop'=>$row['shop_id'],'user'=>$row['user_id'],'hash'=>$replacedHash,'request'=>tamiran_request_id(),'ip'=>tamiran_client_ip(),'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,500)]);
        }
        $pdo->prepare("INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,user_agent) VALUES(:public,:shop,:user,'login',:hash,:request,:ip,:agent)")
            ->execute(['public'=>tamiran_id(),'shop'=>$row['shop_id'],'user'=>$row['user_id'],'hash'=>hash('sha256',$sessionToken),'request'=>tamiran_request_id(),'ip'=>tamiran_client_ip(),'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,500)]);
    } else {
        $pdo->prepare('UPDATE tamiran_users SET last_login_at=NOW() WHERE id=:id')->execute(['id'=>$row['user_id']]);
    }
        $pdo->commit();
    } catch(Throwable $error) { if($pdo->inTransaction())$pdo->rollBack();throw $error; }
    session_regenerate_id(true);
    $_SESSION['tamiran_csrf'] = bin2hex(random_bytes(24));
    $_SESSION['tamiran_actor'] = $actor;
    $_SESSION['tamiran_actor_issued_at'] = time();
    $_SESSION['tamiran_actor_last_activity'] = time();
    $_SESSION['tamiran_credential_stamp'] = tamiran_credential_stamp($row);
    if($sessionToken!==null)$_SESSION['tamiran_session_token']=$sessionToken;
    else unset($_SESSION['tamiran_session_token']);
    unset($_SESSION['tamiran_preauth'], $_SESSION['tamiran_captcha']);
    auth_throttle_success($pdo, $mobile);
    tamiran_log('info', 'authentication_succeeded', [
        'user_id'=>(int)$row['user_id'], 'role'=>$row['role_code'],
        'shop_code'=>$row['shop_code'] ?? null, 'branch_code'=>$row['branch_code'] ?? null,
        'ip_hash'=>auth_throttle_key('ip_log', tamiran_client_ip()),
    ]);
    return ['actor'=>$actor, 'requiresContext'=>false];
}

function auth_identify(PDO $pdo, array $input): array
{
    tamiran_require_csrf();
    $mobile = tamiran_mobile((string) ($input['mobile'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    if ($password === '' || strlen($password) > 4096) throw new TamiranApiException('شماره موبایل یا رمز عبور صحیح نیست.', 401);
    auth_throttle_check($pdo, $mobile);
    if (!auth_validate_captcha((string) ($input['captchaAnswer'] ?? ''))) {
        auth_throttle_failure($pdo, $mobile);
        throw new TamiranApiException('عبارت امنیتی صحیح نیست؛ تصویر جدید را وارد کنید.', 401);
    }

    $candidates = auth_candidate_users($pdo, $mobile);
    $validUsers = [];
    foreach ($candidates as $candidate) {
        if (password_verify($password, (string) $candidate['password_hash'])) {
            if (password_needs_rehash((string) $candidate['password_hash'], PASSWORD_BCRYPT, ['cost'=>12])) {
                $candidate['password_hash'] = tamiran_password_hash($password);
                $pdo->prepare('UPDATE tamiran_users SET password_hash=:hash WHERE id=:id')->execute([
                    'hash'=>$candidate['password_hash'], 'id'=>$candidate['user_id'],
                ]);
            }
            $validUsers[] = $candidate;
        }
    }
    if ($validUsers === []) {
        if ($candidates === []) password_verify($password, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
        auth_throttle_failure($pdo, $mobile);
        tamiran_log('warning', 'authentication_failed', ['ip_hash'=>auth_throttle_key('ip_log', tamiran_client_ip())]);
        throw new TamiranApiException('شماره موبایل یا رمز عبور صحیح نیست.', 401);
    }
    $contexts = auth_contexts($pdo, $validUsers);
    if ($contexts === []) {
        auth_throttle_failure($pdo, $mobile);
        throw new TamiranApiException('شعبه فعالی برای این حساب تعریف نشده است.', 403);
    }
    $centralContexts = array_values(array_filter($contexts, static fn(array $context): bool => ($context['role_code'] ?? '') === 'central_admin' && ($context['shop_id'] ?? null) === null));
    if ($centralContexts !== []) return auth_begin_actor($pdo, $centralContexts[0], $mobile);
    if (count($contexts) === 1) return auth_begin_actor($pdo, $contexts[0], $mobile);

    $challenge = bin2hex(random_bytes(24));
    $_SESSION['tamiran_preauth'] = [
        'challenge_hash'=>hash('sha256', $challenge), 'mobile'=>$mobile, 'expires_at'=>time() + TAMIRAN_PREAUTH_TTL,
        'attempts'=>0, 'contexts'=>array_map(static fn(array $context): array => [
            'user_id'=>(int)$context['user_id'], 'shop_id'=>(int)$context['shop_id'], 'branch_id'=>(int)$context['branch_id'],
        ], $contexts),
    ];
    auth_throttle_success($pdo, $mobile);
    return ['requiresContext'=>true, 'challenge'=>$challenge, 'contextCount'=>count($contexts)];
}

function auth_select_context(PDO $pdo, array $input): array
{
    tamiran_require_csrf();
    tamiran_csrf_token();
    $preauth = $_SESSION['tamiran_preauth'] ?? null;
    $challenge = strtolower(trim((string) ($input['challenge'] ?? '')));
    if (!is_array($preauth) || (int) ($preauth['expires_at'] ?? 0) < time() || !preg_match('/^[a-f0-9]{48}$/', $challenge)
        || !hash_equals((string) ($preauth['challenge_hash'] ?? ''), hash('sha256', $challenge))) {
        unset($_SESSION['tamiran_preauth']);
        throw new TamiranApiException('مهلت انتخاب شعبه پایان یافته است؛ دوباره وارد شوید.', 401);
    }
    $preauth['attempts'] = (int) ($preauth['attempts'] ?? 0) + 1;
    if ($preauth['attempts'] > 5) {
        unset($_SESSION['tamiran_preauth']);
        throw new TamiranApiException('تعداد تلاش‌های انتخاب شعبه بیش از حد مجاز است؛ دوباره وارد شوید.', 429);
    }
    $_SESSION['tamiran_preauth'] = $preauth;
    $shopCode = tamiran_digits((string) ($input['shopCode'] ?? ''));
    $branchCode = strtoupper(trim((string) ($input['branchCode'] ?? '')));
    if (!preg_match('/^\d{6}$/', $shopCode) || !preg_match('/^[A-Z0-9._-]{1,64}$/', $branchCode)) {
        throw new TamiranApiException('کد تعمیرگاه یا شعبه صحیح نیست.', 403);
    }
    foreach ((array) ($preauth['contexts'] ?? []) as $context) {
        $statement = $pdo->prepare(
            "SELECT u.id AS user_id,u.display_name,u.role_code,u.password_hash,u.must_change_password,s.id AS shop_id,s.shop_code,s.public_shop_code,s.name AS shop_name,
                    s.repair_type,s.plan_code,s.modules_json,s.product_profile,s.operation_mode,s.inventory_mode,s.qc_mode,s.feature_flags_json,
                    s.lifecycle_status,s.license_expires_at,s.national_code_required,
                    b.id AS branch_id,b.branch_code,b.name AS branch_name,ub.branch_role_code,ub.permissions_json
             FROM tamiran_users u INNER JOIN repair_shops s ON s.id=u.shop_id
             INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=s.id AND ub.is_active=1
             INNER JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=s.id
             WHERE u.id=:user_id AND s.id=:shop_id AND b.id=:branch_id AND s.public_shop_code=:shop_code AND b.branch_code=:branch_code
               AND u.is_active=1 AND b.is_active=1 AND s.lifecycle_status<>'suspended' LIMIT 1"
        );
        $statement->execute([
            'user_id'=>(int)($context['user_id'] ?? 0), 'shop_id'=>(int)($context['shop_id'] ?? 0), 'branch_id'=>(int)($context['branch_id'] ?? 0),
            'shop_code'=>$shopCode, 'branch_code'=>$branchCode,
        ]);
        $row = $statement->fetch();
        if (is_array($row)) return auth_begin_actor($pdo, $row, (string) $preauth['mobile']);
    }
    throw new TamiranApiException('کد تعمیرگاه یا شعبه برای این حساب مجاز نیست.', 403);
}

function auth_change_initial_password(PDO $pdo,array $input):array
{
    tamiran_require_csrf();$actor=tamiran_require_actor();
    if(empty($actor['mustChangePassword']))throw new TamiranApiException('تغییر اجباری رمز برای این حساب فعال نیست.',409);
    $password=(string)($input['newPassword']??'');$confirmation=(string)($input['confirmation']??'');
    if(!hash_equals($password,$confirmation))throw new TamiranApiException('تکرار رمز جدید یکسان نیست.');
    tamiran_validate_new_password($password);
    $newHash=tamiran_password_hash($password);$sessionToken=bin2hex(random_bytes(32));
    $previous=hash('sha256',(string)($_SESSION['tamiran_session_token']??''));
    $pdo->beginTransaction();
    try{
        $update=$pdo->prepare('UPDATE tamiran_users SET password_hash=:hash,must_change_password=0,active_session_hash=:session_hash WHERE id=:id AND active_session_hash=:previous');
        $update->execute(['hash'=>$newHash,'session_hash'=>hash('sha256',$sessionToken),'id'=>$actor['id'],'previous'=>$previous]);
        if($update->rowCount()!==1)throw new TamiranApiException('نشست هم‌زمان تغییر کرده است؛ دوباره وارد شوید.',409);
        $stamp=$pdo->prepare('SELECT u.password_hash,u.role_code,u.shop_id,ub.branch_role_code,ub.permissions_json,ub.branch_id FROM tamiran_users u JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.id=:id AND ub.branch_id=:branch AND ub.is_active=1');
        $stamp->execute(['id'=>$actor['id'],'branch'=>$actor['branch']['id']]);$stampRow=$stamp->fetch();
        if(!is_array($stampRow))throw new TamiranApiException('عضویت فعال پیدا نشد.',403);
        $event=$pdo->prepare("INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,user_agent) VALUES(:public,:shop,:user,'password_changed',:hash,:request,:ip,:agent)");
        $event->execute(['public'=>tamiran_id(),'shop'=>$actor['shop']['id'],'user'=>$actor['id'],'hash'=>hash('sha256',$sessionToken),'request'=>tamiran_request_id(),'ip'=>tamiran_client_ip(),'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,500)]);
        tamiran_audit($pdo,(int)$actor['shop']['id'],(int)$actor['branch']['id'],(int)$actor['id'],'user.initial_password_changed','tamiran_user',(string)$actor['id'],null,['mustChangePassword'=>false]);
        $pdo->commit();
    }catch(Throwable$error){if($pdo->inTransaction())$pdo->rollBack();throw$error;}
    session_regenerate_id(true);$_SESSION['tamiran_csrf']=bin2hex(random_bytes(24));
    $_SESSION['tamiran_session_token']=$sessionToken;$_SESSION['tamiran_credential_stamp']=tamiran_credential_stamp($stampRow);
    $_SESSION['tamiran_actor_issued_at']=time();$_SESSION['tamiran_actor_last_activity']=time();
    $actor['mustChangePassword']=false;$_SESSION['tamiran_actor']=$actor;
    return['changed'=>true,'actor'=>$actor];
}

tamiran_api(static function (): array {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        return ['actor'=>tamiran_actor()];
    }
    if ($method === 'DELETE') {
        tamiran_require_csrf();
        tamiran_release_active_session();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires'=>time() - 42000, 'path'=>$params['path'], 'domain'=>$params['domain'],
                'secure'=>$params['secure'], 'httponly'=>$params['httponly'], 'samesite'=>$params['samesite'] ?? 'Strict',
            ]);
        }
        session_destroy();
        return ['signed_out'=>true];
    }
    if ($method !== 'POST') throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
    $input = tamiran_json_body();
    $pdo = tamiran_db();
    return match ((string) ($input['action'] ?? '')) {
        'identify' => auth_identify($pdo, $input),
        'select_context' => auth_select_context($pdo, $input),
        'change_initial_password' => auth_change_initial_password($pdo, $input),
        default => throw new TamiranApiException('مرحله ورود معتبر نیست.'),
    };
});
