import React, { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Search, X } from 'lucide-react';
import type { Account, AppSession, Contact, ContactGroup, Transaction } from '../../types';
import {
  buildSearchIndex,
  filterSearchResults,
  pushRecentSearch,
  SEARCH_SHORTCUT_HINT,
  type SearchResult,
} from '../../utils/globalSearch';
import SearchResultsList from './SearchResultsList';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  transactions: Transaction[];
  session: AppSession;
  onSelect: (result: SearchResult) => void;
  /** Per-page hint (design: «جستجو در اشخاص» on persons) */
  placeholder?: string;
}

const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({
  open,
  onOpenChange,
  accounts,
  contacts,
  contactGroups,
  transactions,
  session,
  onSelect,
  placeholder,
}) => {
  const [query, setQuery] = useState('');

  const index = useMemo(
    () =>
      buildSearchIndex({
        accounts,
        contacts,
        contactGroups,
        transactions,
        session,
      }),
    [accounts, contacts, contactGroups, transactions, session]
  );

  const results = useMemo(() => filterSearchResults(index, query), [index, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    pushRecentSearch(result.id);
    onSelect(result);
    onOpenChange(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="جستجوی سراسری"
      shouldFilter={false}
      dir="rtl"
      overlayClassName="command-palette-overlay"
      contentClassName="command-palette-content"
    >
      <div className="command-palette-panel overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--surface-1)] shadow-[0_24px_80px_-12px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--line)] px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--brand-soft)] text-[color:var(--brand)] sm:h-10 sm:w-10">
            <Search size={17} />
          </div>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder || 'جستجو: سرفصل، شخص، تراکنش، صفحه…'}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)] sm:text-base"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] sm:h-9 sm:w-9"
            aria-label="بستن"
          >
            <X size={16} />
          </button>
        </div>

        <SearchResultsList query={query} results={results} onSelect={handleSelect} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/50 px-3 py-2 text-[10px] text-[color:var(--muted)] sm:px-4 sm:py-2.5">
          <span className="font-medium">↑↓ حرکت · Enter انتخاب · Esc بستن</span>
          <span className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-1)] px-1.5 py-0.5 font-bold">
            {SEARCH_SHORTCUT_HINT}
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
};

export default GlobalSearchDialog;
