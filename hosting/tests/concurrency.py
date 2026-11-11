#!/usr/bin/env python3
"""Concurrent loopback-only synthetic reception retries with a real PHP server.

Use a multi-worker PHP server. Shared PHP session locking may serialize requests;
the test measures the actual deployment behavior, not a forced database race.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import os
import secrets
import threading
import time
from urllib.parse import urlsplit
from smoke import Client, expect


def main(args):
    parsed = urlsplit(args.url)
    expect(parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost', '::1'), 'loopback HTTP required')
    marker = 'TEST-TAMIRAN-CONC-' + secrets.token_hex(4).upper()
    prefix = '0997' + str(secrets.randbelow(100000)).zfill(5)
    admin = Client(args.url)
    admin.login(args.admin_mobile, os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    shop = admin.api('admin.php', 'POST', {'name': marker, 'repairType': 'digital', 'managerName': marker,
        'managerMobile': prefix+'01', 'branchName': marker, 'expiresAt': (dt.date.today()+dt.timedelta(days=365)).isoformat(),
        'productProfile': 'pro', 'inventoryMode': 'off', 'qcMode': 'off', 'modules': ['repair'], 'maxUsers': 5,
        'idempotencyKey': marker+'-SHOP'})
    manager = Client(args.url)
    manager.login(prefix+'01', shop['temporaryPassword'])
    pw = 'TEST-CONC!' + secrets.token_hex(12)
    manager.api('auth.php', 'POST', {'action': 'change_initial_password', 'newPassword': pw, 'confirmation': pw})
    manager.token()
    model_data = manager.api('catalog.php', 'POST', {'type': 'موبایل', 'brand': marker, 'model': marker})
    model = next(row['id'] for row in model_data['items'] if row['model'] == marker)
    manager.api('settings.php', 'PATCH', {'receiptTerms': {'title': marker, 'body': marker+' synthetic terms'}})
    terms = manager.api('settings.php')['activeReceiptTerms']
    payload = {'action': 'create_case', 'customerName': marker, 'customerMobile': prefix+'02',
        'deviceModelId': model, 'identifier': marker+'-DEVICE', 'declaredIssue': marker,
        'customerConsent': {'dataHandling': 'no_erasure'}, 'assignmentMode': 'queue', 'idempotencyKey': marker+'-CASE',
        'receiptAcceptance': {'accepted': True, 'publicId': terms['public_id'], 'contentSha256': terms['content_sha256']}}
    barrier = threading.Barrier(args.requests)
    def submit(_):
        client = Client(args.url)
        for cookie in manager.cookies: client.cookies.set_cookie(cookie)
        client.csrf = manager.csrf
        barrier.wait(timeout=10)
        start = time.monotonic()
        row = client.api('operations.php', 'POST', payload)['repairCase']
        return {'id': row['id'], 'receipt': row['receiptSequence'], 'seconds': round(time.monotonic()-start, 3)}
    start = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.requests) as pool:
        results = list(pool.map(submit, range(args.requests)))
    expect(len({r['id'] for r in results}) == 1 and len({r['receipt'] for r in results}) == 1, 'duplicate case or receipt')
    page = manager.api('operations.php')
    expect(page['casesPage']['total'] == 1 and page['summary']['activeCases'] == 1, 'persisted case count is not one')
    result = {'requests': len(results), 'unique_case_ids': len({r['id'] for r in results}),
              'persisted_cases': page['casesPage']['total'], 'max_seconds': max(r['seconds'] for r in results),
              'total_seconds': round(time.monotonic()-start, 3),
              'limits': ['Shared session may serialize requests; this is not a forced SQL race.', 'Local synthetic PHP/MariaDB only']}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.report:
        with open(args.report, 'w') as report: json.dump(result, report, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:9176')
    parser.add_argument('--admin-mobile', default='09120000000')
    parser.add_argument('--requests', type=int, choices=range(2, 17), default=8)
    parser.add_argument('--report')
    main(parser.parse_args())
