import React, { useId } from 'react';
import { cn } from '../ui';

interface MiniSparklineProps {
  values: number[];
  className?: string;
  strokeClass?: string;
  tone?: 'income' | 'expense' | 'brand';
}

function buildSmoothPath(
  pts: { x: number; y: number }[],
  minY: number,
  maxY: number
): string {
  if (pts.length < 2) return '';
  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({
  values,
  className,
  strokeClass,
  tone,
}) => {
  const gradId = useId();
  if (values.length < 2) return null;

  const resolvedTone =
    tone ??
    (strokeClass?.includes('income')
      ? 'income'
      : strokeClass?.includes('expense')
        ? 'expense'
        : 'brand');

  const colorVar =
    resolvedTone === 'income'
      ? 'var(--income)'
      : resolvedTone === 'expense'
        ? 'var(--expense)'
        : 'var(--brand)';

  const w = 136;
  const h = 42;
  const padX = 3;
  const padTop = 5;
  const padBottom = 4;

  const pts = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (w - padX * 2),
    y: h - padBottom - Math.max(0.06, v) * (h - padTop - padBottom),
  }));

  const linePath = buildSmoothPath(pts, padTop, h - padBottom);
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${h} L ${pts[0].x.toFixed(1)} ${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('h-8 w-16 shrink-0 overflow-hidden sm:h-10 sm:w-24', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorVar} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colorVar} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={colorVar}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default MiniSparkline;
