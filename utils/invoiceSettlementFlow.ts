import type { CheckItem, Invoice, InvoiceKind, Transaction } from '../types';
import { computeInvoiceSettlement, type InvoiceSettlementSummary } from './accrualEngine';

export interface DraftSettlementStage {
  id: string;
  /** 'cash' => bank/cashbox transaction ('invoice_settlement'), 'check' => CheckItem */
  method: 'cash' | 'check';
  /** Raw numeric string or integer amount */
  amountStr: string;
  /** Transaction date or Check issueDate (YYYY-MM-DD) */
  date: string;
  /** For check: dueDate (YYYY-MM-DD) */
  dueDate: string;
  /** Treasury bank/cashbox account ID */
  bankAccountId: string;
  /** For check: check serial number */
  checkNumber: string;
  /** For check: optional 16-digit Sayad ID */
  sayadId: string;
  /** Optional description / tracking note */
  description: string;
  /** If loaded from an existing saved transaction or check */
  existingId?: string;
  /** Existing check status if method === 'check' */
  existingCheckStatus?: CheckItem['status'];
}

export interface DraftSettlementTotals {
  invoiceTotal: number;
  cashPaidTotal: number;
  cashStageCount: number;
  checksTotal: number;
  checkStageCount: number;
  settledTotal: number;
  remaining: number;
  overpaid: number;
  progressPct: number;
  status: 'unpaid' | 'partial' | 'paid';
}

function parseDigitsAmount(raw: string): number {
  if (!raw) return 0;
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[^\d]/g, '');
  const n = parseInt(normalized, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Computes real-time totals for multi-stage payments & checks inside the Invoice Editor
 * or Settlement Modal.
 */
export function computeDraftSettlementTotals(
  invoiceTotal: number,
  stages: DraftSettlementStage[]
): DraftSettlementTotals {
  const safeTotal = Math.max(0, Math.round(invoiceTotal || 0));
  let cashPaidTotal = 0;
  let cashStageCount = 0;
  let checksTotal = 0;
  let checkStageCount = 0;

  for (const st of stages) {
    const amt = parseDigitsAmount(st.amountStr);
    if (amt <= 0) continue;
    if (st.method === 'cash') {
      cashPaidTotal += amt;
      cashStageCount += 1;
    } else {
      // Bounced or cancelled existing checks do not count toward active settlement
      if (st.existingCheckStatus === 'bounced' || st.existingCheckStatus === 'cancelled') {
        continue;
      }
      checksTotal += amt;
      checkStageCount += 1;
    }
  }

  const settledTotal = cashPaidTotal + checksTotal;
  const remaining = Math.max(0, safeTotal - settledTotal);
  const overpaid = settledTotal > safeTotal ? settledTotal - safeTotal : 0;
  const progressPct =
    safeTotal > 0 ? Math.min(100, Math.round((settledTotal / safeTotal) * 100)) : 0;
  const status: 'unpaid' | 'partial' | 'paid' =
    settledTotal <= 0 ? 'unpaid' : remaining === 0 && safeTotal > 0 ? 'paid' : 'partial';

  return {
    invoiceTotal: safeTotal,
    cashPaidTotal,
    cashStageCount,
    checksTotal,
    checkStageCount,
    settledTotal,
    remaining,
    overpaid,
    progressPct,
    status,
  };
}

/**
 * Builds initial draft stages from an existing invoice's linked transactions and checks
 * so editing an invoice preserves and displays all multi-stage payments and checks.
 */
export function buildDraftStagesFromExisting(
  invoiceId: string,
  transactions: Transaction[],
  checks: CheckItem[]
): DraftSettlementStage[] {
  const txStages: DraftSettlementStage[] = transactions
    .filter((t) => t.invoiceId === invoiceId && t.linkKind === 'invoice_settlement')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      id: `st_tx_${t.id}`,
      method: 'cash',
      amountStr: String(t.amount),
      date: t.date,
      dueDate: t.date,
      bankAccountId: t.bankAccountId,
      checkNumber: '',
      sayadId: '',
      description: t.description || '',
      existingId: t.id,
    }));

  const checkStages: DraftSettlementStage[] = checks
    .filter((c) => c.invoiceId === invoiceId)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate))
    .map((c) => ({
      id: `st_chk_${c.id}`,
      method: 'check',
      amountStr: String(c.amount),
      date: c.issueDate,
      dueDate: c.dueDate,
      bankAccountId: c.bankAccountId,
      checkNumber: c.checkNumber,
      sayadId: c.sayadId || '',
      description: c.description || '',
      existingId: c.id,
      existingCheckStatus: c.status,
    }));

  return [...txStages, ...checkStages];
}

/**
 * Converts validated DraftSettlementStages for a saved invoice into concrete
 * Transaction[] (with linkKind: 'invoice_settlement') and CheckItem[] records.
 */
export function materializeInvoiceSettlementStages(params: {
  invoice: Invoice;
  contactName: string;
  stages: DraftSettlementStage[];
  existingChecks?: CheckItem[];
}): {
  settlementTransactions: Transaction[];
  settlementChecks: CheckItem[];
} {
  const { invoice, contactName, stages, existingChecks = [] } = params;
  const existingCheckMap = new Map(existingChecks.map((c) => [c.id, c]));

  const settlementTransactions: Transaction[] = [];
  const settlementChecks: CheckItem[] = [];

  let cashIndex = 0;
  let checkIndex = 0;

  for (const st of stages) {
    const amt = parseDigitsAmount(st.amountStr);
    if (amt <= 0 || !st.bankAccountId) continue;

    if (st.method === 'cash') {
      cashIndex += 1;
      const defaultDesc =
        invoice.kind === 'purchase'
          ? `پرداخت مرحله ${cashIndex} بابت فاکتور خرید #${invoice.invoiceNumber} — ${contactName}`
          : `دریافت مرحله ${cashIndex} بابت فاکتور فروش #${invoice.invoiceNumber} — ${contactName}`;

      settlementTransactions.push({
        id: st.existingId || `tx_is_${crypto.randomUUID().slice(0, 10)}`,
        type: invoice.kind === 'purchase' ? 'expense' : 'income',
        amount: amt,
        date: st.date || invoice.date,
        accountId: invoice.accountId,
        bankAccountId: st.bankAccountId,
        contactId: invoice.contactId,
        description: st.description.trim() || defaultDesc,
        linkKind: 'invoice_settlement',
        invoiceId: invoice.id,
      });
    } else {
      checkIndex += 1;
      const prevCheck = st.existingId ? existingCheckMap.get(st.existingId) : undefined;
      const defaultDesc =
        invoice.kind === 'purchase'
          ? `چک پرداختی بابت فاکتور خرید #${invoice.invoiceNumber} — ${contactName}`
          : `چک دریافتی بابت فاکتور فروش #${invoice.invoiceNumber} — ${contactName}`;

      settlementChecks.push({
        id: st.existingId || `chk_is_${crypto.randomUUID().slice(0, 10)}`,
        kind: invoice.kind === 'purchase' ? 'payable' : 'receivable',
        checkNumber: st.checkNumber.trim() || String(checkIndex),
        sayadId: st.sayadId.trim() || undefined,
        contactId: invoice.contactId,
        bankAccountId: st.bankAccountId,
        invoiceId: invoice.id,
        amount: amt,
        issueDate: st.date || invoice.date,
        dueDate: st.dueDate || st.date || invoice.date,
        status: prevCheck?.status || 'pending',
        settledDate: prevCheck?.settledDate,
        clearedTxId: prevCheck?.clearedTxId,
        description: st.description.trim() || defaultDesc,
      });
    }
  }

  return { settlementTransactions, settlementChecks };
}

/**
 * Returns open or all invoices matching a given mode ('income' => sale invoices, 'expense' => purchase invoices)
 * and optional contactId, enriched with their live settlement summary.
 */
export function getInvoicesForSettlementPicker(params: {
  invoices: Invoice[];
  transactions: Transaction[];
  checks: CheckItem[];
  kind?: InvoiceKind;
  contactId?: string;
  includePaid?: boolean;
  selectedInvoiceId?: string;
}): InvoiceSettlementSummary[] {
  const {
    invoices,
    transactions,
    checks,
    kind,
    contactId,
    includePaid = false,
    selectedInvoiceId,
  } = params;

  return invoices
    .filter((inv) => {
      if (kind && inv.kind !== kind) return false;
      if (contactId && inv.contactId !== contactId) return false;
      return true;
    })
    .map((inv) => computeInvoiceSettlement(inv, transactions, checks))
    .filter((s) => includePaid || s.remaining > 0 || s.invoice.id === selectedInvoiceId)
    .sort((a, b) => {
      // Unpaid/partial first, then newest date
      if ((a.remaining > 0) !== (b.remaining > 0)) {
        return a.remaining > 0 ? -1 : 1;
      }
      return b.invoice.date.localeCompare(a.invoice.date);
    });
}
