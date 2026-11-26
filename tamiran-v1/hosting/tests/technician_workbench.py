#!/usr/bin/env python3
"""Synthetic loopback integration tests for the unified technical workspace.
No SMS/payment provider or customer consent is exercised. Credentials via env.
Optional --fixture-php invokes CLI-only guarded policy/rollback fixture helper.
"""
import argparse,datetime as dt,json,os,secrets,subprocess
from pathlib import Path
from urllib.parse import urlsplit
from concurrent.futures import ThreadPoolExecutor
from smoke import Client,Runner,expect,synthetic_imei

def run(args):
    u=urlsplit(args.url);expect(u.scheme=='http' and u.hostname in ('127.0.0.1','localhost','::1'),'loopback only')
    out=Runner(args.report);marker='TEST-TECH-DESK-'+secrets.token_hex(4).upper();prefix='0999'+str(secrets.randbelow(90000)+10000)
    admin=Client(args.url);admin.login(args.admin_mobile,os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    password='Test-Only!'+secrets.token_hex(18)
    created=admin.api('admin.php','POST',{'name':marker,'repairType':'digital','managerName':marker,'managerMobile':prefix+'01','expiresAt':(dt.date.today()+dt.timedelta(days=365)).isoformat(),'productProfile':'pro','inventoryMode':'pro','qcMode':'off','modules':['repair','inventory','finance'],'maxUsers':12,'idempotencyKey':marker})
    manager=Client(args.url);actor=manager.login(prefix+'01',created['temporaryPassword']);manager.api('auth.php','POST',{'action':'change_initial_password','newPassword':password,'confirmation':password});manager.token()
    clients={};actors={}
    for i,role in enumerate(['technician','technician','reception','warehouse_keeper','finance_cashier'],2):
        admin.api('admin-users.php','POST',{'shopId':actor['shop']['id'],'branchIds':[actor['branch']['id']],'displayName':marker+str(i),'mobile':prefix+f'{i:02}','password':password,'role':role})
        c=Client(args.url);a=c.login(prefix+f'{i:02}',password);clients[i]=c;actors[i]=a
    tech=clients[2];other=clients[3];reception=clients[4];warehouse=clients[5];finance=clients[6]
    manager.api('catalog.php','POST',{'type':'موبایل','brand':marker,'model':marker});model=manager.api('catalog.php')['items'][0]['id']
    if args.browser_fixture:
        target=Path(args.browser_fixture).resolve();repo=Path(__file__).resolve().parents[2]
        if target.is_relative_to(repo):raise RuntimeError('Write credential fixtures outside the repository')
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps({'base':args.url,'password':password,'managerMobile':prefix+'01','customerMobile':prefix+'19','tech':{'id':actors[2]['id'],'phone':prefix+'02'},'model':{'id':model}},ensure_ascii=False));target.chmod(0o600)
    def create():
        return manager.api('operations.php','POST',{'action':'create_case','receiptMode':'issue_only','customerName':marker,'customerMobile':prefix+'09','deviceModelId':model,'identifier':synthetic_imei(),'declaredIssue':marker,'customerConsent':{'dataHandling':'coordinate_first'},'assignedToUserId':actors[2]['id'],'preapprovedAmount':7500000,'idempotencyKey':marker+secrets.token_hex(6)})['repairCase']['id']
    def row(id,c=tech):return c.api(f'workflow-v2.php?caseId={id}')['cases'][0]
    def projection(id,c=tech):return c.api(f'workflow-v2.php?caseId={id}&technical=1')
    def receive(id, c=tech, key=None, expected=200, version=None):
        return c.api('workflow-v2.php','POST',{'action':'technical_receive','caseId':id,
            'lockVersion':row(id,c)['lockVersion'] if version is None else version,
            'idempotencyKey':key or secrets.token_hex(12)},expected=expected)
    def transition(id,target,c=tech,expected=200,version=None):
        current=row(id,c)
        if target=='diagnosing' and expected==200 and current['receiptPending']:
            return receive(id,c,version=version)
        return c.api('workflow-v2.php','POST',{'action':'transition','caseId':id,'target':target,
            'lockVersion':current['lockVersion'] if version is None else version,
            'idempotencyKey':secrets.token_hex(12)},expected=expected)
    def activity(id,key=None,c=tech,expected=200,**patch):return c.api('workflow-v2.php','POST',{'action':'technical_activity','caseId':id,'title':'تست مدار شارژ','description':'ولتاژ باتری و مسیر شارژ بررسی شد.','observation':'افت ولتاژ مشاهده شد.','idempotencyKey':key or secrets.token_hex(12),**patch},expected=expected)
    def estimate(id,amount=1000000,diagnostic=100000):return tech.api('workflow-v2.php','POST',{'action':'estimate_create','caseId':id,'items':[{'type':'labor','title':'اجرت تعمیر','quantity':1,'unitPrice':amount}]+([{'type':'part','title':'برآورد قطعات','quantity':1,'unitPrice':projection(id)['cost']['partsAmount']}] if projection(id)['cost']['partsAmount'] else []),'diagnosticFee':diagnostic,'idempotencyKey':secrets.token_hex(12)})['estimate']
    def finish(id,result='repaired',expected=200,key=None,version=None,c=tech):return c.api('workflow-v2.php','POST',{'action':'technical_finish','caseId':id,'result':result,'report':'گزارش نهایی مصنوعی','reason':'قطعه مورد نیاز موجود نیست' if result=='not_repaired' else '', 'lockVersion':row(id,c)['lockVersion'] if version is None else version,'idempotencyKey':key or secrets.token_hex(12)},expected=expected)
    def manual(id,key=None,expected=200,**patch):return tech.api('workflow-v2.php','POST',{'action':'manual_part_add','caseId':id,'title':'کانکتور آزمایشی','quantity':1,'saleUnitPrice':500000,'idempotencyKey':key or secrets.token_hex(12),**patch},expected=expected)
    id=out.check('assigned case visible to its technician',create)
    out.check('foreign technician cannot read technical case',lambda:other.api(f'workflow-v2.php?caseId={id}&technical=1',expected=403))
    initial_version=row(id)['lockVersion']
    receipt_key=secrets.token_hex(12)
    out.check('automatic assignment requires physical receipt',lambda:expect(row(id)['receiptPending'],'receipt was acknowledged on assignment'))
    out.check('plain transition cannot bypass physical receipt',lambda:transition(id,'diagnosing',expected=409))
    out.check('manager cannot confirm for the assigned technician',lambda:receive(id,manager,expected=403))
    out.check('physical receipt rejects a stale version',lambda:receive(id,version=initial_version+1,expected=409))
    out.check('assigned technician confirms physical receipt',lambda:receive(id,key=receipt_key,version=initial_version))
    out.check('lost-response retry keeps the same physical receipt',lambda:expect(receive(id,key=receipt_key,version=initial_version)['replayed'],'receipt duplicated'))
    out.check('receipt advances to diagnosis',lambda:expect(row(id)['status']=='diagnosing' and not row(id)['receiptPending'],'invalid receipt transition'))
    out.check('no-estimate cost gate rejects repair',lambda:transition(id,'repairing',expected=409))
    key=secrets.token_hex(12);out.check('record independent technical activity',lambda:activity(id,key))
    out.check('activity exact replay is idempotent',lambda:expect(activity(id,key)['replayed'],'not replayed'))
    out.check('activity key payload mismatch rejected',lambda:activity(id,key,expected=409,description='different'))
    out.check('unauthorized replay does not leak record',lambda:activity(id,key,c=other,expected=403))
    before=row(id)['lockVersion']
    for i in range(4):out.check(f'independent activity {i+2}',lambda:activity(id))
    out.check('activities do not move case or rewrite version',lambda:expect(row(id)['status']=='diagnosing' and row(id)['lockVersion']==before,'activity changed workflow'))
    out.check('refresh retains all five activities and author/time',lambda:expect(len(projection(id)['activities']['activities'])==5 and all(a['actorName'] and a['createdAt'] for a in projection(id)['activities']['activities']),'history lost'))
    out.check('missing CSRF denied',lambda:tech.api('workflow-v2.php','POST',{'action':'technical_activity','caseId':id},expected=419,headers={'X-CSRF-Token':''}))
    out.check('foreign attachment rejected',lambda:activity(id,attachments=['NONEXISTENT'],expected=403))
    out.check('under-cap estimate valid',lambda:estimate(id))
    out.check('under-cap repair allowed',lambda:transition(id,'repairing'))
    mk=secrets.token_hex(12);out.check('free part alongside professional inventory',lambda:manual(id,mk))
    out.check('free part replay does not duplicate',lambda:expect(manual(id,mk)['replayed'],'duplicate'))
    out.check('free part replay mismatch rejected',lambda:manual(id,mk,expected=409,title='Different'))
    out.check('purchase price permission enforced',lambda:manual(id,purchaseUnitCost=1,expected=403))
    out.check('negative money denied',lambda:manual(id,saleUnitPrice=-1,expected=400))
    out.check('fractional rial denied',lambda:manual(id,saleUnitPrice=1.5,expected=400))
    manager.api('operations.php','POST',{'action':'create_inventory_item','code':marker,'title':'قطعه انباری آزمایشی','category':'قطعات','physicalQuantity':8,'minimumQuantity':1})
    inv=manager.api('inventory-v2.php');stock=inv['items'][0];wh=inv['warehouse']['id'];initial=stock['physical_quantity']
    # Set synthetic sale prices via existing stock editor is outside this mission; zero-price stock still exercises the ledger.
    request={'action':'request','caseId':id,'itemId':stock['id'],'quantity':2,'idempotencyKey':secrets.token_hex(12)}
    out.check('request stock in same case',lambda:tech.api('inventory-v2.php','POST',request))
    out.check('request replay returns original',lambda:expect(tech.api('inventory-v2.php','POST',request)['replayed'],'request duplicated'))
    out.check('unsettled request prevents final outcome',lambda:finish(id,expected=409))
    out.check('consumption cannot fabricate an issue',lambda:tech.api('inventory-v2.php','POST',{'action':'finalize_issue','issuePublicId':'NO-ISSUE','decision':'consumed'},expected=409))
    req=next(r for r in manager.api('inventory-v2.php')['requests'] if r['case_id']==id)
    warehouse.api('inventory-v2.php','POST',{'action':'reserve','requestId':req['id'],'quantity':2,'warehouseId':wh})
    out.check('warehouse cannot issue to an unassigned technician',lambda:warehouse.api('inventory-v2.php','POST',{'action':'issue','requestId':req['id'],'quantity':1,'warehouseId':wh,'technicianUserId':actors[3]['id'],'idempotencyKey':secrets.token_hex(12)},expected=403))
    issued=warehouse.api('inventory-v2.php','POST',{'action':'issue','requestId':req['id'],'quantity':1,'warehouseId':wh,'technicianUserId':actors[2]['id'],'idempotencyKey':secrets.token_hex(12)})
    out.check('delivered stock consumed after issue',lambda:tech.api('inventory-v2.php','POST',{'action':'finalize_issue','issuePublicId':issued['issuePublicId'],'decision':'consumed'}))
    issued2=warehouse.api('inventory-v2.php','POST',{'action':'issue','requestId':req['id'],'quantity':1,'warehouseId':wh,'technicianUserId':actors[2]['id'],'idempotencyKey':secrets.token_hex(12)})
    out.check('unused delivered part returned',lambda:tech.api('inventory-v2.php','POST',{'action':'finalize_issue','issuePublicId':issued2['issuePublicId'],'decision':'returned'}))
    out.check('stock ledger removes only consumed stock; manual part has no effect',lambda:expect(manager.api('inventory-v2.php')['items'][0]['physical_quantity']==initial-1,'stock drift'))
    out.check('mixed part sources visible in case',lambda:expect({p['sourceType'] for p in projection(id)['parts']}=={'manual','stock'},'mixed sources missing'))
    transition(id,'parts_closeout')
    out.check('direct phase transition cannot skip final report and result',lambda:transition(id,'finance_pending',expected=409))
    out.check('higher revision requires fresh authorization',lambda:estimate(id,9000000))
    out.check('higher cost cannot finish existing repair',lambda:finish(id,expected=409))
    e=projection(id)['cost']['estimatePublicId'];tech.api('workflow-v2.php','POST',{'action':'estimate_send','estimatePublicId':e})
    out.check('technician cannot record customer phone approval',lambda:tech.api('workflow-v2.php','POST',{'action':'estimate_decide','estimatePublicId':e,'decision':'approved','channel':'recorded_phone','reason':'TEST denied'},expected=403))
    out.check('rejection still needs decision documentation',lambda:reception.api('workflow-v2.php','POST',{'action':'estimate_decide','estimatePublicId':e,'decision':'rejected','channel':'recorded_phone'},expected=400))
    out.check('cost status clearly awaits customer',lambda:expect(projection(id)['cost']['state']=='waiting_customer','wrong cost state'))
    out.check('fresh valid under-cap revision re-enables authorized repair',lambda:estimate(id))
    out.check('stale finalization version rejected',lambda:finish(id,version=-1,expected=409))
    fk=secrets.token_hex(12);out.check('repaired QC-off enters finance',lambda:finish(id,key=fk))
    out.check('successful finish replay safe',lambda:expect(finish(id,key=fk)['replayed'],'finish duplicated'))
    out.check('technical responsibility ends at finance',lambda:activity(id,expected=409))
    out.check('repaired case is in finance',lambda:expect(row(id)['status']=='finance_pending','wrong final stage'))
    draft=next(d for d in finance.api('finance-v2.php')['drafts'] if d['caseId']==id)
    out.check('canonical draft includes diagnostic fee once',lambda:expect(sum(int(p['saleUnitPrice']) for p in draft['items'] if p['type']=='diagnostic')==100000,'diagnostic omitted/doubled'))
    part=next(p for p in draft['items'] if p['type']=='part')
    out.check('duplicate part billing rejected',lambda:finance.api('finance-v2.php','POST',{'action':'issue','caseId':id,'items':draft['items']+[part]},expected=409))
    out.check('finance cannot exceed current cost authorization',lambda:finance.api('finance-v2.php','POST',{'action':'issue','caseId':id,'items':draft['items']+[{'type':'labor','title':'invalid extra','quantity':1,'saleUnitPrice':9000000}]},expected=409))
    invoice=out.check('canonical mixed invoice issued once',lambda:finance.api('finance-v2.php','POST',{'action':'issue','caseId':id,'items':draft['items']}))
    out.check('invoice retry does not add finance rows',lambda:expect(finance.api('finance-v2.php','POST',{'action':'issue','caseId':id,'items':draft['items']})['replayed'],'invoice duplicated'))
    # Unrepaired with real synthetic parts and diagnostic fee; no QC or approval fabricated.
    un=create();transition(un,'diagnosing');estimate(un);manual(un)
    out.check('unrepaired can end technical work without QC',lambda:finish(un,'not_repaired'))
    out.check('unrepaired with charges waits in finance',lambda:expect(row(un)['status']=='finance_pending','charges bypassed'))
    d=next(d for d in finance.api('finance-v2.php')['drafts'] if d['caseId']==un)
    out.check('unrepaired proposal removes labor and warranty',lambda:expect({x['type'] for x in d['items']}=={'diagnostic','part'} and all(int(x['warrantyDays'])==0 for x in d['items']),'unrepaired billing wrong'))
    out.check('unrepaired repair labor cannot be injected',lambda:finance.api('finance-v2.php','POST',{'action':'issue','caseId':un,'items':d['items']+[{'type':'labor','title':'bad','quantity':1,'saleUnitPrice':1}]},expected=409))
    inv=finance.api('finance-v2.php','POST',{'action':'issue','caseId':un,'items':d['items']})
    out.check('unpaid unrepaired cannot close',lambda:expect(row(un)['status']=='finance_pending','unpaid closed'))
    out.check('payment settles synthetic invoice without gateway',lambda:finance.api('finance-v2.php','POST',{'action':'payment','invoicePublicId':inv['publicId'],'amount':inv['totalAmount'],'method':'cash','idempotencyKey':secrets.token_hex(12)}))
    out.check('settled unrepaired routes to returned_unrepaired without QC',lambda:expect(row(un)['status']=='returned_unrepaired','unrepaired not routed'))
    out.check('locked return rejects new activities',lambda:activity(un,expected=409))
    out.check('locked return rejects free parts',lambda:manual(un,expected=409))
    out.check('delivery queue includes returned case',lambda:expect(any(c['case_id']==un for c in manager.api('delivery-v2.php')['cases']),'return missing'))
    free=create();transition(free,'diagnosing');out.check('no-charge unrepaired routes directly to return',lambda:finish(free,'not_repaired'));out.check('free return closed and locked',lambda:expect(row(free)['status']=='returned_unrepaired' and row(free)['isLocked'],'not locked'))
    # Active collaborator can append their own events, but cannot finalize or buy parts.
    co=create();transition(co,'diagnosing');manager.api('workflow-v2.php','POST',{'action':'collaborator_add','caseId':co,'technicianUserId':actors[3]['id'],'taskTitle':'بررسی تکمیلی'})
    out.check('active collaborator records attributed activity',lambda:activity(co,c=other))
    out.check('collaborator cannot finish principal responsibility',lambda:finish(co,c=other,expected=403))
    out.check('collaborator cannot register principal manual part',lambda:other.api('workflow-v2.php','POST',{'action':'manual_part_add','caseId':co,'title':'bad','quantity':1,'saleUnitPrice':1,'idempotencyKey':secrets.token_hex(12)},expected=403))
    out.check('collaborator actor retained in immutable history',lambda:expect(projection(co)['activities']['activities'][0]['actorName']==actors[3]['displayName'],'wrong event actor'))
    # A real synthetic physical return uses an authorized local emergency verification path, never OTP/SMS.
    delivery={'action':'complete','caseId':un,'recipientFullName':marker,'recipientMobile':prefix+'09','verificationMethod':'manager_emergency','verificationEvidence':{'syntheticReceipt':True,'syntheticIdentity':True},'emergencyReason':'TEST local synthetic handover','accessoriesConfirmed':[],'idempotencyKey':secrets.token_hex(12)}
    out.check('unrepaired physical return is recorded',lambda:manager.api('delivery-v2.php','POST',delivery))
    out.check('physical return retry is idempotent',lambda:expect(manager.api('delivery-v2.php','POST',delivery)['replayed'],'delivery duplicated'))
    hand=tech.api('workflow-v2.php','POST',{'action':'handover_request','caseId':co,'toUserId':actors[3]['id'],'reason':'TEST transfer','partsDisposition':'transfer_to_new','hotReturnsDisposition':'transfer_to_new'})
    receipt=other.api(f"workflow-v2.php?handoverReceipt={hand['publicId']}")
    checklist=['device',*[part['publicId'] for group in ('partIssues','installedParts','hotReturns') for part in receipt['receipt'][group]]]
    out.check('new technician accepts formal handover',lambda:other.api('workflow-v2.php','POST',{'action':'handover_decide','publicId':hand['publicId'],'decision':'accept','receiptRevision':receipt['revision'],'checkedItems':checklist}))
    out.check('handover retains technical author history',lambda:expect(len(projection(co,other)['activities']['activities'])==1,'history lost in handover'))
    out.check('former principal loses case access after handover',lambda:tech.api(f'workflow-v2.php?caseId={co}&technical=1',expected=403))
    late = create()
    transition(late, 'diagnosing')
    pending = tech.api('workflow-v2.php', 'POST', {
        'action':'handover_request', 'caseId':late, 'toUserId':actors[3]['id'],
        'reason':'TEST before finish', 'partsDisposition':'transfer_to_new',
        'hotReturnsDisposition':'transfer_to_new',
    })
    estimate(late);transition(late,'repairing');finish(late)
    late_decision = {'action':'handover_decide', 'publicId':pending['publicId']}
    out.check('pending handover cannot change ownership after technical completion',
              lambda:other.api('workflow-v2.php','POST',{**late_decision,'decision':'accept'},expected=409))
    out.check('handover rejection preserves financial phase and principal',
              lambda:expect(row(late,manager)['status']=='finance_pending' and row(late,manager)['primaryTechnicianUserId']==actors[2]['id'],'late handover changed ownership'))
    out.check('manager can cancel a pending handover after technical completion',
              lambda:manager.api('workflow-v2.php','POST',{**late_decision,'decision':'cancel','reason':'TEST financial phase'}))
    # Real Solo membership/plan, separate from the case-policy snapshot matrix below.
    for number,inventory,qc in [(11,'off','off'),(12,'simple','simple')]:
        solo=admin.api('admin.php','POST',{'name':marker+'-SOLO-'+str(number),'repairType':'digital','managerName':marker+'-SOLO','managerMobile':prefix+str(number),'expiresAt':(dt.date.today()+dt.timedelta(days=365)).isoformat(),'productProfile':'solo','inventoryMode':inventory,'qcMode':qc,'modules':['repair','finance']+(['inventory'] if inventory!='off' else []),'idempotencyKey':marker+'-SOLO-'+str(number)})
        sm=Client(args.url);sa=sm.login(prefix+str(number),solo['temporaryPassword']);sm.api('auth.php','POST',{'action':'change_initial_password','newPassword':password,'confirmation':password});sm.token()
        sm.api('catalog.php','POST',{'type':'موبایل','brand':marker,'model':'Solo '+str(number)});modelid=sm.api('catalog.php')['items'][0]['id']
        sc=sm.api('operations.php','POST',{'action':'create_case','receiptMode':'issue_only','customerName':marker,'customerMobile':prefix+'09','deviceModelId':modelid,'identifier':synthetic_imei(),'declaredIssue':marker,'customerConsent':{'dataHandling':'no_erasure'},'preapprovedAmount':1000000,'idempotencyKey':marker+'SOLOCASE'+str(number)})['repairCase']['id']
        sr=row(sc,sm)
        out.check(f'Solo {inventory}/{qc} waits for physical receipt',lambda:expect(sr['receiptPending'],'Solo receipt was acknowledged automatically'))
        out.check(f'Solo {inventory}/{qc} confirms without new role',lambda:receive(sc,sm))
        sm.api('workflow-v2.php','POST',{'action':'estimate_create','caseId':sc,'items':[{'type':'labor','title':'TEST Solo','quantity':1,'unitPrice':100000}],'idempotencyKey':secrets.token_hex(12)})
        transition(sc,'repairing',sm);finish(sc,c=sm)
        out.check(f'actual Solo light plan {inventory}/{qc} follows enabled policy',lambda sc=sc,sm=sm,qc=qc:expect(row(sc,sm)['status']==('finance_pending' if qc=='off' else 'qc_pending'),'Solo entitlement routing failed'))
        out.check('foreign shop cannot access technical projection '+str(number),lambda sc=sc:tech.api(f'workflow-v2.php?caseId={sc}&technical=1',expected=404))
    if args.fixture_php:
        helper=str(Path(__file__).with_name('technician_fixture.php'))
        def fixture(id,mode,*params):return subprocess.check_output([args.fixture_php,helper,str(id),mode,*params],text=True)
        for profile,inventory,qcs in [('solo','off',['off','simple']),('solo','simple',['off','simple']),('pro','off',['off','simple','independent']),('pro','simple',['off','simple','independent']),('pro','pro',['off','simple','independent'])]:
            for qc in qcs:
                m=create();fixture(m,'policy',profile,inventory,qc);transition(m,'diagnosing');estimate(m);manual(m);transition(m,'repairing');finish(m)
                policy=manager.api(f'workflow-v2.php?caseId={m}')['productPolicy']
                # Actual case policy / transitions govern QC, not the shop default payload.
                out.check(f'{profile}/{inventory}/{qc}: repaired routing and mixed free parts',lambda m=m,qc=qc:expect(row(m)['status']==('finance_pending' if qc=='off' else 'qc_pending'),'policy routing'))
                n=create();fixture(n,'policy',profile,inventory,qc);transition(n,'diagnosing');finish(n,'not_repaired');out.check(f'{profile}/{inventory}/{qc}: unrepaired never requires QC',lambda n=n:expect(row(n)['status']=='returned_unrepaired','QC blocked unrepaired'))
        def queued_case():
            return manager.api('operations.php', 'POST', {
                'action': 'create_case', 'receiptMode': 'issue_only',
                'customerName': marker, 'customerMobile': prefix+'09',
                'deviceModelId': model, 'identifier': synthetic_imei(),
                'declaredIssue': marker, 'customerConsent': {'dataHandling':'coordinate_first'},
                'assignmentMode': 'queue', 'idempotencyKey': marker+secrets.token_hex(12),
            })['repairCase']['id']

        queued = queued_case()
        before = row(queued, manager)
        expect(before['status'] == 'awaiting_assignment', 'fixture must enter assignment queue')
        assignment = {'action':'assign', 'caseId':queued, 'technicianUserId':actors[2]['id'],
                      'reason':'TEST assign', 'lockVersion':before['lockVersion'],
                      'idempotencyKey':secrets.token_hex(12)}
        def assignments(id):
            return [a for a in manager.api(f'workflow-v2.php?caseId={id}')['assignments'] if a['case_id'] == id]

        fixture(queued, 'transition-audit-fail')
        try:
            out.check('assignment transition write failure rolls back', lambda:manager.api('workflow-v2.php','POST',assignment,expected=500))
        finally:
            fixture(queued, 'audit-reset')
        out.check('failed transition leaves ownership, version and assignment rows unchanged',
                  lambda:expect(row(queued, manager)['primaryTechnicianUserId'] is None and row(queued, manager)['lockVersion']==before['lockVersion'] and not assignments(queued), 'partial assignment committed'))
        out.check('technician without assignment permission cannot assign a queued case',
                  lambda:tech.api('workflow-v2.php','POST',assignment,expected=403))
        out.check('stale assignment version cannot claim an unassigned case',
                  lambda:manager.api('workflow-v2.php','POST',{**assignment,'lockVersion':before['lockVersion']+1},expected=409))
        out.check('assignment uses original optimistic version after rollback', lambda:manager.api('workflow-v2.php','POST',assignment))
        out.check('second request replays the original assignment', lambda:manager.api('workflow-v2.php','POST',assignment))
        out.check('reused key with different payload is rejected',
                  lambda:manager.api('workflow-v2.php','POST',{**assignment,'reason':'Different request'},expected=409))
        legacy = {k:v for k,v in assignment.items() if k not in ('idempotencyKey','lockVersion')}
        out.check('legacy repeated assignment remains a no-op', lambda:manager.api('workflow-v2.php','POST',legacy))
        out.check('successful and replayed requests retain a single principal assignment',
                  lambda:expect(row(queued)['status']=='assigned' and len(assignments(queued))==1,'assignment or stage duplicated'))

        contested = queued_case()
        selected_version = row(contested, manager)['lockVersion']
        def claim(params):
            client, recipient = params
            status, _, _ = client.raw('/api/workflow-v2.php','POST',{**assignment, 'caseId':contested,
                'technicianUserId':recipient, 'lockVersion':selected_version, 'idempotencyKey':secrets.token_hex(12)})
            return status
        with ThreadPoolExecutor(max_workers=2) as pool:
            race_results = list(pool.map(claim, [(manager,actors[2]['id']), (reception,actors[3]['id'])]))
        out.check('two distinct concurrent assignments yield exactly one owner',
                  lambda:expect(sorted(race_results)==[200,409] and len(assignments(contested))==1 and row(contested,manager)['status']=='assigned','competing assignment inconsistent'))

        receipt_case = create()
        receipt_before = row(receipt_case)
        receipt_retry_key = secrets.token_hex(12)
        fixture(receipt_case, 'transition-audit-fail')
        try:
            out.check('failed diagnosis transition rolls back physical receipt',
                      lambda:receive(receipt_case,key=receipt_retry_key,expected=500))
        finally:
            fixture(receipt_case, 'audit-reset')
        out.check('rolled-back receipt leaves the case pending at its original version',
                  lambda:expect(row(receipt_case)['receiptPending'] and row(receipt_case)['lockVersion']==receipt_before['lockVersion'],'partial receipt committed'))
        out.check('receipt retries safely after a rolled-back transition',
                  lambda:receive(receipt_case,key=receipt_retry_key))

        fail=create();transition(fail,'diagnosing');fixture(fail,'audit-fail')
        try:
            out.check('audit failure rolls back activity',lambda:activity(fail,expected=500))
            out.check('audit failure rolls back free part',lambda:manual(fail,expected=500))
        finally:fixture(fail,'audit-reset')
        out.check('failed audit leaves zero activity events',lambda:expect(not projection(fail)['activities']['activities'],'partial event committed'))
        out.check('failed part audit leaves zero billable parts',lambda:expect(not projection(fail)['parts'],'partial manual part committed'))
        estimate(fail);transition(fail,'repairing');old=row(fail);fixture(fail,'audit-fail')
        try:out.check('audit failure rolls back final result and transition',lambda:finish(fail,expected=500))
        finally:fixture(fail,'audit-reset')
        out.check('finalization rollback preserves state, report and result',lambda:expect(row(fail)['status']=='repairing' and row(fail)['lockVersion']==old['lockVersion'] and projection(fail)['result'] is None,'partial finalization committed'))
        out.check('unrepaired physical return creates no warranty',lambda:expect(int(json.loads(fixture(un,'counts'))['warranties'])==0,'unrepaired warranty created'))
        race=create();transition(race,'diagnosing');rk=secrets.token_hex(12)
        with ThreadPoolExecutor(max_workers=2) as pool:values=list(pool.map(lambda _:activity(race,rk),range(2)))
        out.check('concurrent retries create one activity',lambda:expect(sum(not v['replayed'] for v in values)==1 and len(projection(race)['activities']['activities'])==1,'race duplicate'))
        for _ in range(51):activity(race)
        first=projection(race)['activities'];second=tech.api(f"workflow-v2.php?caseId={race}&technicalActivities=1&beforeId={first['nextBeforeId']}")
        out.check('activity pagination retains more than fifty independent records',lambda:expect(len(first['activities'])==50 and len(second['activities'])==2 and len({a['id'] for a in first['activities']+second['activities']})==52,'history truncated/duplicated'))

    out.metadata={'fixture_marker':marker,'base_url':args.url,'limits':['No live deployment, SMS, payment gateway or customer approval recorded','Policy matrix uses guarded synthetic case snapshots under active module entitlement' if args.fixture_php else 'Policy matrix and audit injection not run: no fixture CLI supplied']}
    out.save();print('Passed',sum(x['status']=='PASS' for x in out.results))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:9273');p.add_argument('--admin-mobile',default='09990000000');p.add_argument('--report',required=True);p.add_argument('--fixture-php');p.add_argument('--browser-fixture');run(p.parse_args())
