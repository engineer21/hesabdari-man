import React from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderTree,
  HardDrive,
  Landmark,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  ZoomIn,
} from 'lucide-react';
import { BankLogo } from '../ui/BankLogo';
import { cn } from '../ui';
import type { BrochureSectionId } from './brochureSections';

interface BrochureVisualPreviewProps {
  sectionId: BrochureSectionId;
  caption: string;
  expanded?: boolean;
  onExpand?: () => void;
  className?: string;
}

const WindowFrame: React.FC<{
  caption: string;
  badge?: string;
  children: React.ReactNode;
}> = ({ caption, badge, children }) => (
  <div className="overflow-hidden rounded-[1.4rem] border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)] shadow-[var(--shadow-md)]">
    <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/75 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
      </div>
      <span className="truncate text-[11px] font-extrabold text-[color:var(--ink)]">{caption}</span>
      {badge ? (
        <span className="shrink-0 text-[10px] font-bold text-[color:var(--muted)]">{badge}</span>
      ) : (
        <span className="w-8 shrink-0" aria-hidden />
      )}
    </div>
    <div className="ambient-bg p-3.5 sm:p-4">{children}</div>
  </div>
);

function PreviewBody({ sectionId }: { sectionId: BrochureSectionId }) {
  switch (sectionId) {
    case 'dashboard':
      return (
        <div className="space-y-3 text-right">
          <div className="balance-gradient relative overflow-hidden rounded-2xl p-4 text-white">
            <svg
              aria-hidden
              viewBox="0 0 360 110"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
            >
              <path
                d="M0 78 Q90 38 190 66 T360 28 L360 110 L0 110 Z"
                fill="rgba(56, 224, 240, 0.35)"
              />
            </svg>
            <div className="relative flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-white/80">موجودی کل خزانه</p>
                <p className="mt-1 text-xl font-black tabular-nums sm:text-2xl">۱۲۸,۵۰۰,۰۰۰</p>
                <p className="mt-0.5 text-[10px] font-medium text-white/75">تومان · ۳ حساب فعال</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Wallet size={17} />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="kpi-income-card rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[color:var(--muted)]">درآمد این ماه</span>
                <TrendingUp size={14} className="text-[color:var(--income)]" />
              </div>
              <p className="mt-1.5 text-sm font-black tabular-nums text-[color:var(--income)] sm:text-base">
                ۱۸۶,۰۰۰,۰۰۰
              </p>
            </div>
            <div className="kpi-expense-card rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[color:var(--muted)]">هزینه این ماه</span>
                <TrendingDown size={14} className="text-[color:var(--expense)]" />
              </div>
              <p className="mt-1.5 text-sm font-black tabular-nums text-[color:var(--expense)] sm:text-base">
                ۵۷,۵۰۰,۰۰۰
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/90 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[color:var(--muted)]">
              <span>روند جریان نقدی</span>
              <span className="text-[color:var(--brand)]">آذر ۱۴۰۵</span>
            </div>
            <svg viewBox="0 0 280 54" className="h-12 w-full" aria-hidden>
              <defs>
                <linearGradient id="guide-cf-in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--income)" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="var(--income)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M6 42 C52 38, 86 24, 138 28 C186 32, 224 12, 274 10 L274 52 L6 52 Z"
                fill="url(#guide-cf-in)"
              />
              <path
                d="M6 42 C52 38, 86 24, 138 28 C186 32, 224 12, 274 10"
                fill="none"
                stroke="var(--income)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M6 46 C56 44, 96 36, 146 40 C196 42, 232 30, 274 28"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      );

    case 'income':
      return (
        <div className="space-y-2.5 text-right">
          <div className="kpi-income-card flex items-center justify-between rounded-2xl p-3.5">
            <div>
              <p className="text-[11px] font-bold text-[color:var(--muted)]">مجموع درآمد آذر ۱۴۰۵</p>
              <p className="mt-1 text-lg font-black tabular-nums text-[color:var(--income)]">
                +۱۸,۵۰۰,۰۰۰ <span className="text-[11px] font-bold">تومان</span>
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--income-soft)] text-[color:var(--income)]">
              <TrendingUp size={18} />
            </span>
          </div>

          <div className="divide-y divide-[color:var(--line)] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92">
            {[
              { title: 'فروش خدمات مشاوره', bank: 'بانک سامان', date: '۱۴۰۵/۰۹/۰۲', amt: '+۱۸,۵۰۰,۰۰۰' },
              { title: 'تسویه فاکتور شرکت سپهر', bank: 'بانک ملت', date: '۱۴۰۵/۰۸/۲۸', amt: '+۱۲,۴۰۰,۰۰۰' },
              { title: 'فروش مستقیم فروشگاه', bank: 'صندوق اصلی', date: '۱۴۰۵/۰۸/۲۵', amt: '+۶,۲۰۰,۰۰۰' },
            ].map((row) => (
              <div key={row.title} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <BankLogo
                    name={row.bank}
                    treasuryType={row.bank.includes('صندوق') ? 'cashbox' : 'bank'}
                    size="sm"
                    className="h-7 w-7 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">{row.title}</p>
                    <p className="text-[10px] text-[color:var(--muted)]">
                      {row.bank} · {row.date}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-black tabular-nums text-[color:var(--income)]">
                  {row.amt}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'expense':
      return (
        <div className="space-y-2.5 text-right">
          <div className="kpi-expense-card flex items-center justify-between rounded-2xl p-3.5">
            <div>
              <p className="text-[11px] font-bold text-[color:var(--muted)]">مجموع هزینه‌های آذر ۱۴۰۵</p>
              <p className="mt-1 text-lg font-black tabular-nums text-[color:var(--expense)]">
                -۶,۲۰۰,۰۰۰ <span className="text-[11px] font-bold">تومان</span>
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--expense-soft)] text-[color:var(--expense)]">
              <TrendingDown size={18} />
            </span>
          </div>

          <div className="divide-y divide-[color:var(--line)] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92">
            {[
              { title: 'اجاره دفتر و قبوض', cat: 'هزینه‌های اداری', bank: 'بانک ملت', amt: '-۶,۲۰۰,۰۰۰' },
              { title: 'خرید ملزومات مصرفی', cat: 'خرید کالا', bank: 'بانک سامان', amt: '-۲,۸۵۰,۰۰۰' },
              { title: 'حمل و ارسال سفارش', cat: 'توزیع و حمل', bank: 'صندوق اصلی', amt: '-۹۴۰,۰۰۰' },
            ].map((row) => (
              <div key={row.title} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">{row.title}</p>
                  <p className="text-[10px] text-[color:var(--muted)]">
                    {row.cat} · {row.bank}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-black tabular-nums text-[color:var(--expense)]">
                  {row.amt}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'transfers':
      return (
        <div className="space-y-2.5 text-right">
          <div className="balance-gradient flex items-center justify-between rounded-2xl p-3.5 text-white">
            <div>
              <p className="text-[11px] font-semibold text-white/80">انتقال‌های ثبت‌شده دوره</p>
              <p className="mt-1 text-lg font-black tabular-nums">۱۵,۰۰۰,۰۰۰ تومان</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <ArrowLeftRight size={18} />
            </span>
          </div>

          <div className="space-y-2">
            {[
              { from: 'بانک سامان', to: 'صندوق اصلی فروشگاه', fromType: 'bank' as const, toType: 'cashbox' as const, amt: '۱۵,۰۰۰,۰۰۰', note: 'تامین نقدینگی صندوق' },
              { from: 'بانک ملت', to: 'تنخواه دفتر مرکزی', fromType: 'bank' as const, toType: 'pettyCash' as const, amt: '۴,۵۰۰,۰۰۰', note: 'شارژ تنخواه ماهانه' },
            ].map((t) => (
              <div
                key={t.note}
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold text-[color:var(--ink)]">
                    <BankLogo name={t.from} treasuryType={t.fromType} size="sm" className="h-6 w-6 rounded-lg" />
                    <span className="truncate">{t.from}</span>
                    <span className="text-[color:var(--brand)]">←</span>
                    <BankLogo name={t.to} treasuryType={t.toType} size="sm" className="h-6 w-6 rounded-lg" />
                    <span className="truncate">{t.to}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-[color:var(--muted)]">{t.note}</span>
                  <span className="font-black tabular-nums text-[color:var(--brand)]">{t.amt} تومان</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'banks':
      return (
        <div className="grid grid-cols-1 gap-2.5 text-right sm:grid-cols-2">
          {[
            { name: 'بانک سامان', sub: 'حساب جاری شرکت', type: 'bank' as const, bal: '۷۲,۰۰۰,۰۰۰', num: '•••• ۱۹۸۴' },
            { name: 'بانک ملت', sub: 'حساب فروش', type: 'bank' as const, bal: '۴۶,۵۰۰,۰۰۰', num: '•••• ۴۳۲۱' },
            { name: 'صندوق اصلی', sub: 'شعبه مرکزی', type: 'cashbox' as const, bal: '۱۰,۰۰۰,۰۰۰', num: 'نقدی' },
            { name: 'تنخواه دفتر', sub: 'مسئول اداری', type: 'pettyCash' as const, bal: '۳,۲۰۰,۰۰۰', num: 'تنخواه' },
          ].map((acc) => (
            <div
              key={acc.name}
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 p-3"
            >
              <div className="flex items-center gap-2">
                <BankLogo name={acc.name} treasuryType={acc.type} size="sm" className="h-8 w-8 shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">{acc.name}</p>
                  <p className="truncate text-[10px] text-[color:var(--muted)]">{acc.sub}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between border-t border-[color:var(--line)] pt-2">
                <span className="text-[10px] text-[color:var(--muted)] tabular-nums">{acc.num}</span>
                <span className="text-xs font-black tabular-nums text-[color:var(--ink)]">{acc.bal}</span>
              </div>
            </div>
          ))}
        </div>
      );

    case 'persons':
      return (
        <div className="divide-y divide-[color:var(--line)] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 text-right">
          {[
            { name: 'شرکت بازرگانی سپهر', group: 'مشتریان ویژه', net: '+۱۸,۵۰۰,۰۰۰', positive: true },
            { name: 'آقای حسن جواهری', group: 'تأمین‌کنندگان', net: '-۷,۲۰۰,۰۰۰', positive: false },
            { name: 'گروه صنعتی پارس', group: 'شرکا و پیمانکاران', net: '+۱۲,۰۰۰,۰۰۰', positive: true },
          ].map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-2.5 px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-soft)] text-xs font-black text-[color:var(--brand)]">
                  {p.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">{p.name}</p>
                  <p className="text-[10px] text-[color:var(--muted)]">{p.group}</p>
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 text-xs font-black tabular-nums',
                  p.positive ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
                )}
              >
                {p.net}
              </span>
            </div>
          ))}
        </div>
      );

    case 'chartOfAccounts':
      return (
        <div className="space-y-2.5 text-right">
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 p-3.5">
            <div className="flex items-center gap-2 text-xs font-black text-[color:var(--income)]">
              <FolderTree size={14} />
              <span>سرفصل‌های درآمد</span>
            </div>
            <div className="mt-2 space-y-1.5 pr-4 text-[11px] font-bold text-[color:var(--ink)]">
              <div className="flex justify-between">
                <span>فروش خدمات و مشاوره</span>
                <span className="tabular-nums text-[color:var(--income)]">۱۸,۵۰۰,۰۰۰</span>
              </div>
              <div className="flex justify-between">
                <span>فروش کالا و محصولات</span>
                <span className="tabular-nums text-[color:var(--income)]">۲۴,۰۰۰,۰۰۰</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 p-3.5">
            <div className="flex items-center gap-2 text-xs font-black text-[color:var(--expense)]">
              <FolderTree size={14} />
              <span>سرفصل‌های هزینه</span>
            </div>
            <div className="mt-2 space-y-1.5 pr-4 text-[11px] font-bold text-[color:var(--ink)]">
              <div className="flex justify-between">
                <span>اجاره و هزینه‌های اداری</span>
                <span className="tabular-nums text-[color:var(--expense)]">۶,۲۰۰,۰۰۰</span>
              </div>
              <div className="flex justify-between">
                <span>خرید مواد و ملزومات</span>
                <span className="tabular-nums text-[color:var(--expense)]">۴,۹۰۰,۰۰۰</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'reports':
      return (
        <div className="space-y-2.5 text-right">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'دفتر کل سرفصل‌ها', icon: Landmark },
              { label: 'تراز آزمایشی و سود و زیان', icon: FileSpreadsheet },
              { label: 'عملکرد و تراز اشخاص', icon: Users },
              { label: 'گردش خزانه و بانک‌ها', icon: Wallet },
            ].map((r) => {
              const RIcon = r.icon;
              return (
                <div
                  key={r.label}
                  className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 px-2.5 py-2.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                    <RIcon size={14} />
                  </span>
                  <span className="truncate text-[11px] font-extrabold text-[color:var(--ink)]">{r.label}</span>
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 p-3">
            <div className="grid grid-cols-3 border-b border-[color:var(--line)] pb-1.5 text-[10px] font-bold text-[color:var(--muted)]">
              <span>سرفصل</span>
              <span className="text-center">گردش</span>
              <span className="text-left">مانده</span>
            </div>
            <div className="mt-2 space-y-1.5 text-[11px] font-bold tabular-nums">
              <div className="grid grid-cols-3">
                <span className="truncate text-[color:var(--ink)]">درآمد عملیاتی</span>
                <span className="text-center text-[color:var(--muted)]">۴۲,۵۰۰,۰۰۰</span>
                <span className="text-left text-[color:var(--income)]">+۴۲,۵۰۰,۰۰۰</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="truncate text-[color:var(--ink)]">هزینه‌های اداری</span>
                <span className="text-center text-[color:var(--muted)]">۱۱,۱۰۰,۰۰۰</span>
                <span className="text-left text-[color:var(--expense)]">-۱۱,۱۰۰,۰۰۰</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'access':
      return (
        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 p-3.5 text-right">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-xs font-extrabold text-[color:var(--ink)]">گروه‌های دسترسی</p>
                <p className="text-[10px] text-[color:var(--muted)]">ماتریس مجوز ماژول‌به‌ماژول</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { role: 'مالک سیستم', perms: 'دسترسی کامل به تمامی بخش‌ها و بکاپ', active: true },
              { role: 'حسابدار', perms: 'درآمد، هزینه، انتقال، اشخاص و گزارش‌ها', active: true },
              { role: 'صندوقدار', perms: 'ثبت روزانه دریافت و پرداخت', active: true },
            ].map((item) => (
              <div
                key={item.role}
                className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[color:var(--ink)]">{item.role}</p>
                  <p className="truncate text-[10px] text-[color:var(--muted)]">{item.perms}</p>
                </div>
                <CheckCircle2 size={15} className="shrink-0 text-[color:var(--income)]" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'backup':
      return (
        <div className="space-y-2.5 text-right">
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--income-soft)] text-[color:var(--income)]">
                  <HardDrive size={17} />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-[color:var(--ink)]">بکاپ خودکار فعال</p>
                  <p className="text-[10px] text-[color:var(--muted)]">ذخیره امن دیتابیس و پیوست‌ها</p>
                </div>
              </div>
              <span className="text-[11px] font-extrabold text-[color:var(--income)]">فعال</span>
            </div>
          </div>
          <div className="divide-y divide-[color:var(--line)] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/92">
            {[
              { name: 'نسخه خودکار · ۱۴۰۵/۰۹/۰۲', size: '۱.۴ مگابایت' },
              { name: 'نسخه ایمنی پیش از بازیابی', size: '۱.۳ مگابایت' },
            ].map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[color:var(--ink)]">{b.name}</p>
                  <p className="text-[10px] text-[color:var(--muted)]">{b.size}</p>
                </div>
                <Download size={14} className="shrink-0 text-[color:var(--brand)]" />
              </div>
            ))}
          </div>
        </div>
      );
  }
}

export const BrochureVisualPreview: React.FC<BrochureVisualPreviewProps> = ({
  sectionId,
  caption,
  expanded = false,
  onExpand,
  className,
}) => {
  const frame = (
    <WindowFrame caption={caption} badge={expanded ? 'نمای بزرگ‌نمایی‌شده' : 'نمای زنده رابط کاربری'}>
      <PreviewBody sectionId={sectionId} />
    </WindowFrame>
  );

  if (onExpand && !expanded) {
    return (
      <button
        type="button"
        onClick={onExpand}
        aria-label={`بزرگ‌نمایی نمای ${caption}`}
        className={cn(
          'group relative block w-full text-right transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]/40 rounded-[1.4rem]',
          className
        )}
      >
        {frame}
        <span className="pointer-events-none absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950/65 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
          <ZoomIn size={15} />
        </span>
      </button>
    );
  }

  return <div className={cn('w-full', className)}>{frame}</div>;
};

export default BrochureVisualPreview;
