"use client";

import {
  Activity,
  Archive,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  AlarmClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CloudDownload,
  DatabaseBackup,
  Download,
  FileClock,
  FileDown,
  FileSearch,
  FileSpreadsheet,
  Fingerprint,
  Gauge,
  History,
  LockKeyhole,
  MessageSquareMore,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Search,
  Settings2,
  ShieldCheck,
  ShieldEllipsis,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  UserCog,
  UserPlus,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import * as React from "react";
import { useModalFocus } from "../shared/use-modal-focus";
import { useEffect, useState } from "react";
import { readSheet } from "./xlsx-reader";
import type { WorkspaceProfile } from "./access";
import { displayDeviceType, type DeviceCatalogItem } from "./catalog";
import {
  followUpPriorityLabels,
  followUpStatusLabels,
  type CaseFollowUp,
  type FollowUpKind,
  type FollowUpPriority,
  type FollowUpStatus,
} from "./followups";
import {
  createCatalogItem,
  discardReceptionDraft,
  isDirectAdminConflict,
  loadCatalog,
  lookupCustomer,
  saveReceptionDraft,
  saveShopSetting,
  updateCatalogItem,
  updateShopSettings,
} from "./directadmin-api";
import { directAdminApiEnabled, FollowUpApiError } from "./followups-api";
import { PersianDatePicker } from "./persian-date-picker";
import { addGregorianDays, todayGregorianIso } from "./persian-date";
import { SecureQr } from "./secure-qr";
import {
  buildDraftSubmissionSelection,
  buildPreviousDeviceSelection,
  buildReceiptAcceptance,
  parseActiveReceiptTerms,
  receiptTermsKey,
} from "../software/reception-ui-contract";
import {
  buildDraftDiscardSelection,
  createReceptionDraftMutationQueue,
} from "../software/reception-draft-mutations";
import {
  emptyOperationalSnapshot,
  operationalRoleLabels,
  repairCaseStatusLabels,
  type CreateInventoryItemInput,
  type CreatePartRequestInput,
  type CreateRepairCaseInput,
  type CustomerLookupResult,
  type OperationalSnapshot,
  type OperationalUser,
  type PreviousCustomerDevice,
  type RepairCaseRecord,
  type RepairCaseStatus,
} from "./operations";

type ModuleProps = {
  title: string;
  onNavigate: (label: string) => void;
  notify: (message: string) => void;
  workspace?: WorkspaceProfile;
  deviceCatalog?: DeviceCatalogItem[];
  setDeviceCatalog?: React.Dispatch<React.SetStateAction<DeviceCatalogItem[]>>;
  followUps?: CaseFollowUp[];
  onCreateFollowUp?: (item: CaseFollowUp) => void | Promise<void>;
  onUpdateFollowUpStatus?: (
    id: string,
    status: FollowUpStatus,
  ) => void | Promise<void>;
  onUpdateFollowUp?: (input: {
    id: string;
    status?: FollowUpStatus;
    assignedToUserId?: number;
    dueLabel?: string;
    comment?: string;
  }) => void | Promise<void>;
  operations?: OperationalSnapshot;
  operationsLoading?: boolean;
  onCreateRepairCase?: (
    input: CreateRepairCaseInput,
  ) => Promise<RepairCaseRecord>;
  onCreateInventoryItem?: (input: CreateInventoryItemInput) => Promise<void>;
  onCreatePartRequest?: (input: CreatePartRequestInput) => Promise<void>;
  onUpdateRepairCase?: (input: {
    id: number;
    status?: RepairCaseStatus;
    assignedToUserId?: number | null;
    result?: string;
    operationReport?: string;
    reason?: string;
    deliveryAmount?: number;
    deliveredToName?: string;
    deliveryNotes?: string;
  }) => Promise<RepairCaseRecord>;
  onRefreshOperations?: () => void | Promise<void>;
  shopSettings?: Record<string, unknown>;
  setShopSettings?: React.Dispatch<
    React.SetStateAction<Record<string, unknown>>
  >;
};

type PageProps = Omit<ModuleProps, "title">;

type ServiceKey =
  "mobile" | "laptop" | "appliance" | "automotive" | "motorcycle" | "generic";

type ServiceField = {
  label: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: "numeric" | "text" | "tel";
  maxLength?: number;
  pattern?: string;
  helper?: string;
  options?: string[];
  sensitive?: boolean;
};

type DeviceColorOption = {
  id: string;
  name: string;
  hex?: string;
  active: boolean;
  sortOrder: number;
};

const defaultDeviceColors: DeviceColorOption[] = [
  "مشکی", "سفید", "خاکستری", "نقره‌ای", "طلایی", "رزگلد", "کرم", "قهوه‌ای",
  "آبی", "سرمه‌ای", "فیروزه‌ای", "سبز", "قرمز", "زرشکی", "صورتی", "بنفش",
  "زرد", "نارنجی", "شفاف", "چندرنگ", "طرح‌دار", "نامشخص", "سایر",
].map((name, index) => ({ id: `default-${index + 1}`, name, active: true, sortOrder: index + 1 }));

const normalizeDeviceColors = (value: unknown): DeviceColorOption[] => {
  if (!Array.isArray(value) || value.length === 0) return defaultDeviceColors;
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item, index) => ({
      id: String(item.id || `color-${index + 1}`),
      name: String(item.name || "").trim(),
      hex: typeof item.hex === "string" ? item.hex : undefined,
      active: item.active !== false,
      sortOrder: Number(item.sortOrder || index + 1),
    }))
    .filter((item) => item.name)
    .sort((a, b) => a.sortOrder - b.sortOrder);
};

const reportToday = todayGregorianIso();
const reportWeekStart = addGregorianDays(reportToday, -6);

const serviceProfiles: Record<
  ServiceKey,
  {
    title: string;
    itemLabel: string;
    identifierLabel: string;
    fields: ServiceField[];
    accessories: string[];
  }
> = {
  mobile: {
    title: "موبایل و تبلت",
    itemLabel: "دستگاه",
    identifierLabel: "IMEI",
    fields: [
      { label: "برند", required: true, placeholder: "انتخاب از اطلاعات پایه" },
      { label: "مدل", required: true, placeholder: "انتخاب از اطلاعات پایه" },
      { label: "رنگ", placeholder: "مثلاً سرمه‌ای" },
      {
        label: "IMEI",
        required: true,
        placeholder: "شناسه دقیق ۱۵ رقمی",
        inputMode: "numeric",
        maxLength: 15,
        pattern: "[0-9]{15}",
        helper: "دقیقاً ۱۵ رقم",
      },
      {
        label: "رمز بازکردن دستگاه",
        placeholder: "فقط برای تعمیر",
        sensitive: true,
        helper: "در قبض و پرتال چاپ نمی‌شود",
      },
      {
        label: "وضعیت ظاهری",
        options: [
          "بدون ایراد ظاهری",
          "خط و خش",
          "شکستگی",
          "آب‌خوردگی مشهود",
          "سایر",
        ],
      },
    ],
    accessories: [
      "بدون لوازم",
      "قاب",
      "سیم‌کارت",
      "کارت حافظه",
      "شارژر",
      "کابل",
      "کارتن",
    ],
  },
  laptop: {
    title: "لپ‌تاپ و رایانه",
    itemLabel: "سیستم",
    identifierLabel: "سریال",
    fields: [
      { label: "برند", required: true, placeholder: "انتخاب از اطلاعات پایه" },
      { label: "مدل", required: true, placeholder: "انتخاب از اطلاعات پایه" },
      { label: "سریال", required: true, placeholder: "Serial Number" },
      { label: "رنگ", placeholder: "رنگ بدنه" },
      {
        label: "رمز ورود",
        placeholder: "در صورت نیاز",
        sensitive: true,
        helper: "در قبض و پرتال چاپ نمی‌شود",
      },
      {
        label: "وضعیت اطلاعات",
        options: [
          "حفظ اطلاعات الزامی است",
          "اجازه نصب مجدد",
          "بدون اطلاعات مهم",
          "نیازمند هماهنگی",
        ],
      },
    ],
    accessories: [
      "بدون لوازم",
      "شارژر",
      "کیف",
      "ماوس",
      "دانگل",
      "هارد اکسترنال",
      "کارتن",
    ],
  },
  appliance: {
    title: "لوازم خانگی",
    itemLabel: "وسیله",
    identifierLabel: "سریال اختیاری",
    fields: [
      {
        label: "نوع وسیله",
        required: true,
        options: [
          "انتخاب نوع",
          "ماشین لباسشویی",
          "یخچال",
          "تلویزیون",
          "جاروبرقی",
          "مایکروویو",
          "سایر",
        ],
      },
      { label: "برند", required: true, placeholder: "برند سازنده" },
      { label: "مدل", placeholder: "مدل دستگاه" },
      { label: "رنگ", placeholder: "اختیاری" },
      {
        label: "سریال",
        placeholder: "اختیاری و قابل پنهان‌سازی",
        helper: "در این پروفایل اجباری نیست",
      },
      {
        label: "محل خدمت",
        required: true,
        options: ["تحویل در تعمیرگاه", "تعمیر در محل مشتری"],
      },
    ],
    accessories: [
      "بدون لوازم",
      "ریموت",
      "کابل برق",
      "شلنگ ورودی",
      "شلنگ خروجی",
      "پایه",
      "دفترچه",
    ],
  },
  automotive: {
    title: "خودرو",
    itemLabel: "خودرو",
    identifierLabel: "پلاک",
    fields: [
      { label: "برند", required: true, placeholder: "مثلاً ایران‌خودرو" },
      { label: "مدل", required: true, placeholder: "مثلاً دنا پلاس" },
      { label: "سال ساخت", inputMode: "numeric", placeholder: "۱۴۰۲" },
      { label: "پلاک", required: true, placeholder: "شماره پلاک" },
      {
        label: "کارکرد",
        required: true,
        inputMode: "numeric",
        placeholder: "کیلومتر",
      },
      { label: "شماره شاسی", placeholder: "اختیاری" },
      {
        label: "سطح سوخت",
        options: ["خالی", "یک‌چهارم", "نیم", "سه‌چهارم", "پر"],
      },
      {
        label: "وضعیت ظاهری",
        options: [
          "ثبت در توضیحات",
          "بدون آسیب مشهود",
          "دارای خط و خش",
          "دارای آسیب بدنه",
        ],
      },
    ],
    accessories: [
      "بدون اقلام",
      "سوئیچ یدک",
      "کارت خودرو",
      "بیمه‌نامه",
      "زاپاس",
      "ابزار",
      "وسایل داخل خودرو",
    ],
  },
  motorcycle: {
    title: "موتورسیکلت",
    itemLabel: "موتورسیکلت",
    identifierLabel: "پلاک",
    fields: [
      { label: "برند", required: true, placeholder: "برند" },
      { label: "مدل", required: true, placeholder: "مدل" },
      { label: "پلاک", required: true, placeholder: "شماره پلاک" },
      { label: "کارکرد", inputMode: "numeric", placeholder: "کیلومتر" },
      { label: "شماره شاسی", placeholder: "اختیاری" },
      { label: "شماره موتور", placeholder: "اختیاری" },
    ],
    accessories: [
      "بدون اقلام",
      "کلاه ایمنی",
      "سوئیچ یدک",
      "مدارک",
      "باکس عقب",
      "قفل",
    ],
  },
  generic: {
    title: "عمومی و سایر",
    itemLabel: "کالا یا تجهیز",
    identifierLabel: "شناسه اختیاری",
    fields: [
      {
        label: "شرح کالا یا تجهیز",
        required: true,
        placeholder: "نوع، نام یا مشخصات قابل تشخیص",
      },
      { label: "برند", placeholder: "اختیاری" },
      { label: "مدل", placeholder: "اختیاری" },
      { label: "شناسه یا سریال", placeholder: "اختیاری" },
      { label: "رنگ یا نشانه ظاهری", placeholder: "برای تشخیص فیزیکی" },
    ],
    accessories: [
      "بدون لوازم",
      "کابل",
      "آداپتور",
      "کیف",
      "ریموت",
      "دفترچه",
      "سایر",
    ],
  },
};

function profileKeyForWorkshop(
  repairType: string | undefined,
  deviceType: string,
): ServiceKey {
  if (repairType === "appliance") return "appliance";
  if (repairType === "automotive") return "automotive";
  if (repairType === "motorcycle") return "motorcycle";
  if (repairType === "generic") return "generic";
  const normalizedType = displayDeviceType(deviceType).toLocaleLowerCase("fa");
  return /(لپ|رایانه|کامپیوتر|pc|computer|laptop)/i.test(normalizedType)
    ? "laptop"
    : "mobile";
}

function serviceKeysForWorkshop(repairType: string | undefined): ServiceKey[] {
  if (repairType === "appliance") return ["appliance"];
  if (repairType === "automotive") return ["automotive"];
  if (repairType === "motorcycle") return ["motorcycle"];
  if (repairType === "generic") return ["generic"];
  return ["mobile", "laptop"];
}

export function ModuleRouter({
  title,
  onNavigate,
  notify,
  workspace,
  deviceCatalog,
  setDeviceCatalog,
  followUps,
  onCreateFollowUp,
  onUpdateFollowUpStatus,
  onUpdateFollowUp,
  operations,
  operationsLoading,
  onCreateRepairCase,
  onCreateInventoryItem,
  onCreatePartRequest,
  onUpdateRepairCase,
  onRefreshOperations,
  shopSettings,
  setShopSettings,
}: ModuleProps) {
  switch (title) {
    case "پذیرش تعمیرات":
      return (
        <ReceptionPage
          onNavigate={onNavigate}
          notify={notify}
          workspace={workspace}
          deviceCatalog={deviceCatalog}
          setDeviceCatalog={setDeviceCatalog}
          operations={operations}
          onCreateRepairCase={onCreateRepairCase}
          shopSettings={shopSettings}
        />
      );
    case "رسیدها":
      return (
        <ReceiptsPage
          onNavigate={onNavigate}
          notify={notify}
          workspace={workspace}
          operations={operations}
          operationsLoading={operationsLoading}
          shopSettings={shopSettings}
        />
      );
    case "مرکز عملیات تعمیرات":
      return (
        <RepairManagementPage
          onNavigate={onNavigate}
          notify={notify}
          operations={operations}
          operationsLoading={operationsLoading}
          onUpdateRepairCase={onUpdateRepairCase}
          onRefreshOperations={onRefreshOperations}
        />
      );
    case "کارهای من":
      return (
        <TechnicianPage
          onNavigate={onNavigate}
          notify={notify}
          workspace={workspace}
          operations={operations}
          operationsLoading={operationsLoading}
          onUpdateRepairCase={onUpdateRepairCase}
          followUps={followUps}
          onUpdateFollowUpStatus={onUpdateFollowUpStatus}
          onUpdateFollowUp={onUpdateFollowUp}
        />
      );
    case "تحویل تعمیرات":
      return (
        <DeliveryPage
          onNavigate={onNavigate}
          notify={notify}
          workspace={workspace}
          shopSettings={shopSettings}
          operations={operations}
          operationsLoading={operationsLoading}
          onUpdateRepairCase={onUpdateRepairCase}
        />
      );
    case "پیگیری مشتری":
      return (
        <TrackingPage
          notify={notify}
          workspace={workspace}
          operations={operations}
          followUps={followUps}
          onCreateFollowUp={onCreateFollowUp}
          onUpdateFollowUp={onUpdateFollowUp}
        />
      );
    case "انبار قطعات":
      return (
        <InventoryPage
          onNavigate={onNavigate}
          notify={notify}
          operations={operations}
          operationsLoading={operationsLoading}
          onRefreshOperations={onRefreshOperations}
          onCreateInventoryItem={onCreateInventoryItem}
        />
      );
    case "گردش‌ها":
      return (
        <InventoryPage
          onNavigate={onNavigate}
          notify={notify}
          operations={operations}
          operationsLoading={operationsLoading}
          onRefreshOperations={onRefreshOperations}
          onCreateInventoryItem={onCreateInventoryItem}
          initialView="movements"
        />
      );
    case "درخواست‌های قطعه":
      return (
        <PartRequestsPage
          onNavigate={onNavigate}
          notify={notify}
          operations={operations}
          operationsLoading={operationsLoading}
          onCreatePartRequest={onCreatePartRequest}
        />
      );
    case "تعهدهای داغی":
      return (
        <HotReturnsPage
          onNavigate={onNavigate}
          notify={notify}
          operations={operations}
          operationsLoading={operationsLoading}
          onRefreshOperations={onRefreshOperations}
        />
      );
    case "گزارش‌ها":
      return <ReportsPage notify={notify} operations={operations} />;
    case "ممیزی و رویدادها":
      return <AuditPage notify={notify} operations={operations} />;
    case "تنظیمات":
      return (
        <SettingsPage
          notify={notify}
          workspace={workspace}
          deviceCatalog={deviceCatalog}
          setDeviceCatalog={setDeviceCatalog}
          operations={operations}
          shopSettings={shopSettings}
          setShopSettings={setShopSettings}
        />
      );
    default:
      return <EmptyState title={title} onNavigate={onNavigate} />;
  }
}

function ModuleHeader({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="module-header">
      <div className="module-header-copy">
        <div className="module-title-icon">{icon}</div>
        <div>
          <span className="module-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children && <div className="module-header-actions">{children}</div>}
    </section>
  );
}

const defaultAppearanceStates = [
  "بدون ایراد ظاهری",
  "خط‌وخش",
  "ترک یا شکستگی",
  "فرورفتگی",
  "آثار ضربه",
  "آثار آب‌خوردگی",
  "تغییر رنگ یا سوختگی",
  "بازشدگی قبلی",
];
const iranProvinceCities: Record<string, string[]> = {
  "آذربایجان شرقی": ["تبریز", "مراغه", "مرند", "میانه"],
  "آذربایجان غربی": ["ارومیه", "خوی", "مهاباد", "میاندوآب"],
  اردبیل: ["اردبیل", "پارس‌آباد", "مشگین‌شهر"],
  اصفهان: ["اصفهان", "کاشان", "نجف‌آباد", "خمینی‌شهر"],
  البرز: ["کرج", "فردیس", "نظرآباد"],
  ایلام: ["ایلام", "دهلران", "آبدانان"],
  بوشهر: ["بوشهر", "برازجان", "گناوه"],
  تهران: ["تهران", "شهریار", "اسلام‌شهر", "ورامین"],
  "چهارمحال و بختیاری": ["شهرکرد", "بروجن", "لردگان"],
  "خراسان جنوبی": ["بیرجند", "قائن", "طبس"],
  "خراسان رضوی": ["مشهد", "نیشابور", "سبزوار", "تربت حیدریه"],
  "خراسان شمالی": ["بجنورد", "شیروان", "اسفراین"],
  خوزستان: ["اهواز", "آبادان", "خرمشهر", "دزفول"],
  زنجان: ["زنجان", "ابهر", "خرمدره"],
  سمنان: ["سمنان", "شاهرود", "دامغان"],
  "سیستان و بلوچستان": ["زاهدان", "چابهار", "ایرانشهر"],
  فارس: ["شیراز", "مرودشت", "جهرم", "لار"],
  قزوین: ["قزوین", "تاکستان", "الوند"],
  قم: ["قم"],
  کردستان: ["سنندج", "سقز", "مریوان", "بانه"],
  کرمان: ["کرمان", "رفسنجان", "سیرجان", "بم"],
  کرمانشاه: ["کرمانشاه", "اسلام‌آباد غرب", "کنگاور"],
  "کهگیلویه و بویراحمد": ["یاسوج", "دوگنبدان", "دهدشت"],
  گلستان: ["گرگان", "گنبد کاووس", "علی‌آباد"],
  گیلان: ["رشت", "بندر انزلی", "لاهیجان", "لنگرود"],
  لرستان: ["خرم‌آباد", "بروجرد", "دورود"],
  مازندران: ["ساری", "بابل", "آمل", "قائم‌شهر"],
  مرکزی: ["اراک", "ساوه", "خمین"],
  هرمزگان: ["بندرعباس", "قشم", "میناب"],
  همدان: ["همدان", "ملایر", "نهاوند"],
  یزد: ["یزد", "میبد", "اردکان"],
};
const operationalNumber = new Intl.NumberFormat("fa-IR");

function moduleErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FollowUpApiError)
    return `${error.message}${error.trackingCode ? ` · کد رهگیری ${error.trackingCode}` : ""}`;
  return error instanceof Error ? error.message : fallback;
}

function operationalDate(value: string) {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function followUpHistoryBody(body: string | undefined, type: string) {
  const source = body || type;
  return source
    .replaceAll("in_progress", "در حال پیگیری")
    .replaceAll("new", "جدید")
    .replaceAll("seen", "دیده‌شده")
    .replaceAll("done", "انجام‌شده")
    .replaceAll("status_changed", "تغییر وضعیت")
    .replaceAll("reminder_changed", "تغییر یادآوری")
    .replaceAll("assigned", "تغییر مسئول")
    .replaceAll("commented", "ثبت پاسخ")
    .replaceAll("created", "ایجاد پیگیری");
}

function normalizeDigits(value: string) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return value
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/\D/g, "")
    .slice(0, 11);
}
function validIranNationalCode(value: string) {
  const code = normalizeDigits(value).slice(0, 10);
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
  const sum = code
    .slice(0, 9)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const remainder = sum % 11;
  return (remainder < 2 ? remainder : 11 - remainder) === Number(code[9]);
}

function receptionIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `reception-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function ReceptionPage({
  onNavigate,
  notify,
  workspace,
  deviceCatalog = [],
  setDeviceCatalog,
  operations = emptyOperationalSnapshot,
  onCreateRepairCase,
  shopSettings = {},
}: PageProps) {
  const receiptTemplate = (shopSettings.receipt_template ?? {}) as {
    printSize?: string;
    title?: string;
    phone?: string;
    portal?: string;
    clauses?: Array<{ enabled: boolean; text: string }>;
    appearanceOptions?: string[];
  };
  const activeReceiptTerms = parseActiveReceiptTerms(
    shopSettings.__activeReceiptTerms,
  );
  const activeReceiptTermsKey = activeReceiptTerms
    ? receiptTermsKey(activeReceiptTerms)
    : "";
  const assignmentSettings = (shopSettings.assignment_policy ?? {}) as {
    branches?: Record<
      string,
      {
        defaultTechnicianId?: number | null;
        autoAssignSingleTechnician?: boolean;
      }
    >;
  };
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepFormRef = React.useRef<HTMLDivElement>(null);
  const previousStepRef = React.useRef(step);
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    stepFormRef.current?.focus();
    stepFormRef.current?.scrollIntoView({ block: "start" });
  }, [step]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(receptionIdempotencyKey);
  const [draftSubmission, setDraftSubmission] = useState<{
    publicId: string;
    version: number;
  } | null>(null);
  const [draftMutationQueue] = useState(createReceptionDraftMutationQueue);
  const [draftMutationError, setDraftMutationError] = useState("");
  const [draftConflict, setDraftConflict] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const draftRestoredRef = React.useRef(false);
  const restoredCustomerMobileRef = React.useRef<string | null>(null);
  const restoredPreviousDeviceIdRef = React.useRef<number | null>(null);
  const submissionInFlightRef = React.useRef(false);
  const [restoringPreviousDevice, setRestoringPreviousDevice] = useState(false);
  const [createdCase, setCreatedCase] = useState<RepairCaseRecord | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState("");
  const [accessories, setAccessories] = useState<string[]>(["بدون لوازم"]);
  const [appearanceStates, setAppearanceStates] = useState<string[]>([]);
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [acceptedReceiptTermsContextKey, setAcceptedReceiptTermsContextKey] =
    useState("");
  const [nationalCode, setNationalCode] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerProvince, setCustomerProvince] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [secondaryMobile, setSecondaryMobile] = useState("");
  const [preapprovedAmount, setPreapprovedAmount] = useState("");
  const [promisedAt, setPromisedAt] = useState("");
  const [temporaryDeviceSecret, setTemporaryDeviceSecret] = useState("");
  const [dataHandling, setDataHandling] = useState<
    "" | "no_erasure" | "coordinate_first" | "erase_authorized"
  >("");
  const [catalogCreateOpen, setCatalogCreateOpen] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState({
    type: "",
    brand: "",
    model: "",
  });
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [customerChoice, setCustomerChoice] = useState<
    "new" | "history" | null
  >(null);
  const [selectedPreviousDevice, setSelectedPreviousDevice] =
    useState<PreviousCustomerDevice | null>(null);
  const [selectedCatalogItem, setSelectedCatalogItem] =
    useState<DeviceCatalogItem | null>(null);
  const [declaredIssue, setDeclaredIssue] = useState("");
  const [receptionNotes, setReceptionNotes] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [deviceColor, setDeviceColor] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState<
    number | "queue" | null
  >(null);
  const [formError, setFormError] = useState("");
  const [customerLookup, setCustomerLookup] =
    useState<CustomerLookupResult | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const receiptAcceptanceContextKey = activeReceiptTermsKey
    ? `${activeReceiptTermsKey}:${customerMobile}:${customerName.trim()}`
    : "";
  const receiptTermsAccepted =
    receiptAcceptanceContextKey !== "" &&
    acceptedReceiptTermsContextKey === receiptAcceptanceContextKey;
  const errorRef = React.useRef<HTMLDivElement>(null);
  const addressPolicy = (shopSettings.customer_address_policy ?? {}) as {
    required?: boolean;
  };
  const deviceColors = normalizeDeviceColors(shopSettings.device_colors).filter(
    (item) => item.active,
  );
  const appearanceOptions = receiptTemplate.appearanceOptions?.filter(Boolean)
    .length
    ? receiptTemplate.appearanceOptions.filter(Boolean)
    : defaultAppearanceStates;
  const profileKey = profileKeyForWorkshop(
    workspace?.repairType,
    selectedDeviceType,
  );
  const profile = serviceProfiles[profileKey];
  const formSettings = (shopSettings.service_forms ?? {}) as {
    orders?: Partial<Record<ServiceKey, string[]>>;
    policies?: Record<
      string,
      { mode: string; receipt: boolean; customer: boolean }
    >;
    terminology?: Partial<
      Record<
        ServiceKey,
        { itemLabel: string; identifierLabel: string; issueLabel: string }
      >
    >;
  };
  const terminology = formSettings.terminology?.[profileKey];
  const orderedLabels =
    formSettings.orders?.[profileKey] ??
    profile.fields.map((field) => field.label);
  const configuredFields = orderedLabels
    .map(
      (label) =>
        profile.fields.find((field) => field.label === label) ??
        ({ label, placeholder: `مقدار ${label}` } satisfies ServiceField),
    )
    .filter(
      (field) =>
        ![
          "نوع وسیله",
          "شرح کالا یا تجهیز",
          "برند",
          "مدل",
          "وضعیت ظاهری",
        ].includes(field.label) &&
        formSettings.policies?.[`${profileKey}|${field.label}`]?.mode !==
          "پنهان",
    );
  const identifierField = configuredFields.find(
    (field) =>
      field.label === "IMEI" ||
      field.label.includes("سریال") ||
      field.label === "پلاک" ||
      field.label === "شناسه",
  );
  const identifierRequired = Boolean(
    identifierField &&
    (identifierField.required ||
      formSettings.policies?.[`${profileKey}|${identifierField.label}`]
        ?.mode === "الزامی"),
  );
  const activeTechnicians = operations.users.filter(
    (user) => user.isActive && user.role === "technician",
  );
  const serviceAssignees = operations.users.filter(
    (user) =>
      user.isActive && ["technician", "repair_manager"].includes(user.role),
  );
  const eligibleAssignees = operations.users.filter(
    (user) =>
      user.isActive &&
      ["technician", "repair_manager", "quality_control"].includes(user.role),
  );
  const branchPolicy =
    assignmentSettings.branches?.[String(workspace?.branchId ?? "")] ?? {};
  const autoAssignSingle = branchPolicy.autoAssignSingleTechnician !== false;
  const singleAutoAssignee = autoAssignSingle
    ? activeTechnicians.length === 1
      ? activeTechnicians[0]
      : activeTechnicians.length === 0 && serviceAssignees.length === 1
        ? serviceAssignees[0]
        : null
    : null;
  const defaultAssignee = branchPolicy.defaultTechnicianId
    ? (serviceAssignees.find(
        (user) => user.id === branchPolicy.defaultTechnicianId,
      ) ?? null)
    : null;
  const unavailableDefault = Boolean(
    branchPolicy.defaultTechnicianId && !defaultAssignee,
  );
  const effectiveAssignedToUserId =
    singleAutoAssignee?.id ??
    (assignedToUserId === "queue"
      ? null
      : (assignedToUserId ?? defaultAssignee?.id ?? null));
  const customerCases = operations.cases.filter(
    (item) => item.customerMobile === customerMobile,
  );
  const fallbackCustomer: CustomerLookupResult | null =
    customerCases.length > 0
      ? {
          id: customerCases[0].customerId,
          name: customerCases[0].customerName,
          mobile: customerMobile,
          nationalCode: customerCases[0].nationalCode,
          devices: Array.from(
            new Map(
              customerCases.map((item) => [item.deviceId, item]),
            ).values(),
          ).map((item): PreviousCustomerDevice => ({
            id: item.deviceId,
            deviceModelId:
              deviceCatalog.find(
                (catalog) =>
                  catalog.deviceType === item.deviceType &&
                  catalog.brand === item.brand &&
                  catalog.model === item.model,
              )?.id ?? null,
            deviceType: item.deviceType,
            brand: item.brand,
            model: item.model,
            identifier: item.identifier,
            color: item.color,
            lastReceipt: item.receiptNumber,
            lastVisit: item.updatedAt,
            lastIssue: item.declaredIssue,
            lastStatus: item.status,
          })),
        }
      : null;
  const knownCustomer =
    customerLookup ?? (directAdminApiEnabled ? null : fallbackCustomer);

  useEffect(() => {
    if (draftRestoredRef.current) return;
    const latest = operations.receptionDrafts?.[0];
    if (!latest) return;
    draftRestoredRef.current = true;
    const draft = latest.payload;
    setIdempotencyKey(latest.idempotencyKey);
    const restoredDraft = {
      publicId: latest.publicId,
      version: latest.version,
    };
    draftMutationQueue.replace(restoredDraft);
    setDraftSubmission(restoredDraft);
    setStep(
      draft.step === 2 || draft.step === 3 ? draft.step : 1,
    );
    const restoredMobile = String(draft.customerMobile ?? "");
    restoredCustomerMobileRef.current = restoredMobile;
    restoredPreviousDeviceIdRef.current = typeof draft.previousDeviceId === "number" ? draft.previousDeviceId : null;
    setRestoringPreviousDevice(restoredPreviousDeviceIdRef.current !== null);
    setCustomerChoice(draft.customerChoice === "history" ? "history" : "new");
    setAssignedToUserId(draft.assignedToUserId === "queue" ? "queue" : typeof draft.assignedToUserId === "number" ? draft.assignedToUserId : null);
    setCustomerMobile(restoredMobile);
    setCustomerName(String(draft.customerName ?? ""));
    setNationalCode(String(draft.nationalCode ?? ""));
    setSecondaryMobile(String(draft.secondaryMobile ?? ""));
    setCustomerProvince(String(draft.customerProvince ?? ""));
    setCustomerCity(String(draft.customerCity ?? ""));
    setCustomerAddress(String(draft.customerAddress ?? ""));
    setCustomerPostalCode(String(draft.customerPostalCode ?? ""));
    setIdentifier(String(draft.identifier ?? ""));
    setDeviceColor(String(draft.color ?? ""));
    setDeclaredIssue(String(draft.declaredIssue ?? ""));
    setReceptionNotes(String(draft.receptionNotes ?? ""));
    setPreapprovedAmount(String(draft.preapprovedAmount ?? ""));
    setPromisedAt(String(draft.promisedAt ?? ""));
    if (["no_erasure", "coordinate_first", "erase_authorized"].includes(String(draft.dataHandling)))
      setDataHandling(draft.dataHandling as "no_erasure" | "coordinate_first" | "erase_authorized");
    if (Array.isArray(draft.accessories)) setAccessories(draft.accessories.map(String));
    if (Array.isArray(draft.appearanceStates)) setAppearanceStates(draft.appearanceStates.map(String));
    const catalogItem = deviceCatalog.find((item) => item.id === Number(draft.deviceModelId));
    if (catalogItem) {
      setSelectedCatalogItem(catalogItem);
      setSelectedDeviceType(catalogItem.deviceType);
    }
    notify("پیش‌نویس ذخیره‌شده پذیرش بازیابی شد.");
  }, [deviceCatalog, operations.receptionDrafts, draftMutationQueue]);

  useEffect(() => {
    if (
      !directAdminApiEnabled ||
      createdCase || savingReceipt || submissionInFlightRef.current ||
      (!customerMobile && !customerName)
    )
      return;
    const timer = window.setTimeout(() => {
      const payload = {
        step,
        customerMobile,
        customerName,
        nationalCode,
        secondaryMobile,
        customerProvince,
        customerCity,
        customerAddress,
        customerPostalCode,
        deviceModelId: selectedCatalogItem?.id ?? null,
        previousDeviceId: selectedPreviousDevice?.id ?? restoredPreviousDeviceIdRef.current,
        customerChoice,
        assignedToUserId,
        identifier,
        color: deviceColor,
        accessories,
        appearanceStates,
        declaredIssue,
        receptionNotes,
        preapprovedAmount,
        promisedAt,
        dataHandling,
      };
      void draftMutationQueue
        .enqueueSave(async (expectedVersion) => {
          try {
            return await saveReceptionDraft(
              idempotencyKey,
              payload,
              expectedVersion,
            );
          } catch (error) {
            if (isDirectAdminConflict(error)) draftMutationQueue.pause();
            throw error;
          }
        })
        .then((result) => {
          if (!result) return;
          setDraftSubmission(result);
          setDraftMutationError("");
          setDraftConflict(false);
        })
        .catch((error: unknown) => {
          const conflict = isDirectAdminConflict(error);
          setDraftConflict(conflict);
          setDraftMutationError(
            conflict
              ? "نسخه پیش‌نویس در جای دیگری تغییر کرده است. برای جلوگیری از بازنویسی، نسخه ذخیره‌شده را دوباره بازیابی کنید."
              : moduleErrorMessage(
                  error,
                  "ذخیره خودکار پیش‌نویس انجام نشد؛ دوباره تلاش کنید.",
                ),
          );
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    step,
    customerMobile,
    customerName,
    nationalCode,
    secondaryMobile,
    customerProvince,
    customerCity,
    customerAddress,
    customerPostalCode,
    selectedCatalogItem?.id,
    selectedPreviousDevice?.id,
    customerChoice,
    assignedToUserId,
    savingReceipt,
    identifier,
    deviceColor,
    accessories,
    appearanceStates,
    declaredIssue,
    receptionNotes,
    preapprovedAmount,
    promisedAt,
    dataHandling,
    idempotencyKey,
    createdCase,
    draftMutationQueue,
  ]);

  const discardSavedDraft = async () => {
    if (!draftSubmission) return;
    if (!window.confirm("پیش‌نویس ذخیره‌شده پذیرش حذف شود؟")) return;
    setDiscardingDraft(true);
    setDraftMutationError("");
    draftMutationQueue.pause();
    try {
      await draftMutationQueue.settled();
      const selection = buildDraftDiscardSelection(
        draftMutationQueue.current(),
      );
      await discardReceptionDraft(
        selection.publicId,
        selection.expectedVersion,
      );
      draftMutationQueue.replace(null);
      setDraftSubmission(null);
      window.location.reload();
    } catch (error) {
      const conflict = isDirectAdminConflict(error);
      setDraftConflict(conflict);
      setDraftMutationError(
        conflict
          ? "نسخه پیش‌نویس پیش از حذف تغییر کرده است. نسخه ذخیره‌شده را دوباره بازیابی کنید."
          : moduleErrorMessage(error, "حذف پیش‌نویس انجام نشد."),
      );
      if (!conflict) draftMutationQueue.resume();
    } finally {
      setDiscardingDraft(false);
    }
  };

  const showFormError = (message: string) => {
    setFormError(message);
    window.requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      errorRef.current?.focus();
    });
  };

  useEffect(() => {
    if (customerMobile.length !== 11 || !directAdminApiEnabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setCustomerLoading(true);
      lookupCustomer(customerMobile)
        .then(({ customer }) => {
          if (!active) return;
          setCustomerLookup(customer);
          const restoringDraft = restoredCustomerMobileRef.current === customerMobile;
          if (customer) {
            // Lookup refreshes ownership/device metadata. Restored form edits are
            // authoritative for this draft and must not be replaced by old DB values.
            if (!restoringDraft) {
              setCustomerName(customer.name);
              setNationalCode(customer.nationalCode);
              setCustomerAddress(customer.address ?? "");
              setCustomerProvince(customer.province ?? "");
              setCustomerCity(customer.city ?? "");
              setCustomerPostalCode(customer.postalCode ?? "");
              setSecondaryMobile(customer.secondaryMobile ?? "");
              setCustomerChoice(customer.devices.length ? null : "new");
            }
            const previousId = restoredPreviousDeviceIdRef.current;
            if (previousId !== null) {
              const ownedDevice = customer.devices.find(device => device.id === previousId);
              if (!ownedDevice) {
                setFormError("دستگاه پیش‌نویس در سابقه این مشتری پیدا نشد؛ دستگاه را دوباره انتخاب کنید.");
                setStep(1);
              } else {
                setSelectedPreviousDevice(ownedDevice);
                setCustomerChoice("history");
              }
              restoredPreviousDeviceIdRef.current = null;
            }
          } else {
            if (restoredPreviousDeviceIdRef.current !== null) {
              setFormError("مشتری دستگاه قبلی قابل بازیابی نیست؛ سابقه را دوباره انتخاب کنید.");
              setStep(1);
            }
            setCustomerChoice("new");
          }
        })
        .catch((error: unknown) => {
          if (active)
            setFormError(
              moduleErrorMessage(error, "جست‌وجوی سابقه مشتری انجام نشد."),
            );
        })
        .finally(() => {
          if (active) {
            setCustomerLoading(false);
            setRestoringPreviousDevice(false);
          }
        });
    }, 320);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerMobile]);

  const updateCustomerMobile = (value: string) => {
    const normalized = normalizeDigits(value);
    restoredCustomerMobileRef.current = null;
    restoredPreviousDeviceIdRef.current = null;
    setRestoringPreviousDevice(false);
    setCustomerMobile(normalized);
    setCustomerLookup(null);
    setCustomerName("");
    setNationalCode("");
    setCustomerAddress("");
    setCustomerProvince("");
    setCustomerCity("");
    setCustomerPostalCode("");
    setSecondaryMobile("");
    setCustomerChoice(normalized.length === 11 ? "new" : null);
    setSelectedPreviousDevice(null);
    setSelectedCatalogItem(null);
    setSelectedDeviceType("");
    setIdentifier("");
    setDeclaredIssue("");
    setReceptionNotes("");
    setAccessories(["بدون لوازم"]);
    setAppearanceStates([]);
    setFormError("");
    setPreapprovedAmount("");
    setPromisedAt("");
    setTemporaryDeviceSecret("");
    setDataHandling("");
    setStep(1);
  };

  const selectPreviousDevice = (device: PreviousCustomerDevice) => {
    setCustomerChoice("history");
    setSelectedPreviousDevice(device);
    setSelectedDeviceType(device.deviceType);
    setAccessories(["بدون لوازم"]);
    setAppearanceStates([]);
    setDeclaredIssue("");
    setReceptionNotes("");
    setIdentifier(device.identifier);
    setDeviceColor(device.color || "");
    setSelectedCatalogItem(
      deviceCatalog.find(
        (item) => item.id === device.deviceModelId && item.isActive,
      ) ??
        deviceCatalog.find(
          (item) =>
            item.isActive &&
            item.deviceType === device.deviceType &&
            item.brand === device.brand &&
            item.model === device.model,
        ) ??
        null,
    );
  };

  const selectCatalogItem = (item: DeviceCatalogItem | null) => {
    setSelectedCatalogItem(item);
    if (!item) return;
    setSelectedDeviceType(item.deviceType);
    if (
      selectedPreviousDevice &&
      (selectedPreviousDevice.deviceType !== item.deviceType ||
        selectedPreviousDevice.brand !== item.brand ||
        selectedPreviousDevice.model !== item.model)
    ) {
      setSelectedPreviousDevice(null);
      setCustomerChoice("new");
    }
    setAccessories(["بدون لوازم"]);
  };

  const toggleAppearance = (item: string) =>
    setAppearanceStates((current) => {
      if (item === "بدون ایراد ظاهری")
        return current.includes(item) ? [] : [item];
      const withoutClear = current.filter(
        (value) => value !== "بدون ایراد ظاهری",
      );
      return withoutClear.includes(item)
        ? withoutClear.filter((value) => value !== item)
        : [...withoutClear, item];
    });

  const toggleAccessory = (item: string) =>
    setAccessories((current) => {
      if (item === "بدون لوازم" || item === "بدون اقلام") return [item];
      const withoutNone = current.filter(
        (value) => value !== "بدون لوازم" && value !== "بدون اقلام",
      );
      return withoutNone.includes(item)
        ? withoutNone.filter((value) => value !== item)
        : [...withoutNone, item];
    });

  const validateCustomerStep = () => {
    if (!/^09\d{9}$/.test(customerMobile) || !customerName.trim()) {
      showFormError(
        "شماره موبایل معتبر و نام و نام خانوادگی مشتری را کامل کنید.",
      );
      return false;
    }
    if (
      workspace?.nationalCodeRequired &&
      !validIranNationalCode(nationalCode)
    ) {
      showFormError(
        "کد ملی اجباری است و باید با الگوریتم کد ملی ایران معتبر باشد.",
      );
      return false;
    }
    if (nationalCode.trim() && !validIranNationalCode(nationalCode)) {
      showFormError("کد ملی واردشده معتبر نیست.");
      return false;
    }
    if (
      addressPolicy.required &&
      (!customerProvince ||
        !customerCity ||
        !customerAddress.trim() ||
        customerPostalCode.length !== 10)
    ) {
      showFormError("استان، شهر، آدرس و کد پستی ۱۰ رقمی مشتری را کامل کنید.");
      return false;
    }
    if (knownCustomer?.devices.length && customerChoice === null) {
      showFormError(
        "مشخص کنید پذیرش برای محصول جدید است یا یکی از محصولات قبلی مشتری.",
      );
      return false;
    }
    if (customerChoice === "history" && !selectedPreviousDevice) {
      showFormError(
        "برای پذیرش مجدد، یکی از محصولات قبلی مشتری را انتخاب کنید.",
      );
      return false;
    }
    return true;
  };

  const continueReception = () => {
    setFormError("");
    if (step === 1) {
      if (validateCustomerStep()) setStep(2);
      return;
    }
    if (!selectedCatalogItem || !selectedDeviceType) {
      showFormError(
        "نوع محصول، برند و مدل را از فهرست تعریف‌شده در تنظیمات انتخاب کنید.",
      );
      return;
    }
    if (identifierRequired && !identifier.trim()) {
      showFormError(
        `${terminology?.identifierLabel || identifierField?.label || "شناسه محصول"} را کامل کنید.`,
      );
      return;
    }
    const colorFieldVisible = configuredFields.some((field) => field.label.includes("رنگ"));
    if (colorFieldVisible && !deviceColor) {
      showFormError("رنگ دستگاه را از فهرست اطلاعات پایه انتخاب کنید.");
      return;
    }
    setStep(3);
  };

  const submitReceipt = async () => {
    if (submissionInFlightRef.current) return;
    if (restoringPreviousDevice) {
      showFormError("در حال بررسی دستگاه ذخیره‌شده؛ کمی صبر کنید.");
      return;
    }
    if (restoredPreviousDeviceIdRef.current !== null || (customerChoice === "history" && !selectedPreviousDevice)) {
      showFormError("دستگاه قبلی تأیید نشده است؛ سابقه مشتری را دوباره انتخاب کنید.");
      setStep(1);
      return;
    }
    if (
      !customerName.trim() ||
      customerMobile.length !== 11 ||
      !selectedDeviceType ||
      !selectedCatalogItem ||
      !declaredIssue.trim()
    ) {
      showFormError("اطلاعات مشتری، محصول و ایراد اعلامی را کامل کنید.");
      return;
    }
    if (!dataHandling) {
      showFormError("مجوز حذف اطلاعات دستگاه را انتخاب کنید.");
      return;
    }
    if (
      workspace?.nationalCodeRequired &&
      !validIranNationalCode(nationalCode)
    ) {
      showFormError("کد ملی اجباری است و باید معتبر باشد.");
      return;
    }
    if (nationalCode.trim() && !validIranNationalCode(nationalCode)) {
      showFormError("کد ملی واردشده معتبر نیست.");
      return;
    }
    if (
      addressPolicy.required &&
      (!customerProvince ||
        !customerCity ||
        !customerAddress.trim() ||
        customerPostalCode.length !== 10)
    ) {
      showFormError("آدرس کامل مشتری طبق تنظیمات تعمیرگاه الزامی است.");
      return;
    }
    if (!onCreateRepairCase) {
      showFormError("امکان ثبت پذیرش در این نسخه فعال نیست.");
      return;
    }
    let receiptAcceptance;
    let versionedDraft;
    let versionedDevice;
    try {
      receiptAcceptance = buildReceiptAcceptance(
        activeReceiptTerms,
        receiptTermsAccepted ? activeReceiptTermsKey : "",
      );
      versionedDevice = buildPreviousDeviceSelection(selectedPreviousDevice);
    } catch (error) {
      showFormError(
        moduleErrorMessage(error, "تأیید شرایط پذیرش انجام نشده است."),
      );
      return;
    }
    setFormError("");
    submissionInFlightRef.current = true;
    setSavingReceipt(true);
    draftMutationQueue.pause();
    let submitted = false;
    try {
      await draftMutationQueue.settled();
      versionedDraft = buildDraftSubmissionSelection(draftMutationQueue.current());
      const saved = await onCreateRepairCase({
        idempotencyKey,
        ...versionedDraft,
        customerName: customerName.trim(),
        customerMobile,
        secondaryMobile: secondaryMobile || undefined,
        nationalCode: nationalCode.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        customerProvince: customerProvince || undefined,
        customerCity: customerCity || undefined,
        customerPostalCode: customerPostalCode || undefined,
        deviceModelId: selectedCatalogItem.id,
        identifier: identifier.trim() || undefined,
        color: deviceColor,
        declaredIssue: declaredIssue.trim(),
        accessories,
        appearanceStates,
        receptionNotes: receptionNotes.trim() || undefined,
        assignedToUserId: effectiveAssignedToUserId,
        assignmentMode: assignedToUserId === "queue" ? "queue" : "automatic",
        ...versionedDevice,
        preapprovedAmount: Number(preapprovedAmount || 0),
        promisedAt: promisedAt ? `${promisedAt} 12:00:00` : undefined,
        temporaryDeviceSecret: temporaryDeviceSecret || undefined,
        customerConsent: {
          dataHandling,
          acceptanceMethod: "recorded_consent",
        },
        receiptAcceptance,
      });
      submitted = true;
      setCreatedCase(saved);
      setReceiptOpen(true);
      notify(`پذیرش ثبت شد؛ شماره رسید ${saved.receiptNumber}`);
    } catch (error) {
      showFormError(moduleErrorMessage(error, "ثبت پذیرش انجام نشد."));
    } finally {
      submissionInFlightRef.current = false;
      if (!submitted) draftMutationQueue.resume();
      setSavingReceipt(false);
    }
  };

  const createCatalogQuickly = async () => {
    if (
      !catalogDraft.type.trim() ||
      !catalogDraft.brand.trim() ||
      !catalogDraft.model.trim()
    ) {
      showFormError("نوع، برند و مدل محصول جدید را کامل کنید.");
      return;
    }
    setCatalogSaving(true);
    try {
      await createCatalogItem({
        type: catalogDraft.type.trim(),
        brand: catalogDraft.brand.trim(),
        model: catalogDraft.model.trim(),
      });
      const catalog = await loadCatalog();
      setDeviceCatalog?.(catalog);
      const created =
        catalog.find(
          (item) =>
            item.deviceType === catalogDraft.type.trim() &&
            item.brand === catalogDraft.brand.trim() &&
            item.model === catalogDraft.model.trim(),
        ) ?? null;
      if (created) selectCatalogItem(created);
      setCatalogCreateOpen(false);
      setCatalogDraft({ type: "", brand: "", model: "" });
      notify("محصول جدید ثبت و بدون از دست‌رفتن پذیرش انتخاب شد.");
    } catch (error) {
      showFormError(moduleErrorMessage(error, "ثبت محصول جدید انجام نشد."));
    } finally {
      setCatalogSaving(false);
    }
  };

  const stages = [
    { id: 1, title: "مشتری", description: "موبایل و سوابق" },
    { id: 2, title: "محصول", description: "مشخصات و لوازم" },
    { id: 3, title: "پذیرش", description: "وضعیت و شرح" },
  ] as const;

  return (
    <div className="reception-page">
      <ModuleHeader
        icon={<ClipboardList size={26} />}
        eyebrow={`پذیرش · ${workspace?.branch ?? "شعبه جاری"}`}
        title="ثبت پذیرش جدید"
        description="پذیرش در سه مرحله ثبت می‌شود و پرونده فقط با تأیید نهایی ساخته خواهد شد."
      >
        {draftSubmission && (
          <button
            type="button"
            className="outline-action"
            disabled={discardingDraft}
            onClick={() => void discardSavedDraft()}
            title={`نسخه ${draftSubmission.version}`}
          >
            <X size={18} />
            {discardingDraft ? "در حال حذف..." : "حذف پیش‌نویس"}
          </button>
        )}
        <button
          type="button"
          className="outline-action"
          onClick={() => onNavigate("پیگیری مشتری")}
        >
          <FileSearch size={18} />
          پیگیری رسید
        </button>
      </ModuleHeader>

      <div className="form-progress" aria-label="مراحل پذیرش">
        {stages.map((stage, index) => (
          <div className="form-progress-fragment" key={stage.id}>
            {index > 0 && <i />}
            <div
              className={`form-progress-item ${step > stage.id ? "done" : step === stage.id ? "active" : ""}`}
              aria-current={step === stage.id ? "step" : undefined}
            >
              <span>{step > stage.id ? <Check size={15} /> : stage.id}</span>
              <strong>{stage.title}</strong>
              <small>{stage.description}</small>
            </div>
          </div>
        ))}
      </div>

      {draftMutationError && (
        <div
          className="form-error-summary reception-error-summary"
          role="alert"
          aria-live="assertive"
        >
          <CircleAlert size={20} />
          <div>
            <strong>
              {draftConflict
                ? "تعارض نسخه پیش‌نویس"
                : "ذخیره پیش‌نویس انجام نشد"}
            </strong>
            <p>{draftMutationError}</p>
          </div>
          {draftConflict && (
            <button
              type="button"
              className="outline-action"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={17} />
              بازیابی نسخه ذخیره‌شده
            </button>
          )}
        </div>
      )}

      {formError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="form-error-summary reception-error-summary"
          role="alert"
        >
          <CircleAlert size={20} />
          <div>
            <strong>پذیرش هنوز ثبت نشده است</strong>
            <p>{formError}</p>
          </div>
        </div>
      )}

      <div className="reception-layout">
        <div className="form-stack" ref={stepFormRef} tabIndex={-1} role="group" aria-label={`فرم مرحله ${step} از ۳`}>
          {step === 1 && (
            <section className="form-card panel reception-step-card">
              <SectionTitle
                icon={<UserCog size={19} />}
                title="اطلاعات مشتری"
                badge="مرحله اول"
              />
              <div className="form-grid three-columns customer-first-grid">
                <label className="field-block customer-mobile-first">
                  <span>
                    شماره موبایل <b>*</b>
                  </span>
                  <div className="input-with-icon">
                    <Phone size={17} />
                    <input
                      dir="ltr"
                      autoFocus
                      value={customerMobile}
                      onChange={(event) =>
                        updateCustomerMobile(event.target.value)
                      }
                      placeholder="09xxxxxxxxx"
                      inputMode="numeric"
                      maxLength={11}
                      required
                    />
                  </div>
                  <small className="field-helper">
                    {customerLoading
                      ? "در حال جست‌وجوی سوابق مشتری..."
                      : "ابتدا موبایل را وارد کنید؛ اطلاعات و محصولات قبلی خودکار نمایش داده می‌شوند."}
                  </small>
                </label>
                <label className="field-block">
                  <span>
                    نام و نام خانوادگی <b>*</b>
                  </span>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder={
                      customerMobile.length === 11
                        ? "نام کامل مشتری"
                        : "ابتدا شماره موبایل را وارد کنید"
                    }
                    disabled={customerMobile.length !== 11}
                    required
                  />
                </label>
                <label className="field-block">
                  <span>
                    کد ملی {workspace?.nationalCodeRequired && <b>*</b>}
                  </span>
                  <input
                    value={nationalCode}
                    onChange={(event) =>
                      setNationalCode(
                        normalizeDigits(event.target.value).slice(0, 10),
                      )
                    }
                    placeholder={
                      workspace?.nationalCodeRequired
                        ? "اجباری · ۱۰ رقم"
                        : "اختیاری"
                    }
                    inputMode="numeric"
                    maxLength={10}
                  />
                  <small className="field-helper">
                    اعتبار کد ملی ایران هنگام ثبت کنترل می‌شود.
                  </small>
                </label>
                <label className="field-block">
                  <span>شماره تماس دوم</span>
                  <input
                    dir="ltr"
                    value={secondaryMobile}
                    onChange={(event) =>
                      setSecondaryMobile(normalizeDigits(event.target.value))
                    }
                    placeholder="اختیاری · 09xxxxxxxxx"
                    inputMode="numeric"
                    maxLength={11}
                  />
                </label>
                <div className="field-block reception-address-field">
                  <span>آدرس مشتری {addressPolicy.required && <b>*</b>}</span>
                  <button
                    type="button"
                    className="address-open-button"
                    onClick={() => setAddressOpen(true)}
                  >
                    <span>
                      {customerProvince && customerCity
                        ? `${customerProvince}، ${customerCity}${customerAddress ? ` · ${customerAddress}` : ""}`
                        : "افزودن یا ویرایش آدرس"}
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                  <small className="field-helper">
                    استان، شهر، نشانی و کد پستی در یک پنجره جدا ثبت می‌شوند.
                  </small>
                </div>
              </div>

              {knownCustomer && customerChoice === null && (
                <div className="customer-history-alert">
                  <span>
                    <History size={22} />
                  </span>
                  <div>
                    <strong>این مشتری سابقه پذیرش دارد.</strong>
                    <p>
                      {knownCustomer.devices.length} محصول قبلی برای{" "}
                      {knownCustomer.name} پیدا شد. پذیرش برای محصول جدید است یا
                      یکی از سوابق؟
                    </p>
                  </div>
                  <button
                    type="button"
                    className="outline-action"
                    onClick={() => {
                      setCustomerChoice("new");
                      setSelectedPreviousDevice(null);
                      setSelectedCatalogItem(null);
                    }}
                  >
                    پذیرش محصول جدید
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => setCustomerChoice("history")}
                  >
                    <History size={16} />
                    انتخاب از سوابق
                  </button>
                </div>
              )}

              {knownCustomer && customerChoice === "history" && (
                <div className="previous-devices-panel">
                  <div className="previous-devices-head">
                    <div>
                      <strong>محصولات قبلی مشتری</strong>
                      <span>برای پذیرش مجدد یکی از موارد را انتخاب کنید.</span>
                    </div>
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => {
                        setCustomerChoice("new");
                        setSelectedPreviousDevice(null);
                        setSelectedCatalogItem(null);
                      }}
                    >
                      ثبت محصول جدید
                    </button>
                  </div>
                  <div className="previous-device-grid">
                    {knownCustomer.devices.map((device) => (
                      <button
                        type="button"
                        key={device.id}
                        className={
                          selectedPreviousDevice?.id === device.id
                            ? "selected"
                            : ""
                        }
                        onClick={() => selectPreviousDevice(device)}
                      >
                        <span>
                          <Smartphone size={20} />
                        </span>
                        <div>
                          <strong>
                            {displayDeviceType(device.deviceType)} ·{" "}
                            {device.brand} {device.model}
                          </strong>
                          <small>
                            {device.lastIssue || "بدون شرح قبلی"} ·{" "}
                            {operationalDate(device.lastVisit)}
                          </small>
                          <em>{device.lastReceipt || "رسید قبلی نامشخص"}</em>
                        </div>
                        <b>
                          {device.lastStatus
                            ? repairCaseStatusLabels[device.lastStatus]
                            : "سابقه محصول"}
                        </b>
                        {selectedPreviousDevice?.id === device.id ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <ChevronLeft size={18} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <>
              <section className="form-card panel reception-step-card">
                <SectionTitle
                  icon={<Smartphone size={19} />}
                  title="مشخصات محصول"
                  badge="مرحله دوم"
                />
                {selectedPreviousDevice && (
                  <div className="reused-device-banner">
                    <History size={18} />
                    <div>
                      <strong>
                        پذیرش مجدد از سابقه {selectedPreviousDevice.lastReceipt}
                      </strong>
                      <span>
                        نوع، برند، مدل و شناسه پیشنهاد شده‌اند؛ لوازم، وضعیت
                        ظاهری و شرح این مراجعه خالی مانده‌اند.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreviousDevice(null);
                        setSelectedCatalogItem(null);
                        setCustomerChoice("new");
                      }}
                    >
                      تغییر محصول
                    </button>
                  </div>
                )}
                <div className="form-grid four-columns">
                  <div className="catalog-select-with-create">
                    <SearchableCatalogSelect
                      items={deviceCatalog}
                      selected={selectedCatalogItem}
                      onSelect={selectCatalogItem}
                    />
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => setCatalogCreateOpen(true)}
                    >
                      <Plus size={15} />
                      تعریف سریع دستگاه جدید
                    </button>
                  </div>
                  {configuredFields.map((field) =>
                    field.label.includes("رنگ") ? (
                      <label className="field-block" key={field.label}>
                        <span>رنگ دستگاه <b>*</b></span>
                        <select
                          value={deviceColor}
                          onChange={(event) => setDeviceColor(event.target.value)}
                        >
                          <option value="">انتخاب رنگ</option>
                          {deviceColors.map((color) => (
                            <option value={color.name} key={color.id}>{color.name}</option>
                          ))}
                        </select>
                        <small className="field-helper">فهرست رنگ‌ها از تنظیمات تعمیرگاه مدیریت می‌شود.</small>
                      </label>
                    ) : field.options ? (
                      <SelectField
                        key={field.label}
                        label={field.label}
                        required={field.required}
                        options={field.options}
                      />
                    ) : field.label === "IMEI" ||
                      field.label.includes("سریال") ||
                      field.label === "پلاک" ||
                      field.label === "شناسه" ? (
                      <label className="field-block" key={field.label}>
                        <span>
                          {terminology?.identifierLabel || field.label}{" "}
                          {(formSettings.policies?.[
                            `${profileKey}|${field.label}`
                          ]?.mode === "الزامی" ||
                            field.required) && <b>*</b>}
                        </span>
                        <div className="input-with-icon">
                          <Fingerprint size={17} />
                          <input
                            value={identifier}
                            onChange={(event) =>
                              setIdentifier(event.target.value)
                            }
                            placeholder={field.placeholder}
                            inputMode={field.inputMode}
                            maxLength={field.maxLength}
                          />
                        </div>
                        {field.helper && (
                          <small className="field-helper">{field.helper}</small>
                        )}
                      </label>
                    ) : (
                      <Field
                        key={field.label}
                        label={field.label}
                        required={
                          formSettings.policies?.[
                            `${profileKey}|${field.label}`
                          ]?.mode === "الزامی" || field.required
                        }
                        placeholder={field.placeholder}
                        inputMode={field.inputMode}
                        maxLength={field.maxLength}
                        pattern={field.pattern}
                        helper={field.helper}
                        sensitive={field.sensitive}
                        icon={
                          field.label.includes("سریال") ? (
                            <Fingerprint size={17} />
                          ) : undefined
                        }
                      />
                    ),
                  )}
                </div>
              </section>

              <section className="form-card panel reception-step-card">
                <SectionTitle
                  icon={<PackageOpen size={19} />}
                  title="لوازم همراه این مراجعه"
                  badge="ثبت فیزیکی"
                />
                <p className="appearance-help">
                  لوازم همراه از پذیرش قبلی کپی نمی‌شوند و باید برای همین مراجعه
                  دوباره ثبت شوند.
                </p>
                <div className="choice-chips">
                  {profile.accessories.map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={accessories.includes(item)}
                      className={accessories.includes(item) ? "selected" : ""}
                      onClick={() => toggleAccessory(item)}
                    >
                      {accessories.includes(item) && <Check size={14} />}
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {step === 3 && (
            <>
              <section className="form-card panel appearance-state-card reception-step-card">
                <SectionTitle
                  icon={<CircleAlert size={19} />}
                  title="وضعیت ظاهری فعلی"
                  badge="چندانتخابی"
                />
                <p className="appearance-help">
                  فقط وضعیت همین مراجعه را انتخاب کنید؛ این موارد از سابقه قبلی
                  کپی نمی‌شوند.
                </p>
                <div className="choice-chips appearance-choice-chips">
                  {appearanceOptions.map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={appearanceStates.includes(item)}
                      className={
                        appearanceStates.includes(item) ? "selected" : ""
                      }
                      onClick={() => toggleAppearance(item)}
                    >
                      {appearanceStates.includes(item) && <Check size={14} />}
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="form-card panel reception-step-card">
                <SectionTitle
                  icon={<ClipboardCheck size={19} />}
                  title="شرح پذیرش"
                  badge="مرحله پایانی"
                />
                <label className="field-block">
                  <span>
                    {terminology?.issueLabel ||
                      `ایراد اعلامی ${terminology?.itemLabel || profile.itemLabel}`}{" "}
                    <b>*</b>
                  </span>
                  <textarea
                    rows={3}
                    value={declaredIssue}
                    onChange={(event) => setDeclaredIssue(event.target.value)}
                    placeholder="شرح دقیق ایرادی که مشتری اعلام کرده است..."
                  />
                </label>
                <label className="field-block form-row-gap internal-reception-note">
                  <span>
                    <LockKeyhole size={15} />
                    شرح داخلی پذیرش
                  </span>
                  <textarea
                    rows={3}
                    value={receptionNotes}
                    onChange={(event) => setReceptionNotes(event.target.value)}
                    placeholder="نکته داخلی برای تکنسین؛ مانند شرایط خاص هنگام دریافت یا نکته‌ای که نباید روی قبض چاپ شود..."
                  />
                  <small className="field-helper">
                    این متن فقط داخل پرونده و کارتابل تکنسین دیده می‌شود و روی
                    قبض یا پرتال مشتری نمایش داده نخواهد شد.
                  </small>
                </label>
                <div className="form-grid three-columns reception-v2-terms">
                  <label className="field-block">
                    <span>سقف تأیید هزینه در پذیرش</span>
                    <input
                      inputMode="numeric"
                      value={preapprovedAmount}
                      onChange={(event) =>
                        setPreapprovedAmount(
                          normalizeDigits(event.target.value),
                        )
                      }
                      placeholder="ریال · صفر یعنی نیاز به تأیید"
                    />
                    <small className="field-helper">
                      فقط مبلغ بالاتر از این سقف به تأیید جداگانه مشتری نیاز
                      دارد.
                    </small>
                  </label>
                  <div className="field-block">
                    <span>برآورد تاریخ آماده‌شدن</span>
                    <PersianDatePicker
                      value={promisedAt}
                      onChange={setPromisedAt}
                      ariaLabel="انتخاب تاریخ شمسی برآورد"
                    />
                    <small className="field-helper">
                      تاریخ به تقویم شمسی انتخاب و نمایش داده می‌شود.
                    </small>
                  </div>
                  <label className="field-block">
                    <span>رمز موقت دستگاه</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={temporaryDeviceSecret}
                      onChange={(event) =>
                        setTemporaryDeviceSecret(event.target.value)
                      }
                      placeholder="اختیاری · پس از تحویل حذف می‌شود"
                    />
                    <small className="field-helper">
                      رمزگذاری می‌شود و با ثبت تحویل برای همیشه حذف خواهد شد.
                    </small>
                  </label>
                </div>
                <div className="data-handling-choice">
                  <strong>
                    نحوه برخورد با اطلاعات دستگاه <b>*</b>
                  </strong>
                  <div role="group" aria-label="مجوز حذف اطلاعات دستگاه">
                    <button
                      type="button"
                      aria-pressed={dataHandling === "no_erasure"}
                      className={
                        dataHandling === "no_erasure" ? "selected" : ""
                      }
                      onClick={() => setDataHandling("no_erasure")}
                    >
                      <strong>نیازی به پاک‌کردن اطلاعات نیست</strong>
                      <small>تعمیر بدون حذف داده انجام شود.</small>
                    </button>
                    <button
                      type="button"
                      aria-pressed={dataHandling === "coordinate_first"}
                      className={
                        dataHandling === "coordinate_first" ? "selected" : ""
                      }
                      onClick={() => setDataHandling("coordinate_first")}
                    >
                      <strong>قبل از پاک‌کردن هماهنگ شود</strong>
                      <small>
                        تکنسین بدون تأیید بعدی مشتری مجاز به حذف داده نیست.
                      </small>
                    </button>
                    <button
                      type="button"
                      aria-pressed={dataHandling === "erase_authorized"}
                      className={
                        dataHandling === "erase_authorized" ? "selected" : ""
                      }
                      onClick={() => setDataHandling("erase_authorized")}
                    >
                      <strong>مشتری اجازه پاک‌کردن می‌دهد</strong>
                      <small>فقط در صورت ضرورت فنی و در محدوده خدمت.</small>
                    </button>
                  </div>
                </div>
                <div className="summary-note">
                  <ShieldCheck size={22} />
                  <div>
                    {activeReceiptTerms ? (
                      <>
                        <strong>
                          {activeReceiptTerms.title} · نسخه {" "}
                          {operationalNumber.format(
                            activeReceiptTerms.versionNumber,
                          )}
                        </strong>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {activeReceiptTerms.bodyText}
                        </p>
                        <small>
                          شناسه نسخه: {activeReceiptTerms.publicId}
                        </small>
                        <label className="field-block">
                          <span>
                            <input
                              type="checkbox"
                              checked={receiptTermsAccepted}
                              disabled={
                                customerMobile.length !== 11 ||
                                !customerName.trim()
                              }
                              onChange={(event) =>
                                setAcceptedReceiptTermsContextKey(
                                  event.target.checked
                                    ? receiptAcceptanceContextKey
                                    : "",
                                )
                              }
                            />{" "}
                            تأیید می‌کنم متن همین نسخه به مشتری نمایش داده شد و
                            مشتری آن را حضوری پذیرفت.
                          </span>
                        </label>
                      </>
                    ) : (
                      <>
                        <strong>شرایط پذیرش فعال در دسترس نیست</strong>
                        <p>
                          تا تعریف و بارگذاری نسخه فعال، ثبت پذیرش مجاز نیست.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="reception-summary panel">
          <div className="summary-ribbon">
            خلاصه پذیرش · مرحله {operationalNumber.format(step)} از ۳
          </div>
          <div className="summary-device">
            <Smartphone size={33} />
            <div>
              <strong>
                {selectedCatalogItem
                  ? `${selectedCatalogItem.brand} ${selectedCatalogItem.model}`
                  : "محصول جدید"}
              </strong>
              <span>
                {selectedDeviceType
                  ? displayDeviceType(selectedDeviceType)
                  : "نوع محصول انتخاب نشده"}
              </span>
            </div>
          </div>
          <div className="summary-list">
            <div>
              <span>مشتری</span>
              <strong>{customerName || "ثبت نشده"}</strong>
            </div>
            <div>
              <span>پذیرش‌کننده</span>
              <strong>{workspace?.displayName ?? "کاربر جاری"}</strong>
            </div>
            <div>
              <span>لوازم همراه</span>
              <strong>{accessories.join("، ") || "ثبت نشده"}</strong>
            </div>
            <div>
              <span>وضعیت ظاهری</span>
              <strong>{appearanceStates.join("، ") || "ثبت نشده"}</strong>
            </div>
          </div>

          {step === 3 &&
            (singleAutoAssignee ? (
              <div className="auto-assignment">
                <UserCog size={18} />
                <div>
                  <span>تخصیص خودکار این شعبه</span>
                  <strong>
                    {singleAutoAssignee.displayName} · بدون مرحله ارجاع
                  </strong>
                </div>
                <CheckCircle2 size={18} />
              </div>
            ) : eligibleAssignees.length ? (
              <label className="field-block">
                <span>تخصیص اولیه تکنسین</span>
                <select
                  value={
                    assignedToUserId === "queue"
                      ? ""
                      : (assignedToUserId ?? defaultAssignee?.id ?? "")
                  }
                  onChange={(event) =>
                    setAssignedToUserId(
                      event.target.value ? Number(event.target.value) : "queue",
                    )
                  }
                >
                  <option value="">ورود به صف تخصیص</option>
                  {eligibleAssignees.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ·{" "}
                      {operationalRoleLabels[user.role] ?? "کاربر"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="assignment-warning">
                <CircleAlert size={17} />
                <span>
                  تکنسین فعالی در این شعبه تعریف نشده است؛ پرونده وارد صف تخصیص
                  می‌شود.
                </span>
              </div>
            ))}

          {step === 3 && unavailableDefault && (
            <div className="assignment-warning">
              <CircleAlert size={17} />
              <span>
                تکنسین پیش‌فرض قبلی غیرفعال یا از این شعبه حذف شده است؛ یک
                تکنسین جدید انتخاب کنید.
              </span>
            </div>
          )}
          <div className="summary-note">
            <ShieldCheck size={18} />
            <p>
              شرح داخلی پذیرش و اطلاعات محرمانه روی نسخه چاپی یا پرتال مشتری
              نمایش داده نمی‌شوند.
            </p>
          </div>
          <div className="reception-step-actions">
            {step > 1 && (
              <button
                type="button"
                className="outline-action"
                onClick={() => {
                  setFormError("");
                  setStep((step - 1) as 1 | 2);
                }}
              >
                <ChevronLeft size={17} />
                مرحله قبل
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                className="large-primary"
                onClick={continueReception}
              >
                ثبت مرحله و ادامه
                <ChevronLeft size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="large-primary"
                onClick={() => void submitReceipt()}
                disabled={savingReceipt}
              >
                <ClipboardCheck size={19} />
                {savingReceipt ? "در حال ثبت پذیرش..." : "ثبت پذیرش و صدور قبض"}
              </button>
            )}
          </div>
        </aside>
      </div>

      {addressOpen && (
        <Modal title="آدرس مشتری" onClose={() => setAddressOpen(false)}>
          <div className="address-modal-form">
            <p>
              آدرس فقط در پرونده مشتری نگهداری می‌شود و در قبض چاپی نمایش داده
              نمی‌شود.
            </p>
            <div className="form-grid two-columns">
              <label className="field-block">
                <span>استان {addressPolicy.required && <b>*</b>}</span>
                <select
                  value={customerProvince}
                  onChange={(event) => {
                    setCustomerProvince(event.target.value);
                    setCustomerCity("");
                  }}
                >
                  <option value="">انتخاب استان</option>
                  {Object.keys(iranProvinceCities).map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>شهر {addressPolicy.required && <b>*</b>}</span>
                <select
                  value={customerCity}
                  disabled={!customerProvince}
                  onChange={(event) => setCustomerCity(event.target.value)}
                >
                  <option value="">انتخاب شهر</option>
                  {(iranProvinceCities[customerProvince] ?? []).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block wide">
                <span>نشانی</span>
                <textarea
                  className="no-resize"
                  rows={3}
                  maxLength={1000}
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  placeholder="خیابان، کوچه، پلاک و واحد"
                />
              </label>
              <label className="field-block">
                <span>کد پستی</span>
                <input
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={10}
                  value={customerPostalCode}
                  onChange={(event) =>
                    setCustomerPostalCode(
                      normalizeDigits(event.target.value).slice(0, 10),
                    )
                  }
                  placeholder="۱۰ رقم"
                />
                <small className="field-helper">
                  {customerPostalCode
                    ? `${operationalNumber.format(customerPostalCode.length)} از ۱۰ رقم`
                    : "بدون خط تیره"}
                </small>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => {
                  setCustomerProvince("");
                  setCustomerCity("");
                  setCustomerAddress("");
                  setCustomerPostalCode("");
                }}
              >
                پاک‌کردن آدرس
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  if (
                    addressPolicy.required &&
                    (!customerProvince ||
                      !customerCity ||
                      !customerAddress.trim() ||
                      customerPostalCode.length !== 10)
                  ) {
                    showFormError("آدرس کامل و کد پستی ۱۰ رقمی را وارد کنید.");
                    return;
                  }
                  setAddressOpen(false);
                }}
              >
                <Check size={17} />
                ثبت آدرس
              </button>
            </div>
          </div>
        </Modal>
      )}

      {catalogCreateOpen && (
        <Modal
          title="تعریف سریع دستگاه"
          onClose={() => setCatalogCreateOpen(false)}
        >
          <div className="quick-catalog-form">
            <p>
              اطلاعات مرحله‌های پذیرش حفظ می‌شوند و دستگاه جدید بعد از ثبت انتخاب
              خواهد شد.
            </p>
            <div className="form-grid">
              <label className="field-block">
                <span>
                  نوع محصول <b>*</b>
                </span>
                <input
                  value={catalogDraft.type}
                  onChange={(event) =>
                    setCatalogDraft((current) => ({
                      ...current,
                      type: event.target.value,
                    }))
                  }
                  placeholder="مثلاً موبایل"
                />
              </label>
              <label className="field-block">
                <span>
                  برند <b>*</b>
                </span>
                <input
                  value={catalogDraft.brand}
                  onChange={(event) =>
                    setCatalogDraft((current) => ({
                      ...current,
                      brand: event.target.value,
                    }))
                  }
                  placeholder="مثلاً سامسونگ"
                />
              </label>
              <label className="field-block">
                <span>
                  مدل <b>*</b>
                </span>
                <input
                  value={catalogDraft.model}
                  onChange={(event) =>
                    setCatalogDraft((current) => ({
                      ...current,
                      model: event.target.value,
                    }))
                  }
                  placeholder="مثلاً A56"
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => setCatalogCreateOpen(false)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={catalogSaving}
                onClick={() => void createCatalogQuickly()}
              >
                <Save size={17} />
                {catalogSaving ? "در حال ثبت..." : "ثبت و انتخاب محصول"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {receiptOpen && createdCase && (
        <Modal
          title="رسید کامل پذیرش"
          onClose={() => setReceiptOpen(false)}
          size="wide"
        >
          <div className="receipt-complete-view">
            <div className="receipt-created-banner">
              <CheckCircle2 size={22} />
              <div>
                <strong>پذیرش با موفقیت ثبت شد</strong>
                <span>
                  {createdCase.assignedToUserId
                    ? `پرونده به ${createdCase.assignedToName} ارجاع شد.`
                    : "پرونده در صف تخصیص قرار گرفت."}
                </span>
              </div>
              <b dir="ltr">{createdCase.receiptNumber}</b>
            </div>
            <ReceiptDocument
              workspace={workspace}
              receiptNumber={createdCase.receiptNumber}
              customerName={customerName}
              customerMobile={customerMobile}
              catalogItem={selectedCatalogItem}
              accessories={accessories}
              appearanceStates={appearanceStates}
              declaredIssue={declaredIssue}
              dataHandling={dataHandling}
              previousReceipt={selectedPreviousDevice?.lastReceipt}
              identifier={createdCase.identifier}
              color={createdCase.color}
              printSize={receiptTemplate.printSize}
              title={receiptTemplate.title}
              phone={receiptTemplate.phone}
              portal={receiptTemplate.portal}
              trackingUrl={createdCase.trackingUrl}
              conditions={(receiptTemplate.clauses ?? [])
                .filter((item) => item.enabled)
                .map((item) => item.text)}
              promisedAt={
                createdCase.promisedAt ??
                (promisedAt ? `${promisedAt} 12:00:00` : null)
              }
            />
            <div className="modal-actions receipt-modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => {
                  window.print();
                  notify(
                    `نسخه ${receiptTemplate.printSize ?? "A5"} به پنجره چاپ ارسال شد`,
                  );
                }}
              >
                <Printer size={17} />
                چاپ رسید {receiptTemplate.printSize ?? "A5"}
              </button>
              <button
                type="button"
                className="outline-action"
                onClick={() => {
                  window.print();
                  notify(
                    "در پنجره چاپ، گزینه ذخیره به‌صورت PDF را انتخاب کنید",
                  );
                }}
              >
                <FileDown size={17} />
                دریافت PDF
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  window.sessionStorage.setItem(
                    "tamiran:focused-workflow-case",
                    String(createdCase.id),
                  );
                  onNavigate("مرکز عملیات تعمیرات");
                }}
              >
                <UsersRound size={17} />
                رفتن به پرونده
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FollowUpComposer({
  receiptId,
  customerMobile,
  device,
  customer,
  items,
  users,
  currentUserName,
  onCreate,
}: {
  receiptId: string;
  customerMobile: string;
  device: string;
  customer: string;
  items: CaseFollowUp[];
  users: OperationalUser[];
  currentUserName: string;
  onCreate: (item: CaseFollowUp) => void;
}) {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<FollowUpKind>("action");
  const [priority, setPriority] = useState<FollowUpPriority>("important");
  const [ownerId, setOwnerId] = useState<number | null>(
    () => users.find((user) => user.isActive)?.id ?? null,
  );
  const [due, setDue] = useState("قبل از شروع تعمیر");
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(true);

  const submit = () => {
    const normalized = message.trim();
    if (!normalized) return;
    const owner = users.find((user) => user.id === ownerId && user.isActive);
    if (!owner) return;
    const ownerRole: CaseFollowUp["ownerRole"] =
      owner.role === "reception"
        ? "پذیرش"
        : owner.role === "repair_manager"
          ? "مدیر تعمیرگاه"
          : owner.role === "quality_control"
            ? "کنترل کیفیت"
            : "تکنسین";
    onCreate({
      id: `FU-${Date.now()}`,
      receiptId,
      customerMobile,
      device,
      customer,
      message: normalized,
      kind,
      priority,
      status: "new",
      ownerRole,
      ownerName: owner.displayName,
      assignedToUserId: owner.id,
      createdBy: currentUserName,
      createdAt: "همین حالا",
      dueLabel: due,
      overdue: false,
      requiresAcknowledgement,
    });
    setMessage("");
  };

  return (
    <section className="followup-composer-panel">
      <div className="followup-composer-head">
        <div>
          <span>
            <AlarmClock size={19} />
          </span>
          <div>
            <strong>پیام و پیگیری پرونده</strong>
            <small>
              پیام‌های نیازمند اقدام تا زمان «انجام شد» از داشبورد مسئول حذف
              نمی‌شوند.
            </small>
          </div>
        </div>
        <b>{items.length} پیام ثبت‌شده</b>
      </div>
      {items.length > 0 && (
        <div className="followup-composer-log">
          {items.map((item) => (
            <article key={item.id}>
              <span
                className={`followup-priority-dot priority-${item.priority}`}
              />
              <div>
                <strong>{item.message}</strong>
                <small>
                  {item.createdBy} · {operationalDate(item.createdAt)}
                </small>
              </div>
              <b>{followUpStatusLabels[item.status]}</b>
            </article>
          ))}
        </div>
      )}
      <label className="field-block">
        <span>
          متن تماس یا پیام مشتری <b>*</b>
        </span>
        <textarea
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="مثلاً مشتری تماس گرفت؛ قبل از تعویض قطعه مبلغ نهایی اعلام شود..."
        />
      </label>
      <div className="followup-composer-grid">
        <label>
          <span>نوع پیام</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as FollowUpKind)}
          >
            <option value="information">فقط اطلاع‌رسانی</option>
            <option value="action">نیازمند اقدام</option>
            <option value="customer_callback">تماس مجدد با مشتری</option>
          </select>
        </label>
        <label>
          <span>مسئول انجام</span>
          <select
            value={ownerId ?? ""}
            onChange={(event) =>
              setOwnerId(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="" disabled>
              انتخاب کاربر مجاز
            </option>
            {users
              .filter((user) => user.isActive)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ·{" "}
                  {operationalRoleLabels[user.role] ?? "کاربر"}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>مهلت</span>
          <select value={due} onChange={(event) => setDue(event.target.value)}>
            <option>قبل از شروع تعمیر</option>
            <option>امروز تا ساعت ۱۶:۰۰</option>
            <option>تا ۲ ساعت آینده</option>
            <option>قبل از تحویل مشتری</option>
          </select>
        </label>
        <label>
          <span>اهمیت</span>
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as FollowUpPriority)
            }
          >
            <option value="normal">عادی</option>
            <option value="important">مهم</option>
            <option value="urgent">فوری</option>
          </select>
        </label>
      </div>
      <div className="followup-composer-actions">
        <label className="confirm-check">
          <input
            type="checkbox"
            checked={requiresAcknowledgement}
            onChange={(event) =>
              setRequiresAcknowledgement(event.target.checked)
            }
          />
          <span>
            <Check size={14} />
          </span>
          تأیید مشاهده توسط مسئول الزامی باشد
        </label>
        <button
          type="button"
          className="primary-action"
          disabled={!message.trim() || ownerId === null}
          onClick={submit}
        >
          <Send size={16} />
          ثبت و ارسال به داشبورد
        </button>
      </div>
    </section>
  );
}

function SearchableCatalogSelect({
  items,
  selected,
  onSelect,
}: {
  items: DeviceCatalogItem[];
  selected: DeviceCatalogItem | null;
  onSelect: (item: DeviceCatalogItem | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const controlId = `catalog-${React.useId().replace(/:/g, "")}`;
  const normalizedSearch = search.trim().toLocaleLowerCase("fa");
  const available = items
    .filter((item) => item.isActive)
    .filter(
      (item) =>
        !normalizedSearch ||
        `${displayDeviceType(item.deviceType)} ${item.brand} ${item.model}`
          .toLocaleLowerCase("fa")
          .includes(normalizedSearch),
    )
    .sort((first, second) =>
      `${displayDeviceType(first.deviceType)} ${first.brand} ${first.model}`.localeCompare(
        `${displayDeviceType(second.deviceType)} ${second.brand} ${second.model}`,
        "fa",
      ),
    );

  const visibleItems = available.slice(0, 30);
  const choose = (item: DeviceCatalogItem) => {
    onSelect(item); setSearch(""); setOpen(false);
  };
  React.useEffect(() => {
    if (open) document.getElementById(`${controlId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, controlId]);

  return (
    <div ref={rootRef} className="field-block catalog-combobox unified-product-picker">
      <label htmlFor={controlId} className="catalog-field-label">
        نوع محصول، برند و مدل <b>*</b>
      </label>
      <div className={`catalog-search-control ${open ? "open" : ""}`}>
        <Search size={17} />
        <input
          ref={inputRef}
          id={controlId}
          onClick={() => setOpen(true)}
          value={
            selected && !open
              ? `${displayDeviceType(selected.deviceType)} · ${selected.brand} · ${selected.model}`
              : search
          }
          onFocus={() => {
            setOpen(true);
            setActiveIndex(0);
            if (selected) setSearch("");
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
            setActiveIndex(0);
            onSelect(null);
          }}
          onBlur={(event) => { if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setOpen(true);
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setActiveIndex((current) => !open ? (direction > 0 ? 0 : Math.max(0, visibleItems.length - 1)) : (current + direction + visibleItems.length) % Math.max(1, visibleItems.length));
            } else if (open && (event.key === "Home" || event.key === "End")) {
              event.preventDefault(); setActiveIndex(event.key === "Home" ? 0 : Math.max(0, visibleItems.length - 1));
            } else if (event.key === "Enter" && open) {
              event.preventDefault(); if (visibleItems[activeIndex]) choose(visibleItems[activeIndex]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault(); event.stopPropagation(); setOpen(false);
            } else if (event.key === "Tab") setOpen(false);
          }}
          placeholder="جست‌وجوی نوع، برند یا مدل محصول..."
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? `${controlId}-results` : undefined}
          aria-activedescendant={open && visibleItems[activeIndex] ? `${controlId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
        />
        {selected ? (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setSearch("");
              setOpen(true);
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            aria-label="پاک‌کردن انتخاب"
          >
            <X size={15} />
          </button>
        ) : (
          <ChevronDown size={16} />
        )}
        {open && (
          <div
            className="catalog-search-results"
            role="listbox"
            id={`${controlId}-results`}
          >
            <div className="catalog-results-head">
              <span>{available.length} محصول فعال</span>
              <small>فقط فهرست تعریف‌شده در تنظیمات</small>
            </div>
            {available.length ? (
              visibleItems.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  id={`${controlId}-option-${index}`}
                  tabIndex={-1}
                  className={`${selected?.id === item.id ? "selected" : ""} ${activeIndex === index ? "is-keyboard-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => choose(item)}
                  role="option"
                  aria-selected={selected?.id === item.id}
                >
                  <span>
                    <Smartphone size={17} />
                  </span>
                  <div>
                    <strong>
                      {item.brand} · {item.model}
                    </strong>
                    <small>{displayDeviceType(item.deviceType)}</small>
                  </div>
                  {item.usageCount > 0 && <em>{item.usageCount} سابقه</em>}
                  <Check size={15} />
                </button>
              ))
            ) : (
              <div className="catalog-empty">
                <Search size={22} />
                <strong>محصولی پیدا نشد</strong>
                <span>نوع، برند و مدل جدید فقط از تنظیمات قابل تعریف است.</span>
              </div>
            )}
          </div>
        )}
      </div>
      <small className="field-helper">
        نوع محصول با همین انتخاب در پرونده ثبت می‌شود.
      </small>
    </div>
  );
}

function ReceiptDocument({
  workspace,
  receiptNumber,
  customerName,
  customerMobile,
  catalogItem,
  accessories,
  appearanceStates,
  declaredIssue,
  dataHandling,
  previousReceipt,
  identifier,
  color,
  printSize,
  title,
  phone,
  portal,
  trackingUrl,
  conditions,
  issuedAt,
  promisedAt,
  acceptedByName,
}: {
  workspace?: WorkspaceProfile;
  receiptNumber: string;
  customerName: string;
  customerMobile: string;
  catalogItem: Pick<DeviceCatalogItem, "brand" | "model"> | null;
  accessories: string[];
  appearanceStates: string[];
  declaredIssue?: string;
  dataHandling?: "no_erasure" | "coordinate_first" | "erase_authorized" | string;
  previousReceipt?: string;
  identifier?: string;
  color?: string;
  printSize?: string;
  title?: string;
  phone?: string;
  portal?: string;
  trackingUrl?: string;
  conditions?: string[];
  issuedAt?: string;
  promisedAt?: string | null;
  acceptedByName?: string;
}) {
  const dataHandlingLabel =
    dataHandling === "coordinate_first"
      ? "قبل از پاک‌کردن هماهنگ شود"
      : dataHandling === "erase_authorized"
        ? "مشتری اجازه پاک‌کردن می‌دهد"
        : dataHandling === "no_erasure"
          ? "نیازی به پاک‌کردن اطلاعات نیست"
          : "ثبت نشده";
  const printClass =
    printSize === "A4"
      ? "receipt-size-a4"
      : printSize === "حرارتی"
        ? "receipt-size-thermal"
        : "receipt-size-a5";
  const secureTrackingUrl = trackingUrl
    ? typeof window === "undefined"
      ? trackingUrl
      : new URL(trackingUrl, window.location.origin).toString()
    : "";
  const visibleConditions = (
    conditions?.length
      ? conditions
      : [
          "تحویل دستگاه با ارائه رسید یا احراز هویت مشتری انجام می‌شود.",
          "تعمیر و هزینه خارج از سقف توافق‌شده پس از تأیید مشتری انجام خواهد شد.",
          "ضمانت فقط شامل خدمت و قطعات درج‌شده در فاکتور نهایی است.",
        ]
  ).slice(0, 4);
  return (
    <article
      className={`receipt-document receipt-document-v4 ${printClass}`}
      data-print-size={printSize ?? "A5"}
      aria-label="رسید پذیرش تعمیر"
    >
      <header className="receipt-document-head">
        <div className="receipt-identity">
          <div className="receipt-shop-mark">
            <Wrench size={23} />
          </div>
          <div>
            <h2>{workspace?.shopName ?? "تعمیرگاه"}</h2>
            <p>{title || "رسید پذیرش تعمیر"}</p>
            <small>
              {workspace?.branch ?? "شعبه مرکزی"}
              {phone ? ` · ${phone}` : ""}
            </small>
          </div>
        </div>
        <div className="receipt-number">
          <span>شماره رسید</span>
          <strong dir="ltr">{receiptNumber}</strong>
          <small>
            تاریخ پذیرش: {operationalDate(issuedAt ?? new Date().toISOString())}
          </small>
        </div>
      </header>

      <section className="receipt-document-section receipt-customer-row">
        <h3>
          <span>۰۱</span>مشخصات مشتری
        </h3>
        <div className="receipt-facts three compact">
          <div>
            <span>نام مشتری</span>
            <strong>{customerName}</strong>
          </div>
          <div>
            <span>شماره موبایل</span>
            <strong className="receipt-ltr" dir="ltr">
              {customerMobile}
            </strong>
          </div>
          <div>
            <span>پذیرش‌کننده</span>
            <strong>
              {acceptedByName ?? workspace?.displayName ?? "کاربر جاری"}
            </strong>
          </div>
        </div>
      </section>

      <section className="receipt-document-section">
        <h3>
          <span>۰۲</span>مشخصات دستگاه
        </h3>
        <div className="receipt-facts three device">
          <div>
            <span>برند</span>
            <strong>{catalogItem?.brand ?? "ثبت نشده"}</strong>
          </div>
          <div>
            <span>مدل</span>
            <strong>{catalogItem?.model ?? "ثبت نشده"}</strong>
          </div>
          <div>
            <span>رنگ</span>
            <strong>{color || "ثبت نشده"}</strong>
          </div>
          <div className="receipt-identifier">
            <span>شماره سریال / شناسه</span>
            <strong dir="ltr">{identifier || "ثبت نشده"}</strong>
          </div>
        </div>
        <div className="receipt-detail-grid">
          <div className="receipt-issue">
            <span>ایراد اعلامی مشتری</span>
            <p>{declaredIssue?.trim() || "ثبت نشده"}</p>
          </div>
          <div className="receipt-issue">
            <span>مجوز حذف اطلاعات دستگاه</span>
            <p>{dataHandlingLabel}</p>
          </div>
          <div className="receipt-issue">
            <span>وضعیت ظاهری هنگام تحویل</span>
            <p>{appearanceStates.join("، ") || "موردی ثبت نشده است"}</p>
          </div>
          <div className="receipt-issue">
            <span>لوازم همراه</span>
            <p>{accessories.join("، ") || "بدون لوازم"}</p>
          </div>
          {promisedAt && (
            <div className="receipt-issue">
              <span>برآورد تاریخ آماده‌شدن</span>
              <p>{operationalDate(promisedAt)}</p>
            </div>
          )}
          {previousReceipt && (
            <div className="receipt-issue">
              <span>سابقه مرتبط</span>
              <p className="receipt-ltr">{previousReceipt}</p>
            </div>
          )}
        </div>
      </section>

      <section className="receipt-document-section receipt-conditions">
        <h3>
          <span>۰۳</span>شرایط پذیرش و تحویل
        </h3>
        <ol>
          {visibleConditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ol>
      </section>

      <footer className="receipt-document-foot">
        <div>
          <span>امضای پذیرش‌کننده</span>
          <i />
        </div>
        <div>
          <span>امضا و تأیید مشتری</span>
          <i />
        </div>
        {secureTrackingUrl && (
          <div className="receipt-tracking">
            <SecureQr value={secureTrackingUrl} label="پیگیری امن پرونده" />
            <strong dir="ltr">{secureTrackingUrl}</strong>
          </div>
        )}
      </footer>
    </article>
  );
}

function ReceiptsPage({
  onNavigate,
  notify,
  workspace,
  operations = emptyOperationalSnapshot,
  operationsLoading,
  shopSettings = {},
}: PageProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RepairCaseRecord | null>(null);
  const [details, setDetails] = useState<RepairCaseRecord | null>(null);
  const normalized = query.trim().toLocaleLowerCase("fa");
  const receipts = operations.cases.filter(
    (item) =>
      !normalized ||
      `${item.receiptNumber} ${item.customerName} ${item.customerMobile} ${item.deviceType} ${item.brand} ${item.model}`
        .toLocaleLowerCase("fa")
        .includes(normalized),
  );
  const receiptTemplate = (shopSettings.receipt_template ?? {}) as {
    printSize?: string;
    title?: string;
    phone?: string;
    portal?: string;
    clauses?: Array<{ enabled: boolean; text: string }>;
  };
  const conditions = (receiptTemplate.clauses ?? [])
    .filter((item) => item.enabled)
    .map((item) => item.text);
  return (
    <>
      <ModuleHeader
        icon={<FileClock size={26} />}
        eyebrow="بایگانی پذیرش"
        title="رسیدهای تعمیرگاه"
        description="رسیدها از پرونده‌های واقعی خوانده می‌شوند و مشاهده، چاپ و ذخیره PDF آن‌ها فعال است."
      >
        <label className="module-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجوی رسید، مشتری یا دستگاه"
          />
        </label>
        <button
          type="button"
          className="primary-action"
          onClick={() => onNavigate("پذیرش تعمیرات")}
        >
          <ClipboardList size={17} />
          پذیرش جدید
        </button>
      </ModuleHeader>
      <section className="panel data-panel">
        <div className="responsive-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>شماره رسید</th>
                <th>مشتری</th>
                <th>دستگاه</th>
                <th>تاریخ پذیرش</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {receipts.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="receipt-link"
                      onClick={() => setSelected(item)}
                    >
                      {item.receiptNumber}
                    </button>
                  </td>
                  <td>
                    <strong>{item.customerName}</strong>
                    <small dir="ltr">{item.customerMobile}</small>
                  </td>
                  <td>
                    <strong>
                      {item.brand} {item.model}
                    </strong>
                    <small>{item.deviceType}</small>
                  </td>
                  <td>{operationalDate(item.createdAt)}</td>
                  <td>
                    <span className="status-pill tone-teal">
                      {repairCaseStatusLabels[item.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="row-action"
                      aria-label={`مشاهده رسید ${item.receiptNumber}`}
                      onClick={() => setSelected(item)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!operationsLoading && !receipts.length && (
            <ModuleEmptyState
              title="هنوز اطلاعاتی ثبت نشده است"
              description={
                query.trim()
                  ? "رسیدی مطابق جست‌وجو پیدا نشد."
                  : "پس از ثبت اولین پذیرش، رسید آن در این بخش نمایش داده می‌شود."
              }
            />
          )}
        </div>
      </section>
      {selected && (
        <Modal
          title={`رسید ${selected.receiptNumber}`}
          onClose={() => setSelected(null)}
          size="wide"
        >
          <div className="receipt-complete-view">
            <ReceiptDocument
              workspace={workspace}
              receiptNumber={selected.receiptNumber}
              customerName={selected.customerName}
              customerMobile={selected.customerMobile}
              catalogItem={{ brand: selected.brand, model: selected.model }}
              accessories={selected.accessories}
              appearanceStates={selected.appearanceStates}
              declaredIssue={selected.declaredIssue}
              dataHandling={selected.dataHandling}
              identifier={selected.identifier}
              color={selected.color}
              printSize={receiptTemplate.printSize}
              title={receiptTemplate.title}
              phone={receiptTemplate.phone}
              portal={receiptTemplate.portal}
              conditions={conditions}
              issuedAt={selected.createdAt}
              promisedAt={selected.promisedAt}
              trackingUrl={selected.trackingUrl}
              acceptedByName={selected.createdByName}
            />
            <div className="modal-actions receipt-modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => window.print()}
              >
                <Printer size={17} />
                چاپ رسید
              </button>
              <button
                type="button"
                className="outline-action"
                onClick={() => {
                  window.print();
                  notify(
                    "در پنجره چاپ، گزینه ذخیره به‌صورت PDF را انتخاب کنید.",
                  );
                }}
              >
                <FileDown size={17} />
                ذخیره PDF
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  setDetails(selected);
                  setSelected(null);
                }}
              >
                <History size={17} />
                تاریخچه پرونده
              </button>
            </div>
          </div>
        </Modal>
      )}
      {details && (
        <CaseDetailsModal
          repairCase={details}
          onClose={() => setDetails(null)}
        />
      )}
    </>
  );
}

function RepairManagementPage({
  onNavigate,
  notify,
  operations = emptyOperationalSnapshot,
  operationsLoading,
  onUpdateRepairCase,
  onRefreshOperations,
}: PageProps) {
  const [selectedCase, setSelectedCase] = useState<RepairCaseRecord | null>(
    null,
  );
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const technicians = operations.users.filter(
    (user) =>
      user.isActive &&
      ["technician", "repair_manager", "quality_control"].includes(user.role),
  );
  const openCases = operations.cases.filter(
    (item) => !["delivered", "cancelled"].includes(item.status),
  );
  const ageHours = (item: RepairCaseRecord) =>
    Math.max(0, (Date.now() - new Date(item.updatedAt).getTime()) / 3_600_000);
  const columns = [
    {
      title: "SLA گذشته",
      tone: "coral",
      cards: openCases.filter((item) => ageHours(item) >= 48),
    },
    {
      title: "بدون تخصیص",
      tone: "gold",
      cards: openCases.filter(
        (item) => item.status === "awaiting_assignment" || !item.assignedToUserId,
      ),
    },
    {
      title: "انتظار طولانی",
      tone: "sky",
      cards: openCases.filter(
        (item) =>
          ["awaiting_part", "awaiting_customer"].includes(item.status) &&
          ageHours(item) >= 24,
      ),
    },
    {
      title: "بازکاری و برگشتی",
      tone: "teal",
      cards: openCases.filter((item) => item.status === "returned"),
    },
  ].map((column) => ({ ...column, count: column.cards.length }));

  const assignCase = async (repairCase: RepairCaseRecord) => {
    const userId = assignments[repairCase.id];
    if (!userId || !onUpdateRepairCase) {
      notify("ابتدا مسئول پرونده را انتخاب کنید.");
      return;
    }
    try {
      await onUpdateRepairCase({
        id: repairCase.id,
        assignedToUserId: userId,
        status: "assigned",
        reason: "پرونده از کارتابل مدیریت تخصیص داده شد.",
      });
      notify("مسئول پرونده تعیین و در تاریخچه ثبت شد.");
    } catch (error) {
      notify(moduleErrorMessage(error, "تخصیص پرونده انجام نشد."));
    }
  };

  return (
    <>
      <ModuleHeader
        icon={<UsersRound size={26} />}
        eyebrow="دید مدیریتی تعمیرگاه"
        title="مرکز عملیات تعمیرات"
        description="گلوگاه‌ها، SLA، پرونده‌های بدون مسئول و انتظارهای طولانی را در یک نما مدیریت کنید."
      >
        <button
          type="button"
          className="outline-action"
          onClick={() => void onRefreshOperations?.()}
        >
          <RefreshCw
            size={17}
            className={operationsLoading ? "is-spinning" : ""}
          />
          تازه‌سازی
        </button>
        <button
          className="primary-action"
          onClick={() => onNavigate("پذیرش تعمیرات")}
        >
          <UserPlus size={17} />
          پذیرش جدید
        </button>
      </ModuleHeader>

      <div className="responsibility-strip">
        <div>
          <span className="tone-teal">
            <Wrench size={20} />
          </span>
          <p>
            <strong>
              {
                operations.cases.filter(
                  (item) =>
                    item.assignedToUserId &&
                    !["delivered", "cancelled"].includes(item.status),
                ).length
              }
            </strong>
            <small>پرونده نزد مسئول</small>
          </p>
        </div>
        <div>
          <span className="tone-coral">
            <Archive size={20} />
          </span>
          <p>
            <strong>
              {
                operations.hotReturns.filter(
                  (item) => item.status !== "settled",
                ).length
              }
            </strong>
            <small>تعهد داغی باز</small>
          </p>
        </div>
        <div>
          <span className="tone-gold">
            <Clock3 size={20} />
          </span>
          <p>
            <strong>
              {
                operations.cases.filter(
                  (item) => item.status === "awaiting_assignment",
                ).length
              }
            </strong>
            <small>منتظر تخصیص</small>
          </p>
        </div>
        <button onClick={() => onNavigate("تعهدهای داغی")}>
          نمای مسئولیت تکنسین‌ها
          <ChevronLeft size={17} />
        </button>
      </div>

      <div className="kanban-board">
        {columns.map((column) => (
          <section
            className={`kanban-column column-${column.tone}`}
            key={column.title}
          >
            <div className="kanban-column-header">
              <span className={`status-dot tone-${column.tone}`} />
              <strong>{column.title}</strong>
              <b>{column.count}</b>
            </div>
            <div className="kanban-cards">
              {column.cards.map((card) => (
                <article className="repair-card" key={card.id}>
                  <div className="repair-card-top">
                    <button type="button" onClick={() => setSelectedCase(card)}>
                      {card.receiptNumber}
                    </button>
                    <span>
                      {card.assignedToName || operationalDate(card.updatedAt)}
                    </span>
                  </div>
                  <h3>
                    {card.brand} {card.model}
                  </h3>
                  <p>
                    <UserCog size={14} />
                    {card.customerName}
                  </p>
                  <div className="repair-issue">{card.declaredIssue}</div>
                  {column.title === "بدون تخصیص" ? (
                    <div className="assign-row">
                      <select
                        aria-label={`مسئول ${card.receiptNumber}`}
                        value={assignments[card.id] ?? ""}
                        onChange={(event) =>
                          setAssignments((current) => ({
                            ...current,
                            [card.id]: Number(event.target.value),
                          }))
                        }
                      >
                        <option value="" disabled>
                          انتخاب مسئول
                        </option>
                        {technicians.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void assignCase(card)}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="card-link"
                      onClick={() => setSelectedCase(card)}
                    >
                      مشاهده جزئیات و تایم‌لاین
                      <ChevronLeft size={16} />
                    </button>
                  )}
                </article>
              ))}
              {column.cards.length === 0 && (
                <ModuleEmptyState
                  compact
                  title="هنوز اطلاعاتی ثبت نشده است"
                  description={`پرونده‌ای در وضعیت «${column.title}» وجود ندارد.`}
                />
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="panel rule-callout">
        <ArrowLeftRight size={22} />
        <div>
          <strong>قاعده انتقال مسئولیت</strong>
          <p>
            در جابه‌جایی تکنسین، درخواست تحویل‌نشده منتقل می‌شود؛ قطعه تحویل‌شده
            و تعهد داغی نزد تکنسین قبلی باقی می‌ماند.
          </p>
        </div>
      </section>
      {selectedCase && (
        <CaseDetailsModal
          repairCase={selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </>
  );
}

function TechnicianPage({
  onNavigate,
  notify,
  workspace,
  operations = emptyOperationalSnapshot,
  operationsLoading,
  onUpdateRepairCase,
  followUps = [],
  onUpdateFollowUpStatus,
  onUpdateFollowUp,
}: PageProps) {
  const [selected, setSelected] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [timelineCase, setTimelineCase] = useState<RepairCaseRecord | null>(
    null,
  );
  const [operationReport, setOperationReport] = useState("");
  const [result, setResult] = useState("");
  const [followUpDetails, setFollowUpDetails] = useState<CaseFollowUp | null>(
    null,
  );
  const visibleCases = operations.cases.filter(
    (item) =>
      !["delivered", "cancelled"].includes(item.status) &&
      (workspace?.role !== "technician" ||
        item.assignedToUserId === workspace.actorId),
  );
  const normalizedJobQuery = jobQuery.trim().toLocaleLowerCase("fa");
  const jobs = visibleCases
    .filter(
      (item) =>
        !normalizedJobQuery ||
        [
          item.receiptNumber,
          item.brand,
          item.model,
          item.customerName,
          item.customerMobile,
        ].some((value) =>
          value.toLocaleLowerCase("fa").includes(normalizedJobQuery),
        ),
    )
    .map((item) => ({
      id: item.receiptNumber,
      model: `${item.brand} ${item.model}`,
      customer: item.customerName,
      status: repairCaseStatusLabels[item.status],
      tone:
        item.status === "awaiting_part"
          ? "coral"
          : item.status === "awaiting_customer"
            ? "gold"
            : "teal",
      age: operationalDate(item.updatedAt),
    }));
  const activeSelected = selected || jobs[0]?.id || "";
  const selectedCase =
    operations.cases.find((item) => item.receiptNumber === activeSelected) ??
    null;
  const selectedFollowUps = followUps.filter(
    (item) => item.receiptId === activeSelected && item.status !== "done",
  );
  const activeTechnicianFollowUps = followUps.filter((item) =>
    item.assignedToUserId
      ? item.assignedToUserId === workspace?.actorId && item.status !== "done"
      : item.ownerRole === "تکنسین" && item.status !== "done",
  );

  const changeCaseStatus = async (status: RepairCaseStatus) => {
    if (!selectedCase || !onUpdateRepairCase) return;
    try {
      await onUpdateRepairCase({
        id: selectedCase.id,
        status,
        assignedToUserId:
          selectedCase.assignedToUserId ?? workspace?.actorId ?? null,
        reason: "مرحله عملیاتی توسط کاربر تغییر کرد.",
      });
      notify(`مرحله به «${repairCaseStatusLabels[status]}» تغییر کرد.`);
    } catch (error) {
      notify(moduleErrorMessage(error, "تغییر مرحله انجام نشد."));
    }
  };

  const saveReport = async (sendToDelivery: boolean) => {
    if (!selectedCase || !onUpdateRepairCase) return;
    if (!operationReport.trim() || !result) {
      notify("گزارش عملیات و نتیجه نهایی را کامل کنید.");
      return;
    }
    try {
      await onUpdateRepairCase({
        id: selectedCase.id,
        ...(sendToDelivery ? { status: "ready_for_delivery" as const } : {}),
        result,
        operationReport,
        assignedToUserId: selectedCase.assignedToUserId,
      });
      notify(
        sendToDelivery
          ? "پرونده برای تحویل ارسال شد."
          : "گزارش عملیات ذخیره شد.",
      );
    } catch (error) {
      notify(moduleErrorMessage(error, "ذخیره گزارش انجام نشد."));
    }
  };

  const updateFollowUp = (id: string, status: FollowUpStatus) => {
    void onUpdateFollowUpStatus?.(id, status);
  };

  return (
    <>
      <ModuleHeader
        icon={<Wrench size={26} />}
        eyebrow={`کارتابل ${workspace?.displayName ?? "کاربر جاری"}`}
        title="عملیات فنی پرونده‌ها"
        description="فقط پرونده‌های تخصیص‌یافته به شما نمایش داده می‌شوند؛ گزارش عملیات برای پایان کار الزامی است."
      >
        <button
          className="outline-action"
          onClick={() => onNavigate("درخواست‌های قطعه")}
        >
          <PackageOpen size={17} />
          درخواست‌های من
        </button>
      </ModuleHeader>

      <section className="panel technician-followup-inbox">
        <div className="technician-followup-summary">
          <span>
            <AlarmClock size={22} />
          </span>
          <div>
            <strong>پیگیری‌های من</strong>
            <small>
              {activeTechnicianFollowUps.length} مورد باز ·{" "}
              {activeTechnicianFollowUps.filter((item) => item.overdue).length}{" "}
              مورد عقب‌افتاده
            </small>
          </div>
          <b>تا انجام کامل باقی می‌ماند</b>
        </div>
        <div className="technician-followup-strip">
          {activeTechnicianFollowUps.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`technician-followup-card priority-${item.priority} ${item.overdue ? "is-overdue" : ""}`}
              onClick={() => {
                setSelected(item.receiptId);
                setFollowUpDetails(item);
                if (item.status === "new") updateFollowUp(item.id, "seen");
              }}
            >
              <div>
                <span>{item.receiptId}</span>
                <b>
                  {item.overdue
                    ? "عقب‌افتاده"
                    : followUpPriorityLabels[item.priority]}
                </b>
              </div>
              <strong>{item.message}</strong>
              <small>
                {item.customer} · {item.dueLabel}
              </small>
            </button>
          ))}
        </div>
      </section>

      <div className="technician-workspace">
        <aside className="job-list panel">
          <div className="job-list-head">
            <div>
              <strong>پرونده‌های من</strong>
              <span>{jobs.length} پرونده فعال</span>
            </div>
          </div>
          <label className="inline-search">
            <Search size={17} />
            <input
              value={jobQuery}
              onChange={(event) => setJobQuery(event.target.value)}
              placeholder="جست‌وجوی رسید، دستگاه یا مشتری"
            />
          </label>
          {jobs.map((job) => (
            <button
              type="button"
              className={`job-card ${activeSelected === job.id ? "selected" : ""}`}
              key={job.id}
              onClick={() => setSelected(job.id)}
            >
              <div>
                <b>{job.id}</b>
                <span>{job.age}</span>
              </div>
              <strong>{job.model}</strong>
              <p>{job.customer}</p>
              <small className={`status-pill tone-${job.tone}`}>
                {job.status}
              </small>
            </button>
          ))}
          {!operationsLoading && jobs.length === 0 && (
            <ModuleEmptyState
              compact
              title="هنوز اطلاعاتی ثبت نشده است"
              description={
                jobQuery.trim()
                  ? "پرونده‌ای با عبارت جست‌وجوشده پیدا نشد."
                  : "پرونده‌ای به این کاربر تخصیص داده نشده است."
              }
            />
          )}
        </aside>

        {selectedCase ? (
          <section className="repair-detail panel">
            <div className="repair-detail-head">
              <div>
                <span className="module-eyebrow">
                  رسید {selectedCase.receiptNumber}
                </span>
                <h2>
                  {selectedCase.brand} {selectedCase.model}
                </h2>
                <p>
                  {selectedCase.customerName} · {selectedCase.customerMobile}
                </p>
              </div>
              <button
                type="button"
                className="outline-action"
                onClick={() => setTimelineCase(selectedCase)}
              >
                <History size={17} />
                تاریخچه پرونده
              </button>
            </div>

            <div className="device-facts">
              <div>
                <span>شناسه دستگاه</span>
                <strong dir="ltr">
                  {selectedCase.identifier || "ثبت نشده"}
                </strong>
              </div>
              <div>
                <span>نوع دستگاه</span>
                <strong>{selectedCase.deviceType}</strong>
              </div>
              <div>
                <span>لوازم همراه</span>
                <strong>
                  {selectedCase.accessories.join("، ") || "بدون لوازم"}
                </strong>
              </div>
              <div>
                <span>زمان دریافت</span>
                <strong>{operationalDate(selectedCase.createdAt)}</strong>
              </div>
            </div>

            <div className="issue-box">
              <CircleAlert size={20} />
              <div>
                <strong>ایراد اعلامی مشتری</strong>
                <p>{selectedCase.declaredIssue}</p>
              </div>
            </div>

            {selectedCase.receptionNotes && (
              <div className="internal-note-box">
                <LockKeyhole size={20} />
                <div>
                  <strong>شرح داخلی پذیرش برای تکنسین</strong>
                  <p>{selectedCase.receptionNotes}</p>
                  <small>
                    این یادداشت روی قبض و پرتال مشتری نمایش داده نمی‌شود.
                  </small>
                </div>
              </div>
            )}

            {selectedFollowUps.length > 0 && (
              <section className="operation-section case-followups-section">
                <SectionTitle
                  icon={<AlarmClock size={19} />}
                  title="پیام‌ها و پیگیری‌های این پرونده"
                  badge={`${selectedFollowUps.length} باز`}
                />
                <div className="case-followup-list">
                  {selectedFollowUps.map((item) => (
                    <article
                      className={`case-followup-card priority-${item.priority} ${item.overdue ? "is-overdue" : ""}`}
                      key={item.id}
                    >
                      <div className="case-followup-main">
                        <span>
                          <AlarmClock size={18} />
                        </span>
                        <div>
                          <strong>{item.message}</strong>
                          <small>
                            {item.createdBy} · {operationalDate(item.createdAt)}
                          </small>
                        </div>
                      </div>
                      <div className="case-followup-flags">
                        <b>
                          {item.overdue
                            ? "مهلت گذشته"
                            : followUpPriorityLabels[item.priority]}
                        </b>
                        <span>{item.dueLabel}</span>
                        <em>{followUpStatusLabels[item.status]}</em>
                      </div>
                      <div className="case-followup-actions">
                        {item.status === "new" && (
                          <button
                            className="outline-action compact"
                            onClick={() => updateFollowUp(item.id, "seen")}
                          >
                            مشاهده کردم
                          </button>
                        )}
                        {item.status !== "in_progress" && (
                          <button
                            className="outline-action compact"
                            onClick={() =>
                              updateFollowUp(item.id, "in_progress")
                            }
                          >
                            شروع پیگیری
                          </button>
                        )}
                        <button
                          type="button"
                          className="outline-action compact"
                          onClick={() => setFollowUpDetails(item)}
                        >
                          <MessageSquareMore size={15} />
                          جزئیات و ثبت پاسخ
                        </button>
                        <button
                          className="primary-action compact"
                          onClick={() => updateFollowUp(item.id, "done")}
                        >
                          <CheckCircle2 size={15} />
                          انجام شد
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="operation-section">
              <SectionTitle
                icon={<Activity size={19} />}
                title="مرحله عملیاتی"
                badge="قابل تغییر"
              />
              <div className="stage-buttons">
                {(
                  [
                    "diagnosing",
                    "repairing",
                    "awaiting_part",
                    "awaiting_customer",
                  ] as RepairCaseStatus[]
                ).map((item) => (
                  <button
                    type="button"
                    className={selectedCase.status === item ? "active" : ""}
                    key={item}
                    onClick={() => void changeCaseStatus(item)}
                  >
                    <span />
                    {repairCaseStatusLabels[item]}
                  </button>
                ))}
              </div>
            </section>

            <section className="operation-section part-summary">
              <SectionTitle
                icon={<PackageOpen size={19} />}
                title="قطعات این پرونده"
                badge={`${operations.partRequests.filter((item) => item.receiptNumber === selectedCase.receiptNumber).length} مورد`}
              />
              {operations.partRequests
                .filter(
                  (item) => item.receiptNumber === selectedCase.receiptNumber,
                )
                .map((item) => (
                  <div className="part-line" key={item.id}>
                    <div>
                      <span className="part-code">{item.itemCode}</span>
                      <p>
                        <strong>{item.itemTitle}</strong>
                        <small>
                          {item.quantity} عدد · {item.status}
                        </small>
                      </p>
                    </div>
                  </div>
                ))}
              {operations.partRequests.every(
                (item) => item.receiptNumber !== selectedCase.receiptNumber,
              ) && (
                <ModuleEmptyState
                  compact
                  title="هنوز اطلاعاتی ثبت نشده است"
                  description="برای این پرونده درخواست قطعه‌ای وجود ندارد."
                />
              )}
              <button
                type="button"
                className="outline-action compact"
                onClick={() => onNavigate("درخواست‌های قطعه")}
              >
                <PackagePlus size={16} />
                درخواست قطعه جدید
              </button>
            </section>

            <section className="operation-section report-form">
              <SectionTitle
                icon={<ClipboardCheck size={19} />}
                title="گزارش پایان عملیات"
                badge="الزامی"
              />
              <label className="field-block">
                <span>
                  گزارش عملیات <b>*</b>
                </span>
                <textarea
                  rows={4}
                  value={operationReport}
                  onChange={(event) => setOperationReport(event.target.value)}
                  placeholder="عیب‌یابی، اقدام انجام‌شده و نتیجه تست را ثبت کنید..."
                />
              </label>
              <div className="form-grid two-columns form-row-gap">
                <label className="field-block">
                  <span>
                    نتیجه نهایی <b>*</b>
                  </span>
                  <select
                    value={result}
                    onChange={(event) => setResult(event.target.value)}
                  >
                    <option value="">انتخاب نتیجه</option>
                    <option value="repaired">تعمیر شده</option>
                    <option value="not_repaired">تعمیر نشده</option>
                  </select>
                </label>
                <Field
                  label="قطعات خارج از انبار"
                  placeholder="در صورت استفاده ثبت کنید"
                />
              </div>
            </section>

            <div className="sticky-form-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => void saveReport(false)}
              >
                <Save size={17} />
                ذخیره گزارش
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => void saveReport(true)}
              >
                <PackageCheck size={17} />
                ارسال برای تحویل
              </button>
            </div>
          </section>
        ) : (
          <section className="repair-detail panel">
            <ModuleEmptyState
              title="هنوز اطلاعاتی ثبت نشده است"
              description="پس از تخصیص پرونده، جزئیات دستگاه و عملیات فنی در این بخش نمایش داده می‌شود."
            />
          </section>
        )}
      </div>
      {timelineCase && (
        <CaseDetailsModal
          repairCase={timelineCase}
          onClose={() => setTimelineCase(null)}
        />
      )}
      {followUpDetails && (
        <FollowUpDetailsModal
          item={followUpDetails}
          users={operations.users}
          onClose={() => setFollowUpDetails(null)}
          onSave={async (input) => {
            await onUpdateFollowUp?.(input);
            setFollowUpDetails(null);
          }}
        />
      )}
    </>
  );
}

function DeliveryPage({
  notify,
  workspace,
  shopSettings = {},
  operations = emptyOperationalSnapshot,
  operationsLoading,
  onUpdateRepairCase,
}: PageProps) {
  const [returning, setReturning] = useState<RepairCaseRecord | null>(null);
  const [selectedCase, setSelectedCase] = useState<RepairCaseRecord | null>(
    null,
  );
  const [delivering, setDelivering] = useState<RepairCaseRecord | null>(null);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliveryAmount, setDeliveryAmount] = useState(0);
  const [deliveredToName, setDeliveredToName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [query, setQuery] = useState("");
  const receiptTemplate = (shopSettings.receipt_template ?? {}) as {
    printSize?: string;
    title?: string;
    phone?: string;
    portal?: string;
    clauses?: Array<{ enabled: boolean; text: string }>;
  };
  const normalized = query.trim().toLocaleLowerCase("fa");
  const ready = operations.cases.filter(
    (item) =>
      item.status === "ready_for_delivery" &&
      (!normalized ||
        `${item.receiptNumber} ${item.customerMobile} ${item.customerName} ${item.brand} ${item.model}`
          .toLocaleLowerCase("fa")
          .includes(normalized)),
  );
  const openDelivery = (repairCase: RepairCaseRecord) => {
    setDeliveryAmount(repairCase.deliveryAmount || 0);
    setDeliveredToName(repairCase.deliveredToName || repairCase.customerName);
    setDeliveryNotes(repairCase.deliveryNotes || "");
    setDelivering(repairCase);
  };
  const deliver = async () => {
    if (!delivering || !onUpdateRepairCase) return;
    if (!deliveredToName.trim()) {
      notify("نام تحویل‌گیرنده را ثبت کنید.");
      return;
    }
    setDeliverySaving(true);
    try {
      await onUpdateRepairCase({
        id: delivering.id,
        status: "delivered",
        deliveryAmount,
        deliveredToName: deliveredToName.trim(),
        deliveryNotes: deliveryNotes.trim(),
        reason: `دستگاه به ${deliveredToName.trim()} پس از نمایش و تأیید رسید تحویل شد.`,
      });
      notify(`تحویل رسید ${delivering.receiptNumber} ثبت شد.`);
      setDelivering(null);
    } catch (error) {
      notify(moduleErrorMessage(error, "ثبت تحویل انجام نشد."));
    } finally {
      setDeliverySaving(false);
    }
  };
  const returnToTechnician = async () => {
    if (!returning || !onUpdateRepairCase) return;
    if (!returnReason.trim()) {
      notify("علت بازگشت دستگاه را ثبت کنید.");
      return;
    }
    try {
      await onUpdateRepairCase({
        id: returning.id,
        status: "returned",
        assignedToUserId: returning.assignedToUserId,
        reason: returnReason.trim(),
      });
      notify("بازگشت دستگاه در تاریخچه ثبت شد.");
      setReturning(null);
      setReturnReason("");
    } catch (error) {
      notify(moduleErrorMessage(error, "ثبت بازگشت انجام نشد."));
    }
  };

  return (
    <>
      <ModuleHeader
        icon={<PackageCheck size={26} />}
        eyebrow="صف تحویل مرکزی"
        title="تحویل دستگاه به مشتری"
        description="فقط پرونده‌های آماده تحویل قابل ثبت هستند؛ بازگشت دستگاه با علت به همان تکنسین انجام می‌شود."
      >
        <label className="module-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="رسید یا شماره موبایل"
          />
        </label>
      </ModuleHeader>

      <div className="delivery-summary">
        <article className="mini-stat">
          <span className="tone-sky">
            <PackageCheck />
          </span>
          <div>
            <strong>{operations.summary.readyForDelivery}</strong>
            <small>آماده تحویل</small>
          </div>
        </article>
        <article className="mini-stat">
          <span className="tone-teal">
            <CheckCircle2 />
          </span>
          <div>
            <strong>{operations.summary.deliveredToday}</strong>
            <small>تحویل امروز</small>
          </div>
        </article>
        <article className="mini-stat">
          <span className="tone-coral">
            <RotateCcw />
          </span>
          <div>
            <strong>
              {
                operations.cases.filter((item) => item.status === "returned")
                  .length
              }
            </strong>
            <small>برگشتی باز</small>
          </div>
        </article>
      </div>

      <div className="delivery-grid">
        {ready.map((item) => (
          <article className="delivery-card panel" key={item.id}>
            <div className="delivery-card-head">
              <button
                type="button"
                className="receipt-link"
                onClick={() => setSelectedCase(item)}
              >
                {item.receiptNumber}
              </button>
              <span>{operationalDate(item.updatedAt)}</span>
            </div>
            <div className="delivery-device">
              <span className="tone-sky">
                <Smartphone size={25} />
              </span>
              <div>
                <h3>
                  {item.brand} {item.model}
                </h3>
                <p>{item.customerName}</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>شماره تماس</dt>
                <dd>{item.customerMobile}</dd>
              </div>
              <div>
                <dt>نتیجه تعمیر</dt>
                <dd
                  className={
                    item.result === "repaired" ? "success-text" : "warning-text"
                  }
                >
                  {item.result === "repaired"
                    ? "تعمیر شده"
                    : item.result === "not_repaired"
                      ? "تعمیر نشده"
                      : "ثبت نشده"}
                </dd>
              </div>
              <div>
                <dt>مسئول پرونده</dt>
                <dd>{item.assignedToName || "ثبت نشده"}</dd>
              </div>
            </dl>
            <div className="delivery-actions">
              <button
                type="button"
                className="return-action"
                onClick={() => setReturning(item)}
              >
                <RotateCcw size={16} />
                بازگشت دستگاه
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => openDelivery(item)}
              >
                <PackageCheck size={16} />
                مشاهده رسید و ثبت تحویل
              </button>
            </div>
          </article>
        ))}
      </div>
      {!operationsLoading && ready.length === 0 && (
        <ModuleEmptyState
          title="هنوز اطلاعاتی ثبت نشده است"
          description="پرونده آماده تحویلی وجود ندارد؛ پس از پایان تعمیر، پرونده‌ها در این بخش نمایش داده می‌شوند."
        />
      )}

      {returning && (
        <Modal
          title="بازگشت دستگاه به تکنسین"
          onClose={() => setReturning(null)}
        >
          <div className="return-modal">
            <div className="warning-banner">
              <RotateCcw size={20} />
              <p>
                پرونده <b>{returning.receiptNumber}</b> به مسئول قبلی بازمی‌گردد
                و این تغییر در تاریخچه حفظ می‌شود.
              </p>
            </div>
            <label className="field-block">
              <span>
                شرح ایراد بازگشت <b>*</b>
              </span>
              <textarea
                rows={4}
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                placeholder="علت بازگشت و ایراد مشاهده‌شده را دقیق ثبت کنید..."
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => setReturning(null)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="danger-action"
                onClick={() => void returnToTechnician()}
              >
                <RotateCcw size={16} />
                تأیید بازگشت
              </button>
            </div>
          </div>
        </Modal>
      )}
      {delivering && (
        <Modal
          title={`تأیید تحویل رسید ${delivering.receiptNumber}`}
          onClose={() => !deliverySaving && setDelivering(null)}
          size="wide"
        >
          <div className="delivery-confirmation-modal">
            <div className="delivery-confirmation-banner">
              <PackageCheck size={22} />
              <div>
                <strong>رسید تحویل را بررسی کنید</strong>
                <p>
                  با تأیید نهایی، پرونده تحویل‌شده می‌شود و نام کاربر و زمان
                  شمسی در تاریخچه ثبت خواهد شد.
                </p>
              </div>
            </div>
            <section className="delivery-receipt-summary">
              <div>
                <span>شماره رسید</span>
                <strong dir="ltr">{delivering.receiptNumber}</strong>
              </div>
              <div>
                <span>مشتری</span>
                <strong>{delivering.customerName}</strong>
              </div>
              <div>
                <span>دستگاه</span>
                <strong>
                  {delivering.brand} {delivering.model}
                </strong>
              </div>
              <div>
                <span>وضعیت</span>
                <strong>{repairCaseStatusLabels[delivering.status]}</strong>
              </div>
              <div className="wide">
                <span>گزارش و توضیحات تعمیر</span>
                <strong>
                  {delivering.operationReport || "توضیحی ثبت نشده است"}
                </strong>
              </div>
              <div>
                <span>مبلغ نهایی</span>
                <strong>{operationalNumber.format(deliveryAmount)} ریال</strong>
              </div>
            </section>
            <div className="delivery-final-fields">
              <label className="field-block">
                <span>
                  نام تحویل‌گیرنده <b>*</b>
                </span>
                <input
                  value={deliveredToName}
                  onChange={(event) => setDeliveredToName(event.target.value)}
                  maxLength={180}
                />
              </label>
              <label className="field-block">
                <span>مبلغ نهایی به ریال</span>
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  value={deliveryAmount}
                  onChange={(event) =>
                    setDeliveryAmount(Math.max(0, Number(event.target.value)))
                  }
                />
              </label>
              <label className="field-block wide">
                <span>توضیحات تحویل</span>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(event) => setDeliveryNotes(event.target.value)}
                  placeholder="نحوه تحویل، توضیح مشتری یا نکته پایانی..."
                  maxLength={4000}
                />
              </label>
            </div>
            <ReceiptDocument
              workspace={workspace}
              receiptNumber={delivering.receiptNumber}
              customerName={delivering.customerName}
              customerMobile={delivering.customerMobile}
              catalogItem={{ brand: delivering.brand, model: delivering.model }}
              accessories={delivering.accessories}
              appearanceStates={delivering.appearanceStates}
              declaredIssue={delivering.declaredIssue}
              dataHandling={delivering.dataHandling}
              identifier={delivering.identifier}
              color={delivering.color}
              printSize={receiptTemplate.printSize}
              title={receiptTemplate.title}
              phone={receiptTemplate.phone}
              portal={receiptTemplate.portal}
              conditions={(receiptTemplate.clauses ?? [])
                .filter((item) => item.enabled)
                .map((item) => item.text)}
              issuedAt={delivering.createdAt}
              promisedAt={delivering.promisedAt}
              trackingUrl={delivering.trackingUrl}
              acceptedByName={delivering.createdByName}
            />
            <div className="modal-actions delivery-confirmation-actions">
              <button
                type="button"
                className="outline-action"
                disabled={deliverySaving}
                onClick={() => setDelivering(null)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="outline-action"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                چاپ رسید
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={deliverySaving || !deliveredToName.trim()}
                onClick={() => void deliver()}
              >
                <PackageCheck size={16} />
                {deliverySaving ? "در حال ثبت تحویل..." : "تأیید نهایی تحویل"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {selectedCase && (
        <CaseDetailsModal
          repairCase={selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </>
  );
}

function TrackingPage({
  notify,
  workspace,
  operations = emptyOperationalSnapshot,
  followUps = [],
  onCreateFollowUp,
  onUpdateFollowUp,
}: Pick<
  PageProps,
  | "notify"
  | "workspace"
  | "operations"
  | "followUps"
  | "onCreateFollowUp"
  | "onUpdateFollowUp"
>) {
  const [searched, setSearched] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [mobile, setMobile] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState<
    "open" | "new" | "in_progress" | "overdue" | "done"
  >("open");
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [selectedFollowUp, setSelectedFollowUp] = useState<CaseFollowUp | null>(
    null,
  );
  const canCreateFollowUp =
    workspace?.role === "repair_manager" || workspace?.role === "reception";
  const found = searched
    ? (operations.cases.find(
        (item) =>
          item.receiptNumber.trim().toLocaleLowerCase("fa") ===
            receipt.trim().toLocaleLowerCase("fa") &&
          item.customerMobile === normalizeDigits(mobile),
      ) ?? null)
    : null;
  const normalizedFollowUpQuery = followUpQuery.trim().toLocaleLowerCase("fa");
  const visibleFollowUps = followUps
    .filter((item) => {
      const matchesFilter =
        followUpFilter === "open"
          ? item.status !== "done"
          : followUpFilter === "overdue"
            ? item.status !== "done" && item.overdue
            : item.status === followUpFilter;
      const matchesQuery =
        !normalizedFollowUpQuery ||
        `${item.customer} ${item.device} ${item.receiptId} ${item.ownerName} ${item.message}`
          .toLocaleLowerCase("fa")
          .includes(normalizedFollowUpQuery);
      return matchesFilter && matchesQuery;
    })
    .sort((first, second) => Number(second.overdue) - Number(first.overdue));
  const search = () => {
    if (!receipt.trim() || normalizeDigits(mobile).length !== 11) {
      notify("شماره رسید و موبایل مشتری را کامل کنید.");
      return;
    }
    setSearched(true);
  };
  return (
    <div className="tracking-page">
      <ModuleHeader
        icon={<AlarmClock size={26} />}
        eyebrow={`پیگیری‌های ${workspace?.branch ?? "شعبه جاری"}`}
        title="پیگیری مشتری و ارجاع‌ها"
        description="پیام مشتری را تا تعیین تکلیف نگه دارید، به کاربر مجاز ارجاع دهید و پاسخ‌ها را در تاریخچه غیرقابل‌حذف ثبت کنید."
      />

      <section className="panel followup-management-panel">
        <div className="followup-management-summary">
          <article>
            <span>پیگیری باز</span>
            <strong>
              {operationalNumber.format(
                followUps.filter((item) => item.status !== "done").length,
              )}
            </strong>
          </article>
          <article>
            <span>جدید</span>
            <strong>
              {operationalNumber.format(
                followUps.filter((item) => item.status === "new").length,
              )}
            </strong>
          </article>
          <article>
            <span>در حال پیگیری</span>
            <strong>
              {operationalNumber.format(
                followUps.filter((item) => item.status === "in_progress")
                  .length,
              )}
            </strong>
          </article>
          <article className="danger">
            <span>عقب‌افتاده</span>
            <strong>
              {operationalNumber.format(
                followUps.filter(
                  (item) => item.status !== "done" && item.overdue,
                ).length,
              )}
            </strong>
          </article>
        </div>
        <div className="followup-management-toolbar">
          <label className="module-search">
            <Search size={17} />
            <input
              value={followUpQuery}
              onChange={(event) => setFollowUpQuery(event.target.value)}
              placeholder="جست‌وجوی مشتری، رسید، دستگاه یا مسئول"
            />
          </label>
          <div className="tabs-row compact-tabs">
            {(["open", "new", "in_progress", "overdue", "done"] as const).map(
              (filter) => (
                <button
                  type="button"
                  key={filter}
                  className={followUpFilter === filter ? "active" : ""}
                  onClick={() => setFollowUpFilter(filter)}
                >
                  {filter === "open"
                    ? "همه باز"
                    : filter === "new"
                      ? "جدید"
                      : filter === "in_progress"
                        ? "در حال پیگیری"
                        : filter === "overdue"
                          ? "عقب‌افتاده"
                          : "انجام‌شده"}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="followup-management-list">
          {visibleFollowUps.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`followup-management-card priority-${item.priority} ${item.overdue ? "is-overdue" : ""}`}
              onClick={() => setSelectedFollowUp(item)}
            >
              <span className="followup-dashboard-icon">
                <MessageSquareMore size={18} />
              </span>
              <div className="followup-management-main">
                <div>
                  <strong>{item.customer}</strong>
                  <b dir="ltr">{item.receiptId}</b>
                </div>
                <p>{item.message}</p>
                <small>
                  {item.device} · مسئول: {item.ownerName}
                </small>
              </div>
              <div className="followup-management-state">
                <b>
                  {item.overdue
                    ? "عقب‌افتاده"
                    : followUpPriorityLabels[item.priority]}
                </b>
                <span>{followUpStatusLabels[item.status]}</span>
                <small>{item.dueLabel}</small>
              </div>
              <ChevronLeft size={18} />
            </button>
          ))}
        </div>
        {visibleFollowUps.length === 0 && (
          <ModuleEmptyState
            compact
            title={
              followUps.length
                ? "پیگیری مطابق فیلتر پیدا نشد"
                : "هنوز پیگیری ثبت نشده است"
            }
            description={
              followUps.length
                ? "فیلتر یا عبارت جست‌وجو را تغییر دهید."
                : "شماره قبض و موبایل مشتری را بررسی و سپس اولین پیام را ثبت کنید."
            }
          />
        )}
      </section>

      <section className="tracking-hero panel">
        <div className="tracking-logo">
          <Wrench size={30} />
        </div>
        <span className="welcome-chip">
          <FileSearch size={15} />
          استعلام سریع پرونده
        </span>
        <h2>نمایش وضعیت با رسید و موبایل</h2>
        <p>
          برای پاسخ سریع به تماس مشتری، کد رسید و همان شماره موبایل ثبت‌شده در
          پذیرش را وارد کنید.
        </p>
        <div className="tracking-form">
          <label className="field-block">
            <span>کد رسید</span>
            <div className="input-with-icon">
              <FileClock size={17} />
              <input
                dir="ltr"
                value={receipt}
                onChange={(event) => {
                  setReceipt(event.target.value);
                  setSearched(false);
                }}
                placeholder="کد درج‌شده روی رسید"
              />
            </div>
          </label>
          <label className="field-block">
            <span>شماره موبایل</span>
            <div className="input-with-icon">
              <Phone size={17} />
              <input
                dir="ltr"
                value={mobile}
                onChange={(event) => {
                  setMobile(normalizeDigits(event.target.value));
                  setSearched(false);
                }}
                placeholder="09xxxxxxxxx"
                inputMode="numeric"
                maxLength={11}
              />
            </div>
          </label>
          <button type="button" className="large-primary" onClick={search}>
            <Search size={18} />
            بررسی و ادامه
          </button>
        </div>
      </section>

      {found && (
        <section className="tracking-result panel">
          <div className="tracking-result-head">
            <div>
              <span>رسید {found.receiptNumber}</span>
              <h3>
                {found.brand} {found.model}
              </h3>
              <p>آخرین به‌روزرسانی: {operationalDate(found.updatedAt)}</p>
            </div>
            <b className="status-pill tone-teal">
              {repairCaseStatusLabels[found.status]}
            </b>
          </div>
          <div className="public-timeline">
            {found.events
              .slice()
              .reverse()
              .map((event, index) => (
                <div
                  className={
                    index === found.events.length - 1 ? "active" : "done"
                  }
                  key={event.id}
                >
                  <span>
                    {index === found.events.length - 1 ? (
                      <Wrench size={15} />
                    ) : (
                      <Check size={15} />
                    )}
                  </span>
                  <p>
                    <strong>
                      {event.toStatus
                        ? repairCaseStatusLabels[event.toStatus]
                        : event.description}
                    </strong>
                    <small>{operationalDate(event.createdAt)}</small>
                  </p>
                </div>
              ))}
          </div>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <p>شماره قبض و موبایل با اطلاعات پذیرش تطبیق داده شد.</p>
          </div>
          {canCreateFollowUp && (
            <FollowUpComposer
              key={found.receiptNumber}
              receiptId={found.receiptNumber}
              customerMobile={found.customerMobile}
              device={`${found.deviceType} ${found.brand} ${found.model}`.trim()}
              customer={found.customerName}
              items={followUps.filter(
                (item) => item.receiptId === found.receiptNumber,
              )}
              users={operations.users}
              currentUserName={workspace?.displayName ?? "کاربر جاری"}
              onCreate={(item) => void onCreateFollowUp?.(item)}
            />
          )}
        </section>
      )}
      {searched && !found && (
        <ModuleEmptyState
          title="پرونده‌ای پیدا نشد"
          description="شماره رسید و موبایل باید دقیقاً با اطلاعات ثبت‌شده در پذیرش یکسان باشند."
        />
      )}
      {selectedFollowUp && (
        <FollowUpDetailsModal
          item={selectedFollowUp}
          users={operations.users}
          allowAssignment={
            workspace?.role === "repair_manager" ||
            workspace?.role === "reception"
          }
          onClose={() => setSelectedFollowUp(null)}
          onSave={async (input) => {
            await onUpdateFollowUp?.(input);
            setSelectedFollowUp(null);
          }}
        />
      )}
    </div>
  );
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

const movementLabels: Record<string, string> = {
  in: "ورود",
  out: "خروج",
  reserve: "رزرو",
  release: "آزادسازی",
  return: "عودت",
  adjustment: "اصلاح موجودی",
};
const partRequestLabels: Record<string, string> = {
  pending: "منتظر تصمیم",
  reserved: "رزرو شده",
  needs_supply: "نیازمند تأمین",
  delivered: "تحویل‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};
const hotReturnLabels: Record<string, string> = {
  pending_return: "تحویل نشده",
  waiting_review: "منتظر تأیید",
  settled: "تسویه شده",
  rejected: "رد شده",
};

function InventoryPage({
  onNavigate,
  notify,
  operations = emptyOperationalSnapshot,
  operationsLoading,
  onRefreshOperations,
  onCreateInventoryItem,
  initialView = "stock",
}: PageProps & { initialView?: "stock" | "movements" }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"stock" | "movements">(initialView);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({
    code: "",
    title: "",
    category: "",
    physicalQuantity: 0,
    minimumQuantity: 0,
    hotReturnRequired: false,
  });
  const [selectedItem, setSelectedItem] = useState<
    (typeof operations.inventory)[number] | null
  >(null);
  const [selectedMovement, setSelectedMovement] = useState<
    (typeof operations.movements)[number] | null
  >(null);
  const inventory = operations.inventory.filter((item) =>
    `${item.code} ${item.title} ${item.category}`
      .toLocaleLowerCase("fa")
      .includes(query.trim().toLocaleLowerCase("fa")),
  );
  const movements = operations.movements.filter((item) =>
    `${item.itemCode} ${item.itemTitle} ${item.receiptNumber} ${item.reference}`
      .toLocaleLowerCase("fa")
      .includes(query.trim().toLocaleLowerCase("fa")),
  );
  const physical = operations.inventory.reduce(
    (sum, item) => sum + item.physicalQuantity,
    0,
  );
  const reserved = operations.inventory.reduce(
    (sum, item) => sum + item.reservedQuantity,
    0,
  );
  const belowMinimum = operations.inventory.filter(
    (item) =>
      item.physicalQuantity - item.reservedQuantity <= item.minimumQuantity,
  ).length;
  const exportInventory = () => {
    downloadCsv("tamiran-inventory.csv", [
      ["کد", "عنوان", "دسته", "فیزیکی", "رزرو", "قابل تخصیص"],
      ...operations.inventory.map((item) => [
        item.code,
        item.title,
        item.category,
        item.physicalQuantity,
        item.reservedQuantity,
        item.physicalQuantity - item.reservedQuantity,
      ]),
    ]);
    notify("خروجی موجودی دریافت شد.");
  };
  const saveItem = async () => {
    if (!newItem.code.trim() || !newItem.title.trim()) {
      notify("کد و عنوان کالا را کامل کنید.");
      return;
    }
    if (
      operations.inventory.some(
        (item) =>
          item.code.toLocaleLowerCase("fa") ===
          newItem.code.trim().toLocaleLowerCase("fa"),
      )
    ) {
      notify("این کد کالا قبلاً ثبت شده است.");
      return;
    }
    setSaving(true);
    try {
      await onCreateInventoryItem?.({
        ...newItem,
        code: newItem.code.trim(),
        title: newItem.title.trim(),
        category: newItem.category.trim(),
        physicalQuantity: Math.max(0, newItem.physicalQuantity),
        minimumQuantity: Math.max(0, newItem.minimumQuantity),
      });
      setCreating(false);
      setNewItem({
        code: "",
        title: "",
        category: "",
        physicalQuantity: 0,
        minimumQuantity: 0,
        hotReturnRequired: false,
      });
      notify("کالا و موجودی اولیه آن ثبت شد.");
    } catch (error) {
      notify(moduleErrorMessage(error, "ثبت کالا انجام نشد."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ModuleHeader
        icon={<Boxes size={26} />}
        eyebrow="موجودی و گردش قطعه"
        title="انبار قطعات"
        description="موجودی فیزیکی، رزروشده و دفتر گردش واقعی هر قطعه را مشاهده کنید."
      >
        <button
          type="button"
          className="outline-action"
          onClick={() => void onRefreshOperations?.()}
        >
          <RefreshCw size={17} />
          تازه‌سازی
        </button>
        <button
          type="button"
          className="outline-action"
          disabled={!operations.inventory.length}
          onClick={exportInventory}
        >
          <FileSpreadsheet size={17} />
          خروجی
        </button>
        <button
          type="button"
          className="primary-action"
          onClick={() => setCreating(true)}
        >
          <PackagePlus size={17} />
          تعریف کالا
        </button>
      </ModuleHeader>
      <div className="inventory-metrics">
        <article>
          <span className="tone-teal">
            <Boxes />
          </span>
          <div>
            <small>کالاهای فعال</small>
            <strong>
              {operations.inventory.filter((item) => item.isActive).length}
            </strong>
          </div>
          <em>ثبت‌شده</em>
        </article>
        <article>
          <span className="tone-sky">
            <PackageOpen />
          </span>
          <div>
            <small>موجودی فیزیکی</small>
            <strong>{physical}</strong>
          </div>
          <em>{reserved} رزرو</em>
        </article>
        <article>
          <span className="tone-gold">
            <CircleAlert />
          </span>
          <div>
            <small>نیازمند تأمین</small>
            <strong>{belowMinimum}</strong>
          </div>
          <em>زیر حداقل</em>
        </article>
        <article>
          <span className="tone-coral">
            <Archive />
          </span>
          <div>
            <small>تعهد داغی باز</small>
            <strong>{operations.summary.openHotReturns}</strong>
          </div>
          <button type="button" onClick={() => onNavigate("تعهدهای داغی")}>
            مشاهده
          </button>
        </article>
      </div>
      <div className="tabs-row">
        <button
          type="button"
          className={view === "stock" ? "active" : ""}
          onClick={() => setView("stock")}
        >
          موجودی <b>{operations.inventory.length}</b>
        </button>
        <button
          type="button"
          className={view === "movements" ? "active" : ""}
          onClick={() => setView("movements")}
        >
          دفتر گردش <b>{operations.movements.length}</b>
        </button>
      </div>
      <section className="panel data-panel">
        <div className="data-toolbar">
          <label className="module-search grow">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                view === "stock"
                  ? "جست‌وجوی کد، نام یا دسته"
                  : "جست‌وجوی قطعه، رسید یا مرجع"
              }
            />
          </label>
        </div>
        {view === "stock" ? (
          <div className="responsive-table-wrap">
            <table className="data-table inventory-table">
              <thead>
                <tr>
                  <th>کالا</th>
                  <th>دسته</th>
                  <th>فیزیکی</th>
                  <th>رزرو</th>
                  <th>قابل تخصیص</th>
                  <th>حداقل</th>
                  <th>داغی</th>
                  <th>وضعیت</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => {
                  const available =
                    item.physicalQuantity - item.reservedQuantity;
                  const low = available <= item.minimumQuantity;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="inventory-name">
                          <span className="part-code">{item.code}</span>
                          <p>
                            <strong>{item.title}</strong>
                            <small>{operationalDate(item.updatedAt)}</small>
                          </p>
                        </div>
                      </td>
                      <td>{item.category || "—"}</td>
                      <td>
                        <b>{item.physicalQuantity}</b>
                      </td>
                      <td>
                        <b>{item.reservedQuantity}</b>
                      </td>
                      <td>{available}</td>
                      <td>{item.minimumQuantity}</td>
                      <td>{item.hotReturnRequired ? "الزامی" : "ندارد"}</td>
                      <td>
                        <span
                          className={`status-pill ${low ? "tone-coral" : "tone-teal"}`}
                        >
                          {low ? "نیازمند تأمین" : "موجود"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="row-action"
                          aria-label={`جزئیات ${item.title}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <ChevronLeft size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!operationsLoading && !inventory.length && (
              <ModuleEmptyState
                title="هنوز اطلاعاتی ثبت نشده است"
                description="کالای انباری یا نتیجه‌ای مطابق جست‌وجو وجود ندارد."
              />
            )}
          </div>
        ) : (
          <div className="responsive-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>قطعه</th>
                  <th>نوع گردش</th>
                  <th>تعداد</th>
                  <th>رسید</th>
                  <th>ثبت‌کننده</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{operationalDate(movement.createdAt)}</td>
                    <td>
                      <strong>{movement.itemTitle}</strong>
                      <small className="part-code">{movement.itemCode}</small>
                    </td>
                    <td>
                      {movementLabels[movement.movementType] ??
                        movement.movementType}
                    </td>
                    <td>{movement.quantity}</td>
                    <td>{movement.receiptNumber || "—"}</td>
                    <td>{movement.actorName}</td>
                    <td>
                      <button
                        type="button"
                        className="row-action"
                        aria-label="جزئیات گردش"
                        onClick={() => setSelectedMovement(movement)}
                      >
                        <ChevronLeft size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!operationsLoading && !movements.length && (
              <ModuleEmptyState
                title="هنوز اطلاعاتی ثبت نشده است"
                description="هنوز گردش انباری ثبت نشده است."
              />
            )}
          </div>
        )}
      </section>
      {selectedItem && (
        <Modal title="جزئیات کالای انبار" onClose={() => setSelectedItem(null)}>
          <div className="detail-grid">
            <DetailValue label="کد کالا" value={selectedItem.code} />
            <DetailValue label="عنوان" value={selectedItem.title} />
            <DetailValue label="دسته" value={selectedItem.category || "—"} />
            <DetailValue
              label="موجودی فیزیکی"
              value={String(selectedItem.physicalQuantity)}
            />
            <DetailValue
              label="رزروشده"
              value={String(selectedItem.reservedQuantity)}
            />
            <DetailValue
              label="آخرین تغییر"
              value={operationalDate(selectedItem.updatedAt)}
            />
          </div>
        </Modal>
      )}
      {selectedMovement && (
        <Modal
          title="جزئیات گردش انبار"
          onClose={() => setSelectedMovement(null)}
        >
          <div className="detail-grid">
            <DetailValue
              label="قطعه"
              value={`${selectedMovement.itemCode} — ${selectedMovement.itemTitle}`}
            />
            <DetailValue
              label="نوع گردش"
              value={
                movementLabels[selectedMovement.movementType] ??
                selectedMovement.movementType
              }
            />
            <DetailValue
              label="تعداد"
              value={String(selectedMovement.quantity)}
            />
            <DetailValue
              label="شماره رسید"
              value={selectedMovement.receiptNumber || "—"}
            />
            <DetailValue
              label="مرجع"
              value={selectedMovement.reference || "—"}
            />
            <DetailValue label="ثبت‌کننده" value={selectedMovement.actorName} />
          </div>
          {selectedMovement.notes && (
            <p className="detail-note">{selectedMovement.notes}</p>
          )}
        </Modal>
      )}
      {creating && (
        <Modal title="تعریف کالای انبار" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <label className="field-block">
              <span>
                کد کالا <b>*</b>
              </span>
              <input
                dir="ltr"
                value={newItem.code}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-block">
              <span>
                عنوان کالا <b>*</b>
              </span>
              <input
                value={newItem.title}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field-block">
              <span>دسته</span>
              <input
                value={newItem.category}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              />
            </label>
            <div className="form-grid two">
              <label className="field-block">
                <span>موجودی اولیه</span>
                <input
                  type="number"
                  min={0}
                  value={newItem.physicalQuantity}
                  onChange={(event) =>
                    setNewItem((current) => ({
                      ...current,
                      physicalQuantity: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="field-block">
                <span>حداقل موجودی</span>
                <input
                  type="number"
                  min={0}
                  value={newItem.minimumQuantity}
                  onChange={(event) =>
                    setNewItem((current) => ({
                      ...current,
                      minimumQuantity: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <label className="confirm-check">
              <input
                type="checkbox"
                checked={newItem.hotReturnRequired}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    hotReturnRequired: event.target.checked,
                  }))
                }
              />
              <span>
                <Check size={14} />
              </span>
              عودت قطعه داغی الزامی است
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => setCreating(false)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={saving}
                onClick={() => void saveItem()}
              >
                <Save size={16} />
                {saving ? "در حال ذخیره..." : "ثبت کالا"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function PartRequestsPage({
  onNavigate,
  notify,
  operations = emptyOperationalSnapshot,
  operationsLoading,
  onCreatePartRequest,
}: PageProps) {
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState<
    (typeof operations.partRequests)[number] | null
  >(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestForm, setRequestForm] = useState({
    caseId: 0,
    itemId: 0,
    quantity: 1,
    notes: "",
  });
  const filtered =
    tab === "all"
      ? operations.partRequests
      : operations.partRequests.filter((item) => item.status === tab);
  const tabs = ["pending", "reserved", "needs_supply", "all"];
  return (
    <>
      <ModuleHeader
        icon={<PackageOpen size={26} />}
        eyebrow="درخواست، رزرو و خروج"
        title="درخواست‌های قطعه"
        description="تمام درخواست‌ها از داده واقعی پرونده و انبار خوانده می‌شوند."
      >
        <button
          type="button"
          className="outline-action"
          onClick={() => onNavigate("انبار قطعات")}
        >
          <Boxes size={17} />
          انبار و گردش
        </button>
        <button
          type="button"
          className="primary-action"
          onClick={() => setCreating(true)}
        >
          <PackagePlus size={17} />
          درخواست جدید
        </button>
      </ModuleHeader>
      <div className="tabs-row">
        {tabs.map((key) => (
          <button
            type="button"
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {key === "all" ? "همه" : partRequestLabels[key]}
            <b>
              {key === "all"
                ? operations.partRequests.length
                : operations.partRequests.filter((item) => item.status === key)
                    .length}
            </b>
          </button>
        ))}
      </div>
      <div className="request-list">
        {filtered.map((request) => (
          <article className="request-card panel" key={request.id}>
            <div
              className={`request-accent ${request.status === "needs_supply" || request.status === "rejected" ? "tone-coral" : "tone-teal"}`}
            />
            <div className="request-main">
              <div className="request-id">
                <span>{request.publicId}</span>
                <button type="button" onClick={() => setSelected(request)}>
                  {request.receiptNumber}
                </button>
              </div>
              <h3>{request.itemTitle}</h3>
              <p>
                <span className="part-code">{request.itemCode}</span>
                <b>{request.quantity} عدد</b>
              </p>
            </div>
            <div className="request-owner">
              <span>درخواست‌کننده</span>
              <strong>{request.requestedByName}</strong>
              <small>{operationalDate(request.createdAt)}</small>
            </div>
            <div className="request-stock">
              <span>وضعیت</span>
              <strong>
                {partRequestLabels[request.status] ?? request.status}
              </strong>
              <small>{operationalDate(request.updatedAt)}</small>
            </div>
            <div className="request-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => setSelected(request)}
              >
                <FileSearch size={16} />
                جزئیات
              </button>
            </div>
          </article>
        ))}
      </div>
      {!operationsLoading && !filtered.length && (
        <ModuleEmptyState
          title="هنوز اطلاعاتی ثبت نشده است"
          description="درخواستی در این وضعیت ثبت نشده است."
        />
      )}
      {selected && (
        <Modal title="جزئیات درخواست قطعه" onClose={() => setSelected(null)}>
          <div className="detail-grid">
            <DetailValue label="شناسه" value={selected.publicId} />
            <DetailValue label="رسید" value={selected.receiptNumber} />
            <DetailValue
              label="قطعه"
              value={`${selected.itemCode} — ${selected.itemTitle}`}
            />
            <DetailValue label="تعداد" value={String(selected.quantity)} />
            <DetailValue
              label="وضعیت"
              value={partRequestLabels[selected.status] ?? selected.status}
            />
            <DetailValue
              label="درخواست‌کننده"
              value={selected.requestedByName}
            />
          </div>
          {selected.notes && <p className="detail-note">{selected.notes}</p>}
        </Modal>
      )}
      {creating && (
        <Modal title="ثبت درخواست قطعه" onClose={() => setCreating(false)}>
          <div className="form-stack">
            {operations.cases.length && operations.inventory.length ? (
              <>
                <label className="field-block">
                  <span>
                    پرونده <b>*</b>
                  </span>
                  <select
                    value={requestForm.caseId || ""}
                    onChange={(event) =>
                      setRequestForm((current) => ({
                        ...current,
                        caseId: Number(event.target.value),
                      }))
                    }
                  >
                    <option value="" disabled>
                      انتخاب پرونده
                    </option>
                    {operations.cases
                      .filter(
                        (item) =>
                          !["delivered", "cancelled"].includes(item.status),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.receiptNumber} · {item.brand} {item.model}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field-block">
                  <span>
                    قطعه <b>*</b>
                  </span>
                  <select
                    value={requestForm.itemId || ""}
                    onChange={(event) =>
                      setRequestForm((current) => ({
                        ...current,
                        itemId: Number(event.target.value),
                      }))
                    }
                  >
                    <option value="" disabled>
                      انتخاب قطعه
                    </option>
                    {operations.inventory
                      .filter((item) => item.isActive)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field-block">
                  <span>تعداد</span>
                  <input
                    type="number"
                    min={1}
                    value={requestForm.quantity}
                    onChange={(event) =>
                      setRequestForm((current) => ({
                        ...current,
                        quantity: Math.max(1, Number(event.target.value)),
                      }))
                    }
                  />
                </label>
                <label className="field-block">
                  <span>توضیحات</span>
                  <textarea
                    rows={3}
                    value={requestForm.notes}
                    onChange={(event) =>
                      setRequestForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : (
              <ModuleEmptyState
                title="هنوز اطلاعاتی ثبت نشده است"
                description="برای ثبت درخواست، ابتدا یک پرونده و یک کالای انبار تعریف کنید."
              />
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => setCreating(false)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={saving || !requestForm.caseId || !requestForm.itemId}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onCreatePartRequest?.({
                      ...requestForm,
                      notes: requestForm.notes.trim(),
                    });
                    setCreating(false);
                    setRequestForm({
                      caseId: 0,
                      itemId: 0,
                      quantity: 1,
                      notes: "",
                    });
                    notify("درخواست قطعه ثبت شد.");
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : "ثبت درخواست انجام نشد.",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Save size={16} />
                {saving ? "در حال ثبت..." : "ثبت درخواست"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function HotReturnsPage({
  onNavigate,
  operations = emptyOperationalSnapshot,
  operationsLoading,
  onRefreshOperations,
}: PageProps) {
  const [selected, setSelected] = useState<
    (typeof operations.hotReturns)[number] | null
  >(null);
  const open = operations.hotReturns.filter(
    (item) => item.status !== "settled",
  ).length;
  return (
    <>
      <ModuleHeader
        icon={<Archive size={26} />}
        eyebrow="زنجیره قطعه معیوب"
        title="تعهدهای داغی"
        description="تعهد داغی تا تعیین تکلیف نهایی در این فهرست باز می‌ماند."
      >
        <button
          type="button"
          className="outline-action"
          onClick={() => void onRefreshOperations?.()}
        >
          <RefreshCw size={17} />
          تازه‌سازی
        </button>
        <button
          type="button"
          className="outline-action"
          onClick={() => onNavigate("تنظیمات")}
        >
          <Settings2 size={16} />
          سیاست داغی
        </button>
      </ModuleHeader>
      <div className="hot-overview">
        <article className="hot-limit-card panel">
          <div className="hot-limit-ring">
            <strong>{open}</strong>
            <span>تعهد باز</span>
          </div>
          <div>
            <h3>کنترل بازگشت قطعه معیوب</h3>
            <p>
              سوابق بر اساس پرونده، قطعه، تکنسین و زمان واقعی نگهداری می‌شوند.
            </p>
          </div>
        </article>
      </div>
      <section className="panel data-panel">
        <div className="responsive-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>تعهد و قطعه</th>
                <th>پرونده</th>
                <th>تکنسین</th>
                <th>زمان ایجاد</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {operations.hotReturns.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="inventory-name">
                      <span className="part-code">{item.publicId}</span>
                      <p>
                        <strong>{item.itemTitle}</strong>
                        <small>
                          {item.itemCode} · {item.quantity} عدد
                        </small>
                      </p>
                    </div>
                  </td>
                  <td>{item.receiptNumber}</td>
                  <td>{item.technicianName}</td>
                  <td>{operationalDate(item.createdAt)}</td>
                  <td>
                    <span
                      className={`status-pill ${item.status === "settled" ? "tone-teal" : item.status === "waiting_review" ? "tone-gold" : "tone-coral"}`}
                    >
                      {hotReturnLabels[item.status] ?? item.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="row-action"
                      aria-label="جزئیات تعهد"
                      onClick={() => setSelected(item)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!operationsLoading && !operations.hotReturns.length && (
            <ModuleEmptyState
              title="هنوز اطلاعاتی ثبت نشده است"
              description="هیچ تعهد داغی برای قطعات ثبت نشده است."
            />
          )}
        </div>
      </section>
      {selected && (
        <Modal title="جزئیات تعهد داغی" onClose={() => setSelected(null)}>
          <div className="detail-grid">
            <DetailValue label="شناسه" value={selected.publicId} />
            <DetailValue label="رسید" value={selected.receiptNumber} />
            <DetailValue
              label="قطعه"
              value={`${selected.itemCode} — ${selected.itemTitle}`}
            />
            <DetailValue label="تکنسین" value={selected.technicianName} />
            <DetailValue
              label="وضعیت"
              value={hotReturnLabels[selected.status] ?? selected.status}
            />
            <DetailValue
              label="آخرین تغییر"
              value={operationalDate(selected.updatedAt)}
            />
          </div>
          {selected.notes && <p className="detail-note">{selected.notes}</p>}
        </Modal>
      )}
    </>
  );
}

function ReportsPage({
  notify,
  operations = emptyOperationalSnapshot,
}: Pick<PageProps, "notify" | "operations">) {
  const [fromDate, setFromDate] = useState(reportWeekStart);
  const [toDate, setToDate] = useState(reportToday);
  const cases = operations.cases.filter(
    (item) =>
      item.createdAt.slice(0, 10) >= fromDate &&
      item.createdAt.slice(0, 10) <= toDate,
  );
  const delivered = cases.filter((item) => item.status === "delivered").length;
  const repaired = cases.filter((item) => item.result === "repaired").length;
  const notRepaired = cases.filter(
    (item) => item.result === "not_repaired",
  ).length;
  const bars = [
    { label: "پذیرش", value: cases.length, color: "teal" },
    {
      label: "تخصیص",
      value: cases.filter((item) => item.assignedToUserId).length,
      color: "sky",
    },
    { label: "تعمیرشده", value: repaired, color: "gold" },
    { label: "تعمیرنشده", value: notRepaired, color: "coral" },
    { label: "تحویل", value: delivered, color: "green" },
  ];
  const technicians = operations.users.filter(
    (user) => user.role === "technician",
  );
  const exportReport = () => {
    downloadCsv("tamiran-repairs.csv", [
      ["رسید", "مشتری", "دستگاه", "وضعیت", "تکنسین", "تاریخ"],
      ...cases.map((item) => [
        item.receiptNumber,
        item.customerName,
        `${item.deviceType} ${item.brand} ${item.model}`,
        repairCaseStatusLabels[item.status],
        item.assignedToName || "—",
        operationalDate(item.createdAt),
      ]),
    ]);
    notify("خروجی گزارش دریافت شد.");
  };
  return (
    <>
      <ModuleHeader
        icon={<BarChart3 size={26} />}
        eyebrow="گزارش رویدادمحور"
        title="گزارش عملکرد تعمیرات"
        description="شاخص‌ها فقط از پرونده‌های واقعی و بازه انتخابی محاسبه می‌شوند."
      >
        <button
          type="button"
          className="outline-action"
          disabled={!cases.length}
          onClick={exportReport}
        >
          <FileDown size={17} />
          خروجی
        </button>
      </ModuleHeader>
      <section className="report-filters panel">
        <div className="date-field persian-report-date">
          <span>از تاریخ</span>
          <PersianDatePicker
            value={fromDate}
            onChange={setFromDate}
            compact
            ariaLabel="انتخاب تاریخ شروع گزارش"
          />
        </div>
        <ChevronLeft size={17} />
        <div className="date-field persian-report-date">
          <span>تا تاریخ</span>
          <PersianDatePicker
            value={toDate}
            onChange={setToDate}
            compact
            ariaLabel="انتخاب تاریخ پایان گزارش"
          />
        </div>
      </section>
      <div className="report-kpis">
        <ReportKpi
          label="پذیرش"
          value={String(cases.length)}
          delta="در بازه انتخابی"
          tone="teal"
        />
        <ReportKpi
          label="تحویل‌شده"
          value={String(delivered)}
          delta="پرونده"
          tone="sky"
        />
        <ReportKpi
          label="تعمیر موفق"
          value={String(repaired)}
          delta="پرونده"
          tone="gold"
        />
        <ReportKpi
          label="بدون مسئول"
          value={String(
            cases.filter(
              (item) =>
                !item.assignedToUserId &&
                !["delivered", "cancelled"].includes(item.status),
            ).length,
          )}
          delta="نیازمند اقدام"
          tone="coral"
        />
      </div>
      {!cases.length ? (
        <ModuleEmptyState
          title="هنوز اطلاعاتی ثبت نشده است"
          description="در بازه انتخابی پرونده‌ای برای گزارش وجود ندارد."
        />
      ) : (
        <>
          <section className="panel chart-panel">
            <SectionTitle
              icon={<Gauge size={19} />}
              title="رویدادهای بازه"
              badge={`${cases.length} پرونده`}
            />
            <div className="bars-area report-bars">
              {bars.map((bar) => (
                <div className="bar-column" key={bar.label}>
                  <div className="bar-value">{bar.value}</div>
                  <span
                    className={`chart-bar bar-${bar.color}`}
                    style={{ height: `${Math.max(bar.value * 7, 4)}px` }}
                  />
                  <small>{bar.label}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="panel data-panel">
            <SectionTitle
              icon={<UsersRound size={19} />}
              title="عملکرد تکنسین‌ها"
              badge="داده واقعی"
            />
            <div className="responsive-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>تکنسین</th>
                    <th>پرونده‌ها</th>
                    <th>تعمیر شده</th>
                    <th>تعمیر نشده</th>
                    <th>تعهد داغی باز</th>
                  </tr>
                </thead>
                <tbody>
                  {technicians.map((user) => {
                    const assigned = cases.filter(
                      (item) => item.assignedToUserId === user.id,
                    );
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.displayName}</strong>
                        </td>
                        <td>{assigned.length}</td>
                        <td>
                          {
                            assigned.filter(
                              (item) => item.result === "repaired",
                            ).length
                          }
                        </td>
                        <td>
                          {
                            assigned.filter(
                              (item) => item.result === "not_repaired",
                            ).length
                          }
                        </td>
                        <td>
                          {
                            operations.hotReturns.filter(
                              (item) =>
                                item.technicianName === user.displayName &&
                                item.status !== "settled",
                            ).length
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!technicians.length && (
                <ModuleEmptyState
                  compact
                  title="هنوز اطلاعاتی ثبت نشده است"
                  description="تکنسینی تعریف نشده است."
                />
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function AuditPage({
  notify,
  operations = emptyOperationalSnapshot,
}: Pick<PageProps, "notify" | "operations">) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    receipt: string;
    event: RepairCaseRecord["events"][number];
  } | null>(null);
  const events = operations.cases
    .flatMap((repairCase) =>
      repairCase.events.map((event) => ({
        receipt: repairCase.receiptNumber,
        event,
      })),
    )
    .sort((a, b) => b.event.createdAt.localeCompare(a.event.createdAt))
    .filter((item) =>
      `${item.receipt} ${item.event.actorName} ${item.event.description}`
        .toLocaleLowerCase("fa")
        .includes(query.trim().toLocaleLowerCase("fa")),
    );
  const exportAudit = () => {
    downloadCsv("tamiran-audit.csv", [
      ["زمان", "رسید", "کاربر", "رویداد", "شرح"],
      ...events.map((item) => [
        operationalDate(item.event.createdAt),
        item.receipt,
        item.event.actorName,
        item.event.eventType,
        item.event.description,
      ]),
    ]);
    notify("خروجی رویدادها دریافت شد.");
  };
  return (
    <>
      <ModuleHeader
        icon={<ShieldCheck size={26} />}
        eyebrow="تاریخچه عملیاتی"
        title="ممیزی و رویدادها"
        description="رویدادهای پرونده با نام کاربر و زمان واقعی نگهداری می‌شوند."
      >
        <button
          type="button"
          className="outline-action"
          disabled={!events.length}
          onClick={exportAudit}
        >
          <Download size={17} />
          خروجی
        </button>
      </ModuleHeader>
      <section className="integrity-banner">
        <div className="integrity-icon">
          <ShieldCheck size={31} />
        </div>
        <div>
          <span>کنترل نمایشی داده‌ها</span>
          <h3>تاریخچه پرونده‌ها در دسترس است</h3>
          <p>{events.length} رویداد عملیاتی در فضای جاری قابل مشاهده است.</p>
        </div>
        <b>
          <CheckCircle2 size={18} />
          ثبت‌شده
        </b>
      </section>
      <section className="panel audit-events">
        <div className="data-toolbar">
          <label className="module-search grow">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی کاربر، رسید یا شرح رویداد"
            />
          </label>
        </div>
        <div className="event-list">
          {events.map((item) => (
            <article key={`${item.receipt}-${item.event.id}`}>
              <span className="tone-teal">
                <Activity size={18} />
              </span>
              <div>
                <strong>{item.receipt}</strong>
                <p>{item.event.description}</p>
              </div>
              <div className="event-user">
                <b>{item.event.actorName}</b>
                <small>{operationalDate(item.event.createdAt)}</small>
              </div>
              <button
                type="button"
                className="row-action"
                aria-label="جزئیات رویداد"
                onClick={() => setSelected(item)}
              >
                <ChevronLeft size={17} />
              </button>
            </article>
          ))}
        </div>
        {!events.length && (
          <ModuleEmptyState
            title="هنوز اطلاعاتی ثبت نشده است"
            description="رویدادی مطابق جست‌وجو وجود ندارد."
          />
        )}
      </section>
      {selected && (
        <Modal title="جزئیات رویداد" onClose={() => setSelected(null)}>
          <div className="detail-grid">
            <DetailValue label="رسید" value={selected.receipt} />
            <DetailValue label="کاربر" value={selected.event.actorName} />
            <DetailValue
              label="زمان"
              value={operationalDate(selected.event.createdAt)}
            />
            <DetailValue label="نوع رویداد" value={selected.event.eventType} />
            <DetailValue
              label="وضعیت قبلی"
              value={
                selected.event.fromStatus
                  ? repairCaseStatusLabels[selected.event.fromStatus]
                  : "—"
              }
            />
            <DetailValue
              label="وضعیت جدید"
              value={
                selected.event.toStatus
                  ? repairCaseStatusLabels[selected.event.toStatus]
                  : "—"
              }
            />
          </div>
          <p className="detail-note">{selected.event.description}</p>
        </Modal>
      )}
    </>
  );
}

function SettingsPage({
  notify,
  workspace,
  deviceCatalog = [],
  setDeviceCatalog,
  operations = emptyOperationalSnapshot,
  shopSettings = {},
  setShopSettings,
}: Pick<
  PageProps,
  | "notify"
  | "workspace"
  | "deviceCatalog"
  | "setDeviceCatalog"
  | "operations"
  | "shopSettings"
  | "setShopSettings"
>) {
  const [tab, setTab] = useState("پروفایل تعمیرگاه");
  const tabs = [
    "پروفایل تعمیرگاه",
    "فرم‌های صنفی",
    "قبض و چاپ",
    "حساب من",
    "کاربران و نقش‌ها",
    "اطلاعات پایه",
    "سیاست انبار",
    "امنیت و بکاپ",
  ];
  return (
    <>
      <ModuleHeader
        icon={<Settings2 size={26} />}
        eyebrow="تنظیمات نقش‌محور"
        title="تنظیمات سامانه"
        description="هر نقش فقط حساب شخصی و تنظیمات مجاز خود را می‌بیند؛ مسیرهای حساس سمت سرور نیز کنترل می‌شوند."
      />
      <div className="settings-layout">
        <aside className="settings-tabs panel">
          {tabs.map((item) => (
            <button
              className={tab === item ? "active" : ""}
              key={item}
              onClick={() => setTab(item)}
            >
              <span>{settingsIcon(item)}</span>
              {item}
              <ChevronLeft size={16} />
            </button>
          ))}
        </aside>
        <section className="settings-content panel">
          {tab === "پروفایل تعمیرگاه" && (
            <WorkshopProfileSettings
              notify={notify}
              workspace={workspace}
              savedAddressPolicy={shopSettings.customer_address_policy}
              savedAllowDeliveryWithBalance={Boolean(
                (shopSettings.__shop as
                  | { allowDeliveryWithBalance?: boolean }
                  | undefined)?.allowDeliveryWithBalance,
              )}
              onAddressPolicySaved={(value) =>
                setShopSettings?.((current) => ({
                  ...current,
                  customer_address_policy: value,
                }))
              }
              onAllowDeliveryWithBalanceSaved={(value) =>
                setShopSettings?.((current) => ({
                  ...current,
                  __shop: {
                    ...((current.__shop as Record<string, unknown>) ?? {}),
                    allowDeliveryWithBalance: value,
                  },
                }))
              }
            />
          )}
          {tab === "فرم‌های صنفی" && (
            <ServiceFormSettings
              notify={notify}
              workspace={workspace}
              saved={shopSettings.service_forms}
              onSaved={(value) =>
                setShopSettings?.((current) => ({
                  ...current,
                  service_forms: value,
                }))
              }
            />
          )}
          {tab === "قبض و چاپ" && (
            <ReceiptSettings
              notify={notify}
              saved={shopSettings.receipt_template}
              onSaved={(value) =>
                setShopSettings?.((current) => ({
                  ...current,
                  receipt_template: value,
                }))
              }
            />
          )}
          {tab === "حساب من" && (
            <AccountSettings notify={notify} workspace={workspace} />
          )}
          {tab === "کاربران و نقش‌ها" && (
            <UserSettings
              notify={notify}
              users={operations.users}
              workspace={workspace}
              saved={shopSettings.assignment_policy}
              onSaved={(value) =>
                setShopSettings?.((current) => ({
                  ...current,
                  assignment_policy: value,
                }))
              }
            />
          )}
          {tab === "اطلاعات پایه" && (
            <BaseDataSettings
              notify={notify}
              items={deviceCatalog}
              setItems={setDeviceCatalog}
              savedColors={shopSettings.device_colors}
              onColorsSaved={(value) =>
                setShopSettings?.((current) => ({
                  ...current,
                  device_colors: value,
                }))
              }
            />
          )}
          {tab === "سیاست انبار" && (
            <InventorySettings
              notify={notify}
              saved={shopSettings.inventory_policy}
              onSaved={(value) =>
                setShopSettings?.((current) => ({
                  ...current,
                  inventory_policy: value,
                }))
              }
            />
          )}
          {tab === "امنیت و بکاپ" && <SecuritySettings />}
        </section>
      </div>
    </>
  );
}

function WorkshopProfileSettings({
  notify,
  workspace,
  savedAddressPolicy,
  savedAllowDeliveryWithBalance,
  onAddressPolicySaved,
  onAllowDeliveryWithBalanceSaved,
}: {
  notify: (message: string) => void;
  workspace?: WorkspaceProfile;
  savedAddressPolicy?: unknown;
  savedAllowDeliveryWithBalance: boolean;
  onAddressPolicySaved: (value: Record<string, unknown>) => void;
  onAllowDeliveryWithBalanceSaved: (value: boolean) => void;
}) {
  const [nationalRequired, setNationalRequired] = useState(
    Boolean(workspace?.nationalCodeRequired),
  );
  const [addressRequired, setAddressRequired] = useState(
    Boolean(
      (savedAddressPolicy as { required?: boolean } | undefined)?.required,
    ),
  );
  const [allowDeliveryWithBalance, setAllowDeliveryWithBalance] = useState(
    savedAllowDeliveryWithBalance,
  );
  useEffect(() => {
    setAllowDeliveryWithBalance(savedAllowDeliveryWithBalance);
  }, [savedAllowDeliveryWithBalance]);
  const saveNationalRequirement = async (checked: boolean) => {
    setNationalRequired(checked);
    try {
      if (directAdminApiEnabled)
        await updateShopSettings({ nationalCodeRequired: checked });
      notify(`کد ملی در پذیرش ${checked ? "اجباری" : "اختیاری"} شد`);
    } catch (error) {
      setNationalRequired(!checked);
      notify(moduleErrorMessage(error, "ذخیره تنظیم کد ملی انجام نشد"));
    }
  };
  const saveDeliveryWithBalance = async (checked: boolean) => {
    setAllowDeliveryWithBalance(checked);
    try {
      if (directAdminApiEnabled)
        await updateShopSettings({ allowDeliveryWithBalance: checked });
      onAllowDeliveryWithBalanceSaved(checked);
      notify(
        checked
          ? "تحویل با مانده فقط با ثبت مطالبه مدیر مجاز شد"
          : "تحویل پرونده دارای مانده مالی ممنوع شد",
      );
    } catch (error) {
      setAllowDeliveryWithBalance(!checked);
      notify(moduleErrorMessage(error, "ذخیره سیاست تحویل با مانده انجام نشد"));
    }
  };
  const saveAddressRequirement = async (checked: boolean) => {
    setAddressRequired(checked);
    const value = { required: checked };
    try {
      if (directAdminApiEnabled)
        await saveShopSetting("customer_address_policy", value);
      onAddressPolicySaved(value);
      notify(`ثبت آدرس مشتری در پذیرش ${checked ? "الزامی" : "اختیاری"} شد`);
    } catch (error) {
      setAddressRequired(!checked);
      notify(moduleErrorMessage(error, "ذخیره تنظیم آدرس انجام نشد"));
    }
  };
  return (
    <div className="settings-section">
      <SectionTitle
        icon={<Settings2 size={19} />}
        title="پروفایل و ساختار تعمیرگاه"
        badge={workspace?.shopCode ?? "—"}
      />
      <div className="workshop-profile-banner">
        <div className="profile-avatar">
          <Wrench size={24} />
        </div>
        <div>
          <h3>{workspace?.shopName || "تعمیرگاه"}</h3>
          <p>
            محصول{" "}
            {workspace?.productProfile === "solo"
              ? "Tamiran Solo"
              : "Tamiran Pro"}{" "}
            · اعتبار تا {workspace?.expiresAt || "تعریف‌نشده"}
          </p>
          <div>
            {(workspace?.services ?? []).map((service) => (
              <span key={service}>{service}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-form">
        <h3>شناسه و لینک ورود</h3>
        <p>
          کد، مرز فضای کاری است. لینک اختصاصی فقط همین کد را از قبل پر می‌کند و
          سامانه جداگانه‌ای نمی‌سازد.
        </p>
        <div className="detail-grid">
          <DetailValue
            label="کد تعمیرگاه (غیرقابل تغییر)"
            value={workspace?.shopCode || "—"}
          />
          <DetailValue label="شعبه جاری" value={workspace?.branch || "—"} />
        </div>
      </div>

      <div className="settings-form">
        <h3>اشتراک و اعتبار پنل</h3>
        <p>اطلاعات لایسنس فقط توسط ادمین تعمیران تغییر می‌کند.</p>
        <div className="form-grid three-columns">
          <Field
            label="محصول فعال"
            defaultValue={
              workspace?.productProfile === "solo"
                ? "تعمیران Solo"
                : "تعمیران Pro"
            }
          />
          <Field
            label="تاریخ انقضا"
            defaultValue={workspace?.expiresAt ?? "تعریف نشده"}
          />
          <Field
            label="وضعیت لایسنس"
            defaultValue={workspace?.licenseStatus ?? "تعریف نشده"}
          />
        </div>
      </div>

      <div className="toggle-list">
        <ToggleRow
          title="اجباری بودن کد ملی در پذیرش"
          description="در صورت فعال بودن، کد ۱۰ رقمی با الگوریتم کد ملی ایران کنترل می‌شود."
          checked={nationalRequired}
          onChange={saveNationalRequirement}
        />
        <ToggleRow
          title="اجباری بودن آدرس مشتری"
          description="در صورت فعال بودن، استان، شهر، نشانی و کد پستی ۱۰ رقمی پیش از ثبت پذیرش کنترل می‌شود."
          checked={addressRequired}
          onChange={saveAddressRequirement}
        />
        <ToggleRow
          title="تحویل پرونده دارای مانده مالی"
          description="در صورت فعال بودن، تحویل فقط پس از ثبت مطالبه توسط مدیر تعمیرگاه مجاز است."
          checked={allowDeliveryWithBalance}
          onChange={saveDeliveryWithBalance}
        />
      </div>

      <div className="settings-note">
        <ShieldEllipsis size={19} />
        <p>
          هویت، نوع تعمیرگاه، شعبه‌ها، محصول و تاریخ انقضا فقط توسط ادمین مرکزی
          تعمیران مدیریت می‌شوند.
        </p>
      </div>

      <div className="toggle-list">
        <ToggleRow
          title="پرتال پیگیری مشتری"
          description="وضعیت، هزینه قابل تأیید و شرایط عمومی را با واژه‌های صنف نشان می‌دهد"
          checked
        />
        <ToggleRow
          title="ثبت اجباری تغییر شعبه"
          description="مبدأ، مقصد، کاربر و زمان جابه‌جایی در دفتر ممیزی ثبت شود"
          checked
        />
        <ToggleRow
          title="حالت ساده برای کاربران تک‌نفره"
          description="تخصیص به خود، کنترل کیفیت داخلی و انتقال‌های غیرضروری پنهان شود"
        />
      </div>
    </div>
  );
}

function ServiceFormSettings({
  notify,
  workspace,
  saved,
  onSaved,
}: {
  notify: (message: string) => void;
  workspace?: WorkspaceProfile;
  saved?: unknown;
  onSaved: (value: Record<string, unknown>) => void;
}) {
  const allowedProfiles = serviceKeysForWorkshop(workspace?.repairType);
  const [profile, setProfile] = useState<ServiceKey>(allowedProfiles[0]);
  const fieldRows: Record<ServiceKey, string[]> = {
    mobile: ["برند", "مدل", "رنگ", "IMEI", "رمز بازکردن دستگاه"],
    laptop: [
      "برند",
      "مدل",
      "سریال",
      "رمز ورود",
      "وضعیت اطلاعات",
      "لوازم همراه",
    ],
    appliance: ["نوع وسیله", "برند", "مدل", "سریال", "محل خدمت", "لوازم همراه"],
    automotive: ["برند", "مدل", "پلاک", "کارکرد", "شماره شاسی", "سطح سوخت"],
    motorcycle: [
      "برند",
      "مدل",
      "پلاک",
      "کارکرد",
      "شماره موتور",
      "کلاه و اقلام همراه",
    ],
    generic: [
      "شرح کالا یا تجهیز",
      "برند",
      "مدل",
      "شناسه",
      "نشانه ظاهری",
      "لوازم همراه",
    ],
  };
  const savedForms = (saved && typeof saved === "object" ? saved : {}) as {
    orders?: Partial<Record<ServiceKey, string[]>>;
    policies?: Record<
      string,
      { mode: string; receipt: boolean; customer: boolean }
    >;
    terminology?: Partial<
      Record<
        ServiceKey,
        { itemLabel: string; identifierLabel: string; issueLabel: string }
      >
    >;
  };
  const [orders, setOrders] = useState<Partial<Record<ServiceKey, string[]>>>(
    savedForms.orders ?? fieldRows,
  );
  const [policies, setPolicies] = useState(savedForms.policies ?? {});
  const [terminology, setTerminology] = useState<
    Partial<
      Record<
        ServiceKey,
        { itemLabel: string; identifierLabel: string; issueLabel: string }
      >
    >
  >(savedForms.terminology ?? {});
  const currentTerminology = terminology[profile] ?? {
    itemLabel: serviceProfiles[profile].itemLabel,
    identifierLabel: serviceProfiles[profile].identifierLabel,
    issueLabel: `ایراد اعلامی ${serviceProfiles[profile].itemLabel}`,
  };
  const visibleFields = (orders[profile] ?? fieldRows[profile]).filter(
    (field) => field !== "وضعیت ظاهری",
  );
  const policyFor = (field: string) =>
    policies[`${profile}|${field}`] ?? {
      mode:
        field.includes("رمز") || (profile === "appliance" && field === "سریال")
          ? "اختیاری"
          : "الزامی",
      receipt: !field.includes("رمز"),
      customer: !field.includes("رمز"),
    };
  const patchPolicy = (
    field: string,
    patch: Partial<{ mode: string; receipt: boolean; customer: boolean }>,
  ) =>
    setPolicies((current) => ({
      ...current,
      [`${profile}|${field}`]: { ...policyFor(field), ...patch },
    }));
  const moveField = (index: number, direction: -1 | 1) =>
    setOrders((current) => {
      const list = [...(current[profile] ?? fieldRows[profile])];
      const target = index + direction;
      if (target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...current, [profile]: list };
    });
  const addCustomField = () => {
    const name = window.prompt("عنوان فیلد سفارشی را وارد کنید:")?.trim();
    if (!name) return;
    setOrders((current) => ({
      ...current,
      [profile]: [...(current[profile] ?? fieldRows[profile]), name],
    }));
  };
  const saveForms = async () => {
    const value = { orders, policies, terminology };
    try {
      if (directAdminApiEnabled) await saveShopSetting("service_forms", value);
      onSaved(value);
      notify(`قواعد فرم ${serviceProfiles[profile].title} ذخیره شد.`);
    } catch (error) {
      notify(moduleErrorMessage(error, "ذخیره قواعد فرم انجام نشد"));
    }
  };

  return (
    <div className="settings-section">
      <SectionTitle
        icon={<SlidersHorizontal size={19} />}
        title="فرم‌ها و واژه‌های صنفی"
        badge={workspace?.services?.[0] ?? "صنف جاری"}
      />
      <div className="service-settings-intro">
        <Sparkles size={21} />
        <div>
          <strong>
            فقط فرم‌های مرتبط با صنف همین تعمیرگاه نمایش داده می‌شوند.
          </strong>
          <p>
            نوع تعمیرگاه پس از راه‌اندازی قفل است و فرم صنف‌های دیگر در این فضا
            قابل مشاهده یا انتخاب نیست.
          </p>
        </div>
      </div>
      <div className="service-settings-tabs">
        {allowedProfiles.map((key) => (
          <button
            type="button"
            className={profile === key ? "active" : ""}
            key={key}
            onClick={() => setProfile(key)}
          >
            {profile === key && <Check size={14} />}
            {serviceProfiles[key].title}
          </button>
        ))}
      </div>
      <div className="form-terminology-grid">
        <label className="field-block">
          <span>نام آیتم در فرم</span>
          <input
            value={currentTerminology.itemLabel}
            onChange={(event) =>
              setTerminology((current) => ({
                ...current,
                [profile]: {
                  ...currentTerminology,
                  itemLabel: event.target.value,
                },
              }))
            }
          />
        </label>
        <label className="field-block">
          <span>نام شناسه اصلی</span>
          <input
            value={currentTerminology.identifierLabel}
            onChange={(event) =>
              setTerminology((current) => ({
                ...current,
                [profile]: {
                  ...currentTerminology,
                  identifierLabel: event.target.value,
                },
              }))
            }
          />
        </label>
        <label className="field-block">
          <span>عنوان ایراد مشتری</span>
          <input
            value={currentTerminology.issueLabel}
            onChange={(event) =>
              setTerminology((current) => ({
                ...current,
                [profile]: {
                  ...currentTerminology,
                  issueLabel: event.target.value,
                },
              }))
            }
          />
        </label>
      </div>
      <div className="responsive-table-wrap field-policy-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>فیلد</th>
              <th>وضعیت</th>
              <th>روی قبض</th>
              <th>برای مشتری</th>
              <th>ترتیب</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((field, index) => {
              const sensitive = field.includes("رمز");
              const policy = policyFor(field);
              return (
                <tr key={field}>
                  <td>
                    <strong>{field}</strong>
                    {sensitive && (
                      <small className="sensitive-label">محرمانه</small>
                    )}
                  </td>
                  <td>
                    <select
                      value={policy.mode}
                      onChange={(event) =>
                        patchPolicy(field, { mode: event.target.value })
                      }
                    >
                      <option>الزامی</option>
                      <option>اختیاری</option>
                      <option>پنهان</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={policy.receipt}
                      disabled={sensitive}
                      onChange={(event) =>
                        patchPolicy(field, { receipt: event.target.checked })
                      }
                      aria-label={`نمایش ${field} روی قبض`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={policy.customer}
                      disabled={sensitive}
                      onChange={(event) =>
                        patchPolicy(field, { customer: event.target.checked })
                      }
                      aria-label={`نمایش ${field} برای مشتری`}
                    />
                  </td>
                  <td>
                    <span className="sort-actions">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                        aria-label="انتقال به بالا"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === visibleFields.length - 1}
                        onClick={() => moveField(index, 1)}
                        aria-label="انتقال به پایین"
                      >
                        ↓
                      </button>
                      <b>{index + 1}</b>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sensitive-policy">
        <ShieldCheck size={18} />
        <p>
          رمز دستگاه، رمز ورود، Apple ID و Google Account حتی با تغییر قالب،
          اجازه چاپ یا نمایش در پرتال مشتری ندارند.
        </p>
      </div>
      <div className="settings-footer-actions">
        <button
          type="button"
          className="outline-action"
          onClick={addCustomField}
        >
          <PackagePlus size={16} />
          فیلد سفارشی
        </button>
        <button
          type="button"
          className="primary-action"
          onClick={() => void saveForms()}
        >
          <Save size={16} />
          ذخیره قواعد فرم
        </button>
      </div>
    </div>
  );
}

function ReceiptSettings({
  notify,
  saved,
  onSaved,
}: {
  notify: (message: string) => void;
  saved?: unknown;
  onSaved: (value: Record<string, unknown>) => void;
}) {
  const savedTemplate = (saved && typeof saved === "object" ? saved : {}) as {
    printSize?: string;
    title?: string;
    phone?: string;
    portal?: string;
    clauses?: Array<{ id: number; enabled: boolean; text: string }>;
    appearanceOptions?: string[];
  };
  const [printSize, setPrintSize] = useState(savedTemplate.printSize ?? "A5");
  const [title, setTitle] = useState(
    savedTemplate.title ?? "رسید پذیرش و شرایط تعمیر",
  );
  const [phone, setPhone] = useState(savedTemplate.phone ?? "");
  const [portal, setPortal] = useState(savedTemplate.portal ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newClause, setNewClause] = useState("");
  const [newAppearance, setNewAppearance] = useState("");
  const [appearanceOptions, setAppearanceOptions] = useState(
    savedTemplate.appearanceOptions?.length
      ? savedTemplate.appearanceOptions
      : defaultAppearanceStates,
  );
  const [clauses, setClauses] = useState(
    savedTemplate.clauses ?? [
      {
        id: 1,
        enabled: true,
        text: "تحویل مورد پذیرش صرفاً با ارائه رسید یا احراز هویت مشتری انجام می‌شود.",
      },
      {
        id: 2,
        enabled: true,
        text: "هزینه نهایی پس از عیب‌یابی اعلام و انجام تعمیر منوط به تأیید مشتری است.",
      },
      {
        id: 3,
        enabled: true,
        text: "ضمانت فقط شامل عملیات و قطعات درج‌شده در همین قبض و در بازه اعلامی است.",
      },
      {
        id: 4,
        enabled: false,
        text: "مسئولیت تهیه نسخه پشتیبان از اطلاعات، پیش از تحویل دستگاه، بر عهده مشتری است.",
      },
    ],
  );

  const addClause = () => {
    if (!newClause.trim()) return;
    setClauses((current) => [
      ...current,
      { id: Date.now(), enabled: true, text: newClause.trim() },
    ]);
    setNewClause("");
  };

  const moveClause = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= clauses.length) return;
    setClauses((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveTemplate = async () => {
    const value = {
      printSize,
      title,
      phone,
      portal,
      clauses,
      appearanceOptions,
    };
    try {
      if (directAdminApiEnabled)
        await saveShopSetting("receipt_template", value);
      onSaved(value);
      notify("قالب قبض و شرایط تعمیرگاه ذخیره شد.");
    } catch (error) {
      notify(moduleErrorMessage(error, "ذخیره قالب قبض انجام نشد"));
    }
  };

  return (
    <div className="settings-section receipt-settings">
      <SectionTitle
        icon={<Printer size={19} />}
        title="قبض، چاپ و شرایط تعمیرگاه"
        badge={`${printSize} عمودی`}
      />
      <div className="print-size-picker">
        {[
          { id: "A4", note: "جزئیات کامل" },
          { id: "A5", note: "پیشنهادی" },
          { id: "حرارتی", note: "عرض ۸۰ میلی‌متر" },
        ].map((size) => (
          <button
            type="button"
            className={printSize === size.id ? "active" : ""}
            key={size.id}
            onClick={() => setPrintSize(size.id)}
          >
            <Printer size={19} />
            <strong>{size.id}</strong>
            <small>{size.note}</small>
            {printSize === size.id && <CheckCircle2 size={16} />}
          </button>
        ))}
      </div>
      <div className="form-grid two-columns form-row-gap">
        <label className="field-block">
          <span>عنوان سربرگ</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>شماره تماس روی قبض</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="شماره تماس تعمیرگاه"
          />
        </label>
        <label className="field-block">
          <span>نشانی وب یا پرتال</span>
          <input
            value={portal}
            onChange={(event) => setPortal(event.target.value)}
            placeholder="نشانی اختصاصی تعمیرگاه"
          />
        </label>
        <SelectField
          label="محل امضای مشتری"
          options={["پایین شرایط", "کنار امضای پذیرش", "عدم نمایش"]}
        />
      </div>

      <div className="settings-form appearance-settings">
        <h3>گزینه‌های وضعیت ظاهری دستگاه</h3>
        <p>
          پذیرش می‌تواند چند گزینه را هم‌زمان انتخاب کند و نتیجه روی قبض همان
          مراجعه چاپ می‌شود.
        </p>
        <div className="choice-chips">
          {appearanceOptions.map((item) => (
            <button
              type="button"
              className="selected"
              key={item}
              onClick={() =>
                setAppearanceOptions((current) =>
                  current.filter((value) => value !== item),
                )
              }
            >
              <X size={13} />
              {item}
            </button>
          ))}
        </div>
        <div className="inline-add-row">
          <input
            value={newAppearance}
            onChange={(event) => setNewAppearance(event.target.value)}
            placeholder="وضعیت جدید؛ مانند شکستگی قاب"
            maxLength={120}
          />
          <button
            type="button"
            className="outline-action"
            onClick={() => {
              const value = newAppearance.trim();
              if (!value || appearanceOptions.includes(value)) return;
              setAppearanceOptions((current) => [...current, value]);
              setNewAppearance("");
            }}
          >
            <Plus size={16} />
            افزودن وضعیت
          </button>
        </div>
      </div>

      <div className="settings-form clause-section">
        <div className="settings-section-head">
          <div>
            <h3>شرایط قابل چاپ</h3>
            <p>
              بندهای پیش‌فرض را فعال، ویرایش، مرتب یا حذف کنید و شرط اختصاصی
              خودتان را بیفزایید.
            </p>
          </div>
          <span className="status-pill tone-teal">
            {clauses.filter((item) => item.enabled).length} بند فعال
          </span>
        </div>
        <div className="clause-list">
          {clauses.map((clause, index) => (
            <article key={clause.id} className={clause.enabled ? "active" : ""}>
              <label className="clause-toggle">
                <input
                  type="checkbox"
                  checked={clause.enabled}
                  onChange={(event) =>
                    setClauses((current) =>
                      current.map((item) =>
                        item.id === clause.id
                          ? { ...item, enabled: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                <span />
              </label>
              <b>{index + 1}</b>
              <textarea
                value={clause.text}
                onChange={(event) =>
                  setClauses((current) =>
                    current.map((item) =>
                      item.id === clause.id
                        ? { ...item, text: event.target.value }
                        : item,
                    ),
                  )
                }
                rows={2}
              />
              <span className="clause-actions">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveClause(index, -1)}
                  aria-label="بالا"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === clauses.length - 1}
                  onClick={() => moveClause(index, 1)}
                  aria-label="پایین"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="delete"
                  onClick={() =>
                    setClauses((current) =>
                      current.filter((item) => item.id !== clause.id),
                    )
                  }
                  aria-label="حذف"
                >
                  <X size={15} />
                </button>
              </span>
            </article>
          ))}
        </div>
        <div className="add-clause">
          <textarea
            rows={2}
            value={newClause}
            onChange={(event) => setNewClause(event.target.value)}
            placeholder="شرط اختصاصی تعمیرگاه را بنویسید..."
          />
          <button type="button" className="outline-action" onClick={addClause}>
            <PackagePlus size={16} />
            افزودن شرط
          </button>
        </div>
      </div>

      <div className="toggle-list">
        <ToggleRow
          title="چاپ شرایط ضمانت"
          description="مدت و دامنه ضمانت هر عملیات در قبض درج شود"
          checked
        />
        <ToggleRow
          title="چاپ وضعیت پرداخت و مانده"
          description="جمع هزینه، پرداخت‌شده و مانده مشتری نمایش داده شود"
          checked
        />
        <ToggleRow
          title="امضای پذیرش‌کننده و مشتری"
          description="جای امضا و تاریخ در انتهای نسخه چاپی قرار گیرد"
          checked
        />
        <ToggleRow
          title="چاپ اطلاعات محرمانه"
          description="این گزینه به دلایل امنیتی همیشه خاموش و قفل است"
        />
      </div>
      <div className="sensitive-policy">
        <LockKeyhole size={18} />
        <p>
          رمز دستگاه و اطلاعات حساب کاربری در هیچ اندازه چاپی یا خروجی PDF قرار
          نمی‌گیرند.
        </p>
      </div>
      <div className="settings-footer-actions">
        <button
          type="button"
          className="outline-action"
          onClick={() => setPreviewOpen(true)}
        >
          <Printer size={16} />
          پیش‌نمایش چاپ
        </button>
        <button
          type="button"
          className="primary-action"
          onClick={() => void saveTemplate()}
        >
          <Save size={16} />
          ذخیره قالب چاپ
        </button>
      </div>
      {previewOpen && (
        <Modal
          title="پیش‌نمایش قالب قبض"
          onClose={() => setPreviewOpen(false)}
          size="wide"
        >
          <div className="receipt-complete-view">
            <ReceiptDocument
              receiptNumber="----"
              customerName="نام مشتری"
              customerMobile="09xxxxxxxxx"
              catalogItem={{ brand: "برند", model: "مدل" }}
              accessories={["بدون لوازم"]}
              appearanceStates={appearanceOptions.slice(0, 2)}
              declaredIssue="دستگاه روشن نمی‌شود"
              dataHandling="coordinate_first"
              color="مشکی"
              printSize={printSize}
              title={title}
              phone={phone}
              portal={portal}
              conditions={clauses
                .filter((item) => item.enabled)
                .map((item) => item.text)}
            />
            <div className="modal-actions receipt-modal-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                چاپ پیش‌نمایش {printSize}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AccountSettings({
  workspace,
}: {
  notify: (message: string) => void;
  workspace?: WorkspaceProfile;
}) {
  const initials = (workspace?.displayName || "ک")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <div className="settings-section">
      <SectionTitle
        icon={<UserCog size={19} />}
        title="حساب من"
        badge={
          operationalRoleLabels[workspace?.role ?? ""] ??
          workspace?.role ??
          "کاربر"
        }
      />
      <div className="profile-card">
        <div className="profile-avatar">{initials}</div>
        <div>
          <h3>{workspace?.displayName || "کاربر سامانه"}</h3>
          <p>{workspace?.shopName || "مدیریت مرکزی تعمیران"}</p>
          <span className="status-pill tone-teal">حساب فعال</span>
        </div>
        <div className="access-summary">
          <strong>
            {operationalRoleLabels[workspace?.role ?? ""] ?? "دسترسی نقش‌محور"}
          </strong>
          <p>دسترسی‌ها بر اساس نقش، تعمیرگاه و شعبه جاری کنترل می‌شوند.</p>
        </div>
      </div>
      <div className="settings-note">
        <LockKeyhole size={19} />
        <p>
          تغییر رمز و مشخصات حساب از بخش مدیریت کاربران انجام می‌شود و نشست‌های
          قبلی پس از تغییر حساس باطل خواهند شد.
        </p>
      </div>
    </div>
  );
}

function UserSettings({
  users,
  notify,
  workspace,
  saved,
  onSaved,
}: {
  users: OperationalUser[];
  notify: (message: string) => void;
  workspace?: WorkspaceProfile;
  saved?: unknown;
  onSaved: (value: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<OperationalUser | null>(null);
  const savedPolicy = (saved && typeof saved === "object" ? saved : {}) as {
    branches?: Record<
      string,
      {
        defaultTechnicianId?: number | null;
        autoAssignSingleTechnician?: boolean;
      }
    >;
  };
  const branchKey = String(workspace?.branchId ?? "offline");
  const currentBranchPolicy = savedPolicy.branches?.[branchKey] ?? {};
  const [defaultTechnicianId, setDefaultTechnicianId] = useState<number | null>(
    currentBranchPolicy.defaultTechnicianId ?? null,
  );
  const [autoAssignSingle, setAutoAssignSingle] = useState(
    currentBranchPolicy.autoAssignSingleTechnician !== false,
  );
  const [savingAssignment, setSavingAssignment] = useState(false);
  const assignmentCandidates = users.filter(
    (user) =>
      user.isActive && ["technician", "repair_manager"].includes(user.role),
  );
  const defaultUnavailable = Boolean(
    defaultTechnicianId &&
    !assignmentCandidates.some((user) => user.id === defaultTechnicianId),
  );

  const saveAssignment = async () => {
    setSavingAssignment(true);
    const branchValue = {
      defaultTechnicianId,
      autoAssignSingleTechnician: autoAssignSingle,
    };
    try {
      if (directAdminApiEnabled)
        await saveShopSetting("assignment_policy", branchValue);
      onSaved({
        ...savedPolicy,
        branches: { ...(savedPolicy.branches ?? {}), [branchKey]: branchValue },
      });
      notify("قواعد تخصیص تکنسین برای شعبه جاری ذخیره شد.");
    } catch (error) {
      notify(moduleErrorMessage(error, "ذخیره تکنسین پیش‌فرض انجام نشد."));
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <SectionTitle
          icon={<UsersRound size={19} />}
          title="کاربران و نقش‌ها"
          badge={`${users.length} کاربر`}
        />
      </div>
      <div className="settings-form assignment-policy-settings">
        <div className="settings-section-head">
          <div>
            <h3>تخصیص پذیرش در شعبه {workspace?.branch ?? "جاری"}</h3>
            <p>
              برای تعمیرگاه تک‌نفره، پرونده بدون مرحله ارجاع مستقیماً وارد
              کارتابل تکنسین می‌شود.
            </p>
          </div>
          <span className="status-pill tone-teal">شعبه‌ای</span>
        </div>
        <label className="field-block">
          <span>تکنسین پیش‌فرض</span>
          <select
            value={defaultTechnicianId ?? ""}
            onChange={(event) =>
              setDefaultTechnicianId(
                event.target.value ? Number(event.target.value) : null,
              )
            }
          >
            <option value="">بدون تکنسین پیش‌فرض</option>
            {assignmentCandidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} · {operationalRoleLabels[user.role]}
              </option>
            ))}
          </select>
        </label>
        <ToggleRow
          title="تخصیص خودکار در شعبه تک‌تکنسین"
          description="اگر فقط یک تکنسین فعال باشد، انتخاب مسئول از فرم پذیرش حذف و پرونده خودکار به او ارجاع می‌شود."
          checked={autoAssignSingle}
          onChange={setAutoAssignSingle}
        />
        {defaultUnavailable && (
          <div className="assignment-warning">
            <CircleAlert size={17} />
            <span>
              تکنسین پیش‌فرض قبلی دیگر فعال یا عضو این شعبه نیست؛ گزینه جدیدی
              انتخاب کنید.
            </span>
          </div>
        )}
        {!assignmentCandidates.length && (
          <div className="assignment-warning">
            <CircleAlert size={17} />
            <span>
              برای این شعبه هنوز تکنسین یا مدیر عملیاتی فعالی تعریف نشده است.
            </span>
          </div>
        )}
        <div className="settings-footer-actions">
          <button
            type="button"
            className="primary-action"
            disabled={savingAssignment || defaultUnavailable}
            onClick={() => void saveAssignment()}
          >
            <Save size={16} />
            {savingAssignment ? "در حال ذخیره..." : "ذخیره تنظیم تخصیص"}
          </button>
        </div>
      </div>
      <div className="responsive-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>کاربر</th>
              <th>نقش</th>
              <th>وضعیت</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName}</strong>
                </td>
                <td>{operationalRoleLabels[user.role] ?? user.role}</td>
                <td>
                  <span
                    className={`status-pill ${user.isActive ? "tone-teal" : "neutral"}`}
                  >
                    {user.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="row-action"
                    aria-label="مشاهده کاربر"
                    onClick={() => setSelected(user)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && (
          <ModuleEmptyState
            title="هنوز اطلاعاتی ثبت نشده است"
            description="به‌جز حساب مدیریتی جاری، کاربری برای این تعمیرگاه تعریف نشده است."
          />
        )}
      </div>
      <div className="settings-note">
        <ShieldEllipsis size={19} />
        <p>
          ساخت و ویرایش حساب‌ها توسط مدیر مجاز انجام می‌شود و همه تغییرات نقش و
          وضعیت در سمت سرور کنترل می‌شوند.
        </p>
      </div>
      {selected && (
        <Modal title="مشخصات کاربر" onClose={() => setSelected(null)}>
          <div className="detail-grid">
            <DetailValue label="نام" value={selected.displayName} />
            <DetailValue
              label="نقش"
              value={operationalRoleLabels[selected.role] ?? selected.role}
            />
            <DetailValue
              label="وضعیت"
              value={selected.isActive ? "فعال" : "غیرفعال"}
            />
            <DetailValue label="شناسه داخلی" value={String(selected.id)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function BaseDataSettings({
  notify,
  items,
  setItems,
  savedColors,
  onColorsSaved,
}: {
  notify: (message: string) => void;
  items: DeviceCatalogItem[];
  setItems?: React.Dispatch<React.SetStateAction<DeviceCatalogItem[]>>;
  savedColors?: unknown;
  onColorsSaved: (value: DeviceColorOption[]) => void;
}) {
  const [selectedType, setSelectedType] = useState("");
  const [search, setSearch] = useState("");
  const [newType, setNewType] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [importing, setImporting] = useState(false);
  const [colors, setColors] = useState<DeviceColorOption[]>(() =>
    normalizeDeviceColors(savedColors),
  );
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#808080");
  const [savingColors, setSavingColors] = useState(false);
  const deviceTypes = Array.from(
    new Set(items.map((item) => item.deviceType)),
  ).sort((first, second) =>
    displayDeviceType(first).localeCompare(displayDeviceType(second), "fa"),
  );
  const activeType = selectedType || deviceTypes[0] || "";

  const visibleItems = items.filter((item) => {
    const matchesType = item.deviceType === activeType;
    const query = search.trim().toLocaleLowerCase("fa");
    return (
      matchesType &&
      (!query ||
        `${item.brand} ${item.model}`.toLocaleLowerCase("fa").includes(query))
    );
  });

  const refreshCatalog = async () => {
    if (!directAdminApiEnabled) return;
    const latest = await loadCatalog();
    setItems?.(latest);
  };

  const addModel = async () => {
    const type = newType.trim() || activeType;
    const brand = newBrand.trim();
    const model = newModel.trim();
    if (!type || !brand || !model) {
      notify("برای افزودن، نوع دستگاه، برند و مدل را کامل کنید");
      return;
    }
    const duplicate = items.some(
      (item) =>
        item.deviceType.toLocaleLowerCase("fa") ===
          type.toLocaleLowerCase("fa") &&
        item.brand.toLocaleLowerCase("fa") === brand.toLocaleLowerCase("fa") &&
        item.model.toLocaleLowerCase("fa") === model.toLocaleLowerCase("fa"),
    );
    if (duplicate) {
      notify("این ترکیب نوع، برند و مدل قبلاً تعریف شده است");
      return;
    }
    try {
      if (directAdminApiEnabled) {
        await createCatalogItem({ type, brand, model });
        await refreshCatalog();
      } else {
        setItems?.((current) => [
          ...current,
          {
            id: Date.now(),
            deviceType: type,
            brand,
            model,
            usageCount: 0,
            isActive: true,
          },
        ]);
      }
      setSelectedType(type);
      setNewType("");
      setNewBrand("");
      setNewModel("");
      notify(
        `${displayDeviceType(type)} · ${brand} ${model} به فهرست پذیرش اضافه شد`,
      );
    } catch (error) {
      notify(moduleErrorMessage(error, "افزودن مدل انجام نشد"));
    }
  };

  const importExcel = async (file?: File) => {
    if (!file) return;
    const targetType = newType.trim() || activeType;
    if (!targetType) {
      notify("پیش از ورود Excel، نوع دستگاه را انتخاب یا وارد کنید");
      return;
    }
    setImporting(true);
    try {
      const rows = await readSheet(file);
      if (!rows.length) throw new Error("empty");
      const firstRow = rows[0].map((cell) =>
        String(cell ?? "")
          .trim()
          .toLocaleLowerCase("fa"),
      );
      const hasHeader =
        ["برند", "مارک", "brand"].includes(firstRow[0]) &&
        ["مدل", "model"].includes(firstRow[1]);
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const existingKeys = new Set(
        items.map(
          (item) =>
            `${item.deviceType.trim().toLocaleLowerCase("fa")}|${item.brand.trim().toLocaleLowerCase("fa")}|${item.model.trim().toLocaleLowerCase("fa")}`,
        ),
      );
      const imported: DeviceCatalogItem[] = [];
      let duplicates = 0;
      dataRows.forEach((row, index) => {
        const brand = String(row[0] ?? "").trim();
        const model = String(row[1] ?? "").trim();
        if (!brand || !model) return;
        const key = `${targetType.toLocaleLowerCase("fa")}|${brand.toLocaleLowerCase("fa")}|${model.toLocaleLowerCase("fa")}`;
        if (existingKeys.has(key)) {
          duplicates += 1;
          return;
        }
        existingKeys.add(key);
        imported.push({
          id: Date.now() + index,
          deviceType: targetType,
          brand,
          model,
          usageCount: 0,
          isActive: true,
        });
      });
      if (!imported.length) {
        notify(
          duplicates
            ? "همه ردیف‌های فایل قبلاً در فهرست وجود داشتند"
            : "ردیف معتبری در دو ستون برند و مدل پیدا نشد",
        );
      } else {
        if (directAdminApiEnabled) {
          for (const item of imported)
            await createCatalogItem({
              type: targetType,
              brand: item.brand,
              model: item.model,
            });
          await refreshCatalog();
        } else {
          setItems?.((current) => [...current, ...imported]);
        }
        setSelectedType(targetType);
        setNewType("");
        notify(
          `${imported.length} مدل برای نوع «${displayDeviceType(targetType)}» وارد شد${duplicates ? `؛ ${duplicates} ردیف تکراری نادیده گرفته شد` : ""}`,
        );
      }
    } catch (error) {
      notify(
        moduleErrorMessage(
          error,
          "فایل خوانده نشد؛ فایل باید XLSX و شامل دو ستون برند و مدل باشد",
        ),
      );
    } finally {
      setImporting(false);
    }
  };

  const removeModel = async (item: DeviceCatalogItem) => {
    if (item.usageCount > 0) {
      notify(
        `${item.brand} ${item.model} دارای ${item.usageCount} سابقه است؛ حذف ممکن نیست و فقط می‌توانید آن را غیرفعال کنید`,
      );
      return;
    }
    try {
      if (directAdminApiEnabled) {
        await updateCatalogItem({ id: item.id, delete: true });
        await refreshCatalog();
      } else {
        setItems?.((current) =>
          current.filter((currentItem) => currentItem.id !== item.id),
        );
      }
      notify(`${item.brand} ${item.model} حذف شد`);
    } catch (error) {
      notify(moduleErrorMessage(error, "حذف مدل انجام نشد"));
    }
  };

  const toggleModel = async (item: DeviceCatalogItem) => {
    try {
      if (directAdminApiEnabled) {
        await updateCatalogItem({ id: item.id, active: !item.isActive });
        await refreshCatalog();
      } else {
        setItems?.((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, isActive: !currentItem.isActive }
              : currentItem,
          ),
        );
      }
      notify(
        `${item.brand} ${item.model} ${item.isActive ? "غیرفعال" : "فعال"} شد`,
      );
    } catch (error) {
      notify(moduleErrorMessage(error, "تغییر وضعیت مدل انجام نشد"));
    }
  };

  const persistColors = async (next: DeviceColorOption[], message: string) => {
    setSavingColors(true);
    try {
      if (directAdminApiEnabled) await saveShopSetting("device_colors", next);
      setColors(next);
      onColorsSaved(next);
      notify(message);
    } catch (error) {
      notify(moduleErrorMessage(error, "ذخیره فهرست رنگ‌ها انجام نشد"));
    } finally {
      setSavingColors(false);
    }
  };

  const addColor = async () => {
    const name = newColorName.trim();
    if (!name) {
      notify("نام رنگ را وارد کنید");
      return;
    }
    if (colors.some((item) => item.name.toLocaleLowerCase("fa") === name.toLocaleLowerCase("fa"))) {
      notify("این رنگ قبلاً در فهرست وجود دارد");
      return;
    }
    const next = [
      ...colors,
      {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `color-${Date.now()}`,
        name,
        hex: newColorHex,
        active: true,
        sortOrder: colors.length + 1,
      },
    ];
    await persistColors(next, `رنگ «${name}» اضافه شد`);
    setNewColorName("");
  };

  const toggleColor = async (target: DeviceColorOption) => {
    const next = colors.map((item) =>
      item.id === target.id ? { ...item, active: !item.active } : item,
    );
    await persistColors(next, `رنگ «${target.name}» ${target.active ? "غیرفعال" : "فعال"} شد`);
  };

  return (
    <div className="settings-section catalog-settings">
      <section className="device-color-settings">
        <div className="settings-section-head">
          <SectionTitle
            icon={<SlidersHorizontal size={19} />}
            title="رنگ‌های دستگاه"
            badge={`${colors.filter((item) => item.active).length} رنگ فعال`}
          />
        </div>
        <p className="field-helper">این فهرست در پذیرش و ویرایش دستگاه استفاده می‌شود. غیرفعال‌کردن رنگ، سوابق قبلی را حذف نمی‌کند.</p>
        <div className="device-color-add">
          <label>
            <span>نام رنگ</span>
            <input value={newColorName} onChange={(event) => setNewColorName(event.target.value)} placeholder="مثلاً تیتانیوم طبیعی" />
          </label>
          <label>
            <span>نمایش رنگی اختیاری</span>
            <input type="color" value={newColorHex} onChange={(event) => setNewColorHex(event.target.value)} />
          </label>
          <button type="button" className="primary-action" disabled={savingColors} onClick={() => void addColor()}>
            <Plus size={16} /> افزودن رنگ
          </button>
        </div>
        <div className="device-color-list">
          {colors.map((color) => (
            <button
              type="button"
              key={color.id}
              className={color.active ? "active" : "inactive"}
              onClick={() => void toggleColor(color)}
              disabled={savingColors}
              title={color.active ? "غیرفعال‌کردن" : "فعال‌کردن"}
            >
              <i style={{ background: color.hex || "#d7e5e3" }} />
              <span>{color.name}</span>
              <small>{color.active ? "فعال" : "غیرفعال"}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="settings-section-head">
        <SectionTitle
          icon={<Smartphone size={19} />}
          title="تعریف نوع، برند و مدل"
          badge={`${items.length} مدل`}
        />
        <label className={`excel-import-button ${importing ? "loading" : ""}`}>
          <FileSpreadsheet size={17} />
          {importing ? "در حال خواندن..." : "ورود از فایل Excel"}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={importing}
            onChange={(event) => {
              void importExcel(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <div className="catalog-policy-banner">
        <ShieldCheck size={20} />
        <div>
          <strong>پذیرش فقط از این فهرست انتخاب می‌کند.</strong>
          <p>
            «نوع» در این بخش یعنی نوع دستگاه مانند موبایل، تبلت یا لپ‌تاپ؛ نوع
            تعمیرگاه فقط توسط مدیر مرکزی تعیین می‌شود و در پذیرش نمایش داده
            نمی‌شود.
          </p>
        </div>
      </div>

      <div className="catalog-service-tabs">
        {deviceTypes.map((type) => (
          <button
            type="button"
            key={type}
            className={activeType === type ? "active" : ""}
            onClick={() => setSelectedType(type)}
          >
            {activeType === type && <Check size={14} />}
            {displayDeviceType(type)}
            <b>{items.filter((item) => item.deviceType === type).length}</b>
          </button>
        ))}
        {!deviceTypes.length && (
          <span className="catalog-types-empty">
            هنوز نوع دستگاهی تعریف نشده است.
          </span>
        )}
      </div>

      <section className="catalog-add-panel">
        <div>
          <strong>افزودن دستی مدل</strong>
          <span>هر ردیف ترکیب یکتای نوع، برند و مدل است.</span>
        </div>
        <label>
          <span>نوع دستگاه</span>
          <input
            list="device-type-options"
            value={newType}
            onChange={(event) => setNewType(event.target.value)}
            placeholder={
              activeType ? displayDeviceType(activeType) : "مثلاً موبایل"
            }
          />
          <datalist id="device-type-options">
            {deviceTypes.map((type) => (
              <option key={type} value={type}>
                {displayDeviceType(type)}
              </option>
            ))}
          </datalist>
        </label>
        <label>
          <span>برند یا مارک</span>
          <input
            value={newBrand}
            onChange={(event) => setNewBrand(event.target.value)}
            placeholder="مثلاً سامسونگ گلکسی"
          />
        </label>
        <label>
          <span>مدل</span>
          <input
            value={newModel}
            onChange={(event) => setNewModel(event.target.value)}
            placeholder="مثلاً A56"
          />
        </label>
        <button
          type="button"
          className="primary-action"
          onClick={() => void addModel()}
        >
          <PackagePlus size={16} />
          افزودن به فهرست
        </button>
      </section>

      <div className="excel-format-note">
        <FileSpreadsheet size={18} />
        <div>
          <strong>ساختار فایل Excel</strong>
          <span>
            نوع دستگاه را از بالا انتخاب یا وارد کنید؛ فایل فقط دو ستون «برند» و
            «مدل» دارد و همه ردیف‌ها به همان نوع افزوده می‌شوند.
          </span>
        </div>
        <code>
          <b>برند</b>
          <b>مدل</b>
          <span>سامسونگ گلکسی</span>
          <span>A56</span>
        </code>
      </div>

      <div className="data-toolbar catalog-toolbar">
        <label className="module-search grow">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجوی سریع برند یا مدل"
          />
        </label>
        <span>
          {activeType
            ? `${visibleItems.length} نتیجه در ${displayDeviceType(activeType)}`
            : "بدون نوع تعریف‌شده"}
        </span>
      </div>

      <div className="responsive-table-wrap">
        <table className="data-table catalog-table">
          <thead>
            <tr>
              <th>نوع دستگاه</th>
              <th>برند</th>
              <th>مدل</th>
              <th>گردش تعمیراتی</th>
              <th>وضعیت در پذیرش</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id} className={!item.isActive ? "inactive" : ""}>
                <td>
                  <span className="status-pill neutral">
                    {displayDeviceType(item.deviceType)}
                  </span>
                </td>
                <td>
                  <strong>{item.brand}</strong>
                </td>
                <td>
                  <b>{item.model}</b>
                </td>
                <td>
                  {item.usageCount > 0 ? (
                    <span className="usage-count">
                      <History size={14} />
                      {item.usageCount} پرونده
                    </span>
                  ) : (
                    <span className="status-pill neutral">بدون گردش</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={`catalog-status-toggle ${item.isActive ? "active" : ""}`}
                    onClick={() => void toggleModel(item)}
                  >
                    <i />
                    {item.isActive ? "فعال" : "غیرفعال"}
                  </button>
                </td>
                <td>
                  <div className="catalog-row-actions">
                    <button
                      type="button"
                      onClick={() => void toggleModel(item)}
                      title={item.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
                    >
                      <SlidersHorizontal size={15} />
                    </button>
                    <button
                      type="button"
                      className={item.usageCount > 0 ? "locked" : "delete"}
                      onClick={() => void removeModel(item)}
                      title={
                        item.usageCount > 0
                          ? "به‌دلیل وجود سابقه قابل حذف نیست"
                          : "حذف مدل"
                      }
                    >
                      {item.usageCount > 0 ? (
                        <LockKeyhole size={15} />
                      ) : (
                        <X size={15} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleItems.length && (
          <div className="catalog-table-empty">
            <Search size={25} />
            <strong>مدلی پیدا نشد</strong>
            <span>از فرم بالا یا فایل Excel برای تعریف مدل استفاده کنید.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function InventorySettings({
  notify,
  saved,
  onSaved,
}: {
  notify: (message: string) => void;
  saved?: unknown;
  onSaved: (value: Record<string, unknown>) => void;
}) {
  const stored = (saved && typeof saved === "object" ? saved : {}) as {
    hotLimit?: number;
    reservationMinutes?: number;
    availableControl?: boolean;
    rejectionReason?: boolean;
    minimumWarning?: boolean;
  };
  const [hotLimit, setHotLimit] = useState(stored.hotLimit ?? 3);
  const [reservationMinutes, setReservationMinutes] = useState(
    stored.reservationMinutes ?? 120,
  );
  const [availableControl, setAvailableControl] = useState(
    stored.availableControl ?? true,
  );
  const [rejectionReason, setRejectionReason] = useState(
    stored.rejectionReason ?? true,
  );
  const [minimumWarning, setMinimumWarning] = useState(
    stored.minimumWarning ?? true,
  );
  const save = async () => {
    const value = {
      hotLimit,
      reservationMinutes,
      availableControl,
      rejectionReason,
      minimumWarning,
    };
    try {
      if (directAdminApiEnabled)
        await saveShopSetting("inventory_policy", value);
      onSaved(value);
      notify("سیاست‌های انبار ذخیره شد.");
    } catch (error) {
      notify(moduleErrorMessage(error, "ذخیره سیاست انبار انجام نشد"));
    }
  };
  return (
    <div className="settings-section">
      <SectionTitle
        icon={<Archive size={19} />}
        title="سیاست داغی و رزرو"
        badge="کنترل انبار"
      />
      <div className="policy-grid">
        <label>
          <span>سقف تعهد داغی هر تکنسین</span>
          <div>
            <input
              type="number"
              min={0}
              value={hotLimit}
              onChange={(event) =>
                setHotLimit(Math.max(0, Number(event.target.value)))
              }
            />
            <small>عدد</small>
          </div>
          <p>مقدار صفر، محدودیت تحویل قطعه جدید را غیرفعال می‌کند.</p>
        </label>
        <label>
          <span>مدت اعتبار رزرو قطعه</span>
          <div>
            <input
              type="number"
              min={1}
              value={reservationMinutes}
              onChange={(event) =>
                setReservationMinutes(Math.max(1, Number(event.target.value)))
              }
            />
            <small>دقیقه</small>
          </div>
          <p>رزرو منقضی آزاد و در دفتر گردش ثبت می‌شود.</p>
        </label>
      </div>
      <div className="toggle-list">
        <ToggleRow
          title="کنترل موجودی قابل تخصیص"
          description="فیزیکی منهای رزرو؛ مانع رزرو بیشتر از موجودی می‌شود"
          checked={availableControl}
          onChange={setAvailableControl}
        />
        <ToggleRow
          title="الزام دلیل رد درخواست"
          description="انباردار بدون ثبت دلیل نمی‌تواند درخواست یا عودت را رد کند"
          checked={rejectionReason}
          onChange={setRejectionReason}
        />
        <ToggleRow
          title="نمایش هشدار حداقل موجودی"
          description="اقلام زیر حداقل در داشبورد و انبار برجسته می‌شوند"
          checked={minimumWarning}
          onChange={setMinimumWarning}
        />
      </div>
      <button
        type="button"
        className="primary-action"
        onClick={() => void save()}
      >
        <Save size={16} />
        ذخیره سیاست‌ها
      </button>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="settings-section">
      <SectionTitle
        icon={<DatabaseBackup size={19} />}
        title="بکاپ و عیب‌یابی"
        badge="DirectAdmin"
      />
      <div className="settings-note">
        <CloudDownload size={19} />
        <p>
          نسخه پشتیبان دیتابیس و فایل‌ها باید از پنل DirectAdmin تهیه شود. گزارش
          تفصیلی عیب‌یابی فقط با ورود مدیر مرکزی و توکن محرمانه سرور در دسترس
          است.
        </p>
      </div>
      <a
        className="outline-action"
        href="/api/health.php"
        target="_blank"
        rel="noreferrer"
      >
        <Activity size={16} />
        بررسی سلامت عمومی سامانه
      </a>
      <hr />
      <SectionTitle
        icon={<ShieldCheck size={19} />}
        title="امنیت حساب و نشست"
        badge="سمت سرور"
      />
      <div className="toggle-list">
        <ToggleRow
          title="محدودسازی تلاش ناموفق"
          description="تلاش‌های ورود ناموفق در API محدود و ثبت می‌شوند"
          checked
        />
        <ToggleRow
          title="ابطال نشست پس از تغییر حساس"
          description="تغییر رمز، نقش یا وضعیت حساب نشست‌های قبلی را باطل می‌کند"
          checked
        />
        <ToggleRow
          title="نمایش IP فقط برای مدیر سیستم"
          description="آدرس IP رویداد فقط در مسیرهای مدیریتی قابل مشاهده است"
          checked
        />
      </div>
    </div>
  );
}

function ReportKpi({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: string;
}) {
  return (
    <article className={`report-kpi accent-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </article>
  );
}

function SectionTitle({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
}) {
  return (
    <div className="section-title">
      <span>{icon}</span>
      <h3>{title}</h3>
      {badge && <b>{badge}</b>}
    </div>
  );
}

function Field({
  label,
  required,
  placeholder,
  type = "text",
  inputMode,
  icon,
  defaultValue,
  maxLength,
  pattern,
  helper,
  sensitive,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric" | "text" | "tel";
  icon?: React.ReactNode;
  defaultValue?: string;
  maxLength?: number;
  pattern?: string;
  helper?: string;
  sensitive?: boolean;
}) {
  return (
    <label className="field-block">
      <span>
        {label} {required && <b>*</b>} {sensitive && <em>محرمانه</em>}
      </span>
      <div className={icon ? "input-with-icon" : ""}>
        {icon}
        <input
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          maxLength={maxLength}
          pattern={pattern}
        />
      </div>
      {helper && (
        <small className={sensitive ? "sensitive-helper" : "field-helper"}>
          {helper}
        </small>
      )}
    </label>
  );
}

function SelectField({
  label,
  required,
  options,
}: {
  label: string;
  required?: boolean;
  options: string[];
}) {
  return (
    <label className="field-block">
      <span>
        {label} {required && <b>*</b>}
      </span>
      <div className="select-wrap">
        <select defaultValue={options[0]}>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </div>
    </label>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-value">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function ModuleEmptyState({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`module-empty-state ${compact ? "compact" : ""}`}
      role="status"
    >
      <FileSearch size={compact ? 22 : 30} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function CaseDetailsModal({
  repairCase,
  onClose,
}: {
  repairCase: RepairCaseRecord;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`جزئیات پرونده ${repairCase.receiptNumber}`}
      onClose={onClose}
      size="wide"
    >
      <div className="detail-grid">
        <DetailValue label="شماره رسید" value={repairCase.receiptNumber} />
        <DetailValue
          label="وضعیت"
          value={repairCaseStatusLabels[repairCase.status]}
        />
        <DetailValue label="مشتری" value={repairCase.customerName} />
        <DetailValue label="شماره موبایل" value={repairCase.customerMobile} />
        <DetailValue label="نوع دستگاه" value={repairCase.deviceType} />
        <DetailValue
          label="برند و مدل"
          value={`${repairCase.brand} ${repairCase.model}`.trim()}
        />
        <DetailValue
          label="شناسه دستگاه"
          value={repairCase.identifier || "—"}
        />
        <DetailValue
          label="مسئول پرونده"
          value={repairCase.assignedToName || "تخصیص داده نشده"}
        />
        <DetailValue
          label="زمان پذیرش"
          value={operationalDate(repairCase.createdAt)}
        />
        <DetailValue
          label="آخرین تغییر"
          value={operationalDate(repairCase.updatedAt)}
        />
        {repairCase.status === "delivered" && (
          <DetailValue
            label="نام تحویل‌گیرنده"
            value={repairCase.deliveredToName || "ثبت نشده"}
          />
        )}
        {repairCase.status === "delivered" && (
          <DetailValue
            label="مبلغ نهایی"
            value={`${operationalNumber.format(repairCase.deliveryAmount || 0)} ریال`}
          />
        )}
        {repairCase.status === "delivered" && (
          <DetailValue
            label="ثبت‌کننده تحویل"
            value={repairCase.deliveredByName || "ثبت نشده"}
          />
        )}
        {repairCase.status === "delivered" && (
          <DetailValue
            label="زمان تحویل"
            value={
              repairCase.deliveredAt
                ? operationalDate(repairCase.deliveredAt)
                : "ثبت نشده"
            }
          />
        )}
      </div>
      <div className="case-detail-notes">
        <article>
          <span>ایراد اعلامی</span>
          <p>{repairCase.declaredIssue}</p>
        </article>
        {repairCase.receptionNotes && (
          <article>
            <span>توضیحات پذیرش</span>
            <p>{repairCase.receptionNotes}</p>
          </article>
        )}
        {repairCase.operationReport && (
          <article>
            <span>گزارش عملیات</span>
            <p>{repairCase.operationReport}</p>
          </article>
        )}
        {repairCase.deliveryNotes && (
          <article>
            <span>توضیحات تحویل</span>
            <p>{repairCase.deliveryNotes}</p>
          </article>
        )}
        <article>
          <span>لوازم همراه</span>
          <p>
            {repairCase.accessories.length
              ? repairCase.accessories.join("، ")
              : "موردی ثبت نشده است"}
          </p>
        </article>
        <article className="appearance-detail">
          <span>وضعیت ظاهری هنگام پذیرش</span>
          <p>
            {repairCase.appearanceStates.length
              ? repairCase.appearanceStates.join("، ")
              : "موردی ثبت نشده است"}
          </p>
        </article>
      </div>
      <section className="case-timeline">
        <h3>تاریخچه پرونده</h3>
        {repairCase.events.length ? (
          repairCase.events.map((event) => (
            <article key={event.id}>
              <span>
                <History size={16} />
              </span>
              <div>
                <strong>{event.description}</strong>
                <p>
                  {event.actorName} · {operationalDate(event.createdAt)}
                </p>
              </div>
              {event.toStatus && (
                <b>{repairCaseStatusLabels[event.toStatus]}</b>
              )}
            </article>
          ))
        ) : (
          <ModuleEmptyState
            compact
            title="هنوز اطلاعاتی ثبت نشده است"
            description="رویدادی برای این پرونده وجود ندارد."
          />
        )}
      </section>
    </Modal>
  );
}

function FollowUpDetailsModal({
  item,
  users = [],
  allowAssignment = false,
  onClose,
  onSave,
}: {
  item: CaseFollowUp;
  users?: OperationalUser[];
  allowAssignment?: boolean;
  onClose: () => void;
  onSave: (input: {
    id: string;
    status?: FollowUpStatus;
    assignedToUserId?: number;
    dueLabel?: string;
    comment?: string;
  }) => Promise<void>;
}) {
  const [status, setStatus] = useState<FollowUpStatus>(item.status);
  const [assignedToUserId, setAssignedToUserId] = useState<number | null>(
    item.assignedToUserId ?? null,
  );
  const [dueLabel, setDueLabel] = useState(item.dueLabel);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const changed = Boolean(
    comment.trim() ||
    status !== item.status ||
    assignedToUserId !== item.assignedToUserId ||
    dueLabel !== item.dueLabel,
  );
  const save = async () => {
    if (!changed || (allowAssignment && assignedToUserId === null)) return;
    setSaving(true);
    try {
      await onSave({
        id: item.id,
        status,
        assignedToUserId: assignedToUserId ?? undefined,
        dueLabel,
        comment: comment.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const statusOptions: FollowUpStatus[] =
    item.status === "new"
      ? ["new", "seen", "in_progress", "done"]
      : item.status === "seen"
        ? ["seen", "in_progress", "done"]
        : item.status === "in_progress"
          ? ["in_progress", "done"]
          : ["done"];
  return (
    <Modal title={`پیگیری ${item.receiptId}`} onClose={onClose} size="wide">
      <div className="detail-grid">
        <DetailValue label="مشتری" value={item.customer} />
        <DetailValue label="دستگاه" value={item.device} />
        <DetailValue label="مسئول فعلی" value={item.ownerName} />
        <DetailValue
          label="اهمیت"
          value={followUpPriorityLabels[item.priority]}
        />
        <DetailValue label="مهلت" value={item.dueLabel} />
        <DetailValue label="زمان ثبت" value={operationalDate(item.createdAt)} />
      </div>
      <p className="detail-note">{item.message}</p>
      <div
        className={`technician-reply-box ${allowAssignment ? "manager-followup-editor" : ""}`}
      >
        <label className="field-block">
          <span>وضعیت پیگیری</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as FollowUpStatus)
            }
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {followUpStatusLabels[option]}
              </option>
            ))}
          </select>
        </label>
        {allowAssignment && (
          <label className="field-block">
            <span>
              ارجاع به کاربر <b>*</b>
            </span>
            <select
              value={assignedToUserId ?? ""}
              onChange={(event) =>
                setAssignedToUserId(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            >
              <option value="" disabled>
                انتخاب مسئول
              </option>
              {users
                .filter((user) => user.isActive)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} ·{" "}
                    {operationalRoleLabels[user.role] ?? "کاربر"}
                  </option>
                ))}
            </select>
          </label>
        )}
        {allowAssignment && (
          <label className="field-block">
            <span>زمان یادآوری</span>
            <select
              value={dueLabel}
              onChange={(event) => setDueLabel(event.target.value)}
            >
              <option>قبل از شروع تعمیر</option>
              <option>امروز تا ساعت ۱۶:۰۰</option>
              <option>تا ۲ ساعت آینده</option>
              <option>قبل از تحویل مشتری</option>
            </select>
          </label>
        )}
        <label className="field-block followup-reply-field">
          <span>
            {allowAssignment ? "پاسخ یا توضیح" : "پاسخ یا توضیح تکنسین"}
          </span>
          <textarea
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="نتیجه بررسی، اقدام انجام‌شده یا پاسخ به مسئول پذیرش را ثبت کنید..."
          />
        </label>
      </div>
      <section className="case-timeline">
        <h3>تاریخچه ارجاع و تغییرات</h3>
        {item.history?.length ? (
          item.history.map((history, index) => (
            <article key={`${history.createdAt}-${index}`}>
              <span>
                <History size={16} />
              </span>
              <div>
                <strong>
                  {followUpHistoryBody(history.body, history.type)}
                </strong>
                <p>
                  {history.actorName}
                  {history.targetName ? ` ← ${history.targetName}` : ""} ·{" "}
                  {operationalDate(history.createdAt)}
                </p>
              </div>
            </article>
          ))
        ) : (
          <ModuleEmptyState
            compact
            title="هنوز اطلاعاتی ثبت نشده است"
            description="تغییر دیگری پس از ثبت اولیه پیگیری وجود ندارد."
          />
        )}
      </section>
      <div className="modal-actions">
        <button type="button" className="outline-action" onClick={onClose}>
          انصراف
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={
            saving || !changed || (allowAssignment && assignedToUserId === null)
          }
          onClick={() => void save()}
        >
          <Send size={16} />
          {saving
            ? "در حال ثبت..."
            : allowAssignment
              ? "ثبت تغییر و پاسخ"
              : "ثبت پاسخ تکنسین"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
  size,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "wide";
}) {
  const dialogRef = React.useRef<HTMLElement>(null);
  const modalId = useModalFocus(dialogRef, true, onClose);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        data-modal-id={modalId}
        className={`app-modal ${size === "wide" ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="بستن">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <input
        type="checkbox"
        checked={onChange ? checked : undefined}
        defaultChecked={onChange ? undefined : checked}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span />
    </label>
  );
}

function settingsIcon(tab: string) {
  if (tab === "پروفایل تعمیرگاه") return <Settings2 size={17} />;
  if (tab === "فرم‌های صنفی") return <SlidersHorizontal size={17} />;
  if (tab === "قبض و چاپ") return <Printer size={17} />;
  if (tab === "حساب من") return <UserCog size={17} />;
  if (tab === "کاربران و نقش‌ها") return <UsersRound size={17} />;
  if (tab === "اطلاعات پایه") return <Smartphone size={17} />;
  if (tab === "سیاست انبار") return <Archive size={17} />;
  return <ShieldCheck size={17} />;
}

function EmptyState({
  title,
  onNavigate,
}: {
  title: string;
  onNavigate: (label: string) => void;
}) {
  return (
    <section className="module-preview panel">
      <div className="module-preview-icon">
        <Sparkles size={38} />
      </div>
      <span className="welcome-chip">ساختار مصوب تعمیران</span>
      <h2>{title}</h2>
      <p>این مسیر در ساختار نقش‌محور سامانه تعریف شده است.</p>
      <button
        className="primary-action"
        onClick={() => onNavigate("نبض تعمیرگاه")}
      >
        بازگشت به نبض تعمیرگاه
      </button>
    </section>
  );
}
