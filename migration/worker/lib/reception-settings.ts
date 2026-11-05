import type { D1Like, ServerScope } from "./server-scope";
import type { NewDeviceReceptionInput } from "./reception-new-device.ts";
import { ReceptionError } from "./reception-repository.ts";

const defaults = ['بدون ایراد ظاهری','خط‌وخش','ترک یا شکستگی','فرورفتگی','آثار ضربه','آثار آب‌خوردگی','تغییر رنگ یا سوختگی','بازشدگی قبلی'];
function decode(raw: string): unknown {
  try { return JSON.parse(raw); } catch { throw new ReceptionError("تنظیمات پذیرش معتبر نیست.",409); }
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
}

export async function validateReceptionSettings(db: D1Like, scope: ServerScope, input: NewDeviceReceptionInput) {
  const shop = await db.prepare('SELECT national_code_required FROM repair_shops WHERE id=?').bind(scope.shopId).first<{national_code_required:number}>();
  if(!shop)throw new ReceptionError("تعمیرگاه معتبر نیست.",403);
  const rows = await db.prepare("SELECT setting_key,value_json FROM repair_shop_settings WHERE shop_id=? AND setting_key IN ('customer_address_policy','device_colors','receipt_template')").bind(scope.shopId).all<{setting_key:string;value_json:string}>();
  const values = new Map(rows.results.map(row=>[row.setting_key,row.value_json]));
  const rawAddress=values.get('customer_address_policy')??'null', rawColors=values.get('device_colors')??'null', rawTemplate=values.get('receipt_template')??'null';
  const address=object(decode(rawAddress)), colors=decode(rawColors), template=object(decode(rawTemplate));
  if(address.required && [input.customer.province,input.customer.city,input.customer.address,input.customer.postalCode].some(v=>!v?.trim()))throw new ReceptionError("استان، شهر، آدرس و کد پستی مشتری برای این تعمیرگاه الزامی است.",400);
  if(shop.national_code_required && !input.customer.nationalCode?.trim())throw new ReceptionError("ثبت کد ملی برای این تعمیرگاه اجباری است.",400);
  if(input.device.color?.trim() && Array.isArray(colors) && colors.length) {
    const names=colors.filter(v=>v && typeof v==='object' && object(v).active!==false).map(v=>String(object(v).name??'').trim());
    if(!names.includes(input.device.color.trim()))throw new ReceptionError("رنگ دستگاه باید از فهرست فعال تنظیمات انتخاب شود.",409);
  }
  const configured=Array.isArray(template.appearanceOptions)?[...new Set(template.appearanceOptions.map(v=>String(v).trim()).filter(Boolean))]:[];
  const appearance=configured.length?configured:defaults;
  if(input.appearanceStates.some(v=>!appearance.includes(v.trim())))throw new ReceptionError("وضعیت ظاهری باید از فهرست فعال تنظیمات انتخاب شود.",409);
  if(!input.customerConsent || !['no_erasure','coordinate_first','erase_authorized'].includes(input.customerConsent.dataHandling))throw new ReceptionError("انتخاب مجوز حذف اطلاعات دستگاه الزامی است.",400);
  if(input.customerConsent.acceptanceMethod && !['digital_signature','in_person_signature','sms_otp','recorded_consent'].includes(input.customerConsent.acceptanceMethod))throw new ReceptionError("روش پذیرش شرایط معتبر نیست.",400);
  return {nationalRequired:shop.national_code_required,rawAddress,rawColors,rawTemplate};
}
