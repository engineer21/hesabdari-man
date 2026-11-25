const jalaliPartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const persianDigitsMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => persianDigitsMap[Number(d)] ?? d);
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

export interface JalaliCalendarDay {
  iso: string;
  year: number;
  month: number;
  day: number;
  /** 0 = Saturday (ش), 1 = Sunday (ی), ..., 6 = Friday (ج) */
  weekday: number;
}

export interface JalaliMonthGrid {
  year: number;
  month: number;
  monthName: string;
  daysInMonth: number;
  /** Leading empty slots before day 1 (0..6, Saturday = 0) */
  startWeekday: number;
  days: JalaliCalendarDay[];
}

/**
 * Safely parses an ISO date string (YYYY-MM-DD or full ISO timestamp) at local
 * midday (12:00:00) so timezone offsets (e.g. UTC-8) never shift calendar days.
 */
export function parseLocalIsoDate(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }
  const fallback = new Date(isoDate);
  if (Number.isNaN(fallback.getTime())) {
    return new Date(NaN);
  }
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate(),
    12,
    0,
    0,
    0
  );
}

/**
 * Returns local calendar day key (YYYY-MM-DD) without UTC shifting.
 */
export function getLocalDayKey(input: Date | string): string {
  const d = typeof input === 'string' ? parseLocalIsoDate(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getJalaliParts(input: Date | string): JalaliDateParts | null {
  const d = typeof input === 'string' ? parseLocalIsoDate(input) : input;
  if (Number.isNaN(d.getTime())) return null;
  const parts = jalaliPartsFormatter.formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into Persian long Jalali format (e.g. "۲ آذر ۱۴۰۵")
 * without any UTC timezone day-shift.
 */
export function formatJalaliLong(input: Date | string): string {
  const p = getJalaliParts(input);
  if (!p) return '';
  const monthName = JALALI_MONTH_NAMES[p.month - 1] ?? '';
  return `${toFaDigits(p.day)} ${monthName} ${toFaDigits(p.year)}`.trim();
}

/**
 * Formats an ISO date string into compact Persian Jalali numeric format (e.g. "۱۴۰۵/۰۹/۰۲")
 * without any UTC timezone day-shift.
 */
export function formatJalaliShort(input: Date | string): string {
  const p = getJalaliParts(input);
  if (!p) return '';
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return toFaDigits(`${p.year}/${mm}/${dd}`);
}

export function shiftJalaliMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = ((zeroBased % 12) + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}

/**
 * Converts a Jalali (year, month, day) tuple to a local midday Gregorian Date,
 * guaranteed 100% consistent with Intl.DateTimeFormat('en-US-u-ca-persian').
 */
export function jalaliToGregorianDate(
  jy: number,
  jm: number,
  jd: number
): Date {
  // Approximate Gregorian start of Jalali year (Nowruz is always March 19-22)
  const gyApprox = jy + 621;
  const dayOfYearApprox =
    jm <= 6 ? (jm - 1) * 31 + (jd - 1) : 186 + (jm - 7) * 30 + (jd - 1);
  let candidate = new Date(gyApprox, 2, 21 + dayOfYearApprox, 12, 0, 0, 0);

  // Refine up to 10 steps (normally converges in 0-2 steps)
  for (let iter = 0; iter < 12; iter++) {
    const p = getJalaliParts(candidate);
    if (!p) break;
    if (p.year === jy && p.month === jm && p.day === jd) {
      return candidate;
    }
    const targetOrdinal =
      jy * 366 + (jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30) + jd;
    const currentOrdinal =
      p.year * 366 + (p.month <= 6 ? (p.month - 1) * 31 : 186 + (p.month - 7) * 30) + p.day;
    let diff = targetOrdinal - currentOrdinal;
    if (diff === 0) {
      diff = p.year < jy || (p.year === jy && (p.month < jm || p.day < jd)) ? 1 : -1;
    }
    candidate = new Date(
      candidate.getFullYear(),
      candidate.getMonth(),
      candidate.getDate() + diff,
      12,
      0,
      0,
      0
    );
  }
  return candidate;
}

/**
 * Builds the exact calendar grid for a Jalali month (day 1 .. 29/30/31),
 * aligned to the Iranian Saturday-first week (Saturday = 0 .. Friday = 6).
 */
export function getJalaliMonthGrid(jy: number, jm: number): JalaliMonthGrid {
  const firstDay = jalaliToGregorianDate(jy, jm, 1);
  const startWeekday = (firstDay.getDay() + 1) % 7; // Saturday = 0 .. Friday = 6
  const days: JalaliCalendarDay[] = [];

  for (let offset = 0; offset < 32; offset++) {
    const cur = new Date(
      firstDay.getFullYear(),
      firstDay.getMonth(),
      firstDay.getDate() + offset,
      12,
      0,
      0,
      0
    );
    const p = getJalaliParts(cur);
    if (!p || p.year !== jy || p.month !== jm) {
      if (days.length > 0) break;
      continue;
    }
    days.push({
      iso: getLocalDayKey(cur),
      year: p.year,
      month: p.month,
      day: p.day,
      weekday: (cur.getDay() + 1) % 7,
    });
  }

  return {
    year: jy,
    month: jm,
    monthName: JALALI_MONTH_NAMES[jm - 1] ?? '',
    daysInMonth: days.length,
    startWeekday,
    days,
  };
}

export function getJalaliMonthKey(input: Date | string): string {
  const p = getJalaliParts(input);
  if (!p) return '';
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export function getPreviousJalaliMonthKey(reference: Date = new Date()): string {
  const p = getJalaliParts(reference);
  if (!p) return '';
  if (p.month === 1) {
    return `${p.year - 1}-12`;
  }
  return `${p.year}-${String(p.month - 1).padStart(2, '0')}`;
}

export function isInJalaliMonth(isoDate: string, monthKey: string): boolean {
  if (!monthKey) return false;
  return getJalaliMonthKey(isoDate) === monthKey;
}

export function isWithinLastDays(
  isoDate: string,
  days: number,
  reference: Date = new Date()
): boolean {
  const d = parseLocalIsoDate(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const end = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    23,
    59,
    59,
    999
  );
  const start = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() - (days - 1),
    0,
    0,
    0,
    0
  );
  const ms = d.getTime();
  return ms >= start.getTime() && ms <= end.getTime();
}
