export type DeviceCatalogItem = {
  id: number;
  deviceType: string;
  brand: string;
  model: string;
  usageCount: number;
  isActive: boolean;
};

const legacyDeviceTypeLabels: Record<string, string> = {
  mobile: "موبایل و تبلت",
  laptop: "لپ‌تاپ و رایانه",
  appliance: "لوازم خانگی",
  automotive: "خودرو",
  motorcycle: "موتورسیکلت",
  generic: "عمومی و سایر",
};

export function displayDeviceType(value: string): string {
  const normalized = value.trim();
  return legacyDeviceTypeLabels[normalized] ?? normalized;
}

// نصب تازه هیچ نوع، برند یا مدل آماده‌ای ندارد؛ مدیر تعمیرگاه فهرست واقعی خود را می‌سازد.
export const initialDeviceCatalog: DeviceCatalogItem[] = [];
