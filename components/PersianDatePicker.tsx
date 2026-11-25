import React, { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Calendar, X } from 'lucide-react';
import { formatJalaliLong } from '../utils/jalaliPeriod';
import PersianCalendar from './PersianCalendar';
import { cn, fieldPicker } from './ui';

interface PersianDatePickerProps {
  value: string; // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
}

const PersianDatePicker: React.FC<PersianDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ شمسی',
  clearable = false,
  disabled = false,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formattedDate = useMemo(() => {
    if (!value) return '';
    return formatJalaliLong(value);
  }, [value]);

  const handleDateSelect = (date: string | null) => {
    onChange(date ?? '');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div
        className={cn(
          fieldPicker,
          'gap-2',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(true)}
          className="flex min-w-0 flex-1 items-center justify-start text-right outline-none"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <span
            className={cn(
              'truncate tabular-nums',
              formattedDate
                ? 'font-bold text-[color:var(--ink)]'
                : 'font-medium text-[color:var(--muted)]'
            )}
          >
            {formattedDate || placeholder}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {clearable && value && !disabled ? (
            <button
              type="button"
              aria-label="پاک کردن تاریخ"
              onClick={() => onChange('')}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--expense)]"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(true)}
            aria-label="باز کردن تقویم شمسی"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:text-[color:var(--brand)]"
          >
            <Calendar size={16} aria-hidden />
          </button>
        </div>
      </div>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-[3px] animate-fade-in" />
          <Dialog.Content
            aria-label="تقویم شمسی"
            className="fixed left-1/2 top-1/2 z-[125] w-[calc(100vw-2rem)] max-w-[20.5rem] -translate-x-1/2 -translate-y-1/2 outline-none"
          >
            <Dialog.Title className="sr-only">انتخاب تاریخ شمسی</Dialog.Title>
            <Dialog.Description className="sr-only">
              روز، ماه و سال شمسی مورد نظر را انتخاب کنید یا دکمه امروز را بزنید.
            </Dialog.Description>
            <PersianCalendar
              transactions={[]}
              selectedDate={value}
              onDateSelect={handleDateSelect}
              clearable={clearable}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default PersianDatePicker;
