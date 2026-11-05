<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

tamiran_api(static function (): array {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
    }

    $started = microtime(true);
    $pdo = tamiran_db();
    $pdo->query('SELECT 1')->fetchColumn();
    $schemaVersion = null;
    try {
        $schemaVersion = $pdo->query('SELECT version FROM tamiran_schema_versions ORDER BY applied_at DESC, version DESC LIMIT 1')->fetchColumn() ?: null;
    } catch (Throwable) {
        $schemaVersion = 'pre-beta.6';
    }
    $manifestPath = dirname(__DIR__, 2) . '/private/build/manifest.json';
    $buildId = is_file($manifestPath) ? substr(hash_file('sha256', $manifestPath), 0, 16) : 'missing-manifest';
    $schemaCompatible = $schemaVersion === '2.0.0-beta.7';
    return [
        'status' => $schemaCompatible ? 'ok' : 'degraded',
        'version' => TAMIRAN_VERSION,
        'frontend_version' => '2.0.0-beta.7',
        'backend_version' => TAMIRAN_VERSION,
        'schema_version' => $schemaVersion,
        'schema_compatible' => $schemaCompatible,
        'build_id' => $buildId,
        'response_time_ms' => round((microtime(true) - $started) * 1000, 2),
        'time' => gmdate('c'),
        'request_id' => tamiran_request_id(),
    ];
});
