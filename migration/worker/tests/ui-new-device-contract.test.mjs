import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPreviousDeviceSelection,
  buildReceiptAcceptance,
  parseActiveReceiptTerms,
  receiptTermsKey,
} from "../app/software/reception-ui-contract.ts";
import {
  createReceptionPostHttpHandler,
  createReceptionReadHttpHandler,
} from "../lib/reception-contract-http.ts";
import { importPortalKey } from "../lib/portal-token.ts";
import { withCsrf } from "./fixtures/csrf-http.mjs";
import { LocalD1, n, user } from "./fixtures/reception-harness.mjs";

const origin = "https://test.invalid";
const mutableTables = [
  "repair_customers",
  "repair_customer_devices",
  "repair_cases",
  "repair_receipt_sequences",
  "repair_case_workflows",
  "repair_case_stage_events",
  "repair_case_receipt_terms",
  "repair_portal_tokens",
  "tamiran_audit_log",
];

function snapshot(db) {
  return JSON.stringify(
    mutableTables.map((table) =>
      db.db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(),
    ),
  );
}

function dependencies(db, key, account) {
  return {
    getUser: async () => ({
      ...user,
      userId: `TEST-TAMIRAN-1010A-account${account}`,
    }),
    getDb: async () => db,
    getKey: async () => key,
    now: () => "2026-10-11 06:30:00",
  };
}

async function activeTerms(deps) {
  const read = createReceptionReadHttpHandler(deps);
  const response = await read(
    new Request(`${origin}/api/settings.php?branchId=1`),
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  const terms = parseActiveReceiptTerms(payload.data.activeReceiptTerms);
  assert(terms);
  return terms;
}

function caseBody(account, role, terms) {
  return {
    action: "create_case",
    branchId: 1,
    idempotencyKey: `TEST-TAMIRAN-1011V-A04-${account}`,
    customerName: `آزمایشی — دستگاه جدید ${role}`,
    customerMobile: `09121120${String(account).padStart(3, "0")}`,
    deviceModelId: 1,
    ...buildPreviousDeviceSelection(null),
    identifier: `TEST-UI-A04-${account}`,
    color: "آزمایشی — مشکی",
    declaredIssue: "آزمایشی — بررسی قرارداد دستگاه جدید",
    accessories: ["آزمایشی — کابل"],
    appearanceStates: ["خط‌وخش"],
    customerConsent: {
      dataHandling: "no_erasure",
      acceptanceMethod: "recorded_consent",
    },
    receiptAcceptance: buildReceiptAcceptance(
      terms,
      receiptTermsKey(terms),
    ),
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

test("UI-DEVICE-01 new-device selection omits versioned previous-device fields and rejects invalid IDs", () => {
  const selection = buildPreviousDeviceSelection(null);
  assert.deepEqual(selection, {});
  const serialized = JSON.stringify({ action: "create_case", ...selection });
  assert.equal(serialized.includes("previousDeviceId"), false);
  assert.equal(serialized.includes("expectedDeviceVersion"), false);
  assert.deepEqual(
    buildPreviousDeviceSelection({ id: 7, expectedDeviceVersion: 0 }),
    {
      previousDeviceId: 7,
      expectedDeviceVersion: 0,
    },
  );
  for (const id of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () => buildPreviousDeviceSelection({ id, expectedDeviceVersion: 0 }),
      /معتبر نیست/,
    );
  }
});

test("UI-DEVICE-02 strict handler rejects null without writes, accepts omission, and replays read-only", async () => {
  const db = new LocalD1();
  try {
    const key = await importPortalKey(new Uint8Array(32));
    const deps = dependencies(db, key, 3);
    const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
    const terms = await activeTerms(deps);
    const validBody = caseBody(991, "reception", terms);
    assert.equal("previousDeviceId" in validBody, false);
    const caseCountBefore = n(db, "repair_cases");
    const deviceCountBefore = n(db, "repair_customer_devices");

    const before = snapshot(db);
    const invalidResponse = await post(
      request({ ...validBody, previousDeviceId: null }),
    );
    assert.equal(invalidResponse.status, 400);
    assert.equal(snapshot(db), before);

    const acceptedResponse = await post(request(validBody));
    assert.equal(acceptedResponse.status, 200);
    const acceptedPayload = await acceptedResponse.json();
    assert.equal(acceptedPayload.data.created, true);
    assert.equal(n(db, "repair_cases"), caseCountBefore + 1);
    assert.equal(n(db, "repair_customer_devices"), deviceCountBefore + 1);

    const afterCreate = snapshot(db);
    const replayResponse = await post(request(validBody));
    assert.equal(replayResponse.status, 200);
    const replayPayload = await replayResponse.json();
    assert.equal(replayPayload.data.replayed, true);
    assert.equal(snapshot(db), afterCreate);
  } finally {
    db.close();
  }
});

test("UI-DEVICE-03 all six roles use the omitted-field body; only manager and reception may write", async () => {
  const db = new LocalD1();
  try {
    const key = await importPortalKey(new Uint8Array(32));
    const roles = new Map([
      [2, "repair_manager"],
      [3, "reception"],
      [4, "technician"],
      [5, "quality_control"],
      [6, "warehouse_keeper"],
      [7, "finance_cashier"],
    ]);
    const caseCountBefore = n(db, "repair_cases");
    const deviceCountBefore = n(db, "repair_customer_devices");

    for (const [account, role] of roles) {
      const deps = dependencies(db, key, account);
      const terms = await activeTerms(deps);
      const body = caseBody(account, role, terms);
      assert.equal("previousDeviceId" in body, false, role);
      assert.equal(JSON.stringify(body).includes("previousDeviceId"), false);
      const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
      const beforeRole = snapshot(db);
      const response = await post(request(body));
      const allowed = role === "repair_manager" || role === "reception";
      assert.equal(response.status, allowed ? 200 : 403, role);
      if (allowed) {
        const afterCreate = snapshot(db);
        const replay = await post(request(body));
        assert.equal(replay.status, 200, role);
        assert.equal((await replay.json()).data.replayed, true, role);
        assert.equal(snapshot(db), afterCreate, role);
      } else {
        assert.equal(snapshot(db), beforeRole, role);
      }
    }

    assert.equal(n(db, "repair_cases"), caseCountBefore + 2);
    assert.equal(
      n(db, "repair_customer_devices"),
      deviceCountBefore + 2,
    );
  } finally {
    db.close();
  }
});
