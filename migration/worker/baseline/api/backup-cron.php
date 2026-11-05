<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require tamiran_private_root() . '/backup-engine.php';

tamiran_api(static function (): array {
    $isCli = PHP_SAPI === 'cli';
    if (!$isCli) {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new TamiranApiException('روش درخواست مجاز نیست.',405);
        $expected=trim((string)(tamiran_backup_config()['cron_token'] ?? '')); $provided=trim((string)($_SERVER['HTTP_X_TAMIRAN_BACKUP_TOKEN'] ?? ''));
        if (!tamiran_secret_is_configured($expected) || !hash_equals($expected,$provided)) throw new TamiranApiException('دسترسی زمان‌بندی بکاپ مجاز نیست.',403);
    }
    @set_time_limit(0); $lockPath=tamiran_private_root() . '/backup-worker.lock'; $lock=fopen($lockPath,'c');
    if ($lock === false || !flock($lock,LOCK_EX|LOCK_NB)) throw new TamiranApiException('یک فرایند بکاپ دیگر در حال اجراست.',409);
    $pdo=tamiran_db(); $settings=tamiran_backup_settings($pdo); $jobs=[];
    try {
        if (!(bool)$settings['enabled']) return ['processed'=>0,'message'=>'بکاپ‌گیری غیرفعال است.'];
        $globalMinutes=(int)$settings['global_interval_minutes'];
        $lastGlobal=$pdo->query("SELECT MAX(created_at) FROM tamiran_backup_jobs WHERE backup_type='global' AND local_status='succeeded'")->fetchColumn();
        if (!is_string($lastGlobal) || strtotime($lastGlobal) <= time()-$globalMinutes*60) $jobs[]=tamiran_backup_run($pdo,'global',null,'cron',null);
        $shopHours=(int)$settings['shop_interval_hours'];
        $shops=$pdo->query("SELECT s.id FROM repair_shops s LEFT JOIN (SELECT shop_id,MAX(created_at) latest FROM tamiran_backup_jobs WHERE local_status='succeeded' AND backup_type IN ('shop','emergency') GROUP BY shop_id) b ON b.shop_id=s.id WHERE b.latest IS NULL OR b.latest <= DATE_SUB(NOW(), INTERVAL {$shopHours} HOUR) ORDER BY COALESCE(b.latest,'1970-01-01') ASC,s.id ASC LIMIT 10")->fetchAll();
        foreach($shops as $shop) $jobs[]=tamiran_backup_run($pdo,'shop',(int)$shop['id'],'cron',null);
        $removed=tamiran_backup_cleanup($pdo);
        tamiran_log('info','backup_cron_completed',['jobs'=>count($jobs),'removed'=>$removed]);
        return ['processed'=>count($jobs),'removed'=>$removed,'jobs'=>$jobs];
    } finally { flock($lock,LOCK_UN); fclose($lock); }
});
