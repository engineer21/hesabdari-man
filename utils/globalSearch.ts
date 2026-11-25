import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Landmark,
  Network,
  PieChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import type { Account, AppSession, Contact, ContactGroup, Transaction, View } from '../types';
import { APP_NAV } from './appNav';
import { getAccountPathLabel } from './accountTree';
import { contactLabel } from './contactStats';
import { canAccessView } from './permissions';
import { formatNumberWithCommas, toPersianDigits } from './formatters';

export type SearchResultKind =
  | 'account-report'
  | 'contact'
  | 'contact-group'
  | 'transaction'
  | 'navigation';

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  group: string;
  keywords: string;
  icon: LucideIcon;
  tone: 'brand' | 'income' | 'expense' | 'info' | 'warning' | 'neutral';
  payload:
    | { accountId: string }
    | { contactId: string }
    | { groupId: string }
    | { transactionId: string; txnType: 'income' | 'expense' }
    | { view: View };
}

const MODULE_LABEL: Record<Account['module'], string> = {
  income: 'درآمد',
  expense: 'هزینه',
  bank: 'بانک',
};

/** In-memory recent searches — no localStorage */
let recentSearchIds: string[] = [];
const MAX_RECENT = 8;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\u200c/g, '')
    .replace(/[يی]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

/** command-score inspired ranking for Persian/Latin queries */
export function scoreMatch(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 82;
  if (t.includes(q)) return 64;

  const words = t.split(/[\s/·\-]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 72;

  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 38;

  return 0;
}

function bestScore(query: string, ...parts: (string | undefined)[]): number {
  return Math.max(0, ...parts.filter(Boolean).map((p) => scoreMatch(query, p!)));
}

export function buildSearchIndex(input: {
  accounts: Account[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  transactions: Transaction[];
  session: AppSession;
}): SearchResult[] {
  const { accounts, contacts, contactGroups, transactions, session } = input;
  const results: SearchResult[] = [];

  for (const item of APP_NAV) {
    if (!canAccessView(session, item.id)) continue;
    results.push({
      id: `nav-${item.id}`,
      kind: 'navigation',
      title: item.label,
      subtitle: 'رفتن به بخش',
      group: 'صفحات',
      keywords: `${item.label} ${item.id} navigation`,
      icon: item.icon,
      tone: 'brand',
      payload: { view: item.id },
    });
  }

  for (const account of accounts.filter((a) => a.isActive)) {
    if (!canAccessView(session, 'reports')) continue;
    const path = getAccountPathLabel(accounts, account.id);
    const moduleLabel = MODULE_LABEL[account.module];
    results.push({
      id: `acc-${account.id}`,
      kind: 'account-report',
      title: account.name,
      subtitle: `${moduleLabel} · ${path}${account.code ? ` · ${account.code}` : ''}`,
      group: account.module === 'bank' ? 'بانک‌ها' : 'سرفصل‌ها',
      keywords: `${account.name} ${account.code} ${path} ${moduleLabel} گزارش سرفصل`,
      icon: account.module === 'bank' ? Landmark : Network,
      tone: account.module === 'income' ? 'income' : account.module === 'expense' ? 'expense' : 'info',
      payload: { accountId: account.id },
    });
  }

  for (const group of contactGroups) {
    if (!canAccessView(session, 'persons')) continue;
    results.push({
      id: `grp-${group.id}`,
      kind: 'contact-group',
      title: group.name,
      subtitle: 'گروه اشخاص',
      group: 'اشخاص',
      keywords: `${group.name} گروه اشخاص`,
      icon: Users,
      tone: 'warning',
      payload: { groupId: group.id },
    });
  }

  for (const contact of contacts) {
    if (!canAccessView(session, 'persons')) continue;
    const label = contactLabel(contacts, contactGroups, contact.id);
    results.push({
      id: `ct-${contact.id}`,
      kind: 'contact',
      title: contact.fullName,
      subtitle: label,
      group: 'اشخاص',
      keywords: `${contact.fullName} ${contact.mobile || ''} ${label} شخص`,
      icon: UserRound,
      tone: 'info',
      payload: { contactId: contact.id },
    });
  }

  if (canAccessView(session, 'income') || canAccessView(session, 'expense')) {
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 400);
    for (const tx of sorted) {
      if (tx.type !== 'income' && tx.type !== 'expense') continue;
      if (tx.type === 'income' && !canAccessView(session, 'income')) continue;
      if (tx.type === 'expense' && !canAccessView(session, 'expense')) continue;

      const acc = accounts.find((a) => a.id === tx.accountId);
      const person = contactLabel(contacts, contactGroups, tx.contactId);
      const amount = toPersianDigits(formatNumberWithCommas(Math.round(tx.amount)));
      results.push({
        id: `tx-${tx.id}`,
        kind: 'transaction',
        title: tx.description?.trim() || (tx.type === 'income' ? 'درآمد' : 'هزینه'),
        subtitle: `${tx.type === 'income' ? 'درآمد' : 'هزینه'} · ${amount} · ${tx.date}${acc ? ` · ${acc.name}` : ''}${person ? ` · ${person}` : ''}`,
        group: 'تراکنش‌ها',
        keywords: `${tx.description} ${tx.date} ${amount} ${acc?.name || ''} ${person} ${tx.type}`,
        icon: tx.type === 'income' ? TrendingUp : TrendingDown,
        tone: tx.type === 'income' ? 'income' : 'expense',
        payload: { transactionId: tx.id, txnType: tx.type },
      });
    }
  }

  if (canAccessView(session, 'reports')) {
    results.push({
      id: 'action-reports-hub',
      kind: 'navigation',
      title: 'مرکز گزارشات',
      subtitle: 'لیست همه گزارش‌ها',
      group: 'اقدامات',
      keywords: 'گزارش reports گردش مانده',
      icon: PieChart,
      tone: 'brand',
      payload: { view: 'reports' },
    });
  }

  if (canAccessView(session, 'dashboard')) {
    results.push({
      id: 'action-dashboard',
      kind: 'navigation',
      title: 'داشبورد',
      subtitle: 'خلاصه مالی',
      group: 'اقدامات',
      keywords: 'خانه dashboard داشبورد',
      icon: Home,
      tone: 'brand',
      payload: { view: 'dashboard' },
    });
  }

  if (canAccessView(session, 'access')) {
    results.push({
      id: 'action-access',
      kind: 'navigation',
      title: 'دسترسی کاربران',
      subtitle: 'گروه مجوز و پرسنل',
      group: 'اقدامات',
      keywords: 'دسترسی rbac کاربر',
      icon: ShieldCheck,
      tone: 'info',
      payload: { view: 'access' },
    });
  }

  return results;
}

export function filterSearchResults(items: SearchResult[], query: string): SearchResult[] {
  const q = query.trim();
  if (!q) {
    const recentIds = readRecentIds();
    const recent = recentIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is SearchResult => Boolean(item))
      .map((item) => ({ ...item, group: 'اخیر' }));
    if (recent.length) return recent;
    return items.slice(0, 12);
  }

  return items
    .map((item) => ({
      item,
      score: bestScore(q, item.title, item.subtitle, item.keywords, item.group),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'fa'))
    .slice(0, 24)
    .map(({ item }) => item);
}

export function groupSearchResults(items: SearchResult[]): { label: string; items: SearchResult[] }[] {
  const order = ['اخیر', 'سرفصل‌ها', 'بانک‌ها', 'اشخاص', 'تراکنش‌ها', 'صفحات', 'اقدامات'];
  const map = new Map<string, SearchResult[]>();

  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }

  return order
    .filter((label) => map.has(label))
    .map((label) => ({ label, items: map.get(label)! }));
}

function readRecentIds(): string[] {
  return [...recentSearchIds];
}

export function pushRecentSearch(id: string) {
  const prev = recentSearchIds.filter((x) => x !== id);
  recentSearchIds = [id, ...prev].slice(0, MAX_RECENT);
}

export function resultActionLabel(result: SearchResult): string {
  switch (result.kind) {
    case 'account-report':
      return 'گزارش سرفصل';
    case 'contact':
      return 'جزئیات شخص';
    case 'contact-group':
      return 'گروه اشخاص';
    case 'transaction':
      return (result.payload as { txnType: 'income' | 'expense' }).txnType === 'income'
        ? 'صفحه درآمد'
        : 'صفحه هزینه';
    case 'navigation':
      return 'رفتن';
    default:
      return 'باز کردن';
  }
}

export const SEARCH_SHORTCUT_HINT = 'Ctrl+K';
