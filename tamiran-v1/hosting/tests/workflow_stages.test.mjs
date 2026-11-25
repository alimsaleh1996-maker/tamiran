import assert from 'node:assert/strict';
import {test} from 'node:test';
import {repairStages,stageForStatus,initialStageForStatuses} from '../frontend/src/app/tamiran/workflow-stages.ts';
test('all server workflow statuses belong to exactly one visible stage',()=>{
 const statuses=['reception','awaiting_assignment','assigned','diagnosing','estimate_pending','awaiting_customer_approval','awaiting_parts','repairing','parts_closeout','qc_pending','qc_rework','qc_conditional','finance_pending','ready_for_delivery','returned_unrepaired','delivered','cancelled','closed'];
 for(const status of statuses)assert.equal(repairStages.filter(s=>s.statuses.includes(status)).length,1,status);
 assert.equal(stageForStatus('future_server_status'),'other');
});
test('initial stage follows workflow order regardless of server sort and keeps unknown/archived cases reachable',()=>{
 assert.equal(initialStageForStatuses(['delivered','repairing','assigned','awaiting_assignment']),'assignment');
 assert.equal(initialStageForStatuses(['closed','estimate_pending','diagnosing']),'diagnosis');
 assert.equal(initialStageForStatuses(['delivered']),'closed');
 assert.equal(initialStageForStatuses(['future_server_status']),'other');
 assert.equal(initialStageForStatuses([]),'assigned');
});
