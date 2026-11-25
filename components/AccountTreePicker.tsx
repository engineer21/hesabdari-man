import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Check, Search } from 'lucide-react';
import type { Account, AccountModule } from '../types';
import { getChildren, getAccountById, getAccountPathLabel, getPostableLeaves } from '../utils/accountTree';
import { MODULE_ROOT_IDS } from '../constants';
import { FormSheet, cn, fieldLabel, fieldPicker } from './ui';

interface AccountTreePickerProps {
  accounts: Account[];
  module: AccountModule;
  value: string;
  onChange: (accountId: string) => void;
  label?: string;
  banksOnly?: boolean;
}

const AccountTreePicker: React.FC<AccountTreePickerProps> = ({
  accounts,
  module,
  value,
  onChange,
  label = 'سرفصل',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootId = MODULE_ROOT_IDS[module];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const selectedAccount = useMemo(
    () => (value ? getAccountById(accounts, value) : undefined),
    [value, accounts]
  );

  const selectedFullPath = useMemo(
    () => (value ? getAccountPathLabel(accounts, value) : ''),
    [value, accounts]
  );

  const leaves = useMemo(() => getPostableLeaves(accounts, rootId), [accounts, rootId]);
  const root = accounts.find((a) => a.id === rootId);

  const filteredLeaves = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return leaves.filter((a) =>
      `${a.name} ${a.code} ${getAccountPathLabel(accounts, a.id)}`.toLowerCase().includes(q)
    );
  }, [leaves, query, accounts]);

  const renderNode = (account: Account, depth: number): React.ReactNode => {
    const children = getChildren(accounts, account.id);
    const hasChildren = children.length > 0;
    const isOpen = !collapsed[account.id];
    const selectable = account.kind === 'postable';

    return (
      <div key={account.id}>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-xl py-2.5 pe-3 text-right transition',
            selectable
              ? value === account.id
                ? 'bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                : 'hover:bg-[color:var(--surface-2)]/75'
              : 'hover:bg-[color:var(--surface-2)]/40'
          )}
          style={{ paddingInlineStart: `${12 + depth * 16}px` }}
          onClick={() => {
            if (hasChildren) setCollapsed((e) => ({ ...e, [account.id]: !e[account.id] }));
            if (selectable) {
              onChange(account.id);
              setOpen(false);
            }
          }}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown size={15} className="shrink-0 text-[color:var(--muted)]" />
            ) : (
              <ChevronLeft size={15} className="shrink-0 text-[color:var(--muted)]" />
            )
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              selectable
                ? 'font-bold text-[color:var(--ink)]'
                : 'font-semibold text-[color:var(--muted)]'
            )}
          >
            {account.name}
          </span>
          {selectable && value === account.id ? (
            <Check size={16} className="shrink-0 text-[color:var(--brand)]" />
          ) : null}
        </button>
        {hasChildren && isOpen ? children.map((c) => renderNode(c, depth + 1)) : null}
      </div>
    );
  };

  return (
    <div className="block">
      {label ? <label className={fieldLabel}>{label}</label> : null}
      <button
        type="button"
        title={selectedFullPath || label}
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
        className={fieldPicker}
      >
        <span
          className={cn(
            'truncate text-sm',
            selectedAccount
              ? 'font-bold text-[color:var(--ink)]'
              : 'font-medium text-[color:var(--muted)]'
          )}
        >
          {selectedAccount ? selectedAccount.name : 'انتخاب کنید'}
        </span>
        <ChevronDown size={16} className="shrink-0 text-[color:var(--muted)]" />
      </button>

      <FormSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`انتخاب ${label}`}
        subtitle="سرفصل مورد نظر را جست‌وجو یا از ساختار درختی انتخاب کنید"
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
              placeholder="جست‌وجوی نام یا کد سرفصل..."
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>

          <div className="max-h-[48vh] space-y-0.5 overflow-y-auto nice-scroll">
            {query.trim() ? (
              filteredLeaves.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted)]">
                  سرفصلی با این عنوان پیدا نشد.
                </p>
              ) : (
                filteredLeaves.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onChange(a.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-right transition',
                      value === a.id
                        ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)]'
                        : 'border-transparent hover:bg-[color:var(--surface-2)]/75'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[color:var(--ink)]">{a.name}</p>
                      <p className="truncate text-[11px] text-[color:var(--muted)]">
                        {getAccountPathLabel(accounts, a.id)}
                      </p>
                    </div>
                    {value === a.id ? <Check size={16} className="shrink-0 text-[color:var(--brand)]" /> : null}
                  </button>
                ))
              )
            ) : leaves.length === 0 ? (
              <p className="p-8 text-center text-sm text-[color:var(--muted)]">
                سرفصل قابل‌ثبتی وجود ندارد. از منوی کدینگ و سرفصل‌ها اضافه کنید.
              </p>
            ) : root ? (
              renderNode(root, 0)
            ) : null}
          </div>
        </div>
      </FormSheet>
    </div>
  );
};

export default AccountTreePicker;
