import assert from "node:assert/strict";
import { test } from "node:test";
import {
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

const fixtureTerms = {
  versionId: 1,
  public_id: "TEST-TAM-1010F-TERMA",
  version_number: 1,
  title: "آزمایشی — شرایط الف",
  body_text: "آزمایشی — شرایط پذیرش و حفظ اطلاعات دستگاه",
  content_sha256:
    "bb667b05ec45c013994f4ed74c0eac60dbd7a0198aea20d1d3c8eaab1877d873",
  effective_from: "2026-10-10 00:00:00",
};

test("UI-TERMS-01 authoritative settings terms normalize without changing displayed text or hash", () => {
  const terms = parseActiveReceiptTerms(fixtureTerms);
  assert.deepEqual(terms, {
    versionId: 1,
    publicId: fixtureTerms.public_id,
    versionNumber: 1,
    title: fixtureTerms.title,
    bodyText: fixtureTerms.body_text,
    contentSha256: fixtureTerms.content_sha256,
    effectiveFrom: fixtureTerms.effective_from,
  });
  assert.deepEqual(parseActiveReceiptTerms(terms), terms);
  assert.equal(parseActiveReceiptTerms(null), null);
  assert.throws(
    () =>
      parseActiveReceiptTerms({
        ...fixtureTerms,
        content_sha256: "not-a-content-hash",
      }),
    /معتبر نیست/,
  );
});

test("UI-TERMS-02 acceptance is only built for the exact displayed active version", () => {
  const terms = parseActiveReceiptTerms(fixtureTerms);
  assert(terms);
  const key = receiptTermsKey(terms);
  assert.throws(() => buildReceiptAcceptance(null, ""), /آماده نیست/);
  assert.throws(() => buildReceiptAcceptance(terms, ""), /تأیید کنید/);
  assert.throws(
    () =>
      buildReceiptAcceptance(
        {
          ...terms,
          versionId: 2,
          contentSha256: "a".repeat(64),
        },
        key,
      ),
    /تأیید کنید/,
  );
  assert.deepEqual(buildReceiptAcceptance(terms, key), {
    versionId: 1,
    contentSha256: fixtureTerms.content_sha256,
    accepted: true,
  });
});

test("UI-TERMS-03 all six roles read the same real local terms; only manager and reception can submit them", async () => {
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
    const acceptanceCountBefore = n(db, "repair_case_receipt_terms");

    for (const [account, role] of roles) {
      const deps = {
        getUser: async () => ({
          ...user,
          userId: `TEST-TAMIRAN-1010A-account${account}`,
        }),
        getDb: async () => db,
        getKey: async () => key,
        now: () => "2026-10-10 12:00:00",
      };
      const read = createReceptionReadHttpHandler(deps);
      const settingsResponse = await read(
        new Request("https://test.invalid/api/settings.php?branchId=1"),
      );
      assert.equal(settingsResponse.status, 200, role);
      const settingsBody = await settingsResponse.json();
      const terms = parseActiveReceiptTerms(
        settingsBody.data.activeReceiptTerms,
      );
      assert(terms, role);
      assert.equal(terms.bodyText, fixtureTerms.body_text, role);
      assert.equal(terms.contentSha256, fixtureTerms.content_sha256, role);

      const post = withCsrf(createReceptionPostHttpHandler(deps), deps);
      const receiptAcceptance = buildReceiptAcceptance(
        terms,
        receiptTermsKey(terms),
      );
      const response = await post(
        new Request("https://test.invalid/api/operations.php", {
          method: "POST",
          headers: {
            Origin: "https://test.invalid",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_case",
            branchId: 1,
            idempotencyKey: `TEST-TAMIRAN-1011U-A03-${account}`,
            customerName: `آزمایشی — پذیرش شرایط ${role}`,
            customerMobile: `09121110${String(account).padStart(3, "0")}`,
            deviceModelId: 1,
            identifier: `TEST-UI-A03-${account}`,
            color: "آزمایشی — مشکی",
            declaredIssue: "آزمایشی — بررسی مسیر پذیرش شرایط",
            accessories: ["آزمایشی — کابل"],
            appearanceStates: ["خط‌وخش"],
            customerConsent: {
              dataHandling: "no_erasure",
              acceptanceMethod: "recorded_consent",
            },
            receiptAcceptance,
          }),
        }),
      );
      const allowed = role === "repair_manager" || role === "reception";
      assert.equal(response.status, allowed ? 200 : 403, role);
    }

    assert.equal(n(db, "repair_cases"), caseCountBefore + 2);
    assert.equal(
      n(db, "repair_case_receipt_terms"),
      acceptanceCountBefore + 2,
    );
  } finally {
    db.close();
  }
});
