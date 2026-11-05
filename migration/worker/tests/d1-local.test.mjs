// Requires pending migrations applied once through the documented local D1 command.
// Operates exclusively on ignored .wrangler/state; never uses --remote or an HTTP API.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
function execute(args,expected=0) {
 const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state',...args],{encoding:'utf8'});
 assert.equal(result.status,expected,(result.stderr||result.stdout).slice(-1500)); return result.stdout;
}
function rows(query) {
 const response=JSON.parse(execute(['--command',query,'--json']));
 assert(response.every(x=>x.success));return response.flatMap(x=>x.results);
}
// Seed once into an empty isolated database. Reruns must not duplicate it.
const n=rows('SELECT count(*) n FROM repair_shops')[0].n;
if(n===0)execute(['--file','tests/fixtures/d1-identity.sql']);
else assert.equal(n,2,'Test runner refuses any unexpected database; use a fresh checkout.');
assert.equal(rows('SELECT count(DISTINCT role_code) n FROM tamiran_users')[0].n,7);
assert.equal(rows('SELECT count(*) n FROM tamiran_user_branches')[0].n,7);
assert.equal(rows('SELECT count(*) n FROM repair_customers')[0].n,2);
assert.equal(rows('PRAGMA foreign_key_check').length,0);
const bad=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',"INSERT INTO tamiran_user_branches VALUES(2,4,2,'technician','[]',1)"],{encoding:'utf8'});
assert.notEqual(bad.status,0); assert.match(bad.stdout+bad.stderr,/FOREIGN KEY constraint/i);
assert.equal(rows('SELECT count(*) n FROM tamiran_user_branches')[0].n,7,'Denied cross-shop write changed records');
assert.equal(rows('SELECT receipt_counter FROM repair_shops WHERE id=1')[0].receipt_counter,0);
console.log(JSON.stringify({engine:'Wrangler local D1',tables:5,roles:7,memberships:7,synthetic_customers:2,foreign_key_violations:0,cross_shop_write:'rejected_and_readback_unchanged',hosted_database:'NOT_RUN',api_e2e:'NOT_RUN'}));
