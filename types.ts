// --- Chart of Accounts ---
export type AccountKind = 'group' | 'postable';
export type AccountModule = 'income' | 'expense' | 'bank';
export type TreasuryAccountType = 'bank' | 'cashbox' | 'pettyCash';

export interface Account {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  kind: AccountKind;
  module: AccountModule;
  isActive: boolean;
  isSystem?: boolean;
  openingBalance?: number;
  /** نوع حساب خزانه: حساب بانکی، صندوق نقدی یا تنخواه‌گردان */
  treasuryType?: TreasuryAccountType;
  /** عنوان حساب / محل استقرار / پروژه — اختیاری */
  accountTitle?: string;
  /** شماره حساب یا کارت برای نمایش ماسک‌شده (****۱۳۲۴) — اختیاری */
  accountNumber?: string;
  /** نام شعبه (برای بانک) یا مسئول/تنخواه‌دار (برای صندوق و تنخواه) — اختیاری */
  holderName?: string;
}

// --- Contacts (separate from chart of accounts) ---
export interface ContactGroup {
  id: string;
  name: string;
  sortOrder?: number;
}

export type PersonnelType = 'fixed' | 'daily' | 'both';

export interface Contact {
  id: string;
  groupId: string;
  fullName: string;
  mobile?: string;
  notes?: string;
  picture?: string;
  /** مشخص می‌کند آیا این شخص به عنوان پرسنل / کارگر در سیستم تعریف شده است */
  isPersonnel?: boolean;
  /** نوع همکاری پرسنل: ثابت ماهانه، روزمزد/کارکردی، یا هر دو */
  personnelType?: PersonnelType;
  /** نرخ پیش‌فرض کارکرد (مثلاً دستمزد هر روز یا هر شبانه‌روز آبگیری) */
  defaultRate?: number;
  /** واحد پیش‌فرض کارکرد (مثلاً روز، شبانه‌روز، ماه) */
  defaultUnitLabel?: string;
}

// --- Simple & Linked Transactions ---
export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionLinkKind =
  | 'regular'
  | 'invoice_settlement'
  | 'payroll_payment'
  | 'check_clearing'
  | 'loan_disbursement'
  | 'loan_principal'
  | 'loan_interest';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: TransactionType;
  /** For income/expense: heading account ID. For transfer: destination bank account ID. */
  accountId: string;
  /** For income/expense: bank account ID. For transfer: source bank account ID. */
  bankAccountId: string;
  /** Optional linked person */
  contactId?: string;
  attachment?: Attachment;
  /** Accrual linkage metadata to prevent double counting in P&L while keeping bank cash exact */
  linkKind?: TransactionLinkKind;
  invoiceId?: string;
  payrollEntryId?: string;
  checkId?: string;
  loanId?: string;
  loanInstallmentId?: string;
}

export interface Attachment {
  /** Server path e.g. /uploads/attachments/... or public /demo/... */
  path: string;
  mimeType: string;
  name: string;
}

// --- Inventory (Warehouses & Products/Services) ---
export type ProductKind = 'goods' | 'service';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string;
  managerName?: string;
  notes?: string;
  isDefault?: boolean;
  isActive: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category?: string;
  kind: ProductKind;
  unit: string;
  defaultWarehouseId?: string;
  purchasePrice?: number;
  salePrice?: number;
  openingStock?: number;
  minStock?: number;
  notes?: string;
  isActive: boolean;
}

// --- Invoices (Purchase & Sale Accrual + Line Items) ---
export type InvoiceKind = 'purchase' | 'sale';

export interface InvoiceLineItem {
  id: string;
  productId?: string;
  productName: string;
  warehouseId?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
}

export interface Invoice {
  id: string;
  kind: InvoiceKind;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  contactId: string;
  /** Expense heading for purchase invoices; Income heading for sale invoices */
  accountId: string;
  /** Default warehouse associated with this invoice */
  warehouseId?: string;
  /** Optional structured line items; when present, amount equals sum of line totals */
  items?: InvoiceLineItem[];
  amount: number;
  description: string;
  attachment?: Attachment;
}

// --- Payroll & Work-Logs ---
export type PayrollEntryType =
  | 'fixed_month'
  | 'work_log'
  | 'daily_work'
  | 'irrigation'
  | 'group_labor';

export interface PayrollContract {
  id: string;
  contactId: string;
  /** Expense heading (e.g. حقوق و دستمزد) */
  accountId: string;
  jalaliYear: number;
  monthlyAmount: number;
  startMonth: number; // 1..12
  endMonth: number; // 1..12
  notes?: string;
  isActive: boolean;
}

export interface PayrollEntry {
  id: string;
  entryType: PayrollEntryType;
  contactId: string;
  contractId?: string;
  accountId: string;
  date: string;
  jalaliYear?: number;
  jalaliMonth?: number; // 1..12
  quantity: number;
  unitLabel: string; // e.g. 'ماه', 'شبانه‌روز', 'روز', 'نفر-روز'
  unitRate: number;
  amount: number;
  description: string;
}

// --- Checks (Payable & Receivable) ---
export type CheckKind = 'payable' | 'receivable';
export type CheckStatus = 'pending' | 'cleared' | 'bounced' | 'cancelled';

export interface CheckItem {
  id: string;
  kind: CheckKind;
  checkNumber: string;
  sayadId?: string;
  contactId: string;
  bankAccountId: string;
  invoiceId?: string;
  payrollEntryId?: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: CheckStatus;
  settledDate?: string;
  clearedTxId?: string;
  description: string;
}

// --- Loans & Installments ---
export type LoanStatus = 'active' | 'paid_off';
export type LoanInstallmentStatus = 'pending' | 'paid';

export interface Loan {
  id: string;
  title: string;
  lenderName: string;
  bankAccountId: string;
  interestAccountId: string;
  startDate: string;
  firstDueDate: string;
  principalAmount: number;
  totalInterest: number;
  installmentCount: number;
  intervalMonths: number;
  disbursementTxId?: string;
  notes?: string;
  status: LoanStatus;
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  number: number;
  dueDate: string;
  principalShare: number;
  interestShare: number;
  totalAmount: number;
  status: LoanInstallmentStatus;
  paidDate?: string;
  principalTxId?: string;
  interestTxId?: string;
}

// --- Reminder & SMS Settings ---
export type SmsProviderKind = 'mock' | 'kavenegar' | 'melipayamak' | 'farazsms';

export interface ReminderSettings {
  enabled: boolean;
  leadDays: number;
  recipientMobile: string;
  smsEnabled: boolean;
  smsProvider?: SmsProviderKind;
  smsSender?: string;
  smsTemplate?: string;
}

export interface SmsDispatchLog {
  id: string;
  createdAt: string;
  recipient: string;
  message: string;
  provider: string;
  status: 'sent' | 'dry_run' | 'failed';
  detail?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  mobile: string;
  picture: string;
}

export type BusinessTemplateId =
  | 'commercial'
  | 'agriculture'
  | 'service'
  | 'manufacturing';

export type AccountingDefaultRole =
  | 'saleInvoice'
  | 'purchaseInvoice'
  | 'incomeTxn'
  | 'expenseTxn'
  | 'defaultBank'
  | 'payrollFixed'
  | 'payrollDaily'
  | 'payrollIrrigation'
  | 'payrollGroup'
  | 'loanInterest';

export interface AccountingDefaults {
  saleInvoiceAccountId?: string;
  purchaseInvoiceAccountId?: string;
  incomeTxnAccountId?: string;
  expenseTxnAccountId?: string;
  defaultBankAccountId?: string;
  defaultWarehouseId?: string;
  payrollFixedAccountId?: string;
  payrollDailyAccountId?: string;
  payrollIrrigationAccountId?: string;
  payrollGroupAccountId?: string;
  loanInterestAccountId?: string;
}

export interface AppSettings {
  name: string;
  logo: string;
  businessTemplate?: BusinessTemplateId;
  accountingDefaults?: AccountingDefaults;
}

export type Permission =
  | 'dashboard.view'
  | 'journals.view'
  | 'journals.create'
  | 'journals.edit'
  | 'journals.delete'
  | 'journals.export'
  | 'contacts.view'
  | 'contacts.create'
  | 'contacts.edit'
  | 'contacts.delete'
  | 'reports.view'
  | 'reports.export'
  | 'settings.view'
  | 'settings.business'
  | 'settings.demo'
  | 'settings.accounts'
  | 'settings.backup'
  | 'settings.password'
  | 'access.view';

export interface PermissionGroup {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  hashedPassword: string;
  groupId: string;
  active: boolean;
}

export interface OwnerAccount {
  username: string;
  hashedPassword: string;
  needsPasswordChange?: boolean;
  displayName?: string;
}

export type AppSession =
  | {
      kind: 'owner';
      username: string;
      displayName: string;
      permissions: Permission[];
    }
  | {
      kind: 'staff';
      userId: string;
      username: string;
      displayName: string;
      groupId: string;
      groupName: string;
      permissions: Permission[];
    };

export type View =
  | 'dashboard'
  | 'income'
  | 'expense'
  | 'invoices'
  | 'transfers'
  | 'payroll'
  | 'checks'
  | 'loans'
  | 'banks'
  | 'persons'
  | 'inventory'
  | 'chartOfAccounts'
  | 'reports'
  | 'monthly-report'
  | 'account-ledger-report'
  | 'trial-balance-report'
  | 'persons-report'
  | 'treasury-report'
  | 'access'
  | 'settings'
  | 'profile'
  | 'settingsPassword'
  | 'settingsBusiness'
  | 'settingsAccountingDefaults'
  | 'settingsBackup'
  | 'settingsReminders';
