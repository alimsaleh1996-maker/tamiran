#!/usr/bin/env python3
"""Loopback-only real PHP/browser regressions for the UI UX review findings."""
import argparse, datetime as dt, json, os, secrets, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect as pw_expect
from smoke import Client, expect, svg_captcha


def run(a):
    host=urllib.parse.urlsplit(a.url)
    expect(host.scheme=='http' and host.hostname in ('127.0.0.1','localhost','::1'),'literal loopback required')
    out=Path(a.output);out.mkdir(parents=True,exist_ok=True);results=[];errors=[]
    def save():
        (out/'ui-browser-results.json').write_text(json.dumps({'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'results':results,'page_errors':errors,'limits':['Synthetic local PHP/MariaDB; no hosted SSL/Apache or formal screen-reader session']},ensure_ascii=False,indent=2)+'\n')
    def check(name,fn):
        try: value=fn()
        except Exception as e: results.append({'name':name,'status':'FAIL','error':str(e)});save();raise
        results.append({'name':name,'status':'PASS'});save();print('PASS '+name,flush=True);return value
    admin=Client(a.url);admin.login(a.admin_mobile,os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    marker='TEST-TAMIRAN-A11Y-'+secrets.token_hex(4).upper();mobile='09999'+str(secrets.randbelow(1000000)).zfill(6)
    shop=admin.api('admin.php','POST',{'name':'آزمایشی — بررسی اصلاح رابط','repairType':'digital','managerName':'آزمایشی — مدیر بررسی','managerMobile':mobile,'branchName':'شعبه آزمایشی','expiresAt':(dt.date.today()+dt.timedelta(days=365)).isoformat(),'productProfile':'pro','modules':['repair','finance','inventory','customer_portal'],'inventoryMode':'simple','qcMode':'off','maxUsers':12,'idempotencyKey':marker})
    manager=Client(a.url);manager.login(mobile,shop['temporaryPassword']);pw='TEST-A11Y!'+secrets.token_hex(12)
    manager.api('auth.php','POST',{'action':'change_initial_password','newPassword':pw,'confirmation':pw});manager.token()
    catalog=manager.api('catalog.php','POST',{'type':'موبایل','brand':marker,'model':marker+'-MODEL'})
    model=next(x['id'] for x in catalog['items'] if x['model']==marker+'-MODEL')
    manager.api('settings.php','PATCH',{'receiptTerms':{'title':marker,'body':'متن آزمایشی برای بررسی رابط.'}})
    terms=manager.api('settings.php')['activeReceiptTerms']
    manager.api('operations.php','POST',{'action':'create_case','customerName':'آزمایشی — پرونده رابط','customerMobile':'09998765431','deviceModelId':model,'identifier':marker+'-SERIAL','declaredIssue':'بررسی رابط','customerConsent':{'dataHandling':'no_erasure'},'assignmentMode':'queue','idempotencyKey':marker+'-CASE','receiptAcceptance':{'accepted':True,'publicId':terms['public_id'],'contentSha256':terms['content_sha256']}})
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True,args=['--no-sandbox']);c=b.new_context(viewport={'width':1440,'height':1000});page=c.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(a.url,wait_until='networkidle');page.locator('.captcha-control img').wait_for()
        check('CAPTCHA input has its visible accessible label',lambda:expect(page.get_by_label('عبارت امنیتی',exact=True).get_attribute('id')=='login-captcha-answer','label missing'))
        check('Native Persian audio control is available',lambda:expect(page.locator('audio[controls]').count()==1,'audio controls missing'))
        audio=page.evaluate('''async()=>{const d=await(await fetch(document.querySelector('audio').src)).arrayBuffer();const c=new AudioContext();const b=await c.decodeAudioData(d);await c.close();return{duration:b.duration,channels:b.numberOfChannels}}''')
        check('Actual CAPTCHA audio decodes in browser',lambda:expect(audio['duration']>1 and audio['channels']==1,'invalid audio'))
        for width,height in [(375,812),(768,1024),(812,375)]:
            page.set_viewport_size({'width':width,'height':height});check(f'Login audio layout has no horizontal overflow{width}x{height}',lambda:expect(not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),'login audio overflow'))
        page.set_viewport_size({'width':375,'height':812});page.screenshot(path=str(out/'login-audio-mobile.png'),full_page=True);page.set_viewport_size({'width':1440,'height':1000})
        image=page.locator('.captcha-control img')
        digits=svg_captcha(page.request.get(a.url+image.get_attribute('src')).body())
        page.get_by_placeholder('09xxxxxxxxx',exact=True).fill(a.admin_mobile);page.locator('input[type=password]').fill(os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD']);page.get_by_label('عبارت امنیتی',exact=True).fill(digits)
        page.get_by_role('button',name='ورود به سامانه',exact=True).click();create=page.get_by_role('button',name='ایجاد تعمیرگاه جدید',exact=True);create.wait_for();create.click();admin_dialog=page.get_by_role('dialog')
        check('Central admin dialog focuses inside',lambda:expect(admin_dialog.evaluate('x=>x.contains(document.activeElement)'),'admin dialog focus'))
        date=admin_dialog.locator('.persian-date-trigger').first
        if date.count():
            date.click();popup=page.locator('.persian-date-popup');popup.wait_for();popup.locator('button').first.focus()
            check('Owned calendar portal remains keyboard reachable',lambda:expect(popup.evaluate('x=>x.contains(document.activeElement)'),'calendar blocked by parent trap'))
            page.keyboard.press('Escape');popup.wait_for(state='detached')
            check('First Escape closes calendar and returns its trigger',lambda:expect(admin_dialog.count()==1 and date.evaluate('x=>x===document.activeElement'),'calendar Escape closed parent or lost focus'))
        page.keyboard.press('Escape');check('Admin dialog closes and restores opener',lambda:(pw_expect(create).to_be_focused(timeout=2000),expect(admin_dialog.count()==0,'admin dialog still open')))
        c.clear_cookies();c.add_cookies([{'name':x.name,'value':x.value,'domain':host.hostname,'path':x.path,'httpOnly':True,'secure':False,'sameSite':'Strict'} for x in manager.cookies])
        page.goto(a.url,wait_until='networkidle');page.locator('.stats-grid').wait_for()
        audit=Path(__file__).with_name('contrast-audit.js').read_text()
        check('Visible dashboard text meets minimum contrast',lambda:expect(not page.evaluate(audit),str(page.evaluate(audit))))
        check('Real one-case statistic is shown',lambda:expect(page.locator('.stat-card strong').first.inner_text()=='۱','wrong baseline'))
        page.screenshot(path=str(out/'dashboard-readable.png'),full_page=True)
        page.route('**/api/operations.php*',lambda r:r.abort())
        with page.expect_response(lambda r:'/api/client-error.php' in r.url and r.request.method=='POST') as diagnostic:
            page.reload(wait_until='networkidle')
        check('Browser reports failed operations request',lambda:expect(diagnostic.value.status==200,'browser diagnostic failed'))
        check('Initial API failure never renders false zero statistics',lambda:expect(page.locator('.stats-grid').count()==0 and page.locator('.operational-error').count()==1,'error looks empty'))
        def visible_diagnostic_reference():
            import re
            match = re.search(r'UI-[A-F0-9]{24}', page.locator('.operational-error').inner_text())
            expect(match is not None, 'diagnostic reference missing from error')
            log = Path(__file__).resolve().parents[1] / 'private' / 'logs' / ('tamiran-' + dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d') + '.log')
            rows = [json.loads(line) for line in log.read_text().splitlines() if match.group() in line]
            expect(any(row.get('event') == 'client_runtime_error' and row.get('context', {}).get('kind') == 'operation_failure' for row in rows), 'visible reference has no corresponding diagnostic')
        check('Visible operational error has a matching private diagnostic', visible_diagnostic_reference)
        check('Persistent retry is available',lambda:expect(page.get_by_role('button',name='تلاش مجدد',exact=True).is_enabled(),'retry missing'))
        page.screenshot(path=str(out/'initial-load-error.png'),full_page=True)
        page.unroute('**/api/operations.php*');page.get_by_role('button',name='تلاش مجدد',exact=True).click();page.locator('.stats-grid').wait_for()
        check('Retry restores data without reload',lambda:expect(page.locator('.stat-card strong').first.inner_text()=='۱' and page.locator('.operational-error').count()==0,'retry failed'))
        page.route('**/api/operations.php*',lambda r:r.abort());page.get_by_role('button',name='نبض تعمیرگاه',exact=True).click();page.locator('.operational-error').wait_for()
        check('Refresh error preserves and labels last valid data',lambda:expect(page.locator('.stat-card strong').first.inner_text()=='۱' and 'آخرین اطلاعات' in page.locator('.operational-error').inner_text(),'stale data not preserved/labeled'))
        page.unroute('**/api/operations.php*');page.get_by_role('button',name='تلاش مجدد',exact=True).click();page.wait_for_timeout(250)
        page.goto(a.url,wait_until='networkidle');page.get_by_role('button',name='پذیرش تعمیرات',exact=True).click();page.go_back(wait_until='networkidle')
        check('First Back returns to dashboard',lambda:expect(page.locator('h1').inner_text()=='نبض تعمیرگاه','Back ignored bare URL'))
        page.go_forward(wait_until='networkidle');check('Forward restores reception',lambda:expect(page.locator('h1').inner_text()=='پذیرش تعمیرات','Forward failed'))
        check('Visible reception text meets minimum contrast',lambda:expect(not page.evaluate(audit),str(page.evaluate(audit))))
        opener=page.get_by_role('button',name='افزودن یا ویرایش آدرس',exact=True);opener.click();dialog=page.get_by_role('dialog',name='آدرس مشتری')
        check('Opening dialog moves focus inside',lambda:expect(dialog.evaluate('x=>x.contains(document.activeElement)'),'focus outside dialog'))
        for _ in range(12):
            page.keyboard.press('Tab');expect(dialog.evaluate('x=>x.contains(document.activeElement)'),'Tab escaped dialog')
        page.keyboard.press('Shift+Tab');check('Dialog traps forward and reverse Tab',lambda:expect(dialog.evaluate('x=>x.contains(document.activeElement)'),'reverse Tab escaped'))
        page.keyboard.press('Escape');check('Dialog Escape closes and restores opener',lambda:expect(dialog.count()==0 and opener.evaluate('x=>x===document.activeElement'),'dialog close/restore failed'))
        page.set_viewport_size({'width':375,'height':812});menu=page.locator('button[aria-controls=workspace-navigation]');menu.click();drawer=page.get_by_role('dialog',name='منوی اصلی',exact=True)
        check('Drawer announces expansion and focuses inside',lambda:expect(menu.get_attribute('aria-expanded')=='true' and drawer.evaluate('x=>x.contains(document.activeElement)'),'drawer semantics/focus'))
        for _ in range(14):
            page.keyboard.press('Tab');expect(drawer.evaluate('x=>x.contains(document.activeElement)'),'Tab escaped drawer')
        check('Drawer background is inert',lambda:expect(page.locator('.workspace').evaluate('x=>x.inert'),'background active'))
        page.keyboard.press('Escape');check('Drawer Escape restores opener',lambda:expect(menu.get_attribute('aria-expanded')=='false' and menu.evaluate('x=>x===document.activeElement'),'drawer restore failed'))
        menu.click();page.locator('.sidebar-backdrop').click(position={'x':2,'y':2},force=True)
        check('Pointer backdrop dismissal remains functional',lambda:expect(menu.get_attribute('aria-expanded')=='false','backdrop blocked'))
        page.set_viewport_size({'width':1440,'height':1000});check('Desktop sidebar is not left inert',lambda:expect(not page.locator('.sidebar').evaluate('x=>x.inert'),'desktop navigation blocked'))
        page.get_by_placeholder('09xxxxxxxxx',exact=True).fill('09998765432');page.wait_for_timeout(350);page.locator('.customer-first-grid input').nth(1).fill('آزمایشی — مشتری کیبورد');page.get_by_role('button',name='ثبت مرحله و ادامه',exact=True).click()
        combo=page.locator('input[role=combobox]');combo.fill(marker);combo.press('ArrowDown')
        check('Combobox exposes active option',lambda:expect(bool(combo.get_attribute('aria-activedescendant')),'no active option'))
        combo.press('Enter');check('Enter selects product and retains focus',lambda:expect(marker+'-MODEL' in combo.input_value() and combo.get_attribute('aria-expanded')=='false' and combo.evaluate('x=>x===document.activeElement'),'keyboard selection failed'))
        combo.press('ArrowDown');combo.press('Escape');check('Combobox Escape closes its list',lambda:expect(combo.get_attribute('aria-expanded')=='false','Escape failed'))
        combo.press('ArrowDown');combo.press('Tab');check('Tab moves on without BODY focus',lambda:expect(page.evaluate('document.activeElement.tagName')!='BODY','focus lost'))
        for width,height in [(375,812),(768,1024),(812,375)]:
            page.set_viewport_size({'width':width,'height':height});check(f'No horizontal overflow{width}x{height}',lambda:expect(not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),'horizontal overflow'))
        page.screenshot(path=str(out/'reception-landscape.png'),full_page=True);page.set_viewport_size({'width':375,'height':812});page.screenshot(path=str(out/'reception-mobile.png'),full_page=True);check('No JavaScript page errors',lambda:expect(not errors,str(errors)));b.close()
    save();print('SUMMARY',len(results),'UI checks pass',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:8085');p.add_argument('--admin-mobile',default='09120000000');p.add_argument('--output',default='/workspace/scratch/tamiran-ui-fixes');run(p.parse_args())
