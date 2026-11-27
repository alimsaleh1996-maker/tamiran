"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, ReceiptText } from "lucide-react";
import { useModalFocus } from "../shared/use-modal-focus";
import { MoneyInput, formatRials } from "./money-input";
import { PersianDatePicker } from "./persian-date-picker";
import { financeV2Action, workflowV2Action, searchAdvanceCases, repairPaymentMethods as methods, type RepairPaymentMethod, type V2AdvanceCase, type V2FinancePermissions, type V2Invoice, type V2InvoiceDraft } from "./v2-api";
import "./finance-case-view.css";

type Line = V2InvoiceDraft["items"][number];
type Run = (job: () => Promise<unknown>, success: string) => Promise<unknown>;

const money = (rials: number) => `${formatRials(rials)} ریال`;
const count = new Intl.NumberFormat("fa-IR");
const paymentDate = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran",
});
const lineNames = { part: "قطعه", labor: "اجرت", diagnostic: "عیب‌یابی", other: "سایر هزینه‌ها" };
const sourceNames = { stock: "از انبار", external: "خرید خارجی", manual: "قطعه آزاد" };

function lineAmount(line: Line) {
  const base = Math.round(Number(line.quantity) * Number(line.saleUnitPrice));
  const net = base - Number(line.discountAmount);
  const tax = Math.round(net * Number(line.taxRate) / 100);
  return { base, net, tax, total: net + tax };
}

function FinanceHeader({ title, step, receipt, customer, device, technician, onClose, busy }: {
  title: string;
  step?: number;
  receipt: string;
  customer: string;
  device?: string;
  technician?: string | null;
  onClose: () => void;
  busy: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [title]);
  return <>
    <header className="cashier-header">
      <div>
        {step && <span className="cashier-step">مرحله {count.format(step)} از ۳</span>}
        <h3 ref={heading} tabIndex={-1}>{title}</h3>
      </div>
      <button className="cashier-quiet" type="button" onClick={onClose} disabled={busy}>
        <ChevronRight size={17} /> بازگشت به صف
      </button>
    </header>
    <dl className="cashier-meta">
      <div><dt>شماره پذیرش</dt><dd><bdi>{receipt}</bdi></dd></div>
      <div><dt>مشتری</dt><dd>{customer}</dd></div>
      <div><dt>دستگاه</dt><dd>{device || "دستگاه پرونده"}</dd></div>
      {technician && <div><dt>تکنسین مسئول</dt><dd>{technician}</dd></div>}
    </dl>
  </>;
}

function ConfirmAmount({ total, busy, onClose, onConfirm }: {
  total: number; busy: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const id = useModalFocus(dialog, true, () => { if (!busy) onClose(); });
  return <div className="cashier-backdrop">
    <div ref={dialog} className="cashier-dialog" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
      <ReceiptText size={25} aria-hidden />
      <h3 id={id}>تأیید مبلغ نهایی</h3>
      <p>فاکتور تعمیرات با این مبلغ صادر می‌شود.</p>
      <strong>{money(total)}</strong>
      <div className="cashier-actions">
        <button type="button" className="cashier-quiet" disabled={busy} onClick={onClose}>بازگشت و بررسی</button>
        <button type="button" className="cashier-primary" disabled={busy} onClick={onConfirm}>
          {busy ? "در حال صدور…" : "تأیید و صدور فاکتور"}
        </button>
      </div>
    </div>
  </div>;
}

export function AdvancePaymentView({ initialSearch, permissions, paymentMethods, busy, run, onClose }: {
  initialSearch: string; permissions: V2FinancePermissions; paymentMethods: RepairPaymentMethod[];
  busy: boolean; run: Run; onClose: () => void;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState(initialSearch);
  const [submitted, setSubmitted] = useState(initialSearch);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<V2AdvanceCase[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [refundId, setRefundId] = useState("");
  const [amount, setAmount] = useState("");
  const [preferredMethod, setMethod] = useState<RepairPaymentMethod>("card");
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const selected = rows.find(row => row.id === selectedId) ?? (rows.length === 1 ? rows[0] : undefined);
  const refund = selected?.advances.find(entry => entry.publicId === refundId);
  const choices = refund ? Object.keys(methods) as RepairPaymentMethod[] : paymentMethods;
  const method = choices.includes(preferredMethod) ? preferredMethod : choices[0];
  useEffect(() => {
    if (!submitted.trim()) return;
    let active = true;
    setLoading(true);
    setError("");
    searchAdvanceCases(submitted).then(result => { if (active) setRows(result.rows); }).catch(failure => {
      if (active) { setRows([]); setError(failure instanceof Error ? failure.message : "پرونده‌ها بارگذاری نشدند."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [submitted, revision]);
  function clearPayment() {
    setRefundId("");
    setAmount("");
    setTracking("");
    setReason("");
  }
  async function submit() {
    if (!selected || pending.current || !method || Number(amount) <= 0 || (refund && Number(amount) > refund.remaining)) return;
    pending.current = true;
    const action = refund ? "advance_refund" : "advance";
    const payload = {
      action, caseId: selected.id, amount: Number(amount), method,
      trackingNumber: tracking.trim(), reason: reason.trim(), advancePublicId: refund?.publicId,
    };
    const scopedKey = `tamiran:finance:${selected.receiptNumber}:${action}`;
    const signature = JSON.stringify(payload);
    const previous = sessionStorage.getItem(scopedKey);
    const [keyBefore, signBefore] = previous ? JSON.parse(previous) as [string, string] : [];
    const key = signBefore === signature ? keyBefore : crypto.randomUUID();
    sessionStorage.setItem(scopedKey, JSON.stringify([key, signature]));
    try {
      const result = await run(() => financeV2Action({ ...payload, idempotencyKey: key }),
        refund ? "استرداد پیش‌پرداخت ثبت شد." : "پیش‌پرداخت ثبت شد.");
      if (result) {
        sessionStorage.removeItem(scopedKey);
        clearPayment();
        setRevision(value => value + 1);
      }
    } finally { pending.current = false; }
  }
  return <section className="v2-card-form" dir="rtl">
    <div className="service-card-line"><h3>پیش‌پرداخت پیش از صدور فاکتور</h3>
      <button type="button" className="cashier-quiet" onClick={onClose}>بازگشت به مالی</button>
    </div>
    <form className="cashier-payment-form" onSubmit={event => {
      event.preventDefault();
      setRows([]);
      setSelectedId(0);
      clearPayment();
      setSubmitted(query.trim());
      setRevision(value => value + 1);
    }}>
      <label className="cashier-field">شماره پذیرش
        <input type="search" inputMode="numeric" maxLength={60} value={query} onChange={event => setQuery(event.target.value)} required />
      </label>
      <button type="submit" className="cashier-quiet" disabled={busy || loading || !query.trim()}>جست‌وجوی پرونده</button>
    </form>
    {loading && <p role="status">در حال جست‌وجو…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && submitted && !rows.length && <p>پروندهٔ بازِ بدون فاکتور با این شماره پیدا نشد.</p>}
    {rows.length > 1 && <label className="cashier-field">پرونده
      <select value={selectedId} onChange={event => { setSelectedId(Number(event.target.value)); clearPayment(); }}>
        <option value={0}>انتخاب پرونده</option>
        {rows.map(row => <option key={row.id} value={row.id}>{row.receiptNumber} · {row.customerName} · {row.deviceTitle}</option>)}
      </select>
    </label>}
    {selected && <>
      <h4>{selected.deviceTitle} · <bdi>{selected.receiptNumber}</bdi></h4>
      <p>{selected.customerName} · ماندهٔ پیش‌پرداخت {money(selected.advances.reduce((sum, entry) => sum + entry.remaining, 0))}</p>
      {selected.advances.length > 0 && <ul className="tech-plain-list">{selected.advances.map(entry => <li key={entry.publicId}>
        <span>{methods[entry.method]} · {money(entry.remaining)} · {dateLabel(entry.receivedAt)}</span>
        {permissions.manage && <button type="button" className="cashier-quiet" disabled={busy}
          onClick={() => { clearPayment(); setRefundId(entry.publicId); setMethod(entry.method); }}>ثبت استرداد پیش‌پرداخت</button>}
      </li>)}</ul>}
      {permissions.payment && <form className="cashier-payment-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label className="cashier-field" htmlFor={fieldId}>{refund ? "مبلغ استرداد" : "مبلغ پیش‌پرداخت"}
          <MoneyInput id={fieldId} value={amount} onChange={setAmount} required disabled={busy} />
        </label>
        <label className="cashier-field">{refund ? "روش استرداد" : "روش پرداخت"}
          <select value={method} onChange={event => setMethod(event.target.value as RepairPaymentMethod)} disabled={busy}>
            {choices.map(key => <option key={key} value={key}>{methods[key]}</option>)}
          </select>
        </label>
        <label className="cashier-field">شماره پیگیری
          <input value={tracking} maxLength={160} onChange={event => setTracking(event.target.value)} disabled={busy} />
        </label>
        {refund && <label className="cashier-field">دلیل استرداد
          <input maxLength={1000} required value={reason} onChange={event => setReason(event.target.value)} disabled={busy} />
        </label>}
        <button type="submit" className="cashier-primary" disabled={busy || loading || Number(amount) <= 0 || Boolean(refund && Number(amount) > refund.remaining)}>
          {refund ? "تأیید استرداد وجه" : "ثبت دریافت پیش‌پرداخت"}
        </button>
        {refund && <button type="button" className="cashier-quiet" onClick={clearPayment} disabled={busy}>انصراف از استرداد</button>}
      </form>}
    </>}
  </section>;
}

export function RepairInvoiceView({ draft, permissions, busy, run, onClose, onIssue, onApproval, onAdvance }: {
  draft: V2InvoiceDraft;
  permissions: V2FinancePermissions;
  busy: boolean;
  run: Run;
  onClose: () => void;
  onIssue: () => void;
  onApproval: () => void;
  onAdvance: () => void;
}) {
  const editId = useId();
  const draftKey = `tamiran:finance-review:${draft.receiptNumber}:${draft.lockVersion}`;
  const [lines, setLines] = useState<Line[]>(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved && permissions.issue) return JSON.parse(saved) as Line[];
    } catch { /* A stale browser draft does not block the server snapshot. */ }
    return draft.items;
  });
  const [edits, setEdits] = useState<Line[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const approvalKey = useRef<{ signature: string; key: string }>(undefined);
  const source = edits ?? lines;
  const amounts = source.reduce((sum, line) => {
    const amount = lineAmount(line);
    if (line.type === "part") sum.parts += amount.base;
    else if (line.type === "labor") sum.labor += amount.base;
    else sum.services += amount.base;
    sum.tax += amount.tax;
    sum.discount += Number(line.discountAmount);
    sum.total += amount.total;
    return sum;
  }, { parts: 0, labor: 0, services: 0, tax: 0, discount: 0, total: 0 });
  const difference = amounts.total - draft.authorizedAmount;
  const advance = draft.advanceAmount ?? 0;
  const invalid = source.some(line => !line.title.trim() || lineAmount(line).net < 0)
    || amounts.total > 1_000_000_000_000;
  const approvalOutstanding = draft.approvalAmount === amounts.total &&
    ["draft", "sent", "explanation_requested"].includes(draft.approvalStatus ?? "");
  const patch = (index: number, change: Partial<Line>) => setEdits(current =>
    current?.map((line, position) => index === position ? { ...line, ...change } : line) ?? null);
  const append = (type: "labor" | "other" | "diagnostic") => setEdits(current => [
    ...(current ?? []), { type, title: type === "other" ? "" : lineNames[type], quantity: 1,
      saleUnitPrice: 0, discountAmount: 0, taxRate: 0, warrantyDays: 0 },
  ]);
  async function issue() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await run(() => financeV2Action({
        action: "issue", caseId: draft.caseId, lockVersion: draft.lockVersion,
        expectedTotal: amounts.total, deferDelivery: true,
        idempotencyKey: `repair-invoice-${draft.caseId}`,
        items: lines.map(({ type, title, quantity, saleUnitPrice, discountAmount, taxRate, warrantyDays, sourceKey, referenceId }) =>
          ({ type, title: title.trim(), quantity: Number(quantity), saleUnitPrice: Number(saleUnitPrice),
            discountAmount: Number(discountAmount), taxRate: Number(taxRate), warrantyDays, sourceKey, referenceId })),
      }), "فاکتور تعمیرات صادر شد.");
      setConfirm(false);
      if (result) { sessionStorage.removeItem(draftKey); onIssue(); }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }
  async function requestApproval() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(lines));
      const signature = JSON.stringify(lines);
      if (approvalKey.current?.signature !== signature) {
        approvalKey.current = { signature, key: crypto.randomUUID() };
      }
      const key = approvalKey.current.key;
      const result = await run(async () => {
        const response = await workflowV2Action({
          action: "estimate_create", caseId: draft.caseId, lockVersion: draft.lockVersion,
          financeReapproval: true, idempotencyKey: key,
          reason: "تأیید افزایش مبلغ فاکتور تعمیرات",
          items: lines.map(line => ({ type: line.type, title: line.title, quantity: Number(line.quantity),
            unitPrice: Number(line.saleUnitPrice), discountAmount: Number(line.discountAmount), taxRate: Number(line.taxRate) })),
        }) as { estimate: { publicId: string } };
        return workflowV2Action({ action: "estimate_send", estimatePublicId: response.estimate.publicId, financeReapproval: true });
      }, "برآورد برای ثبت تأیید مشتری آماده شد.");
      if (result) onApproval();
    } finally {
      sendingRef.current = false;
    }
  }
  return <section className="cashier-sheet" aria-label="فاکتور تعمیرات">
    <FinanceHeader title="فاکتور تعمیرات" step={1} receipt={draft.receiptNumber}
      customer={draft.customerName} device={draft.device_title} technician={draft.technician_name}
      onClose={onClose} busy={busy} />
    <div className="cashier-line-heading">
      <div className="cashier-badges">
        <span>در انتظار صدور</span>
        {draft.unrepaired && <span>تعمیر نشد</span>}
        {draft.qualityStatus && <span>{draft.qualityStatus === "passed" ? "کنترل کیفیت تأیید شد" : "کنترل کیفیت در انتظار تکمیل"}</span>}
      </div>
      {!edits && permissions.issue && <button type="button" className="cashier-quiet" disabled={busy} onClick={() => setEdits(lines)}>اصلاح مبالغ</button>}
    </div>
    <table className="cashier-lines">
      <thead><tr><th scope="col">شرح</th><th scope="col">تعداد</th><th scope="col">قیمت فروش واحد</th><th scope="col">مبلغ ردیف</th></tr></thead>
      <tbody>{source.map((line, index) => <tr key={line.sourceKey ?? index}>
        <td>
          {edits && index >= lines.length ? <input aria-label={`شرح ردیف ${count.format(index + 1)}`} value={line.title}
            onChange={event => patch(index, { title: event.target.value })} maxLength={240} /> : <strong>{line.title}</strong>}
          <small>{line.sourceType ? sourceNames[line.sourceType] : lineNames[line.type]}</small>
        </td>
        <td data-label="تعداد">{count.format(Number(line.quantity))}</td>
        <td data-label="قیمت فروش واحد">
          {edits ? <>
            <div className="cashier-field">
              <label htmlFor={`${editId}-price-${index}`} className="cashier-sr">قیمت فروش واحد {line.title || count.format(index + 1)}</label>
              <MoneyInput id={`${editId}-price-${index}`} value={String(line.saleUnitPrice)} onChange={value => patch(index, { saleUnitPrice: Number(value) })} />
            </div>
            {permissions.manage && <div className="cashier-field">
              <label htmlFor={`${editId}-discount-${index}`}>تخفیف<span className="cashier-sr"> {line.title || count.format(index + 1)}</span></label>
              <MoneyInput id={`${editId}-discount-${index}`} value={String(line.discountAmount)} onChange={value => patch(index, { discountAmount: Number(value) })} />
            </div>}
          </> : money(Number(line.saleUnitPrice))}
        </td>
        <td data-label="مبلغ ردیف"><strong>{money(lineAmount(line).total)}</strong></td>
      </tr>)}</tbody>
    </table>
    {source.length === 0 && <p className="cashier-empty">هزینه‌ای برای این پرونده ثبت نشده است.</p>}
    {edits && <div className="cashier-actions cashier-edit-actions">
      <div>
        {draft.unrepaired
          ? <button type="button" className="cashier-quiet" onClick={() => append("diagnostic")}>افزودن هزینه عیب‌یابی</button>
          : <>
            <button type="button" className="cashier-quiet" onClick={() => append("labor")}>افزودن اجرت</button>
            <button type="button" className="cashier-quiet" onClick={() => append("other")}>افزودن هزینه</button>
          </>}
      </div>
      <div>
        <button type="button" className="cashier-quiet" onClick={() => setEdits(null)}>انصراف</button>
        <button type="button" className="cashier-primary" disabled={invalid} onClick={() => {
          setLines(edits);
          if (sessionStorage.getItem(draftKey)) sessionStorage.setItem(draftKey, JSON.stringify(edits));
          setEdits(null);
        }}>پایان اصلاح</button>
      </div>
    </div>}
    <div className="cashier-totals">
      <dl className="cashier-breakdown">
        <div><dt>جمع قیمت فروش قطعات</dt><dd>{money(amounts.parts)}</dd></div>
        <div><dt>جمع اجرت تعمیرات</dt><dd>{money(amounts.labor)}</dd></div>
        <div><dt>سایر هزینه‌ها</dt><dd>{money(amounts.services)}</dd></div>
        {amounts.discount > 0 && <div><dt>تخفیف</dt><dd>{money(amounts.discount)}</dd></div>}
        {amounts.tax > 0 && <div><dt>مالیات</dt><dd>{money(amounts.tax)}</dd></div>}
        {advance > 0 && <><div><dt>پیش‌پرداخت ثبت‌شده</dt><dd>{money(advance)}</dd></div>
          <div><dt>مانده پس از اعمال پیش‌پرداخت</dt><dd>{money(Math.max(0, amounts.total - advance))}</dd></div></>}
        <div><dt>مبلغ مورد تأیید مشتری</dt><dd>{money(draft.authorizedAmount)}</dd></div>
        <div className={difference > 0 ? "cashier-over-cap" : undefined}>
          <dt>اختلاف با مبلغ تأییدشده</dt><dd>{money(Math.abs(difference))}{difference !== 0 && (difference > 0 ? " بیشتر" : " کمتر")}</dd>
        </div>
      </dl>
      <div className="cashier-emphasis">
        <span>مبلغ نهایی فاکتور</span>
        <strong>{money(amounts.total)}</strong>
        {!edits && advance > amounts.total && <div>
          <p role="status">پیش‌پرداخت از مبلغ فاکتور بیشتر است. ابتدا مبلغ اضافه را مسترد کنید.</p>
          {permissions.manage && <button type="button" className="cashier-quiet" onClick={onAdvance}>تعیین تکلیف پیش‌پرداخت</button>}
        </div>}
        {!edits && advance <= amounts.total && (difference > 0 ? <>
          <p role="status">صدور فاکتور تا ثبت تأیید مشتری برای مبلغ جدید متوقف است.</p>
          {permissions.reapproval ? (approvalOutstanding && draft.approvalStatus !== "draft" ?
            <button type="button" className="cashier-quiet" onClick={onApproval}>رفتن به تأیید هزینه</button> :
            <button type="button" className="cashier-quiet" disabled={busy || invalid} onClick={() => void requestApproval()}>ارسال برای تأیید هزینه</button>) :
            <p>برای ثبت برآورد جدید، موضوع را به مدیر تعمیرگاه اطلاع دهید.</p>}
        </> : permissions.issue && <button type="button" className="cashier-primary" disabled={busy || invalid}
          onClick={() => setConfirm(true)}>تأیید فاکتور و ادامه به تسویه حساب</button>)}
      </div>
    </div>
    {confirm && <ConfirmAmount total={amounts.total} busy={busy || sending}
      onClose={() => setConfirm(false)} onConfirm={() => void issue()} />}
  </section>;
}

export function isOpenFinanceInvoice(invoice: V2Invoice) {
  return ["issued", "partially_paid", "paid"].includes(invoice.status) &&
    ["finance_pending", "qc_conditional"].includes(invoice.process_status);
}

function dateLabel(value: string | number) {
  const date = new Date(String(value).replace(" ", "T") + "Z");
  return Number.isNaN(date.valueOf()) ? "" : paymentDate.format(date);
}

export function SettlementView({ invoice, permissions, paymentMethods, mode, busy, run, onClose, onReferred, onRefund, continueToDelivery }: {
  invoice: V2Invoice;
  permissions: V2FinancePermissions;
  paymentMethods: RepairPaymentMethod[];
  mode: "work" | "refund";
  busy: boolean;
  run: Run;
  onClose: () => void;
  onReferred: () => void;
  continueToDelivery: boolean;
  onRefund: () => void;
}) {
  const fieldId = useId();
  const [amount, setAmount] = useState("");
  const [preferredMethod, setMethod] = useState<RepairPaymentMethod>("card");
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const [due, setDue] = useState("");
  const [receivableOpen, setReceivableOpen] = useState(false);
  const pending = useRef(false);
  const net = Number(invoice.paid_amount) - Number(invoice.refunded_amount);
  const settled = invoice.balance <= 0;
  const open = isOpenFinanceInvoice(invoice);
  const canReceive = ["issued", "partially_paid", "paid"].includes(invoice.status) && permissions.payment;
  const hasReceivable = invoice.receivables.some(row => ["open", "partially_paid", "overdue"].includes(String(row.status)));
  const canProceed = settled || hasReceivable;
  const stage = canProceed && open ? 3 : 2;
  const refund = mode === "refund";
  const choices = refund ? Object.keys(methods) as RepairPaymentMethod[] : paymentMethods;
  const method = choices.includes(preferredMethod) ? preferredMethod : choices[0];
  const maxAmount = refund ? net : invoice.balance;
  const transaction = async () => {
    if (pending.current || Number(amount) < 1 || Number(amount) > maxAmount) return;
    pending.current = true;
    const action = refund ? "refund" : "payment";
    const scopedKey = `tamiran:finance:${invoice.public_id}:${action}`;
    const signature = JSON.stringify([amount, method, tracking.trim(), reason.trim()]);
    const previous = window.sessionStorage.getItem(scopedKey);
    const [keyBefore, signBefore] = previous ? JSON.parse(previous) as [string, string] : [];
    const key = signBefore === signature ? keyBefore : crypto.randomUUID();
    window.sessionStorage.setItem(scopedKey, JSON.stringify([key, signature]));
    try {
      const result = await run(() => financeV2Action({
        action, amount: Number(amount), method, invoicePublicId: invoice.public_id,
        trackingNumber: tracking.trim(), reason: reason.trim(), idempotencyKey: key, deferDelivery: true,
      }), refund ? "سند استرداد ثبت شد." : "دریافت وجه ثبت شد.");
      if (result) {
        window.sessionStorage.removeItem(scopedKey);
        setAmount("");
        setTracking("");
        if (refund) onClose();
      }
    } finally {
      pending.current = false;
    }
  };
  const refer = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const result = await run(() => financeV2Action({ action: "refer_to_delivery", caseId: invoice.case_id }),
        continueToDelivery ? "تأیید مالی ثبت شد." : "پرونده به کارتابل تحویل ارجاع شد.");
      if (result) onReferred();
    } finally {
      pending.current = false;
    }
  };
  const status = settled ? "تسویه کامل" : net > 0 ? "پرداخت بخشی از مبلغ" : "پرداخت نشده";
  return <section className="cashier-sheet" aria-label={refund ? "استرداد وجه" : stage === 3 ? "ارجاع به تحویل" : "تسویه فاکتور"}>
    <FinanceHeader title={refund ? "استرداد وجه" : stage === 3 ? "ارجاع به تحویل" : !open && settled ? "فاکتور صادرشده" : "تسویه حساب"}
      step={refund ? undefined : stage} receipt={invoice.receipt_number} customer={invoice.customer_name}
      device={invoice.device_title} technician={invoice.technician_name} onClose={onClose} busy={busy} />
    <div className="cashier-settlement">
      <div className="cashier-emphasis">
        <span>{refund ? "وجه قابل استرداد" : "مانده قابل پرداخت"}</span>
        <strong>{money(maxAmount)}</strong>
        {!refund && <span className="cashier-settlement-status">{status}</span>}
      </div>
      <dl className="cashier-breakdown">
        <div><dt>شماره فاکتور</dt><dd><bdi>{invoice.invoice_number}</bdi></dd></div>
        <div><dt>مبلغ نهایی فاکتور</dt><dd>{money(Number(invoice.total_amount))}</dd></div>
        <div><dt>مجموع دریافتی‌ها</dt><dd>{money(Number(invoice.paid_amount))}</dd></div>
        {Number(invoice.refunded_amount) > 0 && <div><dt>مبلغ استردادشده</dt><dd>{money(Number(invoice.refunded_amount))}</dd></div>}
      </dl>
    </div>
    {stage === 3 && !refund ? <div className="cashier-handoff">
      <p role="status"><CheckCircle2 size={20} aria-hidden />{settled
        ? Number(invoice.total_amount) === 0 ? "این پرونده هزینه قابل پرداخت ندارد." : "تسویه حساب انجام شد"
        : "مجوز تحویل با مانده و تعهد پرداخت ثبت شد."}</p>
      {invoice.blockers.length > 0 && <ul className="cashier-blockers">{invoice.blockers.map(item => <li key={item}>{item}</li>)}</ul>}
      {permissions.payment && <button type="button" className="cashier-primary" disabled={busy || invoice.blockers.length > 0}
        onClick={() => void refer()}>{continueToDelivery ? "تأیید مالی و ادامه به تحویل" : "ارجاع به صف تحویل"}</button>}
    </div> : (refund || (!settled && canReceive)) && <form className="cashier-payment" onSubmit={event => { event.preventDefault(); void transaction(); }}>
      <div className="cashier-field">
        <label htmlFor={`${fieldId}-amount`}>{refund ? "مبلغ استرداد" : "مبلغ دریافت"}</label>
        <MoneyInput id={`${fieldId}-amount`} value={amount} onChange={setAmount} required disabled={busy} />
      </div>
      {!refund && <button type="button" className="cashier-quiet cashier-fill" disabled={busy} onClick={() => setAmount(String(invoice.balance))}>دریافت کل مانده</button>}
      <div className="cashier-field">
        <label htmlFor={`${fieldId}-method`}>روش {refund ? "استرداد" : "دریافت"}</label>
        <select id={`${fieldId}-method`} value={method} onChange={event => setMethod(event.target.value as keyof typeof methods)} disabled={busy}>
          {choices.map(key => <option key={key} value={key}>{methods[key]}</option>)}
        </select>
      </div>
      <label className="cashier-field"><span>شماره پیگیری <small>اختیاری</small></span>
        <input value={tracking} onChange={event => setTracking(event.target.value)} maxLength={160} disabled={busy} />
      </label>
      {refund && <label className="cashier-field"><span>علت استرداد</span>
        <input value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} required disabled={busy} />
      </label>}
      <button className="cashier-primary" disabled={busy || Number(amount) <= 0 || Number(amount) > maxAmount || (refund && !reason.trim())}>
        {busy ? "در حال ثبت…" : refund ? "ثبت سند استرداد" : "ثبت دریافت"}
      </button>
    </form>}
    {open && !canProceed && permissions.receivable && !refund && <div className="cashier-receivable">
      {receivableOpen ? <form className="cashier-payment" onSubmit={event => {
        event.preventDefault();
        if (!due || !reason.trim() || busy || pending.current) return;
        pending.current = true;
        void run(() => financeV2Action({
          action: "receivable", invoicePublicId: invoice.public_id, dueAt: `${due} 20:29:59`,
          customerCommitmentText: reason.trim(), evidence: { recordedByManager: true }, deferDelivery: true,
        }), "مجوز تحویل با مانده ثبت شد.").finally(() => { pending.current = false; });
      }}>
        <PersianDatePicker value={due} onChange={setDue} required ariaLabel="سررسید پرداخت مانده" />
        <label className="cashier-field"><span>تعهد پرداخت مشتری</span>
          <input value={reason} onChange={event => setReason(event.target.value)} required maxLength={4000} />
        </label>
        <button type="submit" className="cashier-quiet" disabled={busy || !due || !reason.trim()}>ثبت مجوز تحویل با مانده</button>
      </form> : <button type="button" className="cashier-quiet" onClick={() => setReceivableOpen(true)}>تعیین تکلیف مانده با مجوز مدیر</button>}
    </div>}
    {!refund && <section className="cashier-history" aria-label="سوابق دریافت">
      <div className="cashier-line-heading">
        <h4>دریافت‌های ثبت‌شده</h4>
        {permissions.manage && net > 0 && <button type="button" className="cashier-quiet"
          disabled={busy} onClick={onRefund}>ثبت اصلاح مالی</button>}
      </div>
      {invoice.payments.length === 0 ? <p className="cashier-empty">هنوز دریافتی ثبت نشده است.</p> :
        <ul>{invoice.payments.map(row => <li key={row.public_id}>
          <span>{String(row.idempotency_key).startsWith("advance:") && "پیش‌پرداخت · "}{methods[row.method as keyof typeof methods] ?? row.method}
            {row.tracking_number && <small>پیگیری <bdi>{row.tracking_number}</bdi></small>}
          </span>
          <time>{dateLabel(row.paid_at)}</time>
          <strong>{money(Number(row.amount))}</strong>
        </li>)}</ul>}
    </section>}
    {!open && !refund && <table className="cashier-lines">
      <thead><tr><th scope="col">شرح</th><th scope="col">تعداد</th><th scope="col">قیمت فروش واحد</th><th scope="col">مبلغ ردیف</th></tr></thead>
      <tbody>{invoice.items.map(row => <tr key={row.public_id}>
        <td><strong>{row.title}</strong></td>
        <td data-label="تعداد">{count.format(Number(row.quantity))}</td>
        <td data-label="قیمت فروش واحد">{money(Number(row.sale_unit_price))}</td>
        <td data-label="مبلغ ردیف"><strong>{money(Number(row.line_total))}</strong></td>
      </tr>)}</tbody>
    </table>}
  </section>;
}
