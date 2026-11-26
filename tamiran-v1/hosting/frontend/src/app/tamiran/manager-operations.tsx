import { useEffect, useState } from "react";
import { saveShopSetting } from "./directadmin-api";
import type { WorkspaceProfile } from "./access";
import { ExternalPurchasePanel } from "./external-purchase-panel";
import { MoneyInput } from "./money-input";
import { formatPersianDate, todayGregorianIso } from "./persian-date";
import { PersianDatePicker } from "./persian-date-picker";
import { loadManagerPulse, type ManagerPulseData, loadManagerPerformance, loadOperationsFollowups, loadV2Workflow, workflowV2Action, type ManagerPerformance, type OperationsFollowup, type OperationsPolicy, type V2Case, type V2User } from "./v2-api";

const followTitles = {
  customer: "عدم پاسخ مشتری", parts: "انتظار تأمین قطعه", pickup: "عدم مراجعه برای تحویل", late: "عبور از موعد",
};
type FollowReason = keyof typeof followTitles;
const hours = 3_600_000;
const fa = (value: number) => Number(value).toLocaleString("fa-IR");

export function ManagerPulse({ profile, onNavigate }: {
  profile: WorkspaceProfile; onNavigate: (page: string) => void;
}) {
  const [data, setData] = useState<ManagerPulseData>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState(() => new URLSearchParams(location.search).get("view") === "purchase-approvals" ? "purchases" : "followups");
  const multiTechnician = profile.productProfile !== "solo";
  const inventoryEnabled = profile.modules.includes("inventory");
  useEffect(() => {
    let current = true;
    void loadManagerPulse().then(result => { if (current) { setData(result); setError(""); } })
      .catch(error => { if (current) setError(error instanceof Error ? error.message : "نبض تعمیرگاه بارگذاری نشد."); });
    return () => { current = false; };
  }, [revision]);
  function assign(active = false, technician?: number, stage?: string) {
    if (!multiTechnician) return onNavigate("کارهای من");
    onNavigate("مدیریت ارجاع تعمیرات");
    const url = new URL(location.href);
    url.searchParams.set("assignmentTab", active ? "active" : "pending");
    if (technician) url.searchParams.set("assignmentTech", String(technician));
    if (stage) url.searchParams.set("assignmentStage", stage);
    history.replaceState(history.state, "", url);
  }
  function open(item: V2Case) {
    const target = ["ready_for_delivery", "returned_unrepaired", "finance_pending"].includes(item.status)
      ? (item.status === "finance_pending" ? "مالی پرونده" : "تحویل تعمیرات")
      : item.status === "awaiting_customer_approval" ? "تأیید هزینه"
      : item.status === "awaiting_parts" && inventoryEnabled ? "درخواست‌های قطعات پرونده‌ها"
      : item.status === "qc_pending" || item.status === "qc_conditional" ? "کنترل کیفیت"
      : multiTechnician ? "مدیریت ارجاع تعمیرات" : "کارهای من";
    if (["تأیید هزینه", "مدیریت ارجاع تعمیرات"].includes(target)) sessionStorage.setItem("tamiran:focused-workflow-case", String(item.id));
    if (["درخواست‌های قطعات پرونده‌ها", "کنترل کیفیت", "مالی پرونده", "تحویل تعمیرات"].includes(target)) sessionStorage.setItem("tamiran:focused-module-receipt", item.receiptNumber);
    onNavigate(target);
    const url = new URL(location.href);
    if (target === "کارهای من") url.searchParams.set("techCase", String(item.id));
    if (target === "تأیید هزینه") url.searchParams.set("opsTask", "approval");
    if (target === "مالی پرونده") url.searchParams.set("financeCase", String(item.id));
    if (target === "تحویل تعمیرات") url.searchParams.set("deliveryCase", String(item.id));
    if (target === "کنترل کیفیت") url.searchParams.set("qcCase", String(item.id));
    history.replaceState(history.state, "", url);
  }
  function focusFollowups() {
    setView("followups");
    const section = document.getElementById("manager-followups");
    section?.focus();
    section?.scrollIntoView({ block: "start" });
  }
  const stages = data?.stages ?? {};
  const sum = (...status: string[]) => status.reduce((total, key) => total + (stages[key] ?? 0), 0);
  const tiles = [
    { label: "پرونده‌های فعال", count: Object.values(stages).reduce((a, b) => a + b, 0), open: () => assign(true) },
    { label: "در انتظار ارجاع", count: sum("reception", "awaiting_assignment"), open: () => assign() },
    { label: "ارجاع‌شده و دریافت‌نشده", count: data?.awaitingReceipt, open: () => assign(true, undefined, "receipt") },
    { label: "در حال بررسی یا تعمیر", count: sum("assigned", "diagnosing", "estimate_pending", "repairing", "parts_closeout"), open: () => assign(true, undefined, "repairing") },
    { label: "دارای تأخیر", count: data?.overdue, open: focusFollowups },
    { label: "در انتظار مشتری", count: sum("awaiting_customer_approval"), open: () => onNavigate("تأیید هزینه") },
    { label: "در انتظار قطعه", count: sum("awaiting_parts"), open: () => inventoryEnabled ? onNavigate("درخواست‌های قطعات پرونده‌ها") : assign(true) },
    ...(profile.inventoryMode === "pro" ? [{ label: "تعهد داغی باز", count: data?.openHotReturns, open: () => onNavigate("تعهدات داغی") }] : []),
    { label: "کنترل کیفیت", count: sum("qc_pending", "qc_conditional"), open: () => onNavigate("کنترل کیفیت") },
    { label: "برگشتی از کنترل کیفیت", count: sum("qc_rework"), open: () => assign(true, undefined, "qc_rework") },
    { label: "در انتظار مالی", count: sum("finance_pending"), open: () => onNavigate("مالی پرونده") },
    { label: "آماده تحویل", count: sum("ready_for_delivery", "returned_unrepaired"), open: () => onNavigate("تحویل تعمیرات") },
  ];
  return <div className="technical-desk manager-workspace manager-pulse" dir="rtl">
    <header className="manager-section-header"><h2>{profile.shopName}</h2><button type="button" onClick={() => setRevision(value => value + 1)}>تازه‌سازی</button></header>
    {error && <p role="alert" className="tech-error">{error}</p>}
    {!data && !error && <p role="status">در حال دریافت وضعیت تعمیرگاه…</p>}
    {data && <div className="manager-pulse-grid" aria-label="صف‌های عملیاتی">
      {tiles.map(tile => <button type="button" key={tile.label} onClick={tile.open}><span>{tile.label}</span><strong>{fa(tile.count ?? 0)}</strong></button>)}
    </div>}
    <section className="tech-task manager-pulse-work" id="manager-followups" tabIndex={-1}>
      <div className="manager-switch" role="group" aria-label="درخواست‌ها و پیگیری‌ها">
        <button type="button" aria-pressed={view === "followups"} onClick={() => setView("followups")}>پرونده‌های نیازمند پیگیری</button>
        <button type="button" aria-pressed={view === "purchases"} onClick={() => setView("purchases")}>مجوز خرید قطعه</button>
      </div>
      {view === "followups" ? <OperationsFollowups key={revision} open={open} />
        : <ExternalPurchasePanel key={revision} actorId={profile.actorId} />}
    </section>
    {data && multiTechnician && <section className="tech-task manager-pulse-load">
      <h3>بار کاری تکنسین‌ها</h3>
      {data.technicians.length ? <ul className="manager-workload-list">{data.technicians.map(person =>
        <li key={person.id}><button type="button" onClick={() => assign(true, person.id)}>
          <strong>{person.name}</strong><span>{fa(person.active)} فعال · {fa(person.awaitingReceipt)} منتظر دریافت · {fa(person.overdue)} دارای تأخیر</span>
        </button></li>)}</ul> : <p>تکنسین فعالی در این شعبه ثبت نشده است.</p>}
    </section>}
  </div>;
}

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
    <fieldset disabled={busy} className="tech-form-grid manager-policy-grid">
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

export function OperationsPerformance({ open }: { open: (item: V2Case) => void }) {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * hours).toISOString().slice(0, 10));
  const [to, setTo] = useState(todayGregorianIso);
  const [rows, setRows] = useState<ManagerPerformance[]>();
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number>();
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
  async function openCompleted(id: number) {
    try {
      const item = (await loadV2Workflow(id)).cases[0];
      if (!item) throw new Error("پرونده در دسترسی فعلی موجود نیست.");
      open(item);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "پرونده باز نشد.");
    }
  }
  return <section className="manager-performance">
    <h3>عملکرد تکنسین‌ها</h3>
    <form onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <div className="tech-form-grid manager-report-filters">
        <div><span>از تاریخ</span><PersianDatePicker ariaLabel="تاریخ آغاز گزارش" value={from} onChange={setFrom} /></div>
        <div><span>تا تاریخ</span><PersianDatePicker ariaLabel="تاریخ پایان گزارش" value={to} onChange={setTo} /></div>
      </div>
      <button type="submit" disabled={busy || !from || !to}>دریافت گزارش</button>
    </form>
    {error && <p role="alert" className="tech-error">{error}</p>}
    {rows && <>
      {!visible.length && <p role="status">تکنسینی با این فیلتر یافت نشد.</p>}
      <label>جست‌وجوی تکنسین<input value={search} onChange={(event) => { setSearch(event.target.value); setSelected(""); }} /></label>
      <label>تکنسین<select value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">مقایسه همه</option>
        {filtered.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      <ul className="tech-plain-list manager-report-grid">{visible.map((row) => {
        const total = row.repaired + row.unrepaired;
        const successBasis = row.repaired + row.technicalFailures;
        return <li key={row.id}>
          <h4>{row.name}</h4>
          <label>تعداد پایان فنی <meter min={0} max={maximum} value={total}>{fa(total)}</meter> {fa(total)}</label>
          <p>تعمیر موفق {fa(row.repaired)} · پایان بدون تعمیر {fa(row.unrepaired)}</p>
          <p>ارجاع اولیه در بازه {fa(row.assigned)} · پروندهٔ فعال فعلی: {fa(row.active)} · تحویل ثبت‌شده: {fa(row.delivered)}</p>
          <p>تعمیر موفق: {successBasis ? `${fa(Math.round(100 * row.repaired / successBasis))}٪ (${fa(row.repaired)} از ${fa(successBasis)})` : "داده کافی نیست"} · مردودی کنترل کیفیت: {row.qcRuns ? `${fa(Math.round(100 * row.qcFailures / row.qcRuns))}٪ (${fa(row.qcFailures)} از ${fa(row.qcRuns)})` : "داده کافی نیست"}</p>
          <p>رعایت موعد اولیه: {row.withInitialDue ? `${fa(row.onTime)} از ${fa(row.withInitialDue)} پروندهٔ دارای موعد` : "داده کافی نیست"}</p>
          {row.unrepaired > row.technicalFailures && <p>پایان بدون تعمیر با علت غیرفنی یا نامشخص: {fa(row.unrepaired - row.technicalFailures)}</p>}
          {!!Object.keys(row.stageTimes).length && <ul aria-label="میانگین زمان مرحله‌های تکمیل‌شده">{Object.entries(row.stageTimes).map(([key, second]) =>
            <li key={key}>{({ diagnosing: "عیب‌یابی", repairing: "تعمیر", awaiting_customer_approval: "انتظار مشتری", awaiting_parts: "انتظار قطعه", purchase: "انتظار مجوز خرید", transfer: "انتظار انتقال" } as Record<string, string>)[key]} · {fa(Math.round(second / 60))} دقیقه</li>)}</ul>}
          {selected && !!Object.keys(row.trend).length && <section>
            <h5>روند پایان فنی در روزهای دارای ثبت</h5>
            <ul className="manager-trend">{Object.entries(row.trend).sort(([first], [second]) => first.localeCompare(second)).map(([day, total]) =>
              <li key={day}><span>{formatPersianDate(day)}</span><meter min={0} max={Math.max(1, ...Object.values(row.trend))} value={total} /> <span>{fa(total)}</span></li>)}</ul>
          </section>}
          {row.completedCases.length > 0 && <button type="button" aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? undefined : row.id)}>پرونده‌های پایان فنی</button>}
          {expanded === row.id && <ul className="manager-workload-list" aria-label="پرونده‌های پایان فنی">
            {row.completedCases.map(item => <li key={item.id}><button type="button" onClick={() => void openCompleted(item.id)}>
              <bdi>{item.receiptNumber}</bdi><span>{item.result === "repaired" ? "تعمیر موفق" : "پایان بدون تعمیر"}</span></button></li>)}
          </ul>}
          {!!row.transferReasons.length && <ul>{row.transferReasons.map((reason) =>
            <li key={reason.label}>{reason.label} · {fa(reason.count)}</li>)}</ul>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
