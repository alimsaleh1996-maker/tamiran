import type { RepairCaseStatus } from "../tamiran/operations";

export type CaseMutationRequest = {
  id: number;
  expectedVersion: number;
  status?: RepairCaseStatus;
  assignedToUserId?: number | null;
  result?: string;
  operationReport?: string;
  reason?: string;
  deliveryAmount?: number;
  deliveredToName?: string;
  deliveryNotes?: string;
};

const safeNonNegativeInteger = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} معتبر نیست.`);
  return value;
};

export function buildCaseMutationRequest(
  input: CaseMutationRequest,
): CaseMutationRequest {
  if (!Number.isSafeInteger(input.id) || input.id < 1)
    throw new Error("شناسه پرونده معتبر نیست.");
  safeNonNegativeInteger(input.expectedVersion, "نسخه پرونده");
  if (
    input.deliveryAmount !== undefined &&
    (!Number.isSafeInteger(input.deliveryAmount) || input.deliveryAmount < 0)
  )
    throw new Error("مبلغ تحویل معتبر نیست.");
  if (
    input.assignedToUserId !== undefined &&
    input.assignedToUserId !== null &&
    (!Number.isSafeInteger(input.assignedToUserId) ||
      input.assignedToUserId < 1)
  )
    throw new Error("مسئول پرونده معتبر نیست.");
  return { ...input };
}
