import React, { useMemo, useId, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { Invoice, PayrollEntry, Transaction } from '../../types';
import { isOperatingExpenseTx, isOperatingIncomeTx } from '../../utils/accrualEngine';
import { toPersianDigits } from '../../utils/formatters';
import { cn } from '../ui';

type Mode = 'month' | 'week';

interface Point {
  label: string;
  key: string;
  income: number;
  expense: number;
}

const FA_MONTH_KEY = new Intl.DateTimeFormat('en-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
});
const FA_MONTH_LABEL = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' });
const FA_WEEKDAY = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' });

function persianMonthKey(d: Date): string {
  const parts = FA_MONTH_KEY.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${y}/${m}`;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function recentPersianMonths(count: number, endDate: Date = new Date()): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  const cursor = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0);
  let guard = 0;
  while (result.length < count && guard < 400) {
    const key = persianMonthKey(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      result.unshift({ key, label: FA_MONTH_LABEL.format(cursor) });
      cursor.setDate(cursor.getDate() - 28);
    } else {
      cursor.setDate(cursor.getDate() - 1);
    }
    guard++;
  }
  return result;
}

function monthlyPoints(
  transactions: Transaction[],
  invoices: Invoice[],
  payrollEntries: PayrollEntry[]
): Point[] {
  const buckets: Point[] = recentPersianMonths(6).map((m) => ({
    label: m.label,
    key: m.key,
    income: 0,
    expense: 0,
  }));
  const map = new Map<string, Point>();
  for (const b of buckets) map.set(b.key, b);
  for (const t of transactions) {
    const isInc = isOperatingIncomeTx(t);
    const isExp = isOperatingExpenseTx(t);
    if (!isInc && !isExp) continue;
    const b = map.get(persianMonthKey(new Date(`${t.date}T12:00:00`)));
    if (!b) continue;
    if (isInc) b.income += t.amount;
    else b.expense += t.amount;
  }
  for (const inv of invoices) {
    const b = map.get(persianMonthKey(new Date(`${inv.date}T12:00:00`)));
    if (!b) continue;
    if (inv.kind === 'sale') b.income += inv.amount;
    else b.expense += inv.amount;
  }
  for (const pe of payrollEntries) {
    const b = map.get(persianMonthKey(new Date(`${pe.date}T12:00:00`)));
    if (!b) continue;
    b.expense += pe.amount;
  }
  return buckets;
}

function weeklyPoints(
  transactions: Transaction[],
  invoices: Invoice[],
  payrollEntries: PayrollEntry[]
): Point[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const buckets: Point[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ label: FA_WEEKDAY.format(d), key: localDayKey(d), income: 0, expense: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const t of transactions) {
    const isInc = isOperatingIncomeTx(t);
    const isExp = isOperatingExpenseTx(t);
    if (!isInc && !isExp) continue;
    const b = map.get(localDayKey(new Date(`${t.date}T12:00:00`)));
    if (!b) continue;
    if (isInc) b.income += t.amount;
    else b.expense += t.amount;
  }
  for (const inv of invoices) {
    const b = map.get(localDayKey(new Date(`${inv.date}T12:00:00`)));
    if (!b) continue;
    if (inv.kind === 'sale') b.income += inv.amount;
    else b.expense += inv.amount;
  }
  for (const pe of payrollEntries) {
    const b = map.get(localDayKey(new Date(`${pe.date}T12:00:00`)));
    if (!b) continue;
    b.expense += pe.amount;
  }
  return buckets;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  const minY = PAD_TOP;
  const maxY = H - PAD_BOTTOM;
  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function fmtTick(n: number): string {
  if (n <= 0) return toPersianDigits(0);
  if (n >= 1_000_000_000) return `${toPersianDigits((n / 1_000_000_000).toFixed(1))} م`;
  if (n >= 1_000_000) return `${toPersianDigits(Math.round(n / 1_000_000))} م`;
  if (n >= 1_000) return `${toPersianDigits(Math.round(n / 1_000))} ه`;
  return toPersianDigits(Math.round(n));
}

const W = 560;
const H = 192;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;

interface CashFlowChartProps {
  transactions: Transaction[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  className?: string;
}

const CashFlowChart: React.FC<CashFlowChartProps> = ({
  transactions,
  invoices = [],
  payrollEntries = [],
  className,
}) => {
  const [mode, setMode] = useState<Mode>('month');
  const gradIncome = useId();
  const gradExpense = useId();

  const data = useMemo(
    () =>
      mode === 'month'
        ? monthlyPoints(transactions, invoices, payrollEntries)
        : weeklyPoints(transactions, invoices, payrollEntries),
    [transactions, invoices, payrollEntries, mode]
  );

  const maxV = useMemo(
    () => Math.max(1, ...data.map((p) => Math.max(p.income, p.expense))),
    [data]
  );
  const hasData = data.some((p) => p.income > 0 || p.expense > 0);

  const xAt = (i: number, n: number) =>
    PAD_X + (n === 1 ? (W - PAD_X * 2) / 2 : (i / (n - 1)) * (W - PAD_X * 2));
  const yAt = (v: number) => PAD_TOP + (1 - v / maxV) * (H - PAD_TOP - PAD_BOTTOM);

  const series = (pick: (p: Point) => number) =>
    data.map((p, i) => ({ x: xAt(i, data.length), y: yAt(pick(p)) }));

  const incomePts = series((p) => p.income);
  const expensePts = series((p) => p.expense);
  const incomeLine = smoothPath(incomePts);
  const expenseLine = smoothPath(expensePts);
  const areaOf = (line: string, pts: { x: number; y: number }[]) =>
    line
      ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${H - PAD_BOTTOM} L ${pts[0].x.toFixed(1)} ${H - PAD_BOTTOM} Z`
      : '';

  const ticks = [maxV, (maxV * 2) / 3, maxV / 3, 0];

  return (
    <section
      data-testid="cashflow-card"
      className={cn('dash-card flex flex-col justify-between p-5 sm:p-6', className)}
      aria-label="جریان نقدی"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-income">
            <TrendingUp size={16} />
          </span>
          <h2 className="text-base font-extrabold text-[color:var(--ink)]">جریان نقدی</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3.5 text-[11px] font-bold text-[color:var(--muted)] sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--income)]" />
              درآمد
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand)]" />
              هزینه
            </span>
          </div>

          <div
            role="group"
            aria-label="بازه جریان نقدی"
            className="flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-2)]/90 p-1"
          >
            {(
              [
                ['month', 'ماهانه'],
                ['week', 'هفتگی'],
              ] as [Mode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'rounded-full px-3.5 py-1 text-xs font-bold transition whitespace-nowrap',
                  mode === value
                    ? 'btn-brand-gradient text-white'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-4 text-[11px] font-bold text-[color:var(--muted)] sm:hidden">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[color:var(--income)]" /> درآمد
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[color:var(--brand)]" /> هزینه
        </span>
      </div>

      {hasData ? (
        <div dir="ltr" className="mt-3">
          <div className="relative ps-11">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 flex w-10 flex-col justify-between py-[2px] text-right text-[10px] font-semibold tabular-nums text-[color:var(--muted)]"
              dir="rtl"
            >
              {ticks.map((t, i) => (
                <span key={i}>{fmtTick(t)}</span>
              ))}
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              role="img"
              aria-label="نمودار خطی درآمد و هزینه"
            >
              <defs>
                <linearGradient id={gradIncome} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--income)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--income)" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id={gradExpense} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1={PAD_X}
                  x2={W - PAD_X}
                  y1={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
                  y2={PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM)}
                  stroke="var(--line)"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
              ))}
              <line
                x1={PAD_X}
                x2={W - PAD_X}
                y1={H - PAD_BOTTOM}
                y2={H - PAD_BOTTOM}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <path d={areaOf(expenseLine, expensePts)} fill={`url(#${gradExpense})`} />
              <path d={areaOf(incomeLine, incomePts)} fill={`url(#${gradIncome})`} />
              <path
                d={expenseLine}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={incomeLine}
                fill="none"
                stroke="var(--income)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {incomePts.length > 1 && (
                <circle
                  cx={incomePts[incomePts.length - 1].x}
                  cy={incomePts[incomePts.length - 1].y}
                  r="4.8"
                  fill="var(--surface-solid)"
                  stroke="var(--income)"
                  strokeWidth="2.8"
                />
              )}
              {expensePts.length > 1 && (
                <circle
                  cx={expensePts[expensePts.length - 1].x}
                  cy={expensePts[expensePts.length - 1].y}
                  r="4.8"
                  fill="var(--surface-solid)"
                  stroke="var(--brand)"
                  strokeWidth="2.8"
                />
              )}
            </svg>
          </div>
          <div
            className="ms-11 mt-1 flex justify-between text-[10.5px] font-semibold text-[color:var(--muted)]"
            dir="ltr"
          >
            {data.map((p, i) => (
              <span
                key={`${p.label}-${i}`}
                className={cn(i === data.length - 1 && 'font-extrabold text-[color:var(--brand)]')}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
          هنوز تراکنشی برای نمایش نمودار ثبت نشده است
        </p>
      )}
    </section>
  );
};

export default CashFlowChart;
