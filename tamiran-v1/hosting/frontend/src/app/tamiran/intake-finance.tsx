import { useState } from "react";
import { Banknote, CreditCard, Landmark } from "lucide-react";
import { MoneyInput } from "./money-input";
import { formatRials } from "./money";

export type IntakeMethod = "cash" | "card" | "bank_transfer";
export const intakeMethodTitles: Record<IntakeMethod, string> = {cash: "نقدی", card: "کارت‌خوان", bank_transfer: "واریزی"};
const locationTitles: Record<IntakeMethod, string> = {cash: "صندوق", card: "پایانه", bank_transfer: "حساب بانکی"};
const methods = ["card", "cash", "bank_transfer"] as const;
export type IntakeLocation = {
  id: string; method: IntakeMethod; label: string; active: boolean;
  bank?: string; terminal?: string; accountId?: string; account?: string; card?: string; iban?: string;
};
export type IntakeAdvance = { amount: number; method: IntakeMethod; locationId: string; tracking?: string };
export type IntakeCostApproval = { mode: "always" | "limit"; limit: number; alwaysText: string; limitText: string };
export const defaultIntakeCost: IntakeCostApproval = {
  mode: "always", limit: 0,
  alwaysText: "انجام تعمیرات هزینه‌زا منوط به اعلام هزینه و دریافت تأیید مشتری خواهد بود.",
  limitText: "با موافقت مشتری، تعمیرات تا سقف {approval_limit} ریال بدون نیاز به هماهنگی مجدد انجام می‌شود. در صورت افزایش هزینه بیش از مبلغ مورد توافق، تعمیر دستگاه منوط به دریافت تأیید مشتری خواهد بود. مبلغ نهایی صرفاً بر اساس قطعات مصرف‌شده و خدمات انجام‌شده محاسبه می‌شود.",
};

export const formatIntakeRials = formatRials;

export function IntakeRialInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <MoneyInput value={value ? String(value) : ""} onChange={text => {
    const amount = Number(text);
    if (amount <= 1_000_000_000_000) onChange(amount);
  }} />;
}
export function IntakeAdvanceEditor({ locations, value, onConfirm, onCancel }: {
  locations: IntakeLocation[]; value?: IntakeAdvance | null;
  onConfirm: (value: IntakeAdvance) => void; onCancel: () => void;
}) {
  const [method, setMethod] = useState<IntakeMethod>(value?.method ?? methods.find(item => locations.some(location => location.method === item)) ?? "cash");
  const [amount, setAmount] = useState(value?.amount ?? 0);
  const [selected, setSelected] = useState(value?.locationId ?? "");
  const [tracking, setTracking] = useState(value?.tracking ?? "");
  const options = locations.filter(location => location.method === method);
  const locationId = options.length === 1 ? options[0].id : selected;
  return <form className="intake-advance-editor" onSubmit={event => {
    event.preventDefault();
    if (!amount || !options.some(location => location.id === locationId)) return;
    onConfirm({amount, method, locationId, tracking: method !== "cash" ? tracking.trim() : undefined});
  }}>
    <label className="field-block">مبلغ دریافتی (ریال)<IntakeRialInput value={amount} onChange={setAmount} /></label>
    <fieldset className="intake-methods"><legend>روش دریافت وجه</legend>
      {methods.map(item => {
        const Icon = item === "card" ? CreditCard : item === "cash" ? Banknote : Landmark;
        return <label key={item}>
          <input type="radio" name="intake-method" checked={method === item} disabled={!locations.some(location => location.method === item)}
            onChange={() => {setMethod(item); setSelected(""); setTracking("");}} />
          <Icon size={16} aria-hidden="true" />{intakeMethodTitles[item]}
        </label>;
      })}
    </fieldset>
    <label className="field-block">{locationTitles[method]}
      <select value={locationId} onChange={event => setSelected(event.target.value)}>
        <option value="">انتخاب {locationTitles[method]}</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
    <label className="field-block" style={{visibility:method === "cash" ? "hidden" : "visible"}}>شماره پیگیری (اختیاری)
      <input value={tracking} onChange={event => setTracking(event.target.value)} maxLength={160} disabled={method === "cash"} />
    </label>
    <div className="identity-actions">
      <button type="submit" className="primary-action" disabled={!amount || !options.some(option=>option.id === locationId)}>تأیید پیش‌دریافت</button>
      <button type="button" className="outline-action" onClick={onCancel}>انصراف</button>
    </div>
  </form>;
}

export function IntakeLocationSettings({ initial, branch, onSave }: {
  initial: IntakeLocation[]; branch: string; onSave: (locations: IntakeLocation[]) => Promise<void>;
}) {
  const [locations,setLocations] = useState(initial);
  const [adding,setAdding] = useState<IntakeMethod>("cash");
  const [saving,setSaving]=useState(false);
  const patch = (id:string, next:Partial<IntakeLocation>) =>
    setLocations(list=>list.map(item=>item.id===id ? {...item,...next}:item));
  return <section className="settings-form intake-location-settings">
    <h3>محل‌های دریافت وجه</h3>
    <p>شعبهٔ جاری · {branch}</p>
    {locations.map(item => <fieldset className="form-grid two-columns" key={item.id}>
      <legend>{locationTitles[item.method]}</legend>
      <label className="field-block">عنوان<input maxLength={100} value={item.label} onChange={e=>patch(item.id,{label:e.target.value})} /></label>
      <label><input type="checkbox" checked={item.active} onChange={e=>patch(item.id,{active:e.target.checked})} /> فعال</label>
      {item.method!=="cash" && <label className="field-block">نام بانک<input value={item.bank??""} onChange={e=>patch(item.id,{bank:e.target.value})} /></label>}
      {item.method==="card" && <>
        <label className="field-block">شماره پایانه<input value={item.terminal??""} onChange={e=>patch(item.id,{terminal:e.target.value})} /></label>
        <label className="field-block">حساب متصل<select value={item.accountId??""} onChange={e=>patch(item.id,{accountId:e.target.value})}>
          <option value="">انتخاب حساب</option>
          {locations.filter(location=>location.method==="bank_transfer").map(location=><option key={location.id} value={location.id}>{location.label}</option>)}
        </select></label>
      </>}
      {item.method==="bank_transfer" && ([["account","شماره حساب"],["card","شماره کارت"],["iban","شماره شبا"]] as const).map(([field,label])=>
        <label key={field} className="field-block">{label}<input dir="ltr" value={item[field]??""} onChange={e=>patch(item.id,{[field]:e.target.value})} /></label>)}
    </fieldset>)}
    <div className="identity-actions">
      <label className="field-block">نوع محل<select value={adding} onChange={e=>setAdding(e.target.value as IntakeMethod)}>
        {methods.map(method=><option key={method} value={method}>{locationTitles[method]}</option>)}
      </select></label>
      <button type="button" className="outline-action" onClick={()=>setLocations(current=>[...current,{id:crypto.randomUUID(),method:adding,label:"",active:false}])}>افزودن محل</button>
      <button type="button" className="primary-action" disabled={saving} onClick={()=>{setSaving(true); void onSave(locations).finally(()=>setSaving(false));}}>ذخیره محل‌ها</button>
    </div>
  </section>;
}
