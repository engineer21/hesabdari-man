import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  ClipboardList,
  Layers,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import type { AppSettings, Contact, Invoice, Product, ProductKind, Warehouse } from '../types';
import { APP_NAME, DEFAULT_WAREHOUSE_ID } from '../constants';
import {
  COMMON_PRODUCT_UNITS,
  computeProductCardex,
  computeProductStock,
  computeProductStockByWarehouse,
  computeWarehouseSummary,
  isLowStock,
} from '../utils/inventoryEngine';
import {
  formatNumberWithCommas,
  parseIntegerAmount,
  persianToArabic,
  toPersianDigits,
} from '../utils/formatters';
import { formatJalaliShort } from '../utils/jalaliPeriod';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import { useDialog } from './DialogProvider';
import { ExportActions } from './export/ExportActions';
import {
  Button,
  CollapsibleOptionalSection,
  EmptyState,
  FormActions,
  FormSheet,
  IconButton,
  cn,
  fieldInput,
  fieldLabel,
} from './ui';
import { countFilledFields } from '../utils/formLayout';

interface InventoryPageProps {
  warehouses: Warehouse[];
  setWarehouses: (v: Warehouse[] | ((p: Warehouse[]) => Warehouse[])) => void;
  products: Product[];
  setProducts: (v: Product[] | ((p: Product[]) => Product[])) => void;
  invoices: Invoice[];
  contacts: Contact[];
  settings?: AppSettings;
}

const fmtNum = (n: number) => {
  const rounded = Math.round(n * 100) / 100;
  return toPersianDigits(
    Number.isInteger(rounded) ? formatNumberWithCommas(rounded) : String(rounded)
  );
};

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const InventoryPage: React.FC<InventoryPageProps> = ({
  warehouses,
  setWarehouses,
  products,
  setProducts,
  invoices,
  contacts,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canManage = can('journals.create') || can('settings.accounts');
  const canEdit = can('journals.edit') || can('settings.accounts');
  const canDelete = can('journals.delete') || can('settings.accounts');
  const storeName = settings?.name || APP_NAME;

  const [tab, setTab] = useState<'products' | 'warehouses' | 'cardex'>('products');
  const [query, setQuery] = useState('');
  const [whFilter, setWhFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ProductKind>('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Cardex selectors
  const [cardexProductId, setCardexProductId] = useState('');
  const [cardexWhFilter, setCardexWhFilter] = useState('');

  // Product Modal (Small focused modal)
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [pCode, setPCode] = useState('');
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pKind, setPKind] = useState<ProductKind>('goods');
  const [pUnit, setPUnit] = useState('کیلوگرم');
  const [pWhId, setPWhId] = useState(warehouses[0]?.id || DEFAULT_WAREHOUSE_ID);
  const [pBuyPrice, setPBuyPrice] = useState('');
  const [pSalePrice, setPSalePrice] = useState('');
  const [pOpening, setPOpening] = useState('');
  const [pMinStock, setPMinStock] = useState('');
  const [pNotes, setPNotes] = useState('');

  // Warehouse Modal (Small focused modal)
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [wCode, setWCode] = useState('');
  const [wName, setWName] = useState('');
  const [wLocation, setWLocation] = useState('');
  const [wManager, setWManager] = useState('');
  const [wIsDefault, setWIsDefault] = useState(false);
  const [wNotes, setWNotes] = useState('');

  const warehouseName = (id?: string) =>
    warehouses.find((w) => w.id === id)?.name || warehouses[0]?.name || 'انبار مرکزی';

  const productRows = useMemo(() => {
    return products.map((p) => {
      const stock = computeProductStock(p, invoices, whFilter || undefined);
      const totalStock = computeProductStock(p, invoices);
      const low = isLowStock(p, totalStock);
      const byWh = computeProductStockByWarehouse(p, warehouses, invoices);
      return { product: p, stock, totalStock, low, byWh };
    });
  }, [products, invoices, warehouses, whFilter]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productRows.filter((row) => {
      if (kindFilter !== 'all' && row.product.kind !== kindFilter) return false;
      if (onlyLowStock && !row.low) return false;
      if (!q) return true;
      return `${row.product.code} ${row.product.name} ${row.product.category || ''} ${row.product.unit}`
        .toLowerCase()
        .includes(q);
    });
  }, [productRows, kindFilter, onlyLowStock, query]);

  const warehouseSummaries = useMemo(
    () => warehouses.map((w) => computeWarehouseSummary(w, products, invoices)),
    [warehouses, products, invoices]
  );

  const totalInventoryValue = useMemo(
    () => warehouseSummaries.reduce((sum, s) => sum + s.estimatedValue, 0),
    [warehouseSummaries]
  );

  const lowStockCount = useMemo(
    () => productRows.filter((r) => r.low).length,
    [productRows]
  );

  const activeCardexProduct = useMemo(() => {
    if (cardexProductId) {
      const found = products.find((p) => p.id === cardexProductId);
      if (found) return found;
    }
    return products[0] || null;
  }, [cardexProductId, products]);

  const cardexRows = useMemo(() => {
    if (!activeCardexProduct) return [];
    return computeProductCardex(
      activeCardexProduct,
      invoices,
      warehouses,
      contacts,
      cardexWhFilter || undefined
    );
  }, [activeCardexProduct, invoices, warehouses, contacts, cardexWhFilter]);

  const openCreateProduct = () => {
    setEditingProd(null);
    const nextCode = String(1001 + products.length);
    setPCode(nextCode);
    setPName('');
    setPCategory('');
    setPKind('goods');
    setPUnit('کیلوگرم');
    setPWhId(warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || DEFAULT_WAREHOUSE_ID);
    setPBuyPrice('');
    setPSalePrice('');
    setPOpening('0');
    setPMinStock('');
    setPNotes('');
    setProdModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProd(p);
    setPCode(p.code);
    setPName(p.name);
    setPCategory(p.category || '');
    setPKind(p.kind);
    setPUnit(p.unit || 'کیلوگرم');
    setPWhId(p.defaultWarehouseId || warehouses[0]?.id || DEFAULT_WAREHOUSE_ID);
    setPBuyPrice(p.purchasePrice ? String(p.purchasePrice) : '');
    setPSalePrice(p.salePrice ? String(p.salePrice) : '');
    setPOpening(p.openingStock != null ? String(p.openingStock) : '0');
    setPMinStock(p.minStock != null ? String(p.minStock) : '');
    setPNotes(p.notes || '');
    setProdModalOpen(true);
  };

  const handleSaveProduct = async () => {
    const name = pName.trim();
    if (!name) {
      await dialog.alert({ title: 'نام کالا', message: 'نام کالا یا خدمت را وارد کنید.' });
      return;
    }
    const parseDecimal = (raw: string) => {
      const cleaned = persianToArabic(raw).replace(/,/g, '').trim();
      if (!cleaned) return undefined;
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : undefined;
    };

    const payload: Product = {
      id: editingProd ? editingProd.id : `prd_${crypto.randomUUID().slice(0, 10)}`,
      code: pCode.trim() || String(1001 + products.length),
      name,
      category: pCategory.trim() || undefined,
      kind: pKind,
      unit: pUnit.trim() || 'عدد',
      defaultWarehouseId: pKind === 'goods' ? pWhId || DEFAULT_WAREHOUSE_ID : undefined,
      purchasePrice: pBuyPrice.trim() ? parseIntegerAmount(pBuyPrice) : undefined,
      salePrice: pSalePrice.trim() ? parseIntegerAmount(pSalePrice) : undefined,
      openingStock: pKind === 'goods' ? parseDecimal(pOpening) ?? 0 : undefined,
      minStock: pKind === 'goods' ? parseDecimal(pMinStock) : undefined,
      notes: pNotes.trim() || undefined,
      isActive: true,
    };

    if (editingProd) {
      setProducts((prev) => prev.map((x) => (x.id === editingProd.id ? payload : x)));
    } else {
      setProducts((prev) => [payload, ...prev]);
    }
    setProdModalOpen(false);
  };

  const handleDeleteProduct = async (p: Product) => {
    const usedInInvoice = invoices.some((inv) =>
      inv.items?.some((it) => it.productId === p.id)
    );
    if (usedInInvoice) {
      await dialog.alert({
        title: 'امکان حذف نیست',
        message: 'این کالا در یک یا چند فاکتور ثبت شده است و قابل حذف نیست.',
      });
      return;
    }
    const ok = await dialog.confirm({
      title: 'حذف کالا',
      message: `کالای «${p.name}» حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف کالا',
    });
    if (ok) {
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    }
  };

  const openCreateWarehouse = () => {
    setEditingWh(null);
    setWCode(String(101 + warehouses.length));
    setWName('');
    setWLocation('');
    setWManager('');
    setWIsDefault(warehouses.length === 0);
    setWNotes('');
    setWhModalOpen(true);
  };

  const openEditWarehouse = (w: Warehouse) => {
    setEditingWh(w);
    setWCode(w.code);
    setWName(w.name);
    setWLocation(w.location || '');
    setWManager(w.managerName || '');
    setWIsDefault(Boolean(w.isDefault));
    setWNotes(w.notes || '');
    setWhModalOpen(true);
  };

  const handleSaveWarehouse = async () => {
    const name = wName.trim();
    if (!name) {
      await dialog.alert({ title: 'نام انبار', message: 'نام انبار را وارد کنید.' });
      return;
    }
    const nextId = editingWh ? editingWh.id : `wh_${crypto.randomUUID().slice(0, 10)}`;
    const payload: Warehouse = {
      id: nextId,
      code: wCode.trim() || String(101 + warehouses.length),
      name,
      location: wLocation.trim() || undefined,
      managerName: wManager.trim() || undefined,
      notes: wNotes.trim() || undefined,
      isDefault: wIsDefault,
      isActive: true,
    };

    setWarehouses((prev) => {
      const updated = editingWh
        ? prev.map((x) => (x.id === editingWh.id ? payload : x))
        : [...prev, payload];
      if (!wIsDefault) return updated;
      return updated.map((x) => ({ ...x, isDefault: x.id === nextId }));
    });
    setWhModalOpen(false);
  };

  const handleDeleteWarehouse = async (w: Warehouse) => {
    if (warehouses.length <= 1) {
      await dialog.alert({
        title: 'حداقل یک انبار لازم است',
        message: 'حداقل یک انبار فعال باید در سیستم وجود داشته باشد.',
      });
      return;
    }
    const used =
      products.some((p) => p.defaultWarehouseId === w.id) ||
      invoices.some(
        (inv) =>
          inv.warehouseId === w.id ||
          inv.items?.some((it) => it.warehouseId === w.id)
      );
    if (used) {
      await dialog.alert({
        title: 'امکان حذف نیست',
        message: 'این انبار به کالاها یا فاکتورها متصل است. ابتدا انبار آن‌ها را تغییر دهید.',
      });
      return;
    }
    const ok = await dialog.confirm({
      title: 'حذف انبار',
      message: `انبار «${w.name}» حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف انبار',
    });
    if (ok) {
      setWarehouses((prev) => prev.filter((x) => x.id !== w.id));
    }
  };

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      filteredProducts.map((r) => ({
        کد: r.product.code,
        'نام کالا / خدمت': r.product.name,
        نوع: r.product.kind === 'service' ? 'خدمت' : 'کالا',
        دسته‌بندی: r.product.category || '—',
        واحد: r.product.unit,
        'انبار پیش‌فرض':
          r.product.kind === 'goods' ? warehouseName(r.product.defaultWarehouseId) : '—',
        'موجودی فعلی': r.product.kind === 'goods' ? r.stock : 0,
        'قیمت خرید': r.product.purchasePrice || 0,
        'قیمت فروش': r.product.salePrice || 0,
      })),
      'موجودی کالاها',
      'inventory-products'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    await downloadTableReportPdf({
      title: 'گزارش موجودی کالاها و انبارها',
      storeName,
      subtitle: `${toPersianDigits(String(filteredProducts.length))} قلم کالا و خدمت`,
      pageSize,
      filename: `inventory-${pageSize}`,
      columns: [
        { header: 'کد', width: 0.7, align: 'right' },
        { header: 'نام کالا', width: 2.1, align: 'right' },
        { header: 'انبار', width: 1.3, align: 'right' },
        { header: 'موجودی', width: 1.0, align: 'amount' },
        { header: 'فی خرید', width: 1.2, align: 'amount' },
        { header: 'فی فروش', width: 1.2, align: 'amount' },
      ],
      rows: filteredProducts.map((r) => [
        toPersianDigits(r.product.code),
        r.product.name,
        r.product.kind === 'goods' ? warehouseName(r.product.defaultWarehouseId) : 'خدمت',
        r.product.kind === 'goods' ? `${fmtNum(r.stock)} ${r.product.unit}` : '—',
        r.product.purchasePrice ? formatMoneyFa(r.product.purchasePrice) : '—',
        r.product.salePrice ? formatMoneyFa(r.product.salePrice) : '—',
      ]),
      summary: [
        { label: 'تعداد انبارها', value: toPersianDigits(String(warehouses.length)) },
        { label: 'ارزش تخمینی موجودی', value: formatMoneyFa(totalInventoryValue) },
      ],
    });
  };

  const openCardexFor = (productId: string) => {
    setCardexProductId(productId);
    setCardexWhFilter(whFilter);
    setTab('cardex');
  };

  return (
    <div className="animate-page-enter space-y-5 md:space-y-6" data-testid="inventory-page">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
            کالاها و انبارها
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm">
            تعریف انبارها، کالاها و خدمات، کنترل موجودی لحظه‌ای و کاردکس متصل به فاکتورهای خرید و فروش
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canManage ? (
            <>
              <Button
                size="md"
                variant="secondary"
                icon={WarehouseIcon}
                data-testid="inventory-add-warehouse"
                onClick={openCreateWarehouse}
              >
                انبار جدید
              </Button>
              <Button
                size="md"
                icon={Plus}
                data-testid="inventory-add-product"
                onClick={openCreateProduct}
              >
                تعریف کالای جدید
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="balance-gradient relative overflow-hidden rounded-[1.5rem] p-5 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Boxes size={18} />
            </span>
            <p className="text-sm font-bold text-white/90">ارزش تخمینی انبارها</p>
          </div>
          <p className="mt-4 truncate text-2xl font-black tabular-nums tracking-tight">
            {money(totalInventoryValue)}
            <span className="ms-1.5 text-xs font-bold text-white/80">تومان</span>
          </p>
          <p className="mt-2 text-xs font-semibold text-white/80 tabular-nums">
            در {toPersianDigits(String(warehouses.length))} انبار فعال
          </p>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">کالاها و خدمات</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[color:var(--ink)]">
                {toPersianDigits(String(products.length))}
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl tone-brand">
              <Package size={20} />
            </span>
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted)] tabular-nums">
            {toPersianDigits(String(products.filter((p) => p.kind === 'goods').length))} کالای انباری ·{' '}
            {toPersianDigits(String(products.filter((p) => p.kind === 'service').length))} خدمت
          </p>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">انبارهای تعریف‌شده</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[color:var(--ink)]">
                {toPersianDigits(String(warehouses.length))}
              </p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl tone-info">
              <WarehouseIcon size={20} />
            </span>
          </div>
          <p className="mt-2 truncate text-xs text-[color:var(--muted)]">
            پیش‌فرض: {warehouses.find((w) => w.isDefault)?.name || warehouses[0]?.name || '—'}
          </p>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">کالاهای کم‌موجودی</p>
              <p
                className={cn(
                  'mt-2 text-2xl font-black tabular-nums',
                  lowStockCount > 0 ? 'text-[color:var(--expense)]' : 'text-[color:var(--income)]'
                )}
              >
                {toPersianDigits(String(lowStockCount))}
              </p>
            </div>
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl',
                lowStockCount > 0 ? 'tone-expense' : 'tone-income'
              )}
            >
              <AlertTriangle size={20} />
            </span>
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            {lowStockCount > 0 ? 'موجودی کمتر یا مساوی نقطه سفارش' : 'موجودی همه کالاها مطلوب است'}
          </p>
        </div>
      </section>

      {/* Main Workspace Card */}
      <section className="dash-card p-4 md:p-5">
        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3.5">
          <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1 sm:inline-flex sm:w-auto">
            {(
              [
                { id: 'products', label: 'کالاها و خدمات', icon: Package },
                { id: 'warehouses', label: 'انبارها', icon: WarehouseIcon },
                { id: 'cardex', label: 'کاردکس و گردش انبار', icon: ClipboardList },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`inventory-tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-extrabold transition sm:flex-none sm:px-3.5 sm:text-xs',
                    tab === t.id
                      ? 'btn-brand-gradient text-white shadow-sm'
                      : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                  )}
                >
                  <Icon size={14} aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === 'products' && filteredProducts.length > 0 ? (
            <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="journals.export" />
          ) : null}
        </div>

        {/* TAB 1: PRODUCTS */}
        {tab === 'products' ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-10 min-w-[13rem] flex-1 items-center gap-2.5 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 px-3.5 focus-within:border-[color:var(--brand)]">
                <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                <input
                  aria-label="جست‌وجوی کالا"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="کد، نام کالا، دسته‌بندی یا واحد..."
                />
              </div>

              <span className="relative inline-flex shrink-0">
                <select
                  aria-label="فیلتر انبار"
                  value={whFilter}
                  onChange={(e) => setWhFilter(e.target.value)}
                  className="h-10 appearance-none rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-8 ps-3 text-xs font-bold text-[color:var(--ink)] outline-none"
                >
                  <option value="">همه انبارها (موجودی کل)</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                  aria-hidden
                />
              </span>

              <span className="relative inline-flex shrink-0">
                <select
                  aria-label="فیلتر نوع"
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as 'all' | ProductKind)}
                  className="h-10 appearance-none rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-8 ps-3 text-xs font-bold text-[color:var(--ink)] outline-none"
                >
                  <option value="all">همه (کالا و خدمت)</option>
                  <option value="goods">فقط کالاهای انباری</option>
                  <option value="service">فقط خدمات</option>
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                  aria-hidden
                />
              </span>

              <button
                type="button"
                onClick={() => setOnlyLowStock((v) => !v)}
                className={cn(
                  'h-10 rounded-xl border px-3 text-xs font-bold transition',
                  onlyLowStock
                    ? 'border-[color:var(--expense)] bg-[color:var(--expense-soft)] text-[color:var(--expense)]'
                    : 'border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                کم‌موجودی‌ها
              </button>
            </div>

            {products.length === 0 ? (
              <EmptyState
                title="هنوز کالایی تعریف نشده است"
                description="کالاها و خدمات کسب‌وکار خود را تعریف کنید تا هنگام ثبت فاکتور خرید و فروش، قیمت و موجودی انبار به‌صورت خودکار محاسبه شود."
                action={
                  canManage ? (
                    <Button icon={Plus} onClick={openCreateProduct}>
                      تعریف اولین کالا
                    </Button>
                  ) : undefined
                }
              />
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm font-bold text-[color:var(--muted)]">
                کالایی با این جست‌وجو پیدا نشد.
              </div>
            ) : (
              <>
                {/* Desktop & Tablet Table */}
                <div className="hidden overflow-x-auto rounded-2xl border border-[color:var(--line)] md:block">
                  <table className="w-full min-w-[740px] text-right text-sm" data-testid="inventory-products-table">
                    <thead className="bg-[color:var(--surface-2)]/85 text-xs font-extrabold text-[color:var(--muted)]">
                      <tr>
                        <th className="px-4 py-3">کد</th>
                        <th className="px-4 py-3">نام کالا / خدمت</th>
                        <th className="px-4 py-3">انبار پیش‌فرض</th>
                        <th className="px-4 py-3 text-left">موجودی فعلی</th>
                        <th className="px-4 py-3 text-left">فی خرید (تومان)</th>
                        <th className="px-4 py-3 text-left">فی فروش (تومان)</th>
                        <th className="px-4 py-3 text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--line)] bg-[color:var(--surface-solid)]/55">
                      {filteredProducts.map(({ product: p, stock, low }) => (
                        <tr
                          key={p.id}
                          className="transition hover:bg-[color:var(--surface-2)]/55"
                          data-testid="inventory-product-row"
                        >
                          <td className="px-4 py-3 font-bold tabular-nums text-[color:var(--muted)]">
                            {toPersianDigits(p.code)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-[color:var(--ink)]">{p.name}</span>
                              {p.kind === 'service' ? (
                                <span className="rounded-md bg-[color:var(--surface-2)] px-2 py-0.5 text-[10.5px] font-bold text-[color:var(--muted)]">
                                  خدمت
                                </span>
                              ) : null}
                              {low ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--expense-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[color:var(--expense)]">
                                  <AlertTriangle size={11} />
                                  کم‌موجودی
                                </span>
                              ) : null}
                            </div>
                            {p.category ? (
                              <p className="mt-0.5 text-xs text-[color:var(--muted)]">{p.category}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-[color:var(--ink)]">
                            {p.kind === 'goods' ? warehouseName(p.defaultWarehouseId) : '—'}
                          </td>
                          <td className="px-4 py-3 text-left font-black tabular-nums">
                            {p.kind === 'goods' ? (
                              <span
                                className={cn(
                                  stock < 0 || low
                                    ? 'text-[color:var(--expense)]'
                                    : 'text-[color:var(--income)]'
                                )}
                              >
                                {fmtNum(stock)}{' '}
                                <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                                  {p.unit}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-[color:var(--muted)]">
                                خدمتی ({p.unit})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--ink)]">
                            {p.purchasePrice ? money(p.purchasePrice) : '—'}
                          </td>
                          <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--brand)]">
                            {p.salePrice ? money(p.salePrice) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={ClipboardList}
                                onClick={() => openCardexFor(p.id)}
                              >
                                کاردکس
                              </Button>
                              {canEdit ? (
                                <IconButton
                                  icon={Pencil}
                                  label={`ویرایش ${p.name}`}
                                  size="sm"
                                  onClick={() => openEditProduct(p)}
                                />
                              ) : null}
                              {canDelete ? (
                                <IconButton
                                  icon={Trash2}
                                  label={`حذف ${p.name}`}
                                  size="sm"
                                  variant="soft-danger"
                                  onClick={() => void handleDeleteProduct(p)}
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Product Cards */}
                <div className="space-y-2.5 md:hidden" data-testid="inventory-products-mobile">
                  {filteredProducts.map(({ product: p, stock, low }) => (
                    <div
                      key={p.id}
                      data-testid="inventory-product-card"
                      className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 p-3.5 shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-[color:var(--surface-2)] px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-[color:var(--muted)]">
                              کد {toPersianDigits(p.code)}
                            </span>
                            {p.kind === 'service' ? (
                              <span className="rounded-md bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[color:var(--brand)]">
                                خدمت
                              </span>
                            ) : null}
                            {low ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--expense-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[color:var(--expense)]">
                                <AlertTriangle size={11} />
                                کم‌موجودی
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-1.5 text-sm font-black text-[color:var(--ink)]">{p.name}</h3>
                          <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">
                            {[p.category, p.kind === 'goods' ? warehouseName(p.defaultWarehouseId) : 'خدمتی']
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>

                        <div className="shrink-0 text-left">
                          <span className="block text-[10px] font-bold text-[color:var(--muted)]">
                            موجودی
                          </span>
                          {p.kind === 'goods' ? (
                            <span
                              className={cn(
                                'mt-0.5 block text-sm font-black tabular-nums',
                                stock < 0 || low
                                  ? 'text-[color:var(--expense)]'
                                  : 'text-[color:var(--income)]'
                              )}
                            >
                              {fmtNum(stock)}{' '}
                              <span className="text-[10.5px] font-semibold text-[color:var(--muted)]">
                                {p.unit}
                              </span>
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-xs font-bold text-[color:var(--muted)]">
                              {p.unit}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[color:var(--surface-2)]/60 px-3 py-2 text-xs tabular-nums">
                        <div>
                          <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                            فی خرید
                          </span>
                          <span className="font-extrabold text-[color:var(--ink)]">
                            {p.purchasePrice ? `${money(p.purchasePrice)} تومان` : '—'}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                            فی فروش
                          </span>
                          <span className="font-extrabold text-[color:var(--brand)]">
                            {p.salePrice ? `${money(p.salePrice)} تومان` : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-0.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={ClipboardList}
                          onClick={() => openCardexFor(p.id)}
                        >
                          کاردکس کالا
                        </Button>
                        <div className="flex items-center gap-1">
                          {canEdit ? (
                            <IconButton
                              icon={Pencil}
                              label={`ویرایش ${p.name}`}
                              size="sm"
                              onClick={() => openEditProduct(p)}
                            />
                          ) : null}
                          {canDelete ? (
                            <IconButton
                              icon={Trash2}
                              label={`حذف ${p.name}`}
                              size="sm"
                              variant="soft-danger"
                              onClick={() => void handleDeleteProduct(p)}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* TAB 2: WAREHOUSES */}
        {tab === 'warehouses' ? (
          <div className="mt-4 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3" data-testid="inventory-warehouses-grid">
            {warehouseSummaries.map((s) => (
              <div
                key={s.warehouse.id}
                className="flex flex-col justify-between rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/75 p-4 transition hover:border-[color:var(--brand)]/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl tone-brand">
                        <WarehouseIcon size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-sm font-black text-[color:var(--ink)]">
                            {s.warehouse.name}
                          </h3>
                          {s.warehouse.isDefault ? (
                            <span className="rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-extrabold text-[color:var(--brand)]">
                              پیش‌فرض
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs font-semibold tabular-nums text-[color:var(--muted)]">
                          کد {toPersianDigits(s.warehouse.code)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canEdit ? (
                        <IconButton
                          icon={Pencil}
                          label={`ویرایش ${s.warehouse.name}`}
                          size="sm"
                          onClick={() => openEditWarehouse(s.warehouse)}
                        />
                      ) : null}
                      {canDelete ? (
                        <IconButton
                          icon={Trash2}
                          label={`حذف ${s.warehouse.name}`}
                          size="sm"
                          variant="soft-danger"
                          onClick={() => void handleDeleteWarehouse(s.warehouse)}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-[color:var(--muted)]">
                    {s.warehouse.location ? (
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="shrink-0" />
                        <span className="truncate">{s.warehouse.location}</span>
                      </p>
                    ) : null}
                    {s.warehouse.managerName ? (
                      <p>انباردار / مسئول: {s.warehouse.managerName}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[color:var(--line)] pt-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[color:var(--muted)]">اقلام کالا</p>
                    <p className="mt-0.5 text-sm font-black tabular-nums text-[color:var(--ink)]">
                      {toPersianDigits(String(s.productCount))} قلم
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold text-[color:var(--muted)]">ارزش موجودی</p>
                    <p className="mt-0.5 text-sm font-black tabular-nums text-[color:var(--brand)]">
                      {money(s.estimatedValue)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* TAB 3: CARDEX */}
        {tab === 'cardex' ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>انتخاب کالا برای مشاهده کاردکس</label>
                <select
                  className={fieldInput}
                  value={activeCardexProduct?.id || ''}
                  onChange={(e) => setCardexProductId(e.target.value)}
                >
                  {products.length === 0 ? (
                    <option value="">کالایی تعریف نشده</option>
                  ) : (
                    products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{toPersianDigits(p.code)}] {p.name} ({p.unit})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>فیلتر انبار</label>
                <select
                  className={fieldInput}
                  value={cardexWhFilter}
                  onChange={(e) => setCardexWhFilter(e.target.value)}
                >
                  <option value="">همه انبارها</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!activeCardexProduct ? (
              <EmptyState title="کالایی انتخاب نشده است" description="ابتدا در تب کالاها یک کالا تعریف کنید." />
            ) : cardexRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm font-bold text-[color:var(--muted)]">
                هنوز هیچ ورودی یا خروجی برای «{activeCardexProduct.name}» ثبت نشده است.
              </div>
            ) : (
              <>
                {/* Desktop & Tablet Cardex Table */}
                <div className="hidden overflow-x-auto rounded-2xl border border-[color:var(--line)] md:block">
                  <table className="w-full min-w-[720px] text-right text-sm">
                    <thead className="bg-[color:var(--surface-2)]/85 text-xs font-extrabold text-[color:var(--muted)]">
                      <tr>
                        <th className="px-4 py-3">تاریخ</th>
                        <th className="px-4 py-3">نوع حرکت</th>
                        <th className="px-4 py-3">انبار</th>
                        <th className="px-4 py-3">طرف‌حساب / شرح</th>
                        <th className="px-4 py-3 text-left">ورودی (+)</th>
                        <th className="px-4 py-3 text-left">خروجی (-)</th>
                        <th className="px-4 py-3 text-left">مانده انبار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--line)] bg-[color:var(--surface-solid)]/55">
                      {cardexRows.map((row) => (
                        <tr key={row.id} className="hover:bg-[color:var(--surface-2)]/50">
                          <td className="px-4 py-3 text-xs font-bold tabular-nums text-[color:var(--muted)]">
                            {row.kind === 'opening' ? 'اول دوره' : formatJalaliShort(row.date)}
                          </td>
                          <td className="px-4 py-3">
                            {row.kind === 'opening' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--brand)]">
                                <Layers size={13} />
                                موجودی اول دوره
                              </span>
                            ) : row.kind === 'purchase' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--income)]">
                                <ArrowDownLeft size={13} />
                                ورود (خرید #{toPersianDigits(row.invoiceNumber || '')})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--expense)]">
                                <ArrowUpRight size={13} />
                                خروج (فروش #{toPersianDigits(row.invoiceNumber || '')})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-[color:var(--ink)]">
                            {row.warehouseName}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-[color:var(--ink)]">{row.partyName}</p>
                            <p className="text-[11px] text-[color:var(--muted)]">{row.description}</p>
                          </td>
                          <td className="px-4 py-3 text-left font-black tabular-nums text-[color:var(--income)]">
                            {row.quantityIn > 0 ? `+${fmtNum(row.quantityIn)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-left font-black tabular-nums text-[color:var(--expense)]">
                            {row.quantityOut > 0 ? `-${fmtNum(row.quantityOut)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-left font-black tabular-nums text-[color:var(--ink)]">
                            {fmtNum(row.runningStock)}{' '}
                            <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                              {activeCardexProduct.unit}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cardex Movement Cards */}
                <div className="space-y-2.5 md:hidden" data-testid="inventory-cardex-mobile">
                  {cardexRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 p-3.5 shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {row.kind === 'opening' ? (
                          <span className="inline-flex items-center gap-1 rounded-full tone-brand px-2.5 py-0.5 text-[11px] font-extrabold">
                            <Layers size={12} />
                            موجودی اول دوره
                          </span>
                        ) : row.kind === 'purchase' ? (
                          <span className="inline-flex items-center gap-1 rounded-full tone-income px-2.5 py-0.5 text-[11px] font-extrabold">
                            <ArrowDownLeft size={12} />
                            ورود (خرید #{toPersianDigits(row.invoiceNumber || '')})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full tone-expense px-2.5 py-0.5 text-[11px] font-extrabold">
                            <ArrowUpRight size={12} />
                            خروج (فروش #{toPersianDigits(row.invoiceNumber || '')})
                          </span>
                        )}
                        <span className="text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                          {row.kind === 'opening' ? 'اول دوره' : formatJalaliShort(row.date)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-extrabold text-[color:var(--ink)]">{row.partyName}</p>
                          <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                            {row.warehouseName}
                            {row.description ? ` · ${row.description}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-left tabular-nums">
                          {row.quantityIn > 0 ? (
                            <p className="text-sm font-black text-[color:var(--income)]">
                              +{fmtNum(row.quantityIn)} {activeCardexProduct.unit}
                            </p>
                          ) : row.quantityOut > 0 ? (
                            <p className="text-sm font-black text-[color:var(--expense)]">
                              -{fmtNum(row.quantityOut)} {activeCardexProduct.unit}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-[10.5px] font-bold text-[color:var(--muted)]">
                            مانده: {fmtNum(row.runningStock)} {activeCardexProduct.unit}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </section>

      {/* SMALL MODAL 1: Create / Edit Product */}
      <FormSheet
        isOpen={prodModalOpen}
        onClose={() => setProdModalOpen(false)}
        title={editingProd ? 'ویرایش کالا / خدمت' : 'تعریف کالا یا خدمت جدید'}
        subtitle="مشخصات پایه، واحد شمارش، انبار پیش‌فرض و نرخ‌های خرید و فروش"
        size="lg"
        accent="brand"
        footer={
          <FormActions
            onCancel={() => setProdModalOpen(false)}
            onSubmit={() => void handleSaveProduct()}
            submitLabel={editingProd ? 'ذخیره تغییرات' : 'ثبت کالا'}
            submitIcon={editingProd ? Check : Plus}
          />
        }
      >
        <div className="space-y-4">
          {/* Type segmented toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1">
            <button
              type="button"
              onClick={() => setPKind('goods')}
              className={cn(
                'rounded-lg py-2 text-xs font-extrabold transition',
                pKind === 'goods'
                  ? 'btn-brand-gradient text-white shadow-xs'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              کالای فیزیکی (انباردار)
            </button>
            <button
              type="button"
              onClick={() => setPKind('service')}
              className={cn(
                'rounded-lg py-2 text-xs font-extrabold transition',
                pKind === 'service'
                  ? 'btn-brand-gradient text-white shadow-xs'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              خدمت / کارمزد (بدون انبار)
            </button>
          </div>

          <div className="form-section space-y-3.5 sm:space-y-4">
            <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div className="sm:col-span-2">
                <label className={fieldLabel}>نام کالا / خدمت</label>
                <input
                  className={fieldInput}
                  data-testid="product-name-input"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="مثلاً پسته اکبری خندان"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-4">
                <div>
                  <label className={fieldLabel}>کد کالا</label>
                  <input
                    className={cn(fieldInput, 'tabular-nums')}
                    value={pCode}
                    onChange={(e) => setPCode(e.target.value)}
                    placeholder="مثلاً ۱۰۰۱"
                  />
                </div>

                <div>
                  <label className={fieldLabel}>واحد شمارش</label>
                  <input
                    list="common-product-units"
                    className={fieldInput}
                    value={pUnit}
                    onChange={(e) => setPUnit(e.target.value)}
                    placeholder="کیلوگرم، کیسه..."
                  />
                  <datalist id="common-product-units">
                    {COMMON_PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-4">
                <div>
                  <label className={fieldLabel}>قیمت خرید پیش‌فرض (تومان)</label>
                  <input
                    className={cn(fieldInput, 'tabular-nums')}
                    inputMode="numeric"
                    data-testid="product-buy-price"
                    value={pBuyPrice ? toPersianDigits(formatNumberWithCommas(pBuyPrice)) : ''}
                    onChange={(e) => setPBuyPrice(persianToArabic(e.target.value).replace(/[^\d]/g, ''))}
                    placeholder="۰"
                  />
                </div>

                <div>
                  <label className={fieldLabel}>قیمت فروش پیش‌فرض (تومان)</label>
                  <input
                    className={cn(fieldInput, 'tabular-nums')}
                    inputMode="numeric"
                    data-testid="product-sale-price"
                    value={pSalePrice ? toPersianDigits(formatNumberWithCommas(pSalePrice)) : ''}
                    onChange={(e) => setPSalePrice(persianToArabic(e.target.value).replace(/[^\d]/g, ''))}
                    placeholder="۰"
                  />
                </div>
              </div>
            </div>

            <CollapsibleOptionalSection
              title="انبار، موجودی اول دوره و جزئیات (اختیاری)"
              subtitle={
                pKind === 'goods'
                  ? `${warehouses.find((w) => w.id === pWhId)?.name || 'انبار'} · موجودی اولیه: ${toPersianDigits(pOpening || '0')}`
                  : 'دسته‌بندی و توضیحات تکمیلی'
              }
              filledCount={countFilledFields([
                pCategory,
                pKind === 'goods' ? pWhId : '',
                pKind === 'goods' ? Number(pOpening) || 0 : 0,
                pKind === 'goods' ? Number(pMinStock) || 0 : 0,
                pNotes,
              ])}
              mobileOnly
              testId="product-optional-section"
            >
              <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className={fieldLabel}>دسته‌بندی (اختیاری)</label>
                  <input
                    className={fieldInput}
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    placeholder="مثلاً محصولات پسته، سم و کود"
                  />
                </div>

                {pKind === 'goods' ? (
                  <div>
                    <label className={fieldLabel}>انبار پیش‌فرض</label>
                    <select
                      className={fieldInput}
                      value={pWhId}
                      onChange={(e) => setPWhId(e.target.value)}
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} (کد {toPersianDigits(w.code)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {pKind === 'goods' ? (
                  <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-4">
                    <div>
                      <label className={fieldLabel}>موجودی اول دوره ({pUnit || 'واحد'})</label>
                      <input
                        className={cn(fieldInput, 'tabular-nums')}
                        inputMode="decimal"
                        data-testid="product-opening-stock"
                        value={pOpening}
                        onChange={(e) => setPOpening(persianToArabic(e.target.value).replace(/[^\d.]/g, ''))}
                        placeholder="۰"
                      />
                    </div>

                    <div>
                      <label className={fieldLabel}>نقطه سفارش (حداقل)</label>
                      <input
                        className={cn(fieldInput, 'tabular-nums')}
                        inputMode="decimal"
                        value={pMinStock}
                        onChange={(e) => setPMinStock(persianToArabic(e.target.value).replace(/[^\d.]/g, ''))}
                        placeholder="اختیاری (مثلاً ۲۰)"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="sm:col-span-2">
                  <label className={fieldLabel}>توضیحات تکمیلی (اختیاری)</label>
                  <input
                    className={fieldInput}
                    value={pNotes}
                    onChange={(e) => setPNotes(e.target.value)}
                    placeholder="مشخصات فنی، کیفیت یا شرایط نگهداری..."
                  />
                </div>
              </div>
            </CollapsibleOptionalSection>
          </div>
        </div>
      </FormSheet>

      {/* SMALL MODAL 2: Create / Edit Warehouse */}
      <FormSheet
        isOpen={whModalOpen}
        onClose={() => setWhModalOpen(false)}
        title={editingWh ? 'ویرایش انبار' : 'تعریف انبار جدید'}
        subtitle="محل نگهداری کالاها جهت اتصال مستقیم به فاکتورهای خرید و فروش"
        size="md"
        accent="brand"
        footer={
          <FormActions
            onCancel={() => setWhModalOpen(false)}
            onSubmit={() => void handleSaveWarehouse()}
            submitLabel={editingWh ? 'ذخیره تغییرات' : 'ثبت انبار'}
            submitIcon={editingWh ? Check : Plus}
          />
        }
      >
        <div className="form-section space-y-3.5 sm:space-y-4">
          <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className={fieldLabel}>نام انبار</label>
              <input
                className={fieldInput}
                data-testid="warehouse-name-input"
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                placeholder="مثلاً انبار سردخانه باغ"
                autoFocus
              />
            </div>

            <div>
              <label className={fieldLabel}>کد انبار</label>
              <input
                className={cn(fieldInput, 'tabular-nums')}
                value={wCode}
                onChange={(e) => setWCode(e.target.value)}
                placeholder="مثلاً ۱۰۲"
              />
            </div>

            <label className="sm:col-span-2 flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 px-3.5 py-2.5 text-xs font-bold text-[color:var(--ink)]">
              <input
                type="checkbox"
                checked={wIsDefault}
                onChange={(e) => setWIsDefault(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--brand)]"
              />
              تنظیم به عنوان انبار پیش‌فرض فاکتورها و کالاهای جدید
            </label>
          </div>

          <CollapsibleOptionalSection
            title="نشانی، مسئول انبار و توضیحات (اختیاری)"
            filledCount={countFilledFields([wLocation, wManager, wNotes])}
            mobileOnly
            testId="warehouse-optional-section"
          >
            <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div>
                <label className={fieldLabel}>محل / نشانی (اختیاری)</label>
                <input
                  className={fieldInput}
                  value={wLocation}
                  onChange={(e) => setWLocation(e.target.value)}
                  placeholder="مثلاً سوله ۲ یا باغ شمالی"
                />
              </div>

              <div>
                <label className={fieldLabel}>مسئول / انباردار (اختیاری)</label>
                <input
                  className={fieldInput}
                  value={wManager}
                  onChange={(e) => setWManager(e.target.value)}
                  placeholder="نام مسئول انبار"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={fieldLabel}>توضیحات (اختیاری)</label>
                <input
                  className={fieldInput}
                  value={wNotes}
                  onChange={(e) => setWNotes(e.target.value)}
                  placeholder="یادداشت درباره ظرفیت یا نوع کالاها"
                />
              </div>
            </div>
          </CollapsibleOptionalSection>
        </div>
      </FormSheet>
    </div>
  );
};

export default InventoryPage;
