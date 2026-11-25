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

const checkedInteger = (value: number, minimum: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${label} معتبر نیست.`);
  return value;
};

export function buildCaseMutationRequest(
  input: CaseMutationRequest,
): CaseMutationRequest {
  checkedInteger(input.id, 1, "شناسه پرونده");
  checkedInteger(input.expectedVersion, 0, "نسخه پرونده");
  if (input.deliveryAmount !== undefined)
    checkedInteger(input.deliveryAmount, 0, "مبلغ تحویل");
  if (input.assignedToUserId !== undefined && input.assignedToUserId !== null)
    checkedInteger(input.assignedToUserId, 1, "مسئول پرونده");
  return { ...input };
}
