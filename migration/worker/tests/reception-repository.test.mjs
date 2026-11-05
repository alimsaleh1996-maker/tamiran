import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveServerScope, ScopeError } from '../lib/server-scope.ts';
import { createReceptionForExistingDevice, ReceptionError } from '../lib/reception-repository.ts';

const root=resolve(import.meta.dirname,'..');
const migrationSql=readdirSync(resolve(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort()
  .map(x=>readFileSync(resolve(root,'drizzle',x),'utf8')).join('\n');
const fixtures=['d1-identity.sql','d1-case-core.sql'].map(x=>readFileSync(resolve(root,'tests/fixtures',x),'utf8')).join('\n');

class Statement {
  constructor(owner,sql){this.owner=owner;this.sql=sql;this.values=[];}
  bind(...values){this.values=values;return this;}
  async first(){return this.owner.db.prepare(this.sql).get(...this.values)??null;}
  async all(){return {results:this.owner.db.prepare(this.sql).all(...this.values)};}
  async run(){
    if(this.owner.failPattern?.test(this.sql))throw new Error('TEST-TAMIRAN-1010C injected batch failure');
    return this.owner.db.prepare(this.sql).run(...this.values);
  }
}
class LocalD1 {
  constructor(failPattern=null){
    this.db=new DatabaseSync(':memory:');this.failPattern=failPattern;
    this.db.exec('PRAGMA foreign_keys=ON;');this.db.exec(migrationSql);this.db.exec(fixtures);
  }
  prepare(sql){return new Statement(this,sql);}
  async batch(statements){
    this.db.exec('BEGIN IMMEDIATE');
    try {const results=[];for(const statement of statements)results.push(await statement.run());this.db.exec('COMMIT');return results;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  close(){this.db.close();}
}

const user=id=>({userId:id,email:`${id}@invalid.example`,displayName:'آزمایشی',fullName:null});
const baseInput=()=>({
  customerId:1,deviceId:1,declaredIssue:'آزمایشی — خاموش می‌شود',accessories:['آزمایشی — کابل'],appearanceStates:['آزمایشی — خط سطحی'],
  receptionNotes:'آزمایشی — فقط تست محلی',idempotencyKey:'TEST-TAMIRAN-1010C-RECEPTION-1',
  publicId:'TEST-TAMIRAN-1010C-CASE',caseUuid:'00000000-0000-4000-8000-000000000103',
  workflowPublicId:'TEST-TAMIRAN-1010C-WORK',stageEventPublicId:'TEST-TAMIRAN-1010C-STAGE',auditPublicId:'TEST-TAMIRAN-1010C-AUDIT',
  trackingTokenHash:'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',trackingTokenCiphertext:'TEST-NOT-A-REAL-TOKEN-C',
  requestId:'TEST-TAMIRAN-1010C-REQUEST',ipAddress:'192.0.2.103',userAgent:'TEST-TAMIRAN-1010C',now:'2026-10-10 01:00:00',
});
async function scope(db,account='TEST-TAMIRAN-1010A-account3',branchId=1){return resolveServerScope(db,user(account),{branchId,today:'2026-10-10'});}
function counts(db){return Object.fromEntries(['repair_cases','repair_case_workflows','repair_case_stage_events','repair_case_events','tamiran_audit_log'].map(table=>[table,db.db.prepare(`SELECT count(*) n FROM ${table}`).get().n]));}

test('D1-RECEPTION-01: signed-in identity resolves authoritative branch role and policy',async()=>{
  const db=new LocalD1();try{const actual=await scope(db);assert.equal(actual.userId,3);assert.equal(actual.role,'reception');assert.equal(actual.shopId,1);assert.equal(actual.branchId,1);assert.equal(actual.productProfile,'pro');}finally{db.close();}
});
test('D1-RECEPTION-02: anonymous and cross-shop branch selection are denied',async()=>{
  const db=new LocalD1();try{
    await assert.rejects(resolveServerScope(db,null,{branchId:1,today:'2026-10-10'}),e=>e instanceof ScopeError&&e.status===401);
    await assert.rejects(scope(db,'TEST-TAMIRAN-1010A-account3',2),e=>e instanceof ScopeError&&e.status===403);
  }finally{db.close();}
});
test('D1-RECEPTION-03: valid reception creates one complete graph and advances receipt once',async()=>{
  const db=new LocalD1();try{
    const result=await createReceptionForExistingDevice(db,await scope(db),baseInput());
    assert.deepEqual(result,{created:true,replayed:false,caseId:3,publicId:'TEST-TAMIRAN-1010C-CASE',receiptNumber:'T1010A-000002',status:'awaiting_assignment'});
    assert.deepEqual(counts(db),{repair_cases:3,repair_case_workflows:3,repair_case_stage_events:2,repair_case_events:2,tamiran_audit_log:2});
    assert.equal(db.db.prepare('SELECT last_number FROM repair_receipt_sequences WHERE shop_id=1').get().last_number,2);
    assert.equal(db.db.prepare("SELECT count(*) n FROM repair_case_workflows w JOIN repair_cases c ON c.id=w.case_id WHERE c.public_id='TEST-TAMIRAN-1010C-CASE'").get().n,1);
  }finally{db.close();}
});
test('D1-RECEPTION-04: double-click is a read-only replay',async()=>{
  const db=new LocalD1();try{
    const actor=await scope(db),input=baseInput();await createReceptionForExistingDevice(db,actor,input);
    const before=counts(db);const replayed=await createReceptionForExistingDevice(db,actor,input);
    assert.equal(replayed.replayed,true);assert.equal(replayed.created,false);assert.deepEqual(counts(db),before);
    assert.equal(db.db.prepare('SELECT last_number FROM repair_receipt_sequences WHERE shop_id=1').get().last_number,2);
  }finally{db.close();}
});
test('D1-RECEPTION-05: retry key cannot replay a different payload',async()=>{
  const db=new LocalD1();try{
    const actor=await scope(db),input=baseInput();await createReceptionForExistingDevice(db,actor,input);
    await assert.rejects(createReceptionForExistingDevice(db,actor,{...input,declaredIssue:'آزمایشی — درخواست متفاوت'}),e=>e instanceof ReceptionError&&e.status===409);
  }finally{db.close();}
});
test('D1-RECEPTION-06: technician role and cross-shop device are denied',async()=>{
  const db=new LocalD1();try{
    const tech=await scope(db,'TEST-TAMIRAN-1010A-account4');
    await assert.rejects(createReceptionForExistingDevice(db,tech,baseInput()),e=>e instanceof ReceptionError&&e.status===403);
    await assert.rejects(createReceptionForExistingDevice(db,await scope(db),{...baseInput(),deviceId:2}),e=>e instanceof ReceptionError&&e.status===409);
  }finally{db.close();}
});
test('D1-RECEPTION-07: stale membership fails inside the atomic batch with no receipt gap',async()=>{
  const db=new LocalD1();try{
    const actor=await scope(db);db.db.exec('UPDATE tamiran_user_branches SET is_active=0 WHERE user_id=3 AND branch_id=1');
    const before=counts(db);
    await assert.rejects(createReceptionForExistingDevice(db,actor,baseInput()),/JSON path|bad JSON path|path error/i);
    assert.deepEqual(counts(db),before);assert.equal(db.db.prepare('SELECT last_number FROM repair_receipt_sequences WHERE shop_id=1').get().last_number,1);
  }finally{db.close();}
});
test('D1-RECEPTION-08: downstream failure rolls back case graph and receipt allocation',async()=>{
  const db=new LocalD1(/INSERT INTO repair_case_workflows/);try{
    const before=counts(db);await assert.rejects(createReceptionForExistingDevice(db,await scope(db),baseInput()),/injected batch failure/);
    assert.deepEqual(counts(db),before);assert.equal(db.db.prepare('SELECT last_number FROM repair_receipt_sequences WHERE shop_id=1').get().last_number,1);
  }finally{db.close();}
});
