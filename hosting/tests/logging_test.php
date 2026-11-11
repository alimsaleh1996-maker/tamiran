<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$root = sys_get_temp_dir() . '/tamiran-log-test-' . bin2hex(random_bytes(6));
mkdir($root . '/public_html/api', 0700, true); mkdir($root . '/private', 0700, true);
copy(dirname(__DIR__) . '/public_html/api/bootstrap.php', $root . '/public_html/api/bootstrap.php');
$_SERVER['SCRIPT_FILENAME'] = '/tmp/operations.php';
$_SERVER['REQUEST_URI'] = '/api/operations.php?password=TEST-LOG-SECRET';
$_SERVER['REQUEST_METHOD'] = 'POST';
require $root . '/public_html/api/bootstrap.php';
try {
    $ok = tamiran_log('warning', 'synthetic_test', ['password'=>'TEST-LOG-SECRET', 'message'=>'TEST-LOG-SECRET',
        'actor'=>'TEST-LOG-NAME', 'nested'=>['accessToken'=>'TEST-LOG-SECRET'], 'status'=>409]);
    if (!$ok) throw new RuntimeException('log write failed');
    $path = $root . '/private/logs/tamiran-' . gmdate('Y-m-d') . '.log';
    $raw = file_get_contents($path); $row = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (str_contains($raw, 'TEST-LOG-SECRET') || str_contains($raw, 'TEST-LOG-NAME')) throw new RuntimeException('sensitive data leaked');
    if ($row['route'] !== 'operations.php' || $row['context']['status'] !== 409 || $row['context']['password'] !== '[REDACTED]') throw new RuntimeException('structured fields incorrect');
    if ((fileperms($path) & 0777) !== 0600) throw new RuntimeException('log file is not private');
    echo "PASS structured metadata, redaction, query exclusion and permissions\n";
    unlink($path); rmdir($root . '/private/logs');
    file_put_contents($root . '/private/logs', 'not a directory');
    if (tamiran_log('error', 'synthetic_failure', ['message'=>'TEST-LOG-SECRET'])) throw new RuntimeException('failed log write reported success');
    echo "PASS unavailable log storage does not crash the request\n";
} finally {
    if (isset($path) && is_file($path)) unlink($path);
    if (is_dir($root . '/private/logs')) rmdir($root . '/private/logs');
    if (is_file($root . '/private/logs')) unlink($root . '/private/logs');
    unlink($root . '/public_html/api/bootstrap.php'); rmdir($root . '/public_html/api'); rmdir($root . '/public_html'); rmdir($root . '/private'); rmdir($root);
}
