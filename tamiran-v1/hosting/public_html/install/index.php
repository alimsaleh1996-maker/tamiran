<?php
declare(strict_types=1);
ini_set('display_errors', '0');
require dirname(__DIR__, 2) . '/private/install.php';
$privateDir = dirname(__DIR__, 2) . '/private';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");

function install_escape(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
$host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$loopback = preg_match('/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/D', $host) === 1
    && in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
$https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
$complete = tamiran_install_is_complete($privateDir);
$error = null;
$success = null;
$checks = tamiran_install_preflight($privateDir);
$allowed = $https || $loopback;
if (!$complete && $allowed) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('tamiran_install');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/install/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
    if (!isset($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    try { tamiran_install_ensure_key($privateDir); }
    catch (TamiranInstallException $exception) { $error = $exception->getMessage(); }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) {
            tamiran_install_log($privateDir, 'install_body_rejected');
            http_response_code(413); $error = 'حجم فرم نصب بیش از حد مجاز است.';
        } elseif (!is_string($_POST['csrf_token'] ?? null) || !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
            tamiran_install_log($privateDir, 'install_csrf_rejected');
            http_response_code(403); $error = 'نشست فرم معتبر نیست؛ صفحه را تازه‌سازی کنید.';
        } else {
            try {
                tamiran_install_verify_key($privateDir, $_POST['install_key'] ?? null);
                $success = tamiran_install($_POST, $privateDir);
                $_SESSION = [];
                session_destroy();
                $complete = true;
            } catch (TamiranInstallException $exception) {
                tamiran_install_log($privateDir, 'install_rejected');
                http_response_code(422); $error = $exception->getMessage() . ' کد پیگیری نصب: ' . tamiran_install_request_id();
            } catch (Throwable) {
                tamiran_install_log($privateDir, 'install_unexpected_error');
                http_response_code(500); $error = 'نصب کامل نشد؛ پیش‌نیازها و خالی‌بودن دیتابیس را بررسی کنید. کد پیگیری نصب: ' . tamiran_install_request_id();
            }
        }
    }
} elseif (!$complete) { http_response_code(403); }
if ($error !== null && !str_contains($error, 'کد پیگیری نصب:')) $error .= ' کد پیگیری نصب: ' . tamiran_install_request_id();
$csrf = $_SESSION['csrf_token'] ?? '';
?>
<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>نصب تعمیران</title><link rel="stylesheet" href="/install/style.css"></head>
<body><main><header><span class="brand">ت</span><div><small>راه‌اندازی روی هاست شخصی</small><h1>نصب تعمیران</h1></div></header>
<?php if ($success): ?>
<section class="notice success"><h2>نصب کامل شد</h2><p>حساب مدیر با شماره <?= install_escape($success['mobile']) ?> ساخته شد. <?= (int) $success['tables'] ?> جدول آماده است. نصب‌کننده غیرفعال شد.</p><a class="button" href="/">ورود به تعمیران</a></section>
<?php elseif ($complete): ?>
<section class="notice"><h2>نرم‌افزار قبلاً نصب شده است</h2><p>برای حفاظت از اطلاعات، نصب دوباره از این صفحه امکان‌پذیر نیست.</p><a href="/">بازگشت به نرم‌افزار</a></section>
<?php elseif (!$allowed): ?>
<section class="notice error"><h2>اتصال امن لازم است</h2><p>ابتدا گواهی SSL دامنه را در پنل هاست فعال کنید و این صفحه را با HTTPS باز کنید. رمز دیتابیس را روی اتصال ناامن ارسال نکنید.</p></section>
<?php else: ?>
<p>در پنل هاست یک پایگاه داده <strong>خالی</strong> و کاربر آن را بسازید و همه دسترسی‌های آن دیتابیس را به کاربر بدهید. اطلاعات این فرم فقط برای نصب استفاده می‌شود.</p>
<ul class="checks"><?php foreach ($checks as $label => $passed): ?><li class="<?= $passed ? 'ok' : 'bad' ?>"><?= $passed ? '✓' : '×' ?> <?= install_escape($label) ?></li><?php endforeach; ?></ul>
<?php if ($error): ?><div class="notice error" role="alert"><?= install_escape($error) ?></div><?php endif; ?>
<form method="post" action="/install/" autocomplete="off"><input type="hidden" name="csrf_token" value="<?= install_escape($csrf) ?>">
<fieldset><legend>مالکیت نصب</legend><label>کلید نصب<input name="install_key" type="password" required minlength="64" maxlength="64" dir="ltr" autocomplete="off"></label><p class="hint">در مدیریت فایل پنل هاست، فایل <bdi>private/install.key</bdi> را خارج از <bdi>public_html</bdi> باز و مقدار آن را اینجا کپی کنید. این کلید در صفحه وب نمایش داده نمی‌شود و بعد از نصب حذف می‌شود.</p></fieldset>
<fieldset><legend>۱. اتصال پایگاه داده</legend><div class="grid">
<label>میزبان دیتابیس<input name="db_host" value="localhost" required maxlength="253" dir="ltr"></label>
<label>درگاه<input name="db_port" value="3306" type="number" min="1" max="65535" required dir="ltr"></label>
<label>نام دیتابیس<input name="db_name" required maxlength="64" dir="ltr"></label>
<label>نام کاربر دیتابیس<input name="db_user" required maxlength="190" dir="ltr"></label>
</div><label>رمز کاربر دیتابیس<input name="db_password" type="password" autocomplete="new-password" dir="ltr"></label></fieldset>
<fieldset><legend>۲. مدیر مرکزی</legend><div class="grid">
<label>نام و نام خانوادگی<input name="admin_name" required maxlength="180" autocomplete="name"></label>
<label>شماره موبایل<input name="admin_mobile" required inputmode="tel" maxlength="11" placeholder="09xxxxxxxxx" dir="ltr"></label>
<label>رمز مدیر<input name="admin_password" type="password" minlength="12" maxlength="72" required autocomplete="new-password" dir="ltr"></label>
<label>تکرار رمز مدیر<input name="admin_password_confirmation" type="password" minlength="12" maxlength="72" required autocomplete="new-password" dir="ltr"></label>
</div><p class="hint">رمز ۱۲ تا ۷۲ بایت، شامل حرف انگلیسی، عدد و نشانه. هیچ حساب یا رمز پیش‌فرضی ساخته نمی‌شود.</p></fieldset>
<p class="hint">نصب روی دیتابیس دارای جدول انجام نمی‌شود. اگر نصب SQL نیمه‌کاره ماند، جدول‌ها خودکار حذف نمی‌شوند؛ برای تکرار یک دیتابیس خالی تازه انتخاب کنید.</p>
<button type="submit" <?= in_array(false, $checks, true) ? 'disabled' : '' ?>>نصب و ساخت حساب مدیر</button></form>
<?php endif; ?>
<footer>فایل تنظیمات و رمز اتصال خارج از پوشه عمومی نگه‌داری می‌شوند.</footer></main></body></html>
