#!/usr/bin/env python3
"""Scoped visual, receipt and SMS checks. All endpoints and gateway fixtures are loopback."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import build_opener, ProxyHandler

from smoke import Client, Runner, expect, synthetic_imei
from v7_operations import open_as


WIDTHS = (360, 390, 768, 1024, 1280, 1440, 1920)
PAGES = {
    'home': ('نبض تعمیرگاه','.manager-pulse', 'button', 13),
    'assignments&assignmentTab=active': ('مدیریت ارجاع تعمیرات','.operations-board', '.service-queue-card',30),
    'technician-performance': ('عملکرد تکنسین‌ها','.manager-performance', '.manager-report-grid li',2),
    'repair-policy': ('سیاست‌های تعمیرگاه','.manager-policy-grid', 'select', 2),
    'inventory': ('انبار قطعات','.v2-stack', '.v2-table tbody tr',100),
    'parts-supply': ('درخواست‌های قطعات پرونده‌ها','.v2-stack', '.v2-table tbody tr',30),
    'hot-returns': ('تعهدات داغی','.v2-stack', '.v2-table tbody tr',2),
}


class Lab:
    def __init__(self, args):
        self.args=args
        self.root=Path(__file__).resolve().parent
        self.prefix='0967'+str(secrets.randbelow(90000)+10000)
        self.password='Test-Only!'+secrets.token_hex(13)
        self.marker='TEST-QUEUE-'+secrets.token_hex(5)
        self.admin=Client(args.url)
        self.admin.login(args.admin_mobile,os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])

    def shop(self,suffix,name):
        result=self.admin.api('admin.php','POST',{
            'name':self.marker+name,'repairType':'digital','managerName':'مدیر کارگاه آزمایشی',
            'managerMobile':self.prefix+suffix,'productProfile':'pro','inventoryMode':'pro','qcMode':'off',
            'modules':['repair','inventory','finance','sms'],'maxUsers':10,
            'expiresAt':(dt.date.today()+dt.timedelta(days=120)).isoformat(),'idempotencyKey':self.marker+name,
        })
        manager=Client(self.args.url)
        actor=manager.login(self.prefix+suffix,result['temporaryPassword'])
        manager.api('auth.php','POST',{'action':'change_initial_password','newPassword':self.password,'confirmation':self.password})
        manager.token()
        return manager,actor

    def user(self,suffix,role,owner):
        self.admin.api('admin-users.php','POST',{
            'shopId':owner['shop']['id'],'branchIds':[owner['branch']['id']],
            'displayName':'تکنسین آزمایشی '+self.marker,'mobile':self.prefix+suffix,'password':self.password,'role':role,
        })
        user=Client(self.args.url)
        actor=user.login(self.prefix+suffix,self.password)
        return user,actor

    def model(self,manager):
        manager.api('catalog.php','POST',{'type':'موبایل','brand':'آزمون','model':'TEST PHONE PRO'})
        return manager.api('catalog.php')['items'][0]['id']

    def case(self,manager,model,suffix='09',tech=None,**extra):
        return manager.api('operations.php','POST',{
            'action':'create_case','receiptMode':'issue_only','customerName':'مشتری مصنوعی آزمایش تمدید نمایشگر',
            'customerMobile':self.prefix+suffix,'deviceModelId':model,'imei':synthetic_imei(),
            'serialNumber':'TEST-SERIAL-'+secrets.token_hex(5),'declaredIssue':'آزمون کارکرد نمایشگر',
            'customerConsent':{'dataHandling':'no_erasure'},'preapprovedAmount':0,
            'assignedToUserId':tech,'assignmentMode':'automatic' if tech else 'queue',
            'idempotencyKey':secrets.token_hex(15),**extra,
        })['repairCase']

    def item(self,manager,code,title):
        manager.api('operations.php','POST',{'action':'create_inventory_item','code':code,'title':title,
            'category':'قطعات آزمایشی تعمیرگاه','physicalQuantity':5})
        return next(i['id'] for i in manager.api('inventory-v2.php?catalog=1')['items'] if i['item_code']==code)

    def sql(self,body):
        return subprocess.check_output([self.args.sql],input=body,text=True).strip()


def visual(args,lab,log):
    from playwright.sync_api import sync_playwright, expect as visible
    manager,owner=lab.shop('01','visual')
    empty,_=lab.shop('02','empty')
    _, technician=lab.user('03','technician',owner)
    model=lab.model(manager)
    base=lab.case(manager,model)
    item=lab.item(manager,'LONG-CODE-'+'0123456789ABCDEF'*4,'شرح طولانی قطعهٔ آزمایشی ' * 5)
    older=lab.item(manager,'TEST-OLDER','نمایشگر جایگزین')
    seeded=json.loads(subprocess.check_output(['docker','exec','-i',args.container,'php','--','/app',
        str(base['id']),str(technician['id']),str(item),str(older)],input=(lab.root/'operational_queue_fixture.php').read_bytes()))
    shop=int(owner['shop']['id'])
    lab.sql(f"""INSERT INTO repair_inventory_items(public_id,shop_id,item_code,title,category,hot_evidence_rules_json)
        SELECT LEFT(REPLACE(UUID(),'-',''),26),{shop},CONCAT('TEST-LIST-',seq),CONCAT('قطعهٔ فهرست آزمایشی ',seq),
        'فهرست آزمایشی','{{}}' FROM seq_1_to_105;""")
    measurements=[]
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        for stage,client in [('filled',manager),('empty',empty)]:
            with open_as(browser,args.url,client,390) as ctx:
                page=ctx.new_page()
                for path,(title,root,rows,min_rows) in PAGES.items():
                    page.goto(args.url+'/?view='+path,wait_until='networkidle')
                    visible(page.get_by_role('heading',name=title,exact=True).first).to_be_visible()
                    if path=='technician-performance':
                        page.get_by_role('button',name='دریافت گزارش',exact=True).click()
                        visible(page.locator('.manager-report-grid > li').first).to_be_visible()
                    area=page.locator(root).first
                    visible(area).to_be_visible()
                    if stage=='filled':
                        visible(area.locator(rows).nth(min_rows-1)).to_be_visible()
                    elif path.startswith('assignments') or path in ('inventory','parts-supply','hot-returns'):
                        words={'inventory':'قطعه‌ای در کاتالوگ', 'hot-returns':'تعهد داغی ثبت نشده',
                               'parts-supply':'نتیجه‌ای', 'assignments':'نتیجه‌ای'}
                        visible(page.get_by_text(words[path.split('&')[0]],exact=False).first).to_be_visible()
                    for width in WIDTHS:
                        page.set_viewport_size({'width':width,'height':960})
                        page.evaluate("""async () => {
                            const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
                            await frame();
                            await frame();
                            await Promise.all(document.getAnimations().filter(a =>
                                Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
                            await document.fonts.ready;
                            await frame();
                        }""")
                        m=area.evaluate("""(root) => {
                          const all = [...root.querySelectorAll('button,select,input,td,strong,small,h3,h4,p')];
                          const shown = all.filter(e => e.offsetWidth > 0 && e.offsetHeight > 0);
                          const rect = root.getBoundingClientRect();
                          const offenders = shown.filter(e => {
                            if (e.closest('.v2-table-wrap') && innerWidth >= 760) return false;
                            const r = e.getBoundingClientRect();
                            return r.left < -2 || r.right > innerWidth + 2;
                          });
                          const table = root.querySelector('.v2-table-wrap');
                          const visibleText = shown.filter(e=>e.matches('button,td,strong,small,p'));
                          return {rtl:getComputedStyle(root).direction, rootWidth:Math.round(rect.width),
                            viewport:innerWidth, overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
                            rootOverflow: Math.max(0,root.scrollWidth-root.clientWidth),
                            clipped:offenders.slice(0,6).map(e=>e.tagName+' '+e.textContent.trim().slice(0,90)),
                            denseRows: root.querySelectorAll('tbody tr,.service-queue-card,.manager-report-grid > li').length,
                            desktopTableScroll:table ? Math.max(0, table.scrollWidth-table.clientWidth):0,
                            minimumTextFont: visibleText.length ? Math.min(...visibleText.map(e=>parseFloat(getComputedStyle(e).fontSize))) : null,
                            minimumButtonHeight:shown.some(e=>e.tagName==='BUTTON')?Math.min(...shown.filter(e=>e.tagName==='BUTTON').map(e=>e.getBoundingClientRect().height)):null};
                        }""")
                        m.update(page=path,stage=stage,width=width)
                        measurements.append(m)
                        if stage=='filled' and (path,width) in (('inventory',360),('parts-supply',390),('technician-performance',1440)):
                            page.screenshot(path=str(args.output/f'{args.mode}-{path.split("&")[0]}-{width}.png'),animations='disabled')
                        if args.mode!='baseline':
                            expect(m['rtl']=='rtl' and m['overflow']<=1 and m['rootOverflow']<=1 and not m['clipped'],str(m))
                            if path in ('inventory','parts-supply','hot-returns'):
                                expect(m['desktopTableScroll']<=1,str(m))
                    print('PASS measured',stage,title,flush=True)
        if args.mode=='verified':
            with browser.new_context(viewport={'width':1440,'height':960}) as reference:
                page=reference.new_page()
                prototype_path=lab.root.parents[1]/'references/tamiran-prototype-v7.html'
                prototype_url='http://127.0.0.1/tamiran-prototype-v7.html'
                page.route(prototype_url,lambda route:route.fulfill(path=prototype_path,content_type='text/html; charset=utf-8'))
                page.goto(prototype_url)
                prototype={}
                for path in ('home','performance','settings','stock','catalog'):
                    if path=='catalog':
                        page.evaluate("switchRole('stock')")
                    page.evaluate('(path) => go(path)',path)
                    prototype[path]=page.locator('h1').first.inner_text()
                    if path=='performance':
                        page.screenshot(path=str(args.output/'v7-performance-1440.png'),animations='disabled')
                (args.output/'prototype-views.json').write_text(json.dumps(prototype,ensure_ascii=False,indent=2)+'\n')
        browser.close()
    (args.output/f'{args.mode}-visual.json').write_text(json.dumps(measurements,indent=2,ensure_ascii=False)+'\n')
    log.check('all 98 responsive page and dataset combinations were measured',lambda:expect(len(measurements)==98,'missing viewport'))
    log.metadata['seededCases']=len(seeded['records'])+1


def run(args):
    assert urlsplit(args.url).hostname in ('localhost','127.0.0.1','::1')
    args.output.mkdir(parents=True,exist_ok=True)
    log=Runner(args.output/f'{args.mode}-{args.suite}-results.json')
    lab=Lab(args)
    {'visual':visual,'sms':sms,'receipt':receipt}[args.suite](args,lab,log)
    log.save()


def sms(args,lab,log):
    assert urlsplit(args.gateway).hostname=='127.0.0.1'
    gateway=build_opener(ProxyHandler({}))
    def provider(path='/state'):
        return json.load(gateway.open(args.gateway+path,timeout=3))

    manager,owner=lab.shop('01','sms')
    tech,actor=lab.user('03','technician',owner)
    model=lab.model(manager)
    item=lab.item(manager,'SMS-TEST-PART','قطعهٔ آزمون مجوز')
    manager.api('sms-v2.php','POST',{'action':'configure','providerCode':'kavenegar',
        'apiKey':'FakeTestKey123456789','displayName':'ارائه‌دهنده کنترل‌شده',
        'settings':{'otpTemplate':'tamiran-local-test'}})
    policy=manager.api('workflow-v2.php')['operationsPolicy']
    def save_policy(approval):
        manager.api('settings.php','PATCH',{'key':'operations_policy','value':{**policy,'approval':approval,'purchase':'free'}})
    save_policy('sms')
    customer=Client(args.url)

    def row(case):
        return manager.api(f"workflow-v2.php?caseId={case['id']}")['cases'][0]

    def action(client,case,command,expected=200,**fields):
        return client.api('workflow-v2.php','POST',{'action':command,'caseId':case['id'],
            'lockVersion':row(case)['lockVersion'],'idempotencyKey':secrets.token_hex(16),**fields},expected=expected)

    def estimate(case,amount,valid_until=None):
        choice=action(tech,case,'estimate_create',items=[{'type':'labor','title':'آزمون مبلغ','quantity':1,'unitPrice':amount}],
            **({'validUntil':valid_until} if valid_until else {}))['estimate']
        action(tech,case,'estimate_send',estimatePublicId=choice['publicId'])
        return choice['publicId']

    def new_case(suffix):
        case=lab.case(manager,model,suffix,actor['id'])
        action(tech,case,'technical_receive')
        return case

    def token(case):
        return manager.api('portal-v2.php','POST',{'action':'create_link','caseId':case['id']})['token']

    def otp_request(subject, suffix, portal=None, expected=200):
        before=provider()['calls']
        params={'action':'otp_request','purpose':'estimate','subjectPublicId':subject}
        target='portal-v2.php' if portal else 'sms-v2.php'
        client=customer if portal else manager
        result=client.api(target,'POST',{**params,**({'token':portal} if portal else {})},expected=expected)
        last=provider()
        if expected==200:
            expect(last['calls']==before+1 and last['recipient']==lab.prefix+suffix and 'otpCode' not in result,'transport or recipient incorrect')
            return result['requestId'],last['code']
        if expected in (404,409):
            expect(last['calls']==before,'invalid subject generated an SMS')
        return result

    def decide(subject, pair, portal=None, expected=200, choice='approved'):
        params={'action':'estimate_decide','decision':choice,'estimatePublicId':subject,
            'otpRequestId':pair[0],'otpCode':pair[1]}
        if portal:
            return customer.api('portal-v2.php','POST',{**params,'token':portal},expected=expected)
        return manager.api('workflow-v2.php','POST',{**params,'channel':'sms_otp'},expected=expected)

    def blocked(case):
        action(tech,case,'transition',409,target='repairing')
        action(tech,case,'external_purchase',409,decision='request',purchase=True,
            lines=[{'itemId':item,'quantity':1,'unitCost':100000}])

    case=new_case('09')
    old=estimate(case,900000)
    action(tech,case,'transition',target='awaiting_customer_approval')
    code_old=otp_request(old,'09')
    current=estimate(case,1500000)
    key=token(case)
    log.check('phone approval cannot substitute for SMS under SMS-only policy',lambda:
        manager.api('workflow-v2.php','POST',{'action':'estimate_decide','estimatePublicId':current,
            'decision':'approved','channel':'recorded_phone'},expected=409))
    log.check('purchase and repair wait for authorization of the new amount',lambda:blocked(case))
    log.check('staff cannot issue an OTP for the superseded revision',lambda:otp_request(old,'09',expected=404))
    log.check('assignment alone cannot authorize staff OTP sending',lambda:
        tech.api('sms-v2.php','POST',{'action':'otp_request','purpose':'estimate','subjectPublicId':current},expected=403))
    code_new=otp_request(current,'09')
    log.check('OTP bound to old revision cannot confirm newer amount',lambda:decide(current,code_old,expected=403))
    log.check('superseded estimate cannot be confirmed with its previous OTP',lambda:decide(old,code_old,expected=409))
    wrong='000000'
    log.check('incorrect OTP is rejected',lambda:decide(current,(code_new[0],wrong),expected=403))
    approval=log.check('staff records valid OTP decision on the current revision',lambda:decide(current,code_new))
    log.check('already consumed OTP cannot be replayed',lambda:decide(current,code_new,expected=403))
    log.check('approval is recorded with channel, attempts and immutable audit history',lambda:expect(
        approval['approval']['decided'] and lab.sql(f"""SELECT COUNT(*) FROM repair_estimate_approvals a
        JOIN repair_estimates e ON e.id=a.estimate_id JOIN tamiran_sms_otps o ON o.public_id=a.otp_request_id
        WHERE e.public_id='{current}' AND e.status='approved' AND a.channel='sms_otp' AND o.attempts=2 AND o.consumed_at IS NOT NULL;""")=='1'
        and lab.sql(f"SELECT COUNT(*) FROM tamiran_audit_log WHERE action_code='estimate.decision' AND entity_public_id='{current}';")=='1',
        'approval or OTP audit missing'))
    action(tech,case,'transition',target='repairing')
    log.check('approved quote permits the authorized repair and purchase',lambda:expect(
        action(tech,case,'external_purchase',decision='request',purchase=True,
            lines=[{'itemId':item,'quantity':1,'unitCost':100000}])['status']=='bought','purchase still blocked'))

    portal_case=new_case('07')
    portal_old=estimate(portal_case,1700000)
    portal_key=token(portal_case)
    portal_old_code=otp_request(portal_old,'07',portal=portal_key)
    portal_estimate=estimate(portal_case,2200000)
    log.check('portal refuses an older estimate even when its original code is correct',lambda:
        decide(portal_old,portal_old_code,portal_key,409))
    if args.mode=='baseline':
        # Reproduce the missing validation against the unchanged baseline.
        otp_request(portal_old,'07',portal=portal_key)
        otp_request(portal_estimate,'09',portal=key)
        log.metadata['defects']=['portal sends OTP for superseded quote','portal sends OTP for quote of a different case']
    else:
        log.check('portal rejects obsolete or foreign-case OTP requests before transport',lambda:(
            otp_request(portal_old,'07',portal=portal_key,expected=404),otp_request(portal_estimate,'09',portal=key,expected=404)))
    portal_code=otp_request(portal_estimate,'07',portal=portal_key)
    log.check('portal cannot apply a code to a different case or estimate',lambda:
        decide(portal_estimate,portal_code,key,403))
    lab.sql(f"UPDATE tamiran_sms_otps SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE public_id='{portal_code[0]}';")
    log.check('expired OTP cannot approve a quotation',lambda:decide(portal_estimate,portal_code,portal_key,403))
    new_code=otp_request(portal_estimate,'07',portal=portal_key)
    log.check('secure portal confirms only the current quote and records consent once',lambda:expect(
        decide(portal_estimate,new_code,portal_key)['decided'] and
        lab.sql(f"""SELECT COUNT(*) FROM repair_portal_actions WHERE subject_public_id='{portal_estimate}'
            AND action_type='estimate_approved' AND otp_request_id='{new_code[0]}';""")=='1','portal evidence missing'))
    log.check('secure portal replay is rejected',lambda:decide(portal_estimate,new_code,portal_key,403))
    action(tech,portal_case,'transition',target='repairing')
    raised=estimate(portal_case,2900000)
    if args.mode!='baseline':
        def higher_amount_blocks_completion():
            expect(row(portal_case)['latestEstimate']['publicId']==raised,'wrong current quote')
            error=action(tech,portal_case,'technical_finish',409,result='repaired',report='TEST final check')
            expect('مجوز هزینه' in error['error']['message'],'completion blocked for the wrong reason')
            action(tech,portal_case,'external_purchase',409,decision='request',purchase=True,
                lines=[{'itemId':item,'quantity':1,'unitCost':100000}])
        log.check('increasing an already approved amount blocks costly completion and buying',higher_amount_blocks_completion)

    bad_case=new_case('06')
    bad_subject=estimate(bad_case,2200000)
    bad_token=token(bad_case)
    save_policy('phone')
    if args.mode=='baseline':
        phone_code=otp_request(bad_subject,'06',portal=bad_token)
        decide(bad_subject,phone_code,bad_token)
        log.metadata['defects'].append('secure portal accepts SMS authorization under phone-only policy')
        return
    log.check('portal respects phone-only policy before contacting the provider',lambda:
        otp_request(bad_subject,'06',portal=bad_token,expected=409))
    save_policy('sms')
    provider('/reject-next')
    log.check('portal provider failure leaves no active OTP',lambda:(
        otp_request(bad_subject,'06',portal=bad_token,expected=503),
        expect(lab.sql(f'''SELECT attempts=max_attempts FROM tamiran_sms_otps
            WHERE subject_public_id='{bad_subject}' ORDER BY id DESC LIMIT 1;''')=='1','portal failed code still usable')))
    evidence=otp_request(bad_subject,'06',portal=bad_token)
    save_policy('phone')
    log.check('switching to phone-only blocks even a previously issued portal OTP',lambda:
        decide(bad_subject,evidence,bad_token,409))
    save_policy('sms')
    lab.sql(f"UPDATE repair_portal_tokens SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE case_id={int(bad_case['id'])};")
    log.check('expired portal link cannot view or approve',lambda:(
        customer.api('portal-v2.php?'+urlencode({'token':bad_token}),expected=404),
        decide(bad_subject,evidence,bad_token,404)))
    provider('/reject-next')
    log.check('provider error does not leave an active SMS code',lambda:(
        otp_request(bad_subject,'06',expected=503),expect(lab.sql(f"""SELECT attempts=max_attempts FROM tamiran_sms_otps
        WHERE subject_public_id='{bad_subject}' ORDER BY id DESC LIMIT 1;""")=='1','failed code active')))
    quote=new_case('05')
    subject=estimate(quote,2500000)
    quote_code=otp_request(subject,'05')
    quote_key=token(quote)
    lab.sql(f"UPDATE repair_estimates SET valid_until=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE public_id='{subject}';")
    log.check('an expired estimate cannot receive or use a current authorization code',lambda:(
        otp_request(subject,'05',expected=404),otp_request(subject,'05',portal=quote_key,expected=404),
        decide(subject,quote_code,expected=409),blocked(quote)))
    log.metadata['gateway']='Real PHP cURL and TLS against local synthetic provider. No carrier or external vendor contacted.'


def receipt(args,lab,log):
    from PIL import Image
    import zxingcpp
    from playwright.sync_api import sync_playwright, expect as visible
    manager,_=lab.shop('01','receipt')
    model=lab.model(manager)
    issue='عیب آزمایشی نمایشگر و اتصال سیم‌کارت'
    many=[f'ITEM{i:02} {issue} ' + ('توضیح پیوست آزمون چاپ و نمایش متن طولانی '*4)
          for i in range(1,16)]
    normal=lab.case(manager,model,declaredIssues=[issue])
    long=lab.case(manager,model,declaredIssues=many,receiptNotes='شرح مشتری برای آزمون متن طولانی '*22+' LONGENDTEST',
        receptionNotes='INTERNALONLYTEST',devicePassword='SECRET-TEST-PIN',customerAddress='نشانی مصنوعی برای بررسی شکست سطر '*8)
    def dimensions(file):
        info=subprocess.check_output(['pdfinfo',str(file)],text=True)
        return (int(re.search(r'Pages:\s+(\d+)',info)[1]),
            *(float(x) for x in re.search(r'Page size:\s+([\d.]+) x ([\d.]+)',info).groups()))
    reference=dimensions(args.reference)
    log.check('approved reference PDF has physical A4 dimensions',lambda:expect(
        reference[0]==1 and abs(reference[1]-595.28)<1 and abs(reference[2]-841.89)<1,'reference dimensions'))
    summary={}
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        with open_as(browser,args.url,manager,1440) as ctx:
            page=ctx.new_page()
            for name,case,size in [('receipt-a4',normal,'A4'),('receipt-a4-long',long,'A4'),('receipt-a5',normal,'A5'),
                                   ('receipt-thermal',normal,'حرارتی')]:
                manager.api('settings.php','PATCH',{'key':'receipt_template','value':{
                    'printSize':size,'shopAddress':'نشانی آزمایشی چاپ رسید','phone':'۰۲۱۰۰۰۰۰۰۰۰'}})
                page.goto(args.url+'/?view=receipts',wait_until='networkidle')
                page.get_by_role('button',name=f"مشاهده رسید {case['receiptNumber']}",exact=True).click()
                doc=page.locator('.tamiran-receipt')
                visible(doc).to_have_attribute('data-print-size',size)
                if name=='receipt-a4':
                    expect(all(label in doc.inner_text() for label in ('قبض پذیرش تعمیرات','اطلاعات مالی پذیرش','قوانین و شرایط','امضا')),
                        'sections from approved receipt missing')
                page.evaluate("""() => {
                   const real = window.open.bind(window);
                   window.open = (...args) => { const popup=real(...args); if (popup) popup.print=()=>{}; return popup; };
                }""")
                with page.expect_popup() as waiting:
                    page.get_by_role('button',name='چاپ رسید',exact=True).click()
                paper=waiting.value
                visible(paper.locator('.tamiran-receipt')).to_contain_text(case['receiptNumber'])
                paper.evaluate('document.fonts.ready')
                pdf=args.output/(name+'.pdf')
                paper.pdf(path=str(pdf),prefer_css_page_size=True,print_background=True)
                paper.close()
                pages,w,h=dimensions(pdf)
                fonts=subprocess.check_output(['pdffonts',str(pdf)],text=True)
                expect(any('Vazirmatn' in line and 'yes' in line for line in fonts.splitlines()),'embedded Persian font missing')
                if size=='A4':
                    expect(abs(w-reference[1])<1 and abs(h-reference[2])<1,'A4 dimensions differ from approved sample')
                elif size=='A5':
                    expect(abs(w-419.53)<1 and abs(h-595.28)<1,'A5 dimensions incorrect')
                else:
                    expect(abs(w-226.77)<2,'80 mm roll width incorrect')
                text=subprocess.check_output(['pdftotext',str(pdf),'-'],text=True)
                expect('SECRET-TEST-PIN' not in text and 'INTERNALONLYTEST' not in text,'private intake fields printed')
                if name=='receipt-a4-long':
                    expect(all(f'ITEM{i:02}' in text for i in range(1,16)) and 'LONGENDTEST' in text,'long receipt text lost across pages')
                png=args.output/name
                subprocess.run(['pdftoppm','-f','1','-l','1','-r','175','-png','-singlefile',str(pdf),str(png)],check=True)
                qr=zxingcpp.read_barcode(Image.open(str(png)+'.png'),formats=zxingcpp.BarcodeFormat.QRCode)
                expect(qr is not None,'QR not scannable from rasterized PDF')
                scanned=urlsplit(qr.text)
                expect(scanned.hostname=='127.0.0.1' and scanned.port==urlsplit(args.url).port,'QR escaped local test')
                portal=parse_qs(scanned.query)['portal'][0]
                Client(args.url).api('portal-v2.php?'+urlencode({'token':portal}))
                summary[name]={'pages':pages,'points':[w,h],'embeddedPersianFont':True,'qrDecodedAndOpened':True}
                log.check('physical dimensions, font and QR for '+name,lambda:True)
        browser.close()
    (args.output/'receipt-measurements.json').write_text(json.dumps(summary,indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('suite',choices=('sms','visual','receipt'))
    parser.add_argument('--mode',choices=('baseline','verified'),default='verified')
    parser.add_argument('--url',required=True)
    parser.add_argument('--sql',required=True)
    parser.add_argument('--container',required=True)
    parser.add_argument('--admin-mobile',required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--reference',type=Path,required=True)
    parser.add_argument('--gateway',default='http://127.0.0.1:9357')
    run(parser.parse_args())
