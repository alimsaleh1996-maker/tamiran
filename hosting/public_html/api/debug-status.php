<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

tamiran_api(static function (): array {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
    }
    tamiran_require_central_admin();
    tamiran_require_debug_token();

    $pdo = tamiran_db();
    $databaseVersion = (string) $pdo->query('SELECT VERSION()')->fetchColumn();
    $logFiles = glob(tamiran_private_root() . '/logs/tamiran-*.log') ?: [];
    rsort($logFiles);
    $latestLog = $logFiles[0] ?? null;
    $logTail = [];

    if ($latestLog !== null && is_readable($latestLog)) {
        $lines = file($latestLog, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $logTail = array_slice($lines, -30);
    }

    return [
        'status' => 'debug-enabled',
        'version' => TAMIRAN_VERSION,
        'request_id' => tamiran_request_id(),
        'runtime' => [
            'php' => PHP_VERSION,
            'sapi' => PHP_SAPI,
            'pdo_mysql' => extension_loaded('pdo_mysql'),
            'json' => extension_loaded('json'),
            'mbstring' => extension_loaded('mbstring'),
        ],
        'database' => [
            'connected' => true,
            'server_version' => $databaseVersion,
        ],
        'storage' => [
            'private_readable' => is_readable(tamiran_private_root()),
            'logs_writable' => is_writable(tamiran_private_root() . '/logs'),
            'source_maps_present' => is_dir(tamiran_private_root() . '/source-maps'),
        ],
        'recent_logs' => $logTail,
    ];
});
