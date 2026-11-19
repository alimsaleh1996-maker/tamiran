export type CatalogName = { type: string; brand: string; model: string };
const digits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (v) =>
    String(v.charCodeAt(0) - (v >= "۰" ? 0x6f0 : 0x660)),
  );
export const catalogText = (value: string) =>
  digits(
    value
      .replace(/[！-～]/g, (v) => String.fromCharCode(v.charCodeAt(0) - 0xfee0))
      .replace(/　/g, " "),
  )
    .toLowerCase()
    .replace(/ي|ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064b-\u065f\u0670\u0640\u200c\u200d]/g, "");
const compact = (value: string) =>
  catalogText(value).replace(/[^\p{L}\p{N}]/gu, "");
const typeAliases: Record<string, string> = {
  موبایل: "mobile",
  گوشی: "mobile",
  گوشیموبایل: "mobile",
  mobile: "mobile",
  phone: "mobile",
  smartphone: "mobile",
  موبایلوتبلت: "mobile",
  تبلت: "tablet",
  tablet: "tablet",
  لپتاپ: "laptop",
  رایانه: "computer",
  کامپیوتر: "computer",
  laptop: "laptop",
  notebook: "laptop",
  computer: "computer",
  هندزفری: "earbuds",
  هندسفری: "earbuds",
  handsfree: "earbuds",
  earbuds: "earbuds",
  هدفون: "earbuds", headphone: "earbuds", headphones: "earbuds",
  ایرباد: "earbuds",
  هدفونبیسیم: "earbuds",
};
const brandAliases: Record<string, string> = {
  سامسونگ: "samsung",
  سامسنگ: "samsung",
  samsung: "samsung",
  اپل: "apple",
  apple: "apple",
  شیائومی: "xiaomi",
  شیاومی: "xiaomi",
  xiaomi: "xiaomi",
  هواوی: "huawei",
  هوآوی: "huawei",
  huawei: "huawei",
  لنوو: "lenovo",
  lenovo: "lenovo",
  ایسوس: "asus",
  asus: "asus",
  اچپی: "hp",
  hp: "hp",
  سونی: "sony",
  sony: "sony",
  جیبیال: "jbl",
  jbl: "jbl",
  نوکیا: "nokia",
  nokia: "nokia",
};
export const catalogType = (value: string) =>
  typeAliases[compact(value)] ?? compact(value);
export const catalogBrand = (value: string) =>
  brandAliases[compact(value)] ?? compact(value);
export function modelSignature(value: string, brand: string) {
  let text = catalogText(value)
    .replace(/ایرپادز?|air\s*pods?/gu, " airpods ")
    .replace(/گلکسی/gu, " galaxy ")
    .replace(/پرو/gu, " pro ")
    .replace(/پلاس/gu, " plus ")
    .replace(/مکس/gu, " max ")
    .replace(/اولترا|الترا/gu, " ultra ");
  if (catalogBrand(brand) === "samsung") text = text.replace(/galaxy/g, " ");
  text = text
    .replace(/(\p{L})(\p{N})/gu, "$1 $2")
    .replace(/(\p{N})(\p{L})/gu, "$1 $2");
  const tokens = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  return {
    compact: tokens.join(""),
    codes: tokens.filter((t,i)=>/^\p{L}{1,3}$/u.test(t)&&(/^\d+$/.test(tokens[i-1]??"")||/^\d+$/.test(tokens[i+1]??""))).sort().join("|"),
    sorted: [...tokens].sort().join("|"),
    digits: (text.match(/\d+/g) ?? []).sort().join("|"),
  };
}
// Damerau edit distance treats a transposed pair as one typo; model numbers stay exact.
export function catalogDistance(a: string, b: string): number {
  const x = [...a],
    y = [...b];
  const d = Array.from(
    { length: x.length + 1 },
    () => Array(y.length + 1).fill(0) as number[],
  );
  for (let i = 0; i <= x.length; i++) d[i][0] = i;
  for (let j = 0; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[x.length][y.length];
}
export function catalogMatch(
  a: CatalogName,
  b: CatalogName,
): "identical" | "similar" | null {
  if (
    catalogType(a.type) !== catalogType(b.type) ||
    catalogBrand(a.brand) !== catalogBrand(b.brand)
  )
    return null;
  const x = modelSignature(a.model, a.brand),
    y = modelSignature(b.model, b.brand);
  if (!x.compact || !y.compact) return null;
  if (x.compact === y.compact) return "identical";
  if(x.digits !== y.digits || x.codes !== y.codes) return null;
  if(x.sorted === y.sorted) return "identical";
  if (x.compact.startsWith(y.compact) || y.compact.startsWith(x.compact))
    return null;
  const length = Math.max([...x.compact].length, [...y.compact].length);
  const limit = length >= 12 ? 2 : 1;
  if(Math.abs([...x.compact].length - [...y.compact].length)>limit)return null;
  return length >= 6 &&
    catalogDistance(x.compact, y.compact) <= limit &&
    catalogDistance(x.compact, y.compact) / length <= 0.15
    ? "similar"
    : null;
}
