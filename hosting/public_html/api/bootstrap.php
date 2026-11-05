<?php
declare(strict_types=1);

const TAMIRAN_VERSION = '2.0.0-php.2';

final class TamiranApiException extends RuntimeException
{
    public function __construct(string $message, public readonly int $httpStatus = 400)
    {
        parent::__construct($message);
    }
}

function tamiran_request_id(): string
{
    static $requestId = null;
    if ($requestId !== null) {
        return $requestId;
    }

    $candidate = (string) ($_SERVER['HTTP_X_REQUEST_ID'] ?? '');
    $requestId = preg_match('/^[A-Za-z0-9._-]{8,80}$/', $candidate)
        ? $candidate
        : bin2hex(random_bytes(12));

    return $requestId;
}

function tamiran_domain_root(): string
{
    return dirname(__DIR__, 2);
}

function tamiran_private_root(): string
{
    return tamiran_domain_root() . '/private';
}

function tamiran_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $path = tamiran_private_root() . '/config.php';
    if (!is_file($path)) {
        throw new TamiranApiException('فایل تنظیمات سرور ساخته نشده است.', 503);
    }

    $loaded = require $path;
    if (!is_array($loaded) || !isset($loaded['db']) || !is_array($loaded['db'])) {
        throw new TamiranApiException('ساختار فایل تنظیمات معتبر نیست.', 503);
    }

    $config = $loaded;
    // Database and persisted timestamps use UTC; the frontend renders Tehran/Jalali.
    date_default_timezone_set('UTC');
    return $config;
}

function tamiran_sanitize_log_value(mixed $value, string $key = ''): mixed
{
    $normalizedKey = strtolower(preg_replace('/([a-z])([A-Z])/', '$1_$2', $key) ?? $key);
    foreach (['password','secret','token','authorization','cookie','captcha','apple_id','google_account'] as $sensitivePart) {
        if ($normalizedKey !== '' && str_contains($normalizedKey, $sensitivePart)) return '[REDACTED]';
    }
    if (is_array($value)) {
        $clean = [];
        foreach ($value as $childKey => $childValue) {
            $clean[$childKey] = tamiran_sanitize_log_value($childValue, (string) $childKey);
        }
        return $clean;
    }
    if (is_string($value) && strlen($value) > 500) {
        return substr($value, 0, 500) . '…';
    }
    return $value;
}

function tamiran_log(string $level, string $event, array $context = []): void
{
    $logDirectory = tamiran_private_root() . '/logs';
    if (!is_dir($logDirectory)) {
        @mkdir($logDirectory, 0770, true);
    }

    $record = [
        'time' => gmdate('c'),
        'level' => strtoupper($level),
        'event' => $event,
        'request_id' => tamiran_request_id(),
        'version' => TAMIRAN_VERSION,
        'method' => $_SERVER['REQUEST_METHOD'] ?? null,
        'route' => isset($_SERVER['REQUEST_URI']) ? parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH) : null,
        'context' => tamiran_sanitize_log_value($context),
    ];

    @file_put_contents(
        $logDirectory . '/tamiran-' . gmdate('Y-m-d') . '.log',
        json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        FILE_APPEND | LOCK_EX,
    );
}

/** Expand reused named parameters while retaining real MySQL native prepares.
 * SQL literal/comment contents are copied unchanged. No input values enter SQL.
 */
function tamiran_native_sql(string $sql): array
{
    $output = ''; $aliases = []; $seen = []; $length = strlen($sql);
    for ($i = 0; $i < $length;) {
        $char = $sql[$i];
        if ($char === "'" || $char === '"' || $char === '`') {
            $quote = $char; $output .= $char; $i++;
            while ($i < $length) {
                $char = $sql[$i++]; $output .= $char;
                if ($char === '\\' && $i < $length) { $output .= $sql[$i++]; continue; }
                if ($char === $quote) {
                    if ($i < $length && $sql[$i] === $quote) { $output .= $sql[$i++]; continue; }
                    break;
                }
            }
            continue;
        }
        if ($char === '#' || ($char === '-' && substr($sql, $i, 2) === '--' && ($i+2 >= $length || ctype_space($sql[$i+2])))) {
            $end = strpos($sql, "\n", $i); $end = $end === false ? $length : $end;
            $output .= substr($sql, $i, $end-$i); $i = $end; continue;
        }
        if (substr($sql, $i, 2) === '/*') {
            $end = strpos($sql, '*/', $i+2); $end = $end === false ? $length : $end+2;
            $output .= substr($sql, $i, $end-$i); $i = $end; continue;
        }
        if ($char === ':' && $i+1 < $length && preg_match('/[A-Za-z_]/', $sql[$i+1])) {
            $end = $i+2;
            while ($end < $length && preg_match('/[A-Za-z0-9_]/', $sql[$end])) $end++;
            $name = substr($sql, $i+1, $end-$i-1);
            if (isset($seen[$name])) {
                $copy = 'tmr_dup_' . count($aliases);
                // Avoid collision even if a future query uses our reserved prefix.
                while (str_contains($sql, ':' . $copy)) $copy .= '_x';
                $aliases[$copy] = $name; $output .= ':' . $copy;
            } else { $seen[$name] = true; $output .= ':' . $name; }
            $i = $end; continue;
        }
        $output .= $char; $i++;
    }
    return [$output, $aliases];
}

final class TamiranPDOStatement extends PDOStatement
{
    public array $parameterAliases = [];
    protected function __construct() {}
    public function execute(?array $params = null): bool
    {
        if ($params !== null && $this->parameterAliases !== []) {
            foreach ($this->parameterAliases as $copy => $source) {
                if (array_key_exists($source, $params)) $params[$copy] = $params[$source];
                elseif (array_key_exists(':' . $source, $params)) $params[':' . $copy] = $params[':' . $source];
                else throw new InvalidArgumentException('Missing named SQL parameter.');
            }
        }
        return parent::execute($params);
    }
}

final class TamiranPDO extends PDO
{
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        [$native, $aliases] = tamiran_native_sql($query);
        $statement = parent::prepare($native, $options);
        if ($statement instanceof TamiranPDOStatement) $statement->parameterAliases = $aliases;
        return $statement;
    }
}

function tamiran_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = tamiran_config()['db'];
    foreach (['host', 'name', 'user', 'password'] as $required) {
        if (!array_key_exists($required, $db) || (string) $db[$required] === '') {
            throw new TamiranApiException('تنظیمات پایگاه‌داده کامل نیست.', 503);
        }
    }

    $charset = (string) ($db['charset'] ?? 'utf8mb4');
    $port = (int) ($db['port'] ?? 3306);
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $db['host'], $port, $db['name'], $charset);
    $pdo = new TamiranPDO($dsn, (string) $db['user'], (string) $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STATEMENT_CLASS => [TamiranPDOStatement::class],
    ]);
    // All persisted timestamps are UTC. Jalali/local rendering belongs to the UI.
    $pdo->exec("SET time_zone = '+00:00'");

    return $pdo;
}

function tamiran_json_body(): array
{
    $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    if ($contentType !== 'application/json') {
        throw new TamiranApiException('نوع محتوای درخواست باید JSON باشد.', 415);
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        throw new TamiranApiException('بدنه درخواست خالی است.');
    }
    if (strlen($raw) > 65536) {
        throw new TamiranApiException('حجم درخواست بیش از حد مجاز است.', 413);
    }

    try {
        $decoded = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new TamiranApiException('ساختار JSON درخواست معتبر نیست.');
    }
    if (!is_array($decoded)) {
        throw new TamiranApiException('بدنه درخواست معتبر نیست.');
    }
    return $decoded;
}

function tamiran_digits(string $value): string
{
    return preg_replace('/[^0-9]/', '', strtr($value, [
        '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
        '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
    ])) ?? '';
}

function tamiran_mobile(string $value): string
{
    $mobile = tamiran_digits($value);
    if (str_starts_with($mobile, '0098')) $mobile = '0' . substr($mobile, 4);
    elseif (str_starts_with($mobile, '98')) $mobile = '0' . substr($mobile, 2);
    elseif (preg_match('/^9\d{9}$/', $mobile)) $mobile = '0' . $mobile;
    if (!preg_match('/^09\d{9}$/', $mobile)) {
        throw new TamiranApiException('شماره موبایل معتبر نیست.');
    }
    return $mobile;
}

function tamiran_password_hash(string $password): string
{
    // bcrypt always fits legacy VARCHAR(60) password columns while remaining
    // portable across the PHP versions commonly available on DirectAdmin.
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    if (!is_string($hash)) throw new TamiranApiException('ساخت رمز امن انجام نشد.', 500);
    return $hash;
}

function tamiran_verify_stored_password(PDO $pdo, int $userId, string $password): void
{
    $statement = $pdo->prepare('SELECT password_hash FROM tamiran_users WHERE id=:id LIMIT 1');
    $statement->execute(['id' => $userId]);
    $storedHash = $statement->fetchColumn();
    if (!is_string($storedHash) || !password_verify($password, $storedHash)) {
        throw new TamiranApiException('ذخیره کامل رمز در دیتابیس انجام نشد؛ طول ستون password_hash باید حداقل ۶۰ کاراکتر باشد.', 500);
    }
}

function tamiran_validate_new_password(string $password): void
{
    $length = function_exists('mb_strlen') ? mb_strlen($password) : strlen($password);
    if ($length < 15 || $length > 1024) {
        throw new TamiranApiException('رمز عبور باید حداقل ۱۵ کاراکتر باشد.');
    }
}

function tamiran_secret_is_configured(string $value): bool
{
    $secret = trim($value);
    return strlen($secret) >= 32
        && !str_starts_with($secret, 'CHANGE_THIS')
        && !str_starts_with($secret, 'REPLACE_');
}

/**
 * Keeps generated installation secrets outside public_html and outside the
 * deployable config template. Existing configured secrets always win so an
 * upgrade never changes the key used for previously encrypted records.
 */
function tamiran_runtime_secret(string $purpose): string
{
    if (!preg_match('/^[a-z0-9_-]{2,40}$/', $purpose)) {
        throw new TamiranApiException('شناسه کلید داخلی معتبر نیست.', 500);
    }

    $directory = tamiran_private_root() . '/runtime-secrets';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new TamiranApiException('پوشه امن کلیدهای سامانه قابل ساخت نیست.', 503);
    }
    @chmod($directory, 0700);
    $path = $directory . '/' . $purpose . '.key';

    $read = static function (string $file): ?string {
        $value = is_file($file) ? trim((string) @file_get_contents($file)) : '';
        return preg_match('/^[a-f0-9]{64}$/', $value) ? $value : null;
    };
    $existing = $read($path);
    if ($existing !== null) return $existing;

    $generated = bin2hex(random_bytes(32));
    $handle = @fopen($path, 'x');
    if ($handle !== false) {
        try {
            if (!flock($handle, LOCK_EX) || fwrite($handle, $generated . PHP_EOL) === false) {
                throw new RuntimeException('نوشتن کلید امن انجام نشد.');
            }
            fflush($handle);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
        @chmod($path, 0600);
        tamiran_log('info', 'runtime_secret_generated', ['purpose'=>$purpose]);
        return $generated;
    }

    // A concurrent request may have created the key between read and fopen.
    $existing = $read($path);
    if ($existing !== null) return $existing;
    throw new TamiranApiException('کلید امن سامانه قابل ساخت یا خواندن نیست.', 503);
}

function tamiran_encryption_key(): string
{
    $secret = (string) (tamiran_config()['secrets']['encryption_key'] ?? '');
    if (!tamiran_secret_is_configured($secret)) $secret = tamiran_runtime_secret('sensitive-data');
    return hash('sha256', $secret, true);
}

function tamiran_encrypt_secret(string $plainText): string
{
    if ($plainText === '') return '';
    $nonce = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($plainText, 'aes-256-gcm', tamiran_encryption_key(), OPENSSL_RAW_DATA, $nonce, $tag);
    if (!is_string($cipher)) throw new TamiranApiException('رمزگذاری اطلاعات حساس انجام نشد.', 500);
    return base64_encode("TMR2\0" . $nonce . $tag . $cipher);
}

function tamiran_decrypt_secret(string $payload): string
{
    if ($payload === '') return '';
    $raw = base64_decode($payload, true);
    if (!is_string($raw) || strlen($raw) < 33 || substr($raw, 0, 5) !== "TMR2\0") {
        throw new TamiranApiException('اطلاعات رمزگذاری‌شده معتبر نیست.', 500);
    }
    $plain = openssl_decrypt(substr($raw, 33), 'aes-256-gcm', tamiran_encryption_key(), OPENSSL_RAW_DATA, substr($raw, 5, 12), substr($raw, 17, 16));
    if (!is_string($plain)) throw new TamiranApiException('رمزگشایی اطلاعات حساس انجام نشد.', 500);
    return $plain;
}

function tamiran_audit(PDO $pdo, int $shopId, ?int $branchId, int $actorId, string $action, string $entityType, string $entityId, mixed $before, mixed $after, ?string $reason = null): void
{
    $statement = $pdo->prepare(
        'INSERT INTO tamiran_audit_log(public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,before_json,after_json,reason,request_id,ip_address,user_agent,created_at)
         VALUES(:public,:shop,:branch,:actor,:action,:entity_type,:entity_id,:before_json,:after_json,:reason,:request_id,:ip,:agent,NOW())'
    );
    $encode = static fn(mixed $value): ?string => $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $statement->execute([
        'public'=>tamiran_id(), 'shop'=>$shopId, 'branch'=>$branchId, 'actor'=>$actorId, 'action'=>$action,
        'entity_type'=>$entityType, 'entity_id'=>$entityId, 'before_json'=>$encode($before), 'after_json'=>$encode($after),
        'reason'=>$reason, 'request_id'=>tamiran_request_id(), 'ip'=>tamiran_client_ip(),
        'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500),
    ]);
}

function tamiran_credential_stamp(array $row): string
{
    return hash('sha256', implode('|', [
        (string) ($row['password_hash'] ?? ''),
        (string) ($row['role_code'] ?? ''),
        (string) ($row['branch_role_code'] ?? ''),
        (string) ($row['permissions_json'] ?? ''),
        (string) ($row['shop_id'] ?? ''),
        (string) ($row['branch_id'] ?? ''),
        // Product/entitlement changes are refreshed into the actor on every
        // request and must not invalidate the authenticated session.
    ]));
}

function tamiran_client_ip(): string
{
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    if (filter_var($remote, FILTER_VALIDATE_IP) === false) return 'unknown';
    try {
        $trusted = array_values(array_filter((array)(tamiran_config()['trusted_proxies'] ?? []), static fn($ip): bool => filter_var($ip, FILTER_VALIDATE_IP) !== false));
    } catch (Throwable) {
        $trusted = [];
    }
    if (!in_array($remote, $trusted, true)) return $remote;
    $forwarded = trim(explode(',', (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
    return filter_var($forwarded, FILTER_VALIDATE_IP) !== false ? $forwarded : $remote;
}

function tamiran_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') return true;
    try {
        $config = tamiran_config();
        $trustForwardedProto = ($config['trust_forwarded_proto'] ?? false) === true
            && in_array((string)($_SERVER['REMOTE_ADDR'] ?? ''), (array)($config['trusted_proxies'] ?? []), true);
    } catch (Throwable) {
        $trustForwardedProto = false;
    }
    return $trustForwardedProto && strtolower(trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0])) === 'https';
}

/** Permit plain HTTP only when explicitly configured for a loopback test server. */
function tamiran_require_https(): void
{
    if (PHP_SAPI === 'cli' || tamiran_is_https()) return;
    $config = tamiran_config();
    $remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $host = strtolower((string)(parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST) ?? ''));
    if (($config['require_https'] ?? true) === false
        && in_array($remote, ['127.0.0.1', '::1'], true)
        && in_array($host, ['127.0.0.1', 'localhost', '[::1]', '::1'], true)) return;
    throw new TamiranApiException('اتصال امن HTTPS برای استفاده از سامانه الزامی است.', 426);
}

function tamiran_public_rate_limit(string $scope, int $limit, int $windowSeconds, int $blockSeconds): void
{
    $pdo = tamiran_db();
    $key = hash('sha256', 'public|' . $scope . '|' . tamiran_client_ip());
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT IGNORE INTO tamiran_auth_throttles(scope_key,failed_attempts,window_started_at) VALUES(:scope,0,NOW())')->execute(['scope'=>$key]);
        $select = $pdo->prepare('SELECT failed_attempts,window_started_at,blocked_until FROM tamiran_auth_throttles WHERE scope_key=:scope FOR UPDATE');
        $select->execute(['scope'=>$key]);
        $row = $select->fetch();
        if (is_array($row) && is_string($row['blocked_until'] ?? null) && strtotime($row['blocked_until']) > time()) {
            $pdo->commit();
            header('Retry-After: ' . max(1, strtotime($row['blocked_until']) - time()));
            throw new TamiranApiException('تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.', 429);
        }
        $expired = !is_array($row) || strtotime((string)$row['window_started_at']) < time() - $windowSeconds;
        $count = $expired ? 1 : ((int)$row['failed_attempts'] + 1);
        $blockedUntil = $count > $limit ? date('Y-m-d H:i:s', time() + $blockSeconds) : null;
        $pdo->prepare('UPDATE tamiran_auth_throttles SET failed_attempts=:count,window_started_at=:started,blocked_until=:blocked,updated_at=NOW() WHERE scope_key=:scope')
            ->execute(['count'=>$count, 'started'=>$expired ? date('Y-m-d H:i:s') : $row['window_started_at'], 'blocked'=>$blockedUntil, 'scope'=>$key]);
        $pdo->commit();
        if ($blockedUntil !== null) {
            header('Retry-After: ' . $blockSeconds);
            throw new TamiranApiException('تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.', 429);
        }
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function tamiran_csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        $config = tamiran_config();
        tamiran_require_https();
        $sessionTtl = max(1800, min(604800, (int) ($config['session_ttl'] ?? 43200)));
        ini_set('session.gc_maxlifetime', (string) $sessionTtl);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_name('tamiran_session');
        session_set_cookie_params([
            'lifetime' => $sessionTtl,
            'path' => '/',
            'secure' => tamiran_is_https(),
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        session_start();
    }

    if (!isset($_SESSION['tamiran_csrf']) || !is_string($_SESSION['tamiran_csrf'])) {
        $_SESSION['tamiran_csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['tamiran_csrf'];
}

function tamiran_require_csrf(): void
{
    if(PHP_SAPI!=='cli') {
        $origin=strtolower(trim((string)($_SERVER['HTTP_ORIGIN']??'')));
        $expected=(tamiran_is_https()?'https':'http').'://'.strtolower((string)($_SERVER['HTTP_HOST']??''));
        if($origin!==$expected || (string)($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')
            throw new TamiranApiException('مبدأ درخواست معتبر نیست.',403);
    }
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($provided === '' || !hash_equals(tamiran_csrf_token(), $provided)) {
        throw new TamiranApiException('اعتبار نشست پایان یافته است؛ صفحه را تازه‌سازی کنید.', 419);
    }
}

function tamiran_id(): string
{
    return strtoupper(substr(bin2hex(random_bytes(16)), 0, 26));
}

/** RFC 9562 UUIDv7 for immutable repair-case identity. */
function tamiran_uuid_v7(): string
{
    $milliseconds = (int) floor(microtime(true) * 1000);
    $bytes = random_bytes(16);
    for ($index = 5; $index >= 0; $index--) {
        $bytes[$index] = chr($milliseconds & 0xff);
        $milliseconds >>= 8;
    }
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x70);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}

/** 192-bit URL-safe bearer token used only for the secure customer link. */
function tamiran_tracking_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

function tamiran_forget_actor(): void
{
    unset(
        $_SESSION['tamiran_actor'],
        $_SESSION['tamiran_actor_issued_at'],
        $_SESSION['tamiran_actor_last_activity'],
        $_SESSION['tamiran_credential_stamp'],
        $_SESSION['tamiran_session_token']
    );
}

function tamiran_release_active_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) return;
    $stored = $_SESSION['tamiran_actor'] ?? null;
    $token = $_SESSION['tamiran_session_token'] ?? null;
    if (!is_array($stored) || !is_string($token) || ($stored['role'] ?? '') === 'central_admin') return;
    $userId = (int) ($stored['id'] ?? 0);
    if ($userId < 1 || !preg_match('/^[a-f0-9]{64}$/', $token)) return;
    $hash = hash('sha256', $token);
    try {
        $pdo = tamiran_db();
        $pdo->beginTransaction();
        $clear=$pdo->prepare('UPDATE tamiran_users SET active_session_hash=NULL WHERE id=:id AND active_session_hash=:hash');
        $clear->execute(['id'=>$userId, 'hash'=>$hash]);
        if($clear->rowCount()!==1){$pdo->commit();return;}
        $shopId = (int)($stored['shop']['id'] ?? 0);
        if ($shopId > 0) {
            $pdo->prepare("INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,user_agent) VALUES(:public,:shop,:user,'logout',:hash,:request,:ip,:agent)")
                ->execute(['public'=>tamiran_id(),'shop'=>$shopId,'user'=>$userId,'hash'=>$hash,'request'=>tamiran_request_id(),'ip'=>tamiran_client_ip(),'agent'=>substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,500)]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();
        tamiran_log('warning', 'active_session_release_failed', ['user_id'=>$userId, 'message'=>$error->getMessage()]);
    }
}

function tamiran_actor(): ?array
{
    tamiran_csrf_token();
    if (!isset($_SESSION['tamiran_actor']) || !is_array($_SESSION['tamiran_actor'])) return null;

    $config = tamiran_config();
    $now = time();
    $idleTtl = max(300, min(14400, (int) ($config['session_idle_ttl'] ?? 3600)));
    $absoluteTtl = max($idleTtl, min(86400, (int) ($config['session_ttl'] ?? 43200)));
    $issuedAt = (int) ($_SESSION['tamiran_actor_issued_at'] ?? 0);
    $lastActivity = (int) ($_SESSION['tamiran_actor_last_activity'] ?? 0);
    if ($issuedAt < 1 || $lastActivity < 1 || ($now - $issuedAt) > $absoluteTtl || ($now - $lastActivity) > $idleTtl) {
        tamiran_forget_actor();
        return null;
    }

    $stored = $_SESSION['tamiran_actor'];
    $userId = (int) ($stored['id'] ?? 0);
    if ($userId < 1) {
        tamiran_forget_actor();
        return null;
    }
    $pdo = tamiran_db();
    if (($stored['role'] ?? '') === 'central_admin') {
        $statement = $pdo->prepare("SELECT id,display_name,role_code,password_hash FROM tamiran_users WHERE id=:id AND shop_id IS NULL AND role_code='central_admin' AND is_active=1 LIMIT 1");
        $statement->execute(['id' => $userId]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            tamiran_forget_actor();
            return null;
        }
        $actor = [
            'id'=>(int)$row['id'], 'displayName'=>$row['display_name'], 'role'=>'central_admin', 'isCentralAdmin'=>true,
            'branch'=>null, 'shop'=>null,
        ];
    } else {
        $branchId = (int) ($stored['branch']['id'] ?? 0);
        $statement = $pdo->prepare(
            'SELECT u.id AS user_id,u.display_name,u.role_code,u.password_hash,u.active_session_hash,u.must_change_password,
                    s.id AS shop_id,s.shop_code,s.public_shop_code,s.name AS shop_name,s.repair_type,s.plan_code,s.modules_json,
                    s.product_profile,s.inventory_mode,s.qc_mode,s.feature_flags_json,
                    s.lifecycle_status,s.license_expires_at,s.national_code_required,
                    b.id AS branch_id,b.branch_code,b.name AS branch_name,ub.branch_role_code,ub.permissions_json
             FROM tamiran_users u INNER JOIN repair_shops s ON s.id=u.shop_id
             INNER JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=s.id AND ub.is_active=1
             INNER JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=s.id
             WHERE u.id=:user_id AND b.id=:branch_id AND u.is_active=1 AND b.is_active=1 LIMIT 1'
        );
        $statement->execute(['user_id'=>$userId, 'branch_id'=>$branchId]);
        $row = $statement->fetch();
        if (!is_array($row) || tamiran_license_state($row) === 'suspended') {
            tamiran_forget_actor();
            return null;
        }
        {
            $sessionToken = (string) ($_SESSION['tamiran_session_token'] ?? '');
            $activeSessionHash = (string) ($row['active_session_hash'] ?? '');
            if (!preg_match('/^[a-f0-9]{64}$/', $sessionToken)
                || !preg_match('/^[a-f0-9]{64}$/', $activeSessionHash)
                || !hash_equals($activeSessionHash, hash('sha256', $sessionToken))) {
                tamiran_log('warning', 'actor_session_invalidated', [
                    'user_id'=>$userId,
                    'reason'=>'active_session_mismatch',
                ]);
                tamiran_forget_actor();
                return null;
            }
        }
        $actor = [
            'id'=>(int)$row['user_id'], 'displayName'=>$row['display_name'], 'role'=>$row['branch_role_code'] ?: $row['role_code'],
            'mustChangePassword'=>(bool)$row['must_change_password'],
            'primaryRole'=>$row['role_code'], 'permissions'=>json_decode((string)$row['permissions_json'], true) ?: [], 'isCentralAdmin'=>false,
            'branch'=>['id'=>(int)$row['branch_id'],'code'=>$row['branch_code'],'name'=>$row['branch_name']],
            'shop'=>[
                'id'=>(int)$row['shop_id'],'code'=>$row['shop_code'],'publicCode'=>$row['public_shop_code'],'name'=>$row['shop_name'],'repairType'=>$row['repair_type'],'plan'=>$row['plan_code'],
                'modules'=>json_decode((string)$row['modules_json'],true)?:['repair'],
                'productProfile'=>$row['product_profile'],'inventoryMode'=>$row['inventory_mode'],'qcMode'=>$row['qc_mode'],
                'featureFlags'=>json_decode((string)$row['feature_flags_json'],true)?:[],
                'licenseStatus'=>tamiran_license_state($row),'expiresAt'=>$row['license_expires_at'],'nationalCodeRequired'=>(bool)$row['national_code_required'],
            ],
        ];
    }
    $credentialStamp = tamiran_credential_stamp($row);
    if (!isset($_SESSION['tamiran_credential_stamp']) || !hash_equals((string) $_SESSION['tamiran_credential_stamp'], $credentialStamp)) {
        tamiran_forget_actor();
        return null;
    }
    $_SESSION['tamiran_actor'] = $actor;
    $_SESSION['tamiran_actor_last_activity'] = $now;
    return $actor;
}

function tamiran_require_actor(): array
{
    $actor = tamiran_actor();
    if ($actor === null) {
        throw new TamiranApiException('برای انجام این عملیات وارد سامانه شوید.', 401);
    }
    if(!empty($actor['mustChangePassword']) && basename((string)($_SERVER['SCRIPT_FILENAME']??''))!=='auth.php')
        throw new TamiranApiException('ابتدا رمز اولیه حساب را تغییر دهید.',403);
    return $actor;
}

function tamiran_require_central_admin(): array
{
    $actor = tamiran_require_actor();
    if (($actor['role'] ?? '') !== 'central_admin') {
        throw new TamiranApiException('این عملیات فقط برای ادمین تعمیران مجاز است.', 403);
    }
    return $actor;
}

function tamiran_require_shop_manager(): array
{
    $actor = tamiran_require_actor();
    if (!in_array((string) ($actor['role'] ?? ''), ['repair_manager', 'central_admin'], true)) {
        throw new TamiranApiException('دسترسی مدیر تعمیرگاه لازم است.', 403);
    }
    return $actor;
}

function tamiran_require_writable_actor(?array $actor = null): array
{
    $actor ??= tamiran_require_actor();
    if (is_array($actor['shop'] ?? null) && ($actor['shop']['licenseStatus'] ?? 'active') !== 'active') {
        throw new TamiranApiException('اشتراک تعمیرگاه در حالت فقط‌مشاهده یا منقضی است و ثبت تغییر مجاز نیست.', 403);
    }
    return $actor;
}

function tamiran_validate_national_code(string $value): bool
{
    $digits = preg_replace('/[^0-9]/', '', strtr($value, ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9'])) ?? '';
    if (!preg_match('/^\d{10}$/', $digits) || preg_match('/^(\d)\1{9}$/', $digits)) return false;
    $sum = 0;
    for ($i = 0; $i < 9; $i++) $sum += (int) $digits[$i] * (10 - $i);
    $remainder = $sum % 11;
    $check = $remainder < 2 ? $remainder : 11 - $remainder;
    return $check === (int) $digits[9];
}

function tamiran_license_state(array $shop): string
{
    if (($shop['lifecycle_status'] ?? '') === 'suspended') return 'suspended';
    if (strtotime((string) $shop['license_expires_at']) < strtotime('today')) return 'expired';
    return (string) ($shop['lifecycle_status'] ?? 'active');
}

function tamiran_require_debug_token(): void
{
    $config = tamiran_config();
    if (($config['debug_enabled'] ?? false) !== true) {
        throw new TamiranApiException('حالت دیباگ غیرفعال است.', 404);
    }

    $expected = (string) ($config['debug_token'] ?? '');
    $provided = (string) ($_SERVER['HTTP_X_DEBUG_TOKEN'] ?? '');
    if (!tamiran_secret_is_configured($expected) || !hash_equals($expected, $provided)) {
        throw new TamiranApiException('دسترسی دیباگ مجاز نیست.', 403);
    }
}

function tamiran_respond(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Request-ID: ' . tamiran_request_id());
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (tamiran_is_https()) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tamiran_fail(Throwable $error): never
{
    $status = $error instanceof TamiranApiException ? $error->httpStatus : 500;
    $publicMessage = $status >= 500 ? 'خطای داخلی سرور رخ داد.' : $error->getMessage();
    if ($status >= 500) {
        tamiran_log('error', 'api_request_failed', [
            'exception' => get_class($error), 'message' => $error->getMessage(),
            'file' => basename($error->getFile()), 'line' => $error->getLine(), 'status' => $status,
        ]);
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Request-ID: ' . tamiran_request_id());
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (tamiran_is_https()) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    echo json_encode([
        'ok' => false,
        'error' => [
            'message' => $publicMessage,
            'tracking_code' => tamiran_request_id(),
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tamiran_api(callable $handler): never
{
    $lock = null;
    try {
        tamiran_require_https();
        // Backup restore takes the exclusive side of this lock. Keep regular
        // application requests from racing schema/data replacement.
        $route = basename((string)($_SERVER['SCRIPT_FILENAME'] ?? ''));
        if (!in_array($route, ['backups.php','backup-cron.php'], true)) {
            $lock = fopen(tamiran_private_root() . '/application.lock', 'c');
            if ($lock === false || !flock($lock, LOCK_SH | LOCK_NB))
                throw new TamiranApiException('سامانه در حال بازیابی است؛ کمی بعد تلاش کنید.', 503);
        }
        $result = $handler();
    } catch (Throwable $error) {
        if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); }
        tamiran_fail($error);
    }
    if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); }
    tamiran_respond($result);
}

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if ((error_reporting() & $severity) === 0) {
        return true;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        tamiran_log('critical', 'php_fatal_error', [
            'message' => $error['message'],
            'file' => basename($error['file']),
            'line' => $error['line'],
        ]);
    }
});
