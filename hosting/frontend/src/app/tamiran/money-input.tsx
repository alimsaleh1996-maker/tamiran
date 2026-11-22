import { useEffect, useRef, useState } from "react";
import { formatToman, moneyDigits, tomanToRials } from "./money";
export { formatToman } from "./money";
/** UI uses toman; all values crossing this component boundary remain integer rials. */
export function MoneyInput({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  required,
}: {
  value: string;
  onChange: (rials: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(() => formatToman(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) {
      setDisplay(formatToman(value));
      emitted.current = value;
    }
  }, [value]);
  return (
    <span className="money-input">
      <input
        id={id}
        dir="ltr"
        type="text"
        inputMode="decimal"
        required={required}
        disabled={disabled}
        value={display}
        placeholder={placeholder ?? "مثلاً ۷۵۰٬۰۰۰"}
        onChange={(e) => {
          const next = tomanToRials(e.target.value);
          if (next === null) return;
          emitted.current = next;
          onChange(next);
          const raw = moneyDigits(e.target.value);
          setDisplay(
            raw.endsWith(".") ? formatToman(next) + "٫" : formatToman(next),
          );
        }}
        onBlur={() => setDisplay(formatToman(value))}
      />
      <span aria-hidden="true">تومان</span>
    </span>
  );
}
