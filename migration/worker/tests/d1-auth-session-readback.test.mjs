// Official Wrangler local D1 storage/readback for A09 session evidence.
// This is not a hosted API, browser, staging, customer-data, SMS or payment test.
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
  assert.equal(result.status, 0, (result.stderr || result.stdout).slice(-1_200));
  return JSON.parse(result.stdout).flatMap((item) => item.results);
}
function file(path) {
  const result = execute(["--file", path]);
  assert.equal(result.status, 0, (result.stderr || result.stdout).slice(-1_200));
}

test("D1-LOCAL-Z session rotation, stale logout denial and evidence persist", () => {
  if (rows("SELECT count(*) AS n FROM repair_shops")[0].n === 0)
    file("tests/fixtures/d1-identity.sql");
  assert.equal(rows("SELECT count(*) AS n FROM repair_shops")[0].n, 2);
  const request = "TEST-TAMIRAN-1011Z-A09-D1-REQUEST";
  const oldHash = "1".repeat(64);
  const nextHash = "2".repeat(64);
  const existing = rows(
    `SELECT count(*) AS n FROM tamiran_user_session_events WHERE request_id='${request}'`,
  )[0].n;
  if (existing === 0) {
    rows(
      `UPDATE tamiran_users SET active_session_hash='${oldHash}',last_login_at='2026-10-11 17:30:00' WHERE id=3 AND shop_id=1 RETURNING id`,
    );
    rows(
      `INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,created_at) VALUES('TEST-TAM-1011Z-A09-D1L1',1,3,'login','${oldHash}','${request}','','2026-10-11 17:30:00')`,
    );
    assert.equal(
      rows(
        `UPDATE tamiran_users SET active_session_hash='${nextHash}',last_login_at='2026-10-11 17:31:00' WHERE id=3 AND shop_id=1 AND active_session_hash='${oldHash}' RETURNING id`,
      ).length,
      1,
    );
    rows(
      `INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,created_at) VALUES('TEST-TAM-1011Z-A09-D1R1',1,3,'revoked','${oldHash}','${request}','','2026-10-11 17:31:00')`,
    );
    rows(
      `INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,created_at) VALUES('TEST-TAM-1011Z-A09-D1L2',1,3,'login','${nextHash}','${request}','','2026-10-11 17:31:00')`,
    );
    assert.equal(
      rows(
        `UPDATE tamiran_users SET active_session_hash=NULL WHERE id=3 AND active_session_hash='${oldHash}' RETURNING id`,
      ).length,
      0,
    );
    assert.equal(
      rows(
        `UPDATE tamiran_users SET active_session_hash=NULL WHERE id=3 AND active_session_hash='${nextHash}' RETURNING id`,
      ).length,
      1,
    );
    rows(
      `INSERT INTO tamiran_user_session_events(public_id,shop_id,user_id,event_type,session_hash,request_id,ip_address,created_at) VALUES('TEST-TAM-1011Z-A09-D1O1',1,3,'logout','${nextHash}','${request}','','2026-10-11 17:32:00')`,
    );
  }
  assert.equal(
    rows(
      `SELECT count(*) AS n FROM tamiran_user_session_events WHERE request_id='${request}'`,
    )[0].n,
    4,
  );
  assert.deepEqual(
    rows(
      `SELECT event_type FROM tamiran_user_session_events WHERE request_id='${request}' ORDER BY id`,
    ).map((row) => row.event_type),
    ["login", "revoked", "login", "logout"],
  );
  assert.equal(
    rows("SELECT active_session_hash AS hash FROM tamiran_users WHERE id=3")[0].hash,
    null,
  );
  assert.equal(rows("PRAGMA foreign_key_check").length, 0);
  console.log(
    "PASS official local D1 session rotation/logout evidence and stale denial; hosted/network/E2E NOT_RUN",
  );
});
