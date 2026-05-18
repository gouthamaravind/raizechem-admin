import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { MapPin, ShoppingCart, CreditCard, TrendingUp, Clock, RefreshCw, ArrowUpRight, ShieldCheck, AlertTriangle, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function MobileHome() {
  const { getTodaySummary, pendingSync } = useFieldOps();
  const { userRoles, isAdmin } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isFieldOps = userRoles.includes("fieldops") || isAdmin;

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
      ]
    : [];

  return (
    <MobileLayout title="Home">
      <div className="space-y-6">
        {/* Welcome Section */}
        <section className="rounded-[1.75rem] border border-border bg-card px-5 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">RaizeChem Portal</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Management & Field Overview" : "Your daily field snapshot"}
              </p>
            </div>
            <div className="rounded-2xl bg-accent p-3 text-primary text-xs font-bold">
              {isAdmin ? "ADMIN" : "STAFF"}
            </div>
          </div>
        </section>

        {/* Admin Quick View */}
        {isAdmin && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 px-1">
              <ShieldCheck className="h-4 w-4 text-primary" /> Management
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/approvals" className="block">
                <Card className="hover:bg-accent transition-colors border-dashed">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Approvals</p>
                      <p className="text-[10px] text-muted-foreground">Pending tasks</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/inventory/alerts" className="block">
                <Card className="hover:bg-accent transition-colors border-dashed">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className="p-2 rounded-full bg-red-100 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Stock Alerts</p>
                      <p className="text-[10px] text-muted-foreground">Low inventory</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        )}

        {/* Field Ops Section */}
        {isFieldOps && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Field Operations
              </h3>
              <div className="flex items-center gap-3">
                <SyncBadge count={pendingSync.length} />
                <button
                  type="button"
                  onClick={() => { setRefreshing(true); load(); }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                  Sync
                </button>
              </div>
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
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</span>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <p className={`text-xl font-bold tracking-tight ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </div>
            )}

            {summary?.active_session ? (
              <Link to="/m/duty">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Live Duty Active</p>
                      <p className="text-xs text-muted-foreground">Tracking your movement now</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-primary" />
                </div>
              </Link>
            ) : (
              <Link to="/m/duty">
                <div className="rounded-2xl border border-dashed border-border p-4 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Tap to start your duty session</p>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
