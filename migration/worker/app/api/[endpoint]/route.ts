import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { migrationApiGate } from '../../../lib/api-gate';
import { createCasePatchHttpHandler, createReceptionReadHttpHandler, createReceptionPostHttpHandler } from '../../../lib/reception-contract-http';
import { importPortalKey } from '../../../lib/portal-token';
import type { D1Like } from '../../../lib/server-scope';
import { createAuthSessionHttpHandler } from '../../../lib/auth-session-http';
export const dynamic = 'force-dynamic';
const dependencies = {
  getUser:getChatGPTUser,
  getDb:async()=>env.DB as D1Like|undefined??null,
  getKey:async()=>{
    const raw=env.TAMIRAN_DATA_KEY;
    if(!raw)return null;
    try{if(!/^[A-Za-z0-9+/]{43}=$/.test(raw))return null;return await importPortalKey(Uint8Array.from(atob(raw),ch=>ch.charCodeAt(0)))}catch{return null}
  },
  now:()=>new Date().toISOString().slice(0,19).replace('T',' '),
  requireAppSession:true,
};
export const GET = createReceptionReadHttpHandler(dependencies);
const authSession=createAuthSessionHttpHandler(dependencies);
const receptionPost=createReceptionPostHttpHandler(dependencies);
export const POST = (request:Request)=>new URL(request.url).pathname==='/api/auth.php'?authSession(request):receptionPost(request);
export const PUT = migrationApiGate;
export const PATCH = createCasePatchHttpHandler(dependencies);
export const DELETE = (request:Request)=>new URL(request.url).pathname==='/api/auth.php'?authSession(request):migrationApiGate(request);
