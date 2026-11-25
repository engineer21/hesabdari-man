import type { Contact, Invoice, InvoiceLineItem, Product, Warehouse } from '../types';
import { DEFAULT_WAREHOUSE_ID } from '../constants';

export interface InvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  grandTotal: number;
  itemCount: number;
  totalQuantity: number;
}

export interface ProductWarehouseStock {
  warehouseId: string;
  warehouseName: string;
  stock: number;
}

export interface WarehouseSummary {
  warehouse: Warehouse;
  productCount: number;
  totalUnits: number;
  lowStockCount: number;
  estimatedValue: number;
}

export interface ProductCardexRow {
  id: string;
  date: string;
  kind: 'opening' | 'purchase' | 'sale';
  warehouseId: string;
  warehouseName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  partyName: string;
  quantityIn: number;
  quantityOut: number;
  unitPrice: number;
  lineTotal: number;
  runningStock: number;
  description: string;
}

export const COMMON_PRODUCT_UNITS = [
  'کیلوگرم',
  'کیسه',
  'عدد',
  'لیتر',
  'کارتن',
  'بسته',
  'تن',
  'متر',
  'خدمت',
] as const;

export function computeLineTotal(item: {
  quantity: number;
  unitPrice: number;
  discount?: number;
}): number {
  const qty = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
  const price = Number.isFinite(item.unitPrice) ? Math.max(0, item.unitPrice) : 0;
  const discount = Number.isFinite(item.discount) ? Math.max(0, item.discount || 0) : 0;
  return Math.max(0, Math.round(qty * price - discount));
}

export function computeInvoiceTotals(items: readonly InvoiceLineItem[] | undefined): InvoiceTotals {
  if (!items || items.length === 0) {
    return { subtotal: 0, totalDiscount: 0, grandTotal: 0, itemCount: 0, totalQuantity: 0 };
  }
  let subtotal = 0;
  let totalDiscount = 0;
  let grandTotal = 0;
  let totalQuantity = 0;

  for (const row of items) {
    const qty = Math.max(0, Number(row.quantity) || 0);
    const price = Math.max(0, Number(row.unitPrice) || 0);
    const disc = Math.max(0, Number(row.discount) || 0);
    const gross = Math.round(qty * price);
    const net = Math.max(0, gross - Math.round(disc));
    subtotal += gross;
    totalDiscount += Math.min(gross, Math.round(disc));
    grandTotal += net;
    totalQuantity += qty;
  }

  return {
    subtotal,
    totalDiscount,
    grandTotal,
    itemCount: items.length,
    totalQuantity: Math.round(totalQuantity * 1000) / 1000,
  };
}

/**
 * Pure stock computation for a product:
 * openingStock (in defaultWarehouseId) + purchase line quantities - sale line quantities.
 * Services do not carry physical warehouse stock (returns 0).
 */
export function computeProductStock(
  product: Product,
  invoices: readonly Invoice[],
  warehouseId?: string
): number {
  if (product.kind === 'service') return 0;

  const defaultWh = product.defaultWarehouseId || DEFAULT_WAREHOUSE_ID;
  let stock = 0;

  if (!warehouseId || warehouseId === defaultWh) {
    stock += Number(product.openingStock) || 0;
  }

  for (const inv of invoices) {
    if (!inv.items || inv.items.length === 0) continue;
    for (const item of inv.items) {
      if (item.productId !== product.id) continue;
      const itemWh = item.warehouseId || inv.warehouseId || defaultWh;
      if (warehouseId && itemWh !== warehouseId) continue;
      const qty = Math.max(0, Number(item.quantity) || 0);
      if (inv.kind === 'purchase') stock += qty;
      else if (inv.kind === 'sale') stock -= qty;
    }
  }

  return Math.round(stock * 1000) / 1000;
}

export function computeProductStockByWarehouse(
  product: Product,
  warehouses: readonly Warehouse[],
  invoices: readonly Invoice[]
): ProductWarehouseStock[] {
  if (product.kind === 'service') return [];
  return warehouses.map((w) => ({
    warehouseId: w.id,
    warehouseName: w.name,
    stock: computeProductStock(product, invoices, w.id),
  }));
}

export function isLowStock(product: Product, currentStock: number): boolean {
  if (product.kind !== 'goods') return false;
  if (product.minStock == null || product.minStock <= 0) return false;
  return currentStock <= product.minStock;
}

export function computeWarehouseSummary(
  warehouse: Warehouse,
  products: readonly Product[],
  invoices: readonly Invoice[]
): WarehouseSummary {
  let productCount = 0;
  let totalUnits = 0;
  let lowStockCount = 0;
  let estimatedValue = 0;

  for (const p of products) {
    if (p.kind !== 'goods' || p.isActive === false) continue;
    const stock = computeProductStock(p, invoices, warehouse.id);
    if (stock !== 0 || p.defaultWarehouseId === warehouse.id) {
      productCount += 1;
    }
    if (stock > 0) {
      totalUnits += stock;
      const unitCost = p.purchasePrice || p.salePrice || 0;
      estimatedValue += Math.round(stock * unitCost);
    }
    if (p.defaultWarehouseId === warehouse.id && isLowStock(p, stock)) {
      lowStockCount += 1;
    }
  }

  return {
    warehouse,
    productCount,
    totalUnits: Math.round(totalUnits * 1000) / 1000,
    lowStockCount,
    estimatedValue,
  };
}

export function computeProductCardex(
  product: Product,
  invoices: readonly Invoice[],
  warehouses: readonly Warehouse[],
  contacts: readonly Contact[],
  warehouseFilter?: string
): ProductCardexRow[] {
  const whName = (id?: string) =>
    warehouses.find((w) => w.id === id)?.name || 'انبار مرکزی';
  const contactName = (id?: string) =>
    contacts.find((c) => c.id === id)?.fullName || '—';

  const defaultWh = product.defaultWarehouseId || DEFAULT_WAREHOUSE_ID;
  const rows: Omit<ProductCardexRow, 'runningStock'>[] = [];

  if (product.kind === 'goods' && (product.openingStock || 0) !== 0) {
    if (!warehouseFilter || warehouseFilter === defaultWh) {
      const qty = Number(product.openingStock) || 0;
      const unitCost = product.purchasePrice || 0;
      rows.push({
        id: `opening_${product.id}`,
        date: '0000-00-00',
        kind: 'opening',
        warehouseId: defaultWh,
        warehouseName: whName(defaultWh),
        partyName: 'موجودی اول دوره',
        quantityIn: qty > 0 ? qty : 0,
        quantityOut: qty < 0 ? Math.abs(qty) : 0,
        unitPrice: unitCost,
        lineTotal: Math.round(Math.abs(qty) * unitCost),
        description: 'موجودی اولیه تعریف‌شده هنگام ایجاد کالا',
      });
    }
  }

  const sortedInvoices = [...invoices].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );

  for (const inv of sortedInvoices) {
    if (!inv.items || inv.items.length === 0) continue;
    for (const item of inv.items) {
      if (item.productId !== product.id) continue;
      const itemWh = item.warehouseId || inv.warehouseId || defaultWh;
      if (warehouseFilter && itemWh !== warehouseFilter) continue;
      const qty = Math.max(0, Number(item.quantity) || 0);
      rows.push({
        id: `${inv.id}_${item.id}`,
        date: inv.date,
        kind: inv.kind,
        warehouseId: itemWh,
        warehouseName: whName(itemWh),
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        partyName: contactName(inv.contactId),
        quantityIn: inv.kind === 'purchase' ? qty : 0,
        quantityOut: inv.kind === 'sale' ? qty : 0,
        unitPrice: item.unitPrice,
        lineTotal: item.total,
        description: inv.description || (inv.kind === 'purchase' ? `فاکتور خرید #${inv.invoiceNumber}` : `فاکتور فروش #${inv.invoiceNumber}`),
      });
    }
  }

  let running = 0;
  return rows.map((r) => {
    running = Math.round((running + r.quantityIn - r.quantityOut) * 1000) / 1000;
    return { ...r, runningStock: running };
  });
}
