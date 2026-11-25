import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { ALL_PERMISSIONS, buildPresetGroups, sanitizeGroupPermissions } from './permissions.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const ROOT = root;
export const DB_PATH = process.env.DB_PATH || path.join(root, 'data', 'accounting.sqlite');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(root, 'data', 'uploads');
export const DIST_DIR = path.join(root, 'dist');
export const PUBLIC_DIR = path.join(root, 'public');
export const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 168);

export const DEFAULT_OWNER_USERNAME = 'admin';
export const DEFAULT_OWNER_PASSWORD = '1111';
export const APP_NAME = 'حسابداری من';

export function hashPassword(password) {
  return createHash('sha256').update(String(password), 'utf8').digest('hex');
}

export function newToken() {
  return randomBytes(32).toString('hex');
}

const DEFAULT_LABOR_ACCOUNTS = [
  {
    id: 'acc_exp_labor',
    code: '201',
    name: 'هزینه‌های نیروی انسانی و کارکرد',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
    isSystem: true,
  },
  {
    id: 'acc_exp_fixed_salary',
    code: '20101',
    name: 'حقوق ثابت پرسنل',
    parentId: 'acc_exp_labor',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_daily_labor',
    code: '20102',
    name: 'کارگری روزمزد',
    parentId: 'acc_exp_labor',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_irrigation',
    code: '20103',
    name: 'آبگیری',
    parentId: 'acc_exp_labor',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_group_labor',
    code: '20104',
    name: 'کارگری دسته‌جمعی',
    parentId: 'acc_exp_labor',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
];

const DEFAULT_INCOME_ACCOUNTS = [
  {
    id: 'acc_inc_operational',
    code: '101',
    name: 'درآمدهای عملیاتی و فروش',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_inc_sales',
    code: '10101',
    name: 'فروش کالا و محصولات',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_inc_services',
    code: '10102',
    name: 'درآمد ارائه خدمات',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_inc_other_grp',
    code: '102',
    name: 'سایر درآمدها',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_inc_misc',
    code: '10201',
    name: 'سایر درآمدهای متفرقه',
    parentId: 'acc_inc_other_grp',
    kind: 'postable',
    module: 'income',
    isActive: true,
    isSystem: false,
  },
];

const DEFAULT_EXPENSE_ACCOUNTS = [
  {
    id: 'acc_exp_purchase_grp',
    code: '202',
    name: 'خرید کالا، مواد و ملزومات',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_purchase',
    code: '20201',
    name: 'خرید کالای تجاری و مواد اولیه',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_packaging',
    code: '20202',
    name: 'خرید ملزومات و بسته‌بندی',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_ops_grp',
    code: '203',
    name: 'هزینه‌های عملیاتی، حمل‌ونقل و نگهداری',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_freight',
    code: '20301',
    name: 'کرایه حمل و باربری',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_maintenance',
    code: '20302',
    name: 'تعمیر و نگهداری تجهیزات',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_admin_grp',
    code: '204',
    name: 'هزینه‌های عمومی، اداری و قبوض',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_rent',
    code: '20401',
    name: 'اجاره‌بهای محل',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_utilities',
    code: '20402',
    name: 'آب، برق، گاز و مخابرات',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
  {
    id: 'acc_exp_office',
    code: '20403',
    name: 'پذیرایی و ملزومات اداری',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: false,
  },
];

const DEFAULT_TREASURY_ACCOUNTS = [
  {
    id: 'acc_bank_cashbox',
    code: '301',
    name: 'صندوق نقدی اصلی',
    parentId: 'acc_bank',
    kind: 'postable',
    module: 'bank',
    isActive: true,
    isSystem: false,
    openingBalance: 0,
    treasuryType: 'cashbox',
    accountTitle: 'صندوق مرکزی',
  },
  {
    id: 'acc_bank_petty',
    code: '302',
    name: 'تنخواه‌گردان اصلی',
    parentId: 'acc_bank',
    kind: 'postable',
    module: 'bank',
    isActive: true,
    isSystem: false,
    openingBalance: 0,
    treasuryType: 'pettyCash',
    accountTitle: 'تنخواه جاری',
  },
];

const DEFAULT_CONTACT_GROUPS = [
  { id: 'cg_customers', name: 'مشتریان و خریداران', sortOrder: 1 },
  { id: 'cg_suppliers', name: 'فروشندگان و تأمین‌کنندگان', sortOrder: 2 },
  { id: 'cg_personnel', name: 'پرسنل و کارگران', sortOrder: 3 },
  { id: 'cg_others', name: 'سایر طرف‌حساب‌ها', sortOrder: 4 },
];

const DEFAULT_WAREHOUSES = [
  {
    id: 'wh_main',
    code: '101',
    name: 'انبار مرکزی',
    location: 'محل اصلی کسب‌وکار',
    isDefault: true,
    isActive: true,
  },
];

const DEFAULT_ACCOUNTING_DEFAULTS = {
  saleInvoiceAccountId: 'acc_inc_sales',
  purchaseInvoiceAccountId: 'acc_exp_purchase',
  incomeTxnAccountId: 'acc_inc_sales',
  expenseTxnAccountId: 'acc_exp_office',
  defaultBankAccountId: 'acc_bank_cashbox',
  defaultWarehouseId: 'wh_main',
  payrollFixedAccountId: 'acc_exp_fixed_salary',
  payrollDailyAccountId: 'acc_exp_daily_labor',
  payrollIrrigationAccountId: 'acc_exp_irrigation',
  payrollGroupAccountId: 'acc_exp_group_labor',
  loanInterestAccountId: 'acc_loan_interest',
};

const EMPTY_CHART = [
  {
    id: 'acc_income',
    code: '1',
    name: 'درآمد',
    parentId: null,
    kind: 'group',
    module: 'income',
    isActive: true,
    isSystem: true,
  },
  ...DEFAULT_INCOME_ACCOUNTS,
  {
    id: 'acc_expense',
    code: '2',
    name: 'هزینه',
    parentId: null,
    kind: 'group',
    module: 'expense',
    isActive: true,
    isSystem: true,
  },
  ...DEFAULT_LABOR_ACCOUNTS,
  ...DEFAULT_EXPENSE_ACCOUNTS,
  {
    id: 'acc_loan_interest',
    code: '299',
    name: 'هزینه سود وام',
    parentId: 'acc_expense',
    kind: 'postable',
    module: 'expense',
    isActive: true,
    isSystem: true,
  },
  {
    id: 'acc_bank',
    code: '3',
    name: 'بانک',
    parentId: null,
    kind: 'group',
    module: 'bank',
    isActive: true,
    isSystem: true,
  },
  ...DEFAULT_TREASURY_ACCOUNTS,
];

export function openDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const sub of ['logos', 'avatars', 'attachments', 'profiles', 'misc']) {
    fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH, { timeout: 5000 });
  db.exec(`PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  display_name TEXT,
  needs_password_change INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS permission_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions_json TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  group_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (group_id) REFERENCES permission_groups(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('owner','staff')),
  username TEXT,
  staff_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL,
  module TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  opening_balance REAL,
  treasury_type TEXT,
  account_title TEXT,
  account_number TEXT,
  holder_name TEXT
);

CREATE TABLE IF NOT EXISTS contact_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  mobile TEXT,
  notes TEXT,
  picture_path TEXT,
  is_personnel INTEGER NOT NULL DEFAULT 0,
  personnel_type TEXT,
  default_rate REAL,
  default_unit_label TEXT,
  FOREIGN KEY (group_id) REFERENCES contact_groups(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  account_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  contact_id TEXT,
  att_path TEXT,
  att_mime TEXT,
  att_name TEXT
);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  picture_path TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  logo_path TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app_prefs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  manager_name TEXT,
  notes TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  kind TEXT NOT NULL DEFAULT 'goods',
  unit TEXT NOT NULL DEFAULT 'عدد',
  default_warehouse_id TEXT,
  purchase_price REAL,
  sale_price REAL,
  opening_stock REAL,
  min_stock REAL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT,
  contact_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  warehouse_id TEXT,
  amount REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  att_path TEXT,
  att_mime TEXT,
  att_name TEXT
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  product_id TEXT,
  product_name TEXT NOT NULL,
  warehouse_id TEXT,
  unit TEXT NOT NULL DEFAULT 'عدد',
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payroll_contracts (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  jalali_year INTEGER NOT NULL,
  monthly_amount REAL NOT NULL,
  start_month INTEGER NOT NULL DEFAULT 1,
  end_month INTEGER NOT NULL DEFAULT 12,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  contract_id TEXT,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  jalali_year INTEGER,
  jalali_month INTEGER,
  quantity REAL NOT NULL DEFAULT 1,
  unit_label TEXT NOT NULL DEFAULT 'روز',
  unit_rate REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  check_number TEXT NOT NULL,
  sayad_id TEXT,
  contact_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  invoice_id TEXT,
  payroll_entry_id TEXT,
  amount REAL NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_date TEXT,
  cleared_tx_id TEXT,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  lender_name TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  interest_account_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  first_due_date TEXT NOT NULL,
  principal_amount REAL NOT NULL,
  total_interest REAL NOT NULL,
  installment_count INTEGER NOT NULL,
  interval_months INTEGER NOT NULL DEFAULT 1,
  disbursement_tx_id TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS loan_installments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  principal_share REAL NOT NULL,
  interest_share REAL NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_date TEXT,
  principal_tx_id TEXT,
  interest_tx_id TEXT
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT
);
`);

  // Migration: treasury columns on existing databases
  const accountCols = db.prepare('PRAGMA table_info(accounts)').all().map((c) => c.name);
  if (!accountCols.includes('account_title')) {
    db.exec('ALTER TABLE accounts ADD COLUMN account_title TEXT');
  }
  if (!accountCols.includes('account_number')) {
    db.exec('ALTER TABLE accounts ADD COLUMN account_number TEXT');
  }
  if (!accountCols.includes('treasury_type')) {
    db.exec('ALTER TABLE accounts ADD COLUMN treasury_type TEXT');
  }
  if (!accountCols.includes('holder_name')) {
    db.exec('ALTER TABLE accounts ADD COLUMN holder_name TEXT');
  }

  // Migration: accrual linkage columns on transactions table
  const txCols = db.prepare('PRAGMA table_info(transactions)').all().map((c) => c.name);
  for (const col of [
    'link_kind',
    'invoice_id',
    'payroll_entry_id',
    'check_id',
    'loan_id',
    'loan_installment_id',
  ]) {
    if (!txCols.includes(col)) {
      db.exec(`ALTER TABLE transactions ADD COLUMN ${col} TEXT`);
    }
  }

  // Migration: personnel classification columns on contacts table
  const contactCols = db.prepare('PRAGMA table_info(contacts)').all().map((c) => c.name);
  if (!contactCols.includes('is_personnel')) {
    db.exec('ALTER TABLE contacts ADD COLUMN is_personnel INTEGER NOT NULL DEFAULT 0');
  }
  if (!contactCols.includes('personnel_type')) {
    db.exec('ALTER TABLE contacts ADD COLUMN personnel_type TEXT');
  }
  if (!contactCols.includes('default_rate')) {
    db.exec('ALTER TABLE contacts ADD COLUMN default_rate REAL');
  }
  if (!contactCols.includes('default_unit_label')) {
    db.exec('ALTER TABLE contacts ADD COLUMN default_unit_label TEXT');
  }

  // Migration: warehouse_id column on invoices table
  const invCols = db.prepare('PRAGMA table_info(invoices)').all().map((c) => c.name);
  if (!invCols.includes('warehouse_id')) {
    db.exec('ALTER TABLE invoices ADD COLUMN warehouse_id TEXT');
  }

  seedIfEmpty(db);
  ensureSystemLoanInterestAccount(db);
  ensureSystemLaborHeadingsAndPersonnelGroup(db);
  ensureStandardBaseAccountsAndGroups(db);
  ensureDefaultWarehouse(db);
  return db;
}

function ensureDefaultWarehouse(db) {
  const whCount = db.prepare('SELECT COUNT(*) AS c FROM warehouses').get().c;
  if (!whCount) {
    const ins = db.prepare(
      `INSERT INTO warehouses (id, code, name, location, manager_name, notes, is_default, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const w of DEFAULT_WAREHOUSES) {
      ins.run(
        w.id,
        w.code,
        w.name,
        w.location || null,
        w.managerName || null,
        w.notes || null,
        w.isDefault ? 1 : 0,
        w.isActive === false ? 0 : 1
      );
    }
  }
}

function ensureSystemLoanInterestAccount(db) {
  const existing = db.prepare(`SELECT id FROM accounts WHERE id = 'acc_loan_interest'`).get();
  const expenseRoot = db.prepare(`SELECT id FROM accounts WHERE id = 'acc_expense'`).get();
  if (!existing && expenseRoot) {
    db.prepare(
      `INSERT INTO accounts (id, code, name, parent_id, kind, module, is_active, is_system, opening_balance)
       VALUES ('acc_loan_interest', '299', 'هزینه سود وام', 'acc_expense', 'postable', 'expense', 1, 1, NULL)`
    ).run();
  }
}

function ensureSystemLaborHeadingsAndPersonnelGroup(db) {
  const expenseRoot = db.prepare(`SELECT id FROM accounts WHERE id = 'acc_expense'`).get();
  if (expenseRoot) {
    const insertAcc = db.prepare(
      `INSERT INTO accounts (id, code, name, parent_id, kind, module, is_active, is_system, opening_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    );
    for (const a of DEFAULT_LABOR_ACCOUNTS) {
      const exists = db.prepare('SELECT id FROM accounts WHERE id = ?').get(a.id);
      if (!exists) {
        insertAcc.run(
          a.id,
          a.code,
          a.name,
          a.parentId,
          a.kind,
          a.module,
          a.isActive ? 1 : 0,
          a.isSystem ? 1 : 0
        );
      }
    }
  }

  // Ensure a default personnel contact group exists if none matches personnel yet
  const existingGroups = db.prepare('SELECT id, name FROM contact_groups').all();
  const hasPersonnelGroup = existingGroups.some(
    (g) => g.id === 'cg_personnel' || /پرسنل|کارگر|کارمند|نیروی انسانی/.test(g.name || '')
  );
  if (!hasPersonnelGroup) {
    db.prepare(
      `INSERT INTO contact_groups (id, name, sort_order) VALUES ('cg_personnel', 'پرسنل و کارگران', 3)`
    ).run();
  }
}

function ensureStandardBaseAccountsAndGroups(db) {
  const insertAcc = db.prepare(
    `INSERT INTO accounts (id, code, name, parent_id, kind, module, is_active, is_system, opening_balance, treasury_type, account_title, account_number, holder_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // 1. If there are 0 postable income accounts, seed standard income headings
  const incomeLeavesCount = db
    .prepare(`SELECT COUNT(*) AS c FROM accounts WHERE module = 'income' AND kind = 'postable'`)
    .get().c;
  const incomeRoot = db.prepare(`SELECT id FROM accounts WHERE id = 'acc_income'`).get();
  if (incomeLeavesCount === 0 && incomeRoot) {
    for (const a of DEFAULT_INCOME_ACCOUNTS) {
      const exists = db.prepare('SELECT id FROM accounts WHERE id = ?').get(a.id);
      if (!exists) {
        insertAcc.run(
          a.id,
          a.code,
          a.name,
          a.parentId,
          a.kind,
          a.module,
          a.isActive ? 1 : 0,
          a.isSystem ? 1 : 0,
          a.openingBalance ?? null,
          a.treasuryType ?? null,
          a.accountTitle ?? null,
          a.accountNumber ?? null,
          a.holderName ?? null
        );
      }
    }
  }

  // 2. If there are 0 non-labor/non-loan-interest postable expense accounts, seed standard expense headings
  const nonLaborExpenseCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM accounts
       WHERE module = 'expense' AND kind = 'postable'
         AND id != 'acc_loan_interest'
         AND (parent_id IS NULL OR parent_id != 'acc_exp_labor')`
    )
    .get().c;
  const expenseRoot = db.prepare(`SELECT id FROM accounts WHERE id = 'acc_expense'`).get();
  if (nonLaborExpenseCount === 0 && expenseRoot) {
    for (const a of DEFAULT_EXPENSE_ACCOUNTS) {
      const exists = db.prepare('SELECT id FROM accounts WHERE id = ?').get(a.id);
      if (!exists) {
        insertAcc.run(
          a.id,
          a.code,
          a.name,
          a.parentId,
          a.kind,
          a.module,
          a.isActive ? 1 : 0,
          a.isSystem ? 1 : 0,
          a.openingBalance ?? null,
          a.treasuryType ?? null,
          a.accountTitle ?? null,
          a.accountNumber ?? null,
          a.holderName ?? null
        );
      }
    }
  }

  // 3. If there are 0 postable bank/treasury accounts, seed standard cashbox & petty cash
  const bankLeavesCount = db
    .prepare(`SELECT COUNT(*) AS c FROM accounts WHERE module = 'bank' AND kind = 'postable'`)
    .get().c;
  const bankRoot = db.prepare(`SELECT id FROM accounts WHERE id = 'acc_bank'`).get();
  if (bankLeavesCount === 0 && bankRoot) {
    for (const a of DEFAULT_TREASURY_ACCOUNTS) {
      const exists = db.prepare('SELECT id FROM accounts WHERE id = ?').get(a.id);
      if (!exists) {
        insertAcc.run(
          a.id,
          a.code,
          a.name,
          a.parentId,
          a.kind,
          a.module,
          a.isActive ? 1 : 0,
          a.isSystem ? 1 : 0,
          a.openingBalance ?? 0,
          a.treasuryType ?? null,
          a.accountTitle ?? null,
          a.accountNumber ?? null,
          a.holderName ?? null
        );
      }
    }
  }

  // 4. Ensure standard base contact groups exist if database only had 0 or 1 contact group
  const existingGroups = db.prepare('SELECT id, name FROM contact_groups').all();
  if (existingGroups.length <= 1) {
    const insGroup = db.prepare(
      `INSERT INTO contact_groups (id, name, sort_order) VALUES (?, ?, ?)`
    );
    for (const g of DEFAULT_CONTACT_GROUPS) {
      const exists = existingGroups.some((eg) => eg.id === g.id || eg.name === g.name);
      if (!exists) {
        insGroup.run(g.id, g.name, g.sortOrder ?? null);
      }
    }
  }
}

function seedIfEmpty(db) {
  const owner = db.prepare('SELECT username FROM owner WHERE id = 1').get();
  if (!owner) {
    db.prepare(
      `INSERT INTO owner (id, username, hashed_password, display_name, needs_password_change)
       VALUES (1, ?, ?, ?, 0)`
    ).run(DEFAULT_OWNER_USERNAME, hashPassword(DEFAULT_OWNER_PASSWORD), 'مدیر سیستم');
  }

  const groupCount = db.prepare('SELECT COUNT(*) AS c FROM permission_groups').get().c;
  if (!groupCount) {
    const insert = db.prepare(
      `INSERT INTO permission_groups (id, name, description, permissions_json, is_system)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const g of buildPresetGroups()) {
      insert.run(g.id, g.name, g.description || '', JSON.stringify(g.permissions), g.isSystem ? 1 : 0);
    }
  }

  const accCount = db.prepare('SELECT COUNT(*) AS c FROM accounts').get().c;
  if (!accCount) {
    const insert = db.prepare(
      `INSERT INTO accounts (id, code, name, parent_id, kind, module, is_active, is_system, opening_balance, treasury_type, account_title, account_number, holder_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of EMPTY_CHART) {
      insert.run(
        a.id,
        a.code,
        a.name,
        a.parentId,
        a.kind,
        a.module,
        a.isActive ? 1 : 0,
        a.isSystem ? 1 : 0,
        a.openingBalance ?? null,
        a.treasuryType ?? null,
        a.accountTitle ?? null,
        a.accountNumber ?? null,
        a.holderName ?? null
      );
    }
  }

  const cgCount = db.prepare('SELECT COUNT(*) AS c FROM contact_groups').get().c;
  if (!cgCount) {
    const insGroup = db.prepare(
      `INSERT INTO contact_groups (id, name, sort_order) VALUES (?, ?, ?)`
    );
    for (const g of DEFAULT_CONTACT_GROUPS) {
      insGroup.run(g.id, g.name, g.sortOrder ?? null);
    }
  }

  const profile = db.prepare('SELECT id FROM profile WHERE id = 1').get();
  if (!profile) {
    db.prepare(
      `INSERT INTO profile (id, first_name, last_name, mobile, picture_path) VALUES (1, '', '', '', '')`
    ).run();
  }

  const settings = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!settings) {
    db.prepare(`INSERT INTO settings (id, name, logo_path) VALUES (1, ?, '')`).run(APP_NAME);
  }

  const ver = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get();
  if (!ver) {
    db.prepare(`INSERT INTO meta (key, value) VALUES ('schema_version', '1')`).run();
  }
}

function rowAccount(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    parentId: r.parent_id,
    kind: r.kind,
    module: r.module,
    isActive: Boolean(r.is_active),
    isSystem: Boolean(r.is_system),
    ...(r.opening_balance != null ? { openingBalance: r.opening_balance } : {}),
    ...(r.treasury_type ? { treasuryType: r.treasury_type } : {}),
    ...(r.account_title ? { accountTitle: r.account_title } : {}),
    ...(r.account_number ? { accountNumber: r.account_number } : {}),
    ...(r.holder_name ? { holderName: r.holder_name } : {}),
  };
}

function rowContactGroup(r) {
  return {
    id: r.id,
    name: r.name,
    ...(r.sort_order != null ? { sortOrder: r.sort_order } : {}),
  };
}

function rowContact(r) {
  return {
    id: r.id,
    groupId: r.group_id,
    fullName: r.full_name,
    ...(r.mobile ? { mobile: r.mobile } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    ...(r.picture_path ? { picture: r.picture_path } : {}),
    ...(r.is_personnel ? { isPersonnel: true } : {}),
    ...(r.personnel_type ? { personnelType: r.personnel_type } : {}),
    ...(r.default_rate != null ? { defaultRate: r.default_rate } : {}),
    ...(r.default_unit_label ? { defaultUnitLabel: r.default_unit_label } : {}),
  };
}

function rowTransaction(r) {
  const tx = {
    id: r.id,
    date: r.date,
    amount: r.amount,
    description: r.description || '',
    type: r.type,
    accountId: r.account_id,
    bankAccountId: r.bank_account_id,
  };
  if (r.contact_id) tx.contactId = r.contact_id;
  if (r.att_path) {
    tx.attachment = {
      path: r.att_path,
      mimeType: r.att_mime || 'application/octet-stream',
      name: r.att_name || 'پیوست',
    };
  }
  if (r.link_kind) tx.linkKind = r.link_kind;
  if (r.invoice_id) tx.invoiceId = r.invoice_id;
  if (r.payroll_entry_id) tx.payrollEntryId = r.payroll_entry_id;
  if (r.check_id) tx.checkId = r.check_id;
  if (r.loan_id) tx.loanId = r.loan_id;
  if (r.loan_installment_id) tx.loanInstallmentId = r.loan_installment_id;
  return tx;
}

function rowWarehouse(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    ...(r.location ? { location: r.location } : {}),
    ...(r.manager_name ? { managerName: r.manager_name } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    ...(r.is_default ? { isDefault: true } : {}),
    isActive: Boolean(r.is_active),
  };
}

function rowProduct(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    ...(r.category ? { category: r.category } : {}),
    kind: r.kind === 'service' ? 'service' : 'goods',
    unit: r.unit || 'عدد',
    ...(r.default_warehouse_id ? { defaultWarehouseId: r.default_warehouse_id } : {}),
    ...(r.purchase_price != null ? { purchasePrice: r.purchase_price } : {}),
    ...(r.sale_price != null ? { salePrice: r.sale_price } : {}),
    ...(r.opening_stock != null ? { openingStock: r.opening_stock } : {}),
    ...(r.min_stock != null ? { minStock: r.min_stock } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    isActive: Boolean(r.is_active),
  };
}

function rowInvoiceItem(r) {
  return {
    id: r.id,
    ...(r.product_id ? { productId: r.product_id } : {}),
    productName: r.product_name,
    ...(r.warehouse_id ? { warehouseId: r.warehouse_id } : {}),
    unit: r.unit || 'عدد',
    quantity: r.quantity,
    unitPrice: r.unit_price,
    ...(r.discount ? { discount: r.discount } : {}),
    total: r.total,
  };
}

function rowInvoice(r, itemsByInvoice) {
  const inv = {
    id: r.id,
    kind: r.kind,
    invoiceNumber: r.invoice_number,
    date: r.date,
    contactId: r.contact_id,
    accountId: r.account_id,
    amount: r.amount,
    description: r.description || '',
  };
  if (r.due_date) inv.dueDate = r.due_date;
  if (r.warehouse_id) inv.warehouseId = r.warehouse_id;
  const items = itemsByInvoice?.get(r.id);
  if (items && items.length > 0) inv.items = items;
  if (r.att_path) {
    inv.attachment = {
      path: r.att_path,
      mimeType: r.att_mime || 'application/octet-stream',
      name: r.att_name || 'تصویر فاکتور',
    };
  }
  return inv;
}

function rowPayrollContract(r) {
  return {
    id: r.id,
    contactId: r.contact_id,
    accountId: r.account_id,
    jalaliYear: r.jalali_year,
    monthlyAmount: r.monthly_amount,
    startMonth: r.start_month,
    endMonth: r.end_month,
    ...(r.notes ? { notes: r.notes } : {}),
    isActive: Boolean(r.is_active),
  };
}

function rowPayrollEntry(r) {
  return {
    id: r.id,
    entryType: r.entry_type,
    contactId: r.contact_id,
    ...(r.contract_id ? { contractId: r.contract_id } : {}),
    accountId: r.account_id,
    date: r.date,
    ...(r.jalali_year != null ? { jalaliYear: r.jalali_year } : {}),
    ...(r.jalali_month != null ? { jalaliMonth: r.jalali_month } : {}),
    quantity: r.quantity,
    unitLabel: r.unit_label,
    unitRate: r.unit_rate,
    amount: r.amount,
    description: r.description || '',
  };
}

function rowCheck(r) {
  return {
    id: r.id,
    kind: r.kind,
    checkNumber: r.check_number,
    ...(r.sayad_id ? { sayadId: r.sayad_id } : {}),
    contactId: r.contact_id,
    bankAccountId: r.bank_account_id,
    ...(r.invoice_id ? { invoiceId: r.invoice_id } : {}),
    ...(r.payroll_entry_id ? { payrollEntryId: r.payroll_entry_id } : {}),
    amount: r.amount,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    status: r.status,
    ...(r.settled_date ? { settledDate: r.settled_date } : {}),
    ...(r.cleared_tx_id ? { clearedTxId: r.cleared_tx_id } : {}),
    description: r.description || '',
  };
}

function rowLoan(r) {
  return {
    id: r.id,
    title: r.title,
    lenderName: r.lender_name,
    bankAccountId: r.bank_account_id,
    interestAccountId: r.interest_account_id,
    startDate: r.start_date,
    firstDueDate: r.first_due_date,
    principalAmount: r.principal_amount,
    totalInterest: r.total_interest,
    installmentCount: r.installment_count,
    intervalMonths: r.interval_months,
    ...(r.disbursement_tx_id ? { disbursementTxId: r.disbursement_tx_id } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    status: r.status,
  };
}

function rowLoanInstallment(r) {
  return {
    id: r.id,
    loanId: r.loan_id,
    number: r.number,
    dueDate: r.due_date,
    principalShare: r.principal_share,
    interestShare: r.interest_share,
    totalAmount: r.total_amount,
    status: r.status,
    ...(r.paid_date ? { paidDate: r.paid_date } : {}),
    ...(r.principal_tx_id ? { principalTxId: r.principal_tx_id } : {}),
    ...(r.interest_tx_id ? { interestTxId: r.interest_tx_id } : {}),
  };
}

export function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row?.value ?? null;
}

export function setMeta(db, key, value) {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

export function getOwner(db) {
  const r = db.prepare('SELECT * FROM owner WHERE id = 1').get();
  if (!r) return null;
  return {
    username: r.username,
    hashedPassword: r.hashed_password,
    displayName: r.display_name || r.username,
    needsPasswordChange: Boolean(r.needs_password_change),
  };
}

export function saveOwner(db, owner) {
  db.prepare(
    `UPDATE owner SET username = ?, hashed_password = ?, display_name = ?, needs_password_change = ? WHERE id = 1`
  ).run(
    owner.username,
    owner.hashedPassword,
    owner.displayName || owner.username,
    owner.needsPasswordChange ? 1 : 0
  );
}

export function getPermissionGroups(db) {
  return db
    .prepare('SELECT * FROM permission_groups ORDER BY name')
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || undefined,
      permissions: sanitizeGroupPermissions(JSON.parse(r.permissions_json || '[]')),
      isSystem: Boolean(r.is_system),
    }));
}

function insertPermissionGroupRow(db, g) {
  db.prepare(
    `INSERT INTO permission_groups (id, name, description, permissions_json, is_system)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       permissions_json = excluded.permissions_json,
       is_system = excluded.is_system`
  ).run(
    g.id,
    g.name,
    g.description || '',
    JSON.stringify(sanitizeGroupPermissions(g.permissions || [])),
    g.isSystem ? 1 : 0
  );
}

/** Safe when staff rows still reference groups (upsert + delete unused). */
export function upsertPermissionGroups(db, groups) {
  const keep = new Set(groups.map((g) => g.id));
  for (const g of groups) insertPermissionGroupRow(db, g);
  for (const row of db.prepare('SELECT id FROM permission_groups').all()) {
    if (keep.has(row.id)) continue;
    const used = db.prepare('SELECT 1 AS x FROM staff_users WHERE group_id = ? LIMIT 1').get(row.id);
    if (!used) db.prepare('DELETE FROM permission_groups WHERE id = ?').run(row.id);
  }
}

/** Full replace — must delete staff first (FK). */
export function replacePermissionGroups(db, groups) {
  db.exec('DELETE FROM staff_users');
  db.exec('DELETE FROM permission_groups');
  for (const g of groups) insertPermissionGroupRow(db, g);
}

export function getStaffUsers(db) {
  return db
    .prepare('SELECT * FROM staff_users ORDER BY username')
    .all()
    .map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      hashedPassword: r.hashed_password,
      groupId: r.group_id,
      active: Boolean(r.active),
    }));
}

export function findStaffByUsername(db, username) {
  const r = db
    .prepare('SELECT * FROM staff_users WHERE username = ? AND active = 1 LIMIT 1')
    .get(username);
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    hashedPassword: r.hashed_password,
    groupId: r.group_id,
    active: Boolean(r.active),
  };
}

export function replaceStaffUsers(db, users) {
  db.exec('DELETE FROM staff_users');
  const insert = db.prepare(
    `INSERT INTO staff_users (id, username, display_name, hashed_password, group_id, active)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const u of users) {
    insert.run(u.id, u.username, u.displayName, u.hashedPassword, u.groupId, u.active ? 1 : 0);
  }
}

/** Atomically write groups and/or staff without breaking FK. */
export function writeAuthTables(db, data, { replaceOwner = false } = {}) {
  const hasGroups = Array.isArray(data.permissionGroups);
  const hasStaff = Array.isArray(data.staffUsers);

  if (hasGroups && hasStaff) {
    db.exec('DELETE FROM staff_users');
    db.exec('DELETE FROM permission_groups');
    for (const g of data.permissionGroups) insertPermissionGroupRow(db, g);
    const insert = db.prepare(
      `INSERT INTO staff_users (id, username, display_name, hashed_password, group_id, active)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const u of data.staffUsers) {
      insert.run(u.id, u.username, u.displayName, u.hashedPassword, u.groupId, u.active ? 1 : 0);
    }
  } else if (hasGroups) {
    upsertPermissionGroups(db, data.permissionGroups);
  } else if (hasStaff) {
    replaceStaffUsers(db, data.staffUsers);
  }

  if (replaceOwner && data.owner?.username && data.owner?.hashedPassword) {
    saveOwner(db, data.owner);
  }
}

export function readDomainState(db) {
  const accounts = db.prepare('SELECT * FROM accounts').all().map(rowAccount);
  const contactGroups = db.prepare('SELECT * FROM contact_groups').all().map(rowContactGroup);
  const contacts = db.prepare('SELECT * FROM contacts').all().map(rowContact);
  const warehouses = db.prepare('SELECT * FROM warehouses ORDER BY is_default DESC, code').all().map(rowWarehouse);
  const products = db.prepare('SELECT * FROM products ORDER BY code, name').all().map(rowProduct);
  const transactions = db.prepare('SELECT * FROM transactions').all().map(rowTransaction);
  const allInvItems = db.prepare('SELECT * FROM invoice_items ORDER BY invoice_id, sort_order').all();
  const itemsByInvoice = new Map();
  for (const r of allInvItems) {
    const arr = itemsByInvoice.get(r.invoice_id) || [];
    arr.push(rowInvoiceItem(r));
    itemsByInvoice.set(r.invoice_id, arr);
  }
  const invoices = db.prepare('SELECT * FROM invoices').all().map((r) => rowInvoice(r, itemsByInvoice));
  const payrollContracts = db.prepare('SELECT * FROM payroll_contracts').all().map(rowPayrollContract);
  const payrollEntries = db.prepare('SELECT * FROM payroll_entries').all().map(rowPayrollEntry);
  const checks = db.prepare('SELECT * FROM checks').all().map(rowCheck);
  const loans = db.prepare('SELECT * FROM loans').all().map(rowLoan);
  const loanInstallments = db
    .prepare('SELECT * FROM loan_installments ORDER BY loan_id, number')
    .all()
    .map(rowLoanInstallment);
  const profileRow = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  const settingsRow = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const prefs = Object.fromEntries(
    db.prepare('SELECT key, value FROM app_prefs').all().map((r) => [r.key, r.value])
  );

  let reminderSettings = {
    enabled: true,
    leadDays: 2,
    recipientMobile: '',
    smsEnabled: false,
    smsProvider: 'mock',
    smsSender: '',
    smsTemplate: '',
  };
  try {
    const rawRem = getMeta(db, 'reminder_settings');
    if (rawRem) {
      const parsed = JSON.parse(rawRem);
      reminderSettings = {
        enabled: parsed.enabled !== false,
        leadDays: Math.max(0, Math.min(30, Number(parsed.leadDays ?? 2) || 0)),
        recipientMobile: String(parsed.recipientMobile || ''),
        smsEnabled: Boolean(parsed.smsEnabled),
        smsProvider: ['mock', 'kavenegar', 'melipayamak', 'farazsms'].includes(parsed.smsProvider)
          ? parsed.smsProvider
          : 'mock',
        smsSender: String(parsed.smsSender || '').slice(0, 64),
        smsTemplate: String(parsed.smsTemplate || '').slice(0, 200),
      };
    }
  } catch {
    /* keep defaults */
  }

  return {
    accounts,
    contactGroups,
    contacts,
    warehouses,
    products,
    transactions,
    invoices,
    payrollContracts,
    payrollEntries,
    checks,
    loans,
    loanInstallments,
    reminderSettings,
    userProfile: {
      firstName: profileRow?.first_name || '',
      lastName: profileRow?.last_name || '',
      mobile: profileRow?.mobile || '',
      picture: profileRow?.picture_path || '',
    },
    appSettings: (() => {
      let businessTemplate = 'commercial';
      let accountingDefaults = { ...DEFAULT_ACCOUNTING_DEFAULTS };
      try {
        const rawAcc = getMeta(db, 'accounting_settings');
        if (rawAcc) {
          const parsed = JSON.parse(rawAcc);
          if (
            ['commercial', 'agriculture', 'service', 'manufacturing'].includes(
              parsed.businessTemplate
            )
          ) {
            businessTemplate = parsed.businessTemplate;
          }
          if (parsed.accountingDefaults && typeof parsed.accountingDefaults === 'object') {
            accountingDefaults = {
              ...DEFAULT_ACCOUNTING_DEFAULTS,
              ...parsed.accountingDefaults,
            };
          }
        }
      } catch {
        /* keep defaults */
      }
      return {
        name: settingsRow?.name || APP_NAME,
        logo: settingsRow?.logo_path || '',
        businessTemplate,
        accountingDefaults,
      };
    })(),
    permissionGroups: getPermissionGroups(db),
    staffUsers: getStaffUsers(db),
    owner: getOwner(db),
    prefs: {
      theme: prefs.theme || 'light',
      pdfPageSize: prefs.pdf_page_size || 'a4',
      sidebarCollapsed: prefs.sidebar_collapsed === '1',
    },
    migratedFromLs: getMeta(db, 'migrated_from_ls') === '1',
  };
}

export function writeDomainState(db, data, { replaceAuth = false } = {}) {
  const run = db.prepare('BEGIN IMMEDIATE');
  const commit = db.prepare('COMMIT');
  const rollback = db.prepare('ROLLBACK');
  run.run();
  try {
    if (Array.isArray(data.accounts)) {
      db.exec('DELETE FROM accounts');
      const insert = db.prepare(
        `INSERT INTO accounts (id, code, name, parent_id, kind, module, is_active, is_system, opening_balance, treasury_type, account_title, account_number, holder_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const a of data.accounts) {
        insert.run(
          a.id,
          a.code,
          a.name,
          a.parentId ?? null,
          a.kind,
          a.module,
          a.isActive === false ? 0 : 1,
          a.isSystem ? 1 : 0,
          a.openingBalance ?? null,
          a.treasuryType ?? null,
          a.accountTitle ?? null,
          a.accountNumber ?? null,
          a.holderName ?? null
        );
      }
    }

    if (Array.isArray(data.contactGroups)) {
      db.exec('DELETE FROM contacts');
      db.exec('DELETE FROM contact_groups');
      const insertG = db.prepare(
        `INSERT INTO contact_groups (id, name, sort_order) VALUES (?, ?, ?)`
      );
      for (const g of data.contactGroups) {
        insertG.run(g.id, g.name, g.sortOrder ?? null);
      }
    }

    if (Array.isArray(data.contacts)) {
      if (!Array.isArray(data.contactGroups)) {
        db.exec('DELETE FROM contacts');
      }
      const insertC = db.prepare(
        `INSERT INTO contacts (id, group_id, full_name, mobile, notes, picture_path, is_personnel, personnel_type, default_rate, default_unit_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const c of data.contacts) {
        insertC.run(
          c.id,
          c.groupId,
          c.fullName,
          c.mobile || null,
          c.notes || null,
          c.picture || null,
          c.isPersonnel ? 1 : 0,
          c.personnelType || null,
          c.defaultRate != null && Number.isFinite(Number(c.defaultRate)) ? Number(c.defaultRate) : null,
          c.defaultUnitLabel || null
        );
      }
    }

    if (Array.isArray(data.transactions)) {
      db.exec('DELETE FROM transactions');
      const insertT = db.prepare(
        `INSERT INTO transactions
         (id, date, amount, description, type, account_id, bank_account_id, contact_id, att_path, att_mime, att_name, link_kind, invoice_id, payroll_entry_id, check_id, loan_id, loan_installment_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of data.transactions) {
        const att = t.attachment;
        let pathVal = att?.path || null;
        if (!pathVal && typeof att?.data === 'string' && att.data.startsWith('/')) {
          pathVal = att.data;
        }
        if (pathVal && String(pathVal).startsWith('data:')) pathVal = null;
        insertT.run(
          t.id,
          t.date,
          t.amount,
          t.description || '',
          t.type,
          t.accountId,
          t.bankAccountId,
          t.contactId || null,
          pathVal,
          pathVal ? att?.mimeType || null : null,
          pathVal ? att?.name || null : null,
          t.linkKind || null,
          t.invoiceId || null,
          t.payrollEntryId || null,
          t.checkId || null,
          t.loanId || null,
          t.loanInstallmentId || null
        );
      }
    }

    if (Array.isArray(data.warehouses)) {
      db.exec('DELETE FROM warehouses');
      const insertW = db.prepare(
        `INSERT INTO warehouses (id, code, name, location, manager_name, notes, is_default, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const w of data.warehouses) {
        insertW.run(
          w.id,
          w.code || '',
          w.name,
          w.location || null,
          w.managerName || null,
          w.notes || null,
          w.isDefault ? 1 : 0,
          w.isActive === false ? 0 : 1
        );
      }
    }

    if (Array.isArray(data.products)) {
      db.exec('DELETE FROM products');
      const insertP = db.prepare(
        `INSERT INTO products
         (id, code, name, category, kind, unit, default_warehouse_id, purchase_price, sale_price, opening_stock, min_stock, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const p of data.products) {
        insertP.run(
          p.id,
          p.code || '',
          p.name,
          p.category || null,
          p.kind === 'service' ? 'service' : 'goods',
          p.unit || 'عدد',
          p.defaultWarehouseId || null,
          p.purchasePrice != null && Number.isFinite(Number(p.purchasePrice)) ? Number(p.purchasePrice) : null,
          p.salePrice != null && Number.isFinite(Number(p.salePrice)) ? Number(p.salePrice) : null,
          p.openingStock != null && Number.isFinite(Number(p.openingStock)) ? Number(p.openingStock) : null,
          p.minStock != null && Number.isFinite(Number(p.minStock)) ? Number(p.minStock) : null,
          p.notes || null,
          p.isActive === false ? 0 : 1
        );
      }
    }

    if (Array.isArray(data.invoices)) {
      db.exec('DELETE FROM invoice_items');
      db.exec('DELETE FROM invoices');
      const insertInv = db.prepare(
        `INSERT INTO invoices
         (id, kind, invoice_number, date, due_date, contact_id, account_id, warehouse_id, amount, description, att_path, att_mime, att_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertItem = db.prepare(
        `INSERT INTO invoice_items
         (id, invoice_id, sort_order, product_id, product_name, warehouse_id, unit, quantity, unit_price, discount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const inv of data.invoices) {
        const att = inv.attachment;
        let pathVal = att?.path || null;
        if (!pathVal && typeof att?.data === 'string' && att.data.startsWith('/')) {
          pathVal = att.data;
        }
        if (pathVal && String(pathVal).startsWith('data:')) pathVal = null;
        insertInv.run(
          inv.id,
          inv.kind,
          inv.invoiceNumber || '',
          inv.date,
          inv.dueDate || null,
          inv.contactId,
          inv.accountId,
          inv.warehouseId || null,
          inv.amount,
          inv.description || '',
          pathVal,
          pathVal ? att?.mimeType || null : null,
          pathVal ? att?.name || null : null
        );
        if (Array.isArray(inv.items)) {
          inv.items.forEach((it, idx) => {
            insertItem.run(
              it.id || `${inv.id}_item_${idx + 1}`,
              inv.id,
              idx,
              it.productId || null,
              it.productName || '',
              it.warehouseId || inv.warehouseId || null,
              it.unit || 'عدد',
              Number(it.quantity) || 0,
              Number(it.unitPrice) || 0,
              Number(it.discount) || 0,
              Number(it.total) || 0
            );
          });
        }
      }
    }

    if (Array.isArray(data.payrollContracts)) {
      db.exec('DELETE FROM payroll_contracts');
      const insertPc = db.prepare(
        `INSERT INTO payroll_contracts
         (id, contact_id, account_id, jalali_year, monthly_amount, start_month, end_month, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const pc of data.payrollContracts) {
        insertPc.run(
          pc.id,
          pc.contactId,
          pc.accountId,
          pc.jalaliYear,
          pc.monthlyAmount,
          pc.startMonth ?? 1,
          pc.endMonth ?? 12,
          pc.notes || null,
          pc.isActive === false ? 0 : 1
        );
      }
    }

    if (Array.isArray(data.payrollEntries)) {
      db.exec('DELETE FROM payroll_entries');
      const insertPe = db.prepare(
        `INSERT INTO payroll_entries
         (id, entry_type, contact_id, contract_id, account_id, date, jalali_year, jalali_month, quantity, unit_label, unit_rate, amount, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const pe of data.payrollEntries) {
        insertPe.run(
          pe.id,
          pe.entryType,
          pe.contactId,
          pe.contractId || null,
          pe.accountId,
          pe.date,
          pe.jalaliYear ?? null,
          pe.jalaliMonth ?? null,
          pe.quantity ?? 1,
          pe.unitLabel || 'روز',
          pe.unitRate ?? pe.amount,
          pe.amount,
          pe.description || ''
        );
      }
    }

    if (Array.isArray(data.checks)) {
      db.exec('DELETE FROM checks');
      const insertCh = db.prepare(
        `INSERT INTO checks
         (id, kind, check_number, sayad_id, contact_id, bank_account_id, invoice_id, payroll_entry_id, amount, issue_date, due_date, status, settled_date, cleared_tx_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const ch of data.checks) {
        insertCh.run(
          ch.id,
          ch.kind,
          ch.checkNumber || '',
          ch.sayadId || null,
          ch.contactId,
          ch.bankAccountId,
          ch.invoiceId || null,
          ch.payrollEntryId || null,
          ch.amount,
          ch.issueDate,
          ch.dueDate,
          ch.status || 'pending',
          ch.settledDate || null,
          ch.clearedTxId || null,
          ch.description || ''
        );
      }
    }

    if (Array.isArray(data.loans)) {
      db.exec('DELETE FROM loans');
      const insertL = db.prepare(
        `INSERT INTO loans
         (id, title, lender_name, bank_account_id, interest_account_id, start_date, first_due_date, principal_amount, total_interest, installment_count, interval_months, disbursement_tx_id, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const l of data.loans) {
        insertL.run(
          l.id,
          l.title,
          l.lenderName || '',
          l.bankAccountId,
          l.interestAccountId || 'acc_loan_interest',
          l.startDate,
          l.firstDueDate,
          l.principalAmount,
          l.totalInterest ?? 0,
          l.installmentCount ?? 1,
          l.intervalMonths ?? 1,
          l.disbursementTxId || null,
          l.notes || null,
          l.status || 'active'
        );
      }
    }

    if (Array.isArray(data.loanInstallments)) {
      db.exec('DELETE FROM loan_installments');
      const insertLi = db.prepare(
        `INSERT INTO loan_installments
         (id, loan_id, number, due_date, principal_share, interest_share, total_amount, status, paid_date, principal_tx_id, interest_tx_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const li of data.loanInstallments) {
        insertLi.run(
          li.id,
          li.loanId,
          li.number,
          li.dueDate,
          li.principalShare,
          li.interestShare,
          li.totalAmount,
          li.status || 'pending',
          li.paidDate || null,
          li.principalTxId || null,
          li.interestTxId || null
        );
      }
    }

    if (data.reminderSettings && typeof data.reminderSettings === 'object') {
      const cleaned = {
        enabled: data.reminderSettings.enabled !== false,
        leadDays: Math.max(0, Math.min(30, Number(data.reminderSettings.leadDays ?? 2) || 0)),
        recipientMobile: String(data.reminderSettings.recipientMobile || '').slice(0, 32),
        smsEnabled: Boolean(data.reminderSettings.smsEnabled),
        smsProvider: ['mock', 'kavenegar', 'melipayamak', 'farazsms'].includes(
          data.reminderSettings.smsProvider
        )
          ? data.reminderSettings.smsProvider
          : 'mock',
        smsSender: String(data.reminderSettings.smsSender || '').slice(0, 64),
        smsTemplate: String(data.reminderSettings.smsTemplate || '').slice(0, 200),
      };
      setMeta(db, 'reminder_settings', JSON.stringify(cleaned));
    }

    if (data.userProfile) {
      db.prepare(
        `UPDATE profile SET first_name = ?, last_name = ?, mobile = ?, picture_path = ? WHERE id = 1`
      ).run(
        data.userProfile.firstName || '',
        data.userProfile.lastName || '',
        data.userProfile.mobile || '',
        data.userProfile.picture || ''
      );
    }

    if (data.appSettings) {
      db.prepare(`UPDATE settings SET name = ?, logo_path = ? WHERE id = 1`).run(
        data.appSettings.name || APP_NAME,
        data.appSettings.logo || ''
      );
      if (data.appSettings.businessTemplate || data.appSettings.accountingDefaults) {
        const currentRaw = getMeta(db, 'accounting_settings');
        let prev = {
          businessTemplate: 'commercial',
          accountingDefaults: { ...DEFAULT_ACCOUNTING_DEFAULTS },
        };
        try {
          if (currentRaw) prev = { ...prev, ...JSON.parse(currentRaw) };
        } catch {
          /* ignore */
        }
        const nextBusinessTemplate = ['commercial', 'agriculture', 'service', 'manufacturing'].includes(
          data.appSettings.businessTemplate
        )
          ? data.appSettings.businessTemplate
          : prev.businessTemplate || 'commercial';
        const nextAccountingDefaults = {
          ...DEFAULT_ACCOUNTING_DEFAULTS,
          ...(prev.accountingDefaults || {}),
          ...(data.appSettings.accountingDefaults || {}),
        };
        setMeta(
          db,
          'accounting_settings',
          JSON.stringify({
            businessTemplate: nextBusinessTemplate,
            accountingDefaults: nextAccountingDefaults,
          })
        );
      }
    }

    if (data.prefs) {
      const upsert = db.prepare(
        `INSERT INTO app_prefs (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      );
      if (data.prefs.theme != null) upsert.run('theme', data.prefs.theme);
      if (data.prefs.pdfPageSize != null) upsert.run('pdf_page_size', data.prefs.pdfPageSize);
      if (data.prefs.sidebarCollapsed != null)
        upsert.run('sidebar_collapsed', data.prefs.sidebarCollapsed ? '1' : '0');
    }

    writeAuthTables(db, data, { replaceOwner: Boolean(replaceAuth && data.owner) });

    commit.run();
  } catch (e) {
    try {
      rollback.run();
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export function clearDomainData(db) {
  writeDomainState(db, {
    accounts: EMPTY_CHART,
    contactGroups: DEFAULT_CONTACT_GROUPS,
    contacts: [],
    warehouses: DEFAULT_WAREHOUSES,
    products: [],
    transactions: [],
    invoices: [],
    payrollContracts: [],
    payrollEntries: [],
    checks: [],
    loans: [],
    loanInstallments: [],
    reminderSettings: { enabled: true, leadDays: 2, recipientMobile: '', smsEnabled: false },
    userProfile: { firstName: '', lastName: '', mobile: '', picture: '' },
    appSettings: {
      name: APP_NAME,
      logo: '',
      businessTemplate: 'commercial',
      accountingDefaults: { ...DEFAULT_ACCOUNTING_DEFAULTS },
    },
  });
}

export function createSession(db, session) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions (token, kind, username, staff_id, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(
    token,
    session.kind,
    session.kind === 'owner' ? session.username : null,
    session.kind === 'staff' ? session.userId : null,
    expires
  );
  return token;
}

export function deleteSession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function resolveSessionFromToken(db, token) {
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  if (row.kind === 'owner') {
    const owner = getOwner(db);
    if (!owner || owner.username !== row.username) return null;
    return {
      kind: 'owner',
      username: owner.username,
      displayName: owner.displayName,
      permissions: [...ALL_PERMISSIONS],
    };
  }

  const staff = getStaffUsers(db).find((u) => u.id === row.staff_id && u.active);
  const groups = getPermissionGroups(db);
  const group = groups.find((g) => g.id === staff?.groupId);
  if (!staff || !group) return null;
  return {
    kind: 'staff',
    userId: staff.id,
    username: staff.username,
    displayName: staff.displayName || staff.username,
    groupId: group.id,
    groupName: group.name,
    permissions: sanitizeGroupPermissions(group.permissions),
  };
}
