export const intakeAppearance = [
  "بدون ایراد ظاهری", "خط‌وخش", "ترک یا شکستگی", "فرورفتگی", "آثار ضربه",
  "تغییر رنگ یا سوختگی", "آثار آب‌خوردگی", "بازشدگی قبلی", "تاب‌داشتگی",
] as const;
export const damageTypes: readonly string[] = intakeAppearance.slice(1,6);
export const damagePlaces = [
  "کل دستگاه", "صفحه‌نمایش", "پشت دستگاه", "لبه بالا", "لبه پایین", "لبه راست", "لبه چپ", "محل نامشخص",
] as const;
export const exclusiveDamagePlaces: readonly string[] = [damagePlaces[0],damagePlaces[7]];
export type DamageLocations = Record<string,string[]>;
export function appearanceDescription(state: string, map?: DamageLocations) {
  const places = map?.[state];
  return places?.length ? `${state} · ${places.join("، ")}` : state;
}
