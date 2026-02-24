import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { MapPin, ShoppingCart, CreditCard, TrendingUp, Clock } from "lucide-react";

export default function MobileHome() {
  const { getTodaySummary, pendingSync } = useFieldOps();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await getTodaySummary();
      if (data) setSummary(data);
      setLoading(false);
    };
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
        <SyncBadge count={pendingSync.length} />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
