// Official Wrangler local D1 persistence/constraints only; not application HTTP/E2E.
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const args=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state'];
function execute(extra){return spawnSync(process.execPath,[...args,...extra],{encoding:'utf8',timeout:30000});}
function rows(query){const result=execute(['--command',query,'--json']);assert.equal(result.status,0,(result.stderr||result.stdout).slice(-1000));return JSON.parse(result.stdout).flatMap(x=>x.results);}
function file(path){const result=execute(['--file',path]);assert.equal(result.status,0,(result.stderr||result.stdout).slice(-1000));}
function rejected(query){const result=execute(['--command',query]);assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/immutable|FOREIGN KEY|scope/);}
test('D1-LOCAL-F: receipt terms/acceptance/token persist and immutable/cross-shop writes are rejected',()=>{
 assert.equal(rows('SELECT count(*) n FROM repair_shops')[0].n,2,'Only synthetic local identity database allowed');
 if(rows('SELECT count(*) n FROM repair_cases')[0].n===0)file('tests/fixtures/d1-case-core.sql');
 if(rows('SELECT count(*) n FROM repair_receipt_term_versions')[0].n===0)file('tests/fixtures/d1-receipt-terms.sql');
 if(rows('SELECT count(*) n FROM repair_case_receipt_terms')[0].n===0){
  rows("INSERT INTO repair_case_receipt_terms(public_id,case_id,term_version_id,accepted_by_name,acceptance_method,evidence_json,accepted_at,shop_id) VALUES('TEST-TAM-1010F-CLI-ACCEPT',1,1,'آزمایشی — تست ذخیره','recorded_consent','{}','2026-10-10 02:00:00',1)");
  rows("INSERT INTO repair_portal_tokens(public_id,shop_id,case_id,token_hash,expires_at,created_by_user_id,created_at) SELECT 'TEST-TAM-1010F-CLI-TOKEN',1,1,tracking_token_hash,'2027-11-14 02:00:00',3,'2026-10-10 02:00:00' FROM repair_cases WHERE id=1");
 }
 const before=rows('SELECT public_id,case_id,term_version_id,acceptance_method FROM repair_case_receipt_terms');
 assert.equal(before.length,1);assert.equal(before[0].term_version_id,1);
 assert.equal(rows('SELECT count(*) n FROM repair_portal_tokens')[0].n,1);
 rejected("UPDATE repair_case_receipt_terms SET evidence_json='{}'");
 rejected("UPDATE repair_receipt_term_versions SET body_text='آزمایشی — تغییر غیرمجاز' WHERE id=1");
 rejected("INSERT INTO repair_case_receipt_terms(public_id,case_id,term_version_id,accepted_by_name,acceptance_method,evidence_json,shop_id) VALUES('TEST-TAM-XSHOP-CLI',2,1,'آزمایشی','recorded_consent','{}',2)");
 rejected("INSERT INTO repair_portal_tokens(public_id,shop_id,case_id,token_hash,expires_at,created_by_user_id,created_at) SELECT 'TEST-TAM-XACTOR-CLI',2,2,tracking_token_hash,'2027-11-14 02:00:00',3,'2026-10-10 02:00:00' FROM repair_cases WHERE id=2");
 assert.deepEqual(rows('SELECT public_id,case_id,term_version_id,acceptance_method FROM repair_case_receipt_terms'),before);
 assert.equal(rows('SELECT count(*) n FROM repair_portal_tokens')[0].n,1);
 assert.equal(rows('PRAGMA foreign_key_check').length,0);
 console.log('PASS Wrangler local D1 terms/acceptance/token storage and immutable/cross-shop rejection; hosted/network/E2E NOT_RUN');
});
