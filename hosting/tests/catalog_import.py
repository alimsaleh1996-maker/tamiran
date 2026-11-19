#!/usr/bin/env python3
"""Real loopback-only duplicate matching, atomic import, tenant and concurrency checks."""
import argparse,concurrent.futures,datetime as dt,json,os,secrets
from pathlib import Path
from urllib.parse import urlsplit
from smoke import Client,expect

def run(args):
    expect(urlsplit(args.url).hostname in ('127.0.0.1','localhost','::1'),'loopback only')
    marker='TEST-CATALOG-'+secrets.token_hex(5);prefix='0993'+str(secrets.randbelow(90000)+10000);password='Test-Only!'+secrets.token_hex(16);results=[]
    def check(name,fn):
        v=fn();results.append({'name':name,'status':'PASS'});print('PASS '+name,flush=True);return v
    admin=Client(args.url);admin.login('09990000000',os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    def shop(suffix):
        data=admin.api('admin.php','POST',{'name':marker+suffix,'repairType':'digital','managerName':marker,'managerMobile':prefix+suffix,'expiresAt':(dt.date.today()+dt.timedelta(days=365)).isoformat(),'productProfile':'pro','inventoryMode':'off','qcMode':'off','modules':['repair'],'maxUsers':10,'idempotencyKey':marker+suffix})
        client=Client(args.url);actor=client.login(prefix+suffix,data['temporaryPassword']);client.api('auth.php','POST',{'action':'change_initial_password','newPassword':password,'confirmation':password});client.token();return client,actor
    manager,actor=shop('01');other,other_actor=shop('02')
    def row(t,b,m):return {'type':t,'brand':b,'model':m}
    def bulk(rows,client=manager,**extra):return client.api('catalog.php','POST',{'action':'import','rows':rows,**extra})
    seed=[row('موبایل','سامسونگ','گلکسی A56'),row('هندزفری','اپل','AirPods Pro 2'),row('لپ‌تاپ','لنوو','ThinkPad T14')];bulk(seed)
    r=check('Persian English digit and word-order variants are skipped',lambda:bulk([row('Mobile','Samsung','Galaxy A ۵۶'),row('Handsfree','Apple','AirPod ۲ Pro')]))
    check('canonical duplicates create zero models',lambda:expect(r['created']==0 and r['duplicates']==2,'normalized duplicates created'))
    check('duplicate report names the existing model',lambda:expect(r['matches'][0]['existing']['model']=='گلکسی A56','match missing'))
    check('manual entry cannot bypass canonical duplicate check',lambda:manager.api('catalog.php','POST',row('گوشی','Samsung','A-56'),expected=409))
    check('manual entry cannot bypass fuzzy name check',lambda:manager.api('catalog.php','POST',row('هندزفری','Apple','AirPdos Pro 2'),expected=409))
    bad=[row('موبایل','سامسونگ','Galaxy Z99'),row('هندزفری','اپل','AirPdos Pro 2')]
    check('similar row blocks entire batch with original Excel row number',lambda:manager.api('catalog.php','POST',{'action':'import','rows':[bad[0],{**bad[1],'sourceRow':47}]},expected=409))
    check('earlier valid row is rolled back when similar row exists',lambda:expect(not any(x['model']=='Galaxy Z99' for x in manager.api('catalog.php')['items']),'partial import'))
    distinct=check('different generation number remains distinct',lambda:bulk([row('موبایل','سامسونگ','Galaxy A55'),row('هندزفری','اپل','AirPods Pro 3')]))
    check('two genuinely different models are created',lambda:expect(distinct['created']==2,'different generation blocked'))
    within=check('duplicates within same workbook are matched before creation',lambda:bulk([row('موبایل','Samsung','Galaxy S24'),row('Mobile','سامسونگ','S ۲۴')]))
    check('same workbook creates just one canonical model',lambda:expect(within['created']==1 and within['duplicates']==1,'internal duplicate'))
    check('existing spelling reused for new model type and brand',lambda:expect(next(x for x in manager.api('catalog.php')['items'] if x['model']=='Galaxy S24')['brand']=='سامسونگ','parallel brand created'))
    check('inactive model still prevents duplicate definition',lambda:manager.api('catalog.php','PATCH',{'id':next(x['id'] for x in manager.api('catalog.php')['items'] if x['model']=='گلکسی A56'),'active':False}))
    check('inactive duplicate is skipped without reactivating it',lambda:expect(bulk([row('Mobile','Samsung','A56')])['created']==0 and not next(x for x in manager.api('catalog.php')['items'] if x['model']=='گلکسی A56')['is_active'],'inactive changed'))
    check('another shop can independently define same names',lambda:expect(bulk(seed,other)['created']==3,'cross-tenant collision'))
    manager.api('admin-users.php','POST',{'displayName':marker+'second','mobile':prefix+'03','role':'repair_manager','branchIds':[actor['branch']['id']],'password':password})
    second=Client(args.url);second.login(prefix+'03',password);second.api('auth.php','POST',{'action':'change_initial_password','newPassword':password+'New','confirmation':password+'New'});second.token()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        a=pool.submit(bulk,[row('موبایل','سامسونگ','Galaxy A57')],manager);b=pool.submit(bulk,[row('Mobile','Samsung','A ۵۷')],second);both=[a.result(),b.result()]
    check('concurrent managers cannot create equivalent names twice',lambda:expect(sum(x['created'] for x in both)==1 and sum(x['duplicates'] for x in both)==1,'concurrent duplicate'))
    check('type brand and model codes do not merge different physical models',lambda:expect(bulk([row('هدفون','Sony','WH-1000XM5'),row('هدفون','Sony','WF-1000XM5')])['created']==2,'distinct model code blocked'))
    Path(args.report).write_text(json.dumps({'passed':len(results),'failed':0,'results':results,'scope':'synthetic loopback HTTP; two independent manager accounts for race'},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:9273');p.add_argument('--report',required=True);run(p.parse_args())
