<?php
declare(strict_types=1);
// Local-only fixture helper: never accepts a production database or non-test shop.
$config = require __DIR__.'/../private/config.php';
$db = $config['db'] ?? [];
if (($db['host'] ?? '') !== '127.0.0.1' || (int)($db['port'] ?? 0) !== 3307 || ($db['name'] ?? '') !== 'tamiran_test') {
    throw new RuntimeException('Synthetic local database required');
}
$shopId = filter_var($argv[1] ?? null, FILTER_VALIDATE_INT);
$marker = $argv[2] ?? '';
if (!$shopId || !preg_match('/^TEST-TAMIRAN-[A-Z0-9]+$/', $marker)) throw new RuntimeException('Invalid fixture identity');
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;dbname=tamiran_test;charset=utf8mb4', $db['user'], $db['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$shop = $pdo->prepare('SELECT name FROM repair_shops WHERE id=?');
$shop->execute([$shopId]);
if ($shop->fetchColumn() !== $marker.'-SHOP-A') throw new RuntimeException('Not the specified synthetic shop');
$insert = $pdo->prepare('INSERT INTO repair_branches(shop_id,branch_code,name,business_hours_json) VALUES(?,?,?,?)');
$insert->execute([$shopId, $marker.'-B', $marker.'-BRANCH-B', '{}']);
echo $pdo->lastInsertId();
