import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStickyBarBudgetRatio,
  countFilledFields,
  formatOptionalCountLabel,
  resolveInvoiceItemViewportMode,
} from './formLayout';

test('countFilledFields counts strings, positive numbers, booleans, and attachments', () => {
  assert.equal(countFilledFields(['', '   ', 0, false, null, undefined]), 0);
  assert.equal(
    countFilledFields(['توضیحات', 150000, true, { name: 'receipt.jpg', path: '/a.jpg' }]),
    4
  );
  assert.equal(countFilledFields(['09120000000', '', 0]), 1);
});

test('formatOptionalCountLabel formats Persian count summary when non-zero', () => {
  const toFa = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  assert.equal(formatOptionalCountLabel(0, toFa), '');
  assert.equal(formatOptionalCountLabel(3, toFa), '۳ مورد تکمیل‌شده');
});

test('computeStickyBarBudgetRatio stays within 15% mobile sticky cap for 56px + 64px on 844px', () => {
  const ratio = computeStickyBarBudgetRatio(56, 64, 844);
  assert.ok(ratio <= 0.15, `Expected <= 0.15, got ${ratio}`);
});

test('resolveInvoiceItemViewportMode separates mobile cards, tablet hybrid rows, and desktop table', () => {
  assert.equal(resolveInvoiceItemViewportMode(390), 'mobile-cards');
  assert.equal(resolveInvoiceItemViewportMode(767), 'mobile-cards');
  assert.equal(resolveInvoiceItemViewportMode(768), 'tablet-hybrid');
  assert.equal(resolveInvoiceItemViewportMode(820), 'tablet-hybrid');
  assert.equal(resolveInvoiceItemViewportMode(1024), 'tablet-hybrid');
  assert.equal(resolveInvoiceItemViewportMode(1279), 'tablet-hybrid');
  assert.equal(resolveInvoiceItemViewportMode(1280), 'desktop-table');
  assert.equal(resolveInvoiceItemViewportMode(1440), 'desktop-table');
});
