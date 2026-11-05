"use client";

import {
  Building2,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Phone,
  RefreshCw,
  ShieldCheck,
  Store,
  Wrench,
} from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import {
  changeInitialPassword,
  completeLogin,
  identifyLogin,
  type ServerActor,
} from "./directadmin-api";
import { directAdminApiEnabled, FollowUpApiError } from "./followups-api";

export type WorkspaceProfile = {
  actorId: number;
  displayName: string;
  shopName: string;
  shopCode: string;
  publicShopCode?: string;
  branchId?: number;
  branchCode?: string;
  branch: string;
  size: string;
  plan: string;
  services: string[];
  modules: string[];
  compactMode: boolean;
  role: string;
  isCentralAdmin: boolean;
  repairType?: string;
  expiresAt?: string;
  licenseStatus?: string;
  nationalCodeRequired?: boolean;
  shopId?: number;
  permissions: string[];
  productProfile?: "solo" | "pro";
  inventoryMode?: "off" | "simple" | "pro";
  qcMode?: "off" | "simple" | "independent";
};

const planLabels: Record<string, string> = {
  light: "پایه",
  professional: "حرفه‌ای",
  business: "سازمانی",
};
const repairTypeLabels: Record<string, string> = {
  digital: "کالای دیجیتال",
  appliance: "لوازم خانگی",
  automotive: "خودرو",
  motorcycle: "موتورسیکلت",
  generic: "تعمیرگاه عمومی",
};

function accessErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FollowUpApiError)
    return `${error.message}${error.trackingCode ? ` · کد رهگیری ${error.trackingCode}` : ""}`;
  return fallback;
}

function normalizeMobile(value: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return value
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/\D/g, "")
    .slice(0, 11);
}

export function profileFromActor(actor: ServerActor): WorkspaceProfile {
  return {
    actorId: actor.id,
    displayName: actor.displayName,
    shopName: actor.shop?.name ?? "پنل مدیر تعمیران",
    shopCode: actor.shop?.code ?? "TAMIRAN",
    publicShopCode: actor.shop?.publicCode,
    branchId: actor.branch?.id,
    branchCode: actor.branch?.code,
    branch: actor.branch?.name ?? "مرکز سامانه",
    size: actor.shop ? "متناسب با اشتراک" : "مدیریت مرکزی",
    plan: actor.shop
      ? (planLabels[actor.shop.plan] ?? "سفارشی")
      : "مدیریت پلتفرم",
    services: actor.shop
      ? [repairTypeLabels[actor.shop.repairType] ?? "تعمیرگاه"]
      : ["تمام تعمیرگاه‌ها"],
    modules: actor.shop?.modules ?? [],
    compactMode: false,
    role: actor.role,
    isCentralAdmin: actor.isCentralAdmin,
    repairType: actor.shop?.repairType,
    expiresAt: actor.shop?.expiresAt,
    licenseStatus: actor.shop?.licenseStatus,
    nationalCodeRequired: actor.shop?.nationalCodeRequired,
    shopId: actor.shop?.id,
    permissions: actor.permissions ?? [],
    productProfile: actor.shop?.productProfile,
    inventoryMode: actor.shop?.inventoryMode,
    qcMode: actor.shop?.qcMode,
  };
}

export function AccessSessionLoader() {
  return (
    <main className="access-session-loader">
      <div>
        <span>
          <LoaderCircle size={25} />
        </span>
        <strong>در حال بازیابی ورود امن...</strong>
        <small>فضای کاری شما آماده می‌شود.</small>
      </div>
    </main>
  );
}

export function AccessGateway({
  onAuthenticated,
}: {
  onAuthenticated: (profile: WorkspaceProfile) => void;
}) {
  const [step, setStep] = useState<"credentials" | "context" | "password">("credentials");
  const [pendingActor, setPendingActor] = useState<ServerActor | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaNonce, setCaptchaNonce] = useState(() => Date.now());
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaAudioFailed, setCaptchaAudioFailed] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setCaptchaReady(false);
    setCaptchaFailed(false);
    setCaptchaAudioFailed(false);
    void fetch(`/api/captcha.php?mode=init&v=${captchaNonce}`, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok || !payload.data?.audioAvailable) throw new Error("CAPTCHA unavailable");
        if (active) setCaptchaReady(true);
      })
      .catch(() => { if (active) setCaptchaFailed(true); });
    return () => { active = false; };
  }, [captchaNonce]);

  const refreshCaptcha = () => {
    setCaptchaAnswer("");
    setCaptchaReady(false);
    setCaptchaAudioFailed(false);
    setCaptchaFailed(false);
    setCaptchaNonce(Date.now());
  };

  const resetContext = () => {
    setStep("credentials");
    setChallenge("");
    setShopCode("");
    setBranchCode("");
    setError("");
  };

  const acceptActor = (actor: ServerActor) => {
    if (actor.mustChangePassword) {
      setPendingActor(actor);
      setStep("password");
      setPassword("");
      return;
    }
    onAuthenticated(profileFromActor(actor));
  };

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^09\d{9}$/.test(mobile) || password === "") {
      setError("شماره موبایل ۱۱ رقمی و رمز عبور را کامل کنید.");
      return;
    }
    if (!captchaReady || captchaAnswer.trim().length !== 5) {
      setError(captchaReady ? "عبارت امنیتی را از تصویر یا صدای فارسی وارد کنید." : "عبارت امنیتی آماده نیست؛ دوباره آن را دریافت کنید.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!directAdminApiEnabled)
        throw new FollowUpApiError(
          "ورود عملیاتی در خروجی DirectAdmin فعال می‌شود.",
        );
      const result = await identifyLogin(
        mobile,
        password,
        captchaAnswer.trim(),
      );
      if (result.actor) {
        acceptActor(result.actor);
        return;
      }
      if (result.requiresContext && result.challenge) {
        setChallenge(result.challenge);
        setStep("context");
        setPassword("");
        return;
      }
      throw new FollowUpApiError("ورود انجام نشد.");
    } catch (caught) {
      setError(accessErrorMessage(caught, "ورود انجام نشد."));
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const submitContext = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !/^\d{6}$/.test(shopCode) ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(branchCode)
    ) {
      setError("کد عمومی شش‌رقمی تعمیرگاه و کد شعبه را درست وارد کنید.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await completeLogin(challenge, shopCode, branchCode);
      if (!result.actor)
        throw new FollowUpApiError("تعمیرگاه یا شعبه برای این حساب مجاز نیست.");
      acceptActor(result.actor);
    } catch (caught) {
      setError(accessErrorMessage(caught, "ورود به شعبه انجام نشد."));
    } finally {
      setLoading(false);
    }
  };

  const submitInitialPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 15) {
      setError("رمز جدید باید حداقل ۱۵ کاراکتر و غیرقابل حدس باشد.");
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setError("تکرار رمز جدید یکسان نیست.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await changeInitialPassword(
        newPassword,
        passwordConfirmation,
      );
      onAuthenticated(profileFromActor(result.actor ?? pendingActor!));
    } catch (caught) {
      setError(accessErrorMessage(caught, "تغییر رمز انجام نشد."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="access-shell access-shell-simple">
      <section className="access-main-panel">
        <div className="access-card login-card">
          <div className="login-brand">
            <span>
              <Wrench size={24} />
            </span>
            <div>
              <strong>تعمیران</strong>
              <small>سامانه مدیریت تعمیرگاه</small>
            </div>
          </div>

          {step === "password" ? (
            <>
              <div className="access-card-heading compact-heading">
                <span><KeyRound size={24} /></span>
                <div>
                  <small>فعال‌سازی حساب مدیر</small>
                  <h2>رمز موقت را تغییر دهید</h2>
                  <p>برای ادامه، یک رمز شخصی و امن انتخاب کنید.</p>
                </div>
              </div>
              <form className="login-form" onSubmit={submitInitialPassword}>
                <label>
                  <span>رمز جدید</span>
                  <div>
                    <KeyRound size={18} />
                    <input dir="ltr" type="password" minLength={15} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" autoFocus />
                  </div>
                </label>
                <label>
                  <span>تکرار رمز جدید</span>
                  <div>
                    <ShieldCheck size={18} />
                    <input dir="ltr" type="password" minLength={15} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" />
                  </div>
                </label>
                {error && <div className="login-error" role="alert"><CircleAlert size={16} />{error}</div>}
                <button className="access-primary" disabled={loading}>
                  {loading ? "در حال فعال‌سازی..." : "ثبت رمز و ورود"}
                </button>
              </form>
            </>
          ) : step === "context" ? (
            <>
              <button
                type="button"
                className="access-back"
                onClick={resetContext}
              >
                <ChevronRight size={16} />
                بازگشت به ورود
              </button>
              <div className="access-card-heading compact-heading">
                <span>
                  <Building2 size={24} />
                </span>
                <div>
                  <small>مرحله دوم</small>
                  <h2>انتخاب فضای کاری</h2>
                  <p>این حساب به بیش از یک شعبه یا تعمیرگاه دسترسی دارد.</p>
                </div>
              </div>
              <form className="login-form" onSubmit={submitContext}>
                <label>
                  <span>کد عمومی تعمیرگاه</span>
                  <div>
                    <Store size={18} />
                    <input
                      dir="ltr"
                      inputMode="numeric"
                      value={shopCode}
                      onChange={(event) =>
                        setShopCode(
                          normalizeMobile(event.target.value).slice(0, 6),
                        )
                      }
                      placeholder="مثلاً ۴۸۲۷۳۱"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                </label>
                <label>
                  <span>کد شعبه</span>
                  <div>
                    <Building2 size={18} />
                    <input
                      dir="ltr"
                      value={branchCode}
                      onChange={(event) =>
                        setBranchCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9._-]/g, "")
                            .slice(0, 64),
                        )
                      }
                      placeholder="مثلاً MAIN"
                      maxLength={64}
                      autoComplete="off"
                    />
                  </div>
                </label>
                {error && (
                  <div className="login-error" role="alert">
                    <CircleAlert size={16} />
                    {error}
                  </div>
                )}
                <button className="access-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <LoaderCircle className="is-spinning" size={17} />
                      در حال بررسی...
                    </>
                  ) : (
                    "ورود به فضای کاری"
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="access-card-heading compact-heading">
                <span>
                  <LockKeyhole size={24} />
                </span>
                <div>
                  <small>ورود امن به تعمیران</small>
                  <h2>به حساب خود وارد شوید</h2>
                  <p>شماره موبایل، رمز عبور و عبارت امنیتی را وارد کنید.</p>
                </div>
              </div>
              <form className="login-form" onSubmit={submitCredentials}>
                <label>
                  <span>شماره موبایل</span>
                  <div>
                    <Phone size={18} />
                    <input
                      dir="ltr"
                      inputMode="tel"
                      value={mobile}
                      onChange={(event) =>
                        setMobile(normalizeMobile(event.target.value))
                      }
                      placeholder="09xxxxxxxxx"
                      maxLength={11}
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                </label>
                <label>
                  <span>رمز عبور</span>
                  <div>
                    <KeyRound size={18} />
                    <input
                      dir="ltr"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "پنهان‌کردن رمز" : "نمایش رمز"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <div className="captcha-field">
                  <label htmlFor="login-captcha-answer">عبارت امنیتی</label>
                  <div className="captcha-control">
                    {captchaFailed || !captchaReady ? (
                      <div className="captcha-fallback">
                        <ShieldCheck size={16} />
                        <span>{captchaFailed ? (captchaReady ? "تصویر نمایش داده نشد؛ از نسخه صوتی استفاده کنید." : "دریافت عبارت امنیتی انجام نشد؛ دوباره تلاش کنید.") : "در حال دریافت عبارت امنیتی..."}</span>
                      </div>
                    ) : (
                      // Captcha responses are intentionally dynamic and must never pass through an image optimizer cache.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/captcha.php?mode=image&v=${captchaNonce}`}
                        alt="تصویر عبارت امنیتی"
                        onError={() => setCaptchaFailed(true)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      aria-label="ساخت تصویر امنیتی جدید"
                    >
                      <RefreshCw size={17} />
                    </button>
                    <input
                      id="login-captcha-answer"
                      aria-describedby="login-captcha-help"
                      dir="ltr"
                      inputMode="numeric"
                      value={captchaAnswer}
                      onChange={(event) =>
                        setCaptchaAnswer(
                          normalizeMobile(event.target.value).slice(0, 5),
                        )
                      }
                      placeholder="عدد تصویر"
                      maxLength={5}
                      autoComplete="off"
                    />
                  </div>
                  <p id="login-captcha-help" className="field-helper">پنج رقم را از تصویر یا صدای فارسی وارد کنید.</p>
                  {captchaReady && (
                    <div className="captcha-audio">
                      <audio key={captchaNonce} controls preload="none" aria-label="پخش عبارت امنیتی به فارسی"
                        src={`/api/captcha.php?mode=audio&v=${captchaNonce}`} onError={() => setCaptchaAudioFailed(true)} />
                      <a href="/assets/captcha-audio-credits.txt" target="_blank" rel="noreferrer">منبع و مجوز صدای فارسی</a>
                    </div>
                  )}
                  {captchaAudioFailed && <p className="captcha-audio-status" role="alert">صدا دریافت نشد؛ عبارت امنیتی جدید بسازید و دوباره پخش کنید.</p>}
                </div>
                {error && (
                  <div className="login-error" role="alert">
                    <CircleAlert size={16} />
                    {error}
                  </div>
                )}
                <button className="access-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <LoaderCircle className="is-spinning" size={17} />
                      در حال ورود...
                    </>
                  ) : (
                    "ورود به سامانه"
                  )}
                </button>
              </form>
              <a className="customer-tracking-entry" href="?track=1">
                پیگیری تعمیر با شماره پذیرش
              </a>
              <div className="login-security-note">
                <ShieldCheck size={16} />
                <span>
                  نقش شما پس از ورود به‌صورت خودکار تشخیص داده می‌شود؛ نشست امن
                  و محدودیت تلاش ناموفق فعال است.
                </span>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
