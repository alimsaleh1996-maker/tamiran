import { useState } from "react";
import { MoneyInput, formatRials } from "./money-input";
import { moneyDigits } from "./money";
import {
  inventoryV2Action,
  type TechnicalProjection,
  type V2InventoryPayload,
} from "./v2-api";
export type ManualRow = {
  id: string;
  title: string;
  quantity: string;
  purchase: string;
  sale: string;
  note: string;
  saved?: boolean;
};
export const newManualRow = (): ManualRow => ({
  id: crypto.randomUUID(),
  title: "",
  quantity: "1",
  purchase: "",
  sale: "",
  note: "",
});
export const partLabel: Record<string, string> = {
  pending: "منتظر انبار",
  reserved: "رزرو شده",
  partially_delivered: "تحویل ناقص",
  needs_supply: "منتظر تأمین",
  delivered: "تحویل تکنسین",
  consumed: "مصرف شده",
  returned: "مرجوع شده",
  cancelled: "لغو شده",
  rejected: "رد شده",
  awaiting_technician: "آماده ثبت مصرف یا مرجوعی",
};
export function TechnicianPartsPage({
  caseId,
  actorId,
  data,
  inventory,
  stockError,
  rows,
  setRows,
  stockId,
  stockQuantity,
  stockLines,
  onStockLines,
  onStockChange,
  source,
  onSource,
  busy,
  onManual,
  onRequest,
  onSettled,
}: {
  caseId: number;
  actorId: number;
  data: TechnicalProjection;
  inventory: V2InventoryPayload | null;
  stockError: string;
  rows: ManualRow[];
  setRows: (rows: ManualRow[]) => void;
  stockId: string;
  stockQuantity: string;
  stockLines: Array<{ itemId: number; quantity: number; title: string }>;
  onStockLines: (lines: Array<{ itemId: number; quantity: number; title: string }>) => void;
  onStockChange: (patch: { stockId?: string; stockQuantity?: string }) => void;
  source: "manual" | "stock";
  onSource: (source: "manual" | "stock") => void;
  busy: boolean;
  onManual: () => void;
  onRequest: () => void;
  onSettled: (job: () => Promise<void>) => void;
}) {
  const [query, setQuery] = useState("");
  const requests =
      inventory?.requests.filter((r) => r.case_id === caseId) ?? [],
    issues = inventory?.issues.filter((i) => i.case_id === caseId) ?? [];
  const update = (id: string, patch: Partial<ManualRow>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const selectedStock = inventory?.items.find((item) => item.id === Number(stockId));
  const pickedQuantity = Number(moneyDigits(stockQuantity));
  const validPick = !!selectedStock && Number.isSafeInteger(pickedQuantity) && pickedQuantity > 0 && pickedQuantity <= 100000;
  return (
    <>
      <div className="tech-methods" role="group" aria-label="روش تأمین قطعه">
        <button
          aria-pressed={source === "stock"}
          onClick={() => onSource("stock")}
          disabled={busy}
        >
          از انبار
        </button>
        <button
          aria-pressed={source === "manual"}
          onClick={() => onSource("manual")}
          disabled={busy}
        >
          ثبت آزاد
        </button>
      </div>
      {data.permissions.parts &&
        (source === "manual" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onManual();
            }}
          >
            <fieldset disabled={busy}>
              <p className="tech-hint">
                قطعهٔ مصرف‌شده خارج از انبار را ثبت کنید؛ موجودی انبار تغییر
                نمی‌کند.
              </p>
              {rows.map((row, index) => (
                <section
                  className="tech-part-row"
                  key={row.id}
                  aria-label={`ردیف ${(index + 1).toLocaleString("fa-IR")}`}
                >
                  <div className="tech-form-grid">
                    <label htmlFor={`part-title-${row.id}`}>
                      نام قطعه
                      <input
                        id={`part-title-${row.id}`}
                        required
                        maxLength={240}
                        value={row.title}
                        disabled={row.saved}
                        onChange={(e) =>
                          update(row.id, { title: e.target.value })
                        }
                      />
                    </label>
                    <label htmlFor={`part-quantity-${row.id}`}>
                      تعداد
                      <input
                        id={`part-quantity-${row.id}`}
                        required
                        inputMode="decimal"
                        value={row.quantity}
                        disabled={row.saved}
                        onChange={(e) =>
                          update(row.id, {
                            quantity: moneyDigits(e.target.value),
                          })
                        }
                      />
                    </label>
                    {data.permissions.purchase && (
                      <label htmlFor={`part-buy-${row.id}`}>
                        قیمت خرید هر واحد
                        <MoneyInput
                          id={`part-buy-${row.id}`}
                          disabled={row.saved}
                          value={row.purchase}
                          onChange={(purchase) => update(row.id, { purchase })}
                        />
                      </label>
                    )}
                    <label htmlFor={`part-sale-${row.id}`}>
                      قیمت فروش هر واحد
                      <MoneyInput
                        id={`part-sale-${row.id}`}
                        disabled={row.saved}
                        required
                        value={row.sale}
                        onChange={(sale) => update(row.id, { sale })}
                      />
                    </label>
                  </div>
                  <label>
                    توضیح اختیاری
                    <input
                      maxLength={1000}
                      disabled={row.saved}
                      value={row.note}
                      onChange={(e) => update(row.id, { note: e.target.value })}
                    />
                  </label>
                  {row.saved ? (
                    <p>این ردیف ثبت شد.</p>
                  ) : (
                    rows.length > 1 && (
                      <button
                        type="button"
                        className="tech-text-button"
                        onClick={() =>
                          setRows(rows.filter((r) => r.id !== row.id))
                        }
                      >
                        حذف این ردیف
                      </button>
                    )
                  )}
                </section>
              ))}
              <div className="tech-actions">
                <button
                  type="button"
                  onClick={() => setRows([...rows, newManualRow()])}
                >
                  افزودن ردیف
                </button>
                <button type="submit" className="tech-primary">
                  ثبت قطعات و بازگشت
                </button>
              </div>
            </fieldset>
          </form>
        ) : data.permissions.stock ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRequest();
            }}
          >
            <fieldset disabled={busy || !inventory}>
              <label>
                جستجوی قطعه
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="نام یا کد قطعه"
                />
              </label>
              <label>
                قطعه انبار
                <select
                  required={!stockLines.length}
                  value={stockId}
                  onChange={(e) => onStockChange({ stockId: e.target.value })}
                >
                  <option value="">انتخاب قطعه</option>
                  {inventory?.items
                    .filter((p) => p.id === Number(stockId) ||
                      `${p.title} ${p.item_code}`
                        .toLowerCase()
                        .includes(query.trim().toLowerCase()),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} · موجودی آزاد{" "}
                        {p.available_quantity.toLocaleString("fa-IR")} ·{" "}
                        {formatRials(String(p.sale_price))} ریال
                      </option>
                    ))}
                </select>
              </label>
              <label>
                تعداد درخواست
                <input
                  required={!!stockId}
                  inputMode="numeric"
                  value={stockQuantity}
                  onChange={(e) =>
                    onStockChange({
                      stockQuantity: moneyDigits(e.target.value),
                    })
                  }
                />
              </label>
              <p className="tech-hint">
                درخواست، مصرف قطعه نیست؛ مصرف یا مرجوعی را پس از تحویل انبار ثبت
                کنید.
              </p>
              <button type="button" disabled={!validPick || stockLines.length >= 30} onClick={() => {
                if (selectedStock) onStockLines([...stockLines, { itemId: selectedStock.id, quantity: pickedQuantity, title: selectedStock.title }]);
              }}>افزودن ردیف انبار</button>
              {!!stockLines.length && <ul>{stockLines.map((line, index) => <li key={index}>
                {line.title} · {line.quantity.toLocaleString("fa-IR")} عدد{" "}
                <button type="button" onClick={() => onStockLines(stockLines.filter((_, i) => i !== index))}>حذف ردیف</button>
              </li>)}</ul>}
              <button className="tech-primary" type="submit" disabled={stockId ? (!validPick || stockLines.length >= 30) : !stockLines.length}>
                ثبت درخواست و بازگشت
              </button>
            </fieldset>
          </form>
        ) : (
          <p>
            ماژول مجاز انبار در دسترس نیست. ثبت آزاد برای این پرونده فعال است.
          </p>
        ))}
      <h3>قطعات این پرونده</h3>
      <ul className="tech-plain-list">
        {data.parts.map((p) => (
          <li key={p.sourceKey}>
            <strong>{p.title}</strong>
            <span>
              {p.sourceType === "manual" ? "ثبت آزاد" : "انبار"} · مصرف‌شده ·{" "}
              {Number(p.quantity).toLocaleString("fa-IR")} ×{" "}
              {formatRials(String(p.saleUnitPrice))} ریال
            </span>
            {data.permissions.purchase && p.purchaseUnitCost !== undefined && (
              <span>
                خرید هر واحد: {formatRials(String(p.purchaseUnitCost))} ریال
              </span>
            )}
          </li>
        ))}
      </ul>
      {!data.parts.length && (
        <p className="tech-hint">قطعهٔ مصرف‌شده‌ای ثبت نشده است.</p>
      )}
      {!!requests.length && (
        <>
          <h3>درخواست‌های انبار</h3>
          <ul className="tech-plain-list">
            {requests.map((r) => (
              <li key={r.public_id}>
                <strong>
                  {r.item_title} · {partLabel[r.status] ?? "در حال پیگیری"}
                </strong>
                <span>
                  درخواست {r.quantity.toLocaleString("fa-IR")} · تحویل{" "}
                  {r.delivered_quantity.toLocaleString("fa-IR")} · مصرف{" "}
                  {r.consumed_quantity.toLocaleString("fa-IR")} · مرجوع{" "}
                  {r.returned_quantity.toLocaleString("fa-IR")}
                </span>
                {data.permissions.parts &&
                  !["consumed", "returned", "cancelled", "rejected"].includes(
                    r.status,
                  ) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        onSettled(async () => {
                          await inventoryV2Action({
                            action: "cancel",
                            requestId: r.id,
                            warehouseId: inventory?.warehouse?.id,
                            reason: "لغو مانده درخواست از پرونده فنی",
                          });
                        })
                      }
                    >
                      لغو مانده درخواست
                    </button>
                  )}
              </li>
            ))}
          </ul>
        </>
      )}
      {issues
        .filter((i) => !["consumed", "returned"].includes(i.status))
        .map((i) => (
          <section className="tech-issued" key={i.public_id}>
            <p>
              {i.item_title} · {i.quantity.toLocaleString("fa-IR")} عدد
              تحویل‌شده
            </p>
            {i.technician_user_id === actorId && data.permissions.activity ? (
              <div className="tech-actions">
                {(["consumed", "returned"] as const).map((decision) => (
                  <button
                    key={decision}
                    disabled={busy}
                    onClick={() =>
                      onSettled(async () => {
                        await inventoryV2Action({
                          action: "finalize_issue",
                          issuePublicId: i.public_id,
                          decision,
                        });
                      })
                    }
                  >
                    {decision === "consumed" ? "مصرف شد" : "مرجوع به انبار"}
                  </button>
                ))}
              </div>
            ) : (
              <p>تعیین تکلیف این تحویل با دریافت‌کنندهٔ قطعه است.</p>
            )}
          </section>
        ))}
    </>
  );
}
