import { useEffect, useState } from "react";
import type { QueuePage } from "./v2-api";

const fa = new Intl.NumberFormat("fa-IR");

export function useOperationalQueue<T>(
  request: string | null, revision: number, load: (params: string) => Promise<T>,
) {
  const key = request === null ? null : JSON.stringify([request, revision]);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  useEffect(() => {
    if (request === null || key === null) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void load(request).then(data => {
        if (active) setResult({ key, data });
      }, (error: unknown) => {
        if (active) setResult({ key, error: error instanceof Error ? error.message : "دریافت صف انجام نشد." });
      });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [request, key, load]);
  const current = result?.key === key ? result : undefined;
  return { data: current?.data, error: current?.error, loading: key !== null && !current };
}

export function QueueFeedback({ page, loading, error, onOffset, onRetry }: {
  page?: QueuePage; loading: boolean; error?: string;
  onOffset: (offset: number) => void; onRetry: () => void;
}) {
  if (loading) return <p role="status">در حال بارگذاری نتایج…</p>;
  if (error) return <div className="v2-alert" role="alert">
    <span>{error}</span><button type="button" onClick={onRetry}>تلاش دوباره</button>
  </div>;
  if (!page) return null;
  const { offset, pageSize, total } = page;
  const end = Math.min(offset + pageSize, total);
  return <nav className="v2-row-actions operational-pagination" aria-label="صفحه‌بندی صف">
    <span role="status">{total === 0 ? "نتیجه‌ای نیست. فیلترها یا عبارت جست‌وجو را تغییر دهید."
      : offset >= total ? "تعداد نتایج تغییر کرد. به صفحهٔ قبل برگردید."
      : `${fa.format(offset + 1)} تا ${fa.format(end)} از ${fa.format(total)} نتیجه`}</span>
    {offset > 0 && <button type="button" onClick={() => onOffset(Math.max(0, offset - pageSize))}>صفحه قبل</button>}
    {offset + pageSize < total && <button type="button" onClick={() => onOffset(offset + pageSize)}>صفحه بعد</button>}
  </nav>;
}
