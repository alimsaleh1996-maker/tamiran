#!/usr/bin/env python3
"""Fresh synthetic PHP/MariaDB/browser checks for dashboard, RTL queues and reception.

Run after installing into an isolated loopback database. Credentials are supplied
through TAMIRAN_SMOKE_ADMIN_PASSWORD, never written into the evidence report.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import secrets
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect as pw_expect
from smoke import Client, expect


def run(args):
    host = urlsplit(args.url)
    expect(host.scheme == 'http' and host.hostname in ('localhost', '127.0.0.1', '::1'), 'literal loopback HTTP required')
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    results, errors = [], []

    def save():
        (out / 'results.json').write_text(json.dumps({'passed': sum(r['status'] == 'PASS' for r in results), 'failed': sum(r['status'] == 'FAIL' for r in results), 'results': results, 'page_errors': errors, 'limits': ['Synthetic local PHP/MariaDB only; no hosted deployment or screen reader certification', 'One browser contract check overrides the authorized server summary with 503 to reproduce a paginated response; it does not verify SQL aggregation']}, ensure_ascii=False, indent=2) + '\n')

    def check(name, job):
        try:
            job()
        except Exception as error:
            results.append({'name': name, 'status': 'FAIL', 'error': str(error)})
            save()
            raise
        results.append({'name': name, 'status': 'PASS'})
        save()
        print('PASS ' + name, flush=True)

    marker = 'TEST-TAMIRAN-REVIEW-' + secrets.token_hex(4).upper()
    prefix = '0999' + str(secrets.randbelow(90000) + 10000)
    admin = Client(args.url)
    admin.login(args.admin_mobile, os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    shop = admin.api('admin.php', 'POST', {
        'name': 'آزمایشی — بررسی گردش تعمیر', 'repairType': 'digital', 'managerName': 'آزمایشی — مدیر',
        'managerMobile': prefix + '01', 'branchName': 'شعبه آزمایشی',
        'expiresAt': (dt.date.today() + dt.timedelta(days=365)).isoformat(), 'productProfile': 'pro',
        'modules': ['repair', 'finance'], 'inventoryMode': 'off', 'qcMode': 'off', 'maxUsers': 8, 'idempotencyKey': marker,
    })
    manager = Client(args.url)
    actor = manager.login(prefix + '01', shop['temporaryPassword'])
    password = 'TEST-Review!' + secrets.token_hex(16)
    manager.api('auth.php', 'POST', {'action': 'change_initial_password', 'newPassword': password, 'confirmation': password})
    manager.token()
    for index in (11, 12):
        admin.api('admin-users.php', 'POST', {'shopId': actor['shop']['id'], 'branchIds': [actor['branch']['id']], 'displayName': 'آزمایشی — تکنسین ' + str(index), 'mobile': prefix + str(index), 'password': password, 'role': 'technician'})
    model_title = 'مدل آزمایشی بررسی صف'
    catalog = manager.api('catalog.php', 'POST', {'type': 'موبایل', 'brand': 'برند آزمایشی', 'model': model_title})
    model = next(row['id'] for row in catalog['items'] if row['model'] == model_title)
    manager.api('settings.php', 'PATCH', {'receiptTerms': {'title': 'شرایط آزمایشی', 'body': 'شرایط پذیرش مصنوعی برای بررسی محلی.'}})
    terms = manager.api('settings.php')['activeReceiptTerms']
    cases = []
    for index, name in enumerate(('کیان', 'مینا', 'رضا'), 21):
        cases.append(manager.api('operations.php', 'POST', {
            'action': 'create_case', 'customerName': 'آزمایشی — ' + name, 'customerMobile': prefix + str(index),
            'deviceModelId': model, 'identifier': marker + '-' + str(index), 'declaredIssue': 'ایراد آزمایشی روشن نشدن دستگاه',
            'customerConsent': {'dataHandling': 'no_erasure'}, 'assignmentMode': 'queue', 'idempotencyKey': marker + '-CASE-' + str(index),
            'receiptAcceptance': {'accepted': True, 'publicId': terms['public_id'], 'contentSha256': terms['content_sha256']},
        })['repairCase'])
    technician = next(row for row in manager.api('operations.php')['users'] if row['role'] == 'technician')
    manager.api('workflow-v2.php', 'POST', {'action': 'assign', 'caseId': cases[1]['id'], 'technicianUserId': technician['id'], 'reason': marker})
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, timezone_id='Asia/Tehran')
        context.add_cookies([{'name': cookie.name, 'value': cookie.value, 'domain': host.hostname, 'path': cookie.path, 'httpOnly': True, 'secure': False, 'sameSite': 'Strict'} for cookie in manager.cookies])
        page = context.new_page()
        page.set_default_timeout(10000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url, wait_until='networkidle')
        page.locator('.repair-queue-table tbody tr').first.wait_for()
        check('authoritative dashboard total is three', lambda: pw_expect(page.locator('.stat-card strong').first).to_have_text('۳'))
        check('welcome uses authoritative total', lambda: expect('۳ پرونده فعال' in page.locator('.welcome-copy p').inner_text(), 'wrong total'))
        def paginated_summary(route):
            response = route.fetch()
            payload = response.json()
            payload['data']['summary']['activeCases'] = 503
            route.fulfill(response=response, json=payload)
        page.route('**/api/operations.php*', paginated_summary)
        page.reload(wait_until='networkidle')
        check('paginated summary contract shows 503 while the loaded page has three cases', lambda: expect('۵۰۳ پرونده فعال' in page.locator('.welcome-copy p').inner_text() and page.locator('.repair-queue-table tbody tr').count() == 3, 'welcome used loaded list length'))
        page.unroute('**/api/operations.php*', paginated_summary)
        page.reload(wait_until='networkidle')
        page.locator('.repair-queue-table tbody tr').first.wait_for()
        check('secondary detail starts collapsed', lambda: expect(not page.locator('.dashboard-secondary').evaluate('x=>x.open'), 'details open'))
        check('queue appears before optional detailed charts', lambda: expect(page.locator('.queue-panel').evaluate("x=>Boolean(x.compareDocumentPosition(document.querySelector('.dashboard-secondary')) & Node.DOCUMENT_POSITION_FOLLOWING)"), 'queue order'))
        page.screenshot(path=str(out / '01-dashboard-desktop.png'), full_page=True, animations='disabled')
        search = page.get_by_role('searchbox', name='جست‌وجوی پرونده')
        search.fill('كيان')
        check('dashboard Arabic name search finds Persian customer', lambda: pw_expect(page.locator('.repair-queue-table tbody tr')).to_have_count(1))
        search.fill(''.join('۰۱۲۳۴۵۶۷۸۹'[int(c)] for c in prefix + '21'))
        check('dashboard Persian mobile search finds ASCII record', lambda: pw_expect(page.locator('.repair-queue-table tbody tr')).to_have_count(1))
        page.get_by_label('وضعیت پرونده', exact=True).select_option('assigned')
        check('status and query intersect with useful empty state', lambda: pw_expect(page.get_by_text('پرونده‌ای با این فیلترها پیدا نشد', exact=True)).to_be_visible())
        page.get_by_role('button', name='پاک‌کردن فیلترها', exact=True).click()
        check('clearing dashboard filters restores every row', lambda: pw_expect(page.locator('.repair-queue-table tbody tr')).to_have_count(3))
        page.locator('.dashboard-secondary summary').focus()
        page.keyboard.press('Enter')
        check('keyboard expands preserved flow and team information', lambda: expect(page.locator('.dashboard-secondary').evaluate('x=>x.open') and page.locator('.stage-list').is_visible() and page.locator('.technician-list').is_visible(), 'details unavailable'))
        page.keyboard.press('Enter')
        date_value = page.locator('.repair-queue-table time').first
        sql_time = manager.api('operations.php')['cases'][0]['updatedAt']
        expected_time = page.evaluate("raw=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'short',timeStyle:'short'}).format(new Date(raw.replace(' ','T')+'Z'))", sql_time)
        check('SQL UTC time displays correctly in a Tehran browser', lambda: pw_expect(date_value).to_have_text(expected_time))
        for width, height in ((375, 812), (768, 1024), (812, 375)):
            page.set_viewport_size({'width': width, 'height': height})
            check(f'dashboard and table fit {width}x{height}', lambda: expect(not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'horizontal page overflow'))
            check(f'queue needs no inner horizontal scrolling {width}', lambda: expect(page.locator('.queue-table-wrap').evaluate('x=>x.scrollWidth<=x.clientWidth+1'), 'queue horizontal scrolling'))
        page.set_viewport_size({'width': 375, 'height': 812})
        check('mobile keeps table headings and rows in the accessibility tree', lambda: expect(page.get_by_role('table').get_by_role('columnheader').count() == 6 and page.get_by_role('table').get_by_role('row').count() == 4, 'table semantics missing'))
        check('mobile row action remains in its labeled cell', lambda: expect(page.locator('.repair-queue-table td:last-child').first.evaluate("x=>getComputedStyle(x).position==='static'"), 'action overlaps receipt'))
        page.locator('.queue-panel').screenshot(path=str(out / '02-queue-mobile.png'), animations='disabled')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.get_by_role('button', name='مرکز عملیات تعمیرات', exact=True).click()
        all_cases = page.get_by_role('button', name='همه پرونده‌ها', exact=False).filter(has=page.locator('strong'))
        all_cases.click()
        check('workflow filter exposes its pressed state', lambda: pw_expect(all_cases).to_have_attribute('aria-pressed', 'true'))
        workflow_search = page.get_by_role('searchbox', name='جست‌وجوی صف تعمیر')
        workflow_search.fill('كيان')
        check('workflow uses the same normalized name matching', lambda: pw_expect(page.locator('.v2-case-list > button')).to_have_count(1))
        page.get_by_label('وضعیت صف تعمیر', exact=True).select_option('assigned')
        check('workflow hides detail when combined filters match nothing', lambda: expect(page.locator('.v2-case-list > button').count() == 0 and page.locator('.v2-detail-title').count() == 0, 'hidden case remains actionable'))
        page.get_by_role('button', name='پاک‌کردن فیلترها', exact=True).click()
        check('clearing workflow filters restores queue', lambda: pw_expect(page.locator('.v2-case-list > button')).to_have_count(3))
        check('selected case exposes pressed state', lambda: expect(page.locator('.v2-case-list > button[aria-pressed=true]').count() == 1, 'case selection semantics'))
        page.set_viewport_size({'width': 375, 'height': 812})
        check('workflow filters fit RTL mobile', lambda: expect(not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'workflow overflow'))
        page.screenshot(path=str(out / '03-workflow-mobile.png'), full_page=True, animations='disabled')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.get_by_role('button', name='پذیرش تعمیرات', exact=True).click()
        page.get_by_role('button', name='ثبت مرحله و ادامه', exact=True).click()
        check('invalid reception focuses its error and stays on customer step', lambda: expect(page.locator('.reception-error-summary').evaluate('x=>x===document.activeElement') and page.get_by_role('group', name='فرم مرحله 1 از ۳').count() == 1, 'validation focus lost'))
        page.get_by_placeholder('09xxxxxxxxx', exact=True).fill(prefix + '31')
        page.get_by_placeholder('نام کامل مشتری', exact=True).fill('آزمایشی — مشتری کیبورد')
        page.get_by_role('button', name='ثبت مرحله و ادامه', exact=True).click()
        check('next reception step receives keyboard focus', lambda: pw_expect(page.get_by_role('group', name='فرم مرحله 2 از ۳')).to_be_focused())
        page.keyboard.press('Tab')
        check('Tab from step start reaches product input', lambda: expect(page.locator('input[role=combobox]').evaluate('x=>x===document.activeElement'), 'next input not reached'))
        product = page.locator('input[role=combobox]')
        product.fill(model_title)
        product.press('ArrowDown')
        product.press('Enter')
        accessories = page.locator('.choice-chips button')
        check('selected accessory is announced as pressed', lambda: pw_expect(accessories.filter(has_text='بدون لوازم')).to_have_attribute('aria-pressed', 'true'))
        colors = page.locator('.reception-step-card select').first
        if colors.count():
            option = colors.locator('option').evaluate_all('xs=>xs.find(x=>x.value && !x.disabled)?.value')
            if option:
                colors.select_option(option)
        page.get_by_placeholder('شناسه دقیق ۱۵ رقمی', exact=True).fill('490154203237518')
        page.get_by_role('button', name='ثبت مرحله و ادامه', exact=True).click()
        check('third reception step receives focus', lambda: pw_expect(page.get_by_role('group', name='فرم مرحله 3 از ۳')).to_be_focused())
        consent = page.locator('.data-handling-choice button')
        consent.first.focus()
        page.keyboard.press('Space')
        check('keyboard selection announces data-handling consent', lambda: pw_expect(consent.first).to_have_attribute('aria-pressed', 'true'))
        consent.nth(1).click()
        check('changing consent exposes exactly one selected option', lambda: expect(consent.evaluate_all("xs=>xs.map(x=>x.getAttribute('aria-pressed'))") == ['false', 'true', 'false'], 'consent state incorrect'))
        appearance = page.locator('.appearance-choice-chips button').first
        appearance.click()
        check('appearance choice exposes and toggles its selected state', lambda: pw_expect(appearance).to_have_attribute('aria-pressed', 'true'))
        appearance.click()
        check('appearance choice announces deselection', lambda: pw_expect(appearance).to_have_attribute('aria-pressed', 'false'))
        page.set_viewport_size({'width': 375, 'height': 812})
        check('final reception step fits mobile', lambda: expect(not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'reception overflow'))
        check('appearance choices provide 44px touch targets', lambda: expect(page.locator('.appearance-choice-chips button').evaluate_all('xs=>xs.every(x=>x.getBoundingClientRect().height>=44)'), 'small touch targets'))
        page.evaluate('document.activeElement.blur(); window.scrollTo(0, 0)')
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        page.screenshot(path=str(out / '04-reception-final-mobile.png'), full_page=True, animations='disabled')
        page.get_by_role('button', name='مرحله قبل', exact=True).click()
        check('previous reception step receives focus and retains product', lambda: expect(page.get_by_role('group', name='فرم مرحله 2 از ۳').evaluate('x=>x===document.activeElement') and model_title in product.input_value(), 'back navigation lost focus or data'))
        check('browser has no JavaScript errors', lambda: expect(not errors, str(errors)))
        browser.close()
    save()
    print(f'SUMMARY {len(results)} workflow browser checks passed', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:9173')
    parser.add_argument('--admin-mobile', default='09120000000')
    parser.add_argument('--output', default='/workspace/scratch/tamiran-review/after')
    run(parser.parse_args())
