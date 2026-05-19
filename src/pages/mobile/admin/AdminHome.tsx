import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Wallet, AlertTriangle, ShieldCheck, FileText, Users, ArrowUpRight } from "lucide-react";

type KPI = { label: string; value: string; icon: any; to: string; tone: string };

export default function AdminHome() {
  const [k, setK] = useState({ ordersToday: 0, pendingPay: 0, lowStock: 0, pendingApprovals: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [orders, outstanding, alerts, approvals] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.rpc("get_dealer_outstanding_total").then(r => r).catch(() => ({ data: 0 } as any)),
        supabase.from("low_stock_alerts").select("id", { count: "exact", head: true }).limit(1).then(r => r).catch(() => ({ count: 0 } as any)),
        supabase.from("field_orders").select("id", { count: "exact", head: true }).eq("manager_approval_status", "pending"),
      ]);
      setK({
        ordersToday: orders.count || 0,
        pendingPay: Number((outstanding as any)?.data || 0),
        lowStock: (alerts as any).count || 0,
        pendingApprovals: approvals.count || 0,
      });
    })();
  }, []);

  const kpis: KPI[] = [
    { label: "Orders Today", value: String(k.ordersToday), icon: ShoppingCart, to: "/sales/orders", tone: "text-primary" },
    { label: "Pending Pay", value: `₹${k.pendingPay.toLocaleString()}`, icon: Wallet, to: "/finance/outstanding", tone: "text-amber-600" },
    { label: "Low Stock", value: String(k.lowStock), icon: AlertTriangle, to: "/inventory/alerts", tone: "text-red-600" },
    { label: "Approvals", value: String(k.pendingApprovals), icon: ShieldCheck, to: "/m/admin/approvals", tone: "text-orange-600" },
  ];

  const quick = [
    { label: "New Invoice", to: "/sales/invoices", icon: FileText },
    { label: "Record Payment", to: "/finance/payments", icon: Wallet },
    { label: "Add Dealer", to: "/masters/dealers", icon: Users },
    { label: "Stock In", to: "/inventory/stock-in", icon: ShoppingCart },
  ];

  return (
    <MobileLayout title="Admin">
      <div className="space-y-6">
        <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">RaizeChem</p>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Management overview</p>
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
                  <p className={`text-xl font-bold ${c.tone}`}>{c.value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-muted-foreground">Quick actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quick.map((q) => (
              <Link key={q.label} to={q.to}>
                <Card className="border-dashed hover:bg-accent/40 transition">
                  <CardContent className="flex items-center gap-3 p-4">
                    <q.icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{q.label}</span>
                    <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
