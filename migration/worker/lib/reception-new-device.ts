import { prepareDraftSubmission } from "./reception-drafts.ts";
import { prepareReceptionOptions, optionsFingerprint, type ReceptionOptionsInput } from "./reception-options.ts";
import type { D1Like, ServerScope } from "./server-scope";
import { prepareReceiptAcceptance, validateReceiptAcceptance, canonicalJson, sha256, type ReceiptAcceptance } from "./reception-terms.ts";
import { portalExpiry } from "./portal-token.ts";
import { validateReceptionSettings } from "./reception-settings.ts";
import { ReceptionError, type ReceptionResult } from "./reception-repository.ts";

export type NewDeviceReceptionInput = ReceptionOptionsInput & {
  customer: { publicId: string; fullName: string; mobile: string; secondaryMobile?: string | null; nationalCode?: string | null; province?: string | null; city?: string | null; address?: string | null; postalCode?: string | null };
  device: { publicId: string; previousDeviceId?: number; expectedVersion?: number; modelId: number; color?: string | null; identifier?: string | null };
  draftPublicId?: string; draftExpectedVersion?: number;
  receiptAcceptance: ReceiptAcceptance; receiptTermsPublicId: string; portalTokenPublicId: string;
  customerConsent: { dataHandling: "no_erasure" | "coordinate_first" | "erase_authorized"; acceptanceMethod?: string };
  declaredIssue: string; accessories: string[]; appearanceStates: string[]; receptionNotes?: string | null;
  idempotencyKey: string; publicId: string; caseUuid: string; workflowPublicId: string; stageEventPublicId: string; auditPublicId: string;
  trackingTokenHash: string; trackingTokenCiphertext: string; requestId: string; ipAddress: string; userAgent?: string | null; now: string;
};

type Existing = { caseId:number; publicId:string; receiptNumber:string; status:string; mobile:string; device_public_id:string; declared_issue:string; accessories_json:string; appearance_states_json:string; reception_notes:string|null; device_id:number; color_snapshot:string|null; identifier_snapshot:string|null; model_snapshot:string; customer_consent_json:string; reception_request_hash:string|null };

export async function createReceptionWithNewDevice(db:D1Like,scope:ServerScope,input:NewDeviceReceptionInput,key?:CryptoKey):Promise<ReceptionResult>{
  const normalized=validateAndNormalize(scope,input);
  const requestHash=await hashRequest(scope,input,normalized);
  const existing=await findExisting(db,scope.shopId,input.idempotencyKey);
  if(existing)return replay(existing,requestHash);
  const draft=input.draftPublicId?await prepareDraftSubmission(db,scope,input.draftPublicId,input.idempotencyKey,input.now,input.draftExpectedVersion):null;
  const archived=await db.prepare('SELECT id FROM repair_customers WHERE shop_id=? AND mobile=? AND archived_at IS NOT NULL').bind(scope.shopId,normalized.mobile).first();
  if(archived)throw new ReceptionError("مشتری بایگانی‌شده مجاز به پذیرش نیست.",409);
  const receipt=await prepareReceiptAcceptance(db,scope,input.receiptAcceptance,input.customerConsent?.acceptanceMethod??"recorded_consent",input.requestId,input.now);
  const expiresAt=portalExpiry(input.now);
  const settings=await validateReceptionSettings(db,scope,input);
  const model=await db.prepare(`SELECT m.id,m.title FROM repair_device_models m JOIN repair_device_brands b ON b.id=m.brand_id JOIN repair_device_types t ON t.id=b.device_type_id WHERE m.id=? AND t.shop_id=? AND m.is_active=1 AND b.is_active=1 AND t.is_active=1`).bind(input.device.modelId,scope.shopId).first<{id:number; title:string}>();
  if(!model)throw new ReceptionError("نوع، برند و مدل باید از فهرست فعال همین تعمیرگاه انتخاب شود.",409);
  if(input.device.previousDeviceId){
    const device=await db.prepare(`SELECT d.id,d.lock_version FROM repair_customer_devices d JOIN repair_customers c ON c.id=d.customer_id AND c.shop_id=d.shop_id WHERE d.id=? AND d.shop_id=? AND c.mobile=? AND c.archived_at IS NULL`).bind(input.device.previousDeviceId,scope.shopId,normalized.mobile).first<{id:number;lock_version:number}>();
    if(!device)throw new ReceptionError("دستگاه قبلی برای این مشتری معتبر نیست.",409);
    if(!Number.isSafeInteger(input.device.expectedVersion) || input.device.expectedVersion!==device.lock_version)throw new ReceptionError("اطلاعات دستگاه تغییر کرده است؛ سابقه را دوباره دریافت کنید.",409);
  }
  const options=await prepareReceptionOptions(db,scope,input,input.caseUuid,input.now,key);
  const status=options.status;
  const inventoryMode=scope.productProfile==='solo'&&scope.inventoryMode==='pro'?'simple':scope.inventoryMode;
  const qcMode=scope.productProfile==='solo'&&scope.qcMode==='independent'?'simple':scope.qcMode;
  const statements=[
    ...(draft?[draft.guard]:[]),
    receipt.guard,
    options.guard,
    db.prepare(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM repair_customers WHERE shop_id=? AND mobile=? AND archived_at IS NOT NULL) THEN 1 ELSE json_extract('[]','$[') END`).bind(scope.shopId,normalized.mobile),
    db.prepare(`SELECT CASE WHEN COALESCE((SELECT national_code_required FROM repair_shops WHERE id=?),-1)=? AND COALESCE((SELECT value_json FROM repair_shop_settings WHERE shop_id=? AND setting_key='customer_address_policy'),'null')=? AND COALESCE((SELECT value_json FROM repair_shop_settings WHERE shop_id=? AND setting_key='device_colors'),'null')=? AND COALESCE((SELECT value_json FROM repair_shop_settings WHERE shop_id=? AND setting_key='receipt_template'),'null')=? THEN 1 ELSE json_extract('[]','$[') END`).bind(scope.shopId,settings.nationalRequired,scope.shopId,settings.rawAddress,scope.shopId,settings.rawColors,scope.shopId,settings.rawTemplate),
    db.prepare(`INSERT INTO repair_customers(public_id,shop_id,full_name,mobile,secondary_mobile,national_code,province,city,address,postal_code,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(shop_id,mobile) DO UPDATE SET full_name=excluded.full_name,
      secondary_mobile=COALESCE(excluded.secondary_mobile,secondary_mobile),national_code=COALESCE(excluded.national_code,national_code),
      province=COALESCE(excluded.province,province),city=COALESCE(excluded.city,city),address=COALESCE(excluded.address,address),
      postal_code=COALESCE(excluded.postal_code,postal_code),updated_at=excluded.updated_at`).bind(
        input.customer.publicId,scope.shopId,input.customer.fullName.trim(),normalized.mobile,normalized.secondaryMobile,normalized.nationalCode,
        optional(input.customer.province),optional(input.customer.city),optional(input.customer.address),normalized.postalCode,input.now,input.now),
    ...(input.device.previousDeviceId ? [
      db.prepare(`UPDATE repair_customer_devices SET device_model_id=?,device_type_title=(SELECT t.title FROM repair_device_types t JOIN repair_device_brands b ON b.device_type_id=t.id JOIN repair_device_models m ON m.brand_id=b.id WHERE m.id=?),brand_title=(SELECT b.title FROM repair_device_brands b JOIN repair_device_models m ON m.brand_id=b.id WHERE m.id=?),model_title=?,color_title=?,identifier_value=COALESCE(?,identifier_value),normalized_identifier=COALESCE(?,normalized_identifier),last_accepted_at=?,updated_at=?,lock_version=lock_version+1 WHERE id=? AND shop_id=? AND lock_version=? AND customer_id=(SELECT id FROM repair_customers WHERE shop_id=? AND mobile=? AND archived_at IS NULL)`)
        .bind(input.device.modelId,input.device.modelId,input.device.modelId,model.title,optional(input.device.color),optional(input.device.identifier),normalized.identifier,input.now,input.now,input.device.previousDeviceId,scope.shopId,input.device.expectedVersion,scope.shopId,normalized.mobile),
      db.prepare(`SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('[]','$[') END`).bind(),
    ] : [
    db.prepare(`INSERT INTO repair_customer_devices(public_id,shop_id,customer_id,device_model_id,device_type_title,brand_title,model_title,color_title,identifier_value,normalized_identifier,ownership_verification_json,details_json,last_accepted_at,created_at,updated_at)
      SELECT ?,?,c.id,m.id,t.title,b.title,m.title,?,?,?,'{}','{}',?,?,? FROM repair_customers c
      JOIN repair_device_models m ON m.id=? AND m.is_active=1 JOIN repair_device_brands b ON b.id=m.brand_id AND b.is_active=1
      JOIN repair_device_types t ON t.id=b.device_type_id AND t.shop_id=? AND t.is_active=1
      WHERE c.shop_id=? AND c.mobile=?`).bind(input.device.publicId,scope.shopId,optional(input.device.color),optional(input.device.identifier),normalized.identifier,input.now,input.now,input.now,input.device.modelId,scope.shopId,scope.shopId,normalized.mobile),
    ]),
    db.prepare(`INSERT INTO repair_receipt_sequences(shop_id,last_number,updated_at) VALUES(?,0,?) ON CONFLICT(shop_id) DO NOTHING`).bind(scope.shopId,input.now),
    db.prepare(`UPDATE repair_receipt_sequences SET last_number=last_number+CASE WHEN EXISTS(
      SELECT 1 FROM tamiran_users u JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
      JOIN repair_branches br ON br.id=ub.branch_id AND br.shop_id=ub.shop_id JOIN repair_shops sh ON sh.id=ub.shop_id
      JOIN repair_device_models m ON m.id=? AND m.is_active=1 JOIN repair_device_brands b ON b.id=m.brand_id AND b.is_active=1
      JOIN repair_device_types t ON t.id=b.device_type_id AND t.shop_id=sh.id AND t.is_active=1
      WHERE u.id=? AND u.account_user_id=? AND u.shop_id=? AND u.is_active=1 AND ub.branch_id=? AND ub.is_active=1
      AND ub.branch_role_code IN ('repair_manager','reception') AND br.is_active=1 AND sh.lifecycle_status='active'
      AND sh.license_started_at<=date(?) AND sh.license_expires_at>=date(?)) THEN 1 ELSE json_extract('[]','$[') END,updated_at=? WHERE shop_id=?`).bind(
        input.device.modelId,scope.userId,scope.accountUserId,scope.shopId,scope.branchId,input.now,input.now,input.now,scope.shopId),
    db.prepare(`INSERT INTO repair_cases(public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,public_receipt_no,receipt_number,tracking_token_hash,tracking_token_ciphertext,product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,feature_flags_snapshot_json,idempotency_key,reception_request_hash,device_type_snapshot,brand_snapshot,model_snapshot,color_snapshot,identifier_snapshot,declared_issue,accessories_json,appearance_states_json,reception_notes,status,assigned_to_user_id,created_by_user_id,created_at,updated_at)
      SELECT ?,?,?,?,d.customer_id,d.id,s.last_number,sh.public_shop_code||'-'||printf('%06d',s.last_number),sh.public_shop_code||'-'||printf('%06d',s.last_number),?,?,?,?,?,?,?,?,d.device_type_title,d.brand_title,d.model_title,d.color_title,d.identifier_value,?,?,?,?,?,?,?,?,?
      FROM repair_customer_devices d JOIN repair_receipt_sequences s ON s.shop_id=d.shop_id JOIN repair_shops sh ON sh.id=d.shop_id
      WHERE ( (? IS NULL AND d.public_id=?) OR d.id=? ) AND d.shop_id=?`).bind(input.publicId,input.caseUuid,scope.shopId,scope.branchId,input.trackingTokenHash,input.trackingTokenCiphertext,scope.productProfile,inventoryMode,qcMode,JSON.stringify(scope.featureFlags),input.idempotencyKey,requestHash,input.declaredIssue.trim(),normalized.accessoriesJson,normalized.appearanceJson,normalized.notes,status,options.assignedId,scope.userId,input.now,input.now,input.device.previousDeviceId??null,input.device.publicId,input.device.previousDeviceId??null,scope.shopId),
    db.prepare(`INSERT INTO repair_case_receipt_terms(public_id,case_id,term_version_id,accepted_by_name,acceptance_method,evidence_json,accepted_at,shop_id)
      SELECT ?,c.id,?,?,?,?,?,c.shop_id FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(input.receiptTermsPublicId,receipt.id,input.customer.fullName.trim(),input.customerConsent.acceptanceMethod??'recorded_consent',receipt.evidenceJson,input.now,scope.shopId,input.idempotencyKey),
    db.prepare(`INSERT INTO repair_portal_tokens(public_id,shop_id,case_id,token_hash,expires_at,created_by_user_id,created_at)
      SELECT ?,c.shop_id,c.id,c.tracking_token_hash,?,?,? FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(input.portalTokenPublicId,expiresAt,scope.userId,input.now,scope.shopId,input.idempotencyKey),
    db.prepare(`INSERT INTO repair_case_workflows(public_id,shop_id,branch_id,case_id,workflow_code,process_status,primary_technician_user_id,preapproved_amount,diagnostic_fee_policy_json,promised_at,temporary_device_secret_ciphertext,temporary_secret_expires_at,customer_consent_json,created_at,updated_at)
      SELECT ?,c.shop_id,c.branch_id,c.id,CASE WHEN lower(c.device_type_snapshot) LIKE '%computer%' OR lower(c.device_type_snapshot) LIKE '%laptop%' OR c.device_type_snapshot LIKE '%کامپیوتر%' OR c.device_type_snapshot LIKE '%لپ%تاپ%' THEN 'computer_laptop' ELSE 'mobile_tablet' END,?,?,?,?,?,?,?,?,?,? FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(input.workflowPublicId,status,options.assignedId,options.amount,options.diagnosticJson,options.promisedAt,options.ciphertext,options.secretExpiresAt,JSON.stringify(input.customerConsent),input.now,input.now,scope.shopId,input.idempotencyKey),
    db.prepare(`INSERT INTO repair_case_stage_events(public_id,workflow_id,from_status,to_status,actor_user_id,reason,metadata_json,idempotency_key,started_at)
      SELECT ?,w.id,NULL,?,?,'ثبت پذیرش نسخه ۲.۰',json_object('receiptNumber',c.receipt_number,'productProfile',c.product_profile_snapshot),?,? FROM repair_case_workflows w JOIN repair_cases c ON c.id=w.case_id WHERE c.shop_id=? AND c.idempotency_key=?`).bind(input.stageEventPublicId,status,scope.userId,`case-create:${await sha256(input.idempotencyKey)}`,input.now,scope.shopId,input.idempotencyKey),
    db.prepare(`INSERT INTO repair_case_events(case_id,actor_user_id,event_type,from_status,to_status,description,metadata_json,created_at)
      SELECT c.id,?,'case_created',NULL,?,CASE WHEN ?='diagnosing' THEN 'پذیرش سبک ثبت شد و پرونده وارد بررسی شد.' WHEN ?='assigned' THEN 'پذیرش ثبت شد و پرونده به مسئول تخصیص یافت.' ELSE 'پذیرش ثبت شد و پرونده در انتظار تخصیص قرار گرفت.' END,json_object('receiptNumber',c.receipt_number,'assignedToUserId',c.assigned_to_user_id),? FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(scope.userId,status,status,status,input.now,scope.shopId,input.idempotencyKey),
    db.prepare(`INSERT INTO tamiran_audit_log(public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,before_json,after_json,reason,request_id,ip_address,user_agent,created_at)
      SELECT ?,c.shop_id,c.branch_id,?,'case.create','repair_case',c.public_id,NULL,json_object('receiptNumber',c.receipt_number,'status',c.status),'ثبت پذیرش نسخه ۲.۰',?,?,?,? FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(input.auditPublicId,scope.userId,input.requestId,input.ipAddress,input.userAgent??null,input.now,scope.shopId,input.idempotencyKey),
    ...(draft?[draft.submit,draft.check]:[]),
  ];
  try{await db.batch(statements);}catch(error){const concurrent=await findExisting(db,scope.shopId,input.idempotencyKey);if(concurrent)return replay(concurrent,requestHash);throw error;}
  const created=await findExisting(db,scope.shopId,input.idempotencyKey);if(!created)throw new ReceptionError("تراکنش پذیرش نتیجه قابل بازیابی نداشت.",500);
  return{created:true,replayed:false,caseId:created.caseId,publicId:created.publicId,receiptNumber:created.receiptNumber,status:created.status};
}

async function findExisting(db:D1Like,shopId:number,key:string){return db.prepare(`SELECT c.id AS caseId,c.public_id AS publicId,c.receipt_number AS receiptNumber,c.status,cu.mobile,d.public_id AS device_public_id,c.declared_issue,c.accessories_json,c.appearance_states_json,c.reception_notes,c.device_id,c.color_snapshot,c.identifier_snapshot,c.model_snapshot,w.customer_consent_json,c.reception_request_hash FROM repair_cases c JOIN repair_case_workflows w ON w.case_id=c.id JOIN repair_customers cu ON cu.id=c.customer_id JOIN repair_customer_devices d ON d.id=c.device_id WHERE c.shop_id=? AND c.idempotency_key=? LIMIT 1`).bind(shopId,key).first<Existing>();}
function replay(row:Existing,requestHash:string):ReceptionResult{
  if(row.reception_request_hash!==requestHash)throw new ReceptionError("شناسه یکتای درخواست قبلاً برای پذیرش متفاوت استفاده شده است.",409);
  return{created:false,replayed:true,caseId:row.caseId,publicId:row.publicId,receiptNumber:row.receiptNumber,status:row.status};
}
async function hashRequest(scope:ServerScope,input:NewDeviceReceptionInput,normalized:ReturnType<typeof validateAndNormalize>){
  const value={draftPublicId:input.draftPublicId??null,draftExpectedVersion:input.draftExpectedVersion??null,options:await optionsFingerprint(input),shopId:scope.shopId,branchId:scope.branchId,userId:scope.userId,
    customer:{name:input.customer.fullName.trim(),mobile:normalized.mobile,secondaryMobile:normalized.secondaryMobile,nationalCode:normalized.nationalCode,province:optional(input.customer.province),city:optional(input.customer.city),address:optional(input.customer.address),postalCode:normalized.postalCode},
    device:{previousId:input.device.previousDeviceId??null,expectedVersion:input.device.expectedVersion??null,modelId:input.device.modelId,color:optional(input.device.color),identifier:optional(input.device.identifier)},
    declaredIssue:input.declaredIssue.trim(),accessories:normalized.accessoriesJson,appearance:normalized.appearanceJson,notes:normalized.notes,
    receiptAcceptance:{versionId:input.receiptAcceptance.versionId,contentSha256:input.receiptAcceptance.contentSha256,accepted:input.receiptAcceptance.accepted,evidence:canonicalJson(input.receiptAcceptance.evidence??{})},
    consent:{dataHandling:input.customerConsent?.dataHandling,acceptanceMethod:input.customerConsent?.acceptanceMethod??'recorded_consent'}};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function validateAndNormalize(scope:ServerScope,input:NewDeviceReceptionInput){
  validateReceiptAcceptance(input.receiptAcceptance);
  for(const id of [input.receiptTermsPublicId,input.portalTokenPublicId])if(typeof id!=="string"||!id||id.length>26)throw new ReceptionError("شناسه مدرک یا توکن معتبر نیست.",400);
  if(!['repair_manager','reception'].includes(scope.role))throw new ReceptionError("ثبت پذیرش برای نقش فعلی مجاز نیست.",403);
  if(input.device.previousDeviceId!==undefined && (!Number.isSafeInteger(input.device.previousDeviceId)||input.device.previousDeviceId<1))throw new ReceptionError("شناسه دستگاه قبلی معتبر نیست.",400);
  if(!input.customer.fullName.trim()||[...input.customer.fullName.trim()].length>180)throw new ReceptionError("نام مشتری معتبر نیست.",400);
  if(!Number.isSafeInteger(input.device.modelId)||input.device.modelId<1)throw new ReceptionError("مدل دستگاه معتبر نیست.",400);
  const mobile=normalizeMobile(input.customer.mobile),secondaryMobile=optional(input.customer.secondaryMobile)?normalizeMobile(input.customer.secondaryMobile!):null;
  const nationalCode=digits(input.customer.nationalCode??'')||null;if(nationalCode&&!validNationalCode(nationalCode))throw new ReceptionError("کد ملی مشتری معتبر نیست.",400);
  const postalCode=digits(input.customer.postalCode??'')||null;if(postalCode&&!/^\d{10}$/.test(postalCode))throw new ReceptionError("کد پستی باید ۱۰ رقم باشد.",400);
  const identifier=optional(input.device.identifier)?.toUpperCase().replace(/[^A-Z0-9]/g,'')||null;
  if(!input.idempotencyKey.trim()||input.idempotencyKey.length>160||!input.declaredIssue.trim()||input.declaredIssue.length>4000)throw new ReceptionError("اطلاعات اصلی پذیرش معتبر نیست.",400);
  if(!Array.isArray(input.accessories)||!Array.isArray(input.appearanceStates)||[...input.accessories,...input.appearanceStates].some(v=>typeof v!=="string"||!v.trim()||[...v].length>120))throw new ReceptionError("اقلام و وضعیت ظاهری معتبر نیستند.",400);
  for(const [value,max] of [[input.customer.province,100],[input.customer.city,100],[input.customer.address,1000],[input.device.color,80],[input.device.identifier,180],[input.receptionNotes,4000]] as const)if(value!=null&&(typeof value!=="string"||[...value].length>max))throw new ReceptionError("طول اطلاعات پذیرش بیش از حد مجاز است.",400);
  if(input.accessories.length>40||input.appearanceStates.length>40)throw new ReceptionError("فهرست اقلام پذیرش بیش از حد مجاز است.",400);
  return{mobile,secondaryMobile:secondaryMobile===mobile?null:secondaryMobile,nationalCode,postalCode,identifier,accessoriesJson:JSON.stringify(input.accessories),appearanceJson:JSON.stringify(input.appearanceStates),notes:optional(input.receptionNotes)};
}
function optional(value:unknown){const normalized=String(value??'').trim();return normalized||null;}
function digits(value:string){return value.replace(/[۰-۹٠-٩]/g,ch=>'۰۱۲۳۴۵۶۷۸۹'.includes(ch)?String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)):String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/\D/g,'');}
function normalizeMobile(value:string){let mobile=digits(value);if(mobile.startsWith('0098'))mobile='0'+mobile.slice(4);else if(mobile.startsWith('98'))mobile='0'+mobile.slice(2);else if(/^9\d{9}$/.test(mobile))mobile='0'+mobile;if(!/^09\d{9}$/.test(mobile))throw new ReceptionError("شماره موبایل معتبر نیست.",400);return mobile;}
function validNationalCode(value:string){if(!/^\d{10}$/.test(value)||/^(\d)\1{9}$/.test(value))return false;let sum=0;for(let i=0;i<9;i++)sum+=Number(value[i])*(10-i);const remainder=sum%11,check=remainder<2?remainder:11-remainder;return check===Number(value[9]);}
