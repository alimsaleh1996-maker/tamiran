import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { readSheet } from "./xlsx-reader";
import { importCatalogItems } from "./directadmin-api";
import { normalizeQueueSearch } from "./queue-search";
import type { DeviceCatalogItem } from "./catalog";
import { catalogMatch, type CatalogName } from "./catalog-similarity";
import "./reception-identity.css";

export type CatalogImportRow = CatalogName & { sourceRow?: number };
export function parseCatalogRows(
  rows: unknown[][],
  existing: CatalogImportRow[] = [],
) {
  const aliases = [
    ["نوع", "نوع دستگاه", "type", "device type"],
    ["برند", "مارک", "brand"],
    ["مدل", "model"],
  ];
  const header = (rows[0] ?? []).map((v) =>
    normalizeQueueSearch(String(v ?? "")),
  );
  const columns = aliases.map((names) =>
    header.findIndex((v) => names.includes(v)),
  );
  if (columns.some((v) => v < 0) || header.filter(Boolean).length !== 3)
    throw new Error(
      "ردیف اول باید سه عنوان «نوع»، «برند» و «مدل» داشته باشد. فایل نمونه را دریافت کنید.",
    );
  const found = [...existing];
  const duplicateMatches: { sourceRow: number; existing: CatalogName }[] = [];
  const valid: CatalogImportRow[] = [];
  const errors: string[] = [];
  let duplicates = 0;
  let nonempty = 0;
  rows.slice(1).forEach((cells, index) => {
    if (!cells.some((v) => String(v ?? "").trim())) return;
    nonempty++;
    const [type, brand, model] = columns.map((col) =>
      String(cells[col] ?? "").trim(),
    );
    if (
      !type ||
      !brand ||
      !model ||
      type.length > 120 ||
      brand.length > 120 ||
      model.length > 160 ||
      cells.some((v, col) => !columns.includes(col) && String(v ?? "").trim())
    ) {
      errors.push(
        `ردیف ${index + 2}: نوع، برند و مدل را کامل و بدون ستون اضافه وارد کنید.`,
      );
      return;
    }
    const row = { type, brand, model, sourceRow: index + 2 };
    const match = found
      .map((item) => ({ item, kind: catalogMatch(row, item) }))
      .find((m) => m.kind !== null);
    if (match?.kind === "identical") {
      duplicates++;
      duplicateMatches.push({ sourceRow: index + 2, existing: match.item });
    } else if (match?.kind === "similar")
      errors.push(
        `ردیف ${index + 2}: نام مشابه «${match.item.type} / ${match.item.brand} / ${match.item.model}» وجود دارد؛ این ردیف را بررسی و از فایل حذف یا اصلاح کنید.`,
      );
    else {
      found.push(row);
      valid.push(row);
    }
  });
  if (nonempty > 500)
    throw new Error("حداکثر ۵۰۰ ردیف در هر بار بارگذاری مجاز است.");
  if (!nonempty)
    errors.push(
      "فایل خالی است؛ برگهٔ «داده‌ها» را با نوع، برند و مدل تکمیل کنید.",
    );
  return { valid, errors, duplicates, duplicateMatches };
}
export function catalogTemplate(): Uint8Array {
  const esc = (v: string) =>
    v
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  const sheet = (rows: string[][]) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews><cols><col min="1" max="3" width="32" customWidth="1"/></cols><sheetData>${rows.map((row, i) => `<row r="${i + 1}">${row.map((v, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const files = {
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="داده‌ها" sheetId="1" r:id="rId1"/><sheet name="راهنما" sheetId="2" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": sheet([["نوع", "برند", "مدل"]]),
    "xl/worksheets/sheet2.xml": sheet([
      ["برگهٔ داده‌ها را پر کنید؛ این برگه وارد نمی‌شود."],
      ["نوع", "برند", "مدل"],
      ["موبایل", "Samsung", "Galaxy A55"],
      ["لپ‌تاپ", "Lenovo", "ThinkPad T14"],
      ["هر ردیف یک ترکیب نوع، برند و مدل است؛ حداکثر ۵۰۰ ردیف."],
      ["نوع دستگاه با نوع تعمیرگاه متفاوت است. عنوان ستون‌ها را تغییر ندهید."],
    ]),
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, xml]) => [name, strToU8(xml)]),
    ),
  );
}
export function CatalogImport({
  items,
  onSaved,
  notify,
}: {
  items: DeviceCatalogItem[];
  onSaved: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [preview, setPreview] = useState<ReturnType<
    typeof parseCatalogRows
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = () => {
    const data = catalogTemplate();
    const url = URL.createObjectURL(
      new Blob([data as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "tamiran-catalog-template.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      className="catalog-import-panel"
      aria-label="ورود گروهی نوع، برند و مدل"
    >
      <div>
        <strong>
          <FileSpreadsheet size={19} aria-hidden="true" /> ورود گروهی اطلاعات
          پایه
        </strong>
        <p>
          ۱. فایل نمونه را بگیرید. ۲. برگهٔ «داده‌ها» را با سه ستون نوع، برند و
          مدل پر کنید. ۳. فایل را بررسی و ورود را تأیید کنید. نام‌های یکسان و
          مشابه با فهرست فعلی و ردیف‌های همین فایل تطبیق داده می‌شوند.
        </p>
      </div>
      <div className="identity-actions">
        <button type="button" className="outline-action" onClick={download}>
          <Download size={17} /> دانلود فایل نمونه Excel
        </button>
        <label className="excel-import-button">
          <Upload size={17} />
          {busy ? "در حال بررسی…" : "انتخاب فایل Excel"}
          <input
            aria-label="بارگذاری فایل نوع، برند و مدل"
            type="file"
            accept=".xlsx"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              setPreview(null);
              try {
                if (
                  !file.name.toLowerCase().endsWith(".xlsx") ||
                  file.size > 2 * 1024 * 1024
                )
                  throw new Error(
                    "فقط فایل XLSX با حجم حداکثر ۲ مگابایت مجاز است.",
                  );
                const rows = await readSheet(file);
                setPreview(
                  parseCatalogRows(
                    rows,
                    items.map((i) => ({
                      type: i.deviceType,
                      brand: i.brand,
                      model: i.model,
                    })),
                  ),
                );
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "فایل خوانده نشد.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="identity-error">
          {error}
        </p>
      )}
      {preview && (
        <div className="catalog-import-preview">
          <p role="status">
            {preview.valid.length.toLocaleString("fa")} ردیف جدید ·{" "}
            {preview.duplicates.toLocaleString("fa")} ردیف تکراری ·{" "}
            {preview.errors.length.toLocaleString("fa")} خطا
          </p>
          {preview.duplicateMatches.length > 0 && (
            <div className="catalog-duplicates">
              <strong>این ردیف‌ها دوباره تعریف نمی‌شوند</strong>
              <ul>
                {preview.duplicateMatches.slice(0, 20).map((match, i) => (
                  <li key={i}>
                    ردیف {match.sourceRow.toLocaleString("fa")}:{" "}
                    {match.existing.type} / {match.existing.brand} /{" "}
                    {match.existing.model}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.errors.length > 0 && (
            <div role="alert" className="identity-error">
              فایل هنوز وارد نشده است؛ خطاها را اصلاح و دوباره بارگذاری کنید.
              <ul>
                {preview.errors.slice(0, 20).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.valid.length > 0 && (
            <div className="responsive-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>نوع</th>
                    <th>برند</th>
                    <th>مدل</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.valid.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      <td>{row.type}</td>
                      <td>{row.brand}</td>
                      <td>{row.model}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <small>پیش‌نمایش حداکثر ۱۰ ردیف نخست</small>
            </div>
          )}
          <div className="identity-actions">
            <button
              type="button"
              className="primary-action"
              disabled={
                busy || preview.errors.length > 0 || !preview.valid.length
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await importCatalogItems(preview.valid);
                  await onSaved();
                  setPreview(null);
                  notify(
                    `${result.created.toLocaleString("fa")} مدل وارد شد؛ ${result.duplicates.toLocaleString("fa")} ردیف تکراری بود.`,
                  );
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "ورود انجام نشد؛ می‌توانید دوباره تلاش کنید.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              تأیید و ورود اطلاعات
            </button>
            <button
              type="button"
              className="outline-action"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
