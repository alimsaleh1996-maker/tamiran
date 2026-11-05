import type { D1Like, ServerScope } from './server-scope';
import { ReceptionError } from './reception-repository.ts';
import { canonicalJson, sha256, utcDate } from './reception-terms.ts';
import { encryptDeviceSecret } from './device-secret.ts';

export type ReceptionOptionsInput={assignmentMode?:'automatic'|'queue';assignedToUserId?:number|null;preapprovedAmount?:number;diagnosticFeePolicy?:Record<string,unknown>;promisedAt?:string|null;temporaryDeviceSecret?:string|null};
const ELIGIBLE_SQL=`SELECT u.id FROM tamiran_users u JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.shop_id=? AND ub.branch_id=? AND u.is_active=1 AND ub.is_active=1 AND ub.branch_role_code='technician' ORDER BY u.id`;
const ASSIGNEE_SQL=`SELECT u.id FROM tamiran_users u JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id WHERE u.id=? AND u.shop_id=? AND ub.branch_id=? AND u.is_active=1 AND ub.is_active=1 AND u.role_code IN ('repair_manager','technician','quality_control') AND ub.branch_role_code IN ('repair_manager','technician','quality_control')`;

export function normalizeReceptionOptions(input:ReceptionOptionsInput){
  const mode=input.assignmentMode??'automatic',requestedId=input.assignedToUserId??null,amount=input.preapprovedAmount??0;
  if(!['automatic','queue'].includes(mode))throw new ReceptionError('روش تخصیص اولیه معتبر نیست.',400);
  if(requestedId!==null&&(!Number.isSafeInteger(requestedId)||requestedId<1))throw new ReceptionError('شناسه مسئول پرونده معتبر نیست.',400);
  if(!Number.isSafeInteger(amount)||amount<0)throw new ReceptionError('سقف تأیید هزینه باید عدد صحیح نامنفی باشد.',400);
  if(input.promisedAt!=null&&typeof input.promisedAt!=='string')throw new ReceptionError('موعد تحویل معتبر نیست.',400);
  const promisedAt=input.promisedAt?.trim()||null;if(promisedAt)utcDate(promisedAt);
  if(input.temporaryDeviceSecret!=null&&typeof input.temporaryDeviceSecret!=='string')throw new ReceptionError('رمز موقت دستگاه معتبر نیست.',400);
  const secret=input.temporaryDeviceSecret?.trim()||null;
  if(secret&&new TextEncoder().encode(secret).length>500)throw new ReceptionError('رمز موقت دستگاه بیش از حد طولانی است.',400);
  const diagnostic=input.diagnosticFeePolicy??{source:'shop_service_policy'};
  if(typeof diagnostic!=='object'||Array.isArray(diagnostic))throw new ReceptionError('سیاست عیب‌یابی معتبر نیست.',400);
  return{mode,requestedId,amount,promisedAt,secret,diagnosticJson:canonicalJson(diagnostic)};
}

export async function optionsFingerprint(input:ReceptionOptionsInput){
  const n=normalizeReceptionOptions(input);
  return{assignmentMode:n.mode,assignedToUserId:n.requestedId,preapprovedAmount:n.amount,promisedAt:n.promisedAt,diagnosticFeePolicy:n.diagnosticJson,temporaryDeviceSecretHash:n.secret?await sha256(n.secret):null};
}

export async function prepareReceptionOptions(db:D1Like,scope:ServerScope,input:ReceptionOptionsInput,caseUuid:string,now:string,key?:CryptoKey){
  const n=normalizeReceptionOptions(input),today=utcDate(now);
  const setting=await db.prepare("SELECT value_json FROM repair_shop_settings WHERE shop_id=? AND setting_key='assignment_policy'").bind(scope.shopId).first<{value_json:string}>();
  const raw=setting?.value_json??'null';
  let policy:Record<string,unknown>={};try{const p=JSON.parse(raw);if(p&&typeof p==='object'&&!Array.isArray(p))policy=p;}catch{throw new ReceptionError('سیاست تخصیص معتبر نیست.',409);}
  const branches=policy.branches&&typeof policy.branches==='object'&&!Array.isArray(policy.branches)?policy.branches as Record<string,unknown>:{};
  const candidate=branches[String(scope.branchId)];
  const bp=candidate&&typeof candidate==='object'&&!Array.isArray(candidate)?candidate as Record<string,unknown>:{};
  // Preserve PHP empty() semantics for legacy JSON setting values, including string '0'.
  const flag=bp.autoAssignSingleTechnician;
  const autoSingle=flag===undefined||!(flag===null||flag===false||flag===0||flag===''||flag==='0'||Array.isArray(flag)&&flag.length===0);
  const defaultId=typeof bp.defaultTechnicianId==='string'&&/^\d+$/.test(bp.defaultTechnicianId)?Number(bp.defaultTechnicianId):bp.defaultTechnicianId;
  const eligible=(await db.prepare(ELIGIBLE_SQL).bind(scope.shopId,scope.branchId).all<{id:number}>()).results.map(row=>row.id);
  let assignedId:number|null=null;
  if(scope.productProfile==='pro'){
    if(n.requestedId!==null && !await db.prepare(ASSIGNEE_SQL).bind(n.requestedId,scope.shopId,scope.branchId).first())throw new ReceptionError('کاربر مقصد در این شعبه فعال و مجاز نیست.',409);
    if(autoSingle&&eligible.length===1)assignedId=eligible[0];
    else if(n.mode!=='queue'){
      if(n.requestedId!==null)assignedId=n.requestedId;
      else if(Number.isSafeInteger(defaultId)&&eligible.includes(defaultId as number))assignedId=defaultId as number;
    }
  }
  if(n.secret&&!key)throw new ReceptionError('کلید رمزنگاری رمز موقت دستگاه تنظیم نشده است.',503);
  const ciphertext=n.secret?await encryptDeviceSecret(key!,scope.shopId,caseUuid,n.secret):null;
  const expiry=n.secret?new Date(today.getTime()+7*86400000).toISOString().slice(0,19).replace('T',' '):null;
  const guard=db.prepare(`SELECT CASE WHEN
    COALESCE((SELECT value_json FROM repair_shop_settings WHERE shop_id=? AND setting_key='assignment_policy'),'null')=?
    AND (SELECT json_group_array(id) FROM (${ELIGIBLE_SQL}))=?
    AND (? IS NULL OR EXISTS(${ASSIGNEE_SQL}))
    AND EXISTS(SELECT 1 FROM repair_shops WHERE id=? AND product_profile=? AND inventory_mode=? AND qc_mode=? AND json(feature_flags_json)=json(?))
    THEN 1 ELSE json_extract('[]','$[') END`).bind(scope.shopId,raw,scope.shopId,scope.branchId,JSON.stringify(eligible),assignedId,assignedId,scope.shopId,scope.branchId,scope.shopId,scope.productProfile,scope.inventoryMode,scope.qcMode,JSON.stringify(scope.featureFlags));
  return{...n,assignedId,ciphertext,secretExpiresAt:expiry,status:scope.productProfile==='solo'?'diagnosing':assignedId===null?'awaiting_assignment':'assigned',guard};
}
