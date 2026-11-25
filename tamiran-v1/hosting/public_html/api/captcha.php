<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require tamiran_private_root() . '/captcha-audio.php';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Request-ID: ' . tamiran_request_id());
header('Cross-Origin-Resource-Policy: same-origin');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
    tamiran_require_https();
    tamiran_csrf_token();
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') throw new TamiranApiException('درخواست عبارت امنیتی مجاز نیست.', 403);
    $mode = $_GET['mode'] ?? 'image';
    $requestKey = $_GET['v'] ?? '';
    if (!is_string($mode) || !in_array($mode, ['init','image','audio'], true)
        || !is_string($requestKey) || !preg_match('/^[A-Za-z0-9_-]{0,80}$/D', $requestKey)) {
        throw new TamiranApiException('درخواست عبارت امنیتی معتبر نیست.');
    }
    $state = $_SESSION['tamiran_captcha'] ?? null;
    $valid = tamiran_captcha_state_valid($state, $requestKey, time());
    // Legacy clients request a new image without a key. Audio never creates,
    // refreshes or extends a challenge and remains bound to this PHP session.
    if ($mode !== 'audio' && (!$valid || ($mode === 'image' && $requestKey === ''))) {
        tamiran_public_rate_limit('captcha-generate|' . tamiran_client_ip(), 60, 60, 60);
        $answer = '';
        for ($i = 0; $i < 5; $i++) $answer .= (string) random_int(2, 9);
        $image = tamiran_captcha_image($answer);
        $state = ['answer_hash' => hash('sha256', $answer), 'expires_at' => time() + 300,
            'request_key' => $requestKey, 'audio_wav' => tamiran_captcha_audio($answer),
            'image_body' => $image['body'], 'image_type' => $image['type']];
        $_SESSION['tamiran_captcha'] = $state;
        $valid = true;
        unset($answer);
    }
    if (!$valid) throw new TamiranApiException('مهلت عبارت امنیتی پایان یافته است؛ عبارت جدید دریافت کنید.', 410);
    if ($mode === 'init') tamiran_respond(['audioAvailable' => true, 'expiresIn' => max(0, $state['expires_at'] - time())]);
    if ($mode === 'audio') {
        tamiran_public_rate_limit('captcha-audio|' . tamiran_client_ip(), 120, 60, 60);
        tamiran_log_response(200);
        header('Content-Type: audio/wav');
        header('Content-Length: ' . strlen($state['audio_wav']));
        header('Link: </assets/captcha-audio-credits.txt>; rel="license"');
        echo $state['audio_wav'];
    } else {
        tamiran_log_response(200);
        header('Content-Type: ' . $state['image_type']);
        header("Content-Security-Policy: default-src 'none'; sandbox");
        echo $state['image_body'];
    }
    exit;
} catch (Throwable $error) { tamiran_fail($error); }

function tamiran_captcha_image(string $answer): array
{
if (function_exists('imagecreatetruecolor') && function_exists('imagepng')) {
    $image = imagecreatetruecolor(148, 54);
    if ($image === false) throw new TamiranApiException('ساخت تصویر امنیتی انجام نشد.', 500);
    $background = imagecolorallocate($image, 238, 247, 245);
    $ink = imagecolorallocate($image, 23, 63, 60);
    $teal = imagecolorallocate($image, 37, 125, 119);
    $gold = imagecolorallocate($image, 188, 145, 22);
    imagefilledrectangle($image, 0, 0, 147, 53, $background);
    for ($index = 0; $index < 10; $index++) {
        imageline($image, random_int(0,147), random_int(0,53), random_int(0,147), random_int(0,53), $index % 2 === 0 ? $teal : $gold);
    }
    for ($index = 0; $index < 140; $index++) imagesetpixel($image, random_int(0,147), random_int(0,53), $index % 2 === 0 ? $teal : $gold);
    for ($index = 0; $index < 5; $index++) {
        imagestring($image, 5, 14 + ($index * 25) + random_int(-2,2), random_int(17,23), $answer[$index], $ink);
    }
    ob_start();
    imagepng($image, null, 7);
    $body = ob_get_clean();
    imagedestroy($image);
    if (!is_string($body)) throw new TamiranApiException('ساخت تصویر امنیتی انجام نشد.', 503);
    return ['type' => 'image/png', 'body' => $body];
}

// مسیر پشتیبان برای هاست‌هایی که افزونه GD ندارند: ارقام با قطعات خطی رسم می‌شوند
// و پاسخ به شکل متن در منبع SVG قرار نمی‌گیرد.
$digitSegments = [
    '2'=>['a','b','g','e','d'], '3'=>['a','b','g','c','d'], '4'=>['f','g','b','c'],
    '5'=>['a','f','g','c','d'], '6'=>['a','f','g','e','c','d'], '7'=>['a','b','c'],
    '8'=>['a','b','c','d','e','f','g'], '9'=>['a','b','c','d','f','g'],
];
$coordinates = [
    'a'=>[3,2,17,2], 'b'=>[18,3,18,17], 'c'=>[18,20,18,34], 'd'=>[3,35,17,35],
    'e'=>[2,20,2,34], 'f'=>[2,3,2,17], 'g'=>[3,18,17,18],
];
$characters = '';
for ($index = 0; $index < 5; $index++) {
    $offset = 12 + ($index * 26);
    $angle = random_int(-9, 9);
    $segments = '';
    foreach ($digitSegments[$answer[$index]] as $segment) {
        [$x1,$y1,$x2,$y2] = $coordinates[$segment];
        $segments .= sprintf('<line x1="%d" y1="%d" x2="%d" y2="%d"/>', $x1+$offset, $y1+8, $x2+$offset, $y2+8);
    }
    $characters .= sprintf('<g transform="rotate(%d %d 26)">%s</g>', $angle, $offset+10, $segments);
}
$noise = '';
for ($index = 0; $index < 18; $index++) {
    $noise .= sprintf('<line x1="%d" y1="%d" x2="%d" y2="%d"/>', random_int(0,148), random_int(0,54), random_int(0,148), random_int(0,54));
}
return ['type' => 'image/svg+xml; charset=utf-8', 'body' => '<svg xmlns="http://www.w3.org/2000/svg" width="148" height="54" viewBox="0 0 148 54" role="img" aria-label="تصویر امنیتی">'
    . '<rect width="148" height="54" rx="10" fill="#eef7f5"/>'
    . '<g stroke="#2c817b" stroke-width="1" opacity=".28">' . $noise . '</g>'
    . '<g stroke="#173f3c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' . $characters . '</g>'
    . '</svg>'];

}
