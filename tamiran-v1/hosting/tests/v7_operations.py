#!/usr/bin/env python3
"""Exercise v7 policies, case purchase, prior invoice and QC on synthetic loopback data."""
import argparse
import datetime as dt
import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit

from smoke import Client, Runner, expect, synthetic_imei


def run(args):
    assert urlsplit(args.url).hostname in ('localhost', '127.0.0.1', '::1')
    marker = 'TEST-V7-' + secrets.token_hex(4)
    prefix = '0998' + str(secrets.randbelow(90000) + 10000)
    admin = Client(args.url)
    admin.login(args.admin_mobile, os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    log = Runner(args.report)
    shop = admin.api('admin.php', 'POST', {
        'name': marker, 'repairType': 'digital', 'managerName': marker, 'managerMobile': prefix + '01',
        'expiresAt': (dt.date.today() + dt.timedelta(days=365)).isoformat(), 'productProfile': 'pro',
        'inventoryMode': 'pro', 'qcMode': 'independent', 'modules': ['repair', 'inventory', 'finance'],
        'maxUsers': 12, 'idempotencyKey': marker,
    })
    manager = Client(args.url)
    owner = manager.login(prefix + '01', shop['temporaryPassword'])
    password = 'Test-Only!' + secrets.token_hex(18)
    manager.api('auth.php', 'POST', {'action':'change_initial_password','newPassword':password,'confirmation':password})
    manager.token()
    clients = []
    ids = []
    for index, role in enumerate(('technician','technician','quality_control','warehouse_keeper'), 2):
        mobile = prefix + f'{index:02}'
        admin.api('admin-users.php','POST',{'shopId':owner['shop']['id'], 'branchIds':[owner['branch']['id']],
            'displayName':marker + role + str(index),'mobile':mobile,'password':password,'role':role})
        client = Client(args.url)
        ids.append(client.login(mobile, password)['id'])
        clients.append(client)
    tech, destination, inspector, warehouse = clients
    technician, recipient, _, _ = ids
    manager.api('catalog.php','POST',{'type':'موبایل','brand':marker,'model':marker})
    model = manager.api('catalog.php')['items'][0]['id']
    manager.api('operations.php','POST',{'action':'create_inventory_item','code':'V7-CABLE','title':'کابل آزمایشی','physicalQuantity':3})
    item = manager.api('inventory-v2.php')['items'][0]['id']

    def save_policy(**patch):
        policy = manager.api('workflow-v2.php')['operationsPolicy']
        manager.api('settings.php','PATCH',{'key':'operations_policy','value':{**policy, **patch}})

    def create(promised_at=None):
        case = manager.api('operations.php','POST',{
            'action':'create_case','receiptMode':'issue_only','customerName':marker,'customerMobile':prefix+'09',
            'deviceModelId':model,'identifier':synthetic_imei(),'declaredIssue':'TEST شارژ قطع می‌شود',
            'customerConsent':{'dataHandling':'coordinate_first'},'assignedToUserId':technician,'accessories':['بدون لوازم'],
            'preapprovedAmount':7500000,'idempotencyKey':secrets.token_hex(12),
            **({'promisedAt':promised_at} if promised_at else {}),
        })['repairCase']['id']
        command(tech, case, 'technical_receive', lockVersion=row(case)['lockVersion'])
        return case

    def row(case, actor=manager):
        return actor.api(f'workflow-v2.php?caseId={case}')['cases'][0]

    def command(actor, case, action, expected=200, **payload):
        return actor.api('workflow-v2.php','POST',{'action':action,'caseId':case,'idempotencyKey':secrets.token_hex(12),**payload},expected=expected)

    def qc_call(actor, action, case, expected=200, **payload):
        return actor.api('quality-v2.php','POST',{'action':action,'caseId':case,'idempotencyKey':secrets.token_hex(12),**payload},expected=expected)

    save_policy(handover='manager', purchase='limit', purchaseLimits={str(technician): 300000})
    case = create()
    refer = command(tech,case,'handover_request',toUserId=recipient,reasonId='expertise',partsDisposition='transfer_to_new',hotReturnsDisposition='transfer_to_new')
    reply = {'publicId':refer['publicId']}
    log.check('manager policy creates a separate approval', lambda:expect(refer['requiresManagerApproval'] is True, 'approval not recorded'))
    log.check('pending approval withholds physical receipt',lambda:destination.api(f"workflow-v2.php?handoverReceipt={refer['publicId']}",expected=409))
    log.check('recipient cannot approve managerial request',lambda:command(destination,case,'handover_decide',expected=403,decision='approve_request',**reply))
    log.check('manager approves without transferring case',lambda:expect(command(manager,case,'handover_decide',decision='approve_request',**reply)['approved'] and row(case)['primaryTechnicianUserId']==technician,'approval transferred case'))
    receipt=destination.api(f"workflow-v2.php?handoverReceipt={refer['publicId']}")
    log.check('approved request still needs physical receipt',lambda:expect(command(destination,case,'handover_decide',decision='accept',receiptRevision=receipt['revision'],checkedItems=['device'],**reply)['status']=='accepted','recipient could not accept'))
    save_policy(handover='disabled')
    original_due=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S')
    case = create(original_due)
    log.check('manager-only policy blocks technician referral',lambda:command(tech,case,'handover_request',expected=403,toUserId=recipient,reasonId='expertise',partsDisposition='transfer_to_new',hotReturnsDisposition='transfer_to_new'))

    log.check('diagnosis preserves acceptance issue and moves to estimation',lambda:expect(
        command(tech,case,'technical_diagnosis',assessment='confirmed',description='آزمایش قطع شارژ',issues=['اتصال شارژ معیوب'],lockVersion=row(case)['lockVersion'])['recorded']
        and row(case)['status']=='estimate_pending' and 'شارژ قطع می‌شود' in row(case)['declaredIssue'],'diagnosis rewrote reception or failed transition'))
    line = {'itemId':item,'quantity':1,'unitCost':200000}
    first = command(tech,case,'external_purchase',decision='request',lines=[line])
    second = command(tech,case,'external_purchase',decision='request',lines=[line])
    log.check('case-level limit is cumulative',lambda:expect(first['status']=='approved' and second['status']=='pending','purchase limits were bypassed'))
    first_id, second_id = first['publicIds'][0], second['publicIds'][0]
    log.check('technician cannot see other case purchase costs',lambda:destination.api(f'workflow-v2.php?externalPurchase=1&caseId={case}',expected=403))
    log.check('pending purchase cannot be recorded as actual',lambda:command(tech,case,'external_purchase',expected=409,decision='buy',publicId=second_id))
    log.check('approved purchase cannot be consumed before purchase',lambda:command(tech,case,'external_purchase',expected=409,decision='use',publicId=first_id))
    log.check('manager can reject pending purchase',lambda:command(manager,case,'external_purchase',decision='reject',publicId=second_id,reason='TEST موارد تکراری'))
    command(tech,case,'external_purchase',decision='buy',publicId=first_id)
    log.check('bought parts stop finish until determined',lambda:expect(any('خرید خارج' in blocker for blocker in row(case)['blockers']['parts']),'bought part is invisible to closeout'))
    command(tech,case,'external_purchase',decision='use',publicId=first_id)
    technical=tech.api(f'workflow-v2.php?caseId={case}&technical=1')
    save_policy(purchase='free')
    log.check('catalog item can be defined outside inventory movement', lambda:command(manager,case,'external_catalog_add',code='TEST-V7-OTHER',title='قطعه آزمایشی بدون موجودی',salePrice=450000))
    log.check('technician cannot define unauthorized catalog item', lambda:command(tech,case,'external_catalog_add',expected=403,code='TEST-V7-X',title='آزمایش'))
    before_stock=next(part['physical_quantity'] for part in manager.api('inventory-v2.php')['items'] if part['id']==item)
    returned=command(tech,case,'external_purchase',decision='request',lines=[line])['publicIds'][0]
    command(tech,case,'external_purchase',decision='buy',publicId=returned)
    command(tech,case,'external_purchase',decision='return',publicId=returned,disposition='stock',reason='TEST سالم است')
    log.check('stock does not increase before physical confirmation',lambda:expect(next(part['physical_quantity'] for part in manager.api('inventory-v2.php')['items'] if part['id']==item)==before_stock,'inventory increased early'))
    log.check('only manager confirms stock receipt',lambda:command(tech,case,'external_purchase',expected=403,decision='confirm_return',publicId=returned,reason='TEST confirmation'))
    log.check('physical receipt adds unused part to inventory once',lambda:expect(command(manager,case,'external_purchase',decision='confirm_return',publicId=returned,reason='TEST تحویل قطعه به انبار')['status']=='returned'
        and next(part['physical_quantity'] for part in manager.api('inventory-v2.php')['items'] if part['id']==item)==before_stock+1,'inventory receipt missing'))
    log.check('manager prioritizes with audited reason',lambda:expect(
        command(manager,case,'manager_update_case',priority='critical',reason='TEST تغییر اولویت',lockVersion=row(case)['lockVersion'])['recorded']
        and row(case)['priority']=='critical','priority not retained'))
    log.check('technician cannot override priority',lambda:command(tech,case,'manager_update_case',expected=403,priority='normal',reason='TEST تغییر اولویت',lockVersion=row(case)['lockVersion']))
    log.check('only used purchase reaches invoice and no private cost leaks',lambda:expect(len(technical['parts'])==1 and technical['parts'][0]['sourceType']=='external'
        and 'purchaseUnitCost' not in technical['invoice']['items'][0],'incorrect projection'))
    command(tech,case,'estimate_create',items=[{'type':'labor','title':'اجرت آزمایشی','quantity':1,'unitPrice':1000000}])
    command(tech,case,'transition',target='repairing',lockVersion=row(case)['lockVersion'])
    finish = {'result':'repaired','report':'TEST پایان تعمیر','lockVersion':row(case)['lockVersion']}
    log.check('invoice above customer budget cannot enter QC',lambda:command(tech,case,'technical_finish',expected=409,invoice={'laborAmount':8000000},**finish))
    log.check('invoice enters QC after confirmation',lambda:expect(command(tech,case,'technical_finish',invoice={'laborAmount':1400000},**finish)['target']=='qc_pending','QC route was skipped'))
    log.check('independent QC denies own work',lambda:qc_call(tech,'start',case,expected=403))
    log.check('QC requires physical receipt before testing',lambda:qc_call(inspector,'run',case,expected=409))
    if args.browser_dir:
        check_quality_browser(log,args.url,inspector,args.browser_dir,row(case)['receiptNumber'])
    receipt=qc_call(inspector,'start',case)['receipt']
    template=receipt['template']
    primary=next(x for x in template['items'] if x['code']=='repair_issue')
    items=[{'templateItemId':part['id'],'result':'passed'} for part in template['items']]
    log.check('primary repair test cannot be inapplicable',lambda:qc_call(inspector,'run',case,expected=400,receiptId=receipt['publicId'],items=[
        {**answer,'result':'not_applicable','notes':'TEST'} if answer['templateItemId']==primary['id'] else answer for answer in items]))
    log.check('manager versions checklist after physical receipt',lambda:qc_call(manager,'save_template',case,
        templateId=template['id'],workflowCode=template['workflow_code'],items=[{'code':'new','title':'کنترل جدید','isRequired':True}]))
    log.check('worker cannot correct invoice after inspector intake',lambda:command(tech,case,'invoice_correct',expected=403,
        lockVersion=row(case)['lockVersion'],reason='TEST اصلاح عقب‌افتاده',invoice={'laborAmount':1500000}))
    log.check('manager can correct invoice without restarting QC',lambda:expect(
        command(manager,case,'invoice_correct',lockVersion=row(case)['lockVersion'],reason='TEST اصلاح اجرت',invoice={'laborAmount':1500000})['totalAmount']==1500000
        and row(case)['status']=='qc_pending','invoice correction invalidated QC'))
    log.check('in-progress QC keeps its original checklist',lambda:expect(qc_call(inspector,'run',case,receiptId=receipt['publicId'],items=items)['result']=='passed' and row(case)['status']=='finance_pending','old checklist became invalid'))
    drafts=manager.api('finance-v2.php')['drafts']
    draft=next(d for d in drafts if d['caseId']==case)
    log.check('finance sees prior confirmed draft and consumed purchase',lambda:expect(draft['totalAmount']==1500000 and len(draft['items'])==2,'finance replaced the pre-QC invoice'))
    date=dt.date.today().isoformat()
    log.check('manager reports actual repair and QC',lambda:expect(any(r['id']==technician and r['repaired']>=1 and r['qcRuns']>=1 and r['withInitialDue']==1 and r['onTime']==1 and 'transfer' in r['stageTimes'] for r in manager.api(f'workflow-v2.php?managerReport=1&from={date}&to={date}')['rows']),'missing verified activity'))
    log.check('non-manager cannot request performance data',lambda:tech.api(f'workflow-v2.php?managerReport=1&from={date}&to={date}',expected=403))
    failed=create()
    command(tech,failed,'estimate_create',items=[{'type':'labor','title':'اجرت بازکاری','quantity':1,'unitPrice':200000}])
    command(tech,failed,'transition',target='repairing',lockVersion=row(failed)['lockVersion'])
    command(tech,failed,'technical_finish',result='repaired',report='TEST نتیجه اولیه',lockVersion=row(failed)['lockVersion'])
    failed_qc=qc_call(inspector,'start',failed)['receipt']
    failed_items=[{'templateItemId':line['id'],'result':'failed' if line['code']=='repair_issue' else 'passed',
        **({'notes':'TEST ایراد تکرار شد'} if line['code']=='repair_issue' else {})} for line in failed_qc['template']['items']]
    log.check('failed QC keeps chosen re-diagnosis route',lambda:expect(qc_call(inspector,'run',failed,receiptId=failed_qc['publicId'],
        items=failed_items,result='failed',failureReason='TEST ایراد پابرجا است',reworkDestination='diagnosing')['result']=='failed'
        and row(failed)['status']=='qc_rework'
        and tech.api(f'workflow-v2.php?caseId={failed}&technical=1')['reworkDestination']=='diagnosing','rework route missing'))
    overdue=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
    stock_case=create(overdue)
    feed='workflow-v2.php?managerFollowups=1&filter=late'
    log.check('manager followup independent from operations list',lambda:expect(any(r['caseId']==stock_case for r in manager.api(feed)['rows']),'overdue case missing'))
    log.check('manager note retains the real elapsed followup reason',lambda:expect(command(manager,stock_case,'followup_note',message='TEST پیگیری موعد')['recorded']
        and any(r['caseId']==stock_case for r in manager.api(feed)['rows']),'followup note hid case'))
    log.check('technician cannot view manager followup branch feed',lambda:tech.api(feed,expected=403))

    bad=[{'itemId':item,'quantity':1},{'itemId':99999999999,'quantity':1}]
    purchase_endpoint='inventory-v2.php'
    log.check('invalid item rolls back entire stock batch',lambda:tech.api(purchase_endpoint,'POST',{
        'action':'request','caseId':stock_case,'lines':bad,'idempotencyKey':secrets.token_hex(12)},expected=404))
    log.check('valid batch saves all rows and enters part wait',lambda:expect(len(tech.api(purchase_endpoint,'POST',{
        'action':'request','caseId':stock_case,'lines':[line,line],'idempotencyKey':secrets.token_hex(12)})['publicIds'])==2
        and row(stock_case)['status']=='awaiting_parts','stock batch missing'))
    first_order_case=create()
    second_order_case=create()
    check_case_procurement(log, manager, warehouse, tech, [first_order_case,second_order_case], item)
    if args.browser_dir:
        check_supply_browser(log,args.url,warehouse,row(stock_case)['receiptNumber'],args.browser_dir)
        check_finance_delivery_browser(log,args.url,manager,case,row(case)['receiptNumber'],args.browser_dir)
        check_operations_browser(log,args.url,manager,tech,stock_case,args.browser_dir)

    pending = create()
    command(tech,pending,'estimate_create',items=[{'type':'labor','title':'اجرت آزمایشی','quantity':1,'unitPrice':200000}])
    command(tech,pending,'transition',target='repairing',lockVersion=row(pending)['lockVersion'])
    command(tech,pending,'technical_finish',result='repaired',report='TEST پایان تعمیر',lockVersion=row(pending)['lockVersion'])
    receipt=qc_call(inspector,'start',pending)['receipt']
    qc_call(inspector,'run',pending,receiptId=receipt['publicId'],items=[
        {'templateItemId':test['id'],'result':'passed'} for test in receipt['template']['items']])
    pending_number=row(pending)['receiptNumber']
    def set_finance_module(enabled):
        admin.api('admin.php','PATCH',{'id':owner['shop']['id'],
            'modules':['repair','inventory']+(['finance'] if enabled else []),
            'moduleChangeReason':'آزمون محیط محلی'})
    set_finance_module(False)
    locked=manager.api('finance-v2.php?workspace=1')
    log.check('inactive finance shows pending case identity without billing data',lambda:expect(
        locked['available'] is False and any(entry['receiptNumber']==pending_number for entry in locked['pending'])
        and 'invoices' not in locked and 'drafts' not in locked,'disabled finance hides case or exposes billing data'))
    log.check('technician without finance permission cannot read the workspace',lambda:tech.api('finance-v2.php?workspace=1',expected=403))
    log.check('inactive finance still rejects invoice issue',lambda:manager.api('finance-v2.php','POST',
        {'action':'issue','caseId':pending,'items':[{'type':'labor','title':'آزمایش','quantity':1,'saleUnitPrice':200000}]},expected=403))
    if args.browser_dir:
        check_locked_finance_browser(log,args.url,manager,pending,pending_number,args.browser_dir)
    set_finance_module(True)
    reopened=manager.api('finance-v2.php?workspace=1')
    log.check('activating module restores the same existing case without re-referral',lambda:expect(
        reopened['available'] and any(entry['caseId']==pending for entry in reopened['drafts']), 'existing pending case did not reappear'))
    if args.browser_dir:
        mobile=prefix+'07'
        admin.api('admin-users.php','POST',{'shopId':owner['shop']['id'],'branchIds':[owner['branch']['id']],
            'displayName':'صندوق‌دار آزمایشی','mobile':mobile,'password':password,'role':'finance_cashier'})
        cashier=Client(args.url)
        cashier.login(mobile,password)
        check_cashier_referral(log,args.url,cashier,pending,pending_number)
    log.save()


def check_case_procurement(log, manager, warehouse, tech, ids, part_id):
    endpoint='procurement-v2.php'
    manager.api('operations.php','POST',{'action':'create_inventory_item','code':'TEST-PO-LCD','title':'ال‌سی‌دی آزمایشی','physicalQuantity':0})
    product=next(row for row in manager.api('inventory-v2.php')['items'] if row['item_code']=='TEST-PO-LCD')
    supplier=warehouse.api(endpoint,'POST',{'action':'supplier_create','name':'تأمین‌کننده آزمایشی'})['publicId']
    supplier_id=next(row['id'] for row in warehouse.api(endpoint)['suppliers'] if row['public_id']==supplier)
    endpoint_inventory='inventory-v2.php'
    request_ids=[]
    for case in ids:
        saved=tech.api(endpoint_inventory,'POST',{'action':'request','caseId':case,'itemId':product['id'],'quantity':1,'idempotencyKey':secrets.token_hex(12)})
        request_ids.append(next(row['id'] for row in manager.api(endpoint_inventory)['requests'] if row['public_id']==saved['publicId']))
    request_a,request_b=request_ids
    payload={'action':'document_create','supplierId':supplier_id,'originReason':'TEST LCD پرونده'}
    line={'itemId':product['id'],'quantity':2,'unitPrice':1200000}
    def create(lines, expected=200, actor=warehouse):
        return actor.api(endpoint,'POST',{**payload,'items':lines},expected=expected)
    link_a={'requestId':request_a,'quantity':1}
    link_b={'requestId':request_b,'quantity':1}
    log.check('new procurement order requires a live part request',lambda:create([{**line,'partRequestIds':[]}],400))
    log.check('legacy standalone order is rejected',lambda:warehouse.api('purchase-orders.php','POST',{'itemId':product['id'],'quantity':1},expected=409))
    log.check('order cannot allocate one unit twice or exceed outstanding quantity',lambda:create([{**line,'allocations':[link_a,{**link_a,'quantity':2}]}],400))
    log.check('order cannot link requests for a different item',lambda:create([{**line,'itemId':part_id,'allocations':[link_a,link_b]}],409))
    log.check('order rejects a line whose quantity exceeds its case allocations',lambda:create([{**line,'allocations':[link_a]}],409))
    order=create([{**line,'allocations':[link_a,link_b]}])
    def record():
        return next(row for row in manager.api(endpoint)['documents'] if row['public_id']==order['publicId'])
    doc=record()
    log.check('aggregate order records both case numbers and exact shares',lambda:expect(
        [(int(link['case_id']),int(link['allocated_quantity'])) for link in doc['items'][0]['requests']]==[(ids[0],1),(ids[1],1)],'order cases missing'))
    log.check('same requests cannot be purchased twice while order is open',lambda:create([{**line,'allocations':[link_a,link_b]}],409))
    manager.api(endpoint,'POST',{'action':'approve','publicId':order['publicId'],'reason':'تأیید آزمایشی'})
    received={'action':'receive','publicId':order['publicId'],'items':[{
        'purchaseItemId':doc['items'][0]['id'],'acceptedQuantity':1}], 'idempotencyKey':secrets.token_hex(12)}
    def quantities():
        return {row['id']:row['reserved_quantity'] for row in manager.api(endpoint_inventory)['requests'] if row['id'] in request_ids}
    log.check('partial receipt reserves only one case share',lambda:expect(
        warehouse.api(endpoint,'POST',received)['status']=='partially_received' and quantities()=={request_a:1,request_b:0},'partial receipt overallocated'))
    log.check('partial receipt retries cannot allocate the same stock twice',lambda:expect(
        warehouse.api(endpoint,'POST',received)['replayed'] and quantities()=={request_a:1,request_b:0},'receipt repeated'))
    log.check('defective second unit does not reserve unavailable stock',lambda:expect(
        warehouse.api(endpoint,'POST',{**received,'idempotencyKey':secrets.token_hex(12),'items':[{
        'purchaseItemId':doc['items'][0]['id'],'defectiveQuantity':1}]})['status']=='received' and quantities()=={request_a:1,request_b:0},'defective unit reserved'))
    log.check('uncovered case can be reordered after defective receipt',lambda:create([{**line,'quantity':1,'allocations':[link_b]}]))
    log.check('reserved purchase does not appear as consumed or billable',lambda:expect(
        not tech.api(f'workflow-v2.php?caseId={ids[0]}&technical=1')['parts'],'unconsumed stock became billable'))


def check_supply_browser(log,url,warehouse,receipt,folder):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    with sync_playwright() as tooling:
        browser=tooling.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=open_as(browser,url,warehouse,width=1440).new_page()
        page.goto(url+'/?view=parts-supply',wait_until='networkidle')
        log.check('supply queue has no standalone order form',lambda:browser_expect(page.get_by_role('button',name='ثبت سفارش',exact=False)).to_have_count(0))
        row=page.get_by_role('row').filter(has_text=receipt).first
        row.get_by_role('button',name='ساخت سفارش خرید',exact=True).click()
        form=page.locator('section').filter(has=page.get_by_role('heading',name='سفارش خرید کابل آزمایشی',exact=True))
        browser_expect(form.get_by_text('درخواست مبدأ',exact=False)).to_contain_text(receipt)
        form.get_by_role('combobox').select_option(index=1)
        form.locator('#supply-order-price').fill('۱۲۰٬۰۰۰')
        page.screenshot(path=str(Path(folder)/'supply-desktop.png'),full_page=True)
        form.get_by_role('button',name='ثبت سفارش',exact=False).click()
        browser_expect(form).to_have_count(0)
        log.check('supply creates order with its original case visible',lambda:browser_expect(page.get_by_text('سفارش خرید باز دارد').first).to_be_visible())
        browser.close()


def check_finance_delivery_browser(log,url,manager,case,receipt,folder):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    output=Path(folder)
    with sync_playwright() as tooling:
        browser=tooling.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        ctx=open_as(browser,url,manager,width=1440)
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        def omit_case_from_general_feed(route):
            response=route.fetch()
            body=response.json()
            payload=body.get('data',body)
            payload['cases']=[row for row in payload['cases'] if row['id']!=case]
            route.fulfill(response=response,json=body)
        page.route(lambda address: urlsplit(address).path.endswith('/api/workflow-v2.php') and not urlsplit(address).query,
            omit_case_from_general_feed)
        def omit_legacy_finance_setting(route):
            response=route.fetch()
            body=response.json()
            shop=body['data']['actor']['shop']
            assert 'finance' in shop['modules']
            shop['modules'].remove('finance')
            route.fulfill(response=response,json=body)
        page.route(lambda address: urlsplit(address).path.endswith('/api/auth.php') and not urlsplit(address).query,
            omit_legacy_finance_setting)
        page.goto(url+'/?view=delivery',wait_until='networkidle')
        log.check('combined menu opens finance rather than delivery for a finance-authorized manager', lambda:
            browser_expect(page.get_by_role('button',name='نهایی‌سازی مالی',exact=True)).to_have_attribute('aria-pressed','true'))
        card=page.locator('.service-queue-card').filter(has_text=receipt)
        log.check('server-authorized case is visible with stale module settings and a truncated general feed',lambda:browser_expect(card).to_be_visible())
        draft=next(row for row in manager.api('finance-v2.php')['drafts'] if row['caseId']==case)
        search=page.get_by_role('textbox',name='جست‌وجوی صف')
        search.fill(draft['customer_mobile'])
        log.check('finance search reads customer mobile from its own queue',lambda:browser_expect(card).to_be_visible())
        search.fill('000-missing-case')
        browser_expect(card).to_have_count(0)
        search.fill(receipt)
        browser_expect(card).to_be_visible()
        page.unroute_all(behavior='wait')
        search.fill('')
        card.click()
        invoice_heading=page.get_by_role('heading',name='فاکتور تعمیرات',exact=True)
        browser_expect(invoice_heading).to_be_visible()
        log.check('invoice is read-only by default and shows purchased part source',lambda:expect(
            page.locator('.cashier-lines input').count()==0 and page.get_by_text('خرید خارجی',exact=True).count()==1,
            'invoice does not show the audited part line in read mode'))
        cashier=page.locator('.cashier-sheet')
        for width in (1440,768,390,320):
            page.set_viewport_size({'width':width,'height':900})
            log.check(f'invoice fits {width}px',lambda:expect(page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'horizontal overflow'))
            if width in (390,1440):
                page.screenshot(path=str(output/f'invoice-{width}.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':900})
        page.get_by_role('button',name='اصلاح مبالغ',exact=True).click()
        cashier.locator('tbody tr').filter(has_text='خرید خارجی').locator('input').first.fill('۹۰۰٬۰۰۰')
        cashier.locator('tbody tr').filter(has_text='اجرت').locator('input').first.fill('۱۰۰٬۰۰۰')
        page.get_by_role('button',name='پایان اصلاح',exact=True).click()
        proceed=page.get_by_role('button',name='تأیید فاکتور و ادامه به تسویه حساب',exact=True)
        log.check('invoice increase is blocked until consent',lambda:browser_expect(proceed).to_have_count(0))
        finance_url=page.url
        page.get_by_role('button',name='ارسال برای تأیید هزینه',exact=True).click()
        approval=page.get_by_role('button',name='ثبت تأیید تلفنی مشتری و ادامه',exact=True)
        browser_expect(approval.or_(page.get_by_role('alert')).first).to_be_visible(timeout=25000)
        assert approval.is_visible(), page.get_by_role('alert').all_text_contents()
        approval.click()
        browser_expect(page.get_by_text('تأیید مشتری ثبت شد.',exact=True)).to_be_visible()
        page.goto(finance_url,wait_until='networkidle')
        log.check('renewed consent restores edited invoice amounts without returning to repair',lambda:expect(
            proceed.is_visible() and '۱٬۰۰۰٬۰۰۰' in page.locator('.cashier-emphasis strong').inner_text(),
            'confirmed amount or price edits were lost'))
        proceed.click()
        confirmation=page.get_by_role('dialog',name='تأیید مبلغ نهایی')
        log.check('final amount is confirmed before issuance',lambda:browser_expect(confirmation).to_contain_text('۱٬۰۰۰٬۰۰۰ تومان'))
        confirmation.get_by_role('button',name='بازگشت و بررسی').click()
        browser_expect(confirmation).to_have_count(0)
        proceed.click()
        confirmation.get_by_role('button',name='تأیید و صدور فاکتور').click()
        next_step=page.get_by_role('heading',name='تسویه حساب',exact=True)
        browser_expect(next_step.or_(page.get_by_role('alert')).first).to_be_visible(timeout=25000)
        assert next_step.is_visible(), page.get_by_role('alert').all_text_contents()
        invoice=next(row for row in manager.api('finance-v2.php')['invoices'] if row['case_id']==case)
        log.check('edited sale prices and labor were stored in rials',lambda:expect(
            invoice['total_amount']==10000000 and invoice['paid_amount']==0,'final amount or separation incorrect'))
        endpoint='finance-v2.php'
        log.check('unpaid invoice cannot be referred to delivery',lambda:manager.api(endpoint,'POST',
            {'action':'refer_to_delivery','caseId':case},expected=409))
        page.get_by_label('مبلغ دریافت',exact=True).fill('۴۵۰٬۰۰۰')
        page.get_by_label('روش دریافت',exact=True).select_option('cash')
        page.get_by_role('button',name='ثبت دریافت',exact=True).click()
        browser_expect(cashier.get_by_text('پرداخت بخشی از مبلغ',exact=True)).to_be_visible(timeout=25000)
        page.reload(wait_until='networkidle')
        log.check('prior payments and remaining balance survive reload',lambda:expect(
            '۵۵۰٬۰۰۰' in page.locator('.cashier-emphasis strong').inner_text()
            and '۴۵۰٬۰۰۰' in page.locator('.cashier-history').inner_text(),'partial payment was lost'))
        for width in (1440,768,390,320):
            page.set_viewport_size({'width':width,'height':900})
            log.check(f'settlement fits {width}px',lambda:expect(page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'horizontal overflow'))
            if width in (390,1440):
                page.screenshot(path=str(output/f'settlement-{width}.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':900})
        page.get_by_role('button',name='دریافت کل مانده',exact=True).click()
        page.get_by_role('button',name='ثبت دریافت',exact=True).click()
        browser_expect(page.get_by_role('heading',name='ارجاع به تحویل',exact=True)).to_be_visible(timeout=25000)
        log.check('last receipt keeps the case in finance until explicit referral',lambda:expect(
            manager.api(f'workflow-v2.php?caseId={case}')['cases'][0]['status']=='finance_pending',
            'settlement moved the case to delivery'))
        page.get_by_role('button',name='تأیید مالی و ادامه به تحویل',exact=True).click()
        heading=page.get_by_role('heading',name='تحویل دستگاه به مشتری',exact=True)
        browser_expect(heading).to_be_visible(timeout=25000)
        log.check('finance opens the same physical delivery form directly',lambda:expect(
            f'deliveryCase={case}' in page.url and receipt in page.locator('.delivery-sheet').inner_text(), 'wrong delivery case'))
        log.check('no-accessories placeholder has no checkbox',lambda:browser_expect(
            page.get_by_role('checkbox',name='بدون لوازم',exact=True)).to_have_count(0))
        log.check('explicit referral moves the case without physical delivery',lambda:expect(
            manager.api(f'workflow-v2.php?caseId={case}')['cases'][0]['status']=='ready_for_delivery',
            'referral did not prepare delivery'))
        log.check('referral replay is idempotent',lambda:expect(manager.api(endpoint,'POST',
            {'action':'refer_to_delivery','caseId':case})['replayed'],'referral duplicated'))
        page.reload(wait_until='domcontentloaded',timeout=60000)
        log.check('direct delivery form survives reload',lambda:browser_expect(heading).to_be_visible(timeout=25000))
        submit=page.get_by_role('button',name='ثبت تحویل و نمایش رسید',exact=True)
        browser_expect(submit).to_be_disabled()
        page.get_by_text('شناسه را با همین دستگاه تطبیق دادم.',exact=True).click()
        page.get_by_label('مدرک یا توضیح احراز',exact=True).fill('رسید پرونده آزمایشی بازبینی شد')
        for width in (320,390,768,1440):
            page.set_viewport_size({'width':width,'height':900})
            log.check(f'delivery detail fits {width}px',lambda:page.wait_for_function(
                'document.documentElement.scrollWidth <= innerWidth + 1', timeout=10000))
            if width in (390,1440):
                page.screenshot(path=str(output/f'delivery-{width}.png'),full_page=True,timeout=60000)
        submit.click()
        browser_expect(page.get_by_role('heading',name='تحویل دستگاه ثبت شد',exact=True)).to_be_visible(timeout=25000)
        log.check('delivery records physical delivery independently',lambda:expect(
            manager.api(f'workflow-v2.php?caseId={case}')['cases'][0]['status']=='delivered','physical delivery not stored'))
        page.evaluate("""() => {
          const open = window.open.bind(window);
          window.open = (...args) => {
            const popup = open(...args);
            if (popup) popup.print = () => {};
            return popup;
          };
        }""")
        with page.expect_popup() as printed:
            page.get_by_role('button',name='چاپ رسید تحویل',exact=True).click()
        receipt_page=printed.value
        browser_expect(receipt_page.get_by_role('heading',name='رسید تحویل دستگاه',exact=True)).to_be_visible()
        log.check('actual delivery receipt prints from the success screen',lambda:browser_expect(
            receipt_page.locator('dl')).to_contain_text(receipt))
        receipt_page.pdf(path=str(output/'delivery-receipt.pdf'),prefer_css_page_size=True)
        page.get_by_role('button',name='بازگشت به صف تحویل',exact=True).click()
        browser_expect(page.get_by_role('heading',name='سوابق تحویل',exact=True)).to_be_visible()
        log.check('finance and delivery browser have no JavaScript errors',lambda:expect(not errors,str(errors)))
        browser.close()


def check_locked_finance_browser(log,url,manager,case,receipt,folder):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    with sync_playwright() as tooling:
        browser=tooling.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=open_as(browser,url,manager,width=1440).new_page()
        page.goto(url+f'/?view=my-work&techCase={case}&techTask=overview',wait_until='networkidle')
        page.get_by_role('button',name='پیگیری مالی',exact=True).click()
        page.get_by_role('button',name='ورود به مالی پرونده',exact=True).click()
        log.check('manager follows the case into the finance tab with original receipt prefilled', lambda:
            browser_expect(page.get_by_role('textbox',name='جست‌وجوی صف')).to_have_value(receipt))
        log.check('disabled finance still displays the case and explains activation',lambda:
            browser_expect(page.get_by_role('heading',name='پرونده‌های منتظر تکمیل مالی')).to_be_visible())
        browser_expect(page.get_by_role('listitem').filter(has_text=receipt)).to_be_visible()
        browser_expect(page.get_by_role('button',name='صدور فاکتور',exact=True)).to_have_count(0)
        browser_expect(page.get_by_role('status').filter(has_text='مدیر کل سامانه')).to_be_visible()
        log.check('workshop finance contains no activation action',lambda:browser_expect(
            page.get_by_role('button',name='رفتن به فعال‌سازی مالی',exact=True)).to_have_count(0))
        page.screenshot(path=str(Path(folder)/'finance-inactive.png'),full_page=True)
        page.goto(url+'/?view=capabilities',wait_until='networkidle')
        log.check('retired capability link falls back to workshop home',lambda:expect(
            page.get_by_role('heading',name='نبض تعمیرگاه',exact=True).count()>0
            and page.get_by_role('button',name='افزودن قابلیت',exact=True).count()==0,
            'retired capability catalog still reachable'))
        log.check('legacy activation POST is retired',lambda:manager.api('capabilities.php','POST',
            {'action':'request_activation','module':'finance'},expected=410))
        browser.close()


def check_cashier_referral(log,url,cashier,case,receipt):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    endpoint='finance-v2.php'
    draft=next(item for item in cashier.api(endpoint)['drafts'] if item['caseId']==case)
    invoice=cashier.api(endpoint,'POST',{'action':'issue','caseId':case,'items':draft['items'],'deferDelivery':True})
    cashier.api(endpoint,'POST',{'action':'payment','invoicePublicId':invoice['publicId'],'amount':invoice['totalAmount'],
        'method':'cash','idempotencyKey':secrets.token_hex(12),'deferDelivery':True})
    with sync_playwright() as tooling:
        browser=tooling.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=open_as(browser,url,cashier).new_page()
        page.goto(url+f'/?view=delivery&financeCase={case}',wait_until='domcontentloaded')
        page.get_by_role('button',name='ارجاع به صف تحویل',exact=True).click()
        log.check('cashier without completion permission hands off to queue instead of opening delivery',lambda:
            browser_expect(page.get_by_role('heading',name='صف نهایی‌سازی مالی',exact=True)).to_be_visible(timeout=25000))
        page.goto(url+f'/?view=delivery&deliveryTab=ready&deliveryCase={case}',wait_until='domcontentloaded')
        browser_expect(page.get_by_role('heading',name='صف دستگاه‌های آمادهٔ تحویل')).to_be_visible()
        browser_expect(page.get_by_text(receipt,exact=True)).to_be_visible()
        log.check('cashier deep link keeps physical delivery read only',lambda:
            browser_expect(page.get_by_role('button',name='ثبت تحویل و نمایش رسید')).to_have_count(0))
        browser.close()


def open_as(browser, url, client, width=390):
    ctx=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
    ctx.add_cookies([{'name':cookie.name,'value':cookie.value,'domain':urlsplit(url).hostname,
        'path':cookie.path,'httpOnly':True,'sameSite':'Strict'} for cookie in client.cookies])
    return ctx


def check_quality_browser(log,url,client,folder,receipt):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    output=Path(folder);output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as tooling:
        browser=tooling.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=open_as(browser,url,client)
        page=context.new_page()
        page.goto(url+'/?view=quality',wait_until='networkidle')
        card=page.locator('.service-queue-card').filter(has_text=receipt)
        card.click()
        log.check('browser hides checklist before physical receipt',lambda:browser_expect(page.locator('.service-test')).to_have_count(0))
        page.get_by_role('button',name='تأیید دریافت و شروع تست',exact=True).click()
        primary=page.get_by_role('group',name='آیا ایراد اصلی دستگاه برطرف شده است؟',exact=True)
        log.check('QC browser main test exposes pass and fail only',lambda:browser_expect(primary.get_by_role('button')).to_have_count(2))
        groups=page.get_by_role('group').filter(has=page.get_by_role('button',name='تأیید تست',exact=True))
        for test in groups.all():
            test.get_by_role('button',name='تأیید تست',exact=True).click()
        page.get_by_role('button',name='ثبت تست‌ها و ادامه',exact=True).click()
        log.check('QC browser shows result alone after tests',lambda:browser_expect(page.get_by_role('heading',name='نتیجه کنترل کیفیت',exact=True)).to_be_visible())
        page.reload(wait_until='networkidle')
        log.check('QC receipt and draft survive refresh',lambda:browser_expect(page.get_by_role('button',name='تأیید و ارجاع به مالی',exact=True)).to_be_enabled())
        log.check('QC result view has no editable test list',lambda:browser_expect(primary).to_have_count(0))
        page.get_by_role('button',name='بازگشت و اصلاح تست‌ها',exact=True).click()
        for width in (320,390,768,1440):
            page.set_viewport_size({'width':width,'height':900})
            log.check(f'QC detail fits {width}px',lambda:expect(page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'horizontal overflow'))
            if width in (390,1440):
                page.screenshot(path=str(output/f'qc-{width}.png'),full_page=True)
        browser.close()


def check_operations_browser(log,url,manager,tech,case,folder):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    output=Path(folder)
    with sync_playwright() as tooling:
        browser=tooling.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        ctx=open_as(browser,url,manager,width=1440)
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url+'/?view=assignments',wait_until='networkidle')
        log.check('standalone operations center is absent from desktop navigation',lambda:browser_expect(page.get_by_role('button',name='مرکز عملیات تعمیرات',exact=True)).to_have_count(0))
        page.get_by_role('button',name='سیاست‌های تعمیرگاه',exact=True).click()
        log.check('manager browser shows persisted referral setting',lambda:browser_expect(page.get_by_label('سیاست ارجاع',exact=True)).to_have_value('disabled'))
        page.get_by_role('button',name='پیگیری پرونده‌ها',exact=True).click()
        browser_expect(page.get_by_role('heading',name='پرونده‌های نیازمند پیگیری')).to_be_visible()
        page.get_by_role('button',name='عملکرد تکنسین‌ها',exact=True).click()
        page.get_by_role('button',name='دریافت گزارش',exact=True).click()
        log.check('manager browser loads verified metrics',lambda:browser_expect(page.locator('meter').first).to_be_visible())
        page.screenshot(path=str(output/'performance-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':900})
        log.check('manager performance fits mobile',lambda:expect(page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'horizontal overflow'))
        log.check('manager JS stays error-free',lambda:expect(not errors,str(errors)))
        tc=open_as(browser,url,tech)
        entry=tc.new_page()
        entry.goto(url+f'/?view=my-work&techCase={case}&techTask=purchases',wait_until='networkidle')
        log.check('technician browser sees authorized catalog',lambda:browser_expect(entry.get_by_label('انتخاب کالا')).to_contain_text('کابل آزمایشی'))
        entry.screenshot(path=str(output/'external-purchase-mobile.png'),full_page=True)
        browser.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    parser.add_argument('--admin-mobile',required=True)
    parser.add_argument('--report',required=True)
    parser.add_argument('--browser-dir')
    run(parser.parse_args())
