import React from 'react';
import { ArrowLeft, Check, Landmark, ShieldCheck, TrendingUp } from 'lucide-react';
import { APP_NAME } from '../../constants';
import LogoIcon from '../LogoIcon';
import { BankLogo } from '../ui/BankLogo';

interface LoginHeroProps {
  onOpenGuide: () => void;
}

const KEY_CAPABILITIES = [
  'ثبت سریع درآمد، هزینه و انتقال بین حساب‌ها با تقویم شمسی دقیق',
  'گزارش‌های دفتر کل، تراز آزمایشی، سود و زیان و خروجی Excel / PDF',
  'مدیریت چندکاربره با ماتریس مجوز و پشتیبان‌گیری خودکار امن',
];

const LoginHero: React.FC<LoginHeroProps> = ({ onOpenGuide }) => (
  <section
    aria-label="معرفی سامانه"
    className="app-sidebar relative flex flex-col justify-between overflow-hidden p-7 text-white sm:p-9 lg:p-11"
  >
    {/* Subtle luminous ambient wave matching the redesigned app sidebar */}
    <svg
      aria-hidden
      viewBox="0 0 480 220"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full opacity-40"
    >
      <defs>
        <linearGradient id="login-navy-wave" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor="#0d63f5" stopOpacity="0.48" />
          <stop offset="55%" stopColor="#12b6d8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0d63f5" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 150 Q120 75 240 132 T480 96 L480 220 L0 220 Z"
        fill="url(#login-navy-wave)"
      />
      <path
        d="M0 175 Q140 120 280 165 T480 130"
        fill="none"
        stroke="rgba(125, 211, 252, 0.34)"
        strokeWidth="1.5"
      />
    </svg>

    <div className="relative z-10">
      {/* Brand Lockup */}
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a86ff] to-[#00b4d8] shadow-[0_10px_24px_rgba(13,99,245,0.42)]">
          <LogoIcon className="h-7 w-7 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-tight text-white">{APP_NAME}</p>
          <p className="text-xs font-medium text-sky-200/80">
            سامانه یکپارچه حسابداری و خزانه‌داری
          </p>
        </div>
      </div>

      {/* Editorial Headline */}
      <div className="mt-8 lg:mt-10">
        <h2 className="text-2xl font-black leading-[1.35] tracking-tight text-white sm:text-[1.75rem] lg:text-[2rem]">
          شفافیت کامل در جریان نقدی و حساب‌های کسب‌وکار
        </h2>
        <p className="mt-3 max-w-md text-sm leading-7 text-slate-300/90">
          تمامی بانک‌ها، صندوق‌ها، درآمدها، هزینه‌ها و گزارش‌های مالی را در یک محیط سریع، فارسی و
          امن مدیریت کنید.
        </p>
      </div>

      {/* Live Miniature Financial Preview (Desktop & Tablet) */}
      <div className="mt-7 hidden sm:block">
        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-sky-200/80">نمای خلاصه خزانه</p>
              <p className="mt-1 text-xl font-black tabular-nums tracking-tight text-white">
                ۱۲۸,۵۰۰,۰۰۰{' '}
                <span className="text-xs font-semibold text-sky-200/75">تومان</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <BankLogo name="بانک سامان" treasuryType="bank" size="sm" className="h-8 w-8 rounded-xl ring-1 ring-white/15" />
              <BankLogo name="بانک ملت" treasuryType="bank" size="sm" className="h-8 w-8 rounded-xl ring-1 ring-white/15" />
              <BankLogo name="صندوق اصلی" treasuryType="cashbox" size="sm" className="h-8 w-8 rounded-xl ring-1 ring-white/15" />
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-300">
              <TrendingUp size={13} className="shrink-0" />
              <span className="truncate font-bold">درآمد و فروش</span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-200">
              <Landmark size={13} className="shrink-0" />
              <span className="truncate font-bold">بانک و صندوق</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <ShieldCheck size={13} className="shrink-0" />
              <span className="truncate font-bold">بکاپ خودکار</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Capabilities List (Desktop) */}
      <ul className="mt-7 hidden space-y-2.5 lg:block">
        {KEY_CAPABILITIES.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-200/90">
            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-sky-400/18 text-sky-300">
              <Check size={12} strokeWidth={2.75} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>

    {/* Bottom Guide Action (Desktop & Tablet) */}
    <div className="relative z-10 mt-8 hidden items-center justify-between gap-3 border-t border-white/10 pt-5 sm:flex">
      <p className="text-xs text-slate-300/80">آشنایی سریع با تمام امکانات سامانه</p>
      <button
        type="button"
        onClick={onOpenGuide}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
      >
        <span>مشاهده راهنمای کامل</span>
        <ArrowLeft size={14} />
      </button>
    </div>
  </section>
);

export default LoginHero;
