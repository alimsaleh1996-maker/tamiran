import { useEffect, useRef, useState } from "react";
import { MoneyInput, formatToman } from "./money-input";
import { changeExternalPurchase, loadExternalPurchases, workflowV2Action, type ExternalPurchase, type ExternalPurchasePayload } from "./v2-api";

const labels: Record<ExternalPurchase["status"], string> = {
  pending: "منتظر مجوز", approved: "مجاز به خرید", rejected: "رد شده",
  bought: "خرید انجام شده", used: "مصرف‌شده", returning: "در انتظار تعیین تکلیف فیزیکی", returned: "مرجوع شده", cancelled: "لغو شده",
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
  const [item, setItem] = useState("");
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cost, setCost] = useState("");
  const [lines, setLines] = useState<Array<{ itemId: number; title: string; quantity: number; unitCost: number }>>([]);
  const [disposal, setDisposal] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState({ code: "", title: "", category: "", salePrice: "" });
  const [newItemOpen, setNewItemOpen] = useState(false);
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
      const result = await workflowV2Action({ action: "external_catalog_add", ...newItem, salePrice: Number(newItem.salePrice || 0) });
      setNewItem({ code: "", title: "", category: "", salePrice: "" });
      setNewItemOpen(false);
      setGeneration((value) => value + 1);
      if (caseId) { setSearch(""); setItem(String(result.id)); }
      setMessage(result.created ? "کالا به بانک قطعات اضافه شد." : "کالا از قبل در بانک قطعات ثبت شده است.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "تعریف کالا انجام نشد.");
    } finally { setBusy(false); }
  }
  const selection = data?.catalog.find((part) => part.id === Number(item));
  function addLine() {
    if (!selection || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0 || Number(cost) <= 0) return;
    setLines([...lines, { itemId: selection.id, title: selection.title, quantity: Number(quantity), unitCost: Number(cost) }]);
    setItem("");
    setCost("");
    setQuantity("1");
  }
  return <section>
    <h3>{caseId ? "خرید قطعه خارج از انبار" : "مجوزهای خرید در انتظار"}</h3>
    {error && <p role="alert" className="tech-error">{error}</p>}
    {!data && !error && <p role="status">در حال بارگذاری…</p>}
    {message && <p role="status">{message}</p>}
    {data?.canManageCatalog && <>
      <button type="button" onClick={() => setNewItemOpen(!newItemOpen)}>{newItemOpen ? "بستن تعریف کالا" : "تعریف کالای جدید"}</button>
      {newItemOpen && <form onSubmit={(event) => { event.preventDefault(); void addCatalog(); }} className="tech-form-grid">
        <label>کد کالا<input required maxLength={80} value={newItem.code} onChange={(event) => setNewItem({ ...newItem, code: event.target.value })} /></label>
        <label>نام کالا<input required maxLength={180} value={newItem.title} onChange={(event) => setNewItem({ ...newItem, title: event.target.value })} /></label>
        <label>دسته‌بندی<input maxLength={120} value={newItem.category} onChange={(event) => setNewItem({ ...newItem, category: event.target.value })} /></label>
        <label>قیمت فروش واحد<MoneyInput value={newItem.salePrice} onChange={(salePrice) => setNewItem({ ...newItem, salePrice })} /></label>
        <button type="submit" disabled={busy}>ثبت کالا در بانک قطعات</button>
      </form>}
    </>}
    {caseId && data && canWrite && <div className="tech-form-grid">
      <p>{data.policy === "limit" ? `سقف اختیار هر پرونده: ${toman(data.ownLimit)}` : data.policy === "approval" ? "خرید پس از مجوز مدیر ثبت می‌شود." : "خرید با اختیار مستقیم ثبت می‌شود."}</p>
      <label>جست‌وجوی بانک قطعات<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>انتخاب کالا<select aria-label="انتخاب کالا" value={item} onChange={(event) => setItem(event.target.value)}>
        <option value="">انتخاب کنید</option>
        {data.catalog.filter((part) => part.id === Number(item) || `${part.title} ${part.code}`.includes(search.trim())).map((part) =>
          <option key={part.id} value={part.id}>{part.title} · {part.code}</option>)}
      </select></label>
      <label>تعداد خرید<input type="number" min={1} max={10000} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      <label>بهای خرید واحد<MoneyInput value={cost} onChange={setCost} /></label>
      <button type="button" disabled={!selection || !Number(quantity) || !Number(cost) || lines.length >= 30 || busy} onClick={addLine}>افزودن به ردیف‌های خرید</button>
      {!!lines.length && <ul>{lines.map((line, index) => <li key={index}>
        {line.title} · {line.quantity.toLocaleString("fa-IR")} عدد · {toman(line.quantity * line.unitCost)}{" "}
        <button type="button" disabled={busy} onClick={() => setLines(lines.filter((_, i) => i !== index))}>حذف ردیف</button>
      </li>)}</ul>}
      <button type="button" disabled={!lines.length || busy} onClick={() => void submit({
        caseId, decision: "request", lines: lines.map(({ itemId, quantity, unitCost }) => ({ itemId, quantity, unitCost })),
      }, () => setLines([]))}>ثبت درخواست خرید</button>
    </div>}
    {!!data && !data.rows.length && <p>موردی ثبت نشده است.</p>}
    {!!data?.rows.length && <ul className="tech-plain-list">{data.rows.map((row) => {
      const editable = canWrite && (!caseId || row.requestedBy === actorId || row.status === "bought");
      const actions = !editable ? [] : !caseId ? (row.status === "returning" ? [["confirm_return", "تأیید تعیین تکلیف فیزیکی"]] : [["approve", "تأیید خرید"], ["reject", "رد درخواست"]])
        : row.status === "pending" ? [["cancel", "لغو درخواست"]]
        : row.status === "approved" ? [["buy", "ثبت خرید واقعی"], ["cancel", "لغو خرید"]]
        : row.status === "bought" ? [["use", "ثبت مصرف"], ["return", "ثبت عودت"]]
        : [];
      return <li key={row.publicId}>
        <p><strong>{row.title}</strong> · {row.quantity.toLocaleString("fa-IR")} عدد · {labels[row.status]}</p>
        {row.disposition && <p>{disposals[row.disposition]}</p>}
        {!caseId && <p>رسید <bdi>{row.receiptNumber}</bdi></p>}
        {row.total !== undefined && <p>{toman(row.total)}</p>}
        {row.decisionNote && <p>{row.decisionNote}</p>}
        {!!actions.length && <>
          {caseId && row.status === "bought" && <label>روش تعیین تکلیف
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
