#!/usr/bin/env python3
"""Measure synthetic reception and paginated reads on loopback only."""
import argparse, datetime as dt, json, os, secrets, statistics, time
from urllib.parse import urlsplit
from smoke import Client, expect


def main(args):
    parsed = urlsplit(args.url)
    expect(parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1','localhost','::1'), 'loopback HTTP required')
    marker = 'TEST-TAMIRAN-LOAD-' + secrets.token_hex(4).upper()
    prefix = '0996' + str(secrets.randbelow(100000)).zfill(5)
    admin = Client(args.url); admin.login(args.admin_mobile, os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'])
    shop = admin.api('admin.php','POST', {'name':marker,'repairType':'digital','managerName':marker,'managerMobile':prefix+'01',
      'branchName':marker,'expiresAt':(dt.date.today()+dt.timedelta(days=365)).isoformat(),'productProfile':'pro',
      'inventoryMode':'off','qcMode':'off','modules':['repair'],'maxUsers':5,'idempotencyKey':marker+'-SHOP'})
    manager = Client(args.url);manager.login(prefix+'01',shop['temporaryPassword'])
    pw='TEST-LOAD!'+secrets.token_hex(12);manager.api('auth.php','POST',{'action':'change_initial_password','newPassword':pw,'confirmation':pw});manager.token()
    catalog=manager.api('catalog.php','POST',{'type':'موبایل','brand':marker,'model':marker});model=next(row['id'] for row in catalog['items'] if row['model']==marker)
    manager.api('settings.php','PATCH',{'receiptTerms':{'title':marker,'body':marker+' synthetic terms'}});terms=manager.api('settings.php')['activeReceiptTerms']
    start=time.monotonic()
    for index in range(args.cases):
        manager.api('operations.php','POST',{'action':'create_case','customerName':marker,'customerMobile':prefix+'02',
          'deviceModelId':model,'identifier':marker+'-'+str(index),'declaredIssue':marker,
          'customerConsent':{'dataHandling':'no_erasure'},'assignmentMode':'queue','idempotencyKey':marker+'-'+str(index),
          'receiptAcceptance':{'accepted':True,'publicId':terms['public_id'],'contentSha256':terms['content_sha256']}})
    create_seconds=time.monotonic()-start
    latencies=[];responses=[]
    for _ in range(15):
        start=time.monotonic();page=manager.api('operations.php');latencies.append(time.monotonic()-start)
        responses.append(len(json.dumps(page,ensure_ascii=False).encode()))
    expect(page['casesPage']['total']==args.cases and page['summary']['activeCases']==args.cases,'aggregate incomplete')
    last_offset=((args.cases-1)//250)*250
    last=manager.api('operations.php?caseOffset='+str(last_offset))
    expect(last['casesPage']['total']==args.cases and len(last['cases'])==args.cases-last_offset,'last page incomplete')
    result={'cases':args.cases,'create_total_seconds':round(create_seconds,3),'page_first_p50_ms':round(statistics.median(latencies)*1000,1),
      'page_first_max_ms':round(max(latencies)*1000,1),'page_response_json_bytes':max(responses),'returned_first_page':len(page['cases']),
      'returned_last_page':len(last['cases']),'limits':['Local synthetic dataset and local PHP/MariaDB; not production hardware or concurrent load.']}
    print(json.dumps(result,ensure_ascii=False,indent=2));
    if args.report:
        with open(args.report,'w') as report:json.dump(result,report,ensure_ascii=False,indent=2)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:9176');parser.add_argument('--admin-mobile',default='09120000000');parser.add_argument('--cases',type=int,choices=range(251,2001),default=1000);parser.add_argument('--report');main(parser.parse_args())
