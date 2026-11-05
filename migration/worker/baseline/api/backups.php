<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require tamiran_private_root() . '/backup-engine.php';

function backup_job_view(array $row): array
{
    return [
        'id'=>(int)$row['id'],'publicId'=>$row['public_id'],'type'=>$row['backup_type'],'shopId'=>$row['shop_id'] === null ? null : (int)$row['shop_id'],
        'shopCode'=>$row['shop_code'] ?? null,'shopName'=>$row['shop_name'] ?? null,'trigger'=>$row['trigger_source'],'status'=>$row['status'],
        'localStatus'=>$row['local_status'],'offsiteStatus'=>$row['offsite_status'],'archiveName'=>$row['archive_name'],'checksum'=>$row['checksum_sha256'],
        'sizeBytes'=>(int)$row['size_bytes'],'recordCount'=>(int)$row['record_count'],'tableCounts'=>json_decode((string)$row['table_counts_json'], true) ?: [],
        'offsiteKey'=>$row['offsite_key'],'error'=>$row['error_message'],'startedAt'=>$row['started_at'],'finishedAt'=>$row['finished_at'],
        'verifiedAt'=>$row['verified_at'],'createdAt'=>$row['created_at'],
    ];
}

tamiran_api(static function (): array {
    $actor = tamiran_require_central_admin(); $pdo = tamiran_db(); $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        $jobs = $pdo->query("SELECT j.*,s.shop_code,s.name AS shop_name FROM tamiran_backup_jobs j LEFT JOIN repair_shops s ON s.id=j.shop_id ORDER BY j.created_at DESC LIMIT 150")->fetchAll();
        $restores = $pdo->query("SELECT r.*,s.shop_code,s.name AS shop_name,j.archive_name FROM tamiran_backup_restores r LEFT JOIN repair_shops s ON s.id=r.shop_id INNER JOIN tamiran_backup_jobs j ON j.id=r.backup_job_id ORDER BY r.created_at DESC LIMIT 50")->fetchAll();
        $health = tamiran_backup_health($pdo);
        if (is_array($health['latest'] ?? null)) $health['latest'] = backup_job_view($health['latest']);
        if (is_array($health['latestGlobal'] ?? null)) $health['latestGlobal'] = backup_job_view($health['latestGlobal']);
        return ['health'=>$health,'jobs'=>array_map('backup_job_view',$jobs),'restores'=>array_map(static fn(array $row): array => [
            'id'=>(int)$row['id'],'publicId'=>$row['public_id'],'backupJobId'=>(int)$row['backup_job_id'],'archiveName'=>$row['archive_name'],
            'shopId'=>$row['shop_id'] === null ? null : (int)$row['shop_id'],'shopCode'=>$row['shop_code'] ?? null,'shopName'=>$row['shop_name'] ?? null,
            'type'=>$row['restore_type'],'status'=>$row['status'],'previewCounts'=>json_decode((string)$row['preview_counts_json'],true) ?: [],
            'error'=>$row['error_message'],'createdAt'=>$row['created_at'],'finishedAt'=>$row['finished_at'],
        ],$restores)];
    }
    if (!in_array($method, ['POST','PATCH'], true)) throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
    tamiran_require_csrf(); $input = tamiran_json_body(); $action = (string)($input['action'] ?? '');
    @set_time_limit(0);
    if ($method === 'PATCH' && $action === 'save_settings') {
        $global = max(15,min(1440,(int)($input['globalIntervalMinutes'] ?? 30)));
        $shop = max(1,min(168,(int)($input['shopIntervalHours'] ?? 24)));
        $hourly = max(24,min(168,(int)($input['localHourlyRetention'] ?? 48)));
        $daily = max(7,min(365,(int)($input['dailyRetentionDays'] ?? 30)));
        $weekly = max(4,min(104,(int)($input['weeklyRetentionWeeks'] ?? 12)));
        $monthly = max(3,min(60,(int)($input['monthlyRetentionMonths'] ?? 12)));
        $statement = $pdo->prepare('UPDATE tamiran_backup_settings SET enabled=:enabled,global_interval_minutes=:global_interval,shop_interval_hours=:shop_interval,local_hourly_retention=:hourly,daily_retention_days=:daily,weekly_retention_weeks=:weekly,monthly_retention_months=:monthly,offsite_required=:offsite,updated_by_user_id=:actor WHERE id=1');
        $statement->execute(['enabled'=>!empty($input['enabled'])?1:0,'global_interval'=>$global,'shop_interval'=>$shop,'hourly'=>$hourly,'daily'=>$daily,'weekly'=>$weekly,'monthly'=>$monthly,'offsite'=>!empty($input['offsiteRequired'])?1:0,'actor'=>$actor['id']]);
        tamiran_log('info','backup_settings_updated',['actor_id'=>$actor['id']]);
        return ['updated'=>true];
    }
    if ($method === 'POST' && in_array($action, ['run_global','run_shop'], true)) {
        $shopId = $action === 'run_shop' ? (int)($input['shopId'] ?? 0) : null;
        return ['job'=>tamiran_backup_run($pdo,$action === 'run_global' ? 'global' : 'shop',$shopId,'manual',(int)$actor['id'])];
    }
    if ($method === 'POST' && $action === 'verify') return tamiran_backup_verify($pdo,(int)($input['jobId'] ?? 0));
    if ($method === 'POST' && $action === 'preview_restore') {
        $preview = tamiran_backup_restore_preview($pdo,(int)($input['jobId'] ?? 0));
        $statement = $pdo->prepare("INSERT INTO tamiran_backup_restores (public_id,backup_job_id,shop_id,restore_type,status,preview_counts_json,requested_by_user_id) VALUES (:public_id,:job,:shop,'shop','previewed',:counts,:actor)");
        $statement->execute(['public_id'=>tamiran_id(),'job'=>$preview['jobId'],'shop'=>$preview['shopId'],'counts'=>json_encode($preview['counts'],JSON_UNESCAPED_UNICODE),'actor'=>$actor['id']]);
        return ['preview'=>$preview];
    }
    if ($method === 'POST' && $action === 'restore_shop') {
        $jobId = (int)($input['jobId'] ?? 0); $password = (string)($input['password'] ?? ''); $confirmation = trim((string)($input['confirmation'] ?? ''));
        $preview = tamiran_backup_restore_preview($pdo,$jobId); $shopCode = (string)($preview['shopCode'] ?? '');
        if (!hash_equals('بازیابی-' . $shopCode,$confirmation)) throw new TamiranApiException('عبارت تأیید بازیابی صحیح نیست.', 409);
        $statement = $pdo->prepare("SELECT password_hash FROM tamiran_users WHERE id=:id AND shop_id IS NULL AND role_code='central_admin' AND is_active=1 LIMIT 1");
        $statement->execute(['id'=>$actor['id']]); $hash=$statement->fetchColumn();
        if (!is_string($hash) || !password_verify($password,$hash)) throw new TamiranApiException('رمز مدیر مرکزی صحیح نیست.', 403);
        return tamiran_backup_restore_shop($pdo,$jobId,(int)$actor['id']);
    }
    if ($method === 'POST' && $action === 'cleanup') return ['removed'=>tamiran_backup_cleanup($pdo)];
    throw new TamiranApiException('عملیات بکاپ معتبر نیست.', 405);
});
