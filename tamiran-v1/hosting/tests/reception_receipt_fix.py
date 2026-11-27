"""Focused rc.19/rc.20 reception and print comparison in an isolated local app."""
import argparse
import json
from pathlib import Path
import re
import secrets
from urllib.parse import parse_qs, urlencode, urlsplit

from playwright.sync_api import expect, sync_playwright

from smoke import Client, synthetic_imei
from stabilization_04 import Lab
from v7_operations import open_as


def run(args):
    assert urlsplit(args.url).hostname in ('localhost', '127.0.0.1')
    before = args.phase == 'before'
    args.output.mkdir(parents=True, exist_ok=True)
    lab = Lab(args)
    manager, owner = lab.shop('01', 'receipt-fix')
    tech, technician = lab.user('02', 'technician', owner)
    model = lab.model(manager)
    manager.api('settings.php','PATCH',{'key':'receipt_template','value':{'printSize':'A4'}})
    phone = lab.prefix + '09'
    imei = synthetic_imei()
    serial = 'FIX-TEST-SERIAL-008'
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        ctx = open_as(browser, args.url, manager, 1440)
        page = ctx.new_page()
        if not before:
            page.goto(args.url + '/?view=settings', wait_until='networkidle')
            page.get_by_role('button', name='فرم‌های صنفی').click()
            panel = page.locator('section').filter(has=page.get_by_role('heading',name='ایرادات پیش‌فرض',exact=True)).last
            panel.get_by_role('textbox',name='نوع ایراد جدید').fill('آزمون اتصال')
            panel.get_by_role('button',name='افزودن نوع ایراد').click()
            panel.get_by_role('textbox',name='نوع ایراد 7',exact=True).fill('اتصال آزمایشی')
            panel.get_by_role('button',name='انتقال ایراد 7 به بالا').click()
            panel.get_by_role('checkbox',name='فعال',exact=True).nth(6).uncheck()
            with page.expect_response(lambda res:'/api/settings.php' in res.url and res.request.method=='PATCH') as response:
                page.get_by_role('button',name='ذخیره قواعد فرم').click()
            assert response.value.ok
            stored=manager.api('settings.php')['settings']['service_forms']['defaultIssues']
            assert stored[-2]['label']=='اتصال آزمایشی' and not stored[-1]['enabled']
            panel.screenshot(path=str(args.output/'after-settings.png'))
        page.goto(args.url + '/?view=reception', wait_until='networkidle')
        page.get_by_placeholder('09xxxxxxxxx',exact=True).fill(phone)
        page.get_by_placeholder('نام کامل مشتری',exact=True).fill('مشتری مصنوعی پذیرش')
        page.get_by_role('button',name='ادامه',exact=True).click()
        grid = page.locator('.reception-device-grid')
        expect(grid).to_be_visible()
        page.get_by_role('combobox',name=re.compile('نوع محصول')).fill('TEST PHONE PRO')
        page.get_by_role('option',name=re.compile('TEST PHONE PRO')).click()
        grid.get_by_label('رنگ دستگاه').select_option(index=1)
        grid.locator('#reception-device-identifier').fill(imei)
        grid.get_by_label('شماره سریال').fill(serial)
        grid.get_by_label('رمز دستگاه').fill('0032 TEST ONLY')
        for width,suffix in [(1440,'desktop'),(390,'mobile')]:
            page.set_viewport_size({'width':width,'height':900})
            grid.screenshot(path=str(args.output/f'{args.phase}-device-{suffix}.png'))
            if not before:
                assert grid.evaluate('e => e.scrollWidth <= e.clientWidth + 1')
                boxes=[grid.locator('#reception-device-identifier').bounding_box(),grid.get_by_label('شماره سریال').bounding_box()]
                assert (abs(boxes[0]['y']-boxes[1]['y']) < 8)==(width==1440),boxes
        page.set_viewport_size({'width':1440,'height':900})
        missing=grid.get_by_role('checkbox',name='شناسه در دسترس نیست')
        reason=grid.get_by_label('علت در دسترس نبودن شناسه')
        missing.check()
        expect(reason).to_be_visible()
        expect(grid.locator('#reception-device-identifier')).to_be_disabled()
        expect(grid.get_by_label('شماره سریال')).to_be_enabled()
        missing.uncheck()
        expect(reason).to_have_count(0)
        page.get_by_role('button',name='ادامه',exact=True).click()
        notes=page.get_by_placeholder(re.compile('نکته داخلی برای تکنسین'))
        expect(notes).to_be_visible()
        if before:
            page.get_by_placeholder('هر ایراد اعلامی را در یک خط بنویسید.').fill('LCD — تاچ قطع است\nباتری — شارژ زود تخلیه می‌شود')
        else:
            group=page.get_by_role('group',name='ایرادات پیش‌فرض')
            expect(group.get_by_role('button',name='اتصال آزمایشی')).to_be_visible()
            expect(group.get_by_role('button',name='سایر')).to_have_count(0)
            for name in ('LCD','باتری','اتصال آزمایشی'):
                group.get_by_role('button',name=name,exact=True).click()
            page.get_by_role('button',name='حذف ایراد اتصال آزمایشی').click()
            page.get_by_label('توضیحات تکمیلی LCD').fill('تاچ قطع است')
            page.get_by_label('توضیحات تکمیلی باتری').fill('شارژ زود تخلیه می‌شود')
            expect(page.get_by_text('توضیح روی قبض مشتری',exact=False)).to_have_count(0)
        notes.fill('SECRET INTERNAL FOR TEST')
        issue_card=notes.locator('xpath=ancestor::section[1]')
        issue_card.screenshot(path=str(args.output/f'{args.phase}-issues.png'))
        if before:
            case=lab.case(manager,model,suffix='08',tech=technician['id'],imei=imei,serialNumber=serial)
            page.goto(args.url + '/?view=receipts', wait_until='networkidle')
            page.get_by_role('button',name=f"مشاهده رسید {case['receiptNumber']}",exact=True).click()
            page.locator('.tamiran-receipt').screenshot(path=str(args.output/'before-receipt.png'))
            browser.close()
            return
        page.get_by_role('button',name=re.compile('نیازی به پاک')).click()
        accepted=page.get_by_role('checkbox',name=re.compile('شرایط|مطالعه|پذیرش'))
        if accepted.count():
            accepted.last.check()
        with page.expect_response(lambda res:'/api/operations.php' in res.url and res.request.method=='POST') as response:
            page.get_by_role('button',name='صدور قبض',exact=True).click()
        value=response.value.json()
        assert response.value.ok,value
        case=value['data']['repairCase']
        article=page.locator('.tamiran-receipt')
        expect(article).to_be_visible()
        expect(article.get_by_role('img',name='QR پیگیری پرونده')).to_be_visible()
        for value in (phone,imei,serial,'تاچ قطع است','شارژ زود تخلیه می‌شود'):
            expect(article).to_contain_text(value)
        for value in ('SECRET INTERNAL FOR TEST','0032 TEST ONLY'):
            expect(article).not_to_contain_text(value)
        link=article.get_by_role('link',name='بازکردن پیگیری پرونده').get_attribute('href')
        token=parse_qs(urlsplit(link).query)['portal'][0]
        portal=Client(args.url).api('portal-v2.php?'+urlencode({'token':token}))
        portal_text=json.dumps(portal,ensure_ascii=False)
        assert 'تاچ قطع است' in portal_text
        assert all(secret not in portal_text for secret in ('SECRET INTERNAL FOR TEST','0032 TEST ONLY',phone,imei,serial))
        article.screenshot(path=str(args.output/'after-receipt.png'))
        print_button=page.get_by_role('button',name=re.compile('چاپ'))
        page.evaluate('''() => {
          const original = window.open.bind(window);
          window.open = (...args) => {
            const popup=original(...args);
            if (popup) popup.print=()=>{popup.document.body.dataset.printReady="true"};
            return popup;
          };
        }''')
        with page.expect_popup() as popup:
            print_button.last.click()
        printed=popup.value
        expect(printed.locator('body')).to_have_attribute('data-print-ready','true')
        assert article.evaluate('e=>getComputedStyle(e).fontFamily')==printed.locator('.tamiran-receipt').evaluate('e=>getComputedStyle(e).fontFamily')
        for doc in (page,printed):
            assert doc.evaluate('document.fonts.check(\'400 12px "Tamiran Receipt"\', "قبض")')
        pdf=printed.pdf(path=str(args.output/'receipt-a4.pdf'),prefer_css_page_size=True)
        assert len(re.findall(rb'/Type /Page\b',pdf))==1
        case_id=case['id']
        row=lambda: tech.api(f'workflow-v2.php?caseId={case_id}')['cases'][0]
        issues=['LCD — تاچ قطع است','باتری — شارژ زود تخلیه می‌شود']
        assert row()['declaredIssues']==issues
        tech.api('workflow-v2.php','POST',{'caseId':case_id,'action':'technical_receive','idempotencyKey':secrets.token_hex(12),'lockVersion':row()['lockVersion']})
        with open_as(browser,args.url,tech,390) as technician_context:
            tech_page=technician_context.new_page()
            tech_page.goto(args.url+f'/?view=my-work&techCase={case_id}&techTask=diagnosis',wait_until='networkidle')
            first=tech_page.get_by_role('group',name=issues[0],exact=True)
            second=tech_page.get_by_role('group',name=issues[1],exact=True)
            first.get_by_role('radio',name='ایراد مشاهده شد',exact=True).check()
            second.get_by_role('radio',name='نیاز به بررسی بیشتر',exact=True).check()
            expect(first.get_by_role('radio',name='ایراد مشاهده شد',exact=True)).to_be_checked()
            expect(second.get_by_role('radio',name='نیاز به بررسی بیشتر',exact=True)).to_be_checked()
        lookup=lambda: manager.api(f'operations.php?customerMobile={phone}')['customer']['devices']
        assert any(r['serialNumber']==serial and r['imei']==imei and not r['recallEligible'] for r in lookup())
        tech.api('workflow-v2.php','POST',{'caseId':case_id,'action':'technical_finish','result':'not_repaired',
            'reason':'TEST','report':'TEST','idempotencyKey':secrets.token_hex(12),'lockVersion':row()['lockVersion']})
        manager.api('delivery-v2.php','POST',{'action':'complete','caseId':case_id,'recipientFullName':'مشتری مصنوعی',
            'recipientMobile':phone,'idempotencyKey':secrets.token_hex(12),'verificationMethod':'receipt_qr','verificationEvidence':{'note':'TEST'},'accessoriesConfirmed':['بدون لوازم']})
        assert any(r['serialNumber']==serial and r['imei']==imei and r['recallEligible'] for r in lookup())
        page.goto(args.url+'/?view=reception',wait_until='networkidle')
        page.get_by_placeholder('09xxxxxxxxx',exact=True).fill(phone)
        page.get_by_role('button',name='انتخاب از سوابق',exact=True).click()
        page.locator('.previous-device-grid button').filter(has_text=case['receiptNumber']).click()
        page.get_by_role('button',name='ادامه',exact=True).click()
        expect(page.locator('#reception-device-identifier')).to_have_value(imei)
        expect(page.get_by_label('شماره سریال')).to_have_value(serial)
        expect(page.get_by_label('رمز دستگاه')).to_have_value('')
        browser.close()
    print(json.dumps({'version':manager.api('health.php')['version'],'browser':'passed','technician_issues':2,
        'recall_active_blocked':True,'pdf_pages':1},ensure_ascii=False))


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--url',required=True)
    p.add_argument('--admin-mobile',required=True)
    p.add_argument('--phase',required=True,choices=['before','after'])
    p.add_argument('--output',required=True,type=Path)
    run(p.parse_args())
