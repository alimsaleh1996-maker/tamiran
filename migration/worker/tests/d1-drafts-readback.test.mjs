// Official local D1 storage/constraints, not HTTP or a Worker transaction test.
import {spawnSync} from 'node:child_process';import {readFileSync,readdirSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';
const args=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state'];
const execute=extra=>spawnSync(process.execPath,[...args,...extra],{encoding:'utf8',timeout:30000});
function rows(sql){const r=execute(['--command',sql,'--json']);assert.equal(r.status,0,(r.stderr||r.stdout).slice(-1000));return JSON.parse(r.stdout).flatMap(x=>x.results)}
function file(p){const r=execute(['--file',p]);assert.equal(r.status,0,(r.stderr||r.stdout).slice(-1000))}
function rejected(sql){const r=execute(['--command',sql]);assert.notEqual(r.status,0);assert.match(r.stderr+r.stdout,/constraint|immutable/i)}
test('D1-LOCAL-L fresh migrations and synthetic draft envelope persist; raw/cross-shop/identity changes rejected',()=>{
 const tables=rows("SELECT name FROM sqlite_master WHERE name='repair_shops'");
 if(!tables.length){for(const p of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())file('drizzle/'+p);file('tests/fixtures/d1-identity.sql');file('tests/fixtures/d1-case-core.sql');file('tests/fixtures/d1-receipt-terms.sql')}
 assert.equal(rows('SELECT count(*) n FROM repair_shops')[0].n,2,'Synthetic isolated DB only');
 assert.equal(rows('SELECT count(*) n FROM tamiran_users')[0].n,8);
 const publicId='TEST-TAMIRAN-1010L-CLI';
 if(!rows(`SELECT id FROM repair_reception_drafts WHERE public_id='${publicId}'`).length){rows("INSERT INTO tamiran_data_retention_policies(shop_id,updated_by_user_id,reception_draft_days) VALUES(1,2,15)");rows(`INSERT INTO repair_reception_drafts(public_id,shop_id,branch_id,created_by_user_id,payload_json,payload_sha256,idempotency_key,expires_at) VALUES('${publicId}',1,1,3,'{"version":1,"ciphertext":"v1.TEST-NOT-A-REAL-CIPHER.TEST"}','${'f'.repeat(64)}','TEST-TAMIRAN-1010L-CLI-KEY','2026-11-09 10:30:00')`)}
 const before=rows('SELECT public_id,shop_id,branch_id,created_by_user_id,payload_json,lock_version FROM repair_reception_drafts');
 assert.equal(before.length,1);assert.equal(before[0].created_by_user_id,3);assert.equal(rows('SELECT reception_draft_days n FROM tamiran_data_retention_policies')[0].n,15);
 rejected("UPDATE repair_reception_drafts SET payload_json='{}'");rejected("UPDATE repair_reception_drafts SET created_by_user_id=2");
 rejected(`INSERT INTO repair_reception_drafts(public_id,shop_id,branch_id,created_by_user_id,payload_json,payload_sha256,idempotency_key,expires_at) SELECT 'TEST-TAMIRAN-1010L-X',1,2,3,payload_json,payload_sha256,'TEST-TAMIRAN-1010L-X','2026-11-09 10:30:00' FROM repair_reception_drafts`);
 assert.deepEqual(rows('SELECT public_id,shop_id,branch_id,created_by_user_id,payload_json,lock_version FROM repair_reception_drafts'),before);assert.equal(rows('PRAGMA foreign_key_check').length,0);
 // Old migration inputs were not edited; this test only applies them to a fresh local DB.
 assert(readFileSync('drizzle/0006_next_misty_knight.sql','utf8').includes('CREATE TRIGGER'));
 console.log('PASS official local D1: 9 schema files, synthetic envelope/policy readback, immutable/cross-shop/raw-JSON denial; hosted/network/E2E NOT_RUN');
});
