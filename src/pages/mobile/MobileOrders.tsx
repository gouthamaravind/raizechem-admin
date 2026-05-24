import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ShoppingCart, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Database } from "@/integrations/supabase/types";

type FieldOrder = Database["public"]["Tables"]["field_orders"]["Row"] & { 
  dealers: { name: string } | null 
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning",
  approved: "bg-success/20 text-success",
  converted: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
};

export default function MobileOrders() {
  const { user } = useAuth();
  const { pendingSync } = useFieldOps();
  const [orders, setOrders] = useState<FieldOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  const load = async (pageNum: number, append = false) => {
    if (!user) return;
    const from = pageNum * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("field_orders")
      .select("id, status, created_at, notes, dealers(name), approved_order_id")
      .eq("created_by_user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetchedOrders = (data as FieldOrder[]) || [];
    if (append) {
      setOrders(prev => [...prev, ...fetchedOrders]);
    } else {
      setOrders(fetchedOrders);
    }
    
    setHasMore(fetchedOrders.length === pageSize);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load(0);
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    load(0);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, true);
  };

  return (
    <MobileLayout title="Field Orders">
      <div className="space-y-3 pb-8">
        <div className="flex items-center justify-between gap-2">
          <SyncBadge count={pendingSync.length} />
          <button
            type="button"
            onClick={handleRefresh}
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

        {loading && page === 0 ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="bg-card rounded-xl p-4 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground truncate flex-1 mr-2">{order.dealers?.name || "—"}</p>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", statusColors[order.status] || "bg-muted text-muted-foreground")}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-foreground line-clamp-1 italic">
                        {order.notes || "No notes provided"}
                      </p>
                    </div>
                    {order.approved_order_id && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Synced</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <Button 
                variant="ghost" 
                className="w-full mt-4 text-muted-foreground gap-2" 
                onClick={handleLoadMore}
                disabled={refreshing}
              >
                <ChevronDown className="h-4 w-4" />
                Load More
              </Button>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
}
