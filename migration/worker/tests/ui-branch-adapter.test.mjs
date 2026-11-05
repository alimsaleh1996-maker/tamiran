import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adaptBranchRequest,
  branchSelectionUrl,
  positiveBranchId,
  readBranchSelection,
} from "../app/software/branch-request-adapter.ts";
import { createReceptionReadHttpHandler, createReceptionPostHttpHandler } from "../lib/reception-contract-http.ts";
import { importPortalKey } from "../lib/portal-token.ts";
import { LocalD1, user } from "./fixtures/reception-harness.mjs";

const origin = "https://test.invalid";

test("UI-BRANCH-01 reads only one positive URL or stored branch selection", () => {
  assert.deepEqual(readBranchSelection(`${origin}/software?view=reception&branchId=3`, "1"), {
    branchId: 3,
    source: "url",
  });
  assert.deepEqual(readBranchSelection(`${origin}/software?view=reception`, "2"), {
    branchId: 2,
    source: "storage",
  });
  assert.deepEqual(readBranchSelection(`${origin}/software`, null), {
    branchId: null,
    source: "none",
  });
  for (const value of ["0", "-1", "1.5", "9007199254740992", "abc"])
    assert.throws(() => positiveBranchId(value));
  assert.throws(() => readBranchSelection(`${origin}/software?branchId=1&branchId=1`, null));
});

test("UI-BRANCH-02 selection URL preserves the requested page and replaces branch once", () => {
  const url = new URL(branchSelectionUrl(`${origin}/software?view=reception&branchId=1`, 3));
  assert.equal(url.searchParams.get("view"), "reception");
  assert.deepEqual(url.searchParams.getAll("branchId"), ["3"]);
});

test("UI-BRANCH-03 GET routes carry the authoritative branch without losing query", async () => {
  const adapted = await adaptBranchRequest(
    "/api/operations.php?customerMobile=09120000000",
    { headers: { Accept: "application/json" }, credentials: "same-origin" },
    3,
    origin,
  );
  assert.equal(adapted.adapted, true);
  const request = adapted.input;
  assert(request instanceof Request);
  const url = new URL(request.url);
  assert.equal(url.searchParams.get("customerMobile"), "09120000000");
  assert.deepEqual(url.searchParams.getAll("branchId"), ["3"]);
  assert.equal(request.credentials, "same-origin");
});

test("UI-BRANCH-04 JSON writes carry branch in the body and never in the URL", async () => {
  const adapted = await adaptBranchRequest(
    "/api/operations.php?branchId=3",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ action: "save_reception_draft", idempotencyKey: "TEST-TAMIRAN-1010S-DRAFT" }),
    },
    3,
    origin,
  );
  const request = adapted.input;
  assert(request instanceof Request);
  assert.equal(new URL(request.url).search, "");
  assert.deepEqual(await request.json(), {
    action: "save_reception_draft",
    idempotencyKey: "TEST-TAMIRAN-1010S-DRAFT",
    branchId: 3,
  });
});

test("UI-BRANCH-05 conflicting or ambiguous request scopes fail before fetch", async () => {
  await assert.rejects(adaptBranchRequest("/api/settings.php?branchId=2", undefined, 3, origin));
  await assert.rejects(
    adaptBranchRequest(
      "/api/operations.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_case", branchId: 2 }),
      },
      3,
      origin,
    ),
  );
  await assert.rejects(adaptBranchRequest("/api/csrf.php?branchId=3&branchId=3", undefined, 3, origin));
});

test("UI-BRANCH-06 CSRF is branch-scoped while external and non-API fetches are untouched", async () => {
  const csrf = await adaptBranchRequest("/api/csrf.php", undefined, 6, origin);
  assert(csrf.input instanceof Request);
  assert.equal(new URL(csrf.input.url).searchParams.get("branchId"), "6");
  const external = await adaptBranchRequest("https://example.com/api/csrf.php", undefined, 6, origin);
  assert.equal(external.adapted, false);
  const asset = await adaptBranchRequest("/assets/app.css", undefined, 6, origin);
  assert.equal(asset.adapted, false);
});

test("UI-BRANCH-07 all operational role contexts use the same server-validated adapter", async () => {
  const roles = ["repair_manager", "reception", "technician", "quality_control", "warehouse_keeper", "finance_cashier"];
  for (const [index, role] of roles.entries()) {
    const branchId = index + 1;
    const adapted = await adaptBranchRequest(
      "/api/auth.php",
      { headers: { "X-Test-Role-Label": role } },
      branchId,
      origin,
    );
    const request = adapted.input;
    assert(request instanceof Request);
    assert.equal(new URL(request.url).searchParams.get("branchId"), String(branchId), role);
    assert.equal(request.headers.get("X-Test-Role-Label"), role);
  }
});

test("UI-BRANCH-08 adapter, local D1 scope, and CSRF token stay on the selected branch", async () => {
  const db = new LocalD1();
  try {
    db.db.exec(
      "INSERT INTO tamiran_user_branches(shop_id,user_id,branch_id,branch_role_code,permissions_json) VALUES(1,3,3,'reception','[]')",
    );
    const key = await importPortalKey(new Uint8Array(32));
    const deps = {
      getUser: async () => user,
      getDb: async () => db,
      getKey: async () => key,
      now: () => "2026-10-10 12:00:00",
    };
    const read = createReceptionReadHttpHandler(deps);
    const post = createReceptionPostHttpHandler(deps);

    const get = async (path, branchId) => {
      const adapted = await adaptBranchRequest(path, undefined, branchId, origin);
      assert(adapted.input instanceof Request);
      return read(adapted.input);
    };
    const token = async (branchId) => {
      const response = await get("/api/csrf.php", branchId);
      assert.equal(response.status, 200);
      return (await response.json()).data.csrf_token;
    };
    const save = async (branchId, csrfToken, suffix) => {
      const adapted = await adaptBranchRequest(
        "/api/operations.php",
        {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            action: "save_reception_draft",
            idempotencyKey: `TEST-TAMIRAN-1010S-${suffix}`,
            payload: { name: `آزمایشی — شعبه ${branchId}` },
          }),
        },
        branchId,
        origin,
      );
      assert(adapted.input instanceof Request);
      return post(adapted.input);
    };

    const auth = await get("/api/auth.php", 3);
    assert.equal(auth.status, 200);
    assert.equal((await auth.json()).data.actor.branch.id, 3);

    const branchOneToken = await token(1);
    assert.equal((await save(1, branchOneToken, "BRANCH-1")).status, 200);
    assert.equal((await save(3, branchOneToken, "WRONG-TOKEN")).status, 419);

    const branchThreeToken = await token(3);
    assert.notEqual(branchThreeToken, branchOneToken);
    assert.equal((await save(3, branchThreeToken, "BRANCH-3")).status, 200);

    const rows = db.db
      .prepare("SELECT branch_id, count(*) AS n FROM repair_reception_drafts GROUP BY branch_id ORDER BY branch_id")
      .all()
      .map(({ branch_id, n }) => ({ branch_id, n }));
    assert.deepEqual(rows, [
      { branch_id: 1, n: 1 },
      { branch_id: 3, n: 1 },
    ]);
  } finally {
    db.close();
  }
});
