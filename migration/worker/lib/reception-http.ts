import {verifyReceptionCsrf} from './reception-csrf.ts';
import { z } from 'zod';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import { resolveServerScope, ScopeError, type D1Like, type ServerScope } from './server-scope.ts';
import { ReceptionError } from './reception-repository.ts';
import { createReceptionWithNewDevice } from './reception-new-device.ts';
import { issuePortalToken, recoverPortalToken } from './portal-token.ts';
import { utcDate } from './reception-terms.ts';
import { requireActiveAppSession } from './auth-session.ts';

const text=z.string();
const optionalText=text.nullish();
const positive=z.number().int().positive().safe();
const schema=z.object({
  action:z.literal('create_case'),branchId:positive.optional(),idempotencyKey:text.min(1).max(160),draftPublicId:text.min(1).max(26).optional(),draftExpectedVersion:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  customerName:text.min(1).max(180),customerMobile:text.max(30),secondaryMobile:optionalText,nationalCode:optionalText,
  customerAddress:optionalText,customerProvince:optionalText,customerCity:optionalText,customerPostalCode:optionalText,
  deviceModelId:positive,previousDeviceId:positive.optional(),expectedDeviceVersion:z.number().int().nonnegative().safe().optional(),identifier:optionalText,color:optionalText,
  declaredIssue:text.min(1).max(4000),accessories:z.array(text).max(40),appearanceStates:z.array(text).max(40),receptionNotes:optionalText,
  assignedToUserId:positive.nullish(),assignmentMode:z.enum(['automatic','queue']).optional(),preapprovedAmount:z.number().int().nonnegative().safe().optional(),
  promisedAt:optionalText,temporaryDeviceSecret:optionalText,diagnosticFeePolicy:z.record(z.unknown()).optional(),
  customerConsent:z.object({dataHandling:z.enum(['no_erasure','coordinate_first','erase_authorized']),acceptanceMethod:z.enum(['digital_signature','in_person_signature','sms_otp','recorded_consent']).optional()}).strict(),
  receiptAcceptance:z.object({versionId:positive,contentSha256:text.regex(/^[a-f0-9]{64}$/),accepted:z.literal(true),evidence:z.record(z.unknown()).optional()}).strict(),
}).strict();
export type ReceptionHttpDependencies={getUser:()=>Promise<ChatGPTUser|null>;getDb:()=>Promise<D1Like|null>;getKey:()=>Promise<CryptoKey|null>;now:()=>string;requireAppSession?:boolean};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const publicId=()=>crypto.randomUUID().replace(/-/g,'').slice(0,26);
export async function boundedJson(request:Request,maxBytes=32768){
  const reader=request.body?.getReader();if(!reader)throw new ReceptionError('بدنه درخواست الزامی است.',400);
  let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new ReceptionError('حجم درخواست بیش از حد مجاز است.',413)}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new ReceptionError('بدنه JSON معتبر نیست.',400)}
}
export function createReceptionHttpHandler(deps:ReceptionHttpDependencies){
  return async(request:Request):Promise<Response>=>{
    const requestId=crypto.randomUUID();
    try{
      const url=new URL(request.url);
      if(request.method!=='POST')throw new ReceptionError('روش درخواست مجاز نیست.',405);
      if(url.pathname!=='/api/operations.php')throw new ReceptionError('این API هنوز منتقل نشده است.',503);
      if(url.search)throw new ReceptionError('پارامترهای نشانی برای ثبت پذیرش مجاز نیستند.',400);
      if(request.headers.get('Origin')!==url.origin)throw new ReceptionError('مبدأ درخواست معتبر نیست.',403);
      if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ReceptionError('نوع بدنه باید JSON باشد.',415);
      const user=await deps.getUser();if(!user)throw new ScopeError('ورود با حساب ChatGPT الزامی است.',401);
      const raw=await boundedJson(request);
      if(raw&&typeof raw==='object'&&raw.action!=='create_case')throw new ReceptionError('این عملیات هنوز منتقل نشده است.',503);
      const parsed=schema.safeParse(raw);if(!parsed.success)throw new ReceptionError('اطلاعات درخواست پذیرش معتبر نیست.',400);
      const body=parsed.data;
      if((body.previousDeviceId!==undefined)!==(body.expectedDeviceVersion!==undefined))throw new ReceptionError('شناسه و نسخه دستگاه قبلی باید با هم ارسال شوند.',400);
      if((body.draftPublicId!==undefined)!==(body.draftExpectedVersion!==undefined))throw new ReceptionError('شناسه و نسخه پیش‌نویس باید با هم ارسال شوند.',400);
      const now=deps.now();utcDate(now);
      const db=await deps.getDb();if(!db)throw new ReceptionError('پایگاه داده آماده نیست.',503);
      const scope=await resolveServerScope(db,user,{branchId:body.branchId,today:now.slice(0,10)});
      if(deps.requireAppSession)await requireActiveAppSession(db,user,scope,request);
      if(!['repair_manager','reception'].includes(scope.role))throw new ScopeError('ثبت پذیرش برای نقش فعلی مجاز نیست.',403);
      const key=await deps.getKey();if(!key)throw new ReceptionError('کلید امن پذیرش تنظیم نشده است.',503);
      await verifyReceptionCsrf(key,scope,request.headers.get('X-CSRF-Token'),now);
      const caseUuid=crypto.randomUUID(),token=await issuePortalToken(key,scope.shopId,caseUuid);
      const result=await createReceptionWithNewDevice(db,scope,{
        ...body,customer:{publicId:publicId(),fullName:body.customerName,mobile:body.customerMobile,secondaryMobile:body.secondaryMobile,nationalCode:body.nationalCode,address:body.customerAddress,province:body.customerProvince,city:body.customerCity,postalCode:body.customerPostalCode},
        device:{publicId:publicId(),modelId:body.deviceModelId,color:body.color,identifier:body.identifier,previousDeviceId:body.previousDeviceId,expectedVersion:body.expectedDeviceVersion},
        publicId:publicId(),caseUuid,workflowPublicId:publicId(),stageEventPublicId:publicId(),auditPublicId:publicId(),receiptTermsPublicId:publicId(),portalTokenPublicId:publicId(),
        trackingTokenHash:token.hash,trackingTokenCiphertext:token.ciphertext,requestId,ipAddress:'',userAgent:request.headers.get('User-Agent')?.slice(0,500)??null,now,
      },key);
      const repairCase=await readCreatedCase(db,scope,result.caseId,key);
      return Response.json({ok:true,data:{created:result.created,replayed:result.replayed,repairCase}},{headers});
    }catch(error){
      const known=error instanceof ReceptionError||error instanceof ScopeError;
      return Response.json({ok:false,error:{message:known?error.message:'ثبت پذیرش انجام نشد؛ درخواست را با همان شناسه پیگیری کنید.',tracking_code:requestId}},{status:known?error.status:500,headers});
    }
  };
}

type CaseReadback={id:number;publicId:string;caseUuid:string;receiptNumber:string;receiptSequence:number;branchCode:string;customerId:number;customerName:string;customerMobile:string;nationalCode:string;customerAddress:string;customerProvince:string;customerCity:string;customerPostalCode:string;secondaryMobile:string;deviceId:number;deviceType:string;brand:string;model:string;identifier:string;color:string;declaredIssue:string;receptionNotes:string;status:string;result:string;operationReport:string;deliveryAmount:number;deliveredToName:string;deliveryNotes:string;assignedToUserId:number|null;assignedToName:string;createdByName:string;createdAt:string;updatedAt:string;deliveredAt:string|null;deliveredByName:string;promisedAt:string|null;accessoriesJson:string;appearanceJson:string;consentJson:string;ciphertext:string;tokenHash:string};
async function readCreatedCase(db:D1Like,scope:ServerScope,id:number,key:CryptoKey){
  const row=await db.prepare(`SELECT c.id,c.public_id AS publicId,c.case_uuid AS caseUuid,c.receipt_number AS receiptNumber,c.receipt_sequence AS receiptSequence,b.branch_code AS branchCode,
  cu.id AS customerId,cu.full_name AS customerName,cu.mobile AS customerMobile,COALESCE(cu.national_code,'') AS nationalCode,COALESCE(cu.address,'') AS customerAddress,COALESCE(cu.province,'') AS customerProvince,COALESCE(cu.city,'') AS customerCity,COALESCE(cu.postal_code,'') AS customerPostalCode,COALESCE(cu.secondary_mobile,'') AS secondaryMobile,
  c.device_id AS deviceId,c.device_type_snapshot AS deviceType,c.brand_snapshot AS brand,c.model_snapshot AS model,COALESCE(c.identifier_snapshot,'') AS identifier,COALESCE(c.color_snapshot,'') AS color,c.declared_issue AS declaredIssue,c.accessories_json AS accessoriesJson,c.appearance_states_json AS appearanceJson,COALESCE(c.reception_notes,'') AS receptionNotes,c.status,COALESCE(c.result,'') AS result,COALESCE(c.operation_report,'') AS operationReport,c.delivery_amount AS deliveryAmount,COALESCE(c.delivered_to_name,'') AS deliveredToName,COALESCE(c.delivery_notes,'') AS deliveryNotes,c.assigned_to_user_id AS assignedToUserId,COALESCE(a.display_name,'') AS assignedToName,creator.display_name AS createdByName,c.created_at AS createdAt,c.updated_at AS updatedAt,c.delivered_at AS deliveredAt,COALESCE(deliverer.display_name,'') AS deliveredByName,w.promised_at AS promisedAt,w.customer_consent_json AS consentJson,c.tracking_token_ciphertext AS ciphertext,c.tracking_token_hash AS tokenHash
  FROM repair_cases c JOIN repair_customers cu ON cu.id=c.customer_id AND cu.shop_id=c.shop_id JOIN repair_branches b ON b.id=c.branch_id AND b.shop_id=c.shop_id JOIN repair_case_workflows w ON w.case_id=c.id AND w.shop_id=c.shop_id JOIN tamiran_users creator ON creator.id=c.created_by_user_id AND creator.shop_id=c.shop_id LEFT JOIN tamiran_users a ON a.id=c.assigned_to_user_id AND a.shop_id=c.shop_id LEFT JOIN tamiran_users deliverer ON deliverer.id=c.delivered_by_user_id AND deliverer.shop_id=c.shop_id WHERE c.id=? AND c.shop_id=? AND c.branch_id=?`).bind(id,scope.shopId,scope.branchId).first<CaseReadback>();
  if(!row)throw new ReceptionError('پرونده ثبت‌شده قابل بازیابی نیست.',500);
  const {accessoriesJson,appearanceJson,consentJson,ciphertext,tokenHash,...record}=row;
  const token=await recoverPortalToken(key,scope.shopId,row.caseUuid,ciphertext,tokenHash);
  const events=(await db.prepare(`SELECT e.id,e.event_type AS eventType,e.from_status AS fromStatus,e.to_status AS toStatus,e.description,u.display_name AS actorName,e.created_at AS createdAt FROM repair_case_events e JOIN repair_cases c ON c.id=e.case_id JOIN tamiran_users u ON u.id=e.actor_user_id AND u.shop_id=c.shop_id WHERE c.id=? AND c.shop_id=? AND c.branch_id=? ORDER BY e.id`).bind(id,scope.shopId,scope.branchId).all()).results;
  return{...record,trackingUrl:`/?portal=${token}`,accessories:JSON.parse(accessoriesJson),appearanceStates:JSON.parse(appearanceJson),dataHandling:JSON.parse(consentJson).dataHandling,events};
}
