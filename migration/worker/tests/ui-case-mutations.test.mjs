import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalD1, user } from "./fixtures/reception-harness.mjs";
import { importPortalKey } from "../lib/portal-token.ts";
import {
  createCasePatchHttpHandler,
  createReceptionReadHttpHandler,
} from "../lib/reception-contract-http.ts";
import { buildCaseMutationRequest } from "../app/software/case-mutations.ts";

const origin = "https://test.invalid";
const now = "2026-10-11 16:40:00";
const key = await importPortalKey(new Uint8Array(32));
const actor = (id) => ({
  ...user,
  userId: `TEST-TAMIRAN-1010A-account${id}`,
});

function ids() {
  let value = 0;
  return {
    newPublicId: () =>
      `TEST-TAMIRAN-1011Y-A08-${String(++value).padStart(2, "0")}`,
    newRequestId: () =>
      `TEST-TAMIRAN-1011Y-A08-REQUEST-${String(++value).padStart(2, "0")}`,
  };
}

function deps(db, actorId, changes = {}) {
  return {
    getUser: async () => (actorId === null ? null : actor(actorId)),
    getDb: async () => db,
    getKey: async () => key,
    now: () => now,
    ...ids(),
    ...changes,
  };
}

async function csrf(db, actorId, dependency = deps(db, actorId)) {
  const response = await createReceptionReadHttpHandler(dependency)(
    new Request(`${origin}/api/csrf.php?branchId=1`, {
      headers: { Origin: origin },
    }),
  );
  assert.equal(response.status, 200, `csrf role ${actorId}`);
  return (await response.json()).data.csrf_token;
}

function request(body, token, changes = {}) {
  return new Request(
    `${origin}/api/operations.php${changes.query ?? ""}`,
    {
      method: changes.method ?? "PATCH",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(token ? { "X-CSRF-Token": token } : {}),
        ...(changes.headers ?? {}),
      },
      body: changes.raw ?? JSON.stringify(body),
    },
  );
}

const body = (changes = {}) => ({
  branchId: 1,
  id: 1,
  expectedVersion: 0,
  operationReport: "TEST-TAMIRAN-1011Y-A08 — گزارش کاملاً آزمایشی",
  reason: "TEST-TAMIRAN-1011Y-A08 — آزمون mutation پرونده",
  ...changes,
});

const mutationState = (db) =>
  JSON.stringify({
    cases: db.db
      .prepare(
        "SELECT id,status,assigned_to_user_id,result,operation_report,delivery_amount,delivered_to_name,delivery_notes,row_version,updated_at FROM repair_cases ORDER BY id",
      )
      .all(),
    events: db.db
      .prepare("SELECT * FROM repair_case_events ORDER BY id")
      .all(),
    audit: db.db
      .prepare("SELECT * FROM tamiran_audit_log ORDER BY id")
      .all(),
  });

async function check(run) {
  const db = new LocalD1();
  try {
    await run(db);
  } finally {
    db.close();
  }
}

test("UI-CASE-01 request contract requires authoritative expectedVersion", () => {
  assert.deepEqual(
    buildCaseMutationRequest({
      id: 7,
      expectedVersion: 3,
      operationReport: "TEST-TAMIRAN-1011Y-A08",
    }),
    {
      id: 7,
      expectedVersion: 3,
      operationReport: "TEST-TAMIRAN-1011Y-A08",
    },
  );
  for (const invalid of [
    { id: 0, expectedVersion: 0, operationReport: "x" },
    { id: 1, expectedVersion: -1, operationReport: "x" },
    { id: 1, expectedVersion: 0.5, operationReport: "x" },
    { id: 1, expectedVersion: undefined, operationReport: "x" },
    { id: 1, expectedVersion: 0, deliveryAmount: 1.5 },
  ])
    assert.throws(() => buildCaseMutationRequest(invalid));
});

test("UI-CASE-02 manager mutation commits case, event and audit once; retry is read-only 409", () =>
  check(async (db) => {
    const dependency = deps(db, 2);
    const token = await csrf(db, 2, dependency);
    const handler = createCasePatchHttpHandler(dependency);
    const value = body();
    const response = await handler(request(value, token));
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.equal(data.repairCase.expectedVersion, 1);
    assert.equal(data.repairCase.operationReport, value.operationReport);
    assert.equal(
      db.db.prepare("SELECT row_version FROM repair_cases WHERE id=1").get()
        .row_version,
      1,
    );
    assert.equal(
      db.db
        .prepare("SELECT count(*) AS n FROM repair_case_events WHERE case_id=1")
        .get().n,
      2,
    );
    assert.equal(
      db.db
        .prepare(
          "SELECT count(*) AS n FROM tamiran_audit_log WHERE entity_public_id='TEST-TAMIRAN-1010B-CASEA'",
        )
        .get().n,
      2,
    );
    const after = mutationState(db);
    assert.equal((await handler(request(value, token))).status, 409);
    assert.equal(mutationState(db), after);
  }));

test("UI-CASE-03 all six roles use scoped CSRF; four permitted mutations and two denials preserve data", async () => {
  const scenarios = [
    [
      2,
      200,
      body({ operationReport: "TEST-TAMIRAN-1011Y-A08-MANAGER" }),
    ],
    [
      3,
      200,
      body({
        operationReport: undefined,
        deliveryNotes: "TEST-TAMIRAN-1011Y-A08-RECEPTION",
      }),
    ],
    [
      4,
      200,
      body({
        operationReport: "TEST-TAMIRAN-1011Y-A08-TECHNICIAN",
        result: "repaired",
      }),
    ],
    [
      5,
      200,
      body({
        operationReport: "TEST-TAMIRAN-1011Y-A08-QC",
        result: "not_repaired",
      }),
    ],
    [
      6,
      403,
      body({ operationReport: "TEST-TAMIRAN-1011Y-A08-WAREHOUSE" }),
    ],
    [
      7,
      403,
      body({ operationReport: "TEST-TAMIRAN-1011Y-A08-FINANCE" }),
    ],
  ];
  for (const [actorId, expectedStatus, value] of scenarios) {
    await check(async (db) => {
      if (actorId === 4 || actorId === 5)
        db.db.exec(
          `UPDATE repair_cases SET assigned_to_user_id=${actorId},status='assigned' WHERE id=1`,
        );
      const dependency = deps(db, actorId);
      const token = await csrf(db, actorId, dependency);
      const before = mutationState(db);
      const response = await createCasePatchHttpHandler(dependency)(
        request(value, token),
      );
      assert.equal(response.status, expectedStatus, `role ${actorId}`);
      const version = db.db
        .prepare("SELECT row_version FROM repair_cases WHERE id=1")
        .get().row_version;
      assert.equal(version, expectedStatus === 200 ? 1 : 0, `role ${actorId}`);
      if (expectedStatus !== 200) assert.equal(mutationState(db), before);
    });
  }
});

test("UI-CASE-04 stale, race, workflow-stage and scope failures cannot overwrite or append evidence", () =>
  check(async (db) => {
    const dependency = deps(db, 2);
    const token = await csrf(db, 2, dependency);
    const handler = createCasePatchHttpHandler(dependency);
    const initial = mutationState(db);

    assert.equal(
      (
        await handler(
          request(body({ expectedVersion: 1 }), token),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await handler(
          request(
            body({ operationReport: undefined, status: "assigned" }),
            token,
          ),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await handler(
          request(
            body({
              operationReport: undefined,
              assignedToUserId: 4,
            }),
            token,
          ),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await handler(
          request(body({ branchId: 2 }), token),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await handler(
          request({ ...body(), role: "repair_manager" }, token),
        )
      ).status,
      400,
    );
    assert.equal((await handler(request(body(), null))).status, 419);
    assert.equal(
      (
        await handler(
          request(body(), token, {
            headers: { Origin: "https://other.invalid" },
          }),
        )
      ).status,
      403,
    );
    assert.equal(
      (await handler(request(body(), token, { query: "?role=repair_manager" })))
        .status,
      400,
    );
    assert.equal(
      (await handler(request(body(), token, { method: "POST" }))).status,
      405,
    );
    assert.equal(
      (
        await handler(
          request(body(), token, {
            headers: { "Content-Type": "text/plain" },
          }),
        )
      ).status,
      415,
    );
    assert.equal(
      (
        await handler(
          request(body(), token, {
            raw: JSON.stringify({
              ...body(),
              operationReport: "x".repeat(33_000),
            }),
          }),
        )
      ).status,
      413,
    );
    assert.equal(mutationState(db), initial);

    const originalBatch = db.batch.bind(db);
    let raced = false;
    let afterOtherWriter = "";
    db.batch = async (statements) => {
      if (!raced) {
        raced = true;
        db.db.exec(
          "UPDATE repair_cases SET operation_report='TEST-TAMIRAN-1011Y-A08-OTHER-WRITER',row_version=row_version+1 WHERE id=1",
        );
        afterOtherWriter = mutationState(db);
      }
      return originalBatch(statements);
    };
    assert.equal((await handler(request(body(), token))).status, 409);
    assert.equal(mutationState(db), afterOtherWriter);
  }));

test("UI-CASE-05 injected event failure rolls back case and audit; revocation wins the race", async () => {
  {
    const db = new LocalD1(/INSERT INTO repair_case_events/);
    try {
      const dependency = deps(db, 2);
      const token = await csrf(db, 2, dependency);
      const before = mutationState(db);
      const response = await createCasePatchHttpHandler(dependency)(
        request(body(), token),
      );
      assert.equal(response.status, 500);
      assert.equal(mutationState(db), before);
    } finally {
      db.close();
    }
  }
  await check(async (db) => {
    const dependency = deps(db, 2);
    const token = await csrf(db, 2, dependency);
    const originalBatch = db.batch.bind(db);
    const beforeCase = mutationState(db);
    db.batch = async (statements) => {
      db.db.exec(
        "UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=2 AND branch_id=1",
      );
      return originalBatch(statements);
    };
    const response = await createCasePatchHttpHandler(dependency)(
      request(body(), token),
    );
    assert.equal(response.status, 403);
    assert.equal(mutationState(db), beforeCase);
  });
});
