"""Closed TLS test gateway. This server never opens an outbound connection."""
import argparse
import json
import re
import ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
latest = {'calls':0, 'rejectNext':False}

class JSONHandler(BaseHTTPRequestHandler):
    def reply(self, value, status=200):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

class Provider(JSONHandler):
    def do_POST(self):
        if not re.fullmatch(r'/v1/FakeTestKey[0-9]+/verify/lookup.json',self.path):
            self.reply({},404)
            return
        data=parse_qs(self.rfile.read(int(self.headers['Content-Length'])).decode())
        recipient,code,template=(data.get(k,[''])[0] for k in ('receptor','token','template'))
        if not re.fullmatch(r'0967\d{7}',recipient) or not re.fullmatch(r'\d{6}',code) or template != 'tamiran-local-test':
            self.reply({},400)
            return
        latest.update(code=code,recipient=recipient,calls=latest['calls']+1)
        if latest['rejectNext']:
            latest['rejectNext']=False
            self.reply({},503)
            return
        self.reply({'return':{'status':200},'entries':[{'messageid':latest['calls']}]})

class Proxy(JSONHandler):
    def do_CONNECT(self):
        if self.path!='api.kavenegar.com:443':
            self.send_error(403)
            return
        self.send_response_only(200,'Connection Established')
        self.end_headers()
        with tls.wrap_socket(self.connection,server_side=True) as wire:
            Provider(wire,self.client_address,self.server)

    def do_GET(self):
        if self.path=='/reject-next':
            latest['rejectNext']=True
        self.reply(latest if self.path in ('/state','/reject-next') else {},200 if self.path in ('/state','/reject-next') else 404)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cert',required=True)
    parser.add_argument('--key',required=True)
    parser.add_argument('--port',type=int,default=9357)
    args=parser.parse_args()
    tls.load_cert_chain(args.cert,args.key)
    ThreadingHTTPServer(('127.0.0.1',args.port),Proxy).serve_forever()
