export function moneyDigits(value: string): string {
  return value
    .replace(/[۰-۹٠-٩]/g, (v) =>
      String(v.charCodeAt(0) - (v >= "۰" ? 0x6f0 : 0x660)),
    )
    .replace(/[,٬\s]/g, "")
    .replace(/٫/g, ".");
}
export function parseRials(value: string): string | null {
  const text = moneyDigits(value);
  if (!text) return "";
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 0 ? String(number) : null;
}
export function formatRials(rials: string | number): string {
  const n = Number(rials);
  return rials === ""
    ? ""
    : new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(
        Number.isFinite(n) ? n : 0,
      );
}
