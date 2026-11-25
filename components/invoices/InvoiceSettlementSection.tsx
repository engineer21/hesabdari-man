import React from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { Account, InvoiceKind } from '../../types';
import {
  computeDraftSettlementTotals,
  type DraftSettlementStage,
} from '../../utils/invoiceSettlementFlow';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  persianToArabic,
  toPersianDigits,
} from '../../utils/formatters';
import PersianDatePicker from '../PersianDatePicker';
import { cn, fieldInput, fieldLabel } from '../ui';

interface InvoiceSettlementSectionProps {
  kind: InvoiceKind;
  invoiceTotal: number;
  invoiceDate: string;
  banks: Account[];
  defaultBankId: string;
  stages: DraftSettlementStage[];
  onChangeStages: (next: DraftSettlementStage[]) => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

export const InvoiceSettlementSection: React.FC<InvoiceSettlementSectionProps> = ({
  kind,
  invoiceTotal,
  invoiceDate,
  banks,
  defaultBankId,
  stages,
  onChangeStages,
}) => {
  const isPurchase = kind === 'purchase';
  const totals = computeDraftSettlementTotals(invoiceTotal, stages);
  const fallbackBankId = defaultBankId || banks[0]?.id || '';

  // Determine active mode pill
  const isFullCash =
    stages.length === 1 &&
    stages[0].method === 'cash' &&
    invoiceTotal > 0 &&
    parseIntegerAmount(stages[0].amountStr) === invoiceTotal;

  const activeMode: 'credit' | 'full_cash' | 'split' =
    stages.length === 0 ? 'credit' : isFullCash ? 'full_cash' : 'split';

  const setModeCredit = () => {
    onChangeStages([]);
  };

  const setModeFullCash = () => {
    const existingFirst = stages[0];
    const nextStage: DraftSettlementStage = {
      id: existingFirst?.method === 'cash' ? existingFirst.id : `st_${crypto.randomUUID().slice(0, 8)}`,
      method: 'cash',
      amountStr: String(Math.max(0, Math.round(invoiceTotal))),
      date: existingFirst?.date || invoiceDate || getLocalDateISOString(new Date()),
      dueDate: existingFirst?.date || invoiceDate || getLocalDateISOString(new Date()),
      bankAccountId: existingFirst?.bankAccountId || fallbackBankId,
      checkNumber: '',
      sayadId: '',
      description: existingFirst?.description || '',
      existingId: existingFirst?.method === 'cash' ? existingFirst.existingId : undefined,
    };
    onChangeStages([nextStage]);
  };

  const addStage = (method: 'cash' | 'check', prefillRemaining = true) => {
    const currentTotals = computeDraftSettlementTotals(invoiceTotal, stages);
    const defaultAmt =
      prefillRemaining && currentTotals.remaining > 0 ? String(currentTotals.remaining) : '';
    const today = invoiceDate || getLocalDateISOString(new Date());
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const dueIso = getLocalDateISOString(nextMonth);

    const newStage: DraftSettlementStage = {
      id: `st_${crypto.randomUUID().slice(0, 8)}`,
      method,
      amountStr: defaultAmt,
      date: today,
      dueDate: method === 'check' ? dueIso : today,
      bankAccountId: fallbackBankId,
      checkNumber: '',
      sayadId: '',
      description: '',
    };
    onChangeStages([...stages, newStage]);
  };

  const updateStage = (id: string, patch: Partial<DraftSettlementStage>) => {
    onChangeStages(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStage = (id: string) => {
    onChangeStages(stages.filter((s) => s.id !== id));
  };

  const fillRemainingForStage = (targetId: string) => {
    const otherStages = stages.filter((s) => s.id !== targetId);
    const otherTotals = computeDraftSettlementTotals(invoiceTotal, otherStages);
    if (otherTotals.remaining > 0) {
      updateStage(targetId, { amountStr: String(otherTotals.remaining) });
    }
  };

  return (
    <section
      className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/20 px-4 py-4 sm:px-6 sm:py-5"
      data-testid="invoice-settlement-section"
    >
      {/* Header + 3-Way Settlement Mode Switcher */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                isPurchase ? 'tone-expense' : 'tone-income'
              )}
            >
              <Wallet size={16} />
            </span>
            <h3 className="text-sm font-black text-[color:var(--ink)]">
              {isPurchase
                ? 'نحوه پرداخت و تسویه فاکتور خرید (نقد، بانک، چک یا چندمرحله‌ای)'
                : 'نحوه دریافت و تسویه فاکتور فروش (نقد، بانک، چک یا چندمرحله‌ای)'}
            </h3>
          </div>
          <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
            می‌توانید فاکتور را نسیه ثبت کنید، یکجا نقدی تسویه کنید، یا در چند مرحله ترکیبی (نقد + واریز بانکی + یک یا چند فقره چک) ثبت نمایید.
          </p>
        </div>

        {/* Mode Segmented Control */}
        <div
          className="grid grid-cols-3 gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] p-1 shadow-2xs sm:inline-flex"
          role="group"
          aria-label="حالت تسویه فاکتور"
        >
          <button
            type="button"
            data-testid="inv-settle-mode-credit"
            onClick={setModeCredit}
            className={cn(
              'rounded-lg px-2.5 py-2 text-[11px] font-extrabold transition sm:px-3 sm:text-xs',
              activeMode === 'credit'
                ? 'bg-slate-800 text-white shadow-xs dark:bg-slate-200 dark:text-slate-900'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            نسیه (در صورتحساب)
          </button>

          <button
            type="button"
            data-testid="inv-settle-mode-full-cash"
            onClick={setModeFullCash}
            className={cn(
              'rounded-lg px-2.5 py-2 text-[11px] font-extrabold transition sm:px-3 sm:text-xs',
              activeMode === 'full_cash'
                ? isPurchase
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white shadow-xs'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            نقدی / بانکی کامل
          </button>

          <button
            type="button"
            data-testid="inv-settle-mode-split"
            onClick={() => {
              if (stages.length === 0) {
                addStage('cash', true);
              }
            }}
            className={cn(
              'rounded-lg px-2.5 py-2 text-[11px] font-extrabold transition sm:px-3 sm:text-xs',
              activeMode === 'split'
                ? 'bg-[color:var(--brand)] text-white shadow-xs'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            چندمرحله‌ای / چک
          </button>
        </div>
      </div>

      {/* Quick Action Bar for Adding Stages */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="inv-add-cash-stage"
            onClick={() => addStage('cash', true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
          >
            <Plus size={14} />
            <Banknote size={14} />
            {isPurchase ? 'افزودن مرحله پرداخت نقدی / بانکی' : 'افزودن مرحله دریافت نقدی / بانکی'}
          </button>

          <button
            type="button"
            data-testid="inv-add-check-stage"
            onClick={() => addStage('check', true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[color:var(--brand)]/35 bg-[color:var(--brand-soft)] px-3 text-xs font-extrabold text-[color:var(--brand)] transition hover:opacity-90"
          >
            <Plus size={14} />
            <FileSpreadsheet size={14} />
            {isPurchase ? 'افزودن چک پرداختی' : 'افزودن چک دریافتی'}
          </button>
        </div>

        {/* Live Status Summary Pill */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {totals.cashPaidTotal > 0 ? (
            <span className="font-bold tabular-nums text-[color:var(--income)]">
              نقد و بانک ({toPersianDigits(String(totals.cashStageCount))}): {money(totals.cashPaidTotal)}
            </span>
          ) : null}
          {totals.checksTotal > 0 ? (
            <span className="font-bold tabular-nums text-[color:var(--brand)]">
              چک ({toPersianDigits(String(totals.checkStageCount))}): {money(totals.checksTotal)}
            </span>
          ) : null}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-extrabold tabular-nums',
              totals.remaining === 0 && invoiceTotal > 0
                ? 'tone-income'
                : totals.settledTotal > 0
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-[color:var(--surface-2)] text-[color:var(--muted)]'
            )}
            data-testid="inv-settle-remaining-badge"
          >
            {totals.remaining === 0 && invoiceTotal > 0 ? (
              <>
                <CheckCircle2 size={13} />
                تسویه کامل (مانده: ۰)
              </>
            ) : (
              <>
                <Clock size={13} />
                مانده در حساب شخص: {money(totals.remaining)} تومان
              </>
            )}
          </span>
        </div>
      </div>

      {/* Stages List */}
      {stages.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-solid)]/60 px-4 py-3 text-xs text-[color:var(--muted)]">
          <span>
            فعلاً دریافت یا پرداختی برای این فاکتور ثبت نشده است؛ کل مبلغ{' '}
            <strong className="font-black tabular-nums text-[color:var(--ink)]">
              {money(invoiceTotal)} تومان
            </strong>{' '}
            به‌صورت نسیه در صورتحساب طرف‌حساب منظور خواهد شد.
          </span>
          {invoiceTotal > 0 ? (
            <button
              type="button"
              onClick={setModeFullCash}
              className="font-extrabold text-[color:var(--brand)] hover:underline"
            >
              تسویه نقدی یکجا ←
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2.5" data-testid="inv-settlement-stages-list">
          {stages.map((st, idx) => {
            const stageAmt = parseIntegerAmount(st.amountStr);
            const otherStages = stages.filter((x) => x.id !== st.id);
            const otherTotals = computeDraftSettlementTotals(invoiceTotal, otherStages);
            const canFillRemaining =
              otherTotals.remaining > 0 && otherTotals.remaining !== stageAmt;

            return (
              <div
                key={st.id}
                data-testid={`inv-settlement-stage-${idx}`}
                className={cn(
                  'rounded-2xl border bg-[color:var(--surface-solid)] p-3.5 shadow-2xs transition',
                  st.method === 'check'
                    ? 'border-[color:var(--brand)]/35'
                    : 'border-emerald-500/35'
                )}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--line)]/60 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold',
                        st.method === 'check' ? 'tone-brand' : 'tone-income'
                      )}
                    >
                      {st.method === 'check' ? (
                        <FileSpreadsheet size={12} />
                      ) : (
                        <Banknote size={12} />
                      )}
                      مرحله {toPersianDigits(String(idx + 1))}:{' '}
                      {st.method === 'check'
                        ? isPurchase
                          ? 'چک پرداختی (صادره)'
                          : 'چک دریافتی از مشتری'
                        : isPurchase
                          ? 'پرداخت نقدی / بانکی'
                          : 'دریافت نقدی / بانکی'}
                    </span>

                    {/* Quick switch between Cash and Check on this stage */}
                    <div className="inline-flex rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-0.5 text-[10.5px] font-bold">
                      <button
                        type="button"
                        onClick={() => updateStage(st.id, { method: 'cash' })}
                        className={cn(
                          'rounded-md px-2 py-0.5 transition',
                          st.method === 'cash'
                            ? 'bg-[color:var(--surface-solid)] font-extrabold text-[color:var(--ink)] shadow-2xs'
                            : 'text-[color:var(--muted)]'
                        )}
                      >
                        نقد / بانک
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStage(st.id, { method: 'check' })}
                        className={cn(
                          'rounded-md px-2 py-0.5 transition',
                          st.method === 'check'
                            ? 'bg-[color:var(--surface-solid)] font-extrabold text-[color:var(--brand)] shadow-2xs'
                            : 'text-[color:var(--muted)]'
                        )}
                      >
                        چک
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canFillRemaining ? (
                      <button
                        type="button"
                        onClick={() => fillRemainingForStage(st.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--brand-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:opacity-90"
                      >
                        <Sparkles size={11} />
                        درج الباقی ({money(otherTotals.remaining)})
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-label={`حذف مرحله ${idx + 1}`}
                      data-testid={`inv-stage-remove-${idx}`}
                      onClick={() => removeStage(st.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-rose-500/10 hover:text-[color:var(--expense)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {st.method === 'cash' ? (
                  <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className={fieldLabel}>مبلغ این مرحله (تومان)</label>
                      <input
                        className={cn(fieldInput, 'font-black tabular-nums')}
                        inputMode="numeric"
                        data-testid={`inv-stage-amount-${idx}`}
                        value={
                          st.amountStr
                            ? toPersianDigits(formatNumberWithCommas(st.amountStr))
                            : ''
                        }
                        onChange={(e) =>
                          updateStage(st.id, {
                            amountStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                          })
                        }
                        placeholder="۰"
                      />
                    </div>

                    <div>
                      <label className={fieldLabel}>حساب بانکی / صندوق</label>
                      <select
                        className={fieldInput}
                        data-testid={`inv-stage-bank-${idx}`}
                        value={st.bankAccountId}
                        onChange={(e) => updateStage(st.id, { bankAccountId: e.target.value })}
                      >
                        {banks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={fieldLabel}>تاریخ دریافت / پرداخت</label>
                      <PersianDatePicker
                        value={st.date}
                        onChange={(d) => updateStage(st.id, { date: d })}
                      />
                    </div>

                    <div>
                      <label className={fieldLabel}>شرح / کد پیگیری (اختیاری)</label>
                      <input
                        className={fieldInput}
                        value={st.description}
                        onChange={(e) => updateStage(st.id, { description: e.target.value })}
                        placeholder="مثلاً مرحله اول، کارت‌خوان یا پایا..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <label className={fieldLabel}>مبلغ چک (تومان)</label>
                      <input
                        className={cn(fieldInput, 'font-black tabular-nums')}
                        inputMode="numeric"
                        data-testid={`inv-stage-amount-${idx}`}
                        value={
                          st.amountStr
                            ? toPersianDigits(formatNumberWithCommas(st.amountStr))
                            : ''
                        }
                        onChange={(e) =>
                          updateStage(st.id, {
                            amountStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                          })
                        }
                        placeholder="۰"
                      />
                    </div>

                    <div>
                      <label className={fieldLabel}>شماره چک</label>
                      <input
                        className={cn(fieldInput, 'tabular-nums')}
                        data-testid={`inv-stage-checknum-${idx}`}
                        value={st.checkNumber}
                        onChange={(e) => updateStage(st.id, { checkNumber: e.target.value })}
                        placeholder="مثلاً ۶۵۴۳۲۱"
                      />
                    </div>

                    <div>
                      <label className={fieldLabel}>تاریخ سررسید چک</label>
                      <PersianDatePicker
                        value={st.dueDate}
                        onChange={(d) => updateStage(st.id, { dueDate: d })}
                      />
                    </div>

                    <div>
                      <label className={fieldLabel}>بانک مرتبط</label>
                      <select
                        className={fieldInput}
                        data-testid={`inv-stage-bank-${idx}`}
                        value={st.bankAccountId}
                        onChange={(e) => updateStage(st.id, { bankAccountId: e.target.value })}
                      >
                        {banks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={fieldLabel}>شناسه صیاد / توضیحات (اختیاری)</label>
                      <input
                        className={fieldInput}
                        value={st.sayadId || st.description}
                        onChange={(e) =>
                          updateStage(st.id, {
                            sayadId: e.target.value,
                            description: e.target.value,
                          })
                        }
                        placeholder="شناسه ۱۶ رقمی صیاد یا شرح..."
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default InvoiceSettlementSection;
