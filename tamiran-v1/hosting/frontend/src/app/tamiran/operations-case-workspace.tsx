import { useEffect, useRef, useState } from "react";
import type { WorkspaceProfile } from "./access";
import { TechnicalCaseWorkspace } from "./technical-case-workspace";
import { RepairDeadlinePicker, repairDeadline } from "./repair-deadline-picker";
import { MoneyInput, formatToman } from "./money-input";
import { UserRoundCheck, ArrowLeftRight } from "lucide-react";
import {
  assignV2Case,
  transitionV2Case,
  workflowV2Action,
  smsV2Action,
  type V2Case,
  type V2WorkflowPayload,
} from "./v2-api";
import "./technician-workspace.css";

type Task =
  | "case"
  | "menu"
  | "assignment"
  | "collaborator"
  | "approval"
  | "administration";
const tasks: Task[] = [
  "case",
  "menu",
  "assignment",
  "collaborator",
  "approval",
  "administration",
];
export function OperationsCaseWorkspace({
  selected,
  data,
  profile,
  busy,
  run,
  notify,
  onNavigate,
  onExit,
  onBusyChange,
  onChanged,
}: {
  selected: V2Case;
  data: V2WorkflowPayload;
  profile: WorkspaceProfile;
  busy: boolean;
  run: (job: () => Promise<unknown>, success: string) => Promise<unknown>;
  notify: (text: string) => void;
  onNavigate: (page: string) => void;
  onExit: () => void;
  onBusyChange: (busy: boolean) => void;
  onChanged: (item: V2Case) => void;
}) {
  const [task, setTask] = useState<Task>(() => {
    const value = new URL(location.href).searchParams.get("opsTask") as Task;
    return tasks.includes(value) ? value : "case";
  });
  const key = `tamiran:operations-draft:${profile.actorId}:${selected.id}`;
  const [draft, setDraft] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved)
        ? saved
        : {};
    } catch {
      return {};
    }
  });
  const [reasons, setReasons] = useState<Record<string, string>>(
    draft.reasons ?? { assignment: draft.reason ?? "" },
  );
  const reason = reasons[task] ?? "";
  const setReason = (value: string) =>
    setReasons((current) => ({ ...current, [task]: value }));
  const [technician, setTechnician] = useState<string>(draft.technician ?? "");
  const [collaborator, setCollaborator] = useState({
    technicianId: "",
    task: "",
    fixedFee: "",
    laborPercent: "0",
    partPercent: "0",
    ...draft.collaborator,
  });
  const [revisedLabor, setRevisedLabor] = useState("");
  const [priority, setPriority] = useState(selected.priority ?? "normal");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("12:00");
  const [error, setError] = useState("");
  const [otp, setOtp] = useState({ subject: "", requestId: "", code: "" });

  const lock = useRef(false),
    requestKey = useRef(draft.requestKey || crypto.randomUUID());
  const signature = useRef<string>(draft.signature ?? "");
  const requestKeyFor = (payload: unknown) => {
    const next = JSON.stringify(payload);
    if (signature.current !== next) {
      signature.current = next;
      requestKey.current = crypto.randomUUID();
    }
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          reasons,
          technician,
          collaborator,
          requestKey: requestKey.current,
          signature: signature.current,
        }),
      );
    } catch {}
    return requestKey.current;
  };
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          reasons,
          technician,
          collaborator,
          requestKey: requestKey.current,
          signature: signature.current,
        }),
      );
    } catch {
      setError("ذخیرهٔ پیش‌نویس در این مرورگر ممکن نیست.");
    }
  }, [key, reasons, technician, collaborator]);
  useEffect(() => {
    if (task !== "case") heading.current?.focus();
  }, [task]);
  useEffect(() => {
    if (task === "case") return;
    const prevent = (e: BeforeUnloadEvent) => {
      if (lock.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const guard = (e: MouseEvent) => {
      if (
        lock.current &&
        e.target instanceof Element &&
        e.target.closest("nav button,nav a,[data-tech-exit]")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const navigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    const stop = (e: Event) => {
      if (
        lock.current &&
        e.cancelable &&
        (e as Event & { navigationType?: string }).navigationType === "traverse"
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    document.addEventListener("click", guard, true);
    navigation?.addEventListener("navigate", stop);
    return () => {
      window.removeEventListener("beforeunload", prevent);
      document.removeEventListener("click", guard, true);
      navigation?.removeEventListener("navigate", stop);
    };
  }, [task]);
  const go = (next: Task) => {
    if (lock.current || busy) return;
    const url = new URL(location.href);
    if (next === "case") url.searchParams.delete("opsTask");
    else url.searchParams.set("opsTask", next);
    history.pushState({ ...history.state }, "", url);
    setTask(next);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const canAssign =
    profile.role === "repair_manager" || profile.role === "reception";
  const canDecide =
    canAssign ||
    profile.permissions.includes("estimate.record_customer_decision") ||
    profile.permissions.includes("*");
  const transitions = selected.allowedTransitions;
  const stageRun = async (job: () => Promise<unknown>, message: string) => {
    if (lock.current) return;
    lock.current = true;
    setError("");
    let completed = false;
    try {
      await run(async () => {
        try {
          const result = await job();
          completed = true;
          return result;
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "ثبت انجام نشد؛ دوباره تلاش کنید.",
          );
          throw e;
        }
      }, message);
      if (completed) {
        requestKey.current = crypto.randomUUID();
        setReason("");
        setTechnician("");
        setCollaborator({
          technicianId: "",
          task: "",
          fixedFee: "",
          laborPercent: "0",
          partPercent: "0",
        });
      }
    } finally {
      lock.current = false;
    }
    if (completed) go("case");
  };
  if (task === "case")
    return (
      <TechnicalCaseWorkspace
        key={selected.id}
        caseId={selected.id}
        initial={selected}
        actorId={profile.actorId}
        notify={notify}
        onChanged={onChanged}
        onExit={onExit}
        onBusyChange={onBusyChange}
        onNavigate={onNavigate}
        canViewFinance={
          profile.role === "repair_manager" ||
          profile.permissions.includes("finance.view") ||
          profile.permissions.includes("*")
        }
        exitLabel="بازگشت به دستگاه‌های عملیات"
        onManage={() => go("menu")}
        overviewAction={
          !selected.primaryTechnicianUserId && !selected.isLocked && canAssign
            ? { label: "تخصیص تکنسین", onClick: () => go("assignment") }
            : undefined
        }
      />
    );
  const title = {
    menu: "مدیریت پرونده",
    assignment: "تخصیص تکنسین",
    collaborator: "افزودن همکار و تعیین اجرت",
    approval: "ثبت تصمیم مشتری",
    administration: "اقدام مدیریتی",
  }[task];
  const nextModule = ["qc_pending", "qc_rework", "qc_conditional"].includes(
    selected.status,
  )
    ? "کنترل کیفیت"
    : selected.status === "finance_pending"
      ? "مالی پرونده"
      : selected.status === "ready_for_delivery"
        ? "تحویل تعمیرات"
        : null;
  return (
    <article className="tech-case operations-case" aria-busy={busy}>
      <div className="tech-page-nav">
        <button
          data-tech-exit
          disabled={busy}
          onClick={() => go(task === "menu" ? "case" : "menu")}
        >
          {task === "menu" ? "بازگشت به پرونده" : "بازگشت به مدیریت پرونده"}
        </button>
      </div>
      <header className="tech-device-summary">
        <p>
          پرونده <bdi>{selected.receiptNumber}</bdi>
        </p>
        <h2 ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <p>{selected.deviceTitle}</p>
        <p>{selected.declaredIssue}</p>
        <p>مسئول: {selected.technicianName || "تخصیص نشده"}</p>
      </header>
      {error && (
        <p role="alert" className="tech-error">
          {error}
        </p>
      )}
      {busy && <p role="status">در حال ثبت…</p>}
      {selected.isLocked && (
        <p className="tech-wait">پرونده بسته است؛ عملیات جدید مجاز نیست.</p>
      )}
      {task === "menu" && (
        <div className="tech-entry-actions">
          {!selected.isLocked && canAssign && (
            <button onClick={() => go("assignment")}>
              {selected.primaryTechnicianUserId
                ? "تغییر تکنسین مسئول"
                : "تخصیص تکنسین"}
            </button>
          )}
          {!selected.isLocked &&
            profile.role === "repair_manager" &&
            selected.primaryTechnicianUserId !== null && (
              <button onClick={() => go("collaborator")}>
                افزودن همکار و تعیین اجرت
              </button>
            )}
          {!selected.isLocked &&
            canDecide &&
            selected.status === "awaiting_customer_approval" && (
              <button onClick={() => go("approval")}>ثبت تصمیم مشتری</button>
            )}
          {!selected.isLocked && profile.role === "repair_manager" && (
            <button onClick={() => go("administration")}>اقدام مدیریتی</button>
          )}
          {nextModule && (
            <button
              onClick={() => {
                sessionStorage.setItem(
                  "tamiran:focused-module-receipt",
                  selected.receiptNumber,
                );
                onNavigate(nextModule);
              }}
            >
              رفتن به {nextModule}
            </button>
          )}
        </div>
      )}
      {task === "assignment" && !selected.isLocked && canAssign && (
        <section className="tech-task">
          <h3>
            {selected.primaryTechnicianUserId === null
              ? "تخصیص تکنسین"
              : "تغییر تکنسین مسئول"}
          </h3>
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
                      {user.display_name}{user.workload ? ` · ${user.workload.active.toLocaleString("fa-IR")} فعال، ${user.workload.awaitingReceipt.toLocaleString("fa-IR")} منتظر دریافت، ${user.workload.overdue.toLocaleString("fa-IR")} تأخیر` : ""}
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
                void stageRun(
                  () =>
                    selected.primaryTechnicianUserId
                      ? workflowV2Action({
                          action: "handover_request",
                          caseId: selected.id,
                          toUserId: Number(technician),
                          reason,
                          idempotencyKey: requestKeyFor({
                            action: "handover_request",
                            toUserId: Number(technician),
                            reason,
                          }),
                          partsDisposition: "transfer_to_new",
                          hotReturnsDisposition: "transfer_to_new",
                          toolsNote: "تحویل ابزار و لوازم طبق صورت پرونده",
                        })
                      : assignV2Case(selected.id, Number(technician), reason, {
                          idempotencyKey: requestKeyFor({
                            action: "assign",
                            technicianUserId: Number(technician),
                            reason,
                          }),
                          lockVersion: selected.lockVersion,
                        }),
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
        </section>
      )}
      {task === "collaborator" &&
        !selected.isLocked &&
        selected.primaryTechnicianUserId !== null &&
        profile.role === "repair_manager" && (
          <section className="tech-task">
            <h3>افزودن همکار و تعیین اجرت</h3>
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
                  <span>مبلغ ثابت (تومان)</span>
                  <MoneyInput
                    value={collaborator.fixedFee}
                    onChange={(fixedFee) =>
                      setCollaborator({ ...collaborator, fixedFee })
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
                    void stageRun(
                      () =>
                        workflowV2Action({
                          action: "collaborator_add",
                          caseId: selected.id,
                          technicianUserId: Number(collaborator.technicianId),
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
          </section>
        )}
      {task === "approval" &&
        canDecide &&
        !selected.isLocked &&
        selected.status === "awaiting_customer_approval" &&
        selected.latestEstimate?.status === "approved" &&
        transitions.includes("repairing") && (
          <div className="case-primary-step">
            <p>تأیید مشتری قبلاً ثبت شده است.</p>
            <button
              type="button"
              className="primary-action"
              disabled={busy}
              onClick={() =>
                void stageRun(
                  () =>
                    transitionV2Case(
                      selected.id,
                      "repairing",
                      selected.lockVersion,
                      "ورود به تعمیر با تأیید ثبت‌شده مشتری",
                    ),
                  "پرونده وارد تعمیر شد.",
                )
              }
            >
              ورود به تعمیر
            </button>
          </div>
        )}
      {task === "approval" &&
        canDecide &&
        !selected.isLocked &&
        ["awaiting_customer_approval", "finance_pending", "qc_conditional"].includes(selected.status) &&
        selected.latestEstimate &&
        ["sent", "explanation_requested"].includes(
          selected.latestEstimate.status,
        ) && (
          <div className="v2-card-form">
            <strong>ثبت تصمیم مشتری درباره برآورد</strong>
            <small>
              مبلغ برآورد:{" "}
              {formatToman(selected.latestEstimate.totalAmount) + " تومان"}
            </small>
            {data.operationsPolicy.approval !== "sms" && <>
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
                disabled={busy}
                onClick={() =>
                  void stageRun(async () => {
                    const approval = await workflowV2Action({
                      action: "estimate_decide",
                      estimatePublicId: selected.latestEstimate?.publicId,
                      decision: "approved",
                      channel: "recorded_phone",
                      reason,
                    });
                    if (transitions.includes("repairing"))
                      return transitionV2Case(
                        selected.id,
                        "repairing",
                        selected.lockVersion,
                        reason,
                      );
                    return approval;
                  }, "تأیید مشتری ثبت شد.")
                }
              >
                ثبت تأیید تلفنی مشتری و ادامه
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void stageRun(
                    () =>
                      workflowV2Action({
                        action: "estimate_decide",
                        estimatePublicId: selected.latestEstimate?.publicId,
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

            </>}
            {data.operationsPolicy.approval !== "phone" && <fieldset>
              <legend>تأیید پیامکی</legend>
              <button type="button" disabled={busy} onClick={() => void stageRun(async () => {
                const subject = selected.latestEstimate!.publicId;
                const response = await smsV2Action({ action: "otp_request", purpose: "estimate", subjectPublicId: subject });
                setOtp({ subject, requestId: String(response.requestId), code: "" });
              }, "کد تأیید به شمارهٔ مشتری ارسال شد.")}>ارسال کد به مشتری</button>
              {otp.subject === selected.latestEstimate.publicId && <>
                <label>کد تأیید مشتری<input dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={otp.code} onChange={(event) => setOtp({ ...otp, code: event.target.value })} /></label>
                <button type="button" disabled={busy || otp.code.trim().length !== 6} onClick={() => void stageRun(async () => {
                  await workflowV2Action({ action: "estimate_decide", estimatePublicId: otp.subject, decision: "approved",
                    channel: "sms_otp", otpRequestId: otp.requestId, otpCode: otp.code });
                  setOtp({ subject: "", requestId: "", code: "" });
                  if (transitions.includes("repairing")) return transitionV2Case(selected.id, "repairing", selected.lockVersion, "تأیید پیامکی مشتری");
                }, "تأیید معتبر مشتری ثبت شد.")}>بررسی کد و ادامه</button>
              </>}
            </fieldset>}
          </div>
        )}
      {task === "administration" &&
        !selected.isLocked &&
        profile.role === "repair_manager" &&
        profile.productProfile === "pro" &&
        selected.productProfile === "solo" && (
          <div className="product-preservation-note">
            <ArrowLeftRight size={19} />
            <div>
              <strong>این پرونده هنوز گردش Solo دارد</strong>
              <p>
                پرونده قدیمی بدون تغییر ادامه می‌یابد. فقط در صورت نیاز و پس از
                بررسی سازگاری، آن را جداگانه به گردش Pro منتقل کنید.
              </p>
            </div>
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() =>
                void stageRun(
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

      {task === "approval" &&
        canDecide &&
        !selected.isLocked &&
        !(
          ["awaiting_customer_approval", "finance_pending", "qc_conditional"].includes(selected.status) &&
          selected.latestEstimate &&
          ["sent", "explanation_requested", "approved"].includes(
            selected.latestEstimate.status,
          )
        ) && <p>برآوردی در انتظار تصمیم مشتری نیست.</p>}
      {task === "administration" &&
        !selected.isLocked &&
        profile.role === "repair_manager" && (
          <section className="tech-task">
            <h3>اقدام مدیریتی با ثبت علت</h3>
            <label>
              علت اقدام
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p>ثبت این اقدام در سابقهٔ پرونده باقی می‌ماند.</p>
            <label>اولویت<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
              <option value="normal">عادی</option>
              <option value="urgent">فوری</option>
              <option value="critical">بسیار فوری</option>
            </select></label>
            <RepairDeadlinePicker dateLabel="تاریخ موعد برآوردی" date={dueDate} time={dueTime}
              onChange={(date, time) => { setDueDate(date); setDueTime(time); }} />
            <button type="button" disabled={busy || !reason.trim() || (!!dueDate && !dueTime)} onClick={() => {
              let promisedAt: string | null;
              try {
                promisedAt = repairDeadline(dueDate, dueTime);
              } catch (failure) {
                if (failure instanceof Error) setError(failure.message);
                return;
              }
              const payload = { action: "manager_update_case", caseId: selected.id, priority, promisedAt, reason, lockVersion: selected.lockVersion };
              void stageRun(() => workflowV2Action({ ...payload, idempotencyKey: requestKeyFor(payload) }), "اولویت و موعد پرونده ثبت شد.");
            }}>ثبت اولویت و موعد</button>
            {["qc_pending", "qc_conditional", "finance_pending"].includes(selected.status) && <>
              <label>اصلاح اجرت پیش‌نویس<MoneyInput value={revisedLabor} onChange={setRevisedLabor} /></label>
              <button type="button" disabled={busy || !reason.trim() || revisedLabor === ""} onClick={() => {
                const payload = { action: "invoice_correct", caseId: selected.id, reason, lockVersion: selected.lockVersion, invoice: { laborAmount: Number(revisedLabor) } };
                void stageRun(() => workflowV2Action({ ...payload, idempotencyKey: requestKeyFor(payload) }), "اصلاح پیش‌نویس ثبت شد.");
              }}>ثبت اصلاح اجرت پیش‌نویس</button>
            </>}
            {transitions.includes("cancelled") && (
              <button
                disabled={busy || !reason.trim()}
                onClick={() => {
                  if (
                    window.confirm(
                      "پرونده لغو شود؟ این اقدام در سابقه ثبت می‌شود.",
                    )
                  )
                    void stageRun(
                      () =>
                        transitionV2Case(
                          selected.id,
                          "cancelled",
                          selected.lockVersion,
                          reason,
                        ),
                      "پرونده لغو شد.",
                    );
                }}
              >
                لغو پرونده
              </button>
            )}
          </section>
        )}
    </article>
  );
}
