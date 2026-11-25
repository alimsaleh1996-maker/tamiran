#!/usr/bin/env python3
"""Manager user administration against a fresh, synthetic loopback installation."""
import argparse, concurrent.futures, datetime as dt, json, os, secrets, subprocess
from pathlib import Path
from urllib.parse import urlsplit
from smoke import Client, expect


def run(args):
    url = urlsplit(args.url)
    expect(url.scheme == 'http' and url.hostname in ('127.0.0.1', 'localhost', '::1'), 'loopback only')
    marker = 'TEST-TAMIRAN-USERS-' + secrets.token_hex(4).upper()
    prefix = '0995' + str(secrets.randbelow(90000)+10000)
    password = 'Test-Only!' + secrets.token_hex(18)
    admin = Client(args.url)
    admin.login(args.admin_mobile, os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    results = []
    def check(name, operation):
        value = operation()
        results.append({'name': name, 'status': 'PASS'})
        print('PASS ' + name, flush=True)
        return value
    def shop(index):
        created = admin.api('admin.php', 'POST', {'name':marker+str(index),'repairType':'digital','managerName':marker+str(index),
            'managerMobile':prefix+f'{index:02}','expiresAt':(dt.date.today()+dt.timedelta(days=365)).isoformat(),
            'productProfile':'pro','inventoryMode':'off','qcMode':'off','modules':['repair','finance'],'maxUsers':12,'idempotencyKey':marker+str(index)})
        client = Client(args.url); actor = client.login(prefix+f'{index:02}', created['temporaryPassword'])
        client.api('auth.php','POST',{'action':'change_initial_password','newPassword':password,'confirmation':password});client.token()
        return client, actor
    manager, actor = shop(1); other, other_actor = shop(2)
    own = actor['shop']['id']; branch = actor['branch']['id']; foreign = other_actor['branch']['id']
    body = {'displayName':marker+'STAFF','mobile':prefix+'03','role':'technician','branchIds':[branch],'password':password,'permissions':[]}
    check('manager lists own users and capacity',lambda:expect(manager.api('admin-users.php')['usedUsers']==1,'wrong scope'))
    check('create user without trusting a supplied shop ID',lambda:manager.api('admin-users.php','POST',body))
    roster = manager.api('admin-users.php');user=next(u for u in roster['users'] if u['phone']==prefix+'03')
    staff=Client(args.url); staff_actor=staff.login(prefix+'03',password)
    check('new user must change initial password',lambda:expect(staff_actor['mustChangePassword'],'initial password not temporary'))
    staff.api('auth.php','POST',{'action':'change_initial_password','newPassword':password+'New','confirmation':password+'New'});staff.token()
    check('ordinary staff cannot manage users',lambda:staff.api('admin-users.php',expected=403))
    check('shop manager cannot read central dashboard',lambda:manager.api('admin.php',expected=403))
    check('foreign shop injection rejected',lambda:manager.api('admin-users.php','POST',{**body,'mobile':prefix+'04','shopId':other_actor['shop']['id']},expected=403))
    check('foreign branch rejected',lambda:manager.api('admin-users.php','POST',{**body,'mobile':prefix+'04','branchIds':[foreign]},expected=403))
    check('foreign user patch rejected',lambda:manager.api('admin-users.php','PATCH',{'id':other_actor['id'],'displayName':'BAD'},expected=404))
    check('central role cannot be granted',lambda:manager.api('admin-users.php','POST',{**body,'mobile':prefix+'04','role':'central_admin'},expected=400))
    check('wildcard permission cannot be granted',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'permissions':['*']},expected=403))
    check('unknown permission cannot be granted',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'permissions':['central.users.manage']},expected=403))
    check('missing CSRF rejected',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'displayName':'BAD'},expected=419,headers={'X-CSRF-Token':''}))
    check('self deactivation rejected',lambda:manager.api('admin-users.php','PATCH',{'id':actor['id'],'isActive':False},expected=403))
    check('long bcrypt password rejected before mutation',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'newPassword':'A'*73},expected=400))
    check('role and additive permission can be edited',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'role':'reception','permissions':['finance.view']}))
    check('previous staff session revoked on access change',lambda:staff.api('operations.php',expected=401))
    staff.login(prefix+'03',password+'New')
    check('additive finance permission enforced by real endpoint',lambda:staff.api('finance-v2.php'))
    check('profile edit preserves omitted permissions',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'displayName':marker+'EDITED'}))
    check('preserved permission visible in roster',lambda:expect(next(u for u in manager.api('admin-users.php')['users'] if u['id']==user['id'])['permissions']==['finance.view'],'permission lost'))
    check('deactivation succeeds',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'isActive':False}))
    check('reactivation succeeds',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'isActive':True}))
    check('password reset succeeds',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'newPassword':password+'Reset'}))
    check('reset password requires rotation',lambda:expect(Client(args.url).login(prefix+'03',password+'Reset')['mustChangePassword'],'reset not temporary'))
    # Only an explicit local synthetic DB is accepted for SQL fault/race fixtures.
    def fixture(sql):
        code="""$c=require '/app/private/config.php';$d=$c['db'];if($d['host']!=='127.0.0.1'||$d['name']!=='tamiran_users_test')throw new RuntimeException('Synthetic database required');$p=new PDO('mysql:host=127.0.0.1;port='.$d['port'].';dbname='.$d['name'],$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$p->exec(file_get_contents('php://stdin'));"""
        subprocess.run(['docker','exec','-i',args.container,'php','-r',code],input=sql,text=True,check=True,stdout=subprocess.DEVNULL)
    fixture(f"INSERT INTO repair_branches(shop_id,branch_code,name,business_hours_json) VALUES({own},'TEST-SECOND','TEST SECOND','{{}}');")
    check('unmanaged own-shop branch absent from manager choices',lambda:expect(len(manager.api('admin-users.php')['branches'])==1,'unmanaged branch leaked'))
    fixture(f"INSERT INTO tamiran_user_branches(shop_id,user_id,branch_id,branch_role_code,permissions_json) SELECT {own},{user['id']},id,'reception','[]' FROM repair_branches WHERE shop_id={own} AND branch_code='TEST-SECOND';")
    check('partially managed account hidden',lambda:expect(not any(u['id']==user['id'] for u in manager.api('admin-users.php')['users']),'account outside branch scope listed'))
    check('partially managed account cannot be modified',lambda:manager.api('admin-users.php','PATCH',{'id':user['id'],'isActive':False},expected=403))
    fixture(f"DELETE ub FROM tamiran_user_branches ub INNER JOIN repair_branches b ON b.id=ub.branch_id WHERE ub.user_id={user['id']} AND b.branch_code='TEST-SECOND';")
    fixture("CREATE TRIGGER TEST_users_audit_failure BEFORE INSERT ON tamiran_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST audit rollback';")
    try:
        check('audit failure rejects user creation',lambda:manager.api('admin-users.php','POST',{**body,'mobile':prefix+'04'},expected=500))
        check('audit failure rolls user and membership back',lambda:expect(not any(u['phone']==prefix+'04' for u in manager.api('admin-users.php')['users']),'partial user committed'))
    finally: fixture('DROP TRIGGER TEST_users_audit_failure;')
    admin.api('admin-users.php','POST',{**body,'shopId':own,'mobile':prefix+'07','role':'repair_manager'})
    second_manager=Client(args.url);second_manager.login(prefix+'07',password)
    fixture(f'UPDATE repair_shops SET max_users=4 WHERE id={own};')
    def race(index):
        # Independent manager sessions avoid PHP's same-session serialization.
        source = manager if index==5 else second_manager
        client=Client(args.url)
        for cookie in source.cookies:client.cookies.set_cookie(cookie)
        client.csrf=source.csrf
        status,_,_=client.raw('/api/admin-users.php','POST',{**body,'mobile':prefix+f'{index:02}'})
        return status
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: statuses=list(pool.map(race,(5,6)))
    check('concurrent creation in independent manager sessions respects quota',lambda:expect(sorted(statuses)==[200,409] and manager.api('admin-users.php')['usedUsers']==4,'quota exceeded'))
    check('other shop remains unchanged',lambda:expect(other.api('admin-users.php')['usedUsers']==1,'other shop modified'))
    # Synthetic, short-lived browser fixture, stored privately outside the repository.
    if args.browser_fixture:
        fixture_path=Path(args.browser_fixture);fixture_path.write_text(json.dumps({'url':args.url,'cookies':[{'name':c.name,'value':c.value,'domain':url.hostname,'path':c.path} for c in manager.cookies],'staff_id':user['id'],'prefix':prefix,'marker':marker,'shop_id':own,'password':password}));fixture_path.chmod(0o600)
    Path(args.report).write_text(json.dumps({'passed':len(results),'failed':0,'results':results,'limits':['local synthetic HTTP and SQL; no hosted acceptance']},ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:9173');p.add_argument('--admin-mobile',default='09990000000');p.add_argument('--container',default='tamiran-users-web');p.add_argument('--report',required=True);p.add_argument('--browser-fixture');run(p.parse_args())
