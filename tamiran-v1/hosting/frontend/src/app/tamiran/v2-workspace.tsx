"use client";
import { ExternalPurchasePanel } from "./external-purchase-panel";
import { OperationsFollowups, OperationsPerformance, OperationsPolicyForm } from "./manager-operations";
import { ProcurementDocuments, ProcurementForm } from "./case-procurement";
import { CaseStageBoard } from "./case-stage-board";
import { OperationsCaseWorkspace } from "./operations-case-workspace";
import { technicalCaseFromLocation, writeTechnicalLocation } from "./technician-navigation";
import { printHandoverReceipt } from "./handover-receipt";
import { MoneyInput, formatToman } from "./money-input";
import "./iteration-six.css";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
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
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import type { WorkspaceProfile } from "./access";
import { FollowUpApiError } from "./followups-api";
import { matchesQueueSearch } from "./queue-search";
import {
  deliveryV2Action,
  financeV2Action,
  handoverDiscrepancy,
  handoverNeedsApproval,
  inventoryControlV2Action,
  inventoryV2Action,
  loadV2Delivery,
  loadV2Finance,
  loadV2Inventory,
  loadV2InventoryControl,
  loadV2Procurement,
  loadV2Quality,
  loadV2QualityCase,
  loadV2Sms,
  loadV2Workflow,
  qualityV2Action,
  startV2Quality,
  type V2QcTemplate,
  smsV2Action,
  workflowV2Action,
  type V2Case,
  type V2DeliveryCase,
  type V2InventoryPayload,
  type V2Invoice,
  type V2InvoiceDraft,
  type V2ProcurementPayload,
  type V2QualityPayload,
  type V2QualityCase,
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
const toman = new Intl.NumberFormat("fa-IR");
const formatMoney = (value: number | string | null | undefined) =>
  `${formatToman(Number(value ?? 0))} تومان`;
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
      <span><small>دستگاه</small><strong>{item.deviceTitle}</strong>{item.initialIdentityReason && <small>در پذیرش بدون شناسه بود: {({powered_off:"دستگاه خاموش", missing_label:"برچسب مفقود", unreadable:"ناخوانا",other:"سایر موارد"} as Record<string,string>)[item.initialIdentityReason] ?? item.initialIdentityReason}</small>}</span>
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
  onNavigate: (page: string) => void;
};
type Section =
  | "workflow"
  | "inventory"
  | "supply"
  | "quality"
  | "delivery"
  | "sms";
const pageSection = (page: string): Section => {
  if (page === "صف تأمین قطعات") return "supply";
  if (page === "کنترل کیفیت") return "quality";
  if (page === "مالی و تحویل") return "delivery";
  if (page === "پیامک و پرتال") return "sms";
  if (["انبار قطعات", "گردش‌ها", "تعهدهای داغی"].includes(page)) return "inventory";
  return "workflow";
};

export function V2Workspace({ page, profile, notify, onNavigate }: Props) {
  const section = pageSection(page);
  const [serviceCaseOpen, setServiceCaseOpen] = useState(false);
  const [workflowCaseOpen, setWorkflowCaseOpen] = useState(() => !!technicalCaseFromLocation());
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
  const [queueSearch, setQueueSearch] = useState(() => {
    if (!["quality","delivery"].includes(section)) return "";
    const receipt=window.sessionStorage.getItem("tamiran:focused-module-receipt") ?? "";
    window.sessionStorage.removeItem("tamiran:focused-module-receipt"); return receipt;
  });
  const queueCases = useMemo(() => {
    return (workflow?.cases ?? []).filter((item) =>
      matchesQueueSearch(queueSearch, [item.receiptNumber, item.customerName, item.customerMobile, item.identifier, item.deviceTitle]),
    );
  }, [workflow?.cases, queueSearch]);
  const pageSubtitle = section === "quality"
    ? "دریافت دستگاه، آزمایش و ثبت نتیجه"
    : section === "delivery" ? "نهایی‌سازی مالی و ثبت تحویل واقعی"
    : section === "supply" ? "رزرو، خرید و تحویل قطعات پرونده‌ها"
    : "";
  const canFinance = ["repair_manager", "finance_cashier"].includes(profile.role)
    || profile.permissions.includes("finance.view");
  const canDeliver = ["repair_manager", "reception", "finance_cashier"].includes(profile.role)
    || profile.permissions.includes("delivery.view");
  const [deliveryTab, setDeliveryTab] = useState(() => {
    const url = new URL(location.href);
    return canFinance && (url.searchParams.get("deliveryTab") === "finance"
      || url.searchParams.get("view") === "case-finance" || !canDeliver) ? "finance" : "ready";
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const base = await loadV2Workflow();
      setWorkflow(base);
      if (section === "inventory" || section === "supply") {
        const [stock, control, purchasing] = await Promise.all([
          loadV2Inventory(),
          section === "inventory" && profile.inventoryMode === "pro" ? loadV2InventoryControl() : null,
          section === "supply" && profile.inventoryMode === "pro" && (
            ["repair_manager", "warehouse_keeper"].includes(profile.role) || profile.permissions.includes("procurement.view"))
            ? loadV2Procurement() : null,
        ]);
        setInventory(stock);
        setInventoryControl(control);
        setProcurement(purchasing);
      }
      if (section === "quality") setQuality(await loadV2Quality());
      if (section === "delivery") {
        const [financeData, deliveryData] = await Promise.all([
          canFinance && profile.modules.includes("finance") ? loadV2Finance() : null,
          canDeliver ? loadV2Delivery() : null,
        ]);
        setFinance(financeData);
        setDelivery(deliveryData);
      }
      if (section === "sms") setSms(await loadV2Sms());
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [section, profile.inventoryMode, profile.role, profile.permissions, profile.modules, canFinance, canDeliver]);
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
      const message=errorText(cause);
      if(section==="workflow")await reload();
      setError(message);
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
      {!serviceCaseOpen && !(section === "workflow" && workflowCaseOpen) && <header className="v2-page-head">
        <div>
          <span className="v2-kicker">{profile.branch}</span>
          <h2>{page}</h2>
          {pageSubtitle && <p>{pageSubtitle}</p>}
        </div>
        <button
          className="secondary-button"
          onClick={() => void reload()}
          disabled={loading || busy}
        >
          <RefreshCw size={17} />
          تازه‌سازی
        </button>
      </header>}
      {!serviceCaseOpen && ["supply", "quality", "delivery"].includes(section) && (
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
          page={page}
          data={workflow}
          profile={profile}
          busy={busy}
          run={run}
          notify={notify}
          onNavigate={onNavigate}
          onBusyChange={setBusy}
          onCaseOpenChange={setWorkflowCaseOpen}
          onCaseChanged={fresh=>setWorkflow(current=>current?{...current,cases:current.cases.map(item=>item.id===fresh.id?fresh:item)}:current)}
        />
      )}
      {["inventory", "supply"].includes(section) && workflow && inventory && (
        <InventoryBoard
          data={inventory}
          control={inventoryControl}
          profile={profile}
          supply={section === "supply"}
          caseIds={queueSearch.trim() ? new Set(queueCases.map(item => item.id)) : undefined}
          procurement={procurement}
          busy={busy}
          run={run}
        />
      )}
      {section === "quality" && workflow && quality && (
        <QualityBoard
          data={quality}
          onCaseOpen={setServiceCaseOpen}
          cases={queueCases}
          profile={profile}
          busy={busy}
          run={run}
        />
      )}
      {section === "delivery" && (
        <>
          {!serviceCaseOpen && finance && delivery && <nav className="tech-handover-actions" aria-label="مراحل مالی و تحویل">
            <button type="button" aria-pressed={deliveryTab === "finance"} onClick={() => setDeliveryTab("finance")}>نهایی‌سازی مالی</button>
            <button type="button" aria-pressed={deliveryTab === "ready"} onClick={() => setDeliveryTab("ready")}>تحویل دستگاه</button>
          </nav>}
          {finance && (!delivery || deliveryTab === "finance") && <FinanceBoard onCaseOpen={setServiceCaseOpen} data={finance} cases={queueCases} profile={profile} busy={busy} run={run} />}
          {delivery && (!finance || deliveryTab === "ready") && <DeliveryBoard onCaseOpen={setServiceCaseOpen} data={delivery} cases={queueCases} profile={profile} busy={busy} run={run} />}
        </>
      )}
      {section === "sms" && sms && (
        <SmsBoard data={sms} busy={busy} run={run} />
      )}
    </div>
  );
}

type Run = (job: () => Promise<unknown>, success: string) => Promise<unknown>;

function WorkflowBoard({
  page,
  data,
  profile,
  busy,
  run,
  notify,
  onNavigate,
  onBusyChange,
  onCaseChanged,
  onCaseOpenChange,
}: {
  page: string;
  data: V2WorkflowPayload;
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
  notify: (message: string) => void;
  onNavigate: (page: string) => void;
  onBusyChange: (busy: boolean) => void;
  onCaseChanged: (item: V2Case) => void;
  onCaseOpenChange: (open: boolean) => void;
}) {
  const [selectedId, setSelectedId] = useState(() => {
    const focused = Number(
      sessionStorage.getItem("tamiran:focused-workflow-case") ?? 0,
    );
    sessionStorage.removeItem("tamiran:focused-workflow-case");
    return (
      technicalCaseFromLocation() ||
      (Number.isSafeInteger(focused) && focused > 0 ? focused : 0)
    );
  });
  const [search, setSearch] = useState("");
  const managerPage = {
    "مجوز خرید قطعه": "purchases",
    "پیگیری پرونده‌ها": "followups",
    "عملکرد تکنسین‌ها": "performance",
    "سیاست‌های تعمیرگاه": "policy",
  }[page] ?? "cases";
  const [handoverReasons, setHandoverReasons] = useState<
    Record<number, string>
  >({});
  const [openedCase, setOpenedCase] = useState<V2Case>();
  const listedCase = data.cases.find((item) => item.id === selectedId);
  const selected = listedCase ?? (openedCase?.id === selectedId ? openedCase : undefined);
  useEffect(() => {
    if (!selectedId || selected || profile.role !== "repair_manager") return;
    let active = true;
    void loadV2Workflow(selectedId).then((reply) => {
      if (active && reply.cases[0]) setOpenedCase(reply.cases[0]);
    }).catch(() => {});
    return () => { active = false; };
  }, [selectedId, selected, profile.role]);
  useEffect(() => onCaseOpenChange(!!selected), [selected?.id, onCaseOpenChange]);
  useEffect(() => {
    if (selectedId && !technicalCaseFromLocation())
      writeTechnicalLocation(selectedId, "overview", undefined, true);
  }, [selectedId]);
  const exit = () => {
    const url = new URL(location.href);
    url.searchParams.delete("opsTask");
    history.replaceState({ ...history.state }, "", url);
    writeTechnicalLocation(0);
    setSelectedId(0);
  };
  const open = (item: V2Case) => {
    setOpenedCase(item);
    writeTechnicalLocation(item.id);
    setSelectedId(item.id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openHandovers = data.handovers.filter(
    (item) => item.status === "requested",
  );
  const handoverLock = React.useRef(false);
  const decide = async (publicId: string, decision: string, reason: string) => {
    if (handoverLock.current) return;
    handoverLock.current = true;
    try {
      await run(
        () =>
          workflowV2Action({
            action: "handover_decide",
            publicId,
            decision,
            reason,
          }),
        "تصمیم تحویل مسئولیت ثبت شد.",
      );
    } finally {
      handoverLock.current = false;
    }
  };
  if (selected)
    return (
      <div className="technical-desk operations-case-desk">
        <OperationsCaseWorkspace
          key={selected.id}
          selected={selected}
          data={data}
          profile={profile}
          busy={busy}
          run={run}
          notify={notify}
          onNavigate={onNavigate}
          onExit={exit}
          onBusyChange={onBusyChange}
          onChanged={(item) => { setOpenedCase(item); onCaseChanged(item); }}
        />
      </div>
    );
  return (
    <div className="v2-stack operations-board">
      {selectedId && !selected && (
        <p role="alert">
          پرونده در دسترسی فعلی موجود نیست.{" "}
          <button onClick={exit}>بازگشت به دستگاه‌ها</button>
        </p>
      )}
      {managerPage !== "cases" && profile.role === "repair_manager" && (
        <div className="technical-desk"><section className="tech-task">
          {managerPage === "purchases" && <ExternalPurchasePanel actorId={profile.actorId} />}
          {managerPage === "followups" && <OperationsFollowups open={open} />}
          {managerPage === "performance" && <OperationsPerformance />}
          {managerPage === "policy" && <OperationsPolicyForm policy={data.operationsPolicy} users={data.users}
            onSaved={async () => { await run(async () => {}, ""); }} />}
        </section></div>
      )}
      {managerPage === "cases" && <>
      {page !== "ارجاع تکنسین‌ها" && <><label className="module-search v2-queue-search">
        <FileText size={17} />
        <input
          aria-label="جست‌وجوی دستگاه‌ها"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="رسید، نام مشتری یا سریال"
        />
      </label>
      <CaseStageBoard
        cases={data.cases.filter((item) =>
          (page === "تأیید هزینه" ? item.status === "awaiting_customer_approval"
            : search.trim() !== "" || ["reception", "awaiting_assignment"].includes(item.status)) &&
          matchesQueueSearch(search, [
            item.receiptNumber,
            item.customerName,
            item.customerMobile,
            item.identifier,
            item.deviceTitle,
          ]),
        )}
        onOpen={open}
        openCaseId={selectedId}
        busy={busy}
      />
      </>}
      {page === "ارجاع تکنسین‌ها" && (
        <section className="tech-handover-list">
          <h3>تحویل‌های رسمی در انتظار</h3>
          {!openHandovers.length && <p>ارجاعی در انتظار رسیدگی نیست.</p>}
          <ul>
            {openHandovers.map((h) => {
              const discrepancy = handoverDiscrepancy(h);
              return <li key={h.id}>
                <p>
                  <bdi>{h.receipt_number}</bdi> — {h.from_user_name} ←{" "}
                  {h.to_user_name}
                </p>
                <p>{h.reason}</p>
                <button type="button" disabled={busy} onClick={() => {
                  writeTechnicalLocation(h.case_id);
                  setSelectedId(h.case_id);
                }}>مشاهده پرونده</button>
                {handoverNeedsApproval(h) && <p>منتظر تأیید مدیر</p>}
                {discrepancy && (
                  <p><strong>مغایرت تحویل</strong> {discrepancy.reason}
                    {discrepancy.resolution && <> · نتیجهٔ بررسی: {discrepancy.resolution}</>}
                  </p>
                )}
                {profile.role === "repair_manager" && (
                  <>
                    <label>
                      علت تصمیم دربارهٔ ارجاع
                      <input
                        value={handoverReasons[h.id] ?? ""}
                        onChange={(e) =>
                          setHandoverReasons((current) => ({
                            ...current,
                            [h.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                    {handoverNeedsApproval(h) && <button type="button" disabled={busy}
                      onClick={() => void decide(h.public_id, "approve_request", handoverReasons[h.id] ?? "")}>تأیید درخواست ارجاع</button>}
                    {discrepancy && !discrepancy.resolvedAt && <button
                      type="button"
                      disabled={busy || !handoverReasons[h.id]?.trim()}
                      onClick={() => void decide(h.public_id, "resolve_discrepancy", handoverReasons[h.id])}
                    >ثبت نتیجهٔ بررسی مغایرت</button>}
                    <button
                      type="button"
                      disabled={busy || !handoverReasons[h.id]?.trim()}
                      onClick={() =>
                        void decide(h.public_id, "cancel", handoverReasons[h.id])
                      }
                    >
                      لغو درخواست ارجاع
                    </button>
                  </>
                )}
              </li>;
            })}
          </ul>
        </section>
      )}
      </>}
    </div>
  );
}

function InventoryBoard({
  data,
  control,
  supply,
  caseIds,
  procurement,
  profile,
  busy,
  run,
}: {
  data: V2InventoryPayload;
  control: Record<string, unknown[]> | null;
  supply: boolean;
  caseIds?: Set<number>;
  procurement: V2ProcurementPayload | null;
  profile: WorkspaceProfile;
  busy: boolean;
  run: Run;
}) {
  const [purchaseRequestId, setPurchaseRequestId] = useState<number>();
  const openRequestIds = new Set(procurement?.documents
    .filter(doc => !["received", "rejected", "cancelled"].includes(doc.status))
    .flatMap(doc => doc.items.flatMap(item => item.requests.map(req => Number(req.part_request_id)))));
  const eligible = procurement ? data.requests.filter(row =>
    ["pending","needs_supply","reserved","partially_delivered"].includes(row.status)
      && row.item_id && row.quantity > row.reserved_quantity && !openRequestIds.has(row.id)
  ) : [];
  const purchaseRequest = eligible.find(row => row.id === purchaseRequestId);
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
      {supply && procurement && purchaseRequest && <ProcurementForm
        key={purchaseRequest.id} selected={purchaseRequest} eligible={eligible} suppliers={procurement.suppliers}
        busy={busy} run={run} close={() => setPurchaseRequestId(undefined)} />}
      <section className="v2-table-panel">
        <div className="v2-panel-title"><div><PackageOpen /><strong>درخواست‌های پرونده‌ها</strong></div></div>
        <ResponsiveTable
          headers={["پرونده", "کالا", "درخواست/تحویل", "وضعیت", "عملیات"]}
        >
          {data.requests.filter(item => !caseIds || caseIds.has(item.case_id)).map((item) => {
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
                  {supply && eligible.some(row => row.id === item.id) && <button type="button" className="v2-mini-action"
                    disabled={busy} onClick={() => setPurchaseRequestId(item.id)}>ساخت سفارش خرید</button>}
                  {supply && openRequestIds.has(item.id) && <small>سفارش خرید باز دارد</small>}

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
      {supply && procurement && <ProcurementDocuments data={procurement} profile={profile} busy={busy} run={run} />}
      {warehouseActions && control && (
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

const queuePriority = { critical: 0, urgent: 1, normal: 2 };
const compareQueueCases = (a?: V2Case, b?: V2Case) =>
  (a?.status === "qc_rework" ? -1 : queuePriority[a?.priority ?? "normal"]) -
  (b?.status === "qc_rework" ? -1 : queuePriority[b?.priority ?? "normal"]) ||
  (a?.promisedAt ?? "9999").localeCompare(b?.promisedAt ?? "9999") ||
  (a?.acceptedAt ?? "").localeCompare(b?.acceptedAt ?? "");

function ServiceQueueCard({ receipt, title, customer, action, item, onOpen }: {
  receipt: string; title: string; customer: string; action: string; item?: V2Case; onOpen: () => void;
}) {
  const priority = item?.priority ?? "normal";
  return <button type="button" className="service-queue-card" onClick={onOpen}>
    <span className="service-card-line"><bdi>{receipt}</bdi><small data-priority={priority}>{priority === "critical" ? "بسیار فوری" : priority === "urgent" ? "فوری" : "عادی"}</small></span>
    <strong>{title}</strong>
    <span>{customer}</span>
    {item?.declaredIssue && <p>{item.declaredIssue}</p>}
    <span className="service-card-line"><span>{action}</span><ArrowLeft size={16} aria-hidden="true" /></span>
  </button>;
}

function QualityBoard({ data, cases, profile, busy, run, onCaseOpen }: {
  onCaseOpen: (open: boolean) => void;
  data: V2QualityPayload; cases: V2Case[]; profile: WorkspaceProfile; busy: boolean; run: Run;
}) {
  const candidates = cases.filter(item => item.status === "qc_pending" &&
    (profile.role !== "technician" || item.qcMode === "simple" || profile.permissions.includes("qc.perform")))
    .sort(compareQueueCases);
  const [caseId, setCaseId] = useState(() => Number(new URL(location.href).searchParams.get("qcCase")));
  const [editing, setEditing] = useState(false);
  const selected = candidates.find(item => item.id === caseId);
  useEffect(() => onCaseOpen(!!selected), [selected, onCaseOpen]);
  const select = (id: number) => {
    const url = new URL(location.href);
    if (id) url.searchParams.set("qcCase", String(id));
    else url.searchParams.delete("qcCase");
    history.replaceState(history.state, "", url);
    setCaseId(id);
    window.scrollTo(0, 0);
  };
  if (selected) return <QualityCase key={selected.id} item={selected} profile={profile} busy={busy} run={run} close={() => select(0)} />;
  return <div className="v2-stack">
    <section className="v2-card-form">
      <div className="service-card-line"><h3>صف کنترل کیفیت</h3><b>{toman.format(candidates.length)} دستگاه</b></div>
      <div className="service-card-grid">
        {candidates.map(item => <ServiceQueueCard key={item.id} item={item} title={item.deviceTitle}
          receipt={item.receiptNumber} customer={item.customerName} action="باز کردن پرونده" onOpen={() => select(item.id)} />)}
        {!candidates.length && <Empty text="پرونده‌ای در صف کنترل کیفیت نیست." />}
      </div>
    </section>
    {profile.role === "repair_manager" && <section className="v2-card-form">
      <button type="button" onClick={() => setEditing(!editing)}>{editing ? "بستن تنظیم آزمایش‌ها" : "تنظیم آزمایش‌ها"}</button>
      {editing && <QualityTemplateForm key={data.templates.map(row => row.id).join(":")} templates={data.templates} busy={busy} run={run} />}
    </section>}
    {data.runs.length > 0 && <section className="v2-table-panel">
      <h3>سوابق کنترل کیفیت</h3>
      <ResponsiveTable headers={["پرونده", "بازرس", "نتیجه", "بازکاری", "زمان"]}>
        {data.runs.map((record, index) => <tr key={String(record.public_id ?? index)}>
          <td data-label="پرونده">{record.receipt_number}</td><td data-label="بازرس">{record.performer_name}</td>
          <td data-label="نتیجه">{{passed:"تأیید شده",failed:"مردود",conditional:"تأیید مشروط"}[String(record.result)] ?? "—"}</td>
          <td data-label="بازکاری">{toman.format(Number(record.rework_number ?? 0))}</td>
          <td data-label="زمان">{localDate(String(record.completed_at ?? ""))}</td>
        </tr>)}
      </ResponsiveTable>
    </section>}
  </div>;
}

type QcDraft = {
  step: "tests" | "result";
  answers: Record<number,{ result: string; notes: string }>;
  custom: Array<{ id: string; title: string; result: string; notes: string }>;
  reason: string;
  rework: string;
  key: string;
};
const blankQcDraft = (): QcDraft => ({ step: "tests", answers: {}, custom: [], reason: "", rework: "repairing", key: "" });
const qcResults = [["passed","تأیید تست"],["failed","عدم تأیید تست"],["not_applicable","قابل اعمال نیست"],["prior","خرابی از قبل موجود"]];
const noteRequired = (result: string) => ["failed", "not_applicable", "prior"].includes(result);

function QualityCase({ item, profile, busy, run, close }: {
  item: V2Case; profile: WorkspaceProfile; busy: boolean; run: Run; close: () => void;
}) {
  const [context, setContext] = useState<V2QualityCase>();
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(blankQcDraft);
  const draftKey = (receipt: string) => `tamiran:qc:${profile.actorId}:${receipt}`;
  useEffect(() => {
    let active = true;
    void loadV2QualityCase(item.id).then(value => {
      if (!active) return;
      if (value.receipt) {
        try {
          const saved = sessionStorage.getItem(draftKey(value.receipt.publicId));
          if (saved) setDraft(JSON.parse(saved) as QcDraft);
        } catch { /* The server receipt is still usable without browser storage. */ }
      }
      setContext(value);
    }).catch(cause => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [item.id, profile.actorId]);

  const receipt = context?.receipt;
  const change = (values: Partial<QcDraft>) => {
    const next = {...draft, ...values};
    setDraft(next);
    if (receipt) {
      try { sessionStorage.setItem(draftKey(receipt.publicId), JSON.stringify(next)); } catch { /* In-memory draft remains available. */ }
    }
  };
  const tests = receipt?.template.items ?? [];
  const results = [...Object.values(draft.answers), ...draft.custom];
  const failed = results.some(row => row.result === "failed");
  const conditional = !failed && results.some(row => row.result === "prior");
  const valid = tests.every(test => {
    const answer = draft.answers[test.id];
    return (!(test.is_required || test.code === "repair_issue") || !!answer?.result) &&
      (!answer || !noteRequired(answer.result) || !!answer.notes.trim());
  }) && draft.custom.every(row => row.title.trim() && (!noteRequired(row.result) || row.notes.trim()));
  const choose = (current: string, handler: (value: string) => void, primary = false) =>
    <div className="service-test-choices">{qcResults.slice(0, primary ? 2 : 4).map(([id,label]) =>
      <button key={id} type="button" aria-pressed={current === id} data-result={id} disabled={busy} onClick={() => handler(id)}>{label}</button>)}</div>;

  return <article className="service-case">
    <div className="service-card-line"><h3>{item.deviceTitle} · <bdi>{item.receiptNumber}</bdi></h3><button type="button" disabled={busy} onClick={close}>بازگشت به صف</button></div>
    {error && <p role="alert">{error}</p>}
    {!context && !error && <p role="status">در حال دریافت پرونده…</p>}
    {context && !receipt && <section className="v2-card-form">
      <h3>دریافت دستگاه در کنترل کیفیت</h3>
      <p className="service-callout">ایراد پذیرش · {item.declaredIssue}</p>
      {context.report && <p>{context.report}</p>}
      {context.activities.length > 0 && <ul>{context.activities.map((text,index) => <li key={index}>{text}</li>)}</ul>}
      <p>قطعات مصرف‌شده</p>
      {context.parts.length ? <ul>{context.parts.map((part,index) => <li key={index}>{part.title} · {toman.format(part.quantity)} عدد</li>)}</ul> : <p>قطعه‌ای مصرف نشده است.</p>}
      <button type="button" className="tech-primary" disabled={busy} onClick={() => void run(async () => {
        const response = await startV2Quality(item.id);
        setContext({ ...context, receipt: response.receipt });
        return response;
      }, "دریافت فیزیکی دستگاه ثبت شد.")}>تأیید دریافت و شروع تست</button>
    </section>}
    {receipt && draft.step === "tests" && <section className="v2-card-form">
      <h3>اجرای آزمایش‌های کنترل کیفیت</h3>
      <p className="service-callout">برای تست مردود، غیرقابل‌اعمال یا خرابی مستند قبلی توضیح وارد کنید.</p>
      {tests.map(test => {
        const value = draft.answers[test.id];
        return <div key={test.id} role="group" aria-label={test.title} className="service-test">
          <div className="service-card-line"><strong>{test.title}</strong><small>{test.is_required ? "الزامی" : "اختیاری"}</small></div>
          {choose(value?.result ?? "", result => change({ answers: { ...draft.answers, [test.id]: {result, notes: ""} }, key: "" }), test.code === "repair_issue")}
          {value && noteRequired(value.result) && <label>شرح ایراد {test.title} (الزامی)<input value={value.notes}
            onChange={event => change({ answers: {...draft.answers, [test.id]: {...value, notes: event.target.value}}, key: "" })} /></label>}
        </div>;
      })}
      {draft.custom.map(row => <div className="service-test" key={row.id}>
        <label>عنوان تست سفارشی<input value={row.title} onChange={event => change({custom:draft.custom.map(test => test.id === row.id ? {...test,title:event.target.value} : test),key:""})} /></label>
        {choose(row.result, result => change({custom:draft.custom.map(test => test.id === row.id ? {...test,result,notes:""} : test),key:""}))}
        {noteRequired(row.result) && <label>شرح ایراد تست {row.title || "سفارشی"} (الزامی)<input value={row.notes}
          onChange={event => change({custom:draft.custom.map(test => test.id === row.id ? {...test,notes:event.target.value} : test),key:""})} /></label>}
        <button type="button" onClick={() => change({custom:draft.custom.filter(test => test.id !== row.id),key:""})}>حذف تست اختصاصی</button>
      </div>)}
      <div className="service-card-line">
        <button type="button" disabled={busy} onClick={() => change({custom:[...draft.custom,{id:crypto.randomUUID(),title:"",result:"passed",notes:""}],key:""})}>افزودن تست اختصاصی</button>
        <button type="button" className="tech-primary" disabled={busy || !valid} onClick={() => change({step:"result"})}>ثبت تست‌ها و ادامه</button>
      </div>
    </section>}
    {receipt && draft.step === "result" && <section className="v2-card-form">
      <h3>نتیجه کنترل کیفیت</h3>
      <p className="service-callout">تست سالم {toman.format(results.filter(row => row.result === "passed").length)} · تست مردود {toman.format(results.filter(row => row.result === "failed").length)}</p>
      {failed ? <>
        <label>علت مردودی<input value={draft.reason} onChange={event => change({reason:event.target.value,key:""})} /></label>
        <label>مقصد بازکاری<select aria-label="مسیر بازکاری" value={draft.rework} onChange={event => change({rework:event.target.value,key:""})}>
          <option value="repairing">عملیات تعمیر مجدد</option><option value="diagnosing">عیب‌یابی مجدد</option>
        </select></label>
      </> : conditional ? <p>تأیید مشروط با ثبت خرابی‌های مستند قبلی</p> : <p>کنترل کیفیت موفق · پرونده آمادهٔ ارجاع به مالی است.</p>}
      <div className="service-card-line">
        <button type="button" disabled={busy} onClick={() => change({step:"tests"})}>بازگشت و اصلاح تست‌ها</button>
        <button type="button" className={failed ? "service-danger" : "tech-primary"} disabled={busy || !valid || (failed && !draft.reason.trim())}
          onClick={async () => {
            const key = draft.key || crypto.randomUUID();
            if (!draft.key) change({key});
            const result = await run(() => qualityV2Action({
              action:"run", caseId:item.id, receiptId:receipt.publicId, result: failed ? "failed" : conditional ? "conditional" : "passed",
              failureReason: failed ? draft.reason.trim() : undefined, reworkDestination: failed ? draft.rework : undefined,
              idempotencyKey:key,
              items:tests.map(test => ({ templateItemId:test.id, result:draft.answers[test.id]?.result || "not_tested", notes:draft.answers[test.id]?.notes || undefined })),
              customItems:draft.custom.map(({title,result,notes}) => ({title:title.trim(),result,notes:notes.trim() || undefined})),
            }), failed ? "پرونده برای بازکاری فرستاده شد." : "نتیجه ثبت شد و پرونده به مالی رفت.");
            if (result) {
              try { sessionStorage.removeItem(draftKey(receipt.publicId)); } catch { /* Storage is optional. */ }
              close();
            }
          }}>{failed ? "رد QC و بازگشت برای بازکاری" : "تأیید و ارجاع به مالی"}</button>
      </div>
    </section>}
  </article>;
}

function QualityTemplateForm({ templates, busy, run }: { templates: V2QcTemplate[]; busy: boolean; run: Run }) {
  const [current, setCurrent] = useState(templates[0]?.id);
  const template = templates.find((item) => item.id === current);
  const [items, setItems] = useState(() => (templates[0]?.items ?? []).filter((item) => item.code !== "repair_issue"));
  const select = (id: number) => {
    setCurrent(id);
    setItems((templates.find((item) => item.id === id)?.items ?? []).filter((item) => item.code !== "repair_issue"));
  };
  return <form className="tech-form-grid" onSubmit={(event) => {
    event.preventDefault();
    if (!template) return;
    void run(() => qualityV2Action({
      action: "save_template", templateId: template.id, workflowCode: template.workflow_code,
      items: items.map((row) => ({ code: row.code, title: row.title, isRequired: row.is_required })),
    }), "نسخهٔ جدید چک‌لیست ذخیره شد.");
  }}>
    <label>چک‌لیست فعال<select value={current} onChange={(event) => select(Number(event.target.value))}>
      {templates.map((row) => <option value={row.id} key={row.id}>{row.title}</option>)}
    </select></label>
    <p>ایراد اصلی دستگاه در همهٔ چک‌لیست‌ها اجباری است.</p>
    {items.map((item, index) => <div key={item.code} className="tech-form-grid">
      <label>عنوان آزمایش<input required maxLength={240} value={item.title} onChange={(event) =>
        setItems(items.map((row) => row.code === item.code ? { ...row, title: event.target.value } : row))} /></label>
      <label className="tech-handover-check"><input type="checkbox" checked={!!item.is_required} onChange={(event) =>
        setItems(items.map((row) => row.code === item.code ? { ...row, is_required: event.target.checked } : row))} /> اجباری</label>
      <div className="tech-handover-actions">
        <button type="button" disabled={index === 0} onClick={() => {
          const next = [...items];
          [next[index - 1], next[index]] = [next[index], next[index - 1]];
          setItems(next);
        }}>انتقال به بالا</button>
        <button type="button" onClick={() => setItems(items.filter((row) => row.code !== item.code))}>حذف از نسخهٔ جدید</button>
      </div>
    </div>)}
    <button type="button" disabled={items.length >= 100} onClick={() => setItems([...items, {
      id: 0, code: crypto.randomUUID(), title: "", is_required: true, input_type: "pass_fail",
    }])}>افزودن آزمایش</button>
    <button type="submit" disabled={busy || !template}>ذخیرهٔ نسخهٔ چک‌لیست</button>
  </form>;
}

function FinanceBoard({
  onCaseOpen,
  data,
  cases,
  profile,
  busy,
  run,
}: {
  onCaseOpen: (open: boolean) => void;
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
  const financeQueue = [
    ...visibleDrafts.map(draft => ({
      id: draft.caseId, receipt: draft.receiptNumber, customer: draft.customerName, action: "بررسی پیش‌نویس",
      open: () => { setRefund({ ...refund, invoice: "" }); setPayment({ ...payment, invoice: "", amount: "" });
        setForm({ caseId: String(draft.caseId), title: "اجرت تعمیر", amount: "", tax: "0" }); },
    })),
    ...openInvoices.map(invoice => ({
      id: invoice.case_id, receipt: invoice.receipt_number, customer: invoice.customer_name,
      action: `مانده ${formatMoney(invoice.balance)} · ثبت پرداخت`,
      open: () => { setRefund({ ...refund, invoice: "" }); setForm({ ...form, caseId: "" });
        setPayment({ invoice: invoice.public_id, method: "card", amount: String(invoice.balance), tracking: "" }); },
    })),
  ].map(row => ({...row, item: cases.find(item => item.id === row.id)})).sort((a,b) => compareQueueCases(a.item,b.item));
  const closeFinance = () => {
    setForm({ ...form, caseId: "" });
    setPayment({ ...payment, invoice: "" });
    setRefund({ ...refund, invoice: "" });
  };
  const financeOpen = !!(selectedDraft || selectedInvoice || selectedRefundInvoice);
  useEffect(() => onCaseOpen(financeOpen), [financeOpen, onCaseOpen]);
  const paymentKey = React.useRef<{signature: string; key: string} | undefined>(undefined);
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
      {!financeOpen && <section className="v2-card-form">
        <div className="service-card-line"><h3>صف نهایی‌سازی مالی</h3><b>{toman.format(financeQueue.length)} پرونده</b></div>
        <div className="service-card-grid">
          {financeQueue.map(row => <ServiceQueueCard key={row.receipt + row.action} receipt={row.receipt} item={row.item}
            title={row.item?.deviceTitle ?? "دستگاه پرونده"} customer={row.customer} action={row.action} onOpen={row.open} />)}
          {!financeQueue.length && <Empty text="پرونده‌ای نیازمند اقدام مالی نیست." />}
        </div>
      </section>}
      {financeOpen && <section className="v2-card-form service-case">
        <div className="service-card-line"><h3>{selectedDraft ? "بررسی پیش‌نویس فاکتور" : selectedRefundInvoice ? "استرداد وجه" : "ثبت پرداخت و تعیین تکلیف مالی"}</h3>
          <button type="button" disabled={busy} onClick={closeFinance}>بازگشت به صف</button></div>
        {selectedFinanceCase && <CaseContextHeader item={selectedFinanceCase} branch={profile.branch} />}
        {selectedDraft && <form
          className="v2-grid-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const issued = await run(
              () =>
                financeV2Action({
                  action: "issue",
                  caseId: Number(form.caseId),
                  idempotencyKey: `repair-invoice-${form.caseId}`,
                  items: issueItems,
                }),
              "فاکتور نهایی صادر شد.",
            ) as { publicId?: string; readyForDelivery?: boolean; totalAmount?: number } | undefined;
            if (issued?.publicId) {
              setForm({ ...form, caseId: "" });
              if (!issued.readyForDelivery && Number(issued.totalAmount) > 0) {
                setPayment({ invoice: issued.publicId, amount: String(issued.totalAmount), method: "card", tracking: "" });
              }
            }
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
            <MoneyInput value={form.amount} onChange={amount => setForm({ ...form, amount })} />
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
                <span key={item.sourceKey ?? `${item.type}-${item.referenceId ?? index}`}>
                  {item.title} × {String(item.quantity)}
                  <b>{formatMoney(Number(item.quantity) * Number(item.saleUnitPrice))}</b>
                </span>
              )) : <small>ردیف عملیاتی ثبت نشده؛ در صورت نیاز اجرت تکمیلی را وارد کنید.</small>}
            </div>
          )}
          <button disabled={busy || !form.caseId || issueItems.length === 0}>
            صدور فاکتور
          </button>
        </form>}
        {selectedInvoice && <form
          className="v2-grid-form v2-payment-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const signature = JSON.stringify(payment);
            if (paymentKey.current?.signature !== signature) {
              paymentKey.current = { signature, key: crypto.randomUUID() };
            }
            const paid = await run(
              () =>
                financeV2Action({
                  action: "payment",
                  invoicePublicId: payment.invoice,
                  amount: Number(payment.amount),
                  method: payment.method,
                  trackingNumber: payment.tracking,
                  idempotencyKey: paymentKey.current?.key,
                }),
              "پرداخت ثبت شد.",
            ) as { remaining?: number; readyForDelivery?: boolean } | undefined;
            if (paid) {
              paymentKey.current = undefined;
              if (!paid.remaining || paid.readyForDelivery) closeFinance();
              else setPayment({ ...payment, amount: String(paid.remaining), tracking: "" });
            }
          }}
        >
          <label>
            <span>مبلغ پرداخت</span>
            <MoneyInput value={payment.amount} onChange={amount => setPayment({ ...payment, amount })} />
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
          <button disabled={busy || !payment.invoice || Number(payment.amount) < 1 || Number(payment.amount) > selectedInvoice.balance}>
            {Number(payment.amount) === selectedInvoice.balance ? "ثبت تسویه و آماده تحویل" : "ثبت پرداخت"}
          </button>
        </form>}
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
      </section>}
      {!financeOpen && <section className="v2-table-panel">
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
      </section>}
    </div>
  );
}

function DeliveryBoard({
  onCaseOpen,
  data,
  cases,
  profile,
  busy,
  run,
}: {
  onCaseOpen: (open: boolean) => void;
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
  const [printError, setPrintError] = useState("");
  const visibleCaseIds = new Set(cases.map((item) => item.id));
  const ready = data.cases.filter(
    (item) => ["ready_for_delivery", "returned_unrepaired"].includes(item.process_status) && !item.delivered_at && visibleCaseIds.has(item.case_id),
  );
  const configuredMethods = data.verificationSettings.enabledMethods;
  const methods = [
    ["receipt_qr", "رسید یا QR"], ["digital_signature", "امضا"], ["identity_document", "مدرک هویتی"], ["sms_otp", "کد پیامکی"],
  ].filter(([value]) => !Array.isArray(configuredMethods) || configuredMethods.includes(value));
  if (profile.role === "repair_manager") methods.push(["manager_emergency", "مسیر اضطراری مدیر"]);
  const newForm = (item?: V2DeliveryCase) => ({
    caseId: item ? String(item.case_id) : "",
    name: item?.customer_name ?? "",
    mobile: item?.customer_mobile ?? "",
    recipientType: "customer",
    nationalCode: "",
    method: methods[0]?.[0] ?? "",
    evidence: "",
    discrepancyNote: "",
    otpRequestId: "",
    otpCode: "",
    identifier: item?.identifier_snapshot ?? "", identityConfirmed: false, identityChangeReason: "",
  });
  const [form, setForm] = useState(() => newForm(ready.find(item =>
    item.case_id === Number(new URL(location.href).searchParams.get("deliveryCase")))));
  const deliveryKey = React.useRef<{signature: string; key: string} | undefined>(undefined);
  const [confirmedAccessories, setConfirmedAccessories] = useState<string[]>([]);
  const [warrantyReturn, setWarrantyReturn] = useState({ caseId: "", issue: "", notes: "", identifier: "" });
  const selected = ready.find((item) => item.case_id === Number(form.caseId));
  useEffect(() => onCaseOpen(!!selected || !!warrantyReturn.caseId), [selected, warrantyReturn.caseId, onCaseOpen]);
  const selectedWorkflowCase = cases.find((item) => item.id === selected?.case_id);
  const selectedAccessories = selected
    ? (() => {
        try {
          const parsed = JSON.parse(selected.accessories_json || "[]");
          return Array.isArray(parsed) ? [...new Set(parsed.map(value => typeof value === "string" ? value.trim()
            : String(value?.label ?? value?.title ?? value?.name ?? "").trim()).filter(Boolean))] : [];
        } catch {
          return [];
        }
      })()
    : [];
  const missingAccessories = selectedAccessories.filter(
    (item) => !confirmedAccessories.includes(item),
  );
  const selectDelivery = (item?: V2DeliveryCase) => {
    setForm(newForm(item));
    setConfirmedAccessories([]);
    deliveryKey.current = undefined;
    const url = new URL(location.href);
    if (item) url.searchParams.set("deliveryCase", String(item.case_id));
    else url.searchParams.delete("deliveryCase");
    history.replaceState(history.state, "", url);
    window.scrollTo(0, 0);
  };
  const sortedReady = ready.map(item => ({ item, workflow: cases.find(row => row.id === item.case_id) }))
    .sort((a,b) => compareQueueCases(a.workflow,b.workflow));
  return (
    <div className="v2-stack">
      {printError && <p role="alert" className="identity-error">{printError}</p>}
      {!selected && !warrantyReturn.caseId && <section className="v2-card-form">
        <div className="service-card-line"><h3>صف دستگاه‌های آمادهٔ تحویل</h3><b>{toman.format(ready.length)} دستگاه</b></div>
        <div className="service-card-grid">
          {sortedReady.map(({ item, workflow }) => <ServiceQueueCard key={item.case_id}
            item={workflow} receipt={item.receipt_number} title={workflow?.deviceTitle ?? [item.brand_snapshot,item.model_snapshot].filter(Boolean).join(" ")}
            customer={item.customer_name} action={item.process_status === "returned_unrepaired" ? "تحویل بدون تعمیر" : "شروع تحویل"} onOpen={() => selectDelivery(item)} />)}
          {!ready.length && <Empty text="پرونده‌ای آماده تحویل نیست." />}
        </div>
      </section>}
      {selected && <section className="v2-card-form service-case">
        <div className="service-card-line"><h3>تحویل دستگاه به مشتری</h3>
          <button type="button" disabled={busy} onClick={() => selectDelivery()}>بازگشت به صف</button></div>
        <p className="service-callout"><strong>{selectedWorkflowCase?.deviceTitle ?? [selected.brand_snapshot, selected.model_snapshot].filter(Boolean).join(" ")}</strong>
          {" · "}<bdi>{selected.receipt_number}</bdi>{" · "}{selected.customer_name}</p>
        <form
          className="v2-grid-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const payload = {
              action: "complete", expectedVersion: selectedWorkflowCase?.lockVersion,
              caseId: selected.case_id, deviceIdentifier: form.identifier,
              identityConfirmed: form.identityConfirmed, identifierChangeReason: form.identityChangeReason,
              recipientType: form.recipientType, recipientFullName: form.name, recipientMobile: form.mobile,
              recipientNationalCode: form.nationalCode, verificationMethod: form.method,
              verificationEvidence: { note: form.evidence.trim() }, emergencyReason: form.method === "manager_emergency" ? form.evidence.trim() : undefined, otpRequestId: form.otpRequestId, otpCode: form.otpCode,
              accessoriesConfirmed: confirmedAccessories, warningsAcknowledged: { accepted: true },
              warrantyConditions: "ضمانت هر ردیف مطابق فاکتور و شرایط تعمیرگاه است.",
            };
            const signature = JSON.stringify(payload);
            if (deliveryKey.current?.signature !== signature) deliveryKey.current = { signature, key: crypto.randomUUID() };
            if (await run(() => deliveryV2Action({ ...payload, idempotencyKey: deliveryKey.current?.key }),
              selected.process_status === "returned_unrepaired" ? "تحویل بدون تعمیر ثبت شد." : "تحویل واقعی دستگاه ثبت شد.")) selectDelivery();
          }}
        >
          {selected && (
            <div className="v2-delivery-readiness grow">
              <strong>آمادگی تحویل</strong>
              <div className="service-readiness">
              <span className="ready"><CheckCircle2 size={16} /> {selected.process_status === "returned_unrepaired" ? "عودت بدون تعمیر" : "تعمیر تکمیل شده"}</span>
              <span className={selected.blockers.qc.length ? "blocked" : "ready"}>
                {selected.blockers.qc.length ? "کنترل کیفیت نیازمند اقدام است" : "کنترل کیفیت تأیید شده"}
              </span>
              <span className={selected.blockers.finance.length ? "blocked" : "ready"}>
                {selected.blockers.finance.length ? selected.blockers.finance.join("، ") : "وضعیت مالی معتبر است"}
              </span>
              </div>
              {selected.process_status === "returned_unrepaired" ? <p>عودت بدون تعمیر{!selected.identifier_snapshot && " ـ شناسه ثبت نشده"}. تحویل‌گیرنده و زمان تحویل ثبت می‌شوند.</p> : <div className="reception-identity-field">
              <label><span>سریال / IMEI دستگاه تحویلی *</span><input dir="ltr" value={form.identifier} onChange={(e) => setForm({...form, identifier: e.target.value, identityConfirmed: false})} maxLength={180}/></label>
              <small>{selected.identifier_snapshot ? `شناسه قبلی: ${selected.identifier_snapshot}` : "دستگاه بدون شناسه پذیرش شده؛ شناسه را از دستگاه روشن‌شده ثبت کنید."}</small>
              {selected.identifier_snapshot && form.identifier !== selected.identifier_snapshot && <label><span>علت تغییر شناسه (ثبت فقط توسط مدیر)</span><input value={form.identityChangeReason} onChange={(e) => setForm({...form, identityChangeReason: e.target.value})} placeholder="مانند تعویض برد، با حفظ شناسه قبلی در سابقه" maxLength={1000}/></label>}
              <label className="identity-missing-choice"><input type="checkbox" checked={form.identityConfirmed} onChange={(e) => setForm({...form, identityConfirmed: e.target.checked})}/><span>شناسه را با همین دستگاه تطبیق دادم.</span></label></div>}
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
              {methods.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
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
              (selected?.process_status !== "returned_unrepaired" && (!form.identifier.trim() || !form.identityConfirmed)) ||
              !form.name ||
              !form.mobile ||
              (form.recipientType === "representative" &&
                !form.nationalCode.trim()) ||
              !form.method ||
              !form.evidence.trim() ||
              ((form.method === "sms_otp" ||
                form.recipientType === "representative") &&
                (!form.otpRequestId || form.otpCode.length !== 6)) ||
              selectedAccessories.some((item) => !confirmedAccessories.includes(item))
            }
          >
            <PackageCheck />
            ثبت تحویل واقعی
          </button>
        </form>
      </section>}
      {!selected && !warrantyReturn.caseId && <section className="v2-table-panel">
        <h3>سوابق تحویل</h3>
        <ResponsiveTable
          headers={["پرونده", "مشتری", "وضعیت", "مانده", "کنترل‌ها", "عملیات"]}
        >
          {data.cases.filter(item => !!item.delivered_at).map((item) => (
            <tr key={item.case_id}>
              <td data-label="پرونده">{item.receipt_number}</td>
              <td data-label="مشتری">{item.customer_name}</td>
              <td data-label="وضعیت">{statusLabels[item.process_status]}{item.process_status === "returned_unrepaired" && <small>{item.delivered_at ? "تحویل واقعی ثبت شده" : "منتظر تحویل به مشتری"}</small>}</td>
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
                {item.delivered_at && <button type="button" className="v2-mini-action" onClick={() => {if(!printHandoverReceipt(item))setPrintError("مرورگر پنجرهٔ چاپ را باز نکرد؛ اجازهٔ بازشدن پنجره را برای این سایت فعال کنید.");}}>چاپ رسید تحویل {item.receipt_number}</button>}
                {data.warrantyEnabled && item.process_status === "delivered" && Number(item.active_warranty_count) > 0 ? (
                  <button type="button" className="v2-mini-action" onClick={() => setWarrantyReturn({ caseId: String(item.case_id), issue: "", notes: "", identifier: "" })}>
                    پذیرش ضمانتی
                  </button>
                ) : <small>—</small>}
              </td>
            </tr>
          ))}
        </ResponsiveTable>
      </section>}
      {data.warrantyEnabled && warrantyReturn.caseId && (
        <section className="v2-card-form">
          <div className="v2-panel-title"><div><ShieldCheck /><span><strong>ثبت مراجعه ضمانتی مرتبط</strong><small>پرونده جدید به پرونده تحویل‌شده اصلی متصل می‌شود.</small></span></div></div>
          <form className="v2-grid-form" onSubmit={(event) => {
            event.preventDefault();
            void run(() => deliveryV2Action({
              action: "warranty_case",
              originalCaseId: Number(warrantyReturn.caseId),
              declaredIssue: warrantyReturn.issue.trim(),
              observedIdentifier: warrantyReturn.identifier,
              notes: warrantyReturn.notes.trim(),
              appearanceStates: [],
              idempotencyKey: `warranty:${warrantyReturn.caseId}:${crypto.randomUUID()}`,
            }), "پرونده مراجعه ضمانتی ایجاد شد.");
          }}>
            <label className="grow"><span>سریال / IMEI مشاهده‌شده روی دستگاه مراجعه‌کننده *</span><input required dir="ltr" value={warrantyReturn.identifier} onChange={(e) => setWarrantyReturn({...warrantyReturn, identifier: e.target.value})}/></label>
            <label className="grow"><span>شرح ایراد ضمانتی *</span><textarea rows={3} value={warrantyReturn.issue} onChange={(event) => setWarrantyReturn({ ...warrantyReturn, issue: event.target.value })} /></label>
            <label className="grow"><span>یادداشت داخلی</span><input value={warrantyReturn.notes} onChange={(event) => setWarrantyReturn({ ...warrantyReturn, notes: event.target.value })} /></label>
            <button disabled={busy || !warrantyReturn.issue.trim() || !warrantyReturn.identifier.trim()}>ایجاد پرونده ضمانتی</button>
            <button type="button" className="v2-mini-action" onClick={() => setWarrantyReturn({ caseId: "", issue: "", notes: "", identifier: "" })}>انصراف</button>
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
