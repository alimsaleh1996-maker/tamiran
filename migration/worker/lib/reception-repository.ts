import type { D1Like, ServerScope } from "./server-scope";

export type ReceptionInput = {
  customerId: number;
  deviceId: number;
  declaredIssue: string;
  accessories: string[];
  appearanceStates: string[];
  receptionNotes?: string | null;
  idempotencyKey: string;
  publicId: string;
  caseUuid: string;
  workflowPublicId: string;
  stageEventPublicId: string;
  auditPublicId: string;
  trackingTokenHash: string;
  trackingTokenCiphertext: string;
  requestId: string;
  ipAddress: string;
  userAgent?: string | null;
  now: string;
};

export type ReceptionResult = {
  created: boolean;
  replayed: boolean;
  caseId: number;
  publicId: string;
  receiptNumber: string;
  status: string;
};

export class ReceptionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ReceptionError";
    this.status = status;
  }
}

type ExistingCase = {
  caseId: number;
  publicId: string;
  receiptNumber: string;
  status: string;
  customer_id: number;
  device_id: number;
  declared_issue: string;
  accessories_json: string;
  appearance_states_json: string;
  reception_notes: string | null;
};

const EXISTING_SQL = `SELECT id AS caseId,public_id AS publicId,receipt_number AS receiptNumber,status,
 customer_id,device_id,declared_issue,accessories_json,appearance_states_json,reception_notes
 FROM repair_cases WHERE shop_id=? AND idempotency_key=? LIMIT 1`;

export async function createReceptionForExistingDevice(
  db: D1Like,
  scope: ServerScope,
  input: ReceptionInput,
): Promise<ReceptionResult> {
  validate(scope, input);
  const accessoriesJson = JSON.stringify(input.accessories);
  const appearanceJson = JSON.stringify(input.appearanceStates);
  const notes = input.receptionNotes?.trim() || null;
  const existing = await findExisting(db, scope.shopId, input.idempotencyKey);
  if (existing) return replay(existing, input, accessoriesJson, appearanceJson, notes);

  const device = await db.prepare(`
    SELECT d.id FROM repair_customer_devices d
    JOIN repair_customers c ON c.id=d.customer_id AND c.shop_id=d.shop_id
    WHERE d.id=? AND d.customer_id=? AND d.shop_id=? AND c.archived_at IS NULL
    LIMIT 1`).bind(input.deviceId, input.customerId, scope.shopId).first();
  if (!device) throw new ReceptionError("مشتری یا دستگاه در محدوده تعمیرگاه معتبر نیست.", 409);

  const status = scope.productProfile === "solo" ? "diagnosing" : "awaiting_assignment";
  const statements = [
    db.prepare(`INSERT INTO repair_receipt_sequences(shop_id,last_number,updated_at)
      VALUES(?,0,?) ON CONFLICT(shop_id) DO NOTHING`).bind(scope.shopId, input.now),
    db.prepare(`UPDATE repair_receipt_sequences
      SET last_number=last_number+CASE WHEN EXISTS(
        SELECT 1 FROM tamiran_users u
        JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
        JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id
        JOIN repair_shops sh ON sh.id=ub.shop_id
        WHERE u.id=? AND u.account_user_id=? AND u.shop_id=? AND u.is_active=1
          AND ub.branch_id=? AND ub.is_active=1 AND ub.branch_role_code IN ('repair_manager','reception')
          AND b.is_active=1 AND sh.lifecycle_status='active'
          AND sh.license_started_at<=date(?) AND sh.license_expires_at>=date(?)
      ) THEN 1 ELSE json_extract('[]','$[') END,updated_at=? WHERE shop_id=?`).bind(
        scope.userId,scope.accountUserId,scope.shopId,scope.branchId,input.now,input.now,input.now,scope.shopId,
      ),
    db.prepare(`INSERT INTO repair_cases(
      public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,public_receipt_no,receipt_number,
      tracking_token_hash,tracking_token_ciphertext,product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,
      feature_flags_snapshot_json,idempotency_key,device_type_snapshot,brand_snapshot,model_snapshot,color_snapshot,
      identifier_snapshot,declared_issue,accessories_json,appearance_states_json,reception_notes,status,created_by_user_id,created_at,updated_at)
      SELECT ?,?,?,?,d.customer_id,d.id,s.last_number,
        sh.public_shop_code||'-'||printf('%06d',s.last_number),sh.public_shop_code||'-'||printf('%06d',s.last_number),
        ?,?,?,?,?,?,?,d.device_type_title,d.brand_title,d.model_title,d.color_title,d.identifier_value,?,?,?,?,?,?,?,?
      FROM repair_customer_devices d
      JOIN repair_receipt_sequences s ON s.shop_id=d.shop_id
      JOIN repair_shops sh ON sh.id=d.shop_id
      WHERE d.id=? AND d.customer_id=? AND d.shop_id=?`).bind(
        input.publicId,input.caseUuid,scope.shopId,scope.branchId,input.trackingTokenHash,input.trackingTokenCiphertext,
        scope.productProfile,scope.inventoryMode,scope.qcMode,JSON.stringify(scope.featureFlags),input.idempotencyKey,
        input.declaredIssue.trim(),accessoriesJson,appearanceJson,notes,status,scope.userId,input.now,input.now,
        input.deviceId,input.customerId,scope.shopId,
      ),
    db.prepare(`INSERT INTO repair_case_workflows(
      public_id,shop_id,branch_id,case_id,workflow_code,process_status,diagnostic_fee_policy_json,customer_consent_json,created_at,updated_at)
      SELECT ?,c.shop_id,c.branch_id,c.id,
        CASE WHEN lower(c.device_type_snapshot) LIKE '%computer%' OR lower(c.device_type_snapshot) LIKE '%laptop%'
          OR c.device_type_snapshot LIKE '%کامپیوتر%' OR c.device_type_snapshot LIKE '%لپ%تاپ%'
          THEN 'computer_laptop' ELSE 'mobile_tablet' END,
        ?, '{}','{}',?,? FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(
          input.workflowPublicId,status,input.now,input.now,scope.shopId,input.idempotencyKey,
        ),
    db.prepare(`INSERT INTO repair_case_stage_events(
      public_id,workflow_id,from_status,to_status,actor_user_id,reason,metadata_json,idempotency_key,started_at)
      SELECT ?,w.id,NULL,?,?,'ثبت پذیرش نسخه ۲.۰',json_object('receiptNumber',c.receipt_number,'productProfile',c.product_profile_snapshot),?,?
      FROM repair_case_workflows w JOIN repair_cases c ON c.id=w.case_id
      WHERE c.shop_id=? AND c.idempotency_key=?`).bind(
        input.stageEventPublicId,status,scope.userId,`case-create:${input.idempotencyKey}`,input.now,scope.shopId,input.idempotencyKey,
      ),
    db.prepare(`INSERT INTO repair_case_events(case_id,actor_user_id,event_type,from_status,to_status,description,metadata_json,created_at)
      SELECT c.id,?,'case_created',NULL,?,
        CASE WHEN ?='diagnosing' THEN 'پذیرش سبک ثبت شد و پرونده وارد بررسی شد.' ELSE 'پذیرش ثبت شد و پرونده در انتظار تخصیص قرار گرفت.' END,
        json_object('receiptNumber',c.receipt_number,'assignedToUserId',NULL),?
      FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(
        scope.userId,status,status,input.now,scope.shopId,input.idempotencyKey,
      ),
    db.prepare(`INSERT INTO tamiran_audit_log(
      public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,before_json,after_json,reason,request_id,ip_address,user_agent,created_at)
      SELECT ?,c.shop_id,c.branch_id,?,'case.create','repair_case',c.public_id,NULL,
        json_object('receiptNumber',c.receipt_number,'status',c.status),'ثبت پذیرش نسخه ۲.۰',?,?,?,?
      FROM repair_cases c WHERE c.shop_id=? AND c.idempotency_key=?`).bind(
        input.auditPublicId,scope.userId,input.requestId,input.ipAddress,input.userAgent ?? null,input.now,scope.shopId,input.idempotencyKey,
      ),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    const concurrent = await findExisting(db, scope.shopId, input.idempotencyKey);
    if (concurrent) return replay(concurrent, input, accessoriesJson, appearanceJson, notes);
    throw error;
  }
  const created = await findExisting(db, scope.shopId, input.idempotencyKey);
  if (!created) throw new ReceptionError("تراکنش پذیرش نتیجه قابل بازیابی نداشت.", 500);
  return { created: true, replayed: false, caseId: created.caseId, publicId: created.publicId, receiptNumber: created.receiptNumber, status: created.status };
}

async function findExisting(db: D1Like, shopId: number, key: string): Promise<ExistingCase | null> {
  return db.prepare(EXISTING_SQL).bind(shopId, key).first<ExistingCase>();
}

function replay(existing: ExistingCase, input: ReceptionInput, accessories: string, appearance: string, notes: string | null): ReceptionResult {
  if (existing.customer_id !== input.customerId || existing.device_id !== input.deviceId ||
      existing.declared_issue !== input.declaredIssue.trim() || existing.accessories_json !== accessories ||
      existing.appearance_states_json !== appearance || existing.reception_notes !== notes) {
    throw new ReceptionError("شناسه یکتای درخواست قبلاً برای پذیرش متفاوت استفاده شده است.", 409);
  }
  return { created: false, replayed: true, caseId: existing.caseId, publicId: existing.publicId, receiptNumber: existing.receiptNumber, status: existing.status };
}

function validate(scope: ServerScope, input: ReceptionInput): void {
  if (!['repair_manager','reception'].includes(scope.role)) throw new ReceptionError("ثبت پذیرش برای نقش فعلی مجاز نیست.", 403);
  for (const [name,value] of [["customerId",input.customerId],["deviceId",input.deviceId]] as const) {
    if (!Number.isSafeInteger(value) || value < 1) throw new ReceptionError(`${name} معتبر نیست.`, 400);
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 160) throw new ReceptionError("شناسه یکتای پذیرش معتبر نیست.", 400);
  if (!input.declaredIssue.trim() || input.declaredIssue.length > 4000) throw new ReceptionError("شرح ایراد معتبر نیست.", 400);
  if (input.accessories.length > 40 || input.appearanceStates.length > 40) throw new ReceptionError("فهرست اقلام پذیرش بیش از حد مجاز است.", 400);
  if (input.receptionNotes && input.receptionNotes.length > 4000) throw new ReceptionError("یادداشت پذیرش بیش از حد مجاز است.", 400);
}
