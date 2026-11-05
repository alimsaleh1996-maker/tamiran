import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthSessionHttpHandler } from "../lib/auth-session-http.ts";
import {
  APP_SESSION_COOKIE,
  issueAuthCsrf,
} from "../lib/auth-session.ts";
import { createReceptionReadHttpHandler } from "../lib/reception-contract-http.ts";
import { importPortalKey } from "../lib/portal-token.ts";
import { LocalD1, user as receptionUser } from "./fixtures/reception-harness.mjs";

const origin = "https://test.invalid";
const now = "2026-10-11 17:30:00";
const key = await importPortalKey(new Uint8Array(32));
const actor = (id) => ({
  ...receptionUser,
  userId: `TEST-TAMIRAN-1010A-account${id}`,
  displayName: "آزمایشی — ورودی غیرقابل اعتماد",
});

function factories(secrets = []) {
  let publicCounter = 0;
  let secretCounter = 0;
  return {
    newPublicId: () =>
      `TEST-TAMIRAN-1011Z-A09-${String(++publicCounter).padStart(2, "0")}`,
    newRequestId: () =>
      `TEST-TAMIRAN-1011Z-A09-REQUEST-${String(publicCounter + 1).padStart(2, "0")}`,
    newSessionSecret: () =>
      secrets[secretCounter++] ??
      (secretCounter.toString(16).padStart(2, "0").repeat(32)),
  };
}

function dependencies(db, id, generated = factories(), changes = {}) {
  return {
    getUser: async () => (id === null ? null : actor(id)),
    getDb: async () => db,
    getKey: async () => key,
    now: () => now,
    requireAppSession: true,
    ...generated,
    ...changes,
  };
}

function cookiePair(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
}

async function authToken(id) {
  return issueAuthCsrf(key, actor(id), now);
}

async function begin(deps, id, branchId = 1, cookie = "", bodyChanges = {}) {
  const token = await authToken(id);
  const request = new Request(`${origin}/api/auth.php`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-CSRF-Token": token,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      action: "begin_site_session",
      ...(branchId === null ? {} : { branchId }),
      ...bodyChanges,
    }),
  });
  return createAuthSessionHttpHandler(deps)(request);
}

function settings(deps, cookie, branchId = 1) {
  return createReceptionReadHttpHandler(deps)(
    new Request(`${origin}/api/settings.php?branchId=${branchId}`, {
      headers: { Cookie: cookie },
    }),
  );
}

async function logout(deps, id, cookie, branchId = 1) {
  return createAuthSessionHttpHandler(deps)(
    new Request(`${origin}/api/auth.php${branchId === null ? "" : `?branchId=${branchId}`}`, {
      method: "DELETE",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "X-CSRF-Token": await authToken(id),
      },
    }),
  );
}

async function check(fn, failPattern = null) {
  const db = new LocalD1(failPattern);
  try {
    await fn(db);
  } finally {
    db.close();
  }
}

test("AUTH-SESSION-01 frozen session-event columns and tenant constraints are present", () =>
  check(async (db) => {
    assert.deepEqual(
      db.db.prepare("PRAGMA table_info(tamiran_user_session_events)").all().map((row) => row.name),
      [
        "id",
        "public_id",
        "shop_id",
        "user_id",
        "event_type",
        "session_hash",
        "request_id",
        "ip_address",
        "user_agent",
        "created_at",
      ],
    );
    assert.throws(() =>
      db.db.exec(
        "INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address) VALUES('TEST-TAMIRAN-1011Z-A09-X',1,8,'login','bad','TEST-A09','')",
      ),
    );
    assert.equal(db.db.prepare("PRAGMA foreign_key_check").all().length, 0);
  }));

test("AUTH-SESSION-02 all six operational roles start a scoped session; central stays exempt", () =>
  check(async (db) => {
    const roles = new Map([
      [2, "repair_manager"],
      [3, "reception"],
      [4, "technician"],
      [5, "quality_control"],
      [6, "warehouse_keeper"],
      [7, "finance_cashier"],
    ]);
    const generated = factories(
      [...roles.keys()].map((id) => id.toString(16).padStart(2, "0").repeat(32)),
    );
    for (const [id, role] of roles) {
      const secret = id.toString(16).padStart(2, "0").repeat(32);
      const deps = dependencies(db, id, generated);
      const response = await begin(deps, id);
      assert.equal(response.status, 200, role);
      const json = await response.json();
      assert.equal(json.data.actor.role, role);
      assert.equal(json.data.session.singleActive, true);
      assert(!JSON.stringify(json).includes(secret));
      const cookie = cookiePair(response);
      assert.match(cookie, new RegExp(`^${APP_SESSION_COOKIE}=v1\\.${id}\\.[a-f0-9]{64}$`));
      const setCookie = response.headers.get("set-cookie");
      assert.match(setCookie, /Secure/u);
      assert.match(setCookie, /HttpOnly/u);
      assert.match(setCookie, /SameSite=Strict/u);
      assert.equal((await settings(deps, cookie)).status, 200, role);
      const signedOut = await logout(deps, id, cookie);
      assert.equal(signedOut.status, 200, role);
      assert.equal((await signedOut.json()).data.replayed, false, role);
      assert.equal((await settings(deps, cookie)).status, 401, role);
    }
    assert.equal(
      db.db.prepare("SELECT count(*) AS n FROM tamiran_user_session_events WHERE event_type='login'").get().n,
      6,
    );
    assert.equal(
      db.db.prepare("SELECT count(*) AS n FROM tamiran_user_session_events WHERE event_type='logout'").get().n,
      6,
    );
    const centralDeps = dependencies(db, 1);
    const central = await begin(centralDeps, 1, null);
    assert.equal(central.status, 200);
    const centralJson = await central.json();
    assert.equal(centralJson.data.actor.role, "central_admin");
    assert.equal(centralJson.data.session.singleActive, false);
    assert.match(central.headers.get("set-cookie"), /Max-Age=0/u);
    const centralLogout = await logout(centralDeps, 1, "", null);
    assert.equal(centralLogout.status, 200);
    assert.equal((await centralLogout.json()).data.replayed, true);
  }));

test("AUTH-SESSION-03 restore with the current cookie is read-only", () =>
  check(async (db) => {
    const deps = dependencies(db, 3, factories(["31".repeat(32), "32".repeat(32)]));
    const first = await begin(deps, 3);
    const cookie = cookiePair(first);
    const hash = db.db.prepare("SELECT active_session_hash AS hash FROM tamiran_users WHERE id=3").get().hash;
    const events = db.db.prepare("SELECT count(*) AS n FROM tamiran_user_session_events").get().n;
    const restored = await begin(deps, 3, 1, cookie);
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).data.session.restored, true);
    assert.equal(restored.headers.get("set-cookie"), null);
    assert.equal(db.db.prepare("SELECT active_session_hash AS hash FROM tamiran_users WHERE id=3").get().hash, hash);
    assert.equal(db.db.prepare("SELECT count(*) AS n FROM tamiran_user_session_events").get().n, events);
  }));

test("AUTH-SESSION-04 a new login revokes the old cookie and protects real reads", () =>
  check(async (db) => {
    const deps = dependencies(db, 3, factories(["41".repeat(32), "42".repeat(32)]));
    const firstCookie = cookiePair(await begin(deps, 3));
    const secondResponse = await begin(deps, 3);
    const secondCookie = cookiePair(secondResponse);
    assert.notEqual(firstCookie, secondCookie);
    assert.equal((await secondResponse.json()).data.session.replaced, true);
    assert.equal((await settings(deps, firstCookie)).status, 401);
    assert.equal((await settings(deps, secondCookie)).status, 200);
    assert.deepEqual(
      db.db.prepare("SELECT event_type FROM tamiran_user_session_events ORDER BY id").all().map((row) => row.event_type),
      ["login", "revoked", "login"],
    );
  }));

test("AUTH-SESSION-05 logout is conditional, idempotent and invalidates the active cookie", () =>
  check(async (db) => {
    const deps = dependencies(db, 2, factories(["51".repeat(32)]));
    const cookie = cookiePair(await begin(deps, 2));
    const first = await logout(deps, 2, cookie);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).data.replayed, false);
    assert.match(first.headers.get("set-cookie"), /Max-Age=0/u);
    assert.equal(db.db.prepare("SELECT active_session_hash AS hash FROM tamiran_users WHERE id=2").get().hash, null);
    assert.equal((await settings(deps, cookie)).status, 401);
    const second = await logout(deps, 2, cookie);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).data.replayed, true);
    assert.equal(
      db.db.prepare("SELECT count(*) AS n FROM tamiran_user_session_events WHERE event_type='logout'").get().n,
      1,
    );
  }));

test("AUTH-SESSION-06 spoofed account, branch, cookie, body, origin and CSRF fail closed", () =>
  check(async (db) => {
    const deps3 = dependencies(db, 3, factories(["61".repeat(32)]));
    const cookie = cookiePair(await begin(deps3, 3));
    assert.equal((await settings(dependencies(db, 4), cookie)).status, 401);
    assert.equal((await settings(deps3, cookie, 2)).status, 403);
    assert.equal((await settings(deps3, `${cookie}; ${cookie}`)).status, 401);
    assert.equal(
      (await settings(deps3, `${cookie.slice(0, -1)}${cookie.endsWith("f") ? "e" : "f"}`)).status,
      401,
    );
    assert.equal((await begin(deps3, 3, 1, "", { role: "repair_manager" })).status, 400);
    const badOrigin = await createAuthSessionHttpHandler(deps3)(
      new Request(`${origin}/api/auth.php`, {
        method: "POST",
        headers: {
          Origin: "https://other.invalid",
          "Content-Type": "application/json",
          "X-CSRF-Token": await authToken(3),
        },
        body: JSON.stringify({ action: "begin_site_session", branchId: 1 }),
      }),
    );
    assert.equal(badOrigin.status, 403);
    const foreignToken = await createAuthSessionHttpHandler(dependencies(db, 4))(
      new Request(`${origin}/api/auth.php`, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "X-CSRF-Token": await authToken(3),
        },
        body: JSON.stringify({ action: "begin_site_session", branchId: 1 }),
      }),
    );
    assert.equal(foreignToken.status, 419);
  }));

test("AUTH-SESSION-07 membership revocation blocks data but still permits safe logout", () =>
  check(async (db) => {
    const deps = dependencies(db, 3, factories(["71".repeat(32)]));
    const cookie = cookiePair(await begin(deps, 3));
    db.db.exec("UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=3");
    assert.equal((await settings(deps, cookie)).status, 403);
    const response = await logout(deps, 3, cookie);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.replayed, false);
    assert.equal(db.db.prepare("SELECT active_session_hash AS hash FROM tamiran_users WHERE id=3").get().hash, null);
  }));

test("AUTH-SESSION-08 concurrent rotation and event failure cannot leave partial evidence", async () => {
  await check(async (db) => {
    const deps = dependencies(db, 3, factories(["81".repeat(32)]));
    const originalBatch = db.batch.bind(db);
    let raced = false;
    db.batch = async (statements) => {
      if (!raced) {
        raced = true;
        db.db.exec(`UPDATE tamiran_users SET active_session_hash='${"a".repeat(64)}' WHERE id=3`);
      }
      return originalBatch(statements);
    };
    const response = await begin(deps, 3);
    assert.equal(response.status, 409);
    assert.equal(
      db.db.prepare("SELECT active_session_hash AS hash FROM tamiran_users WHERE id=3").get().hash,
      "a".repeat(64),
    );
    assert.equal(db.db.prepare("SELECT count(*) AS n FROM tamiran_user_session_events").get().n, 0);
  });
  await check(async (db) => {
    const deps = dependencies(db, 3, factories(["82".repeat(32)]));
    const response = await begin(deps, 3);
    assert.equal(response.status, 409);
    assert.equal(db.db.prepare("SELECT active_session_hash AS hash FROM tamiran_users WHERE id=3").get().hash, null);
    assert.equal(db.db.prepare("SELECT count(*) AS n FROM tamiran_user_session_events").get().n, 0);
  }, /INSERT INTO tamiran_user_session_events/u);
});

test("AUTH-SESSION-09 GET auth issues an identity-bound token without exposing session secrets", () =>
  check(async (db) => {
    const deps = dependencies(db, 3);
    const response = await createReceptionReadHttpHandler(deps)(
      new Request(`${origin}/api/auth.php?branchId=1`),
    );
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.data.actor.role, "reception");
    assert.match(json.data.authCsrfToken, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
    assert(!JSON.stringify(json).includes("active_session_hash"));
    assert(!JSON.stringify(json).includes(APP_SESSION_COOKIE));
  }));
