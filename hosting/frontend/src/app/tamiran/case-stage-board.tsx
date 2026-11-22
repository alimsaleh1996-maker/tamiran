import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Smartphone, X } from "lucide-react";
import { useModalFocus } from "../shared/use-modal-focus";
import type { V2Case } from "./v2-api";
import {
  repairStages,
  stageForStatus,
  initialStageForStatuses,
} from "./workflow-stages";
import "./case-stage-board.css";

export function CaseStageBoard({
  cases,
  onOpen,
  busy,
  openCaseId = 0,
}: {
  cases: V2Case[];
  onOpen: (item: V2Case) => void;
  busy: boolean;
  openCaseId?: number;
}) {
  const [stage, setStage] = useState(() => {
    const opened = cases.find((c) => c.id === openCaseId);
    return opened
      ? stageForStatus(opened.status)
      : initialStageForStatuses(cases.map((c) => c.status));
  });
  const root = useRef<HTMLDivElement>(null),
    wasOpen = useRef(false);
  const id = useId();
  const stages = useMemo(
    () =>
      repairStages
        .map((s) => ({
          ...s,
          items: cases.filter((c) => stageForStatus(c.status) === s.id),
        }))
        .filter((s) => s.items.length || s.id === stage),
    [cases, stage],
  );
  const selected = stages.find((s) => s.id === stage)!;
  useEffect(() => {
    if (!openCaseId && wasOpen.current)
      queueMicrotask(() => {
        if (document.activeElement === document.body)
          root.current
            ?.querySelector<HTMLElement>('[aria-selected="true"]')
            ?.focus();
      });
    wasOpen.current = Boolean(openCaseId);
  }, [openCaseId]);
  return (
    <div className="case-stage-board" ref={root}>
      <div
        role="tablist"
        aria-label="مراحل دستگاه‌ها"
        className="case-stage-tabs"
      >
        {stages.map((s, index) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`${id}-${s.id}`}
            aria-selected={s.id === stage}
            aria-controls={`${id}-cards`}
            tabIndex={s.id === stage ? 0 : -1}
            onClick={() => setStage(s.id)}
            onKeyDown={(e) => {
              let next = index;
              if (e.key === "ArrowLeft") next = (index + 1) % stages.length;
              else if (e.key === "ArrowRight")
                next = (index - 1 + stages.length) % stages.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = stages.length - 1;
              else return;
              e.preventDefault();
              setStage(stages[next].id);
              root.current
                ?.querySelectorAll<HTMLElement>('[role="tab"]')
                [next]?.focus();
            }}
          >
            <span>{s.title}</span>
            <b>{s.items.length.toLocaleString("fa-IR")}</b>
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`${id}-cards`}
        aria-labelledby={`${id}-${stage}`}
        className="case-stage-panel"
      >
        <p className="case-stage-instruction">
          کارت دستگاه را برای مشاهده و ثبت اقدام باز کنید.
        </p>
        <div className="case-stage-cards">
          {selected.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="case-device-card"
              disabled={busy}
              onClick={() => onOpen(item)}
              aria-label={`بازکردن پرونده ${item.receiptNumber}`}
            >
              <div className="case-device-heading">
                <Smartphone size={23} />
                <strong>{item.deviceTitle}</strong>
              </div>
              <div className="case-device-reference">
                <bdi>{item.receiptNumber}</bdi>
                <span>{item.customerName}</span>
              </div>
              <p>{item.declaredIssue}</p>
              <div className="case-device-footer">
                <span>{item.technicianView.statusLabel}</span>
                <span>
                  بازکردن <ChevronLeft size={16} />
                </span>
              </div>
            </button>
          ))}
        </div>
        {!selected.items.length && (
          <p className="case-stage-empty">در این مرحله دستگاهی نیست.</p>
        )}
      </section>
    </div>
  );
}
export function CaseActionDialog({
  title,
  receipt,
  onClose,
  busy,
  children,
}: {
  title: string;
  receipt: string;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = () => {
    if (!busy) onClose();
  };
  const modalId = useModalFocus(ref, true, close);
  return createPortal(
    <div className="case-action-overlay">
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${modalId}-title`}
        data-modal-id={modalId}
        className="case-action-dialog"
      >
        <header className="case-action-heading">
          <div>
            <h2 id={`${modalId}-title`}>{title}</h2>
            <p>
              پرونده <bdi>{receipt}</bdi>
            </p>
          </div>
          <button
            type="button"
            aria-label="بستن پرونده"
            disabled={busy}
            onClick={close}
          >
            <X size={22} />
          </button>
        </header>
        <div className="case-action-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
