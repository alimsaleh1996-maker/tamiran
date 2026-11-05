<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/public_html/api/bootstrap.php';
require dirname(__DIR__) . '/private/captcha-audio.php';
$count = 0;
function audio_check(bool $condition, string $name): void { global $count; if (!$condition) throw new RuntimeException($name); $count++; }
$state = ['request_key'=>'fixture','expires_at'=>1000];
audio_check(tamiran_captcha_state_valid($state,'fixture',999),'Unexpired matching challenge accepted');
audio_check(!tamiran_captcha_state_valid($state,'other',999),'Wrong binding denied');
audio_check(!tamiran_captcha_state_valid($state,'fixture',1001),'Expired audio denied');
audio_check(!tamiran_captcha_state_valid(null,'fixture',999),'Consumed/missing challenge denied');
audio_check(!tamiran_captcha_state_valid(['expires_at'=>1000],'fixture',999),'Legacy incomplete state denied');
foreach (range(2,9) as $digit) audio_check(strlen(tamiran_captcha_pcm(dirname(__DIR__).'/private/captcha-audio/'.$digit.'.wav')) > 1000,'Bundled Persian recording is valid PCM');
$wav = tamiran_captcha_audio('23459');
audio_check(substr($wav,0,4)==='RIFF' && substr($wav,8,4)==='WAVE','Generated WAV has standard header');
audio_check(unpack('Vlength',substr($wav,4,4))['length']===strlen($wav)-8,'RIFF length matches bytes');
try { tamiran_captcha_audio('../23'); throw new RuntimeException('Invalid answer accepted'); } catch (InvalidArgumentException) { $count++; }
echo json_encode(['passed'=>$count,'failed'=>0,'scope'=>'PCM assets, expiry, binding and input boundaries'])."\n";
