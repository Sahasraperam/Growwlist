import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  DollarSign,
  PieChart,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWatchlist, type WatchItem } from "@/lib/watchlist.functions";
import {
  directionClass,
  directionPillClass,
  formatPct,
  formatPrice,
} from "@/components/watchlist-ui";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { SideNav } from "@/components/SideNav";

const REFRESH_MS = 3 * 60 * 1000;

export type Position = {
  id: string;
  symbol: string;
  shares: number;
  buyPrice: number;
};

const STORAGE_KEY = "growwlist_portfolio_positions_v1";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Tracker — GrowwList" },
      {
        name: "description",
        content:
          "Track your stock holdings, cost basis, total invested capital, and live unrealized P&L.",
      },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchWatchlist = useServerFn(getWatchlist);

  const [positions, setPositions] = useState<Position[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore invalid saved JSON
      }
    }
    // Default demo positions if empty
    return [
      { id: "p1", symbol: "RELIANCE", shares: 10, buyPrice: 2850 },
      { id: "p2", symbol: "TCS", shares: 5, buyPrice: 4100 },
      { id: "p3", symbol: "AAPL", shares: 8, buyPrice: 220 },
    ];
  });

  const [inputSymbol, setInputSymbol] = useState("");
  const [inputShares, setInputShares] = useState("");
  const [inputBuyPrice, setInputBuyPrice] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    }
  }, [positions]);

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

  function handleAddPosition(e: React.FormEvent) {
    e.preventDefault();
    if (!inputSymbol.trim() || !inputShares || !inputBuyPrice) {
      toast.error("Please enter symbol, shares count, and buy price.");
      return;
    }
    const shares = parseFloat(inputShares);
    const buyPrice = parseFloat(inputBuyPrice);
    if (isNaN(shares) || shares <= 0 || isNaN(buyPrice) || buyPrice <= 0) {
      toast.error("Shares and buy price must be positive numbers.");
      return;
    }

    const newPos: Position = {
      id: `pos-${Date.now()}`,
      symbol: inputSymbol.trim().toUpperCase(),
      shares,
      buyPrice,
    };

    setPositions((prev) => [...prev, newPos]);
    setInputSymbol("");
    setInputShares("");
    setInputBuyPrice("");
    toast.success(`Position added for ${newPos.symbol}`);
  }

  function handleRemovePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id));
    toast.success("Position removed");
  }

  // Calculate Portfolio Totals
  const positionMetrics = positions.map((pos) => {
    const matchedItem = items.find((i) => i.symbol === pos.symbol);
    const currentPrice = matchedItem?.price ?? pos.buyPrice;
    const invested = pos.shares * pos.buyPrice;
    const currentVal = pos.shares * currentPrice;
    const pnlVal = currentVal - invested;
    const pnlPct = invested > 0 ? (pnlVal / invested) * 100 : 0;
    const dayChangeVal = currentVal * ((matchedItem?.changePct ?? 0) / 100);

    return {
      ...pos,
      matchedItem,
      currentPrice,
      invested,
      currentVal,
      pnlVal,
      pnlPct,
      dayChangeVal,
    };
  });

  const totalInvested = positionMetrics.reduce((sum, p) => sum + p.invested, 0);
  const totalMarketVal = positionMetrics.reduce((sum, p) => sum + p.currentVal, 0);
  const totalPnlVal = totalMarketVal - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnlVal / totalInvested) * 100 : 0;
  const totalTodayVal = positionMetrics.reduce((sum, p) => sum + p.dayChangeVal, 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <SideNav currentPath="/portfolio" onSignOut={signOut} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <PieChart className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">
              Demo Portfolio{" "}
              <span className="text-xs font-normal text-muted-foreground font-mono">
                (Simulated Tracker)
              </span>
            </h1>
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
              <span>{isFetching ? "Syncing…" : "Update Prices"}</span>
            </button>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Demo Simulation Notice Banner */}
          <div className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-700">
            <Activity className="h-4 w-4 shrink-0 text-indigo-600" />
            <p>
              <strong>Demo Feature:</strong> This tracker is for local simulation and cost-basis
              testing only. Real positions are not connected to external brokerages.
            </p>
          </div>
          {/* Portfolio Summary Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Current Market Value
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                ${formatPrice(totalMarketVal)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Live total portfolio value</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Total Capital Invested
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                ${formatPrice(totalInvested)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Cumulative cost basis</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Unrealized Return (Total)
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <p
                  className={`text-3xl font-bold tracking-tight tabular-nums ${directionClass(totalPnlVal)}`}
                >
                  {totalPnlVal >= 0 ? "+" : ""}${formatPrice(totalPnlVal)}
                </p>
              </div>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${directionPillClass(totalPnlPct)}`}
              >
                {formatPct(totalPnlPct)} total return
              </span>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Today's Change P&amp;L
              </span>
              <p
                className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${directionClass(totalTodayVal)}`}
              >
                {totalTodayVal >= 0 ? "+" : ""}${formatPrice(totalTodayVal)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Combined 24h market move</p>
            </div>
          </div>

          {/* Position Input Form */}
          <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold tracking-tight border-b border-border/60 pb-3">
              Add Position / Holding
            </h2>

            <form onSubmit={handleAddPosition} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">Symbol</label>
                <input
                  type="text"
                  placeholder="e.g. RELIANCE, AAPL"
                  value={inputSymbol}
                  onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
                  className="h-10 w-44 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">
                  Quantity (Shares)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 10"
                  value={inputShares}
                  onChange={(e) => setInputShares(e.target.value)}
                  className="h-10 w-36 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">
                  Avg Buy Price ($)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 2850"
                  value={inputBuyPrice}
                  onChange={(e) => setInputBuyPrice(e.target.value)}
                  className="h-10 w-36 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                <span>Add Holding</span>
              </button>
            </form>
          </section>

          {/* Allocation Stack Bar */}
          {totalMarketVal > 0 && (
            <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h2 className="text-base font-semibold tracking-tight">Portfolio Allocation</h2>
                <span className="text-xs font-mono text-muted-foreground">By Current Value</span>
              </div>

              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
                {positionMetrics.map((p, idx) => {
                  const weight = (p.currentVal / totalMarketVal) * 100;
                  const colors = [
                    "bg-primary",
                    "bg-emerald-500",
                    "bg-amber-500",
                    "bg-teal-500",
                    "bg-indigo-500",
                  ];
                  const color = colors[idx % colors.length];
                  return (
                    <span
                      key={p.id}
                      className={color}
                      style={{ width: `${weight}%` }}
                      title={`${p.symbol}: ${weight.toFixed(1)}%`}
                    />
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs font-mono">
                {positionMetrics.map((p, idx) => {
                  const weight = (p.currentVal / totalMarketVal) * 100;
                  const colors = [
                    "bg-primary",
                    "bg-emerald-500",
                    "bg-amber-500",
                    "bg-teal-500",
                    "bg-indigo-500",
                  ];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
                      <span className="font-bold">{p.symbol}:</span>
                      <span className="text-muted-foreground">{weight.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Positions Table */}
          <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <h2 className="text-base font-semibold tracking-tight border-b border-border/60 pb-3">
              Tracked Holdings ({positions.length})
            </h2>

            {positions.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No portfolio holdings added yet. Add your first position above.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/30 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-4 text-right">Shares</th>
                      <th className="py-3 px-4 text-right">Avg Cost Basis</th>
                      <th className="py-3 px-4 text-right">Current Price</th>
                      <th className="py-3 px-4 text-right">Market Value</th>
                      <th className="py-3 px-4 text-right">Unrealized Return</th>
                      <th className="py-3 px-4">Data Source</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {positionMetrics.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-muted/20">
                        <td className="py-3 px-4 font-bold font-mono">
                          <Link
                            to="/dashboard/$symbol"
                            params={{ symbol: p.symbol }}
                            className="hover:text-primary"
                          >
                            {p.symbol}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{p.shares}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          ${formatPrice(p.buyPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          ${formatPrice(p.currentPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                          ${formatPrice(p.currentVal)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${directionPillClass(p.pnlPct)}`}
                          >
                            {p.pnlVal >= 0 ? "+" : ""}${formatPrice(p.pnlVal)} (
                            {formatPct(p.pnlPct)})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {p.matchedItem ? (
                            <DataSourceBadge
                              priceSource={p.matchedItem.priceSource}
                              quoteAgeMinutes={p.matchedItem.quoteAgeMinutes}
                              price={p.matchedItem.price}
                              priceAsOf={p.matchedItem.priceAsOf}
                              snapshotDate={p.matchedItem.snapshotDate}
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Cost Basis
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRemovePosition(p.id)}
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
          </section>
        </main>
      </div>
    </div>
  );
}
