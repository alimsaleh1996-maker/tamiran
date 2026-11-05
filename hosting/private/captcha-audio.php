<?php
declare(strict_types=1);

/** The same expiry/binding check is used for image and audio representations. */
function tamiran_captcha_state_valid(mixed $state, string $requestKey, int $now): bool
{
    return is_array($state)
        && is_string($state['request_key'] ?? null)
        && hash_equals($state['request_key'], $requestKey)
        && (int) ($state['expires_at'] ?? 0) >= $now;
}

function tamiran_captcha_pcm(string $path): string
{
    $wav = @file_get_contents($path);
    if (!is_string($wav) || strlen($wav) > 200000 || substr($wav, 0, 4) !== 'RIFF' || substr($wav, 8, 4) !== 'WAVE') {
        throw new TamiranApiException('فایل صوتی عبارت امنیتی در دسترس نیست.', 503);
    }
    $format = false;
    for ($offset = 12; $offset + 8 <= strlen($wav);) {
        $type = substr($wav, $offset, 4);
        $length = unpack('Vlength', substr($wav, $offset + 4, 4))['length'];
        if ($length > strlen($wav) - $offset - 8) break;
        if ($type === 'fmt ' && $length >= 16) {
            $fmt = unpack('vformat/vchannels/Vrate/Vbytes/vblock/vbits', substr($wav, $offset + 8, 16));
            $format = $fmt['format'] === 1 && $fmt['channels'] === 1 && $fmt['rate'] === 16000 && $fmt['bits'] === 16;
        }
        if ($type === 'data' && $format && $length > 0 && $length % 2 === 0) return substr($wav, $offset + 8, $length);
        $offset += 8 + $length + ($length % 2);
    }
    throw new TamiranApiException('ساختار فایل صوتی عبارت امنیتی معتبر نیست.', 503);
}

/** Pure PHP runtime: bundled Persian recordings, no TTS service or executable. */
function tamiran_captcha_audio(string $answer): string
{
    if (!preg_match('/^[2-9]{5}$/D', $answer)) throw new InvalidArgumentException('Invalid CAPTCHA audio input.');
    $pcm = str_repeat("\0", 4800);
    foreach (str_split($answer) as $digit) {
        $pcm .= tamiran_captcha_pcm(tamiran_private_root() . '/captcha-audio/' . $digit . '.wav');
        $pcm .= str_repeat("\0", random_int(3500, 5500) * 2);
    }
    if (strlen($pcm) > 1000000) throw new TamiranApiException('حجم عبارت امنیتی صوتی معتبر نیست.', 503);
    return 'RIFF' . pack('V', 36 + strlen($pcm)) . 'WAVEfmt '
        . pack('VvvVVvv', 16, 1, 1, 16000, 32000, 2, 16)
        . 'data' . pack('V', strlen($pcm)) . $pcm;
}
