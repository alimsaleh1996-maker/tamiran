import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const input = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  function restoreCaret(text: string) {
    const count = caretDigits.current;
    caretDigits.current = null;
    if (count === null || document.activeElement !== input.current || !input.current) return;
    let position = 0;
    let remaining = count;
    while (position < text.length && remaining > 0) {
      if (/[0-9.]/.test(moneyDigits(text[position]))) remaining--;
      position++;
    }
    input.current.setSelectionRange(position, position);
  }
  useLayoutEffect(() => { restoreCaret(display); }, [display]);
  useEffect(() => {
    if (value !== emitted.current) {
      setDisplay(formatToman(value));
      emitted.current = value;
    }
  }, [value]);
  return (
    <span className="money-input">
      <input
        ref={input}
        id={id}
        dir="ltr"
        type="text"
        inputMode="decimal"
        required={required}
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const next = tomanToRials(e.target.value);
          if (next === null) return;
          emitted.current = next;
          onChange(next);
          const raw = moneyDigits(e.target.value);
          const formatted = raw.endsWith(".") ? formatToman(next) + "٫" : formatToman(next);
          caretDigits.current = moneyDigits(e.target.value.slice(0, e.target.selectionStart ?? e.target.value.length))
            .replace(/[^0-9.]/g, "").length;
          if (formatted === display) requestAnimationFrame(() => restoreCaret(formatted));
          setDisplay(formatted);
        }}
        onBlur={() => setDisplay(formatToman(value))}
      />
      <span aria-hidden="true">تومان</span>
    </span>
  );
}
