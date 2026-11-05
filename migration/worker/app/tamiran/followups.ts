export type FollowUpStatus = "new" | "seen" | "in_progress" | "done";
export type FollowUpPriority = "normal" | "important" | "urgent";
export type FollowUpKind = "information" | "action" | "customer_callback";

export type CaseFollowUp = {
  id: string;
  receiptId: string;
  customerMobile?: string;
  device: string;
  customer: string;
  message: string;
  kind: FollowUpKind;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  ownerRole: "تکنسین" | "پذیرش" | "مدیر تعمیرگاه" | "کنترل کیفیت";
  ownerName: string;
  assignedToUserId?: number | null;
  createdBy: string;
  createdAt: string;
  dueLabel: string;
  overdue: boolean;
  requiresAcknowledgement: boolean;
  history?: Array<{
    type: string;
    actorName: string;
    targetName?: string;
    body?: string;
    createdAt: string;
  }>;
};

export const initialCaseFollowUps: CaseFollowUp[] = [];

export const followUpStatusLabels: Record<FollowUpStatus, string> = {
  new: "جدید",
  seen: "مشاهده شد",
  in_progress: "در حال پیگیری",
  done: "انجام شد",
};

export const followUpPriorityLabels: Record<FollowUpPriority, string> = {
  normal: "عادی",
  important: "مهم",
  urgent: "فوری",
};
