<?php
declare(strict_types=1);

// Run only against a separate, freshly initialized synthetic database.
// Example: TAMIRAN_SERVICE_TEST_DB=tamiran_services_test php tests/services_test.php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$source = dirname(__DIR__);
$database = (string) getenv('TAMIRAN_SERVICE_TEST_DB');
if (!preg_match('/^[A-Za-z0-9_]*services_test$/', $database)) throw new RuntimeException('Explicit isolated services_test database required.');
$config = require $source . '/private/config.php'; $config['db']['name'] = $database; $config['sms']['enabled'] = false;
$root = sys_get_temp_dir() . '/tamiran-services-' . bin2hex(random_bytes(6));
mkdir($root . '/private', 0700, true); mkdir($root . '/public_html/api', 0700, true);
foreach (['backup-engine.php', 'sms-service.php'] as $file) copy($source . '/private/' . $file, $root . '/private/' . $file);
copy($source . '/public_html/api/bootstrap.php', $root . '/public_html/api/bootstrap.php');
file_put_contents($root . '/private/config.php', '<?php return ' . var_export($config, true) . ';'); chmod($root . '/private/config.php', 0600);
require $root . '/public_html/api/bootstrap.php'; require $root . '/private/backup-engine.php'; require $root . '/private/sms-service.php';
$pdo = tamiran_db();
if ((int) $pdo->query('SELECT COUNT(*) FROM repair_shops')->fetchColumn() !== 0 || (int) $pdo->query('SELECT COUNT(*) FROM tamiran_users')->fetchColumn() !== 0) throw new RuntimeException('Refusing nonempty fixture database.');
$checks = [];
function check(bool $condition, string $name): void { global $checks; if (!$condition) throw new RuntimeException($name); $checks[] = $name; }
function denied(callable $call, string $name): void { try { $call(); } catch (TamiranApiException) { check(true, $name); return; } throw new RuntimeException('Expected denial: ' . $name); }
$pdo->exec('UPDATE tamiran_backup_settings SET offsite_required=0');
$q = $pdo->prepare("INSERT INTO tamiran_users(username,display_name,password_hash,role_code) VALUES(?,?,?,'central_admin')");
$q->execute(['TEST-TAMIRAN-ADMIN', 'آزمایشی — مدیر مرکزی', tamiran_password_hash('TEST-TAMIRAN-strong-password')]); $admin = (int) $pdo->lastInsertId();
$shops = [];
foreach (['A', 'B'] as $index => $suffix) {
    $q = $pdo->prepare("INSERT INTO repair_shops(public_id,shop_code,public_shop_code,name,repair_type,workflow_settings_json,tax_settings_json,feature_flags_json,modules_json,license_started_at,license_expires_at) VALUES(?,?,?,?,?,'{}','{}','{}','[\"repair\"]','2026-01-01','2030-01-01')");
    $q->execute([tamiran_id(), 'TEST-TAMIRAN-SERVICE-' . $suffix, '99999' . ($index + 1), 'آزمایشی — ' . $suffix, 'mobile_tablet']); $shops[] = (int) $pdo->lastInsertId();
}
[$shop, $other] = $shops;
$q = $pdo->prepare('INSERT INTO repair_customers(public_id,shop_id,full_name,mobile) VALUES(?,?,?,?)');
$q->execute([tamiran_id(), $shop, 'آزمایشی — پیش از بکاپ', '09990000001']); $customer = (int) $pdo->lastInsertId();
$q->execute([tamiran_id(), $other, 'آزمایشی — تعمیرگاه دوم', '09990000002']);
$q = $pdo->prepare("INSERT INTO tamiran_users(shop_id,username,display_name,password_hash,role_code,active_session_hash) VALUES(?,?,?,?,'repair_manager',?)");
$q->execute([$shop, 'TEST-TAMIRAN-MANAGER', 'آزمایشی — مدیر', tamiran_password_hash('TEST-TAMIRAN-manager-password'), str_repeat('a', 64)]); $manager = (int) $pdo->lastInsertId();
tamiran_audit($pdo, $shop, null, $admin, 'services.test', 'test', 'TEST-TAMIRAN', null, ['synthetic' => true]);
$key = $shop . '/ab/' . str_repeat('c', 40); $file = tamiran_private_root() . '/files/' . $key; mkdir(dirname($file), 0700, true); $body = '%PDF-TEST-TAMIRAN'; file_put_contents($file, $body);
$q = $pdo->prepare("INSERT INTO tamiran_private_files(public_id,shop_id,storage_key,original_name,mime_type,size_bytes,sha256,purpose,uploaded_by_user_id) VALUES(?,?,?,'TEST-TAMIRAN.pdf','application/pdf',?,?,'other',?)");
$q->execute([tamiran_id(), $shop, $key, strlen($body), hash('sha256', $body), $manager]);
$job = tamiran_backup_run($pdo, 'shop', $shop, 'manual', $admin);
check($job['status'] === 'succeeded', 'local_shop_backup_succeeds');
check(tamiran_backup_verify($pdo, $job['id'])['verified'] === true, 'checksum_decryption_record_verification');
[$record, $snapshot] = tamiran_backup_read($pdo, $job['id']);
check(count($snapshot['tables']['repair_shops']) === 1 && (int) $snapshot['tables']['repair_shops'][0]['id'] === $shop, 'shop_snapshot_excludes_other_shop');
check(count($snapshot['tables']['repair_customers']) === 1, 'shop_customers_scoped');
check(count($snapshot['tables']['tamiran_users']) === 1 && $snapshot['tables']['tamiran_users'][0]['role_code'] === 'repair_manager', 'central_admin_excluded_from_shop_snapshot');
check(base64_decode($snapshot['files'][$key], true) === $body, 'private_file_bytes_included');
$preview = tamiran_backup_restore_preview($pdo, $job['id']);
check($preview['shopId'] === $shop, 'validated_restore_preview');
$q = $pdo->prepare('UPDATE repair_customers SET full_name=? WHERE id=?'); $q->execute(['آزمایشی — پس از بکاپ', $customer]);
$restored = tamiran_backup_restore_shop($pdo, $job['id'], $admin);
check($restored['restored'] === true && $restored['emergencyBackupJobId'] > $job['id'], 'restore_creates_emergency_snapshot');
$q = $pdo->prepare('SELECT full_name FROM repair_customers WHERE id=?'); $q->execute([$customer]);
check($q->fetchColumn() === 'آزمایشی — پیش از بکاپ', 'shop_data_restored');
$q = $pdo->prepare('SELECT active_session_hash FROM tamiran_users WHERE id=?'); $q->execute([$manager]); check($q->fetchColumn() === null, 'restored_shop_sessions_revoked');
check(file_get_contents($file) === $body, 'private_file_preserved_and_verified');
$q = $pdo->prepare('SELECT full_name FROM repair_customers WHERE shop_id=?'); $q->execute([$other]); check($q->fetchColumn() === 'آزمایشی — تعمیرگاه دوم', 'other_shop_unchanged');
$archivePath = tamiran_backup_root() . '/' . $record['archive_name']; $original = file_get_contents($archivePath); file_put_contents($archivePath, $original . 'tamper');
denied(static fn() => tamiran_backup_verify($pdo, $job['id']), 'archive_tamper_rejected'); file_put_contents($archivePath, $original);
denied(static fn() => tamiran_sms_provider_from_row(['provider_code' => 'kavenegar']), 'sms_disabled_no_network');
$request = tamiran_id(); $code = '123456';
$q = $pdo->prepare("INSERT INTO tamiran_sms_otps(public_id,shop_id,purpose,subject_public_id,mobile,code_hash,expires_at) VALUES(?,?,'estimate','TEST-TAMIRAN-ESTIMATE','09990000001',?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 3 MINUTE))");
$q->execute([$request, $shop, tamiran_sms_otp_hash($shop, 'estimate', 'TEST-TAMIRAN-ESTIMATE', '09990000001', $code)]);
$verify = static fn(string $attempt): bool => tamiran_sms_verify_otp($pdo, $shop, 'estimate', 'TEST-TAMIRAN-ESTIMATE', '09990000001', $request, $attempt);
$pdo->beginTransaction(); check($verify('000000') === false, 'wrong_otp_rejected'); $pdo->rollBack();
$q = $pdo->prepare('SELECT attempts FROM tamiran_sms_otps WHERE public_id=?'); $q->execute([$request]); check((int) $q->fetchColumn() === 1, 'attempt_survives_business_rollback');
check(tamiran_sms_verify_otp($pdo, $other, 'estimate', 'TEST-TAMIRAN-ESTIMATE', '09990000001', $request, $code) === false, 'cross_shop_otp_rejected');
check($verify($code) === true && $verify($code) === false, 'otp_consumed_once');
$locked = tamiran_id(); $q = $pdo->prepare("INSERT INTO tamiran_sms_otps(public_id,shop_id,purpose,subject_public_id,mobile,code_hash,expires_at) VALUES(?,?,'estimate','TEST-TAMIRAN-ESTIMATE','09990000001',?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 3 MINUTE))");
$q->execute([$locked, $shop, tamiran_sms_otp_hash($shop, 'estimate', 'TEST-TAMIRAN-ESTIMATE', '09990000001', $code)]);
for ($i = 0; $i < 5; $i++) tamiran_sms_verify_otp($pdo, $shop, 'estimate', 'TEST-TAMIRAN-ESTIMATE', '09990000001', $locked, '000000');
check(!tamiran_sms_verify_otp($pdo, $shop, 'estimate', 'TEST-TAMIRAN-ESTIMATE', '09990000001', $locked, $code), 'otp_attempt_limit_enforced');
$q = $pdo->prepare('UPDATE tamiran_sms_otps SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE),attempts=0,consumed_at=NULL WHERE public_id=?'); $q->execute([$request]);
check($verify($code) === false, 'expired_otp_rejected');
echo json_encode(['passed' => count($checks), 'checks' => $checks, 'network_sms' => 'NOT_SENT', 'database' => $database], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), PHP_EOL;
