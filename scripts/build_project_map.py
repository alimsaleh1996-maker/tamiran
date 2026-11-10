#!/usr/bin/env python3
"""Build a standalone, scoped viewer from the complete Graphify graph.

Uses only Python's standard library. Does not delete graph relationships, call
models, access the network or publish the application.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess


EDITIONS = {
    'hosting': ('نسخهٔ PHP', '#288577'),
    'worker': ('مهاجرت Worker', '#5273ae'),
    'tools': ('ابزارهای توسعه', '#a57432'),
    'docs': ('راهنما و سابقه', '#956794'),
    'reference': ('مرجع منجمد', '#7a838f'),
    'demo': ('دموی قدیمی', '#8a7870'),
    'external': ('ارجاع‌های بیرونی', '#7a838f'),
}
MODULES = {
    'hosting.ui': 'رابط قابل ویرایش', 'hosting.api': 'API و کنترل دسترسی',
    'hosting.services': 'سرویس‌ها و گردش تعمیر', 'hosting.database': 'ساختار SQL',
    'hosting.install': 'نصب و راه‌اندازی', 'hosting.assets': 'فایل‌های آمادهٔ مرورگر',
    'hosting.tests': 'تست‌ها و بسته‌بندی', 'hosting.docs': 'راهنمای نسخهٔ PHP',
    'worker.ui': 'رابط Worker', 'worker.server': 'سرور Worker',
    'worker.database': 'دیتابیس و migration', 'worker.tests': 'تست‌های Worker',
    'worker.build': 'ساخت و تنظیمات Worker', 'tools.workflow': 'جریان کار و نقش‌ها',
    'tools.map': 'ساخت نقشه', 'tools.tests': 'آزمون ابزارها',
    'docs.current': 'راهنماهای جاری', 'docs.reports': 'گزارش‌ها و تصاویر بررسی',
    'docs.history': 'سابقهٔ مهاجرت', 'reference.frozen': 'مرجع PHP برای مقایسه',
    'demo.static': 'دموی ثابت قدیمی', 'external.symbols': 'ارجاع بدون فایل محلی',
}


def module_for(path):
    """Classify by source path, keeping the three runtime editions separate."""
    if path.startswith('migration/worker/baseline/'):
        return 'reference.frozen'
    if path.startswith('hosting/'):
        if path.endswith('.sql'):
            return 'hosting.database'
        if path.startswith(('hosting/public_html/install/', 'hosting/private/install')):
            return 'hosting.install'
        if path.startswith('hosting/frontend/'):
            return 'hosting.ui'
        if path.startswith('hosting/public_html/api/'):
            return 'hosting.api'
        if path.startswith('hosting/private/'):
            return 'hosting.services'
        if path.startswith('hosting/public_html/'):
            return 'hosting.assets'
        if path.startswith(('hosting/tests/', 'hosting/scripts/', 'hosting/dev/')):
            return 'hosting.tests'
        return 'hosting.docs'
    if path.startswith('migration/worker/'):
        if path.endswith('.sql') or '/drizzle/' in path:
            return 'worker.database'
        if '/tests/' in path:
            return 'worker.tests'
        if '/src/lib/' in path or '/src/app/api/' in path or '/src/server/' in path:
            return 'worker.server'
        if '/src/' in path:
            return 'worker.ui'
        return 'worker.build'
    if path.startswith(('docs/reports/', 'hosting/reviews/', 'migration/reviews/')):
        return 'docs.reports'
    if path.startswith(('docs/history/', 'migration/runs/')):
        return 'docs.history'
    if path.startswith(('docs/', 'migration/')) or path.endswith('.md'):
        return 'docs.current'
    if path.startswith('dist/'):
        return 'demo.static'
    if path.startswith('tests/'):
        return 'tools.tests'
    if path.startswith('scripts/') and ('map' in path or 'graph' in path):
        return 'tools.map'
    if path.startswith(('scripts/', 'workflows/', '.codex/', '.openai/')):
        return 'tools.workflow'
    if path.startswith('graphify-out/'):
        return 'tools.map'
    return 'external.symbols'


def inventory(root):
    result = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
                            cwd=root, check=True, capture_output=True)
    return sorted({p for p in result.stdout.decode().split('\0') if p and (root / p).is_file()
                   and not p.startswith(('graphify-out/', '.ruflo/', '.claude-flow/'))})


def build(root):
    out = root / 'graphify-out'
    raw = (out / 'graph.json').read_bytes()
    graph = json.loads(raw)
    nodes = []
    seen = set()
    for item in graph['nodes']:
        identifier = item['id']
        if identifier in seen:
            raise ValueError('Duplicate graph node: ' + identifier)
        seen.add(identifier)
        nodes.append({'id': identifier, 'label': item.get('label', identifier),
                      'file': item.get('source_file', ''), 'location': item.get('source_location', ''),
                      'module': module_for(item.get('source_file', ''))})
    edges = []
    for item in graph['links']:
        if item['source'] not in seen or item['target'] not in seen:
            raise ValueError('Graph relationship has an unknown endpoint')
        edges.append({'source': item['source'], 'target': item['target'],
                      'relation': item.get('relation', 'related'),
                      'confidence': item.get('confidence', 'AMBIGUOUS'),
                      'file': item.get('source_file', ''), 'location': item.get('source_location', '')})
    files = inventory(root)
    payload = {'nodes': nodes, 'edges': edges, 'files': files,
               'modules': {key: {'label': value, 'edition': key.split('.')[0]} for key, value in MODULES.items()},
               'editions': {key: {'label': label, 'color': color} for key, (label, color) in EDITIONS.items()},
               'fileModules': {name: module_for(name) for name in files},
               'graphSha256': hashlib.sha256(raw).hexdigest(), 'sourceCommit': graph.get('built_at_commit', '')}
    templates = root / 'scripts/project_map'
    data = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    html = (templates / 'viewer.html').read_text()
    html = html.replace('/*__VIEWER__*/', (templates / 'viewer.js').read_text())
    html = html.replace('/*__DATA__*/null', data)
    (out / 'graph.html').write_text(html)
    report = {'graph_sha256': payload['graphSha256'], 'source_commit': payload['sourceCommit'],
              'nodes_embedded': len(nodes), 'typed_relationships_embedded': len(edges),
              'default_scope': 'hosting', 'default_level': 'modules', 'max_rendered_items': 24,
              'editions': dict(Counter(n['module'].split('.')[0] for n in nodes)),
              'offline': True, 'external_dependencies': [], 'complete_graph': 'graph-full.html'}
    (out / 'VIEWER_BUILD.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    print(json.dumps(build(args.root.resolve()), ensure_ascii=False))


if __name__ == '__main__':
    main()
