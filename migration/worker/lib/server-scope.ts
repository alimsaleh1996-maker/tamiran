import type { ChatGPTUser } from "../app/chatgpt-auth";

export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

export type D1Like = {
  prepare: (sql: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<unknown[]>;
};

export type ServerScope = {
  userId: number;
  accountUserId: string;
  displayName: string;
  shopId: number;
  shopCode: string;
  publicShopCode: string;
  branchId: number;
  branchCode: string;
  role: string;
  permissions: unknown[];
  productProfile: "solo" | "pro";
  inventoryMode: "off" | "simple" | "pro";
  qcMode: "off" | "simple" | "independent";
  featureFlags: Record<string, unknown>;
};

export class ScopeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ScopeError";
    this.status = status;
  }
}

type ScopeRow = {
  user_id: number;
  account_user_id: string;
  display_name: string;
  shop_id: number;
  shop_code: string;
  public_shop_code: string;
  branch_id: number;
  branch_code: string;
  branch_role_code: string;
  permissions_json: string;
  product_profile: ServerScope["productProfile"];
  inventory_mode: ServerScope["inventoryMode"];
  qc_mode: ServerScope["qcMode"];
  feature_flags_json: string;
};

const ACTIVE_SCOPE_SQL = `
SELECT u.id AS user_id,u.account_user_id,u.display_name,u.shop_id,
       s.shop_code,s.public_shop_code,s.product_profile,s.inventory_mode,s.qc_mode,s.feature_flags_json,
       b.id AS branch_id,b.branch_code,ub.branch_role_code,ub.permissions_json
FROM tamiran_users u
JOIN repair_shops s ON s.id=u.shop_id
JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id
WHERE u.account_user_id=? AND u.is_active=1 AND ub.is_active=1 AND b.is_active=1
  AND s.lifecycle_status='active' AND s.license_started_at<=? AND s.license_expires_at>=?
  AND (? IS NULL OR b.id=?)
ORDER BY b.id`;

export async function resolveServerScope(
  db: D1Like,
  user: ChatGPTUser | null,
  options: { branchId?: number | null; today: string },
): Promise<ServerScope> {
  if (!user?.userId) throw new ScopeError("ورود با حساب ChatGPT الزامی است.", 401);
  const branchId = options.branchId ?? null;
  if (branchId !== null && (!Number.isSafeInteger(branchId) || branchId < 1)) {
    throw new ScopeError("شناسه شعبه معتبر نیست.", 400);
  }
  const result = await db
    .prepare(ACTIVE_SCOPE_SQL)
    .bind(user.userId, options.today, options.today, branchId, branchId)
    .all<ScopeRow>();
  if (result.results.length === 0) {
    throw new ScopeError("حساب فعال و مجاز برای این شعبه پیدا نشد.", 403);
  }
  if (result.results.length > 1) {
    throw new ScopeError("انتخاب شعبه برای این حساب الزامی است.", 409);
  }
  const row = result.results[0];
  return {
    userId: row.user_id,
    accountUserId: row.account_user_id,
    displayName: row.display_name,
    shopId: row.shop_id,
    shopCode: row.shop_code,
    publicShopCode: row.public_shop_code,
    branchId: row.branch_id,
    branchCode: row.branch_code,
    role: row.branch_role_code,
    permissions: parseArray(row.permissions_json),
    productProfile: row.product_profile,
    inventoryMode: row.inventory_mode,
    qcMode: row.qc_mode,
    featureFlags: parseObject(row.feature_flags_json),
  };
}

function parseArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
