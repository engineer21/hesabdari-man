import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getLocalDateISOString, toPersianDigits } from '../utils/formatters';
import {
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAYS_SHORT,
  formatJalaliLong,
  getJalaliMonthGrid,
  getJalaliParts,
  shiftJalaliMonth,
} from '../utils/jalaliPeriod';
import { cn } from './ui';

interface PersianCalendarProps {
  transactions?: { date: string }[];
  selectedDate: string;
  onDateSelect: (date: string | null) => void;
  clearable?: boolean;
}

const PersianCalendar: React.FC<PersianCalendarProps> = ({
  transactions = [],
  selectedDate,
  onDateSelect,
  clearable = false,
}) => {
  const todayIso = useMemo(() => getLocalDateISOString(new Date()), []);
  const todayParts = useMemo(
    () => getJalaliParts(todayIso) ?? { year: 1405, month: 1, day: 1 },
    [todayIso]
  );

  const initialParts = useMemo(() => {
    if (selectedDate) {
      const parsed = getJalaliParts(selectedDate);
      if (parsed) return parsed;
    }
    return todayParts;
  }, [selectedDate, todayParts]);

  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  useEffect(() => {
    if (!selectedDate) return;
    const parsed = getJalaliParts(selectedDate);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [selectedDate]);

  const grid = useMemo(
    () => getJalaliMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const transactionDates = useMemo(
    () => new Set(transactions.map((t) => t.date)),
    [transactions]
  );

  const yearOptions = useMemo(() => {
    const base = todayParts.year;
    const years: number[] = [];
    for (let y = base - 10; y <= base + 5; y++) years.push(y);
    if (!years.includes(viewYear)) years.push(viewYear);
    return years.sort((a, b) => b - a);
  }, [todayParts.year, viewYear]);

  const handlePrevMonth = () => {
    const prev = shiftJalaliMonth(viewYear, viewMonth, -1);
    setViewYear(prev.year);
    setViewMonth(prev.month);
  };

  const handleNextMonth = () => {
    const next = shiftJalaliMonth(viewYear, viewMonth, 1);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const handleSelectToday = () => {
    setViewYear(todayParts.year);
    setViewMonth(todayParts.month);
    onDateSelect(todayIso);
  };

  const todayFormatted = useMemo(() => formatJalaliLong(todayIso), [todayIso]);

  return (
    <div
      className="overflow-hidden rounded-[1.5rem] border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)] p-4 shadow-[0_24px_60px_-20px_rgba(9,30,66,0.35)]"
      data-testid="persian-calendar"
    >
      {/* Header: Prev / Month+Year Selectors / Next */}
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="ماه قبل"
          onClick={handlePrevMonth}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand)]"
        >
          <ChevronRight size={17} />
        </button>

        <div className="flex min-w-0 items-center gap-1.5">
          <select
            aria-label="انتخاب ماه شمسی"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="h-9 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 px-2.5 text-xs font-extrabold text-[color:var(--ink)] outline-none transition focus:border-[color:var(--brand)]"
          >
            {JALALI_MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="انتخاب سال شمسی"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="h-9 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 px-2.5 text-xs font-extrabold tabular-nums text-[color:var(--ink)] outline-none transition focus:border-[color:var(--brand)]"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {toPersianDigits(String(y))}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          aria-label="ماه بعد"
          onClick={handleNextMonth}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand)]"
        >
          <ChevronLeft size={17} />
        </button>
      </div>

      {/* Weekday Row (Saturday to Friday) */}
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold">
        {JALALI_WEEKDAYS_SHORT.map((day, idx) => (
          <div
            key={day}
            className={cn(
              'py-1',
              idx === 6 ? 'text-[color:var(--expense)]' : 'text-[color:var(--muted)]'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Jalali Days Grid (strictly 1 .. 29/30/31) */}
      <div className="grid grid-cols-7 gap-1" data-testid="persian-calendar-days">
        {Array.from({ length: grid.startWeekday }).map((_, idx) => (
          <div key={`empty-${idx}`} aria-hidden />
        ))}

        {grid.days.map((d) => {
          const isSelected = d.iso === selectedDate;
          const isToday = d.iso === todayIso;
          const isFriday = d.weekday === 6;
          const hasTx = transactionDates.has(d.iso);

          return (
            <div key={d.iso} className="flex items-center justify-center">
              <button
                type="button"
                data-iso={d.iso}
                data-today={isToday ? 'true' : undefined}
                aria-label={`${toPersianDigits(String(d.day))} ${grid.monthName} ${toPersianDigits(String(d.year))}${isToday ? ' (امروز)' : ''}`}
                aria-pressed={isSelected}
                onClick={() => onDateSelect(d.iso)}
                className={cn(
                  'relative flex h-9 w-9 flex-col items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-all duration-150',
                  isSelected
                    ? 'btn-brand-gradient text-white shadow-sm'
                    : isToday
                      ? 'border-2 border-[color:var(--brand)] bg-[color:var(--brand-soft)] font-black text-[color:var(--brand)]'
                      : isFriday
                        ? 'text-[color:var(--expense)] hover:bg-[color:var(--expense-soft)]'
                        : 'text-[color:var(--ink)] hover:bg-[color:var(--brand-soft)]/80 hover:text-[color:var(--brand)]'
                )}
              >
                <span>{toPersianDigits(String(d.day))}</span>
                {hasTx && !isSelected ? (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[color:var(--brand)]" />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer: Prominent Today button + optional Clear */}
      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[color:var(--line)] pt-3">
        <button
          type="button"
          data-testid="datepicker-today"
          onClick={handleSelectToday}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[color:var(--brand-soft)] px-3 py-2 text-xs font-extrabold text-[color:var(--brand)] transition hover:bg-[color:var(--brand)] hover:text-white"
        >
          <CalendarCheck2 size={14} />
          <span>امروز: {todayFormatted}</span>
        </button>

        {clearable && selectedDate ? (
          <button
            type="button"
            data-testid="datepicker-clear"
            onClick={() => onDateSelect('')}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 px-3 py-2 text-xs font-bold text-[color:var(--muted)] transition hover:border-[color:var(--expense)]/40 hover:text-[color:var(--expense)]"
          >
            <RotateCcw size={13} />
            پاک
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default PersianCalendar;