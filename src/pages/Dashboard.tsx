import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, CreditCard, AlertTriangle, TrendingUp, Package, Users, FileText, IndianRupee } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [ordersToday, pendingInvoices, lowStock, monthlyRevenue, recentOrders, topProducts, totalDealers, totalProducts] = await Promise.all([
        // Today's orders
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("order_date", today),
        // Unpaid invoices (total_amount - amount_paid > 0)
        supabase.from("invoices").select("total_amount, amount_paid").neq("status", "cancelled"),
        // Low stock: batches where current_qty <= min_stock_alert_qty
        supabase.from("product_batches").select("current_qty, product_id, products(name, min_stock_alert_qty)").gt("current_qty", 0),
        // Monthly revenue from invoices
        supabase.from("invoices").select("total_amount").gte("invoice_date", monthStart).neq("status", "cancelled"),
        // Recent 5 orders
        supabase.from("orders").select("id, order_number, order_date, total_amount, status, dealers(name)").order("created_at", { ascending: false }).limit(5),
        // Top products by invoice qty this month
        supabase.from("invoice_items").select("qty, amount, products(name), invoices!inner(invoice_date)").gte("invoices.invoice_date", monthStart),
        // Total dealers
        supabase.from("dealers").select("id", { count: "exact", head: true }).eq("status", "active"),
        // Total products
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      // Calculate pending payments
      const pendingAmount = (pendingInvoices.data || []).reduce((sum, inv) => {
        const pending = Number(inv.total_amount) - Number(inv.amount_paid);
        return pending > 0 ? sum + pending : sum;
      }, 0);

      // Calculate low stock count
      const lowStockCount = (lowStock.data || []).filter((b: any) => {
        const minQty = b.products?.min_stock_alert_qty ?? 0;
        return minQty > 0 && Number(b.current_qty) <= Number(minQty);
      }).length;

      // Calculate monthly revenue
      const revenue = (monthlyRevenue.data || []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);

      // Aggregate top products
      const productMap = new Map<string, { name: string; qty: number; amount: number }>();
      (topProducts.data || []).forEach((item: any) => {
        const name = item.products?.name || "Unknown";
        const existing = productMap.get(name) || { name, qty: 0, amount: 0 };
        existing.qty += Number(item.qty);
        existing.amount += Number(item.amount);
        productMap.set(name, existing);
      });
      const topProductsList = Array.from(productMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        todayOrders: ordersToday.count || 0,
        pendingAmount,
        lowStockCount,
        monthlyRevenue: revenue,
        recentOrders: recentOrders.data || [],
        topProducts: topProductsList,
        totalDealers: totalDealers.count || 0,
        totalProducts: totalProducts.count || 0,
      };
    },
    refetchInterval: 30000, // refresh every 30s
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  dispatched: "bg-accent text-accent-foreground",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats();

  const stats = [
    { title: "Today's Orders", value: data ? String(data.todayOrders) : "—", icon: ShoppingCart, color: "text-primary" },
    { title: "Pending Payments", value: data ? formatCurrency(data.pendingAmount) : "—", icon: CreditCard, color: "text-warning" },
    { title: "Low Stock Alerts", value: data ? String(data.lowStockCount) : "—", icon: AlertTriangle, color: "text-destructive" },
    { title: "Monthly Revenue", value: data ? formatCurrency(data.monthlyRevenue) : "—", icon: TrendingUp, color: "text-success" },
  ];

  const secondaryStats = [
    { title: "Active Dealers", value: data ? String(data.totalDealers) : "—", icon: Users },
    { title: "Active Products", value: data ? String(data.totalProducts) : "—", icon: Package },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to Raizechem Admin Panel</p>
        </div>

        {/* Primary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{stat.value}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {secondaryStats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stat.value}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Orders + Top Products */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !data?.recentOrders.length ? (
                <p className="text-muted-foreground text-sm">No recent orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.recentOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono font-medium">{order.order_number}</span>
                        <span className="text-muted-foreground ml-2">— {(order.dealers as any)?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(Number(order.total_amount))}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[order.status] || "bg-muted"}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-primary" />
                Top Products (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !data?.topProducts.length ? (
                <p className="text-muted-foreground text-sm">No product data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} fontSize={12} />
                    <YAxis type="category" dataKey="name" width={100} fontSize={12} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
