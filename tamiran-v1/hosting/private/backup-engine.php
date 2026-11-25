<?php
declare(strict_types=1);

function tamiran_backup_config(): array { return (array) (tamiran_config()['backup'] ?? []); }

function tamiran_backup_root(): string
{
    $path = tamiran_private_root() . '/backups';
    if (is_link($path) || (!is_dir($path) && !mkdir($path, 0700, true))) throw new TamiranApiException('فضای خصوصی پشتیبان قابل استفاده نیست.', 503);
    return $path;
}

function tamiran_backup_settings(PDO $pdo): array
{
    $row = $pdo->query('SELECT * FROM tamiran_backup_settings WHERE id=1')->fetch();
    if (!is_array($row)) throw new TamiranApiException('تنظیمات پشتیبان نصب نشده است.', 503);
    return $row;
}

function tamiran_backup_health(PDO $pdo): array
{
    $local = false;
    try { $local = is_writable(tamiran_backup_root()); } catch (Throwable) {}
    $latest = $pdo->query("SELECT * FROM tamiran_backup_jobs WHERE local_status='succeeded' ORDER BY created_at DESC,id DESC LIMIT 1")->fetch();
    $global = $pdo->query("SELECT * FROM tamiran_backup_jobs WHERE backup_type='global' AND local_status='succeeded' ORDER BY created_at DESC,id DESC LIMIT 1")->fetch();
    return [
        'settings' => tamiran_backup_settings($pdo), 'localReady' => $local, 'offsiteConfigured' => false,
        'latest' => is_array($latest) ? $latest : null, 'latestGlobal' => is_array($global) ? $global : null,
        'failed24Hours' => (int) $pdo->query("SELECT COUNT(*) FROM tamiran_backup_jobs WHERE status='failed' AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR)")->fetchColumn(),
        'format' => 'tamiran-encrypted-json-v1',
        'offsiteNote' => 'این بسته پشتیبان خصوصی محلی دارد؛ ذخیره‌سازی خارج از هاست پیکربندی نشده است.',
    ];
}

function tamiran_backup_identifier(string $name): string
{
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,63}$/', $name)) throw new TamiranApiException('شناسهٔ ساختار پشتیبان معتبر نیست.', 422);
    return '`' . $name . '`';
}

/** Metadata is taken from this connection's database, never an archive query. */
function tamiran_backup_metadata(PDO $pdo): array
{
    $tables = [];
    $query = $pdo->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
    foreach ($query as $row) {
        $name = (string) $row['TABLE_NAME'];
        if (!preg_match('/^(repair_|tamiran_)[A-Za-z0-9_]+$/', $name) || in_array($name, ['tamiran_backup_jobs', 'tamiran_backup_restores'], true)) continue;
        if (strtolower((string) $row['ENGINE']) !== 'innodb') throw new TamiranApiException('پشتیبان سازگار به جدول‌های InnoDB نیاز دارد.', 409);
        $tables[$name] = ['columns' => [], 'primary' => [], 'foreign' => []];
    }
    foreach ($tables as $name => &$meta) {
        $q = $pdo->prepare('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION');
        $q->execute([$name]);
        foreach ($q as $column) $meta['columns'][(string) $column['COLUMN_NAME']] = [(string) $column['COLUMN_TYPE'], (string) $column['IS_NULLABLE'], (string) $column['EXTRA']];
        $q = $pdo->prepare("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX");
        $q->execute([$name]); $meta['primary'] = $q->fetchAll(PDO::FETCH_COLUMN);
        $q = $pdo->prepare('SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME,ORDINAL_POSITION');
        $q->execute([$name]);
        foreach ($q as $fk) {
            $key = (string) $fk['CONSTRAINT_NAME'];
            $meta['foreign'][$key]['table'] = (string) $fk['REFERENCED_TABLE_NAME'];
            $meta['foreign'][$key]['columns'][(string) $fk['COLUMN_NAME']] = (string) $fk['REFERENCED_COLUMN_NAME'];
        }
    }
    unset($meta);
    return $tables;
}

/** Scope uses tenant columns or structural parents, never actor/author fields. */
function tamiran_backup_scope(array $metadata, string $table, string $alias = 't', array $trail = []): ?string
{
    if (isset($trail[$table]) || !isset($metadata[$table])) return null;
    $trail[$table] = true;
    if ($table === 'repair_shops') return $alias . '.`id`=?';
    $columns = $metadata[$table]['columns'];
    foreach (['shop_id', 'repair_shop_id'] as $column) if (isset($columns[$column])) return $alias . '.' . tamiran_backup_identifier($column) . '=?';
    foreach ($metadata[$table]['foreign'] as $fk) {
        if (in_array($fk['table'], ['tamiran_users', 'repair_branches'], true)) continue;
        $parentAlias = 'p' . count($trail);
        $scope = tamiran_backup_scope($metadata, $fk['table'], $parentAlias, $trail);
        if ($scope === null) continue;
        $join = [];
        foreach ($fk['columns'] as $local => $remote) $join[] = $alias . '.' . tamiran_backup_identifier($local) . '=' . $parentAlias . '.' . tamiran_backup_identifier($remote);
        return 'EXISTS(SELECT 1 FROM ' . tamiran_backup_identifier($fk['table']) . ' ' . $parentAlias . ' WHERE ' . implode(' AND ', $join) . ' AND ' . $scope . ')';
    }
    return null;
}

function tamiran_backup_order(array $metadata, array $names): array
{
    $pending = array_fill_keys($names, true); $done = [];
    while ($pending !== []) {
        $progress = false;
        foreach (array_keys($pending) as $table) {
            $blocked = false;
            foreach ($metadata[$table]['foreign'] as $fk) if ($fk['table'] !== $table && isset($pending[$fk['table']])) { $blocked = true; break; }
            if (!$blocked) { $done[] = $table; unset($pending[$table]); $progress = true; }
        }
        if (!$progress) throw new TamiranApiException('وابستگی حلقوی جدول‌ها به بازیابی تخصصی نیاز دارد؛ تغییری اعمال نشد.', 409);
    }
    return $done;
}

function tamiran_backup_limit(): int
{
    static $limit = null;
    if ($limit !== null) return $limit;
    $limit = max(1048576, min(268435456, (int) (tamiran_backup_config()['max_archive_bytes'] ?? 67108864)));
    $memory = trim((string) ini_get('memory_limit'));
    if (preg_match('/^([0-9]+)\s*([KMG]?)$/i', $memory, $match)) {
        $factor = ['' => 1, 'K' => 1024, 'M' => 1048576, 'G' => 1073741824][strtoupper($match[2])];
        $available = (int) $match[1] * $factor - memory_get_usage(true);
        // Rows, JSON, compressed data and encryption buffers coexist briefly.
        $limit = max(1048576, min($limit, (int) floor($available / 6)));
    }
    return $limit;
}

function tamiran_backup_file_key(string $key, ?int $shopId): string
{
    if (!preg_match('/^([1-9][0-9]*)\/[a-f0-9]{2}\/[a-f0-9]{40}$/', $key, $match) || ($shopId !== null && (int) $match[1] !== $shopId)) throw new TamiranApiException('مسیر فایل پشتیبان معتبر نیست.', 422);
    return tamiran_private_root() . '/files/' . $key;
}

function tamiran_backup_capture(PDO $pdo, ?int $shopId): array
{
    if ($pdo->inTransaction()) throw new TamiranApiException('ساخت پشتیبان در تراکنش باز مجاز نیست.', 409);
    $metadata = tamiran_backup_metadata($pdo); $tables = []; $size = 0; $count = 0;
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $pdo->beginTransaction();
    try {
        foreach ($metadata as $name => $meta) {
            $scope = $shopId === null ? null : tamiran_backup_scope($metadata, $name);
            if ($shopId !== null && $scope === null) continue;
            $sql = 'SELECT t.* FROM ' . tamiran_backup_identifier($name) . ' t' . ($scope === null ? '' : ' WHERE ' . $scope);
            if ($meta['primary'] !== []) $sql .= ' ORDER BY ' . implode(',', array_map(static fn(string $key): string => 't.' . tamiran_backup_identifier($key), $meta['primary']));
            $query = $pdo->prepare($sql); $query->execute($scope === null ? [] : [$shopId]);
            $tables[$name] = [];
            while ($row = $query->fetch(PDO::FETCH_ASSOC)) {
                $size += strlen(json_encode($row, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)); $count++;
                if ($size > tamiran_backup_limit() || $count > 100000) throw new TamiranApiException('حجم داده از سقف پشتیبان وب بیشتر است؛ از بکاپ کامل پنل هاست استفاده کنید.', 413);
                $tables[$name][] = $row;
            }
        }
        $files = [];
        foreach ($tables['tamiran_private_files'] ?? [] as $row) {
            $key = (string) $row['storage_key']; $path = tamiran_backup_file_key($key, $shopId);
            $real = realpath($path); $root = realpath(tamiran_private_root() . '/files');
            if (!is_string($real) || !is_string($root) || !str_starts_with($real, $root . DIRECTORY_SEPARATOR) || is_link($path) || !is_file($path)) throw new TamiranApiException('یکی از فایل‌های ثبت‌شده برای پشتیبان موجود نیست.', 409);
            $length = filesize($path); $size += (int) ceil($length * 4 / 3);
            if ($size > tamiran_backup_limit()) throw new TamiranApiException('حجم فایل‌ها از سقف پشتیبان وب بیشتر است.', 413);
            $body = file_get_contents($path);
            if (!is_string($body) || strlen($body) !== (int) $row['size_bytes'] || !hash_equals((string) $row['sha256'], hash('sha256', $body))) throw new TamiranApiException('صحت فایل ثبت‌شده تأیید نشد.', 422);
            $files[$key] = base64_encode($body);
        }
        $pdo->commit();
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
    if ($shopId !== null && count($tables['repair_shops'] ?? []) !== 1) throw new TamiranApiException('تعمیرگاه پشتیبان پیدا نشد.', 404);
    return ['format' => 1, 'createdAt' => gmdate('c'), 'shopId' => $shopId, 'schema' => hash('sha256', json_encode($metadata, JSON_THROW_ON_ERROR)), 'tables' => $tables, 'files' => $files];
}

function tamiran_backup_run(PDO $pdo, string $type, ?int $shopId, string $trigger, ?int $actorId, bool $acquireLock = true): array
{
    if (!in_array($type, ['global', 'shop', 'emergency'], true) || !in_array($trigger, ['manual', 'cron', 'before_restore', 'before_update'], true) || ($type !== 'global' && ($shopId ?? 0) < 1)) throw new TamiranApiException('درخواست پشتیبان معتبر نیست.', 422);
    if ($type === 'global') $shopId = null;
    $lock = null;
    if ($acquireLock) {
        $lock = fopen(tamiran_private_root() . '/application.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_SH | LOCK_NB)) throw new TamiranApiException('بازیابی داده در حال انجام است.', 409);
    }
    $jobId = null; $path = null;
    try {
        $public = tamiran_id();
        $q = $pdo->prepare("INSERT INTO tamiran_backup_jobs(public_id,backup_type,shop_id,trigger_source,status,table_counts_json,requested_by_user_id,started_at) VALUES(?,?,?,?,'running','{}',?,UTC_TIMESTAMP())");
        $q->execute([$public, $type, $shopId, $trigger, $actorId]); $jobId = (int) $pdo->lastInsertId();
        $snapshot = tamiran_backup_capture($pdo, $shopId);
        $counts = array_map('count', $snapshot['tables']);
        $json = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (strlen($json) > tamiran_backup_limit()) throw new TamiranApiException('پشتیبان از سقف نصب بزرگ‌تر است.', 413);
        $compressed = gzencode($json, 6);
        if (!is_string($compressed)) throw new TamiranApiException('فشرده‌سازی پشتیبان انجام نشد.', 500);
        $archive = tamiran_encrypt_secret($compressed);
        $name = 'tamiran-' . $public . '.tmr'; $path = tamiran_backup_root() . '/' . $name;
        $file = fopen($path, 'xb');
        if ($file === false) throw new TamiranApiException('ساخت فایل پشتیبان انجام نشد.', 500);
        try { chmod($path, 0600); if (fwrite($file, $archive) !== strlen($archive) || !fflush($file)) throw new TamiranApiException('نوشتن پشتیبان کامل نشد.', 500); }
        finally { fclose($file); }
        $checksum = hash('sha256', $archive); $required = !empty(tamiran_backup_settings($pdo)['offsite_required']);
        $status = $required ? 'failed' : 'succeeded';
        $error = $required ? 'نسخهٔ محلی ساخته شد؛ مقصد خارج از هاست در این بسته پیکربندی نشده است.' : null;
        $q = $pdo->prepare("UPDATE tamiran_backup_jobs SET status=?,local_status='succeeded',offsite_status=?,archive_name=?,checksum_sha256=?,size_bytes=?,record_count=?,table_counts_json=?,encryption_format='tamiran-encrypted-json-v1',error_message=?,finished_at=UTC_TIMESTAMP() WHERE id=?");
        $q->execute([$status, $required ? 'failed' : 'disabled', $name, $checksum, strlen($archive), array_sum($counts), json_encode($counts, JSON_THROW_ON_ERROR), $error, $jobId]);
        return ['id' => $jobId, 'status' => $status, 'archive' => $name, 'checksum' => $checksum, 'size' => strlen($archive), 'records' => array_sum($counts), 'offsiteStatus' => $required ? 'failed' : 'disabled'];
    } catch (Throwable $error) {
        if ($path !== null && is_file($path)) @unlink($path);
        if ($jobId !== null) {
            $q = $pdo->prepare("UPDATE tamiran_backup_jobs SET status='failed',local_status='failed',error_message='ساخت پشتیبان محلی کامل نشد.',finished_at=UTC_TIMESTAMP() WHERE id=?"); $q->execute([$jobId]);
        }
        throw $error;
    } finally { if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); } }
}

function tamiran_backup_read(PDO $pdo, int $jobId): array
{
    $q = $pdo->prepare("SELECT * FROM tamiran_backup_jobs WHERE id=? AND local_status='succeeded'"); $q->execute([$jobId]); $job = $q->fetch();
    if (!is_array($job) || !preg_match('/^tamiran-[A-Za-z0-9]{26}\.tmr$/', (string) $job['archive_name'])) throw new TamiranApiException('پشتیبان محلی معتبر پیدا نشد.', 404);
    $path = tamiran_backup_root() . '/' . $job['archive_name'];
    if (is_link($path) || !is_file($path) || filesize($path) > tamiran_backup_limit() * 2) throw new TamiranApiException('فایل پشتیبان معتبر در دسترس نیست.', 422);
    $archive = file_get_contents($path);
    if (!is_string($archive) || !hash_equals((string) $job['checksum_sha256'], hash('sha256', $archive))) throw new TamiranApiException('اثر انگشت پشتیبان مطابقت ندارد.', 422);
    $compressed = tamiran_decrypt_secret($archive);
    $json = gzdecode($compressed, tamiran_backup_limit());
    if (!is_string($json)) throw new TamiranApiException('محتوای فشردهٔ پشتیبان معتبر نیست.', 422);
    try { $snapshot = json_decode($json, true, 128, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new TamiranApiException('ساختار پشتیبان معتبر نیست.', 422); }
    if (!is_array($snapshot) || ($snapshot['format'] ?? null) !== 1 || !is_array($snapshot['tables'] ?? null) || !is_array($snapshot['files'] ?? null) || ($snapshot['shopId'] ?? null) !== ($job['shop_id'] === null ? null : (int) $job['shop_id'])) throw new TamiranApiException('محدوده یا نسخهٔ پشتیبان معتبر نیست.', 422);
    return [$job, $snapshot];
}

function tamiran_backup_verify(PDO $pdo, int $jobId): array
{
    [$job, $snapshot] = tamiran_backup_read($pdo, $jobId);
    $records = array_sum(array_map('count', $snapshot['tables']));
    if ($records !== (int) $job['record_count']) throw new TamiranApiException('تعداد رکوردهای پشتیبان مطابقت ندارد.', 422);
    $q = $pdo->prepare('UPDATE tamiran_backup_jobs SET verified_at=UTC_TIMESTAMP() WHERE id=?'); $q->execute([$jobId]);
    return ['verified' => true, 'records' => $records];
}

function tamiran_backup_restore_preview(PDO $pdo, int $jobId): array
{
    [$job, $snapshot] = tamiran_backup_read($pdo, $jobId);
    if ($job['shop_id'] === null || !in_array($job['backup_type'], ['shop', 'emergency'], true)) throw new TamiranApiException('بازیابی خودکار فقط برای پشتیبان یک تعمیرگاه مجاز است؛ پشتیبان کامل برای بازیابی مدیریتی نگهداری می‌شود.', 409);
    $metadata = tamiran_backup_metadata($pdo);
    if (!hash_equals(hash('sha256', json_encode($metadata, JSON_THROW_ON_ERROR)), (string) ($snapshot['schema'] ?? ''))) throw new TamiranApiException('ساختار دیتابیس با زمان پشتیبان متفاوت است؛ بازیابی تخصصی لازم است.', 409);
    $shopId = (int) $job['shop_id']; $q = $pdo->prepare('SELECT public_id,shop_code FROM repair_shops WHERE id=?'); $q->execute([$shopId]); $shop = $q->fetch();
    $saved = $snapshot['tables']['repair_shops'][0] ?? null;
    if (!is_array($shop) || !is_array($saved) || count($snapshot['tables']['repair_shops']) !== 1 || !hash_equals((string) $shop['public_id'], (string) $saved['public_id'])) throw new TamiranApiException('هویت تعمیرگاه با پشتیبان مطابقت ندارد.', 409);
    $names = [];
    foreach ($snapshot['tables'] as $table => $rows) {
        if (!isset($metadata[$table]) || tamiran_backup_scope($metadata, $table) === null || !is_array($rows)) throw new TamiranApiException('جدول خارج از محدودهٔ بازیابی است.', 422);
        foreach ($rows as $row) {
            if (!is_array($row) || array_keys($row) !== array_keys($metadata[$table]['columns'])) throw new TamiranApiException('ستون‌های پشتیبان معتبر نیستند.', 422);
            foreach (['shop_id', 'repair_shop_id'] as $key) if (array_key_exists($key, $row) && (int) $row[$key] !== $shopId) throw new TamiranApiException('رکورد خارج از تعمیرگاه در پشتیبان است.', 422);
        }
        $names[] = $table;
    }
    tamiran_backup_order($metadata, $names);
    return ['jobId' => $jobId, 'backupType' => $job['backup_type'], 'shopId' => $shopId, 'shopCode' => $shop['shop_code'], 'createdAt' => $snapshot['createdAt'], 'counts' => array_map('count', $snapshot['tables']), 'records' => array_sum(array_map('count', $snapshot['tables']))];
}

function tamiran_backup_restore_shop(PDO $pdo, int $jobId, int $actorId): array
{
    $lock = fopen(tamiran_private_root() . '/application.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) throw new TamiranApiException('درخواست دیگری فعال است؛ بازیابی را در زمان خلوت دوباره اجرا کنید.', 409);
    $restoreId = null; $createdFiles = []; $committed = false;
    try {
        $preview = tamiran_backup_restore_preview($pdo, $jobId); [$job, $snapshot] = tamiran_backup_read($pdo, $jobId);
        $shopId = (int) $preview['shopId']; $metadata = tamiran_backup_metadata($pdo); $order = tamiran_backup_order($metadata, array_keys($snapshot['tables']));
        $emergency = tamiran_backup_run($pdo, 'emergency', $shopId, 'before_restore', $actorId, false);
        $q = $pdo->prepare("INSERT INTO tamiran_backup_restores(public_id,backup_job_id,shop_id,restore_type,status,emergency_backup_job_id,preview_counts_json,requested_by_user_id,started_at) VALUES(?,?,?,'shop','running',?,?,?,UTC_TIMESTAMP())");
        $q->execute([tamiran_id(), $jobId, $shopId, $emergency['id'], json_encode($preview['counts'], JSON_THROW_ON_ERROR), $actorId]); $restoreId = (int) $pdo->lastInsertId();
        foreach ($snapshot['tables']['tamiran_private_files'] ?? [] as $row) {
            $key = (string) $row['storage_key']; $path = tamiran_backup_file_key($key, $shopId); $encoded = $snapshot['files'][$key] ?? null;
            $body = is_string($encoded) ? base64_decode($encoded, true) : false;
            if (!is_string($body) || strlen($body) !== (int) $row['size_bytes'] || !hash_equals((string) $row['sha256'], hash('sha256', $body))) throw new TamiranApiException('شواهد فایل پشتیبان معتبر نیست.', 422);
            if (is_file($path) && !is_link($path)) { if (!hash_equals((string) $row['sha256'], (string) hash_file('sha256', $path))) throw new TamiranApiException('فایل موجود با پشتیبان اختلاف دارد؛ تغییری اعمال نشد.', 409); continue; }
            if (is_link($path)) throw new TamiranApiException('مسیر فایل برای بازیابی معتبر نیست.', 422);
            $directory = dirname($path); if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new TamiranApiException('ساخت پوشهٔ فایل بازیابی انجام نشد.', 500);
            $file = fopen($path, 'xb'); if ($file === false) throw new TamiranApiException('ساخت فایل بازیابی انجام نشد.', 500);
            $createdFiles[] = $path;
            try { chmod($path, 0600); if (fwrite($file, $body) !== strlen($body)) throw new TamiranApiException('نوشتن فایل بازیابی کامل نشد.', 500); } finally { fclose($file); }
        }
        $pdo->beginTransaction(); $pdo->exec('SET @tamiran_restore_mode=1');
        $q = $pdo->prepare('SELECT id FROM repair_shops WHERE id=? FOR UPDATE'); $q->execute([$shopId]);
        foreach (array_reverse($order) as $table) {
            if ($table === 'repair_shops') continue;
            $scope = tamiran_backup_scope($metadata, $table);
            $q = $pdo->prepare('DELETE t FROM ' . tamiran_backup_identifier($table) . ' t WHERE ' . $scope); $q->execute([$shopId]);
        }
        foreach ($order as $table) foreach ($snapshot['tables'][$table] as $row) {
            if ($table === 'repair_shops') {
                $fields = array_values(array_diff(array_keys($row), ['id']));
                $q = $pdo->prepare('UPDATE `repair_shops` SET ' . implode(',', array_map(static fn(string $key): string => tamiran_backup_identifier($key) . '=?', $fields)) . ' WHERE id=?');
                $values = array_map(static fn(string $key): mixed => $row[$key], $fields); $values[] = $shopId; $q->execute($values); continue;
            }
            if ($table === 'tamiran_users' && array_key_exists('active_session_hash', $row)) $row['active_session_hash'] = null;
            $fields = array_keys($row);
            $q = $pdo->prepare('INSERT INTO ' . tamiran_backup_identifier($table) . '(' . implode(',', array_map('tamiran_backup_identifier', $fields)) . ') VALUES(' . implode(',', array_fill(0, count($fields), '?')) . ')');
            $q->execute(array_values($row));
        }
        $q = $pdo->prepare("UPDATE tamiran_backup_restores SET status='succeeded',finished_at=UTC_TIMESTAMP() WHERE id=?"); $q->execute([$restoreId]);
        $pdo->commit(); $committed = true;
        return ['restored' => true, 'shopCode' => $preview['shopCode'], 'emergencyBackupJobId' => $emergency['id'], 'restoreId' => $restoreId];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if (!$committed) foreach ($createdFiles as $path) if (is_file($path)) @unlink($path);
        if (!$committed && $restoreId !== null) { $q = $pdo->prepare("UPDATE tamiran_backup_restores SET status='failed',error_message='بازیابی لغو و تراکنش بازگردانده شد.',finished_at=UTC_TIMESTAMP() WHERE id=?"); $q->execute([$restoreId]); }
        throw $error;
    } finally {
        try { $pdo->exec('SET @tamiran_restore_mode=0'); } catch (Throwable) { /* A disconnected nonpersistent connection cannot retain the session variable. */ }
        flock($lock, LOCK_UN); fclose($lock);
    }
}

/** Retain newest hourly/daily/weekly/monthly points per scope, plus restore evidence. */
function tamiran_backup_cleanup(PDO $pdo): int
{
    $settings = tamiran_backup_settings($pdo); $now = time(); $seen = []; $removed = 0;
    $protected = $pdo->query('SELECT backup_job_id,emergency_backup_job_id FROM tamiran_backup_restores')->fetchAll(); $keepIds = [];
    foreach ($protected as $row) { $keepIds[(int) $row['backup_job_id']] = true; $keepIds[(int) $row['emergency_backup_job_id']] = true; }
    $rows = $pdo->query("SELECT id,backup_type,shop_id,archive_name,created_at FROM tamiran_backup_jobs WHERE local_status='succeeded' ORDER BY created_at DESC,id DESC")->fetchAll();
    foreach ($rows as $row) {
        $group = ($row['shop_id'] === null ? 'global' : 'shop-' . $row['shop_id']); $created = strtotime((string) $row['created_at'] . ' UTC'); $age = max(0, $now - $created);
        $bucket = $age <= (int) $settings['local_hourly_retention'] * 3600 ? gmdate('Y-m-d-H', $created)
            : ($age <= (int) $settings['daily_retention_days'] * 86400 ? gmdate('Y-m-d', $created)
            : ($age <= (int) $settings['weekly_retention_weeks'] * 604800 ? gmdate('o-W', $created)
            : ($age <= (int) $settings['monthly_retention_months'] * 2678400 ? gmdate('Y-m', $created) : null)));
        if (!isset($seen[$group]) || isset($keepIds[(int) $row['id']]) || ($bucket !== null && !isset($seen[$group][$bucket]))) { $seen[$group][$bucket ?? 'newest'] = true; continue; }
        if (!preg_match('/^tamiran-[A-Za-z0-9]{26}\.tmr$/', (string) $row['archive_name'])) continue;
        $path = tamiran_backup_root() . '/' . $row['archive_name'];
        if (is_link($path) || (is_file($path) && !unlink($path))) continue;
        $q = $pdo->prepare("UPDATE tamiran_backup_jobs SET status='deleted',local_status='deleted' WHERE id=?"); $q->execute([$row['id']]); $removed++;
    }
    return $removed;
}
