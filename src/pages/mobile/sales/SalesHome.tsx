import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ShoppingCart, Wallet, Users, ArrowUpRight } from "lucide-react";

export default function SalesHome() {
  const [k, setK] = useState({ invToday: 0, ordersOpen: 0, outstanding: 0 });
  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [inv, ord, out] = await Promise.all([
        supabase.from("invoices").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["draft", "confirmed"]),
        supabase.rpc("get_dealer_outstanding_total").then(r => r).catch(() => ({ data: 0 } as any)),
      ]);
      setK({
        invToday: inv.count || 0,
        ordersOpen: ord.count || 0,
        outstanding: Number((out as any)?.data || 0),
      });
    })();
  }, []);

  const kpis = [
    { label: "Invoices Today", value: String(k.invToday), icon: FileText, to: "/sales/invoices", tone: "text-primary" },
    { label: "Open Orders", value: String(k.ordersOpen), icon: ShoppingCart, to: "/m/sales/orders", tone: "text-amber-600" },
    { label: "Outstanding", value: `₹${k.outstanding.toLocaleString()}`, icon: Wallet, to: "/finance/outstanding", tone: "text-red-600" },
    { label: "Dealers", value: "→", icon: Users, to: "/masters/dealers", tone: "text-emerald-600" },
  ];

  const quick = [
    { label: "New Invoice", to: "/sales/invoices", icon: FileText },
    { label: "New Order", to: "/sales/orders", icon: ShoppingCart },
    { label: "Record Payment", to: "/finance/payments", icon: Wallet },
  ];

  return (
    <MobileLayout title="Sales">
      <div className="space-y-6">
        <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Sales Desk</p>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Manage orders, invoices, and collections.</p>
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
          <div className="space-y-2">
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
