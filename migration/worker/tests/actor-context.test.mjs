import{test}from'node:test';import assert from'node:assert/strict';
import{LocalD1,user}from'./fixtures/reception-harness.mjs';
import{createReceptionReadHttpHandler}from'../lib/reception-contract-http.ts';
const now='2026-10-10 12:00:00',actor=id=>({...user,userId:`TEST-TAMIRAN-1010A-account${id}`,displayName:'اعتماد نشود'});
const deps=(db,id=2,changes={})=>({getUser:async()=>id===null?null:actor(id),getDb:async()=>db,getKey:async()=>null,now:()=>now,...changes});
const request=(query='',method='GET')=>new Request(`https://test.invalid/api/auth.php${query?'?'+query:''}`,{method});
const run=(db,id=2,changes={})=>createReceptionReadHttpHandler(deps(db,id,changes));
const state=db=>JSON.stringify(['repair_shops','repair_branches','tamiran_users','tamiran_user_branches'].map(t=>db.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()));
async function check(fn){const db=new LocalD1();try{await fn(db)}finally{db.close()}}

test('ACTOR-01 central administrator resolves only from active Site account binding',()=>check(async db=>{
 const before=state(db),response=await run(db,1)(request());assert.equal(response.status,200);const data=(await response.json()).data;
 assert.equal(data.requiresContext,false);assert.deepEqual(data.contexts,[]);assert.deepEqual(data.actor,{id:1,displayName:'آزمایشی — مدیر سیستم',role:'central_admin',primaryRole:'central_admin',permissions:['*'],isCentralAdmin:true,branch:null,shop:null});
 assert.equal(state(db),before);assert(!JSON.stringify(data).includes('account1'));assert(!JSON.stringify(data).includes('LOGIN-HASH'));
}));

test('ACTOR-02 all six shop roles receive the authoritative branch role and safe profile',()=>check(async db=>{
 const roles=new Map([[2,'repair_manager'],[3,'reception'],[4,'technician'],[5,'quality_control'],[6,'warehouse_keeper'],[7,'finance_cashier']]);
 for(const[id,role]of roles){const response=await run(db,id)(request('branchId=1'));assert.equal(response.status,200,role);const data=(await response.json()).data,profile=data.actor;assert.equal(profile.role,role);assert.equal(profile.displayName,db.db.prepare('SELECT display_name FROM tamiran_users WHERE id=?').get(id).display_name);assert.equal(profile.branch.name,'آزمایشی — شعبه الف');assert.equal(profile.shop.name,'آزمایشی — تعمیرگاه الف');assert.equal(profile.shop.publicCode,'T1010A');assert.equal(profile.shop.productProfile,'pro');assert.equal(profile.isCentralAdmin,false);assert.equal(data.requiresContext,false);const encoded=JSON.stringify(data);assert(!encoded.includes('password_hash'));assert(!encoded.includes('account_user_id'));assert(!encoded.includes('LOGIN-HASH'))}
}));

test('ACTOR-03 multiple memberships require explicit selection and preserve branch role',()=>check(async db=>{
 db.db.exec("UPDATE repair_branches SET is_default=1 WHERE id=1; INSERT INTO tamiran_user_branches(shop_id,user_id,branch_id,branch_role_code,permissions_json) VALUES(1,3,3,'repair_manager','[\"branches.switch\"]')");
 let response=await run(db,3)(request());assert.equal(response.status,200);let data=(await response.json()).data;assert.equal(data.actor,null);assert.equal(data.requiresContext,true);assert.deepEqual(data.contexts.map(x=>[x.branchId,x.role,x.isDefault]),[[1,'reception',true],[3,'repair_manager',false]]);assert(!('shopId'in data.contexts[0]));
 response=await run(db,3)(request('branchId=3'));assert.equal(response.status,200);data=(await response.json()).data;assert.equal(data.actor.branch.id,3);assert.equal(data.actor.role,'repair_manager');assert.deepEqual(data.actor.permissions,['branches.switch']);
 response=await run(db,3)(request('branchId=1'));assert.equal((await response.json()).data.actor.role,'reception');
}));

test('ACTOR-04 the same Site identity can select only its own shop and branch contexts',()=>check(async db=>{
 db.db.exec("UPDATE tamiran_users SET account_user_id='TEST-TAMIRAN-1010A-account3' WHERE id=8");
 let data=(await(await run(db,3)(request())).json()).data;assert.equal(data.requiresContext,true);assert.deepEqual(new Set(data.contexts.map(x=>x.publicShopCode)),new Set(['T1010A','T1010B']));
 data=(await(await run(db,3)(request('branchId=2'))).json()).data;assert.equal(data.actor.id,8);assert.equal(data.actor.shop.publicCode,'T1010B');assert.equal(data.actor.branch.id,2);
 assert.equal((await run(db,2)(request('branchId=2'))).status,403);
}));

test('ACTOR-05 anonymous, unbound, spoofed, duplicate and invalid selections fail closed',async()=>{
 await check(async db=>assert.equal((await run(db,null)(request())).status,401));
 await check(async db=>assert.equal((await run(db,99)(request())).status,403));
 await check(async db=>{for(const query of['role=repair_manager','shopId=1','testRole=reception','branchId=1&branchId=1','branchId=0','branchId=1.5','branchId=9007199254740992','branchId='])assert.equal((await run(db,3)(request(query))).status,400,query);assert.equal((await run(db,3)(request('branchId=2'))).status,403);assert.equal((await run(db,1)(request('branchId=1'))).status,400);assert.equal((await run(db,3)(request('', 'DELETE'))).status,405)});
});

test('ACTOR-06 inactive identity, membership, branch and suspended shop are denied',async()=>{
 for(const sql of["UPDATE tamiran_users SET is_active=0 WHERE id=3","UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=3 AND branch_id=1","UPDATE repair_branches SET is_active=0 WHERE id=1","UPDATE repair_shops SET lifecycle_status='suspended' WHERE id=1"])
  await check(async db=>{db.db.exec(sql);assert.equal((await run(db,3)(request('branchId=1'))).status,403)});
});

test('ACTOR-07 read-only and expired license states remain visible without granting writes',async()=>{
 await check(async db=>{db.db.exec("UPDATE repair_shops SET lifecycle_status='read_only' WHERE id=1");const data=(await(await run(db,3)(request('branchId=1'))).json()).data;assert.equal(data.actor.shop.licenseStatus,'read_only')});
 await check(async db=>{db.db.exec("UPDATE repair_shops SET license_expires_at='2026-10-09' WHERE id=1");const data=(await(await run(db,3)(request('branchId=1'))).json()).data;assert.equal(data.actor.shop.licenseStatus,'expired')});
});

test('ACTOR-08 malformed optional JSON is sanitized and selection rechecks current membership',()=>check(async db=>{
 db.db.exec("UPDATE tamiran_users SET display_name='آزمایشی — پذیرش قطعی' WHERE id=3; UPDATE tamiran_user_branches SET permissions_json='{}' WHERE user_id=3; UPDATE repair_shops SET modules_json='{}',feature_flags_json='[]' WHERE id=1; INSERT INTO tamiran_user_branches(shop_id,user_id,branch_id,branch_role_code,permissions_json) VALUES(1,3,3,'reception','[]')");
 let data=(await(await run(db,3)(request('branchId=1'))).json()).data;assert.equal(data.actor.displayName,'آزمایشی — پذیرش قطعی');assert.deepEqual(data.actor.permissions,[]);assert.deepEqual(data.actor.shop.modules,['repair']);assert.deepEqual(data.actor.shop.featureFlags,{});
 db.db.exec('UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=3 AND branch_id=3');const before=state(db);assert.equal((await run(db,3)(request('branchId=3'))).status,403);assert.equal(state(db),before);
}));
