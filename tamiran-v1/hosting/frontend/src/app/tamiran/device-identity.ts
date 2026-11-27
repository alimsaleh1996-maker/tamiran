// Match the mobile-device rules in v2_identity_value() before submitting.
export function normalizeImei(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x6f0 : 0x660))).replace(/[\s-]+/gu, "");
}

export function imeiError(value: string) {
  if (!value) return "IMEI دستگاه را وارد کنید.";
  if (!/^[0-9]{15}$/.test(value) || /^(.)\1+$/.test(value)) return "IMEI باید ۱۵ رقم معتبر باشد.";
  const sum = [...value].reduce((total, char, index) => {
    const digit = Number(char) * (index % 2 === 1 ? 2 : 1);
    return total + (digit > 9 ? digit - 9 : digit);
  }, 0);
  return sum % 10 === 0 ? "" : "رقم کنترل IMEI صحیح نیست. شماره را از روی دستگاه دوباره بررسی کنید.";
}
