import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workflowMaps, planTransition, roleTargets, legacyStatus, holdReason, WorkflowError } from '../lib/workflow.ts';
import { migrationApiGate } from '../lib/api-gate.ts';
let passed = 0;
function test(name, f) { f(); passed++; console.log('PASS '+name); }
function base() {
  return { scope:{shopId:1,branchId:1,actorId:2,role:'repair_manager',permissions:[]},
    row:{shopId:1,branchId:1,workflowCode:'mobile_tablet',status:'assigned',lockVersion:3,lockedAt:null,primaryTechnicianId:2,preapprovedAmount:100,waitStartedAt:null},
    policy:{profile:'pro',inventoryPro:false,qcEnabled:true,assignmentRequired:true},
    facts:{primaryTechnicianActiveInBranch:true,collaboratorIds:[],latestEstimate:null,partsBlockers:[],qcBlockers:[],financeBlockers:[],terminalFinanceBlockers:[],existingTarget:null},
    target:'diagnosing',reason:null,expectedVersion:3,idempotencyKey:'TEST-transition-001',now:'2026-10-10 00:00:00'};
}
function denied(change, status=409) { const i=base(); change(i); assert.throws(()=>planTransition(i),e=>e instanceof WorkflowError&&e.status===status); }
// Extract the actual PHP arrays; do not compare to another handwritten map.
const php = readFileSync(new URL('../baseline/private/v2-core.php',import.meta.url),'utf8');
const start = php.indexOf("if($profile==='solo')", php.indexOf('function v2_workflow_maps'));
const end = php.indexOf("return['mobile_tablet'",start);
const branches = php.slice(start,end).split('}else{');
function extractMap(source, inventoryPro, qcEnabled) {
  const map={};
  const re=/'([a-z_]+)'\s*=>\s*(array_values\(array_unique\(\[.*?\]\)\)|\[[^\]]*\])/gs;
  for(const match of source.matchAll(re)) {
    const value=match[2];
    const tokens=value.slice(value.indexOf('[')+1,value.lastIndexOf(']')).split(',').map(x=>x.trim());
    map[match[1]]=tokens.filter(Boolean).map(t=>t==='$afterRepair'?(inventoryPro?'parts_closeout':qcEnabled?'qc_pending':'finance_pending'):t==='$afterParts'?(qcEnabled?'qc_pending':'finance_pending'):t.slice(1,-1));
  }
  return map;
}
for(const profile of ['solo','pro']) for(const inventoryPro of [false,true]) for(const qcEnabled of [false,true]) {
  const policy={profile,inventoryPro,qcEnabled,assignmentRequired:profile==='pro'};
  const expected=extractMap(branches[profile==='solo'?0:1],inventoryPro,qcEnabled);
  test(`PHP parity ${profile}/inventory=${inventoryPro}/QC=${qcEnabled}`,()=>{
    assert.equal(Object.keys(expected).length,18);
    assert.deepEqual(workflowMaps(policy).mobile_tablet,expected);
    assert.deepEqual(workflowMaps(policy).computer_laptop,expected);
  });
}
test('valid transition increments version once',()=>assert.equal(planTransition(base()).nextVersion,4));
test('wrong shop rejected',()=>denied(i=>i.scope.shopId=2,403));
test('wrong branch rejected',()=>denied(i=>i.scope.branchId=2,403));
test('missing actor rejected',()=>denied(i=>i.scope.actorId=0,403));
test('stale version rejected',()=>denied(i=>i.expectedVersion=2));
test('fractional version rejected',()=>denied(i=>i.expectedVersion=2.5,400));
test('empty retry key rejected',()=>denied(i=>i.idempotencyKey='',400));
test('oversized retry key rejected',()=>denied(i=>i.idempotencyKey='x'.repeat(161),400));
test('closed case rejected',()=>denied(i=>i.row.lockedAt=i.now));
for(const state of ['cancelled','closed','returned_unrepaired']) test('terminal '+state,()=>denied(i=>i.row.status=state));
test('illegal stage jump rejected',()=>denied(i=>i.target='ready_for_delivery'));
test('unknown industry rejected',()=>denied(i=>i.row.workflowCode='unknown'));
test('reception cannot diagnose',()=>denied(i=>i.scope.role='reception',403));
test('customer cannot transition',()=>denied(i=>i.scope.role='customer',403));
test('unassigned technician rejected',()=>denied(i=>{i.scope.role='technician';i.scope.actorId=7;},403));
test('assigned technician can diagnose',()=>{const i=base();i.scope.role='technician';assert.equal(planTransition(i).target,'diagnosing');});
test('active collaborator can diagnose',()=>{const i=base();i.scope.role='technician';i.scope.actorId=7;i.facts.collaboratorIds=[7];assert.equal(planTransition(i).target,'diagnosing');});
test('inactive primary technician rejected',()=>denied(i=>i.facts.primaryTechnicianActiveInBranch=false));
test('Pro requires primary technician',()=>denied(i=>i.row.primaryTechnicianId=null));
test('Solo follows original non-assignment policy',()=>{const i=base();i.policy.profile='solo';i.policy.assignmentRequired=false;i.row.primaryTechnicianId=null;assert.equal(planTransition(i).target,'diagnosing');});
test('terminal reason required',()=>denied(i=>i.target='cancelled',400));
test('terminal reason locks case',()=>{const i=base();i.target='cancelled';i.reason='آزمایشی';assert.equal(planTransition(i).lockedAt,i.now);});
test('terminal finance unresolved blocks closure',()=>denied(i=>{i.target='cancelled';i.reason='آزمایشی';i.facts.terminalFinanceBlockers=['open'];}));
test('unapproved estimate above reception limit blocks repair',()=>denied(i=>{i.row.status='diagnosing';i.target='repairing';i.facts.latestEstimate={totalAmount:101,status:'sent'};}));
test('approved estimate permits repair',()=>{const i=base();i.row.status='diagnosing';i.target='repairing';i.facts.latestEstimate={totalAmount:101,status:'approved'};assert.equal(planTransition(i).target,'repairing');});
test('equal estimate is within reception limit',()=>{const i=base();i.row.status='diagnosing';i.target='repairing';i.facts.latestEstimate={totalAmount:100,status:'draft'};assert.equal(planTransition(i).target,'repairing');});
test('unresolved parts block QC',()=>denied(i=>{i.row.status='parts_closeout';i.policy.inventoryPro=true;i.target='qc_pending';i.facts.partsBlockers=['hot return'];}));
test('failed QC blocks finance',()=>denied(i=>{i.row.status='qc_pending';i.target='finance_pending';i.facts.qcBlockers=['failed'];}));
test('finance outstanding blocks readiness',()=>denied(i=>{i.row.status='finance_pending';i.target='ready_for_delivery';i.facts.financeBlockers=['debt'];}));
test('settled finance permits readiness',()=>{const i=base();i.row.status='finance_pending';i.target='ready_for_delivery';i.scope.role='finance_cashier';assert.equal(planTransition(i).target,'ready_for_delivery');});
test('same retry key is read-only replay',()=>{const i=base();i.facts.existingTarget='diagnosing';i.expectedVersion=1;assert.deepEqual(planTransition(i),{replay:true,target:'diagnosing',idempotencyKey:i.idempotencyKey});});
test('retry key cannot be reused for different target',()=>denied(i=>i.facts.existingTarget='repairing'));
test('retry does not bypass role authorization',()=>denied(i=>{i.facts.existingTarget='diagnosing';i.scope.role='customer';},403));
test('missing blocker facts fail closed',()=>denied(i=>i.facts.qcBlockers=undefined,503));
test('customer wait is preserved',()=>{const i=base();i.row.status='estimate_pending';i.target='awaiting_customer_approval';assert.equal(planTransition(i).waitReason,'customer');assert.equal(planTransition(i).waitStartedAt,i.now);});
test('leaving wait calculates elapsed seconds',()=>{const i=base();i.row.status='awaiting_parts';i.row.waitStartedAt='2026-10-09 23:59:00';i.target='repairing';assert.equal(planTransition(i).externalWaitIncrement,60);});
test('invalid clock rejected',()=>denied(i=>i.now='bad',400));
test('delivered does not regress legacy status',()=>assert.equal(legacyStatus('closed'),'delivered'));
test('QC hold remains other for legacy storage',()=>assert.equal(holdReason('qc_pending'),'qc'));
// Network-free request-handler checks. These are not deployed browser E2E.
const req=(method='GET',extra={})=>new Request('https://test.example/api/operations.php',{method,headers:extra});
test('API rejects anonymous service access',()=>assert.equal(migrationApiGate(req()).status,401));
test('API rejects query-string role spoofing',()=>assert.equal(migrationApiGate(new Request('https://test.example/api/auth.php?testRole=repair_manager',{headers:{'oai-authenticated-user-id':'test'}})).status,403));
test('API rejects cross-origin write',()=>assert.equal(migrationApiGate(req('POST',{'oai-authenticated-user-id':'test',Origin:'https://evil.example'})).status,403));
test('unported GET returns 503 not fake success',()=>assert.equal(migrationApiGate(req('GET',{'oai-authenticated-user-id':'test'})).status,503));
test('unported POST does not save data',()=>assert.equal(migrationApiGate(req('POST',{'oai-authenticated-user-id':'test',Origin:'https://test.example'})).status,503));
test('unported response cannot be cached',()=>assert.equal(migrationApiGate(req()).headers.get('Cache-Control'),'no-store'));
console.log(`SUMMARY ${passed}/${passed} unit/parity/security tests passed. Database transactions, browser, SMS, print and E2E NOT covered.`);
