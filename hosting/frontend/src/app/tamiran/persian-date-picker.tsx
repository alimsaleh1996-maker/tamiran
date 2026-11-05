"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  daysInPersianMonth,
  formatPersianDate,
  gregorianToPersian,
  isSamePersianDay,
  persianMonthNames,
  persianMonthStartWeekday,
  persianToGregorian,
  persianWeekdayNames,
  shiftPersianMonth,
  todayGregorianIso,
} from "./persian-date";

type PersianDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  ariaLabel?: string;
};

type PopupPosition = { top: number; left: number; width: number };

export function PersianDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  required = false,
  disabled = false,
  compact = false,
  ariaLabel = "انتخاب تاریخ شمسی",
}: PersianDatePickerProps) {
  const selected = gregorianToPersian(value || todayGregorianIso()) ?? {
    year: 1405,
    month: 1,
    day: 1,
  };
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({
    year: selected.year,
    month: selected.month,
  });
  const [position, setPosition] = useState<PopupPosition>({
    top: 0,
    left: 0,
    width: 310,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const closeAndRestore = React.useCallback(() => {
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>(".persian-date-trigger")?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(310, window.innerWidth - 16);
      const left = Math.max(
        8,
        Math.min(rect.right - width, window.innerWidth - width - 8),
      );
      const popupHeight = 356;
      const below = rect.bottom + 7;
      const top =
        below + popupHeight <= window.innerHeight - 8
          ? below
          : Math.max(8, rect.top - popupHeight - 7);
      setPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndRestore();
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, closeAndRestore]);

  const chooseDay = (day: number) => {
    const next = persianToGregorian(view.year, view.month, day);
    if (!next) return;
    onChange(next);
    closeAndRestore();
  };

  const goToToday = () => {
    const today = todayGregorianIso();
    onChange(today);
    const parts = gregorianToPersian(today);
    if (parts) setView({ year: parts.year, month: parts.month });
    closeAndRestore();
  };

  const moveMonth = (delta: number) =>
    setView((current) => shiftPersianMonth(current.year, current.month, delta));
  const toggleOpen = () => {
    if (disabled) return;
    if (!open) setView({ year: selected.year, month: selected.month });
    setOpen((current) => !current);
  };
  const blanks = persianMonthStartWeekday(view.year, view.month);
  const days = daysInPersianMonth(view.year, view.month);
  const cells = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div
      className={`persian-date-picker ${compact ? "is-compact" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`persian-date-trigger ${open ? "is-open" : ""}`}
        onClick={toggleOpen}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={17} />
        <span>{value ? formatPersianDate(value) : placeholder}</span>
        <ChevronDown size={15} />
      </button>
      {required && (
        <input
          className="persian-date-required"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
        />
      )}
      {open &&
        createPortal(
          <div
            className="persian-date-popup"
            data-modal-owner={rootRef.current?.closest("[data-modal-id]")?.getAttribute("data-modal-id") ?? undefined}
            ref={popupRef}
            role="dialog"
            aria-label={ariaLabel}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            <header>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="ماه بعد"
              >
                <ChevronRight size={18} />
              </button>
              <strong>
                {persianMonthNames[view.month - 1]}{" "}
                {new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(
                  view.year,
                )}
              </strong>
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="ماه قبل"
              >
                <ChevronLeft size={18} />
              </button>
            </header>
            <div className="persian-date-weekdays">
              {persianWeekdayNames.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="persian-date-days">
              {cells.map((day, index) =>
                day === null ? (
                  <i key={`blank-${index}`} />
                ) : (
                  <button
                    type="button"
                    key={day}
                    className={
                      isSamePersianDay(value, view.year, view.month, day)
                        ? "selected"
                        : ""
                    }
                    onClick={() => chooseDay(day)}
                  >
                    {new Intl.NumberFormat("fa-IR", {
                      useGrouping: false,
                    }).format(day)}
                  </button>
                ),
              )}
            </div>
            <footer>
              <span>تقویم رسمی ایران</span>
              <button type="button" onClick={goToToday}>
                امروز
              </button>
            </footer>
          </div>,
          document.body,
        )}
    </div>
  );
}
