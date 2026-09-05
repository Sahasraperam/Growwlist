/**
 * DataSourceBadge
 *
 * Displays a small, secondary label that communicates the provenance and
 * freshness of a stock price. Every price in the app uses this component
 * so the label is always accurate and never hardcoded.
 *
 * Status derivation rules:
 *   DEMO → "DEMO · Simulated"
 *   BSE  + age < 20 min  → LIVE     "● BSE Live · 4:32 PM"
 *   BSE  + age 20–90 min → DELAYED  "◐ BSE Delayed · 32 min ago"
 *   BSE  + age > 90 min  → STALE    "⚠ BSE Stale · 3h ago"
 *   NSE  (any age)       → EOD      "NSE EOD · Sep 3"
 *   null / no price      → UNAVAILABLE  "Market data unavailable"
 */

export type DataStatus = "LIVE" | "DELAYED" | "EOD" | "STALE" | "DEMO" | "UNAVAILABLE";

export function deriveDataStatus(
  priceSource: "BSE" | "NSE" | "DEMO" | null,
  quoteAgeMinutes: number | null,
  price: number | null,
): DataStatus {
  if (price === null || priceSource === null) return "UNAVAILABLE";
  if (priceSource === "DEMO") return "DEMO";
  if (priceSource === "NSE") return "EOD";

  const age = quoteAgeMinutes ?? Infinity;
  if (age < 20) return "LIVE";
  if (age < 90) return "DELAYED";
  return "STALE";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "";
  }
}

function formatDate(isoDate: string): string {
  try {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year!, month! - 1, day!).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function formatAgo(minutes: number): string {
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.round(minutes / 60);
  return `${h}h ago`;
}

export type DataSourceBadgeProps = {
  priceSource: "BSE" | "NSE" | "DEMO" | null;
  quoteAgeMinutes: number | null;
  price: number | null;
  priceAsOf: string | null;
  snapshotDate: string | null;
  className?: string;
};

export function DataSourceBadge({
  priceSource,
  quoteAgeMinutes,
  price,
  priceAsOf,
  snapshotDate,
  className = "",
}: DataSourceBadgeProps) {
  const status = deriveDataStatus(priceSource, quoteAgeMinutes, price);

  if (status === "UNAVAILABLE") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}
        title="No market data available for this symbol"
      >
        Market data unavailable
      </span>
    );
  }

  if (status === "DEMO") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 ${className}`}
        title="Simulated demo data for development/testing"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
        DEMO · Simulated
      </span>
    );
  }

  if (status === "EOD") {
    const dateLabel = snapshotDate ? formatDate(snapshotDate) : "";
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}
        title="End-of-day closing price from NSE India"
      >
        NSE EOD{dateLabel ? ` · ${dateLabel}` : ""}
      </span>
    );
  }

  if (status === "LIVE") {
    const timeLabel = priceAsOf ? formatTime(priceAsOf) : "";
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-up ${className}`}
        title="Live intraday price from BSE India"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-up" aria-hidden="true" />
        BSE Live{timeLabel ? ` · ${timeLabel}` : ""}
      </span>
    );
  }

  if (status === "DELAYED") {
    const ago = quoteAgeMinutes !== null ? formatAgo(quoteAgeMinutes) : "";
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-amber-600 ${className}`}
        title="BSE price is slightly delayed (fetched from server cache)"
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full border border-current bg-transparent"
          style={{ background: "linear-gradient(90deg, currentColor 50%, transparent 50%)" }}
          aria-hidden="true"
        />
        BSE Delayed{ago ? ` · ${ago}` : ""}
      </span>
    );
  }

  // STALE
  const ago = quoteAgeMinutes !== null ? formatAgo(quoteAgeMinutes) : "";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-orange-600 ${className}`}
      title="Cached price may be significantly out of date"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
        aria-hidden="true"
      />
      BSE Stale{ago ? ` · ${ago}` : ""}
    </span>
  );
}
