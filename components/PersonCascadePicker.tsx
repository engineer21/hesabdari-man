import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Check, Search, Users, X } from 'lucide-react';
import type { Contact, ContactGroup } from '../types';
import { contactsInGroup, contactLabel, sortGroups } from '../utils/contactStats';
import { FormSheet, cn, fieldLabel, fieldPicker } from './ui';

interface PersonCascadePickerProps {
  groups: ContactGroup[];
  contacts: Contact[];
  value?: string;
  onChange: (contactId: string | undefined) => void;
  label?: string;
  placeholder?: string;
}

type Step = 'closed' | 'groups' | 'people';

const PersonCascadePicker: React.FC<PersonCascadePickerProps> = ({
  groups,
  contacts,
  value,
  onChange,
  label = 'شخص (اختیاری)',
  placeholder = 'بدون شخص',
}) => {
  const [step, setStep] = useState<Step>('closed');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const sortedGroups = useMemo(() => sortGroups(groups), [groups]);
  const people = useMemo(
    () => (groupId ? contactsInGroup(contacts, groupId) : []),
    [contacts, groupId]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return contacts.filter((c) => c.fullName.toLowerCase().includes(q));
  }, [contacts, query]);

  const display = contactLabel(contacts, groups, value) || '';

  const open = () => {
    setGroupId(null);
    setQuery('');
    setStep('groups');
  };

  const close = () => setStep('closed');

  return (
    <div className="block">
      {label ? <label className={fieldLabel}>{label}</label> : null}
      <div className={fieldPicker}>
        <button
          type="button"
          onClick={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-right outline-none"
        >
          <Users size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
          <span
            className={cn(
              'truncate text-sm',
              value ? 'font-bold text-[color:var(--ink)]' : 'font-medium text-[color:var(--muted)]'
            )}
          >
            {display || placeholder}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {value ? (
            <button
              type="button"
              aria-label="حذف انتخاب شخص"
              onClick={() => onChange(undefined)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--expense)]"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={open}
            aria-label={label}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[color:var(--muted)]"
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      </div>

      <FormSheet
        isOpen={step !== 'closed'}
        onClose={close}
        title={step === 'people' ? 'انتخاب شخص' : 'انتخاب شخص / طرف‌حساب'}
        subtitle="جست‌وجو کنید یا از طریق دسته‌بندی گروه انتخاب نمایید"
        size="md"
        layer="nested"
        accent="brand"
      >
        <div className="space-y-3">
          <div className="flex h-11 items-center gap-2.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3.5 focus-within:border-[color:var(--brand)] focus-within:ring-3 focus-within:ring-[color:var(--brand-glow)]">
            <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجوی سریع نام شخص..."
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>

          {query.trim() ? (
            <div className="max-h-[45vh] space-y-1.5 overflow-y-auto nice-scroll">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    close();
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-right transition',
                    value === p.id
                      ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)]'
                      : 'border-[color:var(--line)] bg-[color:var(--surface-solid)] hover:border-[color:var(--brand)]/40'
                  )}
                >
                  <span className="text-sm font-bold text-[color:var(--ink)]">{p.fullName}</span>
                  {value === p.id ? <Check size={16} className="text-[color:var(--brand)]" /> : null}
                </button>
              ))}
              {searchResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted)]">
                  شخصی با این نام پیدا نشد.
                </p>
              ) : null}
            </div>
          ) : step === 'groups' ? (
            <div className="max-h-[48vh] space-y-2 overflow-y-auto nice-scroll">
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  close();
                }}
                className="flex w-full items-center justify-between rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-2)]/50 px-4 py-3 text-right transition hover:border-[color:var(--brand)]/40"
              >
                <span className="text-sm font-semibold text-[color:var(--muted)]">بدون شخص</span>
                {!value ? <Check size={16} className="text-[color:var(--brand)]" /> : null}
              </button>
              {sortedGroups.map((g) => {
                const count = contactsInGroup(contacts, g.id).length;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGroupId(g.id);
                      setStep('people');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-4 py-3 text-right transition hover:border-[color:var(--brand)]/40 active:scale-[0.99]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tone-brand">
                      <Users size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[color:var(--ink)]">{g.name}</p>
                      <p className="text-xs text-[color:var(--muted)]">{count} نفر</p>
                    </div>
                    <ChevronLeft className="text-[color:var(--muted)]" size={16} />
                  </button>
                );
              })}
              {sortedGroups.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted)]">
                  ابتدا از منوی اشخاص یک گروه بسازید.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[48vh] space-y-2 overflow-y-auto nice-scroll">
              <button
                type="button"
                onClick={() => setStep('groups')}
                className="mb-1 inline-flex items-center gap-1 text-xs font-extrabold text-[color:var(--brand)] hover:underline"
              >
                ← بازگشت به گروه‌ها
              </button>
              {people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    close();
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-right transition',
                    value === p.id
                      ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)]'
                      : 'border-[color:var(--line)] bg-[color:var(--surface-solid)] hover:border-[color:var(--brand)]/40'
                  )}
                >
                  <span className="text-sm font-bold text-[color:var(--ink)]">{p.fullName}</span>
                  {value === p.id ? <Check size={16} className="text-[color:var(--brand)]" /> : null}
                </button>
              ))}
              {people.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted)]">
                  در این گروه کسی ثبت نشده است.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </FormSheet>
    </div>
  );
};

export default PersonCascadePicker;
