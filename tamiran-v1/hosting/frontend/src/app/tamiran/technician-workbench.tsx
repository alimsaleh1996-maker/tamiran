"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  writeTechnicalLocation,
} from "./technician-navigation";
import "./technician-workspace.css";
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
  const open = (id: number) => {
    const item = cases.find((entry) => entry.id === id);
    const overview = !item || item.receiptPending || ["assigned", "reception", "awaiting_assignment"].includes(item.status);
    writeTechnicalLocation(id, overview ? "overview" : "work");
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
        open(handover.case_id);
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
  const groups = [
    { key: "all", label: "همه" },
    { key: "action_required", label: "در دست اقدام" },
    { key: "waiting", label: "منتظر" },
    { key: "completed", label: "پایان‌یافته" },
  ];
  const visible = cases.filter(
    (c) => group === "all" || c.technicianView.group === group,
  ).sort((a, b) => b.technicianView.priority - a.technicianView.priority ||
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
    <div className="technical-desk" dir="rtl">
      {selectedId ? (
        <>
          <TechnicalCaseWorkspace
            key={`${profile.actorId}:${selectedId}`}
            caseId={selectedId}
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
              <h2 ref={heading} tabIndex={-1}>
                دستگاه‌های من
              </h2>
              <p>دستگاه را انتخاب کنید و کار را ادامه دهید.</p>
            </div>
            <button
              disabled={loading || busy}
              onClick={() => void reload().catch(() => {})}
            >
              تازه‌سازی
            </button>
          </header>
          {error && (
            <p role="alert" className="tech-error">
              {error}
            </p>
          )}
          {!!incoming.length && (
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
          <label className="tech-search">
            جستجوی دستگاه
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="شماره پرونده، مدل یا سریال"
            />
          </label>
          <nav className="tech-list-filters" aria-label="فیلتر دستگاه‌ها">
            {groups.map((g) => (
              <button
                key={g.key}
                aria-pressed={group === g.key}
                onClick={() => setGroup(g.key)}
              >
                {g.label}{" "}
                <span>
                  {(g.key === "all"
                    ? cases.length
                    : cases.filter((c) => c.technicianView.group === g.key)
                        .length
                  ).toLocaleString("fa-IR")}
                </span>
              </button>
            ))}
          </nav>
          {loading && !cases.length ? (
            <p role="status">در حال دریافت دستگاه‌ها…</p>
          ) : (
            <ul className="tech-device-list">
              {visible.map((c) => (
                <li key={c.id}>
                  <button
                    disabled={busy || loading}
                    onClick={() => open(c.id)}
                    aria-label={`بازکردن پرونده ${c.receiptNumber}`}
                  >
                    <div className="tech-card-badges">
                      <span>{c.technicianView.flags.includes("qc_rework") ? "بازکاری QC" : c.priority === "critical" ? "بسیار فوری" : c.technicianView.flags.includes("sla_overdue") ? "موعد گذشته" : c.priority === "urgent" ? "فوری" : "عادی"}</span>
                      <span>{c.technicianView.statusLabel}</span>
                    </div>
                    <strong>{c.deviceTitle}</strong>
                    <div className="tech-card-reference"><bdi>{c.receiptNumber}</bdi><span>{c.customerName}</span></div>
                    <p>{c.declaredIssue}</p>
                    <div className="tech-card-timing">
                      <span>موعد: {c.promisedAt && Number.isFinite(fromServer(c.promisedAt).getTime()) ? day.format(fromServer(c.promisedAt)) : "تعیین نشده"}</span>
                      {c.waitStartedAt && <span>انتظار: {waitLabel(c.waitStartedAt)}</span>}
                    </div>
                    <span className="tech-card-next">{c.technicianView.primaryAction?.label ?? "مشاهده پرونده"} ←</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && !visible.length && (
            <p className="tech-hint">دستگاهی در این فهرست نیست.</p>
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
          <h2 id="tech-handover-title" tabIndex={-1}>رسید ارجاع دستگاه</h2>
          <HandoverSummary details={review.details} itemCheck={itemCheck} />
          {reviewError && <p className="tech-error" role="alert">{reviewError}</p>}
          {review.details.discrepancy && <p role="status">
            {review.details.discrepancy.resolvedAt ? `نتیجهٔ بررسی مدیر: ${review.details.discrepancy.resolution}` : `مغایرت در انتظار بررسی مدیر: ${review.details.discrepancy.reason}`}
          </p>}
          {confirming && (
            reporting ? <form onSubmit={(event) => { event.preventDefault(); void decide("report_discrepancy"); }}>
              <label>شرح مغایرت<textarea required maxLength={1000} value={discrepancyReason}
                onChange={(event) => setDiscrepancyReason(event.target.value)} /></label>
              <button type="submit" disabled={busy || !discrepancyReason.trim()}>ثبت مغایرت</button>
            </form> : <div className="tech-handover-actions">
              <button type="button" disabled={busy || checked.length !== checklist.length} onClick={() => void decide("accept")}>تأیید دریافت و انتقال مسئولیت</button>
              <button type="button" disabled={busy} onClick={() => setReporting(true)}>گزارش مغایرت</button>
            </div>
          )}
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>بستن رسید</button>
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
    <p>{receipt.deviceTitle} · <bdi>{receipt.receiptNumber}</bdi>{receipt.identifier && <> · <bdi>{receipt.identifier}</bdi></>}</p>
    <p>{receipt.fromName} ← {receipt.toName}</p>
    <p>{receipt.reason}</p>
    <p><strong>لوازم همراه</strong> {receipt.accessories.length ? receipt.accessories.join("، ") : "موردی ثبت نشده"}</p>
    {itemCheck("device", "دستگاه و لوازم همراه را تحویل گرفتم")}
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
  return <section>
    <h3>{title}</h3>
    {rows.length ? <>{policy && <p>{policy}</p>}<ul>{rows.map((item) => <li key={item.publicId}>
      {item.title} · {item.quantity.toLocaleString("fa-IR")} عدد · {statuses[item.status] ?? "در حال پیگیری"}
      {itemCheck(item.publicId, `تطبیق ${item.title}`)}
    </li>)}</ul></> : <p>موردی ندارد.</p>}
  </section>;
}
