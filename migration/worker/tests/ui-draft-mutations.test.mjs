import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDraftDiscardSelection,
  buildDraftDiscardRequest,
  buildDraftSaveRequest,
  createReceptionDraftMutationQueue,
  isDraftVersionConflict,
} from "../app/software/reception-draft-mutations.ts";
import {
  createReceptionPostHttpHandler,
} from "../lib/reception-contract-http.ts";
import { importPortalKey } from "../lib/portal-token.ts";
import { withCsrf } from "./fixtures/csrf-http.mjs";
import { LocalD1, n, user } from "./fixtures/reception-harness.mjs";

const origin = "https://test.invalid";
const now = "2026-10-11 11:00:00";
const roles = new Map([
  [2, "repair_manager"],
  [3, "reception"],
  [4, "technician"],
  [5, "quality_control"],
  [6, "warehouse_keeper"],
  [7, "finance_cashier"],
]);

function dependencies(db, key, account) {
  return {
    getUser: async () => ({
      ...user,
      userId: `TEST-TAMIRAN-1010A-account${account}`,
    }),
    getDb: async () => db,
    getKey: async () => key,
    now: () => now,
  };
}

function request(body) {
  return new Request(`${origin}/api/operations.php`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function snapshot(db) {
  return JSON.stringify(
    ["repair_reception_drafts", "tamiran_audit_log"].map((table) =>
      db.db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(),
    ),
  );
}

function saveBody(account, role, changes = {}) {
  return {
    action: "save_reception_draft",
    branchId: 1,
    idempotencyKey: `TEST-TAMIRAN-1011X-A06-${account}`,
    payload: {
      step: 1,
      customerName: `آزمایشی — پیش‌نویس ${role}`,
      customerMobile: `09121140${String(account).padStart(3, "0")}`,
    },
    ...changes,
  };
}

test("UI-DRAFT-01 autosave queue retains returned versions and serializes overlapping edits", async () => {
  const queue = createReceptionDraftMutationQueue();
  const expectedVersions = [];
  const created = await queue.enqueueSave(async (expectedVersion) => {
    expectedVersions.push(expectedVersion);
    return { publicId: "TEST-TAMIRAN-A06-DRAFT", version: 0 };
  });
  assert.deepEqual(created, {
    publicId: "TEST-TAMIRAN-A06-DRAFT",
    version: 0,
  });

  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const first = queue.enqueueSave(async (expectedVersion) => {
    expectedVersions.push(expectedVersion);
    await firstGate;
    return { publicId: "TEST-TAMIRAN-A06-DRAFT", version: 1 };
  });
  await new Promise((resolve) => setImmediate(resolve));
  const second = queue.enqueueSave(async (expectedVersion) => {
    expectedVersions.push(expectedVersion);
    return { publicId: "TEST-TAMIRAN-A06-DRAFT", version: 2 };
  });
  releaseFirst();
  assert.equal((await first).version, 1);
  assert.equal((await second).version, 2);
  assert.deepEqual(expectedVersions, [undefined, 0, 1]);
  assert.deepEqual(buildDraftDiscardSelection(queue.current()), {
    publicId: "TEST-TAMIRAN-A06-DRAFT",
    expectedVersion: 2,
  });

  queue.pause();
  let called = false;
  assert.equal(
    await queue.enqueueSave(async () => {
      called = true;
      return { publicId: "TEST-TAMIRAN-A06-DRAFT", version: 3 };
    }),
    null,
  );
  assert.equal(called, false);
  assert.throws(() => buildDraftDiscardSelection(null), /پیدا نشد/);
});

test("UI-DRAFT-02 adapter contract emits current expectedVersion and classifies only HTTP 409", () => {
  const created = buildDraftSaveRequest(
    "TEST-TAMIRAN-1011X-A06-ADAPTER",
    { step: 1 },
  );
  assert.equal(Object.hasOwn(created, "expectedVersion"), false);
  const edited = buildDraftSaveRequest(
    "TEST-TAMIRAN-1011X-A06-ADAPTER",
    { step: 2 },
    0,
  );
  assert.equal(edited.expectedVersion, 0);
  assert.deepEqual(
    buildDraftDiscardRequest({
      publicId: "TEST-TAMIRAN-A06-ADAPTER",
      version: 1,
    }),
    {
      action: "discard_reception_draft",
      publicId: "TEST-TAMIRAN-A06-ADAPTER",
      expectedVersion: 1,
    },
  );
  assert.equal(isDraftVersionConflict({ status: 409 }), true);
  assert.equal(isDraftVersionConflict({ status: 500 }), false);
  assert.equal(isDraftVersionConflict(new Error("409")), false);
  assert.throws(
    () =>
      buildDraftSaveRequest(
        "TEST-TAMIRAN-1011X-A06-ADAPTER",
        { step: 3 },
        -1,
      ),
    /نسخه پیش‌نویس/,
  );
});

test("UI-DRAFT-03 local handler covers create, edit, retry, stale conflict, and discard without hidden writes", async () => {
  const db = new LocalD1();
  try {
    const key = await importPortalKey(new Uint8Array(32));
    const deps = dependencies(db, key, 3);
    const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
    const base = saveBody(301, "reception");

    const createdResponse = await post(request(base));
    assert.equal(createdResponse.status, 200);
    const created = (await createdResponse.json()).data;
    assert.equal(created.version, 0);
    const afterCreate = snapshot(db);

    const retryResponse = await post(
      request({ ...base, expectedVersion: created.version }),
    );
    assert.equal(retryResponse.status, 200);
    assert.equal((await retryResponse.json()).data.replayed, true);
    assert.equal(snapshot(db), afterCreate);

    const editedResponse = await post(
      request({
        ...base,
        expectedVersion: created.version,
        payload: { ...base.payload, step: 2 },
      }),
    );
    assert.equal(editedResponse.status, 200);
    const edited = (await editedResponse.json()).data;
    assert.equal(edited.version, 1);

    const beforeStale = snapshot(db);
    const staleSave = await post(
      request({
        ...base,
        expectedVersion: created.version,
        payload: { ...base.payload, step: 3 },
      }),
    );
    assert.equal(staleSave.status, 409);
    assert.equal(snapshot(db), beforeStale);
    const staleDiscard = await post(
      request({
        action: "discard_reception_draft",
        branchId: 1,
        publicId: edited.publicId,
        expectedVersion: created.version,
      }),
    );
    assert.equal(staleDiscard.status, 409);
    assert.equal(snapshot(db), beforeStale);

    const discardedResponse = await post(
      request({
        action: "discard_reception_draft",
        branchId: 1,
        publicId: edited.publicId,
        expectedVersion: edited.version,
      }),
    );
    assert.equal(discardedResponse.status, 200);
    const afterDiscard = snapshot(db);
    const discardRetry = await post(
      request({
        action: "discard_reception_draft",
        branchId: 1,
        publicId: edited.publicId,
        expectedVersion: edited.version,
      }),
    );
    assert.equal(discardRetry.status, 200);
    assert.equal((await discardRetry.json()).data.replayed, true);
    assert.equal(snapshot(db), afterDiscard);
  } finally {
    db.close();
  }
});

test("UI-DRAFT-04 all six roles enforce versioned save, edit, discard, and denial", async () => {
  const db = new LocalD1();
  try {
    const key = await importPortalKey(new Uint8Array(32));
    const draftsBefore = n(db, "repair_reception_drafts");
    for (const [account, role] of roles) {
      const deps = dependencies(db, key, account);
      const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
      const body = saveBody(account, role);
      const beforeRole = snapshot(db);
      const savedResponse = await post(request(body));
      const allowed = role === "repair_manager" || role === "reception";
      assert.equal(savedResponse.status, allowed ? 200 : 403, role);
      if (!allowed) {
        assert.equal(snapshot(db), beforeRole, role);
        continue;
      }

      const saved = (await savedResponse.json()).data;
      assert.equal(saved.version, 0, role);
      const editedResponse = await post(
        request({
          ...body,
          expectedVersion: saved.version,
          payload: { ...body.payload, step: 2 },
        }),
      );
      assert.equal(editedResponse.status, 200, role);
      const edited = (await editedResponse.json()).data;
      assert.equal(edited.version, 1, role);
      const discardedResponse = await post(
        request({
          action: "discard_reception_draft",
          branchId: 1,
          publicId: edited.publicId,
          expectedVersion: edited.version,
        }),
      );
      assert.equal(discardedResponse.status, 200, role);
      const afterDiscard = snapshot(db);
      const retry = await post(
        request({
          action: "discard_reception_draft",
          branchId: 1,
          publicId: edited.publicId,
          expectedVersion: edited.version,
        }),
      );
      assert.equal(retry.status, 200, role);
      assert.equal((await retry.json()).data.replayed, true, role);
      assert.equal(snapshot(db), afterDiscard, role);
    }

    assert.equal(n(db, "repair_reception_drafts"), draftsBefore + 2);
    assert.equal(
      db.db
        .prepare(
          "SELECT count(*) n FROM repair_reception_drafts WHERE status='discarded'",
        )
        .get().n,
      2,
    );
    assert.equal(
      db.db
        .prepare(
          "SELECT count(*) n FROM tamiran_audit_log WHERE action_code IN ('draft.save','draft.discard')",
        )
        .get().n,
      6,
    );
  } finally {
    db.close();
  }
});
