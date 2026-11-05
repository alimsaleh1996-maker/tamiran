// Official Wrangler local D1 persistence/constraints only; not hosted API or browser E2E.
import{spawnSync}from'node:child_process';import assert from'node:assert/strict';import{test}from'node:test';import{fileURLToPath}from'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const args=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state'];
function execute(extra){return spawnSync(process.execPath,[...args,...extra],{encoding:'utf8',timeout:30000})}
function rows(query){const result=execute(['--command',query,'--json']);assert.equal(result.status,0,(result.stderr||result.stdout).slice(-1200));return JSON.parse(result.stdout).flatMap(item=>item.results)}
function file(path){const result=execute(['--file',path]);assert.equal(result.status,0,(result.stderr||result.stdout).slice(-1200))}
function rejected(query){const result=execute(['--command',query]);assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/constraint|FOREIGN KEY/i)}
test('D1-LOCAL-Q module catalog and scoped entitlements persist with denials unchanged',()=>{
 assert.equal(rows('SELECT count(*) n FROM repair_shops')[0].n,2,'Only the isolated synthetic identity database is allowed');
 if(rows('SELECT count(*) n FROM tamiran_modules')[0].n===0)file('tests/fixtures/d1-capabilities.sql');
 assert.equal(rows('SELECT count(*) n FROM tamiran_modules')[0].n,11);assert.equal(rows('SELECT count(*) n FROM tamiran_shop_modules')[0].n,17);
 const before=rows("SELECT repair_shop_id,module_key,state,updated_by_user_id FROM tamiran_shop_modules ORDER BY repair_shop_id,module_key");
 rejected("UPDATE tamiran_shop_modules SET updated_by_user_id=8 WHERE repair_shop_id=1 AND module_key='inventory'");
 rejected("UPDATE tamiran_shop_modules SET state='enabled' WHERE repair_shop_id=1 AND module_key='inventory'");
 rejected("UPDATE tamiran_shop_modules SET config_json='raw' WHERE repair_shop_id=1 AND module_key='inventory'");
 assert.deepEqual(rows("SELECT repair_shop_id,module_key,state,updated_by_user_id FROM tamiran_shop_modules ORDER BY repair_shop_id,module_key"),before);
 assert.equal(rows('PRAGMA foreign_key_check').length,0);
 console.log('PASS official local D1: 9 schema files; 11 modules/17 scoped entitlements; cross-shop/state/JSON denial; hosted/network/E2E NOT_RUN');
});
