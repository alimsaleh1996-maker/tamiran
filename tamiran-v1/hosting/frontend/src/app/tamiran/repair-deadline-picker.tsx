import { useId, useState } from "react";
import { moneyDigits } from "./money";
import { addGregorianDays, todayGregorianIso } from "./persian-date";
import { PersianDatePicker } from "./persian-date-picker";

const days = ["امروز", "فردا", "پس‌فردا"];
const times = ["10:00", "12:00", "15:00", "18:00"];
const persianClock = (value: string) =>
  value.replace(/[0-9]/g, digit => String.fromCharCode(0x6f0 + Number(digit)));

function clockInput(value: string) {
  const digits = moneyDigits(value).replace(/\D/g, "").slice(0, 4);
  return persianClock(digits.length > 2 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits);
}

/** Deadline mutations take a UTC SQL datetime; input is local Iran date and 24h clock. */
export function repairDeadline(date: string, time: string, futureOnly = false): string | null {
  if (!date) return null;
  const clock = moneyDigits(time);
  if (!/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(clock)) {
    throw new Error("ساعت را به شکل ۲۴ ساعته، مانند ۱۴:۳۰، وارد کنید.");
  }
  const day = new Date(date + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
    throw new Error("تاریخ موعد معتبر نیست.");
  }
  const timestamp = new Date(date + "T" + clock + ":00+03:30");
  if (futureOnly && timestamp.getTime() <= Date.now()) {
    throw new Error("زمان تقریبی اتمام باید بعد از زمان فعلی باشد.");
  }
  return timestamp.toISOString().slice(0, 19).replace("T", " ");
}

export function RepairDeadlinePicker({ date, time, onChange, dateLabel, futureOnly = false }: {
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
  dateLabel: string;
  futureOnly?: boolean;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  let error = "";
  try {
    repairDeadline(date, time, futureOnly);
  } catch (failure) {
    if (touched && failure instanceof Error) error = failure.message;
  }
  const today = todayGregorianIso();
  return <fieldset className="tech-due">
    <legend>زمان تقریبی اتمام تعمیر</legend>
    <div className="tech-handover-actions">
      {days.map((label, index) => {
        const shortcut = addGregorianDays(today, index);
        return <button key={label} type="button" aria-pressed={date === shortcut}
          onClick={() => onChange(shortcut, time)}>{label}</button>;
      })}
      {date && <button type="button" onClick={() => { setTouched(false); onChange("", ""); }}>پاک‌کردن موعد</button>}
    </div>
    <div className="tech-form-grid">
      <div><PersianDatePicker ariaLabel={dateLabel} value={date} onChange={value => onChange(value, time)} /></div>
      {date && <label>ساعت به وقت ایران
        <input required inputMode="numeric" dir="ltr" maxLength={5}
          autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined}
          value={persianClock(time)} onChange={event => onChange(date, clockInput(event.target.value))}
          onBlur={() => setTouched(true)} />
      </label>}
    </div>
    {error && <p id={id} role="alert" className="tech-error">{error}</p>}
    {date && <div className="tech-handover-actions" aria-label="انتخاب سریع ساعت">
      {times.map(value => <button key={value} type="button" aria-pressed={moneyDigits(time) === value}
        onClick={() => onChange(date, persianClock(value))}>{persianClock(value)}</button>)}
    </div>}
  </fieldset>;
}
