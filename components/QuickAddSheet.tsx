import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Landmark,
  Users,
  FileText,
  Briefcase,
  FileSpreadsheet,
  Banknote,
  Boxes,
} from 'lucide-react';
import type { View } from '../types';
import { useCan } from '../hooks/useSessionAuth';
import { FormSheet, cn } from './ui';

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onOpenTransfer?: () => void;
  hasBank: boolean;
  canTransfer?: boolean;
}

const QuickAddSheet: React.FC<QuickAddSheetProps> = ({
  open,
  onClose,
  onNavigate,
  onOpenTransfer,
  hasBank,
  canTransfer = false,
}) => {
  const can = useCan();
  const canJournalCreate = can('journals.create');
  const items: {
    key: string;
    title: string;
    hint: string;
    icon: React.ReactNode;
    tone: string;
    disabled?: boolean;
    hidden?: boolean;
    onClick: () => void;
  }[] = [
    {
      key: 'income',
      title: 'ثبت درآمد',
      hint: 'فروش و دریافت نقدی',
      icon: <TrendingUp size={21} />,
      tone: 'tone-income',
      disabled: !hasBank,
      hidden: !canJournalCreate,
      onClick: () => {
        onNavigate('income');
        onClose();
      },
    },
    {
      key: 'expense',
      title: 'ثبت هزینه',
      hint: 'پرداخت و مخارج نقدی',
      icon: <TrendingDown size={21} />,
      tone: 'tone-expense',
      disabled: !hasBank,
      hidden: !canJournalCreate,
      onClick: () => {
        onNavigate('expense');
        onClose();
      },
    },
    {
      key: 'invoices',
      title: 'فاکتور خرید / فروش',
      hint: 'با تصویر فاکتور و تسویه جزئی',
      icon: <FileText size={21} />,
      tone: 'tone-brand',
      hidden: !canJournalCreate,
      onClick: () => {
        onNavigate('invoices');
        onClose();
      },
    },
    {
      key: 'payroll',
      title: 'حقوق و کارکرد',
      hint: 'ثابت، روزمزد و آبگیری',
      icon: <Briefcase size={21} />,
      tone: 'tone-income',
      hidden: !canJournalCreate,
      onClick: () => {
        onNavigate('payroll');
        onClose();
      },
    },
    {
      key: 'checks',
      title: 'ثبت چک',
      hint: 'پرداختی و دریافتی با یادآور',
      icon: <FileSpreadsheet size={21} />,
      tone: 'tone-warning',
      hidden: !canJournalCreate,
      onClick: () => {
        onNavigate('checks');
        onClose();
      },
    },
    {
      key: 'loans',
      title: 'وام و تسهیلات',
      hint: 'اصل وام، سود و جدول اقساط',
      icon: <Banknote size={21} />,
      tone: 'tone-expense',
      hidden: !canJournalCreate,
      onClick: () => {
        onNavigate('loans');
        onClose();
      },
    },
    {
      key: 'transfer',
      title: 'انتقال بین حساب‌ها',
      hint: 'جابه‌جایی بین بانک‌ها',
      icon: <ArrowLeftRight size={21} />,
      tone: 'tone-info',
      disabled: !canTransfer,
      hidden: !canJournalCreate,
      onClick: () => {
        onClose();
        if (onOpenTransfer) onOpenTransfer();
        else onNavigate('banks');
      },
    },
    {
      key: 'banks',
      title: 'حساب بانکی',
      hint: 'مدیریت بانک و موجودی',
      icon: <Landmark size={21} />,
      tone: 'tone-brand',
      hidden: !can('journals.view'),
      onClick: () => {
        onNavigate('banks');
        onClose();
      },
    },
    {
      key: 'inventory',
      title: 'کالاها و انبارها',
      hint: 'تعریف کالا، انبار و موجودی',
      icon: <Boxes size={21} />,
      tone: 'tone-info',
      hidden: !can('journals.view'),
      onClick: () => {
        onNavigate('inventory');
        onClose();
      },
    },
    {
      key: 'persons',
      title: 'اشخاص',
      hint: 'مانده بدهکار/بستانکار افراد',
      icon: <Users size={21} />,
      tone: 'tone-warning',
      hidden: !can('contacts.view'),
      onClick: () => {
        onNavigate('persons');
        onClose();
      },
    },
  ].filter((item) => !item.hidden);

  return (
    <FormSheet
      isOpen={open}
      onClose={onClose}
      title="ثبت سریع"
      subtitle="عملیات مورد نظر را انتخاب کنید"
      size="md"
      accent="brand"
    >
      <div className="space-y-3.5">
        {!hasBank ? (
          <div className="rounded-2xl border border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] px-4 py-3 text-xs font-semibold text-[color:var(--warning)]">
            هنوز حساب بانکی نساخته‌اید؛ ابتدا یک حساب بانکی تعریف کنید.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          {items.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={a.disabled}
              onClick={a.onClick}
              className={cn(
                'flex min-h-[96px] flex-col items-start justify-between rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/90 p-3.5 text-right shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-[color:var(--brand)]/40 hover:shadow-sm active:scale-[0.98]',
                a.disabled && 'cursor-not-allowed opacity-45 hover:translate-y-0'
              )}
            >
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', a.tone)}>
                {a.icon}
              </div>
              <div className="mt-2 min-w-0 flex-1">
                <p className="text-sm font-extrabold text-[color:var(--ink)]">{a.title}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">{a.hint}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </FormSheet>
  );
};

export default QuickAddSheet;
