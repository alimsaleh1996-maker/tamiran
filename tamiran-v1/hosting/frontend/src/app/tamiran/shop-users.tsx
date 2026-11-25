"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import {
  createAdminUser,
  loadShopUsers,
  updateAdminUser,
  type ShopUser,
  type ShopUserData,
} from "./directadmin-api";
import "./shop-users.css";
import { normalizeQueueSearch } from "./queue-search";

const roles: Record<string, { label: string; description: string }> = {
  repair_manager: {
    label: "مدیر تعمیرگاه",
    description: "مدیریت کاربران و فعالیت‌های تعمیرگاه در شعب مجاز.",
  },
  reception: {
    label: "مسئول پذیرش",
    description: "پذیرش دستگاه، رسید و پیگیری مشتری.",
  },
  technician: {
    label: "تکنسین",
    description: "رسیدگی به پرونده‌های تخصیص‌یافته و درخواست قطعه.",
  },
  quality_control: {
    label: "کنترل کیفیت",
    description: "بررسی کیفیت تعمیر و ثبت نتیجهٔ آزمون‌ها.",
  },
  warehouse_keeper: {
    label: "انباردار",
    description: "رسیدگی به قطعات، موجودی و عملیات انبار.",
  },
  finance_cashier: {
    label: "مسئول مالی / صندوق",
    description: "رسیدگی به صورتحساب‌ها، پرداخت و امور صندوق.",
  },
};
const permissionGroups = [
  {
    id: "repair",
    title: "تعمیرات و برآورد",
    Icon: Wrench,
    match: (code: string) =>
      code.startsWith("case.") || code.startsWith("estimate."),
  },
  {
    id: "quality",
    title: "کنترل کیفیت",
    Icon: ShieldCheck,
    match: (code: string) => code.startsWith("qc."),
  },
  {
    id: "finance",
    title: "امور مالی",
    Icon: WalletCards,
    match: (code: string) => code.startsWith("finance."),
  },
  {
    id: "delivery",
    title: "تحویل دستگاه",
    Icon: PackageCheck,
    match: (code: string) => code.startsWith("delivery."),
  },
  {
    id: "inventory",
    title: "قطعات و انبار",
    Icon: Boxes,
    match: (code: string) =>
      code.startsWith("inventory.") || code.startsWith("part."),
  },
  {
    id: "purchase",
    title: "خرید و تأمین",
    Icon: ShoppingCart,
    match: (code: string) => code.startsWith("procurement."),
  },
  {
    id: "other",
    title: "سایر دسترسی‌ها",
    Icon: ShieldCheck,
    match: (code: string) =>
      !/^(case|estimate|qc|finance|delivery|inventory|part|procurement)\./.test(
        code,
      ),
  },
];
type Form = {
  id?: number;
  displayName: string;
  mobile: string;
  email: string;
  role: string;
  isActive: boolean;
  branchIds: number[];
  permissions: string[];
  password: string;
};
type Field = "displayName" | "mobile" | "email" | "password" | "branchIds";
const normalizeMobile = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(
      "۰۱۲۳۴۵۶۷۸۹".indexOf(digit) >= 0
        ? "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
        : "٠١٢٣٤٥٦٧٨٩".indexOf(digit),
    ),
  );
function fieldError(field: Field, form: Form): string {
  if (
    field === "email" &&
    form.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  )
    return "نشانی ایمیل معتبر وارد کنید یا این فیلد را خالی بگذارید.";
  if (field === "displayName" && !form.displayName.trim())
    return "نام و نام خانوادگی را وارد کنید.";
  if (field === "mobile" && !/^09\d{9}$/.test(normalizeMobile(form.mobile)))
    return "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.";
  if (field === "branchIds" && !form.branchIds.length)
    return "حداقل یک شعبه را انتخاب کنید.";
  if (field === "password") {
    if ((!form.id || form.password) && Array.from(form.password).length < 15)
      return "رمز عبور باید حداقل ۱۵ نویسه داشته باشد.";
    if (new TextEncoder().encode(form.password).length > 72)
      return "رمز بیش از حد طولانی است؛ از عبارت کوتاه‌تری استفاده کنید.";
  }
  return "";
}

export function ShopUserManagement({ onChanged }: { onChanged?: () => void }) {
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonsRef = useRef(new Map<number, HTMLButtonElement>());
  const returnToUserRef = useRef<number | undefined>(undefined);
  const [data, setData] = useState<ShopUserData | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [permissionsChanged, setPermissionsChanged] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showExtra, setShowExtra] = useState(false);
  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadShopUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت کاربران انجام نشد.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    loadShopUsers()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "دریافت کاربران انجام نشد.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (form) titleRef.current?.focus();
  }, [form?.id, Boolean(form)]);
  const edit = (user?: ShopUser) => {
    returnToUserRef.current = user?.id;
    setError("");
    setMessage("");
    setErrors({});
    setShowPassword(false);
    setPermissionsChanged(false);
    const permissions = (user?.permissions ?? []).filter(
      (code) => data && Object.hasOwn(data.permissionCatalog, code),
    );
    setForm({
      id: user?.id,
      displayName: user?.displayName ?? "",
      mobile: user?.phone ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "reception",
      isActive: user?.isActive ?? true,
      branchIds:
        user?.branchIds ?? (data?.branches[0] ? [data.branches[0].id] : []),
      permissions,
      password: "",
    });
    setExpanded(
      permissionGroups
        .filter((group) => permissions.some(group.match))
        .map((group) => group.id),
    );
    setShowExtra(permissions.length > 0);
  };
  const cancel = () => {
    setForm(null);
    setErrors({});
    setError("");
    setShowPassword(false);
    requestAnimationFrame(() => {
      const target = returnToUserRef.current
        ? editButtonsRef.current.get(returnToUserRef.current)
        : newButtonRef.current;
      if (target && !target.disabled) target.focus();
      else titleRef.current?.focus();
    });
  };
  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    if (key in errors) setErrors((current) => ({ ...current, [key]: "" }));
  };
  const validate = (field: Field) => {
    if (form)
      setErrors((current) => ({
        ...current,
        [field]: fieldError(field, form),
      }));
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || saving) return;
    setError("");
    setMessage("");
    const nextErrors = Object.fromEntries(
      (
        ["displayName", "mobile", "email", "password", "branchIds"] as Field[]
      ).map((field) => [field, fieldError(field, form)]),
    );
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    setSaving(true);
    try {
      const input = {
        displayName: form.displayName.trim(),
        mobile: normalizeMobile(form.mobile),
        email: form.email,
        role: form.role,
        isActive: form.isActive,
        branchIds: form.branchIds,
        ...(!form.id || permissionsChanged
          ? { permissions: form.permissions }
          : {}),
        ...(form.id
          ? { id: form.id, newPassword: form.password }
          : { password: form.password }),
      };
      if (form.id) await updateAdminUser(input);
      else await createAdminUser(input);
      setForm(null);
      setShowPassword(false);
      setMessage(
        "کاربر و دسترسی‌های او ذخیره شد. تغییرات در ورود بعدی کاربر اعمال می‌شوند.",
      );
      await reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره کاربر انجام نشد.");
    } finally {
      setSaving(false);
    }
  };
  const catalog = Object.entries(data?.permissionCatalog ?? {});
  const selectedCount = form?.permissions.length ?? 0;
  const filteredUsers =
    data?.users.filter((user) =>
      normalizeQueueSearch(`${user.displayName} ${user.phone}`).includes(
        normalizeQueueSearch(query),
      ),
    ) ?? [];
  const inputProps = (field: Field) => ({
    id: `${uid}-${field}`,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${uid}-${field}-error` : undefined,
    onBlur: () => validate(field),
  });
  const inlineError = (field: Field) =>
    errors[field] ? (
      <span className="su-field-error" id={`${uid}-${field}-error`}>
        {errors[field]}
      </span>
    ) : null;

  return (
    <section
      className="shop-user-management"
      aria-label="مدیریت کاربران تعمیرگاه"
    >
      <header className="su-header">
        <div>
          <span className="su-eyebrow">
            <UsersRound size={15} aria-hidden="true" /> مدیریت تیم
          </span>
          <h3 ref={titleRef} tabIndex={-1}>
            {form
              ? form.id
                ? "ویرایش کاربر"
                : "ایجاد کاربر جدید"
              : "کاربران تعمیرگاه"}
          </h3>
          <p>
            {form
              ? "اطلاعات حساب، نقش و شعب مجاز را مشخص کنید."
              : "اعضای تیم و دسترسی آن‌ها را در شعب تحت مدیریت خود تنظیم کنید."}
          </p>
        </div>
        {form ? (
          <button
            type="button"
            className="su-button su-button-secondary"
            onClick={cancel}
            disabled={saving}
          >
            <ArrowRight size={17} aria-hidden="true" />
            بازگشت به کاربران
          </button>
        ) : (
          <button
            ref={newButtonRef}
            type="button"
            className="su-button su-button-primary"
            disabled={
              !data || loading || saving || data.usedUsers >= data.maxUsers
            }
            onClick={() => edit()}
          >
            <Plus size={18} aria-hidden="true" />
            ایجاد کاربر
          </button>
        )}
      </header>
      {data && !form && (
        <div className="su-roster-toolbar">
          <label className="su-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="جست‌وجوی کاربران تعمیرگاه"
              placeholder="جست‌وجوی نام یا موبایل"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="su-capacity">
            {data.usedUsers.toLocaleString("fa-IR")} از{" "}
            {data.maxUsers.toLocaleString("fa-IR")} ظرفیت کاربر
          </span>
        </div>
      )}
      {error && (
        <div role="alert" className="su-notice su-notice-error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="su-notice su-notice-success">
          <Check size={18} aria-hidden="true" />
          {message}
        </div>
      )}
      {loading && (
        <p role="status" className="su-loading">
          در حال دریافت کاربران…
        </p>
      )}
      {!loading && !data && (
        <button
          type="button"
          className="su-button su-button-secondary"
          onClick={() => void reload()}
        >
          تلاش دوباره
        </button>
      )}
      {!form && data && (
        <div className="su-roster">
          <table>
            <caption className="sr-only">کاربران و نقش‌های تعمیرگاه</caption>
            <thead>
              <tr>
                <th scope="col">نام و موبایل</th>
                <th scope="col">نقش و شعبه</th>
                <th scope="col">وضعیت</th>
                <th scope="col">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td data-label="کاربر">
                    <span className="su-user-name">{user.displayName}</span>
                    <bdi className="su-user-phone">{user.phone}</bdi>
                  </td>
                  <td data-label="نقش و شعبه">
                    <span>{roles[user.role]?.label ?? user.role}</span>
                    <small>
                      {data.branches
                        .filter((branch) => user.branchIds.includes(branch.id))
                        .map((branch) => branch.name)
                        .join("، ")}
                    </small>
                  </td>
                  <td data-label="وضعیت">
                    <span
                      className={`su-status ${user.isActive ? "is-active" : ""}`}
                    >
                      <i aria-hidden="true" />
                      {user.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td>
                    {user.canEdit ? (
                      <button
                        ref={(button) => {
                          if (button)
                            editButtonsRef.current.set(user.id, button);
                          else editButtonsRef.current.delete(user.id);
                        }}
                        type="button"
                        className="su-button su-button-text"
                        onClick={() => edit(user)}
                        aria-label={`ویرایش ${user.displayName}`}
                      >
                        ویرایش کاربر
                      </button>
                    ) : (
                      <span className="su-self">حساب شما</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredUsers.length && (
            <p className="su-empty">
              {query
                ? "کاربری با این نام یا شماره پیدا نشد."
                : "هنوز کاربری در شعب تحت مدیریت شما ثبت نشده است."}
            </p>
          )}
        </div>
      )}
      {form && data && (
        <form
          ref={formRef}
          className="su-form"
          onSubmit={(event) => void save(event)}
          noValidate
          aria-label={
            form.id ? "ویرایش کاربر تعمیرگاه" : "ایجاد کاربر تعمیرگاه"
          }
        >
          <fieldset className="su-section" disabled={saving}>
            <legend>
              <span className="su-step">۱</span>اطلاعات حساب
            </legend>
            <p className="su-section-copy">
              نام و موبایل الزامی است. ایمیل را در صورت نیاز وارد کنید.
            </p>
            <div className="su-fields">
              <div className="su-field">
                <label htmlFor={`${uid}-displayName`}>
                  نام و نام خانوادگی <span aria-hidden="true">*</span>
                </label>
                <input
                  {...inputProps("displayName")}
                  aria-required="true"
                  autoComplete="name"
                  maxLength={180}
                  placeholder="مثلاً علی رضایی"
                  value={form.displayName}
                  onChange={(e) => update("displayName", e.target.value)}
                />
                {inlineError("displayName")}
              </div>
              <div className="su-field">
                <label htmlFor={`${uid}-mobile`}>
                  موبایل کاربر <span aria-hidden="true">*</span>
                </label>
                <input
                  {...inputProps("mobile")}
                  aria-required="true"
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={11}
                  placeholder="09xxxxxxxxx"
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                />
                {inlineError("mobile")}
              </div>
              <div className="su-field">
                <label htmlFor={`${uid}-email`}>
                  ایمیل <span className="su-optional">اختیاری</span>
                </label>
                <input
                  {...inputProps("email")}
                  dir="ltr"
                  type="email"
                  autoComplete="email"
                  maxLength={190}
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
                {inlineError("email")}
              </div>
              <div className="su-field">
                <label htmlFor={`${uid}-password`}>
                  {form.id ? "رمز جدید" : "رمز اولیه"}{" "}
                  {form.id ? (
                    <span className="su-optional">اختیاری</span>
                  ) : (
                    <span aria-hidden="true">*</span>
                  )}
                </label>
                <div className="su-password">
                  <input
                    {...inputProps("password")}
                    aria-required={!form.id}
                    aria-describedby={`${uid}-password-help${errors.password ? ` ${uid}-password-error` : ""}`}
                    dir="ltr"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={
                      form.id
                        ? "برای حفظ رمز فعلی، خالی بگذارید"
                        : "حداقل ۱۵ نویسه"
                    }
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "پنهان‌کردن رمز" : "نمایش رمز"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
                <small id={`${uid}-password-help`}>
                  {form.id
                    ? "با تعیین رمز جدید، کاربر در ورود بعدی باید آن را تغییر دهد."
                    : "کاربر در نخستین ورود باید رمز اولیه را تغییر دهد."}
                </small>
                {inlineError("password")}
              </div>
            </div>
          </fieldset>
          <fieldset className="su-section" disabled={saving}>
            <legend>
              <span className="su-step">۲</span>نقش و شعب مجاز
            </legend>
            <div className="su-fields su-role-fields">
              <div className="su-field">
                <label htmlFor={`${uid}-role`}>نقش کاربر</label>
                <select
                  id={`${uid}-role`}
                  aria-describedby={`${uid}-role-help`}
                  value={form.role}
                  onChange={(e) => {
                    update("role", e.target.value);
                    setPermissionsChanged(true);
                  }}
                >
                  {Object.entries(roles).map(([code, role]) => (
                    <option key={code} value={code}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <small id={`${uid}-role-help`}>
                  {roles[form.role]?.description}
                </small>
              </div>
              <div className="su-account-status">
                <div>
                  <strong>وضعیت حساب</strong>
                  <small>
                    {form.isActive
                      ? "کاربر می‌تواند وارد حساب خود شود."
                      : "ورود این کاربر غیرفعال خواهد بود."}
                  </small>
                </div>
                <label className="su-switch">
                  <input
                    aria-label="حساب فعال"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => update("isActive", e.target.checked)}
                  />
                  <span aria-hidden="true" />
                  <b>{form.isActive ? "فعال" : "غیرفعال"}</b>
                </label>
              </div>
            </div>
            <div className="su-branch-heading" id={`${uid}-branches-label`}>
              شعب مجاز{" "}
              <span className="su-counter">
                {form.branchIds.length.toLocaleString("fa-IR")} انتخاب‌شده
              </span>
            </div>
            <div
              className="su-branch-options"
              role="group"
              aria-labelledby={`${uid}-branches-label`}
            >
              {data.branches.map((branch, index) => (
                <label
                  className={`su-choice su-branch ${form.branchIds.includes(branch.id) ? "is-selected" : ""}`}
                  key={branch.id}
                >
                  <input
                    id={index === 0 ? `${uid}-branchIds` : undefined}
                    aria-invalid={Boolean(errors.branchIds)}
                    aria-describedby={
                      errors.branchIds ? `${uid}-branchIds-error` : undefined
                    }
                    type="checkbox"
                    checked={form.branchIds.includes(branch.id)}
                    onChange={(e) =>
                      update(
                        "branchIds",
                        e.target.checked
                          ? [...form.branchIds, branch.id]
                          : form.branchIds.filter((id) => id !== branch.id),
                      )
                    }
                  />
                  <span>
                    {branch.name}
                    {branch.isDefault && <small>شعبهٔ اصلی</small>}
                  </span>
                </label>
              ))}
            </div>
            {inlineError("branchIds")}
          </fieldset>
          <section
            className="su-section su-permissions"
            aria-label="دسترسی‌های تکمیلی"
          >
            <div className="su-permissions-heading">
              <div>
                <span className="su-step">۳</span>
                <h4>دسترسی‌های تکمیلی</h4>
              </div>
              <span className="su-counter">
                {selectedCount.toLocaleString("fa-IR")} دسترسی اضافه
              </span>
            </div>
            {form.role === "repair_manager" ? (
              <div className="su-role-note">
                <ShieldCheck size={22} aria-hidden="true" />
                <div>
                  <strong>دسترسی مدیریتی از نقش تأمین می‌شود</strong>
                  <p>
                    مدیر در شعب انتخاب‌شده اختیار مدیریتی دارد؛ نیازی به انتخاب
                    مجوزهای تکمیلی نیست.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="su-section-copy">
                  مجوزهای پایه از نقش «{roles[form.role]?.label}» می‌آیند. فقط
                  برای وظایف خارج از این نقش، دسترسی اضافه انتخاب کنید.
                </p>
                <button
                  className="su-extra-toggle"
                  type="button"
                  aria-expanded={showExtra}
                  aria-controls={`${uid}-extra-permissions`}
                  onClick={() => setShowExtra((value) => !value)}
                >
                  <ShieldCheck size={18} aria-hidden="true" />
                  <span>
                    {showExtra ? "بستن تنظیم دسترسی‌ها" : "افزودن دسترسی بیشتر"}
                  </span>
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
                {showExtra && (
                  <div
                    id={`${uid}-extra-permissions`}
                    className="su-permission-groups"
                  >
                    <p className="su-permission-hint">
                      برداشتن تیک، فقط دسترسی اضافه را حذف می‌کند؛ اختیارات
                      پایهٔ نقش تغییری نمی‌کند.
                    </p>
                    {permissionGroups.map((group) => {
                      const entries = catalog.filter(([code]) =>
                        group.match(code),
                      );
                      if (!entries.length) return null;
                      const count = entries.filter(([code]) =>
                        form.permissions.includes(code),
                      ).length;
                      const open = expanded.includes(group.id);
                      const Icon = group.Icon;
                      return (
                        <div
                          className={`su-permission-group ${open ? "is-open" : ""}`}
                          key={group.id}
                        >
                          <button
                            type="button"
                            className="su-group-toggle"
                            aria-expanded={open}
                            aria-controls={`${uid}-group-${group.id}`}
                            onClick={() =>
                              setExpanded((current) =>
                                open
                                  ? current.filter((id) => id !== group.id)
                                  : [...current, group.id],
                              )
                            }
                          >
                            <span className="su-group-icon">
                              <Icon size={19} aria-hidden="true" />
                            </span>
                            <strong>{group.title}</strong>
                            <span className="su-group-count">
                              {count
                                ? `${count.toLocaleString("fa-IR")} انتخاب`
                                : "بدون دسترسی اضافه"}
                            </span>
                            <ChevronDown size={17} aria-hidden="true" />
                          </button>
                          {open && (
                            <fieldset
                              className="su-permission-options"
                              id={`${uid}-group-${group.id}`}
                              disabled={saving}
                            >
                              <legend className="sr-only">{group.title}</legend>
                              {entries.map(([code, label]) => (
                                <label
                                  key={code}
                                  className={`su-choice ${form.permissions.includes(code) ? "is-selected" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={form.permissions.includes(code)}
                                    onChange={(e) => {
                                      setPermissionsChanged(true);
                                      update(
                                        "permissions",
                                        e.target.checked
                                          ? [...form.permissions, code]
                                          : form.permissions.filter(
                                              (permission) =>
                                                permission !== code,
                                            ),
                                      );
                                    }}
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </fieldset>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
          <footer className="su-form-actions">
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              تغییرات فقط برای شعب انتخاب‌شده اعمال می‌شود.
            </span>
            <div>
              <button
                className="su-button su-button-secondary"
                type="button"
                disabled={saving}
                onClick={cancel}
              >
                انصراف
              </button>
              <button
                className="su-button su-button-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "در حال ذخیره…" : "ذخیره کاربر"}
              </button>
            </div>
          </footer>
        </form>
      )}
    </section>
  );
}
