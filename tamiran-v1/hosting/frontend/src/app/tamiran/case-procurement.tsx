"use client";
import { useRef, useState } from "react";
import type { WorkspaceProfile } from "./access";
import { MoneyInput, formatToman } from "./money-input";
import { moneyDigits } from "./money";
import { loadPartRequestQueue, procurementV2Action, type V2PartRequest, type V2ProcurementPayload, type V2PurchaseDocument, type V2Supplier } from "./v2-api";

type Run = (job: () => Promise<unknown>, success: string) => Promise<unknown>;
const fa = new Intl.NumberFormat("fa-IR");
const statusLabels: Record<string,string> = {
  awaiting_approval: "منتظر تأیید", approved: "تأیید شده", ordered: "سفارش داده شد",
  partially_received: "بخشی دریافت شد", received: "دریافت شده", rejected: "رد شده", cancelled: "لغو شده",
};

export function ProcurementForm({ selected, eligible, suppliers, busy, run, close }: {
  selected: V2PartRequest; eligible: V2PartRequest[]; suppliers: V2Supplier[];
  busy: boolean; run: Run; close: () => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [price, setPrice] = useState("");
  const [quantities, setQuantities] = useState<Record<number,string>>({
    [selected.id]: String(selected.quantity - selected.reserved_quantity),
  });
  const [more, setMore] = useState<V2PartRequest[]>([]);
  const [next, setNext] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const related = new Map([...more, ...eligible].filter(row =>
    row.id !== selected.id && row.item_id === selected.item_id).map(row => [row.id, row]));
  const rows = [selected, ...related.values()];
  async function loadRelated() {
    if (next === null || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await loadPartRequestQueue(new URLSearchParams({
        purchaseItem: String(selected.item_id), offset: String(next),
      }).toString());
      setMore(current => [...current, ...result.requests]);
      const { offset, pageSize, total } = result.requestPage;
      setNext(offset + pageSize < total ? offset + pageSize : null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "دریافت درخواست‌های مرتبط انجام نشد.");
    } finally {
      setLoading(false);
    }
  }
  const allocations = rows.map(row => ({ requestId: row.id, quantity: Number(quantities[row.id] || 0) }))
    .filter(row => row.quantity > 0);
  const quantity = allocations.reduce((sum, row) => sum + row.quantity, 0);
  const valid = rows.every(row => Number(quantities[row.id] || 0) <= row.quantity - row.reserved_quantity);
  return <section className="v2-card-form">
    <h3>سفارش خرید {selected.item_title}</h3>
    <p>درخواست مبدأ · <bdi>{selected.receipt_number}</bdi></p>
    <form className="v2-grid-form" onSubmit={async event => {
      event.preventDefault();
      if (busy || !valid || !Number(quantities[selected.id]) || !supplier || price === "") return;
      const result = await run(() => procurementV2Action({
        action: "document_create", supplierId: Number(supplier), originReason: "تأمین قطعه برای پرونده",
        items: [{ itemId: selected.item_id, quantity, unitPrice: Number(price), allocations }],
      }), "سفارش متصل به درخواست‌های پرونده ثبت شد.");
      if (result) close();
    }}>
      <label>تأمین‌کننده<select required value={supplier} onChange={event => setSupplier(event.target.value)}>
        <option value="">انتخاب تأمین‌کننده</option>
        {suppliers.filter(row => row.is_active).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      <label htmlFor="supply-order-price">قیمت خرید واحد<MoneyInput id="supply-order-price" value={price} onChange={setPrice} required /></label>
      <fieldset className="grow">
        <legend>سهم هر پرونده در سفارش</legend>
        {rows.map(row => <label key={row.id}>
          <span>پروندهٔ <bdi>{row.receipt_number}</bdi> · ماندهٔ {fa.format(row.quantity - row.reserved_quantity)}</span>
          <input inputMode="numeric" value={quantities[row.id] ?? ""} maxLength={6} placeholder="۰"
            onChange={event => setQuantities(old => ({ ...old, [row.id]: moneyDigits(event.target.value) }))} />
        </label>)}
        {next !== null && <button type="button" disabled={busy || loading} onClick={() => void loadRelated()}>
          {loading ? "در حال بارگذاری…" : "درخواست‌های مرتبط بیشتر"}
        </button>}
        {error && <p role="alert">{error}</p>}
      </fieldset>
      <button className="tech-primary" disabled={busy || !supplier || price === "" || !valid || !Number(quantities[selected.id])}>ثبت سفارش {fa.format(quantity)} عدد</button>
      <button type="button" disabled={busy} onClick={close}>بازگشت</button>
    </form>
  </section>;
}

export function ProcurementDocuments({ data, profile, busy, run }: {
  data: V2ProcurementPayload; profile: WorkspaceProfile; busy: boolean; run: Run;
}) {
  const [supplierName, setSupplierName] = useState("");
  const [openDocument, setOpenDocument] = useState("");
  const canReceive = ["repair_manager", "warehouse_keeper"].includes(profile.role) || profile.permissions.includes("procurement.receive");
  const selected = data.documents.find(doc => doc.public_id === openDocument
    && ["approved","ordered","partially_received"].includes(doc.status));

  return <section className="v2-card-form">
    <h3>سفارش‌های خرید پرونده‌ها</h3>
    {(profile.role === "repair_manager" || profile.role === "warehouse_keeper" || profile.permissions.includes("procurement.supplier.manage")) &&
      <form className="v2-inline-form" onSubmit={async event => {
        event.preventDefault();
        if (!supplierName.trim() || busy) return;
        if (await run(() => procurementV2Action({ action: "supplier_create", name: supplierName.trim() }), "تأمین‌کننده ثبت شد.")) setSupplierName("");
      }}>
        <label>تأمین‌کننده جدید<input value={supplierName} onChange={event => setSupplierName(event.target.value)} /></label>
        <button disabled={busy || !supplierName.trim()}>ثبت تأمین‌کننده</button>
      </form>}
    {selected && canReceive && <ReceiveDocument key={selected.id} doc={selected} busy={busy} run={run} close={() => setOpenDocument("")} />}
    {data.documents.length ? <ul className="tech-plain-list">
      {data.documents.map(doc => <li key={doc.id}>
        <p><bdi>{doc.document_number}</bdi> · {doc.supplier_name} · {statusLabels[doc.status] ?? doc.status} · {formatToman(doc.total_amount)} تومان</p>
        {doc.items.map(item => <p key={item.id}>{item.item_title} · {fa.format(Number(item.quantity))} عدد
          {item.requests.length > 0 && <> · {item.requests.map(link => <span key={link.part_request_id}> پروندهٔ <bdi>{link.receipt_number}</bdi> ({fa.format(Number(link.allocated_quantity))}) </span>)}</>}
        </p>)}
        {profile.role === "repair_manager" && doc.status === "awaiting_approval" &&
          <button type="button" disabled={busy} onClick={() => void run(() =>
            procurementV2Action({ action: "approve", publicId: doc.public_id, reason: "بررسی و تأیید سفارش" }), "سفارش تأیید شد.")}>تأیید سفارش</button>}
        {canReceive && ["approved","ordered","partially_received"].includes(doc.status) &&
          <button type="button" disabled={busy} onClick={() => setOpenDocument(doc.public_id)}>ثبت دریافت</button>}
      </li>)}
    </ul> : <p>سفارشی ثبت نشده است.</p>}
  </section>;
}

function ReceiveDocument({ doc, busy, run, close }: {doc: V2PurchaseDocument; busy: boolean; run: Run; close: () => void}) {
  const [counts, setCounts] = useState<Record<number,{ accepted: string; defective: string }>>({});
  const key = useRef<{ signature: string; key: string } | undefined>(undefined);
  const open = doc.items.filter(item => Number(item.quantity) > Number(item.received_quantity) + Number(item.defective_quantity));
  const items = open.map(item => ({
    purchaseItemId: Number(item.id), acceptedQuantity: Number(counts[item.id]?.accepted || 0),
    defectiveQuantity: Number(counts[item.id]?.defective || 0),
  })).filter(item => item.acceptedQuantity + item.defectiveQuantity > 0);
  const valid = items.length > 0 && items.every(row => {
    const item = open.find(i => Number(i.id) === row.purchaseItemId)!;
    return row.acceptedQuantity + row.defectiveQuantity <= Number(item.quantity) - Number(item.received_quantity) - Number(item.defective_quantity);
  });
  return <form className="v2-grid-form" onSubmit={async event => {
    event.preventDefault();
    if (!valid || busy) return;
    const signature = JSON.stringify(items);
    if (key.current?.signature !== signature) key.current = { signature, key: crypto.randomUUID() };
    if (await run(() => procurementV2Action({ action: "receive", publicId: doc.public_id, items, idempotencyKey: key.current?.key }),
      "دریافت ثبت شد و تعداد سالم به درخواست‌ها تخصیص یافت.")) close();
  }}>
    <h4 className="grow">دریافت سفارش <bdi>{doc.document_number}</bdi></h4>
    {open.map(item => <fieldset className="grow" key={item.id}>
      <legend>{item.item_title} · ماندهٔ {fa.format(Number(item.quantity) - Number(item.received_quantity) - Number(item.defective_quantity))}</legend>
      {([["accepted","تعداد سالم"],["defective","تعداد معیوب"]] as const).map(([field,label]) =>
        <label key={field}>{label}<input inputMode="numeric" maxLength={7} value={counts[item.id]?.[field] ?? ""}
          onChange={event => setCounts(old => ({ ...old, [item.id]: { ...(old[item.id] ?? { accepted: "", defective: "" }), [field]: moneyDigits(event.target.value) } }))} /></label>)}
    </fieldset>)}
    <button disabled={busy || !valid}>ثبت دریافت این نوبت</button>
    <button type="button" disabled={busy} onClick={close}>بازگشت</button>
  </form>;
}
