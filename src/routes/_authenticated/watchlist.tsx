import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  BookMarked,
  Grid,
  List,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addSymbol, getWatchlist, removeSymbol, type WatchItem } from "@/lib/watchlist.functions";
import {
  SIGNIFICANCE_TEXT,
  Sparkline,
  directionClass,
  directionPillClass,
  formatPct,
  formatPrice,
  whyText,
} from "@/components/watchlist-ui";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { SideNav } from "@/components/SideNav";

const REFRESH_MS = 3 * 60 * 1000;

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist Manager — GrowwList" },
      {
        name: "description",
        content:
          "Manage and monitor your tracked stock symbols with real-time BSE and NSE price updates.",
      },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchWatchlist = useServerFn(getWatchlist);
  const add = useServerFn(addSymbol);
  const remove = useServerFn(removeSymbol);

  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<
    "all" | "unusual" | "notable" | "normal" | "bse" | "nse"
  >("all");
  const [sortBy, setSortBy] = useState<"significance" | "symbol" | "price" | "change">(
    "significance",
  );
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const { data, isPending, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetchWatchlist(),
    refetchOnWindowFocus: true,
    refetchInterval: REFRESH_MS,
  });

  const items = data?.items ?? [];

  const addMutation = useMutation({
    mutationFn: (symbol: string) => add({ data: { symbol } }),
    onSuccess: (res) => {
      setInput("");
      toast.success(`${res.symbol} added to watchlist`);
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
      toast.error(error instanceof Error ? error.message : "Could not remove symbol."),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Filter items
  const filtered = items.filter((item) => {
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (category === "unusual") return item.significance === "unusual";
    if (category === "notable") return item.significance === "notable";
    if (category === "normal") return item.significance === "normal";
    if (category === "bse") return item.priceSource === "BSE";
    if (category === "nse") return item.priceSource === "NSE";
    return true;
  });

  // Sort items
  filtered.sort((a, b) => {
    if (sortBy === "symbol") return a.symbol.localeCompare(b.symbol);
    if (sortBy === "price") return (b.price ?? 0) - (a.price ?? 0);
    if (sortBy === "change") return Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0);
    // Default significance order
    const sigOrder = { unusual: 4, notable: 3, normal: 2, quiet: 1, unknown: 0 };
    return sigOrder[b.significance] - sigOrder[a.significance];
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <SideNav currentPath="/watchlist" onSignOut={signOut} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <BookMarked className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Watchlist Manager</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-bold text-primary">
              {items.length} Tracked
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`}
              />
              <span>{isFetching ? "Refreshing…" : "Sync Quotes"}</span>
            </button>
          </div>
        </header>

        {/* Content Workspace */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Add & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search stocks by symbol or name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Add Stock Form */}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) addMutation.mutate(input.trim());
              }}
            >
              <input
                placeholder="Add ticker e.g. INFY, TSLA"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                className="h-10 w-44 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={addMutation.isPending || !input.trim()}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                <span>{addMutation.isPending ? "Adding…" : "Add Stock"}</span>
              </button>
            </form>
          </div>

          {/* Category Tabs & View Options */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1 text-xs">
              {(
                [
                  { id: "all", label: "All Tickers" },
                  { id: "unusual", label: "Unusual Moves" },
                  { id: "notable", label: "Notable" },
                  { id: "normal", label: "Normal Range" },
                  { id: "bse", label: "BSE Live" },
                  { id: "nse", label: "NSE EOD" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCategory(tab.id)}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    category === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort & Grid/Table Toggle */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
                >
                  <option value="significance">Significance</option>
                  <option value="symbol">Ticker (A-Z)</option>
                  <option value="price">Highest Price</option>
                  <option value="change">Volatility %</option>
                </select>
              </div>

              <div className="flex shrink-0 gap-1 rounded-xl border border-border/80 bg-card p-1 text-xs">
                <button
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  title="Table View"
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isPending && (
            <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" />
              Loading stock quotes…
            </div>
          )}

          {/* Empty State */}
          {!isPending && filtered.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
              <BookMarked className="h-8 w-8 text-muted-foreground/50" />
              <h3 className="mt-3 text-sm font-bold">No stocks match your filter</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Try clearing your search query or selecting a different category.
              </p>
            </div>
          )}

          {/* Grid View */}
          {!isPending && viewMode === "grid" && filtered.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 font-mono text-xs font-bold text-primary">
                          {item.symbol.slice(0, 2)}
                        </span>
                        <div>
                          <Link
                            to="/dashboard/$symbol"
                            params={{ symbol: item.symbol }}
                            className="font-bold text-sm hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <span>{item.symbol}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                          </Link>
                          <span className="block text-[11px] text-muted-foreground truncate max-w-[120px]">
                            {item.name ?? item.symbol}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${directionPillClass(item.changePct)}`}
                      >
                        {formatPct(item.changePct)}
                      </span>
                    </div>

                    <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
                      ${formatPrice(item.price)}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <DataSourceBadge
                        priceSource={item.priceSource}
                        quoteAgeMinutes={item.quoteAgeMinutes}
                        price={item.price}
                        priceAsOf={item.priceAsOf}
                        snapshotDate={item.snapshotDate}
                      />
                      <span className="text-[11px] font-mono text-muted-foreground font-medium">
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

                  <div className="mt-4 border-t border-border/50 pt-3 flex items-center justify-between text-xs">
                    <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                      {whyText(item)}
                    </p>
                    <button
                      onClick={() => removeMutation.mutate(item.id)}
                      title={`Remove ${item.symbol}`}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {!isPending && viewMode === "table" && filtered.length > 0 && (
            <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/30 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Ticker & Company</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-right">24h Change</th>
                    <th className="py-3 px-4">Exchange Source</th>
                    <th className="py-3 px-4">Significance Signal</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted/20">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                            {item.symbol.slice(0, 2)}
                          </span>
                          <div>
                            <Link
                              to="/dashboard/$symbol"
                              params={{ symbol: item.symbol }}
                              className="font-bold text-xs hover:text-primary"
                            >
                              {item.symbol}
                            </Link>
                            <span className="block text-[10px] text-muted-foreground">
                              {item.name ?? item.symbol}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        ${formatPrice(item.price)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${directionPillClass(item.changePct)}`}
                        >
                          {formatPct(item.changePct)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <DataSourceBadge
                          priceSource={item.priceSource}
                          quoteAgeMinutes={item.quoteAgeMinutes}
                          price={item.price}
                          priceAsOf={item.priceAsOf}
                          snapshotDate={item.snapshotDate}
                        />
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        {SIGNIFICANCE_TEXT[item.significance]}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => removeMutation.mutate(item.id)}
                          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
