import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{LocalD1,user}from'./fixtures/reception-harness.mjs';
import{createReceptionReadHttpHandler}from'../lib/reception-contract-http.ts';
const now='2026-10-10 12:00:00',actor=id=>({...user,userId:`TEST-TAMIRAN-1010A-account${id}`});
const deps=(db,id=2,changes={})=>({getUser:async()=>id===null?null:actor(id),getDb:async()=>db,getKey:async()=>null,now:()=>now,...changes});
const request=(query='branchId=1')=>new Request(`https://test.invalid/api/capabilities.php${query?'?'+query:''}`);
const run=(db,id=2,changes={})=>createReceptionReadHttpHandler(deps(db,id,changes));
const state=db=>JSON.stringify(['tamiran_modules','tamiran_shop_modules','tamiran_users','tamiran_user_branches','repair_shops'].map(t=>db.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()));
async function check(fn){const db=new LocalD1();try{await fn(db)}finally{db.close()}}

test('CAPABILITY-DB-01 frozen catalog/entitlement columns preserved with tenant constraints',()=>check(async db=>{
 const legacy=readFileSync('baseline/database/schema.sql','utf8');for(const table of['tamiran_modules','tamiran_shop_modules']){const body=legacy.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\(([\\s\\S]*?)\\) ENGINE='))[1];const columns=[...body.trimStart().matchAll(/(?:^|,\s*)(\w+)\s+(?:BIGINT|SMALLINT|TINYINT|VARCHAR|CHAR|ENUM|JSON|TEXT|DATETIME|DATE)\b/g)].map(x=>x[1]);assert.deepEqual(db.db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name),columns)}
 assert.throws(()=>db.db.exec("UPDATE tamiran_shop_modules SET updated_by_user_id=8 WHERE repair_shop_id=1 AND module_key='inventory'"),/FOREIGN KEY/);
 assert.throws(()=>db.db.exec("UPDATE tamiran_shop_modules SET state='enabled' WHERE repair_shop_id=1 AND module_key='inventory'"),/CHECK/);
 assert.throws(()=>db.db.exec("UPDATE tamiran_shop_modules SET config_json='secret' WHERE repair_shop_id=1 AND module_key='inventory'"),/CHECK/);
 assert.throws(()=>db.db.exec("INSERT INTO tamiran_shop_modules(repair_shop_id,module_key,config_json) VALUES(1,'unknown','{}')"),/FOREIGN KEY/);
}));

test('CAPABILITY-GET-02 manager receives DB-backed catalog, states and no private columns',()=>check(async db=>{
 const before=state(db),response=await run(db)(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const data=(await response.json()).data;assert.equal(data.productProfile,'pro');assert.equal(data.discoverable,true);assert.equal(data.modules.length,11);assert.equal(data.generatedAt,'2026-10-10T12:00:00.000Z');
 const by=Object.fromEntries(data.modules.map(item=>[item.module,item]));assert.equal(by.repair.access,'granted');assert.equal(by.inventory.entitlement,'active');assert.equal(by.finance.entitlement,'trial');assert.equal(by.finance.trialDaysRemaining,2);assert.equal(by.warranty.entitlement,'expired');assert.equal(by.warranty.catalog,'visible');
 const encoded=JSON.stringify(data);assert(!encoded.includes('TEST-TAMIRAN-1010Q-PRIVATE'));assert(!encoded.includes('config_json'));assert(!encoded.includes('source'));assert.equal(state(db),before);
}));

test('CAPABILITY-GET-03 role permissions are authoritative and do not grant active modules broadly',()=>check(async db=>{
 db.db.exec("UPDATE tamiran_shop_modules SET state='active',expires_at=NULL WHERE repair_shop_id=1");
 const expected=new Map([[3,['repair','customer_portal','sms','warranty']],[4,['repair','inventory','warranty']],[5,['repair','warranty']],[6,['repair','inventory']],[7,['repair','finance','accounting_integration']]]);
 for(const[id,granted]of expected){const response=await run(db,id)(request());assert.equal(response.status,200,`role ${id}`);const data=(await response.json()).data;assert.equal(data.discoverable,false);assert.deepEqual(data.modules.filter(item=>item.access==='granted').map(item=>item.module),granted);assert(data.modules.filter(item=>!granted.includes(item.module)).every(item=>item.navigation==='hidden'))}
}));

test('CAPABILITY-GET-04 explicit permissions affect discovery/use but cannot override entitlement',()=>check(async db=>{
 db.db.exec("UPDATE tamiran_user_branches SET permissions_json='[\"modules.discover\",\"inventory.use\"]' WHERE user_id=3 AND branch_id=1; UPDATE tamiran_shop_modules SET state='locked' WHERE repair_shop_id=1 AND module_key='inventory'");
 let data=(await(await run(db,3)(request())).json()).data;let inventory=data.modules.find(item=>item.module==='inventory');assert.equal(data.discoverable,true);assert.equal(inventory.permission,'use');assert.equal(inventory.access,'locked');assert.equal(inventory.catalog,'visible');assert.equal(inventory.cta,'request_activation');
 db.db.exec("UPDATE tamiran_shop_modules SET state='active' WHERE repair_shop_id=1 AND module_key='inventory'");data=(await(await run(db,3)(request())).json()).data;inventory=data.modules.find(item=>item.module==='inventory');assert.equal(inventory.access,'granted');assert.equal(inventory.catalog,'hidden');
}));

test('CAPABILITY-GET-05 technical flags suspend but never activate commercial access',()=>check(async db=>{
 db.db.exec("UPDATE repair_shops SET feature_flags_json='{\"module.inventory\":false,\"sms\":true}' WHERE id=1");
 const data=(await(await run(db)(request())).json()).data,by=Object.fromEntries(data.modules.map(item=>[item.module,item]));
 assert.equal(by.inventory.entitlement,'suspended');assert.equal(by.inventory.access,'locked');assert.equal(by.sms.entitlement,'locked');assert.equal(by.sms.access,'locked');
}));

test('CAPABILITY-GET-06 product scope and shop entitlement rows remain isolated',()=>check(async db=>{
 db.db.exec("UPDATE repair_shops SET product_profile='solo' WHERE id=2; UPDATE tamiran_shop_modules SET state='suspended' WHERE repair_shop_id=2 AND module_key='finance'");
 const response=await run(db,8)(request('branchId=2'));assert.equal(response.status,200);const data=(await response.json()).data;assert.equal(data.productProfile,'solo');assert.deepEqual(data.modules.map(item=>item.module),['repair','inventory','finance','customer_portal','sms','warranty']);assert.equal(data.modules.find(item=>item.module==='finance').entitlement,'suspended');assert.equal(data.modules.find(item=>item.module==='inventory').entitlement,'locked');
}));

test('CAPABILITY-GET-07 identity, branch and query spoofing fail closed without mutation',()=>check(async db=>{
 const before=state(db);for(const[identity,status]of[[null,401],[99,403]])assert.equal((await run(db,identity)(request())).status,status);
 for(const query of['role=repair_manager','shopId=2','branchId=0','branchId=1&branchId=1'])assert.equal((await run(db)(request(query))).status,400);
 assert.equal((await run(db)(request('branchId=2'))).status,403);assert.equal(state(db),before);
}));

test('CAPABILITY-GET-08 revocation after initial scope resolution and missing catalog are denied',()=>check(async db=>{
 const base=db.prepare.bind(db);let revoked=false;db.prepare=sql=>{const statement=base(sql);if(!revoked&&sql.includes('WITH valid_scope')){revoked=true;db.db.exec('UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=2')}return statement};assert.equal((await run(db)(request())).status,403);
}));
test('CAPABILITY-GET-09 empty or disabled catalog returns unavailable, not false success',()=>check(async db=>{db.db.exec("UPDATE tamiran_modules SET status='disabled'");const response=await run(db)(request());assert.equal(response.status,503);assert.equal((await response.json()).ok,false)}));
