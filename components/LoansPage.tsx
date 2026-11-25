import React, { useMemo, useState } from 'react';
import {
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  Loan,
  LoanInstallment,
  Transaction,
} from '../types';
import { APP_NAME, LOAN_INTEREST_ACCOUNT_ID } from '../constants';
import { getAccountById, getBankAccounts, getPostableLeaves } from '../utils/accountTree';
import { resolveDefaultAccountId } from '../utils/accountingTemplates';
import { buildLoanInstallments, computeLoanSummary, type LoanSummary } from '../utils/accrualEngine';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  toPersianDigits,
} from '../utils/formatters';
import { formatJalaliShort } from '../utils/jalaliPeriod';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import PersianDatePicker from './PersianDatePicker';
import AccountTreePicker from './AccountTreePicker';
import { ExportActions } from './export/ExportActions';
import {
  AmountInput,
  Button,
  CollapsibleOptionalSection,
  EmptyState,
  FormActions,
  FormSheet,
  IconButton,
  StoreMark,
  cn,
  fieldInput,
  fieldLabel,
} from './ui';
import { countFilledFields } from '../utils/formLayout';
import { useDialog } from './DialogProvider';

interface LoansPageProps {
  accounts: Account[];
  loans: Loan[];
  setLoans: (v: Loan[] | ((p: Loan[]) => Loan[])) => void;
  installments: LoanInstallment[];
  setInstallments: (v: LoanInstallment[] | ((p: LoanInstallment[]) => LoanInstallment[])) => void;
  onSaveTx: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onDeleteTx: (id: string) => void;
  settings?: AppSettings;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const LoansPage: React.FC<LoansPageProps> = ({
  accounts,
  loans,
  setLoans,
  installments,
  setInstallments,
  onSaveTx,
  onDeleteTx,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canCreate = can('journals.create');
  const canEdit = can('journals.edit');
  const canDelete = can('journals.delete');

  const storeName = settings?.name || APP_NAME;
  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const expenseLeaves = useMemo(() => getPostableLeaves(accounts, 'acc_expense'), [accounts]);
  const defaultInterestAccount = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'loanInterest') ||
      expenseLeaves.find((a) => a.id === LOAN_INTEREST_ACCOUNT_ID)?.id ||
      expenseLeaves.find((a) => a.name.includes('سود وام'))?.id ||
      expenseLeaves[0]?.id ||
      LOAN_INTEREST_ACCOUNT_ID,
    [accounts, settings?.accountingDefaults, expenseLeaves]
  );

  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Create Loan Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [interestAccountId, setInterestAccountId] = useState('');
  const [principalRaw, setPrincipalRaw] = useState('');
  const [interestRaw, setInterestRaw] = useState('');
  const [installmentCount, setInstallmentCount] = useState('10');
  const [intervalMonths, setIntervalMonths] = useState('1');
  const [startDate, setStartDate] = useState(() => getLocalDateISOString(new Date()));
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return getLocalDateISOString(d);
  });
  const [notes, setNotes] = useState('');

  // Pay Single Installment Modal
  const [payingItem, setPayingItem] = useState<{ loan: Loan; inst: LoanInstallment } | null>(null);
  const [payBankId, setPayBankId] = useState('');
  const [payDate, setPayDate] = useState(() => getLocalDateISOString(new Date()));

  // Early Lump-Sum Payoff Modal
  const [payoffSummary, setPayoffSummary] = useState<LoanSummary | null>(null);
  const [payoffBankId, setPayoffBankId] = useState('');
  const [payoffDate, setPayoffDate] = useState(() => getLocalDateISOString(new Date()));
  const [payoffInterestRaw, setPayoffInterestRaw] = useState('');

  const summaries = useMemo(
    () =>
      [...loans]
        .sort((a, b) => (a.status === b.status ? b.startDate.localeCompare(a.startDate) : a.status === 'active' ? -1 : 1))
        .map((l) => computeLoanSummary(l, installments)),
    [loans, installments]
  );

  const totalPrincipal = useMemo(() => summaries.reduce((s, x) => s + x.loan.principalAmount, 0), [summaries]);
  const totalRemainingPrincipal = useMemo(
    () => summaries.reduce((s, x) => s + x.remainingPrincipal, 0),
    [summaries]
  );
  const totalPaidInterest = useMemo(() => summaries.reduce((s, x) => s + x.paidInterest, 0), [summaries]);

  const openCreateModal = () => {
    setTitle('');
    setLenderName('');
    setBankAccountId(
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'defaultBank') ||
        banks[0]?.id ||
        ''
    );
    setInterestAccountId(defaultInterestAccount);
    setPrincipalRaw('');
    setInterestRaw('');
    setInstallmentCount('10');
    setIntervalMonths('1');
    const today = getLocalDateISOString(new Date());
    setStartDate(today);
    const next = new Date();
    next.setDate(next.getDate() + 30);
    setFirstDueDate(getLocalDateISOString(next));
    setNotes('');
    setCreateOpen(true);
  };

  const handleCreateLoan = async () => {
    const principal = parseIntegerAmount(principalRaw);
    const totalInterest = parseIntegerAmount(interestRaw, true);
    const count = Math.max(1, Math.min(240, parseInt(installmentCount, 10) || 1));
    const interval = Math.max(1, Math.min(12, parseInt(intervalMonths, 10) || 1));

    if (!title.trim()) {
      await dialog.alert({ title: 'عنوان وام', message: 'عنوان وام (مثلاً وام کشاورزی بانک ملی) را وارد کنید.' });
      return;
    }
    if (principal <= 0) {
      await dialog.alert({ title: 'مبلغ اصل وام', message: 'مبلغ اصل وام باید بیشتر از صفر باشد.' });
      return;
    }
    if (!bankAccountId) {
      await dialog.alert({ title: 'حساب بانکی', message: 'حساب بانکی واریز وام را انتخاب کنید.' });
      return;
    }

    const loanId = `loan_${crypto.randomUUID().slice(0, 10)}`;
    const disbursementTxId = `tx_ld_${crypto.randomUUID().slice(0, 10)}`;

    // Disbursement increases Bank balance WITHOUT counting as P&L operating income!
    onSaveTx({
      id: disbursementTxId,
      type: 'income',
      date: startDate,
      amount: principal,
      accountId: 'acc_income',
      bankAccountId,
      description: `واریز اصل وام: ${title.trim()} (${lenderName.trim() || 'بانک'})`,
      linkKind: 'loan_disbursement',
      loanId,
    });

    const newLoan: Loan = {
      id: loanId,
      title: title.trim(),
      lenderName: lenderName.trim() || 'بانک',
      bankAccountId,
      interestAccountId: interestAccountId || defaultInterestAccount,
      startDate,
      firstDueDate,
      principalAmount: principal,
      totalInterest,
      installmentCount: count,
      intervalMonths: interval,
      disbursementTxId,
      notes: notes.trim() || undefined,
      status: 'active',
    };

    const schedule = buildLoanInstallments({
      loanId,
      firstDueDate,
      principalAmount: principal,
      totalInterest,
      installmentCount: count,
      intervalMonths: interval,
    });

    setLoans((prev) => [newLoan, ...prev]);
    setInstallments((prev) => [...prev, ...schedule]);
    setExpandedLoanId(loanId);
    setCreateOpen(false);
  };

  const confirmPayInstallment = () => {
    if (!payingItem) return;
    const { loan, inst } = payingItem;
    const bankId = payBankId || loan.bankAccountId;
    const principalTxId = `tx_lp_${crypto.randomUUID().slice(0, 10)}`;
    const interestTxId = inst.interestShare > 0 ? `tx_li_${crypto.randomUUID().slice(0, 10)}` : undefined;

    // 1. Principal repayment reduces Bank, NOT P&L Expense
    if (inst.principalShare > 0) {
      onSaveTx({
        id: principalTxId,
        type: 'expense',
        date: payDate,
        amount: inst.principalShare,
        accountId: loan.interestAccountId,
        bankAccountId: bankId,
        description: `بازپرداخت اصل قسط #${toPersianDigits(String(inst.number))} وام ${loan.title}`,
        linkKind: 'loan_principal',
        loanId: loan.id,
        loanInstallmentId: inst.id,
      });
    }

    // 2. Interest share reduces Bank AND posts to `هزینه سود وام` in P&L!
    if (inst.interestShare > 0 && interestTxId) {
      onSaveTx({
        id: interestTxId,
        type: 'expense',
        date: payDate,
        amount: inst.interestShare,
        accountId: loan.interestAccountId || defaultInterestAccount,
        bankAccountId: bankId,
        description: `سود قسط #${toPersianDigits(String(inst.number))} وام ${loan.title}`,
        linkKind: 'loan_interest',
        loanId: loan.id,
        loanInstallmentId: inst.id,
      });
    }

    const updatedInstallments = installments.map((x) =>
      x.id === inst.id
        ? {
            ...x,
            status: 'paid' as const,
            paidDate: payDate,
            principalTxId: inst.principalShare > 0 ? principalTxId : undefined,
            interestTxId,
          }
        : x
    );
    setInstallments(updatedInstallments);

    const stillPending = updatedInstallments.some((x) => x.loanId === loan.id && x.status === 'pending');
    if (!stillPending) {
      setLoans((prev) => prev.map((l) => (l.id === loan.id ? { ...l, status: 'paid_off' } : l)));
    }
    setPayingItem(null);
  };

  const openEarlyPayoff = (s: LoanSummary) => {
    setPayoffSummary(s);
    setPayoffBankId(s.loan.bankAccountId || banks[0]?.id || '');
    setPayoffDate(getLocalDateISOString(new Date()));
    setPayoffInterestRaw(String(s.remainingInterest));
  };

  const confirmEarlyPayoff = () => {
    if (!payoffSummary) return;
    const { loan, remainingPrincipal } = payoffSummary;
    const finalInterest = parseIntegerAmount(payoffInterestRaw, true);
    const bankId = payoffBankId || loan.bankAccountId;

    const pTxId = remainingPrincipal > 0 ? `tx_lp_all_${crypto.randomUUID().slice(0, 8)}` : undefined;
    const iTxId = finalInterest > 0 ? `tx_li_all_${crypto.randomUUID().slice(0, 8)}` : undefined;

    if (remainingPrincipal > 0 && pTxId) {
      onSaveTx({
        id: pTxId,
        type: 'expense',
        date: payoffDate,
        amount: remainingPrincipal,
        accountId: loan.interestAccountId,
        bankAccountId: bankId,
        description: `تسویه یکجا اصل وام ${loan.title}`,
        linkKind: 'loan_principal',
        loanId: loan.id,
      });
    }

    if (finalInterest > 0 && iTxId) {
      onSaveTx({
        id: iTxId,
        type: 'expense',
        date: payoffDate,
        amount: finalInterest,
        accountId: loan.interestAccountId || defaultInterestAccount,
        bankAccountId: bankId,
        description: `تسویه یکجا سود وام ${loan.title}`,
        linkKind: 'loan_interest',
        loanId: loan.id,
      });
    }

    // Mark all pending installments as paid (distributing actual paid interest on first pending)
    let interestAssigned = false;
    setInstallments((prev) =>
      prev.map((x) => {
        if (x.loanId !== loan.id || x.status === 'paid') return x;
        const shareInt = !interestAssigned ? finalInterest : 0;
        interestAssigned = true;
        return {
          ...x,
          interestShare: shareInt,
          totalAmount: x.principalShare + shareInt,
          status: 'paid',
          paidDate: payoffDate,
          principalTxId: pTxId,
          interestTxId: shareInt > 0 ? iTxId : undefined,
        };
      })
    );

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loan.id
          ? { ...l, status: 'paid_off', totalInterest: payoffSummary.paidInterest + finalInterest }
          : l
      )
    );
    setPayoffSummary(null);
  };

  const deleteLoan = async (s: LoanSummary) => {
    const ok = await dialog.confirm({
      title: 'حذف وام',
      message: `وام «${s.loan.title}» و تمام اقساط و تراکنش‌های بانکی مرتبط آن حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف وام',
    });
    if (!ok) return;
    if (s.loan.disbursementTxId) onDeleteTx(s.loan.disbursementTxId);
    const txIds = new Set<string>();
    for (const inst of s.installments) {
      if (inst.principalTxId) txIds.add(inst.principalTxId);
      if (inst.interestTxId) txIds.add(inst.interestTxId);
    }
    for (const tid of txIds) onDeleteTx(tid);
    setInstallments((prev) => prev.filter((i) => i.loanId !== s.loan.id));
    setLoans((prev) => prev.filter((l) => l.id !== s.loan.id));
  };

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      summaries.map((s) => ({
        عنوان: s.loan.title,
        وام‌دهنده: s.loan.lenderName,
        'تاریخ دریافت': formatJalaliShort(s.loan.startDate),
        'اصل وام': s.loan.principalAmount,
        'کل سود': s.loan.totalInterest,
        'مانده اصل': s.remainingPrincipal,
        'سود پرداخت‌شده': s.paidInterest,
        وضعیت: s.loan.status === 'paid_off' ? 'تسویه‌شده' : 'فعال',
      })),
      'وام‌ها',
      'loans-report'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    await downloadTableReportPdf({
      title: 'گزارش وام‌ها و اقساط',
      storeName,
      subtitle: `${toPersianDigits(String(summaries.length))} وام ثبت‌شده`,
      pageSize,
      filename: `loans-${pageSize}`,
      columns: [
        { header: 'عنوان وام', width: 1.8, align: 'right' },
        { header: 'بانک / وام‌دهنده', width: 1.3, align: 'right' },
        { header: 'تاریخ', width: 1.0, align: 'right' },
        { header: 'اصل وام', width: 1.3, align: 'amount' },
        { header: 'مانده اصل', width: 1.3, align: 'amount' },
        { header: 'سود پرداختی', width: 1.2, align: 'amount' },
      ],
      rows: summaries.map((s) => [
        s.loan.title,
        s.loan.lenderName,
        formatDateFa(s.loan.startDate),
        formatMoneyFa(s.loan.principalAmount),
        formatMoneyFa(s.remainingPrincipal),
        formatMoneyFa(s.paidInterest),
      ]),
      summary: [
        { label: 'جمع اصل وام‌ها', value: formatMoneyFa(totalPrincipal) },
        { label: 'مانده بدهی اصل', value: formatMoneyFa(totalRemainingPrincipal) },
        { label: 'سود پرداخت‌شده', value: formatMoneyFa(totalPaidInterest) },
      ],
    });
  };

  return (
    <div className="animate-page-enter space-y-5 md:space-y-6" data-testid="loans-page">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
            مدیریت وام‌ها و اقساط
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm">
            تفکیک دقیق اصل وام (موجودی بانک و بدهی) و سهم سود وام (سرفصل هزینه سود وام) با جدول اقساط و تسویه یکجا
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summaries.length > 0 ? (
            <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="journals.export" />
          ) : null}
          {canCreate ? (
            <Button icon={Plus} data-testid="loan-add" onClick={openCreateModal}>
              ثبت وام جدید
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid gap-3.5 md:grid-cols-3 lg:gap-4">
        <div className="balance-gradient rounded-[1.5rem] p-5 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Banknote size={18} />
            </span>
            <p className="text-sm font-bold text-white/90">مانده بدهی اصل وام‌ها</p>
          </div>
          <p className="mt-4 truncate text-[1.75rem] font-black tabular-nums">
            {money(totalRemainingPrincipal)}
            <span className="ms-2 text-xs font-bold text-white/80">تومان</span>
          </p>
          <span className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold tabular-nums">
            از کل اصل {money(totalPrincipal)} تومان
          </span>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">سود پرداخت‌شده (هزینه سود وام)</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[color:var(--expense)]">
                {money(totalPaidInterest)}
                <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl tone-expense">
              <Wallet size={20} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[color:var(--muted)]">منعکس‌شده در گزارش سود و زیان</p>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">تعداد وام‌های فعال</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[color:var(--ink)]">
                {toPersianDigits(String(summaries.filter((s) => s.loan.status === 'active').length))} وام
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl tone-brand">
              <Landmark size={20} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[color:var(--muted)]">
            {toPersianDigits(String(summaries.filter((s) => s.loan.status === 'paid_off').length))} وام تسویه‌شده
          </p>
        </div>
      </section>

      {/* Loan List */}
      {summaries.length === 0 ? (
        <EmptyState
          title="هنوز وامی ثبت نشده است"
          description="با ثبت وام، مبلغ اصل به بانک واریز می‌شود (بدون اثر روی درآمد)، جدول اقساط با تفکیک اصل و سود ساخته می‌شود و می‌توانید اقساط را تکی یا یکجا تسویه کنید."
          action={
            canCreate ? (
              <Button icon={Plus} onClick={openCreateModal}>
                ثبت اولین وام
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4" data-testid="loans-list">
          {summaries.map((s) => {
            const isExpanded = expandedLoanId === s.loan.id;
            const bankName = getAccountById(accounts, s.loan.bankAccountId)?.name || 'بانک';
            return (
              <div key={s.loan.id} className="dash-card overflow-hidden" data-testid="loan-card">
                <div className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-[color:var(--ink)]">{s.loan.title}</h3>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                            s.loan.status === 'paid_off' ? 'tone-income' : 'tone-brand'
                          )}
                        >
                          {s.loan.status === 'paid_off' ? 'تسویه‌شده' : 'در حال بازپرداخت'}
                        </span>
                        <span className="text-xs font-semibold text-[color:var(--muted)]">
                          {s.loan.lenderName} · واریز به {bankName}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold tabular-nums text-[color:var(--muted)]">
                        <span>اصل وام: {money(s.loan.principalAmount)} تومان</span>
                        <span>کل سود: {money(s.loan.totalInterest)} تومان</span>
                        <span className="text-[color:var(--expense)]">
                          مانده اصل: {money(s.remainingPrincipal)} تومان
                        </span>
                        <span>
                          اقساط: {toPersianDigits(String(s.paidCount))} از{' '}
                          {toPersianDigits(String(s.installments.length))}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="flex items-center gap-3 pt-1">
                        <div className="h-2 w-48 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                          <div
                            className="h-full rounded-full bg-[color:var(--brand)] transition-all"
                            style={{ width: `${s.progressPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-extrabold tabular-nums text-[color:var(--brand)]">
                          {toPersianDigits(String(s.progressPct))}٪ پرداخت‌شده
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit && s.loan.status === 'active' && s.pendingCount > 0 ? (
                        <Button
                          size="sm"
                          icon={Sparkles}
                          data-testid={`loan-payoff-${s.loan.id}`}
                          onClick={() => openEarlyPayoff(s)}
                        >
                          تسویه یکجا
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="secondary"
                        icon={isExpanded ? ChevronUp : ChevronDown}
                        data-testid={`loan-toggle-${s.loan.id}`}
                        onClick={() => setExpandedLoanId(isExpanded ? null : s.loan.id)}
                      >
                        {isExpanded ? 'بستن اقساط' : 'جدول اقساط'}
                      </Button>

                      {canDelete ? (
                        <IconButton
                          icon={Trash2}
                          label="حذف وام"
                          size="sm"
                          variant="soft-danger"
                          onClick={() => void deleteLoan(s)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Expandable Installment Schedule */}
                {isExpanded ? (
                  <div className="border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/35 p-4">
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[38rem] text-right text-xs">
                        <thead>
                          <tr className="border-b border-[color:var(--line)] text-[11px] font-bold text-[color:var(--muted)]">
                            <th className="px-3 py-2">قسط</th>
                            <th className="px-3 py-2">تاریخ سررسید</th>
                            <th className="px-3 py-2 text-left">سهم اصل</th>
                            <th className="px-3 py-2 text-left">سهم سود</th>
                            <th className="px-3 py-2 text-left">جمع قسط</th>
                            <th className="px-3 py-2 text-center">وضعیت</th>
                            <th className="px-3 py-2 text-left">عملیات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--line)]/60">
                          {s.installments.map((inst) => (
                            <tr key={inst.id} className="hover:bg-[color:var(--surface-1)]/60">
                              <td className="px-3 py-2.5 font-extrabold tabular-nums">
                                قسط #{toPersianDigits(String(inst.number))}
                              </td>
                              <td className="px-3 py-2.5 font-semibold tabular-nums text-[color:var(--muted)]">
                                {formatJalaliShort(inst.dueDate)}
                              </td>
                              <td className="px-3 py-2.5 text-left font-bold tabular-nums text-[color:var(--ink)]">
                                {money(inst.principalShare)}
                              </td>
                              <td className="px-3 py-2.5 text-left font-bold tabular-nums text-[color:var(--expense)]">
                                {money(inst.interestShare)}
                              </td>
                              <td className="px-3 py-2.5 text-left font-black tabular-nums text-[color:var(--brand)]">
                                {money(inst.totalAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {inst.status === 'paid' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full tone-income px-2.5 py-0.5 text-[10.5px] font-bold">
                                    <CheckCircle2 size={11} />
                                    پرداخت‌شده ({inst.paidDate ? formatJalaliShort(inst.paidDate) : ''})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                                    <Calendar size={11} />
                                    در انتظار
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-left">
                                {inst.status === 'pending' && canEdit ? (
                                  <Button
                                    size="sm"
                                    data-testid={`pay-inst-${inst.id}`}
                                    onClick={() => {
                                      setPayingItem({ loan: s.loan, inst });
                                      setPayBankId(s.loan.bankAccountId);
                                      setPayDate(getLocalDateISOString(new Date()));
                                    }}
                                  >
                                    پرداخت قسط
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-[color:var(--muted)]">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Installment Cards */}
                    <div className="space-y-2.5 md:hidden" data-testid="loan-installments-mobile">
                      {s.installments.map((inst) => (
                        <div
                          key={inst.id}
                          className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/85 p-3.5 shadow-[var(--shadow-sm)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black tabular-nums text-[color:var(--ink)]">
                                قسط #{toPersianDigits(String(inst.number))}
                              </span>
                              <span className="text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                                سررسید {formatJalaliShort(inst.dueDate)}
                              </span>
                            </div>
                            {inst.status === 'paid' ? (
                              <span className="inline-flex items-center gap-1 rounded-full tone-income px-2.5 py-0.5 text-[10.5px] font-bold">
                                <CheckCircle2 size={11} />
                                پرداخت‌شده
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                                <Calendar size={11} />
                                در انتظار
                              </span>
                            )}
                          </div>

                          <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-[color:var(--surface-2)]/60 px-3 py-2 text-[11px] tabular-nums">
                            <div>
                              <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                                سهم اصل
                              </span>
                              <span className="font-bold text-[color:var(--ink)]">
                                {money(inst.principalShare)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                                سهم سود
                              </span>
                              <span className="font-bold text-[color:var(--expense)]">
                                {money(inst.interestShare)}
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                                جمع قسط
                              </span>
                              <span className="font-black text-[color:var(--brand)]">
                                {money(inst.totalAmount)}
                              </span>
                            </div>
                          </div>

                          {inst.status === 'pending' && canEdit ? (
                            <div className="mt-2.5 flex justify-end">
                              <Button
                                size="sm"
                                data-testid={`pay-inst-mobile-${inst.id}`}
                                onClick={() => {
                                  setPayingItem({ loan: s.loan, inst });
                                  setPayBankId(s.loan.bankAccountId);
                                  setPayDate(getLocalDateISOString(new Date()));
                                }}
                              >
                                پرداخت قسط
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Loan Modal */}
      <FormSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        accent="brand"
        size="lg"
        dock
        headerChip={<StoreMark name={storeName} logo={settings?.logo || undefined} size="md" />}
        title="ثبت وام جدید"
        subtitle="اصل وام به موجودی بانک اضافه می‌شود (بدون ثبت درآمد) و جدول اقساط خودکار ساخته می‌شود"
        footer={
          <FormActions
            onCancel={() => setCreateOpen(false)}
            onSubmit={() => void handleCreateLoan()}
            submitLabel="ثبت وام و ساخت اقساط"
            submitIcon={Plus}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
            <AmountInput
              label="مبلغ اصل وام (تومان)"
              value={principalRaw}
              onChange={setPrincipalRaw}
              accent="brand"
              compact
            />
            <AmountInput
              label="مبلغ کل سود / کارمزد وام (تومان)"
              value={interestRaw}
              onChange={setInterestRaw}
              accent="expense"
              compact
            />
          </div>

          {parseIntegerAmount(principalRaw) > 0 ? (
            <div className="rounded-xl border border-[color:var(--brand)]/20 bg-[color:var(--brand-soft)] px-3.5 py-2.5 text-xs font-extrabold tabular-nums text-[color:var(--brand)]">
              جمع بازپرداخت کل:{' '}
              {money(parseIntegerAmount(principalRaw) + parseIntegerAmount(interestRaw, true))} تومان ·
              هر قسط حدوداً{' '}
              {money(
                Math.round(
                  (parseIntegerAmount(principalRaw) + parseIntegerAmount(interestRaw, true)) /
                    Math.max(1, parseInt(installmentCount, 10) || 1)
                )
              )}{' '}
              تومان
            </div>
          ) : null}

          <div className="form-section space-y-3.5 sm:space-y-4">
            <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div>
                <label className={fieldLabel}>عنوان وام</label>
                <input
                  className={fieldInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً وام سرمایه در گردش کشاورزی"
                />
              </div>
              <div>
                <label className={fieldLabel}>واریز اصل وام به حساب</label>
                <select
                  className={fieldInput}
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>تعداد اقساط</label>
                <input
                  type="number"
                  min="1"
                  max="240"
                  className={cn(fieldInput, 'tabular-nums')}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(e.target.value)}
                />
              </div>
              <div>
                <label className={fieldLabel}>تاریخ سررسید اولین قسط</label>
                <PersianDatePicker value={firstDueDate} onChange={setFirstDueDate} />
              </div>
            </div>

            <CollapsibleOptionalSection
              title="بانک وام‌دهنده، سرفصل سود و تنظیمات اقساط"
              filledCount={countFilledFields([lenderName, notes])}
              mobileOnly
              testId="loan-optional-section"
            >
              <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className={fieldLabel}>بانک / وام‌دهنده (اختیاری)</label>
                  <input
                    className={fieldInput}
                    value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)}
                    placeholder="مثلاً بانک کشاورزی"
                  />
                </div>
                <div>
                  <AccountTreePicker
                    accounts={accounts}
                    module="expense"
                    value={interestAccountId}
                    onChange={setInterestAccountId}
                    label="سرفصل هزینه سود وام"
                  />
                </div>
                <div>
                  <label className={fieldLabel}>فاصله اقساط (ماه)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    className={cn(fieldInput, 'tabular-nums')}
                    value={intervalMonths}
                    onChange={(e) => setIntervalMonths(e.target.value)}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>تاریخ دریافت وام</label>
                  <PersianDatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>توضیحات (اختیاری)</label>
                  <input
                    className={fieldInput}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="شماره تسهیلات یا یادداشت..."
                  />
                </div>
              </div>
            </CollapsibleOptionalSection>
          </div>
        </div>
      </FormSheet>

      {/* Pay Single Installment Modal */}
      <FormSheet
        isOpen={Boolean(payingItem)}
        onClose={() => setPayingItem(null)}
        accent="brand"
        size="sm"
        dock
        headerChip={
          <span className="btn-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <Calendar size={19} />
          </span>
        }
        title={
          payingItem
            ? `پرداخت قسط #${toPersianDigits(String(payingItem.inst.number))} — ${payingItem.loan.title}`
            : 'پرداخت قسط'
        }
        subtitle={
          payingItem
            ? `جمع قسط: ${money(payingItem.inst.totalAmount)} تومان (اصل ${money(payingItem.inst.principalShare)} + سود ${money(payingItem.inst.interestShare)})`
            : undefined
        }
        footer={
          <FormActions
            onCancel={() => setPayingItem(null)}
            onSubmit={confirmPayInstallment}
            submitLabel="ثبت پرداخت قسط"
            submitIcon={Check}
          />
        }
      >
        <div className="form-section space-y-4">
          <div>
            <label className={fieldLabel}>پرداخت از حساب</label>
            <select
              className={fieldInput}
              value={payBankId}
              onChange={(e) => setPayBankId(e.target.value)}
            >
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>تاریخ پرداخت</label>
            <PersianDatePicker value={payDate} onChange={setPayDate} />
          </div>
        </div>
      </FormSheet>

      {/* Early Lump-Sum Payoff Modal */}
      <FormSheet
        isOpen={Boolean(payoffSummary)}
        onClose={() => setPayoffSummary(null)}
        accent="income"
        size="md"
        dock
        headerChip={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Sparkles size={19} />
          </span>
        }
        title={payoffSummary ? `تسویه یکجا وام ${payoffSummary.loan.title}` : 'تسویه یکجا'}
        subtitle={
          payoffSummary
            ? `مانده اصل وام: ${money(payoffSummary.remainingPrincipal)} تومان (${toPersianDigits(String(payoffSummary.pendingCount))} قسط باقی‌مانده)`
            : undefined
        }
        footer={
          <FormActions
            onCancel={() => setPayoffSummary(null)}
            onSubmit={confirmEarlyPayoff}
            submitLabel="تأیید تسویه کامل وام"
            submitIcon={CheckCircle2}
          />
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs leading-6 text-emerald-800 dark:text-emerald-200">
            با تسویه یکجا، مانده اصل ({money(payoffSummary?.remainingPrincipal || 0)} تومان) از حساب کسر و بدهی وام صفر می‌شود. در صورت دریافت تخفیف سود از بانک، مبلغ سود نهایی را در کادر زیر اصلاح کنید.
          </div>
          <AmountInput
            label="سود نهایی پرداختی جهت تسویه یکجا (تومان)"
            value={payoffInterestRaw}
            onChange={setPayoffInterestRaw}
            accent="expense"
          />
          <div className="form-section grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabel}>پرداخت از حساب</label>
              <select
                className={fieldInput}
                value={payoffBankId}
                onChange={(e) => setPayoffBankId(e.target.value)}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>تاریخ تسویه</label>
              <PersianDatePicker value={payoffDate} onChange={setPayoffDate} />
            </div>
          </div>
        </div>
      </FormSheet>
    </div>
  );
};

export default LoansPage;
