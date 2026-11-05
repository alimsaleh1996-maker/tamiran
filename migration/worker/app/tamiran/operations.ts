export type RepairCaseStatus =
  | "awaiting_assignment"
  | "assigned"
  | "diagnosing"
  | "repairing"
  | "awaiting_part"
  | "awaiting_customer"
  | "ready_for_delivery"
  | "returned"
  | "delivered"
  | "cancelled";

export type OperationalUser = {
  id: number;
  displayName: string;
  role: string;
  isActive: boolean;
};

export type RepairCaseEvent = {
  id: number;
  eventType: string;
  fromStatus: RepairCaseStatus | null;
  toStatus: RepairCaseStatus | null;
  description: string;
  actorName: string;
  createdAt: string;
};

export type RepairCaseRecord = {
  id: number;
  expectedVersion: number;
  publicId: string;
  caseUuid?: string;
  receiptNumber: string;
  receiptSequence?: number | null;
  trackingUrl?: string;
  branchCode: string;
  customerId: number;
  customerName: string;
  customerMobile: string;
  nationalCode: string;
  customerAddress?: string;
  customerProvince?: string;
  customerCity?: string;
  customerPostalCode?: string;
  secondaryMobile?: string;
  deviceId: number;
  deviceType: string;
  brand: string;
  model: string;
  identifier: string;
  color: string;
  declaredIssue: string;
  accessories: string[];
  appearanceStates: string[];
  receptionNotes: string;
  status: RepairCaseStatus;
  result: string;
  operationReport: string;
  deliveryAmount: number;
  deliveredToName: string;
  deliveryNotes: string;
  assignedToUserId: number | null;
  assignedToName: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  deliveredByName: string;
  promisedAt?: string | null;
  dataHandling?: "no_erasure" | "coordinate_first" | "erase_authorized";
  events: RepairCaseEvent[];
};

export type InventoryItemRecord = {
  id: number;
  publicId: string;
  code: string;
  title: string;
  category: string;
  physicalQuantity: number;
  reservedQuantity: number;
  minimumQuantity: number;
  hotReturnRequired: boolean;
  isActive: boolean;
  updatedAt: string;
};

export type InventoryMovementRecord = {
  id: number;
  publicId: string;
  itemId: number;
  itemCode: string;
  itemTitle: string;
  receiptNumber: string;
  movementType: string;
  quantity: number;
  reference: string;
  notes: string;
  actorName: string;
  createdAt: string;
};

export type PartRequestRecord = {
  id: number;
  publicId: string;
  receiptNumber: string;
  itemCode: string;
  itemTitle: string;
  quantity: number;
  requestedByName: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type HotReturnRecord = {
  id: number;
  publicId: string;
  receiptNumber: string;
  itemCode: string;
  itemTitle: string;
  technicianName: string;
  quantity: number;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type OperationalSnapshot = {
  summary: {
    activeCases: number;
    awaitingAssignment: number;
    readyForDelivery: number;
    openHotReturns: number;
    deliveredToday: number;
  };
  cases: RepairCaseRecord[];
  users: OperationalUser[];
  inventory: InventoryItemRecord[];
  movements: InventoryMovementRecord[];
  partRequests: PartRequestRecord[];
  hotReturns: HotReturnRecord[];
  receptionDrafts?: Array<{
    publicId: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    updatedAt: string;
    version: number;
  }>;
};

export type CreateRepairCaseInput = {
  idempotencyKey: string;
  draftPublicId?: string;
  draftExpectedVersion?: number;
  customerName: string;
  customerMobile: string;
  nationalCode?: string;
  customerAddress?: string;
  customerProvince?: string;
  customerCity?: string;
  customerPostalCode?: string;
  secondaryMobile?: string;
  deviceModelId: number;
  identifier?: string;
  color: string;
  declaredIssue: string;
  accessories: string[];
  appearanceStates: string[];
  receptionNotes?: string;
  assignedToUserId?: number | null;
  assignmentMode?: "automatic" | "queue";
  previousDeviceId?: number;
  expectedDeviceVersion?: number;
  preapprovedAmount?: number;
  promisedAt?: string;
  temporaryDeviceSecret?: string;
  customerConsent?: Record<string, unknown>;
  receiptAcceptance: {
    versionId: number;
    contentSha256: string;
    accepted: true;
  };
};

export type PreviousCustomerDevice = {
  id: number;
  expectedDeviceVersion?: number;
  deviceModelId: number | null;
  deviceType: string;
  brand: string;
  model: string;
  identifier: string;
  color: string;
  lastReceipt: string;
  lastVisit: string;
  lastIssue: string;
  lastStatus: RepairCaseStatus | null;
};

export type CustomerLookupResult = {
  id: number;
  name: string;
  mobile: string;
  nationalCode: string;
  address?: string;
  province?: string;
  city?: string;
  postalCode?: string;
  secondaryMobile?: string;
  devices: PreviousCustomerDevice[];
};

export type CreateInventoryItemInput = {
  code: string;
  title: string;
  category?: string;
  physicalQuantity: number;
  minimumQuantity: number;
  hotReturnRequired: boolean;
};

export type CreatePartRequestInput = {
  caseId: number;
  itemId: number;
  quantity: number;
  notes?: string;
};

export const emptyOperationalSnapshot: OperationalSnapshot = {
  summary: {
    activeCases: 0,
    awaitingAssignment: 0,
    readyForDelivery: 0,
    openHotReturns: 0,
    deliveredToday: 0,
  },
  cases: [],
  users: [],
  inventory: [],
  movements: [],
  partRequests: [],
  hotReturns: [],
};

export const repairCaseStatusLabels: Record<RepairCaseStatus, string> = {
  awaiting_assignment: "منتظر تخصیص",
  assigned: "تخصیص‌یافته",
  diagnosing: "در حال بررسی",
  repairing: "در حال تعمیر",
  awaiting_part: "در انتظار قطعه",
  awaiting_customer: "منتظر تأیید مشتری",
  ready_for_delivery: "آماده تحویل",
  returned: "برگشت به تکنسین",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};

export const operationalRoleLabels: Record<string, string> = {
  repair_manager: "مدیر تعمیرگاه",
  reception: "مسئول پذیرش",
  technician: "تکنسین",
  quality_control: "کنترل کیفیت",
  warehouse_keeper: "انباردار",
  finance_cashier: "مسئول مالی / صندوق",
};
