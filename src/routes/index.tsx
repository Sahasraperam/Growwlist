import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart2, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GrowwList — Intelligence for your stock watchlist" },
      {
        name: "description",
        content:
          "GrowwList ranks your watchlist by standard deviation anomaly score, surfacing genuine volatility signals instead of noisy market percentages.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecked(true);
    });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20">
      {/* Top Navbar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Activity className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm tracking-tight font-mono">GrowwList</span>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
        >
          Sign In
        </Link>
      </header>

      {/* Hero Body */}
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Activity className="h-3.5 w-3.5" />
          <span>Real-time BSE & NSE Anomaly Detection</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl leading-[1.1]">
          Know which stock <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
            deserves your attention.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Most watchlists overwhelm you with generic percentages. GrowwList measures price moves
          against each stock's historical volatility baseline and highlights genuine market
          anomalies first.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/auth"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:opacity-95 hover:scale-[1.02]"
          >
            <span>{checked ? "Open GrowwList Dashboard" : "Get Started"}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3 w-full">
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Zap className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-xs font-bold font-mono uppercase tracking-wider">
              Volatility Score
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-normal">
              Calculates standard deviation multiples for every ticker to isolate true market
              signals.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-xs font-bold font-mono uppercase tracking-wider">
              BSE & NSE Sync
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-normal">
              Intraday live LTP quotes from BSE India & end-of-day closing prices from NSE.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-xs font-bold font-mono uppercase tracking-wider">
              Calm & Focused
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-normal">
              No clutter or noisy feeds — just actionable anomaly highlights since your last visit.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border/60">
        GrowwList Smart Watchlist · Designed for clarity and performance
      </footer>
    </main>
  );
}
