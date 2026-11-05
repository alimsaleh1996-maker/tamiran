// Port of baseline/private/v2-core.php. Pure planning only: no database writes.
// Facts must be read from the authoritative, branch-scoped database.
export class WorkflowError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}
export type Policy = { profile: 'solo'|'pro'; inventoryPro: boolean; qcEnabled: boolean; assignmentRequired: boolean };
export function workflowMaps(policy: Policy) {
  const afterRepair = policy.inventoryPro ? 'parts_closeout' : policy.qcEnabled ? 'qc_pending' : 'finance_pending';
  const afterParts = policy.qcEnabled ? 'qc_pending' : 'finance_pending';
  const map: Record<string,string[]> = {
    reception: policy.profile === 'solo' ? ['diagnosing','estimate_pending','repairing','cancelled'] : ['awaiting_assignment','assigned','cancelled'],
    awaiting_assignment: policy.profile === 'solo' ? ['diagnosing','estimate_pending','repairing','cancelled'] : ['assigned','cancelled'],
    assigned: ['diagnosing','cancelled'],
    diagnosing: policy.profile === 'solo' ? ['estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','returned_unrepaired','cancelled'] : ['estimate_pending','awaiting_parts','repairing','returned_unrepaired','cancelled'],
    estimate_pending: ['awaiting_customer_approval','repairing','awaiting_parts','returned_unrepaired','cancelled'],
    awaiting_customer_approval: ['repairing','awaiting_parts','returned_unrepaired','cancelled'],
    awaiting_parts: ['repairing','returned_unrepaired','cancelled'],
    repairing: [afterRepair,'awaiting_parts','cancelled'], parts_closeout: [afterParts,'repairing'],
    qc_pending: ['qc_rework','qc_conditional','finance_pending'], qc_rework: ['repairing'], qc_conditional: ['finance_pending'],
    finance_pending: ['ready_for_delivery'], ready_for_delivery: [], returned_unrepaired: [], delivered: ['closed'], cancelled: [], closed: [],
  };
  return { mobile_tablet: map, computer_laptop: map };
}
export const roleTargets: Record<string,readonly string[]> = {
  reception: ['awaiting_assignment','assigned','awaiting_customer_approval','returned_unrepaired','cancelled'],
  technician: ['diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_pending','finance_pending'],
  quality_control: ['qc_rework','qc_conditional','finance_pending'], finance_cashier: ['ready_for_delivery'],
};
export type Scope = { shopId: number; branchId: number; actorId: number; role: string; permissions: readonly string[] };
export type CaseState = {
  shopId: number; branchId: number; workflowCode: string; status: string; lockVersion: number;
  lockedAt: string|null; primaryTechnicianId: number|null; preapprovedAmount: number; waitStartedAt: string|null;
};
export type Facts = {
  primaryTechnicianActiveInBranch: boolean; collaboratorIds: readonly number[];
  latestEstimate: null|{ totalAmount: number; status: string }; partsBlockers: readonly string[];
  qcBlockers: readonly string[]; financeBlockers: readonly string[]; terminalFinanceBlockers: readonly string[];
  existingTarget: string|null;
};
export type TransitionInput = {
  scope: Scope; row: CaseState; policy: Policy; facts: Facts; target: string; reason: string|null;
  expectedVersion: number; idempotencyKey: string; now: string;
};
export function holdReason(status: string): string|null {
  return ({awaiting_customer_approval:'customer',awaiting_parts:'part',qc_pending:'qc',finance_pending:'finance',awaiting_assignment:'assignment'} as Record<string,string>)[status]??null;
}
export function legacyStatus(status: string): string {
  if (['reception','awaiting_assignment'].includes(status)) return 'awaiting_assignment';
  if (status==='assigned') return 'assigned';
  if (['diagnosing','estimate_pending'].includes(status)) return 'diagnosing';
  if (status==='awaiting_customer_approval') return 'awaiting_customer';
  if (status==='awaiting_parts') return 'awaiting_part';
  if (['repairing','parts_closeout','qc_pending','qc_rework','qc_conditional','finance_pending'].includes(status)) return 'repairing';
  if (status==='ready_for_delivery') return status;
  if (status==='returned_unrepaired') return 'returned';
  if (['delivered','closed'].includes(status)) return 'delivered';
  if (status==='cancelled') return status;
  return 'awaiting_assignment';
}
export function planTransition(input: TransitionInput) {
  const {scope,row,policy,facts,target,expectedVersion,idempotencyKey,now} = input;
  const reason = input.reason?.trim() || null;
  if (scope.shopId!==row.shopId || scope.branchId!==row.branchId || scope.actorId<1) throw new WorkflowError('پرونده خارج از شعبه یا تعمیرگاه نشست است.',403);
  if (!idempotencyKey.trim() || [...idempotencyKey].length>160) throw new WorkflowError('شناسه یکتای انتقال معتبر نیست.',400);
  if (!Number.isSafeInteger(expectedVersion)||expectedVersion<0) throw new WorkflowError('نسخه پرونده معتبر نیست.',400);
  if (![facts.collaboratorIds,facts.partsBlockers,facts.qcBlockers,facts.financeBlockers,facts.terminalFinanceBlockers].every(Array.isArray)) throw new WorkflowError('بررسی موانع از پایگاه داده کامل نیست.',503);
  // A retry key must never substitute for actor authorization.
  if (scope.role!=='repair_manager') {
    if (!(roleTargets[scope.role]??[]).includes(target) && !scope.permissions.includes('workflow.transition.'+target)) throw new WorkflowError('نقش فعلی اجازه این انتقال فرایندی را ندارد.',403);
    if (scope.role==='technician' && row.primaryTechnicianId!==scope.actorId && !facts.collaboratorIds.includes(scope.actorId)) throw new WorkflowError('این پرونده به شما تخصیص ندارد.',403);
  }
  if (facts.existingTarget!==null) {
    if (facts.existingTarget!==target) throw new WorkflowError('شناسه یکتا قبلاً برای انتقال دیگری استفاده شده است.');
    return { replay: true as const, target, idempotencyKey };
  }
  if (row.lockVersion!==expectedVersion) throw new WorkflowError('پرونده هم‌زمان تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.');
  if (row.lockedAt!==null || ['returned_unrepaired','cancelled','closed'].includes(row.status)) throw new WorkflowError('پرونده بسته قابل بازگشایی یا ویرایش مستقیم نیست.');
  const maps = workflowMaps(policy) as Record<string,Record<string,string[]>>;
  if (!(maps[row.workflowCode]?.[row.status]??[]).includes(target)) throw new WorkflowError('این انتقال در گردش صنف پرونده مجاز نیست.');
  const terminal = ['cancelled','returned_unrepaired'].includes(target);
  if (terminal && reason===null) throw new WorkflowError('علت بستن پرونده الزامی است.',400);
  if (policy.assignmentRequired && !['awaiting_assignment','cancelled','returned_unrepaired'].includes(target)) {
    if (!row.primaryTechnicianId || !facts.primaryTechnicianActiveInBranch) throw new WorkflowError('مسئول فنی پرونده فعال یا مجاز در این شعبه نیست.');
  }
  if (['repairing','awaiting_parts'].includes(target) && facts.latestEstimate && facts.latestEstimate.totalAmount>row.preapprovedAmount && facts.latestEstimate.status!=='approved') throw new WorkflowError('هزینه بالاتر از سقف پذیرش است و تأیید معتبر مشتری لازم دارد.');
  if (policy.inventoryPro && ['qc_pending','finance_pending','ready_for_delivery','cancelled','returned_unrepaired'].includes(target) && facts.partsBlockers.length) throw new WorkflowError('قطعات پرونده تعیین‌تکلیف نشده‌اند.');
  if (terminal && facts.terminalFinanceBlockers.length) throw new WorkflowError('تعیین تکلیف مالی پیش از بستن پرونده الزامی است.');
  if (policy.qcEnabled && ['finance_pending','ready_for_delivery'].includes(target) && facts.qcBlockers.length) throw new WorkflowError('کنترل کیفیت تکمیل نیست.');
  if (target==='ready_for_delivery' && facts.financeBlockers.length) throw new WorkflowError('مالی پرونده تکمیل نیست.');
  const nowMs = Date.parse(now+'Z');
  const waitingMs = row.waitStartedAt===null?null:Date.parse(row.waitStartedAt+'Z');
  if (!Number.isFinite(nowMs) || (waitingMs!==null&&!Number.isFinite(waitingMs))) throw new WorkflowError('تاریخ گردش‌کار معتبر نیست.',400);
  const hold = holdReason(target);
  return {
    replay: false as const, target, idempotencyKey, reason, expectedVersion, nextVersion: expectedVersion+1,
    legacyStatus: legacyStatus(target), lockedAt: terminal?now:null, terminalReason: terminal?reason:null,
    waitReason: hold===null?null:hold==='customer'||hold==='part'?hold:'other',
    waitStartedAt: hold===null?null:row.waitStartedAt??now,
    externalWaitIncrement: waitingMs!==null&&hold===null?Math.max(0,Math.floor((nowMs-waitingMs)/1000)):0,
  };
}
