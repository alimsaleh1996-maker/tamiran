import type { ChatGPTUser } from "../app/chatgpt-auth.ts";
import { ReceptionError } from "./reception-repository.ts";
import { utcDate } from "./reception-terms.ts";
import { ScopeError, type D1Like, type ServerScope } from "./server-scope.ts";

export const APP_SESSION_COOKIE = "__Host-tamiran-app-session";

type SessionCookie = { userId: number; secret: string };
type SessionRow = {
  id: number;
  shop_id: number;
  active_session_hash: string | null;
};

export type SessionEvidence = {
  requestId: string;
  ipAddress: string;
  userAgent: string | null;
  now: string;
  newPublicId: () => string;
  newSecret: () => string;
};

const encoder = new TextEncoder();

function base64Url(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Invalid encoding");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

function authCsrfAad(accountUserId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`tamiran:auth-csrf:v1:${accountUserId}`);
}

export async function issueAuthCsrf(
  key: CryptoKey,
  user: ChatGPTUser,
  now: string,
): Promise<string> {
  const issued = utcDate(now).getTime();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(
    JSON.stringify({ issued, expires: issued + 8 * 3_600_000 }),
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: authCsrfAad(user.userId) },
    key,
    plaintext,
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function verifyAuthCsrf(
  key: CryptoKey,
  user: ChatGPTUser,
  token: string | null,
  now: string,
): Promise<void> {
  try {
    if (!token || token.length > 512) throw new Error("Missing token");
    const [version, nonce, payload, ...extra] = token.split(".");
    const iv = fromBase64Url(nonce);
    if (version !== "v1" || extra.length > 0 || iv.length !== 12)
      throw new Error("Invalid token");
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: authCsrfAad(user.userId) },
      key,
      fromBase64Url(payload),
    );
    const value = JSON.parse(new TextDecoder().decode(plaintext)) as {
      issued?: unknown;
      expires?: unknown;
    };
    const clock = utcDate(now).getTime();
    if (
      !Number.isSafeInteger(value.issued) ||
      !Number.isSafeInteger(value.expires) ||
      (value.issued as number) > clock ||
      (value.expires as number) <= clock ||
      (value.expires as number) - (value.issued as number) !== 8 * 3_600_000
    )
      throw new Error("Expired token");
  } catch {
    throw new ReceptionError(
      "نشست امن ورود منقضی یا نامعتبر است؛ دوباره تلاش کنید.",
      419,
    );
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function randomSessionSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function readAppSessionCookie(request: Request): SessionCookie | null {
  const matches = (request.headers.get("Cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${APP_SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(APP_SESSION_COOKIE.length + 1);
  const match = /^v1\.([1-9]\d*)\.([a-f0-9]{64})$/u.exec(value);
  if (!match) return null;
  const userId = Number(match[1]);
  if (!Number.isSafeInteger(userId)) return null;
  return { userId, secret: match[2] };
}

export function sessionCookie(value: string): string {
  return `${APP_SESSION_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${APP_SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict`;
}

async function matchingSession(
  db: D1Like,
  user: ChatGPTUser,
  userId: number,
  hash: string,
): Promise<SessionRow | null> {
  return db
    .prepare(
      `SELECT id,shop_id,active_session_hash FROM tamiran_users
       WHERE id=? AND account_user_id=? AND shop_id IS NOT NULL AND is_active=1
         AND active_session_hash=? LIMIT 1`,
    )
    .bind(userId, user.userId, hash)
    .first<SessionRow>();
}

export async function requireActiveAppSession(
  db: D1Like,
  user: ChatGPTUser,
  scope: ServerScope,
  request: Request,
): Promise<void> {
  const cookie = readAppSessionCookie(request);
  if (!cookie || cookie.userId !== scope.userId)
    throw new ScopeError("نشست فعال تعمیران پیدا نشد؛ دوباره وارد شوید.", 401);
  const hash = await sha256(cookie.secret);
  const row = await matchingSession(db, user, scope.userId, hash);
  if (!row || row.shop_id !== scope.shopId)
    throw new ScopeError("نشست تعمیران با ورود جاری هم‌خوان نیست.", 401);
}

export async function beginActiveAppSession(
  db: D1Like,
  user: ChatGPTUser,
  scope: ServerScope,
  request: Request,
  evidence: SessionEvidence,
): Promise<{ cookie: string | null; restored: boolean; replaced: boolean }> {
  utcDate(evidence.now);
  const supplied = readAppSessionCookie(request);
  if (supplied?.userId === scope.userId) {
    const suppliedHash = await sha256(supplied.secret);
    const current = await matchingSession(db, user, scope.userId, suppliedHash);
    if (current?.shop_id === scope.shopId)
      return { cookie: null, restored: true, replaced: false };
  }

  const row = await db
    .prepare(
      `SELECT id,shop_id,active_session_hash FROM tamiran_users
       WHERE id=? AND account_user_id=? AND shop_id=? AND is_active=1 LIMIT 1`,
    )
    .bind(scope.userId, user.userId, scope.shopId)
    .first<SessionRow>();
  if (!row) throw new ScopeError("حساب فعال تعمیران پیدا نشد.", 403);
  const previousHash = row.active_session_hash;
  if (previousHash !== null && !/^[a-f0-9]{64}$/u.test(previousHash))
    throw new ScopeError("وضعیت نشست ذخیره‌شده معتبر نیست.", 409);

  const secret = evidence.newSecret();
  if (!/^[a-f0-9]{64}$/u.test(secret))
    throw new Error("SESSION_SECRET_FACTORY_INVALID");
  const nextHash = await sha256(secret);
  const guard = db
    .prepare(
      `SELECT CASE WHEN EXISTS(
         SELECT 1 FROM tamiran_users u
         JOIN repair_shops s ON s.id=u.shop_id
         JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
         JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id
         WHERE u.id=? AND u.account_user_id=? AND u.shop_id=? AND b.id=?
           AND ub.branch_role_code=? AND u.is_active=1 AND ub.is_active=1 AND b.is_active=1
           AND s.lifecycle_status='active' AND s.license_started_at<=? AND s.license_expires_at>=?
           AND u.active_session_hash IS ?
       ) THEN 1 ELSE json_extract('[]','$[') END`,
    )
    .bind(
      scope.userId,
      user.userId,
      scope.shopId,
      scope.branchId,
      scope.role,
      evidence.now.slice(0, 10),
      evidence.now.slice(0, 10),
      previousHash,
    );
  const update = db
    .prepare(
      `UPDATE tamiran_users SET active_session_hash=?,last_login_at=?,updated_at=?
       WHERE id=? AND account_user_id=? AND shop_id=? AND active_session_hash IS ?`,
    )
    .bind(
      nextHash,
      evidence.now,
      evidence.now,
      scope.userId,
      user.userId,
      scope.shopId,
      previousHash,
    );
  const changed = db
    .prepare(
      "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('[]','$[') END",
    )
    .bind();
  const statements = [guard, update, changed];
  if (previousHash !== null) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tamiran_user_session_events
           (public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,user_agent,created_at)
           VALUES(?,?,?,'revoked',?,?,?,?,?)`,
        )
        .bind(
          evidence.newPublicId(),
          scope.shopId,
          scope.userId,
          previousHash,
          evidence.requestId,
          evidence.ipAddress,
          evidence.userAgent,
          evidence.now,
        ),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO tamiran_user_session_events
         (public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,user_agent,created_at)
         VALUES(?,?,?,'login',?,?,?,?,?)`,
      )
      .bind(
        evidence.newPublicId(),
        scope.shopId,
        scope.userId,
        nextHash,
        evidence.requestId,
        evidence.ipAddress,
        evidence.userAgent,
        evidence.now,
      ),
  );
  try {
    await db.batch(statements);
  } catch {
    throw new ReceptionError(
      "نشست هم‌زمان تغییر کرد؛ ورود را دوباره انجام دهید.",
      409,
    );
  }
  return {
    cookie: `v1.${scope.userId}.${secret}`,
    restored: false,
    replaced: previousHash !== null,
  };
}

export async function releaseActiveAppSession(
  db: D1Like,
  user: ChatGPTUser,
  request: Request,
  evidence: Omit<SessionEvidence, "newSecret">,
): Promise<{ replayed: boolean }> {
  utcDate(evidence.now);
  const cookie = readAppSessionCookie(request);
  if (!cookie) return { replayed: true };
  const hash = await sha256(cookie.secret);
  const row = await matchingSession(db, user, cookie.userId, hash);
  if (!row) return { replayed: true };
  const guard = db
    .prepare(
      `SELECT CASE WHEN EXISTS(
         SELECT 1 FROM tamiran_users WHERE id=? AND account_user_id=? AND shop_id=?
           AND is_active=1 AND active_session_hash=?
       ) THEN 1 ELSE json_extract('[]','$[') END`,
    )
    .bind(row.id, user.userId, row.shop_id, hash);
  const event = db
    .prepare(
      `INSERT INTO tamiran_user_session_events
       (public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,user_agent,created_at)
       VALUES(?,?,?,'logout',?,?,?,?,?)`,
    )
    .bind(
      evidence.newPublicId(),
      row.shop_id,
      row.id,
      hash,
      evidence.requestId,
      evidence.ipAddress,
      evidence.userAgent,
      evidence.now,
    );
  const clear = db
    .prepare(
      `UPDATE tamiran_users SET active_session_hash=NULL,updated_at=?
       WHERE id=? AND account_user_id=? AND shop_id=? AND active_session_hash=?`,
    )
    .bind(evidence.now, row.id, user.userId, row.shop_id, hash);
  const changed = db
    .prepare(
      "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('[]','$[') END",
    )
    .bind();
  try {
    await db.batch([guard, event, clear, changed]);
  } catch {
    const stillCurrent = await matchingSession(db, user, row.id, hash);
    if (!stillCurrent) return { replayed: true };
    throw new ReceptionError(
      "خروج امن ثبت نشد؛ دوباره تلاش کنید.",
      409,
    );
  }
  return { replayed: false };
}
