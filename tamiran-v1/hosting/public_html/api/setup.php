<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
// Installation is an authenticated, one-time installer operation. This legacy
// endpoint must never create or reset a central administrator.
tamiran_api(static function (): array {
    throw new TamiranApiException('راه‌اندازی فقط از نصب‌کننده یک‌بارمصرف انجام می‌شود.', 410);
});
