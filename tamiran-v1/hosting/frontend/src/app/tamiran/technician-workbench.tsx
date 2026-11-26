"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, Smartphone, X } from "lucide-react";
import type { WorkspaceProfile } from "./access";
import type { RepairCaseRecord, RepairCaseStatus } from "./operations";
import {
  handoverDiscrepancy,
  handoverNeedsApproval,
  loadV2HandoverReceipt,
  loadV2Workflow,
  workflowV2Action,
  type V2Case,
  type V2Handover,
  type V2HandoverItem,
  type V2HandoverReceipt,
} from "./v2-api";
import { TechnicalCaseWorkspace } from "./technical-case-workspace";
import {
  technicalCaseFromLocation,
  technicalStageScreen,
  writeTechnicalLocation,
} from "./technician-navigation";
import "./technician-workspace.css";
import "./technician-v7.css";
type Props = {
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
};
export function TechnicianWorkbench({ profile, notify, onNavigate }: Props) {
  const [cases, setCases] = useState<V2Case[]>([]),
    [handovers, setHandovers] = useState<V2Handover[]>([]),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState("all"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [review, setReview] = useState<{ handover: V2Handover; details: V2HandoverReceipt } | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (review && element && !element.open) {
      element.showModal();
      element.querySelector("h2")?.focus();
    }
  }, [review]);
  const [selectedId, setSelectedId] = useState(() => {
    const focused = Number(
      sessionStorage.getItem("tamiran:focused-tech-case") ?? 0,
    );
    sessionStorage.removeItem("tamiran:focused-tech-case");
    return (
      technicalCaseFromLocation() ||
      (Number.isSafeInteger(focused) ? focused : 0)
    );
  });
  const generation = useRef(0),
    lock = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const reload = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const payload = await loadV2Workflow(undefined, query.trim());
      if (seq === generation.current) {
        setCases(payload.cases);
        setHandovers(payload.handovers);
        setError("");
      }
      return payload;
    } catch (e) {
      if (seq === generation.current)
        setError(
          e instanceof Error ? e.message : "دریافت دستگاه‌ها انجام نشد.",
        );
      throw e;
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void reload().catch(() => {}), 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [reload]);
  useEffect(() => {
    if (selectedId && !technicalCaseFromLocation())
      writeTechnicalLocation(selectedId, "overview", undefined, true);
  }, [selectedId]);
  const open = (id: number, item = cases.find((entry) => entry.id === id)) => {
    writeTechnicalLocation(id, technicalStageScreen(item));
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openReview = async (handover: V2Handover) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      setReviewError("");
      setReporting(false);
      setDiscrepancyReason("");
      setChecked([]);
      const details = await loadV2HandoverReceipt(handover.public_id);
      setReview({ handover, details });
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت رسید ارجاع انجام نشد.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const receipt = review?.details.receipt;
  const checklist = receipt ? ["device", ...[...receipt.partIssues, ...receipt.installedParts, ...receipt.hotReturns].map((item) => item.publicId)] : [];
  const confirming = review?.details.status === "requested" && (!review.details.discrepancy || !!review.details.discrepancy.resolvedAt);
  const itemCheck = (id: string, label: string) => confirming && (
    <label className="tech-handover-check">
      <input type="checkbox" checked={checked.includes(id)} onChange={(event) => {
        const enabled = event.target.checked;
        setChecked((current) => enabled ? [...current, id] : current.filter((item) => item !== id));
      }} /> {label}
    </label>
  );
  const decide = async (decision: "accept" | "report_discrepancy") => {
    if (lock.current || !review) return;
    const { handover, details } = review;
    lock.current = true;
    setBusy(true);
    setReviewError("");
    try {
      await workflowV2Action({
        action: "handover_decide",
        publicId: handover.public_id,
        decision,
        receiptRevision: details.revision,
        checkedItems: decision === "accept" ? checklist.filter((id) => checked.includes(id)) : undefined,
        reason: decision === "report_discrepancy" ? discrepancyReason.trim() : undefined,
      });
      dialog.current?.close();
      void reload().catch(() => {});
      if (decision === "accept") {
        notify("مسئولیت دستگاه دریافت شد.");
        const fresh = await loadV2Workflow(handover.case_id).catch(() => undefined);
        open(handover.case_id, fresh?.cases[0]);
      } else {
        notify("مغایرت برای بررسی مدیر ثبت شد.");
      }
    } catch (e) {
      setReviewError(
        e instanceof Error
          ? e.message
          : "ثبت تصمیم انجام نشد؛ دوباره تلاش کنید.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const incoming = handovers.filter(
    (h) => h.to_user_id === profile.actorId && h.status === "requested",
  );
  const stats = [
    { key: "receive", label: "دریافت جدید", count: cases.filter((c) => c.receiptPending).length + incoming.length },
    { key: "action_required", label: "در حال اقدام", count: cases.filter((c) => !c.receiptPending && c.technicianView.group === "action_required" && c.status !== "qc_rework").length },
    { key: "waiting", label: "در انتظار", count: cases.filter((c) => !c.receiptPending && c.technicianView.group === "waiting").length },
    { key: "rework", label: "بازکاری QC", count: cases.filter((c) => c.status === "qc_rework").length },
  ];
  const visible = cases.filter((c) => {
    if (group === "all") return c.technicianView.group !== "completed";
    if (group === "receive") return !!c.receiptPending;
    if (group === "rework") return c.status === "qc_rework";
    return !c.receiptPending && c.technicianView.group === group && (group !== "action_required" || c.status !== "qc_rework");
  }).sort((a, b) => b.technicianView.priority - a.technicianView.priority ||
    (a.promisedAt ?? "9999").localeCompare(b.promisedAt ?? "9999"));
  const numbers = new Intl.NumberFormat("fa-IR");
  const day = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "Asia/Tehran" });
  const fromServer = (value: string) => new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(" ", "T")}Z`);
  const waitLabel = (value: string) => {
    const elapsed = Math.max(0, Math.floor((Date.now() - fromServer(value).getTime()) / 60_000));
    if (!Number.isFinite(elapsed)) return "—";
    return elapsed >= 60 ? `${numbers.format(Math.floor(elapsed / 60))} ساعت` : `${numbers.format(elapsed)} دقیقه`;
  };
  return (
    <div className="technical-desk tech-v7" dir="rtl">
      {selectedId ? (
        <>
          <TechnicalCaseWorkspace
            key={`${profile.actorId}:${selectedId}`}
            caseId={selectedId}
            stageDriven
            initial={cases.find((c) => c.id === selectedId)}
            actorId={profile.actorId}
            notify={notify}
            onExit={() => {
              writeTechnicalLocation(0);
              setSelectedId(0);
              requestAnimationFrame(() => heading.current?.focus());
            }}
            onBusyChange={setBusy}
            onNavigate={onNavigate}
            canViewFinance={
              profile.role === "repair_manager" ||
              profile.permissions.includes("finance.view") ||
              profile.permissions.includes("*")
            }
            onChanged={(fresh) =>
              setCases((current) =>
                current.some((c) => c.id === fresh.id)
                  ? current.map((c) => (c.id === fresh.id ? fresh : c))
                  : [fresh, ...current],
              )
            }
          />
        </>
      ) : (
        <>
          <header className="tech-list-heading">
            <div>
              <p className="tech-v7-eyebrow">کارتابل اختصاصی</p>
              <h2 ref={heading} tabIndex={-1}>میز کار {profile.displayName}</h2>
              <p>پرونده‌های نیازمند اقدام شما</p>
            </div>
            <button type="button" disabled={loading || busy} onClick={() => void reload().catch(() => {})}>
              <RefreshCw size={16} aria-hidden="true" /> تازه‌سازی
            </button>
          </header>
          {error && <p role="alert" className="tech-error">{error}</p>}
          <nav aria-label="وضعیت پرونده‌ها" className="tech-v7-stats">
            {stats.map(({ key, label, count }) => (
              <button key={key} type="button" aria-pressed={group === key} onClick={() => setGroup(group === key ? "all" : key)}>
                <span>{label}</span><strong>{numbers.format(count)}</strong>
              </button>
            ))}
          </nav>
          {!!incoming.length && ["all", "receive"].includes(group) && (
            <section className="tech-incoming">
              <h3>ارجاع‌های منتظر دریافت</h3>
              <ul className="tech-plain-list">
                {incoming.map((h) => {
                  const discrepancy = handoverDiscrepancy(h);
                  return <li key={h.public_id}>
                    <p>
                      پرونده <bdi>{h.receipt_number}</bdi> · از{" "}
                      {h.from_user_name}
                    </p>
                    <p>{h.reason}</p>
                    {discrepancy && !discrepancy.resolvedAt && (
                      <p>مغایرت در انتظار بررسی مدیر است.</p>
                    )}
                    {handoverNeedsApproval(h) ? <p>ارجاع منتظر تأیید مدیر است.</p> : (
                    <button disabled={busy} onClick={() => void openReview(h)}>
                      بررسی رسید ارجاع
                    </button>
                    )}
                  </li>;
                })}
              </ul>
            </section>
          )}
          <div className="tech-v7-queue-head">
            <h3>صف پرونده‌ها</h3>
            <button type="button" className="tech-v7-ghost" onClick={() => { setGroup("all"); setQuery(""); }}>همه</button>
          </div>
          <div className="tech-v7-toolbar">
            <input aria-label="جستجوی دستگاه" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجوی دستگاه، مشتری یا پذیرش" />
            <select aria-label="فیلتر دستگاه‌ها" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">همهٔ پرونده‌های فعال</option>
              {stats.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
              <option value="completed">پایان‌یافته</option>
            </select>
          </div>
          {loading && !cases.length ? (
            <p role="status">در حال دریافت دستگاه‌ها…</p>
          ) : (
            <ul className="tech-device-list">
              {visible.map((c) => (
                <li key={c.id} data-rework={c.status === "qc_rework" || undefined}>
                  <button
                    disabled={busy || loading}
                    onClick={() => open(c.id)}
                    aria-label={`بازکردن پرونده ${c.receiptNumber}`}
                  >
                    <span className="tech-v7-card-top">
                      <span className="tech-v7-pill" data-priority={c.status === "qc_rework" ? "rework" : c.priority}>{c.status === "qc_rework" ? "بازکاری QC" : c.priority === "critical" ? "بسیار فوری" : c.priority === "urgent" ? "فوری" : "عادی"}</span>
                      <bdi>{c.receiptNumber}</bdi>
                    </span>
                    <span className="tech-v7-device">
                      <span className="tech-v7-glyph"><Smartphone size={22} aria-hidden="true" /></span>
                      <span><strong dir="auto">{c.deviceTitle}</strong><span>{c.customerName}</span></span>
                    </span>
                    <span className="tech-v7-card-issue">{c.declaredIssue}</span>
                    <span className="tech-v7-card-meta">
                      <span>{c.technicianName || "بدون مسئول"}{c.waitStartedAt ? ` · ${waitLabel(c.waitStartedAt)}` : ""}</span>
                      <span>{c.promisedAt && Number.isFinite(fromServer(c.promisedAt).getTime()) ? day.format(fromServer(c.promisedAt)) : "موعد تعیین نشده"}</span>
                    </span>
                    <span className="tech-v7-card-foot">
                      <span className="tech-v7-pill tech-v7-stage-pill">{c.technicianView.statusLabel}</span>
                      <span className="tech-v7-card-open">باز کردن <ArrowLeft size={15} aria-hidden="true" /></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && !visible.length && (
            <p className="tech-v7-empty">دستگاهی در این فهرست نیست.</p>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="tech-handover-dialog"
        aria-labelledby="tech-handover-title"
        onCancel={(event) => { if (lock.current) event.preventDefault(); }}
        onClose={() => setReview(null)}
      >
        {review && <>
          <header className="tech-v7-dialog-header">
            <h2 id="tech-handover-title" tabIndex={-1}>رسید ارجاع دستگاه</h2>
            <button type="button" className="tech-v7-ghost" aria-label="بستن رسید" disabled={busy} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
          </header>
          <div className="tech-v7-receipt-panel">
            <h3>رسید دریافت دستگاه ارجاعی</h3>
            <p className="tech-v7-description">تمام اقلام و تعهدات را با تحویل فیزیکی تطبیق دهید.</p>
            <HandoverSummary details={review.details} itemCheck={itemCheck} />
            {reviewError && <p className="tech-error" role="alert">{reviewError}</p>}
            {review.details.discrepancy && <p role="status">
              {review.details.discrepancy.resolvedAt ? `نتیجهٔ بررسی مدیر: ${review.details.discrepancy.resolution}` : `مغایرت در انتظار بررسی مدیر: ${review.details.discrepancy.reason}`}
            </p>}
            {confirming && (
              reporting ? <form onSubmit={(event) => { event.preventDefault(); void decide("report_discrepancy"); }}>
                <label>شرح مغایرت<textarea required maxLength={1000} value={discrepancyReason}
                  onChange={(event) => setDiscrepancyReason(event.target.value)} /></label>
                <div className="tech-v7-action-bar">
                  <button type="button" disabled={busy} onClick={() => setReporting(false)}>بازگشت</button>
                  <button className="tech-primary" type="submit" disabled={busy || !discrepancyReason.trim()}>ثبت مغایرت</button>
                </div>
              </form> : <div className="tech-v7-action-bar">
                <button className="tech-v7-danger" type="button" disabled={busy} onClick={() => setReporting(true)}>گزارش مغایرت</button>
                <button className="tech-primary" type="button" disabled={busy || checked.length !== checklist.length} onClick={() => void decide("accept")}>تأیید دریافت و انتقال مسئولیت</button>
              </div>
            )}
          </div>
        </>}
      </dialog>
    </div>
  );
}

type ItemCheck = (id: string, label: string) => React.ReactNode;

function HandoverSummary({ details, itemCheck }: { details: V2HandoverReceipt; itemCheck: ItemCheck }) {
  const { receipt } = details;
  const dispositions: Record<string, string> = {
    transfer_to_new: "انتقال به تکنسین مقصد",
    remain_with_previous: "نزد تکنسین قبلی",
    settle_before_handover: "تعیین تکلیف پیش از انتقال",
  };
  return <>
    <div className="tech-v7-callout">
      <strong>{receipt.deviceTitle}</strong> · <bdi>{receipt.receiptNumber}</bdi>
      <p>از {receipt.fromName} · {receipt.reason}</p>
    </div>
    <h4>عملیات انجام‌شده</h4>
    {receipt.activities?.length ? <ul className="tech-v7-receipt-lines">{receipt.activities.map((entry) => <li key={entry.id}>{entry.text}</li>)}</ul>
      : <p className="tech-v7-description">عملیاتی ثبت نشده است.</p>}
    <h4>اقلام تحویلی</h4>
    <div className="tech-v7-receipt-line">
      {itemCheck("device", "دستگاه و لوازم همراه را تحویل گرفتم")}
      <small>لوازم همراه · {receipt.accessories.length ? receipt.accessories.join("، ") : "موردی ثبت نشده"}</small>
    </div>
    <HandoverItems title="قطعات باز" policy={dispositions[receipt.partsDisposition]} rows={receipt.partIssues} itemCheck={itemCheck} />
    <HandoverItems title="قطعات مصرف‌شده" rows={receipt.installedParts} itemCheck={itemCheck} />
    <HandoverItems title="داغی‌های باز" policy={dispositions[receipt.hotReturnsDisposition]} rows={receipt.hotReturns} itemCheck={itemCheck} />
    {receipt.toolsNote && <p><strong>ابزار</strong> {receipt.toolsNote}</p>}
  </>;
}

function HandoverItems({ title, policy, rows, itemCheck }: { title: string; policy?: string; rows: V2HandoverItem[]; itemCheck: ItemCheck }) {
  const statuses: Record<string, string> = {
    awaiting_technician: "تحویل انبار، منتظر تأیید تکنسین",
    delivered: "تحویل‌گرفته",
    consumed: "مصرف‌شده",
    pending_return: "در انتظار عودت",
    waiting_review: "در انتظار بررسی",
    rejected: "رد شده و نیازمند پیگیری",
  };
  if (!rows.length) return null;
  return <section>
    <h4>{title}</h4>
    {rows.length ? <>{policy && <p>{policy}</p>}<ul className="tech-v7-receipt-lines">{rows.map((item) => <li key={item.publicId}>
      {item.title} · {item.quantity.toLocaleString("fa-IR")} عدد · {statuses[item.status] ?? "در حال پیگیری"}
      {itemCheck(item.publicId, `تطبیق ${item.title}`)}
    </li>)}</ul></> : <p>موردی ندارد.</p>}
  </section>;
}
