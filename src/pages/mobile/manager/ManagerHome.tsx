import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardCheck, ShoppingCart, Users, CheckCircle2, XCircle } from "lucide-react";

export default function ManagerHome() {
  const [k, setK] = useState({ pending: 0, approved: 0, rejected: 0 });
  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [p, a, r] = await Promise.all([
        supabase.from("field_orders").select("id", { count: "exact", head: true }).eq("manager_approval_status", "pending"),
        supabase.from("field_orders").select("id", { count: "exact", head: true }).eq("manager_approval_status", "approved").gte("approved_at", today.toISOString()),
        supabase.from("field_orders").select("id", { count: "exact", head: true }).eq("manager_approval_status", "rejected").gte("approved_at", today.toISOString()),
      ]);
      setK({ pending: p.count || 0, approved: a.count || 0, rejected: r.count || 0 });
    })();
  }, []);

  const kpis = [
    { label: "Pending", value: k.pending, icon: ClipboardCheck, tone: "text-orange-600", to: "/m/manager/approvals" },
    { label: "Approved Today", value: k.approved, icon: CheckCircle2, tone: "text-emerald-600", to: "/m/manager/approvals" },
    { label: "Rejected Today", value: k.rejected, icon: XCircle, tone: "text-red-600", to: "/m/manager/approvals" },
    { label: "All Orders", value: "—", icon: ShoppingCart, tone: "text-primary", to: "/m/manager/orders" },
  ];

  return (
    <MobileLayout title="Manager">
      <div className="space-y-6">
        <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Approvals Desk</p>
          <h2 className="text-2xl font-bold tracking-tight">Review field orders</h2>
          <p className="text-sm text-muted-foreground">Approve or reject orders raised by the field team.</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          {kpis.map((c) => (
            <Link key={c.label} to={c.to}>
              <Card className="hover:bg-accent/40 transition">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{c.label}</span>
                    <c.icon className={`h-4 w-4 ${c.tone}`} />
                  </div>
                  <p className={`text-2xl font-bold ${c.tone}`}>{c.value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Link to="/m/manager/approvals">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Pending Approvals</p>
              <p className="text-xs text-muted-foreground">Tap to review {k.pending} request(s)</p>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </div>
        </Link>
      </div>
    </MobileLayout>
  );
}
