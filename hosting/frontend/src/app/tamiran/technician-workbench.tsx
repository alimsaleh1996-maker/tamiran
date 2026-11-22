"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import type { WorkspaceProfile } from "./access";
import type { RepairCaseRecord, RepairCaseStatus } from "./operations";
import { CaseStageBoard } from "./case-stage-board";
import { loadV2Workflow, type V2Case } from "./v2-api";
import { TechnicalCaseWorkspace } from "./technical-case-workspace";
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
export function TechnicianWorkbench({ profile, notify }: Props) {
  const [cases, setCases] = useState<V2Case[]>([]),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(() => {
    const id = Number(
      sessionStorage.getItem("tamiran:focused-tech-case") ??
        sessionStorage.getItem(`tamiran:technical-open:${profile.actorId}`) ??
        0,
    );
    sessionStorage.removeItem("tamiran:focused-tech-case");
    return Number.isSafeInteger(id) ? id : 0;
  });
  const generation = useRef(0),
    heading = useRef<HTMLHeadingElement>(null);
  const reload = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const data = await loadV2Workflow(undefined, query.trim());
      if (seq === generation.current) {
        setCases(data.cases);
        setError("");
      }
    } catch (e) {
      if (seq === generation.current)
        setError(
          e instanceof Error ? e.message : "دریافت دستگاه‌ها انجام نشد.",
        );
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [reload]);
  const selected = cases.find((c) => c.id === selectedId);
  return (
    <div className="technical-desk" dir="rtl">
      {selectedId ? (
        <>
          <button
            className="outline-action"
            onClick={() => {
              sessionStorage.removeItem(
                `tamiran:technical-open:${profile.actorId}`,
              );
              setSelectedId(0);
              requestAnimationFrame(() => heading.current?.focus());
            }}
          >
            <ArrowRight size={18} /> بازگشت به دستگاه‌ها
          </button>
          <TechnicalCaseWorkspace
            key={`${profile.actorId}:${selectedId}`}
            caseId={selectedId}
            initial={selected}
            actorId={profile.actorId}
            notify={notify}
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
          <header className="technical-desk-heading">
            <div>
              <p>میز کار روزانه</p>
              <h2 ref={heading} tabIndex={-1}>
                دستگاه‌های من
              </h2>
              <p>مرحله را انتخاب کنید؛ برای انجام کار، دستگاه را باز کنید.</p>
            </div>
            <button
              className="outline-action"
              disabled={loading}
              onClick={() => void reload()}
            >
              <RefreshCw size={18} /> تازه‌سازی
            </button>
          </header>
          <label className="technical-search">
            <Search size={19} />
            <span className="sr-only">جستجوی دستگاه</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="شماره رسید، مدل، سریال یا نام مشتری"
            />
          </label>
          {error && (
            <p role="alert" className="technical-error">
              {error}
            </p>
          )}
          {loading && !cases.length ? (
            <p role="status">در حال دریافت دستگاه‌ها…</p>
          ) : (
            <CaseStageBoard
              cases={cases}
              busy={loading}
              onOpen={(c) => {
                sessionStorage.setItem(
                  `tamiran:technical-open:${profile.actorId}`,
                  String(c.id),
                );
                setSelectedId(c.id);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
