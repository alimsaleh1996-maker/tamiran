import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { MoneyInput, formatToman } from "./money-input";
import { moneyDigits } from "./money";
import { directAdminRequest } from "./directadmin-api";
import { CaseToolsDisclosure } from "./case-tools";
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
} from "./v2-api";

const message = (e: unknown) =>
  e instanceof TypeError
    ? "ارتباط با سرور قطع شد؛ پیش‌نویس محفوظ است. دوباره تلاش کنید."
    : e instanceof Error
      ? e.message
      : "عملیات انجام نشد؛ دوباره تلاش کنید.";
const costLabels = {
  needs_estimate: "نیازمند اعلام هزینه",
  waiting_customer: "منتظر تأیید مشتری",
  approved: "مجوز هزینه معتبر",
  rejected: "برآورد رد شده",
  needs_revision: "نیازمند اصلاح برآورد",
};
const partLabels: Record<string, string> = {
  pending: "درخواست ثبت شد",
  reserved: "رزرو شده",
  partially_delivered: "تحویل ناقص",
  needs_supply: "منتظر تأمین",
  delivered: "تحویل تکنسین",
  consumed: "مصرف شد",
  returned: "مرجوع شد",
  rejected: "رد شد",
  cancelled: "لغو شد",
  awaiting_technician: "دریافت‌شده؛ تعیین تکلیف کنید",
};
const dataLabels = {
  no_erasure: "تعمیر بدون حذف داده",
  coordinate_first: "حذف داده فقط پس از هماهنگی و مجوز مشتری",
  erase_authorized: "حذف داده در صورت ضرورت مجاز است",
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(
        new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")),
      )
    : "تعیین نشده";
const blank = () => ({
  title: "",
  description: "",
  observation: "",
  attachments: [] as string[],
  labor: "",
  diagnostic: "",
  partTitle: "",
  quantity: "1",
  purchase: "",
  sale: "",
  partNote: "",
  stockId: "",
  stockQuantity: "1",
  report: "",
  reason: "",
  outcome: "repaired",
});
type Draft = ReturnType<typeof blank>;
export function TechnicalCaseWorkspace({
  caseId,
  initial,
  actorId,
  notify,
  onChanged,
}: {
  caseId: number;
  initial?: V2Case;
  actorId: number;
  notify: (message: string) => void;
  onChanged: (item: V2Case) => void;
}) {
  const storage = `tamiran:technical-draft:${actorId}:${caseId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return {
        ...blank(),
        ...JSON.parse(localStorage.getItem(storage) ?? "{}").draft,
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
  const [item, setItem] = useState(initial),
    [data, setData] = useState<TechnicalProjection | null>(null),
    [inventory, setInventory] = useState<V2InventoryPayload | null>(null),
    [stockError, setStockError] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState<{ area: string; text: string } | null>(null),
    [saved, setSaved] = useState(""),
    [stockQuery, setStockQuery] = useState(""),
    [source, setSource] = useState<"stock" | "manual">("manual"),
    [confirm, setConfirm] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false),
    alive = useRef(true),
    heading = useRef<HTMLHeadingElement>(null),
    estimatePanel = useRef<HTMLDetailsElement>(null),
    partsPanel = useRef<HTMLDetailsElement>(null);
  const persist = (next: Draft) => {
    localStorage.setItem(
      storage,
      JSON.stringify({ draft: next, keys: keys.current }),
    );
  };
  const change = (patch: Partial<Draft>) =>
    setDraft((old) => {
      const next = { ...old, ...patch };
      persist(next);
      return next;
    });
  const keyFor = (area: string, payload: unknown) => {
    const signature = JSON.stringify(payload);
    if (keys.current[area]?.signature !== signature)
      keys.current[area] = { signature, key: crypto.randomUUID() };
    persist(draft);
    return keys.current[area].key;
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
    onChanged(fresh);
    if (projection.permissions.stock) {
      try {
        const stock = await loadV2Inventory(caseId);
        if (alive.current) {
          setInventory(stock);
          setStockError("");
        }
      } catch (e) {
        if (alive.current)
          setStockError(e instanceof Error ? e.message : "موجودی دریافت نشد.");
      }
    }
  };
  useEffect(() => {
    alive.current = true;
    void reload().catch((e) => {
      if (alive.current)
        setError({
          area: "page",
          text: message(e),
        });
    });
    heading.current?.focus();
    return () => {
      alive.current = false;
    };
  }, [caseId]);
  const run = async (
    area: string,
    job: () => Promise<void>,
    refresh = true,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(area);
    setError(null);
    setSaved("");
    try {
      await job();
      setSaved("ذخیره شد");
      try {
        if (refresh) {
          await reload();
        }
      } catch {
        setError({
          area: "page",
          text: "عملیات ذخیره شد؛ دریافت اطلاعات تازه انجام نشد. تازه‌سازی کنید؛ پیش‌نویس محفوظ است.",
        });
      }
    } catch (e) {
      setError({
        area,
        text: message(e),
      });
    } finally {
      lock.current = false;
      setBusy("");
    }
  };
  const alert = (area: string) =>
    error?.area === area ? (
      <p role="alert" className="technical-error">
        {error.text}
      </p>
    ) : null;
  const transition = async (target: string) => {
    if (!item) return;
    const payload = { target, lockVersion: item.lockVersion };
    await workflowV2Action({
      action: "transition",
      caseId,
      target,
      lockVersion: item.lockVersion,
      idempotencyKey: keyFor("transition", payload),
    });
  };
  const record = () =>
    run("activity", async () => {
      const payload = {
        title: draft.title,
        description: draft.description,
        observation: draft.observation,
        attachments: draft.attachments,
      };
      await workflowV2Action({
        action: "technical_activity",
        caseId,
        ...payload,
        idempotencyKey: keyFor("activity", payload),
      });
      delete keys.current.activity;
      change({ title: "", description: "", observation: "", attachments: [] });
      notify("فعالیت مستقل در دفتر فنی ثبت شد.");
    });
  const estimate = () =>
    run("estimate", async () => {
      if (!data || !item) return;
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
          ...(data.cost.partsAmount > 0
            ? [
                {
                  type: "part",
                  title: "برآورد قطعات پرونده",
                  quantity: 1,
                  unitPrice: data.cost.partsAmount,
                  discountAmount: 0,
                  taxRate: 0,
                },
              ]
            : []),
        ],
        diagnosticFee: Number(draft.diagnostic || 0),
      };
      const result = await createV2Estimate({
        caseId,
        ...payload,
        idempotencyKey: keyFor("estimate", payload),
      });
      if (result.estimate.requiresCustomerApproval)
        await sendV2Estimate(result.estimate.publicId);
      // Refresh state before deciding a transition; a revised estimate never bypasses consent.
      const latest = (await loadV2Workflow(caseId)).cases[0];
      const target = result.estimate.requiresCustomerApproval
        ? "awaiting_customer_approval"
        : "repairing";
      if (
        latest &&
        latest.status !== target &&
        latest.allowedTransitions.includes(target)
      )
        await workflowV2Action({
          action: "transition",
          caseId,
          target,
          lockVersion: latest.lockVersion,
          idempotencyKey: `estimate-route:${result.estimate.publicId}`,
        });
      delete keys.current.estimate;
      change({ labor: "", diagnostic: "" });
      notify(
        result.estimate.requiresCustomerApproval
          ? "هزینه اعلام شد؛ ثبت پاسخ مشتری با نقش مجاز انجام می‌شود."
          : "برآورد در محدوده مجوز پذیرش ثبت شد.",
      );
    });
  const manual = () =>
    run("parts", async () => {
      const payload = {
        title: draft.partTitle,
        quantity: Number(moneyDigits(draft.quantity)),
        purchaseUnitCost: Number(draft.purchase || 0),
        saleUnitPrice: Number(draft.sale || 0),
        note: draft.partNote,
      };
      await workflowV2Action({
        action: "manual_part_add",
        caseId,
        ...payload,
        idempotencyKey: keyFor("manual", payload),
      });
      delete keys.current.manual;
      change({
        partTitle: "",
        quantity: "1",
        purchase: "",
        sale: "",
        partNote: "",
      });
    });
  const request = () =>
    run("parts", async () => {
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
    });
  const finish = () =>
    run("finish", async () => {
      if (!item) return;
      const payload = {
        result: draft.outcome,
        report: draft.report,
        reason: draft.reason,
      };
      await workflowV2Action({
        action: "technical_finish",
        caseId,
        ...payload,
        lockVersion: item.lockVersion,
        idempotencyKey: keyFor("finish", payload),
      });
      delete keys.current.finish;
      change({ report: "", reason: "" });
      setConfirm(false);
      notify("نتیجه ثبت شد و پرونده به مرحله بعدی مجاز رفت.");
    });
  const requests =
      inventory?.requests.filter((r) => r.case_id === caseId) ?? [],
    issues = inventory?.issues.filter((r) => r.case_id === caseId) ?? [];
  const active = !!data?.permissions.activity,
    anyBusy = !!busy;
  const primary = () => {
    if (!item || !data) return null;
    if (!active)
      return (
        <p>
          مسئولیت فنی در این مرحله پایان یافته است. سوابق برای پیگیری در
          دسترس‌اند.
        </p>
      );
    if (["assigned", "reception", "awaiting_assignment"].includes(item.status))
      return (
        <button
          className="primary-action"
          disabled={anyBusy}
          onClick={() => void run("phase", () => transition("diagnosing"))}
        >
          شروع بررسی
        </button>
      );
    if (item.status === "diagnosing")
      return (
        <button
          className="primary-action"
          disabled={anyBusy}
          onClick={() =>
            void run("phase", () => transition("estimate_pending"))
          }
        >
          اعلام هزینه پس از عیب‌یابی
        </button>
      );
    if (!data.cost.authorized)
      return (
        <button
          className="primary-action"
          disabled={anyBusy}
          onClick={() => {
            if (estimatePanel.current) {
              estimatePanel.current.open = true;
              estimatePanel.current.scrollIntoView({
                block: "center",
                behavior: "smooth",
              });
              estimatePanel.current
                .querySelector<HTMLInputElement>("input")
                ?.focus();
            }
          }}
        >
          {data.cost.state === "waiting_customer"
            ? "مشاهده برآورد و وضعیت تأیید"
            : "اعلام یا اصلاح هزینه"}
        </button>
      );
    if (item.status === "awaiting_parts" || item.status === "parts_closeout")
      return (
        <button
          className="primary-action"
          onClick={() => {
            if (partsPanel.current) {
              partsPanel.current.open = true;
              partsPanel.current.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
            }
          }}
        >
          تعیین تکلیف قطعات
        </button>
      );
    if (
      ["estimate_pending", "awaiting_customer_approval", "qc_rework"].includes(
        item.status,
      )
    )
      return (
        <button
          className="primary-action"
          disabled={anyBusy}
          onClick={() => void run("phase", () => transition("repairing"))}
        >
          ادامه تعمیر
        </button>
      );
    return (
      <a className="primary-action" href="#technical-new-activity">
        ثبت اقدام تعمیر
      </a>
    );
  };
  return (
    <article className="technical-case" aria-busy={anyBusy}>
      <header className="technical-case-heading">
        <div>
          <p>
            پروندهٔ فنی · رسید <bdi>{item?.receiptNumber ?? caseId}</bdi>
          </p>
          <h2 tabIndex={-1} ref={heading}>
            {item?.deviceTitle ?? "در حال دریافت دستگاه…"}
          </h2>
        </div>
        <button
          className="outline-action"
          disabled={anyBusy}
          onClick={() => void run("refresh", async () => {})}
        >
          <RefreshCw size={17} /> تازه‌سازی
        </button>
      </header>
      {alert("page")}
      <p className="technical-save" role="status">
        {busy ? (
          <>
            <LoaderCircle size={16} className="is-spinning" /> در حال ذخیره…
          </>
        ) : (
          saved
        )}
      </p>
      {item && data ? (
        <div className="technical-layout">
          <aside className="technical-summary">
            <span className="technical-state">
              {item.technicianView.statusLabel}
            </span>
            <h3>{item.customerName}</h3>
            <p className="technical-issue">{item.declaredIssue}</p>
            <dl>
              <div>
                <dt>تکنسین مسئول</dt>
                <dd>{item.technicianName || "تعیین نشده"}</dd>
              </div>
              <div>
                <dt>پذیرش</dt>
                <dd>{date(item.acceptedAt)}</dd>
              </div>
              <div>
                <dt>موعد تحویل</dt>
                <dd>{date(item.promisedAt)}</dd>
              </div>
            </dl>
            <p className="technical-permission">
              {dataLabels[item.dataHandling]}
            </p>
            <p className="technical-permission">
              <strong>{costLabels[data.cost.state]}</strong>
              <br />
              سقف پذیرش: {formatToman(String(item.preapprovedAmount))} تومان
            </p>
            <details>
              <summary>
                مشخصات و جزئیات دستگاه <ChevronDown size={15} />
              </summary>
              <p>
                شناسه: <bdi>{item.identifier || "در پذیرش ثبت نشده"}</bdi>
              </p>
              <p>
                نتیجه:{" "}
                {data.result === "not_repaired"
                  ? "تعمیر نشد"
                  : data.result === "repaired"
                    ? "تعمیر شد"
                    : "در حال بررسی"}
              </p>
              {data.report && <p>{data.report}</p>}
            </details>
            <div className="technical-primary">
              {primary()}
              {alert("phase")}
            </div>
          </aside>
          <div className="technical-operations">
            <section
              className="technical-section"
              aria-labelledby="technical-activity-title"
            >
              <header>
                <Wrench size={20} />
                <div>
                  <h3 id="technical-activity-title">دفتر فعالیت‌های فنی</h3>
                  <p>هر اقدام یک سابقهٔ مستقل است و مرحله را تغییر نمی‌دهد.</p>
                </div>
              </header>
              {active && (
                <form
                  id="technical-new-activity"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void record();
                  }}
                >
                  <fieldset disabled={anyBusy}>
                    <label>
                      عنوان فعالیت
                      <input
                        required
                        maxLength={240}
                        value={draft.title}
                        onChange={(e) => change({ title: e.target.value })}
                        placeholder="مثلاً تست مدار شارژ"
                      />
                    </label>
                    <label>
                      اقدام انجام‌شده
                      <textarea
                        required
                        maxLength={4000}
                        value={draft.description}
                        onChange={(e) =>
                          change({ description: e.target.value })
                        }
                        rows={3}
                      />
                    </label>
                    <details className="technical-optional">
                      <summary>نتیجه و پیوست اختیاری</summary>
                      <label>
                        نتیجه یا مشاهده <small>اختیاری</small>
                        <textarea
                          maxLength={4000}
                          value={draft.observation}
                          onChange={(e) =>
                            change({ observation: e.target.value })
                          }
                          rows={2}
                        />
                      </label>
                      <div className="technical-form-footer">
                        <label className="technical-upload">
                          <button
                            type="button"
                            className="outline-action"
                            onClick={() => fileInput.current?.click()}
                          >
                            افزودن پیوست
                          </button>
                          <input
                            ref={fileInput}
                            className="sr-only"
                            aria-label="پیوست فعالیت"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              void run("activity", async () => {
                                const form = new FormData();
                                form.set("file", file);
                                form.set("caseId", String(caseId));
                                form.set("purpose", "other");
                                const result = await directAdminRequest<{
                                  publicId: string;
                                }>(
                                  "/api/files-v2.php",
                                  { method: "POST", body: form },
                                  true,
                                );
                                change({
                                  attachments: [
                                    ...draft.attachments,
                                    result.publicId,
                                  ],
                                });
                              });
                            }}
                          />
                        </label>
                        <span>
                          {draft.attachments.length
                            ? `${draft.attachments.length.toLocaleString("fa-IR")} پیوست آماده`
                            : ""}
                        </span>
                      </div>
                      {draft.attachments.map((id, index) => (
                        <button
                          key={id}
                          type="button"
                          className="outline-action"
                          onClick={() =>
                            change({
                              attachments: draft.attachments.filter(
                                (x) => x !== id,
                              ),
                            })
                          }
                        >
                          حذف پیوست {(index + 1).toLocaleString("fa-IR")}
                        </button>
                      ))}
                    </details>
                    <div className="technical-form-footer">
                      <button className="primary-action" type="submit">
                        <Plus size={17} /> ثبت فعالیت
                      </button>
                    </div>
                    {alert("activity")}
                  </fieldset>
                </form>
              )}
              <ol className="technical-timeline">
                {data.activities.activities.map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{a.title}</strong>
                      <small>
                        {a.actorName} · {date(a.createdAt)}
                      </small>
                    </div>
                    <p>{a.description}</p>
                    {a.observation && (
                      <p className="technical-observation">
                        نتیجه: {a.observation}
                      </p>
                    )}
                    {a.attachments.map((id, i) => (
                      <a
                        key={id}
                        href={`/api/files-v2.php?id=${encodeURIComponent(id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        پیوست {(i + 1).toLocaleString("fa-IR")}
                      </a>
                    ))}
                  </li>
                ))}
              </ol>
              {!data.activities.activities.length && (
                <p className="technical-empty">
                  هنوز فعالیت مستقلی ثبت نشده است.
                </p>
              )}
              {data.activities.nextBeforeId && (
                <button
                  className="outline-action"
                  disabled={anyBusy}
                  onClick={() =>
                    void run(
                      "history",
                      async () => {
                        const more = await loadTechnicalActivities(
                          caseId,
                          data.activities.nextBeforeId!,
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
                      false,
                    )
                  }
                >
                  فعالیت‌های قدیمی‌تر
                </button>
              )}
              {alert("history")}
            </section>
            <details
              className="technical-section"
              ref={estimatePanel}
              open={
                item.status === "estimate_pending" ||
                item.status === "awaiting_customer_approval" ||
                data.cost.state === "needs_revision"
              }
            >
              <summary>
                <div>
                  <h3>هزینه و مجوز مشتری</h3>
                  <p>
                    {costLabels[data.cost.state]} ·{" "}
                    {formatToman(String(data.cost.totalAmount))} تومان
                  </p>
                </div>
                <ChevronDown size={19} />
              </summary>
              <div className="technical-detail-body">
                <p>
                  تکنسین هزینه را اعلام می‌کند. ثبت تصمیم مشتری فقط با نقش مجاز
                  و مستندات انجام می‌شود.
                </p>
                <dl className="technical-inline-facts">
                  <div>
                    <dt>قطعات پرونده</dt>
                    <dd>{formatToman(String(data.cost.partsAmount))} تومان</dd>
                  </div>
                  <div>
                    <dt>سقف مجاز پذیرش</dt>
                    <dd>{formatToman(String(data.cost.capAmount))} تومان</dd>
                  </div>
                </dl>
                {active && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void estimate();
                    }}
                  >
                    <fieldset disabled={anyBusy}>
                      <div className="technical-form-grid">
                        <label htmlFor="technical-labor">
                          اجرت پیشنهادی تعمیر
                          <MoneyInput
                            id="technical-labor"
                            value={draft.labor}
                            onChange={(labor) => change({ labor })}
                            required
                          />
                        </label>
                        <label htmlFor="technical-diagnostic">
                          هزینه عیب‌یابی
                          <MoneyInput
                            id="technical-diagnostic"
                            value={draft.diagnostic}
                            onChange={(diagnostic) => change({ diagnostic })}
                          />
                        </label>
                      </div>
                      <p>
                        مبلغ قطعات یک‌بار به برآورد اضافه می‌شود. برای تعمیر
                        رایگان، اجرت صفر وارد کنید.
                      </p>
                      <button type="submit" className="outline-action">
                        اعلام برآورد{" "}
                        {data.cost.estimatePublicId ? "جدید" : "هزینه"}
                      </button>
                      {alert("estimate")}
                    </fieldset>
                  </form>
                )}
              </div>
            </details>
            <details
              className="technical-section"
              ref={partsPanel}
              open={
                item.status === "awaiting_parts" ||
                item.status === "parts_closeout"
              }
            >
              <summary>
                <div>
                  <h3>قطعات همین دستگاه</h3>
                  <p>
                    {requests
                      .filter(
                        (r) =>
                          ![
                            "consumed",
                            "returned",
                            "cancelled",
                            "rejected",
                          ].includes(r.status),
                      )
                      .length.toLocaleString("fa-IR")}{" "}
                    درخواست باز · انبار و ثبت آزاد
                  </p>
                </div>
                <ChevronDown size={19} />
              </summary>
              <div className="technical-detail-body">
                {data.permissions.parts && (
                  <>
                    <div
                      className="technical-source"
                      role="group"
                      aria-label="روش تأمین قطعه"
                    >
                      <button
                        type="button"
                        aria-pressed={source === "manual"}
                        onClick={() => setSource("manual")}
                      >
                        ثبت آزاد
                      </button>
                      <button
                        type="button"
                        aria-pressed={source === "stock"}
                        onClick={() => setSource("stock")}
                      >
                        از انبار شعبه
                      </button>
                    </div>
                    {source === "manual" ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void manual();
                        }}
                      >
                        <fieldset disabled={anyBusy}>
                          <p>
                            قطعهٔ مصرف‌شده خارج از انبار؛ موجودی انبار تغییر
                            نمی‌کند.
                          </p>
                          <div className="technical-form-grid">
                            <label>
                              نام قطعه
                              <input
                                required
                                value={draft.partTitle}
                                onChange={(e) =>
                                  change({ partTitle: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              تعداد
                              <input
                                required
                                inputMode="decimal"
                                value={draft.quantity}
                                onChange={(e) =>
                                  change({
                                    quantity: moneyDigits(e.target.value),
                                  })
                                }
                              />
                            </label>
                            {data.permissions.purchase && (
                              <label htmlFor="technical-purchase">
                                قیمت خرید هر واحد
                                <MoneyInput
                                  id="technical-purchase"
                                  value={draft.purchase}
                                  onChange={(purchase) => change({ purchase })}
                                />
                              </label>
                            )}
                            <label htmlFor="technical-sale">
                              قیمت فروش هر واحد
                              <MoneyInput
                                id="technical-sale"
                                value={draft.sale}
                                onChange={(sale) => change({ sale })}
                                required
                              />
                            </label>
                          </div>
                          <label>
                            توضیح اختیاری
                            <input
                              value={draft.partNote}
                              onChange={(e) =>
                                change({ partNote: e.target.value })
                              }
                            />
                          </label>
                          <button type="submit" className="outline-action">
                            <Plus size={17} /> افزودن قطعه مصرفی
                          </button>
                        </fieldset>
                      </form>
                    ) : data.permissions.stock ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void request();
                        }}
                      >
                        <fieldset disabled={anyBusy || !inventory}>
                          <label>
                            جستجوی قطعه
                            <input
                              value={stockQuery}
                              onChange={(e) => setStockQuery(e.target.value)}
                              placeholder="نام یا کد قطعه"
                            />
                          </label>
                          <label>
                            قطعه انبار
                            <select
                              required
                              value={draft.stockId}
                              onChange={(e) =>
                                change({ stockId: e.target.value })
                              }
                            >
                              <option value="">
                                انتخاب قطعه از موجودی شعبه
                              </option>
                              {inventory?.items
                                .filter((p) =>
                                  `${p.title} ${p.item_code}`
                                    .toLocaleLowerCase()
                                    .includes(
                                      stockQuery.trim().toLocaleLowerCase(),
                                    ),
                                )
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.title} · موجودی آزاد{" "}
                                    {p.available_quantity.toLocaleString(
                                      "fa-IR",
                                    )}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            تعداد درخواست
                            <input
                              inputMode="numeric"
                              required
                              value={draft.stockQuantity}
                              onChange={(e) =>
                                change({
                                  stockQuantity: moneyDigits(e.target.value),
                                })
                              }
                            />
                          </label>
                          <button type="submit" className="outline-action">
                            ثبت درخواست از انبار
                          </button>
                          <p>
                            درخواست یا رزرو، مصرف نیست؛ پس از تحویل انباردار
                            مصرف یا مرجوعی را ثبت کنید.
                          </p>
                        </fieldset>
                        {stockError && (
                          <p role="alert" className="technical-error">
                            {stockError}
                          </p>
                        )}
                      </form>
                    ) : (
                      <p>
                        دسترسی تجاری انبار فعال نیست؛ ثبت آزاد در همین پرونده در
                        دسترس است.
                      </p>
                    )}
                  </>
                )}
                {alert("parts")}
                <ul className="technical-parts-list">
                  {requests
                    .filter(
                      (r) =>
                        ![
                          "consumed",
                          "returned",
                          "cancelled",
                          "rejected",
                        ].includes(r.status),
                    )
                    .map((r) => (
                      <li key={r.public_id}>
                        <div>
                          <strong>{r.item_title}</strong>
                          <small>
                            انبار · {partLabels[r.status] ?? r.status}
                          </small>
                          <p>
                            درخواست {r.quantity.toLocaleString("fa-IR")} · تحویل{" "}
                            {r.delivered_quantity.toLocaleString("fa-IR")} ·
                            مصرف {r.consumed_quantity.toLocaleString("fa-IR")} ·
                            مرجوع {r.returned_quantity.toLocaleString("fa-IR")}
                          </p>
                        </div>
                        {data.permissions.parts &&
                          ![
                            "consumed",
                            "returned",
                            "cancelled",
                            "rejected",
                          ].includes(r.status) && (
                            <button
                              className="outline-action"
                              disabled={anyBusy}
                              onClick={() =>
                                void run("parts", async () => {
                                  await inventoryV2Action({
                                    action: "cancel",
                                    requestId: r.id,
                                    warehouseId: inventory?.warehouse?.id,
                                    reason: "لغو مانده درخواست از پرونده فنی",
                                  });
                                })
                              }
                            >
                              لغو مانده درخواست
                            </button>
                          )}
                      </li>
                    ))}
                  {issues
                    .filter((i) => !["consumed", "returned"].includes(i.status))
                    .map((i) => (
                      <li key={i.public_id}>
                        <div>
                          <strong>
                            {i.item_title} ·{" "}
                            {i.quantity.toLocaleString("fa-IR")} عدد
                          </strong>
                          <small>{partLabels[i.status] ?? i.status}</small>
                        </div>
                        {active && i.technician_user_id === actorId && (
                          <div className="technical-row-actions">
                            {(["consumed", "returned"] as const).map(
                              (decision) => (
                                <button
                                  key={decision}
                                  disabled={anyBusy}
                                  className="outline-action"
                                  onClick={() =>
                                    void run("parts", async () => {
                                      await inventoryV2Action({
                                        action: "finalize_issue",
                                        issuePublicId: i.public_id,
                                        decision,
                                      });
                                    })
                                  }
                                >
                                  {decision === "consumed"
                                    ? "مصرف شد"
                                    : "مرجوع به انبار"}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  {data.parts.map((p) => (
                    <li key={p.sourceKey}>
                      <div>
                        <strong>{p.title}</strong>
                        <small>
                          {p.sourceType === "manual"
                            ? "ثبت آزاد · مصرف‌شده"
                            : "انبار · مصرف‌شده"}
                        </small>
                      </div>
                      <span>
                        {Number(p.quantity).toLocaleString("fa-IR")} ×{" "}
                        {formatToman(String(p.saleUnitPrice))} تومان
                      </span>
                    </li>
                  ))}
                </ul>
                {requests.some((r) =>
                  ["consumed", "returned", "cancelled", "rejected"].includes(
                    r.status,
                  ),
                ) && (
                  <details className="technical-optional">
                    <summary>درخواست‌های تعیین‌تکلیف‌شده</summary>
                    {requests
                      .filter((r) =>
                        [
                          "consumed",
                          "returned",
                          "cancelled",
                          "rejected",
                        ].includes(r.status),
                      )
                      .map((r) => (
                        <p key={r.public_id}>
                          {r.item_title} · {partLabels[r.status]} · تحویل{" "}
                          {r.delivered_quantity.toLocaleString("fa-IR")} · مرجوع{" "}
                          {r.returned_quantity.toLocaleString("fa-IR")}
                        </p>
                      ))}
                  </details>
                )}
                {!requests.length && !data.parts.length && (
                  <p className="technical-empty">
                    قطعه‌ای برای این پرونده ثبت نشده است.
                  </p>
                )}
                {item.blockers.parts.map((b) => (
                  <p className="technical-error" key={b}>
                    {b}
                  </p>
                ))}
              </div>
            </details>
            {data.permissions.finish &&
              !["assigned", "reception", "awaiting_assignment"].includes(
                item.status,
              ) && (
                <section className="technical-section technical-finish">
                  <h3>نتیجه نهایی تعمیر</h3>
                  <p>
                    سوابق فنی حفظ می‌شوند؛ انتقال پس از کنترل قطعات، مجوز هزینه
                    و مسیر مالی انجام می‌شود.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setConfirm(true);
                    }}
                  >
                    <fieldset disabled={anyBusy}>
                      <div
                        className="technical-source"
                        role="group"
                        aria-label="نتیجه تعمیر"
                      >
                        {[
                          { value: "repaired", label: "تعمیر شد" },
                          { value: "not_repaired", label: "تعمیر نشد" },
                        ].map((o) => (
                          <label key={o.value}>
                            <input
                              type="radio"
                              name="technical-outcome"
                              value={o.value}
                              checked={draft.outcome === o.value}
                              onChange={() => {
                                change({ outcome: o.value });
                                setConfirm(false);
                              }}
                            />
                            {o.label}
                          </label>
                        ))}
                      </div>
                      <label>
                        گزارش نهایی
                        <textarea
                          required
                          maxLength={8000}
                          rows={3}
                          value={draft.report}
                          onChange={(e) => {
                            change({ report: e.target.value });
                            setConfirm(false);
                          }}
                        />
                      </label>
                      {draft.outcome === "not_repaired" && (
                        <>
                          <label>
                            علت عدم تعمیر
                            <input
                              required
                              maxLength={1000}
                              value={draft.reason}
                              onChange={(e) => {
                                change({ reason: e.target.value });
                                setConfirm(false);
                              }}
                            />
                          </label>
                          <p>
                            بدون الزام QC به مالی یا صف تحویل می‌رود؛ فقط
                            عیب‌یابی و قطعات مصرف‌شده در فاکتور پیشنهادی
                            می‌ماند. ضمانت تعمیر ایجاد نمی‌شود.
                          </p>
                        </>
                      )}
                      {draft.outcome === "repaired" &&
                        !data.cost.authorized && (
                          <p className="technical-error">
                            ابتدا برآورد و مجوز هزینه را تکمیل کنید.
                          </p>
                        )}
                      {confirm ? (
                        <div className="technical-confirm">
                          <p>
                            نتیجه «
                            {draft.outcome === "repaired"
                              ? "تعمیر شد"
                              : "تعمیر نشد"}
                            » ثبت و مسئولیت فنی پایان یابد؟
                          </p>
                          <button
                            type="button"
                            className="primary-action"
                            onClick={() => void finish()}
                          >
                            <CheckCircle2 size={18} /> تأیید نتیجه و انتقال
                          </button>
                          <button
                            type="button"
                            className="outline-action"
                            onClick={() => setConfirm(false)}
                          >
                            بازگشت به ویرایش
                          </button>
                        </div>
                      ) : (
                        <button
                          type="submit"
                          className="outline-action"
                          disabled={
                            draft.outcome === "repaired" &&
                            !data.cost.authorized
                          }
                        >
                          ثبت نتیجه نهایی
                        </button>
                      )}
                      {alert("finish")}
                    </fieldset>
                  </form>
                </section>
              )}
            <CaseToolsDisclosure
              caseId={caseId}
              locked={!active}
              notify={notify}
            />
          </div>
        </div>
      ) : (
        <p role="status">در حال دریافت محیط کار دستگاه…</p>
      )}
    </article>
  );
}
