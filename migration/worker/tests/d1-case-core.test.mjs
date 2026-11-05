import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const migrations=readdirSync(resolve(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort();
const migrationSql=migrations.map(x=>readFileSync(resolve(root,'drizzle',x),'utf8')).join('\n');
const identitySeed=readFileSync(resolve(root,'tests/fixtures/d1-identity.sql'),'utf8');
const caseSeed=readFileSync(resolve(root,'tests/fixtures/d1-case-core.sql'),'utf8');
const phase2Tables=[
  'repair_device_types','repair_device_brands','repair_device_models','repair_receipt_sequences',
  'repair_customer_devices','repair_cases','repair_case_events','tamiran_audit_log',
  'repair_case_workflows','repair_case_stage_events',
];
const caseInsert=`INSERT INTO repair_cases(public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,public_receipt_no,receipt_number,tracking_token_hash,tracking_token_ciphertext,product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,feature_flags_snapshot_json,idempotency_key,device_type_snapshot,brand_snapshot,model_snapshot,declared_issue,accessories_json,appearance_states_json,created_by_user_id)`;

function database() {
  const db=new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  db.exec(migrationSql);
  db.exec(identitySeed);
  db.exec(caseSeed);
  return db;
}
function scenario(name,fn) {
  test(name,()=>{const db=database();try{fn(db);}finally{db.close();}});
}
function rejected(db,sql,pattern=/constraint|immutable|scope|decrease/i) {
  assert.throws(()=>db.exec(sql),pattern);
}

test('D1-CASE-01: phase 2 migration is schema-only and preserves frozen columns',()=>{
  assert(!/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|SET)\b/i.test(migrationSql));
  const legacy=readFileSync(resolve(root,'baseline/database/schema.sql'),'utf8');
  const db=database();
  try {
    for(const table of phase2Tables) {
      const body=legacy.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+' \\(([\\s\\S]*?)\\) ENGINE='))[1];
      const expected=[...body.trimStart().matchAll(/(?:^|,\s*)(\w+)\s+(?:BIGINT|SMALLINT|INT|TINYINT|VARCHAR|CHAR|ENUM|JSON|TEXT|DATETIME|DATE)\b/g)].map(x=>x[1]);
      const actual=db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name);
      assert.deepEqual(actual.filter(c=>!(table==='repair_customer_devices'&&c==='lock_version')&&!(table==='repair_cases'&&c==='reception_request_hash')),expected,table);
    }
  } finally {db.close();}
});
scenario('D1-CASE-02: valid synthetic case graph has no orphan foreign keys',db=>{
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert.equal(db.prepare('SELECT count(*) n FROM repair_cases').get().n,2);
  assert.equal(db.prepare('SELECT count(*) n FROM repair_case_workflows').get().n,2);
});
scenario('D1-CASE-03: customer device cannot cross customer shop scope',db=>{
  rejected(db,`INSERT INTO repair_customer_devices(public_id,shop_id,customer_id,device_type_title,brand_title,model_title,ownership_verification_json,details_json)
    VALUES('TEST-TAMIRAN-1010B-XDEV',1,2,'آزمایشی','آزمایشی','آزمایشی','{}','{}')`,/FOREIGN KEY constraint/);
});
scenario('D1-CASE-04: catalog model cannot cross shop boundary',db=>{
  rejected(db,"UPDATE repair_customer_devices SET device_model_id=2 WHERE id=1",/outside shop scope/);
});
scenario('D1-CASE-05: case branch, customer and device are all shop-scoped',db=>{
  for(const [column,value] of [['branch_id',2],['customer_id',2],['device_id',2]]) {
    rejected(db,`UPDATE repair_cases SET ${column}=${value} WHERE id=1`,/FOREIGN KEY constraint/);
  }
});
scenario('D1-CASE-06: case creator, assignee and deliverer cannot cross shop',db=>{
  for(const column of ['created_by_user_id','assigned_to_user_id','delivered_by_user_id']) {
    rejected(db,`UPDATE repair_cases SET ${column}=8 WHERE id=1`,/FOREIGN KEY constraint/);
  }
});
scenario('D1-CASE-07: receipt sequence and idempotency are unique per shop',db=>{
  rejected(db,caseInsert+` SELECT 'TEST-TAMIRAN-1010B-DUP1','00000000-0000-4000-8000-000000000011',shop_id,branch_id,customer_id,device_id,receipt_sequence,'T1010A-000011','T1010A-000011','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','X',product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,'{}','TEST-TAMIRAN-1010B-NEW',device_type_snapshot,brand_snapshot,model_snapshot,declared_issue,'[]','[]',created_by_user_id FROM repair_cases WHERE id=1`,/UNIQUE constraint/);
  rejected(db,caseInsert+` SELECT 'TEST-TAMIRAN-1010B-DUP2','00000000-0000-4000-8000-000000000012',shop_id,branch_id,customer_id,device_id,12,'T1010A-000012','T1010A-000012','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','X',product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,'{}',idempotency_key,device_type_snapshot,brand_snapshot,model_snapshot,declared_issue,'[]','[]',created_by_user_id FROM repair_cases WHERE id=1`,/UNIQUE constraint/);
});
scenario('D1-CASE-08: public receipt, UUID and tracking hash are globally unique',db=>{
  const defaults={
    public_receipt_no:'T1010B-000090',receipt_number:'T1010B-000090',
    case_uuid:'00000000-0000-4000-8000-000000000090',
    tracking_token_hash:'9999999999999999999999999999999999999999999999999999999999999999',
  };
  for(const [column,duplicate] of [['public_receipt_no','T1010A-000001'],['receipt_number','T1010A-000001'],['case_uuid','00000000-0000-4000-8000-000000000001'],['tracking_token_hash','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']]) {
    const values={...defaults,[column]:duplicate};
    rejected(db,caseInsert+` SELECT 'TEST-TAMIRAN-1010B-GLOBAL','${values.case_uuid}',shop_id,branch_id,customer_id,device_id,90,'${values.public_receipt_no}','${values.receipt_number}','${values.tracking_token_hash}','X',product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,'{}','TEST-TAMIRAN-1010B-GLOBAL',device_type_snapshot,brand_snapshot,model_snapshot,declared_issue,'[]','[]',created_by_user_id FROM repair_cases WHERE id=2`,/UNIQUE constraint/);
  }
});
scenario('D1-CASE-09: receipt identity and shop public code cannot be rewritten',db=>{
  for(const column of ['case_uuid','receipt_sequence','public_receipt_no','receipt_number','tracking_token_hash','tracking_token_ciphertext']) {
    rejected(db,`UPDATE repair_cases SET ${column}=${column}||'X' WHERE id=1`,/immutable/);
  }
  rejected(db,"UPDATE repair_shops SET public_shop_code='ALTERED' WHERE id=1",/immutable/);
});
scenario('D1-CASE-10: receipt sequence cannot decrease',db=>{
  rejected(db,'UPDATE repair_receipt_sequences SET last_number=0 WHERE shop_id=1',/cannot decrease/);
  db.exec('UPDATE repair_receipt_sequences SET last_number=2 WHERE shop_id=1');
  assert.equal(db.prepare('SELECT last_number FROM repair_receipt_sequences WHERE shop_id=1').get().last_number,2);
});
scenario('D1-CASE-11: workflow case, branch and technician stay inside shop',db=>{
  rejected(db,'UPDATE repair_case_workflows SET shop_id=2 WHERE id=1',/FOREIGN KEY constraint/);
  rejected(db,'UPDATE repair_case_workflows SET branch_id=2 WHERE id=1',/FOREIGN KEY constraint/);
  rejected(db,'UPDATE repair_case_workflows SET primary_technician_user_id=8 WHERE id=1',/FOREIGN KEY constraint/);
});
scenario('D1-CASE-12: linked parent case cannot cross shop',db=>{
  rejected(db,"UPDATE repair_case_workflows SET case_kind='correction',parent_case_id=2 WHERE id=1",/outside shop scope/);
});
scenario('D1-CASE-13: event actors cannot cross shop and evidence rows are immutable',db=>{
  rejected(db,"INSERT INTO repair_case_events(case_id,actor_user_id,event_type,description,metadata_json) VALUES(1,8,'bad','آزمایشی','{}')",/outside shop scope/);
  rejected(db,"INSERT INTO repair_case_stage_events(public_id,workflow_id,to_status,actor_user_id,metadata_json,idempotency_key,started_at) VALUES('TEST-TAMIRAN-1010B-BAD',1,'reception',8,'{}','TEST-TAMIRAN-1010B-BAD','2026-10-10')",/outside shop scope/);
  rejected(db,"UPDATE repair_case_events SET description='altered' WHERE id=1",/immutable/);
  rejected(db,'DELETE FROM repair_case_stage_events WHERE id=1',/immutable/);
});
scenario('D1-CASE-14: audit actor and branch remain scoped and audit is append-only',db=>{
  rejected(db,"INSERT INTO tamiran_audit_log(public_id,shop_id,branch_id,actor_user_id,action_code,entity_type,entity_public_id,request_id,ip_address) VALUES('TEST-TAMIRAN-1010B-BAD',1,1,8,'bad','case','x','x','192.0.2.2')",/FOREIGN KEY constraint/);
  rejected(db,"UPDATE tamiran_audit_log SET action_code='altered' WHERE id=1",/immutable/);
  rejected(db,'DELETE FROM tamiran_audit_log WHERE id=1',/immutable/);
});
scenario('D1-CASE-15: nullable audit snapshots and valid JSON are both supported',db=>{
  const row=db.prepare('SELECT before_json,after_json FROM tamiran_audit_log WHERE id=1').get();
  assert.equal(row.before_json,null);assert.equal(row.after_json,'{}');
  rejected(db,"INSERT INTO tamiran_audit_log(public_id,shop_id,actor_user_id,action_code,entity_type,entity_public_id,before_json,request_id,ip_address) VALUES('TEST-TAMIRAN-1010B-JSON',1,3,'bad','case','x','bad','x','192.0.2.3')",/CHECK constraint/);
});
scenario('D1-CASE-16: enum, JSON and nonnegative integer checks reject corrupt case facts',db=>{
  for(const statement of [
    "UPDATE repair_cases SET product_profile_snapshot='unknown' WHERE id=1",
    "UPDATE repair_cases SET accessories_json='bad' WHERE id=1",
    'UPDATE repair_cases SET delivery_amount=-1 WHERE id=1',
    "UPDATE repair_case_workflows SET process_status='unknown' WHERE id=1",
  ]) rejected(db,statement,/CHECK constraint/);
});
scenario('D1-CASE-17: workflow retry key is unique and cannot represent a different event',db=>{
  rejected(db,"INSERT INTO repair_case_stage_events(public_id,workflow_id,to_status,actor_user_id,metadata_json,idempotency_key,started_at) VALUES('TEST-TAMIRAN-1010B-DUP',1,'diagnosing',4,'{}','TEST-TAMIRAN-1010B-STAGE-1','2026-10-10')",/UNIQUE constraint/);
});
scenario('D1-CASE-18: failed reception graph transaction leaves no case, workflow, event, audit or counter increment',db=>{
  const before={
    cases:db.prepare('SELECT count(*) n FROM repair_cases').get().n,
    workflows:db.prepare('SELECT count(*) n FROM repair_case_workflows').get().n,
    events:db.prepare('SELECT count(*) n FROM repair_case_events').get().n,
    audit:db.prepare('SELECT count(*) n FROM tamiran_audit_log').get().n,
    sequence:db.prepare('SELECT last_number n FROM repair_receipt_sequences WHERE shop_id=1').get().n,
  };
  db.exec('BEGIN');
  try {
    db.exec('UPDATE repair_receipt_sequences SET last_number=last_number+1 WHERE shop_id=1');
    db.exec(`INSERT INTO repair_cases(public_id,case_uuid,shop_id,branch_id,customer_id,device_id,receipt_sequence,public_receipt_no,receipt_number,tracking_token_hash,tracking_token_ciphertext,product_profile_snapshot,inventory_mode_snapshot,qc_mode_snapshot,feature_flags_snapshot_json,idempotency_key,device_type_snapshot,brand_snapshot,model_snapshot,declared_issue,accessories_json,appearance_states_json,created_by_user_id)
      VALUES('TEST-TAMIRAN-1010B-ROLL','00000000-0000-4000-8000-000000000099',1,1,1,1,2,'T1010A-000002','T1010A-000002','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','X','pro','off','off','{}','TEST-TAMIRAN-1010B-ROLL','آزمایشی','آزمایشی','آزمایشی','آزمایشی','[]','[]',3)`);
    rejected(db,"INSERT INTO repair_case_workflows(public_id,shop_id,branch_id,case_id,workflow_code,diagnostic_fee_policy_json,customer_consent_json,primary_technician_user_id) VALUES('TEST-TAMIRAN-1010B-ROLL',1,1,3,'mobile_tablet','{}','{}',8)",/FOREIGN KEY constraint/);
  } finally {db.exec('ROLLBACK');}
  assert.deepEqual({
    cases:db.prepare('SELECT count(*) n FROM repair_cases').get().n,
    workflows:db.prepare('SELECT count(*) n FROM repair_case_workflows').get().n,
    events:db.prepare('SELECT count(*) n FROM repair_case_events').get().n,
    audit:db.prepare('SELECT count(*) n FROM tamiran_audit_log').get().n,
    sequence:db.prepare('SELECT last_number n FROM repair_receipt_sequences WHERE shop_id=1').get().n,
  },before);
});
