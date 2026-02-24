import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning",
  verified: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
};

export default function MobilePayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("field_payments")
        .select("id, amount, mode, status, payment_date, created_at, dealers(name)")
        .eq("created_by_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setPayments(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <MobileLayout title="Collections">
      <div className="space-y-3">
        <Link to="/m/payments/new">
          <Button className="w-full h-12 text-base gap-2">
            <Plus className="h-5 w-5" />
            Record Payment
          </Button>
        </Link>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No payments recorded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{(p.dealers as any)?.name || "—"}</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[p.status] || "bg-muted text-muted-foreground")}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-lg font-bold text-primary">₹{Number(p.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{p.mode} • {p.payment_date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
