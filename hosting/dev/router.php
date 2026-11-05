<?php
declare(strict_types=1);
// Local PHP built-in-server router. Apache uses public_html/.htaccess.
$root = dirname(__DIR__) . '/public_html';
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if (preg_match('~(?:^|/)(?:\.|private|frontend|database|tests|dev)(?:/|$)|\.(?:sql|log|ini|bak|map|env|sqlite|zip|tar|gz)$~i', $path)) {
    http_response_code(403);
    exit('Forbidden');
}
$file = realpath($root . $path);
if ($file !== false && str_starts_with($file, realpath($root) . DIRECTORY_SEPARATOR) && is_file($file)) {
    return false;
}
if (str_starts_with($path, '/api/')) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => ['message' => 'مسیر پیدا نشد.']], JSON_UNESCAPED_UNICODE);
    return true;
}
if ($path === '/install' || str_starts_with($path, '/install/')) {
    require $root . '/install/index.php';
    return true;
}
require $root . '/index.php';
return true;
