/**
 * Server-only market data helpers.
 *
 * Data source: nse-bse-api (unofficial NSE + BSE scraper package).
 * No API key required.
 *
 * Pricing strategy (based on live testing — see nse-bse.server.ts):
 *   • Real-time price (BSE LTP)  — available when BSE scripcode is known
 *   • End-of-day close   (NSE)   — always available via historical API
 *   NSE's live quote endpoint is 403-blocked server-side (anti-scraping).
 *
 * This module exposes the same public surface as the old FMP version so that
 * watchlist.functions.ts needs zero changes.
 */

import {
  getQuoteForSymbol,
  getNseDailyHistory,
  isMarketOpen,
  getMarketStatus,
} from "./nse-bse.server";

// ── Re-export types consumed by watchlist.functions.ts ────────────────────

export type QuoteRow = {
  symbol: string;
  price: number;
  prev_close: number | null;
  company_name: string | null;
  fetched_at: string;
};

export type FeedStatus = "ok" | "degraded" | "unconfigured";

// ── isMarketProviderConfigured — always true; no API key required for nse-bse-api ───────

export function isMarketProviderConfigured(): boolean {
  return true;
}

export const hasMarketKey = isMarketProviderConfigured;

// ── Live quote ────────────────────────────────────────────────────────────

export type LiveQuote = {
  price: number;
  prevClose: number | null;
  name: string | null;
  /** Which exchange supplied this price. Drives the DataSourceBadge. */
  source: "BSE" | "NSE" | "DEMO";
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getMockQuote(symbol: string): LiveQuote {
  const hash = hashString(symbol);
  const basePrice = 120 + (hash % 3800);
  const changePct = (((hash * 17) % 600) - 300) / 100;
  const prevClose = basePrice / (1 + changePct / 100);

  return {
    price: Number(basePrice.toFixed(2)),
    prevClose: Number(prevClose.toFixed(2)),
    name: `[DEMO] ${symbol}`,
    source: "DEMO",
  };
}

function getMockDailyHistory(symbol: string, days = 30): DailyClose[] {
  const quote = getMockQuote(symbol);
  const out: DailyClose[] = [];
  let price = quote.price;
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    out.push({ date: dateStr, close: Number(price.toFixed(2)) });
    const factor = 1 + Math.sin(i * 0.8 + hashString(symbol)) * 0.018;
    price = Math.max(10, price * factor);
  }
  return out;
}

/**
 * Returns the latest available price for `symbol`.
 *
 * Priority:
 *   1. BSE live LTP (real-time, requires successful scripcode lookup)
 *   2. NSE latest daily close from historical data (end-of-day)
 *   3. If provider fails, returns null (never synthesizes fake production data)
 */
export async function fetchQuote(symbol: string): Promise<LiveQuote | null> {
  if (process.env["USE_MOCK_MARKET_DATA"] === "true") {
    return getMockQuote(symbol);
  }

  try {
    const q = await getQuoteForSymbol(symbol);
    if (q && Number.isFinite(q.price) && q.price > 0) {
      return {
        price: q.price,
        prevClose: q.prevClose,
        name: q.name,
        source: q.source,
      };
    }
  } catch {
    // failure handled by returning null
  }
  return null;
}

// ── Daily history ─────────────────────────────────────────────────────────

export type DailyClose = { date: string; close: number };

/**
 * Returns up to `days` daily closes for `symbol`, newest-first.
 * Priority: NSE historical scraper -> null if unavailable.
 */
export async function fetchDailyHistory(symbol: string, days = 90): Promise<DailyClose[] | null> {
  if (process.env["USE_MOCK_MARKET_DATA"] === "true") {
    return getMockDailyHistory(symbol, days);
  }

  try {
    const history = await getNseDailyHistory(symbol, days);
    if (history && history.length >= 5) return history;
  } catch {
    // failure handled by returning null
  }
  return null;
}

// ── Symbol search ─────────────────────────────────────────────────────────

export type SymbolMatch = { symbol: string; name: string | null; exchange: string | null };

/**
 * Symbol search is not reliably available via nse-bse-api.
 * Returns an empty array — watchlist.functions.ts handles the unconfigured
 * case by skipping the quote validation for addSymbol when hasMarketKey()
 * is true but symbolExists() returns null.
 */
export async function searchSymbols(_query: string, _limit = 8): Promise<SymbolMatch[]> {
  return [];
}

/**
 * Returns null (unknown) rather than false so that addSymbol does NOT block
 * users from adding symbols we can't validate.  Validation happens implicitly:
 * if fetchQuote() succeeds on the new symbol, the symbol is real.
 */
export async function symbolExists(symbol: string): Promise<boolean | null> {
  const q = await fetchQuote(symbol);
  if (q === null) return false;
  return true;
}

// ── Market status ─────────────────────────────────────────────────────────

export type MarketStatus = {
  isOpen: boolean;
  segments: Awaited<ReturnType<typeof getMarketStatus>>;
};

export async function fetchMarketStatus(): Promise<MarketStatus> {
  const [open, segments] = await Promise.all([isMarketOpen(), getMarketStatus()]);
  return { isOpen: open, segments };
}

// ── Pure math helpers (unchanged from original) ───────────────────────────

/**
 * Typical daily swing for this stock: standard deviation of its recent
 * daily percentage returns. Returns null when there isn't enough history.
 */
export function typicalDailySwing(closesNewestFirst: number[]): number | null {
  const closes = closesNewestFirst.filter((c) => Number.isFinite(c) && c > 0);
  if (closes.length < 11) return null;
  const returns: number[] = [];
  for (let i = 0; i < closes.length - 1; i++) {
    const newer = closes[i]!;
    const older = closes[i + 1]!;
    returns.push(((newer - older) / older) * 100);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  return sd > 0.01 ? sd : null;
}

export type Significance = "unusual" | "notable" | "normal" | "quiet" | "unknown";

export function significanceLabel(score: number | null): Significance {
  if (score === null) return "unknown";
  const s = Math.abs(score);
  if (s >= 2) return "unusual";
  if (s >= 1) return "notable";
  if (s >= 0.35) return "normal";
  return "quiet";
}

export const SIGNIFICANCE_TEXT: Record<Significance, string> = {
  unusual: "Unusual move",
  notable: "Notable move",
  normal: "Normal range",
  quiet: "Quiet",
  unknown: "Learning its normal range",
};

export type Prediction = {
  direction: "up" | "down" | "flat";
  expected: number;
  low: number;
  high: number;
  driftPct: number;
  swingPct: number;
  confidence: "low" | "moderate";
  text: string;
};

/**
 * A deliberately simple, honest projection: recent average daily drift as the
 * centre, the stock's own typical daily swing as the range. Not advice.
 */
export function predictTomorrow(
  symbol: string,
  price: number | null,
  closesNewestFirst: number[],
): Prediction | null {
  const closes = closesNewestFirst.filter((c) => Number.isFinite(c) && c > 0);
  if (price === null || closes.length < 11) return null;
  const swing = typicalDailySwing(closes);
  if (swing === null) return null;

  const window = closes.slice(0, 21);
  const returns: number[] = [];
  for (let i = 0; i < window.length - 1; i++) {
    returns.push(((window[i]! - window[i + 1]!) / window[i + 1]!) * 100);
  }
  const drift = returns.reduce((a, b) => a + b, 0) / returns.length;

  const expected = price * (1 + drift / 100);
  const low = price * (1 + (drift - swing) / 100);
  const high = price * (1 + (drift + swing) / 100);
  const direction = Math.abs(drift) < swing * 0.15 ? "flat" : drift > 0 ? "up" : "down";
  const confidence = closes.length >= 30 ? "moderate" : "low";

  const shape =
    direction === "flat"
      ? `${symbol} has no clear recent direction, so tomorrow most likely lands near today's price`
      : `${symbol} has been drifting ${direction === "up" ? "higher" : "lower"} by about ${Math.abs(drift).toFixed(2)}% a day recently`;

  return {
    direction,
    expected,
    low,
    high,
    driftPct: drift,
    swingPct: swing,
    confidence,
    text: `${shape}. On a normal day it swings about ${swing.toFixed(2)}%, so a reasonable range for tomorrow is ${low.toFixed(2)} to ${high.toFixed(2)}. This is a simple projection from recent behaviour, not a forecast of news.`,
  };
}
