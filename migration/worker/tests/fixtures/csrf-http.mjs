// Existing HTTP scenarios acquire an actual server-issued token; no runtime bypass.
import {createReceptionReadHttpHandler} from '../../lib/reception-contract-http.ts';
export function withCsrf(handler,deps){return async request=>{
 const read=createReceptionReadHttpHandler(deps),tokenResponse=await read(new Request(new URL('/api/csrf.php?branchId=1',request.url),{headers:{Origin:new URL(request.url).origin}}));
 if(tokenResponse.status!==200)return handler(request);
 const token=(await tokenResponse.json()).data.csrf_token,headers=new Headers(request.headers);headers.set('X-CSRF-Token',token);
 return handler(new Request(request,{headers}));
}}
