import type {
  Account,
  AccountingDefaultRole,
  AccountingDefaults,
  BusinessTemplateId,
  ContactGroup,
  Warehouse,
} from '../types';

export interface BusinessTemplateDefinition {
  id: BusinessTemplateId;
  title: string;
  subtitle: string;
  description: string;
  sampleHeadings: string[];
  accounts: Account[];
  defaults: Required<AccountingDefaults>;
  contactGroups: ContactGroup[];
  warehouses: Warehouse[];
}

export const STANDARD_CONTACT_GROUPS: ContactGroup[] = [
  { id: 'cg_customers', name: 'مشتریان و خریداران', sortOrder: 1 },
  { id: 'cg_suppliers', name: 'فروشندگان و تأمین‌کنندگان', sortOrder: 2 },
  { id: 'cg_personnel', name: 'پرسنل و کارگران', sortOrder: 3 },
  { id: 'cg_others', name: 'سایر طرف‌حساب‌ها', sortOrder: 4 },
];

export const STANDARD_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh_main',
    code: '101',
    name: 'انبار مرکزی',
    location: 'محل اصلی کسب‌وکار',
    isDefault: true,
    isActive: true,
  },
];

const CORE_SYSTEM_ROOTS: Account[] = [
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
];

const CORE_LABOR_AND_LOAN_ACCOUNTS: Account[] = [
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
  },
  {
    id: 'acc_exp_daily_labor',
    code: '20102',
    name: 'کارگری روزمزد',
    parentId: 'acc_exp_labor',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_irrigation',
    code: '20103',
    name: 'آبگیری',
    parentId: 'acc_exp_labor',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_group_labor',
    code: '20104',
    name: 'کارگری دسته‌جمعی',
    parentId: 'acc_exp_labor',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
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
];

const CORE_TREASURY_ACCOUNTS: Account[] = [
  {
    id: 'acc_bank_cashbox',
    code: '301',
    name: 'صندوق نقدی اصلی',
    parentId: 'acc_bank',
    kind: 'postable',
    module: 'bank',
    isActive: true,
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
    openingBalance: 0,
    treasuryType: 'pettyCash',
    accountTitle: 'تنخواه جاری',
  },
];

export const COMMERCIAL_ACCOUNTS: Account[] = [
  ...CORE_SYSTEM_ROOTS,
  // Income Groups & Leaves
  {
    id: 'acc_inc_operational',
    code: '101',
    name: 'درآمدهای عملیاتی و فروش',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_sales',
    code: '10101',
    name: 'فروش کالا و محصولات',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_services',
    code: '10102',
    name: 'درآمد ارائه خدمات',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_other_grp',
    code: '102',
    name: 'سایر درآمدها',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_misc',
    code: '10201',
    name: 'سایر درآمدهای متفرقه',
    parentId: 'acc_inc_other_grp',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  // Labor & Loan Interest
  ...CORE_LABOR_AND_LOAN_ACCOUNTS,
  // Expense Groups & Leaves
  {
    id: 'acc_exp_purchase_grp',
    code: '202',
    name: 'خرید کالا، مواد و ملزومات',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_purchase',
    code: '20201',
    name: 'خرید کالای تجاری و مواد اولیه',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_packaging',
    code: '20202',
    name: 'خرید ملزومات و بسته‌بندی',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_ops_grp',
    code: '203',
    name: 'هزینه‌های عملیاتی، حمل‌ونقل و نگهداری',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_freight',
    code: '20301',
    name: 'کرایه حمل و باربری',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_maintenance',
    code: '20302',
    name: 'تعمیر و نگهداری تجهیزات',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_admin_grp',
    code: '204',
    name: 'هزینه‌های عمومی، اداری و قبوض',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_rent',
    code: '20401',
    name: 'اجاره‌بهای محل',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_utilities',
    code: '20402',
    name: 'آب، برق، گاز و مخابرات',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_office',
    code: '20403',
    name: 'پذیرایی و ملزومات اداری',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  // Treasury
  ...CORE_TREASURY_ACCOUNTS,
];

export const AGRICULTURE_ACCOUNTS: Account[] = [
  ...CORE_SYSTEM_ROOTS,
  {
    id: 'acc_inc_operational',
    code: '101',
    name: 'درآمد فروش محصول و فرآوری',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_sales',
    code: '10101',
    name: 'فروش محصول باغی و پسته',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_export_sales',
    code: '10102',
    name: 'فروش صادراتی و محموله عمده',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_processing_fee',
    code: '10103',
    name: 'درآمد حق‌الزحمه ضبط و فرآوری',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_other_grp',
    code: '102',
    name: 'سایر درآمدهای باغی',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_byproducts',
    code: '10201',
    name: 'فروش ضایعات، پوست و محصولات فرعی',
    parentId: 'acc_inc_other_grp',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  ...CORE_LABOR_AND_LOAN_ACCOUNTS,
  {
    id: 'acc_exp_purchase_grp',
    code: '202',
    name: 'خرید نهاده‌ها، کود، سم و محصول خام',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_purchase',
    code: '20201',
    name: 'خرید کود، سم و نهاده کشاورزی',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_raw_crop',
    code: '20202',
    name: 'خرید محصول خام و تازه باغی',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_packaging',
    code: '20203',
    name: 'خرید گونی، کارتن و ملزومات بسته‌بندی',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_ops_grp',
    code: '203',
    name: 'هزینه‌های باغداری، آبیاری و فرآوری',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_water_share',
    code: '20301',
    name: 'اجاره ساعت آب و حق‌آبه موتورپمپ',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_sorting',
    code: '20302',
    name: 'هزینه ضبط، خشک‌کن و سورتینگ',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_freight',
    code: '20303',
    name: 'کرایه حمل محموله و تراکتور',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_maintenance',
    code: '20304',
    name: 'تعمیر ادوات کشاورزی و چاه آب',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_admin_grp',
    code: '204',
    name: 'هزینه‌های عمومی، انرژی و انبار',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_utilities',
    code: '20401',
    name: 'سوخت، برق چاه و گاز خشک‌کن',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_rent',
    code: '20402',
    name: 'اجاره انبار و ترمینال ضبط',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  ...CORE_TREASURY_ACCOUNTS,
];

export const SERVICE_ACCOUNTS: Account[] = [
  ...CORE_SYSTEM_ROOTS,
  {
    id: 'acc_inc_operational',
    code: '101',
    name: 'درآمد خدمات، قراردادها و پروژه‌ها',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_sales',
    code: '10101',
    name: 'درآمد ارائه خدمات تخصصی و فنی',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_contracts',
    code: '10102',
    name: 'درآمد قراردادهای پشتیبانی و مشاوره',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_contracting',
    code: '10103',
    name: 'حق‌الزحمه اجرا و پیمانکاری پروژه',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_other_grp',
    code: '102',
    name: 'سایر درآمدها',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_misc',
    code: '10201',
    name: 'سایر درآمدهای متفرقه',
    parentId: 'acc_inc_other_grp',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  ...CORE_LABOR_AND_LOAN_ACCOUNTS,
  {
    id: 'acc_exp_purchase_grp',
    code: '202',
    name: 'تأمین قطعات، ملزومات و خدمات پروژه',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_purchase',
    code: '20201',
    name: 'خرید قطعات، ابزار و ملزومات مصرفی',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_subcontract',
    code: '20202',
    name: 'هزینه برون‌سپاری و پیمانکار جزء',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_ops_grp',
    code: '203',
    name: 'هزینه‌های اجرایی و عملیاتی',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_freight',
    code: '20301',
    name: 'ایاب‌وذهاب، مأموریت و حمل تجهیزات',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_maintenance',
    code: '20302',
    name: 'سرویس و نگهداری ابزار و تجهیزات',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_admin_grp',
    code: '204',
    name: 'هزینه‌های اداری، دفتر و بازاریابی',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_rent',
    code: '20401',
    name: 'اجاره دفتر و محل کسب',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_utilities',
    code: '20402',
    name: 'قبوض اینترنت، تلفن، برق و آب',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_office',
    code: '20403',
    name: 'پذیرایی، تبلیغات و ملزومات اداری',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  ...CORE_TREASURY_ACCOUNTS,
];

export const MANUFACTURING_ACCOUNTS: Account[] = [
  ...CORE_SYSTEM_ROOTS,
  {
    id: 'acc_inc_operational',
    code: '101',
    name: 'درآمد فروش تولیدات و کارمزدی',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_sales',
    code: '10101',
    name: 'فروش محصولات تولیدی و ساخته‌شده',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_custom_order',
    code: '10102',
    name: 'درآمد تولید سفارشی و حق‌العمل‌کاری',
    parentId: 'acc_inc_operational',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_other_grp',
    code: '102',
    name: 'سایر درآمدهای کارگاه',
    parentId: 'acc_income',
    kind: 'group',
    module: 'income',
    isActive: true,
  },
  {
    id: 'acc_inc_scrap',
    code: '10201',
    name: 'فروش ضایعات و سرریز مواد تولید',
    parentId: 'acc_inc_other_grp',
    kind: 'postable',
    module: 'income',
    isActive: true,
  },
  ...CORE_LABOR_AND_LOAN_ACCOUNTS,
  {
    id: 'acc_exp_purchase_grp',
    code: '202',
    name: 'تأمین مواد اولیه و بسته‌بندی تولید',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_purchase',
    code: '20201',
    name: 'خرید مواد اولیه و قطعات تولید',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_packaging',
    code: '20202',
    name: 'خرید کارتن، لیبل و ملزومات بسته‌بندی',
    parentId: 'acc_exp_purchase_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_ops_grp',
    code: '203',
    name: 'سربار تولید، ماشین‌آلات و حمل',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_maintenance',
    code: '20301',
    name: 'تعمیر، سرویس و قطعات یدکی ماشین‌آلات',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_freight',
    code: '20302',
    name: 'حمل مواد اولیه و ارسال بار تولیدی',
    parentId: 'acc_exp_ops_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_admin_grp',
    code: '204',
    name: 'هزینه‌های کارگاه، انرژی و اداری',
    parentId: 'acc_expense',
    kind: 'group',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_utilities',
    code: '20401',
    name: 'برق صنعتی، گاز، سوخت و آب کارگاه',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_rent',
    code: '20402',
    name: 'اجاره سوله، کارگاه و انبار',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  {
    id: 'acc_exp_office',
    code: '20403',
    name: 'ملزومات اداری و ایمنی کارگاه',
    parentId: 'acc_exp_admin_grp',
    kind: 'postable',
    module: 'expense',
    isActive: true,
  },
  ...CORE_TREASURY_ACCOUNTS,
];

export const DEFAULT_ACCOUNTING_DEFAULTS: Required<AccountingDefaults> = {
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

export const BUSINESS_TEMPLATES: Record<BusinessTemplateId, BusinessTemplateDefinition> = {
  commercial: {
    id: 'commercial',
    title: 'عمومی، بازرگانی و فروشگاهی',
    subtitle: 'فروش کالا، خرید تجاری، خدمات و هزینه‌های عمومی',
    description:
      'ساختار استاندارد حسابداری برای فروشگاه‌ها، شرکت‌های بازرگانی، پخش و کسب‌وکارهای عمومی',
    sampleHeadings: [
      'فروش کالا و محصولات',
      'خرید کالای تجاری و مواد اولیه',
      'کرایه حمل و باربری',
      'اجاره‌بهای محل',
    ],
    accounts: COMMERCIAL_ACCOUNTS,
    defaults: {
      ...DEFAULT_ACCOUNTING_DEFAULTS,
      expenseTxnAccountId: 'acc_exp_office',
    },
    contactGroups: STANDARD_CONTACT_GROUPS,
    warehouses: STANDARD_WAREHOUSES,
  },
  agriculture: {
    id: 'agriculture',
    title: 'کشاورزی، باغداری و فرآوری پسته',
    subtitle: 'فروش محصول باغی، خرید کود و سم، آبگیری، ضبط و سورتینگ',
    description:
      'طراحی‌شده ویژه باغداران، ترمینال‌های ضبط پسته، کشاورزان و واحدهای سورتینگ و فرآوری محصول',
    sampleHeadings: [
      'فروش محصول باغی و پسته',
      'خرید کود، سم و نهاده کشاورزی',
      'اجاره ساعت آب و حق‌آبه موتورپمپ',
      'هزینه ضبط، خشک‌کن و سورتینگ',
    ],
    accounts: AGRICULTURE_ACCOUNTS,
    defaults: {
      ...DEFAULT_ACCOUNTING_DEFAULTS,
      expenseTxnAccountId: 'acc_exp_freight',
    },
    contactGroups: STANDARD_CONTACT_GROUPS,
    warehouses: STANDARD_WAREHOUSES,
  },
  service: {
    id: 'service',
    title: 'خدماتی، فنی و پیمانکاری',
    subtitle: 'درآمد خدمات تخصصی، قراردادهای پشتیبانی، قطعات و برون‌سپاری',
    description:
      'مناسب شرکت‌های خدماتی، دفاتر فنی و مهندسی، پیمانکاران پروژه و مراکز تعمیرات تخصصی',
    sampleHeadings: [
      'درآمد ارائه خدمات تخصصی و فنی',
      'درآمد قراردادهای پشتیبانی و مشاوره',
      'خرید قطعات، ابزار و ملزومات مصرفی',
      'ایاب‌وذهاب، مأموریت و حمل تجهیزات',
    ],
    accounts: SERVICE_ACCOUNTS,
    defaults: {
      ...DEFAULT_ACCOUNTING_DEFAULTS,
      expenseTxnAccountId: 'acc_exp_freight',
    },
    contactGroups: STANDARD_CONTACT_GROUPS,
    warehouses: STANDARD_WAREHOUSES,
  },
  manufacturing: {
    id: 'manufacturing',
    title: 'تولیدی، صنعتی و کارگاهی',
    subtitle: 'فروش محصولات تولیدی، خرید مواد اولیه، بسته‌بندی و سربار کارگاه',
    description:
      'مناسب کارگاه‌های تولیدی، صنایع کوچک و متوسط، بسته‌بندی و تولیدکنندگان سفارشی',
    sampleHeadings: [
      'فروش محصولات تولیدی و ساخته‌شده',
      'خرید مواد اولیه و قطعات تولید',
      'خرید کارتن، لیبل و ملزومات بسته‌بندی',
      'تعمیر، سرویس و قطعات یدکی ماشین‌آلات',
    ],
    accounts: MANUFACTURING_ACCOUNTS,
    defaults: {
      ...DEFAULT_ACCOUNTING_DEFAULTS,
      expenseTxnAccountId: 'acc_exp_maintenance',
    },
    contactGroups: STANDARD_CONTACT_GROUPS,
    warehouses: STANDARD_WAREHOUSES,
  },
};

export const BUSINESS_TEMPLATE_LIST: BusinessTemplateDefinition[] = [
  BUSINESS_TEMPLATES.commercial,
  BUSINESS_TEMPLATES.agriculture,
  BUSINESS_TEMPLATES.service,
  BUSINESS_TEMPLATES.manufacturing,
];

const ROLE_MODULE: Record<AccountingDefaultRole, 'income' | 'expense' | 'bank'> = {
  saleInvoice: 'income',
  purchaseInvoice: 'expense',
  incomeTxn: 'income',
  expenseTxn: 'expense',
  defaultBank: 'bank',
  payrollFixed: 'expense',
  payrollDaily: 'expense',
  payrollIrrigation: 'expense',
  payrollGroup: 'expense',
  loanInterest: 'expense',
};

const ROLE_DEFAULT_KEY: Record<AccountingDefaultRole, keyof AccountingDefaults> = {
  saleInvoice: 'saleInvoiceAccountId',
  purchaseInvoice: 'purchaseInvoiceAccountId',
  incomeTxn: 'incomeTxnAccountId',
  expenseTxn: 'expenseTxnAccountId',
  defaultBank: 'defaultBankAccountId',
  payrollFixed: 'payrollFixedAccountId',
  payrollDaily: 'payrollDailyAccountId',
  payrollIrrigation: 'payrollIrrigationAccountId',
  payrollGroup: 'payrollGroupAccountId',
  loanInterest: 'loanInterestAccountId',
};

const ROLE_CANONICAL_IDS: Record<AccountingDefaultRole, string[]> = {
  saleInvoice: ['acc_inc_sales', 'acc_inc_services'],
  purchaseInvoice: ['acc_exp_purchase', 'acc_exp_raw_crop', 'acc_exp_packaging'],
  incomeTxn: ['acc_inc_sales', 'acc_inc_services', 'acc_inc_misc'],
  expenseTxn: ['acc_exp_office', 'acc_exp_freight', 'acc_exp_maintenance', 'acc_exp_purchase'],
  defaultBank: ['acc_bank_cashbox', 'acc_bank_petty'],
  payrollFixed: ['acc_exp_fixed_salary'],
  payrollDaily: ['acc_exp_daily_labor'],
  payrollIrrigation: ['acc_exp_irrigation'],
  payrollGroup: ['acc_exp_group_labor'],
  loanInterest: ['acc_loan_interest'],
};

const ROLE_NAME_KEYWORDS: Record<AccountingDefaultRole, RegExp> = {
  saleInvoice: /فروش|درآمد ارائه خدمات|محصول/,
  purchaseInvoice: /خرید|مواد اولیه|کود|سم|نهاده|قطعات|ملزومات/,
  incomeTxn: /فروش|درآمد/,
  expenseTxn: /ملزومات|حمل|کرایه|پذیرایی|تعمیر|اجاره|خرید/,
  defaultBank: /صندوق|بانک|تنخواه/,
  payrollFixed: /حقوق ثابت|حقوق و دستمزد/,
  payrollDaily: /روزمزد|کارگری روزمزد/,
  payrollIrrigation: /آبگیری|آبیاری/,
  payrollGroup: /دسته‌جمعی|دسته جمعی/,
  loanInterest: /سود وام|تسهیلات/,
};

/**
 * Resolves the best active postable account ID for any module/form role.
 * 1. Explicit user setting in `defaults` (if valid, active, postable, and matching module).
 * 2. Canonical standard account ID for that role.
 * 3. Keyword match on active postable account name in that module.
 * 4. First active postable leaf in that module (preferring non-labor/non-loan-interest for purchase invoices).
 */
export function resolveDefaultAccountId(
  accounts: Account[],
  defaults: AccountingDefaults | undefined,
  role: AccountingDefaultRole
): string {
  const targetModule = ROLE_MODULE[role];
  const validLeaves = accounts.filter(
    (a) => a.isActive !== false && a.kind === 'postable' && a.module === targetModule
  );
  if (validLeaves.length === 0) return '';

  const byId = new Map(validLeaves.map((a) => [a.id, a]));

  // 1. User's explicit configured default
  const configKey = ROLE_DEFAULT_KEY[role];
  const configuredId = defaults?.[configKey];
  if (configuredId && byId.has(configuredId)) {
    return configuredId;
  }

  // 2. Canonical IDs for the role
  for (const candId of ROLE_CANONICAL_IDS[role]) {
    if (byId.has(candId)) return candId;
  }

  // 3. Name keyword match
  const keywordRe = ROLE_NAME_KEYWORDS[role];
  const keywordMatch = validLeaves.find((a) => keywordRe.test(a.name));
  if (keywordMatch) return keywordMatch.id;

  // 4. For purchaseInvoice or expenseTxn, avoid defaulting to labor/loan interest if another expense exists
  if (role === 'purchaseInvoice' || role === 'expenseTxn') {
    const nonLabor = validLeaves.find(
      (a) => a.parentId !== 'acc_exp_labor' && a.id !== 'acc_loan_interest'
    );
    if (nonLabor) return nonLabor.id;
  }

  return validLeaves[0].id;
}

/**
 * Resolves the default warehouse ID using user settings first, then `isDefault`, then first active warehouse.
 */
export function resolveDefaultWarehouseId(
  warehouses: Warehouse[],
  defaults: AccountingDefaults | undefined
): string {
  const active = warehouses.filter((w) => w.isActive !== false);
  const pool = active.length > 0 ? active : warehouses;
  if (pool.length === 0) return 'wh_main';

  const configuredId = defaults?.defaultWarehouseId;
  if (configuredId && pool.some((w) => w.id === configuredId)) {
    return configuredId;
  }
  return pool.find((w) => w.isDefault)?.id || pool[0].id;
}

export interface DomainActivityCounts {
  transactionsCount: number;
  invoicesCount: number;
  payrollEntriesCount: number;
  checksCount: number;
  loansCount: number;
}

/**
 * Checks whether the domain has zero operational documents, meaning a full template switch is 100% safe.
 */
export function isDomainRawForTemplateSwitch(counts: DomainActivityCounts): boolean {
  return (
    counts.transactionsCount === 0 &&
    counts.invoicesCount === 0 &&
    counts.payrollEntriesCount === 0 &&
    counts.checksCount === 0 &&
    counts.loansCount === 0
  );
}

/**
 * Non-destructively merges missing groups and postable leaves from a business template
 * into an existing Chart of Accounts without overwriting or deleting existing accounts.
 */
export function mergeTemplateAccountsIntoExisting(
  existingAccounts: Account[],
  templateId: BusinessTemplateId
): { accounts: Account[]; addedCount: number } {
  const template = BUSINESS_TEMPLATES[templateId] || BUSINESS_TEMPLATES.commercial;
  const result = [...existingAccounts];
  const existingIds = new Set(result.map((a) => a.id));
  let addedCount = 0;

  for (const tplAcc of template.accounts) {
    if (existingIds.has(tplAcc.id)) continue;

    // Also check if an account with the same parentId and identical name already exists
    const sameNameExists = result.some(
      (a) =>
        a.module === tplAcc.module &&
        a.kind === tplAcc.kind &&
        a.name.trim() === tplAcc.name.trim()
    );
    if (sameNameExists) continue;

    // Ensure parent exists; if parent doesn't exist by ID, fall back to module root
    const parentExists =
      tplAcc.parentId === null || result.some((a) => a.id === tplAcc.parentId);
    const rootFallback =
      tplAcc.module === 'income'
        ? 'acc_income'
        : tplAcc.module === 'expense'
          ? 'acc_expense'
          : 'acc_bank';

    // Avoid code collision under the same module
    let code = tplAcc.code;
    const codeTaken = result.some((a) => a.code === code);
    if (codeTaken) {
      let suffix = 1;
      while (result.some((a) => a.code === `${tplAcc.code}${suffix}`)) {
        suffix += 1;
      }
      code = `${tplAcc.code}${suffix}`;
    }

    const inserted: Account = {
      ...tplAcc,
      code,
      parentId: parentExists ? tplAcc.parentId : rootFallback,
    };
    result.push(inserted);
    existingIds.add(inserted.id);
    addedCount += 1;
  }

  return { accounts: result, addedCount };
}
