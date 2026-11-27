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
        <div><dt>شماره همراه</dt><dd><bdi dir="ltr">{receipt.customerMobile || "—"}</bdi></dd></div>
        <div><dt>کد ملی</dt><dd><bdi dir="ltr">{receipt.nationalCode ? "•".repeat(receipt.nationalCode.length) : "—"}</bdi></dd></div>
        <div><dt>برند و مدل</dt><dd><bdi>{device}</bdi></dd></div>
        <div><dt>رنگ دستگاه</dt><dd>{receipt.color || "—"}</dd></div>
        {receipt.serialNumber && <div><dt>شماره سریال</dt><dd><bdi dir="ltr">{receipt.serialNumber}</bdi></dd></div>}
        {receipt.imei && <div><dt>IMEI</dt><dd><bdi dir="ltr">{receipt.imei}</bdi></dd></div>}
        {(!receipt.serialNumber && !receipt.imei || !!receipt.identifier && receipt.identifier !== receipt.serialNumber && receipt.identifier !== receipt.imei) &&
          <div><dt>شناسه دستگاه</dt><dd><bdi dir="ltr">{receipt.identifier || "—"}</bdi></dd></div>}
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
          const structured = extra?.kind && [extra.kind, extra.note].filter(Boolean).join(" — ") === issue;
          return <tr key={index}>
            <td>{digits.format(index + 1)}</td><td>{extra?.kind || "—"}</td>
            <td>{structured ? "—" : issue}</td><td>{extra?.note || "—"}</td>
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
          {/* Outlines from the approved A4 sample. Its example damage marks are not part of the template. */}
          {phoneDevice && <div className="receipt-a4-device-views">
            <div><svg viewBox="0 0 42 76" fill="none" strokeLinecap="round" aria-hidden="true">
              <path d="M7.42 2.01 L34.20 2.01 C34.58 2.01 34.96 2.05 35.34 2.12 C35.72 2.20 36.08 2.31 36.44 2.46 C36.80 2.60 37.13 2.78 37.45 3.00 C37.77 3.21 38.07 3.45 38.34 3.73 C38.61 4.00 38.86 4.29 39.07 4.61 C39.28 4.93 39.46 5.27 39.61 5.63 C39.76 5.98 39.87 6.35 39.94 6.73 C40.02 7.10 40.06 7.48 40.06 7.87 L40.06 68.12 C40.06 68.50 40.02 68.89 39.94 69.26 C39.87 69.64 39.76 70.01 39.61 70.36 C39.46 70.72 39.28 71.05 39.07 71.37 C38.86 71.69 38.61 71.99 38.34 72.26 C38.07 72.53 37.77 72.78 37.45 72.99 C37.13 73.20 36.80 73.38 36.44 73.53 C36.08 73.68 35.72 73.79 35.34 73.87 C34.96 73.94 34.58 73.98 34.20 73.98 L7.42 73.98 C7.04 73.98 6.65 73.94 6.28 73.87 C5.90 73.79 5.53 73.68 5.18 73.53 C4.82 73.38 4.49 73.20 4.17 72.99 C3.85 72.78 3.55 72.53 3.28 72.26 C3.01 71.99 2.76 71.69 2.55 71.37 C2.34 71.05 2.16 70.72 2.01 70.36 C1.86 70.01 1.75 69.64 1.67 69.26 C1.60 68.89 1.56 68.50 1.56 68.12 L1.56 7.87 C1.56 7.48 1.60 7.10 1.67 6.73 C1.75 6.35 1.86 5.98 2.01 5.63 C2.16 5.27 2.34 4.93 2.55 4.61 C2.76 4.29 3.01 4.00 3.28 3.73 C3.55 3.45 3.85 3.21 4.17 3.00 C4.49 2.78 4.82 2.60 5.18 2.46 C5.53 2.31 5.90 2.20 6.28 2.12 C6.65 2.05 7.04 2.01 7.42 2.01" stroke="#555" strokeWidth="1.17" />
              <path d="M9.09 5.36 L32.52 5.36 C32.80 5.36 33.07 5.38 33.34 5.44 C33.61 5.49 33.87 5.57 34.13 5.68 C34.38 5.78 34.62 5.91 34.85 6.06 C35.08 6.22 35.29 6.39 35.48 6.58 C35.68 6.78 35.85 6.99 36.00 7.22 C36.16 7.45 36.29 7.69 36.39 7.94 C36.50 8.19 36.58 8.46 36.63 8.73 C36.68 9.00 36.71 9.27 36.71 9.54 L36.71 66.45 C36.71 66.72 36.68 66.99 36.63 67.26 C36.58 67.53 36.50 67.79 36.39 68.05 C36.29 68.30 36.16 68.54 36.00 68.77 C35.85 69.00 35.68 69.21 35.48 69.41 C35.29 69.60 35.08 69.77 34.85 69.93 C34.62 70.08 34.38 70.21 34.13 70.31 C33.87 70.42 33.61 70.50 33.34 70.55 C33.07 70.60 32.80 70.63 32.52 70.63 L9.09 70.63 C8.82 70.63 8.55 70.60 8.28 70.55 C8.01 70.50 7.75 70.42 7.49 70.31 C7.24 70.21 7.00 70.08 6.77 69.93 C6.54 69.77 6.33 69.60 6.13 69.41 C5.94 69.21 5.77 69.00 5.61 68.77 C5.46 68.54 5.33 68.30 5.23 68.05 C5.12 67.79 5.04 67.53 4.99 67.26 C4.94 66.99 4.91 66.72 4.91 66.45 L4.91 9.54 C4.91 9.27 4.94 9.00 4.99 8.73 C5.04 8.46 5.12 8.19 5.23 7.94 C5.33 7.69 5.46 7.45 5.61 7.22 C5.77 6.99 5.94 6.78 6.13 6.58 C6.33 6.39 6.54 6.22 6.77 6.06 C7.00 5.91 7.24 5.78 7.49 5.68 C7.75 5.57 8.01 5.49 8.28 5.44 C8.55 5.38 8.82 5.36 9.09 5.36" stroke="#aaa" strokeWidth="1.17" />
              <path d="M15.79 6.19 L26.67 6.19" stroke="#555" strokeWidth="2.09" />
            </svg><span>نمای جلو</span></div>
            <div><svg viewBox="0 0 42 76" fill="none" strokeLinecap="round" aria-hidden="true">
              <path d="M7.39 2.01 L34.17 2.01 C34.55 2.01 34.93 2.05 35.31 2.12 C35.69 2.20 36.05 2.31 36.41 2.46 C36.76 2.60 37.10 2.78 37.42 3.00 C37.74 3.21 38.04 3.45 38.31 3.73 C38.58 4.00 38.82 4.29 39.04 4.61 C39.25 4.93 39.43 5.27 39.58 5.63 C39.73 5.98 39.84 6.35 39.91 6.73 C39.99 7.10 40.02 7.48 40.02 7.87 L40.02 68.12 C40.02 68.50 39.99 68.89 39.91 69.26 C39.84 69.64 39.73 70.01 39.58 70.36 C39.43 70.72 39.25 71.05 39.04 71.37 C38.82 71.69 38.58 71.99 38.31 72.26 C38.04 72.53 37.74 72.78 37.42 72.99 C37.10 73.20 36.76 73.38 36.41 73.53 C36.05 73.68 35.69 73.79 35.31 73.87 C34.93 73.94 34.55 73.98 34.17 73.98 L7.39 73.98 C7.00 73.98 6.62 73.94 6.24 73.87 C5.87 73.79 5.50 73.68 5.15 73.53 C4.79 73.38 4.45 73.20 4.13 72.99 C3.81 72.78 3.52 72.53 3.25 72.26 C2.97 71.99 2.73 71.69 2.52 71.37 C2.30 71.05 2.12 70.72 1.98 70.36 C1.83 70.01 1.72 69.64 1.64 69.26 C1.57 68.89 1.53 68.50 1.53 68.12 L1.53 7.87 C1.53 7.48 1.57 7.10 1.64 6.73 C1.72 6.35 1.83 5.98 1.98 5.63 C2.12 5.27 2.30 4.93 2.52 4.61 C2.73 4.29 2.97 4.00 3.25 3.73 C3.52 3.45 3.81 3.21 4.13 3.00 C4.45 2.78 4.79 2.60 5.15 2.46 C5.50 2.31 5.87 2.20 6.24 2.12 C6.62 2.05 7.00 2.01 7.39 2.01" stroke="#555" strokeWidth="1.17" />
              <path d="M15.34 12.89 C15.34 13.39 15.24 13.87 15.05 14.33 C14.86 14.79 14.59 15.20 14.23 15.55 C13.88 15.91 13.47 16.18 13.01 16.37 C12.55 16.56 12.07 16.66 11.57 16.66 C11.07 16.66 10.59 16.56 10.13 16.37 C9.67 16.18 9.26 15.91 8.91 15.55 C8.56 15.20 8.28 14.79 8.09 14.33 C7.90 13.87 7.81 13.39 7.81 12.89 C7.81 12.39 7.90 11.91 8.09 11.45 C8.28 10.99 8.56 10.58 8.91 10.23 C9.26 9.87 9.67 9.60 10.13 9.41 C10.59 9.22 11.07 9.12 11.57 9.12 C12.07 9.12 12.55 9.22 13.01 9.41 C13.47 9.60 13.88 9.87 14.23 10.23 C14.59 10.58 14.86 10.99 15.05 11.45 C15.24 11.91 15.34 12.39 15.34 12.89" stroke="#555" strokeWidth="1.17" />
              <path d="M15.34 22.93 C15.34 23.43 15.24 23.91 15.05 24.37 C14.86 24.83 14.59 25.24 14.23 25.59 C13.88 25.95 13.47 26.22 13.01 26.41 C12.55 26.60 12.07 26.70 11.57 26.70 C11.07 26.70 10.59 26.60 10.13 26.41 C9.67 26.22 9.26 25.95 8.91 25.59 C8.56 25.24 8.28 24.83 8.09 24.37 C7.90 23.91 7.81 23.43 7.81 22.93 C7.81 22.43 7.90 21.95 8.09 21.49 C8.28 21.03 8.56 20.62 8.91 20.27 C9.26 19.92 9.67 19.64 10.13 19.45 C10.59 19.26 11.07 19.17 11.57 19.17 C12.07 19.17 12.55 19.26 13.01 19.45 C13.47 19.64 13.88 19.92 14.23 20.27 C14.59 20.62 14.86 21.03 15.05 21.49 C15.24 21.95 15.34 22.43 15.34 22.93" stroke="#555" strokeWidth="1.17" />
              <path d="M15.34 32.97 C15.34 33.47 15.24 33.95 15.05 34.41 C14.86 34.88 14.59 35.28 14.23 35.64 C13.88 35.99 13.47 36.26 13.01 36.45 C12.55 36.64 12.07 36.74 11.57 36.74 C11.07 36.74 10.59 36.64 10.13 36.45 C9.67 36.26 9.26 35.99 8.91 35.64 C8.56 35.28 8.28 34.88 8.09 34.41 C7.90 33.95 7.81 33.47 7.81 32.97 C7.81 32.47 7.90 31.99 8.09 31.53 C8.28 31.07 8.56 30.66 8.91 30.31 C9.26 29.96 9.67 29.69 10.13 29.49 C10.59 29.30 11.07 29.21 11.57 29.21 C12.07 29.21 12.55 29.30 13.01 29.49 C13.47 29.69 13.88 29.96 14.23 30.31 C14.59 30.66 14.86 31.07 15.05 31.53 C15.24 31.99 15.34 32.47 15.34 32.97" stroke="#555" strokeWidth="1.17" />
              <path d="M24.12 13.73 C24.12 13.95 24.08 14.16 24.00 14.37 C23.91 14.57 23.79 14.75 23.63 14.91 C23.48 15.07 23.30 15.19 23.09 15.27 C22.89 15.36 22.67 15.40 22.45 15.40 C22.23 15.40 22.01 15.36 21.81 15.27 C21.60 15.19 21.42 15.07 21.27 14.91 C21.11 14.75 20.99 14.57 20.90 14.37 C20.82 14.16 20.78 13.95 20.78 13.73 C20.78 13.50 20.82 13.29 20.90 13.09 C20.99 12.88 21.11 12.70 21.27 12.54 C21.42 12.39 21.60 12.26 21.81 12.18 C22.01 12.09 22.23 12.05 22.45 12.05 C22.67 12.05 22.89 12.09 23.09 12.18 C23.30 12.26 23.48 12.39 23.63 12.54 C23.79 12.70 23.91 12.88 24.00 13.09 C24.08 13.29 24.12 13.50 24.12 13.73" stroke="#555" strokeWidth="1.17" />
            </svg><span>نمای پشت</span></div>
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
