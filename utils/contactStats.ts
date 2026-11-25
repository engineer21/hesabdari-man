import type { Contact, ContactGroup, Transaction } from '../types';
import { PERSONNEL_GROUP_ID } from '../constants';

const PERSONNEL_GROUP_REGEX = /پرسنل|کارگر|کارمند|نیروی انسانی/;

export function isPersonnelGroup(group?: ContactGroup): boolean {
  if (!group) return false;
  return group.id === PERSONNEL_GROUP_ID || PERSONNEL_GROUP_REGEX.test(group.name || '');
}

/**
 * Determines whether a contact is defined as personnel/worker.
 * True when explicitly flagged `isPersonnel: true` OR assigned to a personnel group.
 */
export function isPersonnelContact(contact: Contact, groups: ContactGroup[]): boolean {
  if (contact.isPersonnel === true) return true;
  const g = groups.find((x) => x.id === contact.groupId);
  return isPersonnelGroup(g);
}

export function filterPersonnelContacts(
  contacts: Contact[],
  groups: ContactGroup[]
): Contact[] {
  return contacts
    .filter((c) => isPersonnelContact(c, groups))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));
}

/**
 * Suggests a natural Persian work-unit label based on an expense heading name
 * (e.g. «آبگیری» -> «شبانه‌روز», «کارگری دسته‌جمعی» -> «نفر-روز», «حقوق ثابت» -> «ماه»).
 */
export function suggestUnitForHeadingName(headingName?: string): string {
  const n = (headingName || '').trim();
  if (/آبگیر|آبیار/.test(n)) return 'شبانه‌روز';
  if (/دسته‌جمعی|گروهی|تیمی/.test(n)) return 'نفر-روز';
  if (/ثابت|ماهان/.test(n)) return 'ماه';
  if (/ساعت|اضافه‌کار/.test(n)) return 'ساعت';
  if (/هکتار|سم‌پاش|شخم/.test(n)) return 'هکتار';
  return 'روز';
}

export function contactsInGroup(contacts: Contact[], groupId: string): Contact[] {
  return contacts
    .filter((c) => c.groupId === groupId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));
}

export function sortGroups(groups: ContactGroup[]): ContactGroup[] {
  return [...groups].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'fa')
  );
}

export function contactLabel(
  contacts: Contact[],
  groups: ContactGroup[],
  contactId?: string
): string {
  if (!contactId) return '';
  const c = contacts.find((x) => x.id === contactId);
  if (!c) return '';
  const g = groups.find((x) => x.id === c.groupId);
  return g ? `${g.name} / ${c.fullName}` : c.fullName;
}

export function contactIncomeTotal(contactId: string, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.contactId === contactId && t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
}

export function contactExpenseTotal(contactId: string, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.contactId === contactId && t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
}

export function contactTransactions(
  contactId: string,
  transactions: Transaction[]
): Transaction[] {
  return [...transactions]
    .filter((t) => t.contactId === contactId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
