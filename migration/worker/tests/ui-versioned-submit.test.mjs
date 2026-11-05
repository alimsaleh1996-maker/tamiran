import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDraftSubmissionSelection,
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
const now = "2026-10-11 09:00:00";
const roles = new Map([
  [2, "repair_manager"],
  [3, "reception"],
  [4, "technician"],
  [5, "quality_control"],
  [6, "warehouse_keeper"],
  [7, "finance_cashier"],
]);
const mutableTables = [
  "repair_customers",
  "repair_customer_devices",
  "repair_cases",
  "repair_receipt_sequences",
  "repair_case_workflows",
  "repair_case_stage_events",
  "repair_case_events",
  "repair_case_receipt_terms",
  "repair_portal_tokens",
  "repair_reception_drafts",
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

async function termsFor(deps) {
  const response = await createReceptionReadHttpHandler(deps)(
    new Request(`${origin}/api/settings.php?branchId=1`),
  );
  assert.equal(response.status, 200);
  const terms = parseActiveReceiptTerms(
    (await response.json()).data.activeReceiptTerms,
  );
  assert(terms);
  return terms;
}

function caseBody(account, role, terms, changes = {}) {
  return {
    action: "create_case",
    branchId: 1,
    idempotencyKey: `TEST-TAMIRAN-1011W-A05-${account}`,
    customerName: `آزمایشی — نسخه‌دار ${role}`,
    customerMobile: `09121130${String(account).padStart(3, "0")}`,
    deviceModelId: 1,
    identifier: `TEST-UI-A05-${account}`,
    color: "آزمایشی — مشکی",
    declaredIssue: "آزمایشی — قرارداد نسخه‌دار پذیرش",
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
    ...changes,
  };
}

test("UI-VERSION-01 submission helpers emit complete ID/version pairs or fail closed", () => {
  assert.deepEqual(buildPreviousDeviceSelection(null), {});
  assert.deepEqual(
    buildPreviousDeviceSelection({ id: 7, expectedDeviceVersion: 3 }),
    { previousDeviceId: 7, expectedDeviceVersion: 3 },
  );
  for (const expectedDeviceVersion of [undefined, -1, 1.5, Number.NaN]) {
    assert.throws(
      () => buildPreviousDeviceSelection({ id: 7, expectedDeviceVersion }),
      /نسخه دستگاه/,
    );
  }

  assert.deepEqual(buildDraftSubmissionSelection(null), {});
  assert.deepEqual(
    buildDraftSubmissionSelection({
      publicId: "TEST-TAMIRAN-A05-DRAFT",
      version: 0,
    }),
    {
      draftPublicId: "TEST-TAMIRAN-A05-DRAFT",
      draftExpectedVersion: 0,
    },
  );
  for (const draft of [
    { publicId: "", version: 0 },
    { publicId: "x".repeat(27), version: 0 },
    { publicId: "TEST-TAMIRAN-A05-DRAFT", version: undefined },
    { publicId: "TEST-TAMIRAN-A05-DRAFT", version: -1 },
    { publicId: "TEST-TAMIRAN-A05-DRAFT", version: 0.5 },
  ]) {
    assert.throws(() => buildDraftSubmissionSelection(draft), /معتبر نیست/);
  }
});

test("UI-VERSION-02 authoritative existing-device versions cover all six roles, stale denial, and read-only retry", async () => {
  const db = new LocalD1();
  try {
    db.db.exec(
      "UPDATE repair_customers SET mobile='09120000002' WHERE id=1",
    );
    const key = await importPortalKey(new Uint8Array(32));
    const casesBefore = n(db, "repair_cases");
    const devicesBefore = n(db, "repair_customer_devices");

    for (const [account, role] of roles) {
      const deps = dependencies(db, key, account);
      const read = createReceptionReadHttpHandler(deps);
      const lookup = await read(
        new Request(
          `${origin}/api/operations.php?customerMobile=09120000002&branchId=1`,
        ),
      );
      const allowed = role === "repair_manager" || role === "reception";
      assert.equal(lookup.status, allowed ? 200 : 403, role);
      const terms = await termsFor(deps);
      const source = allowed
        ? (await lookup.json()).data.customer.devices[0]
        : {
            id: 1,
            expectedDeviceVersion: db.db
              .prepare("SELECT lock_version FROM repair_customer_devices WHERE id=1")
              .get().lock_version,
          };
      if (allowed) assert(Number.isSafeInteger(source.expectedDeviceVersion));
      const versionedDevice = buildPreviousDeviceSelection(source);
      const body = caseBody(account, role, terms, {
        ...versionedDevice,
        customerName: "آزمایشی — مشتری الف",
        customerMobile: "09120000002",
        identifier: "TEST-IMEI-A",
      });
      assert.equal(body.previousDeviceId, 1, role);
      assert(Number.isSafeInteger(body.expectedDeviceVersion), role);

      const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
      const beforeRole = snapshot(db);
      const response = await post(request(body));
      assert.equal(response.status, allowed ? 200 : 403, role);
      if (allowed) {
        assert.equal((await response.json()).data.repairCase.deviceId, 1, role);
        const afterCreate = snapshot(db);
        const retry = await post(request(body));
        assert.equal(retry.status, 200, role);
        assert.equal((await retry.json()).data.replayed, true, role);
        assert.equal(snapshot(db), afterCreate, role);
      } else {
        assert.equal(snapshot(db), beforeRole, role);
      }
    }

    assert.equal(n(db, "repair_cases"), casesBefore + 2);
    assert.equal(n(db, "repair_customer_devices"), devicesBefore);

    const deps = dependencies(db, key, 3);
    const read = createReceptionReadHttpHandler(deps);
    const lookup = await read(
      new Request(
        `${origin}/api/operations.php?customerMobile=09120000002&branchId=1`,
      ),
    );
    const staleDevice = (await lookup.json()).data.customer.devices[0];
    const terms = await termsFor(deps);
    const incompleteBase = caseBody(398, "reception-incomplete", terms, {
      customerName: "آزمایشی — مشتری الف",
      customerMobile: "09120000002",
      identifier: "TEST-IMEI-A",
    });
    const beforeIncomplete = snapshot(db);
    for (const incomplete of [
      { previousDeviceId: staleDevice.id },
      { expectedDeviceVersion: staleDevice.expectedDeviceVersion },
    ]) {
      const denied = await withCsrf(
        createReceptionPostHttpHandler(deps),
        deps,
      )(request({ ...incompleteBase, ...incomplete }));
      assert.equal(denied.status, 400);
      assert.equal(snapshot(db), beforeIncomplete);
    }
    db.db.exec(
      "UPDATE repair_customer_devices SET lock_version=lock_version+1 WHERE id=1",
    );
    const beforeStale = snapshot(db);
    const stale = caseBody(399, "reception-stale", terms, {
      ...buildPreviousDeviceSelection(staleDevice),
      customerName: "آزمایشی — مشتری الف",
      customerMobile: "09120000002",
      identifier: "TEST-IMEI-A",
    });
    const response = await withCsrf(
      createReceptionPostHttpHandler(deps),
      deps,
    )(request(stale));
    assert.equal(response.status, 409);
    assert.equal(snapshot(db), beforeStale);
  } finally {
    db.close();
  }
});

test("UI-VERSION-03 authoritative draft-list versions cover all six roles and exact retries", async () => {
  const db = new LocalD1();
  try {
    const key = await importPortalKey(new Uint8Array(32));
    const casesBefore = n(db, "repair_cases");
    const devicesBefore = n(db, "repair_customer_devices");

    for (const [account, role] of roles) {
      const deps = dependencies(db, key, account);
      const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
      const idempotencyKey = `TEST-TAMIRAN-1011W-A05-DRAFT-${account}`;
      const beforeSave = snapshot(db);
      const savedResponse = await post(
        request({
          action: "save_reception_draft",
          branchId: 1,
          idempotencyKey,
          payload: {
            customerName: `آزمایشی — پیش‌نویس ${role}`,
            customerMobile: `09121131${String(account).padStart(3, "0")}`,
          },
        }),
      );
      const allowed = role === "repair_manager" || role === "reception";
      assert.equal(savedResponse.status, allowed ? 200 : 403, role);
      const terms = await termsFor(deps);

      if (!allowed) {
        assert.equal(snapshot(db), beforeSave, role);
        const body = caseBody(account + 100, role, terms, {
          idempotencyKey,
          ...buildDraftSubmissionSelection({
            publicId: `TEST-A05-DRAFT-${account}`,
            version: 0,
          }),
        });
        const beforeCreate = snapshot(db);
        assert.equal((await post(request(body))).status, 403, role);
        assert.equal(snapshot(db), beforeCreate, role);
        continue;
      }

      const saved = (await savedResponse.json()).data;
      assert.equal(saved.version, 0, role);
      const listedResponse = await createReceptionReadHttpHandler(deps)(
        new Request(`${origin}/api/operations.php?branchId=1`),
      );
      assert.equal(listedResponse.status, 200, role);
      const listed = (await listedResponse.json()).data.receptionDrafts.find(
        (draft) => draft.publicId === saved.publicId,
      );
      assert(listed, role);
      assert.equal(listed.version, saved.version, role);

      const body = caseBody(account + 100, role, terms, {
        idempotencyKey,
        ...buildDraftSubmissionSelection(listed),
      });
      const response = await post(request(body));
      assert.equal(response.status, 200, role);
      const afterCreate = snapshot(db);
      const retry = await post(request(body));
      assert.equal(retry.status, 200, role);
      assert.equal((await retry.json()).data.replayed, true, role);
      assert.equal(snapshot(db), afterCreate, role);
    }

    assert.equal(n(db, "repair_cases"), casesBefore + 2);
    assert.equal(n(db, "repair_customer_devices"), devicesBefore + 2);
    assert.equal(
      db.db
        .prepare(
          "SELECT count(*) AS n FROM repair_reception_drafts WHERE status='submitted' AND lock_version=1",
        )
        .get().n,
      2,
    );
  } finally {
    db.close();
  }
});

test("UI-VERSION-04 stale or incomplete draft versions are read-only; current version submits once", async () => {
  const db = new LocalD1();
  try {
    const key = await importPortalKey(new Uint8Array(32));
    const deps = dependencies(db, key, 3);
    const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
    const terms = await termsFor(deps);
    const idempotencyKey = "TEST-TAMIRAN-1011W-A05-DRAFT-STALE";
    const firstResponse = await post(
      request({
        action: "save_reception_draft",
        branchId: 1,
        idempotencyKey,
        payload: { step: 1, customerName: "آزمایشی — نسخه صفر" },
      }),
    );
    const first = (await firstResponse.json()).data;
    const secondResponse = await post(
      request({
        action: "save_reception_draft",
        branchId: 1,
        idempotencyKey,
        expectedVersion: first.version,
        payload: { step: 2, customerName: "آزمایشی — نسخه یک" },
      }),
    );
    assert.equal(secondResponse.status, 200);
    const second = (await secondResponse.json()).data;
    assert.equal(second.version, 1);

    const base = caseBody(390, "reception-draft-stale", terms, {
      idempotencyKey,
    });
    const beforeDenied = snapshot(db);
    assert.equal(
      (
        await post(
          request({
            ...base,
            draftPublicId: first.publicId,
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          request({
            ...base,
            ...buildDraftSubmissionSelection(first),
          }),
        )
      ).status,
      409,
    );
    assert.equal(snapshot(db), beforeDenied);

    const current = {
      ...base,
      ...buildDraftSubmissionSelection(second),
    };
    const accepted = await post(request(current));
    assert.equal(accepted.status, 200);
    const afterCreate = snapshot(db);
    const retry = await post(request(current));
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).data.replayed, true);
    assert.equal(snapshot(db), afterCreate);
  } finally {
    db.close();
  }
});
