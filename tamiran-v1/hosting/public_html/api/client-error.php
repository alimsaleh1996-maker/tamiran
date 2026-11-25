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
    $reference = strtoupper(client_error_text(is_string($input['reference'] ?? null) ? $input['reference'] : '', 80));
    if (!preg_match('/^UI-[A-Z0-9-]{6,76}$/', $reference)) $reference = 'UI-' . strtoupper(substr(tamiran_request_id(), 0, 16));
    // Never persist free-form browser text, URLs, stacks, form values or headers.
    $kind = is_string($input['kind'] ?? null) ? $input['kind'] : 'runtime';
    if (!in_array($kind, ['runtime', 'unhandled_rejection', 'render', 'network_failure', 'operation_failure'], true)) $kind = 'runtime';
    $endpoint = is_string($input['endpoint'] ?? null) ? $input['endpoint'] : '';
    if (strlen($endpoint) > 120 || !preg_match('~^/api/[a-z0-9_-]+\.php$~D', $endpoint)) $endpoint = '';
    $status = filter_var($input['status'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>100, 'max_range'=>599]]);

    $logged = tamiran_log('error', 'client_runtime_error', [
        'client_reference'=>$reference,
        'kind'=>$kind,
        'endpoint'=>$endpoint !== '' ? $endpoint : null,
        'status'=>$status !== false ? $status : null,
    ]);
    return ['logged'=>$logged, 'reference'=>$reference];
});
