#!/usr/bin/env python3
"""Session binding, privacy and single-use regressions for Persian audio CAPTCHA."""
import argparse,io,json,os,secrets,urllib.parse,wave
from pathlib import Path
from smoke import Client,svg_captcha,expect

p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8085');p.add_argument('--admin-mobile',default='09120000000');p.add_argument('--report',default='/workspace/scratch/tamiran-ui-fixes/captcha-results.json');a=p.parse_args()
u=urllib.parse.urlsplit(a.url);expect(u.scheme=='http' and u.hostname in ('127.0.0.1','localhost','::1'),'literal loopback required')
results=[]
def check(name,fn):
    try: result=fn()
    except Exception as e:
        results.append({'name':name,'status':'FAIL','error':str(e)});save();raise
    results.append({'name':name,'status':'PASS'});save();print('PASS '+name,flush=True);return result
def save():
    Path(a.report).write_text(json.dumps({'passed':sum(r['status']=='PASS' for r in results),'failed':sum(r['status']=='FAIL' for r in results),'results':results},ensure_ascii=False,indent=2)+'\n')
c=Client(a.url);c.token();key=secrets.token_hex(8)
meta=check('Initialization returns metadata only',lambda:c.api('captcha.php?mode=init&v='+key))
check('Initialization never exposes answer or transcript',lambda:expect(set(meta)=={'audioAvailable','expiresIn'} and meta['audioAvailable'] is True,'unexpected metadata'))
status,headers,image=c.raw('/api/captcha.php?mode=image&v='+key);answer=svg_captcha(image)
status,headers,audio=c.raw('/api/captcha.php?mode=audio&v='+key)
check('Audio has no-store WAV headers',lambda:expect(status==200 and 'audio/wav' in headers.get('Content-Type','') and 'no-store' in headers.get('Cache-Control','') and audio[:4]==b'RIFF','invalid audio'))
with wave.open(io.BytesIO(audio)) as w: check('WAV decodes as audible mono PCM',lambda:expect(w.getframerate()==16000 and w.getnchannels()==1 and w.getsampwidth()==2 and w.getnframes()>16000,'bad PCM'))
check('Repeated audio does not rotate challenge',lambda:expect(c.raw('/api/captcha.php?mode=audio&v='+key)[2]==audio,'challenge rotated'))
check('Image remains identical after audio request',lambda:expect(c.raw('/api/captcha.php?mode=image&v='+key)[2]==image,'image changed'))
check('Wrong challenge key is rejected',lambda:c.api('captcha.php?mode=audio&v=wrong',expected=410))
check('Another session cannot fetch audio',lambda:Client(a.url).api('captcha.php?mode=audio&v='+key,expected=410))
check('Cross-site audio request is rejected',lambda:c.api('captcha.php?mode=audio&v='+key,expected=403,headers={'Sec-Fetch-Site':'cross-site'}))
check('Image answer authenticates after audio playback',lambda:c.api('auth.php','POST',{'action':'identify','mobile':a.admin_mobile,'password':os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'],'captchaAnswer':answer}))
check('Consumed audio is unavailable',lambda:c.api('captcha.php?mode=audio&v='+key,expected=410))
c.token()
check('A consumed challenge cannot log in twice',lambda:c.api('auth.php','POST',{'action':'identify','mobile':a.admin_mobile,'password':os.environ['TAMIRAN_SMOKE_ADMIN_PASSWORD'],'captchaAnswer':answer},expected=401))
newkey=secrets.token_hex(8);c.api('captcha.php?mode=init&v='+newkey)
replacement=secrets.token_hex(8);c.api('captcha.php?mode=init&v='+replacement)
check('Refresh invalidates a still-unconsumed audio binding',lambda:c.api('captcha.php?mode=audio&v='+newkey,expected=410))
newkey=replacement
check('Non-GET audio request is rejected',lambda:c.api('captcha.php?mode=audio&v='+newkey,'POST',{},expected=405))
print('SUMMARY',len(results),'CAPTCHA API checks pass')
