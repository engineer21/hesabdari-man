import type { Invoice, InvoiceKind, Product } from '../types';
import { computeProductStock } from './inventoryEngine';
import { persianToArabic } from './formatters';

export interface DraftInvoiceRow {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  unit: string;
  quantityStr: string;
  unitPriceStr: string;
  discountStr: string;
}

export interface RankedProductMatch {
  product: Product;
  score: number;
  availableStock: number | null;
  suggestedPrice: number;
}

/**
 * Normalizes Persian/Arabic text and numerals for consistent client-side search:
 * - Converts Persian & Arabic-Indic digits to ASCII digits
 * - Normalizes Arabic Yeh/Kaf (ي/ى -> ی, ك -> ک) and Teh Marbuta (ة -> ه)
 * - Strips zero-width non-joiner and collapses whitespace
 */
export function normalizeSearchText(input: string): string {
  return persianToArabic(input || '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getSuggestedProductPrice(product: Product, kind: InvoiceKind): number {
  if (kind === 'sale') {
    return product.salePrice ?? product.purchasePrice ?? 0;
  }
  return product.purchasePrice ?? product.salePrice ?? 0;
}

export function extractProductCategories(products: Product[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const p of products) {
    if (!p.isActive) continue;
    const cat = (p.category || '').trim();
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      categories.push(cat);
    }
  }
  return categories;
}

/**
 * Filters and ranks catalog products for the invoice Smart Product Search Picker.
 * Exact code match > code prefix > name prefix > word prefix > name substring > category/unit match.
 */
export function filterAndRankProducts(
  products: Product[],
  query: string,
  options: {
    kind: InvoiceKind;
    warehouseId?: string;
    invoices: Invoice[];
    category?: string;
  }
): RankedProductMatch[] {
  const q = normalizeSearchText(query);
  const tokens = q ? q.split(' ').filter(Boolean) : [];
  const activeCategory = (options.category || '').trim();

  const matches: RankedProductMatch[] = [];

  for (const product of products) {
    if (!product.isActive) continue;
    if (activeCategory && (product.category || '').trim() !== activeCategory) continue;

    const codeNorm = normalizeSearchText(product.code);
    const nameNorm = normalizeSearchText(product.name);
    const categoryNorm = normalizeSearchText(product.category || '');
    const unitNorm = normalizeSearchText(product.unit || '');
    const combined = `${codeNorm} ${nameNorm} ${categoryNorm} ${unitNorm}`;

    let score = 10;

    if (q) {
      // Every whitespace-separated token must appear somewhere in the product metadata
      const allTokensMatch = tokens.every((tok) => combined.includes(tok));
      if (!allTokensMatch) continue;

      if (codeNorm === q) {
        score = 100;
      } else if (codeNorm.startsWith(q)) {
        score = 88;
      } else if (nameNorm === q) {
        score = 85;
      } else if (nameNorm.startsWith(q)) {
        score = 75;
      } else if (nameNorm.split(' ').some((w) => w.startsWith(q))) {
        score = 62;
      } else if (nameNorm.includes(q)) {
        score = 50;
      } else if (categoryNorm.includes(q)) {
        score = 35;
      } else {
        score = 25;
      }
    }

    const effectiveWh = options.warehouseId || product.defaultWarehouseId;
    const availableStock =
      product.kind === 'goods'
        ? computeProductStock(product, options.invoices, effectiveWh)
        : null;

    matches.push({
      product,
      score,
      availableStock,
      suggestedPrice: getSuggestedProductPrice(product, options.kind),
    });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name, 'fa');
  });

  return matches;
}

export function createEmptyDraftRow(
  defaultWarehouseId: string,
  idFactory?: () => string
): DraftInvoiceRow {
  const id = idFactory ? idFactory() : `row_${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    productId: '',
    productName: '',
    warehouseId: defaultWarehouseId,
    unit: 'عدد',
    quantityStr: '1',
    unitPriceStr: '',
    discountStr: '',
  };
}

export function cloneDraftRow(
  row: DraftInvoiceRow,
  idFactory?: () => string
): DraftInvoiceRow {
  const id = idFactory ? idFactory() : `row_${crypto.randomUUID().slice(0, 8)}`;
  return {
    ...row,
    id,
  };
}

export function isDraftRowPopulated(row: DraftInvoiceRow): boolean {
  return Boolean(
    row.productId ||
      row.productName.trim() ||
      (row.unitPriceStr && Number(persianToArabic(row.unitPriceStr)) > 0)
  );
}

/**
 * Determines whether pressing Enter at the end of a spreadsheet row should append a fresh row.
 */
export function shouldAutoAppendOnEnter(
  rowIndex: number,
  totalRows: number,
  row: DraftInvoiceRow
): boolean {
  return rowIndex === totalRows - 1 && isDraftRowPopulated(row);
}
