import { useEffect, useRef, useState } from "react";
import { MoneyInput, formatToman } from "./money-input";
import { moneyDigits } from "./money";
import { directAdminRequest } from "./directadmin-api";
import {
  TechnicianPartsPage,
  newManualRow,
  type ManualRow,
} from "./technician-parts-page";
import { TechnicianFilesPage } from "./technician-files-page";
import {
  readTechnicalScreen,
  writeTechnicalLocation,
  technicalScreens,
  type TechnicalScreen,
} from "./technician-navigation";
import {
  createV2Estimate,
  inventoryV2Action,
  loadTechnicalActivities,
  loadTechnicalCase,
  loadV2Inventory,
  loadV2Workflow,
  sendV2Estimate,
  workflowV2Action,
  type TechnicalProjection,
  type V2Case,
  type V2InventoryPayload,
  type V2User,
  type V2Handover,
  type TechnicalActivity,
} from "./v2-api";
const message = (e: unknown) =>
  e instanceof TypeError
    ? "ارتباط با سرور قطع شد؛ متن شما محفوظ است. دوباره تلاش کنید."
    : e instanceof Error
      ? e.message
      : "عملیات انجام نشد؛ دوباره تلاش کنید.";
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(
        new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")),
      )
    : "ثبت نشده";
const costLabels = {
  needs_estimate: "هنوز هزینه‌ای اعلام نشده است.",
  waiting_customer: "منتظر تأیید هزینه توسط مشتری",
  approved: "هزینه در محدودهٔ مجوز معتبر است.",
  rejected: "مشتری برآورد را رد کرده است.",
  needs_revision: "هزینه تغییر کرده؛ برآورد تازه لازم است.",
};
const titles: Record<TechnicalScreen, string> = {
  overview: "پرونده دستگاه",
  work: "میز کار دستگاه",
  parts: "قطعات",
  estimate: "اعلام هزینه",
  photos: "تصاویر و فایل‌ها",
  refer: "ارجاع به تکنسین دیگر",
  repaired: "پایان تعمیر",
  unrepaired: "عدم امکان تعمیر",
  finance: "پیگیری مالی",
};
const blank = () => ({
  version: 2,
  description: "",
  attachments: [] as string[],
  correctionOf: null as number | null,
  labor: "",
  diagnostic: "",
  estimateNote: "",
  report: "",
  reason: "",
  referTo: "",
  referReason: "",
  stockId: "",
  stockQuantity: "1",
  manualRows: [newManualRow()],
});
type Draft = ReturnType<typeof blank>;
export function TechnicalCaseWorkspace({
  caseId,
  initial,
  actorId,
  notify,
  onChanged,
  onExit,
  onBusyChange,
  onNavigate,
  canViewFinance = false,
}: {
  caseId: number;
  initial?: V2Case;
  actorId: number;
  notify: (text: string) => void;
  onChanged: (item: V2Case) => void;
  onExit: () => void;
  onBusyChange: (busy: boolean) => void;
  onNavigate: (page: string) => void;
  canViewFinance?: boolean;
}) {
  const storage = `tamiran:technical-draft:${actorId}:${caseId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const old = JSON.parse(localStorage.getItem(storage) ?? "{}").draft ?? {};
      return {
        ...blank(),
        ...old,
        ...(old.version !== 2
          ? {
              description: [old.title, old.description, old.observation]
                .filter(Boolean)
                .join("\n"),
              manualRows: old.partTitle
                ? [
                    {
                      ...newManualRow(),
                      title: old.partTitle,
                      quantity: old.quantity ?? "1",
                      purchase: old.purchase ?? "",
                      sale: old.sale ?? "",
                      note: old.partNote ?? "",
                    },
                  ]
                : [newManualRow()],
            }
          : {}),
      };
    } catch {
      return blank();
    }
  });
  const keys = useRef<Record<string, { signature: string; key: string }>>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(storage) ?? "{}").keys ?? {};
      } catch {
        return {};
      }
    })(),
  );
  const [screen, setScreen] = useState<TechnicalScreen>(readTechnicalScreen),
    [returnTo, setReturnTo] = useState<TechnicalScreen>(() => {
      const back = new URL(location.href).searchParams.get("techReturn");
      return technicalScreens.includes(back as TechnicalScreen)
        ? (back as TechnicalScreen)
        : "work";
    });
  const [item, setItem] = useState(initial),
    [data, setData] = useState<TechnicalProjection | null>(null),
    [users, setUsers] = useState<V2User[]>([]),
    [handovers, setHandovers] = useState<V2Handover[]>([]),
    [inventory, setInventory] = useState<V2InventoryPayload | null>(null),
    [stockError, setStockError] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState<{ area: string; text: string } | null>(null),
    [saved, setSaved] = useState(""),
    [source, setSource] = useState<"manual" | "stock">("manual"),
    [confirmed, setConfirmed] = useState(false);
  const lockedUrl = useRef(location.href);
  const lock = useRef(false),
    alive = useRef(true),
    heading = useRef<HTMLHeadingElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    draftNow = useRef(draft);
  const unstarted = item
    ? ["assigned", "reception", "awaiting_assignment"].includes(item.status)
    : true;
  const home: TechnicalScreen = unstarted ? "overview" : "work";
  const persist = (next: Draft) => {
    try {
      localStorage.setItem(
        storage,
        JSON.stringify({ draft: next, keys: keys.current }),
      );
    } catch {
      setSaved(
        "ذخیرهٔ پیش‌نویس در این مرورگر ممکن نیست؛ پیش از خروج گزارش را ثبت کنید.",
      );
    }
  };
  const change = (patch: Partial<Draft>) => {
    const next = { ...draftNow.current, ...patch };
    draftNow.current = next;
    persist(next);
    setDraft(next);
  };
  const keyFor = (area: string, payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (keys.current[area]?.signature !== signature)
      keys.current[area] = { signature, key: crypto.randomUUID() };
    persist(draftNow.current);
    return keys.current[area].key;
  };
  const go = (next: TechnicalScreen, back: TechnicalScreen = home) => {
    if (lock.current) return;
    setError(null);
    setConfirmed(false);
    setReturnTo(back);
    setScreen(next);
    writeTechnicalLocation(
      caseId,
      next,
      next === "overview" || next === "work" ? undefined : back,
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const reload = async () => {
    const [workflow, projection] = await Promise.all([
      loadV2Workflow(caseId),
      loadTechnicalCase(caseId),
    ]);
    const fresh = workflow.cases.find((c) => c.id === caseId);
    if (!fresh) throw new Error("پرونده در دسترسی فعلی شما نیست.");
    if (!alive.current) return;
    setItem(fresh);
    setData(projection);
    setUsers(workflow.users);
    setHandovers(workflow.handovers.filter((h) => h.case_id === caseId));
    onChanged(fresh);
  };
  const loadStock = async () => {
    setStockError("");
    try {
      const stock = await loadV2Inventory(caseId);
      if (alive.current) setInventory(stock);
    } catch (e) {
      if (alive.current) setStockError(message(e));
    }
  };
  useEffect(() => {
    alive.current = true;
    void reload().catch((e) => {
      if (alive.current) setError({ area: "page", text: message(e) });
    });
    return () => {
      alive.current = false;
      onBusyChange(false);
    };
  }, [caseId]);
  useEffect(() => {
    heading.current?.focus();
    if (screen === "parts" && data?.permissions.stock) void loadStock();
  }, [screen, data?.permissions.stock]);
  useEffect(() => {
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
    const backGuard = (e: PopStateEvent) => {
      if (lock.current) {
        e.stopImmediatePropagation();
        history.pushState({ ...history.state }, "", lockedUrl.current);
        setSaved("ثبت در حال انجام است؛ پس از پایان می‌توانید برگردید.");
      }
    };
    const navigation=(window as Window&{navigation?:EventTarget}).navigation;
    const navigationGuard=(e:Event)=>{if(lock.current&&e.cancelable&&(e as Event&{navigationType?:string}).navigationType==="traverse"){e.preventDefault();setSaved("ثبت در حال انجام است؛ پس از پایان می‌توانید برگردید.");}};
    navigation?.addEventListener("navigate",navigationGuard);
    window.addEventListener("popstate", backGuard, true);
    window.addEventListener("beforeunload", prevent);
    document.addEventListener("click", guard, true);
    return () => {
      navigation?.removeEventListener("navigate",navigationGuard);
      window.removeEventListener("popstate", backGuard, true);
      window.removeEventListener("beforeunload", prevent);
      document.removeEventListener("click", guard, true);
    };
  }, []);
  const run = async (
    area: string,
    job: () => Promise<void>,
    next?: TechnicalScreen,
    refresh = true,
  ) => {
    if (lock.current) return;
    lock.current = true;
    lockedUrl.current = location.href;
    setBusy(area);
    onBusyChange(true);
    setError(null);
    setSaved("");
    let ok = false,
      refreshFailed = false;
    try {
      await job();
      ok = true;
      if (area !== "refresh")
        setSaved(
          area === "history" ? "گزارش‌های قدیمی‌تر بارگذاری شد" : "ثبت شد",
        );
      if (refresh)
        try {
          await reload();
          if (area === "refresh") setSaved("اطلاعات تازه شد");
          if (screen === "parts" && data?.permissions.stock) await loadStock();
        } catch {
          refreshFailed = true;
          setError({
            area: "page",
            text:
              area === "refresh"
                ? "دریافت اطلاعات تازه ممکن نشد؛ دوباره تازه‌سازی کنید."
                : "ثبت انجام شد؛ دریافت اطلاعات تازه ممکن نشد. تازه‌سازی کنید.",
          });
        }
    } catch (e) {
      setError({ area, text: message(e) });
    } finally {
      lock.current = false;
      setBusy("");
      onBusyChange(false);
    }
    if (ok && next && alive.current) {
      go(next);
      if (refreshFailed)
        setError({
          area: "page",
          text:
            area === "refresh"
              ? "دریافت اطلاعات تازه ممکن نشد؛ دوباره تازه‌سازی کنید."
              : "ثبت انجام شد؛ دریافت اطلاعات تازه ممکن نشد. تازه‌سازی کنید.",
        });
    }
  };
  const alert = (area: string) =>
    error?.area === area ? (
      <p role="alert" className="tech-error">
        {error.text}
      </p>
    ) : null;
  const transition = async (target: string) => {
    if (!item) return;
    await workflowV2Action({
      action: "transition",
      caseId,
      target,
      lockVersion: item.lockVersion,
      idempotencyKey: keyFor("transition", {
        target,
        lockVersion: item.lockVersion,
      }),
    });
  };
  const record = () =>
    run(
      "report",
      async () => {
        const payload = {
          description: draft.description,
          attachments: draft.attachments,
          ...(draft.correctionOf
            ? { correctsActivityId: draft.correctionOf }
            : {}),
        };
        await workflowV2Action({
          action: "technical_activity",
          caseId,
          ...payload,
          idempotencyKey: keyFor("report", payload),
        });
        delete keys.current.report;
        change({ description: "", attachments: [], correctionOf: null });
        notify("گزارش ثبت شد.");
      },
      undefined,
    );
  const estimate = () =>
    run(
      "estimate",
      async () => {
        if (!data) return;
        const payload = {
          items: [
            {
              type: "labor",
              title: "اجرت تعمیر",
              quantity: 1,
              unitPrice: Number(draft.labor || 0),
              discountAmount: 0,
              taxRate: 0,
            },
            ...(data.cost.partsAmount
              ? [
                  {
                    type: "part",
                    title: "قطعات پرونده",
                    quantity: 1,
                    unitPrice: data.cost.partsAmount,
                    discountAmount: 0,
                    taxRate: 0,
                  },
                ]
              : []),
          ],
          diagnosticFee: Number(draft.diagnostic || 0),
          internalNote: draft.estimateNote,
        };
        const result = await createV2Estimate({
          caseId,
          ...payload,
          idempotencyKey: keyFor("estimate", payload),
        });
        if (result.estimate.requiresCustomerApproval)
          await sendV2Estimate(result.estimate.publicId);
        const fresh = (await loadV2Workflow(caseId)).cases[0];
        const target = result.estimate.requiresCustomerApproval
          ? "awaiting_customer_approval"
          : "repairing";
        if (
          fresh.status !== target &&
          fresh.allowedTransitions.includes(target)
        )
          await workflowV2Action({
            action: "transition",
            caseId,
            target,
            lockVersion: fresh.lockVersion,
            idempotencyKey: `estimate-route:${result.estimate.publicId}`,
          });
        delete keys.current.estimate;
        change({ labor: "", diagnostic: "", estimateNote: "" });
        notify(
          result.estimate.requiresCustomerApproval
            ? "هزینه اعلام شد؛ منتظر تأیید معتبر مشتری است."
            : "هزینه در محدودهٔ مجوز پذیرش ثبت شد.",
        );
      },
      "work",
    );
  const saveManual = () =>
    run(
      "parts",
      async () => {
        for (const row of draft.manualRows) {
          if (row.saved) continue;
          const payload = {
            title: row.title,
            quantity: Number(moneyDigits(row.quantity)),
            purchaseUnitCost: Number(row.purchase || 0),
            saleUnitPrice: Number(row.sale || 0),
            note: row.note,
          };
          await workflowV2Action({
            action: "manual_part_add",
            caseId,
            ...payload,
            idempotencyKey: keyFor(`manual:${row.id}`, payload),
          });
          change({
            manualRows: draftNow.current.manualRows.map((r) =>
              r.id === row.id ? { ...r, saved: true } : r,
            ),
          });
        }
        change({ manualRows: [newManualRow()] });
      },
      returnTo,
    );
  const request = () =>
    run(
      "parts",
      async () => {
        const payload = {
          itemId: Number(draft.stockId),
          quantity: Number(moneyDigits(draft.stockQuantity)),
        };
        await inventoryV2Action({
          action: "request",
          caseId,
          ...payload,
          idempotencyKey: keyFor("stock", payload),
        });
        delete keys.current.stock;
        change({ stockId: "", stockQuantity: "1" });
      },
      returnTo,
    );
  const refer = () =>
    run(
      "refer",
      async () => {
        const payload = {
          toUserId: Number(draft.referTo),
          reason: draft.referReason,
          partsDisposition: "settle_before_handover",
          hotReturnsDisposition: "settle_before_handover",
        };
        await workflowV2Action({
          action: "handover_request",
          caseId,
          ...payload,
          idempotencyKey: keyFor("refer", payload),
        });
        delete keys.current.refer;
        change({ referTo: "", referReason: "" });
        notify(
          "درخواست ارجاع ثبت شد؛ تا پذیرش تحویل‌گیرنده مسئولیت تغییر نمی‌کند.",
        );
      },
      home,
    );
  const upload = (file: File) =>
    run(
      "photos",
      async () => {
        if (file.size > 15 * 1024 * 1024)
          throw new Error("حجم فایل باید حداکثر ۱۵ مگابایت باشد.");
        const form = new FormData();
        form.set("file", file);
        form.set("caseId", String(caseId));
        form.set("purpose", "other");
        const result = await directAdminRequest<{ publicId: string }>(
          "/api/files-v2.php",
          { method: "POST", body: form },
          true,
        );
        change({
          attachments: [...draftNow.current.attachments, result.publicId],
        });
        notify("فایل به پرونده و گزارش بعدی متصل شد.");
      },
      home,
    );
  const finish = (outcome: "repaired" | "not_repaired") =>
    run(
      "finish",
      async () => {
        let fresh = (await loadV2Workflow(caseId)).cases[0];
        if (
          outcome === "repaired" &&
          data?.cost.authorized &&
          fresh.allowedTransitions.includes("repairing")
        ) {
          await workflowV2Action({
            action: "transition",
            caseId,
            target: "repairing",
            lockVersion: fresh.lockVersion,
            idempotencyKey: keyFor("resume", { version: fresh.lockVersion }),
          });
          fresh = (await loadV2Workflow(caseId)).cases[0];
        }
        const payload = {
          result: outcome,
          report: outcome === "not_repaired" ? draft.reason : draft.report,
          reason: outcome === "not_repaired" ? draft.reason : "",
        };
        await workflowV2Action({
          action: "technical_finish",
          caseId,
          ...payload,
          lockVersion: fresh.lockVersion,
          idempotencyKey: keyFor("finish", payload),
        });
        delete keys.current.finish;
        change({ report: "", reason: "" });
        notify(
          outcome === "repaired"
            ? "تعمیر پایان یافت و به مرحلهٔ بعد ارسال شد."
            : "نتیجهٔ عدم تعمیر ثبت شد.",
        );
      },
      "overview",
    );
  const older = () =>
    run(
      "history",
      async () => {
        if (!data?.activities.nextBeforeId) return;
        const more = await loadTechnicalActivities(
          caseId,
          data.activities.nextBeforeId,
        );
        setData((old) =>
          old
            ? {
                ...old,
                activities: {
                  activities: [
                    ...old.activities.activities,
                    ...more.activities,
                  ],
                  nextBeforeId: more.nextBeforeId,
                },
              }
            : old,
        );
      },
      undefined,
      false,
    );
  const timeline = (allowCorrection = false) => (
    <>
      <ol className="tech-report-list">
        {data?.activities.activities.map((a: TechnicalActivity) => (
          <li key={a.id}>
            <div className="tech-report-meta">
              <time>{date(a.createdAt)}</time>
              <span>{a.actorName}</span>
              {allowCorrection && data.permissions.activity && (
                <button
                  disabled={!!busy}
                  className="tech-text-button"
                  onClick={() => {
                    change({ correctionOf: a.id });
                    composer.current?.focus();
                  }}
                >
                  اصلاح گزارش
                </button>
              )}
            </div>
            {a.correctsActivityId && (
              <small>
                اصلاح گزارش شمارهٔ{" "}
                {a.correctsActivityId.toLocaleString("fa-IR")}
              </small>
            )}
            {!["گزارش فنی", "فعالیت فنی"].includes(a.title) && (
              <strong>{a.title}</strong>
            )}
            <p>{a.description}</p>
            {a.observation && <p>{a.observation}</p>}
            {a.attachments.map((id, i) => (
              <a
                href={`/api/files-v2.php?id=${encodeURIComponent(id)}`}
                target="_blank"
                rel="noreferrer"
                key={id}
              >
                پیوست {(i + 1).toLocaleString("fa-IR")}
              </a>
            ))}
          </li>
        ))}
      </ol>
      {!data?.activities.activities.length && (
        <p className="tech-hint">هنوز گزارشی ثبت نشده است.</p>
      )}
      {data?.activities.nextBeforeId && (
        <button disabled={!!busy} onClick={() => void older()}>
          مشاهده گزارش‌های قدیمی‌تر
        </button>
      )}
      {alert("history")}
    </>
  );
  const waiting = () => {
    if (!item || !data) return "";
    if (data.cost.state === "waiting_customer")
      return "منتظر تأیید هزینه توسط مشتری";
    if (item.status === "awaiting_parts")
      return "قطعه درخواست شده و هنوز تعیین تکلیف نشده است.";
    if (item.status === "qc_pending")
      return "دستگاه در انتظار کنترل کیفیت است.";
    if (item.status === "finance_pending")
      return "پرونده در انتظار تعیین تکلیف مالی است.";
    if (
      item.status === "ready_for_delivery" ||
      item.status === "returned_unrepaired"
    )
      return "مسئولیت فنی پایان یافته؛ پرونده در مسیر تحویل است.";
    if (item.isLocked) return "این پرونده بسته و فقط قابل مشاهده است.";
    return "";
  };
  const canWrite = !!data?.permissions.activity,
    disabled = !!busy,
    pending = handovers.find((h) => h.status === "requested"),
    partsBlocked = !!item?.blockers.parts.length;
  return (
    <article className="tech-case" aria-busy={disabled}>
      <div className="tech-page-nav">
        <button
          data-tech-exit
          disabled={disabled}
          onClick={() =>
            screen === "overview" || screen === "work" ? onExit() : go(returnTo)
          }
        >
          {screen === "overview" || screen === "work"
            ? "بازگشت به دستگاه‌های من"
            : "بازگشت به میز کار"}
        </button>
        <button
          disabled={disabled}
          onClick={() => void run("refresh", async () => {})}
        >
          تازه‌سازی
        </button>
      </div>
      <header className="tech-device-summary">
        <p>
          پرونده <bdi>{item?.receiptNumber ?? caseId}</bdi>
        </p>
        <h2 ref={heading} tabIndex={-1}>
          {item?.deviceTitle ?? "در حال دریافت دستگاه…"}
        </h2>
        {item && (
          <>
            <p className="tech-device-issue">{item.declaredIssue}</p>
            {!waiting() && (
              <p className="tech-status">
                {unstarted
                  ? "آمادهٔ بررسی"
                  : canWrite
                    ? "در حال بررسی و تعمیر"
                    : "پایان مسئولیت فنی"}
              </p>
            )}
          </>
        )}
      </header>
      <p className="tech-save" role="status">
        {busy
          ? ["refresh", "history"].includes(busy)
            ? "در حال دریافت…"
            : "در حال ثبت…"
          : saved}
      </p>
      {alert("page")}
      {item && data ? (
        <>
          {waiting() && (
            <p className="tech-wait" role="status">
              {waiting()}
            </p>
          )}
          {screen === "overview" ? (
            <section className="tech-entry">
              {!canWrite && data.report && (
                <p className="tech-final-report">
                  نتیجهٔ ثبت‌شده: {data.report}
                </p>
              )}
              {data.receptionNotes && (
                <p className="tech-reception-note">
                  توضیحات پذیرش: {data.receptionNotes}
                </p>
              )}
              <p className="tech-safety-note">
                {item.dataHandling === "coordinate_first"
                  ? "حذف اطلاعات دستگاه فقط پس از هماهنگی و مجوز مشتری مجاز است."
                  : item.dataHandling === "no_erasure"
                    ? "تعمیر بدون حذف اطلاعات انجام شود."
                    : "حذف اطلاعات فقط در صورت ضرورت فنی و مطابق مجوز مشتری مجاز است."}
              </p>
              {pending && (
                <p className="tech-wait">
                  درخواست ارجاع به {pending.to_user_name} منتظر پذیرش است.
                </p>
              )}
              {item.status === "finance_pending" && (
                <button
                  disabled={disabled}
                  onClick={() => go("finance", "overview")}
                >
                  پیگیری مالی
                </button>
              )}
              <div className="tech-entry-actions">
                {unstarted && canWrite ? (
                  <button
                    className="tech-primary"
                    disabled={disabled}
                    onClick={() =>
                      void run("phase", () => transition("diagnosing"), "work")
                    }
                  >
                    شروع بررسی دستگاه
                  </button>
                ) : (
                  <button
                    className="tech-primary"
                    disabled={disabled}
                    onClick={() => go("work")}
                  >
                    {canWrite
                      ? "ادامه کار روی دستگاه"
                      : "مشاهده گزارش‌های دستگاه"}
                  </button>
                )}
                {unstarted && data.permissions.refer && (
                  <button
                    disabled={disabled || !!pending}
                    onClick={() => go("refer", "overview")}
                  >
                    ارجاع به تکنسین دیگر
                  </button>
                )}
                {unstarted && data.permissions.finish && (
                  <button
                    disabled={disabled}
                    onClick={() => go("unrepaired", "overview")}
                  >
                    اعلام عدم امکان تعمیر
                  </button>
                )}
              </div>
              {alert("phase")}
            </section>
          ) : null}
          {screen === "work" ? (
            <section className="tech-work">
              {canWrite ? (
                <form
                  id="technical-report-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void record();
                  }}
                >
                  <fieldset disabled={disabled}>
                    {draft.correctionOf && (
                      <p>
                        گزارش اصلاحی برای شمارهٔ{" "}
                        {draft.correctionOf.toLocaleString("fa-IR")}؛ متن قبلی
                        حفظ می‌شود.{" "}
                        <button
                          type="button"
                          className="tech-text-button"
                          onClick={() => change({ correctionOf: null })}
                        >
                          لغو ارتباط اصلاحی
                        </button>
                      </p>
                    )}
                    <label htmlFor="technical-report">
                      گزارش اقدام انجام‌شده
                    </label>
                    <textarea
                      id="technical-report"
                      ref={composer}
                      required
                      maxLength={4000}
                      rows={4}
                      placeholder="چه کاری روی دستگاه انجام دادید؟"
                      value={draft.description}
                      onChange={(e) => change({ description: e.target.value })}
                    />
                    {!!draft.attachments.length && (
                      <p>
                        {draft.attachments.length.toLocaleString("fa-IR")} پیوست
                        برای این گزارش آماده است.{" "}
                        <button
                          type="button"
                          className="tech-text-button"
                          onClick={() => change({ attachments: [] })}
                        >
                          حذف ارتباط پیوست‌ها
                        </button>
                      </p>
                    )}
                    <button className="tech-primary" type="submit">
                      ثبت گزارش
                    </button>
                    {alert("report")}
                  </fieldset>
                </form>
              ) : (
                <p>
                  ثبت عملیات در این مرحله مجاز نیست؛ گزارش‌ها برای پیگیری
                  محفوظ‌اند.
                </p>
              )}
              {!canWrite && data.report && (
                <p className="tech-final-report">
                  نتیجهٔ ثبت‌شده: {data.report}
                </p>
              )}
              <nav className="tech-tools" aria-label="ابزارهای دستگاه">
                <button disabled={disabled} onClick={() => go("parts")}>
                  قطعات
                </button>
                {canWrite && (
                  <button disabled={disabled} onClick={() => go("estimate")}>
                    اعلام هزینه
                  </button>
                )}
                <button disabled={disabled} onClick={() => go("photos")}>
                  افزودن عکس و مشاهده تصاویر
                </button>
              </nav>
              {pending && (
                <p className="tech-hint">
                  ارجاع به {pending.to_user_name} منتظر پذیرش است.
                </p>
              )}
              {item.status === "finance_pending" && (
                <button
                  disabled={disabled}
                  onClick={() => go("finance", "work")}
                >
                  پیگیری مالی
                </button>
              )}
              {canWrite && (
                <div className="tech-outcome-actions">
                  {data.permissions.finish && (
                    <button disabled={disabled} onClick={() => go("repaired")}>
                      تعمیر شد
                    </button>
                  )}
                  {data.permissions.refer && (
                    <button
                      disabled={disabled || !!pending}
                      onClick={() => go("refer")}
                    >
                      ارجاع به تکنسین دیگر
                    </button>
                  )}
                  {data.permissions.finish && (
                    <button
                      disabled={disabled}
                      onClick={() => go("unrepaired")}
                    >
                      اعلام عدم امکان تعمیر
                    </button>
                  )}
                </div>
              )}
              <h3>گزارش‌های ثبت‌شده</h3>
              {timeline(true)}
            </section>
          ) : null}
          {screen === "parts" ? (
            <section className="tech-task">
              <h3>{titles.parts}</h3>
              <TechnicianPartsPage
                caseId={caseId}
                actorId={actorId}
                data={data}
                inventory={inventory}
                stockError={stockError}
                rows={draft.manualRows}
                setRows={(manualRows) => change({ manualRows })}
                stockId={draft.stockId}
                stockQuantity={draft.stockQuantity}
                onStockChange={change}
                source={source}
                onSource={setSource}
                busy={disabled}
                onManual={() => void saveManual()}
                onRequest={() => void request()}
                onSettled={(job) => void run("parts", job, returnTo)}
              />
              {alert("parts")}
              {item.blockers.parts.map((b) => (
                <p key={b} className="tech-hint">
                  {b}
                </p>
              ))}
            </section>
          ) : null}
          {screen === "estimate" ? (
            <section className="tech-task">
              <h3>{titles.estimate}</h3>
              <p className="tech-wait">{costLabels[data.cost.state]}</p>
              <p>
                سقف مجاز پذیرش:{" "}
                <strong>
                  {formatToman(String(data.cost.capAmount))} تومان
                </strong>
              </p>
              {!!data.cost.partsAmount && (
                <p>
                  قطعات پرونده: {formatToman(String(data.cost.partsAmount))}{" "}
                  تومان؛ یک‌بار در برآورد محاسبه می‌شود.
                </p>
              )}
              {canWrite ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void estimate();
                  }}
                >
                  <fieldset disabled={disabled}>
                    <label htmlFor="technical-labor">
                      مبلغ پیشنهادی اجرت
                      <MoneyInput
                        id="technical-labor"
                        required
                        value={draft.labor}
                        onChange={(labor) => change({ labor })}
                      />
                    </label>
                    <label htmlFor="technical-diagnostic">
                      هزینه عیب‌یابی، در صورت نیاز
                      <MoneyInput
                        id="technical-diagnostic"
                        value={draft.diagnostic}
                        onChange={(diagnostic) => change({ diagnostic })}
                      />
                    </label>
                    <label>
                      توضیح هزینه، اختیاری
                      <textarea
                        rows={2}
                        maxLength={4000}
                        value={draft.estimateNote}
                        onChange={(e) =>
                          change({ estimateNote: e.target.value })
                        }
                      />
                    </label>
                    <p className="tech-hint">
                      برای تعمیر رایگان صفر وارد کنید. بالاتر از سقف، پاسخ مستند
                      مشتری باید با نقش مجاز ثبت شود.
                    </p>
                    <button type="submit" className="tech-primary">
                      ثبت و ارسال برآورد
                    </button>
                    {alert("estimate")}
                  </fieldset>
                </form>
              ) : (
                <p>در این مرحله اعلام هزینه مجاز نیست.</p>
              )}
            </section>
          ) : null}
          {screen === "photos" ? (
            <section className="tech-task">
              <h3>{titles.photos}</h3>
              <TechnicianFilesPage
                caseId={caseId}
                allowed={canWrite}
                busy={disabled}
                date={date}
                onUpload={(file) => void upload(file)}
              />
              {alert("photos")}
            </section>
          ) : null}
          {screen === "refer" ? (
            <section className="tech-task">
              <h3>{titles.refer}</h3>
              <p>
                ارجاع، نتیجهٔ «تعمیر نشد» نیست. سوابق و مسئولیت فعلی تا پذیرش
                تحویل‌گیرنده حفظ می‌شوند.
              </p>
              {pending ? (
                <p className="tech-wait">
                  درخواست به {pending.to_user_name} ثبت شده و منتظر پذیرش است.
                </p>
              ) : data.permissions.refer ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void refer();
                  }}
                >
                  <fieldset disabled={disabled}>
                    <label>
                      تکنسین مقصد
                      <select
                        required
                        value={draft.referTo}
                        onChange={(e) => change({ referTo: e.target.value })}
                      >
                        <option value="">انتخاب تکنسین</option>
                        {users
                          .filter(
                            (u) =>
                              u.id !== item.primaryTechnicianUserId &&
                              ["technician", "repair_manager"].includes(u.role),
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.display_name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      علت ارجاع
                      <textarea
                        required
                        maxLength={1000}
                        rows={4}
                        value={draft.referReason}
                        onChange={(e) =>
                          change({ referReason: e.target.value })
                        }
                      />
                    </label>
                    {partsBlocked && (
                      <p className="tech-hint">
                        پیش از قبول ارجاع، قطعات و تعهدهای باقی‌مانده باید تعیین
                        تکلیف شوند.
                      </p>
                    )}
                    <button className="tech-primary" type="submit">
                      ثبت درخواست ارجاع
                    </button>
                    {alert("refer")}
                  </fieldset>
                </form>
              ) : (
                <p>ارجاع مسئولیت در دسترسی شما نیست.</p>
              )}
              {partsBlocked && (
                <button
                  disabled={disabled}
                  onClick={() => go("parts", "refer")}
                >
                  تعیین تکلیف قطعات
                </button>
              )}
            </section>
          ) : null}
          {screen === "repaired" || screen === "unrepaired" ? (
            <section className="tech-task">
              <h3>{titles[screen]}</h3>
              {data.permissions.finish ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (confirmed)
                      void finish(
                        screen === "repaired" ? "repaired" : "not_repaired",
                      );
                    else setConfirmed(true);
                  }}
                >
                  <fieldset disabled={disabled}>
                    <label htmlFor="technical-final">
                      {screen === "repaired"
                        ? "نتیجه فنی نهایی"
                        : "علت عدم امکان تعمیر"}
                      <textarea
                        id="technical-final"
                        required
                        rows={4}
                        maxLength={screen === "repaired" ? 8000 : 1000}
                        value={
                          screen === "repaired" ? draft.report : draft.reason
                        }
                        onChange={(e) => {
                          change(
                            screen === "repaired"
                              ? { report: e.target.value }
                              : { reason: e.target.value },
                          );
                          setConfirmed(false);
                        }}
                      />
                    </label>
                    <p>
                      قطعات:{" "}
                      {partsBlocked
                        ? "تعیین تکلیف لازم است."
                        : "قطعهٔ تعیین‌تکلیف‌نشده وجود ندارد."}
                    </p>
                    {partsBlocked && (
                      <button type="button" onClick={() => go("parts", screen)}>
                        تعیین تکلیف قطعات
                      </button>
                    )}
                    {screen === "repaired" ? (
                      <>
                        <p>مقصد بعدی: {data.nextDestination}</p>
                        {!data.cost.authorized && (
                          <>
                            <p className="tech-hint">
                              ابتدا هزینه و مجوز معتبر را تکمیل کنید.
                            </p>
                            <button
                              type="button"
                              onClick={() => go("estimate", screen)}
                            >
                              اعلام یا اصلاح هزینه
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <p>
                          بدون الزام کنترل کیفیت، پس از تعیین تکلیف مالی به
                          تحویل می‌رود. اجرت تعمیر و ضمانت تعمیر ایجاد نمی‌شود.
                        </p>
                        <p>
                          مالی:{" "}
                          {data.unrepairedFinanceBlockers.length
                            ? data.unrepairedFinanceBlockers.join("؛ ")
                            : "مانع ثبت‌شده‌ای وجود ندارد."}
                        </p>
                        {!!data.unrepairedFinanceBlockers.length && (
                          <button
                            type="button"
                            onClick={() => go("finance", screen)}
                          >
                            پیگیری مالی
                          </button>
                        )}
                      </>
                    )}
                    {confirmed ? (
                      <div className="tech-confirm">
                        <p>
                          {screen === "repaired"
                            ? "پایان تعمیر و ارسال به مرحله بعد تأیید شود؟"
                            : "عدم امکان تعمیر دستگاه ثبت شود؟"}
                        </p>
                        <button className="tech-primary" type="submit">
                          تأیید و ثبت نتیجه
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmed(false)}
                        >
                          بازگشت به ویرایش
                        </button>
                      </div>
                    ) : (
                      <button
                        className="tech-primary"
                        type="submit"
                        disabled={
                          partsBlocked ||
                          (screen === "repaired" && !data.cost.authorized)
                        }
                      >
                        {screen === "repaired"
                          ? "ثبت پایان تعمیر و ارسال به مرحله بعد"
                          : "ثبت نتیجه عدم تعمیر"}
                      </button>
                    )}
                    {alert("finish")}
                  </fieldset>
                </form>
              ) : (
                <>
                  <p>
                    {data.result === "not_repaired"
                      ? "نتیجه عدم تعمیر ثبت شده است."
                      : "مسئولیت فنی پایان یافته یا ثبت نتیجه در دسترسی شما نیست."}
                  </p>
                  {item.status === "finance_pending" && (
                    <button
                      disabled={disabled}
                      onClick={() => go("finance", screen)}
                    >
                      پیگیری مالی
                    </button>
                  )}
                </>
              )}
              <h3>گزارش‌های پیشین</h3>
              {timeline()}
            </section>
          ) : null}
          {screen === "finance" ? (
            <section className="tech-task">
              <h3>{titles.finance}</h3>
              <p>
                {item.status === "finance_pending"
                  ? "پرونده منتظر اقدام واحد مالی است."
                  : "تعیین تکلیف مالی با نقش مجاز انجام می‌شود."}
              </p>
              <ul className="tech-plain-list">
                {item.blockers.finance.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              {canViewFinance ? (
                <button onClick={() => onNavigate("مالی پرونده")}>
                  ورود به مالی پرونده
                </button>
              ) : (
                !item.isLocked && (
                  <button
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        "finance",
                        async () => {
                          const payload = {
                            message: "درخواست پیگیری مالی از پرونده تکنسین",
                          };
                          await workflowV2Action({
                            action: "problem_report",
                            caseId,
                            ...payload,
                            idempotencyKey: keyFor("finance", payload),
                          });
                          notify(
                            "درخواست پیگیری در پرونده ثبت شد؛ تصمیم مالی با مسئول مجاز است.",
                          );
                        },
                        "work",
                      )
                    }
                  >
                    ثبت درخواست پیگیری در پرونده
                  </button>
                )
              )}
              {alert("finance")}
            </section>
          ) : null}
        </>
      ) : (
        <p role="status">در حال دریافت پرونده…</p>
      )}
    </article>
  );
}
