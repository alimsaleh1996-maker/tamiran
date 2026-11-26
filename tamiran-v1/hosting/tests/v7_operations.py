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
    for index, role in enumerate(('technician','technician','quality_control'), 2):
        mobile = prefix + f'{index:02}'
        admin.api('admin-users.php','POST',{'shopId':owner['shop']['id'], 'branchIds':[owner['branch']['id']],
            'displayName':marker + role + str(index),'mobile':mobile,'password':password,'role':role})
        client = Client(args.url)
        ids.append(client.login(mobile, password)['id'])
        clients.append(client)
    tech, destination, inspector = clients
    technician, recipient, _ = ids
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
            'customerConsent':{'dataHandling':'coordinate_first'},'assignedToUserId':technician,
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
        check_quality_browser(log,args.url,inspector,args.browser_dir)
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
    if args.browser_dir:
        check_operations_browser(log,args.url,manager,tech,stock_case,args.browser_dir)
    log.save()


def open_as(browser, url, client, width=390):
    ctx=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
    ctx.add_cookies([{'name':cookie.name,'value':cookie.value,'domain':urlsplit(url).hostname,
        'path':cookie.path,'httpOnly':True,'sameSite':'Strict'} for cookie in client.cookies])
    return ctx


def check_quality_browser(log,url,client,folder):
    from playwright.sync_api import sync_playwright, expect as browser_expect
    output=Path(folder);output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as tooling:
        browser=tooling.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=open_as(browser,url,client)
        page=context.new_page()
        page.goto(url+'/?view=quality',wait_until='networkidle')
        card=page.locator('.v2-queue-card').first
        card.click()
        log.check('browser hides checklist before physical receipt',lambda:browser_expect(page.locator('.v2-qc-test-item')).to_have_count(0))
        page.get_by_role('button',name='تأیید دریافت و شروع تست',exact=True).click()
        primary=page.locator('.v2-qc-test-item').filter(has_text='آیا ایراد اصلی دستگاه برطرف شده است؟')
        log.check('QC browser main test exposes pass and fail only',lambda:browser_expect(primary.locator('option')).to_have_count(3))
        page.screenshot(path=str(output/'qc-mobile.png'),full_page=True)
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
        page.goto(url+'/?view=operations',wait_until='networkidle')
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
