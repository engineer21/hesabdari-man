import test from 'node:test';
import assert from 'node:assert/strict';
import type { Invoice, Product } from '../types';
import {
  cloneDraftRow,
  createEmptyDraftRow,
  extractProductCategories,
  filterAndRankProducts,
  getSuggestedProductPrice,
  normalizeSearchText,
  shouldAutoAppendOnEnter,
} from './invoiceSearch';

const sampleProducts: Product[] = [
  {
    id: 'p1',
    code: '1001',
    name: 'پسته اکبری خندان',
    category: 'محصولات باغی',
    kind: 'goods',
    unit: 'کیلوگرم',
    defaultWarehouseId: 'wh_main',
    purchasePrice: 480000,
    salePrice: 620000,
    openingStock: 120,
    isActive: true,
  },
  {
    id: 'p2',
    code: '1002',
    name: 'پسته احمدآقایی ممتاز',
    category: 'محصولات باغی',
    kind: 'goods',
    unit: 'کیلوگرم',
    defaultWarehouseId: 'wh_main',
    purchasePrice: 440000,
    salePrice: 570000,
    openingStock: 50,
    isActive: true,
  },
  {
    id: 'p3',
    code: '2001',
    name: 'کود کامل NPK',
    category: 'نهاده کشاورزی',
    kind: 'goods',
    unit: 'کیسه',
    defaultWarehouseId: 'wh_aux',
    purchasePrice: 950000,
    salePrice: 1100000,
    openingStock: 10,
    isActive: true,
  },
  {
    id: 'p4',
    code: '3001',
    name: 'خدمات سورتینگ و بسته‌بندی',
    category: 'خدمات',
    kind: 'service',
    unit: 'ساعت',
    salePrice: 250000,
    isActive: true,
  },
  {
    id: 'p5',
    code: '9999',
    name: 'کالای غیرفعال تست',
    category: 'آرشیو',
    kind: 'goods',
    unit: 'عدد',
    isActive: false,
  },
];

const sampleInvoices: Invoice[] = [
  {
    id: 'inv1',
    kind: 'sale',
    invoiceNumber: '1',
    date: '2026-06-01',
    contactId: 'c1',
    accountId: 'acc_inc',
    warehouseId: 'wh_main',
    amount: 12400000,
    description: '',
    items: [
      {
        id: 'li1',
        productId: 'p1',
        productName: 'پسته اکبری خندان',
        warehouseId: 'wh_main',
        unit: 'کیلوگرم',
        quantity: 20,
        unitPrice: 620000,
        total: 12400000,
      },
    ],
  },
];

test('normalizeSearchText normalizes Persian digits, Arabic Yeh/Kaf, and ZWNJ', () => {
  assert.equal(normalizeSearchText('  كود   ۱۰۰۱  '), 'کود 1001');
  assert.equal(normalizeSearchText('بسته‌بندي'), 'بسته بندی');
  assert.equal(normalizeSearchText('پسته اکبری'), 'پسته اکبری');
});

test('filterAndRankProducts ranks exact SKU code match first even with Persian digits', () => {
  const results = filterAndRankProducts(sampleProducts, '۱۰۰۲', {
    kind: 'sale',
    warehouseId: 'wh_main',
    invoices: sampleInvoices,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].product.id, 'p2');
  assert.equal(results[0].suggestedPrice, 570000);
});

test('filterAndRankProducts supports multi-token Persian search & excludes inactive items', () => {
  const results = filterAndRankProducts(sampleProducts, 'پسته خندان', {
    kind: 'sale',
    warehouseId: 'wh_main',
    invoices: sampleInvoices,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].product.id, 'p1');
  // 120 opening - 20 sold = 100
  assert.equal(results[0].availableStock, 100);
});

test('filterAndRankProducts returns null stock for services and respects purchase vs sale prices', () => {
  const saleMatches = filterAndRankProducts(sampleProducts, 'سورتينگ', {
    kind: 'sale',
    warehouseId: 'wh_main',
    invoices: sampleInvoices,
  });
  assert.equal(saleMatches.length, 1);
  assert.equal(saleMatches[0].product.id, 'p4');
  assert.equal(saleMatches[0].availableStock, null);
  assert.equal(saleMatches[0].suggestedPrice, 250000);

  assert.equal(getSuggestedProductPrice(sampleProducts[0], 'purchase'), 480000);
  assert.equal(getSuggestedProductPrice(sampleProducts[0], 'sale'), 620000);
});

test('extractProductCategories returns unique active categories', () => {
  assert.deepEqual(extractProductCategories(sampleProducts), [
    'محصولات باغی',
    'نهاده کشاورزی',
    'خدمات',
  ]);
});

test('spreadsheet row helpers clone rows cleanly and gate Enter auto-append', () => {
  const empty = createEmptyDraftRow('wh_main', () => 'row_1');
  assert.equal(shouldAutoAppendOnEnter(0, 1, empty), false);

  const filled = { ...empty, productId: 'p1', productName: 'پسته اکبری خندان', unitPriceStr: '620000' };
  assert.equal(shouldAutoAppendOnEnter(0, 1, filled), true);
  assert.equal(shouldAutoAppendOnEnter(0, 2, filled), false);

  const cloned = cloneDraftRow(filled, () => 'row_2');
  assert.equal(cloned.id, 'row_2');
  assert.equal(cloned.productName, filled.productName);
  assert.notEqual(cloned.id, filled.id);
});
