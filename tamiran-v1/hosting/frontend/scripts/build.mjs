import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const localVite = path.join(root, 'node_modules/vite/bin/vite.js');
if (!existsSync(localVite)) {
  throw new Error('Install frontend dependencies first: npm ci --ignore-scripts');
}
const result = spawnSync(process.execPath, [localVite, 'build'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const output = path.resolve(root, '../public_html');
mkdirSync(output, { recursive: true });
rmSync(path.join(output, 'assets'), { recursive: true, force: true });
cpSync(path.join(root, '.build/assets'), path.join(output, 'assets'), { recursive: true });
cpSync(path.join(root, '.build/favicon.svg'), path.join(output, 'favicon.svg'));
const document = readFileSync(path.join(root, '.build/index.html'), 'utf8');
const guard = `<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (!is_file(dirname(__DIR__) . '/private/config.php')) {
    header('Location: /install/', true, 302);
    exit;
}
try {
    require_once __DIR__ . '/api/bootstrap.php';
    tamiran_require_https();
} catch (Throwable $error) {
    http_response_code(426);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'برای استفاده از تعمیران، نشانی سایت را با اتصال امن HTTPS باز کنید.';
    exit;
}
header('Content-Type: text/html; charset=utf-8');
?>
`;
writeFileSync(path.join(output, 'index.php'), guard + document);
console.log('Built PHP-hosted frontend; existing API, installer and private files were preserved.');
