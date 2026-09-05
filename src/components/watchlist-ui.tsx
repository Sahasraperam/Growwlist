import { useId } from "react";
import type { WatchItem } from "@/lib/watchlist.functions";

export const SIGNIFICANCE_TEXT: Record<WatchItem["significance"], string> = {
  unusual: "Unusual move",
  notable: "Notable move",
  normal: "Normal range",
  quiet: "Quiet",
  unknown: "Learning normal range",
};

export function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function directionClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.005) return "text-muted-foreground";
  return value > 0 ? "text-up" : "text-down";
}

export function directionPillClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.005)
    return "bg-muted/60 text-muted-foreground border border-border/50";
  return value > 0
    ? "bg-up-soft text-up border border-up/20"
    : "bg-down-soft text-down border border-down/20";
}

export function baselineLabel(item: WatchItem): string {
  if (item.price === null) return "No price yet";
  if (item.baseline === "last-seen") return "since last visit";
  if (item.baseline === "previous-close") return "since yesterday's close";
  return "first look";
}

export function whyText(item: WatchItem): string {
  if (item.price === null) return "No price history yet for this symbol.";
  if (item.swing === null || item.score === null) {
    return `Learning standard volatility baseline for ${item.symbol} — currently showing nominal percentage change.`;
  }
  const times = Math.abs(item.score);
  const normal = item.swing.toFixed(2);
  if (times >= 2) {
    return `Move is ${times.toFixed(1)}× ${item.symbol}'s typical daily swing of ${normal}%. Well outside standard deviation.`;
  }
  if (times >= 1) {
    return `Pacing at ${times.toFixed(1)}× the ${normal}% daily swing standard for ${item.symbol}.`;
  }
  return `Trading comfortably within ${item.symbol}'s expected ${normal}% daily range. No unusual signal detected.`;
}

export function Sparkline({
  points,
  up,
  className = "",
  height = 120,
}: {
  points: number[];
  up: boolean;
  className?: string;
  height?: number;
}) {
  const uniqueId = useId();
  if (points.length < 2) return null;
  const width = 640;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / span) * (height - 18) - 9;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const stroke = up ? "var(--color-up)" : "var(--color-down)";
  const gradientId = `sparkline-grad-${uniqueId.replace(/:/g, "")}-${up ? "up" : "down"}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="Price history sparkline"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        strokeWidth="2.5"
        stroke={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
