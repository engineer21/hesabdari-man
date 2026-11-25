import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  FileText,
  Package,
  PackagePlus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { Invoice, InvoiceKind, Product } from '../../types';
import {
  extractProductCategories,
  filterAndRankProducts,
} from '../../utils/invoiceSearch';
import { formatNumberWithCommas, toPersianDigits } from '../../utils/formatters';
import { cn } from '../ui';

export interface ProductSearchPickerProps {
  products: Product[];
  invoicesExcludingSelf: Invoice[];
  kind: InvoiceKind;
  warehouseId?: string;
  productId: string;
  productName: string;
  currentQuantity?: number;
  availableStock?: number | null;
  onSelectProduct: (product: Product) => void;
  onSelectCustomText: (text: string) => void;
  onClear?: () => void;
  onQuickCreateProduct?: (prefillName: string) => void;
  variant?: 'cell' | 'field';
  /** Render popover inside local relative container (required inside Radix Dialog/FormSheet so focus-trap & pointer-events work cleanly) */
  inlineDropdown?: boolean;
  placeholder?: string;
  testId?: string;
  ariaLabel?: string;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const ProductSearchPicker: React.FC<ProductSearchPickerProps> = ({
  products,
  invoicesExcludingSelf,
  kind,
  warehouseId,
  productId,
  productName,
  currentQuantity = 0,
  availableStock = null,
  onSelectProduct,
  onSelectCustomText,
  onClear,
  onQuickCreateProduct,
  variant = 'field',
  inlineDropdown = false,
  placeholder = 'جست‌وجو یا انتخاب کالا / خدمت...',
  testId,
  ariaLabel = 'انتخاب کالا یا شرح ردیف',
  buttonRef,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openAbove: boolean;
    maxHeight: number;
  } | null>(null);

  const triggerElRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const selectedProduct = useMemo(
    () => (productId ? products.find((p) => p.id === productId) : undefined),
    [products, productId]
  );

  const categories = useMemo(() => extractProductCategories(products), [products]);

  const rankedMatches = useMemo(
    () =>
      filterAndRankProducts(products, query, {
        kind,
        warehouseId,
        invoices: invoicesExcludingSelf,
        category: activeCategory || undefined,
      }),
    [products, query, kind, warehouseId, invoicesExcludingSelf, activeCategory]
  );

  const trimmedQuery = query.trim();
  const hasExactCatalogMatch = useMemo(
    () =>
      Boolean(
        trimmedQuery &&
          rankedMatches.some(
            (m) => m.product.name.trim().toLowerCase() === trimmedQuery.toLowerCase()
          )
      ),
    [rankedMatches, trimmedQuery]
  );

  // Sync activeIndex when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, activeCategory, open]);

  // Measure viewport & anchor position when opening (only needed for portal mode)
  useLayoutEffect(() => {
    if (!open || inlineDropdown) return;

    const updatePosition = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw < 640) {
        setIsMobileSheet(true);
        setCoords(null);
        return;
      }
      setIsMobileSheet(false);
      const el = triggerElRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const desiredWidth = Math.min(Math.max(rect.width, 390), Math.min(460, vw - 24));
      // Right-aligned in RTL so dropdown stays directly under trigger's right edge
      let left = rect.right - desiredWidth;
      if (left < 12) left = 12;
      if (left + desiredWidth > vw - 12) left = Math.max(12, vw - desiredWidth - 12);

      const spaceBelow = vh - rect.bottom - 16;
      const spaceAbove = rect.top - 16;
      const openAbove = spaceBelow < 290 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(400, Math.max(220, openAbove ? spaceAbove : spaceBelow));
      const top = openAbove ? rect.top - 6 : rect.bottom + 6;

      setCoords({ top, left, width: desiredWidth, openAbove, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, inlineDropdown]);

  // Focus search input when opened
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);
    return () => window.clearTimeout(id);
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerElRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerElRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleOpen = () => {
    setQuery(!productId && productName ? productName : '');
    setActiveCategory('');
    setOpen(true);
  };

  const handlePickProduct = (product: Product) => {
    onSelectProduct(product);
    setOpen(false);
    setQuery('');
  };

  const handlePickCustom = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    onSelectCustomText(clean);
    setOpen(false);
    setQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const showCustomRow = Boolean(trimmedQuery && !hasExactCatalogMatch);
    const totalOptions = rankedMatches.length + (showCustomRow ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalOptions > 0) {
        setActiveIndex((prev) => (prev + 1) % totalOptions);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalOptions > 0) {
        setActiveIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex < rankedMatches.length && rankedMatches[activeIndex]) {
        handlePickProduct(rankedMatches[activeIndex].product);
      } else if (showCustomRow) {
        handlePickCustom(trimmedQuery);
      } else if (trimmedQuery) {
        handlePickCustom(trimmedQuery);
      }
    }
  };

  const isOverstock =
    kind === 'sale' && availableStock !== null && currentQuantity > availableStock;

  const hasValue = Boolean(selectedProduct || productName.trim());

  const panelBody = (
    <>
      {/* Sticky Search Header */}
      <div className="border-b border-[color:var(--line)] p-2.5 sm:p-3">
        <div className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 px-3 py-2 focus-within:border-[color:var(--brand)] focus-within:bg-[color:var(--surface-solid)] focus-within:ring-2 focus-within:ring-[color:var(--brand-glow)]">
          <Search size={15} className="shrink-0 text-[color:var(--brand)]" aria-hidden />
          <input
            ref={searchInputRef}
            type="text"
            data-testid="product-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="نام کالا، کد (SKU)، دسته‌بندی یا شرح آزاد..."
            className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)] sm:text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label="پاک کردن جست‌وجو"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>

        {/* Category Filter Tabs (only shown if >= 2 categories exist) */}
        {categories.length >= 2 ? (
          <div className="no-scrollbar mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory('')}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold transition',
                !activeCategory
                  ? 'bg-[color:var(--brand)] text-white'
                  : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]'
              )}
            >
              همه ({toPersianDigits(String(products.filter((p) => p.isActive).length))})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold transition',
                  activeCategory === cat
                    ? 'bg-[color:var(--brand)] text-white'
                    : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Results List */}
      <div
        className={cn(
          'nice-scroll flex-1 overflow-y-auto divide-y divide-[color:var(--line)]/60',
          inlineDropdown && 'max-h-[240px]'
        )}
        data-testid="product-search-results"
      >
        {rankedMatches.map((match, idx) => {
          const { product, availableStock: stock, suggestedPrice } = match;
          const isSelected = product.id === productId;
          const isHighlighted = idx === activeIndex;
          const lowStock = stock !== null && stock <= (product.minStock ?? 0);

          return (
            <button
              key={product.id}
              type="button"
              data-testid={`product-search-option-${product.id}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => handlePickProduct(product)}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-right transition',
                isHighlighted
                  ? 'bg-[color:var(--brand-soft)]/70'
                  : 'hover:bg-[color:var(--surface-2)]/60',
                isSelected && 'bg-[color:var(--brand-soft)]/45'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-extrabold text-[color:var(--ink)] sm:text-[13px]">
                    {product.name}
                  </span>
                  {isSelected ? (
                    <Check size={14} className="shrink-0 text-[color:var(--brand)]" />
                  ) : null}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-[color:var(--muted)]">
                  <span className="font-bold tabular-nums">#{toPersianDigits(product.code)}</span>
                  <span>·</span>
                  <span>{product.unit}</span>
                  {product.category ? (
                    <>
                      <span>·</span>
                      <span>{product.category}</span>
                    </>
                  ) : null}
                  {product.kind === 'service' ? (
                    <>
                      <span>·</span>
                      <span className="text-[color:var(--brand)]">خدمت</span>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="shrink-0 text-left">
                <p className="text-xs font-black tabular-nums text-[color:var(--ink)]">
                  {suggestedPrice > 0 ? (
                    <>
                      {money(suggestedPrice)}{' '}
                      <span className="text-[10px] font-semibold text-[color:var(--muted)]">
                        تومان
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-[color:var(--muted)]">بدون نرخ</span>
                  )}
                </p>
                {stock !== null ? (
                  <p
                    className={cn(
                      'mt-0.5 text-[10.5px] font-bold tabular-nums',
                      stock <= 0
                        ? 'text-[color:var(--expense)]'
                        : lowStock
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[color:var(--income)]'
                    )}
                  >
                    موجودی: {toPersianDigits(formatNumberWithCommas(stock))} {product.unit}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[10.5px] font-medium text-[color:var(--muted)]">
                    غیرانباری
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* Custom Free-Text Row when user typed a non-exact query */}
        {trimmedQuery && !hasExactCatalogMatch ? (
          <button
            type="button"
            data-testid="product-search-custom-option"
            onMouseEnter={() => setActiveIndex(rankedMatches.length)}
            onClick={() => handlePickCustom(trimmedQuery)}
            className={cn(
              'flex w-full items-center gap-2.5 px-3.5 py-3 text-right transition',
              activeIndex === rankedMatches.length
                ? 'bg-[color:var(--brand-soft)]/70'
                : 'hover:bg-[color:var(--surface-2)]/60'
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--surface-2)] text-[color:var(--brand)]">
              <FileText size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">
                ثبت «{trimmedQuery}» به‌عنوان شرح آزاد
              </p>
              <p className="text-[10.5px] font-medium text-[color:var(--muted)]">
                بدون اتصال به موجودی انبار (خدمت یا هزینه متفرقه)
              </p>
            </div>
          </button>
        ) : null}

        {rankedMatches.length === 0 && !trimmedQuery ? (
          <div className="px-4 py-6 text-center">
            <Package size={22} className="mx-auto text-[color:var(--muted)]/60" />
            <p className="mt-2 text-xs font-bold text-[color:var(--ink)]">
              هنوز کالایی در فهرست انبار تعریف نشده است
            </p>
            <p className="mt-1 text-[11px] font-medium text-[color:var(--muted)]">
              نام دلخواه را تایپ کرده و Enter بزنید یا از دکمه پایین کالای جدید تعریف کنید
            </p>
          </div>
        ) : null}
      </div>

      {/* Footer Actions: Quick Create Product & Keyboard Hint */}
      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/50 px-3 py-2">
        {onQuickCreateProduct ? (
          <button
            type="button"
            data-testid="product-search-quick-create"
            onClick={() => {
              const prefill = trimmedQuery;
              setOpen(false);
              setQuery('');
              onQuickCreateProduct(prefill);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-extrabold text-[color:var(--brand)] transition hover:bg-[color:var(--brand-soft)]"
          >
            <PackagePlus size={14} />
            <span className="max-w-[15rem] truncate">
              {trimmedQuery ? `تعریف کالای جدید «${trimmedQuery}»` : 'تعریف سریع کالای جدید'}
            </span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[color:var(--muted)]">
            <Sparkles size={12} />
            جست‌وجو با نام، کد یا شرح آزاد
          </span>
        )}

        <span className="hidden text-[10px] font-semibold text-[color:var(--muted)] sm:inline">
          ↑↓ حرکت · Enter انتخاب
        </span>
      </div>
    </>
  );

  return (
    <div className="relative min-w-0 w-full">
      <button
        ref={(el) => {
          triggerElRef.current = el;
          buttonRef?.(el);
        }}
        type="button"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={handleOpen}
        className={cn(
          'group flex w-full items-center justify-between gap-2 text-right transition outline-none',
          variant === 'cell'
            ? cn(
                'min-h-[2.75rem] px-3 py-2 bg-transparent hover:bg-[color:var(--surface-2)]/50 focus-visible:bg-[color:var(--brand-soft)]/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--brand)]',
                open && 'bg-[color:var(--brand-soft)]/35 ring-2 ring-inset ring-[color:var(--brand)]'
              )
            : cn(
                'min-h-[2.85rem] rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 py-2 hover:border-[color:var(--brand)]/45 focus-visible:border-[color:var(--brand)] focus-visible:ring-3 focus-visible:ring-[color:var(--brand-glow)]',
                open && 'border-[color:var(--brand)] ring-3 ring-[color:var(--brand-glow)]'
              )
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search
            size={14}
            className={cn(
              'shrink-0 transition',
              hasValue ? 'text-[color:var(--brand)]' : 'text-[color:var(--muted)]'
            )}
            aria-hidden
          />
          {selectedProduct ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-extrabold text-[color:var(--ink)] sm:text-[13px]">
                  {selectedProduct.name}
                </span>
                <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-[color:var(--muted)]">
                  #{toPersianDigits(selectedProduct.code)}
                </span>
              </div>
              {availableStock !== null ? (
                <p
                  className={cn(
                    'mt-0.5 truncate text-[10.5px] font-bold tabular-nums',
                    isOverstock ? 'text-[color:var(--expense)]' : 'text-[color:var(--muted)]'
                  )}
                >
                  موجودی: {toPersianDigits(formatNumberWithCommas(availableStock))}{' '}
                  {selectedProduct.unit}
                  {isOverstock ? ' · بیش از موجودی!' : ''}
                </p>
              ) : null}
            </div>
          ) : productName.trim() ? (
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-[color:var(--ink)] sm:text-[13px]">
                {productName}
              </span>
              <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                شرح آزاد (غیرانباری)
              </span>
            </div>
          ) : (
            <span className="truncate text-xs font-medium text-[color:var(--muted)]">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {hasValue && onClear ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="پاک کردن کالا"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[color:var(--muted)] opacity-70 transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--expense)] hover:opacity-100"
            >
              <X size={13} />
            </span>
          ) : null}
          <ChevronDown
            size={14}
            className={cn(
              'text-[color:var(--muted)] transition-transform duration-150',
              open && 'rotate-180 text-[color:var(--brand)]'
            )}
            aria-hidden
          />
        </div>
      </button>

      {/* Mode A: Inline Dropdown (safe inside Radix Dialog / FormSheet) */}
      {open && inlineDropdown ? (
        <div
          ref={popoverRef}
          data-testid="product-search-popover"
          className="absolute inset-x-0 top-full z-50 mt-1.5 flex flex-col overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] shadow-[0_18px_45px_-10px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)]"
        >
          {panelBody}
        </div>
      ) : null}

      {/* Mode B: Portal Dropdown (Desktop/Tablet) OR Mobile Bottom Sheet */}
      {open && !inlineDropdown && typeof document !== 'undefined'
        ? createPortal(
            isMobileSheet ? (
              <div
                className="fixed inset-0 z-[120] flex flex-col justify-end bg-slate-950/50 backdrop-blur-[2px]"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setOpen(false);
                }}
              >
                <div
                  ref={popoverRef}
                  data-testid="product-search-popover"
                  className="flex max-h-[84dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-[color:var(--line)] bg-[color:var(--surface-solid)] shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3">
                    <div>
                      <h4 className="text-sm font-black text-[color:var(--ink)]">
                        انتخاب کالا یا خدمت
                      </h4>
                      <p className="text-[11px] font-medium text-[color:var(--muted)]">
                        کد یا نام کالا را جست‌وجو کنید یا شرح آزاد بنویسید
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="بستن"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--surface-2)] text-[color:var(--ink)]"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {panelBody}
                </div>
              </div>
            ) : coords ? (
              <div
                ref={popoverRef}
                data-testid="product-search-popover"
                style={{
                  position: 'fixed',
                  left: coords.left,
                  width: coords.width,
                  top: coords.openAbove ? undefined : coords.top,
                  bottom: coords.openAbove ? window.innerHeight - coords.top : undefined,
                  maxHeight: coords.maxHeight,
                }}
                className="z-[120] flex flex-col overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)]"
              >
                {panelBody}
              </div>
            ) : null,
            document.body
          )
        : null}
    </div>
  );
};

export default ProductSearchPicker;
