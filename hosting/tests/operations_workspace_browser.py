#!/usr/bin/env python3
"""Regression for the operations entry point missed by the technician-only UI tests.
Synthetic loopback PHP only; no customer approval, SMS, payment, or live deployment.
"""
import argparse,json,re,secrets,traceback
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
from smoke import Client,synthetic_imei

def run(args):
 f=json.loads(Path(args.fixture).read_text());assert urlsplit(f['base']).hostname in ('127.0.0.1','localhost','::1')
 out=Path(args.output);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
 def save(): (out/'results.json').write_text(json.dumps({'checks':checks,'passed':sum(c['status']=='PASS' for c in checks),'failed':sum(c['status']=='FAIL' for c in checks),'javascript_errors':errors,'no_real_services':True},ensure_ascii=False,indent=2)+'\n')
 def check(name,fn):
  try:fn();checks.append({'name':name,'status':'PASS'})
  except Exception as e:checks.append({'name':name,'status':'FAIL','error':str(e)});save();raise
 def yes(value,message):assert value,message
 m=Client(f['base']);ma=m.login(f['managerMobile'],f['password']);users=m.api('admin-users.php')['users'];tech=next(u for u in users if u['id']==f['tech']['id']);other=next(u for u in users if u['role']=='technician' and u['id']!=tech['id']);reception=next(u for u in users if u['role']=='reception')
 def create(unassigned=False):
  return m.api('operations.php','POST',{'action':'create_case','receiptMode':'issue_only','customerName':'مشتری آزمایشی عملیات','customerMobile':f['customerMobile'],'deviceModelId':f['model']['id'],'identifier':synthetic_imei(),'declaredIssue':'دستگاه روشن نمی‌شود؛ مدار شارژ بررسی شود.','receptionNotes':'ابتدا اتصال شارژ بررسی شود.','customerConsent':{'dataHandling':'coordinate_first'},**({'assignmentMode':'queue'} if unassigned else {}),'assignedToUserId':None if unassigned else tech['id'],'preapprovedAmount':7500000,'idempotencyKey':secrets.token_hex(16)})['repairCase']
 def row(id):return m.api(f'workflow-v2.php?caseId={id}')['cases'][0]
 def projection(id):return m.api(f'workflow-v2.php?caseId={id}&technical=1')
 c=create();q=create(True)
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  ctx=b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce');ctx.add_cookies([{'name':c.name,'value':c.value,'domain':'127.0.0.1','path':c.path,'httpOnly':True,'sameSite':'Strict'} for c in m.cookies]);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(12000)
  def visit(case,task='overview',ops=''):
   page.goto(f['base']+f'/?view=operations&techCase={case["id"]}&techTask={task}'+('&opsTask='+ops if ops else ''),wait_until='networkidle');expect(page.locator('.tech-device-summary')).to_contain_text(case['receiptNumber'])
  def simple(name):check(name,lambda:expect(page.locator('.technical-desk details,.technical-desk summary,[role=dialog],dialog')).to_have_count(0))
  def capture(name,width):
   page.set_viewport_size({'width':width,'height':1000});page.evaluate('scrollTo(0,0)');check(f'{name} fits {width}',lambda:yes(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),'horizontal overflow'));page.screenshot(path=str(out/f'{name}-{width}.png'),full_page=True)
  page.goto(f['base']+'/?view=operations',wait_until='networkidle');page.get_by_role('tab',name='شروع بررسی').click();page.get_by_role('button',name='بازکردن پرونده '+c['receiptNumber'],exact=True).click();expect(page.get_by_role('button',name='شروع بررسی دستگاه',exact=True)).to_be_visible()
  check('actual operations card opens full-page overview without changing status',lambda:yes(row(c['id'])['status']=='assigned','opening mutated status'));simple('operations entry has no old modal or accordion');check('case hides duplicate operations header and refresh controls',lambda:expect(page.locator('.v2-page-head')).to_have_count(0));check('entry shows necessary reception note',lambda:expect(page.locator('.tech-entry')).to_contain_text('ابتدا اتصال شارژ بررسی شود.'))
  for width in (1440,768,390,320):capture('entry',width)
  page.get_by_role('button',name='شروع بررسی دستگاه',exact=True).click();expect(page.locator('#technical-report')).to_be_visible();check('explicit server start from operations enters diagnosing',lambda:yes(row(c['id'])['status']=='diagnosing','did not start'))
  check('operations composer is one free-text field',lambda:yes(page.locator('#technical-report-form textarea').count()==1 and page.locator('#technical-report-form input,#technical-report-form select').count()==0,'extra fields'))
  page.locator('#technical-report').fill('مدار شارژ بررسی شد.');page.get_by_role('button',name='ثبت گزارش',exact=True).click();expect(page.locator('.tech-report-list li')).to_have_count(1)
  page.locator('#technical-report').fill('کانکتور تست شد.');page.get_by_role('button',name='ثبت گزارش',exact=True).click();expect(page.locator('.tech-report-list li')).to_have_count(2)
  check('manager can append independent reports from operations with real author',lambda:yes(len(projection(c['id'])['activities']['activities'])==2 and all(a['actorName']==ma['displayName'] for a in projection(c['id'])['activities']['activities']),'history or author wrong'));simple('operations work has no accordion')
  for width in (1440,768,390,320):capture('work',width)
  page.locator('#technical-report').fill('پیش‌نویس گزارش مدیر محفوظ بماند.');page.get_by_role('button',name='مدیریت پرونده',exact=True).click();simple('management menu has no accordion');check('management opens independently of report form',lambda:expect(page.locator('#technical-report')).to_have_count(0))
  page.get_by_role('button',name='تغییر تکنسین مسئول',exact=True).click();page.get_by_label('علت تحویل رسمی',exact=True).fill('نیاز به تخصص برد');page.get_by_role('combobox',name='تکنسین مسئول',exact=True).select_option(str(other['id']));capture('assignment',320);page.reload(wait_until='networkidle');check('management draft survives refresh',lambda:expect(page.get_by_label('علت تحویل رسمی',exact=True)).to_have_value('نیاز به تخصص برد'));page.get_by_role('button',name='بازگشت به مدیریت پرونده',exact=True).click();page.get_by_role('button',name='بازگشت به پرونده',exact=True).click();expect(page.locator('#technical-report')).to_have_value('پیش‌نویس گزارش مدیر محفوظ بماند.');check('report draft survives separate management pages and refresh',lambda:expect(page.locator('.tech-report-list li')).to_have_count(2))
  page.get_by_role('button',name='قطعات',exact=True).click();simple('operations parts uses same flat task page');capture('parts',320);page.go_back(wait_until='networkidle');check('browser Back restores operations work and draft',lambda:expect(page.locator('#technical-report')).to_have_value('پیش‌نویس گزارش مدیر محفوظ بماند.'))
  page.get_by_role('button',name='اعلام هزینه',exact=True).click();page.locator('#technical-labor').fill('۹۰۰٬۰۰۰');page.get_by_role('button',name='ثبت و ارسال برآورد',exact=True).click();expect(page.locator('.tech-wait')).to_have_text('منتظر تأیید هزینه توسط مشتری');check('operations estimate obeys actual approval gate',lambda:yes(row(c['id'])['status']=='awaiting_customer_approval','cosmetic wait'))
  page.get_by_role('button',name='مدیریت پرونده',exact=True).click();page.get_by_role('button',name='ثبت تصمیم مشتری',exact=True).click();check('authorized manager reaches isolated documented-decision page',lambda:expect(page.get_by_label('توضیح یا مستند تماس',exact=True)).to_be_visible());check('approval needs documentation',lambda:expect(page.get_by_role('button',name='ثبت تأیید تلفنی',exact=True)).to_be_disabled());simple('decision page no old accordion');capture('approval',320)
  # Do not register a fabricated customer decision. Only inspect the authorized form.
  visit(q);page.get_by_role('button',name='تخصیص تکنسین',exact=True).click();page.get_by_role('combobox',name='تکنسین مسئول',exact=True).select_option(str(tech['id']));page.get_by_label('علت تخصیص',exact=True).fill('تخصص مدار شارژ')
  failed=[]
  def reject_once(route):
   if route.request.method=='POST' and route.request.post_data_json.get('action')=='assign' and not failed:failed.append(True);route.fulfill(status=409,content_type='application/json',body=json.dumps({'ok':False,'error':{'message':'تعارض آزمایشی؛ دوباره تلاش کنید.'}}))
   else:route.continue_()
  page.route('**/api/workflow-v2.php',reject_once);page.get_by_role('button',name='تخصیص',exact=True).click();expect(page.locator('.operations-case [role=alert]')).to_contain_text('تعارض آزمایشی');check('failed assignment preserves form and original owner',lambda:yes(row(q['id'])['primaryTechnicianUserId'] is None and page.get_by_label('علت تخصیص',exact=True).input_value()=='تخصص مدار شارژ','partial assignment or lost draft'));page.unroute('**/api/workflow-v2.php',reject_once);page.get_by_role('button',name='تخصیص',exact=True).click();expect(page.get_by_role('button',name='شروع بررسی دستگاه',exact=True)).to_be_visible();check('assignment retry refreshes same case without modal',lambda:yes(row(q['id'])['primaryTechnicianUserId']==tech['id'],'assignment not saved'))
  page.get_by_role('button',name='مدیریت پرونده',exact=True).click();page.get_by_role('button',name='افزودن همکار و تعیین اجرت',exact=True).click();page.get_by_role('combobox',name='تکنسین همکار',exact=True).select_option(str(other['id']));page.get_by_label('وظیفه',exact=True).fill('بررسی مدار');page.get_by_label(re.compile('مبلغ ثابت')).fill('۲۵٬۰۰۰');capture('collaborator',320);page.get_by_role('button',name='افزودن همکار',exact=True).click();expect(page.get_by_role('button',name='شروع بررسی دستگاه',exact=True)).to_be_visible();assignment=next(a for a in m.api('workflow-v2.php')['assignments'] if a['assignment_type']=='collaborator' and a['case_id']==q['id']);check('collaborator retained with Toman converted to integer Rial',lambda:yes(int(assignment['fixed_fee'])==250000,'10x compensation error'))
  visit(q,'overview','assignment');page.get_by_role('combobox',name='تکنسین مسئول',exact=True).select_option(str(other['id']));page.get_by_label('علت تحویل رسمی',exact=True).fill('ارجاع به متخصص');page.get_by_role('button',name='درخواست تحویل رسمی',exact=True).click();expect(page.locator('.tech-entry')).to_be_visible();check('manager referral requests handover without changing owner',lambda:yes(row(q['id'])['primaryTechnicianUserId']==tech['id'] and any(h['case_id']==q['id'] and h['status']=='requested' for h in m.api('workflow-v2.php')['handovers']),'owner bypassed acceptance'))
  page.get_by_role('button',name='بازگشت به دستگاه‌های عملیات',exact=True).click();expect(page.get_by_role('tablist',name='مراحل دستگاه‌ها')).to_be_visible();check('explicit exit returns to stage cards and clears case URL',lambda:yes('techCase=' not in page.url,'stale selected URL'));simple('operations handovers no accordion or dialog');capture('stage-cards',320)
  # Same case through the technician entry, then adversarial operations URL with technician role.
  t=Client(f['base']);t.login(tech['phone'],f['password']);tc=b.new_context(viewport={'width':390,'height':844});tc.add_cookies([{'name':c.name,'value':c.value,'domain':'127.0.0.1','path':c.path,'httpOnly':True,'sameSite':'Strict'} for c in t.cookies]);tp=tc.new_page();tp.on('pageerror',lambda e:errors.append(str(e)));tp.goto(f['base']+f'/?view=my-work&techCase={c["id"]}&techTask=work',wait_until='networkidle');check('technician entry still uses same report history',lambda:expect(tp.locator('.tech-report-list li')).to_have_count(2));check('technician entry has no management or customer confirmation controls',lambda:expect(tp.get_by_role('button',name=re.compile('مدیریت پرونده|ثبت تأیید تلفنی'))).to_have_count(0));tp.goto(f['base']+f'/?view=operations&techCase={c["id"]}&opsTask=approval',wait_until='networkidle');check('forged operations route does not expose customer approval to technician',lambda:expect(tp.get_by_role('button',name='ثبت تأیید تلفنی',exact=True)).to_have_count(0));tc.close()
  rc=Client(f['base']);rc.login(reception['phone'],f['password']);rx=b.new_context(viewport={'width':390,'height':844});rx.add_cookies([{'name':c.name,'value':c.value,'domain':'127.0.0.1','path':c.path,'httpOnly':True,'sameSite':'Strict'} for c in rc.cookies]);rp=rx.new_page();rp.on('pageerror',lambda e:errors.append(str(e)));rp.goto(f['base']+f'/?view=operations&techCase={c["id"]}&opsTask=menu',wait_until='networkidle');check('reception without operations permission cannot enter manager workspace',lambda:expect(rp.locator('.operations-case')).to_have_count(0));rx.close()
  check('no browser JavaScript errors',lambda:yes(not errors,str(errors)));ctx.close();b.close()
 save();print('PASS',len(checks),'operations browser checks')

if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--fixture',required=True);a.add_argument('--output',required=True)
 try:run(a.parse_args())
 except Exception:traceback.print_exc();raise SystemExit(1)
