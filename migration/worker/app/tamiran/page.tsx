"use client";

import {
  Activity,
  ArrowLeftRight,
  Archive,
  Bell,
  AlarmClock,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  CircleCheckBig,
  ClipboardList,
  FileClock,
  FileSearch,
  FileText,
  Gauge,
  Menu,
  PackageCheck,
  PackageOpen,
  ShoppingCart,
  Send,
  WalletCards,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  AccessGateway,
  AccessSessionLoader,
  profileFromActor,
  type WorkspaceProfile,
} from "./access";
import { CentralAdminPanel, SupportTickets } from "./admin-panel";
import { initialDeviceCatalog } from "./catalog";
import { ModuleRouter } from "./modules";
import {
  followUpPriorityLabels,
  followUpStatusLabels,
  type CaseFollowUp,
} from "./followups";
import {
  createFollowUp,
  directAdminApiEnabled,
  FollowUpApiError,
  loadFollowUps,
  updateFollowUp,
  updateFollowUpStatus,
} from "./followups-api";
import {
  createInventoryItem,
  createPartRequest,
  createRepairCase,
  isDirectAdminConflict,
  loadCapabilities,
  loadCatalog,
  loadOperations,
  loadShopSettings,
  restoreSession,
  signOut,
  updateRepairCase,
  type CapabilitySnapshot,
} from "./directadmin-api";
import {
  emptyOperationalSnapshot,
  repairCaseStatusLabels,
  type CreateInventoryItemInput,
  type CreatePartRequestInput,
  type CreateRepairCaseInput,
  type InventoryItemRecord,
  type InventoryMovementRecord,
  type OperationalSnapshot,
  type PartRequestRecord,
  type RepairCaseRecord,
  type RepairCaseStatus,
} from "./operations";
import { V2Workspace } from "./v2-workspace";
import { CapabilityCatalog } from "./capabilities";
import { TechnicianWorkbench } from "./technician-workbench";
import { CustomerPortal } from "./customer-portal";
import { APP_VERSION } from "./version";
import { loadOperationalBootstrap } from "../software/operational-bootstrap";
import { parseActiveReceiptTerms } from "../software/reception-ui-contract";

const workspaceSessionKey = "tamiran_workspace_session";

function isWorkspaceProfile(value: unknown): value is WorkspaceProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<WorkspaceProfile>;
  return (
    typeof profile.actorId === "number" &&
    typeof profile.displayName === "string" &&
    typeof profile.shopName === "string" &&
    typeof profile.shopCode === "string" &&
    typeof profile.role === "string" &&
    typeof profile.isCentralAdmin === "boolean" &&
    Array.isArray(profile.services) &&
    Array.isArray(profile.modules)
  );
}

const navGroups = [
  {
    label: "عملیات تعمیرگاه",
    items: [
      { label: "نبض تعمیرگاه", icon: Gauge },
      { label: "پذیرش تعمیرات", icon: ClipboardList },
      { label: "کارهای من", icon: Wrench },
      { label: "مرکز عملیات تعمیرات", icon: UsersRound },
      { label: "کنترل کیفیت", icon: ShieldCheck },
      { label: "مالی پرونده", icon: WalletCards },
      { label: "تحویل تعمیرات", icon: PackageCheck },
      { label: "رسیدها", icon: FileClock },
      { label: "پیگیری مشتری", icon: FileSearch },
    ],
  },
  {
    label: "قطعات و کنترل",
    items: [
      { label: "انبار قطعات", icon: Boxes },
      { label: "گردش‌ها", icon: ArrowLeftRight },
      { label: "درخواست‌های قطعه", icon: PackageOpen },
      { label: "تعهدهای داغی", icon: Archive },
      { label: "سفارش خرید", icon: ShoppingCart },
    ],
  },
  {
    label: "مدیریت سامانه",
    items: [
      { label: "گزارش‌ها", icon: FileText },
      { label: "ممیزی و رویدادها", icon: ShieldCheck },
      { label: "پشتیبانی تعمیران", icon: Bell },
      { label: "تنظیمات", icon: Settings },
      { label: "پیامک و پرتال", icon: Send },
      { label: "افزودن قابلیت", icon: Sparkles },
    ],
  },
];

const rolePageAccess: Record<string, Set<string>> = {
  repair_manager: new Set(
    navGroups.flatMap((group) => group.items.map((item) => item.label)),
  ),
  reception: new Set([
    "نبض تعمیرگاه",
    "پذیرش تعمیرات",
    "رسیدها",
    "تحویل تعمیرات",
    "پیگیری مشتری",
  ]),
  technician: new Set(["کارهای من", "درخواست‌های قطعه"]),
  quality_control: new Set(["نبض تعمیرگاه", "کنترل کیفیت", "پیگیری مشتری"]),
  warehouse_keeper: new Set([
    "نبض تعمیرگاه",
    "انبار قطعات",
    "گردش‌ها",
    "درخواست‌های قطعه",
    "تعهدهای داغی",
    "سفارش خرید",
  ]),
  finance_cashier: new Set([
    "نبض تعمیرگاه",
    "مالی پرونده",
    "گزارش‌ها",
  ]),
};

const pageRequiredModule: Record<string, string> = {
  "انبار قطعات": "inventory",
  گردش‌ها: "inventory",
  "درخواست‌های قطعه": "inventory",
  "تعهدهای داغی": "inventory",
  "سفارش خرید": "inventory",
  "مالی پرونده": "finance",
  "پیامک و پرتال": "sms",
};

const pageRequiredPermission: Record<string, string> = {
  "مرکز عملیات تعمیرات": "repair_operations.view",
  "کارهای من": "technician_workbench.view",
  "کنترل کیفیت": "qc.view",
  "مالی پرونده": "finance.view",
  "تحویل تعمیرات": "delivery.view",
  "انبار قطعات": "inventory.view",
  گردش‌ها: "inventory.view",
  "درخواست‌های قطعه": "inventory.request.view",
  "تعهدهای داغی": "inventory.hot_return.view",
  "سفارش خرید": "procurement.view",
};

function permissionAllows(profile: WorkspaceProfile, page: string) {
  const required = pageRequiredPermission[page];
  if (!required || profile.permissions.length === 0) return true;
  return profile.permissions.includes("*") || profile.permissions.includes(required);
}

const v2Pages = new Set([
  "مرکز عملیات تعمیرات",
  "کنترل کیفیت",
  "مالی پرونده",
  "تحویل تعمیرات",
  "انبار قطعات",
  "گردش‌ها",
  "درخواست‌های قطعه",
  "تعهدهای داغی",
  "سفارش خرید",
  "پیامک و پرتال",
]);

const pageSlugs: Record<string, string> = {
  "نبض تعمیرگاه": "home",
  "پذیرش تعمیرات": "reception",
  رسیدها: "receipts",
  "مرکز عملیات تعمیرات": "operations",
  "کارهای من": "my-work",
  "کنترل کیفیت": "quality",
  "مالی پرونده": "case-finance",
  "تحویل تعمیرات": "delivery",
  "پیگیری مشتری": "follow-ups",
  "انبار قطعات": "inventory",
  گردش‌ها: "inventory-movements",
  "درخواست‌های قطعه": "part-requests",
  "تعهدهای داغی": "hot-returns",
  "سفارش خرید": "procurement",
  گزارش‌ها: "reports",
  "ممیزی و رویدادها": "audit",
  "پشتیبانی تعمیران": "support",
  تنظیمات: "settings",
  "پیامک و پرتال": "messaging",
  "افزودن قابلیت": "capabilities",
};

function pageFromLocation() {
  if (typeof window === "undefined") return null;
  const slug = new URLSearchParams(window.location.search).get("view");
  return Object.entries(pageSlugs).find(([, value]) => value === slug)?.[0] ?? null;
}

export default function Home() {
  const [publicPortalMode, setPublicPortalMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const parameters = new URLSearchParams(window.location.search);
    return parameters.has("portal") || parameters.has("track");
  });
  const [workspaceProfile, setWorkspaceProfile] =
    useState<WorkspaceProfile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [deviceCatalog, setDeviceCatalog] = useState(initialDeviceCatalog);
  const [operations, setOperations] = useState<OperationalSnapshot>(
    emptyOperationalSnapshot,
  );
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [activePage, setActivePage] = useState("نبض تعمیرگاه");
  const [contentRevision, setContentRevision] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState("عملیات تعمیرگاه");
  const [toast, setToast] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<CaseFollowUp[]>([]);
  const [shopSettings, setShopSettings] = useState<Record<string, unknown>>({});
  const [capabilities, setCapabilities] = useState<CapabilitySnapshot | null>(
    null,
  );
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);

  useEffect(() => {
    if (publicPortalMode) {
      setSessionReady(true);
      return;
    }
    let active = true;
    const restore = async () => {
      try {
        if (directAdminApiEnabled) {
          const data = await restoreSession();
          if (active && data.actor)
            setWorkspaceProfile(profileFromActor(data.actor));
        } else {
          const stored = window.sessionStorage.getItem(workspaceSessionKey);
          if (stored) {
            const parsed: unknown = JSON.parse(stored);
            if (active && isWorkspaceProfile(parsed))
              setWorkspaceProfile(parsed);
          }
        }
      } catch {
        if (!directAdminApiEnabled)
          window.sessionStorage.removeItem(workspaceSessionKey);
      } finally {
        if (active) setSessionReady(true);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [publicPortalMode]);

  useEffect(() => {
    if (
      !directAdminApiEnabled ||
      !workspaceProfile ||
      workspaceProfile.isCentralAdmin
    )
      return;
    let active = true;
    setCapabilitiesLoading(true);
    void loadOperationalBootstrap({
      loadFollowUps,
      loadOperations,
      loadCatalog,
      loadShopSettings: async () => {
        const snapshot = await loadShopSettings();
        return {
          ...snapshot,
          activeReceiptTerms: parseActiveReceiptTerms(
            (
              snapshot as typeof snapshot & {
                activeReceiptTerms?: unknown;
              }
            ).activeReceiptTerms,
          ),
        };
      },
      loadCapabilities,
    })
      .then(({ core, followUps: followUpResult }) => {
        if (!active) return;
        if (followUpResult.status === "fulfilled" && followUpResult.value)
          setFollowUps(followUpResult.value);
        if (core.status === "rejected") {
          const trackingCode =
            core.reason instanceof FollowUpApiError
              ? core.reason.trackingCode
              : undefined;
          setToast(
            `بارگذاری اطلاعات عملیاتی ناموفق بود${trackingCode ? ` · کد رهگیری ${trackingCode}` : ""}`,
          );
          return;
        }
        setOperations(core.value.operations);
        setDeviceCatalog(core.value.catalog);
        setShopSettings({
          ...core.value.settings.settings,
          __shop: core.value.settings.shop,
          __activeReceiptTerms: core.value.settings.activeReceiptTerms,
        });
        setCapabilities(core.value.capabilities);
        if (followUpResult.status === "rejected") {
          const trackingCode =
            followUpResult.reason instanceof FollowUpApiError
              ? followUpResult.reason.trackingCode
              : undefined;
          setToast(
            `اطلاعات اصلی بارگذاری شد؛ پیگیری مشتری در دسترس نیست${trackingCode ? ` · کد رهگیری ${trackingCode}` : ""}`,
          );
        }
      })
      .finally(() => {
        if (!active) return;
        setOperationsLoading(false);
        setCapabilitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceProfile]);

  useEffect(() => {
    if (!workspaceProfile || workspaceProfile.isCentralAdmin) return;
    const requested = pageFromLocation();
    const fallback =
      workspaceProfile.role === "technician" ? "کارهای من" : "نبض تعمیرگاه";
    const allowed = rolePageAccess[workspaceProfile.role] ?? new Set<string>();
    setActivePage(requested && allowed.has(requested) ? requested : fallback);
  }, [
    workspaceProfile?.actorId,
    workspaceProfile?.isCentralAdmin,
    workspaceProfile?.role,
  ]);

  useEffect(() => {
    if (!workspaceProfile || workspaceProfile.isCentralAdmin) return;
    const onHistory = () => {
      const requested = pageFromLocation();
      const allowed = rolePageAccess[workspaceProfile.role] ?? new Set<string>();
      if (requested && allowed.has(requested)) {
        setActivePage(requested);
        setContentRevision((current) => current + 1);
      }
    };
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, [workspaceProfile]);

  const selectPage = (label: string) => {
    if (workspaceProfile && !workspaceProfile.isCentralAdmin) {
      const roleAllowed =
        rolePageAccess[workspaceProfile.role] ?? new Set<string>();
      const requiredModule = pageRequiredModule[label];
      const capability = capabilities?.modules.find(
        (item) => item.module === requiredModule,
      );
      const moduleBlocked = Boolean(
        requiredModule &&
        (capability
          ? capability.navigation !== "visible"
          : !workspaceProfile.modules.includes(requiredModule)),
      );
      if (
        !roleAllowed.has(label) ||
        moduleBlocked ||
        !permissionAllows(workspaceProfile, label)
      ) {
        setToast("این بخش برای نقش یا قابلیت‌های فعال حساب شما در دسترس نیست.");
        window.setTimeout(() => setToast(null), 3200);
        return;
      }
    }
    setActivePage(label);
    setContentRevision((current) => current + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("view", pageSlugs[label] ?? "home");
    window.history.pushState({ view: pageSlugs[label] }, "", url);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
    if (!["افزودن قابلیت", "پشتیبانی تعمیران"].includes(label)) {
      void refreshOperations();
    }
  };

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshCapabilities = useCallback(async () => {
    setCapabilitiesLoading(true);
    try {
      setCapabilities(await loadCapabilities());
    } catch {
      notify("تازه‌سازی قابلیت‌ها انجام نشد.");
    } finally {
      setCapabilitiesLoading(false);
    }
  }, [notify]);

  const authenticate = useCallback((profile: WorkspaceProfile) => {
    setOperationsLoading(!profile.isCentralAdmin);
    setWorkspaceProfile(profile);
    if (!directAdminApiEnabled)
      window.sessionStorage.setItem(
        workspaceSessionKey,
        JSON.stringify(profile),
      );
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      if (directAdminApiEnabled) await signOut();
    } catch {
      notify("خروج امن روی سرور انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.");
      return;
    }
    window.sessionStorage.removeItem(workspaceSessionKey);
    setWorkspaceProfile(null);
    setOperations(emptyOperationalSnapshot);
    setFollowUps([]);
    setDeviceCatalog([]);
    setShopSettings({});
    setCapabilities(null);
    setActivePage("نبض تعمیرگاه");
  }, [notify]);

  const addFollowUp = async (item: CaseFollowUp) => {
    setFollowUps((current) => [item, ...current]);
    try {
      const saved = await createFollowUp(item);
      setFollowUps((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? saved : candidate,
        ),
      );
      notify(
        "پیام پرونده ثبت شد و تا زمان انجام در داشبورد مسئول باقی می‌ماند",
      );
    } catch (error) {
      setFollowUps((current) =>
        current.filter((candidate) => candidate.id !== item.id),
      );
      const trackingCode =
        error instanceof FollowUpApiError ? error.trackingCode : undefined;
      notify(
        `ثبت پیام انجام نشد${trackingCode ? ` · کد رهگیری ${trackingCode}` : ""}`,
      );
    }
  };

  const changeFollowUpStatus = async (
    id: string,
    status: import("./followups").FollowUpStatus,
  ) => {
    const previous = followUps.find((item) => item.id === id);
    setFollowUps((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              overdue: status === "done" ? false : item.overdue,
            }
          : item,
      ),
    );
    if (!directAdminApiEnabled) {
      notify(
        status === "done"
          ? "پیگیری انجام شد و در لاگ ثبت شد"
          : `وضعیت پیگیری به «${followUpStatusLabels[status]}» تغییر کرد`,
      );
      return;
    }
    try {
      const saved = await updateFollowUpStatus(id, status);
      setFollowUps((current) =>
        current.map((item) => (item.id === id ? saved : item)),
      );
      notify(
        status === "done"
          ? "پیگیری انجام شد و در لاگ ثبت شد"
          : `وضعیت پیگیری به «${followUpStatusLabels[status]}» تغییر کرد`,
      );
    } catch (error) {
      if (previous)
        setFollowUps((current) =>
          current.map((item) => (item.id === id ? previous : item)),
        );
      const trackingCode =
        error instanceof FollowUpApiError ? error.trackingCode : undefined;
      notify(
        `تغییر وضعیت ذخیره نشد${trackingCode ? ` · کد رهگیری ${trackingCode}` : ""}`,
      );
    }
  };

  const changeFollowUp = async (input: {
    id: string;
    status?: import("./followups").FollowUpStatus;
    assignedToUserId?: number;
    dueLabel?: string;
    comment?: string;
  }) => {
    try {
      if (directAdminApiEnabled) {
        const saved = await updateFollowUp(input);
        setFollowUps((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      }
      notify("پیگیری و تاریخچه آن به‌روزرسانی شد.");
    } catch (error) {
      const trackingCode =
        error instanceof FollowUpApiError ? error.trackingCode : undefined;
      notify(
        `به‌روزرسانی پیگیری انجام نشد${trackingCode ? ` · کد رهگیری ${trackingCode}` : ""}`,
      );
      throw error;
    }
  };

  const refreshOperations = useCallback(async () => {
    if (!directAdminApiEnabled) return;
    setOperationsLoading(true);
    try {
      const [snapshot, catalog] = await Promise.all([
        loadOperations(),
        loadCatalog(),
      ]);
      setOperations(snapshot);
      setDeviceCatalog(catalog);
    } catch (error) {
      const trackingCode =
        error instanceof FollowUpApiError ? error.trackingCode : undefined;
      notify(
        `به‌روزرسانی اطلاعات انجام نشد${trackingCode ? ` · کد رهگیری ${trackingCode}` : ""}`,
      );
    } finally {
      setOperationsLoading(false);
    }
  }, [notify]);

  const addRepairCase = async (
    input: CreateRepairCaseInput,
  ): Promise<RepairCaseRecord> => {
    if (directAdminApiEnabled) {
      const data = await createRepairCase(input);
      await refreshOperations();
      return data.repairCase;
    }
    const sequence = operations.cases.length + 1;
    const now = new Date().toISOString();
    const assigned = input.assignedToUserId
      ? operations.users.find((user) => user.id === input.assignedToUserId)
      : undefined;
    const catalogItem = deviceCatalog.find(
      (item) => item.id === input.deviceModelId,
    );
    if (!catalogItem)
      throw new FollowUpApiError("نوع، برند و مدل انتخاب‌شده معتبر نیست.");
    const repairCase: RepairCaseRecord = {
      id: Math.max(0, ...operations.cases.map((item) => item.id)) + 1,
      expectedVersion: 0,
      publicId: `CASE-${Date.now()}`,
      receiptNumber: `${workspaceProfile?.publicShopCode ?? "100000"}-${String(sequence).padStart(6, "0")}`,
      branchCode: "MAIN",
      customerId: Date.now(),
      customerName: input.customerName,
      customerMobile: input.customerMobile,
      nationalCode: input.nationalCode ?? "",
      deviceId: input.previousDeviceId ?? Date.now(),
      deviceType: catalogItem.deviceType,
      brand: catalogItem.brand,
      model: catalogItem.model,
      identifier: input.identifier ?? "",
      color: input.color,
      declaredIssue: input.declaredIssue,
      accessories: input.accessories,
      appearanceStates: input.appearanceStates,
      receptionNotes: input.receptionNotes ?? "",
      status: assigned ? "assigned" : "awaiting_assignment",
      result: "",
      operationReport: "",
      deliveryAmount: 0,
      deliveredToName: "",
      deliveryNotes: "",
      assignedToUserId: assigned?.id ?? null,
      assignedToName: assigned?.displayName ?? "",
      createdByName: workspaceProfile?.displayName ?? "کاربر جاری",
      createdAt: now,
      updatedAt: now,
      deliveredAt: null,
      deliveredByName: "",
      events: [
        {
          id: Date.now(),
          eventType: "case_created",
          fromStatus: null,
          toStatus: assigned ? "assigned" : "awaiting_assignment",
          description: "پذیرش ثبت شد.",
          actorName: workspaceProfile?.displayName ?? "کاربر جاری",
          createdAt: now,
        },
      ],
    };
    setOperations((current) => ({
      ...current,
      cases: [repairCase, ...current.cases],
      summary: {
        ...current.summary,
        activeCases: current.summary.activeCases + 1,
        awaitingAssignment:
          current.summary.awaitingAssignment + (assigned ? 0 : 1),
      },
    }));
    return repairCase;
  };

  const changeRepairCase = async (input: {
    id: number;
    status?: RepairCaseStatus;
    assignedToUserId?: number | null;
    result?: string;
    operationReport?: string;
    reason?: string;
    deliveryAmount?: number;
    deliveredToName?: string;
    deliveryNotes?: string;
  }) => {
    const current = operations.cases.find((item) => item.id === input.id);
    if (!current) throw new FollowUpApiError("پرونده پیدا نشد.");
    if (directAdminApiEnabled) {
      try {
        const data = await updateRepairCase({
          ...input,
          expectedVersion: current.expectedVersion,
        });
        await refreshOperations();
        return data.repairCase;
      } catch (error) {
        if (isDirectAdminConflict(error)) await refreshOperations();
        throw error;
      }
    }
    const assignee = input.assignedToUserId
      ? operations.users.find((user) => user.id === input.assignedToUserId)
      : undefined;
    const updated: RepairCaseRecord = {
      ...current,
      expectedVersion: current.expectedVersion + 1,
      status: input.status ?? current.status,
      assignedToUserId:
        input.assignedToUserId === undefined
          ? current.assignedToUserId
          : input.assignedToUserId,
      assignedToName:
        input.assignedToUserId === undefined
          ? current.assignedToName
          : (assignee?.displayName ?? ""),
      result: input.result ?? current.result,
      operationReport: input.operationReport ?? current.operationReport,
      deliveryAmount: input.deliveryAmount ?? current.deliveryAmount,
      deliveredToName: input.deliveredToName ?? current.deliveredToName,
      deliveryNotes: input.deliveryNotes ?? current.deliveryNotes,
      deliveredAt:
        input.status === "delivered"
          ? new Date().toISOString()
          : current.deliveredAt,
      deliveredByName:
        input.status === "delivered"
          ? (workspaceProfile?.displayName ?? "کاربر جاری")
          : current.deliveredByName,
      updatedAt: new Date().toISOString(),
    };
    setOperations((snapshot) => ({
      ...snapshot,
      cases: snapshot.cases.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));
    return updated;
  };

  const addInventoryItem = async (input: CreateInventoryItemInput) => {
    if (directAdminApiEnabled) {
      await createInventoryItem(input);
      await refreshOperations();
      return;
    }
    const now = new Date().toISOString();
    const id = Math.max(0, ...operations.inventory.map((item) => item.id)) + 1;
    const item: InventoryItemRecord = {
      id,
      publicId: `ITEM-${Date.now()}`,
      code: input.code,
      title: input.title,
      category: input.category ?? "",
      physicalQuantity: input.physicalQuantity,
      reservedQuantity: 0,
      minimumQuantity: input.minimumQuantity,
      hotReturnRequired: input.hotReturnRequired,
      isActive: true,
      updatedAt: now,
    };
    const movement: InventoryMovementRecord | null =
      input.physicalQuantity > 0
        ? {
            id:
              Math.max(0, ...operations.movements.map((entry) => entry.id)) + 1,
            publicId: `MOVE-${Date.now()}`,
            itemId: id,
            itemCode: input.code,
            itemTitle: input.title,
            receiptNumber: "",
            movementType: "in",
            quantity: input.physicalQuantity,
            reference: "موجودی اولیه",
            notes: "موجودی هنگام تعریف کالا ثبت شد.",
            actorName: workspaceProfile?.displayName ?? "کاربر جاری",
            createdAt: now,
          }
        : null;
    setOperations((current) => ({
      ...current,
      inventory: [item, ...current.inventory],
      movements: movement
        ? [movement, ...current.movements]
        : current.movements,
    }));
  };

  const addPartRequest = async (input: CreatePartRequestInput) => {
    if (directAdminApiEnabled) {
      await createPartRequest(input);
      await refreshOperations();
      return;
    }
    const repairCase = operations.cases.find(
      (item) => item.id === input.caseId,
    );
    const inventoryItem = operations.inventory.find(
      (item) => item.id === input.itemId,
    );
    if (!repairCase || !inventoryItem)
      throw new FollowUpApiError("پرونده یا قطعه پیدا نشد.");
    const now = new Date().toISOString();
    const request: PartRequestRecord = {
      id: Math.max(0, ...operations.partRequests.map((item) => item.id)) + 1,
      publicId: `REQUEST-${Date.now()}`,
      receiptNumber: repairCase.receiptNumber,
      itemCode: inventoryItem.code,
      itemTitle: inventoryItem.title,
      quantity: input.quantity,
      requestedByName: workspaceProfile?.displayName ?? "کاربر جاری",
      status: "pending",
      notes: input.notes ?? "",
      createdAt: now,
      updatedAt: now,
    };
    setOperations((current) => ({
      ...current,
      partRequests: [request, ...current.partRequests],
    }));
  };

  if (publicPortalMode) {
    return <CustomerPortal onExit={() => setPublicPortalMode(false)} />;
  }

  if (!sessionReady) {
    return <AccessSessionLoader />;
  }

  if (!workspaceProfile) {
    return <AccessGateway onAuthenticated={authenticate} />;
  }

  if (workspaceProfile.isCentralAdmin) {
    return (
      <>
        <CentralAdminPanel
          notify={notify}
          onSignOut={() => void handleSignOut()}
        />
        {toast && (
          <div className="app-toast" role="status">
            <CircleCheckBig size={20} />
            <span>{toast}</span>
          </div>
        )}
      </>
    );
  }
  const allowedPages =
    rolePageAccess[workspaceProfile.role] ?? rolePageAccess.repair_manager;
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!allowedPages.has(item.label)) return false;
        if (!permissionAllows(workspaceProfile, item.label)) return false;
        if (
          item.label === "مرکز عملیات تعمیرات" &&
          workspaceProfile.productProfile === "solo"
        )
          return false;
        if (item.label === "افزودن قابلیت")
          return capabilities?.discoverable === true;
        const required = pageRequiredModule[item.label];
        if (!required) return true;
        const capability = capabilities?.modules.find(
          (entry) => entry.module === required,
        );
        return capability
          ? capability.navigation === "visible"
          : workspaceProfile.modules.includes(required);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const activeNavGroup =
    visibleNavGroups.find((group) =>
      group.items.some((item) => item.label === activePage),
    )?.label ?? visibleNavGroups[0]?.label;
  const effectiveOpenNavGroup =
    visibleNavGroups.some((group) => group.label === openNavGroup)
      ? openNavGroup
      : activeNavGroup;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            <Wrench size={25} strokeWidth={2.7} />
          </div>
          <div>
            <div className="brand-title">تعمیران</div>
            <div className="brand-subtitle">دفتر مسئولیت تعمیرگاه</div>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="بستن منو"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="nav-area" aria-label="منوی اصلی">
          {visibleNavGroups.map((group) => (
            <div
              className={`nav-group ${effectiveOpenNavGroup === group.label ? "is-expanded" : ""}`}
              key={group.label}
            >
              <button
                type="button"
                className="nav-group-label"
                aria-expanded={effectiveOpenNavGroup === group.label}
                onClick={() =>
                  setOpenNavGroup((current) =>
                    current === group.label ? "" : group.label,
                  )
                }
              >
                <span>{group.label}</span>
                <ChevronDown size={15} />
              </button>
              <div className="nav-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.label;
                  return (
                    <button
                      className={`nav-item ${active ? "active" : ""}`}
                      key={item.label}
                      onClick={() => selectPage(item.label)}
                    >
                      <Icon size={20} strokeWidth={2.15} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-workspace-meta">
          <span>
            {workspaceProfile.productProfile === "solo"
              ? "تعمیران Solo"
              : "تعمیران Pro"}
          </span>
          <strong>{workspaceProfile.shopName}</strong>
          <small>
            {workspaceProfile.shopCode} · {workspaceProfile.branch}
          </small>
          <small className="app-version-label">نسخه {APP_VERSION}</small>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {workspaceProfile.displayName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("") || "ک"}
          </div>
          <div className="user-copy">
            <strong>{workspaceProfile.displayName}</strong>
            <span>
              {workspaceProfile.role === "technician"
                ? "تکنسین"
                : workspaceProfile.role === "quality_control"
                  ? "کنترل کیفیت"
                  : workspaceProfile.role === "reception"
                    ? "مسئول پذیرش"
                    : workspaceProfile.role === "warehouse_keeper"
                      ? "انباردار"
                      : workspaceProfile.role === "finance_cashier"
                        ? "مسئول مالی / صندوق"
                        : "مدیر تعمیرگاه"}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label="خروج از حساب"
            onClick={() => void handleSignOut()}
            title="خروج از حساب"
          >
            <ChevronLeft size={19} />
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="بستن منو"
        />
      )}

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-right">
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu size={23} />
            </button>
            <div>
              <div className="eyebrow">
                {workspaceProfile.branch} · تعمیران {workspaceProfile.productProfile === "solo" ? "Solo" : "Pro"} ·{" "}
                {workspaceProfile.compactMode ? "حالت ساده" : "حالت تیمی"}
              </div>
              <h1>{activePage}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="branch-switcher" title="شعبه فعال این نشست">
              <Building2 size={17} />
              <span>{workspaceProfile.branch}</span>
            </div>
            <button
              type="button"
              className="icon-button notification-button"
              aria-label="اعلان‌ها و پیگیری‌ها"
              onClick={() =>
                selectPage(
                  workspaceProfile.role === "technician"
                    ? "کارهای من"
                    : workspaceProfile.role === "quality_control"
                      ? "کنترل کیفیت"
                      : "پیگیری مشتری",
                )
              }
            >
              <Bell size={21} />
              {followUps.some((item) => item.status !== "done") && <span />}
            </button>
            {["repair_manager", "reception"].includes(
              workspaceProfile.role,
            ) && (
              <button
                className="primary-action"
                onClick={() => selectPage("پذیرش تعمیرات")}
              >
                <span className="button-glint" />
                <ClipboardList size={19} />
                پذیرش جدید
              </button>
            )}
          </div>
        </header>

        <div className="page-content">
          {activePage === "نبض تعمیرگاه" ? (
            <Dashboard
              onNavigate={selectPage}
              profile={workspaceProfile}
              followUps={followUps}
              operations={operations}
              loading={operationsLoading}
            />
          ) : activePage === "پشتیبانی تعمیران" ? (
            <div className="panel">
              <SupportTickets notify={notify} />
            </div>
          ) : activePage === "افزودن قابلیت" ? (
            <CapabilityCatalog
              snapshot={capabilities}
              loading={capabilitiesLoading}
              onRefresh={refreshCapabilities}
              notify={notify}
            />
          ) : activePage === "کارهای من" ? (
            <TechnicianWorkbench
              key={`${activePage}-${contentRevision}`}
              profile={workspaceProfile}
              legacyCases={operations.cases}
              onUpdateRepairCase={changeRepairCase}
              onNavigate={selectPage}
              notify={notify}
            />
          ) : v2Pages.has(activePage) ? (
            <V2Workspace
              key={`${activePage}-${contentRevision}`}
              page={activePage}
              profile={workspaceProfile}
              notify={notify}
            />
          ) : (
            <ModuleRouter
              key={`${activePage}-${contentRevision}`}
              title={activePage}
              onNavigate={selectPage}
              notify={notify}
              workspace={workspaceProfile}
              deviceCatalog={deviceCatalog}
              setDeviceCatalog={setDeviceCatalog}
              followUps={followUps}
              onCreateFollowUp={addFollowUp}
              onUpdateFollowUpStatus={changeFollowUpStatus}
              onUpdateFollowUp={changeFollowUp}
              operations={operations}
              operationsLoading={operationsLoading}
              onCreateRepairCase={addRepairCase}
              onCreateInventoryItem={addInventoryItem}
              onCreatePartRequest={addPartRequest}
              onUpdateRepairCase={changeRepairCase}
              onRefreshOperations={refreshOperations}
              shopSettings={shopSettings}
              setShopSettings={setShopSettings}
            />
          )}
        </div>
      </section>

      {toast && (
        <div className="app-toast" role="status">
          <CircleCheckBig size={20} />
          <span>{toast}</span>
        </div>
      )}
    </main>
  );
}

function Dashboard({
  onNavigate,
  profile,
  followUps,
  operations,
  loading,
}: {
  onNavigate: (label: string) => void;
  profile: WorkspaceProfile;
  followUps: CaseFollowUp[];
  operations: OperationalSnapshot;
  loading: boolean;
}) {
  const number = new Intl.NumberFormat("fa-IR");
  const isManager = profile.role === "repair_manager";
  const isReception = profile.role === "reception";
  const isTechnical = ["technician", "quality_control"].includes(profile.role);
  const followUpTarget = isTechnical ? "کارهای من" : "پیگیری مشتری";
  const caseTarget = isManager
    ? "مرکز عملیات تعمیرات"
    : isReception
      ? "رسیدها"
      : "کارهای من";
  const activeFollowUps = followUps.filter((item) => item.status !== "done");
  const overdueCount = activeFollowUps.filter((item) => item.overdue).length;
  const activeCases = operations.cases.filter(
    (item) => !["delivered", "cancelled"].includes(item.status),
  );
  const stats = [
    {
      label: "پرونده‌های فعال",
      value: number.format(operations.summary.activeCases),
      change: "همه پرونده‌های باز",
      icon: FileClock,
      tone: "teal",
    },
    {
      label: "منتظر تخصیص",
      value: number.format(operations.summary.awaitingAssignment),
      change: "نیازمند تعیین مسئول",
      icon: UsersRound,
      tone: "gold",
    },
    {
      label: "آماده تحویل",
      value: number.format(operations.summary.readyForDelivery),
      change: `${number.format(operations.summary.deliveredToday)} تحویل امروز`,
      icon: PackageCheck,
      tone: "sky",
    },
    {
      label: "تعهد داغی باز",
      value: number.format(operations.summary.openHotReturns),
      change: "نیازمند تعیین تکلیف",
      icon: Archive,
      tone: "coral",
    },
  ];
  const repairStages = [
    {
      label: "منتظر تخصیص",
      value: activeCases.filter((item) => item.status === "awaiting_assignment")
        .length,
      max: Math.max(activeCases.length, 1),
      tone: "gold",
    },
    {
      label: "نزد مسئول پرونده",
      value: activeCases.filter((item) =>
        ["assigned", "diagnosing", "repairing", "returned"].includes(
          item.status,
        ),
      ).length,
      max: Math.max(activeCases.length, 1),
      tone: "teal",
    },
    {
      label: "منتظر قطعه یا مشتری",
      value: activeCases.filter((item) =>
        ["awaiting_part", "awaiting_customer"].includes(item.status),
      ).length,
      max: Math.max(activeCases.length, 1),
      tone: "coral",
    },
    {
      label: "آماده تحویل",
      value: activeCases.filter((item) => item.status === "ready_for_delivery")
        .length,
      max: Math.max(activeCases.length, 1),
      tone: "sky",
    },
  ];
  const technicians = operations.users
    .filter((user) => user.role === "technician" && user.isActive)
    .map((user) => ({
      name: user.displayName,
      active: activeCases.filter((item) => item.assignedToUserId === user.id)
        .length,
      completed: operations.cases.filter(
        (item) =>
          item.assignedToUserId === user.id && item.status === "delivered",
      ).length,
      hot: operations.hotReturns.filter(
        (item) =>
          item.technicianName === user.displayName && item.status !== "settled",
      ).length,
      initials: user.displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join(""),
    }));
  const queue = operations.cases.slice(0, 8).map((item) => ({
    receipt: item.receiptNumber,
    device: `${item.brand} ${item.model}`,
    customer: item.customerName,
    issue: item.declaredIssue,
    status: repairCaseStatusLabels[item.status],
    tone:
      item.status === "awaiting_assignment"
        ? "gold"
        : item.status === "ready_for_delivery"
          ? "sky"
          : item.status === "awaiting_part"
            ? "coral"
            : "teal",
    time: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(item.updatedAt.replace(" ", "T"))),
  }));
  return (
    <>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="welcome-chip">
            <Activity size={16} />
            وضعیت زنده امروز
          </span>
          <h2>{profile.shopName}</h2>
          <p>
            {loading
              ? "در حال دریافت اطلاعات عملیاتی..."
              : activeCases.length > 0
                ? `فضای «${profile.branch}» با ${number.format(activeCases.length)} پرونده فعال در دسترس است.`
                : isManager
                  ? "هنوز اطلاعاتی ثبت نشده است؛ ابتدا نوع، برند و مدل دستگاه‌ها را در تنظیمات تعریف و سپس اولین پذیرش را ثبت کنید."
                  : "هنوز پرونده یا پیگیری فعالی برای حساب شما ثبت نشده است."}
          </p>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <span className="spark spark-one">
            <Sparkles size={18} />
          </span>
          <span className="spark spark-two">
            <CircleCheckBig size={20} />
          </span>
          <div className="tool-orbit tool-orbit-one" />
          <div className="tool-orbit tool-orbit-two" />
          <Wrench size={58} strokeWidth={1.9} />
        </div>
      </section>

      <section className="stats-grid" aria-label="شاخص‌های امروز">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              className={`stat-card accent-${stat.tone}`}
              key={stat.label}
            >
              <div className={`stat-icon tone-${stat.tone}`}>
                <Icon size={23} />
              </div>
              <div className="stat-body">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.change}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="panel followup-dashboard-panel">
        <PanelHeader
          icon={<AlarmClock size={20} />}
          title="پیگیری‌های فراموش‌نشده"
          description={`${activeFollowUps.length} پیگیری باز · ${overdueCount} مورد از مهلت گذشته`}
          action={
            <button
              type="button"
              className="filter-button"
              onClick={() => onNavigate(followUpTarget)}
            >
              مشاهده پیگیری‌ها
              <ChevronLeft size={16} />
            </button>
          }
        />
        <div className="followup-dashboard-overview">
          <article>
            <span>جدید</span>
            <strong>
              {number.format(
                activeFollowUps.filter((item) => item.status === "new").length,
              )}
            </strong>
          </article>
          <article>
            <span>در حال پیگیری</span>
            <strong>
              {number.format(
                activeFollowUps.filter((item) => item.status === "in_progress")
                  .length,
              )}
            </strong>
          </article>
          <article className={overdueCount ? "is-danger" : ""}>
            <span>مهلت گذشته</span>
            <strong>{number.format(overdueCount)}</strong>
          </article>
        </div>
        <div className="followup-dashboard-list">
          {activeFollowUps.slice(0, 3).map((item) => (
            <button
              type="button"
              className={`followup-dashboard-item priority-${item.priority} ${item.overdue ? "is-overdue" : ""}`}
              key={item.id}
              onClick={() => onNavigate(followUpTarget)}
            >
              <span className="followup-dashboard-icon">
                <AlarmClock size={18} />
              </span>
              <div>
                <strong>{item.message}</strong>
                <small>
                  مشتری: {item.customer} · دستگاه: {item.device}
                </small>
                <small>
                  پذیرش: {item.receiptId} · مسئول: {item.ownerName}
                </small>
              </div>
              <span className="followup-dashboard-meta">
                <b>
                  {item.overdue
                    ? "عقب‌افتاده"
                    : followUpPriorityLabels[item.priority]}
                </b>
                <small>{item.dueLabel}</small>
                <em>{followUpStatusLabels[item.status]}</em>
              </span>
            </button>
          ))}
        </div>
        {!loading && activeFollowUps.length === 0 && (
          <DashboardEmpty
            icon={<AlarmClock size={25} />}
            title="هنوز پیگیری ثبت نشده است"
            description="پیگیری‌های مشتری پس از ثبت، تا زمان انجام کامل در این بخش باقی می‌مانند."
          />
        )}
      </section>

      <section className="dashboard-grid">
        <article className="panel stage-panel">
          <PanelHeader
            icon={<Gauge size={20} />}
            title="جریان پرونده‌های فعال"
            description={`تصویر لحظه‌ای از ${number.format(activeCases.length)} پرونده تعمیر`}
          />
          <div className="stage-list">
            {repairStages.map((stage) => (
              <div className="stage-row" key={stage.label}>
                <div className="stage-meta">
                  <span>{stage.label}</span>
                  <strong>{stage.value} دستگاه</strong>
                </div>
                <div className="progress-track">
                  <span
                    className={`progress-fill tone-${stage.tone}`}
                    style={{ width: `${(stage.value / stage.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            className="soft-action"
            onClick={() => onNavigate(caseTarget)}
          >
            مشاهده پرونده‌های مجاز
            <ChevronLeft size={18} />
          </button>
        </article>

        {isManager && (
          <article className="panel technician-panel">
            <PanelHeader
              icon={<UsersRound size={20} />}
              title="بار کاری تکنسین‌ها"
              description="پرونده فعال، تکمیل امروز و داغی باز"
            />
            <div className="technician-list">
              {technicians.map((technician, index) => (
                <div className="technician-row" key={technician.name}>
                  <div className={`technician-avatar avatar-${index + 1}`}>
                    {technician.initials}
                  </div>
                  <div className="technician-name">
                    <strong>{technician.name}</strong>
                    <span>{technician.active} پرونده فعال</span>
                  </div>
                  <div className="technician-metrics">
                    <span className="mini-success">
                      {technician.completed} تکمیل
                    </span>
                    <span
                      className={technician.hot ? "mini-warning" : "mini-muted"}
                    >
                      {technician.hot} داغی
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {technicians.length === 0 && (
              <DashboardEmpty
                icon={<UsersRound size={25} />}
                title="هنوز تکنسینی ثبت نشده است"
                description="کاربران فنی پس از ایجاد حساب در این بخش نمایش داده می‌شوند."
              />
            )}
            <button
              className="soft-action"
              onClick={() => onNavigate("کارهای من")}
            >
              جزئیات عملکرد تیم
              <ChevronLeft size={18} />
            </button>
          </article>
        )}
      </section>

      <section className="panel queue-panel">
        <PanelHeader
          icon={<FileClock size={20} />}
          title="آخرین پرونده‌ها"
          description="رویدادهای واقعی امروز، به‌ترتیب آخرین تغییر"
          action={
            <button
              type="button"
              className="filter-button"
              onClick={() => onNavigate(caseTarget)}
            >
              همه پرونده‌ها
              <ChevronLeft size={16} />
            </button>
          }
        />
        <div className="queue-table-wrap">
          <table className="queue-table">
            <thead>
              <tr>
                <th>رسید</th>
                <th>دستگاه و مشتری</th>
                <th>ایراد اعلامی</th>
                <th>وضعیت</th>
                <th>آخرین تغییر</th>
                <th aria-label="عملیات" />
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.receipt}>
                  <td>
                    <button
                      type="button"
                      className="receipt-link"
                      onClick={() => onNavigate(caseTarget)}
                    >
                      {item.receipt}
                    </button>
                  </td>
                  <td>
                    <div className="device-cell">
                      <strong>{item.device}</strong>
                      <span>{item.customer}</span>
                    </div>
                  </td>
                  <td>{item.issue}</td>
                  <td>
                    <span className={`status-pill tone-${item.tone}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="muted-cell">{item.time}</td>
                  <td>
                    <button
                      type="button"
                      className="row-action"
                      onClick={() => onNavigate(caseTarget)}
                      aria-label={`مشاهده ${item.receipt}`}
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && queue.length === 0 && (
          <DashboardEmpty
            icon={<FileClock size={25} />}
            title="هنوز اطلاعاتی ثبت نشده است"
            description="با ثبت اولین پذیرش، پرونده و رسید آن در این جدول نمایش داده می‌شود."
          />
        )}
      </section>

      <section className="quick-actions">
        {(isManager || isReception) && (
          <button onClick={() => onNavigate("پذیرش تعمیرات")}>
            <span className="quick-icon tone-gold">
              <ClipboardList />
            </span>
            <span>
              <strong>پذیرش دستگاه</strong>
              <small>ایجاد پرونده و قبض A5</small>
            </span>
            <ChevronLeft />
          </button>
        )}
        {(isManager || isTechnical) &&
          profile.modules.includes("inventory") && (
            <button onClick={() => onNavigate("درخواست‌های قطعه")}>
              <span className="quick-icon tone-teal">
                <PackageOpen />
              </span>
              <span>
                <strong>صف درخواست قطعه</strong>
                <small>
                  {number.format(
                    operations.partRequests.filter(
                      (item) => item.status === "pending",
                    ).length,
                  )}{" "}
                  درخواست منتظر تصمیم
                </small>
              </span>
              <ChevronLeft />
            </button>
          )}
        {isManager && profile.modules.includes("inventory") && (
          <button onClick={() => onNavigate("تعهدهای داغی")}>
            <span className="quick-icon tone-coral">
              <Archive />
            </span>
            <span>
              <strong>کنترل داغی</strong>
              <small>
                {number.format(operations.summary.openHotReturns)} تعهد باز
                تکنسین‌ها
              </small>
            </span>
            <ChevronLeft />
          </button>
        )}
      </section>
    </>
  );
}

function DashboardEmpty({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="dashboard-empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-heading">
        <span className="panel-heading-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
