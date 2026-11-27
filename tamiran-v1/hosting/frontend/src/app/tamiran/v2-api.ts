import { directAdminRequest } from "./directadmin-api";

const jsonPost = <T>(path: string, payload: Record<string, unknown>) =>
  directAdminRequest<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    true,
  );

export type V2Blockers = { parts: string[]; qc: string[]; finance: string[] };
export type V2Case = {
  id: number;
  publicId: string;
  workflowPublicId: string;
  receiptNumber: string;
  workflowCode: "mobile_tablet" | "computer_laptop";
  caseKind: string;
  status: string;
  lockVersion: number;
  isLocked: boolean;
  receiptPending?: boolean;
  waitStartedAt?: string | null;
  pickupStartedAt?: string | null;
  deliveredAt?: string | null;
  customerName: string;
  customerMobile: string;
  deviceTitle: string;
  identifier: string;
  serialNumber?: string;
  imei?: string;
  initialIdentityReason?: string;
  declaredIssue: string;
  declaredIssues?: string[];
  dataHandling: "no_erasure" | "coordinate_first" | "erase_authorized";
  technicianName: string;
  primaryTechnicianUserId: number | null;
  preapprovedAmount: number;
  promisedAt: string | null;
  priority?: "normal" | "urgent" | "critical";
  acceptedAt: string;
  allowedTransitions: string[];
  mainState?:
    | "received"
    | "reviewing"
    | "in_progress"
    | "ready_for_delivery"
    | "closed";
  holdReason?: "customer" | "part" | "qc" | "finance" | "assignment" | null;
  closureOutcome?: "delivered" | "unrepaired" | "cancelled" | null;
  closureReason?: string | null;
  blockers: V2Blockers;
  updatedAt: string;
  technicianView: {
    group: "action_required" | "waiting" | "completed";
    statusLabel: string;
    priority: number;
    primaryAction: null | { key: string; label: string; target: string | null };
    secondaryActions: string[];
    flags: string[];
    allowedActions: Array<{ key: string; target: string }>;
  };
  productProfile?: "solo" | "pro";
  inventoryMode?: "off" | "simple" | "pro";
  qcMode?: "off" | "simple" | "independent";
  manualParts?: Array<{
    publicId: string;
    title: string;
    quantity: number;
    purchaseUnitCost: number;
    saleUnitPrice: number;
    note: string;
    createdAt: string;
  }>;
  latestEstimate?: {
    publicId: string;
    status: string;
    totalAmount: number;
    partsAmount?: number;
    laborAmount?: number;
    sentAt: string | null;
  } | null;
};
export type V2User = { id: number; display_name: string; role: string; workload?: ManagerWorkload };
export type V2Assignment = {
  id: number;
  public_id: string;
  case_id: number;
  receipt_number: string;
  technician_user_id: number;
  technician_name: string;
  assignment_type: string;
  task_title: string;
  compensation_model: string;
  fixed_fee: number;
  labor_percent: number;
  part_sale_percent: number;
  started_at: string | null;
  ended_at: string | null;
};
export type V2Handover = {
  id: number;
  public_id: string;
  case_id: number;
  receipt_number: string;
  from_user_id: number;
  to_user_id: number;
  from_user_name: string;
  to_user_name: string;
  status: string;
  reason: string;
  assets_json: string;
  requested_at: string;
  decided_at: string | null;
};
export type V2HandoverDiscrepancy = {
  reason: string;
  reportedAt: string;
  resolvedAt?: string;
  resolution?: string;
};
export type V2HandoverReceipt = {
  status: string;
  revision: string | null;
  discrepancy: V2HandoverDiscrepancy | null;
  receipt: {
    receiptNumber: string;
    deviceTitle: string;
    identifier: string | null;
    fromName: string;
    toName: string;
    reason: string;
    accessories: string[];
    activities?: Array<{ id: number; text: string }>;
    partIssues: V2HandoverItem[];
    installedParts: V2HandoverItem[];
    hotReturns: V2HandoverItem[];
    partsDisposition: string;
    hotReturnsDisposition: string;
    toolsNote: string | null;
  };
};
export type V2HandoverItem = {
  publicId: string;
  title: string;
  quantity: number;
  status: string;
};
export const loadV2HandoverReceipt = (publicId: string) =>
  directAdminRequest<V2HandoverReceipt>(
    `/api/workflow-v2.php?${new URLSearchParams({ handoverReceipt: publicId })}`,
  );
export function handoverDiscrepancy(handover: V2Handover): V2HandoverDiscrepancy | null {
  try {
    return JSON.parse(handover.assets_json)?.discrepancy ?? null;
  } catch {
    return null;
  }
}
export type V2WorkflowPayload = {
  cases: V2Case[];
  users: V2User[];
  assignments: V2Assignment[];
  handovers: V2Handover[];
  operationsPolicy: OperationsPolicy;
  workflowMaps: Record<string, Record<string, string[]>>;
  serverTime: string;
};
export const loadV2Workflow = (caseId?: number, query?: string) => {
  const params = new URLSearchParams();
  if (caseId) params.set("caseId", String(caseId));
  if (query) params.set("q", query);
  return directAdminRequest<V2WorkflowPayload>(
    `/api/workflow-v2.php${params.size ? `?${params}` : ""}`,
  );
};
export const transitionV2Case = (
  caseId: number,
  target: string,
  lockVersion: number,
  reason?: string,
) =>
  jsonPost<{ case: Record<string, unknown> }>("/api/workflow-v2.php", {
    action: "transition",
    caseId,
    target,
    lockVersion,
    reason,
  });
export const assignV2Case = (
  caseId: number,
  technicianUserId: number,
  reason: string,
  options?: { idempotencyKey: string; lockVersion: number },
) =>
  jsonPost<{ case: Record<string, unknown> }>("/api/workflow-v2.php", {
    action: "assign",
    caseId,
    technicianUserId,
    reason,
    ...options,
  });
export const workflowV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/workflow-v2.php", payload);
export const createV2Estimate = (payload: Record<string, unknown>) =>
  jsonPost<{
    estimate: {
      publicId: string;
      totalAmount: number;
      requiresCustomerApproval: boolean;
    };
  }>("/api/workflow-v2.php", { action: "estimate_create", ...payload });
export const sendV2Estimate = (estimatePublicId: string) =>
  jsonPost<{ sent: boolean }>("/api/workflow-v2.php", {
    action: "estimate_send",
    estimatePublicId,
  });

export type V2StockItem = {
  id: number;
  public_id: string;
  item_code: string;
  title: string;
  category: string;
  unit_title: string;
  physical_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  minimum_quantity: number;
  warehouse_id: number;
  sale_price: number;
  purchase_price?: number;
  hot_return_required: boolean;
};
export type V2PartRequest = {
  id: number;
  public_id: string;
  case_id: number;
  receipt_number: string;
  item_id: number;
  item_code: string;
  item_title: string;
  device_title?: string;
  created_at?: string;
  quantity: number;
  reserved_quantity: number;
  delivered_quantity: number;
  consumed_quantity: number;
  returned_quantity: number;
  status: string;
  requester_name: string;
  notes: string;
  reservation_is_expired: boolean;
};
export type V2PartIssue = {
  id: number;
  public_id: string;
  part_request_id: number;
  case_id: number;
  item_id: number;
  technician_user_id: number;
  quantity: number;
  status: string;
  notes: string | null;
  receipt_number: string;
  item_code: string;
  item_title: string;
  technician_name: string;
  created_at: string;
};
export type V2InventoryPayload = {
  items: V2StockItem[];
  requests: V2PartRequest[];
  issues: V2PartIssue[];
  warehouse: { id: number; public_id: string; title: string } | null;
  catalogPage?: { offset: number; nextOffset: number | null };
};
export type QueuePage = { offset: number; pageSize: number; total: number };
export type PartRequestQueue = V2InventoryPayload & {
  requestPage: QueuePage;
  requestCase: { id: number; receiptNumber: string } | null;
  requestTechnicians: Array<{ id: number; name: string }>;
};
export const loadPartRequestQueue = (params: string) =>
  directAdminRequest<PartRequestQueue>(`/api/inventory-v2.php?requests=1&${params}`);
export function loadV2Inventory(caseId?: number, catalog = false, search = "", offset = 0) {
  const params = new URLSearchParams();
  if (caseId) params.set("caseId", String(caseId));
  if (catalog) {
    params.set("catalog", "1");
    if (search) params.set("q", search);
    if (offset) params.set("offset", String(offset));
  }
  return directAdminRequest<V2InventoryPayload>(`/api/inventory-v2.php${params.size ? `?${params}` : ""}`);
}
export const inventoryV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/inventory-v2.php", payload);
export const loadV2InventoryControl = () =>
  directAdminRequest<Record<string, unknown[]>>(
    "/api/inventory-control-v2.php",
  );
export const inventoryControlV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/inventory-control-v2.php", payload);

export type V2Supplier = {
  id: number;
  public_id: string;
  name: string;
  mobile: string | null;
  is_active: boolean;
};
export type V2PurchaseDocument = {
  id: number;
  public_id: string;
  document_number: string;
  supplier_name: string;
  status: string;
  total_amount: number;
  expected_at: string | null;
  items: Array<{
    id: number; item_title: string; quantity: number; received_quantity: number; defective_quantity: number;
    requests: Array<{ part_request_id: number; case_id: number; receipt_number: string; allocated_quantity: number }>;
  }>;
};
export type V2ProcurementPayload = {
  suppliers: V2Supplier[];
  documents: V2PurchaseDocument[];
};
export const loadV2Procurement = () =>
  directAdminRequest<V2ProcurementPayload>("/api/procurement-v2.php");
export const procurementV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/procurement-v2.php", payload);

export type V2QcTemplate = {
  id: number;
  public_id: string;
  workflow_code: string;
  title: string;
  items: Array<{
    id: number;
    code: string;
    title: string;
    is_required: boolean;
    input_type: string;
  }>;
};
export type V2QualityPayload = {
  templates: V2QcTemplate[];
  runs: Array<Record<string, string | number | null>>;
};
export const loadV2Quality = () =>
  directAdminRequest<V2QualityPayload>("/api/quality-v2.php");
export type V2QualityCase = {
  receipt: { publicId: string; template: V2QcTemplate } | null;
  report: string | null;
  activities: string[];
  parts: Array<{ title: string; quantity: number }>;
};
export const loadV2QualityCase = (caseId: number) =>
  directAdminRequest<V2QualityCase>(`/api/quality-v2.php?caseId=${caseId}`);
export const startV2Quality = (caseId: number) =>
  jsonPost<{ receipt: { publicId: string; template: V2QcTemplate } }>("/api/quality-v2.php", { action: "start", caseId });
export const qualityV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/quality-v2.php", payload);

export const repairPaymentMethods = {
  card: "کارت‌خوان", cash: "نقدی", bank_transfer: "واریز بانکی", online: "آنلاین", credit: "اعتباری",
};
export type RepairPaymentMethod = keyof typeof repairPaymentMethods;
export type V2AdvanceCase = {
  id: number; receiptNumber: string; customerName: string; deviceTitle: string;
  advances: Array<{ publicId: string; remaining: number; method: RepairPaymentMethod; receivedAt: string }>;
};
export const searchAdvanceCases = (query: string) =>
  directAdminRequest<{ rows: V2AdvanceCase[] }>(`/api/finance-v2.php?${new URLSearchParams({ advanceSearch: query })}`);

type V2FinanceDevice = {
  technician_name?: string | null;
  process_status: string;
  customer_mobile?: string;
  identifier_snapshot?: string | null;
  serial_number_snapshot?: string | null;
  imei_snapshot?: string | null;
  device_title?: string;
};
export type V2Invoice = V2FinanceDevice & {
  id: number;
  public_id: string;
  invoice_number: string;
  case_id: number;
  receipt_number: string;
  customer_name: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  refunded_amount: number;
  balance: number;
  blockers: string[];
  items: Array<Record<string, string | number>>;
  payments: Array<Record<string, string | number>>;
  refunds: Array<Record<string, string | number>>;
  receivables: Array<Record<string, string | number>>;
};
export type V2InvoiceDraft = V2FinanceDevice & {
  caseId: number;
  receiptNumber: string;
  customerName: string;
  estimatePublicId: string | null;
  lockVersion: number;
  authorizedAmount: number;
  advanceAmount?: number;
  approvalAmount: number | null;
  approvalStatus: string | null;
  unrepaired: boolean;
  qualityStatus: "passed" | "pending" | null;
  items: Array<{
    type: "part" | "labor" | "diagnostic" | "other";
    sourceKey?: string;
    sourceType?: "stock" | "manual" | "external";
    referenceId?: number | null;
    title: string;
    quantity: number;
    saleUnitPrice: number;
    discountAmount: number;
    taxRate: number;
    warrantyDays: number;
  }>;
};
export type V2FinancePermissions = { issue: boolean; payment: boolean; manage: boolean; receivable: boolean; reapproval: boolean };
export type V2FinanceWorkspace =
  | { available: true; invoices: V2Invoice[]; drafts: V2InvoiceDraft[]; paymentMethods: RepairPaymentMethod[]; permissions: V2FinancePermissions }
  | { available: false; pending: Array<{
      receiptNumber: string; customerName: string; customerMobile: string;
      identifier: string | null; serialNumber?: string | null; imei?: string | null; deviceTitle: string;
    }> };
export const loadV2FinanceWorkspace = () =>
  directAdminRequest<V2FinanceWorkspace>("/api/finance-v2.php?workspace=1");
export const financeV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/finance-v2.php", payload);

export type V2DeliveryCase = {
  lock_version: number;
  qc_mode_snapshot: "off" | "simple" | "independent";
  brand_snapshot: string;
  model_snapshot: string;
  delivered_to_name: string | null;
  identifier_snapshot: string | null;
  serial_number_snapshot?: string | null;
  imei_snapshot?: string | null;
  device_type_snapshot: string;
  delivered_at: string | null;
  case_id: number;
  case_public_id: string;
  receipt_number: string;
  customer_name: string;
  customer_mobile: string;
  accessories_json: string;
  invoice_public_id: string;
  invoice_number: string;
  process_status: string;
  balance: number;
  active_warranty_count: number;
  blockers: V2Blockers;
};
export const loadV2Delivery = () =>
  directAdminRequest<{
    cases: V2DeliveryCase[];
    verificationSettings: Record<string, unknown>;
    warrantyEnabled: boolean;
  }>("/api/delivery-v2.php");
export const deliveryV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/delivery-v2.php", payload);

export const loadV2Sms = () =>
  directAdminRequest<Record<string, unknown[]>>("/api/sms-v2.php");
export const smsV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/sms-v2.php", payload);

export type TechnicalActivity = {
  correctsActivityId?: number | null;
  id: number;
  title: string;
  description: string;
  observation: string;
  attachments: string[];
  actorName: string;
  createdAt: string;
};
export type TechnicalProjection = {
  receiptPending?: boolean;
  invoice: TechnicalInvoice;
  summary?: { diagnosedIssues: string[]; customerIssueAssessment?: string | null; issueAssessments?: string[]; qcResult: string | null };
  reworkDestination?: "diagnosing" | "repairing" | null;
  unrepairedAmount: number;
  unrepairedFinanceBlockers: string[];
  receptionNotes: string;
  nextDestination: string;
  cost: {
    state:
      | "needs_estimate"
      | "waiting_customer"
      | "approved"
      | "rejected"
      | "needs_revision";
    authorized: boolean;
    totalAmount: number;
    partsAmount: number;
    capAmount: number;
    estimatePublicId: string | null;
  };
  parts: Array<{
    sourceType: "stock" | "manual" | "external";
    sourceKey: string;
    title: string;
    quantity: number;
    saleUnitPrice: number;
    purchaseUnitCost?: number;
  }>;
  activities: { activities: TechnicalActivity[]; nextBeforeId: number | null };
  report: string;
  result: string | null;
  permissions: {
    receive?: boolean;
    devicePassword?: boolean;
    refer: boolean;
    activity: boolean;
    parts: boolean;
    finish: boolean;
    purchase: boolean;
    stock: boolean;
  };
};
export const loadTechnicalCase = (caseId: number) =>
  directAdminRequest<TechnicalProjection>(
    `/api/workflow-v2.php?caseId=${caseId}&technical=1`,
  );
export const loadTechnicalActivities = (caseId: number, beforeId: number) =>
  directAdminRequest<TechnicalProjection["activities"]>(
    `/api/workflow-v2.php?caseId=${caseId}&technicalActivities=1&beforeId=${beforeId}`,
  );

export type OperationsPolicy = {
  handover: "direct" | "manager" | "disabled";
  approval: "both" | "phone" | "sms";
  purchase: "free" | "approval" | "limit";
  purchaseLimits: Record<string, number>;
  followHours: Record<"customer" | "parts" | "pickup" | "receipt", number>;
  hotReturnHours: number;
  paymentMethods: RepairPaymentMethod[];
  reasons: Array<{ id: string; title: string; active: boolean }>;
};
export type ExternalPurchase = {
  publicId: string;
  caseId: number;
  receiptNumber: string;
  title: string;
  quantity: number;
  unitCost?: number;
  total?: number;
  requestedBy: number;
  disposition?: string;
  status: "pending" | "approved" | "rejected" | "bought" | "received" | "used" | "returning" | "returned" | "cancelled";
  decisionNote?: string;
};
export type ExternalPurchasePayload = {
  rows: ExternalPurchase[];
  catalog: Array<{ id: number; code: string; title: string; salePrice: number }>;
  policy: OperationsPolicy["purchase"];
  ownLimit: number;
  ownCommitted: number;
  canManageCatalog: boolean;
  canPriceCatalog: boolean;
  catalogCategories: string[];
};
export const loadExternalPurchases = (caseId?: number) =>
  directAdminRequest<ExternalPurchasePayload>(
    `/api/workflow-v2.php?externalPurchase=1&summary=1${caseId ? `&caseId=${caseId}` : ""}`,
  );
export const searchExternalCatalog = (caseId: number, q: string) =>
  directAdminRequest<{ items: ExternalPurchasePayload["catalog"] }>(
    `/api/workflow-v2.php?${new URLSearchParams({ externalCatalog: "1", caseId: String(caseId), q })}`,
  );
export const changeExternalPurchase = (payload: Record<string, unknown>) =>
  workflowV2Action({ action: "external_purchase", ...payload });
export function handoverNeedsApproval(handover: V2Handover): boolean {
  try {
    const assets = JSON.parse(handover.assets_json);
    return !!assets.managerApprovalRequired && !assets.managerApprovedAt;
  } catch {
    return false;
  }
}
export type TechnicalInvoice = {
  items: Array<{
    type: "part" | "labor" | "diagnostic" | "other";
    sourceKey?: string;
    title: string;
    quantity: number;
    saleUnitPrice: number;
    lineTotal: number;
    discountAmount: number;
    taxRate: number;
  }>;
  totalAmount: number;
  authorizedAmount: number;
  mayEditPartPrices: boolean;
};

export type ManagerWorkload = { id: number; name: string; active: number; awaitingReceipt: number; overdue: number };
export type ManagerPulseData = {
  stages: Record<string, number>;
  technicians: ManagerWorkload[];
  awaitingReceipt: number;
  receiptOverdue: number;
  overdue: number;
  openHotReturns: number;
  counts: Record<string, number>;
};
export const loadManagerPulse = () =>
  directAdminRequest<ManagerPulseData>("/api/workflow-v2.php?managerPulse=1");
export type ManagerQueueCase = Pick<V2Case, "id" | "status" | "receiptNumber" | "customerName" |
  "deviceTitle" | "technicianName" | "declaredIssue" | "priority" | "acceptedAt" | "promisedAt" | "receiptPending">;
export const loadManagerCaseQueue = (params: string) =>
  directAdminRequest<QueuePage & { rows: ManagerQueueCase[] }>(`/api/workflow-v2.php?${params}`);
export const loadManagerQueueOptions = () =>
  directAdminRequest<V2WorkflowPayload>("/api/workflow-v2.php?managerQueueOptions=1");

export type ManagerPerformance = {
  id: number;
  name: string;
  active: number;
  delivered: number;
  repaired: number;
  unrepaired: number;
  technicalFailures: number;
  assigned: number;
  trend: Record<string, number>;
  completedCases: Array<{ id: number; receiptNumber: string; result: "repaired" | "unrepaired" }>;
  withInitialDue: number;
  onTime: number;
  stageTimes: Record<string, number>;
  qcRuns: number;
  qcFailures: number;
  transferReasons: Array<{ label: string; count: number }>;
};
export const loadManagerPerformance = (from: string, to: string) =>
  directAdminRequest<{ rows: ManagerPerformance[] }>(
    `/api/workflow-v2.php?${new URLSearchParams({ managerReport: "1", from, to })}`,
  );

export type ManagerMetricCase = { id: number; receiptNumber: string; deviceTitle: string; samples: number };
export const loadManagerMetricCases = (from: string, to: string, technician: number, metric: string, variant: string, offset = 0) =>
  directAdminRequest<{ rows: ManagerMetricCase[]; nextOffset: number | null }>(
    `/api/workflow-v2.php?${new URLSearchParams({ managerReport: "1", from, to, technician: String(technician), metric, variant, offset: String(offset) })}`
  );
export type OperationsFollowupReason = "customer" | "parts" | "pickup" | "receipt" | "late";
export type OperationsFollowup = {
  caseId: number;
  receiptNumber: string;
  deviceTitle: string;
  technicianName: string;
  statusLabel: string;
  reasons: Array<{ name: OperationsFollowupReason; elapsedSeconds: number }>;
};
export const loadOperationsFollowups = (filter: string, offset = 0) =>
  directAdminRequest<{ rows: OperationsFollowup[]; nextOffset: number | null }>(
    `/api/workflow-v2.php?${new URLSearchParams({ managerFollowups: "1", filter, offset: String(offset) })}`,
  );
