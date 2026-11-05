import type { D1Like, ServerScope } from './server-scope';
import { ReceptionError } from './reception-repository.ts';

export type ReceiptAcceptance = {
  versionId: number;
  contentSha256: string;
  accepted: boolean;
  evidence?: Record<string, unknown>;
};

export const ACTIVE_TERMS_SQL = `SELECT id,title,version_number,body_text,content_sha256
  FROM repair_receipt_term_versions WHERE shop_id=? AND is_active=1 AND effective_from<=?
  AND (effective_to IS NULL OR effective_to>?) ORDER BY version_number DESC LIMIT 1`;

export function canonicalJson(value: unknown): string {
  function normalize(current: unknown, depth: number): unknown {
    if(depth>12)throw new ReceptionError('مدرک پذیرش بیش از حد پیچیده است.',400);
    if(current===null || typeof current==='string' || typeof current==='boolean')return current;
    if(typeof current==='number' && Number.isFinite(current))return current;
    if(Array.isArray(current))return current.map(v=>normalize(v,depth+1));
    if(current && typeof current==='object')return Object.fromEntries(Object.entries(current).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v,depth+1)]));
    throw new ReceptionError('مدرک پذیرش باید JSON معتبر باشد.',400);
  }
  const result=JSON.stringify(normalize(value,0));
  if(new TextEncoder().encode(result).length>16000)throw new ReceptionError('مدرک پذیرش بیش از حد مجاز است.',400);
  return result;
}

export async function sha256(value: string): Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

export function utcDate(value: string): Date {
  const date=new Date(value.replace(' ','T')+'Z');
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,19).replace('T',' ')!==value)throw new ReceptionError('زمان سرور معتبر نیست.',400);
  return date;
}

export function validateReceiptAcceptance(input: ReceiptAcceptance) {
  if(!input || input.accepted!==true || !Number.isSafeInteger(input.versionId) || input.versionId<1 || !/^[0-9a-f]{64}$/.test(input.contentSha256))throw new ReceptionError('پذیرش نسخه مشخص شرایط الزامی است.',400);
  if(input.evidence!=null && (typeof input.evidence!=='object'||Array.isArray(input.evidence)))throw new ReceptionError('مدرک پذیرش معتبر نیست.',400);
  return canonicalJson(input.evidence??{});
}

export async function prepareReceiptAcceptance(db: D1Like, scope: ServerScope, input: ReceiptAcceptance, method: string, requestId: string, now: string) {
  utcDate(now);
  const details=validateReceiptAcceptance(input);
  if(method==='sms_otp')throw new ReceptionError('ثبت پذیرش پیامکی تا اتصال تأیید واقعی OTP مجاز نیست.',409);
  const term=await db.prepare(ACTIVE_TERMS_SQL).bind(scope.shopId,now,now).first<{id:number;title:string;version_number:number;body_text:string;content_sha256:string}>();
  if(!term || term.id!==input.versionId || term.content_sha256!==input.contentSha256)throw new ReceptionError('شرایط پذیرش تغییر کرده است؛ نسخه فعال را دوباره بررسی کنید.',409);
  if(await sha256(term.body_text)!==term.content_sha256)throw new ReceptionError('یکپارچگی متن شرایط پذیرش تأیید نشد.',409);
  return {
    id:term.id,hash:term.content_sha256,
    evidenceJson:canonicalJson({termTitle:term.title,versionNumber:term.version_number,contentSha256:term.content_sha256,details:JSON.parse(details),recordedByUserId:scope.userId,branchId:scope.branchId,requestId}),
    guard:db.prepare(`SELECT CASE WHEN (SELECT id FROM repair_receipt_term_versions WHERE shop_id=? AND is_active=1 AND effective_from<=? AND (effective_to IS NULL OR effective_to>?) ORDER BY version_number DESC LIMIT 1)=? THEN 1 ELSE json_extract('[]','$[') END`).bind(scope.shopId,now,now,term.id),
  };
}
