import { useState } from "react";
import { saveShopSetting } from "./directadmin-api";
import { MoneyInput } from "./money-input";
import { PersianDatePicker } from "./persian-date-picker";
import { queueTimestamp } from "./queue-search";
import { loadManagerPerformance, workflowV2Action, type ManagerPerformance, type OperationsPolicy, type V2Case, type V2User } from "./v2-api";

const followTitles = {
  customer: "عدم پاسخ مشتری", parts: "انتظار تأمین قطعه", pickup: "عدم مراجعه برای تحویل", late: "عبور از موعد",
};
type FollowReason = keyof typeof followTitles;
const hours = 3_600_000;
const fa = (value: number) => Number(value).toLocaleString("fa-IR");

export function OperationsPolicyForm({ policy, users, onSaved }: {
  policy: OperationsPolicy; users: V2User[]; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(policy);
  const [newTitle, setNewTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = (update: Partial<OperationsPolicy>) => setForm((old) => ({ ...old, ...update }));
  async function save() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await saveShopSetting("operations_policy", form);
      await onSaved();
      setMessage("تنظیمات عملیات ذخیره شد.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "تنظیمات ذخیره نشد.");
    } finally {
      setBusy(false);
    }
  }
  return <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <fieldset disabled={busy} className="tech-form-grid">
      <legend>سیاست‌های تعمیرگاه</legend>
      <label>سیاست ارجاع
        <select aria-label="سیاست ارجاع" value={form.handover} onChange={(event) => patch({ handover: event.target.value as OperationsPolicy["handover"] })}>
          <option value="direct">مستقیم با تأیید دریافت مقصد</option>
          <option value="manager">با تأیید مدیر و سپس دریافت مقصد</option>
          <option value="disabled">صرفاً توسط مدیر</option>
        </select>
      </label>
      <label>روش تأیید مشتری
        <select value={form.approval} onChange={(event) => patch({ approval: event.target.value as OperationsPolicy["approval"] })}>
          <option value="both">تلفنی و پیامکی</option>
          <option value="phone">فقط تلفنی</option>
          <option value="sms">فقط پیامکی</option>
        </select>
      </label>
      <label>سیاست خرید خارج از انبار
        <select value={form.purchase} onChange={(event) => patch({ purchase: event.target.value as OperationsPolicy["purchase"] })}>
          <option value="free">بدون مجوز مدیر</option>
          <option value="approval">همهٔ خریدها با مجوز مدیر</option>
          <option value="limit">سقف اختصاصی هر تکنسین در هر پرونده</option>
        </select>
      </label>
      {form.purchase === "limit" && <section>
        <h3>سقف خرید تکنسین‌ها</h3>
        {users.filter((user) => user.role === "technician").map((user) =>
          <label key={user.id}>{user.display_name}
            <MoneyInput value={String(form.purchaseLimits[user.id] ?? 0)}
              onChange={(value) => patch({ purchaseLimits: { ...form.purchaseLimits, [user.id]: Number(value) } })} />
          </label>)}
      </section>}
      <section>
        <h3>علت‌های ارجاع</h3>
        {form.reasons.map((reason) => <label className="tech-handover-check" key={reason.id}>
          <input type="checkbox" checked={reason.active} disabled={reason.id === "other"} onChange={(event) =>
            patch({ reasons: form.reasons.map((row) => row.id === reason.id ? { ...row, active: event.target.checked } : row) })} /> {reason.title}
        </label>)}
        <label>نام علت جدید<input maxLength={180} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></label>
        <button type="button" disabled={!newTitle.trim() || form.reasons.length >= 100} onClick={() => {
          patch({ reasons: [...form.reasons, { id: crypto.randomUUID(), title: newTitle.trim(), active: true }] });
          setNewTitle("");
        }}>افزودن علت</button>
      </section>
      <section>
        <h3>حدود پیگیری به ساعت</h3>
        {(["customer", "parts", "pickup"] as const).map((name) => <label key={name}>{followTitles[name]}
          <input type="number" required min={1} max={8760} step={1} value={form.followHours[name]}
            onChange={(event) => patch({ followHours: { ...form.followHours, [name]: Number(event.target.value) } })} />
        </label>)}
      </section>
      <button type="submit" className="tech-primary">ذخیرهٔ سیاست‌ها</button>
      {error && <p role="alert" className="tech-error">{error}</p>}
      {message && <p role="status">{message}</p>}
    </fieldset>
  </form>;
}

function aged(caseItem: V2Case, now: number, policy: OperationsPolicy) {
  const reasons: Array<{ name: FollowReason; elapsed: number }> = [];
  const elapsed = (stamp?: string | null) => stamp ? now - queueTimestamp(stamp).getTime() : -1;
  if (caseItem.deliveredAt || ["delivered", "closed", "cancelled"].includes(caseItem.status)) return reasons;
  if (caseItem.holdReason === "customer" && elapsed(caseItem.waitStartedAt) >= hours * policy.followHours.customer) {
    reasons.push({ name: "customer", elapsed: elapsed(caseItem.waitStartedAt) });
  }
  if (caseItem.holdReason === "part" && elapsed(caseItem.waitStartedAt) >= hours * policy.followHours.parts) {
    reasons.push({ name: "parts", elapsed: elapsed(caseItem.waitStartedAt) });
  }
  if (["ready_for_delivery", "returned_unrepaired"].includes(caseItem.status)) {
    if (elapsed(caseItem.pickupStartedAt) >= hours * policy.followHours.pickup)
      reasons.push({ name: "pickup", elapsed: elapsed(caseItem.pickupStartedAt) });
  } else if (elapsed(caseItem.promisedAt) > 0) {
    reasons.push({ name: "late", elapsed: elapsed(caseItem.promisedAt) });
  }
  return reasons;
}

export function OperationsFollowups({ cases, now, policy, open }: {
  cases: V2Case[]; now: string; policy: OperationsPolicy; open: (item: V2Case) => void;
}) {
  const [filter, setFilter] = useState<FollowReason | "all">("all");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const rows = cases.map((item) => ({ item, reasons: aged(item, queueTimestamp(now).getTime(), policy) }))
    .filter((row) => row.reasons.length && (filter === "all" || row.reasons.some((reason) => reason.name === filter)))
    .sort((a, b) => Math.max(...b.reasons.map((r) => r.elapsed)) - Math.max(...a.reasons.map((r) => r.elapsed)));
  async function saveNote(caseId: number) {
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await workflowV2Action({ action: "followup_note", caseId, message: notes[caseId].trim(), idempotencyKey: crypto.randomUUID() });
      setNotes((old) => ({ ...old, [caseId]: "" }));
      setMessage("نتیجهٔ پیگیری در پرونده ثبت شد.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "ثبت پیگیری انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  return <section>
    <h3>پرونده‌های نیازمند پیگیری</h3>
    <label>علت پیگیری<select value={filter} onChange={(event) => setFilter(event.target.value as FollowReason | "all")}>
      <option value="all">همه</option>
      {Object.entries(followTitles).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
    </select></label>
    <p>{fa(rows.length)} پرونده</p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="tech-error">{error}</p>}
    <ul className="tech-plain-list">{rows.map(({ item, reasons }) => <li key={item.id}>
      <p>{item.deviceTitle} · <bdi>{item.receiptNumber}</bdi> · {item.technicianName || "بدون مسئول"}</p>
      <p>{item.technicianView.statusLabel}</p>
      <p>{reasons.map(({ name, elapsed }) => `${followTitles[name]} · ${fa(Math.floor(elapsed / hours))} ساعت`).join("، ")}</p>
      <label>نتیجه پیگیری <bdi>{item.receiptNumber}</bdi>
        <input value={notes[item.id] ?? ""} maxLength={4000} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} />
      </label>
      <div className="tech-handover-actions">
        <button type="button" onClick={() => open(item)}>بازکردن مرحلهٔ پرونده</button>
        <button type="button" disabled={busy || !notes[item.id]?.trim()} onClick={() => void saveNote(item.id)}>ثبت پیگیری</button>
      </div>
    </li>)}</ul>
  </section>;
}

export function OperationsPerformance() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * hours).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<ManagerPerformance[]>();
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const filtered = rows?.filter((row) => row.name.includes(search.trim())) ?? [];
  const visible = filtered.filter((row) => !selected || row.id === Number(selected));
  const maximum = Math.max(1, ...filtered.map((row) => row.repaired + row.unrepaired));
  async function load() {
    setBusy(true);
    setError("");
    try {
      setRows((await loadManagerPerformance(from, to)).rows);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "گزارش بارگذاری نشد.");
    } finally {
      setBusy(false);
    }
  }
  return <section>
    <h3>عملکرد تکنسین‌ها</h3>
    <form onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <div className="tech-form-grid">
        <div><span>از تاریخ</span><PersianDatePicker ariaLabel="تاریخ آغاز گزارش" value={from} onChange={setFrom} /></div>
        <div><span>تا تاریخ</span><PersianDatePicker ariaLabel="تاریخ پایان گزارش" value={to} onChange={setTo} /></div>
      </div>
      <button type="submit" disabled={busy || !from || !to}>دریافت گزارش</button>
    </form>
    {error && <p role="alert" className="tech-error">{error}</p>}
    {rows && <>
      <label>جست‌وجوی تکنسین<input value={search} onChange={(event) => { setSearch(event.target.value); setSelected(""); }} /></label>
      <label>تکنسین<select value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">مقایسه همه</option>
        {filtered.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      <ul className="tech-plain-list">{visible.map((row) => {
        const total = row.repaired + row.unrepaired;
        const successBasis = row.repaired + row.technicalFailures;
        return <li key={row.id}>
          <h4>{row.name}</h4>
          <label>تعداد پایان فنی <meter min={0} max={maximum} value={total}>{fa(total)}</meter> {fa(total)}</label>
          <p>پروندهٔ فعال فعلی: {fa(row.active)} · تحویل ثبت‌شده: {fa(row.delivered)}</p>
          <p>تعمیر موفق: {successBasis ? `${fa(Math.round(100 * row.repaired / successBasis))}٪` : "داده کافی نیست"} · مردودی کنترل کیفیت: {row.qcRuns ? `${fa(Math.round(100 * row.qcFailures / row.qcRuns))}٪` : "داده کافی نیست"}</p>
          {row.unrepaired > row.technicalFailures && <p>پایان بدون تعمیر با علت غیرفنی یا نامشخص: {fa(row.unrepaired - row.technicalFailures)}</p>}
          {!!Object.keys(row.stageTimes).length && <ul aria-label="میانگین زمان مرحله‌های تکمیل‌شده">{Object.entries(row.stageTimes).map(([key, second]) =>
            <li key={key}>{({ diagnosing: "عیب‌یابی", repairing: "تعمیر", awaiting_customer_approval: "انتظار مشتری", awaiting_parts: "انتظار قطعه" } as Record<string, string>)[key]} · {fa(Math.round(second / 60))} دقیقه</li>)}</ul>}
          {!!row.transferReasons.length && <ul>{row.transferReasons.map((reason) =>
            <li key={reason.label}>{reason.label} · {fa(reason.count)}</li>)}</ul>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
