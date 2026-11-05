<?php
declare(strict_types=1);

// Isolated request-level checks execute the real wizard in separate PHP processes.
// No database is contacted and no deployed/private config is modified.
$root = sys_get_temp_dir() . '/tamiran-installer-http-' . bin2hex(random_bytes(8));
foreach ([$root, "$root/private", "$root/private/database", "$root/public_html", "$root/public_html/install", "$root/sessions"] as $directory) mkdir($directory, 0700);
$source = dirname(__DIR__);
copy("$source/private/install.php", "$root/private/install.php");
copy("$source/private/database/schema.sql", "$root/private/database/schema.sql");
copy("$source/public_html/install/index.php", "$root/public_html/install/index.php");
$count = 0;

function wizard_request(string $root, array $server, array $post = []): array
{
    $runner = "$root/request.php";
    $content = '<?php ' .
        'session_save_path(' . var_export("$root/sessions", true) . ');session_id("tamirantestrequest");session_start();session_write_close();' .
        '$_SERVER=' . var_export(array_replace(['HTTP_HOST' => 'localhost', 'REMOTE_ADDR' => '127.0.0.1', 'SERVER_PORT' => 80, 'REQUEST_METHOD' => 'GET'], $server), true) . ';' .
        '$_POST=' . var_export($post, true) . ';require ' . var_export("$root/public_html/install/index.php", true) . ';' .
        'fwrite(STDERR,(string)(http_response_code()?:200));';
    file_put_contents($runner, $content);
    $process = proc_open([PHP_BINARY, $runner], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) throw new RuntimeException('Unable to start test PHP request.');
    $html = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $status = stream_get_contents($pipes[2]); fclose($pipes[2]);
    if (proc_close($process) !== 0 || !preg_match('/^\d{3}$/D', $status)) throw new RuntimeException('Request process failed: ' . $status);
    return [(int) $status, $html];
}
function wizard_check(bool $condition, string $label): void
{
    global $count;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $count++; echo "PASS: $label\n";
}
try {
    [$status, $html] = wizard_request($root, []);
    wizard_check($status === 200, 'fresh loopback GET succeeds');
    wizard_check(preg_match('/name="csrf_token" value="([a-f0-9]+)"/', $html, $match) === 1, 'wizard emits session CSRF token');
    $csrf = $match[1];
    $privateKey = trim(file_get_contents("$root/private/install.key"));
    wizard_check(strlen($privateKey) === 64 && !str_contains($html, $privateKey), 'private install key never appears in HTML');
    wizard_check(str_contains($html, 'name="install_key"'), 'operator ownership field present');

    [$status] = wizard_request($root, ['REQUEST_METHOD' => 'POST'], ['install_key' => $privateKey]);
    wizard_check($status === 403, 'missing CSRF rejected');
    wizard_check(!file_exists("$root/private/.install.mutex"), 'CSRF rejection occurs before database installer');
    [$status, $html] = wizard_request($root, ['REQUEST_METHOD' => 'POST'], ['csrf_token' => $csrf, 'install_key' => str_repeat('0', 64)]);
    wizard_check($status === 422 && str_contains($html, 'کلید نصب معتبر نیست'), 'wrong ownership key rejected');
    wizard_check(!file_exists("$root/private/.install.mutex"), 'ownership rejection occurs before database installer');
    [$status] = wizard_request($root, ['REQUEST_METHOD' => 'POST'], ['csrf_token' => $csrf, 'install_key' => ['bad']]);
    wizard_check($status === 422, 'array ownership key rejected');
    [$status] = wizard_request($root, ['REQUEST_METHOD' => 'POST', 'CONTENT_LENGTH' => 20000], ['csrf_token' => $csrf]);
    wizard_check($status === 413, 'oversized form rejected');

    [$status, $html] = wizard_request($root, ['HTTP_HOST' => 'public.example', 'REMOTE_ADDR' => '203.0.113.4']);
    wizard_check($status === 403 && !str_contains($html, '<form'), 'public plain HTTP has no credential form');
    [$status] = wizard_request($root, ['HTTP_HOST' => 'localhost', 'REMOTE_ADDR' => '203.0.113.4']);
    wizard_check($status === 403, 'spoofed localhost Host does not bypass HTTPS');

    file_put_contents("$root/private/config.php", '<?php return [];');
    [$status, $html] = wizard_request($root, ['REQUEST_METHOD' => 'POST'], ['csrf_token' => $csrf, 'install_key' => $privateKey]);
    wizard_check($status === 200 && str_contains($html, 'قبلاً نصب شده') && !str_contains($html, '<form'), 'installed instance refuses fresh wizard');
    wizard_check(!str_contains($html, $privateKey), 'completed page never exposes old ownership key');
} finally {
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    rmdir($root);
}
echo json_encode(['passed' => $count, 'failed' => 0]) . "\n";
