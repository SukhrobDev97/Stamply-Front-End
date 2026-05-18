"use client";

import { DASHBOARD_ANALYTICS_QUERY } from "@/graphql/queries/dashboard-analytics.query";
import {
  buildChartPath,
  buildSparklinePath,
  chartValueDomain,
  chartYTicks,
  smoothDisplaySeries,
} from "@/lib/analytics/build-chart-path";
import type { ProfileLang, t } from "@/app/profile/copy";
import { useQuery } from "@apollo/client/react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Loader2,
  Minus,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  memo,
  useCallback,
  useId,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

export type DashboardAnalyticsRange = "H1" | "W1" | "M1";

type AnalyticsChartPoint = {
  label: string;
  value: number;
  bucketStart: string;
};

export type DashboardAnalyticsData = {
  todayVisits: number;
  weeklyVisits: number;
  monthlyVisits: number;
  avgVisitsPerDay: number;
  growthPercent: number;
  chartPoints: AnalyticsChartPoint[];
};

type DashboardAnalyticsQueryData = {
  dashboardAnalytics: DashboardAnalyticsData;
};

type Txt = (typeof t)[ProfileLang];

const RANGES: DashboardAnalyticsRange[] = ["H1", "W1", "M1"];

const CHART_W = 188;
const CHART_H = 92;
const CHART_PAD = { top: 10, right: 6, bottom: 4, left: 22 };

function formatGrowthPercent(pct: number): string {
  if (!Number.isFinite(pct)) return "0%";
  const r = Math.round(pct * 100) / 100;
  if (r === 0 || Object.is(r, -0)) return "0%";
  return `${r > 0 ? "+" : ""}${r}%`;
}

function growthDirection(pct: number): "up" | "down" | "neutral" {
  if (!Number.isFinite(pct) || pct === 0) return "neutral";
  return pct > 0 ? "up" : "down";
}

function primaryMetric(range: DashboardAnalyticsRange, data: DashboardAnalyticsData): number {
  if (range === "H1") return data.todayVisits;
  if (range === "W1") return data.weeklyVisits;
  return data.monthlyVisits;
}

function comparisonLabel(range: DashboardAnalyticsRange, txt: Txt): string {
  if (range === "H1") return txt.homeVsYesterday;
  if (range === "W1") return txt.homeVsLastWeek;
  return txt.homeVsLastMonth;
}

function rangeTitle(range: DashboardAnalyticsRange, txt: Txt): string {
  if (range === "H1") return txt.homeVisitsToday;
  if (range === "W1") return txt.homeVisitsWeek;
  return txt.homeVisitsMonth;
}

function periodLabel(range: DashboardAnalyticsRange, txt: Txt): string {
  if (range === "H1") return txt.homeAnalyticsPeriodH1;
  if (range === "W1") return txt.homeAnalyticsPeriodW1;
  return txt.homeAnalyticsPeriodM1;
}

function rangeSegmentLabel(range: DashboardAnalyticsRange, txt: Txt): string {
  if (range === "H1") return txt.homeAnalyticsRange1H;
  if (range === "W1") return txt.homeAnalyticsRange1W;
  return txt.homeAnalyticsRange1M;
}

function pickAxisLabels(points: AnalyticsChartPoint[], max = 5): string[] {
  if (points.length === 0) return [];
  if (points.length <= max) return points.map((p) => p.label);
  const idx = new Set<number>();
  for (let i = 0; i < max; i++) {
    idx.add(Math.round((i / (max - 1)) * (points.length - 1)));
  }
  return [...idx].sort((a, b) => a - b).map((i) => points[i]!.label);
}

const AnalyticsChart = memo(function AnalyticsChart({
  chartPoints,
  range,
  gradientId,
}: {
  chartPoints: AnalyticsChartPoint[];
  range: DashboardAnalyticsRange;
  gradientId: string;
}) {
  const rawValues = useMemo(
    () => chartPoints.map((p) => Math.max(0, Number(p.value) || 0)),
    [chartPoints],
  );

  const displayValues = useMemo(() => {
    if (rawValues.length < 3) return rawValues;
    const min = Math.min(...rawValues);
    const max = Math.max(...rawValues);
    const spread = max - min;
    if (spread === 0) return rawValues;
    return smoothDisplaySeries(rawValues, spread <= 2 ? 1 : 2);
  }, [rawValues]);

  const displayPoints = useMemo(
    () => displayValues.map((value) => ({ value })),
    [displayValues],
  );

  const valueDomain = useMemo(() => chartValueDomain(displayValues), [displayValues]);

  const { linePath, areaPath, coords } = useMemo(
    () => buildChartPath(displayPoints, CHART_W, CHART_H, CHART_PAD, 12),
    [displayPoints],
  );

  const yTicks = useMemo(() => chartYTicks(valueDomain, 4), [valueDomain]);

  const highlight = coords.length > 0 ? coords[coords.length - 1]! : null;
  const highlightLabel =
    chartPoints.length > 0 ? chartPoints[chartPoints.length - 1]!.label : "";

  if (!linePath) {
    return (
      <div className="flex h-[108px] w-full items-center justify-center text-[12px] font-medium text-white/45">
        —
      </div>
    );
  }

  const plotTop = CHART_PAD.top;
  const plotBottom = CHART_H - CHART_PAD.bottom;
  const plotH = plotBottom - plotTop;
  const ySpan = valueDomain.max - valueDomain.min || 1;
  const yForTick = (tick: number) => plotBottom - ((tick - valueDomain.min) / ySpan) * plotH;

  return (
    <motion.div
      key={`chart-${range}`}
      className="flex min-w-0 flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="relative h-[108px] w-full min-w-0">
        <svg
          className="h-full w-full overflow-visible"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          fill="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const y = yForTick(tick);
            return (
              <g key={tick}>
                <line
                  x1={CHART_PAD.left}
                  x2={CHART_W - CHART_PAD.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
                <text
                  x={CHART_PAD.left - 5}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.42)"
                  fontSize="8"
                  fontWeight="500"
                >
                  {tick}
                </text>
              </g>
            );
          })}
          <motion.path
            key={`area-${range}-${chartPoints.length}`}
            d={areaPath}
            fill={`url(#${gradientId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />
          <motion.path
            key={`line-${range}-${chartPoints.length}`}
            d={linePath}
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {highlight ? (
            <g>
              <line
                x1={highlight.x}
                x2={highlight.x}
                y1={highlight.y}
                y2={plotBottom}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <circle
                cx={highlight.x}
                cy={highlight.y}
                r={5}
                fill="rgba(255,255,255,0.95)"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={2}
              />
              {highlightLabel ? (
                <text
                  x={highlight.x}
                  y={Math.max(12, highlight.y - 10)}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.9)"
                  fontSize="8"
                  fontWeight="600"
                >
                  {highlightLabel}
                </text>
              ) : null}
            </g>
          ) : null}
        </svg>
      </div>
      <motion.div
        className="mt-1 flex justify-between gap-1 px-0.5 text-[9px] font-medium tabular-nums text-white/40"
        layout
      >
        {pickAxisLabels(chartPoints).map((label) => (
          <span key={label} className="truncate">
            {label}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
});

const MiniStatStrip = memo(function MiniStatStrip({
  icon,
  label,
  value,
  sparkValues,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  sparkValues: number[];
}) {
  const sparkPath = useMemo(() => {
    const nums = sparkValues.map((v) => Math.max(0, Number(v) || 0));
    const spread = Math.max(...nums) - Math.min(...nums);
    const series = spread > 0 && nums.length >= 3 ? smoothDisplaySeries(nums, 1) : nums;
    return buildSparklinePath(series, 52, 16);
  }, [sparkValues]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5 first:pl-3 last:pr-3">
      <motion.div
        key={String(value)}
        initial={{ opacity: 0.65, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="text-[17px] font-bold leading-none tabular-nums text-white"
      >
        {value}
      </motion.div>
      <motion.div
        key={label}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        className="flex min-w-0 items-center gap-1.5"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/12 text-white/85">
          {icon}
        </span>
        <span className="truncate text-[10px] font-medium leading-tight text-white/58">
          {label}
        </span>
      </motion.div>
      {sparkPath ? (
        <svg className="h-4 w-full opacity-70" viewBox="0 0 52 16" aria-hidden>
          <path
            d={sparkPath}
            stroke="rgba(255,255,255,0.72)"
            strokeWidth={1.35}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <span className="h-4" aria-hidden />
      )}
    </div>
  );
});

type HomeAnalyticsCardProps = {
  active: boolean;
  txt: Txt;
  lang: ProfileLang;
};

export function HomeAnalyticsCard({ active, txt, lang }: HomeAnalyticsCardProps) {
  const [range, setRange] = useState<DashboardAnalyticsRange>("H1");
  const gradientId = useId().replace(/:/g, "");

  const { data, loading } = useQuery<DashboardAnalyticsQueryData>(DASHBOARD_ANALYTICS_QUERY, {
    variables: { range },
    skip: !active,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const analytics = data?.dashboardAnalytics;
  const isRefreshing = loading && Boolean(analytics);
  const isInitialLoad = loading && !analytics;

  const chartPoints = useMemo(() => analytics?.chartPoints ?? [], [analytics?.chartPoints]);
  const sparkTail = useMemo(() => chartPoints.slice(-8).map((p) => p.value), [chartPoints]);
  const sparkWeek = useMemo(() => chartPoints.slice(-7).map((p) => p.value), [chartPoints]);
  const sparkMonth = useMemo(() => chartPoints.slice(-10).map((p) => p.value), [chartPoints]);

  const onRangeClick = useCallback((e: MouseEvent, next: DashboardAnalyticsRange) => {
    e.preventDefault();
    e.stopPropagation();
    setRange(next);
  }, []);

  const metric = analytics ? primaryMetric(range, analytics) : 0;
  const growth = analytics?.growthPercent ?? 0;
  const dir = growthDirection(growth);

  const growthPillClass =
    dir === "up"
      ? "bg-emerald-400/22 text-emerald-50 ring-1 ring-emerald-300/25"
      : dir === "down"
        ? "bg-rose-400/20 text-rose-50 ring-1 ring-rose-300/25"
        : "bg-white/14 text-white/85 ring-1 ring-white/20";

  return (
    <Link
      key={`analytics-${lang}`}
      href="/visits"
      className={[
        "group relative flex w-full flex-col overflow-hidden rounded-[28px] px-5 py-5 text-left text-white sm:px-6",
        "active:scale-[0.98] transition-all duration-300 ease-out",
        "bg-[linear-gradient(145deg,#B49AFF_0%,#8F7CFF_42%,#7488FF_100%)]",
        "shadow-[0_16px_40px_rgba(110,100,230,0.22),inset_0_1px_0_rgba(255,255,255,0.22)]",
        "ring-1 ring-white/10",
        isRefreshing ? "opacity-[0.98]" : "",
      ].join(" ")}
    >
      <span className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-white/18 blur-3xl" />
      <span className="pointer-events-none absolute -right-6 bottom-0 h-28 w-28 rounded-full bg-[#C4B5FF]/25 blur-2xl" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.02)_38%,transparent_100%)]" />

      <motion.div className="relative z-10 flex items-start justify-between gap-3" layout>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm">
            <TrendingUp size={16} strokeWidth={2.35} aria-hidden />
          </span>
          <motion.span
            key={`title-${range}-${lang}`}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-white"
          >
            {rangeTitle(range, txt)}
          </motion.span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <motion.div
            layout
            className="inline-flex rounded-full bg-black/10 p-0.5 backdrop-blur-sm"
            role="tablist"
            aria-label="Analytics range"
          >
            {RANGES.map((r) => {
              const selected = range === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={(e) => onRangeClick(e, r)}
                  className={[
                    "relative z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors",
                    selected ? "text-[#6B5CE7]" : "text-white/70 hover:text-white/90",
                  ].join(" ")}
                >
                  {selected ? (
                    <motion.span
                      layoutId="analytics-range-pill"
                      className="absolute inset-0 rounded-full bg-white/95 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                      transition={{ type: "spring", stiffness: 480, damping: 34 }}
                    />
                  ) : null}
                  <span className="relative z-10">{rangeSegmentLabel(r, txt)}</span>
                </button>
              );
            })}
          </motion.div>
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/60" aria-hidden />
          ) : null}
        </div>
      </motion.div>

      <motion.div className="relative z-10 mt-4 flex gap-3 sm:gap-4" layout>
        <motion.div className="flex w-[38%] min-w-[108px] max-w-[42%] shrink-0 flex-col border-r border-white/12 pr-3 sm:pr-4" layout>
          <motion.span
            key={`period-${range}-${lang}`}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            className="text-[12px] font-medium text-white/55"
          >
            {periodLabel(range, txt)}
          </motion.span>
          <motion.span
            key={`metric-${range}-${metric}`}
            initial={{ opacity: 0.5, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums"
          >
            {isInitialLoad ? "—" : metric}
          </motion.span>
          <motion.span
            layout
            className={[
              "mt-2.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums backdrop-blur-sm",
              growthPillClass,
            ].join(" ")}
          >
            {dir === "down" ? (
              <ArrowDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            ) : dir === "up" ? (
              <ArrowUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            ) : (
              <Minus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            )}
            {formatGrowthPercent(growth)}
          </motion.span>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-white/50">
            {comparisonLabel(range, txt)}
          </p>
        </motion.div>

        <AnalyticsChart
          chartPoints={chartPoints}
          range={range}
          gradientId={gradientId}
        />
      </motion.div>

      {analytics ? (
        <motion.div
          layout
          className="relative z-10 mt-4 overflow-hidden rounded-2xl bg-black/10 ring-1 ring-white/10 backdrop-blur-md"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <motion.div className="grid grid-cols-3 divide-x divide-white/10">
            <MiniStatStrip
              icon={<Users size={12} strokeWidth={2.3} aria-hidden />}
              label={txt.homeMiniWeek}
              value={analytics.weeklyVisits}
              sparkValues={sparkWeek}
            />
            <MiniStatStrip
              icon={<CalendarDays size={12} strokeWidth={2.3} aria-hidden />}
              label={txt.homeMiniMonth}
              value={analytics.monthlyVisits}
              sparkValues={sparkMonth}
            />
            <MiniStatStrip
              icon={<TrendingUp size={12} strokeWidth={2.3} aria-hidden />}
              label={txt.homeMiniAvgDay}
              value={
                Number.isInteger(analytics.avgVisitsPerDay)
                  ? analytics.avgVisitsPerDay
                  : analytics.avgVisitsPerDay.toFixed(1)
              }
              sparkValues={sparkTail}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </Link>
  );
}
