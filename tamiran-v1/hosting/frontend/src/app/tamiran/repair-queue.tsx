import { useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { repairCaseStatusLabels, type RepairCaseRecord } from "./operations";
import { matchesQueueSearch, queueTimestamp } from "./queue-search";

const number = new Intl.NumberFormat("fa-IR");
const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "short",
  timeStyle: "short",
});

export function RepairQueue({
  cases,
  loading,
  onOpen,
}: {
  cases: RepairCaseRecord[];
  loading: boolean;
  onOpen: () => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const filtered = cases.filter(
    (item) =>
      (!status || item.status === status) &&
      matchesQueueSearch(search, [
        item.receiptNumber,
        item.customerName,
        item.customerMobile,
        item.identifier,
        `${item.brand} ${item.model}`,
        item.declaredIssue,
      ]),
  );
  const visible = filtered.slice(0, 8);
  const hasFilters = Boolean(search || status);
  return (
    <>
      <div
        className="repair-queue-filters"
        role="search"
        aria-label="فیلتر آخرین پرونده‌ها"
      >
        <label className="repair-queue-search">
          <span>جست‌وجوی پرونده</span>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="رسید، مشتری، موبایل یا دستگاه"
            />
          </div>
        </label>
        <label>
          <span>وضعیت پرونده</span>
          <select
            aria-label="وضعیت پرونده"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(repairCaseStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            className="outline-action"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
          >
            پاک‌کردن فیلترها
          </button>
        )}
      </div>
      <p className="repair-queue-count" role="status" aria-live="polite">
        {loading
          ? "در حال دریافت اطلاعات…"
          : `${number.format(visible.length)} از ${number.format(filtered.length)} نتیجه در صفحهٔ دریافت‌شده`}
        {filtered.length > visible.length &&
          " · برای ادامه، همه پرونده‌ها را باز کنید."}
      </p>
      <div className="queue-table-wrap">
        <table className="queue-table repair-queue-table">
          <caption className="queue-sr-only">
            آخرین پرونده‌های صفحهٔ دریافت‌شده، به‌ترتیب آخرین تغییر
          </caption>
          <thead>
            <tr>
              {[
                "رسید",
                "دستگاه و مشتری",
                "ایراد اعلامی",
                "وضعیت",
                "آخرین تغییر",
                "عملیات",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const timestamp = queueTimestamp(item.updatedAt);
              const tone =
                item.status === "awaiting_assignment"
                  ? "gold"
                  : item.status === "ready_for_delivery"
                    ? "sky"
                    : item.status === "awaiting_part"
                      ? "coral"
                      : "teal";
              return (
                <tr key={item.id}>
                  <td data-label="رسید">
                    <button
                      type="button"
                      className="receipt-link"
                      onClick={onOpen}
                    >
                      <bdi>{item.receiptNumber}</bdi>
                    </button>
                  </td>
                  <td data-label="دستگاه و مشتری">
                    <div className="device-cell">
                      <strong>
                        {item.brand} {item.model}
                      </strong>
                      <span>{item.customerName}</span>
                    </div>
                  </td>
                  <td data-label="ایراد اعلامی">{item.declaredIssue}</td>
                  <td data-label="وضعیت">
                    <span className={`status-pill tone-${tone}`}>
                      {repairCaseStatusLabels[item.status]}
                    </span>
                  </td>
                  <td data-label="آخرین تغییر" className="muted-cell">
                    {Number.isNaN(timestamp.getTime()) ? (
                      "—"
                    ) : (
                      <time dateTime={timestamp.toISOString()}>
                        {date.format(timestamp)}
                      </time>
                    )}
                  </td>
                  <td data-label="عملیات">
                    <button
                      type="button"
                      className="row-action"
                      onClick={onOpen}
                      aria-label={`مشاهده پرونده‌ها برای ${item.receiptNumber}`}
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loading && !visible.length && (
        <div className="dashboard-empty-state">
          <strong>
            {hasFilters
              ? "پرونده‌ای با این فیلترها پیدا نشد"
              : "هنوز اطلاعاتی ثبت نشده است"}
          </strong>
          <p>
            {hasFilters
              ? "جست‌وجو یا وضعیت را تغییر دهید؛ فیلترها فقط روی صفحهٔ دریافت‌شده اعمال می‌شوند."
              : "با ثبت اولین پذیرش، پرونده و رسید آن اینجا نمایش داده می‌شود."}
          </p>
        </div>
      )}
    </>
  );
}
