"use client";
import { MoneyInput, formatToman } from "./money-input";
import { CaseStageBoard, CaseActionDialog } from "./case-stage-board";
import { CaseToolsDisclosure } from "./case-tools";
import "./iteration-six.css";

import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  LoaderCircle,
  PackageOpen,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceProfile } from "./access";
import { FollowUpApiError } from "./followups-api";
import type { RepairCaseRecord, RepairCaseStatus } from "./operations";
import {
  createV2Estimate,
  loadV2Inventory,
  loadV2Workflow,
  sendV2Estimate,
  transitionV2Case,
  workflowV2Action,
  type V2Case,
  type V2InventoryPayload,
} from "./v2-api";

const flagLabels: Record<string, string> = {
  warranty: "گارانتی",
  qc_rework: "بازکاری QC",
  sla_overdue: "SLA گذشته",
  waiting_part: "منتظر قطعه",
};
const partStatusLabels: Record<string, string> = {
  pending:"منتظر انبار", reserved:"رزرو شده", partially_delivered:"تحویل ناقص",
  needs_supply:"نیازمند خرید", delivered:"تحویل به تکنسین", consumed:"مصرف‌شده",
  returned:"مرجوع‌شده", rejected:"ردشده", cancelled:"لغوشده",
};
const dataHandlingLabels: Record<V2Case["dataHandling"], { title: string; detail: string }> = {
  no_erasure: {
    title: "نیازی به پاک‌کردن اطلاعات نیست",
    detail: "تعمیر بدون حذف داده انجام شود.",
  },
  coordinate_first: {
    title: "قبل از پاک‌کردن هماهنگ شود",
    detail: "تکنسین بدون تأیید بعدی مشتری مجاز به حذف داده نیست.",
  },
  erase_authorized: {
    title: "مشتری اجازه پاک‌کردن می‌دهد",
    detail: "فقط در صورت ضرورت فنی و در محدوده خدمت.",
  },
};
const localDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(
        new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z")),
      )
    : "—";
const errorText = (error: unknown) =>
  error instanceof FollowUpApiError
    ? `${error.message}${error.trackingCode ? ` · کد ${error.trackingCode}` : ""}`
    : error instanceof Error
      ? error.message
      : "عملیات انجام نشد؛ دوباره تلاش کنید.";

export function TechnicianWorkbench({
  profile,
  legacyCases,
  onUpdateRepairCase,
  onRefreshOperations,
  onNavigate,
  notify,
}: {
  profile: WorkspaceProfile;
  legacyCases: RepairCaseRecord[];
  onUpdateRepairCase: (input: {
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
  onRefreshOperations: () => Promise<void>;
  onNavigate: (page: string) => void;
  notify: (message: string) => void;
}) {
  const [cases, setCases] = useState<V2Case[]>([]);
  const [inventory, setInventory] = useState<V2InventoryPayload | null>(null);
  const [query, setQuery] = useState("");
  const [serverQuery, setServerQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => {
    const value=Number(window.sessionStorage.getItem("tamiran:focused-tech-case")??0);
    window.sessionStorage.removeItem("tamiran:focused-tech-case");return Number.isSafeInteger(value)&&value>0?value:0;
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [estimateAmount, setEstimateAmount] = useState("");
  const [manualPart, setManualPart] = useState({
    title: "",
    quantity: "1",
    purchase: "",
    sale: "",
  });
  const scanInput = useRef<HTMLInputElement>(null);
  const draftCase = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setServerQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await loadV2Workflow(undefined, serverQuery);
      await onRefreshOperations();
      setCases(payload.cases);
      if (serverQuery && payload.cases.length === 0)
        setError("پرونده‌ای با دسترسی مجاز برای شما پیدا نشد.");
      if (profile.inventoryMode && profile.inventoryMode !== "off") {
        try {
          setInventory(await loadV2Inventory());
        } catch {
          setInventory(null);
        }
      } else setInventory(null);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [profile.inventoryMode, serverQuery, onRefreshOperations]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = cases.find(item => item.id === selectedId) ?? null;
  const closeCase = () => {
    if (selected) window.localStorage.setItem(`tamiran-tech-draft:${selected.publicId}`,draft);
    setSelectedId(0);
  };
  const legacy = selected
    ? legacyCases.find((item) => item.receiptNumber === selected.receiptNumber)
    : undefined;
  const partRequests = selected
    ? (inventory?.requests ?? []).filter((item) => item.case_id === selected.id)
    : [];

  useEffect(() => {
    if (!selected) {
      draftCase.current = null;
      setDraft("");
      return;
    }
    // A server refresh of the same case must not replace unsaved editor text.
    if (draftCase.current === selected.publicId) return;
    draftCase.current = selected.publicId;
    const stored = window.localStorage.getItem(
      `tamiran-tech-draft:${selected.publicId}`,
    );
    setDraft(stored ?? legacy?.operationReport ?? "");
    setEstimateAmount("");
  }, [legacy?.operationReport, selected?.publicId]);
  useEffect(() => {
    if (!selected) return;
    const timer = window.setTimeout(
      () =>
        window.localStorage.setItem(
          `tamiran-tech-draft:${selected.publicId}`,
          draft,
        ),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [draft, selected?.publicId]);

  const runPrimary = async () => {
    if (!selected?.technicianView.primaryAction || busy) return;
    const action = selected.technicianView.primaryAction;
    setBusy(true);
    setError("");
    try {
      if (["record_diagnosis", "complete_repair"].includes(action.key)) {
        if (!draft.trim()) throw new Error("گزارش فنی این مرحله را ثبت کنید.");
        await onUpdateRepairCase({
          id: selected.id,
          operationReport: draft.trim(),
          ...(action.key === "complete_repair" ? { result: "repaired" } : {}),
        });
      }
      if (action.key === "create_estimate") {
        if (!draft.trim() || Number(estimateAmount) < 1)
          throw new Error("نتیجه بررسی و مبلغ برآورد را کامل کنید.");
        await onUpdateRepairCase({
          id: selected.id,
          operationReport: draft.trim(),
        });
        const result = await createV2Estimate({
          caseId: selected.id,
          items: [
            {
              type: "labor",
              title: "خدمت تعمیر",
              quantity: 1,
              unitPrice: Number(estimateAmount),
              discountAmount: 0,
              taxRate: 0,
            },
          ],
          reason: "برآورد ثبت‌شده از میز کار تکنسین",
        });
        if (
          result.estimate.publicId &&
          result.estimate.requiresCustomerApproval
        )
          await sendV2Estimate(result.estimate.publicId);
        await transitionV2Case(
          selected.id,
          result.estimate.requiresCustomerApproval
            ? "awaiting_customer_approval"
            : "repairing",
          selected.lockVersion,
          "ثبت و ارسال برآورد فنی",
        );
        notify(
          result.estimate.requiresCustomerApproval
            ? "برآورد ثبت شد و برای تأیید مشتری ارسال شد."
            : "برآورد زیر سقف پذیرش تأیید و پرونده وارد تعمیر شد.",
        );
      } else if (action.target) {
        await transitionV2Case(
          selected.id,
          action.target,
          selected.lockVersion,
          draft.trim() || `اقدام ${action.label}`,
        );
        notify(`${action.label} با موفقیت ثبت شد.`);
      } else if (action.key === "close_parts") {
        window.sessionStorage.setItem("tamiran:part-request-case", String(selected.id));
        onNavigate("درخواست‌های قطعه");
      }
      window.localStorage.removeItem(`tamiran-tech-draft:${selected.publicId}`);
      await reload();
      setSelectedId(0);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const openCase = (item: V2Case) => { if (!busy) {setError("");setSelectedId(item.id);} };
  const scan = async (file: File | undefined) => {
    if (!file) return;
    try {
      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (input: { formats: string[] }) => {
            detect: (
              source: ImageBitmap,
            ) => Promise<Array<{ rawValue: string }>>;
          };
        }
      ).BarcodeDetector;
      if (!Detector)
        throw new Error(
          "مرورگر فعلی اسکن QR را پشتیبانی نمی‌کند؛ شماره رسید را در جستجو وارد کنید.",
        );
      const bitmap = await createImageBitmap(file);
      const codes = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
      const value = codes[0]?.rawValue ?? "";
      const receipt = value.match(/[A-Za-z0-9]+-\d{4,}/)?.[0] ?? value.trim();
      if (!receipt) throw new Error("QR معتبر پرونده تشخیص داده نشد.");
      setQuery(receipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "اسکن رسید انجام نشد.");
    } finally {
      if (scanInput.current) scanInput.current.value = "";
    }
  };

  const addManualPart = async () => {
    if (!selected || busy) return;
    if (!manualPart.title.trim() || Number(manualPart.quantity) <= 0 || Number(manualPart.sale) < 1) {
      setError("نام، تعداد و قیمت فروش قطعه را کامل کنید.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await workflowV2Action({
        action: "manual_part_add",
        caseId: selected.id,
        title: manualPart.title.trim(),
        quantity: Number(manualPart.quantity),
        purchaseUnitCost: Number(manualPart.purchase || 0),
        saleUnitPrice: Number(manualPart.sale),
        idempotencyKey:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `manual-part-${selected.id}-${Date.now()}`,
      });
      setManualPart({ title: "", quantity: "1", purchase: "", sale: "" });
      notify("قطعه یک‌بار ثبت شد و در پیش‌فاکتور مالی همین پرونده قرار گرفت.");
      await reload();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="technician-workbench-v4">
      <header className="tech-workbench-head">
        <div>
          <span>میز کار روزانه</span>
          <h2>دستگاه‌های من</h2>
          <p>
            مرحله را انتخاب کنید و کارت دستگاه را باز کنید.
          </p>
        </div>
        <div>
          <input
            ref={scanInput}
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => void scan(event.target.files?.[0])}
          />
          <button
            type="button"
            className="outline-action"
            onClick={() => scanInput.current?.click()}
          >
            <QrCode size={17} />
            اسکن رسید
          </button>
          <button
            type="button"
            className="outline-action"
            onClick={() => void reload()}
          >
            <RefreshCw size={17} className={loading ? "is-spinning" : ""} />
            تازه‌سازی
          </button>
        </div>
      </header>
      {error && !selected && (
        <div className="form-error-summary" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>اقدام انجام نشد</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
      <label className="tech-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="شماره پرونده، موبایل، سریال، مدل یا نام مشتری"
        />
      </label>
      {loading && cases.length===0 ? <p role="status">در حال دریافت دستگاه‌ها…</p> :
        <CaseStageBoard cases={cases} busy={busy||loading} openCaseId={selectedId} onOpen={openCase}/>
      }
      {selected && <CaseActionDialog title={selected.deviceTitle} receipt={selected.receiptNumber} busy={busy} onClose={closeCase}>
        <section className="tech-case-detail">
          {error && <div role="alert" className="form-error-summary">{error}</div>}
                <div className="tech-current-action">
                  <span>
                    <Wrench size={22} />
                  </span>
                  <div>
                    <small>مرحله فعلی</small>
                    <strong>{selected.technicianView.statusLabel}</strong>
                    <p>
                      {selected.technicianView.primaryAction
                        ? `اقدام لازم: ${selected.technicianView.primaryAction.label}`
                        : "در حال حاضر اقدامی از طرف شما لازم نیست."}
                    </p>
                  </div>
                </div>
                <details className="tech-case-information"><summary><FileSearch size={17}/> مشخصات دستگاه، وضعیت ظاهری و لوازم</summary>
                <section className="tech-detail-section">
                  <header>
                    <h3>دستگاه و ایراد</h3>
                    <span dir="ltr">{selected.receiptNumber}</span>
                  </header>
                  <div className="tech-device-facts">
                    <div>
                      <small>دستگاه</small>
                      <strong>{selected.deviceTitle}</strong>
                    </div>
                    <div>
                      <small>IMEI / Serial</small>
                      <strong dir="ltr">
                        {selected.identifier || "ثبت نشده"}
                      </strong>
                    </div>
                    <div>
                      <small>پذیرش</small>
                      <strong>{localDate(selected.acceptedAt)}</strong>
                    </div>
                    <div>
                      <small>موعد</small>
                      <strong>{localDate(selected.promisedAt)}</strong>
                    </div>
                  </div>
                  <div className="tech-issue">
                    <strong>ایراد اعلامی</strong>
                    <p>{selected.declaredIssue}</p>
                  </div>
                  <div className="tech-data-policy">
                    <ShieldCheck size={18} />
                    <span>
                      <small>مجوز حذف اطلاعات دستگاه</small>
                      <strong>{dataHandlingLabels[selected.dataHandling].title}</strong>
                      <p>{dataHandlingLabels[selected.dataHandling].detail}</p>
                    </span>
                  </div>
                  {legacy && (
                    <details>
                      <summary>وضعیت ظاهری و لوازم همراه</summary>
                      <p>
                        <b>وضعیت ظاهری:</b>{" "}
                        {legacy.appearanceStates.join("، ") || "ثبت نشده"}
                      </p>
                      <p>
                        <b>لوازم:</b>{" "}
                        {legacy.accessories.join("، ") || "بدون لوازم"}
                      </p>
                    </details>
                  )}
                </section>
                </details>
                {selected.isLocked && (
                  <div className="tech-locked-note">
                    <ShieldCheck size={18} />
                    <span><strong>پرونده مختومه است</strong><small>فرم قطعه و اقدام عملیاتی برای پرونده قفل‌شده نمایش داده نمی‌شود.</small></span>
                  </div>
                )}
                {selected.technicianView.primaryAction && ["record_diagnosis","create_estimate","complete_repair"].includes(selected.technicianView.primaryAction.key) && (
                  <section className="tech-detail-section tech-action-form">
                    <header>
                      <h3>اقدام فعلی</h3>
                      <span>ذخیره خودکار پیش‌نویس</span>
                    </header>
                    <label>
                      <span>
                        {selected.technicianView.primaryAction.key ===
                        "create_estimate"
                          ? "نتیجه عیب‌یابی"
                          : "گزارش فنی"}
                      </span>
                      <textarea
                        rows={4}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="نتیجه بررسی و اقدام انجام‌شده را ثبت کنید..."
                      />
                    </label>
                    {selected.technicianView.primaryAction.key ===
                      "create_estimate" && (
                      <div className="tech-estimate-card"><p>سقف تأییدشده در پذیرش: <strong>{formatToman(selected.preapprovedAmount)} تومان</strong></p><label><span>مبلغ نهایی پیشنهادی تعمیر (تومان)</span><MoneyInput value={estimateAmount} onChange={setEstimateAmount}/></label><small>برآورد بالاتر از سقف پذیرش برای تأیید مشتری ارسال می‌شود.</small></div>
                    )}
                    <small>
                      <Save size={14} />
                      متن این بخش به‌صورت محلی ذخیره می‌شود و با Refresh از بین
                      نمی‌رود.
                    </small>
                  </section>
                )}
                {!selected.isLocked && (<details className="case-secondary-section"><summary>قطعات و درخواست قطعه</summary>
                <section className="tech-detail-section">
                  <header>
                    <h3>{inventory ? "قطعات این پرونده" : "قطعات مصرف‌شده"}</h3>
                    {inventory && (
                      <button
                        type="button"
                        onClick={() => {window.sessionStorage.setItem("tamiran:part-request-case",String(selected.id));onNavigate("درخواست‌های قطعه");}}
                      >
                        <PackageOpen size={15} />
                        درخواست قطعه
                      </button>
                    )}
                  </header>
                  {inventory ? (
                    <div className="tech-part-list">
                      {partRequests.map((item) => (
                        <div key={item.id}>
                          <strong>{item.item_title}</strong>
                          <span>{item.quantity} عدد</span>
                          <em>{partStatusLabels[item.status] ?? item.status}</em>
                        </div>
                      ))}
                      {!partRequests.length && (
                        <p>درخواست قطعه‌ای ثبت نشده است.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="tech-part-list">
                        {(selected.manualParts ?? []).map((item) => (
                          <div key={item.publicId}>
                            <strong>{item.title}</strong>
                            <span>{item.quantity} عدد</span>
                            <em>{item.saleUnitPrice.toLocaleString("fa-IR")} ریال</em>
                          </div>
                        ))}
                        {!(selected.manualParts ?? []).length && <p>قطعه مصرفی ثبت نشده است.</p>}
                      </div>
                      <div className="v2-grid-form">
                        <label><span>نام قطعه</span><input value={manualPart.title} onChange={(event) => setManualPart({ ...manualPart, title: event.target.value })} /></label>
                        <label><span>تعداد</span><input inputMode="decimal" value={manualPart.quantity} onChange={(event) => setManualPart({ ...manualPart, quantity: event.target.value })} /></label>
                        <label><span>قیمت خرید (اختیاری)</span><input inputMode="numeric" value={manualPart.purchase} onChange={(event) => setManualPart({ ...manualPart, purchase: event.target.value.replace(/\D/g, "") })} /></label>
                        <label><span>قیمت فروش</span><input inputMode="numeric" value={manualPart.sale} onChange={(event) => setManualPart({ ...manualPart, sale: event.target.value.replace(/\D/g, "") })} /></label>
                        <button type="button" disabled={busy || !manualPart.title.trim() || Number(manualPart.sale) < 1} onClick={() => void addManualPart()}>
                          <PackageOpen size={15} /> ثبت قطعه مصرفی
                        </button>
                      </div>
                    </div>
                  )}
                </section></details>
                )}
                <CaseToolsDisclosure key={selected.id} caseId={selected.id} locked={selected.isLocked} notify={notify}/>
                {selected.technicianView.primaryAction && (
                  <div className="tech-sticky-action">
                    <button
                      type="button"
                      className="primary-action"
                      disabled={busy}
                      onClick={() => void runPrimary()}
                    >
                      {busy ? (
                        <LoaderCircle className="is-spinning" size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      {busy
                        ? "در حال ثبت..."
                        : selected.technicianView.primaryAction.label}
                    </button>
                  </div>
                )}

        </section>
      </CaseActionDialog>}

    </div>
  );
}
