import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  TrendingDown,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { getSymbolDetail, removeSymbol } from "@/lib/watchlist.functions";
import {
  SIGNIFICANCE_TEXT,
  baselineLabel,
  directionClass,
  directionPillClass,
  formatPct,
  formatPrice,
  whyText,
  Sparkline,
} from "@/components/watchlist-ui";
import { DataSourceBadge } from "@/components/DataSourceBadge";

export const Route = createFileRoute("/_authenticated/dashboard/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — GrowwList Stock Insights` },
      {
        name: "description",
        content: `Volatility analysis and price projection for ${params.symbol} relative to standard deviation.`,
      },
    ],
  }),
  component: SymbolDetail,
});

function SymbolDetail() {
  const { symbol } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getSymbolDetail);
  const remove = useServerFn(removeSymbol);
  const [timeframe, setTimeframe] = useState<"1D" | "1M" | "6M" | "1Y">("1M");

  const { data, isPending } = useQuery({
    queryKey: ["symbol", symbol],
    queryFn: () => fetchDetail({ data: { symbol } }),
    refetchOnWindowFocus: false,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success(`${symbol} removed from watchlist`);
      navigate({ to: "/dashboard" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove."),
  });

  const item = data?.item ?? null;

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>

          {item && (
            <button
              onClick={() => removeMutation.mutate(item.id)}
              disabled={removeMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{removeMutation.isPending ? "Removing…" : "Remove from Watchlist"}</span>
            </button>
          )}
        </div>

        {isPending && (
          <div className="flex h-96 items-center justify-center text-xs text-muted-foreground">
            Loading detail metrics for {symbol}…
          </div>
        )}

        {!isPending && !item && (
          <div className="rounded-2xl border border-border/80 bg-card p-12 text-center">
            <h2 className="text-lg font-bold">{symbol} is not on your watchlist</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Head back to your dashboard to add {symbol} to your tracked stocks.
            </p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {item && (
          <>
            {/* Header Stock Banner */}
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 font-mono text-base font-bold text-primary">
                    {item.symbol.slice(0, 2)}
                  </span>
                  <div>
                    <h1 className="font-mono text-3xl font-bold tracking-tight">{item.symbol}</h1>
                    <p className="text-xs text-muted-foreground">{item.name ?? item.symbol}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-baseline gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">
                    Current Price
                  </span>
                  <span className="text-3xl font-bold tracking-tight tabular-nums">
                    ${formatPrice(item.price)}
                  </span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${directionPillClass(item.changePct)}`}
                >
                  {formatPct(item.changePct)}
                </span>
              </div>
            </div>

            {/* Main 2-Column Grid */}
            <div className="grid gap-6 xl:grid-cols-12">
              {/* Left Column: Interactive Price Chart & Volatility Insight (7 Columns) */}
              <div className="xl:col-span-7 space-y-6">
                {/* Chart Card */}
                <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/60 pb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <h2 className="text-base font-semibold tracking-tight">Price History</h2>
                    </div>
                    <div className="flex shrink-0 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 text-xs">
                      {(["1D", "1M", "6M", "1Y"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
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

                  {data && data.history.length > 1 ? (
                    <div className="mt-4">
                      <Sparkline
                        points={data.history.map((h) => h.close)}
                        up={(item.changePct ?? 0) >= 0}
                        className="h-64 w-full"
                        height={240}
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
                      No price history accumulated yet for {symbol}.
                    </div>
                  )}
                </section>

                {/* Anomaly Insight Explanation Card */}
                <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                    <Activity className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold tracking-tight">Volatility Analysis</h2>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-foreground/90">{whyText(item)}</p>

                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-4 text-xs">
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <span className="text-muted-foreground font-mono">Typical Daily Swing</span>
                      <p className="mt-1 text-base font-bold tabular-nums">
                        {item.swing !== null ? `${item.swing.toFixed(2)}%` : "Calculating…"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <span className="text-muted-foreground font-mono">Significance Baseline</span>
                      <p className="mt-1 text-base font-bold text-primary">
                        {SIGNIFICANCE_TEXT[item.significance]}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column: Stock Volatility Context & Market Source Badges (5 Columns) */}
              <div className="xl:col-span-5 space-y-6">
                {/* Stock Volatility Context Card */}
                <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <h2 className="text-base font-semibold tracking-tight">
                      Volatility Engine Context
                    </h2>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                      Normalized Anomaly
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
                    <p>
                      GrowwList ranks movement by standard deviation rather than fixed percentages.
                      A 3% change in a quiet utility is{" "}
                      <strong className="text-foreground">UNUSUAL</strong>, while the same move in a
                      volatile stock may be <strong className="text-foreground">NORMAL</strong>.
                    </p>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-1">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>Typical Daily Swing:</span>
                        <span className="font-bold text-foreground">
                          {item?.swing !== null ? `${item.swing.toFixed(2)}%` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>Anomaly Score:</span>
                        <span className="font-bold text-foreground">
                          {item?.score !== null ? `${item.score.toFixed(2)}×` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Market Data Provenance */}
                <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <h2 className="text-base font-semibold tracking-tight border-b border-border/60 pb-3">
                    Data Provenance
                  </h2>
                  <div className="mt-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Exchange Source</span>
                      <DataSourceBadge
                        priceSource={item.priceSource}
                        quoteAgeMinutes={item.quoteAgeMinutes}
                        price={item.price}
                        priceAsOf={item.priceAsOf}
                        snapshotDate={item.snapshotDate}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Baseline Reference</span>
                      <span className="font-medium">{baselineLabel(item)}</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
