import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, ArrowRight, KeyRound, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — GrowwList Smart Market Watchlist" },
      {
        name: "description",
        content:
          "Sign in to GrowwList to sync your watchlist and anomaly baseline settings across devices.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-screen items-center justify-center bg-background p-6 text-foreground selection:bg-primary/20">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Link */}
        <div className="flex flex-col items-center justify-center text-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight font-mono">GrowwList</span>
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            Smart volatility watchlist & anomaly detector
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-sm">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Mail className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Check your inbox</h1>
              <p className="text-xs leading-relaxed text-muted-foreground">
                We sent a confirmation link to{" "}
                <span className="font-semibold text-foreground">{email}</span>. Click it to activate
                your account.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="border-b border-border/60 pb-4">
                <h1 className="text-xl font-bold tracking-tight">
                  {mode === "signin" ? "Sign in to GrowwList" : "Create an Account"}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your tracked watchlist and baselines sync securely across devices.
                </p>
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="trader@growwlist.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <span>
                    {busy ? "Authenticating…" : mode === "signin" ? "Sign In" : "Create Account"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>

              <div className="mt-6 border-t border-border/60 pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  {mode === "signin"
                    ? "New to GrowwList? Create an account"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
