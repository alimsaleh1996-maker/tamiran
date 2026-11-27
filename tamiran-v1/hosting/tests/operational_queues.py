#!/usr/bin/env python3
"""Authenticated MariaDB/API and Chromium regression for the four operational queues."""
import argparse
import datetime as dt
import json
import os
import re
import secrets
import subprocess
from pathlib import Path
from urllib.parse import urlencode, urlsplit

from smoke import Client
from v7_operations import open_as


def run(args):
    for url in (args.before, args.after):
        assert urlsplit(url).hostname in ('localhost', '127.0.0.1')
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    password = os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD']
    admin = Client(args.after)
    admin.login(args.admin_mobile, password)
    token = secrets.token_hex(4)
    mobile = '0997' + str(secrets.randbelow(90_000) + 10_000)
    shop_password = 'Only-Test!' + secrets.token_hex(11)

    def create_shop(suffix):
        response = admin.api('admin.php', 'POST', {
            'name': 'TEST-QUEUE-' + token + suffix, 'repairType': 'digital',
            'managerName': 'مدیر ممیزی صف', 'managerMobile': mobile + suffix,
            'expiresAt': (dt.date.today() + dt.timedelta(days=100)).isoformat(),
            'productProfile': 'pro', 'inventoryMode': 'pro', 'qcMode': 'independent',
            'modules': ['repair', 'inventory', 'finance'], 'maxUsers': 10, 'idempotencyKey': secrets.token_hex(13),
        })
        manager = Client(args.after)
        auth = manager.login(mobile + suffix, response['temporaryPassword'])
        manager.api('auth.php', 'POST', {'action': 'change_initial_password',
                                       'newPassword': shop_password, 'confirmation': shop_password})
        manager.token()
        manager.api('catalog.php', 'POST', {'type': 'موبایل', 'brand': 'صف', 'model': 'آزمون ' + token + suffix})
        model = manager.api('catalog.php')['items'][0]['id']
        base_case = manager.api('operations.php', 'POST', {
            'action': 'create_case', 'receiptMode': 'issue_only', 'customerName': 'مشتری آزمایشی صف',
            'customerMobile': mobile + ('09' if suffix == '01' else '08'), 'deviceModelId': model,
            'identifierUnavailable': True, 'identifierUnavailableReason': 'powered_off',
            'declaredIssue': 'آزمون پروندهٔ قدیمی', 'customerConsent': {'dataHandling': 'coordinate_first'},
            'idempotencyKey': secrets.token_hex(16),
        })['repairCase']
        return manager, auth, base_case

    manager, auth, base = create_shop('01')
    _, _, foreign_case = create_shop('02')
    admin.api('admin-users.php', 'POST', {'shopId': auth['shop']['id'], 'branchIds': [auth['branch']['id']],
        'displayName': 'تکنسین ممیزی', 'mobile': mobile + '03', 'password': shop_password, 'role': 'technician'})
    tech = Client(args.after)
    technician = tech.login(mobile + '03', shop_password)['id']
    for code, title in (('QB-CABLE', 'کابل جدید ممیزی'), ('QB-OLD-LCD', 'نمایشگر قدیمی ممیزی')):
        manager.api('operations.php', 'POST', {'action': 'create_inventory_item', 'code': code,
                                               'title': title, 'physicalQuantity': 5})
    parts = {item['item_code']:item['id'] for item in manager.api('inventory-v2.php?catalog=1')['items']}
    fixture = Path(__file__).with_name('operational_queue_fixture.php')
    seeded = json.loads(subprocess.check_output(
        ['docker', 'exec', '-i', args.container, 'php', '--', '/app', str(base['id']), str(technician),
         str(parts['QB-CABLE']), str(parts['QB-OLD-LCD'])], input=fixture.read_bytes()))
    old = seeded['oldPart']
    old_receipt = next(r['receipt'] for r in seeded['records'] if r['id'] == old)

    before = Client(args.before)
    before.login(mobile + '01', shop_password)
    assert seeded['oldAssigned'] not in {r['id'] for r in before.api('workflow-v2.php')['cases']}
    assert set(seeded['oldRequests']).isdisjoint(r['id'] for r in before.api('inventory-v2.php')['requests'])
    old_assign_receipt=next(r['receipt'] for r in seeded['records'] if r['id'] == seeded['oldAssigned'])
    screens('before', args.before, before, old_receipt, old_assign_receipt, output)
    manager.login(mobile + '01', shop_password)


    def queue_api(**filters):
        return manager.api('workflow-v2.php?' + urlencode(filters))

    def supply_api(actor=manager, **filters):
        return actor.api('inventory-v2.php?' + urlencode({'requests': 1, **filters}))

    def all_ids(fetch, page_key, rows_key):
        items = []
        offset = 0
        while True:
            data = fetch(offset)
            page = data[page_key] if page_key else data
            rows = data[rows_key]
            assert page['offset'] == offset and len(rows) <= page['pageSize'] <= 30
            items.extend(row['id'] for row in rows)
            offset += page['pageSize']
            if offset >= page['total']:
                assert len(items) == page['total'] == len(set(items))
                return set(items)

    eligible = [r for r in seeded['records'] if r['branch'] == seeded['branch'] and
                not r['delivered'] and r['status'] not in {'closed', 'cancelled', 'delivered'}]
    eligible.append({'id':base['id'], 'status':'awaiting_assignment', 'technician':None,
                     'late':False, 'receiptPending':False})
    ready = {'ready_for_delivery','returned_unrepaired'}
    meanings = {
        'active': lambda r: True,
        'unassigned': lambda r: r['status'] in {'reception','awaiting_assignment'},
        'assigned': lambda r: r['technician'] is not None and r['status'] not in ready,
        'receipt': lambda r: r['receiptPending'],
        'receipt_late': lambda r: r['receiptPending'],
        'repairing': lambda r: r['status'] in {'assigned','diagnosing','estimate_pending','repairing','parts_closeout'},
        'late': lambda r: r['late'] and r['status'] not in ready,
        'customer': lambda r: r['status'] == 'awaiting_customer_approval',
        'parts': lambda r: r['status'] == 'awaiting_parts',
        'hot': lambda r: r['id'] == seeded['hot'],
        'quality': lambda r: r['status'] in {'qc_pending','qc_conditional'},
        'qc_rework': lambda r: r['status'] == 'qc_rework',
        'finance': lambda r: r['status'] == 'finance_pending',
        'delivery': lambda r: r['status'] in ready,
    }
    pulse = queue_api(managerPulse=1)
    assert pulse['openHotReturns'] == 2
    results = {}
    for metric, qualifies in meanings.items():
        expected = {r['id'] for r in eligible if qualifies(r)}
        actual = all_ids(lambda offset: queue_api(managerQueue=metric, offset=offset), None, 'rows')
        assert actual == expected and pulse['counts'][metric] == len(actual), metric
        results[metric] = {'count': len(actual), 'sampleCaseIds': sorted(actual)[:5]}
        print('PASS', metric, results[metric], flush=True)

    assert len(all_ids(lambda offset:supply_api(offset=offset), 'requestPage', 'requests')) == 1102
    for filters in ({'q': old_receipt}, {'q': 'نمایشگر قدیمی'}, {'q':'QB-OLD-LCD'}, {'caseId':old},
                    {'q':'نمایشگر قدیمی','technician':technician,'status':'pending'}):
        assert all_ids(lambda offset:supply_api(offset=offset, **filters), 'requestPage', 'requests') == set(seeded['oldRequests'])
    assert supply_api(q='%', status='needs_supply')['requestPage']['total'] == 0
    assert supply_api(purchaseItem=parts['QB-OLD-LCD'])['requestPage']['total'] == 2
    assert queue_api(managerQueue='active', q='%', status='repairing')['total'] == 0
    assert queue_api(managerQueue='assigned', q=old_assign_receipt, status='repairing', technician=technician)['rows'][0]['id'] == seeded['oldAssigned']

    for value in (seeded['other'], foreign_case['id']):
        manager.api(f'inventory-v2.php?requests=1&caseId={value}', expected=404)
    tech.api('inventory-v2.php?requests=1',expected=403)
    tech.api('workflow-v2.php?managerQueue=active',expected=403)
    for query in ('offset=-1', 'offset=1000001', 'q[]=x', 'status[]=pending', 'technician=0'):
        manager.api(f'inventory-v2.php?requests=1&{query}', expected=400)
        manager.api(f'workflow-v2.php?managerQueue=active&{query}', expected=400)
    other_branch = next(r['branch'] for r in seeded['records'] if r['id'] == seeded['other'])
    manager.api(f'workflow-v2.php?managerQueue=active&branchId={other_branch}', expected=403)
    manager.api(f'inventory-v2.php?requests=1&branchId={other_branch}', expected=403)
    print('PASS 1102 paged requests; old-row filters; role, branch, tenant and malformed filters',flush=True)

    screens('after', args.after, manager, old_receipt, old_assign_receipt, output, pulse['counts'])
    follow_url = 'workflow-v2.php?managerFollowups=1&filter=parts'
    assert old in {r['caseId'] for r in manager.api(follow_url)['rows']}
    manager.api('workflow-v2.php','POST',{'action':'followup_note','caseId':old,'message':'پیگیری مصنوعی',
                                         'idempotencyKey':secrets.token_hex(12)})
    assert old in {r['caseId'] for r in manager.api(follow_url)['rows']}
    warehouse = supply_api(caseId=old)['warehouse']['id']
    for index, request in enumerate(seeded['oldRequests']):
        manager.api('inventory-v2.php','POST',{'action':'reserve','requestId':request,'warehouseId':warehouse,
                                              'quantity':1,'reason':'آزمون رزرو'})
        issued=manager.api('inventory-v2.php','POST',{'action':'issue','requestId':request,'warehouseId':warehouse,
                                                     'quantity':1,'idempotencyKey':secrets.token_hex(12),'reason':'آزمون تحویل'})
        tech.api('inventory-v2.php','POST',{'action':'finalize_issue','issuePublicId':issued['issuePublicId'],
                                           'warehouseId':warehouse,'decision':'consumed','reason':'آزمون مصرف'})
        assert (old in {r['caseId'] for r in manager.api(follow_url)['rows']}) == (index == 0)
    assert queue_api(managerQueue='parts', q=old_receipt)['total'] == 0
    assert queue_api(managerQueue='unassigned', q=base['receiptNumber'])['total'] == 1
    manager.api('workflow-v2.php','POST',{'action':'assign','caseId':base['id'],'technicianUserId':technician,
                                        'reason':'تخصیص پروندهٔ قدیمی','idempotencyKey':secrets.token_hex(12)})
    assert queue_api(managerQueue='unassigned', q=base['receiptNumber'])['total'] == 0
    assert queue_api(managerQueue='assigned', q=base['receiptNumber'])['total'] == 1
    tech.api('workflow-v2.php','POST',{'action':'technical_receive','caseId':base['id'],'idempotencyKey':secrets.token_hex(12),
        'lockVersion':tech.api(f"workflow-v2.php?caseId={base['id']}")['cases'][0]['lockVersion']})
    assert queue_api(managerQueue='receipt', q=base['receiptNumber'])['total'] == 0
    print('PASS note preserves alert; reserve → issue → consume clears it; old case assignment and physical receipt',flush=True)
    (output/'queue-results.json').write_text(json.dumps({'metrics':results,'cases':len(seeded['records'])+1,
        'requests':1102,'oldReceipt':old_receipt,'oldCaseId':old,'browser': [390,768,1440]}, indent=2))


def screens(name, url, client, old_receipt, old_assign_receipt, output, metric_counts=None):
    from playwright.sync_api import sync_playwright, expect
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        for width in (390,768,1440):
            context=open_as(browser,url,client,width)
            page=context.new_page()
            page.goto(url+'/?view=parts-supply')
            search=page.get_by_role('textbox',name='جست‌وجوی صف')
            search.fill(old_receipt)
            if name=='after':
                expect(page.locator('tr').filter(has_text=old_receipt)).to_have_count(2)
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            else:
                expect(page.locator('tr').filter(has_text=old_receipt)).to_have_count(0)
            page.screenshot(path=str(output/f'{name}-supply-{width}.png'))
            page.goto(url+'/?view=assignments&assignmentTab=active')
            if name=='after':
                expect(page.get_by_role('button',name='صفحه بعد')).to_be_visible()
                page.get_by_role('button',name='صفحه بعد').click()
                expect(page.get_by_role('button',name='صفحه قبل')).to_be_visible()
                page.get_by_role('textbox',name='جست‌وجوی دستگاه‌ها').fill(old_assign_receipt)
                expect(page.locator('.service-queue-card').filter(has_text=old_assign_receipt)).to_have_count(1)
            else:
                expect(page.locator('.service-queue-card').first).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            page.screenshot(path=str(output/f'{name}-assignment-{width}.png'))
            page.goto(url+'/?view=home')
            pulse_card=page.locator('.manager-pulse-grid button').filter(has_text='پرونده‌های فعال')
            expect(pulse_card).to_be_visible()
            page.screenshot(path=str(output/f'{name}-pulse-{width}.png'))
            pulse_card.click()
            if name=='after':
                expect(page.get_by_role('navigation',name='صفحه‌بندی صف')).to_be_visible()
                page.screenshot(path=str(output/f'{name}-pulse-destination-{width}.png'))
                page.get_by_role('button',name='بازگشت به نبض تعمیرگاه').click()
                page.locator('#manager-followups').get_by_role('combobox').select_option('parts')
                follow=page.locator('#manager-followups li').filter(has_text=old_receipt)
                follow.get_by_role('button',name='بازکردن مرحلهٔ پرونده').click()
                expect(page).to_have_url(re.compile(r'[?&]supplyCase=[1-9][0-9]*'))
                expect(page.locator('tr').filter(has_text=old_receipt)).to_have_count(2)
                page.screenshot(path=str(output/f'after-followup-{width}.png'))
                page.get_by_role('button',name='بازگشت به نبض تعمیرگاه').click()
                expect(page.locator('.manager-pulse-grid')).to_be_visible()
            else:
                expect(page.locator('.service-queue-card').first).to_be_visible()
                page.screenshot(path=str(output/f'{name}-pulse-destination-{width}.png'))
            context.close()
        if name == 'before':
            browser.close()
            return
        context=open_as(browser,url,client,1440)
        page=context.new_page()
        labels={
            'active':'پرونده‌های فعال','unassigned':'در انتظار ارجاع','receipt':'ارجاع‌شده و دریافت‌نشده',
            'receipt_late':'تأخیر در دریافت دستگاه','repairing':'در حال بررسی یا تعمیر','late':'دارای تأخیر',
            'customer':'در انتظار مشتری','parts':'در انتظار قطعه','hot':'پرونده‌های دارای تعهد داغی باز',
            'quality':'کنترل کیفیت','qc_rework':'برگشتی از کنترل کیفیت','finance':'در انتظار مالی','delivery':'آماده تحویل',
        }
        for metric, label in labels.items():
            page.goto(url+'/?view=home')
            card=page.locator('.manager-pulse-grid button').filter(has=page.get_by_text(label,exact=True))
            raw_total=str(metric_counts[metric]).translate(str.maketrans('0123456789','۰۱۲۳۴۵۶۷۸۹'))
            expect(card.locator('strong')).to_have_text(raw_total)
            card.click()
            assert f'managerMetric={metric}' in page.url
            expect(page.get_by_role('navigation',name='صفحه‌بندی صف')).to_contain_text('از '+raw_total+' نتیجه')
        context.close()
        context=open_as(browser,url,client)
        page=context.new_page()
        page.route('**/api/inventory-v2.php?requests=1&*',lambda route: route.fulfill(status=503,json={'ok':False,'error':{'message':'خطای آزمایشی صف'}}))
        page.goto(url+'/?view=parts-supply')
        expect(page.get_by_role('alert').filter(has_text='خطای آزمایشی صف')).to_be_visible()
        page.unroute_all()
        page.get_by_role('button',name='تلاش دوباره').click()
        page.get_by_role('textbox',name='جست‌وجوی صف').fill('NONEXISTENT-QUEUE')
        expect(page.get_by_role('status').filter(has_text='نتیجه‌ای نیست')).to_be_visible()
        search=page.get_by_role('textbox',name='جست‌وجوی صف')
        pending=[]
        def delay_old(route):
            if old_receipt in route.request.url:
                pending.append(route)
            else:
                route.continue_()
        page.route('**/api/inventory-v2.php?requests=1&*',delay_old)
        with page.expect_request(lambda r: old_receipt in r.url):
            search.fill(old_receipt)
        search.fill('NONEXISTENT-NEW-QUEUE')
        expect(page.get_by_role('status').filter(has_text='نتیجه‌ای نیست')).to_be_visible()
        assert len(pending)==1
        with page.expect_response(lambda r: old_receipt in r.url):
            pending[0].continue_()
        expect(page.locator('tr').filter(has_text=old_receipt)).to_have_count(0)
        page.screenshot(path=str(output/'after-empty-390.png'))

        browser.close()
    print('PASS Chromium actual app screenshots, pagination, deep-link, retry and empty state (390, 768, 1440)',flush=True)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for flag in ('before','after','admin-mobile','container','output'):
        parser.add_argument('--'+flag,required=True)
    run(parser.parse_args())
