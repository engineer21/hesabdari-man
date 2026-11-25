import { formatNumberWithCommas, toPersianDigits } from './formatters';

export type PdfPageSize = 'a4' | 'a5';
export type PdfDensity = 'normal' | 'compact';
export type CellAlign = 'right' | 'left' | 'center' | 'amount';

export interface TableColumn {
  header: string;
  width?: number;
  align?: CellAlign;
}

/** In-memory only — no localStorage */
let rememberedPdfPageSize: PdfPageSize = 'a4';

/** ~96 CSS px per inch */
const PX_PER_MM = 96 / 25.4;

const PAGE: Record<
  PdfPageSize,
  {
    format: 'a4' | 'a5';
    widthMm: number;
    heightMm: number;
    marginMm: number;
    label: string;
    /** Approx data rows that fit with header + summary */
    rowsPerPage: number;
  }
> = {
  a4: { format: 'a4', widthMm: 210, heightMm: 297, marginMm: 14, label: 'A4', rowsPerPage: 26 },
  a5: { format: 'a5', widthMm: 148, heightMm: 210, marginMm: 10, label: 'A5', rowsPerPage: 16 },
};

export function readStoredPdfPageSize(fallback: PdfPageSize = 'a4'): PdfPageSize {
  return rememberedPdfPageSize || fallback;
}

export function storePdfPageSize(size: PdfPageSize): void {
  rememberedPdfPageSize = size;
}

export function pageSizeLabel(size: PdfPageSize): string {
  return PAGE[size].label;
}

function resolveDensity(pageSize: PdfPageSize, density?: PdfDensity): PdfDensity {
  if (density) return density;
  return pageSize === 'a5' ? 'compact' : 'normal';
}

type DensityTokens = {
  title: number;
  store: number;
  meta: number;
  th: number;
  td: number;
  cellY: number;
  cellX: number;
  summary: number;
};

function densityTokens(pageSize: PdfPageSize, density?: PdfDensity): DensityTokens {
  const mode = resolveDensity(pageSize, density);
  if (mode === 'compact') {
    return { title: 12, store: 10, meta: 8, th: 8, td: 8, cellY: 3, cellX: 4, summary: 9 };
  }
  return { title: 15, store: 12, meta: 9, th: 10, td: 10, cellY: 5, cellX: 6, summary: 11 };
}

async function waitForFonts(): Promise<void> {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 50));
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (size <= 0) return [rows];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out.length ? out : [[]];
}

function buildHeaderHtml(
  title: string,
  storeName: string,
  subtitle: string | undefined,
  pageSize: PdfPageSize,
  pageIndex: number,
  totalPages: number,
  d: DensityTokens
): string {
  const stamped = toPersianDigits(
    new Date().toLocaleString('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );
  const pageLabel =
    totalPages > 1
      ? `صفحه ${toPersianDigits(String(pageIndex + 1))} از ${toPersianDigits(String(totalPages))}`
      : PAGE[pageSize].label;

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:10px;margin-bottom:10px;border-bottom:2px solid #7c3aed;">
      <div style="min-width:0;flex:1;">
        <div style="font-size:${d.store}px;font-weight:700;color:#6d28d9;line-height:1.35;">${escapeHtml(storeName)}</div>
        <div style="font-size:${d.title}px;font-weight:800;color:#0f172a;margin-top:2px;line-height:1.35;">${escapeHtml(title)}</div>
        ${
          subtitle
            ? `<div style="font-size:${d.meta}px;color:#64748b;margin-top:4px;line-height:1.45;">${subtitle}</div>`
            : ''
        }
      </div>
      <div style="flex-shrink:0;text-align:left;direction:ltr;">
        <div style="display:inline-block;border:1px solid #e2e8f0;background:#f8fafc;border-radius:6px;padding:2px 8px;font-size:${d.meta}px;font-weight:700;color:#64748b;font-family:Tahoma,sans-serif;">${PAGE[pageSize].label}</div>
        <div style="font-size:${d.meta}px;color:#94a3b8;margin-top:6px;font-family:'Vazirmatn',Tahoma,sans-serif;direction:rtl;text-align:left;">${stamped}</div>
        <div style="font-size:${d.meta}px;color:#94a3b8;margin-top:2px;font-family:'Vazirmatn',Tahoma,sans-serif;direction:rtl;text-align:left;">${pageLabel}</div>
      </div>
    </div>`;
}

function buildTableHtml(
  cols: TableColumn[],
  rows: (string | number)[][],
  d: DensityTokens
): string {
  const totalW = cols.reduce((s, c) => s + (c.width || 1), 0);
  const th = cols
    .map((c) => {
      const w = ((c.width || 1) / totalW) * 100;
      return `<th style="width:${w.toFixed(2)}%;background:#f1f5f9;border:1px solid #cbd5e1;padding:${d.cellY}px ${d.cellX}px;font-size:${d.th}px;font-weight:700;color:#334155;text-align:right;vertical-align:middle;line-height:1.35;">${escapeHtml(c.header)}</th>`;
    })
    .join('');

  const body =
    rows.length === 0
      ? `<tr><td colspan="${cols.length}" style="border:1px solid #e2e8f0;padding:14px;text-align:center;color:#94a3b8;font-size:${d.td}px;">موردی نیست</td></tr>`
      : rows
          .map((r, ri) => {
            const bg = ri % 2 ? '#fafafa' : '#ffffff';
            return `<tr>${cols
              .map((c, i) => {
                const raw = String(r[i] ?? '');
                const align = c.align || 'right';
                if (align === 'amount') {
                  return `<td style="border:1px solid #e2e8f0;background:${bg};padding:${d.cellY}px ${d.cellX}px;font-size:${d.td}px;font-weight:700;text-align:left;vertical-align:middle;white-space:nowrap;font-variant-numeric:tabular-nums;line-height:1.35;color:#0f172a;" dir="ltr">${escapeHtml(raw)}</td>`;
                }
                const ta = align === 'center' ? 'center' : align === 'left' ? 'left' : 'right';
                return `<td style="border:1px solid #e2e8f0;background:${bg};padding:${d.cellY}px ${d.cellX}px;font-size:${d.td}px;text-align:${ta};vertical-align:middle;line-height:1.4;color:#334155;word-wrap:break-word;overflow-wrap:anywhere;">${escapeHtml(raw)}</td>`;
              })
              .join('')}</tr>`;
          })
          .join('');

  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildSummaryHtml(
  items: { label: string; value: string }[],
  d: DensityTokens
): string {
  if (!items.length) return '';
  const cells = items
    .map(
      (it) => `
      <td style="border:1px solid #ddd6fe;background:#f5f3ff;padding:8px 10px;vertical-align:top;width:${(100 / items.length).toFixed(2)}%;">
        <div style="font-size:${d.meta}px;color:#7c3aed;font-weight:700;margin-bottom:3px;">${escapeHtml(it.label)}</div>
        <div style="font-size:${d.summary}px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;direction:ltr;text-align:left;line-height:1.3;" dir="ltr">${escapeHtml(it.value)}</div>
      </td>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin-top:12px;table-layout:fixed;"><tr>${cells}</tr></table>`;
}

function pageDocumentHtml(bodyInner: string, contentWidthPx: number): string {
  return `
    <div dir="rtl" style="
      width:${contentWidthPx}px;
      box-sizing:border-box;
      margin:0;
      padding:0;
      background:#fff;
      color:#0f172a;
      font-family:'Vazirmatn',Tahoma,Arial,sans-serif;
      -webkit-font-smoothing:antialiased;
    ">${bodyInner}</div>`;
}

async function renderHtmlToCanvas(html: string, widthPx: number): Promise<HTMLCanvasElement> {
  // Loaded lazily — heavy PDF/render libs must not slow down app startup
  const { default: html2canvas } = await import('html2canvas');
  const host = document.createElement('div');
  host.style.cssText = [
    'position:fixed',
    'left:-16000px',
    'top:0',
    `width:${widthPx}px`,
    'background:#ffffff',
    'z-index:-1',
    'pointer-events:none',
    'box-sizing:border-box',
  ].join(';');
  host.innerHTML = html;
  document.body.appendChild(host);
  await waitForFonts();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: 2,
      width: widthPx,
      windowWidth: widthPx,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 10000,
    });
    if (!canvas.width || !canvas.height) throw new Error('محتوای گزارش خالی است.');
    return canvas;
  } finally {
    host.remove();
  }
}

export interface TableReportInput {
  title: string;
  storeName: string;
  subtitle?: string;
  columns: TableColumn[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
  pageSize?: PdfPageSize;
  density?: PdfDensity;
  filename: string;
  /** Override auto row paging */
  rowsPerPage?: number;
}

/**
 * Multi-page PDF: each page is a complete HTML snapshot (no mid-row slicing).
 * Header repeats; summary only on last page. If a page would overflow, row
 * count per page is reduced so text is not scaled down into unreadability.
 */
export async function downloadTableReportPdf(input: TableReportInput): Promise<void> {
  const pageSize = input.pageSize || 'a4';
  storePdfPageSize(pageSize);
  const { default: jsPDF } = await import('jspdf');
  const page = PAGE[pageSize];
  const d = densityTokens(pageSize, input.density);
  const contentWmm = page.widthMm - page.marginMm * 2;
  const contentHmm = page.heightMm - page.marginMm * 2;
  const contentWidthPx = Math.round(contentWmm * PX_PER_MM);
  const subtitleHtml = input.subtitle ? escapeHtml(input.subtitle) : undefined;

  let perPage = Math.max(1, input.rowsPerPage || page.rowsPerPage);
  // Probe with summary reserved so last page never overflows into tiny scaled text
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const probeRows = input.rows.slice(0, perPage);
    const probeInner =
      buildHeaderHtml(input.title, input.storeName, subtitleHtml, pageSize, 0, 1, d) +
      buildTableHtml(input.columns, probeRows, d) +
      (input.summary?.length ? buildSummaryHtml(input.summary, d) : '');
    const probe = await renderHtmlToCanvas(pageDocumentHtml(probeInner, contentWidthPx), contentWidthPx);
    const hMm = (probe.height * contentWmm) / probe.width;
    if (hMm <= contentHmm * 0.98 || perPage <= 4) break;
    perPage = Math.max(4, Math.floor(perPage * (contentHmm / hMm) * 0.9));
  }

  const pages = chunkRows(input.rows, perPage);
  const totalPages = pages.length;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: page.format,
    compress: true,
  });

  for (let i = 0; i < totalPages; i += 1) {
    const isLast = i === totalPages - 1;
    const inner =
      buildHeaderHtml(input.title, input.storeName, subtitleHtml, pageSize, i, totalPages, d) +
      buildTableHtml(input.columns, pages[i], d) +
      (isLast && input.summary?.length ? buildSummaryHtml(input.summary, d) : '');

    const canvas = await renderHtmlToCanvas(pageDocumentHtml(inner, contentWidthPx), contentWidthPx);

    let finalW = contentWmm;
    let finalH = (canvas.height * finalW) / canvas.width;
    if (finalH > contentHmm) {
      const scale = contentHmm / finalH;
      finalW *= scale;
      finalH = contentHmm;
    }

    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', page.marginMm, page.marginMm, finalW, finalH);
  }

  const name = input.filename.endsWith('.pdf') ? input.filename : `${input.filename}.pdf`;
  pdf.save(name);
}

export async function downloadRowsAsExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  filename: string
): Promise<void> {
  if (!rows.length) throw new Error('ردیفی برای خروجی اکسل نیست.');
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const keys = Object.keys(rows[0] || {});
  ws['!cols'] = keys.map((k) => {
    const max = Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length));
    return { wch: Math.min(42, Math.max(10, max + 2)) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMoneyFa(n: number): string {
  const signed = n < 0 ? '-' : '';
  return `${signed}${toPersianDigits(formatNumberWithCommas(Math.round(Math.abs(n))))}`;
}

export function formatDateFa(iso: string): string {
  if (!iso) return '—';
  return toPersianDigits(new Date(iso + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian'));
}
