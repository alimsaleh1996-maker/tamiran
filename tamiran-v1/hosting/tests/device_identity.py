#!/usr/bin/env python3
"""Synthetic loopback integration of identity, delivery, warranty matching and atomic catalog import."""
import argparse,datetime as dt,json,os,secrets,subprocess
from pathlib import Path
from urllib.parse import urlsplit
from smoke import Client,expect

def run(args):
    expect(urlsplit(args.url).hostname in ('127.0.0.1','localhost','::1'),'loopback only')
    marker='TEST-IDENTITY-'+secrets.token_hex(4).upper();prefix='0994'+str(secrets.randbelow(90000)+10000);results=[]
    def check(name,fn):
        value=fn();results.append({'name':name,'status':'PASS'});print('PASS '+name,flush=True);return value
    admin=Client(args.url);admin.login('09990000000',os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    shop=admin.api('admin.php','POST',{'name':marker,'repairType':'digital','managerName':marker,'managerMobile':prefix+'01','expiresAt':(dt.date.today()+dt.timedelta(days=365)).isoformat(),'productProfile':'pro','inventoryMode':'off','qcMode':'off','modules':['repair','finance','warranty'],'maxUsers':10,'idempotencyKey':marker})
    manager=Client(args.url);actor=manager.login(prefix+'01',shop['temporaryPassword']);password='Test-Only!'+secrets.token_hex(18);manager.api('auth.php','POST',{'action':'change_initial_password','newPassword':password,'confirmation':password});manager.token()
    staff=manager.api('admin-users.php','POST',{'displayName':marker+' reception','mobile':prefix+'02','role':'reception','branchIds':[actor['branch']['id']],'password':password})
    reception=Client(args.url);reception.login(prefix+'02',password);reception.api('auth.php','POST',{'action':'change_initial_password','newPassword':password+'New','confirmation':password+'New'});reception.token()
    def sql(query):
        code="$c=require '/app/private/config.php';$d=$c['db'];if($d['host']!=='127.0.0.1'||$d['name']!=='tamiran_users_test')throw new RuntimeException('Synthetic DB required');$p=new PDO('mysql:host=127.0.0.1;port='.$d['port'].';dbname='.$d['name'],$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$p->exec(file_get_contents('php://stdin'));"
        subprocess.run(['docker','exec','-i',args.container,'php','-r',code],input=query,text=True,check=True,stdout=subprocess.DEVNULL)
    rows=[{'type':'لپ‌تاپ','brand':marker,'model':'Laptop'},{'type':'موبایل','brand':marker,'model':'Phone'}]
    check('catalog import is manager-only',lambda:reception.api('catalog.php','POST',{'action':'import','rows':rows},expected=403))
    check('catalog import requires CSRF',lambda:manager.api('catalog.php','POST',{'action':'import','rows':rows},expected=419,headers={'X-CSRF-Token':''}))
    check('invalid bulk row rejects whole batch',lambda:manager.api('catalog.php','POST',{'action':'import','rows':[rows[0],{'type':'Bad','brand':'','model':'Bad'}]},expected=422))
    check('invalid batch creates no prefix records',lambda:expect(not any(i['brand']==marker for i in manager.api('catalog.php')['items']),'partial import'))
    sql("CREATE TRIGGER TEST_identity_audit_failure BEFORE INSERT ON tamiran_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST atomic rollback';")
    try:
        check('audit failure rejects catalog batch',lambda:manager.api('catalog.php','POST',{'action':'import','rows':rows},expected=500))
        check('failed batch rolls type brand and model back',lambda:expect(not any(i['brand']==marker for i in manager.api('catalog.php')['items']),'partial batch committed'))
    finally:sql('DROP TRIGGER TEST_identity_audit_failure;')
    imported=check('one workbook imports multiple device types',lambda:manager.api('catalog.php','POST',{'action':'import','rows':rows}));expect(imported['created']==2,'wrong count')
    check('retry skips duplicates without overwriting records',lambda:expect(manager.api('catalog.php','POST',{'action':'import','rows':rows})['duplicates']==2,'duplicate import'))
    check('bulk size bounded at 500 rows',lambda:manager.api('catalog.php','POST',{'action':'import','rows':rows*251},expected=422))
    items=manager.api('catalog.php')['items'];laptop=next(x for x in items if x['model']=='Laptop');phone=next(x for x in items if x['model']=='Phone')
    manager.api('settings.php','PATCH',{'receiptTerms':{'title':marker,'body':marker+' synthetic terms'}});terms=manager.api('settings.php')['activeReceiptTerms']
    base={'action':'create_case','customerName':marker,'customerMobile':prefix+'03','deviceModelId':laptop['id'],'declaredIssue':marker,'customerConsent':{'dataHandling':'no_erasure'},'assignmentMode':'queue','accessories':[],'receiptAcceptance':{'accepted':True,'publicId':terms['public_id'],'contentSha256':terms['content_sha256']}}
    n=0
    def create(**changes):
        nonlocal n;n+=1;return manager.api('operations.php','POST',{**base,'idempotencyKey':marker+str(n),**changes})['repairCase']
    check('missing identifier requires explicit unavailable flag',lambda:manager.api('operations.php','POST',{**base,'idempotencyKey':marker+'missing'},expected=422))
    check('unknown identity requires reason',lambda:manager.api('operations.php','POST',{**base,'identifierUnavailable':True},expected=422))
    check('unknown identity rejects conflicting identifier',lambda:manager.api('operations.php','POST',{**base,'identifierUnavailable':True,'identifierUnavailableReason':'powered_off','identifier':'BAD'},expected=422))
    check('phone rejects invalid IMEI',lambda:manager.api('operations.php','POST',{**base,'deviceModelId':phone['id'],'identifier':'123456789012345'},expected=422))
    repaired=check('explicit unknown identity is accepted',lambda:create(identifierUnavailable=True,identifierUnavailableReason='powered_off'))
    check('initial reason survives server readback',lambda:expect(repaired['identifierUnavailableReason']=='powered_off','reason lost'))
    unrepaired=create(identifierUnavailable=True,identifierUnavailableReason='missing_label');changed=create(identifier=marker+'-OLD');duplicate=create(identifier=marker+'-TAKEN')
    def ready(case):
        cid=case['id'];sql(f"UPDATE repair_case_workflows SET process_status='ready_for_delivery' WHERE case_id={cid}; UPDATE repair_cases SET status='ready_for_delivery' WHERE id={cid}; INSERT INTO repair_invoices(public_id,invoice_number,shop_id,branch_id,case_id,status,issued_by_user_id,idempotency_key,issued_at) VALUES('{secrets.token_hex(13)}','{marker}-{cid}',{actor['shop']['id']},{actor['branch']['id']},{cid},'paid',{actor['id']},'{marker}-{cid}',NOW());")
    for c in [repaired,changed]:ready(c)
    sql(f"UPDATE repair_case_workflows SET process_status='returned_unrepaired',locked_at=NOW(),terminal_reason='TEST not repairable' WHERE case_id={unrepaired['id']};UPDATE repair_cases SET status='returned' WHERE id={unrepaired['id']};")
    def delivery(case,**changes):return {'action':'complete','caseId':case['id'],'recipientType':'customer','recipientFullName':marker,'recipientMobile':prefix+'03','verificationMethod':'identity_document','verificationEvidence':{'synthetic':marker},'idempotencyKey':marker+'-DELIVERY-'+str(case['id']),'accessoriesConfirmed':[],**changes}
    request=delivery(repaired,deviceIdentifier=marker+'-RECOVERED',identityConfirmed=True)
    check('repaired delivery without identity is blocked',lambda:manager.api('delivery-v2.php','POST',delivery(repaired),expected=422))
    check('identity confirmation cannot be omitted',lambda:manager.api('delivery-v2.php','POST',{**request,'identityConfirmed':False},expected=422))
    check('stale delivery version rejected',lambda:manager.api('delivery-v2.php','POST',{**request,'expectedVersion':999},expected=409))
    check('cannot assign identity of another device',lambda:manager.api('delivery-v2.php','POST',{**request,'deviceIdentifier':marker+'-TAKEN'},expected=409))
    check('failed delivery preserves blank case identity',lambda:expect(next(c for c in manager.api('operations.php')['cases'] if c['id']==repaired['id'])['identifier']=='','identity changed on failure'))
    sql("CREATE TRIGGER TEST_identity_audit_failure BEFORE INSERT ON tamiran_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST atomic rollback';")
    try:
        check('audit failure rejects late identity and delivery',lambda:manager.api('delivery-v2.php','POST',request,expected=500))
        check('failed late capture rolls identity and handover back',lambda:expect(next(c for c in manager.api('operations.php')['cases'] if c['id']==repaired['id'])['identifier']=='','partial identity committed'))
    finally:sql('DROP TRIGGER TEST_identity_audit_failure;')
    check('valid recovered identity allows repaired delivery',lambda:manager.api('delivery-v2.php','POST',request))
    check('delivery retry is read-only',lambda:expect(manager.api('delivery-v2.php','POST',request)['replayed'],'not replayed'))
    stored=next(c for c in manager.api('operations.php')['cases'] if c['id']==repaired['id']);check('late identity and original unavailable reason both retained',lambda:expect(stored['identifier']==marker+'-RECOVERED' and stored['identifierUnavailableReason']=='powered_off','history overwritten'))
    check('staff cannot change an existing serial',lambda:reception.api('delivery-v2.php','POST',delivery(changed,deviceIdentifier=marker+'-NEW',identityConfirmed=True,identifierChangeReason='TEST board replacement'),expected=403))
    check('manager change requires a reason',lambda:manager.api('delivery-v2.php','POST',delivery(changed,deviceIdentifier=marker+'-NEW',identityConfirmed=True),expected=403))
    check('manager board replacement preserves audited old and new identities',lambda:manager.api('delivery-v2.php','POST',delivery(changed,deviceIdentifier=marker+'-NEW',identityConfirmed=True,identifierChangeReason='TEST board replacement')))
    check('unrepaired device can be handed back without identity or invoice',lambda:manager.api('delivery-v2.php','POST',delivery(unrepaired)))
    check('unrepaired physical handover is idempotent',lambda:expect(manager.api('delivery-v2.php','POST',delivery(unrepaired))['replayed'],'unrepaired replay failed'))
    returned=next(c for c in manager.api('operations.php')['cases'] if c['id']==unrepaired['id']);check('physical return records recipient and timestamp',lambda:expect(returned['deliveredAt'] and returned['deliveredToName']==marker and returned['status']=='returned','handover missing'))
    check('central admin cannot bypass tenant delivery scope',lambda:admin.api('delivery-v2.php','POST',request,expected=403))
    # Give the delivered synthetic invoice a warranty item so mismatch is tested independently of expiry.
    sql(f"INSERT INTO repair_invoice_items(public_id,invoice_id,item_type,title,quantity,sale_unit_price,line_total,warranty_days) SELECT '{secrets.token_hex(13)}',id,'labor','TEST warranty',1,0,0,30 FROM repair_invoices WHERE case_id={repaired['id']}; INSERT INTO repair_warranties(public_id,delivery_id,invoice_item_id,starts_at,expires_at,conditions_text) SELECT '{secrets.token_hex(13)}',d.id,i.id,NOW(),DATE_ADD(NOW(),INTERVAL 30 DAY),'TEST' FROM repair_deliveries d INNER JOIN repair_invoice_items i ON i.invoice_id=d.invoice_id WHERE d.case_id={repaired['id']};")
    warranty={'action':'warranty_case','originalCaseId':repaired['id'],'declaredIssue':'TEST warranty return','idempotencyKey':marker+'-warranty'}
    check('warranty cannot silently copy identity without observation',lambda:manager.api('delivery-v2.php','POST',warranty,expected=422))
    check('warranty rejects a different observed device identity',lambda:manager.api('delivery-v2.php','POST',{**warranty,'observedIdentifier':marker+'-OTHER'},expected=409))
    check('matching identity opens linked warranty case',lambda:manager.api('delivery-v2.php','POST',{**warranty,'observedIdentifier':marker+'-RECOVERED'}))
    Path(args.report).write_text(json.dumps({'passed':len(results),'failed':0,'results':results,'scope':'synthetic loopback HTTP and SQL; delivery prerequisites seeded explicitly, not full workflow E2E'},indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:9273');p.add_argument('--container',default='tamiran-identity-web');p.add_argument('--report',required=True);run(p.parse_args())
