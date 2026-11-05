import type { D1Like } from './server-scope';
import { ReceptionError } from './reception-repository.ts';
import { sha256, utcDate } from './reception-terms.ts';

function encode(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(value: string): Uint8Array {
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw new ReceptionError('شناسه امن پرونده معتبر نیست.',409);
  try{return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));}catch{throw new ReceptionError('شناسه امن پرونده معتبر نیست.',409);}
}
function context(shopId: number, caseUuid: string): Uint8Array<ArrayBuffer> {
  if(!Number.isSafeInteger(shopId)||shopId<1||!caseUuid)throw new ReceptionError('محدوده توکن معتبر نیست.',400);
  return new TextEncoder().encode(`tamiran:portal:v1:${shopId}:${caseUuid}`);
}
export async function importPortalKey(bytes: Uint8Array): Promise<CryptoKey> {
  if(bytes.length!==32)throw new ReceptionError('کلید رمزنگاری پرتال باید ۲۵۶ بیت باشد.',500);
  return crypto.subtle.importKey('raw',Uint8Array.from(bytes),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function issuePortalToken(key: CryptoKey, shopId: number, caseUuid: string) {
  const raw=encode(crypto.getRandomValues(new Uint8Array(32))),iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context(shopId,caseUuid)},key,new TextEncoder().encode(raw));
  return {raw,hash:await sha256(raw),ciphertext:`v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`};
}
export async function recoverPortalToken(key: CryptoKey, shopId: number, caseUuid: string, ciphertext: string, expectedHash: string): Promise<string> {
  try{
    const [version,iv,data,...extra]=ciphertext.split('.');
    if(version!=='v1'||extra.length)throw new Error('Invalid envelope');
    const nonce=decode(iv);if(nonce.length!==12)throw new Error('Invalid nonce');
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(nonce),additionalData:context(shopId,caseUuid)},key,Uint8Array.from(decode(data)));
    const raw=new TextDecoder().decode(plaintext);
    if(!/^[A-Za-z0-9_-]{43}$/.test(raw)||await sha256(raw)!==expectedHash)throw new Error('Hash mismatch');
    return raw;
  }catch{throw new ReceptionError('یکپارچگی شناسه امن پرونده تأیید نشد.',409);}
}
export function portalExpiry(now: string): string {
  const date=utcDate(now);date.setUTCDate(date.getUTCDate()+400);
  return date.toISOString().slice(0,19).replace('T',' ');
}
export async function resolvePortalToken(db: D1Like, raw: string, now: string) {
  utcDate(now);
  if(!/^[A-Za-z0-9_-]{43}$/.test(raw))throw new ReceptionError('لینک پرونده نامعتبر یا منقضی است.',404);
  const row=await db.prepare(`SELECT c.id AS caseId,c.public_id AS casePublicId,c.shop_id AS shopId,c.branch_id AS branchId
    FROM repair_portal_tokens p JOIN repair_cases c ON c.shop_id=p.shop_id AND c.id=p.case_id AND c.tracking_token_hash=p.token_hash
    WHERE p.token_hash=? AND p.revoked_at IS NULL AND p.expires_at>=? LIMIT 1`).bind(await sha256(raw),now).first<{caseId:number;casePublicId:string;shopId:number;branchId:number}>();
  if(!row)throw new ReceptionError('لینک پرونده نامعتبر یا منقضی است.',404);
  return row;
}
