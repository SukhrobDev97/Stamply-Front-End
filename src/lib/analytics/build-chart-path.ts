export type ChartPoint = { value: number };

export type ChartPathResult = {
  linePath: string;
  areaPath: string;
  coords: { x: number; y: number }[];
};

export type ChartPadding = number | { top?: number; right?: number; bottom?: number; left?: number };

function resolveChartPadding(padding: ChartPadding) {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  const d = 6;
  return {
    top: padding.top ?? d,
    right: padding.right ?? d,
    bottom: padding.bottom ?? d,
    left: padding.left ?? d,
  };
}

/** Light display smoothing — does not alter stored metrics. */
export function smoothDisplaySeries(values: number[], passes = 2): number[] {
  if (values.length < 3) return values;
  let out = values.map((v) => Math.max(0, v));
  for (let p = 0; p < passes; p++) {
    out = out.map((v, i) => {
      const prev = out[i - 1] ?? v;
      const next = out[i + 1] ?? v;
      return v * 0.55 + prev * 0.225 + next * 0.225;
    });
  }
  return out;
}

export function chartValueDomain(values: number[]): { min: number; max: number } {
  const nums = values.map((v) => Math.max(0, Number(v) || 0));
  if (nums.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) {
    return { min: 0, max: Math.max(1, max) };
  }
  const pad = Math.max(0.5, (max - min) * 0.15);
  return { min: Math.max(0, min - pad * 0.2), max: max + pad };
}

export function chartYTicks(domain: { min: number; max: number }, count = 4): number[] {
  const span = domain.max - domain.min || 1;
  return Array.from({ length: count }, (_, i) => {
    const v = domain.min + (span * i) / (count - 1);
    return Number.isInteger(v) ? v : Math.round(v * 10) / 10;
  });
}

/** Smooth cubic SVG path from analytics chartPoints (memo-friendly pure fn). */
export function buildChartPath(
  points: ChartPoint[],
  width: number,
  height: number,
  padding: ChartPadding = 8,
  tension = 10,
): ChartPathResult {
  if (points.length === 0) {
    return { linePath: "", areaPath: "", coords: [] };
  }

  const pad = resolveChartPadding(padding);
  const values = points.map((p) => Math.max(0, Number(p.value) || 0));
  const domain = chartValueDomain(values);
  const span = domain.max - domain.min || 1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const n = values.length;

  const coords = values.map((v, i) => ({
    x: pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: pad.top + (1 - (v - domain.min) / span) * innerH,
  }));

  if (coords.length === 1) {
    const { x, y } = coords[0]!;
    const linePath = `M ${x} ${y} L ${x} ${y}`;
    const areaPath = `${linePath} L ${x} ${height - pad.bottom} L ${x} ${height - pad.bottom} Z`;
    return { linePath, areaPath, coords };
  }

  let linePath = `M ${coords[0]!.x} ${coords[0]!.y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[Math.min(coords.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;
    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const baseY = height - pad.bottom;
  const areaPath = `${linePath} L ${coords[coords.length - 1]!.x} ${baseY} L ${coords[0]!.x} ${baseY} Z`;

  return { linePath, areaPath, coords };
}

export function buildSparklinePath(values: number[], width: number, height: number): string {
  return buildChartPath(
    values.map((value) => ({ value })),
    width,
    height,
    2,
  ).linePath;
}
