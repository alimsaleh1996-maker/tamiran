"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  loadCustomerPortal,
  requestCustomerPortalOtp,
  verifyCustomerPortalOtp,
  type CustomerPortalPayload,
} from "./directadmin-api";
import { FollowUpApiError } from "./followups-api";

const statusLabels: Record<string, string> = {
  reception: "پذیرش‌شده",
  awaiting_assignment: "در انتظار ارجاع",
  assigned: "ارجاع به تکنسین",
  diagnosing: "در حال بررسی",
  estimate_pending: "در انتظار برآورد",
  awaiting_customer_approval: "منتظر تأیید شما",
  awaiting_parts: "منتظر قطعه",
  repairing: "در حال تعمیر",
  parts_closeout: "تکمیل قطعات",
  qc_pending: "در کنترل کیفیت",
  qc_rework: "بازکاری فنی",
  qc_conditional: "کنترل کیفیت مشروط",
  finance_pending: "تکمیل مالی",
  ready_for_delivery: "آماده تحویل",
  returned_unrepaired: "مختومه بدون تعمیر",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
  closed: "بسته‌شده",
};

function normalizeDigits(value: string) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return value
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/\D/g, "");
}

function portalError(error: unknown) {
  if (error instanceof FollowUpApiError)
    return `${error.message}${error.trackingCode ? ` · کد رهگیری ${error.trackingCode}` : ""}`;
  return "ارتباط با سامانه انجام نشد؛ دوباره تلاش کنید.";
}

function money(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric)
    ? `${new Intl.NumberFormat("fa-IR").format(numeric)} ریال`
    : "—";
}

export function CustomerPortal({ onExit }: { onExit: () => void }) {
  const initialToken =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("portal")?.trim() ??
        "");
  const [token, setToken] = useState(initialToken);
  const [payload, setPayload] = useState<CustomerPortalPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(initialToken));
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [mobile, setMobile] = useState("");
  const [requestId, setRequestId] = useState("");
  const [otp, setOtp] = useState("");

  const load = useCallback(async (secureToken: string) => {
    setLoading(true);
    setError("");
    try {
      setPayload(await loadCustomerPortal(secureToken));
    } catch (caught) {
      setPayload(null);
      setError(portalError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [load, token]);

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const receiptDigits = normalizeDigits(receipt);
    const mobileDigits = normalizeDigits(mobile);
    if (receiptDigits.length !== 12 || !/^09\d{9}$/.test(mobileDigits)) {
      setError("شماره پذیرش ۱۲ رقمی و موبایل ۱۱ رقمی را کامل وارد کنید.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await requestCustomerPortalOtp(
        receiptDigits,
        mobileDigits,
      );
      setReceipt(`${receiptDigits.slice(0, 6)}-${receiptDigits.slice(6)}`);
      setMobile(mobileDigits);
      setRequestId(result.requestId);
    } catch (caught) {
      setError(portalError(caught));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const otpDigits = normalizeDigits(otp);
    if (otpDigits.length !== 6) {
      setError("کد یک‌بارمصرف شش‌رقمی را وارد کنید.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await verifyCustomerPortalOtp(
        receipt,
        mobile,
        requestId,
        otpDigits,
      );
      window.history.replaceState({}, "", result.relativeUrl);
      setToken(result.token);
    } catch (caught) {
      setError(portalError(caught));
    } finally {
      setLoading(false);
    }
  };

  const leave = () => {
    window.history.replaceState({}, "", window.location.pathname);
    onExit();
  };

  if (token && loading && !payload)
    return (
      <main className="customer-portal-shell">
        <div className="customer-portal-loader">
          <LoaderCircle className="is-spinning" />
          <strong>در حال بازکردن پرونده امن...</strong>
        </div>
      </main>
    );

  return (
    <main className="customer-portal-shell">
      <header className="customer-portal-topbar">
        <div>
          <span>
            <Wrench size={21} />
          </span>
          <strong>تعمیران</strong>
          <small>پیگیری امن تعمیر</small>
        </div>
        <button type="button" onClick={leave}>
          <ArrowRight size={17} /> ورود کارکنان
        </button>
      </header>

      {payload ? (
        <section className="customer-portal-card portal-case-view">
          <div className="portal-case-heading">
            <div>
              <small>شماره پذیرش</small>
              <h1 dir="ltr">{payload.receiptNumber}</h1>
              <p>{payload.customerName}</p>
            </div>
            <span>
              <ShieldCheck size={20} /> لینک امن و احرازشده
            </span>
          </div>
          <div className="portal-status-card">
            <span>
              <Clock3 size={20} />
            </span>
            <div>
              <small>وضعیت فعلی</small>
              <strong>{statusLabels[payload.status] ?? payload.status}</strong>
            </div>
            <CheckCircle2 size={22} />
          </div>
          <div className="portal-case-grid">
            <article>
              <Smartphone size={19} />
              <small>دستگاه</small>
              <strong>{payload.deviceTitle}</strong>
            </article>
            <article>
              <FileText size={19} />
              <small>ایراد اعلامی</small>
              <strong>{payload.declaredIssue}</strong>
            </article>
          </div>
          {payload.operationReport && (
            <article className="portal-report">
              <small>گزارش تعمیرگاه</small>
              <p>{payload.operationReport}</p>
            </article>
          )}
          {(payload.estimate || payload.invoice) && (
            <div className="portal-financial-row">
              {payload.estimate && (
                <div>
                  <small>برآورد ثبت‌شده</small>
                  <strong>{money(payload.estimate["total_amount"])}</strong>
                </div>
              )}
              {payload.invoice && (
                <div>
                  <small>مبلغ فاکتور</small>
                  <strong>{money(payload.invoice["total_amount"])}</strong>
                </div>
              )}
            </div>
          )}
          <p className="portal-security-note">
            <LockKeyhole size={16} /> شماره پذیرش به‌تنهایی دسترسی ایجاد
            نمی‌کند؛ این صفحه با لینک امن یا کد یک‌بارمصرف باز شده است.
          </p>
        </section>
      ) : (
        <section className="customer-portal-card portal-recovery-card">
          <div className="portal-recovery-heading">
            <span>
              <LockKeyhole size={27} />
            </span>
            <div>
              <small>دسترسی امن مشتری</small>
              <h1>پیگیری تعمیر</h1>
              <p>
                شماره پذیرش و موبایل ثبت‌شده را وارد کنید؛ سپس کد یک‌بارمصرف
                برای شما ارسال می‌شود.
              </p>
            </div>
          </div>
          {error && (
            <div className="portal-error" role="alert">
              {error}
            </div>
          )}
          {!requestId ? (
            <form onSubmit={requestOtp} className="portal-recovery-form">
              <label>
                <span>شماره پذیرش</span>
                <div>
                  <FileText size={18} />
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    value={receipt}
                    onChange={(event) => setReceipt(event.target.value)}
                    placeholder="482731-001284"
                  />
                </div>
              </label>
              <label>
                <span>شماره موبایل</span>
                <div>
                  <Phone size={18} />
                  <input
                    dir="ltr"
                    inputMode="tel"
                    maxLength={11}
                    value={mobile}
                    onChange={(event) =>
                      setMobile(
                        normalizeDigits(event.target.value).slice(0, 11),
                      )
                    }
                    placeholder="09xxxxxxxxx"
                  />
                </div>
              </label>
              <button disabled={loading}>
                {loading ? (
                  <LoaderCircle className="is-spinning" size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
                ارسال کد یک‌بارمصرف
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="portal-recovery-form">
              <div className="portal-otp-sent">
                کد برای شماره <b dir="ltr">{mobile}</b> ارسال شد.
              </div>
              <label>
                <span>کد یک‌بارمصرف</span>
                <div>
                  <KeyRound size={18} />
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(normalizeDigits(event.target.value).slice(0, 6))
                    }
                    autoFocus
                  />
                </div>
              </label>
              <button disabled={loading}>
                {loading ? (
                  <LoaderCircle className="is-spinning" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                تأیید و مشاهده پرونده
              </button>
              <button
                type="button"
                className="portal-secondary"
                onClick={() => {
                  setRequestId("");
                  setOtp("");
                  setError("");
                }}
              >
                <RefreshCw size={16} /> اصلاح اطلاعات
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
