import { Smartphone, X } from "lucide-react";
import { PersianDatePicker } from "./persian-date-picker";
import { ExternalPurchasePanel } from "./external-purchase-panel";
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
  technicalStageScreen,
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
  type OperationsPolicy,
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
        timeZone: "Asia/Tehran",
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
  diagnosis: "عیب‌یابی",
  parts: "قطعات",
  purchases: "خرید خارج از انبار",
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
  diagnosisAssessment: "",
  diagnosisDescription: "",
  diagnosisIssues: "",
  diagnosisIssue: "",
  diagnosisDueDate: "",
  diagnosisDueTime: "12:00",
  attachments: [] as string[],
  correctionOf: null as number | null,
  labor: "",
  diagnostic: "",
  estimateNote: "",
  report: "",
  reason: "",
  finishReasonCode: "technical_failure",
  referTo: "",
  referReason: "",
  referReasonId: "other",
  invoiceLabor: "",
  invoiceExtraTitle: "",
  invoiceExtraAmount: "",
  invoicePrices: {} as Record<string, string>,
  stockId: "",
  stockQuantity: "1",
  stockLines: [] as Array<{ itemId: number; quantity: number; title: string }>,
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
  exitLabel = "بازگشت به دستگاه‌های من",
  onManage,
  overviewAction,
  stageDriven = false,
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
  exitLabel?: string;
  onManage?: () => void;
  overviewAction?: { label: string; onClick: () => void };
  stageDriven?: boolean;
}) {
  const [operationsPolicy, setOperationsPolicy] = useState<OperationsPolicy>();
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
  const summary = useRef<HTMLDialogElement>(null);
  const lastLoaded = useRef<V2Case | undefined>(undefined);
  const lockedUrl = useRef(location.href);
  const lock = useRef(false),
    alive = useRef(true),
    heading = useRef<HTMLHeadingElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    draftNow = useRef(draft);
  const unstarted = item
    ? ["assigned", "reception", "awaiting_assignment"].includes(item.status)
    : true;
  const home: TechnicalScreen = stageDriven ? technicalStageScreen(item) : unstarted ? "overview" : "work";
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
  const go = (next: TechnicalScreen, back: TechnicalScreen =
    stageDriven && ["refer", "repaired", "unrepaired"].includes(next) && !unstarted ? "work" : home
  ) => {
    if (lock.current) return;
    setError(null);
    setConfirmed(false);
    setReturnTo(back);
    setScreen(next);
    writeTechnicalLocation(
      caseId,
      next,
      stageDriven ? (next === back ? undefined : back) : next === "overview" || next === "work" ? undefined : back,
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
    lastLoaded.current = fresh;
    setItem(fresh);
    setData(projection);
    setUsers(workflow.users);
    setOperationsPolicy(workflow.operationsPolicy);
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
    void reload().then(() => {
      if (!stageDriven || !alive.current || new URL(location.href).searchParams.has("techReturn")) return;
      const requested = readTechnicalScreen();
      if (!["work", "overview", "diagnosis", "estimate", "parts"].includes(requested)) return;
      const stage = lastLoaded.current;
      const next = technicalStageScreen(stage);
      if (stage && requested !== next) {
        setScreen(next);
        writeTechnicalLocation(caseId, next, undefined, true);
      }
    }).catch((e) => {
      if (alive.current) setError({ area: "page", text: message(e) });
    });
    return () => {
      alive.current = false;
      onBusyChange(false);
    };
  }, [caseId]);
  useEffect(() => {
    heading.current?.focus();
    if ((screen === "parts" || (stageDriven && screen === "work")) && data?.permissions.stock) void loadStock();
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
    const navigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    const navigationGuard = (e: Event) => {
      if (
        lock.current &&
        e.cancelable &&
        (e as Event & { navigationType?: string }).navigationType === "traverse"
      ) {
        e.preventDefault();
        setSaved("ثبت در حال انجام است؛ پس از پایان می‌توانید برگردید.");
      }
    };
    navigation?.addEventListener("navigate", navigationGuard);
    window.addEventListener("popstate", backGuard, true);
    window.addEventListener("beforeunload", prevent);
    document.addEventListener("click", guard, true);
    return () => {
      navigation?.removeEventListener("navigate", navigationGuard);
      window.removeEventListener("popstate", backGuard, true);
      window.removeEventListener("beforeunload", prevent);
      document.removeEventListener("click", guard, true);
    };
  }, []);
  const run = async (
    area: string,
    job: () => Promise<void>,
    next?: TechnicalScreen | (() => TechnicalScreen),
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
      const destination = typeof next === "function" ? next() : next;
      const changedStage = ["receipt", "phase", "diagnosis", "estimate", "finish"].includes(area);
      go(destination, stageDriven && changedStage ? destination : undefined);
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
  const persistEstimate = async () => {
        if (!data) throw new Error("اطلاعات پرونده در دسترس نیست.");
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
        change({ labor: "", diagnostic: "", estimateNote: "", diagnosisDueDate: "", diagnosisDueTime: "12:00" });
        notify(
          result.estimate.requiresCustomerApproval
            ? "هزینه اعلام شد؛ منتظر تأیید معتبر مشتری است."
            : "هزینه در محدودهٔ مجوز پذیرش ثبت شد.",
        );
        return target;
  };
  const diagnose = () => {
    let next: TechnicalScreen = "estimate";
    return run("diagnosis", async () => {
      const fresh = (await loadV2Workflow(caseId)).cases[0];
      if (fresh.status === "diagnosing" || fresh.status === "qc_rework") {
        const payload = {
          assessment: draft.diagnosisAssessment,
          description: draft.diagnosisDescription,
          issues: [...draft.diagnosisIssues.split("\n"), draft.diagnosisIssue].map((line) => line.trim()).filter(Boolean),
        };
        await workflowV2Action({ action: "technical_diagnosis", caseId, ...payload,
          lockVersion: fresh.lockVersion, idempotencyKey: keyFor("diagnosis", payload) });
      }
      if (stageDriven) {
        if (draft.diagnosisDueDate) {
          const promisedAt = new Date(`${draft.diagnosisDueDate}T${draft.diagnosisDueTime}:00+03:30`).toISOString().slice(0, 19).replace("T", " ");
          if (fresh.promisedAt !== promisedAt) await workflowV2Action({ action: "update_promise", caseId, promisedAt, reason: "موعد برآورد عیب‌یابی" });
        }
        next = await persistEstimate() === "repairing" ? "work" : "overview";
      }
      delete keys.current.diagnosis;
      change({ diagnosisAssessment: "", diagnosisDescription: "", diagnosisIssues: "", diagnosisIssue: "" });
    }, () => next);
  };
  const estimate = () => {
    let next: TechnicalScreen = "work";
    return run("estimate", async () => {
      const target = await persistEstimate();
      if (stageDriven && target === "awaiting_customer_approval") next = "overview";
    }, () => next);
  };
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
        const selected = draft.stockId ? [{ itemId: Number(draft.stockId), quantity: Number(moneyDigits(draft.stockQuantity)) }] : [];
        const lines = [...draft.stockLines.map(({ itemId, quantity }) => ({ itemId, quantity })), ...selected];
        const payload = lines.length === 1 ? lines[0] : { lines };
        await inventoryV2Action({
          action: "request",
          caseId,
          ...payload,
          idempotencyKey: keyFor("stock", payload),
        });
        delete keys.current.stock;
        change({ stockId: "", stockQuantity: "1", stockLines: [] });
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
          reasonId: draft.referReasonId,
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
      returnTo,
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
      returnTo,
    );
  const invoiceTotals = { part: 0, labor: 0, diagnostic: 0, other: 0 };
  for (const line of data?.invoice.items ?? []) {
    const changedPrice = line.sourceKey ? draft.invoicePrices[line.sourceKey] : undefined;
    const base = Math.round(Number(line.quantity) * Number(changedPrice ?? line.saleUnitPrice)) - Number(line.discountAmount);
    invoiceTotals[line.type] += changedPrice === undefined ? line.lineTotal : base + Math.round(base * Number(line.taxRate) / 100);
  }
  if (draft.invoiceLabor !== "") invoiceTotals.labor = Number(draft.invoiceLabor);
  const extraPresent = draft.invoiceExtraTitle.trim() !== "" || Number(draft.invoiceExtraAmount) > 0;
  const extraValid = !extraPresent || (draft.invoiceExtraTitle.trim() !== "" && Number(draft.invoiceExtraAmount) > 0);
  if (extraPresent && extraValid) invoiceTotals.other += Number(draft.invoiceExtraAmount);
  const invoiceTotal = Object.values(invoiceTotals).reduce((sum, value) => sum + value, 0);
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
          ...(outcome === "not_repaired" ? { reasonCode: draft.finishReasonCode } : {}),
          ...(outcome === "repaired" ? { invoice: {
            ...(draft.invoiceLabor !== "" ? { laborAmount: Number(draft.invoiceLabor) } : {}),
            ...(draft.invoiceExtraTitle.trim() && Number(draft.invoiceExtraAmount) > 0
              ? { extra: [{ title: draft.invoiceExtraTitle.trim(), amount: Number(draft.invoiceExtraAmount) }] }
              : {}),
            expectedTotal: invoiceTotal,
            partPrices: Object.fromEntries(Object.entries(draft.invoicePrices).map(([key, value]) => [key, Number(value)])),
          } } : {}),
        };
        await workflowV2Action({
          action: "technical_finish",
          caseId,
          ...payload,
          lockVersion: fresh.lockVersion,
          idempotencyKey: keyFor("finish", payload),
        });
        delete keys.current.finish;
        change({ report: "", reason: "", invoiceLabor: "", invoiceExtraTitle: "", invoiceExtraAmount: "", invoicePrices: {} });
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
  const stageNumber = item ? item.receiptPending ? 0 : ({
    assigned: 0, reception: 0, awaiting_assignment: 0, diagnosing: 1, estimate_pending: 1,
    awaiting_customer_approval: 2, repairing: 3, awaiting_parts: 3, qc_rework: 3,
    parts_closeout: 5, qc_pending: 6, qc_conditional: 6, finance_pending: 7,
    ready_for_delivery: 8, returned_unrepaired: 8, delivered: 8, closed: 8,
  } as Record<string, number>)[item.status] ?? 0 : 0;
  const progress = screen === "repaired" ? 4 : stageNumber;
  const estimateInputs = <>
    <div className="tech-form-grid">
      <label htmlFor="technical-labor">مبلغ پیشنهادی اجرت
        <MoneyInput id="technical-labor" required value={draft.labor} onChange={(labor) => change({ labor })} />
      </label>
      <label htmlFor="technical-diagnostic">هزینه عیب‌یابی، در صورت نیاز
        <MoneyInput id="technical-diagnostic" value={draft.diagnostic} onChange={(diagnostic) => change({ diagnostic })} />
      </label>
    </div>
    <label>توضیح هزینه، اختیاری<textarea rows={2} maxLength={4000} value={draft.estimateNote}
      onChange={(event) => change({ estimateNote: event.target.value })} /></label>
  </>;
  const canWrite = !!data?.permissions.activity,
    disabled = !!busy,
    pending = handovers.find((h) => h.status === "requested"),
    partsBlocked = !!item?.blockers.parts.length;
  const stageRoot = !new URL(location.href).searchParams.has("techReturn");
  return (
    <article className="tech-case" aria-busy={disabled}>
      {stageDriven ? <>
        <header className="tech-v7-work-head">
          <div className="tech-v7-device">
            <span className="tech-v7-glyph"><Smartphone size={22} aria-hidden="true" /></span>
            <div>
              <h2 ref={heading} tabIndex={-1} dir="auto">{item?.deviceTitle ?? "در حال دریافت دستگاه…"}</h2>
              <p>پذیرش <bdi>{item?.receiptNumber ?? caseId}</bdi>{item?.customerName && ` · ${item.customerName}`}</p>
            </div>
          </div>
          <nav className="tech-v7-work-nav" aria-label="گام‌های پرونده">
            <button data-tech-exit type="button" disabled={disabled} onClick={() =>
              stageRoot ? onExit() : go(returnTo)
            }>{stageRoot ? exitLabel : "بازگشت به میز کار"}</button>
            {data && <button type="button" className="tech-v7-ghost" disabled={disabled} onClick={() => summary.current?.showModal()}>خلاصه پرونده</button>}
            <button type="button" className="tech-v7-ghost" disabled={disabled} onClick={() => void run("refresh", async () => {})}>تازه‌سازی</button>
          </nav>
        </header>
        {item && <div className="tech-v7-work-phase">
          <span className="tech-v7-eyebrow">{item.technicianView.statusLabel}</span>
          <span className="tech-v7-pill" data-priority={item.status === "qc_rework" ? "rework" : item.priority}>{item.status === "qc_rework" ? "بازکاری QC" : item.priority === "critical" ? "بسیار فوری" : item.priority === "urgent" ? "فوری" : "عادی"}</span>
        </div>}
        {item && <div role="progressbar" aria-label="پیشرفت پرونده" aria-valuemin={1} aria-valuemax={9} aria-valuenow={progress + 1} className="tech-v7-stepbar">
          {Array.from({ length: 9 }, (_, step) => <span key={step} data-step={step < progress ? "done" : step === progress ? "current" : undefined} />)}
        </div>}
        </> : <>
      <div className="tech-page-nav">
        <button
          data-tech-exit
          disabled={disabled}
          onClick={() =>
            screen === "overview" || screen === "work" ? onExit() : go(returnTo)
          }
        >
          {screen === "overview" || screen === "work"
            ? exitLabel
            : "بازگشت به میز کار"}
        </button>
        {onManage && (
          <button
            className="tech-management-link"
            disabled={disabled}
            onClick={onManage}
          >
            مدیریت پرونده
          </button>
        )}
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
                {data?.receiptPending
                  ? "منتظر تأیید دریافت"
                  : unstarted
                  ? "آمادهٔ بررسی"
                  : canWrite
                    ? "در حال بررسی و تعمیر"
                    : "پایان مسئولیت فنی"}
              </p>
            )}
          </>
        )}
      </header>
      </>}
      <p className={stageDriven && !disabled && saved === "ثبت شد" ? "tech-visually-hidden" : "tech-save"} role="status">
        {busy
          ? ["refresh", "history"].includes(busy)
            ? "در حال دریافت…"
            : "در حال ثبت…"
          : saved}
      </p>
      {alert("page")}
      {item && data && data.receiptPending ? (
        <section className="tech-entry tech-receipt" aria-labelledby="device-receipt-heading">
          <h3 id="device-receipt-heading">تأیید دریافت دستگاه</h3>
          <dl className="tech-receipt-details">
            {stageDriven && <div><dt>ایراد اولیه</dt><dd>{item.declaredIssue}</dd></div>}
            <div><dt>مشتری</dt><dd>{item.customerName}</dd></div>
            <div><dt>مسئول</dt><dd>{item.technicianName || "تعمیرکار تعمیرگاه"}</dd></div>
            <div><dt>سقف هزینه در پذیرش</dt><dd>{formatToman(item.preapprovedAmount)} تومان</dd></div>
            <div><dt>موعد اعلام‌شده</dt><dd>{date(item.promisedAt)}</dd></div>
          </dl>
          {data.receptionNotes && <p>{data.receptionNotes}</p>}
          {data.permissions.receive ? (
            <>
              <p>پس از تحویل فیزیکی دستگاه، دریافت آن را ثبت کنید.</p>
              <div className={stageDriven ? "tech-v7-action-bar" : undefined}><button className="tech-primary" disabled={disabled} onClick={() => void run("receipt", async () => {
                await workflowV2Action({
                  action: "technical_receive",
                  caseId,
                  lockVersion: item.lockVersion,
                  idempotencyKey: keyFor("receipt", { lockVersion: item.lockVersion }),
                });
              }, stageDriven ? "diagnosis" : "work")}>
                {stageDriven ? "تأیید دریافت و شروع بررسی" : "تأیید دریافت دستگاه"}
              </button></div>
            </>
          ) : <p role="status">منتظر تأیید دریافت توسط مسئول دستگاه</p>}
          {alert("receipt")}
        </section>
      ) : item && data ? (
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
                {overviewAction ? (
                  <button
                    className="tech-primary"
                    disabled={disabled}
                    onClick={overviewAction.onClick}
                  >
                    {overviewAction.label}
                  </button>
                ) : unstarted && canWrite ? (
                  <button
                    className="tech-primary"
                    disabled={disabled}
                    onClick={() =>
                      void run("phase", () => transition("diagnosing"), stageDriven ? "diagnosis" : "work")
                    }
                  >
                    شروع بررسی دستگاه
                  </button>
                ) : (
                  <button
                    className="tech-primary"
                    disabled={disabled}
                    onClick={() => go("work", "overview")}
                  >
                    {canWrite
                      ? "ادامه کار روی دستگاه"
                      : "مشاهده گزارش‌های دستگاه"}
                  </button>
                )}
                {unstarted && (data.permissions.refer && operationsPolicy?.handover !== "disabled" && item.productProfile !== "solo") && (
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
          {screen === "diagnosis" && <section className="tech-task">
            <h3>{stageDriven ? "عیب‌یابی و برآورد" : "عیب‌یابی دستگاه"}</h3>
            {stageDriven && <p className="tech-v7-description">ایرادهای تشخیص‌داده‌شده و برآورد را ثبت کنید.</p>}
            <p className={stageDriven ? "tech-v7-callout" : undefined}>ایراد پذیرش · {item.declaredIssue}</p>
            <form onSubmit={(event) => { event.preventDefault(); void diagnose(); }}>
              <fieldset disabled={disabled}>
                {item.status !== "estimate_pending" && <>
                  <label>نتیجه بررسی ایراد پذیرش<select required value={draft.diagnosisAssessment}
                    onChange={(event) => change({ diagnosisAssessment: event.target.value })}>
                    <option value="">انتخاب نتیجه</option><option value="confirmed">ایراد تأیید شد</option>
                    <option value="not_reproduced">ایراد تکرار نشد</option><option value="undetermined">نیازمند بررسی بیشتر</option>
                  </select></label>
                  <label>شرح عیب‌یابی<textarea required maxLength={4000} rows={2} value={draft.diagnosisDescription}
                    onChange={(event) => change({ diagnosisDescription: event.target.value })} /></label>
                  {stageDriven ? <>
                    {draft.diagnosisIssues.split("\n").filter(Boolean).map((issue, index, issues) => (
                      <div key={index} className="tech-v7-row"><span>{issue}</span><button type="button" onClick={() => change({ diagnosisIssues: issues.filter((_, i) => i !== index).join("\n") })}>حذف</button></div>
                    ))}
                    <div className="tech-v7-composer">
                      <input aria-label="شرح ایراد جدید" placeholder="شرح ایراد جدید" maxLength={300} value={draft.diagnosisIssue} onChange={(event) => change({ diagnosisIssue: event.target.value })} />
                      <button type="button" disabled={!draft.diagnosisIssue.trim()} onClick={() => change({ diagnosisIssues: [draft.diagnosisIssues, draft.diagnosisIssue.trim()].filter(Boolean).join("\n"), diagnosisIssue: "" })}>افزودن ایراد</button>
                    </div>
                  </> : <label>ایرادهای تازه، هر مورد در یک خط<textarea value={draft.diagnosisIssues} maxLength={4000}
                    onChange={(event) => change({ diagnosisIssues: event.target.value })} /></label>}
                </>}
                {stageDriven && <>
                  {estimateInputs}
                  <div className="tech-form-grid">
                    <div><label>موعد برآوردی اتمام</label><PersianDatePicker ariaLabel="موعد برآوردی اتمام" value={draft.diagnosisDueDate} onChange={(diagnosisDueDate) => change({ diagnosisDueDate })} /></div>
                    {draft.diagnosisDueDate && <label>ساعت موعد به وقت ایران<input required dir="ltr" type="time" value={draft.diagnosisDueTime} onChange={(event) => change({ diagnosisDueTime: event.target.value })} /></label>}
                  </div>
                </>}
                <div className={stageDriven ? "tech-v7-action-bar" : undefined}>
                  {stageDriven && <button type="button" onClick={() => go("work", "diagnosis")}>گزارش‌های پرونده</button>}
                  <button className="tech-primary" type="submit">{stageDriven ? "ثبت برآورد و ادامه" : "ثبت عیب‌یابی و تنظیم برآورد"}</button>
                </div>
              </fieldset>
            </form>
            {alert("diagnosis")}
          </section>}
          {screen === "work" ? (
            <section className="tech-work">
              {stageDriven && <>
                <h3>{item.status === "repairing" || item.status === "qc_rework" ? "عملیات تعمیر" : "گزارش‌های پرونده"}</h3>
                <p className="tech-v7-description">اقدامات فنی و قطعات دستگاه</p>
                <div className="tech-v7-callout tech-v7-row"><span>{data.cost.authorized ? "سقف هزینه تأییدشده" : "سقف هزینه در پذیرش"}</span>
                  <strong>{formatToman(data.invoice.authorizedAmount)} تومان</strong>
                </div>
                <div className="tech-v7-row tech-v7-work-section">
                  <h4>اقدامات انجام‌شده</h4>
                  {canWrite && <button disabled={disabled} onClick={() => go("estimate", "work")}>افزایش برآورد</button>}
                </div>
                {timeline(true)}
              </>}
              {canWrite && (!stageDriven || data.reworkDestination === "diagnosing") && ["diagnosing", "qc_rework"].includes(item.status) && (
                <button type="button" onClick={() => go("diagnosis", "work")}>{data.reworkDestination === "diagnosing" ? "شروع عیب‌یابی مجدد" : "ثبت نتیجهٔ عیب‌یابی"}</button>
              )}
              {canWrite ? (
                <form
                  id="technical-report-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void record();
                  }}
                >
                  <fieldset disabled={disabled} className={stageDriven ? "tech-v7-report-form" : undefined}>
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
                    <label className={stageDriven ? "tech-visually-hidden" : undefined} htmlFor="technical-report">
                      گزارش اقدام انجام‌شده
                    </label>
                    <textarea
                      id="technical-report"
                      ref={composer}
                      required
                      maxLength={4000}
                      rows={stageDriven ? 2 : 4}
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
              {stageDriven && <section className="tech-v7-work-section">
                <h4>قطعات تعمیر</h4>
                {data.parts.length ? <ul className="tech-v7-receipt-lines">{data.parts.map((part) =>
                  <li key={part.sourceKey}><strong>{part.title}</strong><span>{Number(part.quantity).toLocaleString("fa-IR")} عدد · مصرف‌شده</span></li>)}</ul> : <p className="tech-v7-description">هنوز قطعه‌ای مصرف نشده است.</p>}
                {item.blockers.parts.map((blocker) => <p key={blocker} className="tech-v7-description">{blocker}</p>)}
                {data.permissions.parts && <div className="tech-v7-part-actions">
                  {data.permissions.stock && <button type="button" disabled={disabled} onClick={() => { setSource("stock"); go("parts", "work"); }}>درخواست قطعه از انبار</button>}
                  <button type="button" disabled={disabled} onClick={() => go("purchases", "work")}>قطعه خارج از انبار</button>
                </div>}
              </section>}
              <nav className="tech-tools" aria-label="ابزارهای دستگاه">
                <button disabled={disabled} onClick={() => go("parts", "work")}>
                  قطعات
                </button>
                {canWrite && !stageDriven && (
                  <button disabled={disabled} onClick={() => go("estimate")}>
                    اعلام هزینه
                  </button>
                )}
                <button disabled={disabled} onClick={() => go("photos", "work")}>
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
                <div className={stageDriven ? "tech-v7-action-bar" : "tech-outcome-actions"}>
                  {data.permissions.finish && (
                    <button className={stageDriven ? "tech-primary tech-v7-next" : undefined} aria-label="تعمیر شد" disabled={disabled} onClick={() => go("repaired", "work")}>
                      {stageDriven ? "تعمیر شد، ادامه به فاکتور" : "تعمیر شد"}
                    </button>
                  )}
                  {(data.permissions.refer && operationsPolicy?.handover !== "disabled" && item.productProfile !== "solo") && (
                    <button
                      disabled={disabled || !!pending}
                      onClick={() => go("refer", "work")}
                    >
                      ارجاع به تکنسین دیگر
                    </button>
                  )}
                  {data.permissions.finish && (
                    <button
                      className={stageDriven ? "tech-v7-danger" : undefined}
                      disabled={disabled}
                      onClick={() => go("unrepaired", "work")}
                    >
                      اعلام عدم امکان تعمیر
                    </button>
                  )}
                </div>
              )}
              {!stageDriven && <><h3>گزارش‌های ثبت‌شده</h3>{timeline(true)}</>}
            </section>
          ) : null}
          {screen === "parts" ? (
            <section className="tech-task">
              <h3>{titles.parts}</h3>
              {stageDriven && stageRoot && canWrite && <button type="button" disabled={disabled} onClick={() => go("work", "parts")}>گزارش‌های پرونده</button>}
              <button type="button" onClick={() => go("purchases", "parts")}>خرید خارج از انبار</button>
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
                stockLines={draft.stockLines}
                onStockLines={(stockLines) => change({ stockLines, stockId: "", stockQuantity: "1" })}
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
          {screen === "purchases" && <section className="tech-task"><ExternalPurchasePanel key={caseId} caseId={caseId} actorId={actorId} canWrite={data.permissions.parts} onChanged={() => { void reload().catch(() => {}); }} /></section>}
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
                    {estimateInputs}
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
              ) : (data.permissions.refer && operationsPolicy?.handover !== "disabled" && item.productProfile !== "solo") ? (
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
                      نوع علت ارجاع
                      <select required value={draft.referReasonId} onChange={(e) => change({ referReasonId: e.target.value })}>
                        {(operationsPolicy?.reasons ?? [{ id: "other", title: "سایر موارد", active: true }])
                          .filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
                      </select>
                    </label>
                    <label>
                      علت ارجاع
                      <textarea
                        required={draft.referReasonId === "other"}
                        maxLength={800}
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
                    {screen === "unrepaired" && <label>دستهٔ علت پایان بدون تعمیر
                      <select value={draft.finishReasonCode} onChange={(event) => change({ finishReasonCode: event.target.value })}>
                        <option value="technical_failure">تعمیر ناموفق</option><option value="customer_cancelled">انصراف مشتری</option>
                        <option value="estimate_rejected">عدم تأیید هزینه</option><option value="part_unavailable">عدم تأمین قطعه</option>
                        <option value="uneconomical">عدم صرفه اقتصادی</option><option value="external_referral">ارجاع خارج از مجموعه</option><option value="other">سایر موارد</option>
                      </select>
                    </label>}
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
                        <h4>پیش‌نویس فاکتور</h4>
                        <p>سقف مجوز مشتری: {formatToman(String(data.invoice.authorizedAmount))} تومان</p>
                        {data.invoice.items.filter((line) => line.type !== "labor").map((line, index) => (
                          <div key={line.sourceKey ?? index}>
                            <p>{line.title} · {Number(line.quantity).toLocaleString("fa-IR")} · {formatToman(String(line.lineTotal))} تومان</p>
                            {line.sourceKey && data.invoice.mayEditPartPrices && (
                              <label>قیمت فروش {line.title}<MoneyInput value={draft.invoicePrices[line.sourceKey] ?? String(line.saleUnitPrice)} onChange={(amount) =>
                                change({ invoicePrices: { ...draft.invoicePrices, [line.sourceKey!]: amount } })} /></label>
                            )}
                          </div>
                        ))}
                        <label>اجرت تعمیر<MoneyInput value={draft.invoiceLabor !== "" ? draft.invoiceLabor : String(data.invoice.items.filter((line) => line.type === "labor").reduce((sum, line) => sum + line.lineTotal, 0))}
                          onChange={(invoiceLabor) => change({ invoiceLabor })} /></label>
                        <label>عنوان هزینهٔ اضافه<input value={draft.invoiceExtraTitle} onChange={(e) => change({ invoiceExtraTitle: e.target.value })} /></label>
                        <label>مبلغ هزینهٔ اضافه<MoneyInput value={draft.invoiceExtraAmount} onChange={(invoiceExtraAmount) => change({ invoiceExtraAmount })} /></label>
                        <p><strong>جمع پیش‌نویس: {formatToman(invoiceTotal)} تومان</strong></p>
                        {!extraValid && <p className="tech-hint">عنوان و مبلغ هزینهٔ اضافه را کامل یا پاک کنید.</p>}
                        {invoiceTotal > data.invoice.authorizedAmount && (
                          <p className="tech-hint">مبلغ از مجوز مشتری بالاتر است. <button type="button" onClick={() => go("estimate", screen)}>اصلاح برآورد</button></p>
                        )}
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
                        {screen === "repaired" && <dl>
                          <dt>فروش قطعات</dt><dd>{formatToman(invoiceTotals.part)} تومان</dd>
                          <dt>اجرت تعمیر</dt><dd>{formatToman(invoiceTotals.labor)} تومان</dd>
                          <dt>عیب‌یابی و سایر هزینه‌ها</dt><dd>{formatToman(invoiceTotals.diagnostic + invoiceTotals.other)} تومان</dd>
                          <dt>مبلغ دارای مجوز</dt><dd>{formatToman(data.invoice.authorizedAmount)} تومان</dd>
                          <dt>مبلغ نهایی فاکتور</dt><dd>{formatToman(invoiceTotal)} تومان</dd>
                        </dl>}
                        <button className="tech-primary" type="submit" disabled={screen === "repaired" && (!extraValid || invoiceTotal > data.invoice.authorizedAmount)}>
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
                          (screen === "repaired" && (!data.cost.authorized || !extraValid || invoiceTotal > data.invoice.authorizedAmount))
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
                <button onClick={() => {
                  sessionStorage.setItem("tamiran:focused-module-receipt", item.receiptNumber);
                  onNavigate("مالی پرونده");
                }}>
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
      {stageDriven && item && data && <dialog className="tech-handover-dialog tech-v7-summary-dialog" ref={summary} aria-labelledby="tech-v7-summary-title">
        <header className="tech-v7-dialog-header">
          <h2 id="tech-v7-summary-title">خلاصه عملیاتی پرونده</h2>
          <button type="button" className="tech-v7-ghost" aria-label="بستن خلاصه" onClick={() => summary.current?.close()}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="tech-v7-callout"><strong>{item.deviceTitle}</strong> · <bdi>{item.receiptNumber}</bdi><p>{item.technicianView.statusLabel}</p></div>
        <dl className="tech-v7-summary-grid">
          <div><dt>مسئول پرونده</dt><dd>{item.technicianName || "تخصیص داده نشده"}</dd></div>
          <div><dt>موعد برآوردی</dt><dd>{date(item.promisedAt)}</dd></div>
          <div><dt>مبلغ دارای مجوز</dt><dd>{formatToman(data.invoice.authorizedAmount)} تومان</dd></div>
          <div><dt>آخرین کنترل کیفیت</dt><dd>{data.summary?.qcResult ?? "انجام نشده"}</dd></div>
        </dl>
        <section className="tech-v7-summary-section"><h4>ایراد اعلام‌شده در پذیرش</h4><p>{item.declaredIssue}</p>{data.receptionNotes && <p>{data.receptionNotes}</p>}</section>
        <section className="tech-v7-summary-section"><h4>ایرادهای تشخیص‌داده‌شده</h4>{data.summary?.diagnosedIssues.length ? <ul>{data.summary.diagnosedIssues.map((issue, i) => <li key={i}>{issue}</li>)}</ul> : <p>ایراد جدیدی ثبت نشده است.</p>}</section>
        <section className="tech-v7-summary-section"><h4>عملیات فنی</h4>{data.activities.activities.length ? <ul>{data.activities.activities.map((activity) => <li key={activity.id}>{activity.description} · {activity.actorName}</li>)}</ul> : <p>هنوز اقدامی ثبت نشده است.</p>}</section>
        <section className="tech-v7-summary-section"><h4>قطعات و تعهدات</h4>{data.parts.length ? <ul>{data.parts.map((part) => <li key={part.sourceKey}>{part.title} · {Number(part.quantity).toLocaleString("fa-IR")} عدد</li>)}</ul> : <p>قطعه‌ای مصرف نشده است.</p>}{item.blockers.parts.map((blocker) => <p key={blocker}>{blocker}</p>)}</section>
      </dialog>}
    </article>
  );
}
