<?php
declare(strict_types=1);
require dirname(__DIR__) . '/private/install.php';

$passed = 0;
function install_check(bool $condition, string $name): void
{
    global $passed;
    if (!$condition) throw new RuntimeException('FAIL: ' . $name);
    $passed++;
    echo 'PASS: ' . $name . PHP_EOL;
}
function install_rejected(callable $operation, string $name, ?string $messageContains = null): void
{
    try { $operation(); } catch (TamiranInstallException $error) {
        install_check($messageContains === null || str_contains($error->getMessage(), $messageContains), $name);
        return;
    }
    throw new RuntimeException('FAIL: expected rejection: ' . $name);
}

$input = [
    'db_host' => '127.0.0.1', 'db_port' => '3306', 'db_name' => 'test_empty',
    'db_user' => 'test_installer', 'db_password' => 'TEST-ONLY-db-password',
    'admin_name' => 'مدیر آزمایشی', 'admin_mobile' => '۰۹۱۲۰۰۰۰۰۰۰',
    'admin_password' => 'TEST-Only-Strong-2026!', 'admin_password_confirmation' => 'TEST-Only-Strong-2026!',
];
$valid = tamiran_install_validate($input);
install_check($valid['admin']['mobile'] === '09120000000', 'Persian mobile digits normalize');
install_check($valid['db']['charset'] === 'utf8mb4', 'fixed utf8mb4 charset');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['db_host' => 'localhost;dbname=other'])), 'reject DSN injection');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['db_port' => '65536'])), 'reject invalid port');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['db_name' => 'other;SET SQL_MODE=0'])), 'reject malformed DB name');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['admin_mobile' => '0912x000000'])), 'reject malformed mobile');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['admin_password' => 'weak'])), 'reject weak admin password');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['admin_password' => str_repeat('a', 73)])), 'reject bcrypt truncation');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['admin_password_confirmation' => 'different'])), 'reject mismatched confirmation');
install_rejected(fn() => tamiran_install_validate(array_replace($input, ['admin_name' => []])), 'reject array injection');

$schema = file_get_contents(dirname(__DIR__) . '/private/database/schema.sql');
$statements = tamiran_install_sql_statements($schema);
$tables = array_values(array_filter($statements, fn($sql) => preg_match('/^CREATE TABLE /', $sql)));
$triggers = array_values(array_filter($statements, fn($sql) => preg_match('/^CREATE TRIGGER /', $sql)));
install_check(count($tables) === 104, 'all 104 baseline tables parsed');
install_check(count($triggers) === 8, 'all eight immutable-identity/ledger triggers parsed');
install_check(count(array_filter($statements, fn($sql) => preg_match('/^ALTER TABLE (repair_customer_devices ADD COLUMN row_version|repair_reception_drafts ADD COLUMN row_version|repair_cases ADD COLUMN reception_request_hash)/', $sql))) === 3, 'three hosting concurrency additions parsed');
install_check(!array_filter($statements, fn($sql) => preg_match('/^CREATE DATABASE /i', $sql)), 'does not require CREATE DATABASE');
install_rejected(fn() => tamiran_install_sql_statements('CREATE TABLE incomplete'), 'reject truncated SQL');

$temporary = sys_get_temp_dir() . '/tamiran-installer-test-' . bin2hex(random_bytes(8));
mkdir($temporary, 0700);
mkdir($temporary . '/database', 0700);
file_put_contents($temporary . '/database/schema.sql', $schema);
try {
    install_check(!tamiran_install_is_complete($temporary), 'fresh directory is not installed');
    tamiran_install_ensure_key($temporary);
    $installKey = trim(file_get_contents($temporary . '/install.key'));
    install_check(preg_match('/^[a-f0-9]{64}$/D', $installKey) === 1, 'filesystem install key has 256 bits');
    install_check((fileperms($temporary . '/install.key') & 0777) === 0600, 'install key permission 0600');
    tamiran_install_ensure_key($temporary);
    install_check(trim(file_get_contents($temporary . '/install.key')) === $installKey, 'existing install key is preserved');
    tamiran_install_verify_key($temporary, $installKey);
    install_check(true, 'filesystem owner key accepted');
    install_rejected(fn() => tamiran_install_verify_key($temporary, str_repeat('0', 64)), 'remote wrong key rejected before database');
    install_rejected(fn() => tamiran_install_verify_key($temporary, null), 'missing key rejected');
    install_rejected(fn() => tamiran_install_verify_key($temporary, []), 'array key rejected');
    unlink($temporary . '/install.key');
    install_rejected(fn() => tamiran_install_verify_key($temporary, $installKey), 'unreadable or missing private key fails closed');
    file_put_contents($temporary . '/config.php', "<?php return ['sentinel'=>true];");
    $sentinel = file_get_contents($temporary . '/config.php');
    install_check(tamiran_install_is_complete($temporary), 'config.php disables installer');
    install_rejected(fn() => tamiran_install($input, $temporary), 'existing config rejected');
    install_check(file_get_contents($temporary . '/config.php') === $sentinel, 'existing config never overwritten');
    unlink($temporary . '/config.php');
    file_put_contents($temporary . '/installed.lock', 'installed');
    install_check(tamiran_install_is_complete($temporary), 'installed.lock independently disables installer');
    unlink($temporary . '/installed.lock');
    $lock = fopen($temporary . '/.install.mutex', 'c');
    flock($lock, LOCK_EX);
    install_rejected(fn() => tamiran_install($input, $temporary), 'exclusive install lock rejects concurrency', 'نصب دیگری');
    flock($lock, LOCK_UN); fclose($lock);

    // Optional real-DB refusal check: reads the local test installation config,
    // connects to its already-nonempty DB and must make no modifications.
    if (getenv('TAMIRAN_INSTALLER_TEST_EXISTING_DB') === '1') {
        $configPath = dirname(__DIR__) . '/private/config.php';
        $config = require $configPath;
        $db = $config['db'];
        $existing = array_replace($input, [
            'db_host' => $db['host'], 'db_port' => (string) $db['port'], 'db_name' => $db['name'],
            'db_user' => $db['user'], 'db_password' => $db['password'],
        ]);
        install_rejected(fn() => tamiran_install($existing, $temporary), 'real nonempty MariaDB safely refused', 'خالی نیست');
        install_check(!is_file($temporary . '/config.php'), 'no config published after DB refusal');
        install_check(!glob($temporary . '/.config-*.tmp'), 'no temporary credential files remain');
        install_check((fileperms($configPath) & 0777) === 0600, 'installed config permission 0600');
        install_check($config['require_https'] === true || getenv('TAMIRAN_TEST_ALLOW_HTTP') === '1', 'production HTTPS default retained');
    }
} finally {
    foreach (glob($temporary . '/database/*') ?: [] as $file) unlink($file);
    rmdir($temporary . '/database');
    foreach (array_merge(glob($temporary . '/*') ?: [], glob($temporary . '/.*') ?: []) as $file) {
        if (is_file($file)) unlink($file);
    }
    rmdir($temporary);
}
echo json_encode(['passed' => $passed, 'failed' => 0], JSON_UNESCAPED_UNICODE) . PHP_EOL;
