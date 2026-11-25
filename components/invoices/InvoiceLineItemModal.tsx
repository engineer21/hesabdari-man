import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Minus,
  Plus,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import type { Invoice, InvoiceKind, Product, Warehouse } from '../../types';
import {
  COMMON_PRODUCT_UNITS,
  computeLineTotal,
  computeProductStock,
} from '../../utils/inventoryEngine';
import {
  createEmptyDraftRow,
  getSuggestedProductPrice,
  type DraftInvoiceRow,
} from '../../utils/invoiceSearch';
import {
  formatNumberWithCommas,
  parseIntegerAmount,
  persianToArabic,
  toPersianDigits,
} from '../../utils/formatters';
import ProductSearchPicker from './ProductSearchPicker';
import { Button, FormSheet, cn, fieldInput, fieldLabel } from '../ui';
import { useDialog } from '../DialogProvider';

interface InvoiceLineItemModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialRow?: DraftInvoiceRow | null;
  defaultWarehouseId: string;
  kind: InvoiceKind;
  products: Product[];
  warehouses: Warehouse[];
  invoicesExcludingSelf: Invoice[];
  onClose: () => void;
  onSaveRow: (row: DraftInvoiceRow, keepOpenForNext: boolean) => void;
  onQuickCreateProduct: (prefillName: string, onCreated?: (prod: Product) => void) => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const InvoiceLineItemModal: React.FC<InvoiceLineItemModalProps> = ({
  isOpen,
  mode,
  initialRow,
  defaultWarehouseId,
  kind,
  products,
  warehouses,
  invoicesExcludingSelf,
  onClose,
  onSaveRow,
  onQuickCreateProduct,
}) => {
  const dialog = useDialog();
  const [draft, setDraft] = useState<DraftInvoiceRow>(() =>
    initialRow ? { ...initialRow } : createEmptyDraftRow(defaultWarehouseId)
  );

  useEffect(() => {
    if (!isOpen) return;
    setDraft(initialRow ? { ...initialRow } : createEmptyDraftRow(defaultWarehouseId));
  }, [isOpen, initialRow, defaultWarehouseId]);

  const selectedProduct = useMemo(
    () => (draft.productId ? products.find((p) => p.id === draft.productId) : undefined),
    [products, draft.productId]
  );

  const qty = Math.max(0, Number(persianToArabic(draft.quantityStr).replace(/,/g, '')) || 0);
  const unitPrice = parseIntegerAmount(draft.unitPriceStr);
  const discount = parseIntegerAmount(draft.discountStr);
  const grossTotal = Math.round(qty * unitPrice);
  const netTotal = computeLineTotal({ quantity: qty, unitPrice, discount });

  const availableStock = useMemo(() => {
    if (!selectedProduct || selectedProduct.kind !== 'goods') return null;
    return computeProductStock(
      selectedProduct,
      invoicesExcludingSelf,
      draft.warehouseId || defaultWarehouseId
    );
  }, [selectedProduct, invoicesExcludingSelf, draft.warehouseId, defaultWarehouseId]);

  const isOverstock = kind === 'sale' && availableStock !== null && qty > availableStock;

  const handleSelectProduct = (prod: Product) => {
    const suggested = getSuggestedProductPrice(prod, kind);
    setDraft((prev) => ({
      ...prev,
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit || 'عدد',
      warehouseId: prod.defaultWarehouseId || prev.warehouseId || defaultWarehouseId,
      unitPriceStr: suggested > 0 ? String(suggested) : prev.unitPriceStr,
    }));
  };

  const handleStepQty = (delta: number) => {
    const next = Math.max(0, Number((qty + delta).toFixed(2)));
    setDraft((prev) => ({ ...prev, quantityStr: next > 0 ? String(next) : '1' }));
  };

  const validateAndSubmit = async (keepOpenForNext: boolean) => {
    if (!draft.productName.trim()) {
      await dialog.alert({
        title: 'انتخاب کالا یا شرح',
        message: 'لطفاً یک کالا انتخاب کنید یا شرح آزاد ردیف را وارد نمایید.',
      });
      return;
    }
    if (qty <= 0) {
      await dialog.alert({
        title: 'تعداد نامعتبر',
        message: 'تعداد ردیف باید بیشتر از صفر باشد.',
      });
      return;
    }
    const finalRow: DraftInvoiceRow = {
      ...draft,
      productName: draft.productName.trim(),
      unit: draft.unit.trim() || 'عدد',
      warehouseId: draft.warehouseId || defaultWarehouseId,
    };
    onSaveRow(finalRow, keepOpenForNext);
    if (keepOpenForNext) {
      setDraft(createEmptyDraftRow(draft.warehouseId || defaultWarehouseId));
    }
  };

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'ویرایش ردیف کالا' : 'افزودن ردیف کالا به فاکتور'}
      subtitle={
        kind === 'sale'
          ? 'کالا را جست‌وجو کرده و تعداد و قیمت فروش را مشخص کنید'
          : 'کالا را جست‌وجو کرده و تعداد و قیمت خرید را وارد کنید'
      }
      size="md"
      layer="nested"
      accent={kind === 'purchase' ? 'expense' : 'income'}
      dock
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            انصراف
          </Button>
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            {mode === 'create' ? (
              <Button
                variant="secondary"
                size="md"
                icon={Plus}
                data-testid="invoice-line-modal-save-next"
                onClick={() => void validateAndSubmit(true)}
              >
                <span className="sm:hidden">ثبت و بعدی</span>
                <span className="hidden sm:inline">ثبت و ردیف بعدی</span>
              </Button>
            ) : null}
            <Button
              size="md"
              variant={kind === 'purchase' ? 'expense' : 'income'}
              icon={Check}
              data-testid="invoice-line-modal-save"
              onClick={() => void validateAndSubmit(false)}
            >
              {mode === 'edit' ? 'ذخیره ردیف' : 'ثبت ردیف'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4" data-testid="invoice-line-modal">
        {/* Product Smart Search */}
        <div>
          <label className={fieldLabel}>کالا / خدمت یا شرح ردیف</label>
          <ProductSearchPicker
            products={products}
            invoicesExcludingSelf={invoicesExcludingSelf}
            kind={kind}
            warehouseId={draft.warehouseId || defaultWarehouseId}
            productId={draft.productId}
            productName={draft.productName}
            currentQuantity={qty}
            availableStock={availableStock}
            onSelectProduct={handleSelectProduct}
            onSelectCustomText={(text) =>
              setDraft((prev) => ({ ...prev, productId: '', productName: text }))
            }
            onClear={() =>
              setDraft((prev) => ({
                ...prev,
                productId: '',
                productName: '',
                unitPriceStr: '',
              }))
            }
            onQuickCreateProduct={(prefill) =>
              onQuickCreateProduct(prefill, (created) => handleSelectProduct(created))
            }
            variant="field"
            inlineDropdown
            testId="invoice-line-modal-product"
          />
        </div>

        {/* Warehouse + Live Stock Banner */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={fieldLabel}>
              <span className="inline-flex items-center gap-1">
                <WarehouseIcon size={13} />
                انبار مرتبط
              </span>
            </label>
            <select
              className={fieldInput}
              data-testid="invoice-line-modal-warehouse"
              value={draft.warehouseId}
              onChange={(e) => setDraft((prev) => ({ ...prev, warehouseId: e.target.value }))}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <div
              className={cn(
                'flex min-h-[2.85rem] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs',
                isOverstock
                  ? 'border-rose-300 bg-rose-50/80 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300'
                  : 'border-[color:var(--line)] bg-[color:var(--surface-2)]/55 text-[color:var(--muted)]'
              )}
            >
              <span className="inline-flex items-center gap-1.5 font-bold">
                {isOverstock ? <AlertTriangle size={14} className="shrink-0" /> : null}
                موجودی انبار
              </span>
              <span className="font-black tabular-nums text-[color:var(--ink)]">
                {availableStock !== null
                  ? `${toPersianDigits(formatNumberWithCommas(availableStock))} ${selectedProduct?.unit || draft.unit}`
                  : selectedProduct?.kind === 'service'
                    ? 'خدمت (غیرانباری)'
                    : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Quantity Stepper + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={fieldLabel}>تعداد / مقدار</label>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] focus-within:border-[color:var(--brand)] focus-within:ring-3 focus-within:ring-[color:var(--brand-glow)]">
              <button
                type="button"
                aria-label="افزایش تعداد"
                onClick={() => handleStepQty(1)}
                className="flex w-10 shrink-0 items-center justify-center border-l border-[color:var(--line)] text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
              >
                <Plus size={14} />
              </button>
              <input
                data-testid="invoice-line-modal-qty"
                inputMode="decimal"
                className="min-h-[2.75rem] min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-black tabular-nums text-[color:var(--ink)] outline-none"
                value={draft.quantityStr}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    quantityStr: persianToArabic(e.target.value).replace(/[^\d.]/g, ''),
                  }))
                }
                placeholder="1"
              />
              <button
                type="button"
                aria-label="کاهش تعداد"
                onClick={() => handleStepQty(-1)}
                className="flex w-10 shrink-0 items-center justify-center border-r border-[color:var(--line)] text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
              >
                <Minus size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className={fieldLabel}>واحد شمارش</label>
            <input
              list="invoice-modal-units-list"
              data-testid="invoice-line-modal-unit"
              className={cn(fieldInput, 'text-center font-bold')}
              value={draft.unit}
              onChange={(e) => setDraft((prev) => ({ ...prev, unit: e.target.value }))}
              placeholder="کیلوگرم / عدد"
            />
            <datalist id="invoice-modal-units-list">
              {COMMON_PRODUCT_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Unit Price + Row Discount */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={fieldLabel}>قیمت واحد (تومان)</label>
            <input
              data-testid="invoice-line-modal-price"
              inputMode="numeric"
              className={cn(fieldInput, 'text-left text-sm font-black tabular-nums')}
              value={
                draft.unitPriceStr
                  ? toPersianDigits(formatNumberWithCommas(draft.unitPriceStr))
                  : ''
              }
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  unitPriceStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                }))
              }
              placeholder="۰"
            />
          </div>

          <div>
            <label className={fieldLabel}>تخفیف این ردیف (تومان)</label>
            <input
              data-testid="invoice-line-modal-discount"
              inputMode="numeric"
              className={cn(fieldInput, 'text-left text-sm font-bold tabular-nums')}
              value={
                draft.discountStr
                  ? toPersianDigits(formatNumberWithCommas(draft.discountStr))
                  : ''
              }
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  discountStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                }))
              }
              placeholder="۰"
            />
          </div>
        </div>

        {/* Live Line Financial Preview */}
        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3.5">
          <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
            <span className="font-semibold">
              مبلغ ناخالص ({toPersianDigits(String(qty))} × {money(unitPrice)})
            </span>
            <span className="font-bold tabular-nums text-[color:var(--ink)]">
              {money(grossTotal)} تومان
            </span>
          </div>
          {discount > 0 ? (
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-[color:var(--muted)]">تخفیف ردیف</span>
              <span className="font-bold tabular-nums text-[color:var(--expense)]">
                −{money(discount)} تومان
              </span>
            </div>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between border-t border-[color:var(--line)] pt-2.5">
            <span className="text-xs font-black text-[color:var(--ink)]">جمع خالص این ردیف</span>
            <span
              data-testid="invoice-line-modal-total"
              className={cn(
                'text-lg font-black tabular-nums',
                kind === 'purchase' ? 'text-[color:var(--expense)]' : 'text-[color:var(--income)]'
              )}
            >
              {money(netTotal)}
              <span className="ms-1 text-[11px] font-semibold text-[color:var(--muted)]">تومان</span>
            </span>
          </div>
        </div>
      </div>
    </FormSheet>
  );
};

export default InvoiceLineItemModal;
