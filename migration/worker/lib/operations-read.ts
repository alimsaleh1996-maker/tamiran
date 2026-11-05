import {listReceptionDrafts} from './reception-drafts.ts';
import {ReceptionError} from './reception-repository.ts';
import {utcDate} from './reception-terms.ts';
import {ScopeError,type D1Like,type ServerScope} from './server-scope.ts';

type CaseRow={
  id:number;publicId:string;caseUuid:string;receiptNumber:string;receiptSequence:number;branchCode:string;
  customerId:number;customerName:string;customerMobile:string;secondaryMobile:string|null;nationalCode:string|null;
  customerProvince:string|null;customerCity:string|null;customerAddress:string|null;customerPostalCode:string|null;
  deviceId:number;deviceType:string;brand:string;model:string;identifier:string|null;color:string|null;
  declaredIssue:string;accessoriesJson:string;appearanceStatesJson:string;receptionNotes:string|null;status:string;
  result:string|null;operationReport:string|null;deliveryAmount:number;deliveredToName:string|null;deliveryNotes:string|null;
  assignedToUserId:number|null;assignedToName:string|null;createdByName:string;createdAt:string;updatedAt:string;
  deliveredAt:string|null;deliveredByName:string|null;promisedAt:string|null;customerConsentJson:string|null;rowVersion:number;
};
type EventRow={id:number;caseId:number;eventType:string;fromStatus:string|null;toStatus:string|null;description:string;actorName:string;createdAt:string};
const piiRoles=new Set(['repair_manager','reception']);
const assignedRoles=new Set(['technician','quality_control']);
function array(value:string){try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}}
function consent(value:string|null){try{const parsed:unknown=JSON.parse(value??'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){const mode=(parsed as Record<string,unknown>).dataHandling;if(['no_erasure','coordinate_first','erase_authorized'].includes(String(mode)))return String(mode)}}catch{}return'no_erasure'}
function chunks<T>(items:T[],size:number){const result:T[][]=[];for(let i=0;i<items.length;i+=size)result.push(items.slice(i,i+size));return result}

async function assertFreshScope(db:D1Like,scope:ServerScope,now:string){
  const row=await db.prepare(`SELECT 1 AS ok FROM tamiran_users u
    JOIN repair_shops s ON s.id=u.shop_id
    JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
    JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id
    WHERE u.id=? AND u.account_user_id=? AND u.shop_id=? AND b.id=? AND ub.branch_role_code=?
      AND u.is_active=1 AND ub.is_active=1 AND b.is_active=1 AND s.lifecycle_status='active'
      AND s.license_started_at<=? AND s.license_expires_at>=? LIMIT 1`)
    .bind(scope.userId,scope.accountUserId,scope.shopId,scope.branchId,scope.role,now.slice(0,10),now.slice(0,10)).first();
  if(!row)throw new ScopeError('حساب فعال و مجاز برای این شعبه پیدا نشد.',403);
}

async function eventsFor(db:D1Like,scope:ServerScope,caseIds:number[]){
  const grouped=new Map<number,EventRow[]>();
  // D1 has a bounded bind-parameter budget. Forty case IDs keep each query below 100 bindings.
  for(const ids of chunks(caseIds,40)){
    const marks=ids.map(()=>'?').join(',');
    const rows=(await db.prepare(`SELECT e.id AS id,e.case_id AS caseId,e.event_type AS eventType,
        e.from_status AS fromStatus,e.to_status AS toStatus,e.description,u.display_name AS actorName,e.created_at AS createdAt
      FROM repair_case_events e JOIN repair_cases c ON c.id=e.case_id
      JOIN tamiran_users u ON u.id=e.actor_user_id
      WHERE c.shop_id=? AND c.branch_id=? AND e.case_id IN (${marks})
      UNION ALL
      SELECT -stage.id AS id,w.case_id AS caseId,'workflow_transition' AS eventType,
        NULL AS fromStatus,NULL AS toStatus,COALESCE(NULLIF(stage.reason,''),'مرحله پرونده تغییر کرد.') AS description,
        u.display_name AS actorName,stage.created_at AS createdAt
      FROM repair_case_stage_events stage JOIN repair_case_workflows w ON w.id=stage.workflow_id
      JOIN tamiran_users u ON u.id=stage.actor_user_id
      WHERE w.shop_id=? AND w.branch_id=? AND w.case_id IN (${marks})
      ORDER BY createdAt DESC,id DESC`)
      .bind(scope.shopId,scope.branchId,...ids,scope.shopId,scope.branchId,...ids).all<EventRow>()).results;
    for(const row of rows){const list=grouped.get(row.caseId)??[];list.push(row);grouped.set(row.caseId,list)}
  }
  return grouped;
}

export async function listOperationalCases(db:D1Like,scope:ServerScope,now:string,onlyCaseId?:number){
  utcDate(now);await assertFreshScope(db,scope,now);
  if(onlyCaseId!==undefined&&(!Number.isSafeInteger(onlyCaseId)||onlyCaseId<1))throw new ScopeError('شناسه پرونده معتبر نیست.',400);
  if(scope.role==='warehouse_keeper')return[];
  const assigned=assignedRoles.has(scope.role);
  const rows=(await db.prepare(`SELECT c.id,c.public_id AS publicId,c.case_uuid AS caseUuid,c.receipt_number AS receiptNumber,
      c.receipt_sequence AS receiptSequence,b.branch_code AS branchCode,c.customer_id AS customerId,
      customer.full_name AS customerName,customer.mobile AS customerMobile,customer.secondary_mobile AS secondaryMobile,
      customer.national_code AS nationalCode,customer.province AS customerProvince,customer.city AS customerCity,
      customer.address AS customerAddress,customer.postal_code AS customerPostalCode,c.device_id AS deviceId,
      c.device_type_snapshot AS deviceType,c.brand_snapshot AS brand,c.model_snapshot AS model,
      c.identifier_snapshot AS identifier,c.color_snapshot AS color,c.declared_issue AS declaredIssue,
      c.accessories_json AS accessoriesJson,c.appearance_states_json AS appearanceStatesJson,c.reception_notes AS receptionNotes,
      c.status,c.result,c.operation_report AS operationReport,c.delivery_amount AS deliveryAmount,
      c.delivered_to_name AS deliveredToName,c.delivery_notes AS deliveryNotes,c.assigned_to_user_id AS assignedToUserId,
      assignee.display_name AS assignedToName,creator.display_name AS createdByName,c.created_at AS createdAt,
      c.updated_at AS updatedAt,c.delivered_at AS deliveredAt,deliverer.display_name AS deliveredByName,
      workflow.promised_at AS promisedAt,workflow.customer_consent_json AS customerConsentJson,c.row_version AS rowVersion
    FROM repair_cases c
    JOIN repair_branches b ON b.id=c.branch_id AND b.shop_id=c.shop_id
    JOIN repair_customers customer ON customer.id=c.customer_id AND customer.shop_id=c.shop_id
    JOIN repair_customer_devices device ON device.id=c.device_id AND device.shop_id=c.shop_id
    LEFT JOIN tamiran_users assignee ON assignee.id=c.assigned_to_user_id AND assignee.shop_id=c.shop_id
    JOIN tamiran_users creator ON creator.id=c.created_by_user_id AND creator.shop_id=c.shop_id
    LEFT JOIN tamiran_users deliverer ON deliverer.id=c.delivered_by_user_id AND deliverer.shop_id=c.shop_id
    LEFT JOIN repair_case_workflows workflow ON workflow.case_id=c.id AND workflow.shop_id=c.shop_id AND workflow.branch_id=c.branch_id
    WHERE c.shop_id=? AND c.branch_id=? ${assigned?'AND c.assigned_to_user_id=?':''} ${onlyCaseId===undefined?'':'AND c.id=?'}
    ORDER BY c.updated_at DESC,c.id DESC LIMIT 250`)
    .bind(scope.shopId,scope.branchId,...(assigned?[scope.userId]:[]),...(onlyCaseId===undefined?[]:[onlyCaseId])).all<CaseRow>()).results;
  // Recheck after the data query so a membership revocation racing this read cannot return a stale authorized payload.
  await assertFreshScope(db,scope,now);
  const events=await eventsFor(db,scope,rows.map(row=>row.id)),showPii=piiRoles.has(scope.role);
  return rows.map(row=>({
    id:row.id,publicId:row.publicId,caseUuid:row.caseUuid,receiptNumber:row.receiptNumber,receiptSequence:row.receiptSequence,
    trackingUrl:'',branchCode:row.branchCode,customerId:row.customerId,customerName:row.customerName,
    customerMobile:showPii?row.customerMobile:'',secondaryMobile:showPii?(row.secondaryMobile??''):'',
    nationalCode:showPii?(row.nationalCode??''):'',customerAddress:showPii?(row.customerAddress??''):'',
    customerProvince:showPii?(row.customerProvince??''):'',customerCity:showPii?(row.customerCity??''):'',
    customerPostalCode:showPii?(row.customerPostalCode??''):'',deviceId:row.deviceId,deviceType:row.deviceType,
    brand:row.brand,model:row.model,identifier:row.identifier??'',color:row.color??'',declaredIssue:row.declaredIssue,
    accessories:array(row.accessoriesJson),appearanceStates:array(row.appearanceStatesJson),receptionNotes:row.receptionNotes??'',
    status:row.status,result:row.result??'',operationReport:row.operationReport??'',deliveryAmount:row.deliveryAmount,
    deliveredToName:row.deliveredToName??'',deliveryNotes:row.deliveryNotes??'',assignedToUserId:row.assignedToUserId,
    assignedToName:row.assignedToName??'',createdByName:row.createdByName,createdAt:row.createdAt,updatedAt:row.updatedAt,
    deliveredAt:row.deliveredAt,deliveredByName:row.deliveredByName??'',promisedAt:row.promisedAt,
    dataHandling:consent(row.customerConsentJson),expectedVersion:row.rowVersion,events:events.get(row.id)??[],
  }));
}

export async function readOperationalCase(db:D1Like,scope:ServerScope,caseId:number,now:string){
  const item=(await listOperationalCases(db,scope,now,caseId))[0];
  if(!item)throw new ScopeError('پرونده پیدا نشد.',404);
  return item;
}

async function operationalUsers(db:D1Like,scope:ServerScope){
  if(!piiRoles.has(scope.role))return[];
  const rows=(await db.prepare(`SELECT u.id,u.display_name AS displayName,ub.branch_role_code AS role,
      CASE WHEN u.is_active=1 AND ub.is_active=1 THEN 1 ELSE 0 END AS isActive
    FROM tamiran_users u JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
    WHERE u.shop_id=? AND ub.branch_id=? ORDER BY isActive DESC,u.display_name,u.id`)
    .bind(scope.shopId,scope.branchId).all<{id:number;displayName:string;role:string;isActive:number}>()).results;
  return rows.map(row=>({...row,isActive:row.isActive===1}));
}

export async function readOperationsSnapshot(db:D1Like,scope:ServerScope,key:CryptoKey|null,now:string){
  utcDate(now);
  if(scope.inventoryMode!=='off')throw new ScopeError('قرارداد عملیاتی انبار این تعمیرگاه هنوز منتقل نشده است.',503);
  const cases=await listOperationalCases(db,scope,now),users=await operationalUsers(db,scope);
  let receptionDrafts:unknown[]=[];
  if(piiRoles.has(scope.role)){
    if(!key)throw new ReceptionError('کلید امن پذیرش تنظیم نشده است.',503);
    receptionDrafts=await listReceptionDrafts(db,scope,key,now);
  }
  await assertFreshScope(db,scope,now);
  const today=now.slice(0,10);
  return{
    summary:{
      activeCases:cases.filter(item=>!['delivered','cancelled'].includes(item.status)).length,
      awaitingAssignment:cases.filter(item=>item.status==='awaiting_assignment').length,
      readyForDelivery:cases.filter(item=>item.status==='ready_for_delivery').length,
      openHotReturns:0,
      deliveredToday:cases.filter(item=>item.status==='delivered'&&item.deliveredAt?.slice(0,10)===today).length,
    },
    cases,users,inventory:[],movements:[],partRequests:[],hotReturns:[],receptionDrafts,
  };
}
