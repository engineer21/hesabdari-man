import React from 'react';
import { Command } from 'cmdk';
import { ArrowLeft, FileBarChart, Sparkles } from 'lucide-react';
import {
  groupSearchResults,
  resultActionLabel,
  type SearchResult,
} from '../../utils/globalSearch';
import { cn } from '../ui';

interface SearchResultsListProps {
  query: string;
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  compact?: boolean;
  className?: string;
}

const toneIcon: Record<SearchResult['tone'], string> = {
  brand: 'bg-[color:var(--brand-soft)] text-[color:var(--brand)]',
  income: 'tone-income',
  expense: 'tone-expense',
  info: 'bg-[color:var(--info-soft)] text-[color:var(--info)]',
  warning: 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]',
  neutral: 'bg-[color:var(--surface-2)] text-[color:var(--muted)]',
};

const SearchResultsList: React.FC<SearchResultsListProps> = ({
  query,
  results,
  onSelect,
  compact,
  className,
}) => {
  const grouped = groupSearchResults(results);

  return (
    <Command.List
      className={cn(
        'overflow-y-auto scroll-smooth p-1.5 sm:p-2',
        compact ? 'max-h-56' : 'max-h-[min(52vh,22rem)] sm:max-h-[min(58vh,26rem)]',
        className
      )}
    >
      <Command.Empty className="px-4 py-8 text-center sm:py-10">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface-2)] text-[color:var(--muted)]">
          <Sparkles size={18} />
        </div>
        <p className="text-sm font-bold text-[color:var(--ink)]">نتیجه‌ای یافت نشد</p>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          نام سرفصل، شخص، مبلغ یا تاریخ را امتحان کنید
        </p>
      </Command.Empty>

      {!query.trim() && results.length > 0 ? (
        <p className="px-2.5 pb-1.5 pt-0.5 text-[10px] font-bold tracking-wide text-[color:var(--muted)]">
          {results.some((r) => r.group === 'اخیر') ? 'جستجوهای اخیر' : 'پیشنهادها'}
        </p>
      ) : null}

      {grouped.map((group) => (
        <Command.Group key={group.label} heading={group.label} className="command-palette-group">
          {group.items.map((result) => {
            const Icon = result.icon;
            const action = resultActionLabel(result);
            return (
              <Command.Item
                key={result.id}
                value={`${result.id} ${result.keywords}`}
                onSelect={() => onSelect(result)}
                className={cn(
                  'command-palette-item flex cursor-pointer items-center gap-2.5 rounded-2xl px-2.5 py-2 outline-none transition sm:gap-3 sm:px-3 sm:py-2.5',
                  'data-[selected=true]:bg-[color:var(--brand-soft)] data-[selected=true]:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand)_18%,transparent)]'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10',
                    toneIcon[result.tone]
                  )}
                >
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <p className="truncate text-[13px] font-bold text-[color:var(--ink)] sm:text-sm">
                    {result.title}
                  </p>
                  {result.subtitle ? (
                    <p className="truncate text-[10px] text-[color:var(--muted)] sm:text-[11px]">
                      {result.subtitle}
                    </p>
                  ) : null}
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[9px] font-bold text-[color:var(--brand)] sm:px-2.5 sm:py-1 sm:text-[10px]">
                  {result.kind === 'account-report' ? <FileBarChart size={10} /> : null}
                  <span className="hidden sm:inline">{action}</span>
                  <ArrowLeft size={10} className="opacity-60" />
                </span>
              </Command.Item>
            );
          })}
        </Command.Group>
      ))}
    </Command.List>
  );
};

export default SearchResultsList;
