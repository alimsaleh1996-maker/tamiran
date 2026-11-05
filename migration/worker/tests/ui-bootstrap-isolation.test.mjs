import { test } from "node:test";
import assert from "node:assert/strict";
import { loadOperationalBootstrap } from "../app/software/operational-bootstrap.ts";
import { createReceptionReadHttpHandler } from "../lib/reception-contract-http.ts";
import { importPortalKey } from "../lib/portal-token.ts";
import { LocalD1, user } from "./fixtures/reception-harness.mjs";

const value = (name) => ({ id: `TEST-TAMIRAN-1011T-${name}` });

function loaders(changes = {}) {
  return {
    loadFollowUps: async () => value("FOLLOWUPS"),
    loadOperations: async () => value("OPERATIONS"),
    loadCatalog: async () => value("CATALOG"),
    loadShopSettings: async () => value("SETTINGS"),
    loadCapabilities: async () => value("CAPABILITIES"),
    ...changes,
  };
}

test("BOOTSTRAP-01 successful core and followups retain their exact payloads", async () => {
  const result = await loadOperationalBootstrap(loaders());
  assert.deepEqual(result, {
    core: {
      status: "fulfilled",
      value: {
        operations: value("OPERATIONS"),
        catalog: value("CATALOG"),
        settings: value("SETTINGS"),
        capabilities: value("CAPABILITIES"),
      },
    },
    followUps: { status: "fulfilled", value: value("FOLLOWUPS") },
  });
});

test("BOOTSTRAP-02 unported followups stays rejected without discarding successful core", async () => {
  const unavailable = Object.assign(new Error("این API هنوز منتقل نشده است."), {
    status: 503,
  });
  const result = await loadOperationalBootstrap(
    loaders({ loadFollowUps: async () => { throw unavailable; } }),
  );
  assert.equal(result.core.status, "fulfilled");
  assert.deepEqual(result.core.value.operations, value("OPERATIONS"));
  assert.deepEqual(result.core.value.capabilities, value("CAPABILITIES"));
  assert.deepEqual(result.followUps, { status: "rejected", reason: unavailable });
});

test("BOOTSTRAP-03 core failure is not converted to partial or fake success", async () => {
  const calls = [];
  const failure = new Error("TEST-TAMIRAN-1011T-CORE-FAILURE");
  const result = await loadOperationalBootstrap({
    loadFollowUps: async () => { calls.push("followups"); return value("FOLLOWUPS"); },
    loadOperations: async () => { calls.push("operations"); return value("OPERATIONS"); },
    loadCatalog: async () => { calls.push("catalog"); throw failure; },
    loadShopSettings: async () => { calls.push("settings"); return value("SETTINGS"); },
    loadCapabilities: async () => { calls.push("capabilities"); return value("CAPABILITIES"); },
  });
  assert.deepEqual(new Set(calls), new Set(["followups", "operations", "catalog", "settings", "capabilities"]));
  assert.deepEqual(result.core, { status: "rejected", reason: failure });
  assert.deepEqual(result.followUps, { status: "fulfilled", value: value("FOLLOWUPS") });
  assert.equal("value" in result.core, false);
});

test("BOOTSTRAP-04 all six operational roles keep real local D1 core when followups returns 503", async () => {
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
    for (const [account, role] of roles) {
      const handler = createReceptionReadHttpHandler({
        getUser: async () => ({ ...user, userId: `TEST-TAMIRAN-1010A-account${account}` }),
        getDb: async () => db,
        getKey: async () => key,
        now: () => "2026-10-10 12:00:00",
      });
      const read = async (path) => {
        const response = await handler(
          new Request(`https://test.invalid${path}?branchId=1`),
        );
        const body = await response.json();
        if (!response.ok) {
          throw Object.assign(new Error(body.error?.message ?? "TEST-TAMIRAN-1011T-HTTP"), {
            status: response.status,
          });
        }
        return body.data;
      };
      const auth = await read("/api/auth.php");
      assert.equal(auth.actor.role, role);
      const result = await loadOperationalBootstrap({
        loadFollowUps: () => read("/api/followups.php"),
        loadOperations: () => read("/api/operations.php"),
        loadCatalog: () => read("/api/catalog.php"),
        loadShopSettings: () => read("/api/settings.php"),
        loadCapabilities: () => read("/api/capabilities.php"),
      });
      assert.equal(result.core.status, "fulfilled", role);
      assert.equal(result.followUps.status, "rejected", role);
      assert.equal(result.followUps.reason.status, 503, role);
      assert.equal(
        result.core.value.settings.shop.code,
        "TEST-TAMIRAN-1010A-SHOPA",
        role,
      );
      assert(Array.isArray(result.core.value.operations.cases), role);
      assert.equal(result.core.value.capabilities.productProfile, "pro", role);
    }
  } finally {
    db.close();
  }
});
