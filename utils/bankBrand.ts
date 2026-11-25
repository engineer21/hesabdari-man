/**
 * Iranian Bank & Treasury Brand Catalog + Auto-Detection
 * Matches Persian bank names, cashboxes (صندوق), and petty cash (تنخواه) to bespoke emblems & palettes.
 */

import type { Account, TreasuryAccountType } from '../types';

export type BankBrandKey =
  | 'saman'
  | 'mellat'
  | 'melli'
  | 'saderat'
  | 'tejarat'
  | 'keshavarzi'
  | 'sepah'
  | 'parsian'
  | 'pasargad'
  | 'shahr'
  | 'ayandeh'
  | 'blu'
  | 'cash'
  | 'pettyCash'
  | 'default';

export interface BankBrandMeta {
  key: BankBrandKey;
  fullName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  tintBg: string;
  toneClass: string;
  pattern: RegExp;
  isBank?: boolean;
}

export const IRANIAN_BANK_CATALOG: BankBrandMeta[] = [
  {
    key: 'saman',
    fullName: 'بانک سامان',
    shortName: 'سامان',
    primaryColor: '#0284C7',
    secondaryColor: '#38BDF8',
    tintBg: 'rgba(2, 132, 199, 0.12)',
    toneClass: 'tone-info',
    pattern: /سامان|saman/i,
    isBank: true,
  },
  {
    key: 'mellat',
    fullName: 'بانک ملت',
    shortName: 'ملت',
    primaryColor: '#DC2626',
    secondaryColor: '#F59E0B',
    tintBg: 'rgba(220, 38, 38, 0.11)',
    toneClass: 'tone-expense',
    pattern: /ملت|mellat/i,
    isBank: true,
  },
  {
    key: 'melli',
    fullName: 'بانک ملی',
    shortName: 'ملی',
    primaryColor: '#B45309',
    secondaryColor: '#D97706',
    tintBg: 'rgba(217, 119, 6, 0.12)',
    toneClass: 'tone-warning',
    pattern: /ملی|ملي|melli/i,
    isBank: true,
  },
  {
    key: 'saderat',
    fullName: 'بانک صادرات',
    shortName: 'صادرات',
    primaryColor: '#1D4ED8',
    secondaryColor: '#3B82F6',
    tintBg: 'rgba(29, 78, 216, 0.12)',
    toneClass: 'tone-brand',
    pattern: /صادرات|saderat/i,
    isBank: true,
  },
  {
    key: 'tejarat',
    fullName: 'بانک تجارت',
    shortName: 'تجارت',
    primaryColor: '#1E3A8A',
    secondaryColor: '#2563EB',
    tintBg: 'rgba(30, 58, 138, 0.12)',
    toneClass: 'tone-info',
    pattern: /تجارت|tejarat/i,
    isBank: true,
  },
  {
    key: 'keshavarzi',
    fullName: 'بانک کشاورزی',
    shortName: 'کشاورزی',
    primaryColor: '#059669',
    secondaryColor: '#10B981',
    tintBg: 'rgba(5, 150, 105, 0.12)',
    toneClass: 'tone-income',
    pattern: /کشاورزی|کشاورزي|keshavarzi/i,
    isBank: true,
  },
  {
    key: 'sepah',
    fullName: 'بانک سپه',
    shortName: 'سپه',
    primaryColor: '#991B1B',
    secondaryColor: '#F59E0B',
    tintBg: 'rgba(153, 27, 27, 0.12)',
    toneClass: 'tone-brand',
    pattern: /سپه|sepah/i,
    isBank: true,
  },
  {
    key: 'parsian',
    fullName: 'بانک پارسیان',
    shortName: 'پارسیان',
    primaryColor: '#B91C1C',
    secondaryColor: '#EA580C',
    tintBg: 'rgba(185, 28, 28, 0.11)',
    toneClass: 'tone-expense',
    pattern: /پارسیان|پارسيان|parsian/i,
    isBank: true,
  },
  {
    key: 'pasargad',
    fullName: 'بانک پاسارگاد',
    shortName: 'پاسارگاد',
    primaryColor: '#CA8A04',
    secondaryColor: '#1F2937',
    tintBg: 'rgba(202, 138, 4, 0.13)',
    toneClass: 'tone-warning',
    pattern: /پاسارگاد|pasargad/i,
    isBank: true,
  },
  {
    key: 'shahr',
    fullName: 'بانک شهر',
    shortName: 'شهر',
    primaryColor: '#E11D48',
    secondaryColor: '#FB7185',
    tintBg: 'rgba(225, 29, 72, 0.11)',
    toneClass: 'tone-expense',
    pattern: /شهر|shahr/i,
    isBank: true,
  },
  {
    key: 'ayandeh',
    fullName: 'بانک آینده',
    shortName: 'آینده',
    primaryColor: '#7C2D12',
    secondaryColor: '#D97706',
    tintBg: 'rgba(124, 45, 18, 0.12)',
    toneClass: 'tone-warning',
    pattern: /آینده|آينده|ayandeh/i,
    isBank: true,
  },
  {
    key: 'blu',
    fullName: 'بلوبانک',
    shortName: 'بلو',
    primaryColor: '#2563EB',
    secondaryColor: '#06B6D4',
    tintBg: 'rgba(37, 99, 235, 0.12)',
    toneClass: 'tone-info',
    pattern: /بلو|blu/i,
    isBank: true,
  },
  {
    key: 'pettyCash',
    fullName: 'تنخواه‌گردان',
    shortName: 'تنخواه',
    primaryColor: '#D97706',
    secondaryColor: '#F59E0B',
    tintBg: 'rgba(217, 119, 6, 0.13)',
    toneClass: 'tone-warning',
    pattern: /تنخواه|petty/i,
  },
  {
    key: 'cash',
    fullName: 'صندوق نقدی',
    shortName: 'صندوق',
    primaryColor: '#0D9488',
    secondaryColor: '#10B981',
    tintBg: 'rgba(13, 148, 136, 0.13)',
    toneClass: 'tone-income',
    pattern: /صندوق|نقد|خزانه|cash/i,
  },
];

export const IRANIAN_BANKS_ONLY = IRANIAN_BANK_CATALOG.filter((b) => b.isBank);

export const CASHBOX_PRESETS = [
  'صندوق اصلی فروشگاه',
  'صندوق مرکزی دفتر',
  'صندوق شعبه',
  'صندوق ریالی',
];

export const PETTY_CASH_PRESETS = [
  'تنخواه دفتر مرکزی',
  'تنخواه خرید و تدارکات',
  'تنخواه پروژه',
  'تنخواه حمل‌ونقل',
];

export const BANK_ACCOUNT_TITLES = [
  'حساب جاری',
  'قرض‌الحسنه',
  'سپرده کوتاه‌مدت',
  'حساب شرکتی',
];

export const TREASURY_TYPE_META: Record<
  TreasuryAccountType,
  {
    label: string;
    shortLabel: string;
    description: string;
    toneClass: string;
    gradientClass: string;
  }
> = {
  bank: {
    label: 'حساب بانکی',
    shortLabel: 'بانک',
    description: 'حساب‌های جاری، کارت‌خوان و بانکی',
    toneClass: 'tone-brand',
    gradientClass: 'from-[#0a3fa8] via-[#0d63f5] to-[#009fb7]',
  },
  cashbox: {
    label: 'صندوق نقدی',
    shortLabel: 'صندوق',
    description: 'وجوه نقد فروشگاه، دفتر و شعب',
    toneClass: 'tone-income',
    gradientClass: 'from-[#065f46] via-[#0d9488] to-[#10b981]',
  },
  pettyCash: {
    label: 'تنخواه‌گردان',
    shortLabel: 'تنخواه',
    description: 'تنخواه پرسنل، خرید و پروژه‌ها',
    toneClass: 'tone-warning',
    gradientClass: 'from-[#92400e] via-[#d97706] to-[#f59e0b]',
  },
};

const DEFAULT_META: BankBrandMeta = {
  key: 'default',
  fullName: 'حساب بانکی',
  shortName: 'بانک',
  primaryColor: '#1D63ED',
  secondaryColor: '#38BDF8',
  tintBg: 'rgba(29, 99, 237, 0.11)',
  toneClass: 'tone-brand',
  pattern: /.*/,
};

export function resolveTreasuryType(account: Pick<Account, 'name' | 'treasuryType'>): TreasuryAccountType {
  if (account.treasuryType === 'bank' || account.treasuryType === 'cashbox' || account.treasuryType === 'pettyCash') {
    return account.treasuryType;
  }
  const n = (account.name || '').trim();
  if (/تنخواه|petty/i.test(n)) return 'pettyCash';
  if (/صندوق|نقد|خزانه|cash/i.test(n)) return 'cashbox';
  return 'bank';
}

export function detectBankBrand(name: string, treasuryType?: TreasuryAccountType): BankBrandMeta {
  if (treasuryType === 'pettyCash') {
    return IRANIAN_BANK_CATALOG.find((b) => b.key === 'pettyCash') ?? DEFAULT_META;
  }
  if (treasuryType === 'cashbox') {
    return IRANIAN_BANK_CATALOG.find((b) => b.key === 'cash') ?? DEFAULT_META;
  }
  const n = (name || '').trim();
  if (!n) return DEFAULT_META;
  return IRANIAN_BANK_CATALOG.find((b) => b.pattern.test(n)) ?? DEFAULT_META;
}

export const bankTone = (name: string, treasuryType?: TreasuryAccountType) =>
  detectBankBrand(name, treasuryType).toneClass;

/** «بانک ملت» → «ملت» */
export const shortBankName = (name: string) => name.replace(/^بانک\s+/, '').trim() || name;

/** Mask account/card number cleanly like ****۱۳۲۴ */
export function maskAccountNumber(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return raw;
  return `•••• ${digits.slice(-4)}`;
}
