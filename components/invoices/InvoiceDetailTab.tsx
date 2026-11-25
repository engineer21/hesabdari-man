import React from 'react';
import {
  FileSpreadsheet,
  Image as ImageIcon,
  Package,
  Pencil,
  Wallet,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import type { Account, Attachment, Contact, Warehouse } from '../../types';
import type { InvoiceSettlementSummary } from '../../utils/accrualEngine';
import { getAccountById } from '../../utils/accountTree';
import { attachmentSrc, isImageAttachment, isPdfAttachment } from '../../utils/attachments';
import { formatNumberWithCommas, toPersianDigits } from '../../utils/formatters';
import { formatJalaliShort } from '../../utils/jalaliPeriod';
import { Button, MobileStickyBar, cn } from '../ui';

interface InvoiceDetailTabProps {
  isActive?: boolean;
  summary: InvoiceSettlementSummary;
  accounts: Account[];
  contacts: Contact[];
  warehouses: Warehouse[];
  canCreate: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onSettle: () => void;
  onIssueCheck?: () => void;
  onPreviewAttachment: (att: Attachment) => void;
  onClose: () => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const InvoiceDetailTab: React.FC<InvoiceDetailTabProps> = ({
  isActive = true,
  summary,
  accounts,
  contacts,
  warehouses,
  canCreate,
  canEdit,
  onEdit,
  onSettle,
  onIssueCheck,
  onPreviewAttachment,
  onClose,
}) => {
  const inv = summary.invoice;
  const contactName = contacts.find((c) => c.id === inv.contactId)?.fullName || 'شخص حذف‌شده';
  const accountName = getAccountById(accounts, inv.accountId)?.name || 'سرفصل';
  const whName = (id?: string) =>
    warehouses.find((w) => w.id === id)?.name || warehouses[0]?.name || 'انبار مرکزی';

  return (
    <div
      className={cn(
        'dash-card overflow-hidden rounded-[1.5rem] border border-[color:var(--glass-border)]',
        isActive && 'mb-24 md:mb-0'
      )}
      data-testid="invoice-mdi-detail"
    >
      <div
        className={cn(
          'h-[3px] w-full bg-gradient-to-l',
          inv.kind === 'purchase'
            ? 'from-rose-400 via-rose-500 to-orange-500'
            : 'from-emerald-400 via-emerald-500 to-teal-500'
        )}
        aria-hidden
      />

      <div className="space-y-4 p-3.5 sm:p-5 lg:space-y-5 lg:p-6">
        {/* Top Summary Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--line)] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-extrabold',
                  inv.kind === 'purchase' ? 'tone-expense' : 'tone-income'
                )}
              >
                {inv.kind === 'purchase' ? 'فاکتور خرید' : 'فاکتور فروش'} #
                {toPersianDigits(inv.invoiceNumber)}
              </span>
              <span className="text-xs font-bold tabular-nums text-[color:var(--muted)]">
                تاریخ: {formatJalaliShort(inv.date)}
              </span>
              {inv.dueDate ? (
                <span className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  سررسید: {formatJalaliShort(inv.dueDate)}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-lg font-black text-[color:var(--ink)]">{contactName}</h2>
            <p className="mt-0.5 text-xs font-semibold text-[color:var(--muted)]">
              سرفصل: {accountName}
              {inv.warehouseId ? ` · انبار: ${whName(inv.warehouseId)}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreate && summary.remaining > 0 ? (
              <Button size="sm" icon={Wallet} className="hidden md:inline-flex" onClick={onSettle}>
                {inv.kind === 'purchase' ? 'ثبت پرداخت' : 'ثبت دریافت'}
              </Button>
            ) : null}
            {canCreate && onIssueCheck && summary.remaining > 0 ? (
              <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={onIssueCheck}>
                ثبت چک
              </Button>
            ) : null}
            {canEdit ? (
              <Button size="sm" variant="secondary" icon={Pencil} onClick={onEdit}>
                ویرایش فاکتور
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" className="hidden md:inline-flex" onClick={onClose}>
              بستن تب
            </Button>
          </div>
        </div>

        {/* 4 Financial Boxes */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3.5">
            <p className="text-[11px] font-bold text-[color:var(--muted)]">مبلغ کل فاکتور</p>
            <p className="mt-1.5 text-base font-black tabular-nums text-[color:var(--ink)]">
              {money(inv.amount)} <span className="text-[11px] font-semibold">تومان</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3.5">
            <p className="text-[11px] font-bold text-[color:var(--muted)]">تسویه نقدی / بانکی</p>
            <p className="mt-1.5 text-base font-black tabular-nums text-[color:var(--income)]">
              {money(summary.paidCash)} <span className="text-[11px] font-semibold">تومان</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3.5">
            <p className="text-[11px] font-bold text-[color:var(--muted)]">چک‌های معتبر</p>
            <p className="mt-1.5 text-base font-black tabular-nums text-[color:var(--brand)]">
              {money(summary.pendingChecks + summary.clearedChecks)}{' '}
              <span className="text-[11px] font-semibold">تومان</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3.5">
            <p className="text-[11px] font-bold text-[color:var(--muted)]">مانده باز</p>
            <p
              className={cn(
                'mt-1.5 text-base font-black tabular-nums',
                summary.remaining > 0 ? 'text-[color:var(--expense)]' : 'text-[color:var(--income)]'
              )}
            >
              {money(summary.remaining)} <span className="text-[11px] font-semibold">تومان</span>
            </p>
          </div>
        </div>

        {/* Line Items (mobile cards + tablet/desktop responsive table) */}
        {inv.items && inv.items.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-[color:var(--brand)]" />
              <h3 className="text-sm font-black text-[color:var(--ink)]">اقلام کالا و انبار</h3>
            </div>

            {/* Mobile Item Cards */}
            <div className="space-y-2 md:hidden">
              {inv.items.map((it, i) => (
                <div
                  key={it.id}
                  className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/70 p-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[color:var(--ink)]">
                        {toPersianDigits(String(i + 1))}. {it.productName}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">
                        {whName(it.warehouseId || inv.warehouseId)} · {toPersianDigits(formatNumberWithCommas(it.quantity))} {it.unit} × {money(it.unitPrice)}
                        {it.discount ? ` (تخفیف ${money(it.discount)})` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 font-black tabular-nums text-[color:var(--ink)]">
                      {money(it.total)} <span className="text-[10px] font-semibold text-[color:var(--muted)]">تومان</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tablet & Desktop Table (no horizontal overflow) */}
            <div className="hidden overflow-x-auto rounded-2xl border border-[color:var(--line)] md:block">
              <table className="w-full text-right text-xs">
                <thead className="bg-[color:var(--surface-2)]/85 font-extrabold text-[color:var(--muted)]">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">شرح کالا / خدمت</th>
                    <th className="px-3 py-2.5">انبار</th>
                    <th className="px-3 py-2.5 text-center">تعداد</th>
                    <th className="px-3 py-2.5 text-left">قیمت واحد</th>
                    <th className="px-3 py-2.5 text-left">تخفیف</th>
                    <th className="px-3 py-2.5 text-left">مبلغ کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)] bg-[color:var(--surface-solid)]/60">
                  {inv.items.map((it, i) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2.5 font-bold tabular-nums text-[color:var(--muted)]">
                        {toPersianDigits(String(i + 1))}
                      </td>
                      <td className="px-3 py-2.5 font-extrabold text-[color:var(--ink)]">
                        {it.productName}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-[color:var(--muted)]">
                        <span className="inline-flex items-center gap-1">
                          <WarehouseIcon size={12} />
                          {whName(it.warehouseId || inv.warehouseId)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums">
                        {toPersianDigits(formatNumberWithCommas(it.quantity))} {it.unit}
                      </td>
                      <td className="px-3 py-2.5 text-left font-bold tabular-nums">
                        {money(it.unitPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-left tabular-nums text-[color:var(--expense)]">
                        {it.discount ? money(it.discount) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-left font-black tabular-nums text-[color:var(--ink)]">
                        {money(it.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {inv.description ? (
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/45 px-4 py-3 text-xs font-medium text-[color:var(--ink)]">
            <span className="font-extrabold text-[color:var(--muted)]">شرح فاکتور: </span>
            {inv.description}
          </div>
        ) : null}

        {/* Two-column lower section: Settlements History + Attachment */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-black text-[color:var(--ink)]">
                تاریخچه تسویه‌های نقدی و چکی ({toPersianDigits(String(summary.linkedTransactions.length + summary.linkedChecks.length))} مرحله)
              </h3>
              {canCreate ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onSettle}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/12 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <Wallet size={12} />
                    + مرحله نقد / بانک
                  </button>
                  {onIssueCheck ? (
                    <button
                      type="button"
                      onClick={onIssueCheck}
                      className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--brand-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:opacity-90"
                    >
                      <FileSpreadsheet size={12} />
                      + ثبت چک
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {summary.linkedTransactions.length === 0 && summary.linkedChecks.length === 0 ? (
              <p className="py-6 text-center text-xs font-medium text-[color:var(--muted)]">
                هنوز هیچ پرداخت یا چکی برای این فاکتور ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.linkedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/45 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[color:var(--ink)]">
                        {tx.description || 'پرداخت نقدی/بانکی'}
                      </p>
                      <p className="text-[11px] tabular-nums text-[color:var(--muted)]">
                        {formatJalaliShort(tx.date)} ·{' '}
                        {getAccountById(accounts, tx.bankAccountId)?.name || 'بانک'}
                      </p>
                    </div>
                    <span className="font-black tabular-nums text-[color:var(--income)]">
                      {money(tx.amount)} تومان
                    </span>
                  </div>
                ))}
                {summary.linkedChecks.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/45 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[color:var(--ink)]">
                        چک #{toPersianDigits(ch.checkNumber)}
                      </p>
                      <p className="text-[11px] tabular-nums text-[color:var(--muted)]">
                        سررسید: {formatJalaliShort(ch.dueDate)} ·{' '}
                        {ch.status === 'cleared'
                          ? 'پاس‌شده'
                          : ch.status === 'bounced'
                            ? 'برگشتی'
                            : 'در جریان'}
                      </p>
                    </div>
                    <span className="font-black tabular-nums text-[color:var(--brand)]">
                      {money(ch.amount)} تومان
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/55 p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-black text-[color:var(--ink)]">
              <ImageIcon size={14} className="text-[color:var(--brand)]" />
              تصویر / سند پیوست فاکتور
            </h3>
            {inv.attachment ? (
              isImageAttachment(inv.attachment) ? (
                <button
                  type="button"
                  onClick={() => onPreviewAttachment(inv.attachment!)}
                  className="group relative block w-full overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]"
                >
                  <img
                    src={attachmentSrc(inv.attachment)}
                    alt={inv.attachment.name || 'تصویر فاکتور'}
                    className="max-h-64 w-full object-contain transition group-hover:scale-[1.01]"
                  />
                  <span className="absolute bottom-2 left-2 rounded-lg bg-slate-900/75 px-2.5 py-1 text-[11px] font-bold text-white">
                    بزرگ‌نمایی تصویر
                  </span>
                </button>
              ) : isPdfAttachment(inv.attachment) ? (
                <a
                  href={attachmentSrc(inv.attachment)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] px-4 py-3 text-xs font-bold text-[color:var(--brand)] hover:bg-[color:var(--surface-2)]"
                >
                  مشاهده فایل PDF ({inv.attachment.name})
                </a>
              ) : null
            ) : (
              <p className="py-6 text-center text-xs font-medium text-[color:var(--muted)]">
                تصویر یا فایلی برای این فاکتور پیوست نشده است.
              </p>
            )}
          </div>
        </div>
      </div>

      {isActive ? (
        <MobileStickyBar
          submitLabel={
            canCreate && summary.remaining > 0
              ? inv.kind === 'purchase'
                ? 'ثبت پرداخت فاکتور'
                : 'ثبت دریافت فاکتور'
              : canEdit
                ? 'ویرایش فاکتور'
                : 'مشاهده فاکتور'
          }
          submitDisabled={!(canCreate && summary.remaining > 0) && !canEdit}
          onSubmit={canCreate && summary.remaining > 0 ? onSettle : onEdit}
          submitIcon={canCreate && summary.remaining > 0 ? Wallet : Pencil}
          submitVariant={inv.kind === 'purchase' ? 'expense' : 'income'}
          onCancel={onClose}
          cancelLabel="بستن"
          summaryLabel={summary.remaining > 0 ? 'مانده قابل تسویه' : 'وضعیت فاکتور'}
          summaryValue={summary.remaining > 0 ? `${money(summary.remaining)} تومان` : 'تسویه‌شده'}
          summaryTone={summary.remaining > 0 ? 'expense' : 'income'}
        />
      ) : null}
    </div>
  );
};

export default InvoiceDetailTab;
