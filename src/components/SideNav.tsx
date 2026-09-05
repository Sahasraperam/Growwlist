import { Link, useRouter } from "@tanstack/react-router";
import {
  Activity,
  BookMarked,
  Clock3,
  LayoutGrid,
  LineChart,
  LogOut,
  PieChart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type NavPath = "/dashboard" | "/watchlist" | "/analytics" | "/portfolio";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutGrid, to: "/dashboard" as const },
  { label: "Watchlist", icon: BookMarked, to: "/watchlist" as const },
  { label: "Analytics", icon: LineChart, to: "/analytics" as const },
  { label: "Demo Portfolio", icon: PieChart, to: "/portfolio" as const },
];

export function SideNav({
  currentPath,
  onSignOut,
}: {
  currentPath: NavPath;
  onSignOut?: () => void;
}) {
  const router = useRouter();

  async function handleSignOut() {
    if (onSignOut) {
      onSignOut();
      return;
    }
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border/80 bg-sidebar p-4 text-sidebar-foreground">
      {/* Brand Header */}
      <Link to="/dashboard" className="flex items-center gap-3 px-2 py-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <span className="block font-bold text-sm tracking-tight text-sidebar-foreground">
            GrowwList
          </span>
          <span className="block text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
            Smart Market Watchlist
          </span>
        </div>
      </Link>

      {/* Main Navigation */}
      <nav className="mt-6 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Main Workspace
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Secondary System Tools */}
      <div className="mt-6 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Insights & System
        </p>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-muted-foreground">
          <Clock3 className="h-4 w-4 shrink-0" />
          <span className="flex-1">Live BSE/NSE Sync</span>
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </div>
      </div>

      {/* User Actions */}
      <div className="mt-auto border-t border-sidebar-border pt-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
