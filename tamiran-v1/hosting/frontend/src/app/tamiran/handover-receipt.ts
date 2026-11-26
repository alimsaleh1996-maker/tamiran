import type { V2DeliveryCase } from "./v2-api";
import { queueTimestamp } from "./queue-search";

const timeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tehran", calendar: "persian",
});
export function formatHandoverTime(timestamp: string | null) {
  if (!timestamp) return "ثبت نشده";
  const time = queueTimestamp(timestamp);
  return Number.isNaN(time.getTime()) ? "ثبت نشده" : timeFormatter.format(time);
}

/** Build the printable proof with text nodes; catalog/customer text is never HTML. */
export function printHandoverReceipt(item: V2DeliveryCase, shopName: string): boolean {
  const popup = window.open("", "_blank", "width=650,height=780");
  if (!popup) return false;
  const doc = popup.document;
  doc.documentElement.lang = "fa";
  doc.documentElement.dir = "rtl";
  doc.title = `رسید تحویل ${item.receipt_number}`;
  const style = doc.createElement("style");
  style.textContent = `
    @page { size: A5 portrait; margin: 12mm }
    * { box-sizing: border-box }
    body { font: 14px/1.8 Tahoma, sans-serif; color: #163531; margin: 20px auto; width: min(100% - 32px, 550px) }
    header { border-bottom: 2px solid #163531; padding: 0 0 12px }
    h1 { font-size: 21px; margin: 0 }
    p { margin-block: 6px }
    dl { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); margin: 14px 0; border: 1px solid #cedbd7; border-radius: 9px; padding: 12px; gap: 10px 14px; break-inside: avoid }
    dt { font-size: 12px; color: #405c58 }
    dd { margin: 0; font-weight: bold; overflow-wrap: anywhere }
    @media print { body { margin: 0; width: auto } }
  `;
  doc.head.append(style);
  const header = doc.createElement("header");
  const title = doc.createElement("h1");
  const returned = item.process_status === "returned_unrepaired";
  title.textContent = returned ? "رسید تحویل بدون تعمیر" : "رسید تحویل دستگاه";
  const shop = doc.createElement("p");
  shop.textContent = shopName;
  header.append(title, shop);
  doc.body.append(header);
  const fields: Array<[string, string, boolean?]> = [
    ["شماره پذیرش", item.receipt_number, true], ["زمان تحویل", formatHandoverTime(item.delivered_at)],
    ["مشتری", item.customer_name], ["تحویل‌گیرنده", item.delivered_to_name || "ثبت نشده"],
    ["دستگاه", [item.device_type_snapshot, item.brand_snapshot, item.model_snapshot].filter(Boolean).join(" ")],
    ["سریال / IMEI", item.identifier_snapshot || "شناسه ثبت نشده", Boolean(item.identifier_snapshot)],
  ];
  if (item.invoice_number) fields.push(["شماره فاکتور", item.invoice_number, true]);
  const list = doc.createElement("dl");
  for (const [label, value, ltr] of fields) {
    const field = doc.createElement("div");
    const term = doc.createElement("dt");
    const detail = doc.createElement("dd");
    const text = doc.createElement("bdi");
    if (ltr) text.dir = "ltr";
    text.textContent = value;
    term.textContent = label;
    detail.append(text);
    field.append(term, detail);
    list.append(field);
  }
  doc.body.append(list);
  const note = doc.createElement("p");
  note.textContent = returned ? "دستگاه بدون انجام تعمیر به تحویل‌گیرنده بازگردانده شد." : "دستگاه با شناسهٔ درج‌شده به تحویل‌گیرنده تحویل داده شد.";
  doc.body.append(note);
  popup.focus();
  popup.requestAnimationFrame(() => popup.print());
  return true;
}
