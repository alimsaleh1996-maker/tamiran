import {ReceptionError} from './reception-repository.ts';
import {sha256,utcDate} from './reception-terms.ts';
import type {D1Like,ServerScope} from './server-scope';

type DraftRow={public_id:string;shop_id:number;branch_id:number;created_by_user_id:number;payload_json:string;payload_sha256:string;idempotency_key:string;status:string;lock_version:number;expires_at:string;created_at:string;updated_at:string};
export type DraftInput={idempotencyKey:string;payload:Record<string,unknown>;expectedVersion?:number};
function permitted(scope:ServerScope){if(!['repair_manager','reception'].includes(scope.role))throw new ReceptionError('دسترسی به پیش‌نویس پذیرش مجاز نیست.',403)}
function owned(row:DraftRow,scope:ServerScope){return row.shop_id===scope.shopId&&row.branch_id===scope.branchId&&row.created_by_user_id===scope.userId}
function bytes(v:string){return new TextEncoder().encode(v)}
function aad(scope:ServerScope,id:string){return bytes(`tamiran:draft:v1:${scope.shopId}:${scope.branchId}:${scope.userId}:${id}`)}
function encode(v:Uint8Array){return btoa(String.fromCharCode(...v)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decode(v:string){if(!/^[A-Za-z0-9_-]+$/.test(v))throw new Error('Invalid envelope');return Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0))}
function serialize(payload:Record<string,unknown>){
  function normalize(v:unknown,depth:number):unknown{
    if(depth>12)throw new ReceptionError('پیش‌نویس بیش از حد پیچیده است.',400);
    if(v===null||typeof v==='boolean'||typeof v==='string')return v;
    if(typeof v==='number'&&Number.isFinite(v))return v;
    if(Array.isArray(v))return v.map(x=>normalize(x,depth+1));
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,normalize(x,depth+1)]));
    throw new ReceptionError('پیش‌نویس باید JSON معتبر باشد.',400);
  }
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new ReceptionError('پیش‌نویس معتبر نیست.',400);
  const raw=JSON.stringify(normalize(payload,0));if(bytes(raw).length>65536)throw new ReceptionError('حجم پیش‌نویس پذیرش بیش از حد مجاز است.',413);return raw;
}
async function encrypt(key:CryptoKey,scope:ServerScope,id:string,raw:string){const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(scope,id)},key,bytes(raw));return JSON.stringify({version:1,ciphertext:`v1.${encode(iv)}.${encode(new Uint8Array(data))}`})}
async function decrypt(key:CryptoKey,scope:ServerScope,row:DraftRow){
  try{const envelope=JSON.parse(row.payload_json),[version,nonce,value,...extra]=envelope.ciphertext.split('.');if(envelope.version!==1||version!=='v1'||extra.length)throw new Error('Invalid envelope');const iv=decode(nonce);if(iv.length!==12)throw new Error('Invalid nonce');const data=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(scope,row.public_id)},key,decode(value));const raw=new TextDecoder('utf-8',{fatal:true}).decode(data);if(await sha256(raw)!==row.payload_sha256)throw new Error('Digest mismatch');return JSON.parse(raw)}catch{throw new ReceptionError('یکپارچگی پیش‌نویس تأیید نشد.',409)}
}
function scopeGuard(db:D1Like,scope:ServerScope,now:string){return db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM tamiran_users u JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id JOIN repair_shops s ON s.id=u.shop_id WHERE u.id=? AND u.account_user_id=? AND u.shop_id=? AND b.id=? AND u.is_active=1 AND ub.is_active=1 AND b.is_active=1 AND ub.branch_role_code=? AND ub.branch_role_code IN ('repair_manager','reception') AND s.lifecycle_status='active' AND s.license_started_at<=? AND s.license_expires_at>=?) THEN 1 ELSE json_extract('[]','$[') END`).bind(scope.userId,scope.accountUserId,scope.shopId,scope.branchId,scope.role,now.slice(0,10),now.slice(0,10))}
async function byKey(db:D1Like,scope:ServerScope,idempotencyKey:string){return db.prepare('SELECT * FROM repair_reception_drafts WHERE shop_id=? AND idempotency_key=?').bind(scope.shopId,idempotencyKey).first<DraftRow>()}
function result(row:DraftRow,replayed:boolean){return {saved:true,publicId:row.public_id,expiresAt:row.expires_at,version:row.lock_version,replayed}}
function audit(db:D1Like,scope:ServerScope,now:string,action:string,id:string,version:number,envelope:string){return db.prepare(`INSERT INTO tamiran_audit_log(public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,after_json,request_id,ip_address,created_at) SELECT ?,?,?,?,?,'reception_draft',public_id,json_object('version',lock_version,'status',status),?,'',? FROM repair_reception_drafts WHERE public_id=? AND lock_version=? AND payload_json=?`).bind(crypto.randomUUID().replace(/-/g,'').slice(0,26),scope.shopId,scope.branchId,scope.userId,action,crypto.randomUUID(),now,id,version,envelope)}
export async function saveReceptionDraft(db:D1Like,scope:ServerScope,input:DraftInput,key:CryptoKey,now:string){
  permitted(scope);utcDate(now);if(!input.idempotencyKey?.trim()||input.idempotencyKey.length>160)throw new ReceptionError('شناسه پیش‌نویس معتبر نیست.',400);
  if(input.expectedVersion!==undefined&&(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0))throw new ReceptionError('نسخه پیش‌نویس معتبر نیست.',400);
  const raw=serialize(input.payload),digest=await sha256(raw),existing=await byKey(db,scope,input.idempotencyKey);
  if(existing&&(!owned(existing,scope)||existing.status!=='active'))throw new ReceptionError('پیش‌نویس قابل ویرایش پیدا نشد.',409);
  if(existing&&existing.payload_sha256===digest&&existing.expires_at>now){await db.batch([scopeGuard(db,scope,now),db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM repair_reception_drafts WHERE public_id=? AND status='active' AND payload_sha256=? AND expires_at>?) THEN 1 ELSE json_extract('[]','$[') END").bind(existing.public_id,digest,now)]);return result(existing,true)}
  if(existing&&input.expectedVersion!==existing.lock_version)throw new ReceptionError('پیش‌نویس تغییر کرده است؛ دوباره بازیابی کنید.',409);
  if(!existing&&input.expectedVersion!==undefined)throw new ReceptionError('پیش‌نویس قابل ویرایش پیدا نشد.',409);
  const policy=await db.prepare('SELECT reception_draft_days FROM tamiran_data_retention_policies WHERE shop_id=?').bind(scope.shopId).first<{reception_draft_days:number}>();
  const days=Math.max(1,Math.min(90,policy?.reception_draft_days||30)),expiry=utcDate(now);expiry.setUTCDate(expiry.getUTCDate()+days);const expiresAt=expiry.toISOString().slice(0,19).replace('T',' ');
  const id=existing?.public_id??crypto.randomUUID().replace(/-/g,'').slice(0,26),version=existing?existing.lock_version+1:0,envelope=await encrypt(key,scope,id,raw);
  const write=existing?db.prepare(`UPDATE repair_reception_drafts SET payload_json=?,payload_sha256=?,expires_at=?,updated_at=?,lock_version=lock_version+1 WHERE public_id=? AND shop_id=? AND branch_id=? AND created_by_user_id=? AND status='active' AND lock_version=?`).bind(envelope,digest,expiresAt,now,id,scope.shopId,scope.branchId,scope.userId,input.expectedVersion):db.prepare(`INSERT INTO repair_reception_drafts(public_id,shop_id,branch_id,created_by_user_id,payload_json,payload_sha256,idempotency_key,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(shop_id,idempotency_key) DO NOTHING`).bind(id,scope.shopId,scope.branchId,scope.userId,envelope,digest,input.idempotencyKey,expiresAt,now,now);
  const verify=db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM repair_reception_drafts WHERE shop_id=? AND branch_id=? AND created_by_user_id=? AND idempotency_key=? AND payload_sha256=? AND status='active') THEN 1 ELSE json_extract('[]','$[') END`).bind(scope.shopId,scope.branchId,scope.userId,input.idempotencyKey,digest);
  try{await db.batch([scopeGuard(db,scope,now),...(existing?[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM repair_reception_drafts WHERE public_id=? AND status='active' AND lock_version=?) THEN 1 ELSE json_extract('[]','$[') END").bind(id,input.expectedVersion)]:[]),write,verify,audit(db,scope,now,'draft.save',id,version,envelope)])}catch{throw new ReceptionError('ذخیره پیش‌نویس انجام نشد؛ دسترسی یا نسخه را دوباره بررسی کنید.',409)}
  const stored=await byKey(db,scope,input.idempotencyKey);if(!stored||!owned(stored,scope)||stored.payload_sha256!==digest)throw new ReceptionError('پیش‌نویس تغییر کرده است؛ دوباره بازیابی کنید.',409);return result(stored,stored.public_id!==id);
}
export async function listReceptionDrafts(db:D1Like,scope:ServerScope,key:CryptoKey,now:string){
  permitted(scope);utcDate(now);await db.batch([scopeGuard(db,scope,now)]);
  const rows=(await db.prepare(`SELECT * FROM repair_reception_drafts WHERE shop_id=? AND branch_id=? AND created_by_user_id=? AND status='active' AND expires_at>? ORDER BY updated_at DESC,id DESC LIMIT 20`).bind(scope.shopId,scope.branchId,scope.userId,now).all<DraftRow>()).results;
  return Promise.all(rows.map(async row=>({publicId:row.public_id,payload:await decrypt(key,scope,row),idempotencyKey:row.idempotency_key,expiresAt:row.expires_at,createdAt:row.created_at,updatedAt:row.updated_at,version:row.lock_version})));
}
export async function discardReceptionDraft(db:D1Like,scope:ServerScope,id:string,now:string,expectedVersion?:number){
  permitted(scope);utcDate(now);const row=await db.prepare('SELECT * FROM repair_reception_drafts WHERE shop_id=? AND branch_id=? AND created_by_user_id=? AND public_id=?').bind(scope.shopId,scope.branchId,scope.userId,id).first<DraftRow>();
  if(!row||!['active','discarded'].includes(row.status))throw new ReceptionError('پیش‌نویس فعال پیدا نشد.',404);
  if(row.status==='discarded'){await db.batch([scopeGuard(db,scope,now)]);return {discarded:true,replayed:true}}
  if(expectedVersion===undefined||expectedVersion!==row.lock_version)throw new ReceptionError('نسخه پیش‌نویس تغییر کرده است.',409);
  try{await db.batch([scopeGuard(db,scope,now),db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM repair_reception_drafts WHERE public_id=? AND status='active' AND lock_version=?) THEN 1 ELSE json_extract('[]','$[') END").bind(id,expectedVersion),db.prepare(`UPDATE repair_reception_drafts SET status='discarded',lock_version=lock_version+1,updated_at=? WHERE public_id=? AND shop_id=? AND branch_id=? AND created_by_user_id=? AND status='active' AND lock_version=?`).bind(now,id,scope.shopId,scope.branchId,scope.userId,expectedVersion),db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM repair_reception_drafts WHERE public_id=? AND status='discarded' AND lock_version=?) THEN 1 ELSE json_extract('[]','$[') END`).bind(id,expectedVersion+1),audit(db,scope,now,'draft.discard',id,expectedVersion+1,row.payload_json)])}catch{throw new ReceptionError('حذف پیش‌نویس انجام نشد؛ نسخه یا دسترسی تغییر کرده است.',409)}return {discarded:true,replayed:false};
}

// Guard the exact reviewed snapshot again in the reception transaction.
export async function prepareDraftSubmission(db:D1Like,scope:ServerScope,id:string,idempotencyKey:string,now:string,expectedVersion?:number){
 permitted(scope);utcDate(now);
 if(!id||id.length>26||!Number.isSafeInteger(expectedVersion)||expectedVersion!<0)throw new ReceptionError('نسخه یا شناسه پیش‌نویس معتبر نیست.',400);
 const row=await db.prepare("SELECT * FROM repair_reception_drafts WHERE public_id=? AND shop_id=? AND branch_id=? AND created_by_user_id=? AND idempotency_key=? AND status='active' AND expires_at>? AND lock_version=?").bind(id,scope.shopId,scope.branchId,scope.userId,idempotencyKey,now,expectedVersion).first<DraftRow>();
 if(!row)throw new ReceptionError('پیش‌نویس تغییر کرده یا برای این پذیرش معتبر نیست.',409);
 return {
  guard:db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM repair_reception_drafts WHERE public_id=? AND shop_id=? AND branch_id=? AND created_by_user_id=? AND idempotency_key=? AND status='active' AND expires_at>? AND lock_version=? AND payload_json=? AND payload_sha256=?) THEN 1 ELSE json_extract('[]','$[') END").bind(id,scope.shopId,scope.branchId,scope.userId,idempotencyKey,now,expectedVersion,row.payload_json,row.payload_sha256),
  submit:db.prepare("UPDATE repair_reception_drafts SET status='submitted',submitted_case_id=(SELECT id FROM repair_cases WHERE shop_id=? AND branch_id=? AND created_by_user_id=? AND idempotency_key=?),lock_version=lock_version+1,updated_at=? WHERE public_id=? AND shop_id=? AND branch_id=? AND created_by_user_id=? AND status='active' AND lock_version=?").bind(scope.shopId,scope.branchId,scope.userId,idempotencyKey,now,id,scope.shopId,scope.branchId,scope.userId,expectedVersion),
  check:db.prepare("SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('[]','$[') END").bind(),
 };
}
