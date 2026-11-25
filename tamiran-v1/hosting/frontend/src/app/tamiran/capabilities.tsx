"use client";

import {
  CheckCircle2,
  Clock3,
  LockKeyhole,
  PackagePlus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import {
  recordCapabilityEvent,
  requestModuleActivation,
  type CapabilitySnapshot,
} from "./directadmin-api";
import { FollowUpApiError } from "./followups-api";

const stateLabels: Record<string, string> = {
  active: "فعال",
  trial: "آزمایشی",
  locked: "فعال نیست",
  expired: "اعتبار پایان یافته",
  suspended: "تعلیق‌شده",
};

export function CapabilityCatalog({
  snapshot,
  loading,
  onRefresh,
  notify,
}: {
  snapshot: CapabilitySnapshot | null;
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  notify: (message: string) => void;
}) {
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(() => new Set());
  const modules = (snapshot?.modules ?? []).filter(
    (item) => item.catalog === "visible",
  );

  useEffect(() => {
    const firstVisibleModule = modules[0]?.module;
    if (!snapshot?.generatedAt || !firstVisibleModule) return;
    void recordCapabilityEvent(firstVisibleModule, "module_catalog_opened", {
      surface: "module_catalog",
    }).catch(() => undefined);
    // Module keys are stable for the lifetime of the loaded snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.generatedAt]);

  useEffect(() => {
    modules.forEach((item) => {
      void recordCapabilityEvent(item.module, "module_card_viewed", {
        surface: "module_catalog",
      }).catch(() => undefined);
    });
    // Module keys are stable for the lifetime of the loaded snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.generatedAt]);

  const request = async (module: string) => {
    setRequesting(module);
    try {
      void recordCapabilityEvent(module, "module_upgrade_cta_clicked", {
        surface: "module_catalog",
      }).catch(() => undefined);
      await requestModuleActivation(module);
      setRequested((current) => new Set(current).add(module));
      notify(
        "درخواست فعال‌سازی ثبت شد؛ نتیجه از مسیر پشتیبانی تجاری پیگیری می‌شود.",
      );
    } catch (error) {
      notify(
        error instanceof FollowUpApiError
          ? error.message
          : "ثبت درخواست فعال‌سازی انجام نشد.",
      );
    } finally {
      setRequesting(null);
    }
  };

  return (
    <div className="capability-catalog-page">
      <header className="module-header capability-catalog-header">
        <div className="module-header-copy">
          <div className="module-title-icon">
            <Sparkles size={26} />
          </div>
          <div>
            <span className="module-eyebrow">ویترین قابلیت‌ها</span>
            <h2>افزودن قابلیت</h2>
            <p>
              ماژول‌های غیرفعال از منوی عملیاتی حذف شده‌اند و فقط مدیر می‌تواند
              آنها را اینجا بررسی کند.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="outline-action"
          onClick={() => void onRefresh()}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "is-spinning" : ""} />
          تازه‌سازی
        </button>
      </header>
      <div className="capability-separation-note">
        <ShieldCheck size={20} />
        <div>
          <strong>دسترسی عملیاتی از فروش جداست</strong>
          <p>
            فعال‌بودن ماژول، مجوز نقش و امکان مشاهده تجاری مستقل بررسی می‌شوند.
            درخواست از این صفحه به معنی فعال‌سازی فوری یا پرداخت نیست.
          </p>
        </div>
      </div>
      <section className="capability-card-grid">
        {modules.map((item) => (
          <article className="capability-card" key={item.module}>
            <header>
              <span>
                <PackagePlus size={22} />
              </span>
              <div>
                <h3>{item.label}</h3>
                <em className={`capability-state state-${item.entitlement}`}>
                  {item.entitlement === "expired" ? (
                    <Clock3 size={14} />
                  ) : (
                    <LockKeyhole size={14} />
                  )}
                  {stateLabels[item.entitlement] ?? item.entitlement}
                </em>
              </div>
            </header>
            <p>{item.description}</p>
            {item.entitlement === "expired" && (
              <small>
                اطلاعات قبلی حفظ شده است؛ عملیات جدید تا فعال‌سازی دوباره قفل
                می‌ماند.
              </small>
            )}
            <button
              type="button"
              className="primary-action"
              disabled={
                requesting === item.module || requested.has(item.module)
              }
              onClick={() => void request(item.module)}
            >
              {requested.has(item.module) ? (
                <>
                  <CheckCircle2 size={17} />
                  درخواست ثبت شد
                </>
              ) : (
                <>
                  <Send size={17} />
                  {requesting === item.module
                    ? "در حال ثبت..."
                    : "درخواست فعال‌سازی"}
                </>
              )}
            </button>
          </article>
        ))}
        {!loading && modules.length === 0 && (
          <div className="capability-empty">
            <CheckCircle2 size={30} />
            <strong>قابلیت قابل‌درخواست دیگری وجود ندارد</strong>
            <p>منوی اصلی فقط ابزارهای فعال و مجاز را نمایش می‌دهد.</p>
          </div>
        )}
      </section>
    </div>
  );
}
