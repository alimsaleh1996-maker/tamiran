#!/usr/bin/env python3
"""Targeted delay-report and deadline-picker checks for the isolated PHP/MariaDB lab."""
import argparse
import datetime as dt
import os
from pathlib import Path
import secrets
import subprocess
from urllib.parse import urlencode, urlsplit
from zoneinfo import ZoneInfo

from smoke import Client, Runner, expect, synthetic_imei
from v7_operations import open_as


def run(args):
    assert urlsplit(args.url).hostname in ('localhost', '127.0.0.1', '::1')
    log = Runner(args.report)
    marker = 'TEST-STAB-03-' + secrets.token_hex(4)
    prefix = '0968' + str(secrets.randbelow(90000) + 10000)
    password = 'Test-Only!' + secrets.token_hex(18)
    admin = Client(args.url)
    admin.login(args.admin_mobile, os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])

    def shop(suffix, name):
        registered = admin.api('admin.php','POST',{
            'name':marker+name,'repairType':'digital','managerName':marker+name,'managerMobile':prefix+suffix,
            'expiresAt':(dt.date.today()+dt.timedelta(days=31)).isoformat(),'productProfile':'pro','maxUsers':10,
            'inventoryMode':'pro','qcMode':'off','modules':['repair','inventory'],'idempotencyKey':marker+name,
        })
        client = Client(args.url)
        owner = client.login(prefix+suffix,registered['temporaryPassword'])
        client.api('auth.php','POST',{'action':'change_initial_password','newPassword':password,'confirmation':password})
        client.token()
        return client,owner

    manager,owner = shop('01','manager')
    stranger,_ = shop('08','foreign')
    techs = []
    for suffix in ('02','03','04','05'):
        admin.api('admin-users.php','POST',{
            'shopId':owner['shop']['id'],'branchIds':[owner['branch']['id']],
            'displayName':marker+suffix,'mobile':prefix+suffix,'password':password,'role':'technician',
        })
        client=Client(args.url)
        actor=client.login(prefix+suffix,password)
        techs.append((client, actor))
    tech, lead = techs[0]
    other, next_tech = techs[1]
    _, empty_tech = techs[2]
    _, former_tech = techs[3]
    manager.api('catalog.php','POST',{'type':'موبایل','brand':marker,'model':'TEST phone'})
    model=manager.api('catalog.php')['items'][0]['id']

    def create(due=None, assigned=lead['id'], label='TEST پرونده'):
        return manager.api('operations.php','POST',{
            'action':'create_case','receiptMode':'issue_only','customerName':marker,'customerMobile':prefix+'09',
            'deviceModelId':model,'identifier':synthetic_imei(),'declaredIssue':label,
            'customerConsent':{'dataHandling':'no_erasure'},'preapprovedAmount':5000000,
            'assignedToUserId':assigned,'assignmentMode':'queue' if assigned is None else 'automatic',
            'idempotencyKey':secrets.token_hex(16),**({'promisedAt':due} if due else {}),
        })['repairCase']

    def case_row(case):
        return manager.api(f"workflow-v2.php?caseId={case['id']}")['cases'][0]

    def mutate(actor,case,action,expected=200,**values):
        return actor.api('workflow-v2.php','POST',{
            'action':action,'caseId':case['id'],'lockVersion':case_row(case)['lockVersion'],
            'idempotencyKey':secrets.token_hex(16),**values,
        },expected=expected)

    iran = ZoneInfo('Asia/Tehran')
    report_day = dt.datetime.now(iran).date()-dt.timedelta(days=2)
    midnight = dt.datetime.combine(report_day,dt.time(),iran).astimezone(dt.timezone.utc)
    def at(minutes):
        return (midnight+dt.timedelta(minutes=minutes)).strftime('%Y-%m-%d %H:%M:%S')
    due = at(1)
    params={'managerReport':'1','from':str(report_day),'to':str(report_day)}
    creator = int(owner['id'])
    fixtures = []

    def history(case,last_stage='diagnosing',*,accepted=True,earlier_wait=False,transfer=None,missing=False):
        case_id, branch = int(case['id']), int(owner['branch']['id'])
        statements = [
            f"SET @w=(SELECT id FROM repair_case_workflows WHERE case_id={case_id});",
            f"UPDATE repair_cases SET created_at='{at(-180)}' WHERE id={case_id} AND branch_id={branch};",
            f"""UPDATE repair_case_stage_events SET started_at='{at(-180)}',created_at='{at(-180)}',
            ended_at='{at(-120)}' WHERE workflow_id=@w AND from_status IS NULL;""",
            f"""UPDATE repair_case_assignments SET started_at='{at(-180)}',
            accepted_at={repr(at(-120)) if accepted else 'NULL'} WHERE workflow_id=@w AND assignment_type='primary';""",
        ]
        def stage(status,offset,end):
            finish=repr(at(end)) if end is not None else 'NULL'
            return f"""INSERT INTO repair_case_stage_events(public_id,workflow_id,from_status,to_status,actor_user_id,
                idempotency_key,metadata_json,started_at,ended_at,created_at)
                VALUES(LEFT(REPLACE(UUID(),'-',''),26),@w,'assigned','{status}',{creator},
                    'test-03-{offset}','{{}}','{at(offset)}',{finish},'{at(offset)}');"""
        if earlier_wait:
            statements.append(stage('awaiting_parts',-120,-30))
        if not missing:
            statements.append(stage(last_stage,-30 if earlier_wait else -120,None))
        if transfer is not None:
            successor, minutes=transfer
            statements.extend([
                f"UPDATE repair_case_assignments SET ended_at='{at(minutes)}' WHERE workflow_id=@w;",
                f"""INSERT INTO repair_case_assignments(public_id,workflow_id,technician_user_id,assignment_type,task_title,
                    started_at,accepted_at,created_by_user_id) VALUES(LEFT(REPLACE(UUID(),'-',''),26),@w,
                    {successor},'primary','TEST handover','{at(minutes)}','{at(minutes)}',{creator});""",
                f"UPDATE repair_case_workflows SET primary_technician_user_id={successor} WHERE id=@w;",
            ])
        fixtures.extend(statements)

    # The live API creates each case and its original promise. SQL only ages isolated test timelines.
    bulk = [create(due) for _ in range(51)]
    for case in bulk:
        history(case)
    post_transfer=create(due)
    history(post_transfer,transfer=(next_tech['id'],30))
    pre_transfer=create(due)
    history(pre_transfer,transfer=(next_tech['id'],-5))
    waiting_customer=create(due)
    history(waiting_customer,'awaiting_customer_approval')
    waiting_part=create(due)
    history(waiting_part,'awaiting_parts')
    resumed=create(due)
    history(resumed,earlier_wait=True)
    pending_receipt=create(due)
    history(pending_receipt,'assigned',accepted=False)
    former=create(due,assigned=former_tech['id'])
    history(former)
    fixtures.append(f"DELETE FROM tamiran_user_branches WHERE user_id={former_tech['id']} AND branch_id={owner['branch']['id']};")
    unassigned=create(due,assigned=None)
    history(unassigned,'awaiting_assignment',accepted=False)
    settled=create(due)
    history(settled,'ready_for_delivery')
    cancelled=create(due)
    history(cancelled,'cancelled')
    gap=create(due)
    history(gap,missing=True)
    unknown=create()
    history(unknown)
    fixtures.append(f"UPDATE repair_case_workflows SET promised_at='{due}' WHERE case_id={unknown['id']};")
    outside=create(at(-1))
    history(outside)
    future=create(at(24*60+1))
    history(future)
    edited=create(due)
    mutate(manager,edited,'manager_update_case',priority='normal',promisedAt=at(90),reason='TEST moved before deadline')
    history(edited,transfer=(next_tech['id'],45))
    repeated=create(due)
    mutate(manager,repeated,'manager_update_case',priority='normal',promisedAt=at(90),reason='TEST moved after breach')
    history(repeated)
    technical=create()
    accepted=mutate(tech,technical,'technical_receive')
    assert accepted['received']
    real_future=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
    mutate(tech,technical,'update_promise',promisedAt=real_future,reason='TEST estimate')
    history(technical)
    fixtures.extend([
        'SET @tamiran_restore_mode=1;',
        f"UPDATE tamiran_audit_log SET created_at='{at(-15)}' WHERE action_code='manager_priority' AND entity_public_id='{edited['publicId']}';",
        f"UPDATE tamiran_audit_log SET created_at='{at(10)}' WHERE action_code='manager_priority' AND entity_public_id='{repeated['publicId']}';",
        f"""UPDATE tamiran_audit_log SET created_at='{at(-15)}',after_json=JSON_SET(after_json,'$.promisedAt','{due}')
            WHERE action_code='case.promise.update' AND entity_public_id='{technical['publicId']}';""",
        'SET @tamiran_restore_mode=0;',
    ])
    fixture = subprocess.run([args.sql],input='\n'.join(fixtures),text=True,capture_output=True)
    if fixture.returncode:
        raise RuntimeError(fixture.stderr)

    def report(client=manager, **extra):
        return client.api('workflow-v2.php?'+urlencode({**params,**extra}))

    summary=log.check('manager report queries recorded stages, assignments and both promise histories',report)
    records={r['id']:r for r in summary['rows']}
    a,b=lead['id'],next_tech['id']
    attributable={c['id'] for c in bulk+[post_transfer,repeated,technical]}
    operational=attributable|{c['id'] for c in [waiting_customer,waiting_part,resumed,pending_receipt]}
    def details(user,metric):
        result=[]
        offset=0
        while offset is not None:
            payload=report(technician=user,metric=metric,offset=offset,asOf=summary['asOf'])
            result+=payload['rows']
            offset=payload['nextOffset']
        return result

    def parity(user, metric, ids, count):
        rows=details(user,metric)
        expect(len(rows)==count==len(ids) and {row['id'] for row in rows}==ids and all(row['samples']==1 for row in rows),
            f'{metric}: pages did not match summary or IDs')
        return rows

    log.check('operational delay count matches both pages and exact per-case IDs',lambda:
        parity(a,'operationalLate',operational,records[a]['operationalLate']))
    rows=log.check('attributable count matches both pages and excludes waits and pending receipt',lambda:
        parity(a,'attributableLate',attributable,records[a]['attributableLate']))
    log.check('historical transfer uses the owner at due and a timely reschedule uses the effective deadline',lambda:
        parity(b,'attributableLate',{pre_transfer['id'],edited['id']},records[b]['attributableLate']))
    log.check('a former branch member keeps historical responsibility when the record proves it',lambda:
        parity(former_tech['id'],'attributableLate',{former['id']},records[former_tech['id']]['attributableLate']))
    log.check('a deadline changed after breach keeps its first breach once',lambda:expect(
        next(row for row in rows if row['id']==repeated['id'])['dueAt']==due,'first breach disappeared'))
    log.check('unassigned delayed cases are visible separately',lambda:
        parity(0,'operationalLate',{unassigned['id']},summary['withoutOwner']['operationalLate']))
    log.check('missing stage or promise, future and previous Tehran date are excluded',lambda:expect(
        records[a]['delayObserved']==len(operational)+2 and records[empty_tech['id']]['delayObserved']==0,'wrong observation coverage'))
    log.check('foreign workshop has no local records and technician cannot request reporting',lambda:(
        expect(report(stranger,technician=a,metric='operationalLate')['rows']==[],'foreign workshop leaked'),
        tech.api('workflow-v2.php?'+urlencode(params),expected=403)))
    log.check('non-delay detail remains available and future as-of is rejected',lambda:(
        expect(len(details(a,'assigned'))==records[a]['assigned'],'assignment parity regressed'),
        manager.api('workflow-v2.php?'+urlencode({**params,'technician':a,'metric':'operationalLate','asOf':'2099-11-27 12:00:00'}),expected=400)))

    browser_case=create(label='TEST موعد مدیر و تکنسین')
    mutate(tech,browser_case,'technical_receive')
    log.check('technician deadline validation still requires a time component',lambda:mutate(
        tech,browser_case,'update_promise',expected=400,promisedAt=str(report_day)))
    log.check('technician due date in the past is still rejected',lambda:mutate(
        tech,browser_case,'update_promise',expected=400,promisedAt=due))
    if args.browser_dir:
        expected_days=[(dt.datetime.now(iran).date()+dt.timedelta(days=d)).isoformat() for d in (1,2)]
        browser_checks(log,args,manager,tech,browser_case,lead['displayName'],expected_days,case_row)
    log.save()


def browser_checks(log,args,manager,tech,case,name,days,case_row):
    from playwright.sync_api import sync_playwright, expect as visible
    output=args.browser_dir
    output.mkdir(parents=True,exist_ok=True)
    url=args.url
    def fits(page):
        return page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    def pick(page,label):
        group=page.get_by_role('group',name='زمان تقریبی اتمام تعمیر',exact=True)
        visible(group.get_by_role('button',name=label,exact=True)).to_be_visible()
        group.get_by_role('button',name='امروز',exact=True).click()
        group.get_by_role('button',name='فردا',exact=True).click()
        group.get_by_role('button',name='پس‌فردا',exact=True).click()
        visible(group.get_by_role('button',name='پس‌فردا',exact=True)).to_have_attribute('aria-pressed','true')
        group.get_by_role('button',name=label,exact=True).click()
        calendar=page.get_by_role('dialog',name=label)
        visible(calendar.get_by_text('تقویم رسمی ایران')).to_be_visible()
        calendar.locator('.persian-date-days button.selected').click()
        group.get_by_role('button',name='فردا',exact=True).click()
        field=group.get_by_role('textbox',name='ساعت به وقت ایران',exact=True)
        group.get_by_role('button',name='۱۸:۰۰',exact=True).click()
        visible(field).to_have_value('۱۸:۰۰')
        field.fill('24:00')
        field.press('Tab')
        visible(group.get_by_role('alert')).to_contain_text('۲۴ ساعته')
        field.fill('23:45')
        field.press('Tab')
        visible(field).to_have_value('۲۳:۴۵')
        visible(group.get_by_role('alert')).to_have_count(0)
        assert field.get_attribute('type') in (None,'text')
        assert 'AM' not in group.inner_text() and 'PM' not in group.inner_text()
        return group,field

    with sync_playwright() as tools:
        browser=tools.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        for width in (390,1440):
            with open_as(browser,url,manager,width) as context:
                page=context.new_page()
                page.goto(url+'/?view=technician-performance')
                page.get_by_role('button',name='دریافت گزارش',exact=True).click()
                row=page.locator('.manager-report-grid > li').filter(has=page.get_by_role('heading',name=name,exact=True))
                visible(row.locator('meter')).to_be_visible()
                row.get_by_role('button',name='پرونده‌های دارای تأخیر عملیاتی').click()
                details=row.get_by_role('region',name='ریز شاخص پرونده‌های دارای تأخیر عملیاتی')
                visible(details.locator('li')).to_have_count(50)
                if width==390:
                    details.get_by_role('button',name='پرونده‌های بیشتر').click()
                    visible(details.locator('li')).to_have_count(60)
                assert fits(page)
                page.screenshot(path=str(output/f'performance-{width}.png'),animations='disabled')
                page.goto(url+f"/?view=technician-performance&techCase={case['id']}&opsTask=administration")
                group,field=pick(page,'تاریخ موعد برآوردی')
                group.scroll_into_view_if_needed()
                assert fits(page)
                page.screenshot(path=str(output/f'manager-picker-{width}.png'),animations='disabled')
                if width==1440:
                    page.get_by_label('علت اقدام',exact=True).fill('TEST موعد مدیر')
                    with page.expect_response(lambda r:'workflow-v2.php' in r.url and r.request.method=='POST') as reply:
                        page.get_by_role('button',name='ثبت اولویت و موعد',exact=True).click()
                    expect(reply.value.ok and case_row(case)['promisedAt']==days[0]+' 20:15:00','manager deadline did not persist in UTC')
            with open_as(browser,url,tech,width) as context:
                page=context.new_page()
                page.goto(url+f"/?view=my-work&techCase={case['id']}&techTask=diagnosis")
                page.get_by_role('radio',name='ایراد مشاهده شد',exact=True).check()
                group,field=pick(page,'انتخاب تاریخ دیگر')
                group.scroll_into_view_if_needed()
                assert fits(page)
                page.screenshot(path=str(output/f'technician-picker-{width}.png'),animations='disabled')
                if width==1440:
                    group.get_by_role('button',name='پس‌فردا',exact=True).click()
                    field.fill('09:35')
                    page.get_by_label('شرح عیب‌یابی',exact=True).fill('TEST کانکتور شارژ')
                    page.get_by_label('شرح ایراد جدید',exact=True).fill('TEST خرابی کانکتور')
                    page.locator('#technical-labor').fill('20000')
                    page.get_by_role('button',name='ثبت برآورد و ادامه',exact=True).click()
                    page.wait_for_url('**techTask=work**',timeout=12000)
                    expect(case_row(case)['promisedAt']==days[1]+' 06:05:00','technician deadline did not persist in UTC')
        log.check('Chromium verifies both views, drill-down paging, and both picker saves at 390px and 1440px',lambda:True)
        browser.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',required=True)
    parser.add_argument('--admin-mobile',required=True)
    parser.add_argument('--report',required=True)
    parser.add_argument('--sql',required=True,help='executable that reads SQL from stdin for the isolated test database only')
    parser.add_argument('--browser-dir',type=Path)
    run(parser.parse_args())
