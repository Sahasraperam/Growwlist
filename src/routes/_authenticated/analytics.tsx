import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  LineChart,
  PieChart,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWatchlist, type WatchItem } from "@/lib/watchlist.functions";
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

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics & Volatility Radar — GrowwList" },
      {
        name: "description",
        content:
          "Quantitative standard deviation metrics, volatility rank, and anomaly distribution across stock watchlists.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchWatchlist = useServerFn(getWatchlist);

  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetchWatchlist(),
    refetchOnWindowFocus: true,
    refetchInterval: REFRESH_MS,
  });

  const items = data?.items ?? [];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Analytics Metrics Calculation
  const totalCount = items.length;
  const unusualItems = items.filter((i) => i.significance === "unusual");
  const notableItems = items.filter((i) => i.significance === "notable");
  const normalItems = items.filter((i) => i.significance === "normal");
  const quietItems = items.filter((i) => i.significance === "quiet");

  const gainers = items.filter((i) => (i.changePct ?? 0) > 0);
  const losers = items.filter((i) => (i.changePct ?? 0) < 0);

  const avgSwing =
    items.filter((i) => i.swing !== null).length > 0
      ? items.reduce((sum, i) => sum + (i.swing ?? 0), 0) /
        items.filter((i) => i.swing !== null).length
      : 0;

  const maxScoreItem = [...items].sort(
    (a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0),
  )[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <SideNav currentPath="/analytics" onSignOut={signOut} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <LineChart className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Analytics & Anomaly Radar</h1>
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
              <span>{isFetching ? "Recalculating…" : "Recalculate Radar"}</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top 4 Analytics Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Average Swing Standard
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {isPending ? "—" : `${avgSwing.toFixed(2)}%`}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Historical daily volatility baseline
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Highest Anomaly Score
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-primary">
                {isPending || !maxScoreItem
                  ? "—"
                  : `${Math.abs(maxScoreItem.score ?? 0).toFixed(1)}×`}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {maxScoreItem
                  ? `${maxScoreItem.symbol} · ${maxScoreItem.significance}`
                  : "No score calculated"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Market Sentiment Ratio
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight tabular-nums text-emerald-500">
                  {gainers.length}
                </p>
                <span className="text-xs text-muted-foreground">/</span>
                <p className="text-2xl font-semibold tracking-tight tabular-nums text-rose-500">
                  {losers.length}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Advancers vs Decliners ratio</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Unusual Signals Count
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-amber-500">
                {unusualItems.length}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Beyond 2.0× standard deviation
              </p>
            </div>
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid gap-6 xl:grid-cols-12">
            {/* Left Column: Anomaly Distribution Matrix */}
            <section className="xl:col-span-6 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold tracking-tight">
                  Volatility Anomaly Breakdown
                </h2>
              </div>

              {/* Progress Stack Bar */}
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
                {totalCount > 0 && (
                  <>
                    <span
                      className="bg-rose-500"
                      style={{ width: `${(unusualItems.length / totalCount) * 100}%` }}
                    />
                    <span
                      className="bg-primary"
                      style={{ width: `${(notableItems.length / totalCount) * 100}%` }}
                    />
                    <span
                      className="bg-emerald-500"
                      style={{ width: `${(normalItems.length / totalCount) * 100}%` }}
                    />
                    <span
                      className="bg-muted-foreground/40"
                      style={{ width: `${(quietItems.length / totalCount) * 100}%` }}
                    />
                  </>
                )}
              </div>

              {/* Stacked Metric Breakdown */}
              <div className="mt-6 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                    <span className="font-medium">Unusual Move (&ge; 2.0&times; Std Dev)</span>
                  </div>
                  <span className="font-mono font-bold">{unusualItems.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                    <span className="font-medium">Notable Move (&ge; 1.0&times; Std Dev)</span>
                  </div>
                  <span className="font-mono font-bold">{notableItems.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    <span className="font-medium">Normal Range (&lt; 1.0&times; Std Dev)</span>
                  </div>
                  <span className="font-mono font-bold">{normalItems.length}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" />
                    <span className="font-medium">Quiet / Learning Baseline</span>
                  </div>
                  <span className="font-mono font-bold">{quietItems.length}</span>
                </div>
              </div>
            </section>

            {/* Right Column: Top Volatility Radar Cards */}
            <section className="xl:col-span-6 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold tracking-tight">
                    Volatility Radar Spotlight
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground font-mono">Sorted by Score</span>
              </div>

              {isPending && (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Calculating radar spot light…
                </p>
              )}

              {!isPending && items.length === 0 && (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Add stocks to your watchlist to view volatility spotlight metrics.
                </p>
              )}

              <div className="mt-4 space-y-3">
                {items.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3.5 transition-all hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                        {item.symbol.slice(0, 2)}
                      </span>
                      <div>
                        <Link
                          to="/dashboard/$symbol"
                          params={{ symbol: item.symbol }}
                          className="font-bold text-xs hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span>{item.symbol}</span>
                          <ArrowUpRight className="h-3 w-3 text-primary" />
                        </Link>
                        <span className="block text-[10px] text-muted-foreground">
                          {item.swing !== null
                            ? `Typical swing: ${item.swing.toFixed(2)}%`
                            : "Learning baseline"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${directionPillClass(item.changePct)}`}
                      >
                        {formatPct(item.changePct)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground font-mono mt-1">
                        {item.score !== null
                          ? `${Math.abs(item.score).toFixed(1)}× swing`
                          : SIGNIFICANCE_TEXT[item.significance]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Full Stock Volatility Table */}
          <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold tracking-tight border-b border-border/60 pb-3">
              Full Volatility & Risk Metrics Matrix
            </h2>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/30 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Symbol</th>
                    <th className="py-3 px-4 text-right">Last Price</th>
                    <th className="py-3 px-4 text-right">24h Move</th>
                    <th className="py-3 px-4 text-right">Typical Swing</th>
                    <th className="py-3 px-4 text-right">Anomaly Multiple</th>
                    <th className="py-3 px-4">Significance State</th>
                    <th className="py-3 px-4">Data Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold font-mono">
                        <Link
                          to="/dashboard/$symbol"
                          params={{ symbol: item.symbol }}
                          className="hover:text-primary"
                        >
                          {item.symbol}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold">
                        ${formatPrice(item.price)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${directionPillClass(item.changePct)}`}
                        >
                          {formatPct(item.changePct)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {item.swing !== null ? `${item.swing.toFixed(2)}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-primary tabular-nums">
                        {item.score !== null ? `${Math.abs(item.score).toFixed(1)}×` : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {SIGNIFICANCE_TEXT[item.significance]}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
