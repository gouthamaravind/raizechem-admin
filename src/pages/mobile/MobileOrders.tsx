import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ShoppingCart, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning",
  converted: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
};

export default function MobileOrders() {
  const { user } = useAuth();
  const { pendingSync } = useFieldOps();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("field_orders")
      .select("id, status, created_at, notes, dealers(name)")
      .eq("created_by_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setOrders(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  return (
    <MobileLayout title="Field Orders">
      <div className="space-y-3">
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

        <Link to="/m/orders/new">
          <Button className="w-full h-12 text-base gap-2">
            <Plus className="h-5 w-5" />
            New Field Order
          </Button>
        </Link>

        {loading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{(order.dealers as any)?.name || "—"}</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[order.status] || "bg-muted text-muted-foreground")}>
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(order.created_at).toLocaleDateString()} • {order.notes || "No notes"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
