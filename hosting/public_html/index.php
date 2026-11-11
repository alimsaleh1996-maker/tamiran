<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (!is_file(dirname(__DIR__) . '/private/config.php')) {
    header('Location: /install/', true, 302);
    exit;
}
try {
    require_once __DIR__ . '/api/bootstrap.php';
    tamiran_require_https();
} catch (Throwable $error) {
    http_response_code(426);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'برای استفاده از تعمیران، نشانی سایت را با اتصال امن HTTPS باز کنید.';
    exit;
}
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="تعمیران؛ مدیریت پذیرش، تعمیرات، انبار و خدمات مشتری" />
    <title>تعمیران | مدیریت تعمیرگاه</title>
    <link rel="icon" href="/favicon.svg" />
    <link rel="stylesheet" href="/assets/app-D2PBnnyi.css" />
    <link rel="stylesheet" href="/assets/beta7-ui.css" />
    <link rel="stylesheet" href="/assets/index-B_SWlkkz.css" />
    <link rel="stylesheet" href="/assets/accessibility.css" />
    <script type="module" crossorigin src="/assets/index-S_8Qm_s7.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <noscript>برای استفاده از تعمیران، JavaScript مرورگر را فعال کنید.</noscript>
  </body>
</html>
