#!/usr/bin/env python3
"""Verify TAM-STAB-02 against an isolated rc.15 → rc.16 loopback MariaDB lab."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import os
from pathlib import Path
import secrets
import subprocess
import time
from urllib.parse import urlencode, urlsplit

from smoke import Client, Runner, expect, synthetic_imei
from v7_operations import open_as


def run(args):
    for url in (args.before, args.after):
        assert urlsplit(url).hostname in ('localhost', '127.0.0.1', '::1')
    log = Runner(args.report)
    unique = secrets.token_hex(4)
    prefix = '0978' + str(secrets.randbelow(90000) + 10000)
    password = 'Test-Only!' + secrets.token_hex(18)
    cap_permission = 'inventory.catalog.create'
    migration = Path(__file__).parents[1] / 'private/database/migrations/2.0.0-beta.8-device-identifiers.sql'

    def sql(query):
        return subprocess.run([args.sql], input=query, text=True, capture_output=True, check=True).stdout.strip()

    def api(base, mobile, credential):
        client = Client(base)
        actor = client.login(mobile, credential)
        return client, actor

    admin, _ = api(args.before, args.admin_mobile, os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    shop = admin.api('admin.php', 'POST', {
        'name': f'TEST STAB-02 {unique}', 'repairType': 'digital', 'managerName': 'مدیر آزمایشی',
        'managerMobile': prefix+'01', 'expiresAt': (dt.date.today()+dt.timedelta(days=30)).isoformat(),
        'productProfile': 'pro', 'inventoryMode': 'pro', 'qcMode': 'off',
        'modules': ['repair','inventory','finance'], 'maxUsers': 8, 'idempotencyKey': unique,
    })
    before, owner = api(args.before, prefix+'01', shop['temporaryPassword'])
    before.api('auth.php','POST',{'action':'change_initial_password','newPassword':password,'confirmation':password})
    before.token()
    actors = {}
    for suffix, role in [('02','technician'),('03','technician'),('04','warehouse_keeper'),('05','reception')]:
        admin.api('admin-users.php','POST',{'shopId':owner['shop']['id'],'branchIds':[owner['branch']['id']],
            'displayName':f'TEST {role} {suffix}','mobile':prefix+suffix,'password':password,'role':role})
        _, actors[suffix] = api(args.before, prefix+suffix, password)
    before.api('catalog.php','POST',{'type':'موبایل','brand':'TEST '+unique,'model':'TEST handset'})
    model = before.api('catalog.php')['items'][0]['id']

    def create(client, expected=200, **fields):
        result = client.api('operations.php','POST',{
            'action':'create_case','receiptMode':'issue_only','customerName':'مشتری آزمایشی',
            'customerMobile':prefix+'09','deviceModelId':model,'declaredIssue':'TEST بررسی دستگاه',
            'customerConsent':{'dataHandling':'no_erasure'},'assignedToUserId':actors['02']['id'],
            'color':'مشکی','preapprovedAmount':7500000,'idempotencyKey':secrets.token_hex(16),
            **fields,
        },expected=expected)
        return result['repairCase'] if expected==200 else result

    legacy_imei = synthetic_imei()
    legacy = create(before, identifier=legacy_imei)
    legacy_exception = create(before,identifier=synthetic_imei())
    historical_text = 'HIST-موارد-0007'
    sql(f"""UPDATE repair_cases SET identifier_snapshot='{historical_text}' WHERE id={int(legacy_exception['id'])};
        UPDATE repair_customer_devices SET identifier_value='{historical_text}' WHERE id={int(legacy_exception['deviceId'])};""")
    original = sql(f"""SELECT HEX(c.identifier_snapshot),HEX(d.identifier_value),HEX(d.normalized_identifier)
        FROM repair_cases c JOIN repair_customer_devices d ON d.id=c.device_id
        WHERE c.id IN ({int(legacy['id'])},{int(legacy_exception['id'])}) ORDER BY c.id;""")
    health = Client(args.after)
    log.check('new backend reports the unmigrated database as incompatible',lambda:expect(
        not health.api('health.php')['schema_compatible'],'old schema treated as compatible'))
    log.check('apply additive migration against populated rc.15',lambda:sql(migration.read_text()))
    log.check('migration is safe to reapply',lambda:sql(migration.read_text()))
    log.check('migration preserves legacy values byte for byte and does not guess types',lambda:expect(
        sql(f"""SELECT HEX(c.identifier_snapshot),HEX(d.identifier_value),HEX(d.normalized_identifier)
        FROM repair_cases c JOIN repair_customer_devices d ON d.id=c.device_id
        WHERE c.id IN ({int(legacy['id'])},{int(legacy_exception['id'])}) AND c.imei_snapshot IS NULL
        AND c.serial_number_snapshot IS NULL AND d.imei IS NULL AND d.serial_number IS NULL ORDER BY c.id;""")==original
        and sql("SELECT COUNT(*) FROM tamiran_schema_versions WHERE version='2.0.0-beta.8';")=='1',
        'legacy identifiers changed or migration version repeated'))
    log.check('health recognizes migrated schema',lambda:expect(health.api('health.php')['schema_compatible'],'migration not recognized'))

    manager,_ = api(args.after,prefix+'01',password)
    tech,_ = api(args.after,prefix+'02',password)
    other,_ = api(args.after,prefix+'03',password)
    warehouse,_ = api(args.after,prefix+'04',password)
    reception,_ = api(args.after,prefix+'05',password)

    def command(client, case, action, expected=200, **fields):
        return client.api('workflow-v2.php','POST',{'action':action,'caseId':case,'idempotencyKey':secrets.token_hex(16),**fields},
            expected=expected)

    def row(case):
        return manager.api(f'workflow-v2.php?caseId={case}')['cases'][0]

    def receive(case):
        return command(tech,case,'technical_receive',lockVersion=row(case)['lockVersion'])

    def lookup(case):
        devices=manager.api(f'operations.php?customerMobile={prefix}09')['customer']['devices']
        return next(device for device in devices if device['id']==case['deviceId'])

    for old, identifier in ((legacy,legacy_imei),(legacy_exception,historical_text)):
        log.check('legacy lookup keeps identifier as an untyped value',lambda:expect(
            (lookup(old)['identifier'],lookup(old)['serialNumber'],lookup(old)['imei'])==(identifier,'',''),'legacy lookup relabeled data'))

    imei = synthetic_imei()
    serial = '123456789012345'
    local_digits = str.maketrans('0123456789','۰۱۲۳۴۵۶۷۸۹')
    local_imei = (imei[:7]+'-'+imei[7:]).translate(local_digits)
    log.check('bad IMEI fails even with a valid independent serial',lambda:create(manager,422,imei=serial,serialNumber='TEST-SERIAL'))
    log.check('invalid serial fails even with a valid independent IMEI',lambda:create(manager,422,imei=imei,serialNumber='???'))
    entry = log.check('independent identifiers accept alphanumerics and 15-digit serials without an IMEI checksum',lambda:
        create(manager,imei=local_imei,serialNumber=serial))
    case = entry['id']
    log.check('case and customer-history APIs preserve each typed identifier',lambda:expect(
        all((item['identifier'],item['imei'],item['serialNumber'])==(imei,imei,serial) for item in (entry,row(case),lookup(entry))),
        'dependent identifiers or leading digits changed'))
    log.check('both identifiers work in authorized server-side search',lambda:expect(
        all(manager.api('workflow-v2.php?'+urlencode({'q':value}))['cases'][0]['id']==case
            and manager.api('workflow-v2.php?'+urlencode({'managerQueue':'assigned','q':value}))['total']==1
            for value in (serial,imei)), 'server search missed a typed identifier'))
    log.check('another device cannot claim an already registered serial',lambda:create(manager,409,imei=synthetic_imei(),serialNumber=serial))
    log.check('previous typed case is unavailable for recall while active',lambda:expect(not lookup(entry)['recallEligible'],'active recall allowed'))
    log.check('IMEI unavailable still permits an independent serial with a valid reason',lambda:expect(
        create(manager,identifierUnavailable=True,identifierUnavailableReason='powered_off',serialNumber='SN-'+unique)['serialNumber']=='SN-'+unique,
        'unavailable IMEI cleared serial'))
    log.check('receipt API exposes typed fields and retains the compatibility field',lambda:expect(
        manager.api('operations.php?receipt='+entry['receiptNumber'])['repairCase']['serialNumber']==serial,'receipt lost serial'))
    receive(case)
    command(tech,case,'technical_finish',result='not_repaired',report='TEST',reason='TEST',lockVersion=row(case)['lockVersion'])
    manager.api('delivery-v2.php','POST',{'action':'complete','caseId':case,'recipientFullName':'مشتری آزمایشی',
        'recipientMobile':prefix+'09','verificationMethod':'receipt_qr','verificationEvidence':{'note':'TEST'},'accessoriesConfirmed':[]})
    recalled = lookup(entry)
    log.check('real delivery makes both typed identifiers available for recall',lambda:expect(
        recalled['recallEligible'] and recalled['serialNumber']==serial and recalled['imei']==imei,'recall fields lost'))
    if args.browser_dir:
        check_recall_browser(log,args.after,manager,recalled,entry,args.browser_dir,prefix+'09')
    new_case=log.check('recall creates a new case with both fields and keeps the previous case intact',lambda:create(
        manager,previousDeviceId=recalled['id'],expectedDeviceVersion=recalled['expectedDeviceVersion'],
        imei=recalled['imei'],serialNumber=recalled['serialNumber']))
    assert new_case['id']!=case and new_case['imei']==row(case)['imei'] and new_case['serialNumber']==row(case)['serialNumber']

    stock_code = 'CORE-'+unique
    category = 'TEST category '+unique
    manager.api('operations.php','POST',{'action':'create_inventory_item','code':stock_code,'title':stock_code,
        'category':category,'physicalQuantity':3,'hotReturnRequired':True})
    stock = next(item for item in manager.api('inventory-v2.php?catalog=1')['items'] if item['item_code']==stock_code)
    work = new_case['id']
    receive(work)
    catalog_input = {'code':'DELEGATED-'+unique,'title':'قطعه آزمایشی '+unique,'category':category}
    log.check('catalog permission defaults off',lambda:expect(
        not tech.api(f'workflow-v2.php?externalPurchase=1&caseId={work}')['canManageCatalog'],'permission default on'))
    log.check('default technician cannot create a catalog item',lambda:command(tech,work,'external_catalog_add',403,**catalog_input))
    log.check('technician cannot delegate the permission to themselves',lambda:tech.api('admin-users.php','PATCH',
        {'id':actors['02']['id'],'permissions':[cap_permission]},expected=403))
    log.check('manager cannot delegate this particular permission to reception',lambda:manager.api('admin-users.php','PATCH',
        {'id':actors['05']['id'],'permissions':[cap_permission]},expected=422))
    if args.browser_dir:
        check_grant_browser(log,args.after,manager,actors['02']['displayName'],args.browser_dir)
    else:
        manager.api('admin-users.php','PATCH',{'id':actors['02']['id'],'permissions':[cap_permission]})
    log.check('manager can grant just catalog definition to one technician',lambda:expect(
        next(user['permissions'] for user in manager.api('admin-users.php')['users'] if user['id']==actors['02']['id'])==[cap_permission],
        'unexpected permissions were granted'))
    tech, _ = api(args.after,prefix+'02',password)
    log.check('only the delegated technician receives existing categories',lambda:expect(
        category in tech.api(f'workflow-v2.php?externalPurchase=1&caseId={work}')['catalogCategories'],'existing category missing'))
    log.check('other technician remains unauthorized',lambda:command(other,work,'external_catalog_add',403,**catalog_input))
    log.check('definition without a case remains forbidden',lambda:tech.api('workflow-v2.php','POST',
        {'action':'external_catalog_add',**catalog_input},expected=403))
    log.check('definition cannot target an unknown scoped case',lambda:command(tech,999999999,'external_catalog_add',404,**catalog_input))
    log.check('technician cannot create a category via delegated catalog definition',lambda:
        command(tech,work,'external_catalog_add',422,**{**catalog_input,'category':'Other category'}))
    log.check('delegation grants neither sale price edits nor stock creation',lambda:(
        command(tech,work,'external_catalog_add',403,**catalog_input,salePrice=100),
        tech.api('operations.php','POST',{'action':'create_inventory_item',**catalog_input,'physicalQuantity':5},expected=403)))
    if args.browser_dir:
        check_catalog_browser(log,args.after,tech,work,catalog_input,args.browser_dir)
    item = log.check('definition is idempotent and the item is selectable in the same case',lambda:
        command(tech,work,'external_catalog_add',**catalog_input,physicalQuantity=9,purchasePrice=400))
    item_id = int(item['id'])
    log.check('catalog creation leaves stock and inventory ledger untouched',lambda:expect(
        sql(f'SELECT COUNT(*) FROM repair_branch_stock WHERE item_id={item_id};')=='0'
        and sql(f'SELECT COUNT(*) FROM repair_inventory_ledger WHERE item_id={item_id};')=='0'
        and sql(f'SELECT physical_quantity FROM repair_inventory_items WHERE id={item_id};')=='0','creation changed stock'))
    log.check('duplicate title and duplicate code are rejected consistently',lambda:(
        command(tech,work,'external_catalog_add',409,**{**catalog_input,'code':'OTHER-'+unique}),
        command(tech,work,'external_catalog_add',409,**{**catalog_input,'title':'OTHER-'+unique}),
        manager.api('operations.php','POST',{'action':'create_inventory_item',**catalog_input},expected=409)))

    def policy(**configured):
        current=manager.api('workflow-v2.php')['operationsPolicy']
        return manager.api('settings.php','PATCH',{'key':'operations_policy','value':{**current,**configured}})

    def purchase(client,target,cost,item_id,**fields):
        return command(client,target,'external_purchase',decision='request',purchase=True,
            lines=[{'itemId':item_id,'quantity':1,'unitCost':cost}],**fields)

    policy(purchase='limit',purchaseLimits={str(actors['02']['id']):100000})
    first_session = tech
    tech = log.check('two independent sessions overlap at the database and cannot both buy over the cumulative cap',lambda:
        check_concurrency(args.sql,sql,work,first_session,lambda:api(args.after,prefix+'02',password)[0],stock['id'],purchase))
    log.check('replaced session remains revoked for subsequent requests',lambda:first_session.api(f'workflow-v2.php?caseId={work}',expected=401))
    buying = tech.api(f'workflow-v2.php?externalPurchase=1&caseId={work}')
    log.check('purchase histories keep unit cost private and pending counts towards the cap',lambda:expect(
        buying['ownCommitted']==120000 and all('unitCost' not in part and 'total' not in part for part in buying['rows'])
        and purchase(tech,work,1,stock['id'])['status']=='pending','cap or confidentiality failed'))
    log.check('purchase awaiting approval cannot be booked as an actual purchase',lambda:command(tech,work,
        'external_purchase',409,decision='buy',publicId=next(x['publicId'] for x in buying['rows'] if x['status']=='pending')))
    policy(purchase='approval')
    log.check('manager policy still requires approval',lambda:expect(
        purchase(tech,work,1000,item_id)['status']=='pending','mandatory approval bypassed'))
    policy(purchase='free')
    log.check('free policy still permits valid immediate purchase',lambda:expect(
        purchase(tech,work,1000,item_id)['status']=='bought','free policy blocked'))
    bought=next(part for part in buying['rows'] if part['status']=='bought')
    command(tech,work,'external_purchase',decision='receive',publicId=bought['publicId'])
    command(tech,work,'external_purchase',decision='use',publicId=bought['publicId'])
    hot = next(h for h in manager.api('inventory-control-v2.php')['hotReturns'] if int(h['case_id'])==work)
    action = {'hotReturnPublicId':hot['public_id']}
    endpoint='inventory-control-v2.php'
    log.check('an unsubmitted core cannot be marked as physically received',lambda:warehouse.api(endpoint,'POST',
        {'action':'hot_review','decision':'accept',**action},expected=409))
    tech.api(endpoint,'POST',{'action':'hot_submit','condition':'healthy',**action})
    def current_core():
        return next(h for h in manager.api(endpoint)['hotReturns'] if h['public_id']==hot['public_id'])
    evidence = current_core()['evidence_id']
    review={'action':'hot_review','decision':'reject','evidenceId':evidence,**action}
    reason='TEST مغایرت در سلامت قطعه'
    log.check('negative review requires a nonblank reason and the warehouse role',lambda:(
        warehouse.api(endpoint,'POST',{**review,'reason':'  '},expected=400),
        tech.api(endpoint,'POST',{**review,'reason':reason},expected=403),
        reception.api(endpoint,'POST',{**review,'reason':reason},expected=403)))
    if args.browser_dir:
        check_hot_browser(log,args.after,warehouse,hot['receipt_number'],reason,args.browser_dir)
    else:
        warehouse.api(endpoint,'POST',{**review,'reason':reason})
    log.check('rejected core stays open with the reason visible in the queue',lambda:expect(
        current_core()['status']=='rejected' and current_core()['rejection_reason']==reason
        and any('داغی' in text for text in row(work)['blockers']['parts']), 'rejected core stopped blocking'))
    tech.api(endpoint,'POST',{'action':'hot_submit','condition':'damaged',**action})
    log.check('a stale decision cannot settle different evidence',lambda:warehouse.api(endpoint,'POST',
        {**review,'decision':'accept'},expected=409))
    warehouse.api(endpoint,'POST',{**review,'decision':'accept','evidenceId':current_core()['evidence_id']})
    log.check('real re-submission and acceptance settle once and preserve both decision records',lambda:expect(
        current_core()['status']=='settled' and sql(f"""SELECT COUNT(*) FROM tamiran_audit_log
        WHERE action_code='hot_return.review' AND entity_public_id='{hot['public_id']}';""")=='2'
        and sql(f"SELECT COUNT(*) FROM repair_hot_return_evidence WHERE hot_return_id={int(hot['id'])} AND rejection_reason IS NOT NULL;")=='1',
        'audit or history lost'))
    manager.api('admin-users.php','PATCH',{'id':actors['02']['id'],'permissions':[]})
    log.check('permission changes invalidate the previous session',lambda:tech.api(f'workflow-v2.php?caseId={work}',expected=401))
    tech,_=api(args.after,prefix+'02',password)
    log.check('revoked permission stays off after a fresh login',lambda:command(tech,work,
        'external_catalog_add',403,**{**catalog_input,'code':'REVOKED-'+unique,'title':'REVOKED-'+unique}))
    log.save()


def check_concurrency(sql_command, sql, case, first, open_second, item, purchase):
    locker = subprocess.Popen([sql_command], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

    def wait_for_transactions(count):
        for _ in range(45):
            if int(sql('SELECT COUNT(DISTINCT requesting_trx_id) FROM information_schema.INNODB_LOCK_WAITS;')) >= count:
                return
            time.sleep(.1)
        raise AssertionError(f'expected {count} simultaneous database lock waiters')

    try:
        locker.stdin.write(f'START TRANSACTION; SELECT id FROM repair_case_workflows WHERE case_id={case} FOR UPDATE;\n')
        locker.stdin.flush()
        assert locker.stdout.readline().strip().isdigit()
        with ThreadPoolExecutor(max_workers=2) as pool:
            try:
                started = pool.submit(purchase,first,case,60000,item)
                wait_for_transactions(1)
                # A fresh login revokes the earlier session for new requests. Its authenticated purchase is in flight.
                second = open_second()
                assert first.csrf != second.csrf
                next_request = pool.submit(purchase,second,case,60000,item)
                wait_for_transactions(2)
            finally:
                locker.stdin.write('COMMIT;\n')
                locker.stdin.flush()
            states = [request.result(timeout=15)['status'] for request in (started,next_request)]
            expect(sorted(states)==['bought','pending'],'cumulative purchase cap failed')
            return second
    finally:
        locker.stdin.close()
        locker.wait(timeout=10)
        locker.stdout.close()


def browse(url, client, width, callback):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        with open_as(browser,url,client,width) as context:
            callback(context.new_page(), browser_expect)
        browser.close()


def check_recall_browser(log,url,manager,device,entry,folder,mobile):
    def check(page, visible):
        page.goto(url+'/?view=receipts',wait_until='networkidle')
        page.get_by_role('button',name=f"مشاهده رسید {entry['receiptNumber']}",exact=True).click()
        receipt=page.locator('.tamiran-receipt')
        visible(receipt.get_by_text('شماره سریال',exact=True)).to_be_visible()
        visible(receipt.get_by_text('IMEI',exact=True)).to_be_visible()
        assert device['serialNumber'] in receipt.inner_text() and device['imei'] in receipt.inner_text()
        page.screenshot(path=str(folder/'receipt-identifiers.png'),animations='disabled')
        page.goto(url+'/?view=reception',wait_until='networkidle')
        page.get_by_placeholder('09xxxxxxxxx',exact=True).fill(mobile)
        page.get_by_role('button',name='انتخاب از سوابق',exact=True).click()
        page.locator('.previous-device-grid button').filter(has_text=device['lastReceipt']).click()
        page.get_by_role('button',name='ادامه',exact=True).click()
        visible(page.get_by_label('IMEI',exact=False).first).to_have_value(device['imei'])
        visible(page.get_by_label('شماره سریال',exact=True)).to_have_value(device['serialNumber'])
        page.screenshot(path=str(folder/'recall-mobile.png'),animations='disabled')
    log.check('Chromium displays separate receipt identities and prefills both after recall',lambda:browse(url,manager,390,check))


def check_grant_browser(log,url,manager,technician_name,folder):
    def check(page, visible):
        page.goto(url+'/?view=settings',wait_until='networkidle')
        page.get_by_role('button',name='کاربران و نقش‌ها',exact=True).click()
        page.get_by_role('button',name=f'ویرایش {technician_name}',exact=True).click()
        page.get_by_role('button',name='افزودن دسترسی بیشتر',exact=True).click()
        page.get_by_role('button',name='قطعات و انبار',exact=False).click()
        permission=page.get_by_role('checkbox',name='تعریف قطعه از داخل پرونده',exact=True)
        visible(permission).not_to_be_checked()
        permission.check()
        permission.scroll_into_view_if_needed()
        page.screenshot(path=str(folder/'manager-catalog-permission.png'),animations='disabled')
        page.get_by_role('button',name='ذخیره کاربر',exact=True).click()
        visible(page.get_by_role('form',name='ویرایش کاربر تعمیرگاه')).to_have_count(0)
    log.check('Chromium lets a manager enable only the catalog permission',lambda:browse(url,manager,1440,check))


def check_catalog_browser(log,url,tech,case,item,folder):
    def check(page, visible):
        page.goto(url+f'/?view=my-work&techCase={case}&techTask=purchases',wait_until='networkidle')
        page.get_by_role('button',name='تعریف کالای جدید',exact=True).click()
        page.get_by_label('کد کالا',exact=True).fill(item['code'])
        page.get_by_label('نام کالا',exact=True).fill(item['title'])
        page.get_by_role('combobox',name='دسته‌بندی',exact=True).select_option(item['category'])
        visible(page.get_by_label('قیمت فروش واحد',exact=True)).to_have_count(0)
        page.screenshot(path=str(folder/'catalog-entry-mobile.png'),animations='disabled')
        page.get_by_role('button',name='ثبت کالا در بانک قطعات',exact=True).click()
        visible(page.get_by_text('کالا به بانک قطعات اضافه شد.')).to_be_visible()
        visible(page.get_by_role('button',name='تغییر قطعه',exact=True)).to_be_visible()
        assert f'techCase={case}' in page.url
    log.check('Chromium allows in-case catalog definition and automatically selects the item',lambda:browse(url,tech,390,check))


def check_hot_browser(log,url,warehouse,receipt,reason,folder):
    def check(page, visible):
        page.goto(url+'/?view=hot-returns',wait_until='networkidle')
        row=page.locator('tr').filter(has_text=receipt)
        row.get_by_role('button',name='رد دریافت',exact=True).click()
        visible(row.get_by_role('button',name='ثبت رد دریافت',exact=True)).to_be_disabled()
        row.get_by_label('دلیل رد دریافت',exact=True).fill(reason)
        page.screenshot(path=str(folder/'core-rejection.png'),animations='disabled')
        row.get_by_role('button',name='ثبت رد دریافت',exact=True).click()
        visible(row.get_by_text(reason,exact=False)).to_be_visible()
    log.check('Chromium submits an explicit rejection and shows the reason on the row',lambda:browse(url,warehouse,1440,check))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before',required=True)
    parser.add_argument('--after',required=True)
    parser.add_argument('--admin-mobile',required=True)
    parser.add_argument('--report',required=True)
    parser.add_argument('--sql',required=True,help='executable that reads SQL from stdin, connects only to the isolated database, and streams unbuffered results')
    parser.add_argument('--browser-dir',type=Path)
    args=parser.parse_args()
    if args.browser_dir:
        args.browser_dir.mkdir(parents=True,exist_ok=True)
    run(args)
