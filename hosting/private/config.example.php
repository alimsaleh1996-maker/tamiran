<?php
declare(strict_types=1);

// Reference only. The installation wizard creates config.php outside public_html.
// Never put production credentials in this example or commit config.php.
return [
    'db' => ['host' => 'localhost', 'port' => 3306, 'name' => '', 'user' => '', 'password' => '', 'charset' => 'utf8mb4'],
    'timezone' => 'UTC',
    'secrets' => ['encryption_key' => ''],
    'session_ttl' => 43200,
    'session_idle_ttl' => 3600,
    'require_https' => true,
    'trusted_proxies' => [],
    'trust_forwarded_proto' => false,
    'debug_enabled' => false,
    'debug_token' => '',
    'retention' => ['cron_token' => ''],
    'sms' => ['enabled' => false, 'test_sink' => false, 'cron_token' => ''],
    'backup' => ['cron_token' => '', 'max_archive_bytes' => 67108864],
];
