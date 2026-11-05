<?php
declare(strict_types=1);

// Read-only verification of the synthetic fixture created by smoke.py.
// Run only inside a disposable local PHP/MariaDB test environment.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$marker = (string) ($argv[1] ?? '');
if (!preg_match('/^TEST-TAMIRAN-[A-Z0-9_-]{1,64}$/D', $marker)) {
    fwrite(STDERR, "Usage: php tests/database_test.php TEST-TAMIRAN-<run-id>\n");
    exit(2);
}
require dirname(__DIR__) . '/public_html/api/bootstrap.php';
$results = [];
function verify_db(string $label, bool $condition): void {
    global $results;
    $results[] = ['name' => $label, 'status' => $condition ? 'PASS' : 'FAIL'];
    if (!$condition) throw new RuntimeException($label);
}
try {
    $pdo = tamiran_db();
    $pdo->exec('SET TRANSACTION READ ONLY');
    $pdo->beginTransaction();
    verify_db('PDO uses native prepared statements', !(bool)$pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES));
    $statement = $pdo->prepare("SELECT :n + :n AS doubled, :label AS label, ':n' AS literal /* :n */");
    $literal = "literal :n and quote '";
    $statement->execute(['n' => 9, 'label' => $literal]);
    $row = $statement->fetch();
    verify_db('repeated named parameters preserve native values and quoted text', (int)$row['doubled'] === 18 && $row['label'] === $literal && $row['literal'] === ':n');
    $statement = $pdo->prepare('SELECT id,receipt_counter FROM repair_shops WHERE name=:name');
    $statement->execute(['name' => $marker . '-SHOP-A']);
    $shop = $statement->fetch();
    verify_db('exact synthetic shop exists', is_array($shop));
    $shopId = (int)$shop['id'];
    $count = static function (string $table) use ($pdo, $shopId): int {
        // Table names are fixed by this test, never from runtime input.
        $statement = $pdo->prepare("SELECT COUNT(*) FROM {$table} WHERE shop_id=:shop");
        $statement->execute(['shop' => $shopId]);
        return (int)$statement->fetchColumn();
    };
    verify_db('repeat visit creates two cases', $count('repair_cases') === 2);
    verify_db('repeat visit reuses one customer', $count('repair_customers') === 1);
    verify_db('repeat visit reuses one device', $count('repair_customer_devices') === 1);
    verify_db('receipt counter advances exactly twice', (int)$shop['receipt_counter'] === 2);
    $statement = $pdo->prepare('SELECT payload_json,status,row_version FROM repair_reception_drafts WHERE shop_id=:shop ORDER BY id');
    $statement->execute(['shop' => $shopId]);
    $drafts = $statement->fetchAll();
    verify_db('two drafts persisted with terminal outcomes', count($drafts) === 2 && array_column($drafts, 'status') === ['submitted', 'discarded']);
    foreach ($drafts as $index => $draft) {
        $envelope = json_decode($draft['payload_json'], true, 32, JSON_THROW_ON_ERROR);
        verify_db('draft ' . ($index + 1) . ' payload encrypted at rest', ($envelope['format'] ?? '') === 'tamiran-draft-v1' && !str_contains($draft['payload_json'], $marker));
        $payload = json_decode(tamiran_decrypt_secret($envelope['ciphertext']), true, 32, JSON_THROW_ON_ERROR);
        verify_db('draft ' . ($index + 1) . ' encryption roundtrip', ($payload['customerName'] ?? '') === $marker);
    }
    $statement = $pdo->prepare('SELECT id,total_amount,paid_amount FROM repair_invoices WHERE shop_id=:shop');
    $statement->execute(['shop' => $shopId]);
    $invoices = $statement->fetchAll();
    verify_db('invoice retry persists one exact-rial invoice', count($invoices) === 1 && (int)$invoices[0]['total_amount'] === 10000 && (int)$invoices[0]['paid_amount'] === 10000);
    $statement = $pdo->prepare('SELECT COUNT(*) AS n,SUM(amount) AS total FROM repair_payments WHERE invoice_id=:invoice');
    $statement->execute(['invoice' => $invoices[0]['id']]);
    $payments = $statement->fetch();
    verify_db('payment retry persists one exact payment', (int)$payments['n'] === 1 && (int)$payments['total'] === 10000);
    $statement = $pdo->prepare('SELECT event_type,COUNT(*) AS n FROM repair_financial_ledger WHERE invoice_id=:invoice GROUP BY event_type');
    $statement->execute(['invoice' => $invoices[0]['id']]);
    $ledger = array_column($statement->fetchAll(), 'n', 'event_type');
    verify_db('invoice and payment ledger events written once', (int)($ledger['invoice_issued'] ?? 0) === 1 && (int)($ledger['payment_received'] ?? 0) === 1);
    $statement = $pdo->prepare("SELECT COUNT(*) FROM tamiran_audit_log WHERE shop_id=:shop AND action_code='case.update'");
    $statement->execute(['shop' => $shopId]);
    verify_db('versioned case report has one audit', (int)$statement->fetchColumn() === 1);
    $statement = $pdo->prepare('SELECT COUNT(*) FROM repair_case_receipt_terms t INNER JOIN repair_cases c ON c.id=t.case_id WHERE c.shop_id=:shop');
    $statement->execute(['shop' => $shopId]);
    verify_db('both cases preserve accepted receipt evidence', (int)$statement->fetchColumn() === 2);
    $statement = $pdo->prepare('SELECT token_hash FROM repair_portal_tokens WHERE shop_id=:shop');
    $statement->execute(['shop' => $shopId]);
    $tokens = $statement->fetchAll();
    verify_db('both portal tokens stored only as hashes', count($tokens) === 2 && count(array_filter($tokens, static fn(array $token): bool => preg_match('/^[a-f0-9]{64}$/D', $token['token_hash']) === 1)) === 2);
    $statement = $pdo->prepare('SELECT physical_quantity,reserved_quantity FROM repair_inventory_items WHERE shop_id=:shop');
    $statement->execute(['shop' => $shopId]);
    $stock = $statement->fetchAll();
    verify_db('initial stock retains five available units', count($stock) === 1 && (int)$stock[0]['physical_quantity'] === 5 && (int)$stock[0]['reserved_quantity'] === 0);
    $pdo->rollBack();
    echo json_encode(['suite' => 'MariaDB read-only smoke evidence', 'fixture_marker' => $marker, 'passed' => count($results), 'failed' => 0, 'results' => $results], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['suite' => 'MariaDB read-only smoke evidence', 'fixture_marker' => $marker, 'error' => $error->getMessage(), 'results' => $results], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    exit(1);
}
