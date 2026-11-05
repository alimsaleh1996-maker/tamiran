// Official Wrangler local D1 storage/readback for A08 SQL shapes.
// This is not a hosted API, Worker dispatch, browser, SMS, payment, or customer-data test.
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const args = [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "dist/server/wrangler.json",
  "--persist-to",
  ".wrangler/state",
];
function execute(extra) {
  return spawnSync(process.execPath, [...args, ...extra], {
    encoding: "utf8",
    timeout: 30_000,
  });
}
function rows(query) {
  const result = execute(["--command", query, "--json"]);
  assert.equal(
    result.status,
    0,
    (result.stderr || result.stdout).slice(-1_200),
  );
  return JSON.parse(result.stdout).flatMap((item) => item.results);
}
function file(path) {
  const result = execute(["--file", path]);
  assert.equal(
    result.status,
    0,
    (result.stderr || result.stdout).slice(-1_200),
  );
}

test("D1-LOCAL-Y authoritative case version, event and audit persist; stale/cross-shop updates stay read-only", () => {
  if (rows("SELECT count(*) AS n FROM repair_shops")[0].n === 0)
    file("tests/fixtures/d1-identity.sql");
  if (rows("SELECT count(*) AS n FROM repair_cases")[0].n === 0)
    file("tests/fixtures/d1-case-core.sql");
  assert.equal(
    rows("SELECT count(*) AS n FROM repair_shops")[0].n,
    2,
    "Only the isolated synthetic database is allowed",
  );

  const marker = "TEST-TAMIRAN-1011Y-A08-D1";
  const current = rows(
    "SELECT row_version,operation_report FROM repair_cases WHERE id=1 AND shop_id=1 AND branch_id=1",
  )[0];
  if (current.row_version === 0) {
    const updated = rows(
      `UPDATE repair_cases SET operation_report='${marker}',updated_at='2026-10-11 16:40:00',row_version=row_version+1 WHERE id=1 AND shop_id=1 AND branch_id=1 AND row_version=0 RETURNING row_version`,
    );
    assert.equal(updated[0].row_version, 1);
    rows(
      `INSERT INTO repair_case_events(case_id,actor_user_id,event_type,from_status,to_status,description,metadata_json,created_at) VALUES(1,2,'case_updated','awaiting_assignment','awaiting_assignment','${marker}','{"expectedVersion":0,"nextVersion":1}','2026-10-11 16:40:00')`,
    );
    rows(
      `INSERT INTO tamiran_audit_log(public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,before_json,after_json,reason,request_id,ip_address,created_at) VALUES('TEST-TAMIRAN-1011Y-A08-D1',1,1,2,'case.update','repair_case','TEST-TAMIRAN-1010B-CASEA','{"version":0}','{"version":1}','${marker}','TEST-TAMIRAN-1011Y-A08-D1-REQUEST','','2026-10-11 16:40:00')`,
    );
  } else {
    assert.equal(current.row_version, 1);
    assert.equal(current.operation_report, marker);
  }

  const before = rows(
    "SELECT id,status,operation_report,row_version FROM repair_cases WHERE id=1",
  );
  assert.equal(
    rows(
      "UPDATE repair_cases SET operation_report='TEST-TAMIRAN-1011Y-A08-STALE',row_version=row_version+1 WHERE id=1 AND shop_id=1 AND branch_id=1 AND row_version=0 RETURNING row_version",
    ).length,
    0,
  );
  assert.equal(
    rows(
      "UPDATE repair_cases SET operation_report='TEST-TAMIRAN-1011Y-A08-XSHOP',row_version=row_version+1 WHERE id=2 AND shop_id=1 AND branch_id=1 AND row_version=0 RETURNING row_version",
    ).length,
    0,
  );
  assert.deepEqual(
    rows("SELECT id,status,operation_report,row_version FROM repair_cases WHERE id=1"),
    before,
  );
  assert.equal(
    rows(
      "SELECT count(*) AS n FROM repair_case_events WHERE case_id=1 AND description='TEST-TAMIRAN-1011Y-A08-D1'",
    )[0].n,
    1,
  );
  assert.equal(
    rows(
      "SELECT count(*) AS n FROM tamiran_audit_log WHERE public_id='TEST-TAMIRAN-1011Y-A08-D1'",
    )[0].n,
    1,
  );
  assert.equal(rows("PRAGMA foreign_key_check").length, 0);
  console.log(
    "PASS official local D1 case version/event/audit readback and stale/cross-shop denial; hosted/network/E2E NOT_RUN",
  );
});
