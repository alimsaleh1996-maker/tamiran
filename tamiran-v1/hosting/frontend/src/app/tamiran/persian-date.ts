export type PersianDateParts = { year: number; month: number; day: number };

const persianPartsFormatter = new Intl.DateTimeFormat(
  "en-US-u-ca-persian-nu-latn",
  {
    calendar: "persian",
    numberingSystem: "latn",
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  },
);

const persianDisplayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  calendar: "persian",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const persianLongFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  calendar: "persian",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export const persianMonthNames = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

export const persianWeekdayNames = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isoFromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function gregorianToPersian(value: string): PersianDateParts | null {
  const date = parseIso(value);
  if (!date) return null;
  const values: Record<string, number> = {};
  for (const part of persianPartsFormatter.formatToParts(date)) {
    if (["year", "month", "day"].includes(part.type))
      values[part.type] = Number(part.value);
  }
  if (!values.year || !values.month || !values.day) return null;
  return { year: values.year, month: values.month, day: values.day };
}

export function persianToGregorian(
  year: number,
  month: number,
  day: number,
): string | null {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  if (month > 6 && day > 30) return null;

  const dayOfYear =
    month <= 6 ? (month - 1) * 31 + day - 1 : 186 + (month - 7) * 30 + day - 1;
  const approximate = Date.UTC(year + 621, 2, 20 + dayOfYear, 12);
  for (let offset = -4; offset <= 4; offset += 1) {
    const candidate = new Date(approximate + offset * 86_400_000);
    const parts = gregorianToPersian(isoFromUtcDate(candidate));
    if (parts?.year === year && parts.month === month && parts.day === day)
      return isoFromUtcDate(candidate);
  }
  return null;
}

export function daysInPersianMonth(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return persianToGregorian(year, 12, 30) ? 30 : 29;
}

export function persianMonthStartWeekday(year: number, month: number) {
  const iso = persianToGregorian(year, month, 1);
  const date = iso ? parseIso(iso) : null;
  if (!date) return 0;
  return (date.getUTCDay() + 1) % 7;
}

export function formatPersianDate(value: string, long = false) {
  const date = parseIso(value);
  if (!date) return "انتخاب تاریخ";
  return (long ? persianLongFormatter : persianDisplayFormatter).format(date);
}

export function todayGregorianIso() {
  const parts: Record<string, number> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())) {
    if (["year", "month", "day"].includes(part.type))
      parts[part.type] = Number(part.value);
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addGregorianDays(value: string, days: number) {
  const date = parseIso(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromUtcDate(date);
}

export function addPersianMonths(
  value: string,
  months: number,
  inclusiveEnd = false,
) {
  const parts = gregorianToPersian(value);
  if (!parts) return value;
  const targetIndex = parts.year * 12 + parts.month - 1 + months;
  const targetYear = Math.floor(targetIndex / 12);
  const targetMonth = (((targetIndex % 12) + 12) % 12) + 1;
  const targetDay = Math.min(
    parts.day,
    daysInPersianMonth(targetYear, targetMonth),
  );
  const converted =
    persianToGregorian(targetYear, targetMonth, targetDay) ?? value;
  return inclusiveEnd ? addGregorianDays(converted, -1) : converted;
}

export function shiftPersianMonth(year: number, month: number, delta: number) {
  const index = year * 12 + month - 1 + delta;
  return {
    year: Math.floor(index / 12),
    month: (((index % 12) + 12) % 12) + 1,
  };
}

export function isSamePersianDay(
  value: string,
  year: number,
  month: number,
  day: number,
) {
  const parts = gregorianToPersian(value);
  return parts?.year === year && parts.month === month && parts.day === day;
}
