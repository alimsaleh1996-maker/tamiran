import type {ServerScope} from './server-scope';
import {encryptDeviceSecret,decryptDeviceSecret} from './device-secret.ts';
import {utcDate} from './reception-terms.ts';
import {ReceptionError} from './reception-repository.ts';
const subject=(s:ServerScope)=>`csrf:${s.accountUserId}:${s.userId}:${s.branchId}`;
export async function issueReceptionCsrf(key:CryptoKey,scope:ServerScope,now:string){
  const issued=utcDate(now).getTime();
  return encryptDeviceSecret(key,scope.shopId,subject(scope),JSON.stringify({issued,expires:issued+8*3600000}));
}
export async function verifyReceptionCsrf(key:CryptoKey,scope:ServerScope,token:string|null,now:string){
  try{
    if(!token||token.length>512)throw new Error('Missing or large CSRF');
    const value=JSON.parse(await decryptDeviceSecret(key,scope.shopId,subject(scope),token)),clock=utcDate(now).getTime();
    if(!Number.isSafeInteger(value.issued)||!Number.isSafeInteger(value.expires)||value.issued>clock||value.expires<=clock||value.expires-value.issued!==8*3600000)throw new Error('Expired CSRF');
  }catch{throw new ReceptionError('نشست امن منقضی یا نامعتبر است؛ دوباره دریافت کنید.',419)}
}
