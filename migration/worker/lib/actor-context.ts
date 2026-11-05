import type { ChatGPTUser } from "../app/chatgpt-auth.ts";
import { ScopeError, type D1Like } from "./server-scope.ts";

type CentralActorRow = {
  user_id: number;
  display_name: string;
};

type ActorContextRow = {
  user_id: number;
  display_name: string;
  primary_role: string;
  permissions_json: string;
  shop_id: number;
  shop_code: string;
  public_shop_code: string;
  shop_name: string;
  repair_type: string;
  plan_code: string;
  modules_json: string;
  product_profile: "solo" | "pro";
  inventory_mode: "off" | "simple" | "pro";
  qc_mode: "off" | "simple" | "independent";
  feature_flags_json: string;
  lifecycle_status: "active" | "suspended" | "expired" | "read_only";
  license_expires_at: string;
  national_code_required: number;
  branch_id: number;
  branch_code: string;
  branch_name: string;
  is_default: number;
  branch_role: string;
};

export type ActorContextOption = {
  branchId: number;
  branchCode: string;
  branchName: string;
  isDefault: boolean;
  role: string;
  shopName: string;
  publicShopCode: string;
  licenseStatus: string;
};

const CENTRAL_ACTOR_SQL = `
SELECT id AS user_id,display_name
FROM tamiran_users
WHERE account_user_id=? AND shop_id IS NULL AND role_code='central_admin' AND is_active=1
LIMIT 1`;

const ACTOR_CONTEXTS_SQL = `
SELECT u.id AS user_id,u.display_name,u.role_code AS primary_role,
       ub.permissions_json,ub.branch_role_code AS branch_role,
       s.id AS shop_id,s.shop_code,s.public_shop_code,s.name AS shop_name,
       s.repair_type,s.plan_code,s.modules_json,s.product_profile,s.inventory_mode,s.qc_mode,
       s.feature_flags_json,s.lifecycle_status,s.license_expires_at,s.national_code_required,
       b.id AS branch_id,b.branch_code,b.name AS branch_name,b.is_default
FROM tamiran_users u
JOIN repair_shops s ON s.id=u.shop_id
JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id
WHERE u.account_user_id=? AND u.is_active=1 AND ub.is_active=1 AND b.is_active=1
  AND s.lifecycle_status<>'suspended'
ORDER BY s.id,b.is_default DESC,b.id`;

export async function readActorContext(
  db: D1Like,
  user: ChatGPTUser | null,
  branchId: number | null,
  today: string,
) {
  if (!user?.userId) throw new ScopeError("ورود با حساب ChatGPT الزامی است.", 401);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new ScopeError("زمان سرور معتبر نیست.", 503);
  }

  const central = await db
    .prepare(CENTRAL_ACTOR_SQL)
    .bind(user.userId)
    .first<CentralActorRow>();
  if (central) {
    if (branchId !== null) {
      throw new ScopeError("مدیر سامانه به انتخاب شعبه نیاز ندارد.", 400);
    }
    return {
      actor: {
        id: central.user_id,
        displayName: central.display_name,
        role: "central_admin",
        primaryRole: "central_admin",
        permissions: ["*"],
        isCentralAdmin: true,
        branch: null,
        shop: null,
      },
      requiresContext: false,
      contexts: [] as ActorContextOption[],
    };
  }

  const rows = (
    await db
      .prepare(ACTOR_CONTEXTS_SQL)
      .bind(user.userId)
      .all<ActorContextRow>()
  ).results;
  if (rows.length === 0) {
    throw new ScopeError("حساب فعال و مجاز برای تعمیران پیدا نشد.", 403);
  }

  if (branchId === null && rows.length > 1) {
    return {
      actor: null,
      requiresContext: true,
      contexts: rows.map((row) => contextOption(row, today)),
    };
  }

  const selected = branchId === null ? rows[0] : rows.find((row) => row.branch_id === branchId);
  if (!selected) {
    throw new ScopeError("حساب برای شعبه انتخاب‌شده مجاز نیست.", 403);
  }

  return {
    actor: actorFromRow(selected, today),
    requiresContext: false,
    contexts: rows.map((row) => contextOption(row, today)),
  };
}

function actorFromRow(row: ActorContextRow, today: string) {
  return {
    id: row.user_id,
    displayName: row.display_name,
    role: row.branch_role,
    primaryRole: row.primary_role,
    permissions: stringArray(row.permissions_json),
    isCentralAdmin: false,
    mustChangePassword: false,
    branch: {
      id: row.branch_id,
      code: row.branch_code,
      name: row.branch_name,
    },
    shop: {
      id: row.shop_id,
      code: row.shop_code,
      publicCode: row.public_shop_code,
      name: row.shop_name,
      repairType: row.repair_type,
      plan: row.plan_code,
      modules: moduleArray(row.modules_json),
      productProfile: row.product_profile,
      inventoryMode: row.inventory_mode,
      qcMode: row.qc_mode,
      featureFlags: booleanObject(row.feature_flags_json),
      licenseStatus: licenseStatus(row, today),
      expiresAt: row.license_expires_at,
      nationalCodeRequired: row.national_code_required === 1,
    },
  };
}

function contextOption(row: ActorContextRow, today: string): ActorContextOption {
  return {
    branchId: row.branch_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    isDefault: row.is_default === 1,
    role: row.branch_role,
    shopName: row.shop_name,
    publicShopCode: row.public_shop_code,
    licenseStatus: licenseStatus(row, today),
  };
}

function licenseStatus(row: ActorContextRow, today: string): string {
  if (row.license_expires_at.slice(0, 10) < today) return "expired";
  return row.lifecycle_status;
}

function stringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function moduleArray(value: string): string[] {
  const modules = stringArray(value);
  return modules.length > 0 ? modules : ["repair"];
}

function booleanObject(value: string): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}
