"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  createAdminUser,
  loadShopUsers,
  updateAdminUser,
  type ShopUser,
  type ShopUserData,
} from "./directadmin-api";

const roles: Record<string, string> = {
  repair_manager: "مدیر تعمیرگاه",
  reception: "مسئول پذیرش",
  technician: "تکنسین",
  quality_control: "کنترل کیفیت",
  warehouse_keeper: "انباردار",
  finance_cashier: "مسئول مالی / صندوق",
};
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

export function ShopUserManagement({ onChanged }: { onChanged?: () => void }) {
  const passwordHint = useId();
  const [data, setData] = useState<ShopUserData | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [permissionsChanged, setPermissionsChanged] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const edit = (user?: ShopUser) => {
    setError("");
    setMessage("");
    setPermissionsChanged(false);
    setForm({
      id: user?.id,
      displayName: user?.displayName ?? "",
      mobile: user?.phone ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "reception",
      isActive: user?.isActive ?? true,
      branchIds:
        user?.branchIds ?? (data?.branches[0] ? [data.branches[0].id] : []),
      permissions: user?.permissions ?? [],
      password: "",
    });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || saving) return;
    setError("");
    setMessage("");
    if (!form.branchIds.length) {
      setError("حداقل یک شعبه انتخاب کنید.");
      return;
    }
    if (new TextEncoder().encode(form.password).length > 72) {
      setError("رمز باید حداکثر ۷۲ بایت باشد؛ نویسه‌های فارسی چند بایت هستند.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        displayName: form.displayName,
        mobile: form.mobile,
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
      setMessage(
        "کاربر و دسترسی‌های او ذخیره شد. کاربر برای استفاده از تغییرات باید دوباره وارد شود.",
      );
      await reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره کاربر انجام نشد.");
    } finally {
      setSaving(false);
    }
  };
  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));
  return (
    <section
      className="shop-user-management"
      aria-label="مدیریت کاربران تعمیرگاه"
    >
      <div className="settings-section-head">
        <div>
          <h3>مدیریت کاربران تعمیرگاه</h3>
          <p>کاربران و شعب تحت مدیریت خودتان را مستقل مدیریت کنید.</p>
        </div>
        <button
          type="button"
          className="primary-action"
          disabled={
            !data || loading || saving || data.usedUsers >= data.maxUsers
          }
          onClick={() => edit()}
        >
          ایجاد کاربر
        </button>
      </div>
      {data && (
        <p>
          ظرفیت اشتراک: {data.usedUsers.toLocaleString("fa-IR")} از{" "}
          {data.maxUsers.toLocaleString("fa-IR")} کاربر
        </p>
      )}
      {error && (
        <p role="alert" className="assignment-warning">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">در حال دریافت کاربران…</p>}
      {!loading && !data && (
        <button type="button" onClick={() => void reload()}>
          تلاش دوباره
        </button>
      )}
      {!form && data && (
        <div className="responsive-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">کاربر</th>
                <th scope="col">نقش و شعب</th>
                <th scope="col">وضعیت</th>
                <th scope="col">ویرایش</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.displayName}</strong>
                    <br />
                    <bdi>{user.phone}</bdi>
                  </td>
                  <td>
                    {roles[user.role]}
                    <br />
                    <small>
                      {data.branches
                        .filter((b) => user.branchIds.includes(b.id))
                        .map((b) => b.name)
                        .join("، ")}
                    </small>
                  </td>
                  <td>{user.isActive ? "فعال" : "غیرفعال"}</td>
                  <td>
                    {user.canEdit ? (
                      <button
                        type="button"
                        className="row-action"
                        onClick={() => edit(user)}
                        aria-label={`ویرایش ${user.displayName}`}
                      >
                        ویرایش
                      </button>
                    ) : (
                      "حساب شما"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.users.length && (
            <p>کاربری در شعب تحت مدیریت شما وجود ندارد.</p>
          )}
        </div>
      )}
      {form && data && (
        <form
          className="settings-form"
          onSubmit={(event) => void save(event)}
          aria-label={
            form.id ? "ویرایش کاربر تعمیرگاه" : "ایجاد کاربر تعمیرگاه"
          }
        >
          <fieldset disabled={saving}>
            <legend>{form.id ? "ویرایش کاربر" : "کاربر جدید"}</legend>
            <label className="field-block">
              <span>نام و نام خانوادگی</span>
              <input
                required
                maxLength={180}
                value={form.displayName}
                onChange={(e) => update("displayName", e.target.value)}
              />
            </label>
            <label className="field-block">
              <span>موبایل کاربر</span>
              <input
                required
                dir="ltr"
                type="tel"
                inputMode="tel"
                maxLength={11}
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
              />
            </label>
            <label className="field-block">
              <span>ایمیل</span>
              <input
                dir="ltr"
                type="email"
                maxLength={190}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>
            <label className="field-block">
              <span>نقش کاربر</span>
              <select
                aria-label="نقش کاربر"
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
              >
                {Object.entries(roles).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block">
              <span>{form.id ? "رمز جدید (اختیاری)" : "رمز اولیه"}</span>
              <input
                dir="ltr"
                type="password"
                aria-label={form.id ? "رمز جدید (اختیاری)" : "رمز اولیه"}
                aria-describedby={passwordHint}
                autoComplete="new-password"
                required={!form.id}
                minLength={15}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
              <small id={passwordHint}>
                حداقل ۱۵ نویسه و حداکثر ۷۲ بایت؛ کاربر باید رمز اولیه یا
                بازنشانی‌شده را در ورود بعدی تغییر دهد.
              </small>
            </label>
            <label className="shop-user-choice">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => update("isActive", e.target.checked)}
              />
              حساب فعال
            </label>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>شعب مجاز</legend>
            <div className="shop-user-choices">
              {data.branches.map((branch) => (
                <label className="shop-user-choice" key={branch.id}>
                  <input
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
                  {branch.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={saving || form.role === "repair_manager"}>
            <legend>دسترسی‌های تکمیلی</legend>
            <p>
              این مجوزها به دسترسی‌های پایهٔ نقش اضافه می‌شوند. مدیر تعمیرگاه در
              شعب مجاز خود اختیار مدیریتی دارد. محدودیت قابلیت‌های اشتراک
              پابرجاست.
            </p>
            <div className="shop-user-choices">
              {Object.entries(data.permissionCatalog).map(([code, label]) => (
                <label className="shop-user-choice" key={code}>
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(code)}
                    onChange={(e) => {
                      setPermissionsChanged(true);
                      update(
                        "permissions",
                        e.target.checked
                          ? [...form.permissions.filter((p) => p !== "*"), code]
                          : form.permissions.filter(
                              (p) => p !== code && p !== "*",
                            ),
                      );
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="settings-footer-actions">
            <button type="submit" className="primary-action" disabled={saving}>
              {saving ? "در حال ذخیره…" : "ذخیره کاربر"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setForm(null)}
            >
              انصراف
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
