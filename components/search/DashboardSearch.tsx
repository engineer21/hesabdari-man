import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { cn } from '../ui';

interface DashboardSearchProps {
  accounts: Account[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  transactions: Transaction[];
  session: AppSession;
  onSelect: (result: SearchResult) => void;
  focusToken?: number;
  embedded?: boolean;
}

const DashboardSearch: React.FC<DashboardSearchProps> = ({
  accounts,
  contacts,
  contactGroups,
  transactions,
  session,
  onSelect,
  focusToken = 0,
  embedded = false,
}) => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  const showResults = expanded && (query.trim().length > 0 || results.length > 0);

  useEffect(() => {
    if (!focusToken) return;
    setExpanded(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [focusToken]);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        if (!query.trim()) setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded, query]);

  const handleSelect = (result: SearchResult) => {
    pushRecentSearch(result.id);
    setQuery('');
    setExpanded(false);
    onSelect(result);
  };

  return (
    <div ref={rootRef} className={cn('relative', embedded ? 'mt-4' : '')}>
      <Command shouldFilter={false} label="جستجوی داشبورد" className="relative">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-2xl border bg-[color:var(--surface-1)]/95 px-3 py-2.5 shadow-[var(--shadow-sm)] transition sm:gap-3 sm:px-4 sm:py-3',
            expanded
              ? 'border-[color:var(--brand)]/35 ring-2 ring-[color:var(--brand)]/12'
              : 'border-[color:var(--line)]'
          )}
        >
          <Search size={18} className="shrink-0 text-[color:var(--brand)]" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setExpanded(true)}
            placeholder="جستجو: سرفصل، شخص، تراکنش…"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)] sm:text-[15px]"
          />
          <kbd className="hidden rounded-md border border-[color:var(--line)] bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--muted)] lg:inline">
            {SEARCH_SHORTCUT_HINT}
          </kbd>
          {(query || expanded) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                if (!query) setExpanded(false);
                inputRef.current?.focus();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
              aria-label="پاک کردن"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {showResults ? (
          <div
            className={cn(
              'z-20 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] shadow-[var(--shadow-md)]',
              embedded ? 'absolute inset-x-0 top-[calc(100%+0.5rem)]' : 'mt-3'
            )}
          >
            <SearchResultsList query={query} results={results} onSelect={handleSelect} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/60 px-3 py-2 text-[10px] text-[color:var(--muted)]">
              <span>↑↓ · Enter</span>
              <span>{results.length} نتیجه</span>
            </div>
          </div>
        ) : null}
      </Command>
    </div>
  );
};

export default DashboardSearch;
