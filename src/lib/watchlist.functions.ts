import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Significance = "unusual" | "notable" | "normal" | "quiet" | "unknown";

export type WatchItem = {
  id: string;
  symbol: string;
  name: string | null;
  price: number | null;
  changePct: number | null;
  changeAbs: number | null;
  baseline: "last-seen" | "previous-close" | "none";
  lastSeenAt: string | null;
  addedAt: string;
  swing: number | null;
  score: number | null;
  significance: Significance;
  historyDays: number;
  quoteAgeMinutes: number | null;
  spark: number[];
  /** Exchange that supplied this price: "BSE" (live LTP), "NSE" (EOD close), or "DEMO". Null = unknown. */
  priceSource: "BSE" | "NSE" | "DEMO" | null;
  /** ISO timestamp of when this price was fetched. Null when price is unavailable. */
  priceAsOf: string | null;
  /** YYYY-MM-DD of the most recent trading session in price_snapshots. Used to label NSE EOD dates. */
  snapshotDate: string | null;
};

export type WatchlistPayload = {
  items: WatchItem[];
  feedStatus: "ok" | "degraded" | "unconfigured";
  stale: boolean;
  lastVisitAt: string | null;
};

const QUOTE_TTL_MINUTES = 10;
const HISTORY_TTL_HOURS = 20;

type CacheRow = {
  symbol: string;
  price: number;
  prev_close: number | null;
  company_name: string | null;
  fetched_at: string;
  data_source: string | null;
  data_status: string | null;
};

let _rlsWarned = false;

async function safeUpsertQuoteCache(
  supabaseAdmin: SupabaseClient<Database>,
  row: CacheRow,
  contextTag: string = "refreshSymbolData",
) {
  let { error } = await supabaseAdmin
    .from("quote_cache")
    .upsert(row as Database["public"]["Tables"]["quote_cache"]["Insert"], { onConflict: "symbol" });

  if (error?.code === "PGRST204") {
    // Remote DB lacks data_source / data_status columns. Retry without them.
    const legacyRow = {
      symbol: row.symbol,
      price: row.price,
      prev_close: row.prev_close,
      company_name: row.company_name,
      fetched_at: row.fetched_at,
    };
    const fallback = await supabaseAdmin
      .from("quote_cache")
      .upsert(legacyRow as Database["public"]["Tables"]["quote_cache"]["Insert"], {
        onConflict: "symbol",
      });
    error = fallback.error;
  }

  if (error) {
    const isRlsOrKeyError =
      error.code === "42501" ||
      error.message?.includes("Invalid API key") ||
      error.message?.includes("API key");
    if (isRlsOrKeyError) {
      if (!_rlsWarned) {
        _rlsWarned = true;
        console.warn(
          `[${contextTag}] Cache upsert skipped (Invalid or missing service_role key). Add valid SUPABASE_SERVICE_ROLE_KEY to .env to enable server caching.`,
        );
      }
    } else {
      console.error(`[${contextTag}] Quote cache upsert error for ${row.symbol}:`, error);
    }
  }
}

async function safeUpsertPriceSnapshots(
  supabaseAdmin: SupabaseClient<Database>,
  snapshots: { symbol: string; snapshot_date: string; close: number }[],
  symbol: string,
) {
  const { error } = await supabaseAdmin
    .from("price_snapshots")
    .upsert(snapshots, { onConflict: "symbol,snapshot_date" });

  if (error) {
    const isRlsOrKeyError =
      error.code === "42501" ||
      error.message?.includes("Invalid API key") ||
      error.message?.includes("API key");
    if (isRlsOrKeyError) {
      if (!_rlsWarned) {
        _rlsWarned = true;
        console.warn(
          `[refreshSymbolData] Snapshot upsert skipped (Invalid or missing service_role key). Add valid SUPABASE_SERVICE_ROLE_KEY to .env to enable server caching.`,
        );
      }
    } else {
      console.error(`[refreshSymbolData] Snapshot upsert error for ${symbol}:`, error);
    }
  }
}

async function refreshSymbolData(symbols: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const market = await import("./market.server");

  const { data: quoteRows } = await supabaseAdmin
    .from("quote_cache")
    .select("*")
    .in("symbol", symbols);
  const { data: snapRows } = await supabaseAdmin
    .from("price_snapshots")
    .select("symbol, snapshot_date, close")
    .in("symbol", symbols)
    .order("snapshot_date", { ascending: false });

  const quotes = new Map<string, CacheRow>();
  for (const row of (quoteRows ?? []) as CacheRow[]) quotes.set(row.symbol, row);

  const history = new Map<string, { date: string; close: number }[]>();
  for (const row of snapRows ?? []) {
    const list = history.get(row.symbol) ?? [];
    list.push({ date: row.snapshot_date as string, close: Number(row.close) });
    history.set(row.symbol, list);
  }

  let degraded = false;
  const now = Date.now();
  const configured = market.isMarketProviderConfigured();

  // Bounded concurrency (chunk size 5) to avoid serial bottleneck while respecting provider limits
  const CHUNK_SIZE = 5;
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    if (!configured) break;
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (symbol) => {
        const cached = quotes.get(symbol);
        const ageMin = cached ? (now - new Date(cached.fetched_at).getTime()) / 60000 : Infinity;

        if (ageMin > QUOTE_TTL_MINUTES) {
          const quote = await market.fetchQuote(symbol);
          if (quote) {
            const row: CacheRow = {
              symbol,
              price: quote.price,
              prev_close: quote.prevClose,
              company_name: quote.name ?? cached?.company_name ?? null,
              fetched_at: new Date().toISOString(),
              data_source: quote.source,
              data_status:
                quote.source === "DEMO" ? "DEMO" : quote.source === "BSE" ? "LIVE" : "EOD",
            };
            await safeUpsertQuoteCache(supabaseAdmin, row, "refreshSymbolData");
            quotes.set(symbol, row);
          } else if (cached) {
            // Provider failed, but valid cached quote exists -> preserve it, mark stale
            degraded = true;
            quotes.set(symbol, { ...cached, data_status: "STALE" });
          } else {
            degraded = true;
          }
        }

        const hist = history.get(symbol) ?? [];
        const newest = hist[0]?.date ? new Date(`${hist[0].date}T00:00:00Z`).getTime() : 0;
        const historyStale = hist.length < 11 || (now - newest) / 3600000 > HISTORY_TTL_HOURS;

        if (historyStale) {
          const fetched = await market.fetchDailyHistory(symbol);
          if (fetched && fetched.length) {
            await safeUpsertPriceSnapshots(
              supabaseAdmin,
              fetched.map((d) => ({ symbol, snapshot_date: d.date, close: d.close })),
              symbol,
            );
            history.set(
              symbol,
              fetched.map((d) => ({ date: d.date, close: d.close })),
            );
          } else {
            degraded = true;
          }
        }
      }),
    );
  }

  return { quotes, history, degraded, configured };
}

function buildItem(
  row: {
    id: string;
    symbol: string;
    added_at: string;
    last_seen_price: number | null;
    last_seen_at: string | null;
  },
  quote: CacheRow | undefined,
  hist: { date: string; close: number }[],
  swing: number | null,
  significanceLabel: (score: number | null) => Significance,
): WatchItem {
  const price = quote ? Number(quote.price) : null;
  const lastSeen = row.last_seen_price !== null ? Number(row.last_seen_price) : null;
  const prevClose =
    quote?.prev_close !== null && quote?.prev_close !== undefined ? Number(quote.prev_close) : null;

  let baseline: WatchItem["baseline"] = "none";
  let reference: number | null = null;
  if (price !== null && lastSeen !== null && lastSeen > 0) {
    baseline = "last-seen";
    reference = lastSeen;
  } else if (price !== null && prevClose !== null && prevClose > 0) {
    baseline = "previous-close";
    reference = prevClose;
  }

  const changeAbs = price !== null && reference !== null ? price - reference : null;
  const changePct = changeAbs !== null && reference ? (changeAbs / reference) * 100 : null;

  // Stale current quote MUST NOT produce a fresh attention score or significance
  const isStale = quote?.data_status === "STALE";
  const score = !isStale && changePct !== null && swing ? changePct / swing : null;
  const significance = !isStale ? significanceLabel(score) : "unknown";

  const rawSource = quote?.data_source;
  const priceSource: WatchItem["priceSource"] =
    rawSource === "BSE" || rawSource === "NSE" || rawSource === "DEMO" ? rawSource : null;

  const snapshotDate = hist[0]?.date ?? null;

  return {
    id: row.id,
    symbol: row.symbol,
    name: quote?.company_name ?? null,
    price,
    changePct,
    changeAbs,
    baseline,
    lastSeenAt: row.last_seen_at,
    addedAt: row.added_at,
    swing,
    score,
    significance,
    historyDays: hist.length,
    spark: hist
      .slice(0, 30)
      .map((h) => h.close)
      .reverse(),
    quoteAgeMinutes: quote
      ? Math.round((Date.now() - new Date(quote.fetched_at).getTime()) / 60000)
      : null,
    priceSource,
    priceAsOf: quote?.fetched_at ?? null,
    snapshotDate,
  };
}

/**
 * getWatchlist is strictly READ-ONLY.
 * It fetches the current watchlist and market quotes without mutating last_seen_price or last_seen_at.
 * Automatic TanStack Query background refetches call this function safety without shifting user baseline.
 */
export const getWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WatchlistPayload> => {
    const market = await import("./market.server");
    const { data: rows, error } = await context.supabase
      .from("watchlist_items")
      .select("id, symbol, added_at, last_seen_price, last_seen_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(`Database error: ${error.message}`);

    const list = rows ?? [];
    if (!list.length) {
      return {
        items: [],
        feedStatus: market.isMarketProviderConfigured() ? "ok" : "unconfigured",
        stale: false,
        lastVisitAt: null,
      };
    }

    const symbols = list.map((r) => r.symbol as string);
    const { quotes, history, degraded, configured } = await refreshSymbolData(symbols);

    const lastVisitAt =
      list
        .map((r) => r.last_seen_at as string | null)
        .filter((v): v is string => Boolean(v))
        .sort()
        .pop() ?? null;

    const items = list.map((row) => {
      const hist = history.get(row.symbol as string) ?? [];
      const swing = market.typicalDailySwing(hist.map((h) => h.close));
      return buildItem(
        row as never,
        quotes.get(row.symbol as string),
        hist,
        swing,
        market.significanceLabel,
      );
    });

    items.sort((a, b) => {
      const av =
        a.score !== null
          ? Math.abs(a.score)
          : a.changePct !== null
            ? Math.abs(a.changePct) / 4
            : -1;
      const bv =
        b.score !== null
          ? Math.abs(b.score)
          : b.changePct !== null
            ? Math.abs(b.changePct) / 4
            : -1;
      return bv - av;
    });

    return {
      items,
      feedStatus: !configured ? "unconfigured" : degraded ? "degraded" : "ok",
      stale: degraded || !configured,
      lastVisitAt,
    };
  });

/**
 * Atomic user check-in function.
 * Explicitly updates the user's last_seen_price and last_seen_at checkpoints in a single batch upsert.
 */
export const checkInWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; seenAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await context.supabase
      .from("watchlist_items")
      .select("id, symbol, added_at")
      .eq("user_id", context.userId);

    if (error) {
      throw new Error(`Failed to load watchlist for check-in: ${error.message}`);
    }
    if (!rows || !rows.length) {
      return { ok: true, seenAt: new Date().toISOString() };
    }

    const symbols = rows.map((r) => r.symbol);
    const { quotes } = await refreshSymbolData(symbols);

    const seenAt = new Date().toISOString();
    const updates = rows
      .map((r) => {
        const q = quotes.get(r.symbol);
        if (!q || !Number.isFinite(q.price)) return null;
        return {
          id: r.id,
          user_id: context.userId,
          symbol: r.symbol,
          added_at: r.added_at,
          last_seen_price: q.price,
          last_seen_at: seenAt,
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    if (updates.length) {
      const { error: upsertErr } = await supabaseAdmin
        .from("watchlist_items")
        .upsert(updates as TablesInsert<"watchlist_items">[], { onConflict: "user_id,symbol" });

      if (upsertErr) {
        throw new Error(`Failed to save checkpoint to database: ${upsertErr.message}`);
      }
    }

    return { ok: true, seenAt };
  });

export const addSymbol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { symbol: string }) => {
    const symbol = String(input.symbol ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9.-]{1,12}$/.test(symbol))
      throw new Error("Enter a valid ticker symbol (e.g. RELIANCE, TCS, AAPL).");
    return { symbol };
  })
  .handler(async ({ data, context }) => {
    const market = await import("./market.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch quote (live BSE/NSE or mock) and seed quote_cache if returned
    const quote = await market.fetchQuote(data.symbol);
    if (quote) {
      await safeUpsertQuoteCache(
        supabaseAdmin,
        {
          symbol: data.symbol,
          price: quote.price,
          prev_close: quote.prevClose,
          company_name: quote.name,
          fetched_at: new Date().toISOString(),
          data_source: quote.source,
          data_status: quote.source === "DEMO" ? "DEMO" : quote.source === "BSE" ? "LIVE" : "EOD",
        },
        "addSymbol",
      );
    } else if (process.env["USE_MOCK_MARKET_DATA"] !== "true") {
      // Validate symbol against history if live quote fails
      const hist = await market.fetchDailyHistory(data.symbol, 5);
      if (!hist || !hist.length) {
        throw new Error(
          `Could not verify market data for "${data.symbol}". Please check the symbol and try again.`,
        );
      }
    }

    const { error } = await context.supabase
      .from("watchlist_items")
      .insert({ user_id: context.userId, symbol: data.symbol });

    if (error) {
      if (error.code === "23505") throw new Error(`${data.symbol} is already on your watchlist.`);
      throw new Error(error.message);
    }

    return { ok: true, symbol: data.symbol };
  });

export const removeSymbol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type SymbolDetail = {
  item: WatchItem | null;
  symbol: string;
  history: { date: string; close: number }[];
  prediction: import("./market.server").Prediction | null;
  feedStatus: "ok" | "degraded" | "unconfigured";
};

export const getSymbolDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { symbol: string }) => ({
    symbol: String(input.symbol ?? "")
      .trim()
      .toUpperCase(),
  }))
  .handler(async ({ data, context }): Promise<SymbolDetail> => {
    const market = await import("./market.server");
    const { data: row, error } = await context.supabase
      .from("watchlist_items")
      .select("id, symbol, added_at, last_seen_price, last_seen_at")
      .eq("user_id", context.userId)
      .eq("symbol", data.symbol)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!row) {
      return {
        item: null,
        symbol: data.symbol,
        history: [],
        prediction: null,
        feedStatus: market.isMarketProviderConfigured() ? "ok" : "unconfigured",
      };
    }

    const { quotes, history, degraded, configured } = await refreshSymbolData([data.symbol]);
    const hist = history.get(data.symbol) ?? [];
    const swing = market.typicalDailySwing(hist.map((h) => h.close));
    const item = buildItem(
      row as never,
      quotes.get(data.symbol),
      hist,
      swing,
      market.significanceLabel,
    );

    return {
      item,
      symbol: data.symbol,
      history: hist.slice(0, 40).reverse(),
      prediction: market.predictTomorrow(
        data.symbol,
        item.price,
        hist.map((h) => h.close),
      ),
      feedStatus: !configured ? "unconfigured" : degraded ? "degraded" : "ok",
    };
  });
