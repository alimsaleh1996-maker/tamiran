import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatRials, moneyDigits, parseRials } from "./money";
export { formatRials } from "./money";
/** UI and API both use integer rials. */
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
  const [display, setDisplay] = useState(() => formatRials(value));
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
      if (/[0-9]/.test(moneyDigits(text[position]))) remaining--;
      position++;
    }
    input.current.setSelectionRange(position, position);
  }
  useLayoutEffect(() => { restoreCaret(display); }, [display]);
  useEffect(() => {
    if (value !== emitted.current) {
      setDisplay(formatRials(value));
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
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const next = parseRials(e.target.value);
          if (next === null) return;
          emitted.current = next;
          onChange(next);
          const formatted = formatRials(next);
          caretDigits.current = moneyDigits(e.target.value.slice(0, e.target.selectionStart ?? e.target.value.length))
            .replace(/[^0-9]/g, "").length;
          if (formatted === display) requestAnimationFrame(() => restoreCaret(formatted));
          setDisplay(formatted);
        }}
        onBlur={() => setDisplay(formatRials(value))}
      />
      <span aria-hidden="true">ریال</span>
    </span>
  );
}
