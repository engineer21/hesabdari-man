export function countFilledFields(values: Array<unknown>): number {
  let count = 0;
  for (const val of values) {
    if (val == null) continue;
    if (typeof val === 'string') {
      if (val.trim().length > 0) count += 1;
      continue;
    }
    if (typeof val === 'number') {
      if (Number.isFinite(val) && val > 0) count += 1;
      continue;
    }
    if (typeof val === 'boolean') {
      if (val) count += 1;
      continue;
    }
    if (typeof val === 'object') {
      count += 1;
    }
  }
  return count;
}

export function formatOptionalCountLabel(count: number, toDigits: (v: string) => string): string {
  if (count <= 0) return '';
  return `${toDigits(String(count))} مورد تکمیل‌شده`;
}

export function computeStickyBarBudgetRatio(
  topHeaderPx: number,
  bottomBarPx: number,
  viewportHeightPx: number
): number {
  if (viewportHeightPx <= 0) return 1;
  return (Math.max(0, topHeaderPx) + Math.max(0, bottomBarPx)) / viewportHeightPx;
}

export function resolveInvoiceItemViewportMode(
  widthPx: number
): 'mobile-cards' | 'tablet-hybrid' | 'desktop-table' {
  if (widthPx < 768) return 'mobile-cards';
  if (widthPx < 1280) return 'tablet-hybrid';
  return 'desktop-table';
}
