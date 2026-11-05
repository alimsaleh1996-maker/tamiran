<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

tamiran_api(static function (): array {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        throw new TamiranApiException('روش درخواست مجاز نیست.', 405);
    }
    return ['csrf_token' => tamiran_csrf_token()];
});
