import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  Search,
  X,
} from 'lucide-react';
import LogoIcon from './LogoIcon';
import BrochureVisualPreview from './brochure/BrochureVisualPreview';
import {
  brochureSections,
  brochureTocGroups,
  filterBrochureSections,
  productBenefits,
  type BrochureGroupId,
  type BrochureSection,
  type BrochureSectionId,
} from './brochure/brochureSections';
import { APP_NAME } from '../constants';
import { toPersianDigits } from '../utils/formatters';
import { cn } from './ui';

interface HelpBrochureModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  initialSectionId?: string;
  isLoggedIn?: boolean;
}

const toneClasses: Record<BrochureSection['tone'], string> = {
  brand: 'bg-[color:var(--brand-soft)] text-[color:var(--brand)]',
  income: 'bg-[color:var(--income-soft)] text-[color:var(--income)]',
  expense: 'bg-[color:var(--expense-soft)] text-[color:var(--expense)]',
  info: 'bg-[color:var(--info-soft)] text-[color:var(--info)]',
  warning: 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]',
};

const sectionById = Object.fromEntries(brochureSections.map((s) => [s.id, s])) as Record<
  string,
  BrochureSection
>;

const HelpBrochureModal: React.FC<HelpBrochureModalProps> = ({
  isOpen,
  onClose,
  storeName = APP_NAME,
  initialSectionId,
  isLoggedIn = false,
}) => {
  const resolveStartId = (): BrochureSectionId =>
    initialSectionId && sectionById[initialSectionId]
      ? (initialSectionId as BrochureSectionId)
      : brochureSections[0].id;

  const [activeSection, setActiveSection] = useState<BrochureSectionId>(resolveStartId);
  const [mobileGroup, setMobileGroup] = useState<BrochureGroupId>(
    () => sectionById[resolveStartId()]?.group ?? brochureSections[0].group
  );
  const [query, setQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<BrochureSection | null>(null);

  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileRailRef = useRef<HTMLDivElement | null>(null);
  const mobileItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tocItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const ignoreSpyUntil = useRef(0);
  const expandedRef = useRef(expandedSection);
  expandedRef.current = expandedSection;

  const filteredSections = useMemo(() => filterBrochureSections(query), [query]);
  const isSearching = query.trim().length > 0;

  const mobileSections = useMemo(
    () => filteredSections.filter((s) => s.group === mobileGroup),
    [filteredSections, mobileGroup]
  );

  const requestClose = () => {
    if (expandedRef.current) {
      setExpandedSection(null);
      return;
    }
    onClose();
  };

  const scrollTo = (id: BrochureSectionId) => {
    const section = sectionById[id];
    if (section) setMobileGroup(section.group);
    setActiveSection(id);
    ignoreSpyUntil.current = Date.now() + 800;

    const root = mainScrollRef.current;
    const el = document.getElementById(`brochure-${id}`);
    if (!root || !el) return;

    const offset = window.matchMedia('(min-width: 1024px)').matches ? 80 : 180;
    const top =
      el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offset;
    root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen) {
      setExpandedSection(null);
      return;
    }

    const startId = resolveStartId();
    setQuery('');
    setActiveSection(startId);
    setMobileGroup(sectionById[startId]?.group ?? brochureSections[0].group);
    setExpandedSection(null);

    const frame = window.requestAnimationFrame(() => {
      if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
      closeBtnRef.current?.focus({ preventScroll: true });
      if (startId !== brochureSections[0].id) {
        window.setTimeout(() => scrollTo(startId), 80);
      }
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialSectionId]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (expandedRef.current) {
        setExpandedSection(null);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const section = sectionById[activeSection];
    if (section) setMobileGroup(section.group);
  }, [activeSection]);

  useEffect(() => {
    if (!isOpen) return;
    const root = mainScrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < ignoreSpyUntil.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target?.id) {
          const id = top.target.id.replace(/^brochure-/, '') as BrochureSectionId;
          if (sectionById[id]) setActiveSection(id);
        }
      },
      { root, rootMargin: '-18% 0px -58% 0px', threshold: [0.1, 0.3, 0.55] }
    );

    filteredSections.forEach((section) => {
      const el = document.getElementById(`brochure-${section.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isOpen, filteredSections]);

  useEffect(() => {
    const mobileBtn = mobileItemRefs.current[activeSection];
    const mobileRail = mobileRailRef.current;
    if (mobileRail && mobileBtn && mobileRail.offsetParent !== null) {
      const btnRect = mobileBtn.getBoundingClientRect();
      const railRect = mobileRail.getBoundingClientRect();
      const delta = btnRect.left + btnRect.width / 2 - (railRect.left + railRect.width / 2);
      mobileRail.scrollBy({ left: delta, behavior: 'smooth' });
    }

    const tocBtn = tocItemRefs.current[activeSection];
    if (tocBtn) {
      tocBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSection]);

  if (!isOpen) return null;

  const selectMobileGroup = (groupId: BrochureGroupId) => {
    setMobileGroup(groupId);
    const first = filteredSections.find((s) => s.group === groupId);
    if (first) scrollTo(first.id);
  };

  const activeMeta = sectionById[activeSection] ?? brochureSections[0];
  const ctaTitle = isLoggedIn ? 'آماده ادامه کار هستید؟' : 'آماده شروع کار با سامانه هستید؟';
  const ctaBody = isLoggedIn
    ? 'راهنما را ببندید و دقیقاً از همان صفحه‌ای که بودید ادامه دهید.'
    : 'راهنما را ببندید و وارد حساب کاربری خود شوید.';
  const ctaButton = isLoggedIn ? 'بازگشت به برنامه' : 'ورود به حساب کاربری';

  return (
    <div
      className="fixed inset-0 z-[300] flex overflow-hidden bg-[color:var(--surface-0)] animate-fade-in"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      data-blocking-modal="true"
      aria-labelledby="help-brochure-title"
    >
      {/* Desktop Deep Midnight Navy Sidebar TOC (mirrors AppLayout sidebar) */}
      <aside className="app-sidebar relative hidden w-72 shrink-0 flex-col border-e border-white/10 text-white lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a86ff] to-[#00b4d8] shadow-[0_8px_20px_rgba(13,99,245,0.38)]">
            <LogoIcon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-tight text-white">{storeName}</p>
            <p className="truncate text-[11px] font-medium text-sky-200/75">راهنمای جامع سامانه</p>
          </div>
        </div>

        {/* Zero-Overlap Flexbox Search Input in Sidebar */}
        <div className="px-4 pb-3 pt-4">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.07] px-3 transition focus-within:border-sky-400/60 focus-within:bg-white/[0.11]">
            <Search size={15} className="shrink-0 text-sky-200/75" aria-hidden />
            <input
              type="text"
              data-testid="guide-search-desktop"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجو در راهنما..."
              aria-label="جست‌وجو در راهنما"
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-300/65"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="پاک کردن جست‌وجو"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/12 hover:text-white"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Grouped TOC Navigation */}
        <nav
          aria-label="فهرست بخش‌های راهنما"
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-2"
        >
          {brochureTocGroups.map((group) => {
            const items = filteredSections.filter((s) => s.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="mb-1.5 px-2.5 text-[11px] font-bold text-sky-200/60">{group.label}</p>
                <ul className="space-y-1">
                  {items.map((section) => {
                    const isActive = activeSection === section.id;
                    const Icon = section.icon;
                    return (
                      <li key={section.id}>
                        <button
                          type="button"
                          ref={(el) => {
                            tocItemRefs.current[section.id] = el;
                          }}
                          onClick={() => scrollTo(section.id)}
                          aria-current={isActive ? 'true' : undefined}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-right text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60',
                            isActive
                              ? 'btn-brand-gradient text-white shadow-[0_8px_20px_rgba(13,99,245,0.38)]'
                              : 'text-slate-300/85 hover:bg-white/[0.07] hover:text-white'
                          )}
                        >
                          <Icon
                            size={15}
                            className={cn('shrink-0', isActive ? 'text-white' : 'text-sky-300/75')}
                            aria-hidden
                          />
                          <span className="truncate">{section.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Return Action */}
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={requestClose}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-xs font-extrabold text-white transition hover:bg-white/16"
          >
            <ArrowRight size={15} aria-hidden />
            <span>{ctaButton}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div
        ref={mainScrollRef}
        className="ambient-bg relative flex min-w-0 flex-1 flex-col overflow-y-auto"
      >
        {/* Top Sticky Header (Responsive for Mobile, Tablet & Desktop) */}
        <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--surface-elevated)] backdrop-blur-xl">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between gap-3 lg:h-16">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0d63f5] to-[#00b4d8] text-white lg:hidden">
                  <LogoIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <nav
                    aria-label="مسیر راهنما"
                    className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)]"
                  >
                    <span className="shrink-0">راهنمای سامانه</span>
                    <span aria-hidden>/</span>
                    <span className="truncate font-extrabold text-[color:var(--ink)]">
                      {activeMeta.title}
                    </span>
                  </nav>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs font-bold tabular-nums text-[color:var(--muted)] sm:inline">
                  {toPersianDigits(filteredSections.length)} بخش آموزشی
                </span>
                <button
                  ref={closeBtnRef}
                  type="button"
                  data-testid="guide-close-btn"
                  onClick={requestClose}
                  aria-label="بستن راهنما"
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] text-[color:var(--muted)] transition hover:border-[color:var(--expense)]/30 hover:bg-[color:var(--expense-soft)] hover:text-[color:var(--expense)]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Mobile & Tablet Search + Group Tabs + Section Strip */}
            <div className="space-y-2.5 pb-3 lg:hidden">
              <div className="flex h-10 items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 focus-within:border-[color:var(--brand)] focus-within:ring-2 focus-within:ring-[color:var(--brand-glow)]">
                <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                <input
                  type="text"
                  data-testid="guide-search-mobile"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="جست‌وجو در راهنما..."
                  aria-label="جست‌وجو در راهنما"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="پاک کردن جست‌وجو"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--surface-2)]"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>

              {!isSearching ? (
                <>
                  <div
                    role="tablist"
                    aria-label="دسته‌های راهنما"
                    className="grid grid-cols-3 gap-1 rounded-xl bg-[color:var(--surface-2)] p-1"
                  >
                    {brochureTocGroups.map((group) => {
                      const isActive = mobileGroup === group.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => selectMobileGroup(group.id)}
                          className={cn(
                            'h-8 truncate rounded-lg px-2 text-[11px] font-extrabold transition-colors',
                            isActive
                              ? 'bg-[color:var(--surface-solid)] text-[color:var(--brand)] shadow-xs'
                              : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                          )}
                        >
                          {group.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    ref={mobileRailRef}
                    className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5"
                  >
                    {mobileSections.map((section) => {
                      const isActive = activeSection === section.id;
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          ref={(el) => {
                            mobileItemRefs.current[section.id] = el;
                          }}
                          type="button"
                          onClick={() => scrollTo(section.id)}
                          className={cn(
                            'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[11px] font-extrabold transition',
                            isActive
                              ? 'btn-brand-gradient text-white'
                              : 'border border-[color:var(--line)] bg-[color:var(--surface-solid)] text-[color:var(--muted)]'
                          )}
                        >
                          <Icon size={13} aria-hidden />
                          <span>{section.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {/* Editorial Hero (Hidden While Actively Filtering) */}
          {!isSearching ? (
            <section className="mb-10 overflow-hidden rounded-[1.85rem] border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/92 shadow-[var(--shadow-md)]">
              <div className="grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.05fr] lg:p-10">
                <div>
                  <p className="text-xs font-extrabold text-[color:var(--brand)]">
                    راهنمای کامل کاربری
                  </p>
                  <h1
                    id="help-brochure-title"
                    className="mt-2 text-2xl font-black leading-[1.3] tracking-tight text-[color:var(--ink)] sm:text-3xl lg:text-[2.15rem]"
                  >
                    آشنایی کامل با {storeName}
                  </h1>
                  <p className="mt-3.5 max-w-lg text-sm leading-7 text-[color:var(--muted)]">
                    مسیر گام‌به‌گام ثبت درآمد و هزینه، مدیریت بانک‌ها و صندوق‌ها، انتقال بین
                    حساب‌ها، گزارش‌های ۴گانه مالی، تعریف کاربران پرسنلی و پشتیبان‌گیری خودکار.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => scrollTo('dashboard')}
                      className="btn-brand-gradient flex h-11 items-center gap-2 rounded-2xl px-5 text-xs font-extrabold text-white"
                    >
                      <span>شروع مطالعه بخش‌ها</span>
                      <ArrowDown size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={requestClose}
                      className="flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 px-5 text-xs font-extrabold text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/35 hover:text-[color:var(--brand)]"
                    >
                      <span>{ctaButton}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <BrochureVisualPreview
                    sectionId="dashboard"
                    caption="نمای پیشخوان مالی"
                    onExpand={() => setExpandedSection(brochureSections[0])}
                  />
                </div>
              </div>

              {/* Quiet 4-Column Product Highlights Strip */}
              <div className="grid grid-cols-1 divide-y divide-[color:var(--line)] border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/45 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
                {productBenefits.map((benefit, idx) => (
                  <div
                    key={benefit.title}
                    className={cn(
                      'px-5 py-4',
                      idx > 0 && 'lg:border-s lg:border-[color:var(--line)]',
                      idx % 2 === 1 && 'sm:border-s sm:border-[color:var(--line)] lg:border-s',
                      idx >= 2 && 'sm:border-t sm:border-[color:var(--line)] lg:border-t-0'
                    )}
                  >
                    <p className="text-xs font-extrabold text-[color:var(--ink)]">{benefit.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted)]">
                      {benefit.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Sections List or Empty Search State */}
          {filteredSections.length === 0 ? (
            <div className="rounded-[1.75rem] border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/92 px-6 py-14 text-center shadow-[var(--shadow-sm)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                <Search size={20} />
              </div>
              <h2 className="mt-4 text-base font-black text-[color:var(--ink)]">
                موردی برای «{query}» پیدا نشد
              </h2>
              <p className="mt-1.5 text-xs text-[color:var(--muted)]">
                واژه دیگری مانند «انتقال»، «تراز»، «بکاپ» یا «دسترسی» را جست‌وجو کنید.
              </p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--brand-soft)] px-4 text-xs font-extrabold text-[color:var(--brand)] transition hover:bg-[color:var(--brand)] hover:text-white"
              >
                پاک کردن جست‌وجو
              </button>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {filteredSections.map((section, idx) => {
                const Icon = section.icon;
                const chapterNum = toPersianDigits(String(idx + 1).padStart(2, '0'));
                return (
                  <article
                    id={`brochure-${section.id}`}
                    key={section.id}
                    className="scroll-mt-44 rounded-[1.75rem] border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/92 p-5 shadow-[var(--shadow-sm)] sm:p-7 lg:scroll-mt-24 lg:p-8"
                  >
                    <div
                      className={cn(
                        'grid items-center gap-7 lg:grid-cols-2 lg:gap-10',
                        idx % 2 === 1 && 'lg:[&>*:first-child]:order-2'
                      )}
                    >
                      {/* Live Theme-Aware Visual Preview */}
                      <BrochureVisualPreview
                        sectionId={section.id}
                        caption={section.title}
                        onExpand={() => setExpandedSection(section)}
                      />

                      {/* Editorial Guide Copy */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                              toneClasses[section.tone]
                            )}
                          >
                            <Icon size={20} aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-[color:var(--brand)]">
                              فصل {chapterNum} · {section.eyebrow}
                            </p>
                            <h2 className="mt-0.5 text-xl font-black tracking-tight text-[color:var(--ink)] sm:text-2xl">
                              {section.title}
                            </h2>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
                          {section.description}
                        </p>

                        {/* Clean Unboxed Metadata Highlights */}
                        <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-extrabold text-[color:var(--ink)]">
                          {section.highlights.map((item, i) => (
                            <React.Fragment key={item}>
                              {i > 0 ? (
                                <span className="text-[color:var(--muted)]/50" aria-hidden>
                                  ·
                                </span>
                              ) : null}
                              <span>{item}</span>
                            </React.Fragment>
                          ))}
                        </div>

                        {/* Clean Details List with Subtle Hairline Dividers */}
                        <ul className="mt-5 divide-y divide-[color:var(--line)] border-t border-[color:var(--line)]">
                          {section.details.map((detail) => (
                            <li
                              key={detail}
                              className="flex items-start gap-2.5 py-2.5 text-[13px] leading-6 text-[color:var(--muted)]"
                            >
                              <span
                                className={cn(
                                  'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                                  toneClasses[section.tone]
                                )}
                              >
                                <Check size={12} strokeWidth={2.5} aria-hidden />
                              </span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Closing CTA Card */}
          <section className="app-sidebar relative mt-10 overflow-hidden rounded-[1.85rem] px-6 py-10 text-center text-white sm:px-10">
            <div className="relative z-10 mx-auto max-w-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a86ff] to-[#00b4d8] shadow-[0_10px_24px_rgba(13,99,245,0.42)]">
                <BookOpen size={21} />
              </div>
              <h2 className="mt-4 text-xl font-black tracking-tight sm:text-2xl">{ctaTitle}</h2>
              <p className="mt-2 text-xs leading-6 text-slate-300/90 sm:text-sm">{ctaBody}</p>
              <button
                type="button"
                onClick={requestClose}
                className="btn-brand-gradient mt-6 inline-flex h-11 items-center gap-2 rounded-2xl px-7 text-xs font-extrabold text-white"
              >
                <span>{ctaButton}</span>
              </button>
            </div>
          </section>
        </main>
      </div>

      {/* Magnified Live Preview Modal */}
      {expandedSection ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`بزرگ‌نمایی ${expandedSection.title}`}
          onClick={() => setExpandedSection(null)}
        >
          <div
            className="w-full max-w-2xl animate-scale-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between text-white">
              <div>
                <p className="text-sm font-black">{expandedSection.title}</p>
                <p className="text-xs text-slate-300">{expandedSection.eyebrow}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedSection(null)}
                aria-label="بستن بزرگ‌نمایی"
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-white transition hover:bg-white/22"
              >
                <X size={18} />
              </button>
            </div>
            <BrochureVisualPreview
              sectionId={expandedSection.id}
              caption={expandedSection.title}
              expanded
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HelpBrochureModal;
