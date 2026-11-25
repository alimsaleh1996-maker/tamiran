#!/usr/bin/env python3
"""Prove a real 500 response and its private log omit exception text."""
import json, os, shutil, subprocess, tempfile
from pathlib import Path

with tempfile.TemporaryDirectory(prefix='tamiran-log-failure-') as tmp:
    root = Path(tmp)
    (root/'public_html/api').mkdir(parents=True)
    (root/'private').mkdir()
    source = Path(__file__).resolve().parents[1] / 'public_html/api/bootstrap.php'
    shutil.copyfile(source, root/'public_html/api/bootstrap.php')
    script = root/'public_html/api/test_error.php'
    script.write_text('''<?php
$_SERVER['SCRIPT_FILENAME']=__FILE__; $_SERVER['REQUEST_METHOD']='POST';
require __DIR__.'/bootstrap.php';
tamiran_fail(new RuntimeException('TEST-SECRET-DO-NOT-LOG'));
''')
    process = subprocess.run([os.environ.get('TAMIRAN_TEST_PHP','php'),str(script)],capture_output=True,text=True,check=True)
    body = json.loads(process.stdout)
    log_path = next((root/'private/logs').glob('tamiran-*.log'))
    raw = log_path.read_text();rows=[json.loads(line) for line in raw.splitlines()]
    assert 'TEST-SECRET-DO-NOT-LOG' not in raw and 'TEST-SECRET-DO-NOT-LOG' not in process.stdout
    assert body['ok'] is False and any(r['event']=='api_request_failed' and r['context']['status']==500 for r in rows)
    assert any(r['event']=='api_response' and r['context']['status']==500 for r in rows)
    print('PASS 500 response and structured failure log omit raw exception text')
