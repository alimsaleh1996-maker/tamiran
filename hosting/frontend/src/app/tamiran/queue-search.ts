/** Normalize only for matching; never rewrite stored identifiers or customer data. */
export function normalizeQueueSearch(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .trim()
    .toLocaleLowerCase("fa");
}

export function matchesQueueSearch(query: string, values: string[]): boolean {
  const normalized = normalizeQueueSearch(query);
  return (
    !normalized ||
    values.some((value) => normalizeQueueSearch(value).includes(normalized))
  );
}

/** SQL DATETIME values are stored in UTC; ISO values already carry their zone. */
export function queueTimestamp(value: string): Date {
  return new Date(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? value.replace(" ", "T") + "Z"
      : value,
  );
}
