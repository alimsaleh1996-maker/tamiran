import { useEffect, useState } from "react";
import { ReceiptA4 } from "./receipt-a4";
import receiptA4Css from "./receipt-a4.css?inline";
import type { IntakeReceiptDetails } from "./operations";
import type { WorkspaceProfile } from "./access";
import { SecureQr } from "./secure-qr";
import { formatToman } from "./money-input";
import { formatPersianDate } from "./persian-date";
import { queueTimestamp } from "./queue-search";
export type CompactReceiptProps = {
  workspace?: WorkspaceProfile;
  receiptNumber: string;
  customerName: string;
  customerMobile: string;
  nationalCode?: string;
  deviceType?: string;
  shopAddress?: string;
  details?: IntakeReceiptDetails | null;
  catalogItem: { brand: string; model: string } | null;
  accessories: string[];
  appearanceStates: string[];
  declaredIssue?: string;
  dataHandling?: string;
  previousReceipt?: string;
  identifier?: string;
  serialNumber?: string;
  imei?: string;
  color?: string;
  printSize?: string;
  title?: string;
  phone?: string;
  portal?: string;
  trackingUrl?: string;
  conditions?: string[];
  issuedAt?: string;
  promisedAt?: string | null;
  acceptedByName?: string;
  preapprovedAmount?: number;
};
export const RECEIPT_FONT_FILE = "/assets/vazirmatn-arabic-wght-normal-Cafbb7Zc.woff2";
const RECEIPT_FONT_CSS = `@font-face{font-family:"Tamiran Receipt";src:url('${RECEIPT_FONT_FILE}') format('woff2');font-weight:100 900;font-display:block}`;
const receiptFontSample = '۴۰۰ تومان LCD قبض پذیرش';

async function loadReceiptFont(document: Document) {
  const faces = await document.fonts.load('400 12px "Tamiran Receipt"', receiptFontSample);
  if (!faces.length) throw new Error("Receipt font not available");
  await document.fonts.ready;
}

const RECEIPT_CSS = `
.tamiran-receipt{box-sizing:border-box;width:148mm;max-width:100%;margin:0 auto;padding:8mm;background:#fff;color:#111;font-family:"Tamiran Receipt",Vazirmatn,Tahoma,sans-serif;font-size:13px;line-height:1.65;text-align:right;direction:rtl;border:1px solid #c8d5d1;border-radius:8px}
.tamiran-receipt *{box-sizing:border-box}.tamiran-receipt p,.tamiran-receipt h2,.tamiran-receipt h3,.tamiran-receipt dl,.tamiran-receipt dd{margin:0}.tamiran-receipt header{display:flex;justify-content:space-between;align-items:start;gap:5mm;border-bottom:2px solid #173f3c;padding-bottom:3mm;margin-bottom:3mm}.tamiran-receipt header h2{font-size:20px;line-height:1.4;color:#111}.tamiran-receipt header p{font-size:11px;color:#444}.tamiran-receipt .cr-number{text-align:left;font-size:17px;font-weight:800;white-space:nowrap}.tamiran-receipt .cr-number small{display:block;font-size:10px;font-weight:400}.tamiran-receipt h3{font-size:12px;font-weight:700;margin-bottom:2mm}.tamiran-receipt section{padding:2.5mm 0;border-bottom:1px solid #d3ddda;break-inside:avoid}.tamiran-receipt .cr-facts{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 5mm}.tamiran-receipt .cr-facts>div{display:flex;gap:2mm;min-width:0;align-items:baseline}.tamiran-receipt dt{color:#444;font-size:11px;flex:none}.tamiran-receipt dd{font-weight:600;overflow-wrap:anywhere}.tamiran-receipt .cr-wide{grid-column:1/-1}.tamiran-receipt .cr-text{display:grid;grid-template-columns:auto 1fr;gap:2mm;font-size:12px}.tamiran-receipt .cr-text dt{font-weight:700}.tamiran-receipt .cr-text dd{font-weight:400;white-space:pre-wrap;overflow-wrap:anywhere}.tamiran-receipt .cr-footer{display:grid;grid-template-columns:1fr 35mm;gap:5mm;padding-top:3mm;align-items:start}.tamiran-receipt .cr-conditions{font-size:10.5px;line-height:1.65}.tamiran-receipt .cr-conditions p{margin-bottom:1.5mm}.tamiran-receipt .secure-qr{width:34mm;max-width:100%;display:block;padding:0;background:#fff;border:0;text-align:center}.tamiran-receipt .secure-qr svg{display:block;width:34mm;height:34mm;max-width:100%;background:#fff}.tamiran-receipt .secure-qr>span{font-size:10px;display:block;color:#111}.tamiran-receipt .cr-link{font-size:8px;word-break:break-all;line-height:1.3;direction:ltr;text-align:left;margin-top:1mm}.tamiran-receipt .cr-signatures{display:grid;grid-template-columns:1fr 1fr;gap:10mm;padding-top:5mm;font-size:11px}.tamiran-receipt .cr-signatures>span{border-bottom:1px solid #889e96;padding-bottom:6mm}.tamiran-receipt .cr-muted{font-size:10px;color:#444}
@media(max-width:480px){.tamiran-receipt{padding:5mm;font-size:12px}.tamiran-receipt .cr-number{font-size:14px}.tamiran-receipt header h2{font-size:17px}.tamiran-receipt .cr-facts{gap:2mm;grid-template-columns:1fr}.tamiran-receipt .cr-footer{grid-template-columns:1fr 32mm}.tamiran-receipt .secure-qr svg{width:32mm;height:32mm}}
@media print{html,body{margin:0!important;padding:0!important;background:white!important;width:auto!important;height:auto!important;min-height:0!important;overflow:visible!important} .tamiran-receipt{border:0!important;border-radius:0!important;margin:0!important;width:100%!important;max-width:none!important;padding:8mm!important;font-size:10pt;box-shadow:none!important}.tamiran-receipt header h2{font-size:15pt}.tamiran-receipt .cr-number{font-size:13pt}.tamiran-receipt section{break-inside:avoid}.tamiran-receipt .cr-facts{grid-template-columns:1fr 1fr}.tamiran-receipt .cr-footer{grid-template-columns:1fr 35mm}.tamiran-receipt .secure-qr svg{width:34mm;height:34mm}.tamiran-receipt .cr-conditions{font-size:8.5pt}}
@media print {
  .tamiran-receipt { color: #111; background: #fff; font-size: 9.5pt; line-height: 1.6; }
  .tamiran-receipt header { border-bottom: 1px solid #444; }
  .tamiran-receipt header h2 { color: #111; font-size: 13pt; }
  .tamiran-receipt h3 { color: #222; font-size: 10pt; margin-block-end: 1mm; break-after: avoid; }
  .tamiran-receipt section { padding-block: 2mm; border-color: #aaa; }
  .tamiran-receipt .cr-number, .tamiran-receipt dt, .tamiran-receipt .cr-muted { color: #333; }
  .tamiran-receipt .cr-facts, .tamiran-receipt .cr-text { gap: 1mm 4mm; }
  .tamiran-receipt dd, .tamiran-receipt .cr-conditions { overflow-wrap: anywhere; }
  .tamiran-receipt .cr-conditions { font-size: 8.5pt; }
  .tamiran-receipt .cr-signatures { break-inside: avoid; }
  .tamiran-receipt .cr-signatures > span { border-color: #555; }
  .tamiran-receipt[data-print-size="حرارتی"] { font-size: 8.5pt; line-height: 1.48; padding: 4mm !important; }
  .tamiran-receipt[data-print-size="حرارتی"] header { gap: 2mm; margin-block-end: 1mm; padding-block-end: 1.5mm; }
  .tamiran-receipt[data-print-size="حرارتی"] header h2, .tamiran-receipt[data-print-size="حرارتی"] .cr-number { font-size: 10pt; }
  .tamiran-receipt[data-print-size="حرارتی"] section { padding-block: 1mm; }
  .tamiran-receipt[data-print-size="حرارتی"] .cr-signatures { padding-block-start: 2mm; }
  .tamiran-receipt[data-print-size="حرارتی"] .cr-signatures > span { padding-block-end: 4mm; }
  .tamiran-receipt[data-print-size="حرارتی"] .cr-facts { grid-template-columns: minmax(0, 1fr); }
  .tamiran-receipt[data-print-size="حرارتی"] .cr-footer { grid-template-columns: minmax(0, 1fr); gap: 2mm; padding-block-start: 2mm; }
  .tamiran-receipt[data-print-size="حرارتی"] .cr-footer svg { width: 27mm; height: 27mm; }
}

`;
function dateText(value?: string | null, withTime = false) {
  if (!value) return "—";
  const d = queueTimestamp(value);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Tehran",
        ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const : {}),
      }).format(d)
    : formatPersianDate(value);
}
export const DEFAULT_RECEIPT_SIZE = "A4";

export function CompactReceipt(p: CompactReceiptProps) {
  const [fontStatus, setFontStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    loadReceiptFont(document).then(
      () => { if (active) setFontStatus("ready"); },
      () => { if (active) setFontStatus("error"); },
    );
    return () => { active = false; };
  }, []);
  if (fontStatus !== "ready") return <>
    <style>{RECEIPT_FONT_CSS}</style>
    {fontStatus === "loading" ? <p role="status">در حال بارگذاری قلم قبض…</p>
      : <p role="alert">قلم قبض بارگذاری نشد. صفحه را تازه‌سازی کنید.</p>}
  </>;
  const tracking = p.trackingUrl
    ? new URL(
        p.trackingUrl,
        typeof window !== "undefined"
          ? window.location.origin
          : "https://example.invalid",
      ).toString()
    : "";
  const handling =
    p.dataHandling === "coordinate_first"
      ? "پاک‌کردن اطلاعات فقط با هماهنگی مشتری"
      : p.dataHandling === "erase_authorized"
        ? "حذف اطلاعات با مجوز مشتری و در صورت ضرورت فنی"
        : p.dataHandling === "no_erasure"
          ? "تعمیر بدون حذف اطلاعات"
          : "ثبت نشده";
  const conditions = p.details?.terms?.trim() ? p.details.terms.split(/\n+/).map(line => line.trim()).filter(Boolean)
    : p.conditions?.length
    ? p.conditions
    : [
        "تحویل دستگاه با ارائهٔ این رسید و احراز هویت مشتری انجام می‌شود.",
        "تعمیر و هزینهٔ بالاتر از سقف پذیرش نیازمند تأیید مشتری است.",
        "ضمانت خدمت و قطعات مطابق فاکتور نهایی است.",
      ];
  const printSize = p.printSize ?? DEFAULT_RECEIPT_SIZE;
  if (printSize === "A4") return <>
    <style>{RECEIPT_FONT_CSS}</style>
    <style>{RECEIPT_CSS + receiptA4Css}</style>
    <ReceiptA4 receipt={p} tracking={tracking} handling={handling} conditions={conditions} />
  </>;
  return (
    <>
      <style>{RECEIPT_FONT_CSS}</style>
      <style>{RECEIPT_CSS}</style>
      <article
        className="tamiran-receipt"
        data-print-size={printSize}
        aria-label="رسید پذیرش تعمیر"
      >
        <header>
          <div>
            <h2>{p.title || p.workspace?.shopName || "تعمیران"}</h2>
            <p>رسید پذیرش دستگاه</p>
            <p>{p.phone || ""}</p>
          </div>
          <div className="cr-number">
            <bdi>{p.receiptNumber}</bdi>
            <small>تاریخ پذیرش: {dateText(p.issuedAt, true)}</small>
          </div>
        </header>
        <section>
          <h3>مشتری</h3>
          <dl className="cr-facts">
            <div>
              <dt>نام</dt>
              <dd>{p.customerName}</dd>
            </div>
            <div>
              <dt>موبایل</dt>
              <dd>
                <bdi>{p.customerMobile}</bdi>
              </dd>
            </div>
            <div className="cr-wide">
              <dt>پذیرنده</dt>
              <dd>{p.acceptedByName || p.workspace?.displayName || "—"}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>دستگاه</h3>
          <dl className="cr-facts">
            <div className="cr-wide">
              <dt>برند و مدل</dt>
              <dd>
                {[p.catalogItem?.brand, p.catalogItem?.model]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
            <div>
              <dt>رنگ</dt>
              <dd>{p.color || "—"}</dd>
            </div>
            {p.serialNumber && <div><dt>شماره سریال</dt><dd><bdi>{p.serialNumber}</bdi></dd></div>}
            {p.imei && <div><dt>IMEI</dt><dd><bdi>{p.imei}</bdi></dd></div>}
            {(!p.serialNumber && !p.imei || !!p.identifier && p.identifier !== p.serialNumber && p.identifier !== p.imei) &&
              <div><dt>شناسه</dt><dd>{p.identifier ? <bdi>{p.identifier}</bdi> : "بدون شناسه در پذیرش"}</dd></div>}
            <div className="cr-wide">
              <dt>لوازم همراه</dt>
              <dd>{p.accessories.join("، ") || "بدون لوازم"}</dd>
            </div>
            <div className="cr-wide">
              <dt>وضعیت ظاهری</dt>
              <dd>{p.appearanceStates.join("، ") || "موردی ثبت نشده"}</dd>
            </div>
          </dl>
        </section>
        <section>
          <dl className="cr-text">
            <dt>ایراد اعلامی</dt>
            <dd>{p.declaredIssue || "—"}</dd>
            <dt>اطلاعات دستگاه</dt>
            <dd>{handling}</dd>
            <dt>موعد برآوردی</dt>
            <dd>{dateText(p.promisedAt)}</dd>
            {Boolean(p.preapprovedAmount) && (
              <>
                <dt>سقف هزینه</dt>
                <dd>{formatToman(p.preapprovedAmount!)} تومان</dd>
              </>
            )}
            {p.previousReceipt && (
              <>
                <dt>رسید قبلی</dt>
                <dd>
                  <bdi>{p.previousReceipt}</bdi>
                </dd>
              </>
            )}
          </dl>
        </section>
        <footer className="cr-footer">
          <div className="cr-conditions">
            {conditions.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            <div className="cr-signatures">
              <span>امضای پذیرنده</span>
              <span>امضای مشتری</span>
            </div>
          </div>
          <div>
            {tracking ? (
              <>
                <SecureQr value={tracking} label="پیگیری پرونده" />
                <p className="cr-link">{tracking}</p>
              </>
            ) : (
              <p className="cr-muted">
                برای پیگیری، شمارهٔ رسید را اعلام کنید.
              </p>
            )}
          </div>
        </footer>
      </article>
    </>
  );
}
/** Isolate the receipt from application/modals; page dimensions are physical millimetres. */
export function printCompactReceipt(): boolean {
  const receipt = [
    ...document.querySelectorAll<HTMLElement>(".tamiran-receipt"),
  ].find((el) => el.getClientRects().length > 0);
  if (!receipt) return false;
  const popup = window.open("", "_blank", "width=850,height=1000");
  if (!popup) {
    window.alert(
      "برای چاپ رسید، اجازهٔ باز شدن پنجرهٔ چاپ را در مرورگر بدهید.",
    );
    return false;
  }
  const d = popup.document;
  d.documentElement.lang = "fa";
  d.documentElement.dir = "rtl";
  d.title = "";
  const meta = d.createElement("meta");
  meta.setAttribute("charset", "utf-8");
  d.head.append(meta);
  const size =
    receipt.dataset.printSize === "A4"
      ? "A4"
      : receipt.dataset.printSize === "حرارتی"
        ? "80mm 210mm"
        : "A5";
  const style = d.createElement("style");
  style.textContent = `${RECEIPT_FONT_CSS}@page{size:${size};margin:0}${RECEIPT_CSS}${receiptA4Css}`;
  d.head.append(style);
  d.body.append(receipt.cloneNode(true));
  void loadReceiptFont(d).then(() => {
    popup.focus();
    popup.requestAnimationFrame(() => popup.print());
  }, () => {
    popup.close();
    window.alert("قلم قبض بارگذاری نشد. دوباره تلاش کنید.");
  });
  return true;
}
