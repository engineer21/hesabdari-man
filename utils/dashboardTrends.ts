import type { Invoice, PayrollEntry, Transaction } from '../types';
import { isOperatingExpenseTx, isOperatingIncomeTx } from './accrualEngine';
import {
  getJalaliMonthKey,
  getLocalDayKey,
  getPreviousJalaliMonthKey,
  isInJalaliMonth,
} from './jalaliPeriod';

export function monthTrend(
  transactions: Transaction[],
  type: 'income' | 'expense',
  reference: Date = new Date(),
  invoices: Invoice[] = [],
  payrollEntries: PayrollEntry[] = []
): { pct: number; up: boolean; current: number; previous: number } {
  const curKey = getJalaliMonthKey(reference);
  const prevKey = getPreviousJalaliMonthKey(reference);

  let cur = 0;
  let prev = 0;
  for (const t of transactions) {
    const matches = type === 'income' ? isOperatingIncomeTx(t) : isOperatingExpenseTx(t);
    if (!matches) continue;
    if (isInJalaliMonth(t.date, curKey)) cur += t.amount;
    else if (isInJalaliMonth(t.date, prevKey)) prev += t.amount;
  }
  for (const inv of invoices) {
    if (type === 'income' && inv.kind !== 'sale') continue;
    if (type === 'expense' && inv.kind !== 'purchase') continue;
    if (isInJalaliMonth(inv.date, curKey)) cur += inv.amount;
    else if (isInJalaliMonth(inv.date, prevKey)) prev += inv.amount;
  }
  if (type === 'expense') {
    for (const pe of payrollEntries) {
      if (isInJalaliMonth(pe.date, curKey)) cur += pe.amount;
      else if (isInJalaliMonth(pe.date, prevKey)) prev += pe.amount;
    }
  }

  if (prev === 0 && cur === 0) return { pct: 0, up: true, current: 0, previous: 0 };
  if (prev === 0) return { pct: 100, up: true, current: cur, previous: 0 };
  const pct = Math.round(Math.abs(((cur - prev) / prev) * 100));
  return { pct, up: cur >= prev, current: cur, previous: prev };
}

export function sparklineSeries(
  transactions: Transaction[],
  type: 'income' | 'expense',
  days = 7,
  reference: Date = new Date(),
  invoices: Invoice[] = [],
  payrollEntries: PayrollEntry[] = []
): number[] {
  const totalsByDay = new Map<string, number>();
  for (const t of transactions) {
    const matches = type === 'income' ? isOperatingIncomeTx(t) : isOperatingExpenseTx(t);
    if (!matches) continue;
    const key = getLocalDayKey(t.date);
    if (!key) continue;
    totalsByDay.set(key, (totalsByDay.get(key) || 0) + t.amount);
  }
  for (const inv of invoices) {
    if (type === 'income' && inv.kind !== 'sale') continue;
    if (type === 'expense' && inv.kind !== 'purchase') continue;
    const key = getLocalDayKey(inv.date);
    if (!key) continue;
    totalsByDay.set(key, (totalsByDay.get(key) || 0) + inv.amount);
  }
  if (type === 'expense') {
    for (const pe of payrollEntries) {
      const key = getLocalDayKey(pe.date);
      if (!key) continue;
      totalsByDay.set(key, (totalsByDay.get(key) || 0) + pe.amount);
    }
  }

  const series: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate() - i,
      12,
      0,
      0,
      0
    );
    const key = getLocalDayKey(d);
    series.push(totalsByDay.get(key) || 0);
  }

  const max = Math.max(...series, 1);
  return series.map((v) => v / max);
}
