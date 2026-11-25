<?php
declare(strict_types=1);

/** SMS is opt-in. No network request is made until sms.enabled is true. */
final class TamiranKavenegarProvider
{
    public function __construct(private readonly string $apiKey, private readonly array $settings) {}

    private function request(string $method, array $fields): array
    {
        if (empty(tamiran_config()['sms']['enabled'])) {
            throw new TamiranApiException('ارسال پیامک در تنظیمات نصب غیرفعال است.', 503);
        }
        if (!function_exists('curl_init')) throw new TamiranApiException('افزونه cURL برای پیامک لازم است.', 503);
        // The host and API methods are fixed; provider settings cannot introduce SSRF.
        $url = 'https://api.kavenegar.com/v1/' . rawurlencode($this->apiKey) . '/' . $method . '.json';
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($fields),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        // Do not expose provider URLs (which include the API key), response bodies, or OTPs.
        if (!is_string($body) || $status !== 200 || strlen($body) > 1048576) {
            throw new TamiranApiException('سرویس پیامک پاسخ معتبر نداد.', 503);
        }
        try { $response = json_decode($body, true, 32, JSON_THROW_ON_ERROR); }
        catch (JsonException) { throw new TamiranApiException('پاسخ سرویس پیامک معتبر نیست.', 503); }
        if (($response['return']['status'] ?? null) !== 200 || !isset($response['entries'][0]['messageid'])) {
            throw new TamiranApiException('ارائه‌دهنده ارسال پیامک را تأیید نکرد.', 503);
        }
        return ['messageId' => (string) $response['entries'][0]['messageid']];
    }

    public function send(string $mobile, string $body): array
    {
        if ($body === '' || mb_strlen($body) > 1800) throw new TamiranApiException('طول متن پیامک معتبر نیست.', 422);
        $fields = ['receptor' => tamiran_mobile($mobile), 'message' => $body];
        $sender = trim((string) ($this->settings['sender'] ?? ''));
        if ($sender !== '') $fields['sender'] = $sender;
        return $this->request('sms/send', $fields);
    }

    public function lookup(string $mobile, string $template, array $tokens): array
    {
        if (!preg_match('/^[A-Za-z0-9_-]{1,120}$/', $template) || count($tokens) < 1 || count($tokens) > 3) {
            throw new TamiranApiException('قالب یا پارامترهای کد یک‌بارمصرف معتبر نیست.', 422);
        }
        $fields = ['receptor' => tamiran_mobile($mobile), 'template' => $template];
        foreach (array_values($tokens) as $index => $token) {
            $text = (string) $token;
            if ($text === '' || strlen($text) > 120 || preg_match('/\s/', $text)) throw new TamiranApiException('پارامتر قالب پیامک معتبر نیست.', 422);
            $fields[$index === 0 ? 'token' : 'token' . ($index + 1)] = $text;
        }
        return $this->request('verify/lookup', $fields);
    }
}

function tamiran_sms_provider_from_row(array $row): TamiranKavenegarProvider
{
    if (empty(tamiran_config()['sms']['enabled'])) throw new TamiranApiException('ارسال پیامک در تنظیمات نصب غیرفعال است.', 503);
    if (($row['provider_code'] ?? '') !== 'kavenegar') throw new TamiranApiException('آداپتور این ارائه‌دهنده نصب نشده است.', 409);
    try {
        $credentials = json_decode(tamiran_decrypt_secret((string) ($row['credentials_ciphertext'] ?? '')), true, 16, JSON_THROW_ON_ERROR);
        $settings = json_decode((string) ($row['settings_json'] ?? '{}'), true, 16, JSON_THROW_ON_ERROR);
    } catch (Throwable) { throw new TamiranApiException('تنظیمات رمزگذاری‌شدهٔ پیامک معتبر نیست.', 503); }
    $key = (string) ($credentials['apiKey'] ?? '');
    if (!preg_match('/^[A-Za-z0-9]{16,240}$/', $key) || !is_array($settings)) throw new TamiranApiException('کلید یا تنظیمات پیامک معتبر نیست.', 503);
    return new TamiranKavenegarProvider($key, $settings);
}

function tamiran_sms_otp_hash(int $shopId, string $purpose, string $subject, string $mobile, string $code): string
{
    return hash_hmac('sha256', json_encode([$shopId, $purpose, $subject, $mobile, $code], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), tamiran_encryption_key());
}

/**
 * Attempts and consumption use a separate transaction, so rolling back a failed
 * business action cannot reset a brute-force counter or make an OTP reusable.
 * A failed business action after a valid OTP requires a newly issued OTP.
 */
function tamiran_sms_verify_otp(PDO $businessDb, int $shopId, string $purpose, string $subject, string $mobile, string $requestId, string $code): bool
{
    if ($shopId < 1 || !preg_match('/^[A-Za-z0-9]{26}$/', $requestId) || !preg_match('/^[0-9]{6}$/', $code)) return false;
    $db = tamiran_config()['db'];
    $pdo = new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $db['host'], (int) ($db['port'] ?? 3306), $db['name']), (string) $db['user'], (string) $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    $pdo->beginTransaction();
    try {
        $query = $pdo->prepare('SELECT id,code_hash FROM tamiran_sms_otps WHERE public_id=:public AND shop_id=:shop AND purpose=:purpose AND subject_public_id=:subject AND mobile=:mobile AND consumed_at IS NULL AND attempts<max_attempts AND expires_at>UTC_TIMESTAMP() FOR UPDATE');
        $query->execute(['public' => $requestId, 'shop' => $shopId, 'purpose' => $purpose, 'subject' => $subject, 'mobile' => $mobile]);
        $row = $query->fetch();
        if (!is_array($row)) { $pdo->commit(); return false; }
        $valid = hash_equals((string) $row['code_hash'], tamiran_sms_otp_hash($shopId, $purpose, $subject, $mobile, $code));
        $query = $pdo->prepare($valid
            ? 'UPDATE tamiran_sms_otps SET attempts=attempts+1,verified_at=UTC_TIMESTAMP(),consumed_at=UTC_TIMESTAMP() WHERE id=:id'
            : 'UPDATE tamiran_sms_otps SET attempts=attempts+1 WHERE id=:id');
        $query->execute(['id' => $row['id']]);
        $pdo->commit();
        return $valid;
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
}

/** Explicit event queue for configured templates; idempotent within one shop. */
function tamiran_sms_queue_event(PDO $pdo, int $shopId, string $event, string $mobile, array $variables, string $idempotencyKey, ?string $relatedType = null, ?string $relatedPublicId = null): array
{
    if (empty(tamiran_config()['sms']['enabled'])) throw new TamiranApiException('ارسال پیامک در تنظیمات نصب غیرفعال است.', 503);
    if ($shopId < 1 || !preg_match('/^[a-z0-9._-]{2,80}$/', $event) || strlen($idempotencyKey) < 8 || strlen($idempotencyKey) > 160) throw new TamiranApiException('رویداد پیامک معتبر نیست.', 422);
    $query = $pdo->prepare('SELECT t.body_template,p.id AS provider_id FROM tamiran_sms_templates t INNER JOIN tamiran_sms_providers p ON p.shop_id=t.shop_id AND p.is_active=1 WHERE t.shop_id=:shop AND t.event_code=:event AND t.is_enabled=1 ORDER BY p.id LIMIT 1');
    $query->execute(['shop' => $shopId, 'event' => $event]);
    $row = $query->fetch();
    if (!is_array($row)) throw new TamiranApiException('قالب و ارائه‌دهندهٔ فعال پیامک تنظیم نشده‌اند.', 409);
    $replace = [];
    foreach ($variables as $key => $value) if (preg_match('/^[A-Za-z][A-Za-z0-9_]{0,63}$/', (string) $key) && is_scalar($value)) $replace['{' . $key . '}'] = (string) $value;
    $body = strtr((string) $row['body_template'], $replace);
    if (preg_match('/\{[A-Za-z][A-Za-z0-9_]*\}/', $body) || mb_strlen($body) > 1800) throw new TamiranApiException('پارامترهای قالب پیامک کامل نیست.', 422);
    $query = $pdo->prepare("INSERT INTO tamiran_sms_messages(public_id,shop_id,provider_id,event_code,recipient_mobile,body,idempotency_key,related_type,related_public_id) VALUES(:public,:shop,:provider,:event,:mobile,:body,:key,:type,:related) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)");
    $public = tamiran_id();
    $query->execute(['public' => $public, 'shop' => $shopId, 'provider' => $row['provider_id'], 'event' => $event, 'mobile' => tamiran_mobile($mobile), 'body' => $body, 'key' => $idempotencyKey, 'type' => $relatedType, 'related' => $relatedPublicId]);
    $query = $pdo->prepare('SELECT public_id,status FROM tamiran_sms_messages WHERE shop_id=:shop AND idempotency_key=:key');
    $query->execute(['shop' => $shopId, 'key' => $idempotencyKey]);
    $result = $query->fetch();
    return ['queued' => true, 'publicId' => $result['public_id'], 'status' => $result['status']];
}
