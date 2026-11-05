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
  customerName: string;
  customerMobile: string;
  deviceTitle: string;
  identifier: string;
  declaredIssue: string;
  dataHandling: "no_erasure" | "coordinate_first" | "erase_authorized";
  technicianName: string;
  primaryTechnicianUserId: number | null;
  preapprovedAmount: number;
  promisedAt: string | null;
  acceptedAt: string;
  allowedTransitions: string[];
  mainState?: "received" | "reviewing" | "in_progress" | "ready_for_delivery" | "closed";
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
    sentAt: string | null;
  } | null;
};
export type V2User = { id: number; display_name: string; role: string };
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
export type V2WorkflowPayload = {
  cases: V2Case[];
  users: V2User[];
  assignments: V2Assignment[];
  handovers: V2Handover[];
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
) =>
  jsonPost<{ case: Record<string, unknown> }>("/api/workflow-v2.php", {
    action: "assign",
    caseId,
    technicianUserId,
    reason,
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
};
export const loadV2Inventory = () =>
  directAdminRequest<V2InventoryPayload>("/api/inventory-v2.php");
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
  items: Array<Record<string, string | number | null>>;
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
export const qualityV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/quality-v2.php", payload);

export type V2Invoice = {
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
  items: Array<Record<string, string | number>>;
  payments: Array<Record<string, string | number>>;
  refunds: Array<Record<string, string | number>>;
  receivables: Array<Record<string, string | number>>;
};
export type V2InvoiceDraft = {
  caseId: number;
  receiptNumber: string;
  customerName: string;
  estimatePublicId: string | null;
  items: Array<{
    type: "part" | "labor" | "diagnostic" | "other";
    referenceId?: number | null;
    title: string;
    quantity: number;
    saleUnitPrice: number;
    purchaseUnitCost: number;
    discountAmount: number;
    taxRate: number;
    warrantyDays: number;
  }>;
};
export const loadV2Finance = () =>
  directAdminRequest<{ invoices: V2Invoice[]; drafts: V2InvoiceDraft[] }>("/api/finance-v2.php");
export const financeV2Action = (payload: Record<string, unknown>) =>
  jsonPost<Record<string, unknown>>("/api/finance-v2.php", payload);

export type V2DeliveryCase = {
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
