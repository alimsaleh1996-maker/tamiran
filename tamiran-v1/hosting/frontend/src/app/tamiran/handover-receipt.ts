import type { V2DeliveryCase } from "./v2-api";
import { queueTimestamp } from "./queue-search";
/** Build the printable proof with text nodes; catalog/customer text is never HTML. */
export function printHandoverReceipt(item: V2DeliveryCase): boolean {
  const popup=window.open("", "_blank", "width=820,height=900"); if(!popup)return false;
  const doc=popup.document;doc.documentElement.lang="fa";doc.documentElement.dir="rtl";doc.title=`رسید تحویل ${item.receipt_number}`;
  const style=doc.createElement("style");style.textContent="body{font:16px/2 Tahoma,sans-serif;color:#183f3c;margin:36px}h1{font-size:22px}dl{border:1px solid #b7cdc7;padding:20px}dt{font-size:13px;color:#536e6a}dd{margin:0 0 16px;font-weight:bold;overflow-wrap:anywhere}@page{size:A5;margin:15mm}";doc.head.append(style);
  const title=doc.createElement("h1");title.textContent=item.process_status==="returned_unrepaired"?`عودت بدون تعمیر${!item.identifier_snapshot?" ـ شناسه ثبت نشده":""}`:"رسید تحویل دستگاه تعمیرشده";doc.body.append(title);
  const fields=[["شماره پرونده",item.receipt_number],["مشتری",item.customer_name],["دستگاه",[item.device_type_snapshot,item.brand_snapshot,item.model_snapshot].filter(Boolean).join(" ")],["سریال / IMEI",item.identifier_snapshot||"شناسه ثبت نشده"],["تحویل‌گیرنده",item.delivered_to_name||"ثبت نشده"],["زمان تحویل",item.delivered_at?new Intl.DateTimeFormat("fa-IR",{dateStyle:"long",timeStyle:"short"}).format(queueTimestamp(item.delivered_at)):"ثبت نشده"]];
  const list=doc.createElement("dl");for(const [label,value] of fields){const term=doc.createElement("dt"),detail=doc.createElement("dd");term.textContent=label;detail.textContent=value;list.append(term,detail);}doc.body.append(list);
  const note=doc.createElement("p");note.textContent=item.process_status==="returned_unrepaired"?"دستگاه بدون انجام تعمیر به تحویل‌گیرنده بازگردانده شد. این رسید ضمانت تعمیر ایجاد نمی‌کند.":"شناسهٔ درج‌شده هنگام تحویل با دستگاه تطبیق داده شده و برای پیگیری مراجعهٔ بعدی ثبت است.";doc.body.append(note);
  popup.focus();popup.requestAnimationFrame(()=>popup.print());return true;
}
