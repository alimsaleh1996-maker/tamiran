#!/usr/bin/env python3
"""Exercise automatic browser error reporting against loopback PHP."""
import datetime as dt, json, secrets
from pathlib import Path
from playwright.sync_api import sync_playwright

marker = 'TEST-PRIVATE-' + secrets.token_hex(8)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page()
    page.goto('http://127.0.0.1:9173/', wait_until='domcontentloaded')
    page.locator('.captcha-control img').wait_for(timeout=15000)
    path = Path(__file__).resolve().parents[1] / 'private' / 'logs' / ('tamiran-' + dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d') + '.log')
    previous = path.stat().st_size if path.exists() else 0
    with page.expect_response(lambda r: '/api/client-error.php' in r.url and r.request.method == 'POST') as pending:
        page.evaluate("secret => window.dispatchEvent(new ErrorEvent('error', {message: secret}))", marker)
    response = pending.value
    assert response.status == 200
    with path.open('rb') as log:
        log.seek(previous)
        rows = [json.loads(line) for line in log if line.strip()]
    assert any(r['event'] == 'client_runtime_error' and r['context']['kind'] == 'runtime' for r in rows)
    assert marker not in json.dumps(rows)
    print('PASS browser runtime error recorded without exception text')
    page.close()
    browser.close()
