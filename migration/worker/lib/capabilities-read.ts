import {ReceptionError} from './reception-repository.ts';
import {ScopeError,type D1Like,type ServerScope} from './server-scope.ts';
import {utcDate} from './reception-terms.ts';

type Entitlement='active'|'trial'|'locked'|'expired'|'suspended';
type Permission='manage'|'use'|'none';
type CapabilityRow={
  product_profile:'solo'|'pro';feature_flags_json:string;branch_role_code:string;permissions_json:string;
  module_key:string|null;name:string|null;description:string|null;is_core:number|null;is_sellable:number|null;
  state:Entitlement|null;expires_at:string|null;
};

const ROLE_MODULES:Record<string,readonly string[]>={
  reception:['repair','customer_portal','sms','warranty'],technician:['repair','inventory','warranty'],
  quality_control:['repair','warranty'],warehouse_keeper:['repair','inventory'],
  finance_cashier:['repair','finance','accounting_integration'],
};

const CAPABILITY_SQL=`WITH valid_scope AS (
 SELECT s.id AS shop_id,s.product_profile,s.feature_flags_json,ub.branch_role_code,ub.permissions_json
 FROM tamiran_users u
 JOIN repair_shops s ON s.id=u.shop_id
 JOIN tamiran_user_branches ub ON ub.user_id=u.id AND ub.shop_id=u.shop_id
 JOIN repair_branches b ON b.id=ub.branch_id AND b.shop_id=ub.shop_id
 WHERE u.id=? AND u.account_user_id=? AND u.shop_id=? AND b.id=?
   AND u.is_active=1 AND ub.is_active=1 AND b.is_active=1 AND ub.branch_role_code=?
   AND s.lifecycle_status='active' AND s.license_started_at<=? AND s.license_expires_at>=?
)
SELECT v.product_profile,v.feature_flags_json,v.branch_role_code,v.permissions_json,
       m.module_key,m.name,m.description,m.is_core,m.is_sellable,sm.state,sm.expires_at
FROM valid_scope v
LEFT JOIN tamiran_modules m ON m.status='active' AND (m.product_scope='both' OR m.product_scope=v.product_profile)
LEFT JOIN tamiran_shop_modules sm ON sm.repair_shop_id=v.shop_id AND sm.module_key=m.module_key
ORDER BY CASE m.module_key
 WHEN 'repair' THEN 10 WHEN 'inventory' THEN 20 WHEN 'finance' THEN 30 WHEN 'customer_portal' THEN 40
 WHEN 'sms' THEN 50 WHEN 'warranty' THEN 60 WHEN 'multi_branch' THEN 70 WHEN 'analytics' THEN 80
 WHEN 'accounting_integration' THEN 90 WHEN 'sla' THEN 100 WHEN 'api' THEN 110 ELSE 1000 END,m.module_key`;

function object(value:string):Record<string,unknown>{
  try{const parsed:unknown=JSON.parse(value);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed as Record<string,unknown>}catch{}
  throw new ReceptionError('تنظیمات قابلیت تعمیرگاه معتبر نیست.',409);
}
function strings(value:string):string[]{
  try{const parsed:unknown=JSON.parse(value);if(Array.isArray(parsed)&&parsed.every(item=>typeof item==='string'))return parsed}catch{}
  throw new ReceptionError('مجوزهای نقش معتبر نیست.',409);
}
function permission(role:string,permissions:Set<string>,module:string):Permission{
  if(role==='repair_manager'||permissions.has('*')||permissions.has(`${module}.manage`))return'manage';
  if(permissions.has(`${module}.view`)||permissions.has(`${module}.use`))return'use';
  return ROLE_MODULES[role]?.includes(module)?'use':'none';
}
function expiry(value:string):Date{
  try{return utcDate(value)}catch{throw new ReceptionError('زمان اعتبار قابلیت معتبر نیست.',409)}
}

export async function readCapabilitySnapshot(db:D1Like,scope:ServerScope,now:string){
  const current=utcDate(now),today=now.slice(0,10);
  const result=await db.prepare(CAPABILITY_SQL).bind(scope.userId,scope.accountUserId,scope.shopId,scope.branchId,scope.role,today,today).all<CapabilityRow>();
  if(result.results.length===0)throw new ScopeError('دسترسی حساب یا شعبه تغییر کرده است.',403);
  const first=result.results[0];
  if(!first.module_key)throw new ReceptionError('فهرست قابلیت‌ها آماده نیست.',503);
  const featureFlags=object(first.feature_flags_json),permissions=new Set(strings(first.permissions_json));
  const discoverable=first.branch_role_code==='repair_manager'||permissions.has('*')||permissions.has('modules.discover');
  const modules=result.results.map(row=>{
    if(!row.module_key||row.name===null||row.description===null||row.is_core===null||row.is_sellable===null)throw new ReceptionError('فهرست قابلیت‌ها ناقص است.',503);
    const core=row.is_core===1,sellable=row.is_sellable===1,moduleKey=row.module_key;
    let entitlement:Entitlement=core?'active':(row.state??'locked');
    if(entitlement==='trial'&&row.expires_at&&expiry(row.expires_at).getTime()<current.getTime())entitlement='expired';
    const technicalFlag=featureFlags[`module.${moduleKey}`]??featureFlags[moduleKey]??true;
    if(technicalFlag===false&&(entitlement==='active'||entitlement==='trial'))entitlement='suspended';
    const actorPermission=permission(first.branch_role_code,permissions,moduleKey);
    const granted=(entitlement==='active'||entitlement==='trial')&&actorPermission!=='none';
    const catalogVisible=!core&&sellable&&discoverable&&!granted;
    const trialDaysRemaining=entitlement==='trial'&&row.expires_at?Math.max(0,Math.ceil((expiry(row.expires_at).getTime()-current.getTime())/86400000)):null;
    return{module:moduleKey,label:row.name,description:row.description,entitlement,permission:actorPermission,
      navigation:granted?'visible':'hidden',catalog:catalogVisible?'visible':'hidden',
      access:granted?'granted':actorPermission==='none'?'denied':'locked',cta:catalogVisible?'request_activation':null,
      trialDaysRemaining,expiresAt:row.expires_at};
  });
  return{productProfile:first.product_profile,discoverable,modules,generatedAt:current.toISOString()};
}
