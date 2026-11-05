import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..');
const migrations = readdirSync(resolve(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort();
const sql = migrations.map(x=>readFileSync(resolve(root,'drizzle',x),'utf8')).join('\n');
const seed = readFileSync(resolve(root,'tests/fixtures/d1-identity.sql'),'utf8');
function database() {
 const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON;'); db.exec(sql); db.exec(seed); return db;
}
function scenario(name,fn) { test(name,()=>{const db=database();try{fn(db);}finally{db.close();}}); }
function rejected(db,sql,pattern=/constraint failed/i) { assert.throws(()=>db.exec(sql),pattern); }
test('D1-SCHEMA-01: schema-only official migration preserves every frozen core column',()=>{
 assert(!/\b(INSERT|UPDATE|DELETE|DROP)\s+(?:INTO|FROM|TABLE|SET)\b/i.test(sql));
 const db=database();try {
 const legacy=readFileSync(resolve(root,'baseline/database/schema.sql'),'utf8');
 for(const table of ['repair_shops','repair_branches','tamiran_users','tamiran_user_branches','repair_customers']) {
  const body=legacy.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\(([\\s\\S]*?)\\) ENGINE='))[1];
  const cols=[...body.trimStart().matchAll(/(?:^|,\s*)(\w+)\s+(?:BIGINT|SMALLINT|INT|TINYINT|VARCHAR|CHAR|ENUM|JSON|TEXT|DATETIME|DATE)\b/g)].map(x=>x[1]);
  const actual=db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name);
  assert.deepEqual(actual.filter(x=>x!=='account_user_id'),cols,table);
 }
 } finally {db.close();}
});
scenario('D1-SCHEMA-02: all seven legacy roles have synthetic rows and valid scoped memberships',db=>{
 assert.equal(db.prepare('SELECT count(DISTINCT role_code) n FROM tamiran_users').get().n,7);
 assert.equal(db.prepare('SELECT count(*) n FROM tamiran_user_branches').get().n,7);
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
});
scenario('D1-SCHEMA-03: user from shop A cannot acquire shop B branch with shop A scope',db=>rejected(db,"INSERT INTO tamiran_user_branches VALUES(1,4,2,'technician','[]',1)",/FOREIGN KEY constraint/));
scenario('D1-SCHEMA-04: user from shop A cannot acquire shop B branch by spoofing shop B scope',db=>rejected(db,"INSERT INTO tamiran_user_branches VALUES(2,4,2,'technician','[]',1)",/FOREIGN KEY constraint/));
scenario('D1-SCHEMA-05: duplicate membership is rejected',db=>rejected(db,"INSERT INTO tamiran_user_branches VALUES(1,4,1,'technician','[]',1)",/UNIQUE constraint/));
scenario('D1-SCHEMA-06: central role cannot become branch role',db=>rejected(db,"UPDATE tamiran_user_branches SET branch_role_code='central_admin' WHERE user_id=4",/CHECK constraint/));
scenario('D1-SCHEMA-07: noncentral role requires shop and central role remains global',db=>{
 rejected(db,"UPDATE tamiran_users SET shop_id=NULL WHERE id=4",/CHECK constraint/);
 rejected(db,"UPDATE tamiran_users SET shop_id=1 WHERE id=1",/CHECK constraint/);
});
scenario('D1-SCHEMA-08: duplicate account binding inside shop rejected',db=>rejected(db,"UPDATE tamiran_users SET account_user_id='TEST-TAMIRAN-1010A-account3' WHERE id=4",/UNIQUE constraint/));
scenario('D1-SCHEMA-09: same verified account may have explicit memberships in separate shops',db=>{
 db.exec("UPDATE tamiran_users SET account_user_id='TEST-TAMIRAN-1010A-account3' WHERE id=8");
 assert.equal(db.prepare("SELECT count(*) n FROM tamiran_users WHERE account_user_id='TEST-TAMIRAN-1010A-account3'").get().n,2);
});
scenario('D1-SCHEMA-10: NULL shop cannot defeat central username uniqueness',db=>rejected(db,"INSERT INTO tamiran_users(username,display_name,password_hash,role_code) VALUES('TEST-TAMIRAN-1010A-admin','آزمایشی — تکرار','!TEST-NOT-A-LOGIN-HASH','central_admin')",/UNIQUE constraint/));
scenario('D1-SCHEMA-11: NULL shop cannot defeat central account uniqueness',db=>rejected(db,"INSERT INTO tamiran_users(username,display_name,password_hash,role_code,account_user_id) VALUES('TEST-TAMIRAN-1010A-admin2','آزمایشی — تکرار','!TEST-NOT-A-LOGIN-HASH','central_admin','TEST-TAMIRAN-1010A-account1')",/UNIQUE constraint/));
scenario('D1-SCHEMA-12: customer mobile remains unique within shop, reused across shops',db=>{
 assert.equal(db.prepare("SELECT count(*) n FROM repair_customers WHERE mobile='TEST-MOBILE-A'").get().n,2);
 rejected(db,"INSERT INTO repair_customers(public_id,shop_id,full_name,mobile) VALUES('TEST-TAMIRAN-1010A-DUP',1,'آزمایشی — تکرار','TEST-MOBILE-A')",/UNIQUE constraint/);
});
scenario('D1-SCHEMA-13: orphan customer is rejected',db=>rejected(db,"UPDATE repair_customers SET shop_id=999 WHERE id=1",/FOREIGN KEY constraint/));
scenario('D1-SCHEMA-14: shop with dependent data cannot be deleted',db=>rejected(db,'DELETE FROM repair_shops WHERE id=1',/FOREIGN KEY constraint/));
scenario('D1-SCHEMA-15: invalid role, boolean and permissions JSON rejected',db=>{
 rejected(db,"UPDATE tamiran_users SET role_code='administrator' WHERE id=4",/CHECK constraint/);
 rejected(db,'UPDATE tamiran_user_branches SET is_active=2 WHERE user_id=4',/CHECK constraint/);
 rejected(db,"UPDATE tamiran_user_branches SET permissions_json='bad' WHERE user_id=4",/CHECK constraint/);
});
scenario('D1-SCHEMA-16: counter stays nonnegative integer in JS safe range',db=>{
 for(const v of [-1,1.5,9007199254740992])rejected(db,`UPDATE repair_shops SET receipt_counter=${v} WHERE id=1`,/CHECK constraint/);
 db.exec('UPDATE repair_shops SET receipt_counter=9007199254740991 WHERE id=1');
 assert.equal(db.prepare('SELECT receipt_counter FROM repair_shops WHERE id=1').get().receipt_counter,9007199254740991);
});
scenario('D1-SCHEMA-17: invalid JSON/product/inventory/QC cannot silently enter database',db=>{
 for(const [col,value] of [['modules_json','bad'],['product_profile','unknown'],['inventory_mode','unknown'],['qc_mode','unknown']]) rejected(db,`UPDATE repair_shops SET ${col}='${value}' WHERE id=1`,/CHECK constraint/);
});
scenario('D1-SCHEMA-18: defaults retain legacy policies and UTC timestamp shape',db=>{
 const row=db.prepare('SELECT * FROM repair_shops WHERE id=1').get();
 assert.equal(row.receipt_counter,0); assert.equal(row.product_profile,'pro'); assert.equal(row.inventory_mode,'off');assert.equal(row.qc_mode,'off');assert.equal(row.allow_delivery_with_balance,0);
 assert.match(row.created_at,/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
});
scenario('D1-SCHEMA-19: branch code scoped uniqueness and global shop code uniqueness',db=>{
 rejected(db,"UPDATE repair_branches SET branch_code='TEST-TAMIRAN-1010A-BA' WHERE id=3",/UNIQUE constraint/);
 db.exec("UPDATE repair_branches SET branch_code='TEST-TAMIRAN-1010A-BA' WHERE id=2");
 rejected(db,"UPDATE repair_shops SET public_shop_code='T1010A' WHERE id=2",/(?:UNIQUE constraint|immutable)/);
});
scenario('D1-SCHEMA-20: failed multiwrite transaction rolls back customer and counter',db=>{
 db.exec('BEGIN');try {
 db.exec("INSERT INTO repair_customers(public_id,shop_id,full_name,mobile) VALUES('TEST-TAMIRAN-1010A-ROLL',1,'آزمایشی — بازگشت','TEST-MOBILE-ROLL')");
 db.exec('UPDATE repair_shops SET receipt_counter=receipt_counter+1 WHERE id=1');
 rejected(db,"INSERT INTO tamiran_user_branches VALUES(2,4,2,'technician','[]',1)",/FOREIGN KEY constraint/);
 } finally {db.exec('ROLLBACK');}
 assert.equal(db.prepare("SELECT count(*) n FROM repair_customers WHERE public_id='TEST-TAMIRAN-1010A-ROLL'").get().n,0);
 assert.equal(db.prepare('SELECT receipt_counter FROM repair_shops WHERE id=1').get().receipt_counter,0);
});
scenario('D1-SCHEMA-21: inactive status is persisted without deleting membership',db=>{
 db.exec('UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=4');
 assert.equal(db.prepare('SELECT count(*) n FROM tamiran_user_branches WHERE user_id=4 AND is_active=1').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM tamiran_user_branches WHERE user_id=4').get().n,1);
});
scenario('D1-SCHEMA-22: required fields and legacy lengths enforced',db=>{
 rejected(db,'UPDATE repair_customers SET full_name=NULL WHERE id=1',/NOT NULL constraint/);
 rejected(db,`UPDATE repair_customers SET national_code='${'0'.repeat(11)}' WHERE id=1`,/CHECK constraint/);
});
