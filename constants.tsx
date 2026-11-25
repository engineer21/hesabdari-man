import type { Account, AppSettings, ReminderSettings, UserProfile, Warehouse } from './types';
import {
  COMMERCIAL_ACCOUNTS,
  DEFAULT_ACCOUNTING_DEFAULTS,
  STANDARD_CONTACT_GROUPS,
  STANDARD_WAREHOUSES,
} from './utils/accountingTemplates';

export const APP_NAME = 'حسابداری من';

export const STORAGE_KEYS = {
  sidebarCollapsed: 'farzad_v2_sidebar_collapsed',
  session: 'farzad_v2_session',
  owner: 'farzad_v2_user',
  theme: 'farzad_v2_theme',
  accounts: 'farzad_v2_accounts',
  transactions: 'farzad_v2_transactions',
  contactGroups: 'farzad_v2_contact_groups',
  contacts: 'farzad_v2_contacts',
  profile: 'farzad_v2_profile',
  settings: 'farzad_v2_settings',
  staffUsers: 'farzad_v2_staff_users',
  permissionGroups: 'farzad_v2_permission_groups',
  demoSeeded: 'farzad_v2_demo_seeded',
} as const;

export const MODULE_ROOT_IDS = {
  income: 'acc_income',
  expense: 'acc_expense',
  bank: 'acc_bank',
} as const;

export const LOAN_INTEREST_ACCOUNT_ID = 'acc_loan_interest';

export const PERSONNEL_GROUP_ID = 'cg_personnel';
export const LABOR_GROUP_ACCOUNT_ID = 'acc_exp_labor';
export const FIXED_SALARY_ACCOUNT_ID = 'acc_exp_fixed_salary';
export const DAILY_LABOR_ACCOUNT_ID = 'acc_exp_daily_labor';
export const IRRIGATION_ACCOUNT_ID = 'acc_exp_irrigation';
export const GROUP_LABOR_ACCOUNT_ID = 'acc_exp_group_labor';

export const DEFAULT_WAREHOUSE_ID = 'wh_main';

export const DEFAULT_WAREHOUSES: Warehouse[] = STANDARD_WAREHOUSES;

export const DEFAULT_CONTACT_GROUPS = STANDARD_CONTACT_GROUPS;

export const EMPTY_PROFILE: UserProfile = {
  firstName: '',
  lastName: '',
  mobile: '',
  picture: '',
};

export const EMPTY_SETTINGS: AppSettings = {
  name: APP_NAME,
  logo: '',
  businessTemplate: 'commercial',
  accountingDefaults: { ...DEFAULT_ACCOUNTING_DEFAULTS },
};

export const EMPTY_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  leadDays: 2,
  recipientMobile: '',
  smsEnabled: false,
};

/** Complete standard chart of accounts (Income, Expense, Treasury) preserved even on Reset */
export const EMPTY_CHART_OF_ACCOUNTS: Account[] = COMMERCIAL_ACCOUNTS;
