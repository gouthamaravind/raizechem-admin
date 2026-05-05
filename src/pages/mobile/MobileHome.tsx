import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { MapPin, ShoppingCart, CreditCard, TrendingUp, Clock, RefreshCw, ArrowUpRight } from "lucide-react";

export default function MobileHome() {
  const { getTodaySummary, pendingSync } = useFieldOps();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data } = await getTodaySummary();
    if (data) setSummary(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const cards = summary
    ? [
        {
          icon: Clock,
          label: "Duty Status",
          value: summary.active_session ? "On Duty" : "Off Duty",
          color: summary.active_session ? "text-success" : "text-muted-foreground",
        },
        { icon: MapPin, label: "Total KM", value: `${summary.live_km || 0} km`, color: "text-primary" },
        { icon: ShoppingCart, label: "Orders", value: summary.orders_count, color: "text-primary" },
        { icon: CreditCard, label: "Collections", value: `₹${summary.payments_total?.toLocaleString() || 0}`, color: "text-primary" },
        { icon: TrendingUp, label: "Visits", value: summary.visits_count, color: "text-primary" },
      ]
    : [];

  return (
    <MobileLayout title="Today's Summary">
      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-border bg-card px-5 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Daily Snapshot</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {summary?.active_session ? "You are on duty" : "Ready for field work"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Track visits, orders, collections, and movement from one place.
              </p>
            </div>
            <div className="rounded-2xl bg-accent p-3 text-primary">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          {summary?.active_session && (
            <div className="mt-4 inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              Started at {new Date(summary.active_session.start_time).toLocaleTimeString()}
            </div>
          )}
        </section>

        <div className="flex items-center justify-between gap-2">
          <SyncBadge count={pendingSync.length} />
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              load();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((card) => (
              <div key={card} className="h-28 rounded-2xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                  <div className="rounded-xl bg-accent p-2">
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold tracking-tight ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {summary?.active_session && (
          <div className="rounded-2xl border border-border bg-gradient-to-r from-card to-accent p-4">
            <p className="text-sm font-medium text-foreground">Active Session</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Started: {new Date(summary.active_session.start_time).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
