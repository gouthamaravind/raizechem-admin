import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { MapPin, ShoppingCart, CreditCard, TrendingUp, Clock, RefreshCw } from "lucide-react";

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
      <div className="space-y-4">
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
              <div key={card} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card) => (
              <div key={card.label} className="bg-card rounded-xl p-4 border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                  <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                </div>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {summary?.active_session && (
          <div className="bg-accent rounded-xl p-4 border border-border">
            <p className="text-sm font-medium text-accent-foreground">Active Session</p>
            <p className="text-xs text-muted-foreground mt-1">
              Started: {new Date(summary.active_session.start_time).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
