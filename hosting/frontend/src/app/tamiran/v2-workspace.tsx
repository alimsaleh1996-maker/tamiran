"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeftRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LoaderCircle,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingCart,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import type { WorkspaceProfile } from "./access";
import { FollowUpApiError } from "./followups-api";
import { matchesQueueSearch } from "./queue-search";
import {
  assignV2Case,
  createV2Estimate,
  deliveryV2Action,
  financeV2Action,
  inventoryControlV2Action,
  inventoryV2Action,
  loadV2Delivery,
  loadV2Finance,
  loadV2Inventory,
  loadV2InventoryControl,
  loadV2Procurement,
  loadV2Quality,
  loadV2Sms,
  loadV2Workflow,
  procurementV2Action,
  qualityV2Action,
  sendV2Estimate,
  smsV2Action,
  transitionV2Case,
  workflowV2Action,
  type V2Case,
  type V2DeliveryCase,
  type V2InventoryPayload,
  type V2Invoice,
  type V2InvoiceDraft,
  type V2ProcurementPayload,
  type V2QualityPayload,
  type V2WorkflowPayload,
} from "./v2-api";

const statusLabels: Record<string, string> = {
  reception: "پذیرش",
  awaiting_assignment: "در انتظار تخصیص",
  assigned: "تخصیص‌شده",
  diagnosing: "عیب‌یابی",
  estimate_pending: "تنظیم برآورد",
  awaiting_customer_approval: "تأیید مشتری",
  awaiting_parts: "تأمین قطعه",
  repairing: "تعمیر",
  parts_closeout: "تعیین تکلیف قطعات",
  qc_pending: "کنترل کیفیت",
  qc_rework: "بازکاری QC",
  qc_conditional: "قبول مشروط",
  finance_pending: "تکمیل مالی",
  ready_for_delivery: "آماده تحویل",
  returned_unrepaired: "مرجوع بدون تعمیر",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
  closed: "بسته‌شده",
};
const workflowLabels: Record<string, string> = {
  mobile_tablet: "موبایل و تبلت",
  computer_laptop: "کامپیوتر و لپ‌تاپ",
};
const requestLabels: Record<string, string> = {
  pending: "منتظر انبار",
  reserved: "رزرو شده",
  partially_delivered: "تحویل ناقص",
  needs_supply: "نیازمند خرید",
  delivered: "تحویل به تکنسین",
  consumed: "مصرف‌شده",
  returned: "مرجوع‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};
const purchaseLabels: Record<string, string> = {
  draft: "پیش‌نویس",
  awaiting_approval: "منتظر تأیید",
  approved: "تأییدشده",
  ordered: "سفارش داده‌شده",
  partially_received: "دریافت ناقص",
  received: "دریافت کامل",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

const toman = new Intl.NumberFormat("fa-IR");
const formatMoney = (value: number | string | null | undefined) =>
  `${toman.format(Number(value ?? 0))} ریال`;
const localDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
        calendar: "persian",
      }).format(
        new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z")),
      )
    : "—";
const errorText = (error: unknown) =>
  error instanceof FollowUpApiError
    ? `${error.message}${error.trackingCode ? ` · کد ${error.trackingCode}` : ""}`
    : "عملیات انجام نشد؛ دوباره تلاش کنید.";

function CaseContextHeader({ item, branch }: { item: V2Case; branch: string }) {
  return (
    <div className="v2-case-context" aria-label="مشخصات ثابت پرونده">
      <span><small>شماره پرونده</small><strong dir="ltr">{item.receiptNumber}</strong></span>
      <span><small>مشتری</small><strong>{item.customerName}</strong></span>
      <span><small>دستگاه</small><strong>{item.deviceTitle}</strong></span>
      <span><small>وضعیت</small><strong>{statusLabels[item.status] ?? item.status}</strong></span>
      <span><small>مسئول</small><strong>{item.technicianName || "تخصیص‌نشده"}</strong></span>
      <span><small>شعبه</small><strong>{branch}</strong></span>
    </div>
  );
}

type Props = {
  page: string;
  profile: WorkspaceProfile;
  notify: (message: string) => void;
};
type Section =
  | "workflow"
  | "inventory"
  | "procurement"
  | "quality"
  | "finance"
  | "delivery"
  | "sms";
const pageSection = (page: string): Section =>
  page === "سفارش خرید"
    ? "procurement"
    : page === "کنترل کیفیت"
      ? "quality"
      : page === "مالی پرونده"
        ? "finance"
        : page === "تحویل تعمیرات"
          ? "delivery"
          : page === "پیامک و پرتال"
            ? "sms"
            : [
                  "انبار قطعات",
                  "گردش‌ها",
                  "درخواست‌های قطعه",
                  "تعهدهای داغی",
                ].includes(page)
              ? "inventory"
              : "workflow";

export function V2Workspace({ page, profile, notify }: Props) {
  const section = pageSection(page);
  const [workflow, setWorkflow] = useState<V2WorkflowPayload | null>(null);
  const [inventory, setInventory] = useState<V2InventoryPayload | null>(null);
  const [inventoryControl, setInventoryControl] = useState<Record<
    string,
    unknown[]
  > | null>(null);
  const [procurement, setProcurement] = useState<V2ProcurementPayload | null>(
    null,
  );
  const [quality, setQuality] = useState<V2QualityPayload | null>(null);
  const [finance, setFinance] = useState<{ invoices: V2Invoice[]; drafts: V2InvoiceDraft[] } | null>(
    null,
  );
  const [delivery, setDelivery] = useState<{
    cases: V2DeliveryCase[];
    verificationSettings: Record<string, unknown>;
    warrantyEnabled: boolean;
  } | null>(null);
  const [sms, setSms] = useState<Record<string, unknown[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const queueCases = useMemo(() => {
    return (workflow?.cases ?? []).filter((item) =>
      matchesQueueSearch(queueSearch, [item.receiptNumber, item.customerName, item.customerMobile, item.identifier, item.deviceTitle]),
    );
  }, [workflow?.cases, queueSearch]);
  const pageSubtitle =
    page === "مرکز عملیات تعمیرات"
      ? "وضعیت جاری تعمیرگاه و موارد نیازمند اقدام"
      : page === "کنترل کیفیت"
        ? "تست‌های لازم را ثبت و نتیجه تعمیر را تأیید کنید"
        : page === "مالی پرونده"
          ? "فاکتور، پرداخت‌ها و مانده هر پرونده"
          : page === "تحویل تعمیرات"
            ? "کنترل آمادگی و تحویل امن دستگاه"
            : "اطلاعات این بخش بر اساس دسترسی و شعبه جاری نمایش داده می‌شود.";

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const base = await loadV2Workflow();
      setWorkflow(base);
      if (section === "inventory") {
        const [stock, control] = await Promise.all([
          loadV2Inventory(),
          loadV2InventoryControl(),
        ]);
        setInventory(stock);
        setInventoryControl(control);
      }
      if (section === "procurement") setProcurement(await loadV2Procurement());
      if (section === "quality") setQuality(await loadV2Quality());
      if (section === "finance") setFinance(await loadV2Finance());
      if (section === "delivery") setDelivery(await loadV2Delivery());
      if (section === "sms") setSms(await loadV2Sms());
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [section]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (job: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await job();
      notify(success);
      await reload();
      return result;
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !workflow)
    return (
      <div className="v2-loading">
        <LoaderCircle className="spin" />
        <strong>در حال آماده‌سازی…</strong>
        <small>اطلاعات شعبه جاری دریافت می‌شود.</small>
      </div>
    );
  return (
    <div className="v2-shell">
      <header className="v2-page-head">
        <div>
          <span className="v2-kicker">{profile.branch}</span>
          <h2>{page}</h2>
          <p>{pageSubtitle}</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => void reload()}
          disabled={loading || busy}
        >
          <RefreshCw size={17} />
          تازه‌سازی
        </button>
      </header>
      {["inventory", "quality", "finance", "delivery"].includes(section) && (
        <label className="module-search v2-queue-search">
          <FileText size={17} />
          <input
            aria-label="جست‌وجوی صف"
            value={queueSearch}
            onChange={(event) => setQueueSearch(event.target.value)}
            placeholder="جست‌وجو با شماره قبض، موبایل، IMEI یا سریال"
          />
        </label>
      )}
      {error && (
        <div className="v2-alert" role="alert">
          <ShieldCheck size={18} />
          <span>{error}</span>
        </div>
      )}
      {section === "workflow" && workflow && (
        <WorkflowBoard
          data={workflow}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "inventory" && workflow && inventory && (
        <InventoryBoard
          data={inventory}
          control={inventoryControl}
          cases={queueCases}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "procurement" && inventory && procurement && (
        <ProcurementBoard
          data={procurement}
          inventory={inventory}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "procurement" && !inventory && procurement && (
        <ProcurementLoader
          data={procurement}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "quality" && workflow && quality && (
        <QualityBoard
          data={quality}
          cases={queueCases}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "finance" && workflow && finance && (
        <FinanceBoard
          data={finance}
          cases={queueCases}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "delivery" && delivery && (
        <DeliveryBoard
          data={delivery}
          cases={queueCases}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "sms" && sms && (
        <SmsBoard data={sms} busy={busy} run={run} />
      )}
    </div>
  );
}

type Run = (job: () => Promise<unknown>, success: string) => Promise<unknown>;

function WorkflowBoard({
  data,
  profile,
  busy,
  run,
}: {
  data: V2WorkflowPayload;
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const [focusedCaseId] = useState(() => {
    if (typeof window === "undefined") return 0;
    const value = Number(
      window.sessionStorage.getItem("tamiran:focused-workflow-case") ?? 0,
    );
    window.sessionStorage.removeItem("tamiran:focused-workflow-case");
    return Number.isInteger(value) && value > 0 ? value : 0;
  });
  const [queue, setQueue] = useState<"critical" | "unassigned" | "waiting" | "all">(
    focusedCaseId ? "all" : "critical",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState(
    focusedCaseId || data.cases[0]?.id || 0,
  );
  const [reason, setReason] = useState("");
  const [technician, setTechnician] = useState("");
  const [collaborator, setCollaborator] = useState({
    technicianId: "",
    task: "",
    fixedFee: "",
    laborPercent: "0",
    partPercent: "0",
  });
  const [estimate, setEstimate] = useState({
    title: "اجرت تعمیر",
    amount: "",
    tax: "0",
  });
  const criticalCases = data.cases.filter(
    (item) =>
      item.technicianView.flags.includes("sla_overdue") ||
      item.technicianView.flags.includes("qc_rework"),
  );
  const unassignedCases = data.cases.filter(
    (item) =>
      !["returned_unrepaired", "delivered", "cancelled", "closed"].includes(
        item.status,
      ) &&
      (["reception", "awaiting_assignment"].includes(item.status) ||
        item.primaryTechnicianUserId === null),
  );
  const waitingCases = data.cases.filter((item) =>
    ["awaiting_customer_approval", "awaiting_parts", "qc_pending", "finance_pending"].includes(item.status),
  );
  const categoryCases =
    queue === "critical"
      ? criticalCases
      : queue === "unassigned"
        ? unassignedCases
        : queue === "waiting"
          ? waitingCases
          : data.cases;
  const visibleCases = categoryCases.filter((item) =>
    (!status || item.status === status) && matchesQueueSearch(search, [
      item.receiptNumber, item.customerName, item.customerMobile, item.identifier, item.deviceTitle,
    ]),
  );
  const selected =
    visibleCases.find((item) => item.id === selectedId) ?? visibleCases[0];
  const openHandovers = data.handovers.filter(
    (item) => item.status === "requested",
  );
  const roleTargets: Record<string, string[]> = {
    reception: [
      "awaiting_assignment",
      "assigned",
      "awaiting_customer_approval",
      "returned_unrepaired",
      "cancelled",
    ],
    technician: [
      "diagnosing",
      "estimate_pending",
      "awaiting_parts",
      "repairing",
      "parts_closeout",
    ],
    quality_control: ["qc_rework", "qc_conditional", "finance_pending"],
    finance_cashier: ["ready_for_delivery"],
  };
  const transitions =
    selected?.allowedTransitions.filter(
      (target) =>
        profile.role === "repair_manager" ||
        (roleTargets[profile.role] ?? []).includes(target),
    ) ?? [];
  return (
    <div className="v2-stack">
      <div className="v2-summary-cards operations-exception-cards">
        {[
          { key: "critical" as const, label: "بحرانی / SLA", count: criticalCases.length },
          { key: "unassigned" as const, label: "نیازمند تخصیص", count: unassignedCases.length },
          { key: "waiting" as const, label: "صف‌های انتظار", count: waitingCases.length },
          { key: "all" as const, label: "همه پرونده‌ها", count: data.cases.length },
        ].map((item) => (
          <button key={item.key} type="button" aria-pressed={queue === item.key} className={queue === item.key ? "active" : ""} onClick={() => { setQueue(item.key); setSelectedId(0); }}>
            <span>{item.label}</span><strong>{toman.format(item.count)}</strong>
          </button>
        ))}
      </div>
      <div className="repair-queue-filters" role="search" aria-label="فیلتر صف تعمیر">
        <label className="repair-queue-search"><span>جست‌وجوی صف تعمیر</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رسید، مشتری، موبایل یا سریال" />
        </label>
        <label><span>وضعیت صف تعمیر</span><select aria-label="وضعیت صف تعمیر" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {(search || status) && <button type="button" className="outline-action" onClick={() => { setSearch(""); setStatus(""); }}>پاک‌کردن فیلترها</button>}
      </div>
      <div className="v2-master-detail">
        <section className="v2-list-panel">
          <div className="v2-panel-title">
            <div>
              <ClipboardCheck />
              <span>
                <strong>صف پرونده‌ها</strong>
                <small role="status" aria-live="polite">
                  {toman.format(visibleCases.length)} از {toman.format(categoryCases.length)} پروندهٔ دریافت‌شده در این صف
                </small>
              </span>
            </div>
          </div>
          <div className="v2-case-list">
            {visibleCases.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={selected?.id === item.id}
                className={selected?.id === item.id ? "active" : ""}
                onClick={() => setSelectedId(item.id)}
              >
                <span className={`v2-status-dot status-${item.status}`} />
                <span>
                  <strong>{item.receiptNumber}</strong>
                  <small>
                    {item.customerName} · {item.deviceTitle}
                  </small>
                </span>
                <em>{statusLabels[item.status] ?? item.status}</em>
              </button>
            ))}
            {visibleCases.length === 0 && (
              <Empty text={search || status ? "پرونده‌ای با این فیلترها پیدا نشد؛ جست‌وجو یا وضعیت را تغییر دهید." : "در حال حاضر مورد نیازمند اقدام در این صف وجود ندارد."} />
            )}
          </div>
        </section>
        <section className="v2-detail-panel">
          {selected ? (
            <>
              <div className="v2-detail-title">
                <div>
                  <span className="v2-chip">
                    {workflowLabels[selected.workflowCode]}
                  </span>
                  <h3>{selected.receiptNumber}</h3>
                  <p>
                    {selected.customerName} · {selected.deviceTitle}
                  </p>
                </div>
                <span className="v2-stage">
                  {statusLabels[selected.status] ?? selected.status}
                </span>
              </div>
              <div className="v2-facts">
                <span>
                  <small>مسئول اصلی</small>
                  <strong>{selected.technicianName || "تخصیص نشده"}</strong>
                </span>
                <span>
                  <small>موعد وعده</small>
                  <strong>{localDate(selected.promisedAt)}</strong>
                </span>
                <span>
                  <small>سقف پذیرش</small>
                  <strong>{formatMoney(selected.preapprovedAmount)}</strong>
                </span>
              </div>
              <div className="v2-issue">
                <strong>شرح خرابی مشتری</strong>
                <p>{selected.declaredIssue}</p>
              </div>
              {selected.isLocked && (
                <div className="v2-issue">
                  <strong>پرونده مختومه و قفل‌شده است</strong>
                  <p>{selected.closureReason || "عملیات جدید روی این پرونده مجاز نیست."}</p>
                </div>
              )}
              <Blockers value={selected.blockers} />
              {profile.role === "repair_manager" &&
                profile.productProfile === "pro" &&
                selected.productProfile === "solo" && (
                  <div className="product-preservation-note">
                    <ArrowLeftRight size={19} />
                    <div>
                      <strong>این پرونده هنوز گردش Solo دارد</strong>
                      <p>پرونده قدیمی بدون تغییر ادامه می‌یابد. فقط در صورت نیاز و پس از بررسی سازگاری، آن را جداگانه به گردش Pro منتقل کنید.</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void run(
                          () =>
                            workflowV2Action({
                              action: "migrate_case_to_pro",
                              caseId: selected.id,
                              reason,
                              idempotencyKey:
                                typeof crypto !== "undefined" && crypto.randomUUID
                                  ? crypto.randomUUID()
                                  : `case-migrate-${selected.id}-${Date.now()}`,
                            }),
                          "گردش همین پرونده پس از اعتبارسنجی به Pro تغییر کرد.",
                        )
                      }
                    >
                      انتقال این پرونده به Pro
                    </button>
                  </div>
                )}
              {!selected.isLocked && ["repair_manager", "reception"].includes(profile.role) && (
                <div className="v2-inline-form">
                  <label>
                    <span>تکنسین مسئول</span>
                    <select
                      value={technician}
                      onChange={(event) => setTechnician(event.target.value)}
                    >
                      <option value="">انتخاب کنید</option>
                      {data.users
                        .filter((user) => user.role === "technician")
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.display_name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="grow">
                    <span>
                      {selected.primaryTechnicianUserId
                        ? "علت تحویل رسمی"
                        : "علت تخصیص"}
                    </span>
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="مثلاً تخصص برد"
                    />
                  </label>
                  <button
                    disabled={
                      busy ||
                      !technician ||
                      !reason.trim() ||
                      Number(technician) === selected.primaryTechnicianUserId
                    }
                    onClick={() =>
                      void run(
                        () =>
                          selected.primaryTechnicianUserId
                            ? workflowV2Action({
                                action: "handover_request",
                                caseId: selected.id,
                                toUserId: Number(technician),
                                reason,
                                partsDisposition: "transfer_to_new",
                                hotReturnsDisposition: "transfer_to_new",
                                toolsNote:
                                  "تحویل ابزار و لوازم طبق صورت پرونده",
                              })
                            : assignV2Case(
                                selected.id,
                                Number(technician),
                                reason,
                              ),
                        selected.primaryTechnicianUserId
                          ? "تحویل رسمی برای تأیید تکنسین مقصد ارسال شد."
                          : "مسئول پرونده ثبت شد.",
                      )
                    }
                  >
                    <UserRoundCheck size={17} />
                    {selected.primaryTechnicianUserId
                      ? "درخواست تحویل رسمی"
                      : "تخصیص"}
                  </button>
                </div>
              )}
              {!selected.isLocked && profile.role === "repair_manager" && (
                <div className="v2-collaborator-form">
                  <strong>افزودن همکار با وظیفه و اجرت مستقل</strong>
                  <div className="v2-grid-form">
                    <label>
                      <span>تکنسین همکار</span>
                      <select
                        value={collaborator.technicianId}
                        onChange={(event) =>
                          setCollaborator({
                            ...collaborator,
                            technicianId: event.target.value,
                          })
                        }
                      >
                        <option value="">انتخاب کنید</option>
                        {data.users
                          .filter(
                            (user) =>
                              user.role === "technician" &&
                              user.id !== selected.primaryTechnicianUserId,
                          )
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.display_name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="grow">
                      <span>وظیفه</span>
                      <input
                        value={collaborator.task}
                        onChange={(event) =>
                          setCollaborator({
                            ...collaborator,
                            task: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>مبلغ ثابت</span>
                      <input
                        inputMode="numeric"
                        value={collaborator.fixedFee}
                        onChange={(event) =>
                          setCollaborator({
                            ...collaborator,
                            fixedFee: event.target.value.replace(/\D/g, ""),
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>درصد اجرت</span>
                      <input
                        inputMode="decimal"
                        value={collaborator.laborPercent}
                        onChange={(event) =>
                          setCollaborator({
                            ...collaborator,
                            laborPercent: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>درصد فروش قطعه</span>
                      <input
                        inputMode="decimal"
                        value={collaborator.partPercent}
                        onChange={(event) =>
                          setCollaborator({
                            ...collaborator,
                            partPercent: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      disabled={
                        busy ||
                        !collaborator.technicianId ||
                        !collaborator.task.trim()
                      }
                      onClick={() =>
                        void run(
                          () =>
                            workflowV2Action({
                              action: "collaborator_add",
                              caseId: selected.id,
                              technicianUserId: Number(
                                collaborator.technicianId,
                              ),
                              taskTitle: collaborator.task,
                              compensationModel:
                                Number(collaborator.fixedFee) > 0 &&
                                Number(collaborator.laborPercent) > 0
                                  ? "mixed"
                                  : Number(collaborator.laborPercent) > 0
                                    ? "labor_percent"
                                    : "fixed",
                              fixedFee: Number(collaborator.fixedFee),
                              laborPercent: Number(collaborator.laborPercent),
                              partSalePercent: Number(collaborator.partPercent),
                            }),
                          "همکار و مدل اجرت ثبت شد.",
                        )
                      }
                    >
                      افزودن همکار
                    </button>
                  </div>
                </div>
              )}
              {!selected.isLocked && <div className="v2-transition-box">
                <strong>انتقال‌های مجاز همین مرحله</strong>
                {transitions.some((target) => ["returned_unrepaired", "cancelled"].includes(target)) && (
                  <div className="v2-reason-presets" aria-label="دلایل رایج مختومه‌کردن پرونده">
                    {["غیرقابل تعمیر", "عدم تأمین قطعه", "انصراف مشتری", "رد برآورد توسط مشتری"].map((item) => (
                      <button type="button" className={reason === item ? "active" : ""} key={item} onClick={() => setReason(item)}>{item}</button>
                    ))}
                  </div>
                )}
                <label>
                  <span>علت/توضیح انتقال</span>
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="برای مراحل پایانی و استثناها الزامی است"
                  />
                </label>
                <div>
                  {transitions.map((target) => (
                    <button
                      key={target}
                      disabled={
                        busy ||
                        (["cancelled", "returned_unrepaired"].includes(
                          target,
                        ) &&
                          !reason.trim())
                      }
                      onClick={() =>
                        void run(
                          () =>
                            transitionV2Case(
                              selected.id,
                              target,
                              selected.lockVersion,
                              reason || undefined,
                            ),
                          `پرونده به «${statusLabels[target]}» منتقل شد.`,
                        )
                      }
                    >
                      {statusLabels[target] ?? target}
                    </button>
                  ))}
                  {transitions.length === 0 && (
                    <small>
                      در این مرحله عملیات بعدی از صفحه تخصصی QC، مالی یا تحویل
                      انجام می‌شود.
                    </small>
                  )}
                </div>
              </div>}
              {selected.status === "awaiting_customer_approval" &&
                selected.latestEstimate &&
                ["sent", "explanation_requested"].includes(
                  selected.latestEstimate.status,
                ) && (
                  <div className="v2-card-form">
                    <strong>ثبت تصمیم مشتری درباره برآورد</strong>
                    <small>
                      مبلغ برآورد: {formatMoney(selected.latestEstimate.totalAmount)}
                    </small>
                    <label>
                      <span>توضیح یا مستند تماس</span>
                      <input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="مثلاً تأیید تلفنی مشتری در تاریخ امروز"
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        disabled={busy || !reason.trim()}
                        onClick={() =>
                          void run(
                            () =>
                              workflowV2Action({
                                action: "estimate_decide",
                                estimatePublicId:
                                  selected.latestEstimate?.publicId,
                                decision: "approved",
                                channel: "recorded_phone",
                                reason,
                              }),
                            "تأیید مشتری ثبت شد.",
                          )
                        }
                      >
                        ثبت تأیید تلفنی
                      </button>
                      <button
                        type="button"
                        disabled={busy || !reason.trim()}
                        onClick={() =>
                          void run(
                            () =>
                              workflowV2Action({
                                action: "estimate_decide",
                                estimatePublicId:
                                  selected.latestEstimate?.publicId,
                                decision: "rejected",
                                channel: "recorded_phone",
                                reason,
                              }),
                            "رد برآورد توسط مشتری ثبت شد.",
                          )
                        }
                      >
                        ثبت رد مشتری
                      </button>
                    </div>
                  </div>
                )}
              {["repair_manager", "technician"].includes(profile.role) &&
                ["diagnosing", "estimate_pending"].includes(
                  selected.status,
                ) && (
                  <form
                    className="v2-card-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        const response = await createV2Estimate({
                          caseId: selected.id,
                          items: [
                            {
                              type: "labor",
                              title: estimate.title,
                              quantity: 1,
                              unitPrice: Number(estimate.amount),
                              taxRate: Number(estimate.tax),
                            },
                          ],
                          reason: "برآورد پس از عیب‌یابی",
                        });
                        if (response.estimate.requiresCustomerApproval)
                          await sendV2Estimate(response.estimate.publicId);
                      }, "برآورد ذخیره و در صورت نیاز برای مشتری ارسال شد.");
                    }}
                  >
                    <strong>برآورد سریع</strong>
                    <div>
                      <label>
                        <span>عنوان</span>
                        <input
                          value={estimate.title}
                          onChange={(e) =>
                            setEstimate({ ...estimate, title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>مبلغ ریال</span>
                        <input
                          inputMode="numeric"
                          value={estimate.amount}
                          onChange={(e) =>
                            setEstimate({
                              ...estimate,
                              amount: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>مالیات ٪</span>
                        <input
                          inputMode="decimal"
                          value={estimate.tax}
                          onChange={(e) =>
                            setEstimate({ ...estimate, tax: e.target.value })
                          }
                        />
                      </label>
                      <button disabled={busy || !estimate.amount}>
                        ثبت برآورد
                      </button>
                    </div>
                  </form>
                )}
            </>
          ) : (
            <Empty text="یک پرونده را انتخاب کنید." />
          )}
        </section>
      </div>
      {openHandovers.length > 0 && (
        <section className="v2-table-panel">
          <div className="v2-panel-title">
            <div>
              <UserRoundCheck />
              <span>
                <strong>تحویل‌های رسمی در انتظار</strong>
                <small>
                  انتقال مسئولیت فقط پس از تأیید تحویل‌گیرنده یا اجبار ممیزی‌شده
                  مدیر قطعی می‌شود.
                </small>
              </span>
            </div>
          </div>
          <ResponsiveTable headers={["پرونده", "از", "به", "علت", "عملیات"]}>
            {openHandovers.map((handover) => (
              <tr key={handover.id}>
                <td data-label="پرونده">{handover.receipt_number}</td>
                <td data-label="از">{handover.from_user_name}</td>
                <td data-label="به">{handover.to_user_name}</td>
                <td data-label="علت">{handover.reason}</td>
                <td data-label="عملیات">
                  <div className="v2-row-actions">
                    {handover.to_user_id === profile.actorId && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              workflowV2Action({
                                action: "handover_decide",
                                publicId: handover.public_id,
                                decision: "accept",
                              }),
                            "تحویل پرونده تأیید شد.",
                          )
                        }
                      >
                        تأیید دریافت
                      </button>
                    )}
                    {profile.role === "repair_manager" && (
                      <button
                        disabled={busy || !reason.trim()}
                        onClick={() =>
                          void run(
                            () =>
                              workflowV2Action({
                                action: "handover_decide",
                                publicId: handover.public_id,
                                decision: "manager_force",
                                reason,
                              }),
                            "انتقال با علت مدیر قطعی شد.",
                          )
                        }
                      >
                        قطعی‌کردن مدیر
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </section>
      )}
    </div>
  );
}

function InventoryBoard({
  data,
  control,
  cases,
  profile,
  busy,
  run,
}: {
  data: V2InventoryPayload;
  control: Record<string, unknown[]> | null;
  cases: V2Case[];
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const [request, setRequest] = useState({
    caseId: "",
    itemId: "",
    quantity: "1",
    notes: "",
  });
  const [stocktakeCounts, setStocktakeCounts] = useState<
    Record<number, string>
  >({});
  const [stocktakeReason, setStocktakeReason] = useState(
    "انبارگردانی دوره‌ای شعبه",
  );
  const [hotForm, setHotForm] = useState({
    publicId: "",
    serial: "",
    condition: "healthy",
    imageFileId: "",
    notes: "",
  });
  const warehouseActions = ["repair_manager", "warehouse_keeper"].includes(
    profile.role,
  );
  const openHot = (control?.hotReturns ?? []) as Array<
    Record<string, string | number>
  >;
  const stocktakes = (control?.stocktakes ?? []) as Array<
    Record<string, string | number | null>
  >;
  const stocktakeItems = (control?.stocktakeItems ?? []) as Array<
    Record<string, string | number | null>
  >;
  const activeStocktake = stocktakes.find((item) =>
    ["counting", "awaiting_manager"].includes(String(item.status)),
  );
  const activeStocktakeItems = activeStocktake
    ? stocktakeItems.filter(
        (item) => item.stocktake_public_id === activeStocktake.public_id,
      )
    : [];
  const requestableCases = cases.filter(
    (item) =>
      !item.isLocked &&
      [
        "diagnosing",
        "estimate_pending",
        "awaiting_customer_approval",
        "repairing",
        "awaiting_parts",
        "qc_rework",
      ].includes(item.status),
  );
  const selectedRequestCase = requestableCases.find(
    (item) => item.id === Number(request.caseId),
  );
  const canRequestPart =
    ["repair_manager", "technician"].includes(profile.role) ||
    profile.permissions.includes("*") ||
    profile.permissions.includes("part.request");
  return (
    <div className="v2-stack">
      <div className="v2-metrics">
        {data.items.slice(0, 4).map((item) => (
          <article
            key={item.id}
            className={
              item.available_quantity <= item.minimum_quantity ? "warn" : ""
            }
          >
            <Boxes />
            <span>
              <small>{item.item_code}</small>
              <strong>{item.title}</strong>
            </span>
            <em>
              {toman.format(item.available_quantity)} {item.unit_title}
              <small>قابل استفاده</small>
            </em>
          </article>
        ))}
      </div>
      {canRequestPart && (
        <section className="v2-card-form v2-queue">
          <div className="v2-queue-head">
            <div>
              <strong>پرونده‌های قابل درخواست قطعه</strong>
              <small> پرونده‌های فعال و مرتبط با دسترسی جاری</small>
            </div>
            <b>{toman.format(requestableCases.length)}</b>
          </div>
          <div className="v2-queue-list">
            {requestableCases.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`v2-queue-card ${selectedRequestCase?.id === item.id ? "selected" : ""}`}
                aria-pressed={selectedRequestCase?.id === item.id}
                onClick={() => setRequest({ ...request, caseId: String(item.id) })}
              >
                <strong dir="ltr">{item.receiptNumber}</strong>
                <span>{item.deviceTitle}</span>
                <small>{item.customerName} · {item.technicianName || "تخصیص‌نشده"}</small>
                <em>ثبت درخواست</em>
              </button>
            ))}
            {!requestableCases.length && <small>پرونده فعالی برای درخواست قطعه وجود ندارد.</small>}
          </div>
        </section>
      )}
      <section className="v2-table-panel">
        <div className="v2-panel-title">
          <div>
            <PackageOpen />
            <span>
              <strong>درخواست قطعه متصل به پرونده</strong>
              <small>رزرو هر شعبه از موجودی همان انبار انجام می‌شود.</small>
            </span>
          </div>
        </div>
        {canRequestPart && selectedRequestCase && <CaseContextHeader item={selectedRequestCase} branch={profile.branch} />}
        {canRequestPart && <form
          className="v2-grid-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                inventoryV2Action({
                  action: "request",
                  caseId: Number(request.caseId),
                  itemId: Number(request.itemId),
                  quantity: Number(request.quantity),
                  notes: request.notes,
                }),
              "درخواست قطعه ثبت شد.",
            );
          }}
        >
          <label>
            <span>کالا</span>
            <select
              value={request.itemId}
              onChange={(e) =>
                setRequest({ ...request, itemId: e.target.value })
              }
            >
              <option value="">انتخاب کالا</option>
              {data.items.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.item_code} · {item.title} (
                  {toman.format(item.available_quantity)})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>تعداد</span>
            <input
              inputMode="numeric"
              value={request.quantity}
              onChange={(e) =>
                setRequest({
                  ...request,
                  quantity: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </label>
          <label className="grow">
            <span>توضیح</span>
            <input
              value={request.notes}
              onChange={(e) =>
                setRequest({ ...request, notes: e.target.value })
              }
            />
          </label>
          <button disabled={busy || !request.caseId || !request.itemId}>
            ثبت درخواست
          </button>
        </form>}
        <ResponsiveTable
          headers={["پرونده", "کالا", "درخواست/تحویل", "وضعیت", "عملیات"]}
        >
          {data.requests.map((item) => {
            const reservable = Math.max(
              0,
              item.quantity - item.reserved_quantity,
            );
            const issuable = Math.max(
              0,
              item.reserved_quantity - item.delivered_quantity,
            );
            return (
              <tr key={item.id}>
                <td data-label="پرونده">
                  <strong>{item.receipt_number}</strong>
                  <small>{item.requester_name}</small>
                </td>
                <td data-label="کالا">
                  {item.item_code} · {item.item_title}
                </td>
                <td data-label="درخواست/تحویل">
                  {toman.format(item.quantity)} /{" "}
                  {toman.format(item.delivered_quantity)}
                </td>
                <td data-label="وضعیت">
                  <span className="v2-table-status">
                    {requestLabels[item.status] ?? item.status}
                  </span>
                  {item.reservation_is_expired && (
                    <small className="v2-expired">
                      رزرو منقضی؛ آزادسازی خودکار نشده
                    </small>
                  )}
                </td>
                <td data-label="عملیات">
                  <div className="v2-row-actions">
                    {warehouseActions &&
                      [
                        "pending",
                        "needs_supply",
                        "reserved",
                        "partially_delivered",
                      ].includes(item.status) &&
                      reservable > 0 && (
                        <button
                          disabled={busy || !data.warehouse}
                          onClick={() =>
                            void run(
                              () =>
                                inventoryV2Action({
                                  action: "reserve",
                                  requestId: item.id,
                                  warehouseId: data.warehouse?.id,
                                  quantity: reservable,
                                  reason: "رزرو از انبار شعبه",
                                }),
                              "قطعه رزرو شد.",
                            )
                          }
                        >
                          رزرو مانده
                        </button>
                      )}
                    {warehouseActions &&
                      ["reserved", "partially_delivered"].includes(
                        item.status,
                      ) &&
                      issuable > 0 && (
                        <button
                          disabled={busy || !data.warehouse}
                          onClick={() =>
                            void run(
                              () =>
                                inventoryV2Action({
                                  action: "issue",
                                  requestId: item.id,
                                  warehouseId: data.warehouse?.id,
                                  quantity: issuable,
                                  reason: "تحویل به تکنسین",
                                  idempotencyKey: `part-issue-${item.id}-${item.delivered_quantity}-${issuable}`,
                                }),
                              "تحویل قطعه ثبت شد.",
                            )
                          }
                        >
                          تحویل
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            );
          })}
        </ResponsiveTable>
      </section>
      {data.issues.some((item) =>
        ["awaiting_technician", "delivered"].includes(item.status),
      ) && (
        <section className="v2-table-panel">
          <div className="v2-panel-title">
            <div>
              <PackageCheck />
              <span>
                <strong>تأیید قطعه تحویلی</strong>
                <small>
                  تکنسین باید پیش از QC هر قطعه را مصرف‌شده یا مرجوع‌شده ثبت
                  کند.
                </small>
              </span>
            </div>
          </div>
          <ResponsiveTable
            headers={["پرونده", "کالا", "تکنسین", "تعداد", "عملیات"]}
          >
            {data.issues
              .filter((item) =>
                ["awaiting_technician", "delivered"].includes(item.status),
              )
              .map((item) => (
                <tr key={item.id}>
                  <td data-label="پرونده">{item.receipt_number}</td>
                  <td data-label="کالا">
                    {item.item_code} · {item.item_title}
                  </td>
                  <td data-label="تکنسین">{item.technician_name}</td>
                  <td data-label="تعداد">{toman.format(item.quantity)}</td>
                  <td data-label="عملیات">
                    {["repair_manager", "technician"].includes(profile.role) ? (
                      <div className="v2-row-actions">
                        <button
                          disabled={busy || !data.warehouse}
                          onClick={() =>
                            void run(
                              () =>
                                inventoryV2Action({
                                  action: "finalize_issue",
                                  issuePublicId: item.public_id,
                                  warehouseId: data.warehouse?.id,
                                  decision: "consumed",
                                  reason: "مصرف در تعمیر",
                                }),
                              "مصرف قطعه ثبت شد.",
                            )
                          }
                        >
                          مصرف شد
                        </button>
                        <button
                          disabled={busy || !data.warehouse}
                          onClick={() =>
                            void run(
                              () =>
                                inventoryV2Action({
                                  action: "finalize_issue",
                                  issuePublicId: item.public_id,
                                  warehouseId: data.warehouse?.id,
                                  decision: "returned",
                                  reason: "مرجوع سالم به انبار",
                                }),
                              "مرجوعی قطعه ثبت شد.",
                            )
                          }
                        >
                          مرجوع شد
                        </button>
                      </div>
                    ) : (
                      <small>منتظر تأیید تکنسین</small>
                    )}
                  </td>
                </tr>
              ))}
          </ResponsiveTable>
        </section>
      )}
      {warehouseActions && (
        <section className="v2-table-panel">
          <div className="v2-panel-title">
            <div>
              <Archive />
              <span>
                <strong>انبارگردانی با Snapshot</strong>
                <small>
                  هر قلم هنگام شمارش پنج دقیقه قفل می‌شود و مغایرت فقط با تأیید
                  مدیر وارد Ledger می‌شود.
                </small>
              </span>
            </div>
          </div>
          {!activeStocktake && (
            <div className="v2-inline-form">
              <label className="grow">
                <span>علت انبارگردانی</span>
                <input
                  value={stocktakeReason}
                  onChange={(event) => setStocktakeReason(event.target.value)}
                />
              </label>
              <button
                disabled={busy || !data.warehouse || !stocktakeReason.trim()}
                onClick={() =>
                  void run(
                    () =>
                      inventoryControlV2Action({
                        action: "stocktake_start",
                        warehouseId: data.warehouse?.id,
                        reason: stocktakeReason,
                      }),
                    "Snapshot انبارگردانی ثبت شد.",
                  )
                }
              >
                شروع شمارش
              </button>
            </div>
          )}
          {activeStocktake?.status === "counting" && (
            <>
              <ResponsiveTable
                headers={["کالا", "Snapshot", "شمارش واقعی", "عملیات"]}
              >
                {activeStocktakeItems.map((item) => (
                  <tr key={String(item.id)}>
                    <td data-label="کالا">
                      {item.item_code} · {item.item_title}
                    </td>
                    <td data-label="Snapshot">
                      {toman.format(Number(item.snapshot_quantity))}
                    </td>
                    <td data-label="شمارش واقعی">
                      <input
                        className="v2-count-input"
                        aria-label={`شمارش واقعی ${item.item_title}، کد ${item.item_code}`}
                        inputMode="numeric"
                        value={
                          stocktakeCounts[Number(item.item_id)] ??
                          item.counted_quantity ??
                          ""
                        }
                        onChange={(event) =>
                          setStocktakeCounts({
                            ...stocktakeCounts,
                            [Number(item.item_id)]: event.target.value.replace(
                              /\D/g,
                              "",
                            ),
                          })
                        }
                      />
                    </td>
                    <td data-label="عملیات">
                      <button
                        disabled={
                          busy ||
                          (stocktakeCounts[Number(item.item_id)] ??
                            item.counted_quantity ??
                            "") === ""
                        }
                        onClick={() =>
                          void run(async () => {
                            await inventoryControlV2Action({
                              action: "stocktake_lock_item",
                              publicId: activeStocktake.public_id,
                              itemId: Number(item.item_id),
                            });
                            await inventoryControlV2Action({
                              action: "stocktake_count_item",
                              publicId: activeStocktake.public_id,
                              itemId: Number(item.item_id),
                              countedQuantity: Number(
                                stocktakeCounts[Number(item.item_id)] ??
                                  item.counted_quantity,
                              ),
                              notes: "شمارش از پنل",
                            });
                          }, "شمارش قلم ثبت شد.")
                        }
                      >
                        ثبت شمارش
                      </button>
                    </td>
                  </tr>
                ))}
              </ResponsiveTable>
              <button
                className="v2-wide-action"
                disabled={
                  busy ||
                  activeStocktakeItems.some(
                    (item) => item.counted_quantity === null,
                  )
                }
                onClick={() =>
                  void run(
                    () =>
                      inventoryControlV2Action({
                        action: "stocktake_submit",
                        publicId: activeStocktake.public_id,
                      }),
                    "انبارگردانی برای مدیر ارسال شد.",
                  )
                }
              >
                ارسال برای تأیید مدیر
              </button>
            </>
          )}
          {activeStocktake?.status === "awaiting_manager" && (
            <div className="v2-inline-form">
              <strong>شمارش تکمیل و منتظر تأیید مدیر است.</strong>
              {profile.role === "repair_manager" && (
                <>
                  <label className="grow">
                    <span>علت/یادداشت تأیید</span>
                    <input
                      value={stocktakeReason}
                      onChange={(event) =>
                        setStocktakeReason(event.target.value)
                      }
                    />
                  </label>
                  <button
                    disabled={busy || !stocktakeReason.trim()}
                    onClick={() =>
                      void run(
                        () =>
                          inventoryControlV2Action({
                            action: "stocktake_decide",
                            publicId: activeStocktake.public_id,
                            decision: "approve",
                            reason: stocktakeReason,
                          }),
                        "انبارگردانی تأیید و مغایرت‌ها ثبت شد.",
                      )
                    }
                  >
                    تأیید نهایی
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}
      {openHot.length > 0 && (
        <section className="v2-table-panel">
          <div className="v2-panel-title">
            <div>
              <Archive />
              <span>
                <strong>تعهدهای داغی</strong>
                <small>پایان کار فنی تا تسویه همه تعهدها مسدود است.</small>
              </span>
            </div>
          </div>
          {["technician", "repair_manager"].includes(profile.role) &&
            openHot.some((item) =>
              ["pending_return", "rejected"].includes(String(item.status)),
            ) && (
              <form
                className="v2-grid-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () =>
                      inventoryControlV2Action({
                        action: "hot_submit",
                        hotReturnPublicId: hotForm.publicId,
                        serialNumber: hotForm.serial,
                        condition: hotForm.condition,
                        imageFileId: Number(hotForm.imageFileId) || undefined,
                        notes: hotForm.notes,
                      }),
                    "داغی برای بررسی انبار ارسال شد.",
                  );
                }}
              >
                <label>
                  <span>تعهد داغی</span>
                  <select
                    value={hotForm.publicId}
                    onChange={(event) =>
                      setHotForm({ ...hotForm, publicId: event.target.value })
                    }
                  >
                    <option value="">انتخاب کنید</option>
                    {openHot
                      .filter((item) =>
                        ["pending_return", "rejected"].includes(
                          String(item.status),
                        ),
                      )
                      .map((item) => (
                        <option
                          key={String(item.public_id)}
                          value={String(item.public_id)}
                        >
                          {item.receipt_number} · {item.item_title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>سریال قطعه</span>
                  <input
                    value={hotForm.serial}
                    onChange={(event) =>
                      setHotForm({ ...hotForm, serial: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>سلامت</span>
                  <select
                    value={hotForm.condition}
                    onChange={(event) =>
                      setHotForm({ ...hotForm, condition: event.target.value })
                    }
                  >
                    <option value="healthy">سالم</option>
                    <option value="damaged">آسیب‌دیده</option>
                    <option value="unknown">نیازمند بررسی</option>
                  </select>
                </label>
                <label>
                  <span>شناسه تصویر خصوصی</span>
                  <input
                    inputMode="numeric"
                    value={hotForm.imageFileId}
                    onChange={(event) =>
                      setHotForm({
                        ...hotForm,
                        imageFileId: event.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </label>
                <label className="grow">
                  <span>توضیحات</span>
                  <input
                    value={hotForm.notes}
                    onChange={(event) =>
                      setHotForm({ ...hotForm, notes: event.target.value })
                    }
                  />
                </label>
                <button disabled={busy || !hotForm.publicId}>تحویل داغی</button>
              </form>
            )}
          <ResponsiveTable
            headers={["پرونده", "قطعه", "تکنسین", "وضعیت", "عملیات"]}
          >
            {openHot.map((item) => (
              <tr key={String(item.public_id)}>
                <td data-label="پرونده">{item.receipt_number}</td>
                <td data-label="قطعه">{item.item_title}</td>
                <td data-label="تکنسین">{item.technician_name}</td>
                <td data-label="وضعیت">{String(item.status)}</td>
                <td data-label="عملیات">
                  {warehouseActions && item.status === "waiting_review" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            inventoryControlV2Action({
                              action: "hot_review",
                              hotReturnPublicId: item.public_id,
                              decision: "accept",
                            }),
                          "داغی تسویه شد.",
                        )
                      }
                    >
                      تأیید دریافت
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </section>
      )}
    </div>
  );
}

function ProcurementLoader(props: {
  data: V2ProcurementPayload;
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const [inventory, setInventory] = useState<V2InventoryPayload | null>(null);
  useEffect(() => {
    void loadV2Inventory().then(setInventory);
  }, []);
  return inventory ? (
    <ProcurementBoard {...props} inventory={inventory} />
  ) : (
    <div className="v2-loading">
      <LoaderCircle className="spin" />
      در حال خواندن کالاها…
    </div>
  );
}

function ProcurementBoard({
  data,
  inventory,
  profile,
  busy,
  run,
}: {
  data: V2ProcurementPayload;
  inventory: V2InventoryPayload;
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const [supplier, setSupplier] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [line, setLine] = useState({
    itemId: "",
    quantity: "1",
    unitPrice: "",
    reason: "کسری موجودی پرونده",
  });
  return (
    <div className="v2-stack">
      <section className="v2-card-form">
        <div className="v2-panel-title">
          <div>
            <ShoppingCart />
            <span>
              <strong>سفارش خرید تجمیعی</strong>
              <small>
                تکنسین درخواست می‌دهد؛ انباردار یا مدیر سفارش را می‌سازد.
              </small>
            </span>
          </div>
        </div>
        <div className="v2-inline-form">
          <label className="grow">
            <span>تأمین‌کننده جدید</span>
            <input
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              placeholder="نام فروشنده یا شرکت"
            />
          </label>
          <button
            disabled={busy || !newSupplier.trim()}
            onClick={() =>
              void run(
                () =>
                  procurementV2Action({
                    action: "supplier_create",
                    name: newSupplier,
                  }),
                "تأمین‌کننده ثبت شد.",
              )
            }
          >
            افزودن
          </button>
        </div>
        <form
          className="v2-grid-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                procurementV2Action({
                  action: "document_create",
                  supplierId: Number(supplier),
                  originReason: line.reason,
                  items: [
                    {
                      itemId: Number(line.itemId),
                      quantity: Number(line.quantity),
                      unitPrice: Number(line.unitPrice),
                      partRequestIds: [],
                    },
                  ],
                }),
              "سفارش خرید برای تأیید مدیر ساخته شد.",
            );
          }}
        >
          <label>
            <span>تأمین‌کننده</span>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">انتخاب کنید</option>
              {data.suppliers.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>کالا</span>
            <select
              value={line.itemId}
              onChange={(e) => setLine({ ...line, itemId: e.target.value })}
            >
              <option value="">انتخاب کنید</option>
              {inventory.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>تعداد</span>
            <input
              value={line.quantity}
              inputMode="numeric"
              onChange={(e) =>
                setLine({
                  ...line,
                  quantity: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </label>
          <label>
            <span>قیمت واحد ریال</span>
            <input
              value={line.unitPrice}
              inputMode="numeric"
              onChange={(e) =>
                setLine({
                  ...line,
                  unitPrice: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </label>
          <label className="grow">
            <span>علت اصلی</span>
            <input
              value={line.reason}
              onChange={(e) => setLine({ ...line, reason: e.target.value })}
            />
          </label>
          <button
            disabled={busy || !supplier || !line.itemId || !line.unitPrice}
          >
            ساخت سفارش
          </button>
        </form>
      </section>
      <section className="v2-table-panel">
        <ResponsiveTable
          headers={["سفارش", "تأمین‌کننده", "مبلغ", "وضعیت", "عملیات"]}
        >
          {data.documents.map((doc) => (
            <tr key={doc.id}>
              <td data-label="سفارش">
                <strong>{doc.document_number}</strong>
                <small>{localDate(doc.expected_at)}</small>
              </td>
              <td data-label="تأمین‌کننده">{doc.supplier_name}</td>
              <td data-label="مبلغ">{formatMoney(doc.total_amount)}</td>
              <td data-label="وضعیت">
                <span className="v2-table-status">
                  {purchaseLabels[doc.status] ?? doc.status}
                </span>
              </td>
              <td data-label="عملیات">
                <div className="v2-row-actions">
                  {profile.role === "repair_manager" &&
                    doc.status === "awaiting_approval" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              procurementV2Action({
                                action: "approve",
                                publicId: doc.public_id,
                                reason: "بررسی و تأیید سفارش",
                              }),
                            "سفارش تأیید شد.",
                          )
                        }
                      >
                        تأیید
                      </button>
                    )}
                  {["repair_manager", "warehouse_keeper"].includes(
                    profile.role,
                  ) &&
                    ["approved", "ordered", "partially_received"].includes(
                      doc.status,
                    ) &&
                    doc.items[0] && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              procurementV2Action({
                                action: "receive",
                                publicId: doc.public_id,
                                deliveryReference: "ثبت از پنل",
                                items: [
                                  {
                                    purchaseItemId: Number(doc.items[0].id),
                                    acceptedQuantity: Math.max(
                                      1,
                                      Number(doc.items[0].quantity) -
                                        Number(doc.items[0].received_quantity),
                                    ),
                                    defectiveQuantity: 0,
                                    extraQuantity: 0,
                                  },
                                ],
                              }),
                            "دریافت سفارش ثبت و موجودی شعبه به‌روز شد.",
                          )
                        }
                      >
                        ثبت دریافت
                      </button>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </ResponsiveTable>
      </section>
    </div>
  );
}

function QualityBoard({
  data,
  cases,
  profile,
  busy,
  run,
}: {
  data: V2QualityPayload;
  cases: V2Case[];
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const candidates = cases.filter((item) => item.status === "qc_pending");
  const [caseId, setCaseId] = useState("");
  const selected = candidates.find((item) => item.id === Number(caseId));
  const template = data.templates.find(
    (item) => item.workflow_code === selected?.workflowCode,
  );
  const [result, setResult] = useState("passed");
  const [reason, setReason] = useState("");
  const [checks, setChecks] = useState<Record<number, string>>({});
  const [checkNotes, setCheckNotes] = useState<Record<number, string>>({});
  const [customTests, setCustomTests] = useState<Array<{ id: string; title: string; result: string; notes: string }>>([]);
  return (
    <div className="v2-stack">
      <section className="v2-card-form v2-queue">
        <div className="v2-queue-head">
          <div><strong>آماده کنترل کیفیت</strong><small> پرونده‌های همین شعبه و دسترسی جاری</small></div>
          <b>{toman.format(candidates.length)}</b>
        </div>
        <div className="v2-queue-list">
          {candidates.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`v2-queue-card ${selected?.id === item.id ? "selected" : ""}`}
              aria-pressed={selected?.id === item.id}
              onClick={() => { setCaseId(String(item.id)); setChecks({}); }}
            >
              <strong dir="ltr">{item.receiptNumber}</strong>
              <span>{item.deviceTitle}</span>
              <small>{item.customerName} · {item.technicianName || "بدون مسئول"}</small>
              <em>شروع QC</em>
            </button>
          ))}
          {!candidates.length && <small>پرونده‌ای در صف QC وجود ندارد.</small>}
        </div>
      </section>
      <section className="v2-card-form">
        <div className="v2-panel-title">
          <div>
            <ClipboardCheck />
            <span>
              <strong>کنترل کیفیت مستقل</strong>
              <small>چک‌لیست استاندارد صنف + موارد افزوده تعمیرگاه</small>
            </span>
          </div>
        </div>
        {selected && <CaseContextHeader item={selected} branch={profile.branch} />}
        {template && (
          <div className="v2-checklist">
            <div className="v2-panel-title">
              <strong>{template.title}</strong>
              <button
                type="button"
                className="v2-mini-action"
                onClick={() => {
                  setChecks(Object.fromEntries(template.items.map((item) => [item.id, "passed"])));
                  setResult("passed");
                }}
              >
                <CheckCircle2 size={16} />
                همه تست‌ها قبول هستند
              </button>
            </div>
            {template.items.map((item) => (
              <div key={item.id} className="v2-qc-test-item">
                <label>
                  <span>{item.title}{item.is_required && <i>اجباری</i>}</span>
                  <select
                    value={checks[item.id] ?? ""}
                    onChange={(e) => {
                      setChecks({ ...checks, [item.id]: e.target.value });
                      if (e.target.value === "failed") setResult("failed");
                    }}
                  >
                    <option value="">انتخاب نتیجه</option>
                    <option value="passed">قبول</option>
                    <option value="failed">رد</option>
                    <option value="not_applicable">قابل اعمال نیست</option>
                    <option value="not_tested">تست نشده</option>
                  </select>
                </label>
                {checks[item.id] === "failed" && (
                  <label><span>شرح ایراد {item.title} (الزامی)</span><input
                    value={checkNotes[item.id] ?? ""}
                    onChange={(event) => setCheckNotes({ ...checkNotes, [item.id]: event.target.value })}
                    placeholder="شرح ایراد این تست (الزامی)"
                  /></label>
                )}
              </div>
            ))}
            <div className="v2-qc-custom-tests">
              {customTests.map((item) => (
                <div key={item.id} className="v2-qc-test-item">
                  <label><span>عنوان تست سفارشی</span><input value={item.title} onChange={(event) => setCustomTests(customTests.map((test) => test.id === item.id ? { ...test, title: event.target.value } : test))} /></label>
                  <label><span>نتیجه</span><select value={item.result} onChange={(event) => { const nextResult = event.target.value; setCustomTests(customTests.map((test) => test.id === item.id ? { ...test, result: nextResult } : test)); if (nextResult === "failed") setResult("failed"); }}><option value="passed">قبول</option><option value="failed">رد</option><option value="not_applicable">قابل اعمال نیست</option><option value="not_tested">تست نشده</option></select></label>
                  {item.result === "failed" && <label><span>شرح ایراد تست {item.title || "سفارشی"} (الزامی)</span><input value={item.notes} onChange={(event) => setCustomTests(customTests.map((test) => test.id === item.id ? { ...test, notes: event.target.value } : test))} placeholder="شرح ایراد تست سفارشی (الزامی)" /></label>}
                  <button type="button" className="v2-mini-action" onClick={() => setCustomTests(customTests.filter((test) => test.id !== item.id))}>حذف</button>
                </div>
              ))}
              <button type="button" className="v2-mini-action" onClick={() => setCustomTests([...customTests, { id: crypto.randomUUID(), title: "", result: "passed", notes: "" }])}>+ افزودن تست اختصاصی</button>
            </div>
          </div>
        )}
        <div className="v2-inline-form">
          <label>
            <span>نتیجه نهایی</span>
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="passed">قبول</option>
              <option value="failed">رد و بازکاری</option>
              <option value="conditional">قبول مشروط</option>
            </select>
          </label>
          <label className="grow">
            <span>
              {result === "failed"
                ? "علت مردودی"
                : result === "conditional"
                  ? "محدودیت تحویل"
                  : "توضیح"}
            </span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button
            disabled={
              busy ||
              !selected ||
              !template ||
              template.items.some(
                (item) => item.is_required && !checks[item.id],
              ) ||
              template.items.some(
                (item) => checks[item.id] === "failed" && !checkNotes[item.id]?.trim(),
              ) ||
              customTests.some((item) => !item.title.trim() || (item.result === "failed" && !item.notes.trim())) ||
              (result !== "passed" && !reason.trim())
            }
            onClick={() =>
              selected &&
              template &&
              void run(
                () =>
                  qualityV2Action({
                    action: "run",
                    caseId: selected.id,
                    templateId: template.id,
                    result,
                    failureReason: result === "failed" ? reason : undefined,
                    conditionalLimitations:
                      result === "conditional" ? reason : undefined,
                    idempotencyKey: crypto.randomUUID(),
                    items: template.items.map((item) => ({
                      templateItemId: item.id,
                      result: checks[item.id] || "not_tested",
                      notes: checkNotes[item.id] || undefined,
                    })),
                    customItems: customTests.map(({ title, result: customResult, notes }) => ({ title: title.trim(), result: customResult, notes: notes.trim() || undefined })),
                  }),
                "نتیجه QC ثبت شد.",
              )
            }
          >
            <CheckCircle2 />
            ثبت QC
          </button>
        </div>
      </section>
      <section className="v2-table-panel">
        <ResponsiveTable
          headers={["پرونده", "بازرس", "نتیجه", "بازکاری", "زمان"]}
        >
          {data.runs.map((run, index) => (
            <tr key={String(run.public_id ?? index)}>
              <td data-label="پرونده">{run.receipt_number}</td>
              <td data-label="بازرس">{run.performer_name}</td>
              <td data-label="نتیجه">{String(run.result)}</td>
              <td data-label="بازکاری">
                {toman.format(Number(run.rework_number ?? 0))}
              </td>
              <td data-label="زمان">
                {localDate(String(run.completed_at ?? ""))}
              </td>
            </tr>
          ))}
        </ResponsiveTable>
      </section>
    </div>
  );
}

function FinanceBoard({
  data,
  cases,
  profile,
  busy,
  run,
}: {
  data: { invoices: V2Invoice[]; drafts: V2InvoiceDraft[] };
  cases: V2Case[];
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const [form, setForm] = useState({
    caseId: "",
    title: "اجرت تعمیر",
    amount: "",
    tax: "0",
  });
  const [payment, setPayment] = useState({
    invoice: "",
    amount: "",
    method: "card",
    tracking: "",
  });
  const [refund, setRefund] = useState({
    invoice: "",
    amount: "",
    method: "card",
    tracking: "",
    reason: "",
  });
  const selectedDraft = data.drafts.find(
    (item) => item.caseId === Number(form.caseId),
  );
  const visibleCaseIds = new Set(cases.map((item) => item.id));
  const visibleDrafts = data.drafts.filter((item) => visibleCaseIds.has(item.caseId));
  const selectedInvoice = data.invoices.find((item) => item.public_id === payment.invoice);
  const selectedRefundInvoice = data.invoices.find((item) => item.public_id === refund.invoice);
  const selectedFinanceCase = cases.find(
    (item) => item.id === (selectedDraft?.caseId ?? selectedInvoice?.case_id ?? selectedRefundInvoice?.case_id),
  );
  const openInvoices = data.invoices.filter((item) => item.balance > 0 && visibleCaseIds.has(item.case_id));
  const issueItems = [
    ...(selectedDraft?.items ?? []),
    ...(form.amount
      ? [{
          type: "labor",
          title: form.title,
          quantity: 1,
          saleUnitPrice: Number(form.amount),
          purchaseUnitCost: 0,
          discountAmount: 0,
          taxRate: Number(form.tax),
          warrantyDays: 30,
        }]
      : []),
  ];
  return (
    <div className="v2-stack">
      <section className="v2-card-form v2-queue">
        <div className="v2-queue-head">
          <div><strong>نیازمند نهایی‌سازی مالی</strong><small> فاکتور ناقص یا مانده پرداخت</small></div>
          <b>{toman.format(visibleDrafts.length + openInvoices.length)}</b>
        </div>
        <div className="v2-queue-list">
          {visibleDrafts.map((draft) => {
            const item = cases.find((candidate) => candidate.id === draft.caseId);
            return (
              <button type="button" key={`draft-${draft.caseId}`} className={`v2-queue-card ${selectedDraft?.caseId === draft.caseId ? "selected" : ""}`} aria-pressed={selectedDraft?.caseId === draft.caseId} onClick={() => {
                setRefund({ ...refund, invoice: "", amount: "", reason: "" });
                setPayment({ ...payment, invoice: "", amount: "" });
                setForm({ ...form, caseId: String(draft.caseId) });
              }}>
                <strong dir="ltr">{draft.receiptNumber}</strong>
                <span>{item?.deviceTitle || "دستگاه پرونده"}</span>
                <small>{draft.customerName} · فاکتور صادر نشده</small>
                <em>بررسی و صدور</em>
              </button>
            );
          })}
          {openInvoices.map((invoice) => {
            const item = cases.find((candidate) => candidate.id === invoice.case_id);
            return (
              <button type="button" key={`invoice-${invoice.id}`} className={`v2-queue-card ${selectedInvoice?.id === invoice.id ? "selected" : ""}`} aria-pressed={selectedInvoice?.id === invoice.id} onClick={() => {
                setRefund({ ...refund, invoice: "", amount: "", reason: "" });
                setForm({ ...form, caseId: "" });
                setPayment({ ...payment, invoice: invoice.public_id, amount: String(invoice.balance) });
              }}>
                <strong dir="ltr">{invoice.receipt_number}</strong>
                <span>{item?.deviceTitle || invoice.invoice_number}</span>
                <small>{invoice.customer_name} · مانده {formatMoney(invoice.balance)}</small>
                <em>ثبت پرداخت</em>
              </button>
            );
          })}
          {!visibleDrafts.length && !openInvoices.length && <small>پرونده‌ای نیازمند اقدام مالی نیست.</small>}
        </div>
      </section>
      <section className="v2-card-form">
        <div className="v2-panel-title">
          <div>
            <WalletCards />
            <span>
              <strong>مالی کامل هر پرونده</strong>
              <small>قطعه، اجرت، مالیات ردیفی و پرداخت‌های چندگانه</small>
            </span>
          </div>
        </div>
        {selectedFinanceCase && <CaseContextHeader item={selectedFinanceCase} branch={profile.branch} />}
        <form
          className="v2-grid-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                financeV2Action({
                  action: "issue",
                  caseId: Number(form.caseId),
                  idempotencyKey: `repair-invoice-${form.caseId}`,
                  items: issueItems,
                }),
              "فاکتور نهایی صادر شد.",
            );
          }}
        >
          <label>
            <span>اجرت/هزینه تکمیلی</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            <span>مبلغ تکمیلی (اختیاری)</span>
            <input
              inputMode="numeric"
              value={form.amount}
              onChange={(e) =>
                setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })
              }
            />
          </label>
          <label>
            <span>مالیات ٪</span>
            <input
              value={form.tax}
              onChange={(e) => setForm({ ...form, tax: e.target.value })}
            />
          </label>
          {selectedDraft && (
            <div className="v2-finance-preview grow">
              <strong>پیش‌نویس خودکار از عملیات پرونده</strong>
              {selectedDraft.items.length ? selectedDraft.items.map((item, index) => (
                <span key={`${item.type}-${item.referenceId ?? index}`}>
                  {item.title} × {String(item.quantity)}
                  <b>{formatMoney(Number(item.quantity) * Number(item.saleUnitPrice))}</b>
                </span>
              )) : <small>ردیف عملیاتی ثبت نشده؛ در صورت نیاز اجرت تکمیلی را وارد کنید.</small>}
            </div>
          )}
          <button disabled={busy || !form.caseId || issueItems.length === 0}>
            صدور فاکتور
          </button>
        </form>
        <form
          className="v2-grid-form v2-payment-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                financeV2Action({
                  action: "payment",
                  invoicePublicId: payment.invoice,
                  amount: Number(payment.amount),
                  method: payment.method,
                  trackingNumber: payment.tracking,
                  idempotencyKey: crypto.randomUUID(),
                }),
              "پرداخت ثبت شد.",
            );
          }}
        >
          <label>
            <span>مبلغ پرداخت</span>
            <input
              value={payment.amount}
              inputMode="numeric"
              onChange={(e) =>
                setPayment({
                  ...payment,
                  amount: e.target.value.replace(/\D/g, ""),
                })
              }
            />
          </label>
          <label>
            <span>روش</span>
            <select
              value={payment.method}
              onChange={(e) =>
                setPayment({ ...payment, method: e.target.value })
              }
            >
              <option value="card">کارت</option>
              <option value="cash">نقد</option>
              <option value="bank_transfer">حواله</option>
              <option value="online">آنلاین</option>
            </select>
          </label>
          <label>
            <span>شماره پیگیری</span>
            <input
              value={payment.tracking}
              onChange={(e) =>
                setPayment({ ...payment, tracking: e.target.value })
              }
            />
          </label>
          <button disabled={busy || !payment.invoice || !payment.amount}>
            ثبت پرداخت
          </button>
        </form>
        {profile.role === "repair_manager" && selectedRefundInvoice && (
          <form
            className="v2-grid-form v2-refund-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () =>
                  financeV2Action({
                    action: "refund",
                    invoicePublicId: refund.invoice,
                    amount: Number(refund.amount),
                    method: refund.method,
                    trackingNumber: refund.tracking,
                    reason: refund.reason.trim(),
                    idempotencyKey: crypto.randomUUID(),
                  }),
                "سند استرداد ثبت شد.",
              );
            }}
          >
            <div className="v2-form-heading grow">
              <strong>سند اصلاح مالی / استرداد</strong>
              <small>پرداخت حذف نمی‌شود؛ سند برگشتی مستقل در دفتر مالی ثبت خواهد شد.</small>
            </div>
            <label>
              <span>مبلغ استرداد</span>
              <input inputMode="numeric" value={refund.amount} onChange={(event) => setRefund({ ...refund, amount: event.target.value.replace(/\D/g, "") })} />
            </label>
            <label>
              <span>روش استرداد</span>
              <select value={refund.method} onChange={(event) => setRefund({ ...refund, method: event.target.value })}>
                <option value="card">کارت</option><option value="cash">نقد</option><option value="bank_transfer">حواله</option><option value="online">آنلاین</option>
              </select>
            </label>
            <label>
              <span>شماره پیگیری</span>
              <input value={refund.tracking} onChange={(event) => setRefund({ ...refund, tracking: event.target.value })} />
            </label>
            <label className="grow">
              <span>علت اصلاح *</span>
              <input value={refund.reason} onChange={(event) => setRefund({ ...refund, reason: event.target.value })} placeholder="علت دقیق استرداد یا اصلاح مالی" />
            </label>
            <button disabled={busy || Number(refund.amount) < 1 || Number(refund.amount) > selectedRefundInvoice.paid_amount - selectedRefundInvoice.refunded_amount || !refund.reason.trim()}>
              ثبت سند استرداد
            </button>
          </form>
        )}
      </section>
      <section className="v2-table-panel">
        <ResponsiveTable headers={["فاکتور", "مشتری", "کل", "پرداخت", "مانده", "عملیات"]}>
          {data.invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td data-label="فاکتور">
                <strong>{invoice.invoice_number}</strong>
                <small>{invoice.receipt_number}</small>
              </td>
              <td data-label="مشتری">{invoice.customer_name}</td>
              <td data-label="کل">{formatMoney(invoice.total_amount)}</td>
              <td data-label="پرداخت">
                {formatMoney(invoice.paid_amount - invoice.refunded_amount)}
              </td>
              <td data-label="مانده">
                <span
                  className={
                    invoice.balance > 0 ? "v2-balance due" : "v2-balance"
                  }
                >
                  {formatMoney(invoice.balance)}
                </span>
                {profile.role === "repair_manager" && invoice.balance > 0 && (
                  <button
                    className="v2-mini-action"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          financeV2Action({
                            action: "receivable",
                            invoicePublicId: invoice.public_id,
                            dueAt: new Date(Date.now() + 7 * 86400000)
                              .toISOString()
                              .slice(0, 19)
                              .replace("T", " "),
                            customerCommitmentText:
                              "تعهد پرداخت مانده تا سررسید ثبت‌شده",
                            evidence: { recordedByManager: true },
                          }),
                        "مطالبه و تعهد مشتری ثبت شد.",
                      )
                    }
                  >
                    تحویل با مانده
                  </button>
                )}
              </td>
              <td data-label="عملیات">
                {profile.role === "repair_manager" && invoice.paid_amount - invoice.refunded_amount > 0 ? (
                  <button
                    type="button"
                    className="v2-mini-action"
                    onClick={() => {
                      setForm({ ...form, caseId: "" });
                      setPayment({ ...payment, invoice: "", amount: "" });
                      setRefund({ invoice: invoice.public_id, amount: String(invoice.paid_amount - invoice.refunded_amount), method: "card", tracking: "", reason: "" });
                    }}
                  >
                    ثبت اصلاح مالی
                  </button>
                ) : <small>—</small>}
              </td>
            </tr>
          ))}
        </ResponsiveTable>
      </section>
    </div>
  );
}

function DeliveryBoard({
  data,
  cases,
  profile,
  busy,
  run,
}: {
  data: {
    cases: V2DeliveryCase[];
    verificationSettings: Record<string, unknown>;
    warrantyEnabled: boolean;
  };
  cases: V2Case[];
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const visibleCaseIds = new Set(cases.map((item) => item.id));
  const ready = data.cases.filter(
    (item) => item.process_status === "ready_for_delivery" && visibleCaseIds.has(item.case_id),
  );
  const [form, setForm] = useState({
    caseId: "",
    name: "",
    mobile: "",
    recipientType: "customer",
    nationalCode: "",
    method: "receipt_qr",
    evidence: "رسید پذیرش تطبیق داده شد",
    discrepancyNote: "",
    otpRequestId: "",
    otpCode: "",
  });
  const [confirmedAccessories, setConfirmedAccessories] = useState<string[]>([]);
  const [warrantyReturn, setWarrantyReturn] = useState({ caseId: "", issue: "", notes: "" });
  const selected = ready.find((item) => item.case_id === Number(form.caseId));
  const selectedWorkflowCase = cases.find((item) => item.id === selected?.case_id);
  const selectedAccessories = selected
    ? (() => {
        try {
          const parsed = JSON.parse(selected.accessories_json || "[]");
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      })()
    : [];
  const missingAccessories = selectedAccessories.filter(
    (item) => !confirmedAccessories.includes(item),
  );
  return (
    <div className="v2-stack">
      <section className="v2-card-form v2-queue">
        <div className="v2-queue-head">
          <div><strong>آماده تحویل</strong><small> فقط پرونده‌های عبورکرده از کنترل‌های QC و مالی</small></div>
          <b>{toman.format(ready.length)}</b>
        </div>
        <div className="v2-queue-list">
          {ready.map((item) => {
            const workflowCase = cases.find((candidate) => candidate.id === item.case_id);
            return (
              <button
                type="button"
                key={item.case_id}
                className={`v2-queue-card ${selected?.case_id === item.case_id ? "selected" : ""}`}
                aria-pressed={selected?.case_id === item.case_id}
                onClick={() => {
                  setForm({ ...form, caseId: String(item.case_id), name: item.customer_name, mobile: item.customer_mobile });
                  setConfirmedAccessories([]);
                }}
              >
                <strong dir="ltr">{item.receipt_number}</strong>
                <span>{workflowCase?.deviceTitle || "دستگاه پرونده"}</span>
                <small>{item.customer_name} · {item.balance > 0 ? `مانده ${formatMoney(item.balance)}` : "تسویه کامل"}</small>
                <em>شروع تحویل</em>
              </button>
            );
          })}
          {!ready.length && <small>پرونده آماده تحویلی وجود ندارد.</small>}
        </div>
      </section>
      <section className="v2-card-form">
        <div className="v2-panel-title">
          <div>
            <PackageCheck />
            <span>
              <strong>تحویل امن و غیرقابل تکرار</strong>
              <small>
                قطعه، داغی، QC و مالی پیش از تحویل دوباره روی سرور بررسی
                می‌شوند.
              </small>
            </span>
          </div>
        </div>
        {selectedWorkflowCase && <CaseContextHeader item={selectedWorkflowCase} branch={profile.branch} />}
        <form
          className="v2-grid-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                deliveryV2Action({
                  action: "complete",
                  caseId: Number(form.caseId),
                  recipientType: form.recipientType,
                  recipientFullName: form.name,
                  recipientMobile: form.mobile,
                  recipientNationalCode: form.nationalCode,
                  verificationMethod: form.method,
                  verificationEvidence: { note: form.evidence },
                  idempotencyKey: crypto.randomUUID(),
                  otpRequestId: form.otpRequestId,
                  otpCode: form.otpCode,
                  accessoriesConfirmed: confirmedAccessories,
                  warningsAcknowledged: { accepted: true },
                  warrantyConditions:
                    "ضمانت هر ردیف مطابق فاکتور و شرایط تعمیرگاه است.",
                }),
              "تحویل ثبت و دوره ضمانت آغاز شد.",
            );
          }}
        >
          {selected && (
            <div className="v2-delivery-readiness grow">
              <strong>آمادگی تحویل</strong>
              <span className="ready"><CheckCircle2 size={16} /> تعمیر تکمیل شده</span>
              <span className={selected.blockers.qc.length ? "blocked" : "ready"}>
                {selected.blockers.qc.length ? "کنترل کیفیت نیازمند اقدام است" : "کنترل کیفیت تأیید شده"}
              </span>
              <span className={selected.blockers.finance.length ? "blocked" : "ready"}>
                {selected.blockers.finance.length ? selected.blockers.finance.join("، ") : "وضعیت مالی معتبر است"}
              </span>
              <div className="v2-accessory-checklist">
                <b>لوازم همراه</b>
                {selectedAccessories.length ? selectedAccessories.map((accessory) => (
                  <label key={accessory}>
                    <input
                      type="checkbox"
                      checked={confirmedAccessories.includes(accessory)}
                      onChange={(event) =>
                        setConfirmedAccessories((current) =>
                          event.target.checked
                            ? [...current, accessory]
                            : current.filter((item) => item !== accessory),
                        )
                      }
                    />
                    <span>{accessory}</span>
                  </label>
                )) : <small>لوازم همراهی در پذیرش ثبت نشده است.</small>}
                {missingAccessories.length > 0 && (
                  <div className="v2-inline-form">
                    <label className="grow">
                      <span>شرح مغایرت لوازم</span>
                      <input
                        value={form.discrepancyNote}
                        onChange={(event) =>
                          setForm({ ...form, discrepancyNote: event.target.value })
                        }
                        placeholder="علت نبودن یا مغایرت اقلام را ثبت کنید"
                      />
                    </label>
                    <button
                      type="button"
                      className="v2-mini-action"
                      disabled={busy || !form.discrepancyNote.trim()}
                      onClick={() =>
                        void run(
                          () =>
                            deliveryV2Action({
                              action: "report_discrepancy",
                              caseId: selected.case_id,
                              missingAccessories,
                              note: form.discrepancyNote.trim(),
                            }),
                          "مغایرت لوازم در Audit پرونده ثبت شد.",
                        )
                      }
                    >
                      ثبت مغایرت
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <label>
            <span>تحویل‌گیرنده</span>
            <select
              value={form.recipientType}
              onChange={(e) =>
                setForm({ ...form, recipientType: e.target.value })
              }
            >
              <option value="customer">خود مشتری</option>
              <option value="representative">شخص دیگر</option>
            </select>
          </label>
          <label>
            <span>نام کامل</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span>موبایل</span>
            <input
              dir="ltr"
              inputMode="tel"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
          </label>
          {form.recipientType === "representative" && (
            <label>
              <span>مشخصات هویتی تحویل‌گیرنده</span>
              <input
                dir="ltr"
                value={form.nationalCode}
                onChange={(event) =>
                  setForm({ ...form, nationalCode: event.target.value })
                }
                placeholder="کد ملی یا شناسه معتبر"
              />
            </label>
          )}
          <label>
            <span>روش احراز</span>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
            >
              <option value="receipt_qr">رسید یا QR</option>
              <option value="sms_otp">OTP پیامکی</option>
              <option value="digital_signature">امضا</option>
              <option value="identity_document">مدرک هویتی</option>
              {profile.role === "repair_manager" && (
                <option value="manager_emergency">مسیر اضطراری مدیر</option>
              )}
            </select>
          </label>
          <label className="grow">
            <span>مدرک/توضیح</span>
            <input
              value={form.evidence}
              onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            />
          </label>
          {["sms_otp"].includes(form.method) ||
          form.recipientType === "representative" ? (
            <>
              <label>
                <span>شناسه OTP</span>
                <div className="v2-inline-form">
                  <input dir="ltr" readOnly value={form.otpRequestId} />
                  <button
                    type="button"
                    className="v2-mini-action"
                    disabled={busy || !selected}
                    onClick={async () => {
                      if (!selected) return;
                      const response = await run(
                        () =>
                          smsV2Action({
                            action: "otp_request",
                            purpose:
                              form.recipientType === "representative"
                                ? "representative_delivery"
                                : "delivery",
                            subjectPublicId: selected.case_public_id,
                            mobile: selected.customer_mobile,
                          }),
                        "کد یک‌بارمصرف برای مشتری ارسال شد.",
                      );
                      const requestId = String(
                        (response as { requestId?: unknown } | undefined)
                          ?.requestId ?? "",
                      );
                      if (requestId)
                        setForm((current) => ({
                          ...current,
                          otpRequestId: requestId,
                        }));
                    }}
                  >
                    ارسال OTP
                  </button>
                </div>
              </label>
              <label>
                <span>کد OTP</span>
                <input
                  inputMode="numeric"
                  value={form.otpCode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      otpCode: e.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                />
              </label>
            </>
          ) : null}
          <button
            disabled={
              busy ||
              !selected ||
              !form.name ||
              !form.mobile ||
              (form.recipientType === "representative" &&
                !form.nationalCode.trim()) ||
              !form.evidence ||
              ((form.method === "sms_otp" ||
                form.recipientType === "representative") &&
                (!form.otpRequestId || form.otpCode.length !== 6)) ||
              selectedAccessories.some((item) => !confirmedAccessories.includes(item))
            }
          >
            <PackageCheck />
            ثبت تحویل نهایی
          </button>
        </form>
      </section>
      <section className="v2-table-panel">
        <ResponsiveTable
          headers={["پرونده", "مشتری", "وضعیت", "مانده", "کنترل‌ها", "عملیات"]}
        >
          {data.cases.map((item) => (
            <tr key={item.case_id}>
              <td data-label="پرونده">{item.receipt_number}</td>
              <td data-label="مشتری">{item.customer_name}</td>
              <td data-label="وضعیت">{statusLabels[item.process_status]}</td>
              <td data-label="مانده">{formatMoney(item.balance)}</td>
              <td data-label="کنترل‌ها">
                {Object.values(item.blockers).flat().length ? (
                  <span className="v2-balance due">
                    {Object.values(item.blockers).flat().join("، ")}
                  </span>
                ) : (
                  <span className="v2-balance">تکمیل</span>
                )}
              </td>
              <td data-label="عملیات">
                {data.warrantyEnabled && item.process_status === "delivered" && Number(item.active_warranty_count) > 0 ? (
                  <button type="button" className="v2-mini-action" onClick={() => setWarrantyReturn({ caseId: String(item.case_id), issue: "", notes: "" })}>
                    پذیرش ضمانتی
                  </button>
                ) : <small>—</small>}
              </td>
            </tr>
          ))}
        </ResponsiveTable>
      </section>
      {data.warrantyEnabled && warrantyReturn.caseId && (
        <section className="v2-card-form">
          <div className="v2-panel-title"><div><ShieldCheck /><span><strong>ثبت مراجعه ضمانتی مرتبط</strong><small>پرونده جدید به پرونده تحویل‌شده اصلی متصل می‌شود.</small></span></div></div>
          <form className="v2-grid-form" onSubmit={(event) => {
            event.preventDefault();
            void run(() => deliveryV2Action({
              action: "warranty_case",
              originalCaseId: Number(warrantyReturn.caseId),
              declaredIssue: warrantyReturn.issue.trim(),
              notes: warrantyReturn.notes.trim(),
              appearanceStates: [],
              idempotencyKey: `warranty:${warrantyReturn.caseId}:${crypto.randomUUID()}`,
            }), "پرونده مراجعه ضمانتی ایجاد شد.");
          }}>
            <label className="grow"><span>شرح ایراد ضمانتی *</span><textarea rows={3} value={warrantyReturn.issue} onChange={(event) => setWarrantyReturn({ ...warrantyReturn, issue: event.target.value })} /></label>
            <label className="grow"><span>یادداشت داخلی</span><input value={warrantyReturn.notes} onChange={(event) => setWarrantyReturn({ ...warrantyReturn, notes: event.target.value })} /></label>
            <button disabled={busy || !warrantyReturn.issue.trim()}>ایجاد پرونده ضمانتی</button>
            <button type="button" className="v2-mini-action" onClick={() => setWarrantyReturn({ caseId: "", issue: "", notes: "" })}>انصراف</button>
          </form>
        </section>
      )}
    </div>
  );
}

function SmsBoard({
  data,
  busy,
  run,
}: {
  data: Record<string, unknown[]>;
  busy: boolean;
  run: Run;
}) {
  const [provider, setProvider] = useState({
    apiKey: "",
    sender: "",
    otpTemplate: "",
  });
  const messages = (data.messages ?? []) as Array<
    Record<string, string | number | null>
  >;
  return (
    <div className="v2-stack">
      <section className="v2-card-form">
        <div className="v2-panel-title">
          <div>
            <Send />
            <span>
              <strong>اتصال خصوصی کاوه‌نگار</strong>
              <small>
                کلید API رمزگذاری می‌شود و هیچ سورسی به سرویس اسکن ابری ارسال
                نمی‌شود.
              </small>
            </span>
          </div>
        </div>
        <form
          className="v2-grid-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                smsV2Action({
                  action: "configure",
                  providerCode: "kavenegar",
                  displayName: "کاوه‌نگار",
                  apiKey: provider.apiKey,
                  settings: {
                    sender: provider.sender,
                    otpTemplate: provider.otpTemplate,
                  },
                }),
              "تنظیمات کاوه‌نگار ذخیره شد.",
            );
          }}
        >
          <label className="grow">
            <span>API Key</span>
            <input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={provider.apiKey}
              onChange={(e) =>
                setProvider({ ...provider, apiKey: e.target.value })
              }
            />
          </label>
          <label>
            <span>شماره فرستنده</span>
            <input
              dir="ltr"
              value={provider.sender}
              onChange={(e) =>
                setProvider({ ...provider, sender: e.target.value })
              }
            />
          </label>
          <label>
            <span>قالب Lookup برای OTP</span>
            <input
              dir="ltr"
              value={provider.otpTemplate}
              onChange={(e) =>
                setProvider({ ...provider, otpTemplate: e.target.value })
              }
            />
          </label>
          <button disabled={busy || !provider.apiKey || !provider.otpTemplate}>
            ذخیره امن
          </button>
        </form>
      </section>
      <section className="v2-table-panel">
        <ResponsiveTable
          headers={["رویداد", "گیرنده", "وضعیت", "تلاش", "زمان"]}
        >
          {messages.map((message, index) => (
            <tr key={String(message.public_id ?? index)}>
              <td data-label="رویداد">{message.event_code}</td>
              <td data-label="گیرنده" dir="ltr">
                {message.recipient_mobile}
              </td>
              <td data-label="وضعیت">{message.status}</td>
              <td data-label="تلاش">{message.attempts}</td>
              <td data-label="زمان">
                {localDate(String(message.created_at ?? ""))}
              </td>
            </tr>
          ))}
        </ResponsiveTable>
      </section>
    </div>
  );
}

function Blockers({
  value,
}: {
  value: { parts: string[]; qc: string[]; finance: string[] };
}) {
  const entries = Object.entries(value).flatMap(([kind, items]) =>
    items.map((text) => ({ kind, text })),
  );
  return entries.length ? (
    <div className="v2-blockers">
      <strong>موانع ادامه فرایند</strong>
      <div>
        {entries.map((item) => (
          <span key={`${item.kind}-${item.text}`}>{item.text}</span>
        ))}
      </div>
    </div>
  ) : (
    <div className="v2-clear">
      <CheckCircle2 size={17} />
      مانع ثبت‌شده‌ای برای مرحله بعد وجود ندارد.
    </div>
  );
}

function ResponsiveTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="v2-table-wrap">
      <table className="v2-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="v2-empty">
      <FileText />
      <strong>{text}</strong>
      <small>با تغییر فیلتر یا تازه‌سازی دوباره بررسی کنید.</small>
    </div>
  );
}
