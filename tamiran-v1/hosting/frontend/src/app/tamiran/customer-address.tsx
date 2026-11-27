import { useId, useRef, useState } from "react";
import { MapPin, Pencil, Plus, Check } from "lucide-react";
import "./reception-identity.css";
type Address = {
  province: string;
  city: string;
  address: string;
  postalCode: string;
};
export function CustomerAddress({
  value,
  required,
  cities,
  onSave,
}: {
  value: Address;
  required: boolean;
  cities: Record<string, string[]>;
  onSave: (v: Address) => void;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = () => {setOpen(false); requestAnimationFrame(() => buttonRef.current?.focus());};
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const present = Boolean(
    value.province || value.city || value.address || value.postalCode,
  );
  const update = (key: keyof Address, text: string) => {
    setDraft((d) => ({
      ...d,
      [key]: text,
      ...(key === "province" ? { city: "" } : {}),
    }));
    setError("");
  };
  return (
    <section className="reception-address-field" aria-label="آدرس مشتری">
      <div className="address-section-heading">
        <div>
          <strong>
            <MapPin size={18} aria-hidden="true" /> آدرس مشتری{" "}
            {required ? <span>الزامی</span> : <small>اختیاری</small>}
          </strong>
          <p>
            {present
              ? [value.province, value.city, value.address]
                  .filter(Boolean)
                  .join("، ")
              : "آدرس مشتری را در همین صفحه ثبت کنید."}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            className="outline-action"
            ref={buttonRef} aria-expanded={false}
            aria-controls={`${id}-editor`}
            onClick={() => {
              setDraft(value);
              setError("");
              setOpen(true);
            }}
          >
            {present ? <Pencil size={17} /> : <Plus size={17} />}{" "}
            {present ? "ویرایش آدرس" : "افزودن آدرس"}
          </button>
        )}
      </div>
      {open && (
        <div id={`${id}-editor`} className="reception-address-editor">
          <p>
            آدرس در پروندهٔ مشتری نگهداری می‌شود.
          </p>
          <div className="address-fields">
            <label>
              <span id={`${id}-province-label`}>استان {required && "*"}</span>
              <select
                autoFocus
                aria-labelledby={`${id}-province-label`} value={draft.province}
                onChange={(e) => update("province", e.target.value)}
              >
                <option value="">انتخاب استان</option>
                {Object.keys(cities).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span id={`${id}-city-label`}>شهر {required && "*"}</span>
              <select
                aria-labelledby={`${id}-city-label`} value={draft.city}
                disabled={!draft.province}
                onChange={(e) => update("city", e.target.value)}
              >
                <option value="">انتخاب شهر</option>
                {(cities[draft.province] ?? []).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span id={`${id}-postalCode-label`}>کد پستی {required && "*"}</span>
              <input
                dir="rtl"
                inputMode="numeric"
                maxLength={10}
                aria-labelledby={`${id}-postalCode-label`} value={draft.postalCode}
                onChange={(e) =>
                  update(
                    "postalCode",
                    e.target.value
                      .replace(/[۰-۹٠-٩]/g, (v) =>
                        String(v.charCodeAt(0) - (v >= "۰" ? 0x6f0 : 0x660)),
                      )
                      .replace(/\D/g, ""),
                  )
                }
              />
              <small>۱۰ رقم، بدون خط تیره</small>
            </label>
            <label className="address-wide">
              <span id={`${id}-address-label`}>نشانی {required && "*"}</span>
              <textarea
                rows={3}
                maxLength={1000}
                aria-labelledby={`${id}-address-label`} value={draft.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="خیابان، کوچه، پلاک و واحد"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="identity-error">
              {error}
            </p>
          )}
          <div className="identity-actions">
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                if (
                  required &&
                  (!draft.province ||
                    !draft.city ||
                    !draft.address.trim() ||
                    draft.postalCode.length !== 10)
                ) {
                  setError("استان، شهر، نشانی و کد پستی ۱۰ رقمی را کامل کنید.");
                  return;
                }
                if (draft.postalCode && !/^\d{10}$/.test(draft.postalCode)) {
                  setError("کد پستی باید ۱۰ رقم باشد.");
                  return;
                }
                onSave(draft);
                close();
              }}
            >
              <Check size={17} /> ذخیره آدرس
            </button>
            <button
              type="button"
              className="outline-action"
              onClick={close}
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
