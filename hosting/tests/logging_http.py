#!/usr/bin/env python3
"""Loopback-only checks of real request and browser diagnostic log records."""
import datetime as dt, json, secrets, urllib.parse
from pathlib import Path
from smoke import Client, expect

base = 'http://127.0.0.1:9173'
assert urllib.parse.urlsplit(base).hostname == '127.0.0.1'
client = Client(base)
marker = 'TESTLOG' + secrets.token_hex(8)
client.api('operations.php', expected=401, headers={'X-Request-ID': marker+'DENIED'})
client.api('health.php', headers={'X-Request-ID': marker+'OK'})
client.token()
reference = 'UI-' + secrets.token_hex(8).upper()
body = {'reference': reference, 'kind': 'network_failure', 'endpoint': '/api/operations.php',
        'message': 'TEST-LOG-SECRET', 'stack': 'TEST-LOG-SECRET', 'page': '/private/TEST-LOG-SECRET'}
result = client.api('client-error.php', 'POST', body, headers={'X-Request-ID': marker+'CLIENT'})
expect(result['logged'] is True and result['reference'] == reference, 'client diagnostic not recorded')
client.api('client-error.php', 'POST', body, expected=403, headers={'Origin':'https://example.invalid', 'X-Request-ID':marker+'ORIGIN'})
malformed = client.api('client-error.php', 'POST', {'reference': [], 'kind': [], 'endpoint': '/api/' + 'a'*500 + '.php'}, headers={'X-Request-ID':marker+'BOUNDED'})
expect(malformed['logged'] is True and malformed['reference'].startswith('UI-'), 'malformed diagnostic not safely normalized')
path = Path(__file__).resolve().parents[1] / 'private' / 'logs' / ('tamiran-' + dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d') + '.log')
rows = [json.loads(line) for line in path.read_text().splitlines() if marker in line or reference in line]
expect(any(r['event']=='api_response' and r['request_id']==marker+'DENIED' and r['context']['status']==401 for r in rows), '401 request not logged')
expect(any(r['event']=='api_response' and r['request_id']==marker+'OK' and r['context']['status']==200 for r in rows), '200 request not logged')
expect(any(r['event']=='client_runtime_error' and r['context'].get('client_reference')==reference and r['context'].get('endpoint')=='/api/operations.php' for r in rows), 'client diagnostic missing')
expect(any(r['event']=='client_runtime_error' and r['request_id']==marker+'BOUNDED' and r['context']['endpoint'] is None for r in rows), 'oversized endpoint was logged')
expect('TEST-LOG-SECRET' not in json.dumps(rows), 'free-form browser text leaked into logs')
print('PASS real HTTP success, denial, client report and private-data exclusion')
