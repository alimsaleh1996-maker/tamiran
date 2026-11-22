export function moneyDigits(value: string): string {
  return value
    .replace(/[۰-۹٠-٩]/g, (v) =>
      String(v.charCodeAt(0) - (v >= "۰" ? 0x6f0 : 0x660)),
    )
    .replace(/[,٬\s]/g, "")
    .replace(/٫/g, ".");
}
export function tomanToRials(value: string): string | null {
  const text = moneyDigits(value);
  if (!text) return "";
  if (!/^\d+(?:\.\d?)?$/.test(text)) return null;
  const number = Math.round(Number(text) * 10);
  return Number.isSafeInteger(number) && number >= 0 ? String(number) : null;
}
export function formatToman(rials: string | number): string {
  const n = Number(rials);
  return rials === ""
    ? ""
    : new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(
        Number.isFinite(n) ? n / 10 : 0,
      );
}
