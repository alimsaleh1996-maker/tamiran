import {issueReceptionCsrf,verifyReceptionCsrf} from './reception-csrf.ts';
import {z} from 'zod';
import {resolveServerScope,ScopeError,type ServerScope,type D1Like} from './server-scope.ts';
import {boundedJson,createReceptionHttpHandler,type ReceptionHttpDependencies} from './reception-http.ts';
import {createCustomerLookupHttpHandler} from './customer-lookup-http.ts';
import {ReceptionError} from './reception-repository.ts';
import {listReceptionDrafts,saveReceptionDraft,discardReceptionDraft} from './reception-drafts.ts';
import {utcDate} from './reception-terms.ts';
import {readOperationsSnapshot} from './operations-read.ts';
import {readCapabilitySnapshot} from './capabilities-read.ts';
import {readActorContext} from './actor-context.ts';
import {mutateOperationalCase} from './case-mutations.ts';
import {issueAuthCsrf,requireActiveAppSession} from './auth-session.ts';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const positive=z.number().int().positive().safe(),version=z.number().int().nonnegative().safe();
const operationalRoles=new Set(['repair_manager','reception','technician','quality_control','warehouse_keeper','finance_cashier']);
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('save_reception_draft'),branchId:positive.optional(),idempotencyKey:z.string().min(1).max(160),payload:z.record(z.unknown()),expectedVersion:version.optional()}).strict(),
  z.object({action:z.literal('discard_reception_draft'),branchId:positive.optional(),draftPublicId:z.string().min(1).max(80).optional(),publicId:z.string().min(1).max(80).optional(),expectedVersion:version.optional()}).strict(),
]);
const caseMutationSchema=z.object({
  branchId:positive.optional(),id:positive,expectedVersion:version,
  status:z.enum(['awaiting_assignment','assigned','diagnosing','repairing','awaiting_part','awaiting_customer','ready_for_delivery','returned','delivered','cancelled']).optional(),
  assignedToUserId:positive.nullable().optional(),result:z.string().max(32).optional(),operationReport:z.string().max(12000).optional(),reason:z.string().max(1000).optional(),
  deliveryAmount:z.number().int().nonnegative().safe().optional(),deliveredToName:z.string().max(180).optional(),deliveryNotes:z.string().max(4000).optional(),
}).strict().refine(value=>['status','assignedToUserId','result','operationReport','reason','deliveryAmount','deliveredToName','deliveryNotes'].some(key=>Object.hasOwn(value,key)),{message:'هیچ تغییری برای پرونده ارسال نشده است.'});
function failure(error:unknown,requestId:string){const known=error instanceof ScopeError||error instanceof ReceptionError;return Response.json({ok:false,error:{message:known?error.message:'عملیات پذیرش انجام نشد.',tracking_code:requestId}},{status:known?error.status:500,headers})}
async function scopeFor(deps:ReceptionHttpDependencies,branchId:number|null,now:string,request:Request,enforceSession=true){const user=await deps.getUser();if(!user)throw new ScopeError('ورود با حساب ChatGPT الزامی است.',401);const db=await deps.getDb();if(!db)throw new ScopeError('پایگاه داده آماده نیست.',503);const scope=await resolveServerScope(db,user,{branchId,today:now.slice(0,10)});if(enforceSession&&deps.requireAppSession)await requireActiveAppSession(db,user,scope,request);return {db,scope}}
function branchQuery(request:Request,allowed:string[]){const query=new URL(request.url).searchParams;for(const k of query.keys())if(!allowed.includes(k)||query.getAll(k).length!==1)throw new ScopeError('پارامتر درخواست معتبر نیست.',400);const value=query.get('branchId');if(value!==null&&(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value))))throw new ScopeError('شناسه شعبه معتبر نیست.',400);return value===null?null:Number(value)}
function parseJson(value:string):unknown{try{return JSON.parse(value)}catch{throw new ReceptionError('تنظیمات تعمیرگاه معتبر نیست.',409)}}
async function settings(db:D1Like,scope:ServerScope,now:string){
  const row=await db.prepare(`SELECT name,shop_code AS code,repair_type AS repairType,repair_type_locked AS typeLocked,national_code_required AS nationalCodeRequired,plan_code AS plan,license_expires_at AS expiresAt,operation_mode AS operationMode,inventory_cost_method AS inventoryCostMethod,product_profile AS productProfile,inventory_mode AS inventoryMode,qc_mode AS qcMode,allow_self_qc AS allowSelfQc,allow_delivery_with_balance AS allowDeliveryWithBalance,feature_flags_json,workflow_settings_json,tax_settings_json,modules_json FROM repair_shops WHERE id=?`).bind(scope.shopId).first<Record<string,unknown>>();if(!row)throw new ScopeError('تعمیرگاه پیدا نشد.',404);
  const values=Object.fromEntries((await db.prepare('SELECT setting_key,value_json FROM repair_shop_settings WHERE shop_id=?').bind(scope.shopId).all<{setting_key:string;value_json:string}>()).results.map(v=>[v.setting_key,parseJson(v.value_json)]));
  // Include the DB version ID needed by create_case without trusting a client-supplied hash.
  const terms=await db.prepare(`SELECT id AS versionId,public_id,version_number,title,body_text,content_sha256,effective_from FROM repair_receipt_term_versions WHERE shop_id=? AND is_active=1 AND effective_from<=? AND (effective_to IS NULL OR effective_to>?) ORDER BY version_number DESC LIMIT 1`).bind(scope.shopId,now,now).first();
  const {feature_flags_json,workflow_settings_json,tax_settings_json,modules_json,...plain}=row;
  return {shop:{...plain,typeLocked:!!plain.typeLocked,nationalCodeRequired:!!plain.nationalCodeRequired,allowSelfQc:!!plain.allowSelfQc,allowDeliveryWithBalance:!!plain.allowDeliveryWithBalance,featureFlags:parseJson(String(feature_flags_json)),workflowSettings:parseJson(String(workflow_settings_json)),taxSettings:parseJson(String(tax_settings_json)),modules:parseJson(String(modules_json)),licenseStatus:'active'},settings:values,activeReceiptTerms:terms};
}
export function createReceptionReadHttpHandler(deps:ReceptionHttpDependencies){
  const lookup=createCustomerLookupHttpHandler(deps);
  return async(request:Request)=>{
    const requestId=crypto.randomUUID();try{
      const url=new URL(request.url);if(request.method!=='GET')throw new ScopeError('روش درخواست مجاز نیست.',405);
      if(url.pathname==='/api/operations.php'&&url.searchParams.has('customerMobile'))return lookup(request);
      const path=url.pathname;if(!['/api/auth.php','/api/settings.php','/api/catalog.php','/api/operations.php','/api/csrf.php','/api/capabilities.php'].includes(path))throw new ScopeError('این API هنوز منتقل نشده است.',503);
      const operationsAction=path==='/api/operations.php'?url.searchParams.get('action'):null;
      if(path==='/api/operations.php'&&operationsAction!==null&&operationsAction!=='reception_drafts')throw new ScopeError('این عملیات هنوز منتقل نشده است.',503);
      const branchId=branchQuery(request,path==='/api/operations.php'&&operationsAction==='reception_drafts'?['branchId','action']:['branchId']),now=deps.now();utcDate(now);
      if(path==='/api/auth.php'){
        const user=await deps.getUser();const db=await deps.getDb();if(!db)throw new ScopeError('پایگاه داده آماده نیست.',503);
        const context=await readActorContext(db,user,branchId,now.slice(0,10)),key=user?await deps.getKey():null;
        return Response.json({ok:true,data:{...context,authCsrfToken:user&&key?await issueAuthCsrf(key,user,now):null}},{headers});
      }
      const {db,scope}=await scopeFor(deps,branchId,now,request,path!=='/api/csrf.php');
      let data:unknown;
      if(path==='/api/csrf.php'){
        if((request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new ScopeError('مبدأ درخواست معتبر نیست.',403);
        if(!operationalRoles.has(scope.role))throw new ScopeError('دسترسی به نشست امن مجاز نیست.',403);
        const key=await deps.getKey();if(!key)throw new ReceptionError('کلید امن پذیرش تنظیم نشده است.',503);
        data={csrf_token:await issueReceptionCsrf(key,scope,now)};
      }
      else if(path==='/api/settings.php')data=await settings(db,scope,now);
      else if(path==='/api/catalog.php')data={items:(await db.prepare(`SELECT m.id,m.title AS model,b.id AS brand_id,b.title AS brand,t.id AS type_id,t.title AS type,m.usage_count,m.is_active FROM repair_device_models m JOIN repair_device_brands b ON b.id=m.brand_id JOIN repair_device_types t ON t.id=b.device_type_id WHERE t.shop_id=? ORDER BY t.title,b.title,m.title`).bind(scope.shopId).all()).results};
      else if(path==='/api/capabilities.php')data=await readCapabilitySnapshot(db,scope,now);
      else if(path==='/api/operations.php'&&operationsAction==='reception_drafts'){if(!['repair_manager','reception'].includes(scope.role))throw new ScopeError('دسترسی به پیش‌نویس پذیرش مجاز نیست.',403);const key=await deps.getKey();if(!key)throw new ReceptionError('کلید امن پذیرش تنظیم نشده است.',503);data={receptionDrafts:await listReceptionDrafts(db,scope,key,now)}}
      else{const key=['repair_manager','reception'].includes(scope.role)?await deps.getKey():null;data=await readOperationsSnapshot(db,scope,key,now)}
      return Response.json({ok:true,data},{headers});
    }catch(error){return failure(error,requestId)}
  };
}

type CasePatchDependencies=ReceptionHttpDependencies&{newPublicId?:()=>string;newRequestId?:()=>string};
const mutationPublicId=()=>crypto.randomUUID().replace(/-/g,'').slice(0,26);
export function createCasePatchHttpHandler(deps:CasePatchDependencies){
  return async(request:Request)=>{
    const requestId=deps.newRequestId?.()??crypto.randomUUID();
    try{
      const url=new URL(request.url);if(request.method!=='PATCH')throw new ScopeError('روش درخواست مجاز نیست.',405);
      if(url.pathname!=='/api/operations.php')throw new ScopeError('این API هنوز منتقل نشده است.',503);
      if(url.search)throw new ScopeError('پارامتر نشانی مجاز نیست.',400);
      if(request.headers.get('Origin')!==url.origin)throw new ScopeError('مبدأ درخواست معتبر نیست.',403);
      if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ScopeError('نوع بدنه باید JSON باشد.',415);
      const parsed=caseMutationSchema.safeParse(await boundedJson(request,32768));if(!parsed.success)throw new ReceptionError('درخواست تغییر پرونده معتبر نیست.',400);
      const body=parsed.data,now=deps.now();utcDate(now);const {db,scope}=await scopeFor(deps,body.branchId??null,now,request);
      const key=await deps.getKey();if(!key)throw new ReceptionError('کلید امن عملیات تنظیم نشده است.',503);
      await verifyReceptionCsrf(key,scope,request.headers.get('X-CSRF-Token'),now);
      const mutation={...body};delete mutation.branchId;
      const data=await mutateOperationalCase(db,scope,mutation,{auditPublicId:deps.newPublicId?.()??mutationPublicId(),requestId,ipAddress:'',userAgent:request.headers.get('User-Agent')?.slice(0,500)??null},now);
      return Response.json({ok:true,data},{headers});
    }catch(error){return failure(error,requestId)}
  };
}
export function createReceptionPostHttpHandler(deps:ReceptionHttpDependencies){
  const create=createReceptionHttpHandler(deps);
  return async(request:Request)=>{
    const requestId=crypto.randomUUID();try{
      const url=new URL(request.url);if(request.method!=='POST')throw new ScopeError('روش درخواست مجاز نیست.',405);
      if(url.pathname!=='/api/operations.php')throw new ScopeError('این API هنوز منتقل نشده است.',503);
      if(url.search)throw new ScopeError('پارامتر نشانی مجاز نیست.',400);
      if(request.headers.get('Origin')!==url.origin)throw new ScopeError('مبدأ درخواست معتبر نیست.',403);
      if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ScopeError('نوع بدنه باید JSON باشد.',415);
      const raw=await boundedJson(request,98304);
      if(raw?.action==='create_case')return create(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(raw)}));
      if(!['save_reception_draft','discard_reception_draft'].includes(raw?.action))throw new ReceptionError('این عملیات هنوز منتقل نشده است.',503);
      const parsed=schema.safeParse(raw);if(!parsed.success)throw new ReceptionError('درخواست پیش‌نویس معتبر نیست.',400);
      const body=parsed.data,now=deps.now();utcDate(now);const {db,scope}=await scopeFor(deps,body.branchId??null,now,request);if(!['repair_manager','reception'].includes(scope.role))throw new ScopeError('دسترسی به پیش‌نویس پذیرش مجاز نیست.',403);
      const key=await deps.getKey();if(!key)throw new ReceptionError('کلید امن پذیرش تنظیم نشده است.',503);
      await verifyReceptionCsrf(key,scope,request.headers.get('X-CSRF-Token'),now);
      let data:unknown;
      if(body.action==='save_reception_draft'){data=await saveReceptionDraft(db,scope,body,key,now)}
      else{if((body.publicId&&body.draftPublicId&&body.publicId!==body.draftPublicId)||!(body.publicId||body.draftPublicId))throw new ReceptionError('شناسه پیش‌نویس معتبر نیست.',400);data=await discardReceptionDraft(db,scope,(body.draftPublicId??body.publicId)!,now,body.expectedVersion)}
      return Response.json({ok:true,data},{headers});
    }catch(error){return failure(error,requestId)}
  };
}
