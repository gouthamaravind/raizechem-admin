import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning",
  converted: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
};

export default function MobileOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("field_orders")
        .select("id, status, created_at, notes, dealers(name)")
        .eq("created_by_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setOrders(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <MobileLayout title="Field Orders">
      <div className="space-y-3">
        <Link to="/m/orders/new">
          <Button className="w-full h-12 text-base gap-2">
            <Plus className="h-5 w-5" />
            New Field Order
          </Button>
        </Link>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
