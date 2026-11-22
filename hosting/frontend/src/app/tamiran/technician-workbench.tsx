"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceProfile } from "./access";
import type { RepairCaseRecord, RepairCaseStatus } from "./operations";
import {
  loadV2Workflow,
  workflowV2Action,
  type V2Case,
  type V2Handover,
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
    writeTechnicalLocation(id);
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const accept = async (h: V2Handover) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await workflowV2Action({
        action: "handover_decide",
        publicId: h.public_id,
        decision: "accept",
      });
      await reload();
      notify("مسئولیت دستگاه دریافت شد.");
      open(h.case_id);
    } catch (e) {
      try {
        const fresh = await reload();
        if (
          fresh?.cases.some(
            (c) =>
              c.id === h.case_id &&
              c.primaryTechnicianUserId === profile.actorId,
          )
        ) {
          open(h.case_id);
          return;
        }
      } catch {}
      setError(
        e instanceof Error
          ? e.message
          : "دریافت مسئولیت انجام نشد؛ دوباره تلاش کنید.",
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
  );
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
                {incoming.map((h) => (
                  <li key={h.public_id}>
                    <p>
                      پرونده <bdi>{h.receipt_number}</bdi> · از{" "}
                      {h.from_user_name}
                    </p>
                    <p>{h.reason}</p>
                    <button disabled={busy} onClick={() => void accept(h)}>
                      دریافت مسئولیت دستگاه
                    </button>
                  </li>
                ))}
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
                    <div>
                      <strong>{c.deviceTitle}</strong>
                      <bdi>{c.receiptNumber}</bdi>
                    </div>
                    <p>{c.declaredIssue}</p>
                    <span>{c.technicianView.statusLabel}</span>
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
    </div>
  );
}
