import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  FilePlus2,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  Attachment,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  InvoiceKind,
  InvoiceLineItem,
  Product,
  Transaction,
  Warehouse,
} from '../../types';
import { DEFAULT_WAREHOUSE_ID } from '../../constants';
import { getBankAccounts, getPostableLeaves } from '../../utils/accountTree';
import {
  resolveDefaultAccountId,
  resolveDefaultWarehouseId,
} from '../../utils/accountingTemplates';
import {
  buildDraftStagesFromExisting,
  computeDraftSettlementTotals,
  materializeInvoiceSettlementStages,
  type DraftSettlementStage,
} from '../../utils/invoiceSettlementFlow';
import {
  COMMON_PRODUCT_UNITS,
  computeInvoiceTotals,
  computeLineTotal,
  computeProductStock,
} from '../../utils/inventoryEngine';
import {
  cloneDraftRow,
  createEmptyDraftRow,
  getSuggestedProductPrice,
  isDraftRowPopulated,
  shouldAutoAppendOnEnter,
  type DraftInvoiceRow,
} from '../../utils/invoiceSearch';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  persianToArabic,
  toPersianDigits,
} from '../../utils/formatters';
import PersianDatePicker from '../PersianDatePicker';
import AccountTreePicker from '../AccountTreePicker';
import AttachmentField from '../ui/AttachmentField';
import ProductSearchPicker from './ProductSearchPicker';
import InvoiceLineItemModal from './InvoiceLineItemModal';
import InvoiceSettlementSection from './InvoiceSettlementSection';
import {
  AmountInput,
  Button,
  CollapsibleOptionalSection,
  FormActions,
  FormSheet,
  IconButton,
  MobileStickyBar,
  cn,
  fieldInput,
  fieldLabel,
} from '../ui';
import { countFilledFields } from '../../utils/formLayout';
import { useDialog } from '../DialogProvider';

interface InvoiceEditorTabProps {
  tabId: string;
  isActive?: boolean;
  initialKind: InvoiceKind;
  initialInvoice?: Invoice;
  nextInvoiceNumber: string;
  accounts: Account[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  warehouses: Warehouse[];
  products: Product[];
  allInvoices: Invoice[];
  transactions?: Transaction[];
  checks?: CheckItem[];
  settings?: AppSettings;
  onQuickCreateProduct: (product: Product) => void;
  onSave: (
    invoice: Invoice,
    settlements?: { transactions: Transaction[]; checks: CheckItem[] }
  ) => void;
  onCancel: () => void;
  onMetaChange?: (meta: { title: string; dirty: boolean; accent: 'income' | 'expense' }) => void;
}

type CellCol = 'product' | 'qty' | 'unit' | 'price' | 'discount';

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const InvoiceEditorTab: React.FC<InvoiceEditorTabProps> = ({
  isActive = true,
  initialKind,
  initialInvoice,
  nextInvoiceNumber,
  accounts,
  contacts,
  contactGroups,
  warehouses,
  products,
  allInvoices,
  transactions = [],
  checks = [],
  settings,
  onQuickCreateProduct,
  onSave,
  onCancel,
  onMetaChange,
}) => {
  const dialog = useDialog();
  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const expenseLeaves = useMemo(() => getPostableLeaves(accounts, 'acc_expense'), [accounts]);
  const incomeLeaves = useMemo(() => getPostableLeaves(accounts, 'acc_income'), [accounts]);

  const defaultBankId = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'defaultBank') ||
      banks[0]?.id ||
      '',
    [accounts, settings?.accountingDefaults, banks]
  );

  const defaultSaleAccId = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'saleInvoice') ||
      incomeLeaves[0]?.id ||
      '',
    [accounts, settings?.accountingDefaults, incomeLeaves]
  );

  const defaultPurchaseAccId = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'purchaseInvoice') ||
      expenseLeaves[0]?.id ||
      '',
    [accounts, settings?.accountingDefaults, expenseLeaves]
  );

  const defaultWhId = useMemo(
    () =>
      initialInvoice?.warehouseId ||
      resolveDefaultWarehouseId(warehouses, settings?.accountingDefaults) ||
      DEFAULT_WAREHOUSE_ID,
    [initialInvoice, warehouses, settings?.accountingDefaults]
  );

  const [kind, setKind] = useState<InvoiceKind>(initialInvoice?.kind || initialKind);
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialInvoice?.invoiceNumber || nextInvoiceNumber
  );
  const [date, setDate] = useState(initialInvoice?.date || getLocalDateISOString(new Date()));
  const [dueDate, setDueDate] = useState(initialInvoice?.dueDate || '');
  const [contactId, setContactId] = useState(initialInvoice?.contactId || contacts[0]?.id || '');
  const [accountId, setAccountId] = useState(() => {
    if (initialInvoice?.accountId) return initialInvoice.accountId;
    return (initialInvoice?.kind || initialKind) === 'sale'
      ? defaultSaleAccId
      : defaultPurchaseAccId;
  });
  const [warehouseId, setWarehouseId] = useState(defaultWhId);
  const [description, setDescription] = useState(initialInvoice?.description || '');
  const [attachment, setAttachment] = useState<Attachment | undefined>(initialInvoice?.attachment);

  const [pricingMode, setPricingMode] = useState<'itemized' | 'lump_sum'>(() => {
    if (initialInvoice && (!initialInvoice.items || initialInvoice.items.length === 0)) {
      return 'lump_sum';
    }
    return 'itemized';
  });
  const [lumpAmountRaw, setLumpAmountRaw] = useState(
    initialInvoice ? String(initialInvoice.amount) : ''
  );
  const [rows, setRows] = useState<DraftInvoiceRow[]>(() => {
    if (initialInvoice?.items && initialInvoice.items.length > 0) {
      return initialInvoice.items.map((it) => ({
        id: it.id,
        productId: it.productId || '',
        productName: it.productName,
        warehouseId: it.warehouseId || initialInvoice.warehouseId || defaultWhId,
        unit: it.unit || 'عدد',
        quantityStr: String(it.quantity),
        unitPriceStr: String(it.unitPrice),
        discountStr: it.discount ? String(it.discount) : '',
      }));
    }
    return [createEmptyDraftRow(defaultWhId)];
  });

  const [dirty, setDirty] = useState(false);

  // Multi-Stage Cash / Bank / Check Settlement Stages inside Invoice Form
  const [settlementStages, setSettlementStages] = useState<DraftSettlementStage[]>(() =>
    initialInvoice ? buildDraftStagesFromExisting(initialInvoice.id, transactions, checks) : []
  );

  const handleStagesChange = (nextStages: DraftSettlementStage[]) => {
    markDirty();
    setSettlementStages(nextStages);
  };

  // Dual-Mode Line Item Modal State (Create or Edit any row)
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineModalMode, setLineModalMode] = useState<'create' | 'edit'>('create');
  const [lineModalRow, setLineModalRow] = useState<DraftInvoiceRow | null>(null);

  // Quick Add Product Modal
  const [quickProdOpen, setQuickProdOpen] = useState(false);
  const [quickProdTargetRowId, setQuickProdTargetRowId] = useState<string | null>(null);
  const quickProdCallbackRef = useRef<((prod: Product) => void) | null>(null);
  const [qpName, setQpName] = useState('');
  const [qpUnit, setQpUnit] = useState('کیلوگرم');
  const [qpBuy, setQpBuy] = useState('');
  const [qpSale, setQpSale] = useState('');
  const [qpWh, setQpWh] = useState(defaultWhId);

  // Excel-like keyboard cell focus registry (`${rowId}:${col}`)
  const cellRefs = useRef<Record<string, HTMLElement | null>>({});
  const pendingFocusRef = useRef<{ rowId: string; col: CellCol } | null>(null);

  const registerCellRef = (rowId: string, col: CellCol) => (el: HTMLElement | null) => {
    const key = `${rowId}:${col}`;
    if (el) {
      cellRefs.current[key] = el;
    } else {
      delete cellRefs.current[key];
    }
  };

  useEffect(() => {
    if (!pendingFocusRef.current) return;
    const { rowId, col } = pendingFocusRef.current;
    const el = cellRefs.current[`${rowId}:${col}`];
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) el.select();
      pendingFocusRef.current = null;
    }
  }, [rows]);

  const groupName = (id: string) => contactGroups.find((g) => g.id === id)?.name || '';

  useEffect(() => {
    const labelPrefix = initialInvoice
      ? kind === 'purchase'
        ? 'ویرایش خرید'
        : 'ویرایش فروش'
      : kind === 'purchase'
        ? 'فاکتور خرید جدید'
        : 'فاکتور فروش جدید';
    const numSuffix = invoiceNumber.trim() ? ` #${toPersianDigits(invoiceNumber.trim())}` : '';
    onMetaChange?.({
      title: `${labelPrefix}${numSuffix}`,
      dirty,
      accent: kind === 'purchase' ? 'expense' : 'income',
    });
  }, [kind, invoiceNumber, dirty, initialInvoice, onMetaChange]);

  const parsedItems: InvoiceLineItem[] = useMemo(() => {
    return rows.map((r) => {
      const qty = Math.max(0, Number(persianToArabic(r.quantityStr).replace(/,/g, '')) || 0);
      const unitPrice = parseIntegerAmount(r.unitPriceStr);
      const discount = parseIntegerAmount(r.discountStr);
      const total = computeLineTotal({ quantity: qty, unitPrice, discount });
      return {
        id: r.id,
        productId: r.productId || undefined,
        productName: r.productName.trim(),
        warehouseId: r.warehouseId || warehouseId,
        unit: r.unit.trim() || 'عدد',
        quantity: qty,
        unitPrice,
        discount: discount || undefined,
        total,
      };
    });
  }, [rows, warehouseId]);

  const totals = useMemo(() => computeInvoiceTotals(parsedItems), [parsedItems]);

  const invoicesExcludingSelf = useMemo(
    () => (initialInvoice ? allInvoices.filter((i) => i.id !== initialInvoice.id) : allInvoices),
    [allInvoices, initialInvoice]
  );

  const markDirty = () => {
    if (!dirty) setDirty(true);
  };

  const handleSelectProductObj = (rowId: string, prod: Product) => {
    markDirty();
    const suggestedPrice = getSuggestedProductPrice(prod, kind);
    setRows((prev) =>
      prev.map((r) =>
        r.id !== rowId
          ? r
          : {
              ...r,
              productId: prod.id,
              productName: prod.name,
              unit: prod.unit || 'عدد',
              warehouseId: prod.defaultWarehouseId || r.warehouseId || warehouseId,
              unitPriceStr: suggestedPrice > 0 ? String(suggestedPrice) : r.unitPriceStr,
            }
      )
    );
    // Focus quantity cell smoothly right after picking a product on desktop Excel grid
    window.setTimeout(() => {
      const qtyEl = cellRefs.current[`${rowId}:qty`];
      if (qtyEl && qtyEl.offsetParent !== null) {
        qtyEl.focus();
        if (qtyEl instanceof HTMLInputElement) qtyEl.select();
      }
    }, 25);
  };

  const updateRow = (rowId: string, patch: Partial<DraftInvoiceRow>) => {
    markDirty();
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const addExcelRow = (focusCol: CellCol = 'product') => {
    markDirty();
    const fresh = createEmptyDraftRow(warehouseId);
    pendingFocusRef.current = { rowId: fresh.id, col: focusCol };
    setRows((prev) => [...prev, fresh]);
  };

  const duplicateRow = (row: DraftInvoiceRow, idx: number) => {
    markDirty();
    const copy = cloneDraftRow(row);
    pendingFocusRef.current = { rowId: copy.id, col: 'qty' };
    setRows((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removeRow = (rowId: string) => {
    markDirty();
    setRows((prev) =>
      prev.length <= 1 ? [createEmptyDraftRow(warehouseId)] : prev.filter((r) => r.id !== rowId)
    );
  };

  // Excel-like keyboard navigation across spreadsheet cells
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    col: Exclude<CellCol, 'product'>
  ) => {
    const colOrder: Exclude<CellCol, 'product'>[] = ['qty', 'unit', 'price', 'discount'];
    const currentRow = rows[rowIndex];
    if (!currentRow) return;

    if (e.key === 'ArrowDown' && rowIndex < rows.length - 1) {
      e.preventDefault();
      const target = cellRefs.current[`${rows[rowIndex + 1].id}:${col}`];
      if (target) {
        target.focus();
        if (target instanceof HTMLInputElement) target.select();
      }
      return;
    }

    if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const target = cellRefs.current[`${rows[rowIndex - 1].id}:${col}`];
      if (target) {
        target.focus();
        if (target instanceof HTMLInputElement) target.select();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const colIdx = colOrder.indexOf(col);
      if (colIdx < colOrder.length - 1) {
        const nextCol = colOrder[colIdx + 1];
        const target = cellRefs.current[`${currentRow.id}:${nextCol}`];
        if (target) {
          target.focus();
          if (target instanceof HTMLInputElement) target.select();
        }
        return;
      }
      // Last column (discount): move to next row or auto-append a fresh row
      if (rowIndex < rows.length - 1) {
        const nextRow = rows[rowIndex + 1];
        const target = cellRefs.current[`${nextRow.id}:product`] || cellRefs.current[`${nextRow.id}:qty`];
        if (target) target.focus();
      } else if (shouldAutoAppendOnEnter(rowIndex, rows.length, currentRow)) {
        addExcelRow('product');
      }
    }
  };

  // Open Line Item Modal (Create or Edit)
  const openCreateLineModal = () => {
    setLineModalMode('create');
    setLineModalRow(null);
    setLineModalOpen(true);
  };

  const openEditLineModal = (row: DraftInvoiceRow) => {
    setLineModalMode('edit');
    setLineModalRow(row);
    setLineModalOpen(true);
  };

  const handleSaveLineModal = (savedRow: DraftInvoiceRow, keepOpenForNext: boolean) => {
    markDirty();
    setRows((prev) => {
      if (lineModalMode === 'edit') {
        return prev.map((r) => (r.id === savedRow.id ? savedRow : r));
      }
      // If only a single untouched empty placeholder row exists, replace it cleanly
      if (prev.length === 1 && !isDraftRowPopulated(prev[0])) {
        return [savedRow];
      }
      return [...prev, savedRow];
    });
    if (!keepOpenForNext) {
      setLineModalOpen(false);
    }
  };

  const openQuickProductModal = (
    targetRowId: string | null,
    prefillName = '',
    onCreated?: (prod: Product) => void
  ) => {
    setQuickProdTargetRowId(targetRowId);
    quickProdCallbackRef.current = onCreated || null;
    setQpName(prefillName);
    setQpWh(warehouseId);
    setQuickProdOpen(true);
  };

  const handleQuickCreateProduct = async () => {
    const name = qpName.trim();
    if (!name) {
      await dialog.alert({ title: 'نام کالا', message: 'نام کالا را وارد کنید.' });
      return;
    }
    const created: Product = {
      id: `prd_${crypto.randomUUID().slice(0, 10)}`,
      code: String(1001 + products.length),
      name,
      kind: 'goods',
      unit: qpUnit.trim() || 'کیلوگرم',
      defaultWarehouseId: qpWh || warehouseId,
      purchasePrice: qpBuy ? parseIntegerAmount(qpBuy) : undefined,
      salePrice: qpSale ? parseIntegerAmount(qpSale) : undefined,
      openingStock: 0,
      isActive: true,
    };
    onQuickCreateProduct(created);
    if (quickProdCallbackRef.current) {
      quickProdCallbackRef.current(created);
      quickProdCallbackRef.current = null;
    } else if (quickProdTargetRowId) {
      handleSelectProductObj(quickProdTargetRowId, created);
    }
    setQuickProdOpen(false);
    setQpName('');
    setQpBuy('');
    setQpSale('');
  };

  const handleSubmit = async () => {
    if (!contactId) {
      await dialog.alert({
        title: 'طرف‌حساب',
        message: 'انتخاب طرف‌حساب (فروشنده یا خریدار) الزامی است.',
      });
      return;
    }
    if (!accountId) {
      await dialog.alert({
        title: 'سرفصل حسابداری',
        message: 'سرفصل هزینه یا درآمد فاکتور را انتخاب کنید.',
      });
      return;
    }

    let finalAmount = 0;
    let finalItems: InvoiceLineItem[] | undefined = undefined;

    if (pricingMode === 'itemized') {
      const validItems = parsedItems.filter((it) => it.productName && it.quantity > 0);
      if (validItems.length === 0) {
        await dialog.alert({
          title: 'اقلام فاکتور',
          message: 'حداقل یک ردیف کالا/شرح با تعداد معتبر در جدول اقلام وارد کنید.',
        });
        return;
      }
      finalAmount = computeInvoiceTotals(validItems).grandTotal;
      if (finalAmount <= 0) {
        await dialog.alert({
          title: 'مبلغ فاکتور',
          message: 'مبلغ نهایی اقلام فاکتور باید بیشتر از صفر باشد.',
        });
        return;
      }
      finalItems = validItems;
    } else {
      finalAmount = parseIntegerAmount(lumpAmountRaw);
      if (finalAmount <= 0) {
        await dialog.alert({ title: 'مبلغ فاکتور', message: 'مبلغ کل فاکتور را وارد کنید.' });
        return;
      }
    }

    for (let i = 0; i < settlementStages.length; i++) {
      const st = settlementStages[i];
      const amt = parseIntegerAmount(st.amountStr);
      if (amt <= 0) continue;
      if (!st.bankAccountId) {
        await dialog.alert({
          title: 'حساب بانکی / صندوق',
          message: `برای مرحله ${toPersianDigits(String(i + 1))} تسویه، حساب بانکی یا صندوق را انتخاب کنید.`,
        });
        return;
      }
      if (st.method === 'check' && !st.checkNumber.trim()) {
        await dialog.alert({
          title: 'شماره چک',
          message: `شماره چک مرحله ${toPersianDigits(String(i + 1))} را وارد کنید.`,
        });
        return;
      }
    }

    const payload: Invoice = {
      id: initialInvoice ? initialInvoice.id : `inv_${crypto.randomUUID().slice(0, 10)}`,
      kind,
      invoiceNumber: invoiceNumber.trim() || nextInvoiceNumber,
      date,
      dueDate: dueDate || undefined,
      contactId,
      accountId,
      warehouseId: pricingMode === 'itemized' ? warehouseId : undefined,
      items: finalItems,
      amount: finalAmount,
      description: description.trim(),
      attachment,
    };

    const contactName = contacts.find((c) => c.id === contactId)?.fullName || 'طرف‌حساب';
    const materialized = materializeInvoiceSettlementStages({
      invoice: payload,
      contactName,
      stages: settlementStages,
      existingChecks: checks,
    });

    onSave(payload, {
      transactions: materialized.settlementTransactions,
      checks: materialized.settlementChecks,
    });
  };

  const finalDisplayAmount =
    pricingMode === 'itemized' ? totals.grandTotal : parseIntegerAmount(lumpAmountRaw);
  const settlementTotals = useMemo(
    () => computeDraftSettlementTotals(finalDisplayAmount, settlementStages),
    [finalDisplayAmount, settlementStages]
  );
  const optionalHeaderCount = countFilledFields([invoiceNumber, dueDate, warehouseId]);
  const optionalFooterCount = countFilledFields([description, attachment]);
  const selectedWhName =
    warehouses.find((w) => w.id === warehouseId)?.name || 'انبار مرکزی';
  const populatedRowCount = rows.filter(isDraftRowPopulated).length;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] shadow-xs',
        isActive && 'mb-24 md:mb-0'
      )}
      data-testid="invoice-mdi-editor"
    >
      {/* Document Header Strip — Clean single-elevation SaaS document header */}
      <div className="flex flex-col gap-3 border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/35 px-4 py-3.5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3 md:justify-start">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                kind === 'purchase' ? 'bg-rose-500' : 'bg-emerald-500'
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-sm font-black tracking-tight text-[color:var(--ink)] sm:text-base">
                  {initialInvoice
                    ? kind === 'purchase'
                      ? 'ویرایش فاکتور خرید'
                      : 'ویرایش فاکتور فروش'
                    : kind === 'purchase'
                      ? 'فاکتور خرید جدید'
                      : 'فاکتور فروش جدید'}
                </h2>
                <span className="text-xs font-extrabold tabular-nums text-[color:var(--muted)]">
                  #{toPersianDigits(invoiceNumber.trim() || nextInvoiceNumber)}
                </span>
              </div>
              <p className="hidden text-[11.5px] font-medium text-[color:var(--muted)] xl:block">
                به‌روزرسانی خودکار موجودی انبار و مانده حساب طرف‌حساب هم‌زمان با ثبت سند
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switchers */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid grid-cols-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/85 p-0.5 sm:inline-flex">
            <button
              type="button"
              data-testid="invoice-kind-purchase"
              onClick={() => {
                markDirty();
                setKind('purchase');
                if (defaultPurchaseAccId) setAccountId(defaultPurchaseAccId);
              }}
              className={cn(
                'inline-flex min-h-[2.2rem] items-center justify-center gap-1.5 rounded-[10px] px-3 py-1 text-xs font-extrabold transition whitespace-nowrap',
                kind === 'purchase'
                  ? 'bg-[color:var(--surface-solid)] text-rose-600 shadow-xs ring-1 ring-rose-500/20 dark:text-rose-400'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  kind === 'purchase' ? 'bg-rose-500' : 'bg-transparent'
                )}
              />
              فاکتور خرید
            </button>
            <button
              type="button"
              data-testid="invoice-kind-sale"
              onClick={() => {
                markDirty();
                setKind('sale');
                if (defaultSaleAccId) setAccountId(defaultSaleAccId);
              }}
              className={cn(
                'inline-flex min-h-[2.2rem] items-center justify-center gap-1.5 rounded-[10px] px-3 py-1 text-xs font-extrabold transition whitespace-nowrap',
                kind === 'sale'
                  ? 'bg-[color:var(--surface-solid)] text-emerald-600 shadow-xs ring-1 ring-emerald-500/20 dark:text-emerald-400'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  kind === 'sale' ? 'bg-emerald-500' : 'bg-transparent'
                )}
              />
              فاکتور فروش
            </button>
          </div>

          <div className="grid grid-cols-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/85 p-0.5 sm:inline-flex">
            <button
              type="button"
              onClick={() => setPricingMode('itemized')}
              className={cn(
                'min-h-[2.2rem] rounded-[10px] px-3 py-1 text-xs font-bold transition whitespace-nowrap',
                pricingMode === 'itemized'
                  ? 'bg-[color:var(--surface-solid)] text-[color:var(--brand)] shadow-xs'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              اقلام کالا
            </button>
            <button
              type="button"
              onClick={() => setPricingMode('lump_sum')}
              className={cn(
                'min-h-[2.2rem] rounded-[10px] px-3 py-1 text-xs font-bold transition whitespace-nowrap',
                pricingMode === 'lump_sum'
                  ? 'bg-[color:var(--surface-solid)] text-[color:var(--brand)] shadow-xs'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              مبلغ یکجا
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="divide-y divide-[color:var(--line)]">
        {/* Section 1: Counterparty, Heading & Document Dates */}
        <section className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-3 md:gap-4">
            <div>
              <label className={fieldLabel}>
                {kind === 'purchase' ? 'فروشنده / تأمین‌کننده' : 'مشتری / خریدار'}
              </label>
              <select
                className={fieldInput}
                data-testid="invoice-contact-select"
                value={contactId}
                onChange={(e) => {
                  markDirty();
                  setContactId(e.target.value);
                }}
              >
                <option value="">انتخاب شخص...</option>
                {contacts.map((c) => {
                  const g = groupName(c.groupId);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                      {g ? ` (${g})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <AccountTreePicker
                accounts={accounts}
                module={kind === 'sale' ? 'income' : 'expense'}
                value={accountId}
                onChange={(id) => {
                  markDirty();
                  setAccountId(id);
                }}
                label={kind === 'sale' ? 'سرفصل درآمد' : 'سرفصل هزینه'}
              />
            </div>

            <div>
              <label className={fieldLabel}>تاریخ صدور فاکتور</label>
              <PersianDatePicker
                value={date}
                onChange={(d) => {
                  markDirty();
                  setDate(d);
                }}
              />
            </div>
          </div>

          <CollapsibleOptionalSection
            title="مشخصات تکمیلی سند (شماره، سررسید و انبار)"
            subtitle={`#${toPersianDigits(invoiceNumber || nextInvoiceNumber)} · ${selectedWhName}`}
            filledCount={optionalHeaderCount}
            mobileOnly
            testId="invoice-optional-header"
          >
            <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-3 md:gap-4">
              <div>
                <label className={fieldLabel}>شماره فاکتور</label>
                <input
                  className={cn(fieldInput, 'tabular-nums font-bold')}
                  data-testid="invoice-number-input"
                  value={invoiceNumber}
                  onChange={(e) => {
                    markDirty();
                    setInvoiceNumber(e.target.value);
                  }}
                  placeholder="مثلاً ۱۰۰۱"
                />
              </div>

              <div>
                <label className={fieldLabel}>تاریخ سررسید (اختیاری)</label>
                <PersianDatePicker
                  value={dueDate}
                  onChange={(d) => {
                    markDirty();
                    setDueDate(d);
                  }}
                  clearable
                  placeholder="بدون سررسید"
                />
              </div>

              <div>
                <label className={fieldLabel}>
                  <span className="inline-flex items-center gap-1">
                    <WarehouseIcon size={13} />
                    انبار پیش‌فرض فاکتور
                  </span>
                </label>
                <select
                  className={fieldInput}
                  data-testid="invoice-warehouse-select"
                  value={warehouseId}
                  onChange={(e) => {
                    markDirty();
                    const nextWh = e.target.value;
                    setWarehouseId(nextWh);
                    setRows((prev) =>
                      prev.map((r) => (!r.productId ? { ...r, warehouseId: nextWh } : r))
                    );
                  }}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CollapsibleOptionalSection>
        </section>

        {/* Section 2: Dual-Mode Line Items (Excel Inline Grid + Modal Entry) OR Lump-Sum */}
        <section className="px-4 py-4 sm:px-6 sm:py-5">
          {pricingMode === 'itemized' ? (
            <div className="space-y-3.5">
              {/* Line Items Toolbar */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <h3 className="inline-flex items-center gap-2 text-sm font-black text-[color:var(--ink)]">
                      <Package size={16} className="text-[color:var(--brand)]" />
                      جدول اقلام فاکتور
                    </h3>
                    <span className="text-xs font-semibold tabular-nums text-[color:var(--muted)]">
                      {toPersianDigits(String(populatedRowCount || rows.length))} ردیف
                      {totals.totalQuantity > 0
                        ? ` · جمع تعداد ${toPersianDigits(formatNumberWithCommas(totals.totalQuantity))}`
                        : ''}
                    </span>
                  </div>

                  {/* Mobile compact Quick Create Product link */}
                  <button
                    type="button"
                    onClick={() => openQuickProductModal(rows[rows.length - 1]?.id || null)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:bg-[color:var(--brand-soft)] sm:hidden"
                  >
                    <PackagePlus size={13} />
                    کالای جدید
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <span className="hidden sm:inline-flex">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={PackagePlus}
                      onClick={() => openQuickProductModal(rows[rows.length - 1]?.id || null)}
                    >
                      تعریف کالا
                    </Button>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={FilePlus2}
                    className="w-full sm:w-auto"
                    data-testid="invoice-add-modal-btn"
                    onClick={openCreateLineModal}
                  >
                    افزودن با فرم
                  </Button>
                  <Button
                    size="sm"
                    icon={Plus}
                    className="w-full sm:w-auto"
                    data-testid="invoice-add-row"
                    onClick={() => addExcelRow('product')}
                  >
                    ردیف سریع
                  </Button>
                </div>
              </div>

              <datalist id="invoice-excel-units">
                {COMMON_PRODUCT_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>

              {/* MODE 1: MOBILE TOUCH CARDS (< 768px) — Inline Editable + One-Tap Modal Edit */}
              <div className="space-y-3 md:hidden" data-testid="invoice-mobile-items">
                {rows.map((r, idx) => {
                  const parsed = parsedItems[idx];
                  const selectedProd = r.productId
                    ? products.find((p) => p.id === r.productId)
                    : undefined;
                  const availableStock =
                    selectedProd && selectedProd.kind === 'goods'
                      ? computeProductStock(
                          selectedProd,
                          invoicesExcludingSelf,
                          r.warehouseId || warehouseId
                        )
                      : null;

                  return (
                    <div
                      key={r.id}
                      data-testid={`invoice-mobile-row-${idx}`}
                      className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] p-3"
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-black tabular-nums text-[color:var(--brand)]">
                            ردیف {toPersianDigits(String(idx + 1))}
                          </span>
                          {availableStock !== null ? (
                            <span
                              className={cn(
                                'text-[11px] font-bold tabular-nums',
                                kind === 'sale' && parsed.quantity > availableStock
                                  ? 'text-[color:var(--expense)]'
                                  : 'text-[color:var(--muted)]'
                              )}
                            >
                              · موجودی {toPersianDigits(formatNumberWithCommas(availableStock))}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            icon={Pencil}
                            label={`ویرایش ردیف ${idx + 1} در فرم`}
                            size="sm"
                            onClick={() => openEditLineModal(r)}
                          />
                          <IconButton
                            icon={Copy}
                            label={`کپی ردیف ${idx + 1}`}
                            size="sm"
                            onClick={() => duplicateRow(r, idx)}
                          />
                          <IconButton
                            icon={Trash2}
                            label={`حذف ردیف ${idx + 1}`}
                            size="sm"
                            variant="soft-danger"
                            onClick={() => removeRow(r.id)}
                          />
                        </div>
                      </div>

                      <ProductSearchPicker
                        products={products}
                        invoicesExcludingSelf={invoicesExcludingSelf}
                        kind={kind}
                        warehouseId={r.warehouseId || warehouseId}
                        productId={r.productId}
                        productName={r.productName}
                        currentQuantity={parsed.quantity}
                        availableStock={availableStock}
                        onSelectProduct={(prod) => handleSelectProductObj(r.id, prod)}
                        onSelectCustomText={(text) =>
                          updateRow(r.id, { productId: '', productName: text })
                        }
                        onClear={() =>
                          updateRow(r.id, { productId: '', productName: '', unitPriceStr: '' })
                        }
                        onQuickCreateProduct={(prefill) => openQuickProductModal(r.id, prefill)}
                        variant="field"
                        testId={`invoice-mobile-row-product-${idx}`}
                        ariaLabel={`انتخاب کالا ردیف ${idx + 1}`}
                      />

                      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-[color:var(--muted)]">
                            تعداد
                          </label>
                          <input
                            aria-label={`تعداد ردیف ${idx + 1}`}
                            data-testid={`invoice-mobile-row-qty-${idx}`}
                            inputMode="decimal"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.45rem] !h-[2.45rem] text-center text-xs font-bold tabular-nums'
                            )}
                            value={r.quantityStr}
                            onChange={(e) =>
                              updateRow(r.id, {
                                quantityStr: persianToArabic(e.target.value).replace(/[^\d.]/g, ''),
                              })
                            }
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-[color:var(--muted)]">
                            واحد
                          </label>
                          <input
                            aria-label={`واحد ردیف ${idx + 1}`}
                            list="invoice-excel-units"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.45rem] !h-[2.45rem] text-center text-xs font-bold'
                            )}
                            value={r.unit}
                            onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                            placeholder="عدد"
                          />
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-[color:var(--muted)]">
                            قیمت واحد (تومان)
                          </label>
                          <input
                            aria-label={`قیمت واحد ردیف ${idx + 1}`}
                            data-testid={`invoice-mobile-row-price-${idx}`}
                            inputMode="numeric"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.45rem] !h-[2.45rem] text-left text-xs font-bold tabular-nums'
                            )}
                            value={
                              r.unitPriceStr
                                ? toPersianDigits(formatNumberWithCommas(r.unitPriceStr))
                                : ''
                            }
                            onChange={(e) =>
                              updateRow(r.id, {
                                unitPriceStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                              })
                            }
                            placeholder="۰"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-[color:var(--muted)]">
                            تخفیف (تومان)
                          </label>
                          <input
                            aria-label={`تخفیف ردیف ${idx + 1}`}
                            inputMode="numeric"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.45rem] !h-[2.45rem] text-left text-xs font-bold tabular-nums'
                            )}
                            value={
                              r.discountStr
                                ? toPersianDigits(formatNumberWithCommas(r.discountStr))
                                : ''
                            }
                            onChange={(e) =>
                              updateRow(r.id, {
                                discountStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                              })
                            }
                            placeholder="۰"
                          />
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[color:var(--line)]/75 pt-2.5">
                        <select
                          aria-label={`انبار ردیف ${idx + 1}`}
                          className="h-9 max-w-[10.5rem] rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/65 px-2.5 text-[11px] font-bold text-[color:var(--ink)] outline-none"
                          value={r.warehouseId}
                          onChange={(e) => updateRow(r.id, { warehouseId: e.target.value })}
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-left">
                          <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                            جمع ردیف
                          </span>
                          <span className="text-sm font-black tabular-nums text-[color:var(--ink)]">
                            {money(parsed.total)}{' '}
                            <span className="text-[10px] font-semibold text-[color:var(--muted)]">
                              تومان
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Quick Mobile Bottom Add Actions */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={openCreateLineModal}
                    className="flex min-h-[2.65rem] items-center justify-center gap-1.5 rounded-xl border border-dashed border-[color:var(--brand)]/50 bg-[color:var(--brand-soft)]/35 px-3 text-xs font-extrabold text-[color:var(--brand)] transition active:scale-[0.99]"
                  >
                    <FilePlus2 size={14} />
                    افزودن ردیف با فرم
                  </button>
                  <button
                    type="button"
                    onClick={() => addExcelRow('product')}
                    className="flex min-h-[2.65rem] items-center justify-center gap-1.5 rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-2)]/40 px-3 text-xs font-bold text-[color:var(--ink)] transition active:scale-[0.99]"
                  >
                    <Plus size={14} />
                    ردیف سریع
                  </button>
                </div>
              </div>

              {/* MODE 2: TABLET HYBRID 2-ROW EDITABLE CARDS (768px–1279px) — zero horizontal overflow */}
              <div className="hidden space-y-2.5 md:block xl:hidden" data-testid="invoice-tablet-items">
                {rows.map((r, idx) => {
                  const parsed = parsedItems[idx];
                  const selectedProd = r.productId
                    ? products.find((p) => p.id === r.productId)
                    : undefined;
                  const availableStock =
                    selectedProd && selectedProd.kind === 'goods'
                      ? computeProductStock(
                          selectedProd,
                          invoicesExcludingSelf,
                          r.warehouseId || warehouseId
                        )
                      : null;

                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] p-3"
                    >
                      {/* Row 1: # + Smart Product Picker + Warehouse + Actions */}
                      <div className="grid grid-cols-[2rem_minmax(0,1fr)_9.5rem_auto] items-center gap-2.5">
                        <span className="flex h-10 items-center justify-center rounded-lg bg-[color:var(--surface-2)]/80 text-xs font-black tabular-nums text-[color:var(--muted)]">
                          {toPersianDigits(String(idx + 1))}
                        </span>

                        <ProductSearchPicker
                          products={products}
                          invoicesExcludingSelf={invoicesExcludingSelf}
                          kind={kind}
                          warehouseId={r.warehouseId || warehouseId}
                          productId={r.productId}
                          productName={r.productName}
                          currentQuantity={parsed.quantity}
                          availableStock={availableStock}
                          onSelectProduct={(prod) => handleSelectProductObj(r.id, prod)}
                          onSelectCustomText={(text) =>
                            updateRow(r.id, { productId: '', productName: text })
                          }
                          onClear={() =>
                            updateRow(r.id, { productId: '', productName: '', unitPriceStr: '' })
                          }
                          onQuickCreateProduct={(prefill) => openQuickProductModal(r.id, prefill)}
                          variant="field"
                          testId={`invoice-tablet-row-product-${idx}`}
                          ariaLabel={`انتخاب کالا ردیف ${idx + 1}`}
                        />

                        <select
                          aria-label={`انبار ردیف ${idx + 1}`}
                          className={cn(fieldInput, '!min-h-[2.75rem] !h-[2.75rem] text-xs font-bold')}
                          value={r.warehouseId}
                          onChange={(e) => updateRow(r.id, { warehouseId: e.target.value })}
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          <IconButton
                            icon={Pencil}
                            label={`ویرایش ردیف ${idx + 1} در فرم`}
                            size="sm"
                            onClick={() => openEditLineModal(r)}
                          />
                          <IconButton
                            icon={Copy}
                            label={`کپی ردیف ${idx + 1}`}
                            size="sm"
                            onClick={() => duplicateRow(r, idx)}
                          />
                          <IconButton
                            icon={Trash2}
                            label={`حذف ردیف ${idx + 1}`}
                            size="sm"
                            variant="soft-danger"
                            onClick={() => removeRow(r.id)}
                          />
                        </div>
                      </div>

                      {/* Row 2: Qty, Unit, Price, Discount, Net Line Total */}
                      <div className="mt-2.5 grid grid-cols-[5.25rem_5.25rem_minmax(0,1fr)_7.5rem_8.5rem] items-end gap-2.5 border-t border-[color:var(--line)]/65 pt-2.5">
                        <div>
                          <label className="mb-1 block text-[10.5px] font-bold text-[color:var(--muted)]">
                            تعداد
                          </label>
                          <input
                            aria-label={`تعداد ردیف ${idx + 1}`}
                            data-testid={`invoice-tablet-row-qty-${idx}`}
                            inputMode="decimal"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.35rem] !h-[2.35rem] text-center text-xs font-bold tabular-nums'
                            )}
                            value={r.quantityStr}
                            onChange={(e) =>
                              updateRow(r.id, {
                                quantityStr: persianToArabic(e.target.value).replace(/[^\d.]/g, ''),
                              })
                            }
                            placeholder="1"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10.5px] font-bold text-[color:var(--muted)]">
                            واحد
                          </label>
                          <input
                            aria-label={`واحد ردیف ${idx + 1}`}
                            list="invoice-excel-units"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.35rem] !h-[2.35rem] text-center text-xs font-bold'
                            )}
                            value={r.unit}
                            onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                            placeholder="عدد"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10.5px] font-bold text-[color:var(--muted)]">
                            قیمت واحد (تومان)
                          </label>
                          <input
                            aria-label={`قیمت واحد ردیف ${idx + 1}`}
                            data-testid={`invoice-tablet-row-price-${idx}`}
                            inputMode="numeric"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.35rem] !h-[2.35rem] text-left text-xs font-bold tabular-nums'
                            )}
                            value={
                              r.unitPriceStr
                                ? toPersianDigits(formatNumberWithCommas(r.unitPriceStr))
                                : ''
                            }
                            onChange={(e) =>
                              updateRow(r.id, {
                                unitPriceStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                              })
                            }
                            placeholder="۰"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10.5px] font-bold text-[color:var(--muted)]">
                            تخفیف
                          </label>
                          <input
                            aria-label={`تخفیف ردیف ${idx + 1}`}
                            inputMode="numeric"
                            className={cn(
                              fieldInput,
                              '!min-h-[2.35rem] !h-[2.35rem] text-left text-xs font-bold tabular-nums'
                            )}
                            value={
                              r.discountStr
                                ? toPersianDigits(formatNumberWithCommas(r.discountStr))
                                : ''
                            }
                            onChange={(e) =>
                              updateRow(r.id, {
                                discountStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                              })
                            }
                            placeholder="۰"
                          />
                        </div>

                        <div className="flex h-[2.35rem] flex-col justify-center rounded-xl bg-[color:var(--surface-2)]/65 px-2.5 text-left">
                          <span className="text-[9.5px] font-semibold text-[color:var(--muted)]">
                            جمع ردیف
                          </span>
                          <span className="truncate text-xs font-black tabular-nums text-[color:var(--ink)]">
                            {money(parsed.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MODE 3: DESKTOP EXCEL-LIKE SPREADSHEET GRID (>= 1280px) */}
              <div
                className="hidden overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] xl:block"
                data-testid="invoice-desktop-items"
              >
                <table className="w-full table-fixed border-collapse text-right text-xs">
                  <thead>
                    <tr className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/75 text-[11px] font-extrabold text-[color:var(--muted)] divide-x divide-x-reverse divide-[color:var(--line)]/70">
                      <th className="w-10 px-2 py-2.5 text-center">#</th>
                      <th className="px-3 py-2.5">کالا / شرح ردیف</th>
                      <th className="w-32 px-2.5 py-2.5">انبار</th>
                      <th className="w-20 px-2 py-2.5 text-center">تعداد</th>
                      <th className="w-20 px-2 py-2.5 text-center">واحد</th>
                      <th className="w-32 px-2.5 py-2.5 text-left">قیمت واحد</th>
                      <th className="w-28 px-2.5 py-2.5 text-left">تخفیف</th>
                      <th className="w-32 px-3 py-2.5 text-left">جمع ردیف</th>
                      <th className="w-24 px-2 py-2.5 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--line)]">
                    {rows.map((r, idx) => {
                      const parsed = parsedItems[idx];
                      const selectedProd = r.productId
                        ? products.find((p) => p.id === r.productId)
                        : undefined;
                      const availableStock =
                        selectedProd && selectedProd.kind === 'goods'
                          ? computeProductStock(
                              selectedProd,
                              invoicesExcludingSelf,
                              r.warehouseId || warehouseId
                            )
                          : null;

                      return (
                        <tr
                          key={r.id}
                          data-testid={`invoice-desktop-row-${idx}`}
                          className="group divide-x divide-x-reverse divide-[color:var(--line)]/65 transition-colors hover:bg-[color:var(--surface-2)]/30"
                        >
                          {/* Row index */}
                          <td className="bg-[color:var(--surface-2)]/25 px-2 py-0 text-center font-bold tabular-nums text-[color:var(--muted)]">
                            {toPersianDigits(String(idx + 1))}
                          </td>

                          {/* Smart Product Search Cell */}
                          <td className="p-0 align-middle">
                            <ProductSearchPicker
                              products={products}
                              invoicesExcludingSelf={invoicesExcludingSelf}
                              kind={kind}
                              warehouseId={r.warehouseId || warehouseId}
                              productId={r.productId}
                              productName={r.productName}
                              currentQuantity={parsed.quantity}
                              availableStock={availableStock}
                              onSelectProduct={(prod) => handleSelectProductObj(r.id, prod)}
                              onSelectCustomText={(text) =>
                                updateRow(r.id, { productId: '', productName: text })
                              }
                              onClear={() =>
                                updateRow(r.id, {
                                  productId: '',
                                  productName: '',
                                  unitPriceStr: '',
                                })
                              }
                              onQuickCreateProduct={(prefill) =>
                                openQuickProductModal(r.id, prefill)
                              }
                              variant="cell"
                              testId={`invoice-row-product-${idx}`}
                              ariaLabel={`انتخاب کالا ردیف ${idx + 1}`}
                              buttonRef={registerCellRef(r.id, 'product')}
                            />
                          </td>

                          {/* Warehouse Cell */}
                          <td className="relative p-0 align-middle">
                            <select
                              aria-label={`انبار ردیف ${idx + 1}`}
                              className="h-11 w-full appearance-none bg-transparent pe-6 ps-2.5 text-xs font-semibold text-[color:var(--ink)] outline-none transition hover:bg-[color:var(--surface-2)]/40 focus:bg-[color:var(--brand-soft)]/35 focus:ring-2 focus:ring-inset focus:ring-[color:var(--brand)]"
                              value={r.warehouseId}
                              onChange={(e) => updateRow(r.id, { warehouseId: e.target.value })}
                            >
                              {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={12}
                              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                              aria-hidden
                            />
                          </td>

                          {/* Quantity Cell */}
                          <td className="p-0 align-middle">
                            <input
                              ref={registerCellRef(r.id, 'qty')}
                              aria-label={`تعداد ردیف ${idx + 1}`}
                              data-testid={`invoice-row-qty-${idx}`}
                              inputMode="decimal"
                              className="h-11 w-full bg-transparent px-2 text-center text-xs font-bold tabular-nums text-[color:var(--ink)] outline-none transition hover:bg-[color:var(--surface-2)]/40 focus:bg-[color:var(--brand-soft)]/35 focus:ring-2 focus:ring-inset focus:ring-[color:var(--brand)]"
                              value={r.quantityStr}
                              onChange={(e) =>
                                updateRow(r.id, {
                                  quantityStr: persianToArabic(e.target.value).replace(/[^\d.]/g, ''),
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'qty')}
                              placeholder="1"
                            />
                          </td>

                          {/* Unit Cell */}
                          <td className="p-0 align-middle">
                            <input
                              ref={registerCellRef(r.id, 'unit')}
                              aria-label={`واحد ردیف ${idx + 1}`}
                              list="invoice-excel-units"
                              className="h-11 w-full bg-transparent px-2 text-center text-xs font-semibold text-[color:var(--ink)] outline-none transition hover:bg-[color:var(--surface-2)]/40 focus:bg-[color:var(--brand-soft)]/35 focus:ring-2 focus:ring-inset focus:ring-[color:var(--brand)]"
                              value={r.unit}
                              onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'unit')}
                              placeholder="عدد"
                            />
                          </td>

                          {/* Unit Price Cell */}
                          <td className="p-0 align-middle">
                            <input
                              ref={registerCellRef(r.id, 'price')}
                              aria-label={`قیمت واحد ردیف ${idx + 1}`}
                              data-testid={`invoice-row-price-${idx}`}
                              inputMode="numeric"
                              className="h-11 w-full bg-transparent px-2.5 text-left text-xs font-bold tabular-nums text-[color:var(--ink)] outline-none transition hover:bg-[color:var(--surface-2)]/40 focus:bg-[color:var(--brand-soft)]/35 focus:ring-2 focus:ring-inset focus:ring-[color:var(--brand)]"
                              value={
                                r.unitPriceStr
                                  ? toPersianDigits(formatNumberWithCommas(r.unitPriceStr))
                                  : ''
                              }
                              onChange={(e) =>
                                updateRow(r.id, {
                                  unitPriceStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'price')}
                              placeholder="۰"
                            />
                          </td>

                          {/* Discount Cell */}
                          <td className="p-0 align-middle">
                            <input
                              ref={registerCellRef(r.id, 'discount')}
                              aria-label={`تخفیف ردیف ${idx + 1}`}
                              data-testid={`invoice-row-discount-${idx}`}
                              inputMode="numeric"
                              className="h-11 w-full bg-transparent px-2.5 text-left text-xs font-semibold tabular-nums text-[color:var(--ink)] outline-none transition hover:bg-[color:var(--surface-2)]/40 focus:bg-[color:var(--brand-soft)]/35 focus:ring-2 focus:ring-inset focus:ring-[color:var(--brand)]"
                              value={
                                r.discountStr
                                  ? toPersianDigits(formatNumberWithCommas(r.discountStr))
                                  : ''
                              }
                              onChange={(e) =>
                                updateRow(r.id, {
                                  discountStr: persianToArabic(e.target.value).replace(/[^\d]/g, ''),
                                })
                              }
                              onKeyDown={(e) => handleCellKeyDown(e, idx, 'discount')}
                              placeholder="۰"
                            />
                          </td>

                          {/* Computed Line Total */}
                          <td className="bg-[color:var(--surface-2)]/20 px-3 py-0 text-left font-black tabular-nums text-[color:var(--ink)]">
                            {money(parsed.total)}
                          </td>

                          {/* Row Actions: Edit Modal, Duplicate, Delete */}
                          <td className="px-1.5 py-0 text-center">
                            <div className="inline-flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                title="ویرایش در فرم"
                                aria-label={`ویرایش ردیف ${idx + 1} در فرم`}
                                data-testid={`invoice-row-edit-${idx}`}
                                onClick={() => openEditLineModal(r)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand)]"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                title="کپی ردیف"
                                aria-label={`کپی ردیف ${idx + 1}`}
                                onClick={() => duplicateRow(r, idx)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                type="button"
                                title="حذف ردیف"
                                aria-label={`حذف ردیف ${idx + 1}`}
                                onClick={() => removeRow(r.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-rose-500/10 hover:text-[color:var(--expense)]"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Excel-like Footer Strip: Quick Add Row + Column Totals */}
                  <tfoot>
                    <tr className="border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/50 text-[11.5px] font-extrabold divide-x divide-x-reverse divide-[color:var(--line)]/65">
                      <td colSpan={3} className="p-0">
                        <div className="flex items-center gap-1 px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => addExcelRow('product')}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-extrabold text-[color:var(--brand)] transition hover:bg-[color:var(--brand-soft)]"
                          >
                            <Plus size={14} />
                            افزودن ردیف اکسل
                          </button>
                          <span className="text-[color:var(--line)]">|</span>
                          <button
                            type="button"
                            onClick={openCreateLineModal}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                          >
                            <FilePlus2 size={13} />
                            افزودن با فرم
                          </button>
                          <span className="ms-auto hidden text-[10px] font-medium text-[color:var(--muted)] 2xl:inline">
                            Enter در آخرین سلول = ردیف جدید
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums text-[color:var(--ink)]">
                        {toPersianDigits(formatNumberWithCommas(totals.totalQuantity))}
                      </td>
                      <td className="px-2 py-2.5 text-center text-[10.5px] font-semibold text-[color:var(--muted)]">
                        جمع
                      </td>
                      <td className="px-2.5 py-2.5 text-left text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                        {money(totals.subtotal)}
                      </td>
                      <td className="px-2.5 py-2.5 text-left tabular-nums text-[color:var(--expense)]">
                        {totals.totalDiscount > 0 ? `−${money(totals.totalDiscount)}` : '۰'}
                      </td>
                      <td className="px-3 py-2.5 text-left text-[13px] font-black tabular-nums text-[color:var(--ink)]">
                        {money(totals.grandTotal)}
                      </td>
                      <td className="px-2 py-2.5 text-center text-[10px] font-semibold text-[color:var(--muted)]">
                        تومان
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <AmountInput
              label="مبلغ کل فاکتور (تومان)"
              value={lumpAmountRaw}
              onChange={(v) => {
                markDirty();
                setLumpAmountRaw(v);
              }}
              accent={kind === 'purchase' ? 'expense' : 'income'}
            />
          )}
        </section>

        {/* Section 2.5: Multi-Stage Receipt/Payment & Check Settlement Section */}
        <InvoiceSettlementSection
          kind={kind}
          invoiceTotal={finalDisplayAmount}
          invoiceDate={date}
          banks={banks}
          defaultBankId={defaultBankId}
          stages={settlementStages}
          onChangeStages={handleStagesChange}
        />

        {/* Section 3: Notes & Attachment | Elevated Financial Summary */}
        <section className="grid grid-cols-1 items-start gap-5 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <CollapsibleOptionalSection
              title="شرح فاکتور و فایل پیوست (اختیاری)"
              subtitle={
                description.trim() ? description.trim() : 'یادداشت، تصویر فاکتور یا فایل PDF'
              }
              filledCount={optionalFooterCount}
              defaultOpenMobile={Boolean(initialInvoice && optionalFooterCount > 0)}
              mobileOnly
              testId="invoice-optional-footer"
            >
              <div className="space-y-3.5">
                <div>
                  <label className={fieldLabel}>شرح و یادداشت فاکتور</label>
                  <input
                    className={fieldInput}
                    data-testid="invoice-desc-input"
                    value={description}
                    onChange={(e) => {
                      markDirty();
                      setDescription(e.target.value);
                    }}
                    placeholder="مثلاً خرید نهاده فصل پاییز یا فروش صادراتی محموله اول"
                  />
                </div>

                <AttachmentField
                  value={attachment}
                  onChange={(att) => {
                    markDirty();
                    setAttachment(att);
                  }}
                  label="تصویر فاکتور یا فایل PDF (اختیاری)"
                />
              </div>
            </CollapsibleOptionalSection>
          </div>

          <div className="hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/40 p-4 md:block lg:col-span-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-[color:var(--muted)]">
                جمع‌بندی مالی و وضعیت تسویه فاکتور
              </h4>
              <span className="text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                {pricingMode === 'itemized'
                  ? `${toPersianDigits(String(totals.itemCount))} قلم`
                  : 'مبلغ یکجا'}
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs sm:text-sm">
              {pricingMode === 'itemized' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">
                      جمع تعداد اقلام
                    </span>
                    <span className="font-bold tabular-nums text-[color:var(--ink)]">
                      {toPersianDigits(formatNumberWithCommas(totals.totalQuantity))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">
                      جمع ناخالص اقلام
                    </span>
                    <span className="font-bold tabular-nums text-[color:var(--ink)]">
                      {money(totals.subtotal)}{' '}
                      <span className="text-[11px] font-medium text-[color:var(--muted)]">تومان</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">
                      جمع تخفیف‌ها
                    </span>
                    <span className="font-bold tabular-nums text-[color:var(--expense)]">
                      {totals.totalDiscount > 0 ? `−${money(totals.totalDiscount)}` : '۰'}{' '}
                      <span className="text-[11px] font-medium text-[color:var(--muted)]">تومان</span>
                    </span>
                  </div>
                </>
              ) : null}

              <div className="flex items-baseline justify-between border-t border-[color:var(--line)] pt-2.5">
                <span className="text-xs font-black text-[color:var(--ink)] sm:text-sm">
                  مبلغ کل فاکتور
                </span>
                <span
                  data-testid="invoice-grand-total"
                  className={cn(
                    'text-lg font-black tabular-nums tracking-tight',
                    kind === 'purchase'
                      ? 'text-[color:var(--expense)]'
                      : 'text-[color:var(--income)]'
                  )}
                >
                  {money(finalDisplayAmount)}
                  <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">
                    تومان
                  </span>
                </span>
              </div>

              {settlementTotals.settledTotal > 0 ? (
                <div className="space-y-1.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 p-2.5 text-xs">
                  {settlementTotals.cashPaidTotal > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[color:var(--muted)]">
                        تسویه نقد و بانک ({toPersianDigits(String(settlementTotals.cashStageCount))} مرحله)
                      </span>
                      <span className="font-bold tabular-nums text-[color:var(--income)]">
                        {money(settlementTotals.cashPaidTotal)} تومان
                      </span>
                    </div>
                  ) : null}
                  {settlementTotals.checksTotal > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[color:var(--muted)]">
                        چک‌های ثبت‌شده ({toPersianDigits(String(settlementTotals.checkStageCount))} فقره)
                      </span>
                      <span className="font-bold tabular-nums text-[color:var(--brand)]">
                        {money(settlementTotals.checksTotal)} تومان
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-[color:var(--line)]/60 pt-1.5">
                    <span className="font-extrabold text-[color:var(--ink)]">
                      مانده باز در حساب شخص
                    </span>
                    <span
                      className={cn(
                        'font-black tabular-nums',
                        settlementTotals.remaining > 0
                          ? 'text-[color:var(--expense)]'
                          : 'text-[color:var(--income)]'
                      )}
                    >
                      {money(settlementTotals.remaining)} تومان
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-[color:var(--line)] pt-3.5">
              <Button variant="secondary" onClick={onCancel}>
                بستن تب
              </Button>
              <Button
                variant={kind === 'purchase' ? 'expense' : 'income'}
                icon={initialInvoice ? Check : Plus}
                data-testid="invoice-save-submit"
                onClick={() => void handleSubmit()}
              >
                {initialInvoice ? 'ذخیره تغییرات فاکتور' : 'ثبت نهایی فاکتور'}
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Sticky Bottom Action Bar (replaces hidden BottomNav) */}
      {isActive ? (
        <MobileStickyBar
          submitLabel={initialInvoice ? 'ذخیره فاکتور' : 'ثبت نهایی فاکتور'}
          onSubmit={() => void handleSubmit()}
          submitIcon={initialInvoice ? Check : Plus}
          submitVariant={kind === 'purchase' ? 'expense' : 'income'}
          onCancel={onCancel}
          cancelLabel="بستن"
          summaryLabel={
            pricingMode === 'itemized'
              ? `جمع کل (${toPersianDigits(String(totals.itemCount))} قلم)`
              : 'مبلغ نهایی فاکتور'
          }
          summaryValue={`${money(finalDisplayAmount)} تومان`}
          summaryTone={kind === 'purchase' ? 'expense' : 'income'}
          submitTestId="invoice-mobile-submit"
        />
      ) : null}

      {/* Dual-Mode Line Item Modal (Create & Edit) */}
      <InvoiceLineItemModal
        isOpen={lineModalOpen}
        mode={lineModalMode}
        initialRow={lineModalRow}
        defaultWarehouseId={warehouseId}
        kind={kind}
        products={products}
        warehouses={warehouses}
        invoicesExcludingSelf={invoicesExcludingSelf}
        onClose={() => setLineModalOpen(false)}
        onSaveRow={handleSaveLineModal}
        onQuickCreateProduct={(prefill, onCreated) =>
          openQuickProductModal(null, prefill, onCreated)
        }
      />

      {/* Quick Inline Product Creation Small Modal */}
      <FormSheet
        isOpen={quickProdOpen}
        onClose={() => setQuickProdOpen(false)}
        title="تعریف سریع کالای جدید"
        subtitle="کالا در فهرست انبار ثبت شده و بلافاصله در ردیف فاکتور انتخاب می‌شود"
        size="md"
        layer="nested"
        accent="brand"
        footer={
          <FormActions
            onCancel={() => setQuickProdOpen(false)}
            onSubmit={() => void handleQuickCreateProduct()}
            submitLabel="ثبت و انتخاب در فاکتور"
            submitIcon={Plus}
          />
        }
      >
        <div className="form-section grid grid-cols-2 items-start gap-3 sm:gap-4">
          <div className="col-span-2">
            <label className={fieldLabel}>نام کالا</label>
            <input
              className={fieldInput}
              value={qpName}
              onChange={(e) => setQpName(e.target.value)}
              placeholder="مثلاً سم قارچ‌کش یا پسته خام"
              autoFocus
            />
          </div>

          <div>
            <label className={fieldLabel}>واحد شمارش</label>
            <input
              list="quick-units-list"
              className={fieldInput}
              value={qpUnit}
              onChange={(e) => setQpUnit(e.target.value)}
            />
            <datalist id="quick-units-list">
              {COMMON_PRODUCT_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={fieldLabel}>انبار پیش‌فرض</label>
            <select className={fieldInput} value={qpWh} onChange={(e) => setQpWh(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={fieldLabel}>قیمت خرید (تومان)</label>
            <input
              className={cn(fieldInput, 'tabular-nums')}
              inputMode="numeric"
              value={qpBuy ? toPersianDigits(formatNumberWithCommas(qpBuy)) : ''}
              onChange={(e) => setQpBuy(persianToArabic(e.target.value).replace(/[^\d]/g, ''))}
              placeholder="۰"
            />
          </div>

          <div>
            <label className={fieldLabel}>قیمت فروش (تومان)</label>
            <input
              className={cn(fieldInput, 'tabular-nums')}
              inputMode="numeric"
              value={qpSale ? toPersianDigits(formatNumberWithCommas(qpSale)) : ''}
              onChange={(e) => setQpSale(persianToArabic(e.target.value).replace(/[^\d]/g, ''))}
              placeholder="۰"
            />
          </div>
        </div>
      </FormSheet>
    </div>
  );
};

export default InvoiceEditorTab;
