import { useEffect, useState } from "react";
import { saveShopSetting } from "./directadmin-api";
import { MoneyInput } from "./money-input";
import { PersianDatePicker } from "./persian-date-picker";
import { loadManagerPerformance, loadOperationsFollowups, loadV2Workflow, workflowV2Action, type ManagerPerformance, type OperationsFollowup, type OperationsPolicy, type V2Case, type V2User } from "./v2-api";

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

export function OperationsFollowups({ open }: { open: (item: V2Case) => void }) {
  const [filter, setFilter] = useState<FollowReason | "all">("all");
  const [rows, setRows] = useState<OperationsFollowup[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setRows([]);
    setOffset(null);
    setError("");
    loadOperationsFollowups(filter).then((data) => {
      if (active) { setRows(data.rows); setOffset(data.nextOffset); setLoading(false); }
    }, (failure: Error) => {
      if (active) { setError(failure.message); setLoading(false); }
    });
    return () => { active = false; };
  }, [filter]);
  async function loadMore() {
    if (offset === null) return;
    setBusy(true);
    try {
      const data = await loadOperationsFollowups(filter, offset);
      setRows((current) => [...current, ...data.rows.filter((item) => !current.some((previous) => previous.caseId === item.caseId))]);
      setOffset(data.nextOffset);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "دریافت پرونده‌های بیشتر انجام نشد.");
    } finally { setBusy(false); }
  }
  async function openCase(id: number) {
    setBusy(true);
    try {
      const result = await loadV2Workflow(id);
      if (!result.cases[0]) throw new Error("پرونده در دسترسی فعلی پیدا نشد.");
      open(result.cases[0]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "پرونده باز نشد.");
    } finally { setBusy(false); }
  }
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
    <label>علت پیگیری<select disabled={busy} value={filter} onChange={(event) => setFilter(event.target.value as FollowReason | "all")}>
      <option value="all">همه</option>
      {Object.entries(followTitles).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
    </select></label>
    <p>{fa(rows.length)} پروندهٔ بارگذاری‌شده</p>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="tech-error">{error}</p>}
    <ul className="tech-plain-list">{rows.map((item) => <li key={item.caseId}>
      <p>{item.deviceTitle} · <bdi>{item.receiptNumber}</bdi> · {item.technicianName || "بدون مسئول"}</p>
      <p>{item.statusLabel}</p>
      <p>{item.reasons.map(({ name, elapsedSeconds }) => `${followTitles[name]} · ${fa(Math.floor(elapsedSeconds / 3600))} ساعت`).join("، ")}</p>
      <label>نتیجه پیگیری <bdi>{item.receiptNumber}</bdi>
        <input value={notes[item.caseId] ?? ""} maxLength={4000} onChange={(event) => setNotes({ ...notes, [item.caseId]: event.target.value })} />
      </label>
      <div className="tech-handover-actions">
        <button type="button" disabled={busy} onClick={() => void openCase(item.caseId)}>بازکردن مرحلهٔ پرونده</button>
        <button type="button" disabled={busy || !notes[item.caseId]?.trim()} onClick={() => void saveNote(item.caseId)}>ثبت پیگیری</button>
      </div>
    </li>)}</ul>
    {offset !== null && <button disabled={busy} type="button" onClick={() => void loadMore()}>نمایش پرونده‌های بیشتر</button>}
    {loading && <p role="status">در حال بارگذاری…</p>}
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
          <p>رعایت موعد اولیه: {row.withInitialDue ? `${fa(row.onTime)} از ${fa(row.withInitialDue)} پروندهٔ دارای موعد` : "داده کافی نیست"}</p>
          {row.unrepaired > row.technicalFailures && <p>پایان بدون تعمیر با علت غیرفنی یا نامشخص: {fa(row.unrepaired - row.technicalFailures)}</p>}
          {!!Object.keys(row.stageTimes).length && <ul aria-label="میانگین زمان مرحله‌های تکمیل‌شده">{Object.entries(row.stageTimes).map(([key, second]) =>
            <li key={key}>{({ diagnosing: "عیب‌یابی", repairing: "تعمیر", awaiting_customer_approval: "انتظار مشتری", awaiting_parts: "انتظار قطعه", purchase: "انتظار مجوز خرید", transfer: "انتظار انتقال" } as Record<string, string>)[key]} · {fa(Math.round(second / 60))} دقیقه</li>)}</ul>}
          {!!row.transferReasons.length && <ul>{row.transferReasons.map((reason) =>
            <li key={reason.label}>{reason.label} · {fa(reason.count)}</li>)}</ul>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
