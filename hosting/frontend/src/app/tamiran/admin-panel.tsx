"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Archive,
  BadgeCheck,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  CreditCard,
  Cloud,
  Database,
  Download,
  Edit3,
  Gauge,
  Headphones,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquareMore,
  Menu,
  Phone,
  Plus,
  Play,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Store,
  TicketCheck,
  UserCog,
  UserPlus,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import * as React from "react";
import { useModalFocus } from "../shared/use-modal-focus";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  changeTicket,
  checkProductChange,
  cleanupBackups,
  createAdminUser,
  createPriceVersion,
  createSalesInvoice,
  executeProductChange,
  createShop,
  createTicket,
  loadBackups,
  loadAdmin,
  loadAdminUsers,
  loadPriceCatalog,
  loadSalesInvoices,
  loadTickets,
  previewBackupRestore,
  restoreShopBackup,
  recordSalesPayment,
  retrySalesProvisioning,
  runBackup,
  saveBackupSettings,
  updateAdminUser,
  updateSalesInvoice,
  updateShop,
  verifyBackup,
  type AdminBranch,
  type AdminDashboard,
  type AdminShop,
  type AdminUser,
  type BackupDashboard,
  type BackupJob,
  type ModuleChangeRecord,
  type PriceCatalogItem,
  type ProductChangeCheck,
  type SalesInvoice,
  type SalesInvoiceItem,
  type SupportTicketRecord,
} from "./directadmin-api";
import { directAdminApiEnabled, FollowUpApiError } from "./followups-api";
import { PersianDatePicker } from "./persian-date-picker";
import {
  addGregorianDays,
  addPersianMonths,
  todayGregorianIso,
} from "./persian-date";
import { APP_VERSION } from "./version";

type AdminSection =
  "overview" | "shops" | "users" | "licenses" | "pricing" | "sales" | "backups" | "tickets";

const adminSections = new Set<AdminSection>([
  "overview",
  "shops",
  "users",
  "licenses",
  "pricing",
  "sales",
  "backups",
  "tickets",
]);

function adminSectionFromLocation(): AdminSection {
  if (typeof window === "undefined") return "overview";
  const value = new URLSearchParams(window.location.search).get("admin");
  return value && adminSections.has(value as AdminSection)
    ? (value as AdminSection)
    : "overview";
}
type AdminModalState =
  | { kind: "shop-create" }
  | {
      kind: "shop-activation";
      shopCode: string;
      publicShopCode: string;
      managerMobile: string;
      temporaryPassword: string;
    }
  | { kind: "shop-edit"; shop: AdminShop }
  | { kind: "product-change"; shop: AdminShop }
  | { kind: "user-create" }
  | { kind: "user-edit"; user: AdminUser }
  | null;

const sectionItems: Array<{
  id: AdminSection;
  label: string;
  description: string;
  icon: typeof Gauge;
}> = [
  {
    id: "overview",
    label: "نمای کلی",
    description: "وضعیت لحظه‌ای سامانه",
    icon: LayoutDashboard,
  },
  {
    id: "shops",
    label: "تعمیرگاه‌ها",
    description: "فضاها و تنظیمات",
    icon: Building2,
  },
  {
    id: "users",
    label: "کاربران",
    description: "حساب‌ها و دسترسی‌ها",
    icon: UsersRound,
  },
  {
    id: "licenses",
    label: "اشتراک‌ها",
    description: "تمدید و محدودیت‌ها",
    icon: CreditCard,
  },
  {
    id: "pricing",
    label: "محصولات و قیمت‌ها",
    description: "کاتالوگ و نسخه قیمت",
    icon: BadgeCheck,
  },
  {
    id: "sales",
    label: "فروش و فاکتورها",
    description: "صورتحساب خریداران",
    icon: ReceiptText,
  },
  {
    id: "backups",
    label: "پشتیبان‌گیری",
    description: "سلامت، نگهداری و بازیابی",
    icon: Database,
  },
  {
    id: "tickets",
    label: "پشتیبانی",
    description: "تیکت‌ها و درخواست‌ها",
    icon: Headphones,
  },
];

const sectionTitles: Record<
  AdminSection,
  { eyebrow: string; title: string; description: string }
> = {
  overview: {
    eyebrow: "مرکز فرمان تعمیران",
    title: "نمای کلی سامانه",
    description:
      "تصویر روشن از تعمیرگاه‌ها، کاربران، اشتراک‌ها و درخواست‌های پشتیبانی",
  },
  shops: {
    eyebrow: "مدیریت مشتریان سازمانی",
    title: "تعمیرگاه‌ها",
    description:
      "ایجاد فضای جدید و مدیریت مشخصات، ظرفیت‌ها و وضعیت هر تعمیرگاه",
  },
  users: {
    eyebrow: "مدیریت هویت و دسترسی",
    title: "کاربران سامانه",
    description: "مشاهده، ساخت و ویرایش اطلاعات کاربران تمام تعمیرگاه‌ها",
  },
  licenses: {
    eyebrow: "مدیریت اشتراک",
    title: "اشتراک‌ها و انقضا",
    description: "کنترل تمدید، تعلیق، محصول و سقف کاربران و شعب",
  },
  sales: {
    eyebrow: "مدیریت فروش تعمیران",
    title: "فروش و فاکتورها",
    description:
      "ثبت و پیگیری فاکتور براساس محصول Solo/Pro و قابلیت‌های فعال‌شده",
  },
  pricing: {
    eyebrow: "قیمت‌گذاری SaaS",
    title: "محصولات و قیمت‌ها",
    description: "منبع واحد قیمت برای صدور فاکتور و محاسبه Entitlement",
  },
  backups: {
    eyebrow: "تداوم خدمت و حفاظت از داده",
    title: "مدیریت پشتیبان‌گیری",
    description:
      "کنترل نسخه‌های سراسری و تفکیکی، فضای خارجی، سلامت فایل‌ها و بازیابی امن",
  },
  tickets: {
    eyebrow: "مرکز ارتباط با تعمیرگاه‌ها",
    title: "پشتیبانی و تیکت‌ها",
    description: "رسیدگی تفکیک‌شده به ایرادات سامانه، پشتیبانی و فروش",
  },
};

const repairTypeLabels: Record<string, string> = {
  digital: "کالای دیجیتال",
  appliance: "لوازم خانگی",
  automotive: "خودرو",
  motorcycle: "موتورسیکلت",
  generic: "تعمیرگاه عمومی",
};
const planLabels: Record<string, string> = {
  light: "پایه",
  professional: "حرفه‌ای",
  business: "سازمانی",
};
const productLabel = (
  profile?: "solo" | "pro" | null,
  legacyPlan?: string,
) =>
  (profile ?? (legacyPlan === "light" ? "solo" : "pro")) === "solo"
    ? "تعمیران Solo"
    : "تعمیران Pro";
const moduleLabels: Record<string, string> = {
  repair: "مرکز عملیات تعمیرات",
  inventory: "انبار قطعات",
  finance: "مدیریت مالی",
  customer_portal: "پرتال مشتری",
  multi_branch: "مدیریت چندشعبه‌ای",
  sms: "پیامک و اطلاع‌رسانی",
  warranty: "گارانتی شرکتی",
  analytics: "گزارش‌های حرفه‌ای",
  accounting_integration: "اتصال حسابداری",
};
const moduleDescriptions: Record<string, string> = {
  repair: "پذیرش، تعمیر، رسید و تحویل",
  inventory: "موجودی، گردش و درخواست قطعه",
  finance: "دریافت، پرداخت و تسویه پرونده",
  customer_portal: "پیگیری و تأیید مشتری با لینک اختصاصی",
  multi_branch: "مدیریت شعب و دسترسی‌های تفکیکی",
  warranty: "پوشش و رسیدگی پرونده‌های گارانتی",
  analytics: "تحلیل SLA، بهره‌وری و روند عملیات",
  accounting_integration: "خروجی و یکپارچگی مالی کنترل‌شده",
  sms: "پیامک وضعیت، یادآوری و اطلاع‌رسانی",
};
const invoiceItemTypeLabels: Record<string, string> = {
  product: "محصول",
  plan: "اشتراک",
  repair_type: "راه‌اندازی صنفی",
  module: "قابلیت افزوده",
};
const sizeLabels: Record<string, string> = {
  personal: "تک‌نفره",
  small: "کوچک",
  medium: "متوسط",
  large: "بزرگ",
};
const roleLabels: Record<string, string> = {
  central_admin: "مدیر مرکزی تعمیران",
  repair_manager: "مدیر تعمیرگاه",
  reception: "مسئول پذیرش",
  technician: "تکنسین",
  quality_control: "کنترل کیفیت",
  warehouse_keeper: "انباردار",
  finance_cashier: "مسئول مالی / صندوق",
};
const statusLabels: Record<string, string> = {
  active: "فعال",
  suspended: "تعلیق‌شده",
  read_only: "فقط مشاهده",
  expired: "منقضی‌شده",
};
const ticketCategoryLabels: Record<string, string> = {
  support: "پشتیبانی",
  incident: "ایراد سامانه",
  sales: "فروش و تمدید",
};
const ticketStatusLabels: Record<string, string> = {
  open: "جدید",
  in_progress: "در حال بررسی",
  waiting_shop: "منتظر پاسخ تعمیرگاه",
  resolved: "حل‌شده",
  closed: "بسته‌شده",
};
const ticketPriorityLabels: Record<string, string> = {
  normal: "عادی",
  important: "مهم",
  urgent: "فوری",
};
const invoiceStatusLabels: Record<string, string> = {
  draft: "پیش‌نویس",
  issued: "صادرشده",
  partial: "پرداخت ناقص",
  paid: "تسویه‌شده",
  cancelled: "باطل‌شده",
};
const billingPeriodLabels: Record<string, string> = {
  monthly: "یک‌ماهه",
  quarterly: "سه‌ماهه",
  semiannual: "شش‌ماهه",
  annual: "یک‌ساله",
  custom: "بازه سفارشی",
};
const moduleChangeContextLabels: Record<string, string> = {
  initial_setup: "راه‌اندازی اولیه",
  manual: "درخواست مستقل مشتری",
  plan_change: "تغییر محصول",
  invoice: "فاکتور فروش",
  renewal: "تمدید اشتراک",
};

const persianNumber = new Intl.NumberFormat("fa-IR");
const persianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const persianDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const digitMap: Record<string, string> = {
  "0": "۰",
  "1": "۱",
  "2": "۲",
  "3": "۳",
  "4": "۴",
  "5": "۵",
  "6": "۶",
  "7": "۷",
  "8": "۸",
  "9": "۹",
};
const initialToday = todayGregorianIso();
const initialDueDate = addGregorianDays(initialToday, 7);
const initialYearEnd = addPersianMonths(initialToday, 12, true);

function toPersianDigits(value: string | number) {
  return String(value).replace(/[0-9]/g, (digit) => digitMap[digit]);
}

function formatMoney(value: number) {
  return `${persianNumber.format(value)} ریال`;
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "ثبت نشده";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return (withTime ? persianDateTime : persianDate).format(date);
}

function daysRemaining(value: string) {
  const target = new Date(`${value}T23:59:59`).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "ک"
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof FollowUpApiError
    ? `${error.message}${error.trackingCode ? ` · کد رهگیری ${error.trackingCode}` : ""}`
    : fallback;
}

const emptyDashboard: AdminDashboard = {
  summary: {
    shops: 0,
    active: 0,
    expiring: 0,
    users: 0,
    branches: 0,
    tickets: 0,
  },
  shops: [],
  moduleChanges: [],
};

export function CentralAdminPanel({
  notify,
  onSignOut,
}: {
  notify: (message: string) => void;
  onSignOut: () => void;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>(
    adminSectionFromLocation,
  );
  const [sectionRevision, setSectionRevision] = useState(0);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopFormError, setShopFormError] = useState("");
  const [query, setQuery] = useState("");
  const [shopStatus, setShopStatus] = useState("all");
  const [userRole, setUserRole] = useState("all");
  const [userStatus, setUserStatus] = useState("all");
  const [modal, setModal] = useState<AdminModalState>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<"checking" | "ok" | "error">(
    "checking",
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setSystemStatus("checking");
    try {
      if (!directAdminApiEnabled) {
        setDashboard(emptyDashboard);
        setUsers([]);
        setBranches([]);
        return;
      }
      const [adminData, userData] = await Promise.all([
        loadAdmin(),
        loadAdminUsers(),
      ]);
      setDashboard(adminData);
      setUsers(userData.users);
      setBranches(userData.branches);
      setSystemStatus("ok");
      setLastUpdatedAt(new Date());
    } catch (error) {
      setSystemStatus("error");
      notify(errorMessage(error, "بارگذاری پنل مدیریت انجام نشد."));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshAll(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshAll]);

  useEffect(() => {
    const onHistory = () => {
      setActiveSection(adminSectionFromLocation());
      setSectionRevision((current) => current + 1);
    };
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, []);

  const shops = useMemo(() => dashboard?.shops ?? [], [dashboard]);
  const normalizedQuery = query.trim().toLocaleLowerCase("fa");
  const filteredShops = useMemo(
    () =>
      shops.filter((shop) => {
        const matchesQuery =
          !normalizedQuery ||
          `${shop.name} ${shop.code} ${repairTypeLabels[shop.repairType] ?? ""}`
            .toLocaleLowerCase("fa")
            .includes(normalizedQuery);
        return (
          matchesQuery && (shopStatus === "all" || shop.status === shopStatus)
        );
      }),
    [shops, normalizedQuery, shopStatus],
  );
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesQuery =
          !normalizedQuery ||
          `${user.displayName} ${user.phone || user.username} ${user.shopName}`
            .toLocaleLowerCase("fa")
            .includes(normalizedQuery);
        const matchesRole = userRole === "all" || user.role === userRole;
        const matchesStatus =
          userStatus === "all" ||
          (userStatus === "active" ? user.isActive : !user.isActive);
        return matchesQuery && matchesRole && matchesStatus;
      }),
    [users, normalizedQuery, userRole, userStatus],
  );

  const openSection = (section: AdminSection) => {
    setActiveSection(section);
    setSectionRevision((current) => current + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("admin", section);
    window.history.pushState({ admin: section }, "", url);
    setQuery("");
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const saveShop = async (input: Record<string, unknown>, editing: boolean) => {
    setSaving(true);
    setShopFormError("");
    try {
      if (directAdminApiEnabled) {
        if (editing) await updateShop(input);
        else {
          const result = await createShop(input);
          setModal({
            kind: "shop-activation",
            shopCode: result.shopCode,
            publicShopCode: result.publicShopCode,
            managerMobile: result.managerMobile,
            temporaryPassword: result.temporaryPassword,
          });
          notify("تعمیرگاه ساخته شد؛ اطلاعات فعال‌سازی را امن تحویل دهید.");
        }
        await refreshAll();
      } else if (editing) {
        setDashboard((current) =>
          current
            ? {
                ...current,
                shops: current.shops.map((shop) =>
                  shop.id === input.id
                    ? ({ ...shop, ...input } as AdminShop)
                    : shop,
                ),
              }
            : current,
        );
      } else {
        const usedPublicCodes = new Set(
          shops.map((shop) => shop.publicShopCode).filter(Boolean),
        );
        let publicShopCode = "";
        for (let attempt = 0; attempt < 100 && !publicShopCode; attempt += 1) {
          const candidate = String(100000 + Math.floor(Math.random() * 900000));
          if (!usedPublicCodes.has(candidate)) publicShopCode = candidate;
        }
        if (!publicShopCode)
          throw new FollowUpApiError("کد عمومی شش‌رقمی آزاد پیدا نشد.");
        const code = publicShopCode;
        const id = Math.max(0, ...shops.map((item) => item.id)) + 1;
        const branchId = Math.max(0, ...branches.map((item) => item.id)) + 1;
        const now = new Date().toISOString();
        const created: AdminShop = {
          id,
          publicId: `SHOP-${Date.now()}`,
          code,
          publicShopCode,
          name: String(input.name),
          repairType: String(input.repairType),
          typeLocked: true,
          size: String(input.size),
          plan: String(input.plan),
          modules: input.modules as string[],
          status: "active",
          lifecycleStatus: "active",
          productProfile:
            String(input.productProfile) === "solo" ? "solo" : "pro",
          inventoryMode: (input.modules as string[]).includes("inventory")
            ? String(input.productProfile) === "solo"
              ? "simple"
              : "pro"
            : "off",
          qcMode:
            String(input.productProfile) === "solo" ? "simple" : "independent",
          startedAt: initialToday,
          expiresAt: String(input.expiresAt),
          nationalCodeRequired: Boolean(input.nationalCodeRequired),
          maxUsers: Number(input.maxUsers),
          maxBranches: Number(input.maxBranches),
          userCount: 1,
          branchCount: 1,
          openTickets: 0,
          createdAt: now,
          updatedAt: now,
        };
        setDashboard((current) => {
          const base = current ?? emptyDashboard;
          return {
            summary: {
              ...base.summary,
              shops: Number(base.summary.shops ?? 0) + 1,
              active: Number(base.summary.active ?? 0) + 1,
              users: Number(base.summary.users ?? 0) + 1,
              branches: Number(base.summary.branches ?? 0) + 1,
            },
            shops: [created, ...base.shops],
            moduleChanges: base.moduleChanges,
          };
        });
        setBranches((current) => [
          {
            id: branchId,
            shopId: id,
            code: "MAIN",
            name: "شعبه مرکزی",
            isDefault: true,
            isActive: true,
          },
          ...current,
        ]);
        setUsers((current) => [
          {
            id: Math.max(0, ...current.map((item) => item.id)) + 1,
            shopId: id,
            shopName: created.name,
            shopCode: code,
            username: String(input.managerMobile),
            displayName: String(input.managerName),
            phone: String(input.managerMobile),
            email: String(input.managerEmail ?? ""),
            role: "repair_manager",
            isActive: true,
            branchIds: [branchId],
            createdAt: now,
            updatedAt: now,
            lastLoginAt: null,
          },
          ...current,
        ]);
        notify("تعمیرگاه با موفقیت ساخته شد.");
      }
      if (editing) setModal(null);
      if (editing) notify("اطلاعات تعمیرگاه با موفقیت به‌روزرسانی شد.");
    } catch (error) {
      setShopFormError(
        errorMessage(
          error,
          editing ? "ویرایش تعمیرگاه انجام نشد." : "ساخت تعمیرگاه انجام نشد.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async (input: Record<string, unknown>, editing: boolean) => {
    setSaving(true);
    try {
      if (directAdminApiEnabled) {
        if (editing) await updateAdminUser(input);
        else await createAdminUser(input);
        const userData = await loadAdminUsers();
        setUsers(userData.users);
        setBranches(userData.branches);
        const adminData = await loadAdmin();
        setDashboard(adminData);
      } else if (editing) {
        setUsers((current) =>
          current.map((user) =>
            user.id === input.id ? ({ ...user, ...input } as AdminUser) : user,
          ),
        );
      } else {
        const shop = shops.find((item) => item.id === Number(input.shopId));
        setUsers((current) => [
          {
            id: Math.max(0, ...current.map((item) => item.id)) + 1,
            shopId: Number(input.shopId),
            shopName: shop?.name ?? "تعمیرگاه",
            shopCode: shop?.code ?? "",
            username: String(input.mobile),
            displayName: String(input.displayName),
            phone: String(input.mobile),
            email: String(input.email ?? ""),
            role: String(input.role),
            isActive: Boolean(input.isActive),
            branchIds: input.branchIds as number[],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: null,
          },
          ...current,
        ]);
      }
      setModal(null);
      notify(
        editing
          ? "مشخصات و دسترسی کاربر ذخیره شد."
          : "کاربر جدید با موفقیت ساخته شد.",
      );
    } catch (error) {
      notify(
        errorMessage(
          error,
          editing ? "ویرایش کاربر انجام نشد." : "ساخت کاربر انجام نشد.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const section = sectionTitles[activeSection];

  return (
    <main className="central-admin-shell">
      <aside
        className={`central-admin-sidebar ${mobileMenuOpen ? "is-open" : ""}`}
      >
        <div className="central-admin-brand">
          <span>
            <Wrench size={24} />
          </span>
          <div>
            <strong>تعمیران</strong>
            <small>مدیریت مرکزی سامانه</small>
          </div>
          <button
            type="button"
            className="central-admin-sidebar-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="بستن منو"
          >
            <X size={20} />
          </button>
        </div>
        <div className="central-admin-nav-label">فضای مدیریت</div>
        <nav className="central-admin-nav" aria-label="بخش‌های پنل مدیریت">
          {sectionItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeSection === item.id ? "active" : ""}
                onClick={() => openSection(item.id)}
              >
                <span>
                  <Icon size={19} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </div>
                {item.id === "tickets" &&
                  Number(dashboard?.summary.tickets ?? 0) > 0 && (
                    <b>
                      {persianNumber.format(Number(dashboard?.summary.tickets))}
                    </b>
                  )}
                <ChevronLeft size={16} />
              </button>
            );
          })}
        </nav>
        <div className="central-admin-system-card">
          <span>
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong>
              {systemStatus === "checking"
                ? "در حال بررسی ارتباط..."
                : systemStatus === "ok"
                  ? "ارتباط سامانه برقرار است"
                  : "ارتباط نیازمند بررسی است"}
            </strong>
            <small>
              {lastUpdatedAt
                ? `آخرین دریافت: ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(lastUpdatedAt)}`
                : "هنوز بررسی کامل نشده است"}
            </small>
            <small className="app-version-label">نسخه {APP_VERSION}</small>
          </div>
        </div>
        <div className="central-admin-profile">
          <span>م‌س</span>
          <div>
            <strong>مدیر سامانه</strong>
            <small>دسترسی کامل مرکزی</small>
          </div>
          <button type="button" onClick={onSignOut} aria-label="خروج از حساب">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          type="button"
          className="central-admin-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="بستن منو"
        />
      )}

      <section className="central-admin-workspace">
        <header className="central-admin-topbar">
          <div className="central-admin-heading">
            <button
              type="button"
              className="central-admin-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu size={22} />
            </button>
            <div>
              <span>{section.eyebrow}</span>
              <h1>{section.title}</h1>
              <p>{section.description}</p>
            </div>
          </div>
          <div className="central-admin-top-actions">
            {["shops", "users", "licenses"].includes(activeSection) && (
              <label className="central-admin-search">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeSection === "users"
                      ? "جست‌وجوی نام، شماره یا تعمیرگاه"
                      : "جست‌وجوی نام یا کد تعمیرگاه"
                  }
                />
              </label>
            )}
            <button
              type="button"
              className="central-admin-icon-button"
              onClick={() => void refreshAll()}
              title="به‌روزرسانی"
            >
              <RefreshCw size={19} className={loading ? "is-spinning" : ""} />
            </button>
            <button
              type="button"
              className="central-admin-icon-button has-alert"
              onClick={() => openSection("tickets")}
              title="درخواست‌های جدید"
            >
              <BellRing size={19} />
              <i />
            </button>
          </div>
        </header>

        <div className="central-admin-content" key={`${activeSection}-${sectionRevision}`}>
          {loading && !dashboard ? <AdminLoading /> : null}
          {!loading || dashboard ? (
            <>
              {activeSection === "overview" && (
                <AdminOverview
                  dashboard={dashboard ?? emptyDashboard}
                  users={users}
                  onNavigate={openSection}
                  onCreateShop={() => {
                    setShopFormError("");
                    setModal({ kind: "shop-create" });
                  }}
                />
              )}
              {activeSection === "shops" && (
                <ShopsSection
                  shops={filteredShops}
                  status={shopStatus}
                  onStatusChange={setShopStatus}
                  onCreate={() => {
                    setShopFormError("");
                    setModal({ kind: "shop-create" });
                  }}
                  onEdit={(shop) => {
                    setShopFormError("");
                    setModal({ kind: "shop-edit", shop });
                  }}
                  onProductChange={(shop) =>
                    setModal({ kind: "product-change", shop })
                  }
                />
              )}
              {activeSection === "users" && (
                <UsersSection
                  users={filteredUsers}
                  branches={branches}
                  role={userRole}
                  status={userStatus}
                  onRoleChange={setUserRole}
                  onStatusChange={setUserStatus}
                  onCreate={() => setModal({ kind: "user-create" })}
                  onEdit={(user) => setModal({ kind: "user-edit", user })}
                />
              )}
              {activeSection === "licenses" && (
                <LicensesSection
                  shops={filteredShops}
                  status={shopStatus}
                  onStatusChange={setShopStatus}
                  onEdit={(shop) => {
                    setShopFormError("");
                    setModal({ kind: "shop-edit", shop });
                  }}
                />
              )}
              {activeSection === "pricing" && (
                <PriceCatalogSection notify={notify} />
              )}
              {activeSection === "sales" && (
                <SalesSection shops={shops} notify={notify} />
              )}
              {activeSection === "backups" && (
                <BackupSection shops={shops} notify={notify} />
              )}
              {activeSection === "tickets" && (
                <SupportTickets central notify={notify} />
              )}
            </>
          ) : null}
        </div>
      </section>

      {modal?.kind === "shop-create" && (
        <AdminModal
          title="ایجاد فضای تعمیرگاه"
          subtitle="نوع صنفی و محصول Solo یا Pro را مشخص کنید؛ شناسه‌های لازم به‌صورت خودکار ساخته می‌شوند."
          onClose={() => setModal(null)}
        >
          <ShopFormV4
            saving={saving}
            serverError={shopFormError}
            onCancel={() => setModal(null)}
            onSave={(input) => void saveShop(input, false)}
          />
        </AdminModal>
      )}
      {modal?.kind === "shop-edit" && (
        <AdminModal
          title="ویرایش تعمیرگاه"
          subtitle="اطلاعات پایه و محصول در یک بخش مدیریت می‌شوند؛ افزونه‌ها فقط از مسیر فاکتور تغییر می‌کنند."
          onClose={() => setModal(null)}
        >
          <ShopFormV4
            shop={modal.shop}
            moduleChanges={(dashboard?.moduleChanges ?? []).filter(
              (item) => item.shopId === modal.shop.id,
            )}
            saving={saving}
            serverError={shopFormError}
            onCancel={() => setModal(null)}
            onSave={(input) => void saveShop(input, true)}
          />
        </AdminModal>
      )}
      {modal?.kind === "shop-activation" && (
        <AdminModal
          title="اطلاعات فعال‌سازی مدیر"
          subtitle="رمز موقت فقط در همین مرحله نمایش داده می‌شود؛ آن را از مسیر امن به مدیر تعمیرگاه تحویل دهید."
          onClose={() => setModal(null)}
        >
          <div className="central-admin-form shop-activation-card">
            <div className="product-preservation-note">
              <ShieldCheck size={22} />
              <div>
                <strong>تعمیرگاه با موفقیت Provision شد</strong>
                <p>کد عمومی و توالی قبض مستقل از محصول باقی می‌مانند.</p>
              </div>
            </div>
            <div className="product-impact-grid">
              <div><span>کد ورود</span><strong dir="ltr">{modal.shopCode}</strong></div>
              <div><span>کد عمومی قبض</span><strong dir="ltr">{modal.publicShopCode}</strong></div>
              <div><span>موبایل مدیر</span><strong dir="ltr">{modal.managerMobile}</strong></div>
            </div>
            <label className="field-block">
              <span>رمز موقت یک‌بارمصرف</span>
              <input dir="ltr" readOnly value={modal.temporaryPassword} onFocus={(event) => event.currentTarget.select()} />
              <small>مدیر در نخستین ورود ملزم به انتخاب رمز جدید خواهد بود.</small>
            </label>
            <div className="central-admin-form-actions">
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(`کد تعمیرگاه: ${modal.shopCode}\nموبایل: ${modal.managerMobile}\nرمز موقت: ${modal.temporaryPassword}`)}
              >
                کپی اطلاعات
              </button>
              <button type="button" className="central-admin-primary" onClick={() => setModal(null)}>
                اطلاعات را تحویل دادم
              </button>
            </div>
          </div>
        </AdminModal>
      )}
      {modal?.kind === "product-change" && (
        <AdminModal
          title={
            modal.shop.productProfile === "solo"
              ? "ارتقا به Tamiran Pro"
              : "درخواست تغییر به Tamiran Solo"
          }
          subtitle="ابتدا پیش‌بررسی و اثر تغییر نمایش داده می‌شود؛ شناسه تعمیرگاه، کد عمومی و توالی قبض ثابت می‌مانند."
          onClose={() => setModal(null)}
        >
          <ProductChangeFlow
            shop={modal.shop}
            onCancel={() => setModal(null)}
            onCompleted={async () => {
              setModal(null);
              await refreshAll();
              notify("تغییر محصول با موفقیت تکمیل شد.");
            }}
          />
        </AdminModal>
      )}
      {modal?.kind === "user-create" && (
        <AdminModal
          title="ساخت کاربر جدید"
          subtitle="تعمیرگاه، نقش و شعب مجاز کاربر را مشخص کنید."
          onClose={() => setModal(null)}
        >
          <UserForm
            shops={shops}
            branches={branches}
            saving={saving}
            onCancel={() => setModal(null)}
            onSave={(input) => void saveUser(input, false)}
          />
        </AdminModal>
      )}
      {modal?.kind === "user-edit" && (
        <AdminModal
          title="ویرایش مشخصات کاربر"
          subtitle="اطلاعات هویتی، دسترسی، وضعیت و رمز عبور قابل مدیریت است."
          onClose={() => setModal(null)}
        >
          <UserForm
            user={modal.user}
            shops={shops}
            branches={branches}
            saving={saving}
            onCancel={() => setModal(null)}
            onSave={(input) => void saveUser(input, true)}
          />
        </AdminModal>
      )}
    </main>
  );
}

function AdminLoading() {
  return (
    <div className="central-admin-loading">
      <RefreshCw size={24} className="is-spinning" />
      <strong>در حال آماده‌سازی پنل مدیریت...</strong>
      <span>اطلاعات تعمیرگاه‌ها و کاربران دریافت می‌شود.</span>
    </div>
  );
}

function AdminOverview({
  dashboard,
  users,
  onNavigate,
  onCreateShop,
}: {
  dashboard: AdminDashboard;
  users: AdminUser[];
  onNavigate: (section: AdminSection) => void;
  onCreateShop: () => void;
}) {
  const summary = dashboard.summary;
  const expiring = dashboard.shops
    .filter(
      (shop) => shop.status === "active" && daysRemaining(shop.expiresAt) <= 30,
    )
    .sort((a, b) => daysRemaining(a.expiresAt) - daysRemaining(b.expiresAt));
  const inactiveUsers = users.filter((user) => !user.isActive).length;
  const cards = [
    {
      label: "تعمیرگاه‌ها",
      value: summary.shops ?? 0,
      helper: `${persianNumber.format(summary.active ?? 0)} تعمیرگاه فعال`,
      icon: Building2,
      tone: "teal",
      section: "shops" as AdminSection,
    },
    {
      label: "کاربران سامانه",
      value: summary.users ?? users.length,
      helper: `${persianNumber.format(inactiveUsers)} حساب غیرفعال`,
      icon: UsersRound,
      tone: "blue",
      section: "users" as AdminSection,
    },
    {
      label: "نزدیک به انقضا",
      value: summary.expiring ?? 0,
      helper: "در ۳۰ روز آینده",
      icon: CalendarClock,
      tone: "amber",
      section: "licenses" as AdminSection,
    },
    {
      label: "درخواست‌های باز",
      value: summary.tickets ?? 0,
      helper: "نیازمند رسیدگی",
      icon: LifeBuoy,
      tone: "coral",
      section: "tickets" as AdminSection,
    },
  ];
  return (
    <div className="central-admin-overview">
      <section className="central-admin-welcome">
        <div>
          <span>
            <Activity size={16} /> وضعیت امروز سامانه
          </span>
          <h2>همه‌چیز برای مدیریت تعمیرگاه‌ها در یک نگاه</h2>
          <p>
            حساب‌های کاربری، اشتراک‌ها و درخواست‌های نیازمند اقدام از این مرکز
            کنترل می‌شوند.
          </p>
        </div>
        <button type="button" onClick={onCreateShop}>
          <Plus size={18} />
          ایجاد تعمیرگاه جدید
        </button>
      </section>
      <div className="central-admin-kpis">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.label}
              className={`central-admin-kpi tone-${card.tone}`}
              onClick={() => onNavigate(card.section)}
            >
              <span>
                <Icon size={21} />
              </span>
              <div>
                <small>{card.label}</small>
                <strong>{persianNumber.format(Number(card.value))}</strong>
                <p>{card.helper}</p>
              </div>
              <ChevronLeft size={18} />
            </button>
          );
        })}
      </div>
      <div className="central-admin-overview-grid">
        <section className="central-admin-panel central-admin-action-panel">
          <header>
            <div>
              <span>
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3>اقدام‌های لازم</h3>
                <p>مواردی که بهتر است امروز بررسی شوند</p>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate("licenses")}>
              مشاهده همه
            </button>
          </header>
          <div className="central-admin-action-list">
            {expiring.slice(0, 4).map((shop) => (
              <button
                type="button"
                key={shop.id}
                onClick={() => onNavigate("licenses")}
              >
                <span className="warning">
                  <CalendarClock size={18} />
                </span>
                <div>
                  <strong>اشتراک «{shop.name}» رو به پایان است</strong>
                  <small>
                    {persianNumber.format(
                      Math.max(0, daysRemaining(shop.expiresAt)),
                    )}{" "}
                    روز تا انقضا · {formatDate(shop.expiresAt)}
                  </small>
                </div>
                <b>تمدید</b>
              </button>
            ))}
            {Number(summary.tickets ?? 0) > 0 && (
              <button type="button" onClick={() => onNavigate("tickets")}>
                <span className="attention">
                  <TicketCheck size={18} />
                </span>
                <div>
                  <strong>
                    {persianNumber.format(Number(summary.tickets))} درخواست
                    پشتیبانی باز است
                  </strong>
                  <small>درخواست‌های جدید و در حال بررسی</small>
                </div>
                <b>رسیدگی</b>
              </button>
            )}
            {inactiveUsers > 0 && (
              <button type="button" onClick={() => onNavigate("users")}>
                <span>
                  <UserCog size={18} />
                </span>
                <div>
                  <strong>
                    {persianNumber.format(inactiveUsers)} حساب کاربری غیرفعال
                    است
                  </strong>
                  <small>وضعیت و دلیل غیرفعال‌بودن حساب‌ها را بررسی کنید</small>
                </div>
                <b>بررسی</b>
              </button>
            )}
            {expiring.length === 0 &&
              Number(summary.tickets ?? 0) === 0 &&
              inactiveUsers === 0 && (
                <div className="central-admin-empty-inline">
                  <CheckCircle2 size={24} />
                  <strong>اقدام معوقی وجود ندارد</strong>
                  <span>وضعیت سامانه پایدار و به‌روز است.</span>
                </div>
              )}
          </div>
        </section>
        <section className="central-admin-panel central-admin-recent-panel">
          <header>
            <div>
              <span>
                <Store size={18} />
              </span>
              <div>
                <h3>آخرین تعمیرگاه‌ها</h3>
                <p>فضاهای ایجادشده در سامانه</p>
              </div>
            </div>
            <button type="button" onClick={() => onNavigate("shops")}>
              مدیریت
            </button>
          </header>
          <div>
            {dashboard.shops.slice(0, 5).map((shop) => (
              <article key={shop.id}>
                <span>{initials(shop.name)}</span>
                <div>
                  <strong>{shop.name}</strong>
                  <small>
                    {repairTypeLabels[shop.repairType] ?? "تعمیرگاه"} ·{" "}
                    {persianNumber.format(shop.userCount)} کاربر
                  </small>
                </div>
                <StatusBadge status={shop.status} />
              </article>
            ))}
          </div>
          {dashboard.shops.length === 0 && (
            <AdminEmpty
              icon={Store}
              title="هنوز اطلاعاتی ثبت نشده است"
              description="با ایجاد اولین تعمیرگاه، اطلاعات آن در این بخش نمایش داده می‌شود."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function BackupSection({
  shops,
  notify,
}: {
  shops: AdminShop[];
  notify: (message: string) => void;
}) {
  const [data, setData] = useState<BackupDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shopId, setShopId] = useState(shops[0]?.id ?? 0);
  const [restoreJob, setRestoreJob] = useState<BackupJob | null>(null);
  const [restorePreview, setRestorePreview] = useState<Record<string, number>>(
    {},
  );
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadBackups());
    } catch (error) {
      notify(errorMessage(error, "وضعیت پشتیبان‌گیری دریافت نشد."));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const execute = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      notify(success);
      await refresh();
    } catch (error) {
      notify(errorMessage(error, "عملیات پشتیبان‌گیری انجام نشد."));
    } finally {
      setBusy(false);
    }
  };

  const openRestore = async (job: BackupJob) => {
    setBusy(true);
    try {
      const result = await previewBackupRestore(job.id);
      setRestorePreview(result.preview.counts);
      setRestoreJob(job);
      setRestoreConfirmation("");
      setRestorePassword("");
    } catch (error) {
      notify(errorMessage(error, "پیش‌نمایش بازیابی آماده نشد."));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <AdminLoading />;
  const health = data?.health;
  const jobs = data?.jobs ?? [];
  const settings = health?.settings;
  const latest = health?.latestGlobal;
  const healthy = Boolean(
    health?.localReady &&
    (!settings?.offsite_required || health?.offsiteConfigured) &&
    Number(health?.failed24Hours ?? 0) === 0,
  );
  return (
    <div className="backup-admin-page">
      <section
        className={`backup-health-banner ${healthy ? "is-healthy" : "needs-attention"}`}
      >
        <span>
          {healthy ? <ShieldCheck size={25} /> : <AlertTriangle size={25} />}
        </span>
        <div>
          <strong>
            {healthy
              ? "زنجیره پشتیبان‌گیری سالم است"
              : "پشتیبان‌گیری نیازمند بررسی است"}
          </strong>
          <p>
            {healthy
              ? "نسخه محلی و مقصد خارجی آماده‌اند و خطای بازی ثبت نشده است."
              : !health?.localReady
                ? "کلید رمزگذاری یا پوشه خصوصی بکاپ آماده نیست."
                : !health?.offsiteConfigured
                  ? "فضای خارجی هنوز در private/config.php پیکربندی نشده است."
                  : "در ۲۴ ساعت گذشته حداقل یک عملیات ناموفق ثبت شده است."}
          </p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          <RefreshCw size={17} className={loading ? "is-spinning" : ""} />
          به‌روزرسانی وضعیت
        </button>
      </section>

      <section className="backup-summary-grid">
        <article>
          <span>
            <Database size={21} />
          </span>
          <div>
            <small>آخرین بکاپ سراسری</small>
            <strong>
              {latest?.finishedAt
                ? formatDate(latest.finishedAt, true)
                : "ثبت نشده"}
            </strong>
            <p>
              {latest
                ? `${persianNumber.format(latest.recordCount)} رکورد`
                : "هنوز نسخه‌ای ساخته نشده است"}
            </p>
          </div>
        </article>
        <article>
          <span>
            <Cloud size={21} />
          </span>
          <div>
            <small>فضای خارج از سرور</small>
            <strong>
              {health?.offsiteConfigured ? "پیکربندی شده" : "آماده نیست"}
            </strong>
            <p>
              {settings?.offsite_required
                ? "برای موفقیت بکاپ الزامی است"
                : "اختیاری تنظیم شده است"}
            </p>
          </div>
        </article>
        <article>
          <span>
            <Store size={21} />
          </span>
          <div>
            <small>تعمیرگاه فاقد نسخه تازه</small>
            <strong>
              {persianNumber.format(
                Number(health?.shopsWithoutRecentBackup ?? 0),
              )}
            </strong>
            <p>بیش از ۴۸ ساعت بدون بکاپ تفکیکی</p>
          </div>
        </article>
        <article>
          <span>
            <AlertTriangle size={21} />
          </span>
          <div>
            <small>خطای ۲۴ ساعت اخیر</small>
            <strong>
              {persianNumber.format(Number(health?.failed24Hours ?? 0))}
            </strong>
            <p>شامل خطای محلی یا انتقال خارجی</p>
          </div>
        </article>
      </section>

      <section className="central-admin-panel backup-actions-panel">
        <header>
          <div>
            <span>
              <Play size={18} />
            </span>
            <div>
              <h3>عملیات فوری</h3>
              <p>اجرای دستی علاوه بر زمان‌بندی خودکار</p>
            </div>
          </div>
          <button
            type="button"
            className="central-admin-secondary"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <Settings size={16} />
            تنظیم زمان‌بندی
          </button>
        </header>
        <div className="backup-action-row">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void execute(
                () => runBackup(),
                "بکاپ سراسری ساخته و نتیجه انتقال خارجی ثبت شد.",
              )
            }
          >
            <Database size={19} />
            <span>
              <strong>بکاپ سراسری فوری</strong>
              <small>تمام داده‌ها، تنظیمات خصوصی و فایل‌ها</small>
            </span>
          </button>
          <div className="backup-shop-action">
            <label>
              بکاپ تفکیکی تعمیرگاه
              <select
                value={shopId}
                onChange={(event) => setShopId(Number(event.target.value))}
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} · {toPersianDigits(shop.code)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !shopId}
              onClick={() =>
                void execute(
                  () => runBackup(shopId),
                  "نسخه تفکیکی تعمیرگاه ساخته شد.",
                )
              }
            >
              <Play size={17} />
              اجرا
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void execute(cleanupBackups, "پاک‌سازی نسخه‌های منقضی انجام شد.")
            }
          >
            <Archive size={19} />
            <span>
              <strong>اجرای سیاست نگهداری</strong>
              <small>حذف امن نسخه‌های خارج از بازه</small>
            </span>
          </button>
        </div>
        {settingsOpen && settings && (
          <BackupSettingsForm
            settings={settings}
            busy={busy}
            onSave={(input) =>
              void execute(
                () => saveBackupSettings(input),
                "تنظیمات پشتیبان‌گیری ذخیره شد.",
              )
            }
          />
        )}
      </section>

      <section className="central-admin-panel central-admin-list-panel backup-list-panel">
        <div className="central-admin-list-toolbar">
          <div>
            <strong>تاریخچه نسخه‌ها</strong>
            <small>فایل‌های رمزگذاری‌شده محلی و وضعیت انتقال خارجی</small>
          </div>
        </div>
        <div className="central-admin-table-wrap">
          <table className="central-admin-table backup-table">
            <thead>
              <tr>
                <th>نسخه</th>
                <th>محدوده</th>
                <th>تاریخ و حجم</th>
                <th>نسخه محلی</th>
                <th>فضای خارجی</th>
                <th>کنترل سلامت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong>
                      {job.archiveName ?? `بکاپ ${toPersianDigits(job.id)}`}
                    </strong>
                    <small className="central-admin-cell-note">
                      {job.trigger === "cron"
                        ? "خودکار"
                        : job.trigger === "before_restore"
                          ? "پیش از بازیابی"
                          : "دستی"}
                    </small>
                  </td>
                  <td>
                    <strong>
                      {job.type === "global"
                        ? "کل سامانه"
                        : job.type === "emergency"
                          ? "اضطراری"
                          : "تفکیکی"}
                    </strong>
                    <small className="central-admin-cell-note">
                      {job.shopName
                        ? `${job.shopName} · ${toPersianDigits(job.shopCode ?? "")}`
                        : "تمام تعمیرگاه‌ها"}
                    </small>
                  </td>
                  <td>
                    <strong>{formatDate(job.createdAt, true)}</strong>
                    <small className="central-admin-cell-note">
                      {formatBytes(job.sizeBytes)} ·{" "}
                      {persianNumber.format(job.recordCount)} رکورد
                    </small>
                  </td>
                  <td>
                    <BackupState value={job.localStatus} />
                  </td>
                  <td>
                    <BackupState value={job.offsiteStatus} />
                  </td>
                  <td>
                    {job.verifiedAt ? (
                      <span className="backup-verified">
                        <CheckCircle2 size={14} />
                        تأییدشده
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="central-admin-row-action"
                        disabled={busy || job.localStatus !== "succeeded"}
                        onClick={() =>
                          void execute(
                            () => verifyBackup(job.id),
                            "سلامت و رمزگشایی فایل تأیید شد.",
                          )
                        }
                      >
                        <ShieldCheck size={15} />
                        بررسی
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="backup-row-actions">
                      {job.localStatus === "succeeded" && (
                        <a
                          className="central-admin-row-action"
                          href={`/api/backup-download.php?id=${job.id}`}
                        >
                          <Download size={15} />
                          دانلود
                        </a>
                      )}
                      {job.shopId && job.localStatus === "succeeded" && (
                        <button
                          type="button"
                          className="central-admin-row-action danger"
                          disabled={busy}
                          onClick={() => void openRestore(job)}
                        >
                          <RotateCcw size={15} />
                          بازیابی
                        </button>
                      )}
                    </div>
                    {job.error && (
                      <small className="backup-error">{job.error}</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <AdminEmpty
            icon={Database}
            title="هنوز نسخه پشتیبانی ساخته نشده است"
            description="پس از فعال‌سازی زمان‌بندی یا اجرای بکاپ فوری، سوابق اینجا نمایش داده می‌شوند."
          />
        )}
      </section>

      {restoreJob && (
        <AdminModal
          title={`بازیابی ${restoreJob.shopName ?? "تعمیرگاه"}`}
          subtitle="قبل از بازیابی، یک نسخه اضطراری خودکار از وضعیت فعلی ساخته می‌شود."
          onClose={() => setRestoreJob(null)}
        >
          <div className="backup-restore-modal">
            <div className="backup-restore-warning">
              <AlertTriangle size={21} />
              <div>
                <strong>
                  این عملیات اطلاعات فعلی تعمیرگاه را با نسخه انتخاب‌شده جایگزین
                  می‌کند.
                </strong>
                <p>
                  پیش‌نمایش شامل{" "}
                  {persianNumber.format(
                    Object.values(restorePreview).reduce(
                      (sum, value) => sum + Number(value),
                      0,
                    ),
                  )}{" "}
                  رکورد و فایل است.
                </p>
              </div>
            </div>
            <div className="backup-preview-counts">
              {Object.entries(restorePreview)
                .filter(([, value]) => value > 0)
                .map(([key, value]) => (
                  <span key={key}>
                    <b>{persianNumber.format(value)}</b>
                    {backupTableLabel(key)}
                  </span>
                ))}
            </div>
            <label>
              رمز فعلی مدیر مرکزی
              <input
                type="password"
                value={restorePassword}
                onChange={(event) => setRestorePassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label>
              برای تأیید عبارت «بازیابی-
              {toPersianDigits(restoreJob.shopCode ?? "")}» را وارد کنید
              <input
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                placeholder={`بازیابی-${toPersianDigits(restoreJob.shopCode ?? "")}`}
              />
            </label>
            <div className="central-admin-form-actions">
              <button
                type="button"
                className="central-admin-secondary"
                onClick={() => setRestoreJob(null)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="central-admin-primary danger"
                disabled={busy || !restorePassword || !restoreConfirmation}
                onClick={() =>
                  void execute(async () => {
                    await restoreShopBackup(
                      restoreJob.id,
                      restorePassword,
                      restoreConfirmation.replace(/[۰-۹]/g, (digit) =>
                        String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
                      ),
                    );
                    setRestoreJob(null);
                  }, "اطلاعات تعمیرگاه بازیابی و نسخه اضطراری ثبت شد.")
                }
              >
                <RotateCcw size={17} />
                تأیید بازیابی
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function BackupSettingsForm({
  settings,
  busy,
  onSave,
}: {
  settings: BackupDashboard["health"]["settings"];
  busy: boolean;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    enabled: Boolean(settings.enabled),
    offsiteRequired: Boolean(settings.offsite_required),
    globalIntervalMinutes: Number(settings.global_interval_minutes),
    shopIntervalHours: Number(settings.shop_interval_hours),
    localHourlyRetention: Number(settings.local_hourly_retention),
    dailyRetentionDays: Number(settings.daily_retention_days),
    weeklyRetentionWeeks: Number(settings.weekly_retention_weeks),
    monthlyRetentionMonths: Number(settings.monthly_retention_months),
  });
  const numberField = (
    key: keyof typeof form,
    label: string,
    min: number,
    max: number,
  ) => (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={Number(form[key])}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            [key]: Number(event.target.value),
          }))
        }
      />
    </label>
  );
  return (
    <div className="backup-settings-form">
      <div className="backup-settings-switches">
        <label>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                enabled: event.target.checked,
              }))
            }
          />
          <span>
            <strong>بکاپ خودکار فعال</strong>
            <small>اجرای زمان‌بندی‌شده توسط Cron</small>
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.offsiteRequired}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                offsiteRequired: event.target.checked,
              }))
            }
          />
          <span>
            <strong>نسخه خارجی الزامی</strong>
            <small>بدون تأیید مقصد خارجی، عملیات موفق محسوب نمی‌شود</small>
          </span>
        </label>
      </div>
      <div className="backup-settings-grid">
        {numberField(
          "globalIntervalMinutes",
          "فاصله بکاپ سراسری (دقیقه)",
          15,
          1440,
        )}
        {numberField("shopIntervalHours", "فاصله بکاپ تعمیرگاه (ساعت)", 1, 168)}
        {numberField("localHourlyRetention", "نگهداری فشرده (ساعت)", 24, 168)}
        {numberField("dailyRetentionDays", "نگهداری روزانه (روز)", 7, 365)}
        {numberField("weeklyRetentionWeeks", "نگهداری هفتگی (هفته)", 4, 104)}
        {numberField("monthlyRetentionMonths", "نگهداری ماهانه (ماه)", 3, 60)}
      </div>
      <button
        type="button"
        className="central-admin-primary"
        disabled={busy}
        onClick={() => onSave(form)}
      >
        <Save size={16} />
        ذخیره تنظیمات
      </button>
    </div>
  );
}

function BackupState({ value }: { value: string }) {
  const label =
    value === "succeeded"
      ? "موفق"
      : value === "pending"
        ? "در انتظار"
        : value === "disabled"
          ? "تنظیم نشده"
          : value === "deleted"
            ? "پاک‌شده"
            : "ناموفق";
  return (
    <span className={`backup-state state-${value}`}>
      <i />
      {label}
    </span>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${persianNumber.format(value)} بایت`;
  if (value < 1024 * 1024)
    return `${persianNumber.format(Math.round(value / 1024))} کیلوبایت`;
  return `${persianNumber.format(Math.round((value / 1024 / 1024) * 10) / 10)} مگابایت`;
}

function backupTableLabel(value: string) {
  const labels: Record<string, string> = {
    repair_shops: "تعمیرگاه",
    repair_branches: "شعب",
    tamiran_users: "کاربران",
    repair_customers: "مشتریان",
    repair_customer_devices: "دستگاه‌ها",
    repair_cases: "پرونده‌ها",
    repair_inventory_items: "قطعات",
    repair_inventory_movements: "گردش‌ها",
    repair_followups: "پیگیری‌ها",
    repair_support_tickets: "تیکت‌ها",
    files: "فایل‌ها",
  };
  return labels[value] ?? "سایر داده‌ها";
}

function ShopsSection({
  shops,
  status,
  onStatusChange,
  onCreate,
  onEdit,
  onProductChange,
}: {
  shops: AdminShop[];
  status: string;
  onStatusChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (shop: AdminShop) => void;
  onProductChange: (shop: AdminShop) => void;
}) {
  return (
    <section className="central-admin-panel central-admin-list-panel">
      <div className="central-admin-list-toolbar">
        <div className="central-admin-filter-tabs">
          <button
            type="button"
            className={status === "all" ? "active" : ""}
            onClick={() => onStatusChange("all")}
          >
            همه
          </button>
          <button
            type="button"
            className={status === "active" ? "active" : ""}
            onClick={() => onStatusChange("active")}
          >
            فعال
          </button>
          <button
            type="button"
            className={status === "expired" ? "active" : ""}
            onClick={() => onStatusChange("expired")}
          >
            منقضی
          </button>
          <button
            type="button"
            className={status === "suspended" ? "active" : ""}
            onClick={() => onStatusChange("suspended")}
          >
            تعلیق‌شده
          </button>
        </div>
        <button
          type="button"
          className="central-admin-primary"
          onClick={onCreate}
        >
          <Plus size={17} />
          ایجاد تعمیرگاه
        </button>
      </div>
      <div className="central-admin-table-wrap">
        <table className="central-admin-table">
          <thead>
            <tr>
              <th>تعمیرگاه</th>
              <th>نوع صنفی</th>
              <th>محصول</th>
              <th>کاربر و شعبه</th>
              <th>انقضای اشتراک</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td>
                  <div className="central-admin-name-cell">
                    <span>{initials(shop.name)}</span>
                    <div>
                      <strong>{shop.name}</strong>
                      <small dir="ltr">{shop.code}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>
                    {repairTypeLabels[shop.repairType] ?? "تعمیرگاه"}
                  </strong>
                </td>
                <td>
                  <span className="central-admin-plan-badge">
                    {shop.productProfile === "solo"
                      ? "تعمیران Solo"
                      : "تعمیران Pro"}
                  </span>
                </td>
                <td>
                  <strong>
                    {persianNumber.format(shop.userCount)} از{" "}
                    {persianNumber.format(shop.maxUsers)} کاربر
                  </strong>
                  <small className="central-admin-cell-note">
                    {persianNumber.format(shop.branchCount)} از{" "}
                    {persianNumber.format(shop.maxBranches)} شعبه
                  </small>
                </td>
                <td>
                  <strong>{formatDate(shop.expiresAt)}</strong>
                  <small
                    className={`central-admin-cell-note ${daysRemaining(shop.expiresAt) <= 30 ? "is-warning" : ""}`}
                  >
                    {daysRemaining(shop.expiresAt) >= 0
                      ? `${persianNumber.format(daysRemaining(shop.expiresAt))} روز باقی‌مانده`
                      : `${persianNumber.format(Math.abs(daysRemaining(shop.expiresAt)))} روز از انقضا`}
                  </small>
                </td>
                <td>
                  <StatusBadge status={shop.status} />
                </td>
                <td>
                  <div className="central-admin-row-actions">
                    <button
                      type="button"
                      className="central-admin-row-action"
                      onClick={() => onEdit(shop)}
                    >
                      <Edit3 size={16} />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      className="central-admin-row-action"
                      onClick={() => onProductChange(shop)}
                    >
                      <ArrowLeftRight size={16} />
                      {shop.productProfile === "solo"
                        ? "ارتقا به Pro"
                        : "تغییر به Solo"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shops.length === 0 && (
        <AdminEmpty
          icon={Store}
          title="تعمیرگاهی پیدا نشد"
          description="عبارت جست‌وجو یا فیلتر وضعیت را تغییر دهید."
        />
      )}
    </section>
  );
}

function UsersSection({
  users,
  branches,
  role,
  status,
  onRoleChange,
  onStatusChange,
  onCreate,
  onEdit,
}: {
  users: AdminUser[];
  branches: AdminBranch[];
  role: string;
  status: string;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (user: AdminUser) => void;
}) {
  const branchNames = (user: AdminUser) =>
    branches
      .filter((branch) => user.branchIds.includes(branch.id))
      .map((branch) => branch.name)
      .join("، ") || "بدون شعبه";
  return (
    <section className="central-admin-panel central-admin-list-panel">
      <div className="central-admin-list-toolbar">
        <div className="central-admin-select-filters">
          <label>
            نقش
            <select
              value={role}
              onChange={(event) => onRoleChange(event.target.value)}
            >
              <option value="all">همه نقش‌ها</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            وضعیت
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              <option value="all">همه حساب‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="central-admin-primary"
          onClick={onCreate}
        >
          <UserPlus size={17} />
          ساخت کاربر
        </button>
      </div>
      <div className="central-admin-table-wrap">
        <table className="central-admin-table central-admin-users-table">
          <thead>
            <tr>
              <th>کاربر</th>
              <th>تعمیرگاه</th>
              <th>نقش و شعبه</th>
              <th>راه ارتباطی</th>
              <th>آخرین ورود</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="central-admin-name-cell">
                    <span className={user.isActive ? "" : "inactive"}>
                      {initials(user.displayName)}
                    </span>
                    <div>
                      <strong>{user.displayName}</strong>
                      <small dir="ltr">{user.username}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{user.shopName}</strong>
                  <small
                    className="central-admin-cell-note"
                    dir={user.shopId ? "ltr" : "rtl"}
                  >
                    {user.shopId ? user.shopCode : "حساب مرکزی"}
                  </small>
                </td>
                <td>
                  <strong>{roleLabels[user.role] ?? "کاربر"}</strong>
                  <small className="central-admin-cell-note">
                    {branchNames(user)}
                  </small>
                </td>
                <td>
                  <div className="central-admin-contact-cell">
                    {user.phone && (
                      <span>
                        <Phone size={13} />
                        {user.phone}
                      </span>
                    )}
                    {user.email && (
                      <span dir="ltr">
                        <Mail size={13} />
                        {user.email}
                      </span>
                    )}
                    {!user.phone && !user.email && <small>ثبت نشده</small>}
                  </div>
                </td>
                <td>
                  <strong>
                    {user.lastLoginAt
                      ? formatDate(user.lastLoginAt, true)
                      : "هنوز وارد نشده"}
                  </strong>
                  <small className="central-admin-cell-note">
                    عضویت: {formatDate(user.createdAt)}
                  </small>
                </td>
                <td>
                  <span
                    className={`central-admin-account-status ${user.isActive ? "active" : "inactive"}`}
                  >
                    <i />
                    {user.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="central-admin-row-action"
                    onClick={() => onEdit(user)}
                  >
                    <Edit3 size={16} />
                    ویرایش
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && (
        <AdminEmpty
          icon={UsersRound}
          title="کاربری پیدا نشد"
          description="عبارت جست‌وجو یا فیلترهای نقش و وضعیت را تغییر دهید."
        />
      )}
    </section>
  );
}

function LicensesSection({
  shops,
  status,
  onStatusChange,
  onEdit,
}: {
  shops: AdminShop[];
  status: string;
  onStatusChange: (value: string) => void;
  onEdit: (shop: AdminShop) => void;
}) {
  const ordered = [...shops].sort(
    (a, b) => daysRemaining(a.expiresAt) - daysRemaining(b.expiresAt),
  );
  return (
    <div className="central-admin-license-page">
      <div className="central-admin-license-summary">
        <article>
          <span>
            <BadgeCheck size={20} />
          </span>
          <div>
            <strong>
              {persianNumber.format(
                shops.filter((shop) => shop.status === "active").length,
              )}
            </strong>
            <small>اشتراک فعال</small>
          </div>
        </article>
        <article>
          <span>
            <CalendarClock size={20} />
          </span>
          <div>
            <strong>
              {persianNumber.format(
                shops.filter(
                  (shop) =>
                    shop.status === "active" &&
                    daysRemaining(shop.expiresAt) <= 30,
                ).length,
              )}
            </strong>
            <small>نزدیک به انقضا</small>
          </div>
        </article>
        <article>
          <span>
            <AlertTriangle size={20} />
          </span>
          <div>
            <strong>
              {persianNumber.format(
                shops.filter((shop) => shop.status === "expired").length,
              )}
            </strong>
            <small>منقضی‌شده</small>
          </div>
        </article>
      </div>
      <section className="central-admin-panel central-admin-list-panel">
        <div className="central-admin-list-toolbar">
          <div className="central-admin-filter-tabs">
            <button
              type="button"
              className={status === "all" ? "active" : ""}
              onClick={() => onStatusChange("all")}
            >
              همه اشتراک‌ها
            </button>
            <button
              type="button"
              className={status === "active" ? "active" : ""}
              onClick={() => onStatusChange("active")}
            >
              فعال
            </button>
            <button
              type="button"
              className={status === "expired" ? "active" : ""}
              onClick={() => onStatusChange("expired")}
            >
              منقضی
            </button>
          </div>
        </div>
        <div className="central-admin-license-list">
          {ordered.map((shop) => {
            const days = daysRemaining(shop.expiresAt);
            const percentage = Math.max(
              0,
              Math.min(100, ((days + 1) / 365) * 100),
            );
            return (
              <article key={shop.id}>
                <div className="central-admin-license-main">
                  <span>{initials(shop.name)}</span>
                  <div>
                    <strong>{shop.name}</strong>
                    <small>
                      {productLabel(shop.productProfile, shop.plan)} · سقف{" "}
                      {persianNumber.format(shop.maxUsers)} کاربر و{" "}
                      {persianNumber.format(shop.maxBranches)} شعبه
                    </small>
                  </div>
                </div>
                <div className="central-admin-license-progress">
                  <div>
                    <span>اعتبار تا {formatDate(shop.expiresAt)}</span>
                    <b className={days <= 30 ? "warning" : ""}>
                      {days >= 0
                        ? `${persianNumber.format(days)} روز باقی‌مانده`
                        : "اشتراک منقضی شده"}
                    </b>
                  </div>
                  <i>
                    <b style={{ width: `${percentage}%` }} />
                  </i>
                </div>
                <StatusBadge status={shop.status} />
                <button
                  type="button"
                  className="central-admin-row-action"
                  onClick={() => onEdit(shop)}
                >
                  <Edit3 size={16} />
                  مدیریت اشتراک
                </button>
              </article>
            );
          })}
        </div>
        {ordered.length === 0 && (
          <AdminEmpty
            icon={CreditCard}
            title="اشتراکی پیدا نشد"
            description="عبارت جست‌وجو یا فیلتر وضعیت را تغییر دهید."
          />
        )}
      </section>
    </div>
  );
}

type EditableInvoiceItem = SalesInvoiceItem & { enabled: boolean };

function PriceCatalogSection({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [items, setItems] = useState<PriceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<
    Record<number, { unitPrice: string; versionCode: string; effectiveFrom: string }>
  >({});
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadPriceCatalog();
      setItems(result.items);
    } catch (error) {
      notify(errorMessage(error, "بارگذاری کاتالوگ قیمت انجام نشد."));
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const draftFor = (item: PriceCatalogItem) =>
    drafts[item.id] ?? {
      unitPrice: item.unitPrice === null ? "" : String(item.unitPrice),
      versionCode: new Date().toISOString().slice(0, 7),
      effectiveFrom: initialToday,
    };
  const updateDraft = (
    item: PriceCatalogItem,
    patch: Partial<{ unitPrice: string; versionCode: string; effectiveFrom: string }>,
  ) =>
    setDrafts((current) => ({
      ...current,
      [item.id]: { ...draftFor(item), ...patch },
    }));
  const save = async (item: PriceCatalogItem) => {
    const draft = draftFor(item);
    const unitPrice = Number(draft.unitPrice);
    if (!draft.versionCode.trim() || !draft.effectiveFrom || unitPrice < 0) {
      notify("نسخه، تاریخ شروع و قیمت معتبر را وارد کنید.");
      return;
    }
    setSavingId(item.id);
    try {
      const result = await createPriceVersion({
        catalogId: item.id,
        versionCode: draft.versionCode.trim(),
        unitPrice,
        effectiveFrom: draft.effectiveFrom,
      });
      setItems(result.items);
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      notify(`نسخه قیمت ${item.name} ثبت شد.`);
    } catch (error) {
      notify(errorMessage(error, "ثبت نسخه قیمت انجام نشد."));
    } finally {
      setSavingId(null);
    }
  };
  return (
    <section className="central-admin-panel central-admin-list-panel">
      <div className="central-admin-list-toolbar">
        <div>
          <h2>کاتالوگ قیمت نسخه‌دار</h2>
          <p>قیمت جاری این بخش منبع فاکتور فروش است؛ تغییر قیمت، فاکتورهای قبلی را تغییر نمی‌دهد.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={17} className={loading ? "is-spinning" : ""} /> تازه‌سازی
        </button>
      </div>
      <div className="central-admin-table-wrap">
        <table className="central-admin-table">
          <thead><tr><th>محصول / قلم</th><th>دوره</th><th>قیمت جاری</th><th>نسخه جدید</th><th>شروع</th><th>عملیات</th></tr></thead>
          <tbody>{items.map((item) => {
            const draft = draftFor(item);
            return <tr key={item.id}>
              <td><strong>{item.name}</strong><small className="central-admin-cell-note">{item.productKey} · {item.itemType}</small></td>
              <td>{billingPeriodLabels[item.billingPeriod] ?? item.billingPeriod}</td>
              <td><strong>{item.unitPrice === null ? "تعریف نشده" : formatMoney(item.unitPrice)}</strong><small className="central-admin-cell-note">{item.priceVersion ?? "بدون نسخه فعال"}</small></td>
              <td><input dir="ltr" type="number" min={0} step={1000} value={draft.unitPrice} placeholder="مبلغ به ریال" onChange={(event) => updateDraft(item, { unitPrice: event.target.value })} /><input dir="ltr" value={draft.versionCode} aria-label={`نسخه قیمت ${item.name}`} onChange={(event) => updateDraft(item, { versionCode: event.target.value })} /></td>
              <td><input dir="ltr" type="date" value={draft.effectiveFrom} onChange={(event) => updateDraft(item, { effectiveFrom: event.target.value })} /></td>
              <td><button type="button" className="central-admin-row-action" onClick={() => void save(item)} disabled={savingId === item.id}><Save size={16} />{savingId === item.id ? "در حال ثبت" : "ثبت نسخه"}</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!loading && items.length === 0 && <AdminEmpty icon={BadgeCheck} title="کاتالوگ قیمت خالی است" description="Migration نسخه قیمت را بررسی کنید." />}
    </section>
  );
}

function invoiceItemsForShop(shop?: AdminShop): EditableInvoiceItem[] {
  if (!shop) return [];
  return [
    {
      type: "product",
      code: shop.productProfile,
      title: productLabel(shop.productProfile, shop.plan),
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      enabled: true,
    },
    {
      type: "repair_type",
      code: shop.repairType,
      title: `راه‌اندازی و شخصی‌سازی ${repairTypeLabels[shop.repairType] ?? "تعمیرگاه"}`,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      enabled: true,
    },
    ...shop.modules.map((module) => ({
      type: "module" as const,
      code: module,
      title: `ماژول ${moduleLabels[module] ?? module}`,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      enabled: true,
    })),
  ];
}

function SalesSection({
  shops,
  notify,
}: {
  shops: AdminShop[];
  notify: (message: string) => void;
}) {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<SalesInvoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [catalog, setCatalog] = useState<PriceCatalogItem[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!directAdminApiEnabled) {
        setInvoices([]);
        setSummary({ invoices: 0, paid: 0, receivable: 0, overdue: 0 });
      } else {
        const data = await loadSalesInvoices();
        setInvoices(data.invoices);
        setSummary(data.summary);
        setCatalog(data.catalog);
      }
    } catch (error) {
      notify(errorMessage(error, "بارگذاری فاکتورها انجام نشد."));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const saveNew = async (input: Record<string, unknown>) => {
    setSaving(true);
    setCreateError("");
    try {
      if (directAdminApiEnabled) {
        const created = await createSalesInvoice(input);
        const initialPayment = Number(input.paidAmount ?? 0);
        if (initialPayment > 0) {
          await recordSalesPayment({
            invoiceId: created.invoiceId,
            amount: initialPayment,
            method: "other",
            note: "پرداخت اولیه هنگام صدور فاکتور",
            idempotencyKey: `${String(input.idempotencyKey)}-initial-payment`,
          });
        }
      }
      else {
        const shop = shops.find((item) => item.id === Number(input.shopId));
        const subtotal = Number(input.subtotalAmount);
        const discount = Number(input.discountAmount);
        const tax = Number(input.taxAmount);
        const total = subtotal - discount + tax;
        const paid = Number(input.paidAmount);
        setInvoices((current) => [
          {
            id: Math.max(0, ...current.map((item) => item.id)) + 1,
            publicId: `INVOICE-${Date.now()}`,
            invoiceNumber: `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.floor(100000 + Math.random() * 900000)}`,
            shopId: Number(input.shopId),
            shopName: shop?.name ?? "خریدار",
            shopCode: shop?.code ?? "",
            plan: shop?.plan ?? "light",
            repairType: shop?.repairType ?? "generic",
            modules: shop?.modules ?? [],
            items: input.items as SalesInvoiceItem[],
            billingPeriod: String(input.billingPeriod),
            issueDate: String(input.issueDate),
            dueDate: String(input.dueDate),
            periodStart: String(input.periodStart),
            periodEnd: String(input.periodEnd),
            description: String(input.description),
            subtotalAmount: subtotal,
            discountAmount: discount,
            taxAmount: tax,
            totalAmount: total,
            paidAmount: paid,
            status:
              paid >= total
                ? "paid"
                : paid > 0
                  ? "partial"
                  : String(input.status),
            notes: String(input.notes ?? ""),
            createdBy: "مدیر سامانه",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ]);
      }
      setCreateOpen(false);
      if (directAdminApiEnabled) await refresh();
      notify("فاکتور فروش با موفقیت ثبت شد.");
    } catch (error) {
      setCreateError(errorMessage(error, "ثبت فاکتور انجام نشد."));
    } finally {
      setSaving(false);
    }
  };

  const saveChanges = async (input: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    try {
      if (directAdminApiEnabled) {
        const nextPaid = Number(input.paidAmount ?? selected.paidAmount);
        const delta = nextPaid - selected.paidAmount;
        if (delta < 0)
          throw new FollowUpApiError(
            "پرداخت ثبت‌شده قابل کاهش یا حذف نیست؛ برای اصلاح باید سند برگشتی ثبت شود.",
          );
        if (delta > 0)
          await recordSalesPayment({
            invoiceId: selected.id,
            amount: delta,
            method: String(input.paymentMethod ?? "other"),
            reference: String(input.paymentReference ?? ""),
            note: String(input.paymentNote ?? ""),
            idempotencyKey:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          });
        if (input.retryProvisioning === true)
          await retrySalesProvisioning(selected.id);
      }
      else
        setInvoices((current) =>
          current.map((invoice) =>
            invoice.id === selected.id
              ? {
                  ...invoice,
                  ...input,
                  paidAmount: Number(input.paidAmount),
                  status: String(input.status),
                  dueDate: String(input.dueDate),
                  notes: String(input.notes),
                }
              : invoice,
          ),
        );
      setSelected(null);
      if (directAdminApiEnabled) await refresh();
      notify("وضعیت مالی فاکتور ذخیره شد.");
    } catch (error) {
      notify(errorMessage(error, "به‌روزرسانی فاکتور انجام نشد."));
    } finally {
      setSaving(false);
    }
  };

  const normalized = query.trim().toLocaleLowerCase("fa");
  const filtered = invoices.filter((invoice) => {
    const matchesQuery =
      !normalized ||
      `${invoice.shopName} ${invoice.invoiceNumber} ${invoice.description}`
        .toLocaleLowerCase("fa")
        .includes(normalized);
    return matchesQuery && (status === "all" || invoice.status === status);
  });
  const cards = [
    {
      label: "فاکتورهای صادرشده",
      value: persianNumber.format(summary.invoices ?? invoices.length),
      icon: ReceiptText,
      tone: "teal",
    },
    {
      label: "دریافت‌شده",
      value: formatMoney(
        summary.paid ??
          invoices.reduce((sum, item) => sum + item.paidAmount, 0),
      ),
      icon: BadgeCheck,
      tone: "blue",
    },
    {
      label: "مطالبات باقی‌مانده",
      value: formatMoney(
        summary.receivable ??
          invoices.reduce(
            (sum, item) =>
              sum + Math.max(0, item.totalAmount - item.paidAmount),
            0,
          ),
      ),
      icon: CreditCard,
      tone: "amber",
    },
    {
      label: "فاکتورهای سررسیدگذشته",
      value: persianNumber.format(summary.overdue ?? 0),
      icon: AlertTriangle,
      tone: "coral",
    },
  ];

  return (
    <div className="central-admin-sales-page">
      <div className="central-admin-sales-summary">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={`tone-${card.tone}`}>
              <span>
                <Icon size={20} />
              </span>
              <div>
                <small>{card.label}</small>
                <strong>{card.value}</strong>
              </div>
            </article>
          );
        })}
      </div>
      <section className="central-admin-panel central-admin-list-panel">
        <div className="central-admin-list-toolbar">
          <div className="central-admin-sales-filters">
            <label className="central-admin-ticket-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جست‌وجوی خریدار یا شماره فاکتور"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="draft">پیش‌نویس</option>
              <option value="issued">صادرشده</option>
              <option value="partial">پرداخت ناقص</option>
              <option value="paid">تسویه‌شده</option>
              <option value="cancelled">باطل‌شده</option>
            </select>
          </div>
          <button
            type="button"
            className="central-admin-primary"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
          >
            <Plus size={17} />
            ثبت فاکتور فروش
          </button>
        </div>
        <div className="central-admin-table-wrap">
          <table className="central-admin-table">
            <thead>
              <tr>
                <th>شماره و خریدار</th>
                <th>نوع و خدمات</th>
                <th>مبلغ نهایی</th>
                <th>پرداخت‌شده</th>
                <th>سررسید</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <strong>
                      فاکتور {toPersianDigits(invoice.invoiceNumber)}
                    </strong>
                    <small className="central-admin-cell-note">
                      {invoice.shopName}
                    </small>
                  </td>
                  <td>
                    <strong>
                      {repairTypeLabels[invoice.repairType] ?? "تعمیرگاه"}
                    </strong>
                    <small className="central-admin-cell-note">
                      {productLabel(invoice.productProfile, invoice.plan)} ·{" "}
                      {persianNumber.format(invoice.modules.length)} قابلیت ·{" "}
                      {billingPeriodLabels[invoice.billingPeriod] ??
                        "بازه سفارشی"}
                    </small>
                  </td>
                  <td>
                    <strong>{formatMoney(invoice.totalAmount)}</strong>
                    {invoice.discountAmount > 0 && (
                      <small className="central-admin-cell-note">
                        {formatMoney(invoice.discountAmount)} تخفیف
                      </small>
                    )}
                  </td>
                  <td>
                    <strong>{formatMoney(invoice.paidAmount)}</strong>
                    <small className="central-admin-cell-note">
                      مانده:{" "}
                      {formatMoney(
                        Math.max(0, invoice.totalAmount - invoice.paidAmount),
                      )}
                    </small>
                  </td>
                  <td>
                    <strong>{formatDate(invoice.dueDate)}</strong>
                    <small
                      className={`central-admin-cell-note ${daysRemaining(invoice.dueDate) < 0 && !["paid", "cancelled"].includes(invoice.status) ? "is-warning" : ""}`}
                    >
                      {formatDate(invoice.issueDate)} صادر شده
                    </small>
                  </td>
                  <td>
                    <span
                      className={`central-admin-status invoice-${invoice.status}`}
                    >
                      <i />
                      {invoiceStatusLabels[invoice.status] ?? "نامشخص"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="central-admin-row-action"
                      onClick={() => setSelected(invoice)}
                    >
                      <ReceiptText size={16} />
                      مشاهده
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="central-admin-inline-loading">
            <RefreshCw size={18} className="is-spinning" />
            در حال دریافت فاکتورها...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <AdminEmpty
            icon={ReceiptText}
            title="فاکتوری پیدا نشد"
            description="فاکتور جدیدی ثبت کنید یا فیلترها را تغییر دهید."
          />
        )}
      </section>
      {createOpen && (
        <AdminModal
          title="ثبت فاکتور فروش"
          subtitle="محصول Solo یا Pro و افزونه‌های فعال‌شونده را شفاف ثبت کنید."
          onClose={() => setCreateOpen(false)}
        >
          <InvoiceCatalogForm
            shops={shops}
            catalog={catalog}
            saving={saving}
            serverError={createError}
            onCancel={() => setCreateOpen(false)}
            onSave={(input) => void saveNew(input)}
          />
        </AdminModal>
      )}
      {selected && (
        <AdminModal
          title={`فاکتور ${toPersianDigits(selected.invoiceNumber)}`}
          subtitle="مشاهده، چاپ و ثبت وضعیت پرداخت فاکتور"
          onClose={() => setSelected(null)}
        >
          <InvoiceDetails
            invoice={selected}
            saving={saving}
            onCancel={() => setSelected(null)}
            onSave={(input) => void saveChanges(input)}
          />
        </AdminModal>
      )}
    </div>
  );
}

function InvoiceCatalogForm({
  shops,
  catalog,
  saving,
  serverError,
  onCancel,
  onSave,
}: {
  shops: AdminShop[];
  catalog: PriceCatalogItem[];
  saving: boolean;
  serverError?: string;
  onCancel: () => void;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const initialShop = shops[0];
  const idempotencyKey = React.useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sales-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [form, setForm] = useState({
    shopId: initialShop?.id ?? 0,
    operationType: "new_sale",
    productProfile: initialShop?.productProfile ?? "solo",
    billingPeriod: "annual",
    issueDate: initialToday,
    dueDate: initialDueDate,
    periodStart: initialToday,
    periodEnd: initialYearEnd,
    status: "draft",
    discountAmount: 0,
    discountReason: "",
    discountManagerApproved: false,
    description: "",
    internalNotes: "",
  });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState("");
  const selectedShop =
    shops.find((shop) => shop.id === form.shopId) ?? initialShop;
  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const catalogFor = (key: string) =>
    catalog.find(
      (item) =>
        item.productKey === key && item.billingPeriod === form.billingPeriod,
    ) ?? catalog.find(
      (item) => item.productKey === key && item.billingPeriod === "annual",
    );
  const productItem = catalogFor(`tamiran_${form.productProfile}`);
  const addonItems = catalog.filter(
    (item, index, all) =>
      item.itemType !== "product" &&
      (form.productProfile === "pro" ||
        ![
          "inventory_pro",
          "multi_branch",
          "extra_user",
          "extra_branch",
          "advanced_analytics",
          "accounting_integration",
        ].includes(item.productKey)) &&
      (item.billingPeriod === form.billingPeriod ||
        item.billingPeriod === "annual" ||
        item.billingPeriod === "one_time") &&
      all.findIndex((candidate) => candidate.productKey === item.productKey) ===
        index,
  );
  const selectedAddons = addonItems
    .filter((item) => (quantities[item.productKey] ?? 0) > 0)
    .map((item) => ({ item, quantity: quantities[item.productKey] }));
  const lines = [
    ...(productItem ? [{ item: productItem, quantity: 1 }] : []),
    ...selectedAddons,
  ];
  const subtotal = lines.reduce(
    (sum, line) => sum + (line.item.unitPrice ?? 0) * line.quantity,
    0,
  );
  const taxTotal = lines.reduce(
    (sum, line) =>
      sum +
      Math.round(
        (line.item.unitPrice ?? 0) *
          line.quantity *
          (line.item.taxRate ?? 0) /
          100,
      ),
    0,
  );
  const total = Math.max(0, subtotal - form.discountAmount + taxTotal);
  const missingPrices = lines.filter((line) => line.item.unitPrice === null);
  const entitlement = lines.reduce(
    (result, line) => {
      const effect = line.item.entitlementEffect ?? {};
      if (effect.product_profile === "solo" || effect.product_profile === "pro")
        result.product = effect.product_profile;
      if (typeof effect.users_included === "number")
        result.users = effect.users_included;
      if (typeof effect.branches_included === "number")
        result.branches = effect.branches_included;
      if (typeof effect.users_limit_delta === "number")
        result.users += effect.users_limit_delta * line.quantity;
      if (typeof effect.branches_limit_delta === "number")
        result.branches += effect.branches_limit_delta * line.quantity;
      if (typeof effect.module === "string") result.modules.push(effect.module);
      return result;
    },
    {
      product: form.productProfile,
      users: selectedShop?.maxUsers ?? 1,
      branches: selectedShop?.maxBranches ?? 1,
      modules: [...(selectedShop?.modules ?? ["repair"])],
    },
  );
  const changePeriod = (period: string) => {
    update("billingPeriod", period);
    setQuantities({});
    if (period !== "custom")
      update(
        "periodEnd",
        addPersianMonths(
          form.periodStart,
          ({ monthly: 1, quarterly: 3, semiannual: 6, annual: 12 } as Record<string, number>)[period],
          true,
        ),
      );
  };
  if (!initialShop)
    return (
      <AdminEmpty
        icon={Store}
        title="هنوز تعمیرگاهی ثبت نشده است"
        description="ابتدا تعمیرگاه خریدار را ایجاد کنید."
      />
    );
  return (
    <form
      className="central-admin-form invoice-builder-v2"
      onSubmit={(event) => {
        event.preventDefault();
        const submitMode =
          ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)
            ?.value ?? "draft";
        let error = "";
        if (!productItem) error = "محصول انتخاب‌شده در کاتالوگ قیمت تعریف نشده است.";
        else if (missingPrices.length)
          error = `برای ${missingPrices.map((line) => line.item.name).join("، ")} نسخه قیمت فعال ثبت نشده است.`;
        else if (form.discountAmount > subtotal)
          error = "تخفیف نمی‌تواند از جمع اقلام بیشتر باشد.";
        else if (form.discountAmount > 0 && !form.discountReason.trim())
          error = "ثبت دلیل تخفیف الزامی است.";
        else if (subtotal > 0 && form.discountAmount / subtotal > 0.2 && !form.discountManagerApproved)
          error = "تخفیف بیش از ۲۰٪ نیازمند تأیید صریح مدیر است.";
        if (error) return setFormError(error);
        setFormError("");
        onSave({
          ...form,
          status: submitMode === "draft" ? "draft" : "issued",
          provisionNow: submitMode === "activate",
          idempotencyKey: idempotencyKey.current,
          items: lines.map(({ item, quantity }) => ({
            type: item.itemType,
            code: item.productKey,
            productKey: item.productKey,
            title: item.name,
            quantity,
            unitPrice: item.unitPrice,
            totalPrice: (item.unitPrice ?? 0) * quantity,
          })),
        });
      }}
    >
      {(formError || serverError) && (
        <div className="form-error-summary" role="alert">
          <AlertTriangle size={19} />
          <div><strong>فاکتور هنوز ثبت نشده است</strong><p>{formError || serverError}</p></div>
        </div>
      )}
      <fieldset>
        <legend><Building2 size={18} /> خریدار و نوع عملیات</legend>
        <div className="central-admin-form-grid">
          <label><span>تعمیرگاه خریدار</span><select value={form.shopId} onChange={(event) => {
            const shopId = Number(event.target.value);
            const shop = shops.find((candidate) => candidate.id === shopId);
            setForm((current) => ({ ...current, shopId, productProfile: shop?.productProfile ?? "solo" }));
            setQuantities({});
          }}>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
          <label><span>نوع عملیات</span><select value={form.operationType} onChange={(event) => {
            const operationType = event.target.value;
            setForm((current) => ({ ...current, operationType, ...(operationType === "upgrade" ? { productProfile: "pro" } : {}) }));
            setQuantities({});
          }}>
            <option value="new_sale">فروش جدید</option><option value="renewal">تمدید</option>
            <option value="upgrade">ارتقا Solo به Pro</option><option value="add_module">افزودن ماژول</option>
            <option value="increase_capacity">افزایش ظرفیت</option><option value="renewal_product_change">تمدید و تغییر محصول</option>
            <option value="contract_correction">اصلاح قرارداد</option>
          </select></label>
          <label><span>محصول فعلی</span><input readOnly value={selectedShop?.productProfile === "pro" ? "Tamiran Pro" : "Tamiran Solo"} /></label>
          <label><span>دوره سرویس</span><select value={form.billingPeriod} onChange={(event) => changePeriod(event.target.value)}>
            <option value="monthly">ماهانه</option><option value="quarterly">سه‌ماهه</option><option value="semiannual">شش‌ماهه</option><option value="annual">سالانه</option><option value="custom">سفارشی</option>
          </select></label>
        </div>
        <div className="product-choice-grid">
          {(["solo", "pro"] as const).map((product) => <button key={product} type="button" className={form.productProfile === product ? "selected" : ""} onClick={() => update("productProfile", product)}>
            <strong>Tamiran {product === "solo" ? "Solo" : "Pro"}</strong>
            <small>{catalogFor(`tamiran_${product}`)?.unitPrice === null ? "قیمت تعریف نشده" : formatMoney(catalogFor(`tamiran_${product}`)?.unitPrice ?? 0)}</small>
          </button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend><ReceiptText size={18} /> اقلام فاکتور</legend>
        <div className="central-admin-invoice-items">
          <header><span>شرح</span><span>تعداد</span><span>قیمت کاتالوگ</span></header>
          {productItem && <div className="is-enabled"><strong>{productItem.name}<small>نسخه {productItem.priceVersion ?? "بدون قیمت"}</small></strong><b>۱</b><span>{productItem.unitPrice === null ? "تعریف نشده" : formatMoney(productItem.unitPrice)}</span></div>}
          {addonItems.map((item) => {
            const quantity = quantities[item.productKey] ?? 0;
            return <div key={item.productKey} className={quantity > 0 ? "is-enabled" : ""}>
              <label className="central-admin-invoice-item-check"><input type="checkbox" checked={quantity > 0} onChange={(event) => setQuantities((current) => ({ ...current, [item.productKey]: event.target.checked ? 1 : 0 }))} /><i /><span>{item.name}</span></label>
              <input dir="ltr" type="number" min={1} max={1000} value={Math.max(1, quantity)} disabled={quantity < 1} onChange={(event) => setQuantities((current) => ({ ...current, [item.productKey]: Math.max(1, Number(event.target.value)) }))} aria-label={`تعداد ${item.name}`} />
              <span>{item.unitPrice === null ? "قیمت تعریف نشده" : formatMoney(item.unitPrice)}</span>
            </div>;
          })}
        </div>
        <p className="central-admin-invoice-items-help">قیمت‌ها فقط از کاتالوگ نسخه‌دار خوانده می‌شوند و در این فرم قابل تغییر نیستند.</p>
      </fieldset>
      <fieldset>
        <legend><BadgeCheck size={18} /> نتیجه Entitlement</legend>
        <div className="central-admin-sales-summary entitlement-preview">
          <article><small>محصول</small><strong>Tamiran {entitlement.product === "pro" ? "Pro" : "Solo"}</strong></article>
          <article><small>کاربران</small><strong>{persianNumber.format(entitlement.users)}</strong></article>
          <article><small>شعب</small><strong>{persianNumber.format(entitlement.branches)}</strong></article>
          <article><small>ماژول‌ها</small><strong>{entitlement.modules.length ? entitlement.modules.map((key) => moduleLabels[key] ?? key).join("، ") : "بدون افزونه"}</strong></article>
        </div>
      </fieldset>
      <fieldset>
        <legend><CalendarClock size={18} /> دوره خدمت</legend>
        <div className="central-admin-form-grid">
          <div className="central-admin-date-field"><span>تاریخ صدور</span><PersianDatePicker value={form.issueDate} onChange={(value) => update("issueDate", value)} required ariaLabel="تاریخ صدور" /></div>
          <div className="central-admin-date-field"><span>سررسید</span><PersianDatePicker value={form.dueDate} onChange={(value) => update("dueDate", value)} required ariaLabel="سررسید" /></div>
          <div className="central-admin-date-field"><span>شروع سرویس</span><PersianDatePicker value={form.periodStart} onChange={(value) => update("periodStart", value)} required ariaLabel="شروع سرویس" /></div>
          <div className="central-admin-date-field"><span>پایان سرویس</span><PersianDatePicker value={form.periodEnd} onChange={(value) => update("periodEnd", value)} required ariaLabel="پایان سرویس" /></div>
        </div>
      </fieldset>
      <fieldset>
        <legend><CreditCard size={18} /> خلاصه مالی</legend>
        <div className="central-admin-form-grid">
          <label><span>جمع اقلام</span><input readOnly value={formatMoney(subtotal)} /></label>
          <label><span>مالیات محاسبه‌شده</span><input readOnly value={formatMoney(taxTotal)} /></label>
          <label><span>تخفیف فاکتور</span><input dir="ltr" type="number" min={0} max={subtotal} value={form.discountAmount} onChange={(event) => update("discountAmount", Number(event.target.value))} /></label>
          {form.discountAmount > 0 && <label><span>دلیل تخفیف</span><input value={form.discountReason} onChange={(event) => update("discountReason", event.target.value)} required /></label>}
          {subtotal > 0 && form.discountAmount / subtotal > 0.2 && <label className="central-admin-switch-field"><span>تأیید تخفیف حساس</span><button type="button" className={form.discountManagerApproved ? "active" : ""} onClick={() => update("discountManagerApproved", !form.discountManagerApproved)}><i /><strong>{form.discountManagerApproved ? "تأیید مدیر ثبت شد" : "نیازمند تأیید مدیر"}</strong><small>این تأیید همراه با دلیل و نام مدیر در Audit ثبت می‌شود.</small></button></label>}
          <label><span>وضعیت پرداخت</span><input readOnly value="بدون پرداخت ثبت‌شده" /></label>
          <label className="wide"><span>توضیحات فاکتور (قابل مشاهده مشتری)</span><textarea rows={2} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          <label className="wide"><span>یادداشت داخلی</span><textarea rows={2} value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></label>
        </div>
        <div className="central-admin-invoice-total"><span>مبلغ نهایی</span><strong>{formatMoney(total)}</strong></div>
      </fieldset>
      <div className="central-admin-form-actions">
        <button type="button" onClick={onCancel}>انصراف</button>
        <button type="submit" name="submitMode" value="draft" disabled={saving || !productItem || missingPrices.length > 0 || total < 1}>ذخیره پیش‌نویس</button>
        <button type="submit" name="submitMode" value="issue" className="central-admin-primary" disabled={saving || !productItem || missingPrices.length > 0 || total < 1}>صدور فاکتور</button>
        <button type="submit" name="submitMode" value="activate" className="central-admin-primary" disabled={saving || !productItem || missingPrices.length > 0 || total < 1}><Save size={17} />{saving ? "در حال اجرا..." : "صدور و فعال‌سازی"}</button>
      </div>
    </form>
  );
}


function InvoiceDetails({
  invoice,
  saving,
  onCancel,
  onSave,
}: {
  invoice: SalesInvoice;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [paidAmount, setPaidAmount] = useState(invoice.paidAmount);
  const [status, setStatus] = useState(invoice.status);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [notes, setNotes] = useState(invoice.notes);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  return (
    <div className="central-admin-invoice-view">
      <InvoiceDocument
        invoice={{ ...invoice, paidAmount, status, dueDate, notes }}
      />
      <section className="central-admin-invoice-controls">
        <h3>پرداخت‌ها و فعال‌سازی محصول</h3>
        <p>
          وضعیت فاکتور: {invoiceStatusLabels[invoice.status] ?? invoice.status} · وضعیت اعمال محصول: {invoice.provisioningStatus ?? "ثبت‌نشده"}
        </p>
        <div className="central-admin-form-grid">
          <label>
            <span>جمع پرداخت پس از ثبت جدید</span>
            <input
              dir="ltr"
              type="number"
              min={0}
              max={invoice.totalAmount}
              value={paidAmount}
              onChange={(event) => setPaidAmount(Number(event.target.value))}
            />
          </label>
          <label>
            <span>روش پرداخت جدید</span>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="cash">نقد</option>
              <option value="bank_transfer">انتقال بانکی</option>
              <option value="pos">کارت‌خوان</option>
              <option value="online_gateway">درگاه آنلاین</option>
              <option value="other">سایر</option>
            </select>
          </label>
          <label>
            <span>شماره مرجع پرداخت</span>
            <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
          </label>
          <label>
            <span>وضعیت</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="issued">صادرشده</option>
              <option value="partial">پرداخت ناقص</option>
              <option value="paid">تسویه‌شده</option>
              <option value="cancelled">باطل‌شده</option>
            </select>
          </label>
          <div className="central-admin-date-field">
            <span>تاریخ سررسید</span>
            <PersianDatePicker
              value={dueDate}
              onChange={setDueDate}
              required
              ariaLabel="انتخاب تاریخ سررسید فاکتور"
            />
          </div>
          <label className="wide">
            <span>یادداشت داخلی</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
      </section>
      <div className="central-admin-form-actions">
        <button type="button" onClick={onCancel}>
          بستن
        </button>
        <button type="button" onClick={() => window.print()}>
          <Printer size={17} />
          چاپ فاکتور
        </button>
        <button
          type="button"
          className="central-admin-primary"
          disabled={saving}
          onClick={() =>
            onSave({
              paidAmount,
              status,
              dueDate,
              notes,
              paymentMethod,
              paymentReference,
            })
          }
        >
          <Save size={17} />
          {saving ? "در حال ثبت..." : "ثبت پرداخت"}
        </button>
        {invoice.provisioningStatus === "failed" && (
          <button
            type="button"
            className="central-admin-primary"
            disabled={saving}
            onClick={() =>
              onSave({
                paidAmount,
                paymentMethod,
                paymentReference,
                retryProvisioning: true,
              })
            }
          >
            <RotateCcw size={17} />
            تلاش دوباره برای فعال‌سازی
          </button>
        )}
      </div>
    </div>
  );
}

function InvoiceDocument({ invoice }: { invoice: SalesInvoice }) {
  const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const displayItems =
    invoice.items.length > 0
      ? invoice.items
      : [
          {
            type: "plan" as const,
            code: invoice.plan,
            title: invoice.description,
            quantity: 1,
            unitPrice: invoice.subtotalAmount,
            totalPrice: invoice.subtotalAmount,
          },
        ];
  return (
    <article className="central-admin-invoice-document">
      <header>
        <div className="central-admin-invoice-brand">
          <span>
            <Wrench size={23} />
          </span>
          <div>
            <strong>تعمیران</strong>
            <small>سامانه مدیریت تعمیرگاه</small>
          </div>
        </div>
        <div>
          <span>فاکتور فروش</span>
          <strong>{toPersianDigits(invoice.invoiceNumber)}</strong>
          <small>تاریخ صدور: {formatDate(invoice.issueDate)}</small>
        </div>
      </header>
      <section className="central-admin-invoice-parties">
        <div>
          <span>خریدار</span>
          <strong>{invoice.shopName}</strong>
          <small>
            کد تعمیرگاه: <b dir="ltr">{invoice.shopCode}</b> · نوع:{" "}
            {repairTypeLabels[invoice.repairType] ?? "تعمیرگاه"}
          </small>
          <small>
            محصول {productLabel(invoice.productProfile, invoice.plan)} · قابلیت‌ها:{" "}
            {invoice.modules
              .map((module) => moduleLabels[module] ?? module)
              .join("، ") || "بدون ماژول افزوده"}
          </small>
        </div>
        <div>
          <span>فروشنده</span>
          <strong>سامانه تعمیران</strong>
          <small>خدمات نرم‌افزاری مدیریت تعمیرگاه</small>
          <small>
            {billingPeriodLabels[invoice.billingPeriod] ?? "بازه سفارشی"}:{" "}
            {formatDate(invoice.periodStart)} تا {formatDate(invoice.periodEnd)}
          </small>
        </div>
      </section>
      <table>
        <thead>
          <tr>
            <th>شرح ردیف</th>
            <th>دسته</th>
            <th>تعداد</th>
            <th>مبلغ واحد</th>
            <th>جمع ردیف</th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item, index) => (
            <tr key={`${item.type}-${item.code}-${index}`}>
              <td>{item.title}</td>
              <td>{invoiceItemTypeLabels[item.type] ?? "خدمت"}</td>
              <td>{persianNumber.format(item.quantity)}</td>
              <td>{formatMoney(item.unitPrice)}</td>
              <td>{formatMoney(item.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="central-admin-invoice-totals">
        <div>
          <span>جمع ردیف‌ها</span>
          <strong>{formatMoney(invoice.subtotalAmount)}</strong>
        </div>
        <div>
          <span>تخفیف</span>
          <strong>{formatMoney(invoice.discountAmount)}</strong>
        </div>
        <div>
          <span>مالیات</span>
          <strong>{formatMoney(invoice.taxAmount)}</strong>
        </div>
        <div className="grand">
          <span>مبلغ نهایی</span>
          <strong>{formatMoney(invoice.totalAmount)}</strong>
        </div>
        <div>
          <span>پرداخت‌شده</span>
          <strong>{formatMoney(invoice.paidAmount)}</strong>
        </div>
        <div className={remaining > 0 ? "remaining" : "paid"}>
          <span>مانده</span>
          <strong>{formatMoney(remaining)}</strong>
        </div>
      </section>
      <footer>
        <div>
          <strong>
            وضعیت: {invoiceStatusLabels[invoice.status] ?? "نامشخص"}
          </strong>
          <span>سررسید پرداخت: {formatDate(invoice.dueDate)}</span>
          {invoice.notes && <small>{invoice.notes}</small>}
        </div>
        <div>
          <span>مهر و امضای فروشنده</span>
          <i />
        </div>
      </footer>
    </article>
  );
}

function ProductChangeFlow({
  shop,
  onCancel,
  onCompleted,
}: {
  shop: AdminShop;
  onCancel: () => void;
  onCompleted: () => Promise<void>;
}) {
  const target = shop.productProfile === "solo" ? "pro" : "solo";
  const [check, setCheck] = useState<ProductChangeCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [qcMode, setQcMode] = useState("independent");
  const [setupStep, setSetupStep] = useState(1);
  const [assignmentMode, setAssignmentMode] = useState("manual");
  const [approvalPolicy, setApprovalPolicy] = useState("threshold");
  const [error, setError] = useState("");
  const idempotency = React.useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `product-change-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const loadCheck = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCheck(await checkProductChange(shop.id, target));
    } catch (cause) {
      setError(errorMessage(cause, "پیش‌بررسی تغییر محصول انجام نشد."));
    } finally {
      setLoading(false);
    }
  }, [shop.id, target]);

  useEffect(() => {
    void loadCheck();
  }, [loadCheck]);

  const submit = async () => {
    if (!check?.allowed || !reason.trim()) {
      setError("علت تغییر محصول را ثبت کنید و موانع پیش‌بررسی را برطرف کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await executeProductChange({
        shopId: shop.id,
        targetProduct: target,
        idempotencyKey: idempotency.current,
        reason: reason.trim(),
        settings:
          target === "pro"
            ? { qcMode, assignmentMode, customerApprovalPolicy: approvalPolicy }
            : {},
      });
      await onCompleted();
    } catch (cause) {
      setError(errorMessage(cause, "تغییر محصول تکمیل نشد."));
      await loadCheck();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="product-change-flow">
      {error && (
        <div className="form-error-summary" role="alert">
          <AlertTriangle size={19} />
          <div><strong>عملیات تکمیل نشد</strong><p>{error}</p></div>
        </div>
      )}
      {loading && !check ? (
        <div className="central-admin-inline-loading">
          <RefreshCw size={18} className="is-spinning" />
          در حال اجرای پیش‌بررسی…
        </div>
      ) : check ? (
        <>
          <section className={`product-change-state ${check.allowed ? "ready" : "blocked"}`}>
            <strong>{check.allowed ? "آماده تغییر محصول" : "تغییر محصول فعلاً مسدود است"}</strong>
            <small>
              {productLabel(check.currentProduct)} → {productLabel(check.targetProduct)}
            </small>
          </section>
          <div className="product-impact-grid">
            <div><span>پرونده باز</span><strong>{persianNumber.format(check.impact.openCases)}</strong></div>
            <div><span>کاربر فعال</span><strong>{persianNumber.format(check.impact.users)}</strong></div>
            <div><span>شعبه فعال</span><strong>{persianNumber.format(check.impact.branches)}</strong></div>
            <div><span>وضعیت انبار</span><strong>{check.impact.inventoryState}</strong></div>
          </div>
          {check.blockers.length > 0 && (
            <section className="product-change-list blockers">
              <strong>موانع</strong>
              {check.blockers.map((item) => (
                <article key={item.code}>
                  <AlertTriangle size={17} />
                  <div><b>{item.message}</b>{item.action && <small>{item.action}</small>}</div>
                </article>
              ))}
            </section>
          )}
          {check.warnings.length > 0 && (
            <section className="product-change-list warnings">
              <strong>نکات اثر تغییر</strong>
              {check.warnings.map((item) => <p key={item.code}>{item.message}</p>)}
            </section>
          )}
          <section className="product-preservation-note">
            <ShieldCheck size={20} />
            <div>
              <strong>داده و شناسه‌ها حفظ می‌شوند</strong>
              <p>کد عمومی، توالی قبض، مشتری‌ها، دستگاه‌ها، پرونده‌ها، مالی، فایل‌ها و پرتال بدون جابه‌جایی باقی می‌مانند. افزونه‌ها نیز خودکار فعال نمی‌شوند.</p>
            </div>
          </section>
          {target === "pro" ? (
            <section className="product-upgrade-wizard">
              <div className="compact-tabs" role="tablist" aria-label="راه‌اندازی Pro">
                {["کاربران و نقش‌ها", "Workflow و QC", "ماژول‌ها"].map((label, index) => (
                  <button key={label} type="button" className={setupStep === index + 1 ? "active" : ""} onClick={() => setSetupStep(index + 1)}>
                    {toPersianDigits(index + 1)}. {label}
                  </button>
                ))}
              </div>
              {setupStep === 1 && (
                <div className="product-preservation-note">
                  <UsersRound size={20} />
                  <div><strong>کاربران فعلی حفظ می‌شوند</strong><p>کاربر فعلی Owner / Admin باقی می‌ماند. نقش‌های Reception، Technician، QC، Finance، Warehouse و Repair Manager بعداً و بدون اجبار قابل تخصیص هستند.</p></div>
                </div>
              )}
              {setupStep === 2 && (
                <div className="central-admin-form-grid">
                  <label><span>قانون تخصیص پرونده جدید</span><select value={assignmentMode} onChange={(event) => setAssignmentMode(event.target.value)}><option value="manual">تخصیص دستی</option><option value="default">تکنسین پیش‌فرض</option><option value="auto">تخصیص خودکار</option></select></label>
                  <label><span>حالت QC پرونده‌های جدید</span><select value={qcMode} onChange={(event) => setQcMode(event.target.value)}><option value="off">خاموش</option><option value="simple">کنترل توسط تعمیرکار</option><option value="independent">QC مستقل</option></select></label>
                  <label><span>سیاست تأیید مشتری</span><select value={approvalPolicy} onChange={(event) => setApprovalPolicy(event.target.value)}><option value="threshold">بر اساس سقف مبلغ</option><option value="always">همیشه الزامی</option><option value="manual">تصمیم مدیر</option></select></label>
                </div>
              )}
              {setupStep === 3 && (
                <div className="product-impact-grid">
                  <div><span>Customer Portal</span><strong>فعال فعلی</strong></div>
                  <div><span>Inventory Pro</span><strong>افزونه مستقل</strong></div>
                  <div><span>Warranty</span><strong>افزونه مستقل</strong></div>
                  <div><span>Multi Branch</span><strong>افزونه مستقل</strong></div>
                </div>
              )}
              <div className="central-admin-form-actions">
                <button type="button" disabled={setupStep === 1} onClick={() => setSetupStep((current) => Math.max(1, current - 1))}>مرحله قبل</button>
                <button type="button" disabled={setupStep === 3} onClick={() => setSetupStep((current) => Math.min(3, current + 1))}>مرحله بعد</button>
              </div>
            </section>
          ) : null}
          {(target === "solo" || setupStep === 3) && (
            <label className="field-block">
              <span>علت تغییر محصول <b>*</b></span>
              <textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
          )}
        </>
      ) : null}
      <div className="central-admin-form-actions">
        <button type="button" onClick={onCancel}>انصراف</button>
        <button type="button" className="central-admin-primary" disabled={saving || loading || !check?.allowed || (target === "pro" && setupStep !== 3)} onClick={() => void submit()}>
          <ArrowLeftRight size={17} />
          {saving ? "در حال اجرا…" : target === "pro" ? "تأیید ارتقا به Pro" : "تأیید تغییر به Solo"}
        </button>
      </div>
    </div>
  );
}

function ShopFormV4({
  shop,
  moduleChanges = [],
  saving,
  serverError,
  onCancel,
  onSave,
}: {
  shop?: AdminShop;
  moduleChanges?: ModuleChangeRecord[];
  saving: boolean;
  serverError?: string;
  onCancel: () => void;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const editing = Boolean(shop);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({
    name: shop?.name ?? "",
    repairType: shop?.repairType ?? "digital",
    productProfile: shop?.productProfile ?? "solo",
    expiresAt: shop?.expiresAt ?? initialYearEnd,
    status: shop?.lifecycleStatus ?? "active",
    maxUsers: shop?.productProfile === "solo" ? 1 : (shop?.maxUsers ?? 10),
    maxBranches: shop?.productProfile === "solo" ? 1 : (shop?.maxBranches ?? 1),
    inventoryMode: shop?.inventoryMode ?? "off",
    qcMode: shop?.qcMode ?? (shop?.productProfile === "pro" ? "independent" : "off"),
    allowSelfQc: false,
    allowDeliveryWithBalance: false,
    nationalCodeRequired: shop?.nationalCodeRequired ?? false,
    productChangeReason: "",
    managerName: "",
    managerMobile: "",
    managerEmail: "",
  });
  const [formError, setFormError] = useState("");
  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const productChanged =
    editing && form.productProfile !== shop?.productProfile;
  const productTitle =
    form.productProfile === "solo" ? "تعمیران Solo" : "تعمیران Pro";
  const activeModules = shop?.modules ?? ["repair"];
  const chooseProduct = (productProfile: "solo" | "pro") =>
    setForm((current) => ({
      ...current,
      productProfile,
      maxUsers: productProfile === "solo" ? 1 : 10,
      maxBranches:
        productProfile === "solo" ? 1 : Math.max(1, current.maxBranches),
      inventoryMode:
        productProfile === "solo" && current.inventoryMode === "pro"
          ? "simple"
          : current.inventoryMode,
      qcMode:
        productProfile === "solo" && current.qcMode === "independent"
          ? "off"
          : productProfile === "pro" && current.qcMode === "off"
            ? "independent"
            : current.qcMode,
    }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    let error = "";
    if (!form.name.trim()) error = "نام تعمیرگاه را وارد کنید.";
    else if (!editing && !form.managerName.trim())
      error = "نام مدیر اولیه را وارد کنید.";
    else if (!editing && !/^09\d{9}$/.test(form.managerMobile))
      error = "شماره موبایل مدیر باید ۱۱ رقم و با 09 آغاز شود.";
    else if (productChanged && !form.productChangeReason.trim())
      error = "علت تغییر محصول را ثبت کنید.";
    if (error) {
      setFormError(error);
      window.requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>(
            "[aria-invalid='true'], input:invalid, select:invalid, textarea:invalid",
          )
          ?.focus(),
      );
      return;
    }
    setFormError("");
    const modules = Array.from(
      new Set([
        ...(editing ? activeModules : ["repair"]),
        ...(form.inventoryMode === "off" ? [] : ["inventory"]),
      ]),
    ).filter(
      (module) => module !== "inventory" || form.inventoryMode !== "off",
    );
    const payload = {
      ...form,
      size: "small",
      modules,
      plan: form.productProfile === "solo" ? "light" : "professional",
      maxUsers: form.productProfile === "solo" ? 1 : Math.max(2, form.maxUsers),
      maxBranches:
        form.productProfile === "solo" ? 1 : Math.max(1, form.maxBranches),
      inventoryMode: form.inventoryMode,
      qcMode: form.qcMode,
      allowSelfQc: form.qcMode === "simple" && form.allowSelfQc,
      allowDeliveryWithBalance: form.allowDeliveryWithBalance,
      idempotencyKey:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `shop-${Date.now()}`,
      moduleChangeReason: productChanged ? form.productChangeReason : "",
      moduleChangeContext: "manual",
      ...(editing ? { id: shop?.id } : { branchName: "شعبه مرکزی" }),
    };
    onSave(payload);
  };
  return (
    <form
      ref={formRef}
      className="central-admin-form shop-form-v4"
      onSubmit={submit}
      noValidate
    >
      {(formError || serverError) && (
        <div className="form-error-summary" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>اطلاعات ذخیره نشد</strong>
            <p>{formError || serverError}</p>
          </div>
        </div>
      )}
      <fieldset>
        <legend>
          <Store size={18} />
          مشخصات تعمیرگاه
        </legend>
        <div className="central-admin-form-grid">
          <label>
            <span>
              نام تعمیرگاه <b>*</b>
            </span>
            <input
              autoFocus
              value={form.name}
              aria-invalid={!form.name.trim()}
              onChange={(event) => update("name", event.target.value)}
            />
          </label>
          {editing && (
            <label>
              <span>کد عمومی تعمیرگاه</span>
              <input dir="ltr" value={shop?.code ?? ""} disabled />
              <small>
                <LockKeyhole size={12} /> این کد شش‌رقمی قابل تغییر نیست.
              </small>
            </label>
          )}
          <label>
            <span>نوع تعمیرگاه</span>
            <select
              value={form.repairType}
              onChange={(event) => update("repairType", event.target.value)}
              disabled={editing}
            >
              {Object.entries(repairTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {editing && <small>نوع صنفی پس از ایجاد قفل است.</small>}
          </label>
          <div className="central-admin-date-field">
            <span>تاریخ انقضا</span>
            <PersianDatePicker
              value={form.expiresAt}
              onChange={(value) => update("expiresAt", value)}
              required
              ariaLabel="تاریخ انقضا"
            />
          </div>
          {editing && (
            <label>
              <span>وضعیت دسترسی</span>
              <select
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
              >
                <option value="active">فعال</option>
                <option value="read_only">فقط مشاهده</option>
                <option value="suspended">تعلیق‌شده</option>
              </select>
            </label>
          )}
          <label className="central-admin-switch-field">
            <span>کد ملی در پذیرش</span>
            <button
              type="button"
              className={form.nationalCodeRequired ? "active" : ""}
              onClick={() =>
                update("nationalCodeRequired", !form.nationalCodeRequired)
              }
            >
              <i />
              <strong>
                {form.nationalCodeRequired ? "الزامی" : "اختیاری"}
              </strong>
              <small>اعتبارسنجی کد ملی ایران</small>
            </button>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>
          <CreditCard size={18} />
          محصول و امکانات
        </legend>
        <div className="product-choice-grid">
          <button
            type="button"
            className={form.productProfile === "solo" ? "selected" : ""}
            onClick={() => chooseProduct("solo")}
            disabled={editing}
          >
            <strong>تعمیران Solo</strong>
            <small>یک کاربر، یک شعبه، گردش ساده</small>
          </button>
          <button
            type="button"
            className={form.productProfile === "pro" ? "selected" : ""}
            onClick={() => chooseProduct("pro")}
            disabled={editing}
          >
            <strong>تعمیران Pro</strong>
            <small>تیمی، نقش‌محور، QC و توسعه‌پذیر</small>
          </button>
        </div>
        {editing && (
          <p className="product-change-route-note">
            تغییر Solo/Pro فقط از دکمه «تغییر محصول» و پس از پیش‌بررسی انجام می‌شود.
          </p>
        )}
        <div className="product-capacity-summary">
          <div>
            <span>محصول انتخاب‌شده</span>
            <strong>{productTitle}</strong>
          </div>
          <div>
            <span>حداکثر کاربران</span>
            <strong>
              {form.productProfile === "solo"
                ? "۱"
                : "۱۰ نفر در پلن پایه Pro"}
            </strong>
          </div>
          <div>
            <span>حداکثر شعب</span>
            <strong>
              {form.productProfile === "solo"
                ? "۱"
                : "۱ شعبه"}
            </strong>
          </div>
        </div>
        {!editing && (
          <div className="central-admin-form-grid">
            <label>
              <span>حالت انبار</span>
              <select
                value={form.inventoryMode}
                onChange={(event) => update("inventoryMode", event.target.value as "off" | "simple" | "pro")}
              >
                <option value="off">خاموش</option>
                <option value="simple">انبار ساده</option>
                {form.productProfile === "pro" && <option value="pro">انبار حرفه‌ای</option>}
              </select>
              <small>انبار Add-on مستقل است و با Pro شدن خودکار فعال نمی‌شود.</small>
            </label>
            <label>
              <span>کنترل کیفیت</span>
              <select
                value={form.qcMode}
                onChange={(event) => update("qcMode", event.target.value as "off" | "simple" | "independent")}
              >
                <option value="off">خاموش</option>
                <option value="simple">کنترل توسط تعمیرکار</option>
                {form.productProfile === "pro" && <option value="independent">کنترل مستقل</option>}
              </select>
            </label>
            <label className="central-admin-switch-field">
              <span>تحویل با مانده</span>
              <button
                type="button"
                className={form.allowDeliveryWithBalance ? "active" : ""}
                onClick={() => update("allowDeliveryWithBalance", !form.allowDeliveryWithBalance)}
              >
                <i />
                <strong>{form.allowDeliveryWithBalance ? "با مجوز مدیر" : "ممنوع"}</strong>
                <small>در هر پرونده همچنان Reason و Audit الزامی است.</small>
              </button>
            </label>
          </div>
        )}
        {editing && (
          <div className="active-module-summary">
            <div>
              <strong>قابلیت‌های فعال</strong>
              <small>
                افزودن یا غیرفعال‌سازی قابلیت فقط از مسیر فروش و فاکتور انجام
                می‌شود.
              </small>
            </div>
            <div>
              {activeModules.map((module) => (
                <span key={module}>{moduleLabels[module] ?? module}</span>
              ))}
            </div>
          </div>
        )}
        {productChanged && (
          <label className="field-block product-change-reason">
            <span>
              علت تغییر محصول <b>*</b>
            </span>
            <textarea
              rows={3}
              maxLength={1000}
              required
              value={form.productChangeReason}
              onChange={(event) =>
                update("productChangeReason", event.target.value)
              }
              placeholder="علت تجاری تغییر Solo / Pro را برای Audit ثبت کنید."
            />
          </label>
        )}
      </fieldset>
      {editing && moduleChanges.length > 0 && (
        <details className="module-history-collapsed">
          <summary>
            <History size={17} />
            مشاهده تاریخچه تغییرات قابلیت‌ها (
            {toPersianDigits(moduleChanges.length)})
          </summary>
          <div className="module-change-history">
            {moduleChanges.slice(0, 12).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>
                    {item.addedModules.length
                      ? `افزوده: ${item.addedModules.map((code) => moduleLabels[code] ?? code).join("، ")}`
                      : "بدون قابلیت افزوده"}
                  </strong>
                  <small>
                    {item.removedModules.length
                      ? `غیرفعال: ${item.removedModules.map((code) => moduleLabels[code] ?? code).join("، ")}`
                      : "بدون قابلیت غیرفعال"}
                  </small>
                </div>
                <p>{item.reason}</p>
                <footer>
                  <span>
                    {item.actorName} · {formatDate(item.createdAt, true)}
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </details>
      )}
      {!editing && (
        <fieldset>
          <legend>
            <CircleUserRound size={18} />
            مدیر اولیه تعمیرگاه
          </legend>
          <div className="central-admin-form-grid">
            <label>
              <span>
                نام و نام خانوادگی <b>*</b>
              </span>
              <input
                value={form.managerName}
                aria-invalid={!form.managerName.trim()}
                onChange={(event) => update("managerName", event.target.value)}
              />
            </label>
            <label>
              <span>
                شماره موبایل <b>*</b>
              </span>
              <input
                dir="ltr"
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={form.managerMobile}
                aria-invalid={
                  Boolean(form.managerMobile) &&
                  !/^09\d{9}$/.test(form.managerMobile)
                }
                onChange={(event) =>
                  update(
                    "managerMobile",
                    event.target.value.replace(/\D/g, "").slice(0, 11),
                  )
                }
                placeholder="09xxxxxxxxx"
              />
            </label>
            <label>
              <span>ایمیل</span>
              <input
                dir="ltr"
                type="email"
                value={form.managerEmail}
                onChange={(event) => update("managerEmail", event.target.value)}
              />
            </label>
          </div>
          <div className="product-preservation-note">
            <KeyRound size={20} />
            <div>
              <strong>رمز موقت امن توسط سامانه ساخته می‌شود</strong>
              <p>پس از ایجاد، رمز یک‌بار نمایش داده می‌شود و مدیر در نخستین ورود باید آن را تغییر دهد.</p>
            </div>
          </div>
        </fieldset>
      )}
      <div className="central-admin-form-actions">
        <button type="button" onClick={onCancel}>
          انصراف
        </button>
        <button
          type="submit"
          className="central-admin-primary"
          disabled={saving}
        >
          <Save size={17} />
          {saving
            ? "در حال ذخیره..."
            : editing
              ? "ذخیره تغییرات"
              : "ایجاد تعمیرگاه"}
        </button>
      </div>
    </form>
  );
}

function UserForm({
  user,
  shops,
  branches,
  saving,
  onCancel,
  onSave,
}: {
  user?: AdminUser;
  shops: AdminShop[];
  branches: AdminBranch[];
  saving: boolean;
  onCancel: () => void;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const editing = Boolean(user);
  const central = user?.shopId === null;
  const initialShopId = user?.shopId ?? shops[0]?.id ?? 0;
  const [form, setForm] = useState({
    shopId: initialShopId,
    displayName: user?.displayName ?? "",
    mobile: user?.phone || user?.username || "",
    email: user?.email ?? "",
    role: user?.role ?? "reception",
    isActive: user?.isActive ?? true,
    branchIds:
      user?.branchIds ??
      branches
        .filter((branch) => branch.shopId === initialShopId && branch.isDefault)
        .map((branch) => branch.id),
    password: "",
    newPassword: "",
  });
  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const visibleBranches = branches.filter(
    (branch) => branch.shopId === form.shopId && branch.isActive,
  );
  const toggleBranch = (branchId: number) =>
    update(
      "branchIds",
      form.branchIds.includes(branchId)
        ? form.branchIds.filter((id) => id !== branchId)
        : [...form.branchIds, branchId],
    );
  return (
    <form
      className="central-admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...(editing ? { id: user?.id } : { shopId: form.shopId }),
          displayName: form.displayName,
          mobile: form.mobile,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          branchIds: form.branchIds,
          ...(editing
            ? { newPassword: form.newPassword }
            : { password: form.password }),
        });
      }}
    >
      <fieldset>
        <legend>
          <CircleUserRound size={18} />
          اطلاعات حساب
        </legend>
        <div className="central-admin-form-grid">
          {!editing && (
            <label>
              <span>تعمیرگاه</span>
              <select
                value={form.shopId}
                onChange={(event) => {
                  const shopId = Number(event.target.value);
                  update("shopId", shopId);
                  update(
                    "branchIds",
                    branches
                      .filter(
                        (branch) =>
                          branch.shopId === shopId && branch.isDefault,
                      )
                      .map((branch) => branch.id),
                  );
                }}
                required
              >
                <option value="" disabled>
                  انتخاب تعمیرگاه
                </option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>نام و نام خانوادگی</span>
            <input
              value={form.displayName}
              onChange={(event) => update("displayName", event.target.value)}
              required
            />
          </label>
          <label>
            <span>شماره موبایل (نام کاربری)</span>
            <input
              dir="ltr"
              type="tel"
              inputMode="numeric"
              pattern="09[0-9]{9}"
              maxLength={11}
              value={form.mobile}
              onChange={(event) => update("mobile", event.target.value)}
              placeholder="09xxxxxxxxx"
              required
            />
          </label>
          <label>
            <span>ایمیل</span>
            <input
              dir="ltr"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>
          <ShieldCheck size={18} />
          نقش و دسترسی
        </legend>
        <div className="central-admin-form-grid">
          <label>
            <span>نقش کاربر</span>
            <select
              value={form.role}
              onChange={(event) => update("role", event.target.value)}
              disabled={central}
            >
              {central && (
                <option value="central_admin">مدیر مرکزی تعمیران</option>
              )}
              <option value="repair_manager">مدیر تعمیرگاه</option>
              <option value="reception">مسئول پذیرش</option>
              <option value="technician">تکنسین</option>
              <option value="quality_control">کنترل کیفیت</option>
              <option value="warehouse_keeper">انباردار</option>
              <option value="finance_cashier">مسئول مالی / صندوق</option>
            </select>
          </label>
          <label className="central-admin-switch-field">
            <span>وضعیت حساب</span>
            <button
              type="button"
              className={form.isActive ? "active" : ""}
              onClick={() => !central && update("isActive", !form.isActive)}
              disabled={central}
            >
              <i />
              <strong>{form.isActive ? "حساب فعال" : "حساب غیرفعال"}</strong>
              <small>
                {central
                  ? "حساب مدیر مرکزی قابل غیرفعال‌کردن نیست"
                  : "برای تغییر وضعیت کلیک کنید"}
              </small>
            </button>
          </label>
        </div>
        {!central && (
          <div className="central-admin-branch-picker">
            <span>شعب مجاز</span>
            <div>
              {visibleBranches.map((branch) => (
                <label key={branch.id}>
                  <input
                    type="checkbox"
                    checked={form.branchIds.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                  />
                  <span>
                    <Building2 size={15} />
                    {branch.name}
                    {branch.isDefault && <small>شعبه اصلی</small>}
                  </span>
                </label>
              ))}
            </div>
            {visibleBranches.length === 0 && (
              <small>برای این تعمیرگاه شعبه فعالی تعریف نشده است.</small>
            )}
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend>
          <KeyRound size={18} />
          {editing ? "بازنشانی رمز عبور" : "رمز اولیه"}
        </legend>
        <div className="central-admin-form-grid">
          <label>
            <span>{editing ? "رمز جدید (اختیاری)" : "رمز اولیه"}</span>
            <input
              dir="ltr"
              type="password"
              minLength={15}
              value={editing ? form.newPassword : form.password}
              onChange={(event) =>
                editing
                  ? update("newPassword", event.target.value)
                  : update("password", event.target.value)
              }
              placeholder="حداقل ۱۵ کاراکتر"
              required={!editing}
            />
            <small>
              {editing
                ? "اگر خالی بماند، رمز فعلی تغییر نمی‌کند."
                : "رمز از طریق مسیر امن به کاربر اعلام شود."}
            </small>
          </label>
        </div>
      </fieldset>
      <div className="central-admin-form-actions">
        <button type="button" onClick={onCancel}>
          انصراف
        </button>
        <button
          type="submit"
          className="central-admin-primary"
          disabled={saving}
        >
          <Save size={17} />
          {saving
            ? "در حال ذخیره..."
            : editing
              ? "ذخیره مشخصات کاربر"
              : "ساخت کاربر"}
        </button>
      </div>
    </form>
  );
}

function AdminModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = React.useRef<HTMLElement>(null);
  const modalId = useModalFocus(dialogRef, true, onClose);
  return (
    <div
      className="central-admin-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="central-admin-modal"
        ref={dialogRef}
        tabIndex={-1}
        data-modal-id={modalId}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن">
            <X size={21} />
          </button>
        </header>
        <div className="central-admin-modal-body">{children}</div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`central-admin-status status-${status}`}>
      <i />
      {statusLabels[status] ?? "نامشخص"}
    </span>
  );
}

function AdminEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <div className="central-admin-empty">
      <span>
        <Icon size={25} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function SupportTickets({
  central = false,
  notify,
}: {
  central?: boolean;
  notify: (message: string) => void;
}) {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("support");
  const [priority, setPriority] = useState("normal");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicketRecord | null>(null);
  const [reply, setReply] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!directAdminApiEnabled) {
        setTickets([]);
      } else {
        const data = await loadTickets();
        setTickets(data.tickets);
      }
    } catch (error) {
      notify(errorMessage(error, "بارگذاری تیکت‌ها انجام نشد."));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      notify("عنوان و شرح درخواست را کامل کنید.");
      return;
    }
    try {
      if (directAdminApiEnabled)
        await createTicket({ category, subject, message, priority });
      setSubject("");
      setMessage("");
      await refresh();
      notify("درخواست پشتیبانی با موفقیت ثبت شد.");
    } catch (error) {
      notify(errorMessage(error, "ثبت درخواست انجام نشد."));
    }
  };

  const setTicketStatus = async (publicId: string, status: string) => {
    const previous = tickets;
    setTickets((current) =>
      current.map((ticket) =>
        ticket.public_id === publicId ? { ...ticket, status } : ticket,
      ),
    );
    try {
      if (directAdminApiEnabled) await changeTicket({ publicId, status });
      notify("وضعیت درخواست به‌روزرسانی شد.");
    } catch (error) {
      setTickets(previous);
      notify(errorMessage(error, "تغییر وضعیت درخواست انجام نشد."));
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    try {
      if (directAdminApiEnabled)
        await changeTicket({
          publicId: selected.public_id,
          message: reply.trim(),
        });
      setReply("");
      setSelected(null);
      await refresh();
      notify("پاسخ تیکت ثبت شد.");
    } catch (error) {
      notify(errorMessage(error, "ثبت پاسخ انجام نشد."));
    }
  };

  const normalized = query.trim().toLocaleLowerCase("fa");
  const filtered = tickets.filter(
    (ticket) =>
      !normalized ||
      `${ticket.subject} ${ticket.shop_name} ${ticket.created_by}`
        .toLocaleLowerCase("fa")
        .includes(normalized),
  );
  return (
    <div
      className={
        central ? "central-admin-ticket-page" : "repair-shop-ticket-page"
      }
    >
      {!central && (
        <section className="central-admin-panel central-admin-ticket-compose">
          <header>
            <span>
              <LifeBuoy size={20} />
            </span>
            <div>
              <h3>درخواست جدید</h3>
              <p>
                برای ایراد سامانه، پشتیبانی یا فروش با تیم تعمیران در ارتباط
                باشید.
              </p>
            </div>
          </header>
          <div className="central-admin-ticket-form">
            <label>
              <span>دسته درخواست</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="support">پشتیبانی</option>
                <option value="incident">ایراد سامانه</option>
                <option value="sales">فروش و تمدید</option>
              </select>
            </label>
            <label>
              <span>اهمیت</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="normal">عادی</option>
                <option value="important">مهم</option>
                <option value="urgent">فوری</option>
              </select>
            </label>
            <label className="wide">
              <span>عنوان درخواست</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
            <label className="wide">
              <span>شرح کامل</span>
              <textarea
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="central-admin-primary"
              onClick={() => void submit()}
            >
              <CheckCircle2 size={17} />
              ثبت درخواست
            </button>
          </div>
        </section>
      )}
      <section className="central-admin-panel central-admin-list-panel">
        <div className="central-admin-list-toolbar">
          <label className="central-admin-ticket-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی عنوان یا تعمیرگاه"
            />
          </label>
          <button
            type="button"
            className="central-admin-secondary"
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
            به‌روزرسانی
          </button>
        </div>
        <div className="central-admin-table-wrap">
          <table className="central-admin-table">
            <thead>
              <tr>
                {central && <th>تعمیرگاه</th>}
                <th>عنوان درخواست</th>
                <th>دسته و اهمیت</th>
                <th>ثبت‌کننده</th>
                <th>آخرین تغییر</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => (
                <tr key={ticket.public_id}>
                  {central && (
                    <td>
                      <strong>{ticket.shop_name}</strong>
                    </td>
                  )}
                  <td>
                    <strong>{ticket.subject}</strong>
                    <small className="central-admin-cell-note" dir="ltr">
                      {ticket.public_id}
                    </small>
                  </td>
                  <td>
                    <span
                      className={`central-admin-ticket-priority priority-${ticket.priority}`}
                    >
                      {ticketCategoryLabels[ticket.category] ?? "پشتیبانی"} ·{" "}
                      {ticketPriorityLabels[ticket.priority] ?? "عادی"}
                    </span>
                  </td>
                  <td>{ticket.created_by}</td>
                  <td>{formatDate(ticket.updated_at, true)}</td>
                  <td>
                    {central ? (
                      <select
                        className="central-admin-ticket-status"
                        value={ticket.status}
                        onChange={(event) =>
                          void setTicketStatus(
                            ticket.public_id,
                            event.target.value,
                          )
                        }
                      >
                        <option value="open">جدید</option>
                        <option value="in_progress">در حال بررسی</option>
                        <option value="waiting_shop">
                          منتظر پاسخ تعمیرگاه
                        </option>
                        <option value="resolved">حل‌شده</option>
                        <option value="closed">بسته‌شده</option>
                      </select>
                    ) : (
                      <span
                        className={`central-admin-status ticket-${ticket.status}`}
                      >
                        <i />
                        {ticketStatusLabels[ticket.status] ?? "نامشخص"}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="central-admin-row-action"
                      onClick={() => setSelected(ticket)}
                    >
                      <MessageSquareMore size={15} />
                      جزئیات
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <AdminEmpty
            icon={TicketCheck}
            title="هنوز اطلاعاتی ثبت نشده است"
            description="هنوز تیکتی ثبت نشده یا نتیجه‌ای با جست‌وجوی شما وجود ندارد."
          />
        )}
      </section>
      {selected && (
        <AdminModal
          title={selected.subject}
          subtitle={`${selected.shop_name} · ${selected.public_id}`}
          onClose={() => setSelected(null)}
        >
          <div className="central-admin-ticket-thread">
            {selected.messages.length ? (
              selected.messages.map((item) => (
                <article key={item.id}>
                  <strong>{item.author_name}</strong>
                  <p>{item.body}</p>
                  <small>{formatDate(item.created_at, true)}</small>
                </article>
              ))
            ) : (
              <AdminEmpty
                icon={MessageSquareMore}
                title="هنوز اطلاعاتی ثبت نشده است"
                description="پیامی برای این تیکت وجود ندارد."
              />
            )}
          </div>
          <label className="central-admin-ticket-reply">
            <span>پاسخ جدید</span>
            <textarea
              rows={4}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="پاسخ یا نتیجه بررسی را ثبت کنید..."
            />
          </label>
          <div className="central-admin-form-actions">
            <button type="button" onClick={() => setSelected(null)}>
              بستن
            </button>
            <button
              type="button"
              className="central-admin-primary"
              disabled={!reply.trim()}
              onClick={() => void sendReply()}
            >
              <Send size={16} />
              ثبت پاسخ
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
