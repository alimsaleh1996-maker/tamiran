import type { V2Case } from "./v2-api";

export const technicalScreens = [
  "overview",
  "work",
  "diagnosis",
  "parts",
  "purchases",
  "estimate",
  "photos",
  "refer",
  "repaired",
  "unrepaired",
  "finance",
] as const;
export type TechnicalScreen = (typeof technicalScreens)[number];
export function readTechnicalScreen(): TechnicalScreen {
  const value = new URL(location.href).searchParams.get("techTask");
  return technicalScreens.includes(value as TechnicalScreen)
    ? (value as TechnicalScreen)
    : "overview";
}
export function writeTechnicalLocation(
  caseId: number,
  page: TechnicalScreen = "overview",
  back?: TechnicalScreen,
  replace = false,
) {
  const url = new URL(location.href);
  if (caseId) {
    url.searchParams.set("techCase", String(caseId));
    url.searchParams.set("techTask", page);
  } else {
    url.searchParams.delete("techCase");
    url.searchParams.delete("techTask");
  }
  if (back && caseId) url.searchParams.set("techReturn", back);
  else url.searchParams.delete("techReturn");
  window.history[replace ? "replaceState" : "pushState"](
    { ...history.state },
    "",
    url,
  );
}
export function technicalCaseFromLocation() {
  const id = Number(new URL(location.href).searchParams.get("techCase") ?? 0);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export function technicalStageScreen(item?: V2Case): TechnicalScreen {
  if (!item || item.receiptPending) return "overview";
  switch (item.status) {
    case "diagnosing": return "diagnosis";
    case "estimate_pending": return "diagnosis";
    case "awaiting_parts":
    case "parts_closeout": return "parts";
    case "awaiting_customer_approval":
    case "qc_pending":
    case "qc_conditional":
    case "finance_pending":
    case "ready_for_delivery":
    case "delivered":
    case "closed":
    case "returned_unrepaired": return "overview";
    case "repairing":
    case "qc_rework": return "work";
    default: return "overview";
  }
}
