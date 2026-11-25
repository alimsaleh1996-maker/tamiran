<?php
declare(strict_types=1);

/** Installation errors contain safe operator messages only, never PDO messages. */
final class TamiranInstallException extends RuntimeException {}

function tamiran_install_request_id(): string
{
    static $id = null;
    return $id ??= bin2hex(random_bytes(12));
}

/** Installer has no config yet; log bounded metadata only, never SQL or credentials. */
function tamiran_install_log(string $privateDir, string $event, string $stage = 'preparation', int $statement = 0, ?Throwable $error = null): void
{
    $dir = $privateDir . '/logs';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $record = ['time'=>gmdate('c'), 'level'=>$event === 'install_completed' ? 'INFO' : 'WARNING',
        'event'=>$event, 'request_id'=>tamiran_install_request_id(), 'stage'=>$stage, 'statement'=>$statement];
    if ($error instanceof PDOException) {
        $state = (string) $error->getCode();
        if (preg_match('/^[A-Z0-9]{5}$/D', $state)) $record['sqlstate'] = $state;
        $vendor = $error->errorInfo[1] ?? null;
        if (is_int($vendor) || (is_string($vendor) && ctype_digit($vendor) && strlen($vendor) <= 6)) $record['db_code'] = (int) $vendor;
    }
    $oldUmask = umask(0077);
    $written = @file_put_contents($dir . '/tamiran-' . gmdate('Y-m-d') . '.log', json_encode($record, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . PHP_EOL, FILE_APPEND | LOCK_EX);
    umask($oldUmask);
    if ($written === false && function_exists('error_log')) error_log('tamiran: unable to write private installer log');
}

/** Check exclusive creation and same-directory rename before any database writes. */
function tamiran_install_check_config_publication(string $privateDir): void
{
    $source = $privateDir . '/.install-publish-check-' . bin2hex(random_bytes(12));
    $target = $source . '.target';
    $oldUmask = umask(0077);
    $handle = @fopen($source, 'xb');
    umask($oldUmask);
    if (!$handle) throw new TamiranInstallException('ساخت فایل آزمایشی در پوشه private ممکن نیست؛ نصب پیش از ساخت جدول متوقف شد.');
    try {
        if (!chmod($source, 0600) || fwrite($handle, 'test') !== 4 || !fflush($handle)) {
            throw new TamiranInstallException('نوشتن فایل امن در پوشه private ممکن نیست؛ نصب پیش از ساخت جدول متوقف شد.');
        }
        fclose($handle); $handle = null;
        if (!@rename($source, $target) || @file_get_contents($target) !== 'test') {
            throw new TamiranInstallException('انتقال امن فایل در پوشه private ممکن نیست؛ نصب پیش از ساخت جدول متوقف شد.');
        }
    } finally {
        if (is_resource($handle)) fclose($handle);
        @unlink($target);
        @unlink($source);
    }
}

/** Publish a complete file while holding the installer mutex; never replace an existing config. */
function tamiran_install_publish_config(string $temporary, string $privateDir): void
{
    $target = $privateDir . '/config.php';
    if (function_exists('link') && @link($temporary, $target)) return;
    // Reserve the name exclusively. The fail-closed placeholder prevents an
    // interrupted installation from exposing a partially written PHP config.
    $oldUmask = umask(0077);
    $handle = @fopen($target, 'xb');
    umask($oldUmask);
    if (!$handle) throw new RuntimeException('CONFIG_PUBLISH_FAILED');
    $identity = fstat($handle);
    $placeholder = "<?php http_response_code(503); exit;\n";
    try {
        if (!chmod($target, 0600) || fwrite($handle, $placeholder) !== strlen($placeholder) || !fflush($handle)) throw new RuntimeException('CONFIG_PUBLISH_FAILED');
        if (function_exists('fsync') && !fsync($handle)) throw new RuntimeException('CONFIG_PUBLISH_FAILED');
        $current = @lstat($target);
        if (!is_array($identity) || !is_array($current) || $identity['dev'] !== $current['dev'] || $identity['ino'] !== $current['ino']) throw new RuntimeException('CONFIG_PUBLISH_FAILED');
        if (!@rename($temporary, $target)) throw new RuntimeException('CONFIG_PUBLISH_FAILED');
    } catch (Throwable $error) {
        $current = @lstat($target);
        if (is_array($identity) && is_array($current) && $identity['dev'] === $current['dev'] && $identity['ino'] === $current['ino']) @unlink($target);
        throw $error;
    } finally { fclose($handle); }
}

/** Do not expose raw SQL errors, credentials, SQL text or filesystem paths. */
function tamiran_install_safe_diagnostic(Throwable $error, string $stage, int $statementNumber, int $statementCount): string
{
    $labels = ['schema' => 'ساخت ساختار پایگاه داده', 'admin' => 'ساخت حساب مدیر', 'config' => 'نوشتن تنظیمات خصوصی', 'publish' => 'فعال‌سازی تنظیمات خصوصی'];
    $details = 'مرحله: ' . ($labels[$stage] ?? 'آماده‌سازی نصب');
    if ($stage === 'schema' && $statementNumber > 0 && $statementCount >= $statementNumber) $details .= '؛ دستور ' . $statementNumber . ' از ' . $statementCount;
    if ($error instanceof PDOException) {
        $state = (string) $error->getCode();
        if (preg_match('/^[A-Z0-9]{5}$/D', $state)) $details .= '؛ SQLSTATE: ' . $state;
        $vendor = $error->errorInfo[1] ?? null;
        if (is_int($vendor) || (is_string($vendor) && ctype_digit($vendor) && strlen($vendor) <= 6)) $details .= '؛ کد دیتابیس: ' . (int) $vendor;
    } elseif (in_array($error->getMessage(), ['CONFIG_TEMP_FAILED', 'CONFIG_WRITE_FAILED', 'CONFIG_SYNC_FAILED', 'CONFIG_PUBLISH_FAILED'], true)) {
        $details .= '؛ کد: ' . $error->getMessage();
    }
    return $details;
}

function tamiran_install_preflight(string $privateDir): array
{
    return [
        'PHP 8.2 یا بالاتر' => PHP_VERSION_ID >= 80200,
        'PDO MySQL' => extension_loaded('pdo_mysql'),
        'mbstring' => extension_loaded('mbstring'),
        'OpenSSL' => extension_loaded('openssl'),
        'پوشه private قابل نوشتن' => is_dir($privateDir) && is_writable($privateDir),
        'فایل ساختار پایگاه داده' => is_readable($privateDir . '/database/schema.sql'),
        'پایان‌نیافتن نصب قبلی' => !tamiran_install_is_complete($privateDir),
    ];
}

function tamiran_install_is_complete(string $privateDir): bool
{
    return file_exists($privateDir . '/config.php') || file_exists($privateDir . '/installed.lock');
}

/** First-install ownership is proven by private filesystem access, not web session. */
function tamiran_install_ensure_key(string $privateDir): void
{
    $path = $privateDir . '/install.key';
    if (!file_exists($path)) {
        $oldUmask = umask(0077);
        $handle = @fopen($path, 'xb');
        umask($oldUmask);
        if (is_resource($handle)) {
            try {
                $key = bin2hex(random_bytes(32)) . "\n";
                if (!chmod($path, 0600) || fwrite($handle, $key) !== strlen($key) || !fflush($handle)) {
                    throw new TamiranInstallException('ساخت کلید نصب در پوشه private ممکن نشد.');
                }
            } finally { fclose($handle); }
        }
    }
    $key = @file_get_contents($path);
    if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/D', trim($key))) {
        throw new TamiranInstallException('کلید نصب private/install.key موجود یا معتبر نیست؛ دسترسی فایل را در پنل هاست بررسی کنید.');
    }
}

function tamiran_install_verify_key(string $privateDir, mixed $provided): void
{
    $expected = @file_get_contents($privateDir . '/install.key');
    if (!is_string($provided) || !is_string($expected) || !preg_match('/^[a-f0-9]{64}$/D', trim($expected)) || !hash_equals(trim($expected), trim($provided))) {
        throw new TamiranInstallException('کلید نصب معتبر نیست. مقدار فایل private/install.key را از مدیریت فایل هاست کپی کنید.');
    }
}

/** Parse this trusted bundled schema, including the mysql-client DELIMITER blocks. */
function tamiran_install_sql_statements(string $sql): array
{
    $statements = [];
    $buffer = '';
    $delimiter = ';';
    foreach (preg_split('/\R/u', $sql) ?: [] as $line) {
        if (preg_match('/^\s*DELIMITER\s+(\S+)\s*$/i', $line, $match)) {
            if (trim($buffer) !== '') throw new TamiranInstallException('ساختار فایل SQL معتبر نیست.');
            $delimiter = $match[1];
            continue;
        }
        if (preg_match('/^\s*(?:--|#)/', $line)) continue;
        $buffer .= $line . "\n";
        $trimmed = rtrim($buffer);
        if ($trimmed !== '' && str_ends_with($trimmed, $delimiter)) {
            $statement = trim(substr($trimmed, 0, -strlen($delimiter)));
            if ($statement !== '') $statements[] = $statement;
            $buffer = '';
        }
    }
    if (trim($buffer) !== '') throw new TamiranInstallException('پایان فایل SQL کامل نیست.');
    return $statements;
}

function tamiran_install_mobile(string $mobile): string
{
    $mobile = strtr(trim($mobile), array_combine(
        preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY),
        str_split('01234567890123456789')
    ));
    if (!preg_match('/^09[0-9]{9}$/D', $mobile)) {
        throw new TamiranInstallException('شماره موبایل مدیر باید ۱۱ رقم و با 09 شروع شود.');
    }
    return $mobile;
}

function tamiran_install_validate(array $input): array
{
    foreach (['db_host', 'db_port', 'db_name', 'db_user', 'db_password', 'admin_name', 'admin_mobile', 'admin_password', 'admin_password_confirmation'] as $field) {
        if (!isset($input[$field]) || !is_string($input[$field])) {
            throw new TamiranInstallException('همه فیلدهای نصب را تکمیل کنید.');
        }
    }
    $host = trim($input['db_host']);
    $name = trim($input['db_name']);
    $user = trim($input['db_user']);
    $port = filter_var($input['db_port'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
    if (!preg_match('/^[A-Za-z0-9_.:-]{1,253}$/D', $host) || !preg_match('/^[A-Za-z0-9_$-]{1,64}$/D', $name) || !$port || $user === '' || strlen($user) > 190 || str_contains($user, "\0") || str_contains($input['db_password'], "\0")) {
        throw new TamiranInstallException('مشخصات اتصال پایگاه داده معتبر نیست.');
    }
    $displayName = trim($input['admin_name']);
    if ($displayName === '' || mb_strlen($displayName, 'UTF-8') > 180) {
        throw new TamiranInstallException('نام مدیر را بین ۱ تا ۱۸۰ نویسه وارد کنید.');
    }
    $password = $input['admin_password'];
    // Bcrypt truncates after 72 bytes; reject rather than silently weaken passwords.
    if (strlen($password) < 12 || strlen($password) > 72 || str_contains($password, "\0") || !preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
        throw new TamiranInstallException('رمز مدیر باید ۱۲ تا ۷۲ بایت و شامل حرف انگلیسی، عدد و نشانه باشد.');
    }
    if (!hash_equals($password, $input['admin_password_confirmation'])) {
        throw new TamiranInstallException('رمز مدیر و تکرار آن یکسان نیستند.');
    }
    return [
        'db' => ['host' => $host, 'port' => $port, 'name' => $name, 'user' => $user, 'password' => $input['db_password'], 'charset' => 'utf8mb4'],
        'admin' => ['name' => $displayName, 'mobile' => tamiran_install_mobile($input['admin_mobile']), 'password' => $password],
    ];
}

/**
 * Install into an existing EMPTY database. MySQL DDL cannot be rolled back.
 * On partial failure, leave its tables intact and refuse that nonempty DB on retry.
 * The operator must choose a new empty DB, or explicitly empty this installer-only DB.
 */
function tamiran_install(array $input, string $privateDir): array
{
    foreach (tamiran_install_preflight($privateDir) as $label => $passed) {
        if (!$passed) throw new TamiranInstallException('پیش‌نیاز نصب برقرار نیست: ' . $label);
    }
    $values = tamiran_install_validate($input);
    $oldUmask = umask(0077);
    $mutex = @fopen($privateDir . '/.install.mutex', 'c');
    umask($oldUmask);
    if (!$mutex || !flock($mutex, LOCK_EX | LOCK_NB)) {
        if (is_resource($mutex)) fclose($mutex);
        throw new TamiranInstallException('نصب دیگری در حال اجرا است؛ کمی بعد دوباره تلاش کنید.');
    }
    $pdo = null;
    $databaseLock = false;
    $schemaStarted = false;
    $temporary = null;
    $stage = 'preparation';
    $statementNumber = 0;
    $statementCount = 0;
    try {
        if (tamiran_install_is_complete($privateDir)) throw new TamiranInstallException('نصب قبلاً کامل شده است؛ نصب دوباره مجاز نیست.');
        $db = $values['db'];
        try {
            $pdo = new PDO("mysql:host={$db['host']};port={$db['port']};dbname={$db['name']};charset=utf8mb4", $db['user'], $db['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 10,
                PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
            ]);
        } catch (Throwable) {
            throw new TamiranInstallException('اتصال برقرار نشد. نام دیتابیس، کاربر، رمز و دسترسی کاربر را در پنل هاست بررسی کنید.');
        }
        $lockName = 'tamiran-install-' . substr(hash('sha256', $db['name']), 0, 40);
        $lock = $pdo->prepare('SELECT GET_LOCK(?,0)');
        $lock->execute([$lockName]);
        if ((int) $lock->fetchColumn() !== 1) throw new TamiranInstallException('این پایگاه داده در حال نصب است؛ بعداً تلاش کنید.');
        $databaseLock = true;
        if ($pdo->query('SHOW FULL TABLES')->fetch()) {
            throw new TamiranInstallException('پایگاه داده خالی نیست. هیچ داده‌ای تغییر نکرد؛ برای نصب، یک دیتابیس خالی در پنل هاست بسازید.');
        }
        tamiran_install_check_config_publication($privateDir);
        $schema = file_get_contents($privateDir . '/database/schema.sql');
        if ($schema === false) throw new TamiranInstallException('فایل ساختار پایگاه داده خوانده نشد.');
        $statements = tamiran_install_sql_statements($schema);
        $hash = password_hash($values['admin']['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        if ($hash === false) throw new TamiranInstallException('ساخت رمز امن مدیر ممکن نشد.');
        $schemaStarted = true;
        $stage = 'schema';
        $statementCount = count($statements);
        foreach ($statements as $statement) { $statementNumber++; $pdo->exec($statement); }
        $stage = 'admin';
        $pdo->beginTransaction();
        $admin = $pdo->prepare("INSERT INTO tamiran_users(shop_id,username,display_name,phone,password_hash,role_code,must_change_password,is_active) VALUES(NULL,?,?,?,?,'central_admin',0,1)");
        $admin->execute([$values['admin']['mobile'], $values['admin']['name'], $values['admin']['mobile'], $hash]);
        $adminId = (int) $pdo->lastInsertId();
        $pdo->commit();

        $stage = 'config';
        $config = [
            'db' => $db, 'timezone' => 'UTC',
            'secrets' => ['encryption_key' => base64_encode(random_bytes(32))],
            'session_ttl' => 43200, 'session_idle_ttl' => 3600,
            'require_https' => true, 'trusted_proxies' => [], 'trust_forwarded_proto' => false,
            'debug_enabled' => false, 'debug_token' => '',
            'retention' => ['cron_token' => bin2hex(random_bytes(32))],
            'sms' => ['enabled' => false, 'test_sink' => false, 'cron_token' => bin2hex(random_bytes(32))],
            'backup' => ['cron_token' => bin2hex(random_bytes(32)), 'max_archive_bytes' => 67108864],
        ];
        $temporary = $privateDir . '/.config-' . bin2hex(random_bytes(12)) . '.tmp';
        $oldUmask = umask(0077);
        $handle = @fopen($temporary, 'xb');
        umask($oldUmask);
        if (!$handle) throw new RuntimeException('CONFIG_TEMP_FAILED');
        $body = "<?php\ndeclare(strict_types=1);\n// Generated by the installer. Keep outside the web root.\nreturn " . var_export($config, true) . ";\n";
        try {
            if (!chmod($temporary, 0600) || fwrite($handle, $body) !== strlen($body) || !fflush($handle)) throw new RuntimeException('CONFIG_WRITE_FAILED');
            if (function_exists('fsync') && !fsync($handle)) throw new RuntimeException('CONFIG_SYNC_FAILED');
        } finally { fclose($handle); }
        // Installer mutex and exclusive reservation prevent concurrent installer overwrites.
        $stage = 'publish';
        tamiran_install_publish_config($temporary, $privateDir);
        @unlink($temporary);
        $temporary = null;
        $oldUmask = umask(0077);
        @file_put_contents($privateDir . '/installed.lock', gmdate('c') . "\n", LOCK_EX);
        umask($oldUmask);
        @unlink($privateDir . '/install.key');
        tamiran_install_log($privateDir, 'install_completed', 'complete');
        return ['admin_id' => $adminId, 'mobile' => $values['admin']['mobile'], 'tables' => count($pdo->query('SHOW FULL TABLES')->fetchAll())];
    } catch (Throwable $error) {
        if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
        tamiran_install_log($privateDir, 'install_failed', $stage, $statementNumber, $error);
        if ($error instanceof TamiranInstallException) throw $error;
        throw new TamiranInstallException($schemaStarted
            ? 'نصب کامل نشد و فایل تنظیمات فعال نشد. جدول‌های نصب ناقص حفظ شدند؛ برای تکرار از دیتابیس خالی تازه استفاده کنید. ' . tamiran_install_safe_diagnostic($error, $stage, $statementNumber, $statementCount) . '. دسترسی CREATE، ALTER، INDEX و TRIGGER و سازگاری MySQL 8 یا MariaDB 10.6+ را بررسی کنید.'
            : 'نصب آغاز نشد. دسترسی دیتابیس و قابلیت قفل نصب روی هاست را بررسی کنید.');
    } finally {
        if ($temporary !== null) @unlink($temporary);
        if ($databaseLock && $pdo instanceof PDO) {
            try { $release = $pdo->prepare('SELECT RELEASE_LOCK(?)'); $release->execute([$lockName]); } catch (Throwable) {}
        }
        flock($mutex, LOCK_UN);
        fclose($mutex);
    }
}
