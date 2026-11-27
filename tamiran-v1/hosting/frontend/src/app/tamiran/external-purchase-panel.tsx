import { useEffect, useId, useRef, useState } from "react";
import { MoneyInput, formatToman } from "./money-input";
import { changeExternalPurchase, loadExternalPurchases, searchExternalCatalog, workflowV2Action, type ExternalPurchase, type ExternalPurchasePayload } from "./v2-api";

const labels: Record<ExternalPurchase["status"], string> = {
  pending: "منتظر مجوز", approved: "مجاز به خرید", rejected: "رد شده",
  bought: "خرید انجام شده، منتظر دریافت", received: "دریافت‌شده", used: "مصرف‌شده", returning: "در انتظار تعیین تکلیف فیزیکی", returned: "مرجوع شده", cancelled: "لغو شده",
};
const disposals: Record<string, string> = {
  supplier: "مرجوعی به تأمین‌کننده", stock: "ورود به موجودی انبار", damage: "تعیین تکلیف خسارت", nonrecoverable: "ضایعات غیرقابل برگشت",
};
const toman = (amount: number) => `${formatToman(String(amount))} تومان`;

export function ExternalPurchasePanel({ caseId, actorId, canWrite = true, onChanged }: {
  caseId?: number;
  actorId: number;
  canWrite?: boolean;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<ExternalPurchasePayload>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<ExternalPurchasePayload["catalog"][number]>();
  const [results, setResults] = useState<ExternalPurchasePayload["catalog"]>();
  const [editing, setEditing] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cost, setCost] = useState("");
  const [lines, setLines] = useState<Array<{ itemId: number; title: string; quantity: number; unitCost: number }>>([]);
  const [disposal, setDisposal] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState({ code: "", title: "", category: "", salePrice: "" });
  const [newItemOpen, setNewItemOpen] = useState(false);
  const categoryLabel = useId();
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const request = useRef({ key: "", signature: "" });
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let mounted = true;
    loadExternalPurchases(caseId).then((payload) => { if (mounted) setData(payload); }, (failure: Error) => {
      if (mounted) setError(failure.message);
    });
    return () => { mounted = false; };
  }, [caseId, generation]);
  useEffect(() => {
    if (!caseId || !search.trim() || selection) { setResults(undefined); return; }
    let current = true;
    setResults(undefined);
    const timer = window.setTimeout(() => {
      void searchExternalCatalog(caseId, search.trim()).then(payload => {
        if (current) setResults(payload.items);
      }).catch((failure: Error) => { if (current) setError(failure.message); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [caseId, search, selection]);
  async function submit(payload: Record<string, unknown>, saved?: () => void) {
    if (busy) return;
    const signature = JSON.stringify(payload);
    if (request.current.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await changeExternalPurchase({ ...payload, idempotencyKey: request.current.key });
      request.current = { key: "", signature: "" };
      saved?.();
      setGeneration((value) => value + 1);
      onChanged?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "ثبت خرید انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function addCatalog() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await workflowV2Action({ action: "external_catalog_add", caseId, ...newItem, salePrice: Number(newItem.salePrice || 0) });
      setNewItem({ code: "", title: "", category: "", salePrice: "" });
      setNewItemOpen(false);
      setGeneration((value) => value + 1);
      if (caseId) { setSearch(""); setSelection({ id: Number(result.id), title: newItem.title, code: newItem.code, salePrice: Number(result.salePrice ?? 0) }); }
      setMessage(result.created ? "کالا به بانک قطعات اضافه شد." : "کالا از قبل در بانک قطعات ثبت شده است.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "تعریف کالا انجام نشد.");
    } finally { setBusy(false); }
  }
  function addLine() {
    if (!selection || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 || Number(cost) <= 0) return;
    const line = { itemId: selection.id, title: selection.title, quantity: Number(quantity), unitCost: Number(cost) };
    setLines(editing === null ? [...lines, line] : lines.map((row, index) => index === editing ? line : row));
    setEditing(null);
    setSelection(undefined);
    setSearch("");
    setCost("");
    setQuantity("1");
  }
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const committed = data?.ownCommitted ?? 0;
  const approval = data?.policy === "approval" || (data?.policy === "limit" && committed + total > data.ownLimit);
  return <section>
    <h3>{caseId ? "خرید قطعه خارج از انبار" : "مجوزهای خرید در انتظار"}</h3>
    {error && <p role="alert" className="tech-error">{error}</p>}
    {!data && !error && <p role="status">در حال بارگذاری…</p>}
    {message && <p role="status">{message}</p>}
    {caseId && canWrite && data?.canManageCatalog && <>
      <button type="button" onClick={() => setNewItemOpen(!newItemOpen)}>{newItemOpen ? "بستن تعریف کالا" : "تعریف کالای جدید"}</button>
      {newItemOpen && <form onSubmit={(event) => { event.preventDefault(); void addCatalog(); }} className="tech-form-grid">
        <label>کد کالا<input required maxLength={80} value={newItem.code} onChange={(event) => setNewItem({ ...newItem, code: event.target.value })} /></label>
        <label>نام کالا<input required maxLength={180} value={newItem.title} onChange={(event) => setNewItem({ ...newItem, title: event.target.value })} /></label>
        <label><span id={categoryLabel}>دسته‌بندی</span>
          {data.canPriceCatalog ? <input aria-labelledby={categoryLabel} maxLength={120} value={newItem.category} onChange={(event) => setNewItem({ ...newItem, category: event.target.value })} />
            : <select aria-labelledby={categoryLabel} value={newItem.category} onChange={(event) => setNewItem({ ...newItem, category: event.target.value })}>
              <option value="">بدون دسته‌بندی</option>
              {data.catalogCategories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>}
        </label>
        {data.canPriceCatalog && <label>قیمت فروش واحد<MoneyInput value={newItem.salePrice} onChange={(salePrice) => setNewItem({ ...newItem, salePrice })} /></label>}
        <button type="submit" disabled={busy}>ثبت کالا در بانک قطعات</button>
      </form>}
    </>}
    {caseId && data && canWrite && <div className="tech-form-grid">
      {data.policy === "limit" && <p>اختیار باقی‌مانده در این پرونده {toman(Math.max(0, data.ownLimit - committed))}</p>}
      <label>جست‌وجوی بانک قطعات<input maxLength={120} value={search}
        onChange={(event) => { setSelection(undefined); setSearch(event.target.value); }} /></label>
      {selection ? <p className="tech-v7-callout"><strong>{selection.title}</strong> · <bdi>{selection.code}</bdi>{" "}
        <button type="button" onClick={() => setSelection(undefined)}>تغییر قطعه</button></p>
        : search.trim() && (results ? results.length ? <ul className="tech-catalog-results" aria-label="نتایج قطعات">
          {results.map(part => <li key={part.id}><button type="button" onClick={() => setSelection(part)}><span>{part.title}</span><bdi>{part.code}</bdi></button></li>)}
        </ul> : <p role="status">قطعه‌ای پیدا نشد.</p> : <p role="status">در حال جست‌وجو…</p>)}
      {selection && <div className="tech-form-grid">
        <label>تعداد خرید<input type="number" min={1} max={10000} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label>بهای خرید واحد<MoneyInput value={cost} onChange={setCost} /></label>
        <button type="button" disabled={!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 10000 || !Number(cost) || (lines.length >= 30 && editing === null) || busy}
          onClick={addLine}>{editing === null ? "افزودن به ردیف‌های خرید" : "اعمال تغییر ردیف"}</button>
      </div>}
      {!!lines.length && <ul className="tech-plain-list">{lines.map((line, index) => <li key={index}>
        <strong>{line.title}</strong> · {line.quantity.toLocaleString("fa-IR")} عدد × {toman(line.unitCost)} · {toman(line.quantity * line.unitCost)}
        <div className="tech-handover-actions">
          <button type="button" disabled={busy || editing !== null} onClick={() => {
            setSelection({ id: line.itemId, title: line.title, code: "", salePrice: 0 });
            setQuantity(String(line.quantity)); setCost(String(line.unitCost)); setEditing(index);
          }}>اصلاح ردیف</button>
          <button type="button" disabled={busy || editing !== null} onClick={() => setLines(lines.filter((_, i) => i !== index))}>حذف ردیف</button>
        </div>
      </li>)}</ul>}
      {!!lines.length && <p className="tech-v7-callout"><strong>مجموع خرید {toman(total)}</strong></p>}
      <button className="tech-primary" type="button" disabled={!lines.length || busy || editing !== null} onClick={() => void submit({
        caseId, decision: "request", purchase: !approval, lines: lines.map(({ itemId, quantity, unitCost }) => ({ itemId, quantity, unitCost })),
      }, () => setLines([]))}>{approval ? "ارسال درخواست خرید به مدیر" : "ثبت خرید قطعات"}</button>
    </div>}
    {!!data && !data.rows.length && <p>موردی ثبت نشده است.</p>}
    {!!data?.rows.length && <ul className="tech-plain-list">{data.rows.map((row) => {
      const editable = canWrite && (!caseId || row.requestedBy === actorId || ["bought", "received"].includes(row.status));
      const actions = !editable ? [] : !caseId ? (row.status === "returning" ? [["confirm_return", "تأیید تعیین تکلیف فیزیکی"]] : [["approve", "تأیید خرید"], ["reject", "رد درخواست"]])
        : row.status === "pending" ? [["cancel", "لغو درخواست"]]
        : row.status === "approved" ? [["buy", "ثبت خرید واقعی"], ["cancel", "لغو خرید"]]
        : row.status === "bought" ? [["receive", "ثبت دریافت قطعه"]]
        : row.status === "received" ? [["use", "ثبت مصرف"], ["return", "ثبت عودت"]]
        : [];
      return <li key={row.publicId}>
        <p><strong>{row.title}</strong> · {row.quantity.toLocaleString("fa-IR")} عدد · {labels[row.status]}</p>
        {row.disposition && <p>{disposals[row.disposition]}</p>}
        {!caseId && <p>رسید <bdi>{row.receiptNumber}</bdi></p>}
        {row.total !== undefined && <p>{toman(row.total)}</p>}
        {row.decisionNote && <p>{row.decisionNote}</p>}
        {!!actions.length && <>
          {caseId && row.status === "received" && <label>روش تعیین تکلیف
            <select value={disposal[row.publicId] ?? "supplier"} onChange={(event) => setDisposal({ ...disposal, [row.publicId]: event.target.value })}>
              {Object.entries(disposals).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select></label>}
          <label>توضیح خرید {row.title}<input value={note[row.publicId] ?? ""} onChange={(event) => setNote({ ...note, [row.publicId]: event.target.value })} /></label>
          <div className="tech-handover-actions">{actions.map(([decision, label]) =>
            <button key={decision} type="button" disabled={busy || (["reject", "return", "confirm_return", "cancel"].includes(decision) && !note[row.publicId]?.trim())}
              onClick={() => void submit({ caseId: row.caseId, publicId: row.publicId, decision, disposition: disposal[row.publicId] ?? "supplier", reason: note[row.publicId] ?? "" })}>
              {label}
            </button>)}</div>
        </>}
      </li>;
    })}</ul>}
  </section>;
}
