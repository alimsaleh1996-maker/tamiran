<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function client_error_text(mixed $value, int $maximum): string
{
    $text = trim((string) $value);
    if (strlen($text) > $maximum) $text = substr($text, 0, $maximum);
    return $text;
}

tamiran_api(static function (): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new TamiranApiException('روش درخواست مجاز نیست.', 405);

    $fetchSite = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($fetchSite !== '' && !in_array($fetchSite, ['same-origin', 'none'], true)) {
        throw new TamiranApiException('مبدأ گزارش رابط کاربری مجاز نیست.', 403);
    }
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
        $requestHost = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')) ?? '');
        if ($originHost === '' || !hash_equals($requestHost, $originHost)) {
            throw new TamiranApiException('مبدأ گزارش رابط کاربری مجاز نیست.', 403);
        }
    }

    tamiran_csrf_token();
    $now = time();
    $rate = $_SESSION['tamiran_client_error_rate'] ?? ['started_at'=>$now, 'count'=>0];
    if (!is_array($rate) || ($now - (int) ($rate['started_at'] ?? 0)) > 600) $rate = ['started_at'=>$now, 'count'=>0];
    $rate['count'] = (int) ($rate['count'] ?? 0) + 1;
    $_SESSION['tamiran_client_error_rate'] = $rate;
    if ($rate['count'] > 10) return ['logged'=>false, 'rate_limited'=>true];

    $input = tamiran_json_body();
    $reference = strtoupper(client_error_text($input['reference'] ?? '', 80));
    if (!preg_match('/^UI-[A-Z0-9-]{6,76}$/', $reference)) $reference = 'UI-' . strtoupper(substr(tamiran_request_id(), 0, 16));
    $message = client_error_text($input['message'] ?? 'خطای ناشناخته رابط کاربری', 500);
    $stack = client_error_text($input['stack'] ?? '', 4000);
    $componentStack = client_error_text($input['componentStack'] ?? '', 2000);
    $page = (string) parse_url(client_error_text($input['page'] ?? '/', 300), PHP_URL_PATH);
    $source = (string) parse_url(client_error_text($input['source'] ?? '', 300), PHP_URL_PATH);

    tamiran_log('error', 'client_runtime_error', [
        'client_reference'=>$reference,
        'message'=>$message,
        'stack'=>$stack,
        'component_stack'=>$componentStack,
        'page'=>$page ?: '/',
        'source'=>$source,
        'client_version'=>client_error_text($input['version'] ?? '', 30),
        'browser'=>client_error_text($_SERVER['HTTP_USER_AGENT'] ?? '', 240),
        'ip_hash'=>hash('sha256', 'client-error|' . tamiran_client_ip()),
    ]);
    return ['logged'=>true, 'reference'=>$reference];
});
