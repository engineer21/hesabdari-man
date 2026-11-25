import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, AlertTriangle, Check } from 'lucide-react';
import type { Account, Transaction } from '../types';
import { computeBankBalance } from '../utils/accountBalance';
import { getBankAccounts } from '../utils/accountTree';
import { resolveTreasuryType } from '../utils/bankBrand';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  toPersianDigits,
} from '../utils/formatters';
import PersianDatePicker from './PersianDatePicker';
import { BankLogo } from './ui/BankLogo';
import {
  AmountInput,
  CollapsibleOptionalSection,
  FormActions,
  FormSheet,
  fieldInput,
  fieldLabel,
  cn,
} from './ui';
import { countFilledFields } from '../utils/formLayout';
import { useDialog } from './DialogProvider';

interface BankTransferModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  transactions: Transaction[];
  onSaveTransfer: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  initialFromBankId?: string;
  editing?: Transaction | null;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const BankTransferModal: React.FC<BankTransferModalProps> = ({
  open,
  onClose,
  accounts,
  transactions,
  onSaveTransfer,
  initialFromBankId,
  editing = null,
}) => {
  const dialog = useDialog();
  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const [fromBankId, setFromBankId] = useState('');
  const [toBankId, setToBankId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getLocalDateISOString(new Date()));
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing && editing.type === 'transfer') {
      const fromValid = banks.some((b) => b.id === editing.bankAccountId)
        ? editing.bankAccountId
        : banks[0]?.id || '';
      const toValid =
        banks.some((b) => b.id === editing.accountId) && editing.accountId !== fromValid
          ? editing.accountId
          : banks.find((b) => b.id !== fromValid)?.id || '';
      setFromBankId(fromValid);
      setToBankId(toValid);
      setAmountStr(String(editing.amount));
      setDate(editing.date || getLocalDateISOString(new Date()));
      setDescription(editing.description || '');
      return;
    }

    const first =
      initialFromBankId && banks.some((b) => b.id === initialFromBankId)
        ? initialFromBankId
        : banks[0]?.id || '';
    const second = banks.find((b) => b.id !== first)?.id || '';
    setFromBankId(first);
    setToBankId(second);
    setAmountStr('');
    setDate(getLocalDateISOString(new Date()));
    setDescription('');
  }, [open, initialFromBankId, editing, banks]);

  const effectiveTxs = useMemo(
    () => (editing?.id ? transactions.filter((t) => t.id !== editing.id) : transactions),
    [transactions, editing]
  );

  const fromBank = banks.find((b) => b.id === fromBankId);
  const toBank = banks.find((b) => b.id === toBankId);
  const fromBalance = fromBank ? computeBankBalance(fromBank, effectiveTxs) : 0;
  const toBalance = toBank ? computeBankBalance(toBank, effectiveTxs) : 0;
  const amount = parseIntegerAmount(amountStr);
  const exceedsSource = amount > 0 && amount > fromBalance;
  const canSubmit =
    banks.length >= 2 &&
    Boolean(fromBankId) &&
    Boolean(toBankId) &&
    fromBankId !== toBankId &&
    amount > 0;

  const swapBanks = () => {
    const prevFrom = fromBankId;
    setFromBankId(toBankId);
    setToBankId(prevFrom);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (banks.length < 2) {
      await dialog.alert({
        title: 'نیاز به حداقل دو حساب',
        message: 'برای انتقال بین حساب‌ها حداقل دو حساب بانکی یا صندوق فعال نیاز است.',
      });
      return;
    }
    if (!fromBankId || !toBankId || fromBankId === toBankId) {
      await dialog.alert({
        title: 'حساب مبدأ و مقصد',
        message: 'حساب مبدأ و حساب مقصد باید متفاوت باشند.',
      });
      return;
    }
    if (!amount || amount <= 0) {
      await dialog.alert({ title: 'مبلغ انتقال', message: 'مبلغ معتبر وارد کنید.' });
      return;
    }

    const payload: Omit<Transaction, 'id'> | Transaction = {
      type: 'transfer',
      amount,
      date: date || getLocalDateISOString(new Date()),
      bankAccountId: fromBankId,
      accountId: toBankId,
      description:
        description.trim() ||
        `انتقال از ${fromBank?.name || 'حساب مبدأ'} به ${toBank?.name || 'حساب مقصد'}`,
      ...(editing?.id ? { id: editing.id } : {}),
    };

    onSaveTransfer(payload);
    onClose();
  };

  const isEdit = Boolean(editing?.id);

  return (
    <FormSheet
      isOpen={open}
      onClose={onClose}
      title={isEdit ? 'ویرایش انتقال بین حساب‌ها' : 'ثبت انتقال بین حساب‌ها'}
      subtitle="جابه‌جایی وجه بین بانک‌ها، صندوق‌ها و تنخواه‌ها بدون تغییر در درآمد و هزینه"
      accent="brand"
      size="md"
      headerChip={
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm">
          <ArrowLeftRight size={19} />
        </span>
      }
      footer={
        <FormActions
          onCancel={onClose}
          submitLabel={isEdit ? 'ذخیره تغییرات' : 'ثبت انتقال وجه'}
          submitIcon={Check}
          submitType="submit"
          formId="bank-transfer-form"
          submitDisabled={!canSubmit}
        />
      }
    >
      <form id="bank-transfer-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5 sm:space-y-4">
        {banks.length < 2 ? (
          <div className="rounded-2xl border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-4 text-sm font-semibold text-[color:var(--warning)]">
            برای ثبت انتقال، ابتدا حداقل دو حساب فعال (بانک، صندوق یا تنخواه) در بخش بانک‌ها و صندوق‌ها تعریف کنید.
          </div>
        ) : (
          <>
            <AmountInput
              id="transfer-amount"
              label="مبلغ انتقال (تومان)"
              value={amountStr}
              onChange={setAmountStr}
              placeholder="۰"
              accent="brand"
              compact
              autoFocus
            />

            {/* Source -> Swap -> Destination visual block */}
            <div className="form-section space-y-2.5 sm:space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                  <label htmlFor="transfer-from" className="text-[color:var(--muted)]">
                    از حساب مبدأ
                  </label>
                  {fromBank ? (
                    <span className="tabular-nums text-[11px] text-[color:var(--muted)]">
                      موجودی: <strong className="text-[color:var(--ink)]">{money(fromBalance)}</strong> تومان
                    </span>
                  ) : null}
                </div>
                <div className="flex h-11 items-center gap-2.5 rounded-[0.9rem] border-[1.5px] border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-[3px] focus-within:ring-[color:var(--brand-glow)]">
                  {fromBank ? (
                    <BankLogo
                      name={fromBank.name}
                      treasuryType={resolveTreasuryType(fromBank)}
                      size="xs"
                      className="h-6 w-6 shrink-0"
                    />
                  ) : null}
                  <select
                    id="transfer-from"
                    value={fromBankId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFromBankId(next);
                      if (next === toBankId) {
                        setToBankId(banks.find((b) => b.id !== next)?.id || '');
                      }
                    }}
                    className="h-full w-full min-w-0 bg-transparent text-sm font-bold text-[color:var(--ink)] outline-none"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.accountTitle ? `(${b.accountTitle})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={swapBanks}
                  aria-label="جابه‌جایی حساب مبدأ و مقصد"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3.5 text-[11px] font-extrabold text-[color:var(--brand)] shadow-xs transition hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--brand-soft)] active:scale-95"
                >
                  <ArrowLeftRight size={13} />
                  جابه‌جایی مبدأ و مقصد
                </button>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                  <label htmlFor="transfer-to" className="text-[color:var(--muted)]">
                    به حساب مقصد
                  </label>
                  {toBank ? (
                    <span className="tabular-nums text-[11px] text-[color:var(--muted)]">
                      موجودی: <strong className="text-[color:var(--ink)]">{money(toBalance)}</strong> تومان
                    </span>
                  ) : null}
                </div>
                <div className="flex h-11 items-center gap-2.5 rounded-[0.9rem] border-[1.5px] border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-[3px] focus-within:ring-[color:var(--brand-glow)]">
                  {toBank ? (
                    <BankLogo
                      name={toBank.name}
                      treasuryType={resolveTreasuryType(toBank)}
                      size="xs"
                      className="h-6 w-6 shrink-0"
                    />
                  ) : null}
                  <select
                    id="transfer-to"
                    value={toBankId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setToBankId(next);
                      if (next === fromBankId) {
                        setFromBankId(banks.find((b) => b.id !== next)?.id || '');
                      }
                    }}
                    className="h-full w-full min-w-0 bg-transparent text-sm font-bold text-[color:var(--ink)] outline-none"
                  >
                    {banks
                      .filter((b) => b.id !== fromBankId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.accountTitle ? `(${b.accountTitle})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {exceedsSource ? (
              <div className="flex items-center gap-2 rounded-xl border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-3.5 py-2.5 text-xs font-semibold text-[color:var(--warning)]">
                <AlertTriangle size={15} className="shrink-0" />
                <span>مبلغ انتقال از موجودی فعلی حساب مبدأ بیشتر است.</span>
              </div>
            ) : null}

            <div className="form-section grid grid-cols-1 items-start gap-3.5 md:grid-cols-2 md:gap-4">
              <div>
                <label className={fieldLabel} htmlFor="transfer-date">
                  تاریخ انتقال
                </label>
                <PersianDatePicker id="transfer-date" value={date} onChange={setDate} />
              </div>
              <CollapsibleOptionalSection
                mobileOnly
                title="توضیحات انتقال (اختیاری)"
                subtitle="شرح دلخواه برای ثبت در گردش حساب‌ها"
                filledCount={countFilledFields([description])}
                testId="transfer-optional-section"
              >
                <div>
                  <label className={fieldLabel} htmlFor="transfer-desc">
                    توضیحات (اختیاری)
                  </label>
                  <input
                    id="transfer-desc"
                    className={fieldInput}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="مثلاً انتقال جهت تسویه"
                  />
                </div>
              </CollapsibleOptionalSection>
            </div>
          </>
        )}
      </form>
    </FormSheet>
  );
};

export default BankTransferModal;
