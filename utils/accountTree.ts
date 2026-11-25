import type { Account, AccountModule } from '../types';

export function getChildren(accounts: Account[], parentId: string | null): Account[] {
  return accounts
    .filter((a) => a.parentId === parentId && a.isActive !== false)
    .sort((a, b) => a.code.localeCompare(b.code, 'fa', { numeric: true }));
}

export function getAccountById(accounts: Account[], id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}

export function getDescendantIds(accounts: Account[], rootId: string, includeSelf = true): string[] {
  const result: string[] = includeSelf ? [rootId] : [];
  const walk = (parentId: string) => {
    for (const child of accounts.filter((a) => a.parentId === parentId)) {
      result.push(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return result;
}

export function getPostableLeaves(accounts: Account[], rootId?: string): Account[] {
  const scope = rootId ? new Set(getDescendantIds(accounts, rootId)) : null;
  return accounts.filter(
    (a) => a.kind === 'postable' && a.isActive !== false && (!scope || scope.has(a.id))
  );
}

export function getBankAccounts(accounts: Account[]): Account[] {
  return getPostableLeaves(accounts, 'acc_bank');
}

export function getAccountPath(accounts: Account[], id: string): Account[] {
  const path: Account[] = [];
  let current = getAccountById(accounts, id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getAccountById(accounts, current.parentId) : undefined;
  }
  return path;
}

export function getAccountPathLabel(accounts: Account[], id: string): string {
  return getAccountPath(accounts, id)
    .map((a) => a.name)
    .join(' / ');
}

export function nextChildCode(accounts: Account[], parentId: string): string {
  const parent = getAccountById(accounts, parentId);
  const siblings = accounts.filter((a) => a.parentId === parentId);
  const next = siblings.length + 1;
  return parent ? `${parent.code}-${next}` : String(next);
}

export function canDeleteAccount(accounts: Account[], id: string): boolean {
  const acc = getAccountById(accounts, id);
  if (!acc || acc.isSystem) return false;
  return !accounts.some((a) => a.parentId === id);
}

export function moduleLabel(module: AccountModule): string {
  switch (module) {
    case 'income':
      return 'درآمد';
    case 'expense':
      return 'هزینه';
    case 'bank':
      return 'بانک';
  }
}
