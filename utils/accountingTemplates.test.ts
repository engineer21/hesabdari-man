import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUSINESS_TEMPLATES,
  BUSINESS_TEMPLATE_LIST,
  COMMERCIAL_ACCOUNTS,
  DEFAULT_ACCOUNTING_DEFAULTS,
  STANDARD_CONTACT_GROUPS,
  STANDARD_WAREHOUSES,
  isDomainRawForTemplateSwitch,
  mergeTemplateAccountsIntoExisting,
  resolveDefaultAccountId,
  resolveDefaultWarehouseId,
} from './accountingTemplates';

test('all 4 industry templates contain complete income, expense, labor, loan interest, and treasury postable accounts', () => {
  assert.equal(BUSINESS_TEMPLATE_LIST.length, 4);

  for (const tpl of BUSINESS_TEMPLATE_LIST) {
    const incomeLeaves = tpl.accounts.filter((a) => a.module === 'income' && a.kind === 'postable');
    const expenseLeaves = tpl.accounts.filter((a) => a.module === 'expense' && a.kind === 'postable');
    const bankLeaves = tpl.accounts.filter((a) => a.module === 'bank' && a.kind === 'postable');

    assert.ok(incomeLeaves.length >= 2, `${tpl.id} must have at least 2 postable income accounts`);
    assert.ok(expenseLeaves.length >= 8, `${tpl.id} must have at least 8 postable expense accounts`);
    assert.ok(bankLeaves.length >= 2, `${tpl.id} must have cashbox and petty cash treasury accounts`);

    // Must preserve core system IDs
    const ids = new Set(tpl.accounts.map((a) => a.id));
    for (const sysId of [
      'acc_income',
      'acc_expense',
      'acc_bank',
      'acc_exp_labor',
      'acc_exp_fixed_salary',
      'acc_exp_daily_labor',
      'acc_exp_irrigation',
      'acc_exp_group_labor',
      'acc_loan_interest',
      'acc_inc_sales',
      'acc_exp_purchase',
      'acc_bank_cashbox',
      'acc_bank_petty',
    ]) {
      assert.ok(ids.has(sysId), `${tpl.id} must include core account ${sysId}`);
    }
  }
});

test('STANDARD_CONTACT_GROUPS and STANDARD_WAREHOUSES provide complete foundational base data', () => {
  assert.equal(STANDARD_CONTACT_GROUPS.length, 4);
  const groupIds = STANDARD_CONTACT_GROUPS.map((g) => g.id);
  assert.deepEqual(groupIds, ['cg_customers', 'cg_suppliers', 'cg_personnel', 'cg_others']);

  assert.equal(STANDARD_WAREHOUSES.length, 1);
  assert.equal(STANDARD_WAREHOUSES[0].id, 'wh_main');
  assert.equal(STANDARD_WAREHOUSES[0].isDefault, true);
});

test('resolveDefaultAccountId respects explicit user defaults when valid and falls back cleanly when invalid', () => {
  const accounts = COMMERCIAL_ACCOUNTS;

  // 1. Canonical defaults resolve to sale and purchase headings (NOT labor salary!)
  const saleAccId = resolveDefaultAccountId(accounts, undefined, 'saleInvoice');
  assert.equal(saleAccId, 'acc_inc_sales');

  const purchaseAccId = resolveDefaultAccountId(accounts, undefined, 'purchaseInvoice');
  assert.equal(purchaseAccId, 'acc_exp_purchase');
  assert.notEqual(purchaseAccId, 'acc_exp_fixed_salary');

  // 2. Explicit valid override in defaults wins
  const customPurchaseId = resolveDefaultAccountId(
    accounts,
    { purchaseInvoiceAccountId: 'acc_exp_packaging' },
    'purchaseInvoice'
  );
  assert.equal(customPurchaseId, 'acc_exp_packaging');

  // 3. Invalid or wrong-module override in defaults falls back to canonical ID
  const wrongModuleFallback = resolveDefaultAccountId(
    accounts,
    { purchaseInvoiceAccountId: 'acc_inc_sales' }, // income account passed for expense role
    'purchaseInvoice'
  );
  assert.equal(wrongModuleFallback, 'acc_exp_purchase');

  const groupFallback = resolveDefaultAccountId(
    accounts,
    { saleInvoiceAccountId: 'acc_income' }, // group account passed instead of postable
    'saleInvoice'
  );
  assert.equal(groupFallback, 'acc_inc_sales');

  // 4. Payroll & Loan interest roles resolve accurately
  assert.equal(
    resolveDefaultAccountId(accounts, DEFAULT_ACCOUNTING_DEFAULTS, 'payrollFixed'),
    'acc_exp_fixed_salary'
  );
  assert.equal(
    resolveDefaultAccountId(accounts, DEFAULT_ACCOUNTING_DEFAULTS, 'payrollIrrigation'),
    'acc_exp_irrigation'
  );
  assert.equal(
    resolveDefaultAccountId(accounts, DEFAULT_ACCOUNTING_DEFAULTS, 'loanInterest'),
    'acc_loan_interest'
  );
  assert.equal(
    resolveDefaultAccountId(accounts, DEFAULT_ACCOUNTING_DEFAULTS, 'defaultBank'),
    'acc_bank_cashbox'
  );
});

test('resolveDefaultWarehouseId prefers configured warehouse then isDefault', () => {
  const warehouses = [
    { id: 'wh_1', code: '101', name: 'انبار ۱', isDefault: true, isActive: true },
    { id: 'wh_2', code: '102', name: 'انبار ۲', isDefault: false, isActive: true },
  ];
  assert.equal(resolveDefaultWarehouseId(warehouses, undefined), 'wh_1');
  assert.equal(
    resolveDefaultWarehouseId(warehouses, { defaultWarehouseId: 'wh_2' }),
    'wh_2'
  );
  assert.equal(
    resolveDefaultWarehouseId(warehouses, { defaultWarehouseId: 'wh_missing' }),
    'wh_1'
  );
});

test('isDomainRawForTemplateSwitch returns true only when all operational collections are empty', () => {
  assert.equal(
    isDomainRawForTemplateSwitch({
      transactionsCount: 0,
      invoicesCount: 0,
      payrollEntriesCount: 0,
      checksCount: 0,
      loansCount: 0,
    }),
    true
  );

  assert.equal(
    isDomainRawForTemplateSwitch({
      transactionsCount: 0,
      invoicesCount: 1,
      payrollEntriesCount: 0,
      checksCount: 0,
      loansCount: 0,
    }),
    false
  );
});

test('mergeTemplateAccountsIntoExisting non-destructively adds missing template headings without duplicating existing ones', () => {
  const base = COMMERCIAL_ACCOUNTS;
  const { accounts: mergedAgri, addedCount } = mergeTemplateAccountsIntoExisting(
    base,
    'agriculture'
  );

  assert.ok(addedCount > 0, 'Should add agriculture-specific headings like water share & sorting');
  assert.ok(mergedAgri.length === base.length + addedCount);
  assert.ok(mergedAgri.some((a) => a.id === 'acc_exp_sorting'));
  assert.ok(mergedAgri.some((a) => a.id === 'acc_exp_water_share'));

  // Merging the same template a second time adds 0 duplicates
  const secondMerge = mergeTemplateAccountsIntoExisting(mergedAgri, 'agriculture');
  assert.equal(secondMerge.addedCount, 0);
  assert.equal(secondMerge.accounts.length, mergedAgri.length);
});
