import{test}from'node:test';import assert from'node:assert/strict';
import{LocalD1,user}from'./fixtures/reception-harness.mjs';
import{createReceptionReadHttpHandler}from'../lib/reception-contract-http.ts';
import{importPortalKey}from'../lib/portal-token.ts';
const now='2026-10-10 12:00:00',key=await importPortalKey(new Uint8Array(32));
const actor=id=>({...user,userId:`TEST-TAMIRAN-1010A-account${id}`});
const request=(query='branchId=1')=>new Request(`https://test.invalid/api/operations.php${query?'?'+query:''}`);
const deps=(db,id=3,changes={})=>({getUser:async()=>id===null?null:actor(id),getDb:async()=>db,getKey:async()=>key,now:()=>now,...changes});
const run=(db,id=3,changes={})=>createReceptionReadHttpHandler(deps(db,id,changes));
const state=db=>JSON.stringify(['repair_cases','repair_case_events','repair_case_stage_events','tamiran_users','tamiran_user_branches'].map(t=>db.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()));
async function check(fn){const db=new LocalD1();try{await fn(db)}finally{db.close()}}

test('OPERATIONS-01 manager/reception receive branch cases, authoritative users, summary and no secret',()=>check(async db=>{
  const before=state(db);
  for(const id of[2,3]){
    const response=await run(db,id)(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const data=(await response.json()).data;assert.equal(data.cases.length,1);const item=data.cases[0];
    assert.equal(item.publicId,'TEST-TAMIRAN-1010B-CASEA');assert.equal(item.customerMobile,'TEST-MOBILE-A');assert.equal(item.expectedVersion,0);
    assert.equal(item.events.length,2);assert.deepEqual(new Set(item.events.map(event=>event.eventType)),new Set(['workflow_transition','case_created']));
    assert.equal(item.trackingUrl,'');assert(!JSON.stringify(data).includes('TEST-NOT-A-REAL-TOKEN'));
    assert.equal(data.users.find(row=>row.id===4).role,'technician');assert.equal(data.summary.activeCases,1);
    assert.deepEqual([data.inventory,data.movements,data.partRequests,data.hotReturns],[[],[],[],[]]);
  }
  assert.equal(state(db),before);
}));

test('OPERATIONS-02 every operational role gets only its permitted case projection',()=>check(async db=>{
  db.db.exec("UPDATE repair_cases SET assigned_to_user_id=4,status='assigned' WHERE id=1");
  const expectations=[[2,1,true],[3,1,true],[4,1,false],[5,0,false],[6,0,false],[7,1,false]];
  for(const[id,count,pii]of expectations){const response=await run(db,id)(request());assert.equal(response.status,200,`role ${id}`);const data=(await response.json()).data;assert.equal(data.cases.length,count,`role ${id}`);if(count){assert.equal(data.cases[0].customerMobile,pii?'TEST-MOBILE-A':'');assert.equal(data.cases[0].nationalCode,'')}assert.equal(data.users.length,pii?6:0)}
}));

test('OPERATIONS-03 shop and selected branch are isolated; ambiguous branch is rejected',()=>check(async db=>{
  let response=await run(db,8)(request('branchId=2'));assert.equal(response.status,200);assert.deepEqual((await response.json()).data.cases.map(row=>row.publicId),['TEST-TAMIRAN-1010B-CASEB']);
  db.db.exec("INSERT INTO tamiran_user_branches(shop_id,user_id,branch_id,branch_role_code,permissions_json) VALUES(1,3,3,'reception','[]')");
  assert.equal((await run(db,3)(request(''))).status,409);
  response=await run(db,3)(request('branchId=3'));assert.equal(response.status,200);assert.deepEqual((await response.json()).data.cases,[]);
  assert.equal((await run(db,3)(request('branchId=2'))).status,403);
}));

test('OPERATIONS-04 branch role is authoritative and role/query spoofing is denied',()=>check(async db=>{
  db.db.exec("UPDATE tamiran_users SET role_code='repair_manager' WHERE id=4");
  let response=await run(db,4)(request());assert.equal(response.status,200);assert.deepEqual((await response.json()).data.cases,[]);
  for(const query of['branchId=1&role=repair_manager','branchId=1&shopId=2','branchId=1&branchId=1','action=case_list&branchId=1'])assert.equal((await run(db,4)(request(query))).status,query.startsWith('action=')?503:400);
}));

test('OPERATIONS-05 anonymous, unbound and revoked identities fail closed',async()=>{
  await check(async db=>assert.equal((await run(db,null)(request())).status,401));
  await check(async db=>assert.equal((await run(db,3,{getUser:async()=>actor(99)})(request())).status,403));
  for(const sql of["UPDATE tamiran_users SET is_active=0 WHERE id=3","UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=3","UPDATE repair_branches SET is_active=0 WHERE id=1","UPDATE repair_shops SET license_expires_at='2026-10-09' WHERE id=1"])
    await check(async db=>{db.db.exec(sql);assert.equal((await run(db,3)(request())).status,403)});
});

test('OPERATIONS-06 missing draft key and unported inventory modes never return partial success',()=>check(async db=>{
  assert.equal((await run(db,3,{getKey:async()=>null})(request())).status,503);
  assert.equal((await run(db,4,{getKey:async()=>null})(request())).status,200);
  db.db.exec("UPDATE repair_shops SET inventory_mode='simple' WHERE id=1");
  for(const id of[2,3,4,5,6,7])assert.equal((await run(db,id)(request())).status,503);
}));

test('OPERATIONS-07 membership revocation after scope resolution is rechecked by case repository',()=>check(async db=>{
  const base=db.prepare.bind(db);let revoked=false;
  db.prepare=sql=>{const statement=base(sql);if(!revoked&&sql.includes('SELECT c.id,c.public_id AS publicId')){revoked=true;db.db.exec('UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=4')}return statement};
  const response=await run(db,4)(request());assert.equal(response.status,403);
}));

test('OPERATIONS-08 malformed branch and methods fail without leaking errors or writing',()=>check(async db=>{
  const before=state(db);
  for(const query of['branchId=0','branchId=1.5','branchId=9007199254740992','branchId='])assert.equal((await run(db,3)(request(query))).status,400);
  const response=await run(db,3)(new Request('https://test.invalid/api/operations.php',{method:'DELETE'}));assert.equal(response.status,405);assert.equal(state(db),before);
}));
