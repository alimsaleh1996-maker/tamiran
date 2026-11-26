import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { moneyDigits } from "./money";
import { deliveryV2Action, smsV2Action, type V2DeliveryCase } from "./v2-api";
import "./delivery-case-form.css";

type Run = (job: () => Promise<unknown>, success: string) => Promise<unknown>;

const evidenceMethods = [
  ["receipt_qr", "رسید یا QR"],
  ["digital_signature", "امضا"],
  ["identity_document", "مدرک هویتی"],
  ["sms_otp", "کد پیامکی"],
] as const;

function accessoryLabels(raw: string) {
  try {
    const list: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(list)) return [];
    const labels = list.map(value => (typeof value === "string" ? value
      : String(value?.label ?? value?.title ?? value?.name ?? "")).trim());
    return [...new Set(labels.filter(label => label && label !== "بدون لوازم" && label !== "بدون اقلام"))];
  } catch {
    return [];
  }
}

export function DeliveryCaseForm({ item, verificationSettings, manager, busy, run, onBack, onCompleted }: {
  item: V2DeliveryCase;
  verificationSettings: Record<string, unknown>;
  manager: boolean;
  busy: boolean;
  run: Run;
  onBack: () => void;
  onCompleted: () => void;
}) {
  const methods: (readonly [string, string])[] = evidenceMethods.filter(([value]) => {
    const enabled = verificationSettings.enabledMethods;
    return !Array.isArray(enabled) || enabled.includes(value);
  });
  if (manager) methods.push(["manager_emergency", "مسیر اضطراری مدیر"]);
  const fieldId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const key = useRef<{ signature: string; value: string } | undefined>(undefined);
  const submitting = useRef(false);
  const otpSending = useRef(false);
  const [form, setForm] = useState({
    name: item.customer_name, mobile: item.customer_mobile, recipientType: "customer",
    nationalCode: "", method: methods[0]?.[0] ?? "", evidence: "", discrepancyNote: "",
    otpRequestId: "", otpCode: "", identifier: item.identifier_snapshot ?? "",
    identityConfirmed: false, identityChangeReason: "",
  });
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);
  const [discrepancyRecorded, setDiscrepancyRecorded] = useState(false);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  const patch = (values: Partial<typeof form>) => setForm(current => ({ ...current, ...values }));
  const unrepaired = item.process_status === "returned_unrepaired";
  const accessories = accessoryLabels(item.accessories_json);
  const missing = accessories.filter(label => !confirmed.includes(label));
  const representative = form.recipientType === "representative";
  const requiresOtp = representative || form.method === "sms_otp";
  const identityChanged = Boolean(item.identifier_snapshot && form.identifier.trim() !== item.identifier_snapshot);
  const blockers = [...item.blockers.parts, ...item.blockers.qc, ...item.blockers.finance];
  const invalid = blockers.length > 0 || missing.length > 0
    || (!unrepaired && (!form.identifier.trim() || !form.identityConfirmed || (identityChanged && !form.identityChangeReason.trim())))
    || !form.name.trim() || !form.mobile.trim() || (representative && !form.nationalCode.trim())
    || !form.method || !form.evidence.trim() || (requiresOtp && (!form.otpRequestId || form.otpCode.length !== 6));

  async function submit() {
    if (busy || invalid || submitting.current) return;
    submitting.current = true;
    const payload = {
      action: "complete", expectedVersion: item.lock_version, caseId: item.case_id,
      deviceIdentifier: form.identifier, identityConfirmed: form.identityConfirmed, identifierChangeReason: form.identityChangeReason,
      recipientType: form.recipientType, recipientFullName: form.name, recipientMobile: form.mobile,
      recipientNationalCode: form.nationalCode, verificationMethod: form.method,
      verificationEvidence: { note: form.evidence.trim() },
      emergencyReason: form.method === "manager_emergency" ? form.evidence.trim() : undefined,
      otpRequestId: form.otpRequestId, otpCode: form.otpCode, accessoriesConfirmed: confirmed,
      warningsAcknowledged: { accepted: true },
      warrantyConditions: "ضمانت هر ردیف مطابق فاکتور و شرایط تعمیرگاه است.",
    };
    const signature = JSON.stringify(payload);
    if (key.current?.signature !== signature) key.current = { signature, value: crypto.randomUUID() };
    const idempotencyKey = key.current.value;
    try {
      const result = await run(() => deliveryV2Action({ ...payload, idempotencyKey }), "تحویل دستگاه ثبت شد.");
      if ((result as { delivered?: boolean } | undefined)?.delivered) onCompleted();
    } finally {
      submitting.current = false;
    }
  }

  async function sendOtp() {
    if (busy || otpSending.current) return;
    otpSending.current = true;
    try {
      const result = await run(() => smsV2Action({
        action: "otp_request", purpose: representative ? "representative_delivery" : "delivery",
        subjectPublicId: item.case_public_id, mobile: item.customer_mobile,
      }), "کد یک‌بارمصرف برای مشتری ارسال شد.");
      const requestId = (result as { requestId?: string } | undefined)?.requestId;
      if (requestId) patch({ otpRequestId: requestId, otpCode: "" });
    } finally {
      otpSending.current = false;
    }
  }

  async function reportDiscrepancy() {
    if (busy || !form.discrepancyNote.trim() || missing.length === 0) return;
    if (await run(() => deliveryV2Action({ action: "report_discrepancy", caseId: item.case_id,
      missingAccessories: missing, note: form.discrepancyNote.trim() }), "مغایرت لوازم ثبت شد.")) {
      setReporting(false);
      setDiscrepancyRecorded(true);
    }
  }

  return <section className="cashier-sheet delivery-sheet" aria-labelledby={`${fieldId}-title`}>
    <header className="cashier-header">
      <h3 id={`${fieldId}-title`} ref={title} tabIndex={-1}>تحویل دستگاه به مشتری</h3>
      <button type="button" className="cashier-quiet" onClick={onBack} disabled={busy}>
        <ChevronRight size={17} aria-hidden /> بازگشت به صف
      </button>
    </header>
    <dl className="cashier-meta">
      <div><dt>شماره پذیرش</dt><dd><bdi>{item.receipt_number}</bdi></dd></div>
      <div><dt>دستگاه</dt><dd>{[item.device_type_snapshot, item.brand_snapshot, item.model_snapshot].filter(Boolean).join(" ")}</dd></div>
      <div><dt>مشتری</dt><dd>{item.customer_name}</dd></div>
    </dl>
    <div className="cashier-badges">
      <span>{unrepaired ? "تحویل بدون تعمیر" : "تعمیر تکمیل شده"}</span>
      {blockers.length === 0 && !unrepaired && <span>تعیین تکلیف مالی ثبت شد</span>}
      {!unrepaired && item.qc_mode_snapshot !== "off" && !item.blockers.qc.length && <span>کنترل کیفیت تکمیل شد</span>}
    </div>
    {blockers.length > 0 && <ul className="cashier-blockers">{blockers.map((text, index) => <li key={index}>{text}</li>)}</ul>}
    <form className="delivery-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset>
        <legend>تطبیق دستگاه و لوازم</legend>
        {!unrepaired && <>
          <label className="cashier-field">
            <span>سریال یا IMEI دستگاه تحویلی</span>
            <input dir="ltr" value={form.identifier} maxLength={180} required
              onChange={event => patch({ identifier: event.target.value, identityConfirmed: false })} />
          </label>
          {!item.identifier_snapshot && <p className="delivery-hint">شناسهٔ روی دستگاه را ثبت کنید.</p>}
          {identityChanged && <label className="cashier-field">
            <span>علت تغییر شناسه</span><input required value={form.identityChangeReason} maxLength={1000}
              onChange={event => patch({ identityChangeReason: event.target.value })} />
          </label>}
          <label className="delivery-check"><input type="checkbox" checked={form.identityConfirmed}
            onChange={event => patch({ identityConfirmed: event.target.checked })} />
            <span>شناسه را با همین دستگاه تطبیق دادم.</span>
          </label>
        </>}
        {accessories.length ? <div className="delivery-accessories">
          <strong>لوازم همراه</strong>
          <div>{accessories.map(label => <label key={label} className="delivery-check">
            <input type="checkbox" checked={confirmed.includes(label)} onChange={event =>
              setConfirmed(previous => event.target.checked ? [...previous, label] : previous.filter(entry => entry !== label))} />
            <span>{label}</span>
          </label>)}</div>
          {missing.length > 0 && (reporting ? <div className="delivery-discrepancy">
            <label className="cashier-field"><span>شرح مغایرت لوازم</span>
              <input maxLength={1000} value={form.discrepancyNote} onChange={event => patch({ discrepancyNote: event.target.value })} />
            </label>
            <button type="button" className="cashier-quiet" disabled={busy || !form.discrepancyNote.trim()} onClick={() => void reportDiscrepancy()}>ثبت مغایرت</button>
          </div> : <button type="button" className="cashier-quiet" onClick={() => setReporting(true)}>گزارش مغایرت لوازم</button>)}
          {discrepancyRecorded && <p role="status">مغایرت ثبت شد. برای تحویل، لوازم پذیرش‌شده را تعیین تکلیف کنید.</p>}
        </div> : <p className="delivery-hint">لوازم همراهی ثبت نشده است.</p>}
      </fieldset>
      <fieldset>
        <legend>تحویل‌گیرنده</legend>
        <div className="delivery-fields">
          <div className="cashier-field">
            <label htmlFor={`${fieldId}-recipient`}>نسبت با مشتری</label>
            <select id={`${fieldId}-recipient`} value={form.recipientType} onChange={event => {
              const recipientType = event.target.value;
              patch({ recipientType, name: recipientType === "customer" ? item.customer_name : "",
                mobile: recipientType === "customer" ? item.customer_mobile : "", nationalCode: "", otpRequestId: "", otpCode: "" });
            }}>
              <option value="customer">خود مشتری</option>
              <option value="representative">شخص دیگر</option>
            </select>
          </div>
          <label className="cashier-field"><span>نام کامل</span><input required maxLength={180} value={form.name}
            onChange={event => patch({ name: event.target.value })} /></label>
          <label className="cashier-field"><span>موبایل</span><input dir="ltr" inputMode="tel" required value={form.mobile}
            onChange={event => patch({ mobile: event.target.value })} /></label>
          {representative && <label className="cashier-field"><span>مشخصات هویتی تحویل‌گیرنده</span>
            <input dir="ltr" required maxLength={20} value={form.nationalCode} onChange={event => patch({ nationalCode: event.target.value })} />
          </label>}
        </div>
      </fieldset>
      <fieldset>
        <legend>احراز تحویل</legend>
        <div className="delivery-fields">
          <div className="cashier-field">
            <label htmlFor={`${fieldId}-method`}>روش احراز</label>
            <select id={`${fieldId}-method`} value={form.method}
              onChange={event => patch({ method: event.target.value, otpRequestId: "", otpCode: "", evidence: "" })}>
              {methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <label className="cashier-field"><span>{form.method === "manager_emergency" ? "علت مسیر اضطراری" : "مدرک یا توضیح احراز"}</span>
            <input required maxLength={1000} value={form.evidence} onChange={event => patch({ evidence: event.target.value })} />
          </label>
        </div>
        {requiresOtp && <div className="delivery-fields delivery-otp">
          <button type="button" className="cashier-quiet" disabled={busy} onClick={() => void sendOtp()}>
            {form.otpRequestId ? "ارسال مجدد کد به مشتری" : "ارسال کد به مشتری"}
          </button>
          {form.otpRequestId && <label className="cashier-field"><span>کد پیامکی مشتری</span>
            <input dir="ltr" autoComplete="one-time-code" inputMode="numeric" required value={form.otpCode}
              onChange={event => patch({ otpCode: moneyDigits(event.target.value).replace(/\D/g, "").slice(0, 6) })} />
          </label>}
        </div>}
      </fieldset>
      <footer className="delivery-actions">
        <button type="submit" className="cashier-primary" disabled={busy || invalid}>
          {busy ? "در حال ثبت…" : "ثبت تحویل و نمایش رسید"}
        </button>
      </footer>
    </form>
  </section>;
}
