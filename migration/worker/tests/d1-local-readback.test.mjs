// Read-only verification of the local Wrangler D1 files after official migration/seed.
// This is storage readback, not the D1 HTTP API or application role authorization.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const folder=resolve(import.meta.dirname,'../.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files=readdirSync(folder).filter(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite');
assert.equal(files.length,1,'Use a fresh checkout with one isolated local database.');
const db=new DatabaseSync(resolve(folder,files[0]),{readOnly:true});
try {
 assert.equal(db.prepare('SELECT count(*) n FROM repair_shops').get().n,2);
 assert.equal(db.prepare('SELECT count(DISTINCT role_code) n FROM tamiran_users').get().n,7);
 assert.equal(db.prepare('SELECT count(*) n FROM tamiran_user_branches').get().n,7);
 assert.equal(db.prepare('SELECT count(*) n FROM repair_customers').get().n,2);
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 assert.equal(db.prepare('SELECT receipt_counter FROM repair_shops WHERE id=1').get().receipt_counter,0);
 console.log(JSON.stringify({engine:'read-only local D1 SQLite storage',shops:2,roles:7,memberships:7,synthetic_customers:2,foreign_key_violations:0,hosted_database:'NOT_RUN',d1_api_denial_smoke:'INCOMPLETE_tool_access',application_e2e:'NOT_RUN'}));
}finally {db.close();}
