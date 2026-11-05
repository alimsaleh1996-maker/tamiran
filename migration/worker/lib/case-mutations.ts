import { readOperationalCase } from "./operations-read.ts";
import { ReceptionError } from "./reception-repository.ts";
import { ScopeError, type D1Like, type ServerScope } from "./server-scope.ts";
import { utcDate } from "./reception-terms.ts";

export type CaseStatus =
  | "awaiting_assignment"
  | "assigned"
  | "diagnosing"
  | "repairing"
  | "awaiting_part"
  | "awaiting_customer"
  | "ready_for_delivery"
  | "returned"
  | "delivered"
  | "cancelled";

export type OperationalCaseMutation = {
  id: number;
  expectedVersion: number;
  status?: CaseStatus;
  assignedToUserId?: number | null;
  result?: string;
  operationReport?: string;
  reason?: string;
  deliveryAmount?: number;
  deliveredToName?: string;
  deliveryNotes?: string;
};

export type CaseMutationEvidence = {
  auditPublicId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string | null;
};

type CurrentCase = {
  id: number;
  publicId: string;
  status: CaseStatus;
  result: string | null;
  operationReport: string | null;
  assignedToUserId: number | null;
  deliveryAmount: number;
  deliveredToName: string | null;
  deliveryNotes: string | null;
  deliveredByUserId: number | null;
  deliveredAt: string | null;
  rowVersion: number;
  hasWorkflow: number;
};

const transitions: Record<CaseStatus, CaseStatus[]> = {
  awaiting_assignment: ["assigned", "cancelled"],
  assigned: ["diagnosing", "returned", "cancelled"],
  diagnosing: [
    "repairing",
    "awaiting_part",
    "awaiting_customer",
    "ready_for_delivery",
    "cancelled",
  ],
  repairing: [
    "awaiting_part",
    "awaiting_customer",
    "ready_for_delivery",
    "cancelled",
  ],
  awaiting_part: ["repairing", "ready_for_delivery", "cancelled"],
  awaiting_customer: ["repairing", "ready_for_delivery", "cancelled"],
  ready_for_delivery: ["delivered", "returned"],
  returned: ["assigned", "diagnosing"],
  delivered: [],
  cancelled: [],
};

const permittedRoles = new Set([
  "repair_manager",
  "reception",
  "technician",
  "quality_control",
]);
const technicalRoles = new Set(["technician", "quality_control"]);

function optionalText(value: string | null | undefined, max: number) {
  const text = String(value ?? "").trim();
  if (text.length > max)
    throw new ReceptionError("متن ثبت‌شده بیش از حد مجاز است.", 400);
  return text || null;
}

function resultChanges(value: unknown) {
  if (!value || typeof value !== "object") return 0;
  const direct = (value as { changes?: unknown }).changes;
  if (typeof direct === "number") return direct;
  const meta = (value as { meta?: { changes?: unknown } }).meta?.changes;
  return typeof meta === "number" ? meta : 0;
}

async function currentCase(
  db: D1Like,
  scope: ServerScope,
  id: number,
): Promise<CurrentCase> {
  const row = await db
    .prepare(
      `SELECT c.id,c.public_id AS publicId,c.status,c.result,c.operation_report AS operationReport,
        c.assigned_to_user_id AS assignedToUserId,c.delivery_amount AS deliveryAmount,
        c.delivered_to_name AS deliveredToName,c.delivery_notes AS deliveryNotes,
        c.delivered_by_user_id AS deliveredByUserId,c.delivered_at AS deliveredAt,
        c.row_version AS rowVersion,
        EXISTS(SELECT 1 FROM repair_case_workflows w WHERE w.case_id=c.id AND w.shop_id=c.shop_id) AS hasWorkflow
      FROM repair_cases c WHERE c.id=? AND c.shop_id=? AND c.branch_id=?`,
    )
    .bind(id, scope.shopId, scope.branchId)
    .first<CurrentCase>();
  if (!row) throw new ScopeError("پرونده پیدا نشد.", 404);
  return row;
}

async function activeAssignee(
  db: D1Like,
  scope: ServerScope,
  userId: number,
) {
  return db
    .prepare(
      `SELECT u.id FROM tamiran_users u
       JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
       WHERE u.id=? AND u.shop_id=? AND u.is_active=1 AND ub.branch_id=? AND ub.is_active=1
         AND ub.branch_role_code IN ('repair_manager','technician','quality_control') LIMIT 1`,
    )
    .bind(userId, scope.shopId, scope.branchId)
    .first();
}

async function classifyConflict(
  db: D1Like,
  scope: ServerScope,
  input: OperationalCaseMutation,
  today: string,
): Promise<never> {
  const active = await db
    .prepare(
      `SELECT 1 AS ok FROM tamiran_users u
       JOIN repair_shops s ON s.id=u.shop_id
       JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
       JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id
       WHERE u.id=? AND u.account_user_id=? AND u.shop_id=? AND b.id=? AND ub.branch_role_code=?
         AND u.is_active=1 AND ub.is_active=1 AND b.is_active=1 AND s.lifecycle_status='active'
         AND s.license_started_at<=? AND s.license_expires_at>=? LIMIT 1`,
    )
    .bind(
      scope.userId,
      scope.accountUserId,
      scope.shopId,
      scope.branchId,
      scope.role,
      today,
      today,
    )
    .first();
  if (!active)
    throw new ScopeError("حساب فعال و مجاز برای این شعبه پیدا نشد.", 403);
  const row = await currentCase(db, scope, input.id);
  if (row.rowVersion !== input.expectedVersion)
    throw new ReceptionError(
      "پرونده هم‌زمان تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
      409,
    );
  const assignedToUserId =
    input.assignedToUserId === undefined
      ? row.assignedToUserId
      : input.assignedToUserId;
  const effectiveStatus =
    (input.status ?? row.status) === "awaiting_assignment" &&
    assignedToUserId !== null
      ? "assigned"
      : (input.status ?? row.status);
  if (effectiveStatus !== row.status && row.hasWorkflow)
    throw new ReceptionError(
      "تغییر مرحله پرونده نسخه ۲ فقط از موتور فرایند مجاز است.",
      409,
    );
  if (
    input.assignedToUserId !== undefined &&
    input.assignedToUserId !== null &&
    !(await activeAssignee(db, scope, input.assignedToUserId))
  )
    throw new ReceptionError(
      "کاربر مقصد در این تعمیرگاه و شعبه فعال نیست.",
      409,
    );
  throw new Error("CASE_MUTATION_ATOMIC_GUARD_FAILED");
}

export async function mutateOperationalCase(
  db: D1Like,
  scope: ServerScope,
  input: OperationalCaseMutation,
  evidence: CaseMutationEvidence,
  now: string,
) {
  utcDate(now);
  if (!Number.isSafeInteger(input.id) || input.id < 1)
    throw new ReceptionError("شناسه پرونده معتبر نیست.", 400);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0)
    throw new ReceptionError("نسخه پرونده معتبر نیست.", 400);
  if (!permittedRoles.has(scope.role))
    throw new ScopeError("نقش فعلی اجازه تغییر پرونده را ندارد.", 403);

  const current = await currentCase(db, scope, input.id);
  if (current.rowVersion !== input.expectedVersion)
    throw new ReceptionError(
      "پرونده هم‌زمان تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
      409,
    );
  if (
    technicalRoles.has(scope.role) &&
    current.assignedToUserId !== scope.userId
  )
    throw new ScopeError("این پرونده به شما ارجاع نشده است.", 403);
  if (
    scope.role === "reception" &&
    (input.result !== undefined || input.operationReport !== undefined)
  )
    throw new ScopeError(
      "ثبت نتیجه و گزارش عملیات برای نقش پذیرش مجاز نیست.",
      403,
    );
  if (
    technicalRoles.has(scope.role) &&
    input.assignedToUserId !== undefined
  )
    throw new ScopeError(
      "تغییر مسئول پرونده فقط برای مدیر یا پذیرش مجاز است.",
      403,
    );
  if (
    technicalRoles.has(scope.role) &&
    (input.deliveryAmount !== undefined ||
      input.deliveredToName !== undefined ||
      input.deliveryNotes !== undefined)
  )
    throw new ScopeError(
      "ویرایش اطلاعات مالی و تحویل برای کارتابل فنی مجاز نیست.",
      403,
    );
  if (input.status !== undefined && current.hasWorkflow)
    throw new ReceptionError(
      "تغییر مرحله پرونده نسخه ۲ فقط از موتور فرایند مجاز است.",
      409,
    );

  let status = input.status ?? current.status;
  if (
    status !== current.status &&
    !transitions[current.status].includes(status)
  )
    throw new ReceptionError("این تغییر وضعیت برای پرونده مجاز نیست.", 409);
  if (
    scope.role === "reception" &&
    status !== current.status &&
    !["assigned", "delivered", "returned", "cancelled"].includes(status)
  )
    throw new ScopeError("این تغییر وضعیت در دسترسی پذیرش مجاز نیست.", 403);
  if (
    technicalRoles.has(scope.role) &&
    status !== current.status &&
    ![
      "diagnosing",
      "repairing",
      "awaiting_part",
      "awaiting_customer",
      "ready_for_delivery",
    ].includes(status)
  )
    throw new ScopeError("این تغییر وضعیت در کارتابل فنی مجاز نیست.", 403);

  const assignedToUserId =
    input.assignedToUserId === undefined
      ? current.assignedToUserId
      : input.assignedToUserId;
  if (
    assignedToUserId !== null &&
    (!Number.isSafeInteger(assignedToUserId) || assignedToUserId < 1)
  )
    throw new ReceptionError("مسئول پرونده معتبر نیست.", 400);
  if (
    input.assignedToUserId !== undefined &&
    assignedToUserId !== null &&
    !(await activeAssignee(db, scope, assignedToUserId))
  )
    throw new ReceptionError(
      "کاربر مقصد در این تعمیرگاه و شعبه فعال نیست.",
      409,
    );
  if (status === "awaiting_assignment" && assignedToUserId !== null)
    status = "assigned";
  if (status !== current.status && current.hasWorkflow)
    throw new ReceptionError(
      "تغییر مرحله پرونده نسخه ۲ فقط از موتور فرایند مجاز است.",
      409,
    );

  const result = optionalText(input.result ?? current.result, 32);
  if (result !== null && !["repaired", "not_repaired"].includes(result))
    throw new ReceptionError("نتیجه تعمیر معتبر نیست.", 400);
  const operationReport = optionalText(
    input.operationReport ?? current.operationReport,
    12_000,
  );
  if (
    status === "ready_for_delivery" &&
    (result === null || operationReport === null)
  )
    throw new ReceptionError(
      "نتیجه و گزارش عملیات برای ارسال به تحویل الزامی است.",
      409,
    );
  const deliveryAmount = input.deliveryAmount ?? current.deliveryAmount;
  if (!Number.isSafeInteger(deliveryAmount) || deliveryAmount < 0)
    throw new ReceptionError("مبلغ تحویل معتبر نیست.", 400);
  const deliveredToName = optionalText(
    input.deliveredToName ?? current.deliveredToName,
    180,
  );
  const deliveryNotes = optionalText(
    input.deliveryNotes ?? current.deliveryNotes,
    4_000,
  );
  if (status === "delivered" && !["repair_manager", "reception"].includes(scope.role))
    throw new ScopeError("ثبت تحویل فقط برای مدیر یا پذیرش مجاز است.", 403);
  if (status === "delivered" && deliveredToName === null)
    throw new ReceptionError("نام تحویل‌گیرنده الزامی است.", 400);

  const reason = optionalText(input.reason, 1_000);
  const description =
    status === "delivered"
      ? `دستگاه به ${deliveredToName} تحویل شد. مبلغ نهایی: ${deliveryAmount} ریال.${deliveryNotes ? ` توضیحات: ${deliveryNotes}` : ""}`
      : reason ??
        (status !== current.status
          ? "وضعیت پرونده تغییر کرد."
          : "مسئول یا اطلاعات عملیاتی پرونده به‌روزرسانی شد.");
  const deliveredByUserId =
    status === "delivered" ? scope.userId : current.deliveredByUserId;
  const deliveredAt = status === "delivered" ? now : current.deliveredAt;
  const nextVersion = input.expectedVersion + 1;
  const before = JSON.stringify({
    status: current.status,
    assignedToUserId: current.assignedToUserId,
    result: current.result,
    operationReport: current.operationReport,
    deliveryAmount: current.deliveryAmount,
    deliveredToName: current.deliveredToName,
    deliveryNotes: current.deliveryNotes,
    version: current.rowVersion,
  });
  const after = JSON.stringify({
    status,
    assignedToUserId,
    result,
    operationReport,
    deliveryAmount,
    deliveredToName,
    deliveryNotes,
    version: nextVersion,
  });
  const metadata = JSON.stringify({
    assignedToUserId,
    result,
    deliveryAmount,
    deliveredToName: status === "delivered" ? deliveredToName : null,
    expectedVersion: input.expectedVersion,
    nextVersion,
  });
  const today = now.slice(0, 10);
  const assignmentChanged = input.assignedToUserId !== undefined ? 1 : 0;
  const technicalGuard = technicalRoles.has(scope.role) ? 1 : 0;
  const statusGuard = status !== current.status ? 1 : 0;

  let results: unknown[];
  try {
    results = await db.batch([
      db
        .prepare(
          `UPDATE repair_cases SET status=?,assigned_to_user_id=?,result=?,operation_report=?,
             delivery_amount=?,delivered_to_name=?,delivery_notes=?,delivered_by_user_id=?,delivered_at=?,
             updated_at=?,row_version=row_version+1
           WHERE id=? AND shop_id=? AND branch_id=? AND row_version=? AND status=?
             AND (?=0 OR assigned_to_user_id=?)
             AND (?=0 OR NOT EXISTS(SELECT 1 FROM repair_case_workflows w WHERE w.case_id=repair_cases.id AND w.shop_id=repair_cases.shop_id))
             AND (?=0 OR ? IS NULL OR EXISTS(
               SELECT 1 FROM tamiran_users target
               JOIN tamiran_user_branches target_branch ON target_branch.user_id=target.id AND target_branch.shop_id=target.shop_id
               WHERE target.id=? AND target.shop_id=repair_cases.shop_id AND target.is_active=1
                 AND target_branch.branch_id=repair_cases.branch_id AND target_branch.is_active=1
                 AND target_branch.branch_role_code IN ('repair_manager','technician','quality_control')
             ))
             AND EXISTS(
               SELECT 1 FROM tamiran_users actor
               JOIN repair_shops shop ON shop.id=actor.shop_id
               JOIN tamiran_user_branches actor_branch ON actor_branch.user_id=actor.id AND actor_branch.shop_id=actor.shop_id
               JOIN repair_branches branch ON branch.id=actor_branch.branch_id AND branch.shop_id=actor_branch.shop_id
               WHERE actor.id=? AND actor.account_user_id=? AND actor.shop_id=repair_cases.shop_id
                 AND branch.id=repair_cases.branch_id AND actor_branch.branch_role_code=?
                 AND actor.is_active=1 AND actor_branch.is_active=1 AND branch.is_active=1
                 AND shop.lifecycle_status='active' AND shop.license_started_at<=? AND shop.license_expires_at>=?
             )`,
        )
        .bind(
          status,
          assignedToUserId,
          result,
          operationReport,
          deliveryAmount,
          deliveredToName,
          deliveryNotes,
          deliveredByUserId,
          deliveredAt,
          now,
          input.id,
          scope.shopId,
          scope.branchId,
          input.expectedVersion,
          current.status,
          technicalGuard,
          scope.userId,
          statusGuard,
          assignmentChanged,
          assignedToUserId,
          assignedToUserId,
          scope.userId,
          scope.accountUserId,
          scope.role,
          today,
          today,
        ),
      db
        .prepare(
          `INSERT INTO repair_case_events(case_id,actor_user_id,event_type,from_status,to_status,description,metadata_json,created_at)
           SELECT id,?,CASE WHEN changes()=1 THEN ? ELSE NULL END,?,?,?,?,?
           FROM repair_cases WHERE id=? AND shop_id=? AND branch_id=? AND row_version=?`,
        )
        .bind(
          scope.userId,
          status !== current.status ? "status_changed" : "case_updated",
          current.status,
          status,
          description,
          metadata,
          now,
          input.id,
          scope.shopId,
          scope.branchId,
          nextVersion,
        ),
      db
        .prepare(
          `INSERT INTO tamiran_audit_log(public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,before_json,after_json,reason,request_id,ip_address,user_agent,created_at)
           SELECT ?,shop_id,branch_id,?,CASE WHEN changes()=1 THEN ? ELSE NULL END,'repair_case',public_id,?,?,?,?,?,?,?
           FROM repair_cases WHERE id=? AND shop_id=? AND branch_id=? AND row_version=?`,
        )
        .bind(
          evidence.auditPublicId,
          scope.userId,
          status !== current.status ? "case.status_change" : "case.update",
          before,
          after,
          reason,
          evidence.requestId,
          evidence.ipAddress,
          evidence.userAgent,
          now,
          input.id,
          scope.shopId,
          scope.branchId,
          nextVersion,
        ),
    ]);
  } catch (error) {
    try {
      await classifyConflict(db, scope, input, today);
    } catch (classified) {
      if (classified instanceof ScopeError || classified instanceof ReceptionError)
        throw classified;
    }
    throw error;
  }
  if (
    resultChanges(results[0]) !== 1 ||
    resultChanges(results[1]) !== 1 ||
    resultChanges(results[2]) !== 1
  )
    await classifyConflict(db, scope, input, today);

  return {
    updated: true,
    repairCase: await readOperationalCase(db, scope, input.id, now),
  };
}
