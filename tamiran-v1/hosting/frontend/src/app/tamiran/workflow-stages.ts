/** Display grouping only. Server transitions and role checks remain authoritative. */
export const repairStages = [
  {
    id: "assignment",
    title: "تخصیص",
    statuses: ["reception", "awaiting_assignment"],
  },
  { id: "assigned", title: "شروع بررسی", statuses: ["assigned"] },
  { id: "diagnosis", title: "عیب‌یابی", statuses: ["diagnosing"] },
  { id: "estimate", title: "برآورد", statuses: ["estimate_pending"] },
  {
    id: "approval",
    title: "تأیید مشتری",
    statuses: ["awaiting_customer_approval"],
  },
  { id: "parts", title: "انتظار قطعه", statuses: ["awaiting_parts"] },
  { id: "repair", title: "تعمیر", statuses: ["repairing"] },
  { id: "closeout", title: "تسویهٔ قطعات", statuses: ["parts_closeout"] },
  {
    id: "quality",
    title: "کنترل کیفیت",
    statuses: ["qc_pending", "qc_rework", "qc_conditional"],
  },
  { id: "finance", title: "مالی", statuses: ["finance_pending"] },
  { id: "delivery", title: "آمادهٔ تحویل", statuses: ["ready_for_delivery"] },
  {
    id: "closed",
    title: "مختومه",
    statuses: ["returned_unrepaired", "delivered", "cancelled", "closed"],
  },
  { id: "other", title: "سایر مراحل", statuses: [] },
];
export function stageForStatus(status: string): string {
  return (
    repairStages.find((stage) => stage.statuses.includes(status))?.id ?? "other"
  );
}
export function initialStageForStatuses(statuses: string[]): string {
  return (
    repairStages.find(
      (stage) =>
        stage.id !== "closed" &&
        statuses.some((status) => stageForStatus(status) === stage.id),
    )?.id ?? (statuses.length ? stageForStatus(statuses[0]) : "assigned")
  );
}
