import { directAdminApiEnabled, FollowUpApiError } from "./followups-api";
import type {
  CreateInventoryItemInput,
  CreatePartRequestInput,
  CreateRepairCaseInput,
  CustomerLookupResult,
  OperationalSnapshot,
  RepairCaseRecord,
  RepairCaseStatus,
} from "./operations";
import type { DeviceCatalogItem } from "./catalog";
import {
  buildDraftDiscardRequest,
  buildDraftSaveRequest,
  isDraftVersionConflict,
} from "../software/reception-draft-mutations";
import { buildCaseMutationRequest } from "../software/case-mutations";
import {
  buildSiteSessionLogout,
  buildSiteSessionStart,
  siteDispatchSignOutPath,
} from "../software/auth-session-adapter";
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string; tracking_code?: string };
};
export class DirectAdminApiError extends FollowUpApiError {
  status: number;

  constructor(message: string, status: number, trackingCode?: string) {
    super(message, trackingCode);
    this.name = "DirectAdminApiError";
    this.status = status;
  }
}
export function isDirectAdminConflict(error: unknown) {
  return isDraftVersionConflict(error);
}
let csrf: string | null = null;
let authCsrf: string | null = null;
async function readEnvelope<T>(response: Response): Promise<Envelope<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new DirectAdminApiError(
      "پاسخ نامعتبر از سرور دریافت شد.",
      response.status,
      response.headers.get("X-Request-ID") ?? undefined,
    );
  }
  return response.json() as Promise<Envelope<T>>;
}
async function getCsrfToken(): Promise<string> {
  if (csrf) return csrf;
  const response = await fetch("/api/csrf.php", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const body = await readEnvelope<{ csrf_token: string }>(response);
  if (!response.ok || !body.ok || !body.data?.csrf_token)
    throw new DirectAdminApiError(
      body.error?.message ?? "نشست امن ساخته نشد.",
      response.status,
      body.error?.tracking_code,
    );
  csrf = body.data.csrf_token;
  return csrf;
}
export async function directAdminRequest<T>(
  path: string,
  init: RequestInit = {},
  needsCsrf = false,
  retryCsrf = true,
): Promise<T> {
  if (!directAdminApiEnabled)
    throw new FollowUpApiError("نسخه سرور DirectAdmin فعال نیست.");
  const token = needsCsrf ? await getCsrfToken() : null;
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { "X-CSRF-Token": token } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await readEnvelope<T>(response);
  if (needsCsrf && response.status === 419 && retryCsrf) {
    csrf = null;
    return directAdminRequest<T>(path, init, true, false);
  }
  if (!response.ok || !body.ok || body.data === undefined)
    throw new DirectAdminApiError(
      body.error?.message ?? "ارتباط با سرور ناموفق بود.",
      response.status,
      body.error?.tracking_code,
    );
  return body.data;
}
const request = directAdminRequest;
export type ServerActor = {
  id: number;
  displayName: string;
  role: string;
  primaryRole?: string;
  permissions?: string[];
  isCentralAdmin: boolean;
  mustChangePassword?: boolean;
  branch: null | { id: number; code: string; name: string };
  shop: null | {
    id: number;
    code: string;
    publicCode?: string;
    name: string;
    repairType: string;
    plan: string;
    modules: string[];
    productProfile: "solo" | "pro";
    inventoryMode: "off" | "simple" | "pro";
    qcMode: "off" | "simple" | "independent";
    featureFlags?: Record<string, boolean>;
    licenseStatus: string;
    expiresAt: string;
    nationalCodeRequired: boolean;
  };
};
export type CapabilityModule = {
  module: string;
  label: string;
  description: string;
  entitlement: "active" | "trial" | "locked" | "expired" | "suspended";
  permission: "manage" | "use" | "none";
  navigation: "visible" | "hidden";
  catalog: "visible" | "hidden";
  access: "granted" | "denied" | "locked";
  cta: "request_activation" | null;
  trialDaysRemaining: number | null;
  expiresAt: string | null;
};
export type CapabilitySnapshot = {
  productProfile: "solo" | "pro" | null;
  discoverable: boolean;
  modules: CapabilityModule[];
  generatedAt?: string;
};
export type LoginResult = {
  actor?: ServerActor;
  requiresContext: boolean;
  challenge?: string;
  contextCount?: number;
  authCsrfToken?: string | null;
};
export type AdminShop = {
  id: number;
  publicId: string;
  code: string;
  publicShopCode: string;
  name: string;
  repairType: string;
  typeLocked: boolean;
  size: string;
  plan: string;
  modules: string[];
  productProfile: "solo" | "pro";
  inventoryMode: "off" | "simple" | "pro";
  qcMode: "off" | "simple" | "independent";
  featureFlags?: Record<string, boolean>;
  status: string;
  lifecycleStatus: string;
  startedAt: string;
  expiresAt: string;
  nationalCodeRequired: boolean;
  maxUsers: number;
  maxBranches: number;
  userCount: number;
  branchCount: number;
  openTickets: number;
  createdAt: string;
  updatedAt: string;
};
export type AdminUser = {
  id: number;
  shopId: number | null;
  shopName: string;
  shopCode: string;
  username: string;
  displayName: string;
  phone: string;
  email: string;
  role: string;
  isActive: boolean;
  branchIds: number[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};
export type AdminBranch = {
  id: number;
  shopId: number;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
};
export type ModuleChangeRecord = {
  id: number;
  shopId: number;
  shopName: string;
  shopCode: string;
  actorName: string;
  previousModules: string[];
  newModules: string[];
  addedModules: string[];
  removedModules: string[];
  reason: string;
  context: "initial_setup" | "manual" | "plan_change" | "invoice" | "renewal";
  relatedPlan: string;
  invoiceNumber: string;
  licenseExpiresAt: string;
  createdAt: string;
};
export type AdminDashboard = {
  summary: Record<string, number>;
  shops: AdminShop[];
  moduleChanges: ModuleChangeRecord[];
};
export type BackupJob = {
  id: number;
  publicId: string;
  type: "global" | "shop" | "emergency";
  shopId: number | null;
  shopCode: string | null;
  shopName: string | null;
  trigger: string;
  status: string;
  localStatus: string;
  offsiteStatus: string;
  archiveName: string | null;
  checksum: string | null;
  sizeBytes: number;
  recordCount: number;
  tableCounts: Record<string, number>;
  offsiteKey: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
};
export type BackupHealth = {
  settings: {
    enabled: number | boolean;
    global_interval_minutes: number;
    shop_interval_hours: number;
    local_hourly_retention: number;
    daily_retention_days: number;
    weekly_retention_weeks: number;
    monthly_retention_months: number;
    offsite_required: number | boolean;
  };
  localReady: boolean;
  offsiteConfigured: boolean;
  latest: BackupJob | null;
  latestGlobal: BackupJob | null;
  failed24Hours: number;
  shopsWithoutRecentBackup: number;
  configPath: string;
};
export type BackupRestore = {
  id: number;
  publicId: string;
  backupJobId: number;
  archiveName: string;
  shopId: number | null;
  shopCode: string | null;
  shopName: string | null;
  type: string;
  status: string;
  previewCounts: Record<string, number>;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};
export type BackupDashboard = {
  health: BackupHealth;
  jobs: BackupJob[];
  restores: BackupRestore[];
};
export type SalesInvoiceItem = {
  type: "product" | "plan" | "repair_type" | "module" | "capacity" | "service";
  code: string;
  productKey?: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};
export type PriceCatalogItem = {
  id: number;
  productKey: string;
  name: string;
  itemType: "product" | "module" | "capacity" | "service";
  billingPeriod: string;
  taxRate: number;
  entitlementEffect: Record<string, unknown>;
  priceVersion: string | null;
  unitPrice: number | null;
  active?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};
export type SalesInvoice = {
  id: number;
  publicId: string;
  invoiceNumber: string;
  shopId: number;
  shopName: string;
  shopCode: string;
  plan: string;
  productProfile?: "solo" | "pro";
  productSnapshot?: Record<string, unknown>;
  activationStatus?: string;
  provisioningStatus?: string;
  provisioningError?: string | null;
  operationType?: string;
  repairType: string;
  modules: string[];
  items: SalesInvoiceItem[];
  payments?: Array<{
    id: number;
    amount: number;
    method: string;
    reference?: string | null;
    paidAt: string;
    note?: string | null;
    actor: string;
  }>;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  description: string;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
export type ProductChangeIssue = {
  code: string;
  message: string;
  action?: string | null;
};
export type ProductChangeCheck = {
  allowed: boolean;
  currentProduct: "solo" | "pro";
  targetProduct: "solo" | "pro";
  warnings: ProductChangeIssue[];
  blockers: ProductChangeIssue[];
  impact: {
    openCases: number;
    users: number;
    branches: number;
    inventoryState: string;
    qcState: string;
    featureOverrides: number;
    modules: string[];
    preserved: string[];
    enabledByProduct: string[];
    addonsRemainIndependent: string[];
  };
  history: Array<Record<string, unknown>>;
};
export const identifyLogin = async (
  mobile: string,
  password: string,
  captchaAnswer: string,
) => {
  const result = await directAdminRequest<LoginResult>(
    "/api/auth.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "identify",
        mobile,
        password,
        captchaAnswer,
      }),
    },
    true,
  );
  if (result.actor) csrf = null;
  return result;
};
export const completeLogin = async (
  challenge: string,
  shopCode: string,
  branchCode: string,
) => {
  const result = await request<LoginResult>(
    "/api/auth.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "select_context",
        challenge,
        shopCode,
        branchCode,
      }),
    },
    true,
  );
  csrf = null;
  return result;
};
export const changeInitialPassword = (
  newPassword: string,
  confirmation: string,
) =>
  request<{ changed: boolean; actor: ServerActor }>(
    "/api/auth.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "change_initial_password",
        newPassword,
        confirmation,
      }),
    },
    true,
  );
export const restoreSession = async () => {
  const context = await request<LoginResult & { actor: ServerActor | null }>(
    "/api/auth.php",
  );
  if (!context.actor || context.requiresContext) return context;
  if (!context.authCsrfToken)
    throw new DirectAdminApiError("کلید امن نشست تنظیم نشده است.", 503);
  authCsrf = context.authCsrfToken;
  const result = await request<LoginResult & { actor: ServerActor | null }>(
    "/api/auth.php",
    buildSiteSessionStart(authCsrf),
  );
  csrf = null;
  return result;
};
export const signOut = async () => {
  if (!authCsrf) {
    const context = await request<LoginResult>("/api/auth.php");
    authCsrf = context.authCsrfToken ?? null;
  }
  if (!authCsrf)
    throw new DirectAdminApiError("نشست امن خروج آماده نیست.", 503);
  const result = await request<{ signed_out: boolean }>(
    "/api/auth.php",
    buildSiteSessionLogout(authCsrf),
  );
  csrf = null;
  authCsrf = null;
  if (typeof window !== "undefined") {
    if (window.top) window.top.location.href = siteDispatchSignOutPath;
    else window.location.href = siteDispatchSignOutPath;
  }
  return result;
};
export const loadAdmin = () => request<AdminDashboard>("/api/admin.php");
export const createShop = (input: Record<string, unknown>) =>
  request<{
    created: boolean;
    replayed?: boolean;
    shopCode: string;
    publicShopCode: string;
    managerMobile: string;
    temporaryPassword: string;
  }>(
    "/api/admin.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const updateShop = (input: Record<string, unknown>) =>
  request<{ updated: boolean }>(
    "/api/admin.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const loadBackups = () => request<BackupDashboard>("/api/backups.php");
export const runBackup = (shopId?: number) =>
  request<{
    job: {
      id: number;
      status: string;
      archive: string;
      checksum: string;
      size: number;
      records: number;
      offsiteStatus: string;
    };
  }>(
    "/api/backups.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        shopId ? { action: "run_shop", shopId } : { action: "run_global" },
      ),
    },
    true,
  );
export const verifyBackup = (jobId: number) =>
  request<{ verified: boolean; records: number }>(
    "/api/backups.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", jobId }),
    },
    true,
  );
export const previewBackupRestore = (jobId: number) =>
  request<{
    preview: {
      jobId: number;
      backupType: string;
      shopId: number | null;
      shopCode: string | null;
      createdAt: string;
      counts: Record<string, number>;
      records: number;
    };
  }>(
    "/api/backups.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview_restore", jobId }),
    },
    true,
  );
export const restoreShopBackup = (
  jobId: number,
  password: string,
  confirmation: string,
) =>
  request<{
    restored: boolean;
    shopCode: string;
    emergencyBackupJobId: number;
    restoreId: number;
  }>(
    "/api/backups.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restore_shop",
        jobId,
        password,
        confirmation,
      }),
    },
    true,
  );
export const saveBackupSettings = (input: Record<string, unknown>) =>
  request<{ updated: boolean }>(
    "/api/backups.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", ...input }),
    },
    true,
  );
export const cleanupBackups = () =>
  request<{ removed: number }>(
    "/api/backups.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cleanup" }),
    },
    true,
  );
export const loadAdminUsers = () =>
  request<{ users: AdminUser[]; branches: AdminBranch[] }>(
    "/api/admin-users.php",
  );
export const createAdminUser = (input: Record<string, unknown>) =>
  request<{ created: boolean }>(
    "/api/admin-users.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const updateAdminUser = (input: Record<string, unknown>) =>
  request<{ updated: boolean }>(
    "/api/admin-users.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const loadSalesInvoices = () =>
  request<{
    summary: Record<string, number>;
    invoices: SalesInvoice[];
    catalog: PriceCatalogItem[];
  }>(
    "/api/sales-v2.php",
  );
export const loadPriceCatalog = () =>
  request<{ items: PriceCatalogItem[] }>("/api/price-catalog.php");
export const createPriceVersion = (input: {
  catalogId: number;
  versionCode: string;
  unitPrice: number;
  effectiveFrom: string;
}) =>
  request<{ updated: boolean; items: PriceCatalogItem[] }>(
    "/api/price-catalog.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const createSalesInvoice = (input: Record<string, unknown>) =>
  request<{
    created: boolean;
    invoiceNumber: string;
    invoiceId: number;
    provisioningStatus: string;
  }>(
    "/api/sales-v2.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        action: "create_invoice",
        operationType: String(input.operationType ?? "new_sale"),
        provisionNow: input.provisionNow === true,
        priceOverrideReason: String(input.priceOverrideReason ?? ""),
        items: (Array.isArray(input.items) ? input.items : [])
          .filter((item) => {
            const candidate = item as Record<string, unknown>;
            return ["product", "module", "capacity", "service"].includes(
              String(candidate.type),
            );
          })
          .map((item) => {
            const candidate = item as Record<string, unknown>;
            const code = String(candidate.code ?? "");
            const moduleKeys: Record<string, string> = {
              inventory: "inventory_pro",
              customer_portal: "customer_portal",
              multi_branch: "multi_branch",
              finance: "finance_module",
              sms: "sms_module",
            };
            return {
              productKey:
                String(candidate.productKey ?? "") ||
                (candidate.type === "product"
                  ? `tamiran_${code}`
                  : (moduleKeys[code] ?? code)),
              quantity: Number(candidate.quantity ?? 1),
              unitPrice: Number(candidate.unitPrice ?? 0),
              discountAmount: 0,
            };
          }),
      }),
    },
    true,
  );
export const updateSalesInvoice = (input: Record<string, unknown>) =>
  request<{ updated: boolean }>(
    "/api/sales.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const recordSalesPayment = (input: Record<string, unknown>) =>
  request<{ recorded: boolean; paidAmount: number; balance: number }>(
    "/api/sales-v2.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record_payment", ...input }),
    },
    true,
  );
export const retrySalesProvisioning = (invoiceId: number) =>
  request<{ provisioning: { status: string; error?: string } }>(
    "/api/sales-v2.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry_provision", invoiceId }),
    },
    true,
  );
export const checkProductChange = (
  shopId: number,
  target: "solo" | "pro",
) =>
  request<ProductChangeCheck>(
    `/api/product-change.php?shop_id=${encodeURIComponent(shopId)}&target=${target}`,
  );
export const executeProductChange = (input: Record<string, unknown>) =>
  request<{ replayed: boolean; operation: Record<string, unknown> }>(
    "/api/product-change.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const createTicket = (input: Record<string, string>) =>
  request<{ created: boolean }>(
    "/api/tickets.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export type SupportTicketMessage = {
  id: number;
  body: string;
  created_at: string;
  author_name: string;
};
export type SupportTicketRecord = {
  public_id: string;
  category: string;
  priority: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  shop_name: string;
  created_by: string;
  messages: SupportTicketMessage[];
};
export const loadTickets = () =>
  request<{ tickets: SupportTicketRecord[] }>("/api/tickets.php");
export const changeTicket = (input: Record<string, string>) =>
  request<{ updated: boolean }>(
    "/api/tickets.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const updateShopSettings = (input: {
  nationalCodeRequired?: boolean;
  allowDeliveryWithBalance?: boolean;
}) =>
  request<{ updated: boolean }>(
    "/api/settings.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const loadShopSettings = () =>
  request<{ shop: Record<string, unknown>; settings: Record<string, unknown> }>(
    "/api/settings.php",
  );
export const loadCapabilities = () =>
  request<CapabilitySnapshot>("/api/capabilities.php");
export const requestModuleActivation = (module: string, reason = "") =>
  request<{ requested: boolean; requestId: string }>(
    "/api/capabilities.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_activation", module, reason }),
    },
    true,
  );
export const recordCapabilityEvent = (
  module: string,
  event: string,
  metadata: Record<string, unknown> = {},
) =>
  request<{ recorded: boolean }>(
    "/api/capabilities.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "event", module, event, metadata }),
    },
    true,
  );
export const saveShopSetting = (key: string, value: unknown) =>
  request<{ updated: boolean }>(
    "/api/settings.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    },
    true,
  );
export const loadOperations = () =>
  request<OperationalSnapshot>("/api/operations.php");
export const lookupCustomer = (mobile: string) =>
  request<{ customer: CustomerLookupResult | null }>(
    `/api/operations.php?customerMobile=${encodeURIComponent(mobile)}`,
  );
export const createRepairCase = (input: CreateRepairCaseInput) =>
  request<{ created: boolean; repairCase: RepairCaseRecord }>(
    "/api/operations.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_case", ...input }),
    },
    true,
  );
export const saveReceptionDraft = (
  idempotencyKey: string,
  payload: Record<string, unknown>,
  expectedVersion?: number,
) =>
  request<{
    saved: boolean;
    publicId: string;
    expiresAt: string;
    version: number;
  }>(
    "/api/operations.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildDraftSaveRequest(idempotencyKey, payload, expectedVersion),
      ),
    },
    true,
  );
export const discardReceptionDraft = (
  publicId: string,
  expectedVersion: number,
) =>
  request<{ discarded: boolean; replayed?: boolean }>(
    "/api/operations.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildDraftDiscardRequest({ publicId, version: expectedVersion }),
      ),
    },
    true,
  );
export const createInventoryItem = (input: CreateInventoryItemInput) =>
  request<{ created: boolean }>(
    "/api/operations.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_inventory_item", ...input }),
    },
    true,
  );
export const createPartRequest = (input: CreatePartRequestInput) =>
  request<{ created: boolean }>(
    "/api/operations.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_part_request", ...input }),
    },
    true,
  );
export const updateRepairCase = (input: {
  id: number;
  expectedVersion: number;
  status?: RepairCaseStatus;
  assignedToUserId?: number | null;
  result?: string;
  operationReport?: string;
  reason?: string;
  deliveryAmount?: number;
  deliveredToName?: string;
  deliveryNotes?: string;
}) =>
  request<{ updated: boolean; repairCase: RepairCaseRecord }>(
    "/api/operations.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCaseMutationRequest(input)),
    },
    true,
  );
export const loadCatalog = async (): Promise<DeviceCatalogItem[]> => {
  const data = await request<{
    items: Array<{
      id: number;
      model: string;
      brand: string;
      type: string;
      usage_count: number | string;
      is_active: boolean | number;
    }>;
  }>("/api/catalog.php");
  return data.items.map((item) => ({
    id: Number(item.id),
    deviceType: item.type,
    brand: item.brand,
    model: item.model,
    usageCount: Number(item.usage_count),
    isActive: Boolean(item.is_active),
  }));
};
export const createCatalogItem = (input: {
  type: string;
  brand: string;
  model: string;
}) =>
  request<{ created: boolean }>(
    "/api/catalog.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );
export const updateCatalogItem = (input: {
  id: number;
  active?: boolean;
  delete?: boolean;
}) =>
  request<{ updated: boolean }>(
    "/api/catalog.php",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    true,
  );

export type CustomerPortalPayload = {
  receiptNumber: string;
  customerName: string;
  deviceTitle: string;
  declaredIssue: string;
  status: string;
  workflowCode: string;
  operationReport: string;
  estimate: null | Record<string, unknown>;
  invoice: null | Record<string, unknown>;
  warranties: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  linkExpiresAt: string;
};

export const loadCustomerPortal = (token: string) =>
  request<CustomerPortalPayload>(
    `/api/portal-v2.php?token=${encodeURIComponent(token)}`,
  );

export const requestCustomerPortalOtp = (
  receiptNumber: string,
  mobile: string,
) =>
  request<{ requested: boolean; requestId: string; expiresInSeconds: number }>(
    "/api/portal-v2.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "access_otp_request",
        receiptNumber,
        mobile,
      }),
    },
  );

export const verifyCustomerPortalOtp = (
  receiptNumber: string,
  mobile: string,
  requestId: string,
  otpCode: string,
) =>
  request<{ verified: boolean; token: string; relativeUrl: string }>(
    "/api/portal-v2.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "access_otp_verify",
        receiptNumber,
        mobile,
        requestId,
        otpCode,
      }),
    },
  );
