#!/usr/bin/env python3
"""Offline browser verification of the generated project map; needs Playwright."""
from pathlib import Path
import argparse
import json
from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    root = args.root.resolve()
    graph = json.loads((root/'graphify-out/graph.json').read_text())
    checks, errors, remote = [], [], []

    def check(name, condition):
        if not condition: raise AssertionError(name)
        checks.append(name)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1440,'height':1050}, offline=True)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda req: remote.append(req.url) if req.url.startswith(('http://','https://')) else None)
        page.goto((root/'graphify-out/graph.html').as_uri(), wait_until='load')
        check('Default scope is the active PHP edition', page.evaluate('projectMapState.edition') == 'hosting')
        check('Default overview contains eight modules instead of thousands of nodes', page.locator('.module-node').count() == 8)
        check('All source graph nodes embedded', page.evaluate('DATA.nodes.length') == len(graph['nodes']))
        check('All typed source graph relationships embedded', page.evaluate('DATA.edges.length') == len(graph['links']))
        check('RTL diagram labels remain inside their cards', page.locator('.module-node').evaluate_all('groups=>groups.every(g=>{const r=g.querySelector("rect").getBBox();return [...g.querySelectorAll("text")].every(t=>{const b=t.getBBox();return b.x>=r.x+8 && b.x+b.width<=r.x+r.width-8;});})'))
        page.screenshot(path=str(args.output/'overview-desktop.png'), full_page=True)
        page.locator('[data-module="hosting.api"]').focus()
        page.keyboard.press('Enter')
        check('Module opens with keyboard', page.evaluate('projectMapState.module') == 'hosting.api')
        check('File listing is bounded to 24 items', 0 < page.locator('.file-card').count() <= 24)
        page.locator('.file-card').filter(has_text='bootstrap.php').click()
        check('File drill-down opens bootstrap', page.evaluate('projectMapState.file').endswith('/bootstrap.php'))
        check('Symbol listing is bounded to 24 items', page.locator('.file-card').count() <= 24)
        page.locator('#search').fill('tamiran_require_actor')
        expect(page.locator('#results button').first).to_be_visible()
        check('Search distinguishes editions with paths', 'hosting/' in page.locator('#results').inner_text() and 'migration/worker/baseline/' in page.locator('#results').inner_text())
        page.locator('#results button').filter(has_text='hosting/public_html/api/bootstrap.php').first.click()
        check('Search opens actual selected node', page.evaluate('projectMapState.node') is not None)
        check('Selected node exposes actual typed relationships', page.locator('#detail table tr').count() > 1)
        page.locator('#confidence').select_option('EXTRACTED')
        check('Confidence filter hides inferred rows', 'INFERRED' not in page.locator('#detail').inner_text())
        page.locator('#home').click()
        page.locator('#search').fill('package-lock.json')
        expect(page.locator('#results button').first).to_be_visible()
        check('Search also finds inventory files without modeled symbols', 'package-lock.json' in page.locator('#results').inner_text())
        page.keyboard.press('Escape')
        check('Escape closes search results', 'hidden' in page.locator('#results').get_attribute('class'))
        page.locator('[data-edition="reference"]').click()
        check('Frozen reference has a separate scoped view', page.evaluate('projectMapState.edition') == 'reference' and page.locator('.module-node').count() == 1)
        page.locator('[data-edition="docs"]').click()
        page.locator('[data-module="docs.reports"]').click()
        check('Evidence paths point to the organized documentation', page.locator('.file-card .path').count() > 0 and all(x.startswith('docs/reports/') for x in page.locator('.file-card .path').all_text_contents()))
        page.locator('#home').click()
        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(250)
        check('Mobile view has no horizontal page overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        check('Mobile overview uses a readable single column', page.locator('svg.diagram').get_attribute('viewBox').split()[2] == '340')
        page.screenshot(path=str(args.output/'overview-mobile.png'), full_page=True)
        check('No JavaScript runtime errors', not errors)
        check('Standalone viewer makes no network requests', not remote)
        browser.close()
    report = {'passed':len(checks), 'failed':0, 'checks':checks, 'page_errors':errors,
              'network_requests':remote, 'scope':'Generated graph viewer only; no application/database/model execution'}
    (args.output/'browser-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__': main()
