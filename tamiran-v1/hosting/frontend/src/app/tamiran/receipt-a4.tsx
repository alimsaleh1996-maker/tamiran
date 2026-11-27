import { Camera, Smartphone } from "lucide-react";
import type { CompactReceiptProps } from "./compact-receipt";
import { formatToman } from "./money";
import { queueTimestamp } from "./queue-search";
import { SecureQr } from "./secure-qr";

const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
});
const time = new Intl.DateTimeFormat("fa-IR", {
  timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const digits = new Intl.NumberFormat("fa-IR", { useGrouping: false });

function mask(value: string | undefined, leading: number, trailing = 0) {
  if (!value) return "—";
  if (value.length <= leading + trailing) return "•".repeat(value.length);
  return value.slice(0, leading) + "•".repeat(value.length - leading - trailing) +
    (trailing ? value.slice(-trailing) : "");
}

function validDate(value?: string | null) {
  if (!value) return null;
  const result = queueTimestamp(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

export function ReceiptA4({ receipt, tracking, handling, conditions }: {
  receipt: CompactReceiptProps; tracking: string; handling: string; conditions: string[];
}) {
  const { receiptNumber, workspace, catalogItem, details, issuedAt } = receipt;
  const accepted = validDate(issuedAt);
  const promised = validDate(receipt.promisedAt);
  const shopName = workspace?.shopName || "تعمیران";
  const device = [catalogItem?.brand, catalogItem?.model].filter(Boolean).join(" ") || "—";
  const phoneDevice = /موبایل|گوشی|تبلت|mobile|phone|tablet/i.test(receipt.deviceType ?? "");
  const issues = details?.declaredIssues.length ? details.declaredIssues : [receipt.declaredIssue || "—"];
  return <article className="tamiran-receipt receipt-a4" data-print-size="A4" aria-label="قبض پذیرش تعمیرات">
    <header className="receipt-a4-header">
      <div className="receipt-a4-brand">
        <div><span aria-hidden="true">ت</span><strong>{shopName}</strong></div>
        {workspace?.branch && <p>{workspace.branch}</p>}
        {receipt.phone && <p>تماس <bdi>{receipt.phone}</bdi></p>}
      </div>
      <div className="receipt-a4-title">
        <h2>{receipt.title || "قبض پذیرش تعمیرات"}</h2>
        <p>نسخهٔ مشتری · رسید دریافت دستگاه</p>
      </div>
      <div className="receipt-a4-tracking">
        {tracking ? <a href={tracking} target="_blank" rel="noreferrer" aria-label="بازکردن پیگیری پرونده">
          <SecureQr value={tracking} label="پیگیری پرونده" />
        </a> : <p>پیگیری با شمارهٔ پذیرش</p>}
      </div>
    </header>
    <div className="receipt-a4-meta">
      <strong>شماره پذیرش <bdi>{receiptNumber}</bdi></strong>
      {accepted && <span>تاریخ <time>{date.format(accepted)}</time> · ساعت <bdi>{time.format(accepted)}</bdi></span>}
    </div>
    <section aria-label="مشخصات مشتری و دستگاه">
      <h3>مشخصات مشتری و دستگاه</h3>
      <dl className="receipt-a4-cells">
        <div><dt>نام و نام خانوادگی</dt><dd>{receipt.customerName || "—"}</dd></div>
        <div><dt>شماره همراه</dt><dd><bdi dir="ltr">{mask(receipt.customerMobile, 4)}</bdi></dd></div>
        <div><dt>کد ملی</dt><dd><bdi dir="ltr">{mask(receipt.nationalCode, 0)}</bdi></dd></div>
        <div><dt>برند و مدل</dt><dd><bdi>{device}</bdi></dd></div>
        <div><dt>رنگ دستگاه</dt><dd>{receipt.color || "—"}</dd></div>
        {receipt.serialNumber && <div><dt>شماره سریال</dt><dd><bdi dir="ltr">{mask(receipt.serialNumber, 2, 2)}</bdi></dd></div>}
        {receipt.imei && <div><dt>IMEI</dt><dd><bdi dir="ltr">{mask(receipt.imei, 2, 2)}</bdi></dd></div>}
        {(!receipt.serialNumber && !receipt.imei || !!receipt.identifier && receipt.identifier !== receipt.serialNumber && receipt.identifier !== receipt.imei) &&
          <div><dt>شناسه دستگاه</dt><dd><bdi dir="ltr">{mask(receipt.identifier, 2, 2)}</bdi></dd></div>}
      </dl>
    </section>
    <section aria-label="اطلاعات مالی پذیرش">
      <div className="receipt-a4-section-head"><h3>اطلاعات مالی پذیرش</h3><span>مبالغ به تومان</span></div>
      <dl className="receipt-a4-cells receipt-a4-money">
        <div><dt>برآورد اولیه تعمیر</dt><dd>{details?.initialEstimate == null ? "—" : formatToman(details.initialEstimate)}</dd></div>
        <div><dt>سقف هزینه مورد توافق</dt><dd>{receipt.preapprovedAmount == null ? "—" : formatToman(receipt.preapprovedAmount)}</dd></div>
        <div><dt>پیش‌پرداخت ثبت‌شده</dt><dd>{details ? formatToman(details.advance) : "—"}</dd></div>
      </dl>
      <p className="receipt-a4-note">مبالغ پذیرش برآورد اولیه‌اند و مبلغ نهایی در فاکتور تعمیرات درج می‌شود.</p>
    </section>
    <section aria-label="ایرادات دستگاه">
      <h3>ایرادات دستگاه طبق اظهارات مشتری</h3>
      <table className="receipt-a4-issues">
        <thead><tr><th scope="col">ردیف</th><th scope="col">نوع ایراد</th>
          <th scope="col">شرح ایراد</th><th scope="col">توضیحات تکمیلی</th></tr></thead>
        <tbody>{issues.map((issue, index) => {
          const extra = details?.issueDetails?.[index];
          return <tr key={index}>
            <td>{digits.format(index + 1)}</td><td>{extra?.kind || "—"}</td>
            <td>{issue}</td><td>{extra?.note || "—"}</td>
          </tr>;
        })}</tbody>
      </table>
    </section>
    <div className="receipt-a4-conditions">
      <section>
        <h3>قوانین و شرایط پذیرش</h3>
        <ol>{conditions.map((condition,index) => <li key={index}>{condition}</li>)}</ol>
      </section>
      <section>
        <h3>وضعیت ظاهری دستگاه</h3>
        <div className="receipt-a4-appearance">
          {phoneDevice && <div className="receipt-a4-device-views">
            <div><Smartphone aria-hidden="true" /><span>نمای جلو</span></div>
            <div className="receipt-a4-device-back"><Smartphone aria-hidden="true" /><Camera aria-hidden="true" /><span>نمای پشت</span></div>
          </div>}
          <p>{receipt.appearanceStates.join("، ") || "وضعیت ظاهری ثبت نشده است."}</p>
        </div>
      </section>
    </div>
    <section>
      <h3>متعلقات و توضیحات تکمیلی</h3>
      <div className="receipt-a4-extras">
        <p><strong>متعلقات:</strong> {receipt.accessories.join("، ") || "بدون لوازم"}</p>
        {details?.notes && <p><strong>توضیحات:</strong> {details.notes}</p>}
        <p><strong>اطلاعات دستگاه:</strong> {handling}</p>
        {promised && <p><strong>موعد برآوردی:</strong> <bdi>{date.format(promised)}</bdi></p>}
        {receipt.previousReceipt && <p><strong>رسید پیشین:</strong> <bdi>{receipt.previousReceipt}</bdi></p>}
      </div>
    </section>
    <div className="receipt-a4-acceptance">
      <p>اینجانب اطلاعات ثبت‌شده و شرایط پذیرش مندرج در قبض را مطالعه و تأیید می‌کنم.</p>
      <div className="receipt-a4-signatures">
        <div><strong>نام و امضای مشتری</strong><span>امضا / تاریخ</span></div>
        <div><strong>مهر و امضای تعمیرگاه</strong><span>{receipt.acceptedByName || workspace?.displayName || "مسئول پذیرش"}</span></div>
      </div>
    </div>
    <footer className="receipt-a4-footer">
      <span>{receipt.shopAddress && <>نشانی تعمیرگاه · {receipt.shopAddress}</>}</span><strong>تعمیران</strong>
    </footer>
  </article>;
}
