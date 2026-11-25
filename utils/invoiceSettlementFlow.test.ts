import test from 'node:test';
import assert from 'node:assert/strict';
import type { CheckItem, Invoice, Transaction } from '../types';
import {
  buildDraftStagesFromExisting,
  computeDraftSettlementTotals,
  getInvoicesForSettlementPicker,
  materializeInvoiceSettlementStages,
  type DraftSettlementStage,
} from './invoiceSettlementFlow';
import { computeInvoiceSettlement, computePersonBalance } from './accrualEngine';

const sampleSaleInvoice: Invoice = {
  id: 'inv_sale_1',
  kind: 'sale',
  invoiceNumber: '101',
  date: '2026-11-20',
  contactId: 'c_customer_1',
  accountId: 'acc_inc_sales_goods',
  amount: 50_000_000,
  description: 'فروش پسته اکبری',
};

test('computeDraftSettlementTotals accurately sums multi-stage cash and check payments with Persian digits', () => {
  const stages: DraftSettlementStage[] = [
    {
      id: 's1',
      method: 'cash',
      amountStr: '۱۵,۰۰۰,۰۰۰',
      date: '2026-11-20',
      dueDate: '2026-11-20',
      bankAccountId: 'acc_bank_mellat',
      checkNumber: '',
      sayadId: '',
      description: 'مرحله اول نقدی',
    },
    {
      id: 's2',
      method: 'cash',
      amountStr: '10000000',
      date: '2026-11-22',
      dueDate: '2026-11-22',
      bankAccountId: 'acc_bank_mellat',
      checkNumber: '',
      sayadId: '',
      description: 'مرحله دوم کارت به کارت',
    },
    {
      id: 's3',
      method: 'check',
      amountStr: '20,000,000',
      date: '2026-11-20',
      dueDate: '2026-12-20',
      bankAccountId: 'acc_bank_mellat',
      checkNumber: '982341',
      sayadId: '1234567890123456',
      description: 'چک یک ماهه',
    },
  ];

  const totals = computeDraftSettlementTotals(50_000_000, stages);
  assert.equal(totals.cashPaidTotal, 25_000_000);
  assert.equal(totals.cashStageCount, 2);
  assert.equal(totals.checksTotal, 20_000_000);
  assert.equal(totals.checkStageCount, 1);
  assert.equal(totals.settledTotal, 45_000_000);
  assert.equal(totals.remaining, 5_000_000);
  assert.equal(totals.progressPct, 90);
  assert.equal(totals.status, 'partial');
});

test('materializeInvoiceSettlementStages produces zero-double-counting transactions and checks that reconcile with computeInvoiceSettlement and computePersonBalance', () => {
  const stages: DraftSettlementStage[] = [
    {
      id: 's1',
      method: 'cash',
      amountStr: '20000000',
      date: '2026-11-20',
      dueDate: '2026-11-20',
      bankAccountId: 'acc_bank_1',
      checkNumber: '',
      sayadId: '',
      description: 'پیش‌پرداخت نقدی',
    },
    {
      id: 's2',
      method: 'check',
      amountStr: '30000000',
      date: '2026-11-20',
      dueDate: '2026-12-25',
      bankAccountId: 'acc_bank_1',
      checkNumber: '774411',
      sayadId: '',
      description: 'چک تسویه نهایی',
    },
  ];

  const { settlementTransactions, settlementChecks } = materializeInvoiceSettlementStages({
    invoice: sampleSaleInvoice,
    contactName: 'شرکت صادرات رفسنجان',
    stages,
  });

  assert.equal(settlementTransactions.length, 1);
  assert.equal(settlementTransactions[0].linkKind, 'invoice_settlement');
  assert.equal(settlementTransactions[0].invoiceId, 'inv_sale_1');
  assert.equal(settlementTransactions[0].type, 'income');

  assert.equal(settlementChecks.length, 1);
  assert.equal(settlementChecks[0].kind, 'receivable');
  assert.equal(settlementChecks[0].invoiceId, 'inv_sale_1');
  assert.equal(settlementChecks[0].checkNumber, '774411');

  // Verify invoice settlement status is 'paid' (0 remaining)
  const invSummary = computeInvoiceSettlement(
    sampleSaleInvoice,
    settlementTransactions,
    settlementChecks
  );
  assert.equal(invSummary.paidCash, 20_000_000);
  assert.equal(invSummary.pendingChecks, 30_000_000);
  assert.equal(invSummary.remaining, 0);
  assert.equal(invSummary.status, 'paid');

  // Verify person running balance is 0 (settled)
  const personBal = computePersonBalance(
    'c_customer_1',
    [sampleSaleInvoice],
    [],
    settlementChecks,
    settlementTransactions
  );
  assert.equal(personBal.totalDebit, 50_000_000);
  assert.equal(personBal.totalCredit, 50_000_000);
  assert.equal(personBal.netBalance, 0);
  assert.equal(personBal.status, 'settled');

  // Round-trip: buildDraftStagesFromExisting recovers all stages
  const rebuilt = buildDraftStagesFromExisting(
    'inv_sale_1',
    settlementTransactions,
    settlementChecks
  );
  assert.equal(rebuilt.length, 2);
});

test('getInvoicesForSettlementPicker filters by kind and contactId and prioritizes unpaid/partial invoices', () => {
  const invPaid: Invoice = {
    ...sampleSaleInvoice,
    id: 'inv_paid',
    invoiceNumber: '100',
    amount: 10_000_000,
  };
  const invOpen: Invoice = {
    ...sampleSaleInvoice,
    id: 'inv_open',
    invoiceNumber: '102',
    amount: 25_000_000,
  };
  const txs: Transaction[] = [
    {
      id: 'tx_1',
      type: 'income',
      amount: 10_000_000,
      date: '2026-11-20',
      accountId: 'acc_inc_sales_goods',
      bankAccountId: 'acc_bank_1',
      contactId: 'c_customer_1',
      description: 'تسویه',
      linkKind: 'invoice_settlement',
      invoiceId: 'inv_paid',
    },
  ];
  const checks: CheckItem[] = [];

  const openOnly = getInvoicesForSettlementPicker({
    invoices: [invPaid, invOpen],
    transactions: txs,
    checks,
    kind: 'sale',
    contactId: 'c_customer_1',
    includePaid: false,
  });
  assert.equal(openOnly.length, 1);
  assert.equal(openOnly[0].invoice.id, 'inv_open');
});
