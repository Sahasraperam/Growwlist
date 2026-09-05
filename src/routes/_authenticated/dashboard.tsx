import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  Bell,
  BookMarked,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Filter,
  LayoutGrid,
  LineChart,
  LogOut,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Settings,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  addSymbol,
  checkInWatchlist,
  getWatchlist,
  removeSymbol,
  type WatchItem,
} from "@/lib/watchlist.functions";
import { getNews } from "@/lib/news.functions";
import {
  SIGNIFICANCE_TEXT,
  Sparkline,
  baselineLabel,
  directionClass,
  directionPillClass,
  formatPct,
  formatPrice,
  whyText,
} from "@/components/watchlist-ui";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { SideNav } from "@/components/SideNav";

const REFRESH_MS = 3 * 60 * 1000;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrowwList Smart Market Watchlist" },
      {
        name: "description",
        content:
          "Real-time stock watchlist ranked by anomaly significance with live BSE/NSE market feeds and instant volatility insight.",
      },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchWatchlist = useServerFn(getWatchlist);
  const doCheckIn = useServerFn(checkInWatchlist);
  const fetchNews = useServerFn(getNews);
  const add = useServerFn(addSymbol);
  const remove = useServerFn(removeSymbol);

  const [input, setInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [timeframe, setTimeframe] = useState<"1D" | "1M" | "6M" | "1Y">("1M");

  const { data, isPending, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetchWatchlist(),
    refetchOnWindowFocus: true,
    refetchInterval: REFRESH_MS,
  });

  const checkInMutation = useMutation({
    mutationFn: () => doCheckIn(),
    onSuccess: () => {
      toast.success("Checkpoint updated to current market prices");
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update checkpoint."),
  });

  const items = data?.items ?? [];
  const symbols = items.map((i) => i.symbol);

  const { data: newsData } = useQuery({
    queryKey: ["news", symbols.join(",")],
    queryFn: () => fetchNews({ data: { symbols } }),
    enabled: symbols.length > 0,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: (symbol: string) => add({ data: { symbol } }),
    onSuccess: (res) => {
      setInput("");
      toast.success(`${res.symbol} added to your watchlist`);
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not add that symbol."),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Symbol removed");
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not remove that symbol."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Filter items based on local search box
  const filteredItems = items.filter(
    (item) =>
      item.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.name && item.name.toLowerCase().includes(searchFilter.toLowerCase())),
  );

  const [top] = items;
  const totalValue = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const movedCount = items.filter(
    (i) => i.significance === "unusual" || i.significance === "notable",
  ).length;
  const unusualCount = items.filter((i) => i.significance === "unusual").length;
  const avgChange =
    items.filter((i) => i.changePct !== null).length > 0
      ? items.reduce((s, i) => s + (i.changePct ?? 0), 0) /
        items.filter((i) => i.changePct !== null).length
      : null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Fixed Left Sidebar */}
      <SideNav currentPath="/dashboard" onSignOut={signOut} />

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sticky Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {greeting()}, <span className="text-primary">Trader</span>
            </h1>
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground md:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Market feed connected</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              title="Set current prices as your last-seen baseline"
              className="flex h-9 items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{checkInMutation.isPending ? "Updating Checkpoint…" : "Check In Now"}</span>
            </button>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh Watchlist Prices"
              className="flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`}
              />
              <span className="hidden sm:inline">
                {isFetching
                  ? "Syncing…"
                  : dataUpdatedAt
                    ? `${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Refresh"}
              </span>
            </button>

            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 border border-primary/20 font-mono text-xs font-bold text-primary">
              GL
            </div>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Feed Alert Banner */}
          {data && data.feedStatus !== "ok" && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-600">
              <Zap className="h-4 w-4 shrink-0" />
              <p>
                {data.feedStatus === "unconfigured"
                  ? "Market data connection is pending setup — live intraday prices will update automatically."
                  : "Prices may be delayed due to market data feed response intervals."}
              </p>
            </div>
          )}

          {/* Hero Analytics Overview */}
          <HeroCard
            totalValue={totalValue}
            avgChange={avgChange}
            total={items.length}
            moved={movedCount}
            unusual={unusualCount}
            top={top}
            pending={isPending}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
          />

          {/* Main 2-Column Grid */}
          <div className="grid gap-6 xl:grid-cols-12">
            {/* Left Radar Section (7 Columns) */}
            <section className="xl:col-span-7 flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold tracking-tight">Worth Your Attention</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Stocks ranked by standard deviation anomaly relative to historic swing
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {unusualCount > 0 ? `${unusualCount} Unusual Signals` : "Normal Activity"}
                </span>
              </div>

              {isPending && (
                <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" />
                  Calculating volatility scores...
                </div>
              )}

              {!isPending && items.length === 0 && (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center">
                  <BookMarked className="h-8 w-8 text-muted-foreground/50" />
                  <h3 className="mt-3 text-sm font-medium">Your Watchlist is Empty</h3>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Add your first stock symbol using the panel on the right. GrowwList will monitor
                    price swings and highlight unusual moves.
                  </p>
                </div>
              )}

              {items.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {items.slice(0, 4).map((item, i) => (
                    <StockCard key={item.id} item={item} highlight={i === 0} />
                  ))}
                </div>
              )}
            </section>

            {/* Right Watchlist Panel (5 Columns) */}
            <section className="xl:col-span-5 flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Watchlist Manager</h2>
                  <p className="text-xs text-muted-foreground">{items.length} stocks tracked</p>
                </div>
              </div>

              {/* Add Symbol Input */}
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) addMutation.mutate(input.trim());
                }}
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    aria-label="Add a stock symbol"
                    placeholder="Add symbol e.g. RELIANCE, TCS, AAPL"
                    value={input}
                    onChange={(e) => setInput(e.target.value.toUpperCase())}
                    className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addMutation.isPending || !input.trim()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{addMutation.isPending ? "Adding…" : "Add"}</span>
                </button>
              </form>

              {/* Local Search / Filter */}
              {items.length > 5 && (
                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Filter list..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 w-full rounded-lg border border-border/60 bg-muted/40 px-3 text-xs outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Watchlist Items */}
              <div className="mt-4 flex-1 overflow-y-auto max-h-[380px] divide-y divide-border/50">
                {filteredItems.map((item) => (
                  <Row key={item.id} item={item} onRemove={() => removeMutation.mutate(item.id)} />
                ))}

                {!isPending && items.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No stocks added yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Bottom Row: Attention Mix & News Panel */}
          <div className="grid gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <AttentionMix items={items} />
            </div>
            <div className="xl:col-span-8">
              <NewsPanel items={items} news={newsData?.news ?? {}} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function HeroCard({
  totalValue,
  avgChange,
  total,
  moved,
  unusual,
  top,
  pending,
  timeframe,
  setTimeframe,
}: {
  totalValue: number;
  avgChange: number | null;
  total: number;
  moved: number;
  unusual: number;
  top: WatchItem | undefined;
  pending: boolean;
  timeframe: "1D" | "1M" | "6M" | "1Y";
  setTimeframe: (tf: "1D" | "1M" | "6M" | "1Y") => void;
}) {
  return (
    <section className="grid gap-6 rounded-2xl border border-border/80 bg-card p-6 shadow-sm lg:grid-cols-12">
      {/* Stat Cards */}
      <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
            Tracked Symbols
          </span>
          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="text-3xl font-bold tracking-tight tabular-nums">
              {pending ? "—" : `${total} Symbol${total === 1 ? "" : "s"}`}
            </h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${directionPillClass(avgChange)}`}
            >
              {avgChange && avgChange > 0 ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {formatPct(avgChange)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <span className="text-[11px] text-muted-foreground font-mono">Total Tracked</span>
            <p className="mt-1 text-xl font-bold tabular-nums">{total}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <span className="text-[11px] text-muted-foreground font-mono">Active Movers</span>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-500">{moved}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <span className="text-[11px] text-muted-foreground font-mono">Unusual Moves</span>
            <p className="mt-1 text-xl font-bold tabular-nums text-amber-500">{unusual}</p>
          </div>
        </div>
      </div>

      {/* Top Mover Sparkline Chart Banner */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-border/60 bg-muted/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">
              {top ? `${top.symbol} · ${top.name ?? "Top Mover"}` : "Top Mover"}
            </span>
            {top && (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${directionPillClass(top.changePct)}`}
              >
                {formatPct(top.changePct)}
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-1 rounded-lg border border-border/60 bg-card p-1 text-[11px]">
            {(["1D", "1M", "6M", "1Y"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                  timeframe === t
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {top && top.spark.length > 1 ? (
          <Sparkline
            points={top.spark}
            up={(top.changePct ?? 0) >= 0}
            className="mt-3 h-28 w-full"
            height={110}
          />
        ) : (
          <div className="mt-6 flex h-28 items-center justify-center text-xs text-muted-foreground">
            Price history chart will display here once market quotes are fetched.
          </div>
        )}
      </div>
    </section>
  );
}

function StockCard({ item, highlight }: { item: WatchItem; highlight: boolean }) {
  return (
    <Link
      to="/dashboard/$symbol"
      params={{ symbol: item.symbol }}
      className={`group flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        highlight
          ? "border-primary/40 bg-gradient-to-b from-primary/5 to-transparent"
          : "border-border/80 bg-card hover:border-primary/30"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
              {item.symbol.slice(0, 2)}
            </span>
            <span className="truncate text-xs font-bold tracking-tight">{item.symbol}</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${directionPillClass(item.changePct)}`}
          >
            {formatPct(item.changePct)}
          </span>
        </div>

        <p className="mt-2 text-xl font-bold tracking-tight tabular-nums">
          ${formatPrice(item.price)}
        </p>

        <div className="mt-1 flex items-center justify-between">
          <DataSourceBadge
            priceSource={item.priceSource}
            quoteAgeMinutes={item.quoteAgeMinutes}
            price={item.price}
            priceAsOf={item.priceAsOf}
            snapshotDate={item.snapshotDate}
          />
          <span className="text-[11px] font-medium text-muted-foreground font-mono">
            {SIGNIFICANCE_TEXT[item.significance]}
          </span>
        </div>
      </div>

      {item.spark && item.spark.length > 1 && (
        <Sparkline
          points={item.spark}
          up={(item.changePct ?? 0) >= 0}
          className="mt-3 h-12 w-full"
          height={48}
        />
      )}

      <p className="mt-3 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground">
        {whyText(item)}
      </p>
    </Link>
  );
}

function Row({ item, onRemove }: { item: WatchItem; onRemove: () => void }) {
  return (
    <div className="group flex items-center gap-3 py-3 px-1 transition-colors hover:bg-muted/30 rounded-lg">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/60 font-mono text-xs font-bold">
        {item.symbol.slice(0, 2)}
      </span>

      <Link to="/dashboard/$symbol" params={{ symbol: item.symbol }} className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-bold hover:text-primary">{item.symbol}</span>
          <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-primary" />
        </div>
        <span className="block truncate text-[11px] text-muted-foreground">
          {item.name ?? SIGNIFICANCE_TEXT[item.significance]}
        </span>
      </Link>

      <div className="shrink-0 text-right">
        <span className="block text-xs font-semibold tabular-nums">${formatPrice(item.price)}</span>
        <DataSourceBadge
          priceSource={item.priceSource}
          quoteAgeMinutes={item.quoteAgeMinutes}
          price={item.price}
          priceAsOf={item.priceAsOf}
          snapshotDate={item.snapshotDate}
          className="justify-end"
        />
      </div>

      <span
        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${directionPillClass(item.changePct)}`}
      >
        {formatPct(item.changePct)}
      </span>

      <button
        onClick={onRemove}
        aria-label={`Remove ${item.symbol}`}
        className="shrink-0 text-[11px] font-medium text-muted-foreground opacity-60 transition-opacity hover:opacity-100 hover:text-destructive"
      >
        Remove
      </button>
    </div>
  );
}

function AttentionMix({ items }: { items: WatchItem[] }) {
  const buckets: { key: WatchItem["significance"]; color: string }[] = [
    { key: "unusual", color: "bg-down" },
    { key: "notable", color: "bg-primary" },
    { key: "normal", color: "bg-up" },
    { key: "quiet", color: "bg-muted-foreground/60" },
    { key: "unknown", color: "bg-border" },
  ];
  const total = items.length || 1;

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">Attention Mix</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Distribution of volatility signals across watchlist
      </p>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
        {buckets.map((b) => {
          const n = items.filter((i) => i.significance === b.key).length;
          if (n === 0) return null;
          return (
            <span key={b.key} className={b.color} style={{ width: `${(n / total) * 100}%` }} />
          );
        })}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 xl:grid-cols-1">
        {buckets.map((b) => {
          const n = items.filter((i) => i.significance === b.key).length;
          return (
            <li
              key={b.key}
              className="flex items-center justify-between rounded-lg border border-border/40 p-2"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${b.color}`} />
                <span className="truncate text-muted-foreground">{SIGNIFICANCE_TEXT[b.key]}</span>
              </div>
              <span className="font-mono font-bold tabular-nums">{n}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NewsPanel({
  items,
  news,
}: {
  items: WatchItem[];
  news: Record<string, { title: string; source: string | null; url: string }[]>;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <h2 className="text-base font-semibold tracking-tight">Latest Market Headlines</h2>
        <span className="text-xs text-muted-foreground font-mono">Curated Feed</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Headlines will appear automatically once you add stocks to your watchlist.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item) => {
            const headlines = news[item.symbol] ?? [];
            return (
              <div key={item.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="font-mono text-xs font-bold text-primary">{item.symbol}</span>
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${directionClass(item.changePct)}`}
                  >
                    {formatPct(item.changePct)}
                  </span>
                </div>
                {headlines.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">No recent headlines.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {headlines.map((h) => (
                      <li key={h.url}>
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs leading-snug text-foreground/90 transition-colors hover:text-primary line-clamp-2"
                        >
                          {h.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
