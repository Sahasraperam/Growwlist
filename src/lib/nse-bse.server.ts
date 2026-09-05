/**
 * Server-only adapter for the `nse-bse-api` package.
 *
 * KEY FACTS discovered from live testing (2026-09-04):
 *  - nse.equity.getQuote() / nse.equityQuote()  → 403 Forbidden (NSE bot-blocks server-side)
 *  - nse.historical.fetchEquityHistoricalData()  → ✅ Works (daily OHLCV)
 *  - nse.market.getStatus()                      → ✅ Works
 *  - bse.quote(scripcode)                        → ✅ Works (live LTP)
 *  - bse.lookupSymbol()                          → ⚠️  Unreliable (garbled data)
 *  - bse.getScripCode(name)                      → used for NSE→BSE code mapping
 *
 * NSE real-time prices are NOT available server-side.
 * We derive price from the most recent close in historical data.
 * BSE prices (LTP) are real-time during market hours.
 *
 * This module MUST only be imported in server-side code (*.server.ts / server functions).
 */

import type { NSEClient } from "nse-bse-api";
import type { BSE as BSEClient } from "nse-bse-api";

// ── Singleton clients ──────────────────────────────────────────────────────
let _nse: NSEClient | null = null;
let _bse: BSEClient | null = null;

/** Lazy-create and return the NSE singleton. */
async function nse(): Promise<NSEClient> {
  if (!_nse) {
    const { NSE } = await import("nse-bse-api");
    _nse = new NSE("/tmp/nse_cookies", { timeout: 12000 });
  }
  return _nse;
}

/** Lazy-create and return the BSE singleton. */
async function bse(): Promise<BSEClient> {
  if (!_bse) {
    const { BSE } = await import("nse-bse-api");
    _bse = new BSE({ timeout: 10000 });
  }
  return _bse;
}

// ── In-memory BSE scrip-code cache (rarely changes) ───────────────────────
const _bseCodeCache = new Map<string, string | null>();

// ── Public types ──────────────────────────────────────────────────────────

export type NseBseQuote = {
  /** LTP or latest close */
  price: number;
  /** Previous session close */
  prevClose: number | null;
  /** Company name if available */
  name: string | null;
  /** 'NSE' or 'BSE' */
  source: "NSE" | "BSE";
  /** Whether this is an intraday live price (BSE) or end-of-day close (NSE) */
  isLive: boolean;
};

export type DailyClose = {
  date: string; // YYYY-MM-DD
  close: number;
};

export type MarketSegmentStatus = {
  market: string;
  marketStatus: string;
  tradeDate: string;
  index: string;
  last: number | string;
  variation: number | string;
  percentChange: number | string;
  marketStatusMessage: string;
};

// ── BSE scripcode helpers ─────────────────────────────────────────────────

/**
 * Returns the BSE scrip code for a given stock symbol.
 * Tries bse.getScripCode(symbol) and caches the result.
 * Returns null if not found or on error.
 */
export async function getBseScripCode(symbol: string): Promise<string | null> {
  const key = symbol.toUpperCase();
  if (_bseCodeCache.has(key)) return _bseCodeCache.get(key) ?? null;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("instruments")
      .select("exchange_code")
      .eq("symbol", key)
      .eq("exchange", "BSE")
      .maybeSingle();

    if (data?.exchange_code) {
      _bseCodeCache.set(key, data.exchange_code);
      return data.exchange_code;
    }
  } catch {
    // proceed to provider lookup
  }

  try {
    const client = await bse();
    const code = await Promise.race<string>([
      client.getScripCode(key),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
    const result = code && /^\d+$/.test(code.trim()) ? code.trim() : null;
    _bseCodeCache.set(key, result);
    if (result) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("instruments").upsert(
        {
          symbol: key,
          exchange: "BSE",
          exchange_code: result,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "symbol" },
      );
    }
    return result;
  } catch {
    _bseCodeCache.set(key, null);
    return null;
  }
}

// ── BSE quote ─────────────────────────────────────────────────────────────

/**
 * Fetch a live BSE quote by scripcode.
 * Returns null on error.
 *
 * Live response shape:
 *   { PrevClose, Open, High, Low, LTP }
 */
export async function getBseQuote(scripcode: string): Promise<NseBseQuote | null> {
  try {
    const client = await bse();
    const raw = await Promise.race([
      client.quote(scripcode),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]);

    // BSE returns capitalised keys (PrevClose, LTP) OR lowercase (ltp, previousclose)
    // Handle both defensively
    const ltp =
      typeof raw.LTP === "number" ? raw.LTP : typeof raw.ltp === "number" ? raw.ltp : null;
    const prev =
      typeof raw.PrevClose === "number"
        ? raw.PrevClose
        : typeof raw.previousclose === "number"
          ? raw.previousclose
          : null;

    if (ltp === null || ltp <= 0) return null;

    return {
      price: ltp,
      prevClose: prev,
      name: null, // BSE quote endpoint doesn't return name
      source: "BSE",
      isLive: true,
    };
  } catch {
    return null;
  }
}

// ── NSE historical → latest close ────────────────────────────────────────

/**
 * Fetches NSE equity historical data and returns the most recent close
 * as a NseBseQuote.  Also returns the previous close (second entry) if
 * available.
 *
 * Historical record shape (live):
 *   chClosingPrice, chPreviousClsPrice, chLastTradedPrice, mtimestamp, chSymbol
 */
export async function getNseLatestClose(symbol: string): Promise<NseBseQuote | null> {
  try {
    const client = await nse();
    const to = new Date();
    // Fetch 10 calendar days to cover weekends/holidays
    const from = new Date(to.getTime() - 10 * 86_400_000);

    const rows = await Promise.race([
      client.historical.fetchEquityHistoricalData({
        symbol: symbol.toUpperCase(),
        from_date: from,
        to_date: to,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)),
    ]);

    if (!Array.isArray(rows) || rows.length === 0) return null;

    // fetchEquityHistoricalData returns oldest-first; we want newest
    const sorted = [...rows].sort((a, b) => {
      const da = parseMtimestamp(String(a["mtimestamp"] ?? ""));
      const db = parseMtimestamp(String(b["mtimestamp"] ?? ""));
      return db - da;
    });

    const latest = sorted[0] as Record<string, unknown>;
    const prev = sorted[1] as Record<string, unknown> | undefined;

    const price = toNum(latest["chClosingPrice"]) ?? toNum(latest["chLastTradedPrice"]) ?? null;
    if (price === null || price <= 0) return null;

    const prevClose =
      toNum(latest["chPreviousClsPrice"]) ??
      (prev ? (toNum(prev["chClosingPrice"]) ?? null) : null);

    const name = typeof latest["chSymbol"] === "string" ? (latest["chSymbol"] as string) : null;

    return { price, prevClose, name, source: "NSE", isLive: false };
  } catch {
    return null;
  }
}

// ── NSE historical data (for spark + swing calculations) ─────────────────

/**
 * Returns up to `days` daily closes for a symbol, newest-first.
 * Uses NSE historical API.
 */
export async function getNseDailyHistory(symbol: string, days = 90): Promise<DailyClose[] | null> {
  try {
    const client = await nse();
    const to = new Date();
    // Fetch extra days to account for weekends/holidays
    const from = new Date(to.getTime() - days * 1.6 * 86_400_000);

    const rows = await Promise.race([
      client.historical.fetchEquityHistoricalData({
        symbol: symbol.toUpperCase(),
        from_date: from,
        to_date: to,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20000)),
    ]);

    if (!Array.isArray(rows) || rows.length === 0) return null;

    const out: DailyClose[] = [];
    for (const raw of rows as Record<string, unknown>[]) {
      const dateStr = parseDateString(String(raw["mtimestamp"] ?? ""));
      const close = toNum(raw["chClosingPrice"]) ?? toNum(raw["chLastTradedPrice"]) ?? null;
      if (dateStr && close !== null && close > 0) {
        out.push({ date: dateStr, close });
      }
    }

    // newest-first
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out.slice(0, days);
  } catch {
    return null;
  }
}

// ── Market status ─────────────────────────────────────────────────────────

/**
 * Returns NSE market status segments.
 * Example: [{market:"Capital Market", marketStatus:"Closed", ...}]
 */
export async function getMarketStatus(): Promise<MarketSegmentStatus[] | null> {
  try {
    const client = await nse();
    const result = await Promise.race([
      client.market.getStatus(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
    return Array.isArray(result) ? (result as MarketSegmentStatus[]) : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the NSE Capital Market is currently open.
 */
export async function isMarketOpen(): Promise<boolean> {
  const status = await getMarketStatus();
  if (!status) return false;
  const cm = status.find(
    (s) => s.market === "Capital Market" || s.market?.toLowerCase().includes("capital"),
  );
  return cm?.marketStatus?.toLowerCase() === "open";
}

// ── Unified quote (BSE live → NSE historical fallback) ───────────────────

/**
 * Best-effort quote for any NSE symbol.
 * Strategy:
 *   1. Try BSE live quote (scripcode lookup + bse.quote)
 *   2. Fall back to NSE latest close from historical data
 * Returns null only if both fail.
 */
export async function getQuoteForSymbol(symbol: string): Promise<NseBseQuote | null> {
  // 1. Try BSE live first
  const scripcode = await getBseScripCode(symbol);
  if (scripcode) {
    const bseQ = await getBseQuote(scripcode);
    if (bseQ) return bseQ;
  }

  // 2. Fall back to NSE historical
  return getNseLatestClose(symbol);
}

// ── Cleanup ───────────────────────────────────────────────────────────────

/** Call on server shutdown to persist NSE cookies. */
export function exitClients(): void {
  try {
    _nse?.exit();
  } catch {
    // ignore
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse NSE mtimestamp like "05-Aug-2026" → ms since epoch
 */
function parseMtimestamp(s: string): number {
  if (!s) return 0;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Parse NSE mtimestamp like "05-Aug-2026" → "2026-08-05"
 */
function parseDateString(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
