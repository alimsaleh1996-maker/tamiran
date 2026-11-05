<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require tamiran_private_root() . '/backup-engine.php';

try {
    tamiran_require_central_admin();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') throw new TamiranApiException('روش درخواست مجاز نیست.',405);
    $id=(int)($_GET['id'] ?? 0); $pdo=tamiran_db();
    $statement=$pdo->prepare("SELECT archive_name,checksum_sha256 FROM tamiran_backup_jobs WHERE id=:id AND local_status='succeeded' LIMIT 1");
    $statement->execute(['id'=>$id]); $row=$statement->fetch();
    if (!is_array($row) || !$row['archive_name']) throw new TamiranApiException('نسخه محلی بکاپ پیدا نشد.',404);
    $path=tamiran_backup_root() . '/' . basename((string)$row['archive_name']);
    if (!is_file($path)) throw new TamiranApiException('فایل بکاپ موجود نیست.',404);
    $checksum=hash_file('sha256',$path);
    if (!is_string($checksum) || !hash_equals((string)$row['checksum_sha256'],$checksum)) throw new TamiranApiException('صحت فایل بکاپ تأیید نشد.',422);
    header('Content-Type: application/octet-stream'); header('Content-Disposition: attachment; filename="' . basename($path) . '"');
    header('Content-Length: ' . filesize($path)); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
    readfile($path); exit;
} catch (Throwable $error) { tamiran_fail($error); }
