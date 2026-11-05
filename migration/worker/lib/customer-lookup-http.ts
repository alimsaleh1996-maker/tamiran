import type { ChatGPTUser } from '../app/chatgpt-auth';
import { resolveServerScope, ScopeError, type D1Like } from './server-scope.ts';
import { requireActiveAppSession } from './auth-session.ts';

type Dependencies = { getUser: () => Promise<ChatGPTUser | null>; getDb: () => Promise<D1Like | null>; now: () => string; requireAppSession?: boolean };
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function digits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, ch => String(ch.charCodeAt(0) - (ch >= '۰' ? 1776 : 1632))).trim();
}

// Read-only reception contract. Customer/device history is shop-wide in the frozen API.
// Only explicit fields are returned; token, secret, consent evidence and internal IDs stay private.
export function createCustomerLookupHttpHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      const url = new URL(request.url);
      if (request.method !== 'GET') throw new ScopeError('روش درخواست مجاز نیست.', 405);
      if (url.pathname !== '/api/operations.php') throw new ScopeError('این API هنوز منتقل نشده است.', 503);
      const query = url.searchParams;
      for (const name of query.keys()) {
        if (!['customerMobile', 'branchId'].includes(name) || query.getAll(name).length !== 1) {
          throw new ScopeError('پارامتر درخواست معتبر نیست.', 400);
        }
      }
      if (!query.has('customerMobile')) throw new ScopeError('این عملیات هنوز منتقل نشده است.', 503);
      const mobile = digits(query.get('customerMobile')!);
      if (!/^09\d{9}$/.test(mobile)) throw new ScopeError('شماره موبایل مشتری معتبر نیست.', 400);
      const branch = query.get('branchId');
      if (branch !== null && (!/^[1-9]\d*$/.test(branch) || !Number.isSafeInteger(Number(branch)))) {
        throw new ScopeError('شناسه شعبه معتبر نیست.', 400);
      }
      const user = await deps.getUser();
      if (!user) throw new ScopeError('ورود با حساب ChatGPT الزامی است.', 401);
      const db = await deps.getDb();
      if (!db) throw new ScopeError('پایگاه داده آماده نیست.', 503);
      const scope = await resolveServerScope(db, user, { branchId: branch === null ? null : Number(branch), today: deps.now().slice(0, 10) });
      if (deps.requireAppSession) await requireActiveAppSession(db, user, scope, request);
      if (!['repair_manager', 'reception'].includes(scope.role)) throw new ScopeError('مشاهده سابقه مشتری فقط برای مدیر یا پذیرش مجاز است.', 403);
      const customer = await db.prepare(`SELECT id,full_name AS name,mobile,COALESCE(secondary_mobile,'') AS secondaryMobile,
        COALESCE(national_code,'') AS nationalCode,COALESCE(province,'') AS province,COALESCE(city,'') AS city,
        COALESCE(address,'') AS address,COALESCE(postal_code,'') AS postalCode
        FROM repair_customers WHERE shop_id=? AND mobile=? LIMIT 1`).bind(scope.shopId, mobile).first<{ id: number }>();
      if (!customer) return Response.json({ ok: true, data: { customer: null } }, { headers });
      const devices = (await db.prepare(`SELECT d.id,d.device_model_id AS deviceModelId,d.lock_version AS expectedDeviceVersion,
        d.device_type_title AS deviceType,d.brand_title AS brand,d.model_title AS model,
        COALESCE(d.identifier_value,'') AS identifier,COALESCE(d.color_title,'') AS color,
        COALESCE(latest.receipt_number,'') AS lastReceipt,COALESCE(latest.updated_at,d.last_accepted_at,'') AS lastVisit,
        COALESCE(latest.declared_issue,'') AS lastIssue,latest.status AS lastStatus
        FROM repair_customer_devices d
        LEFT JOIN repair_cases latest ON latest.id=(SELECT c.id FROM repair_cases c
          WHERE c.device_id=d.id AND c.shop_id=d.shop_id ORDER BY c.created_at DESC,c.id DESC LIMIT 1)
        WHERE d.shop_id=? AND d.customer_id=? ORDER BY COALESCE(d.last_accepted_at,d.created_at) DESC,d.id DESC`)
        .bind(scope.shopId, customer.id).all()).results;
      return Response.json({ ok: true, data: { customer: { ...customer, devices } } }, { headers });
    } catch (error) {
      const known = error instanceof ScopeError;
      return Response.json({ ok: false, error: { message: known ? error.message : 'بازیابی سابقه مشتری انجام نشد.', tracking_code: requestId } }, { status: known ? error.status : 500, headers });
    }
  };
}
