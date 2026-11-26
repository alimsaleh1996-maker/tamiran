<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function tamiran_health_files(string $root, mixed $files, string $required, string $allowed): bool
{
    if (!is_array($files) || !isset($files[$required])) {
        return false;
    }
    foreach ($files as $name => $sha256) {
        // Manifest entries are generated during release. Only hash fixed application paths.
        if (!is_string($name) || !preg_match($allowed, $name) || !is_string($sha256)
            || !preg_match('/\A[0-9a-f]{64}\z/', $sha256)) {
            return false;
        }
        $path = $root . '/' . $name;
        if (!is_file($path) || is_link($path) || @hash_file('sha256', $path) !== $sha256) {
            return false;
        }
    }
    return true;
}

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
    $root = tamiran_domain_root();
    $manifestPath = $root . '/private/build/manifest.json';
    $rawManifest = is_file($manifestPath) ? @file_get_contents($manifestPath) : false;
    $manifest = is_string($rawManifest) ? json_decode($rawManifest, true) : null;
    $buildId = is_array($manifest) ? ($manifest['build_id'] ?? null) : null;
    $commit = $manifest['git']['commit'] ?? null;
    $releaseKnown = ($manifest['format'] ?? null) === 1 && is_string($buildId)
        && preg_match('/\A[0-9a-f]{16}\z/', $buildId) === 1
        && is_string($commit) && preg_match('/\A[0-9a-f]{40}\z/', $commit) === 1
        && ($manifest['git']['dirty'] ?? null) === false
        && TAMIRAN_VERSION !== 'unknown' && ($manifest['version'] ?? null) === TAMIRAN_VERSION;
    $frontendVerified = $releaseKnown && ($manifest['frontend_version'] ?? null) === TAMIRAN_VERSION
        && tamiran_health_files($root, $manifest['files']['frontend'] ?? null, 'public_html/index.php',
            '~\Apublic_html/(?:index\.php|favicon\.svg|assets/[A-Za-z0-9_.-]+\.(?:js|css|svg|woff2?|png|webp|ico|txt))\z~');
    $backendVerified = $releaseKnown && ($manifest['backend_version'] ?? null) === TAMIRAN_VERSION
        && tamiran_health_files($root, $manifest['files']['backend'] ?? null, 'public_html/api/bootstrap.php',
            '~\A(?:VERSION|public_html/api/[A-Za-z0-9_-]+\.php|private/[A-Za-z0-9_-]+\.php)\z~');
    $schemaCompatible = $schemaVersion === '2.0.0-beta.7';
    $buildVerified = $frontendVerified && $backendVerified;
    return [
        'status' => $schemaCompatible && $buildVerified ? 'ok' : 'degraded',
        'version' => TAMIRAN_VERSION,
        'frontend_version' => $frontendVerified ? TAMIRAN_VERSION : null,
        'backend_version' => $backendVerified ? TAMIRAN_VERSION : null,
        'schema_version' => $schemaVersion,
        'schema_compatible' => $schemaCompatible,
        'build_id' => $releaseKnown ? $buildId : null,
        'build_manifest_sha256' => is_string($rawManifest) ? hash('sha256', $rawManifest) : null,
        'build_verified' => $buildVerified,
        'response_time_ms' => round((microtime(true) - $started) * 1000, 2),
        'time' => gmdate('c'),
        'request_id' => tamiran_request_id(),
    ];
});
