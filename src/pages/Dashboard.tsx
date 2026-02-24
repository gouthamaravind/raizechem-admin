import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart, CreditCard, AlertTriangle, TrendingUp, Package, Users,
  FileText, IndianRupee, Plus, ArrowRight, Clock, CalendarDays,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { format, startOfMonth, startOfDay, differenceInDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";

function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [ordersToday, pendingInvoices, lowStock, monthlyRevenue, recentOrders, topProducts, totalDealers, totalProducts, recentPayments, overdueInvoices] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("order_date", today),
        supabase.from("invoices").select("total_amount, amount_paid").neq("status", "cancelled").neq("status", "void"),
        supabase.from("product_batches").select("current_qty, product_id, products(name, min_stock_alert_qty)").gt("current_qty", 0),
        supabase.from("invoices").select("total_amount").gte("invoice_date", monthStart).neq("status", "cancelled").neq("status", "void"),
        supabase.from("orders").select("id, order_number, order_date, total_amount, status, dealers(name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("invoice_items").select("qty, amount, products(name), invoices!inner(invoice_date)").gte("invoices.invoice_date", monthStart),
        supabase.from("dealers").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("payments").select("id, amount, payment_date, payment_mode, dealers(name)").neq("status", "void").order("created_at", { ascending: false }).limit(5),
        supabase.from("invoices").select("id, invoice_number, total_amount, amount_paid, due_date, dealers(name)").neq("status", "void").neq("status", "paid").not("due_date", "is", null).lt("due_date", today).order("due_date").limit(5),
      ]);

      const pendingAmount = (pendingInvoices.data || []).reduce((sum, inv) => {
        const pending = Number(inv.total_amount) - Number(inv.amount_paid);
        return pending > 0 ? sum + pending : sum;
      }, 0);

      const lowStockCount = (lowStock.data || []).filter((b: any) => {
        const minQty = b.products?.min_stock_alert_qty ?? 0;
        return minQty > 0 && Number(b.current_qty) <= Number(minQty);
      }).length;

      const revenue = (monthlyRevenue.data || []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);

      const productMap = new Map<string, { name: string; qty: number; amount: number }>();
      (topProducts.data || []).forEach((item: any) => {
        const name = item.products?.name || "Unknown";
        const existing = productMap.get(name) || { name, qty: 0, amount: 0 };
        existing.qty += Number(item.qty);
        existing.amount += Number(item.amount);
        productMap.set(name, existing);
      });
      const topProductsList = Array.from(productMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);

      return {
        todayOrders: ordersToday.count || 0,
        pendingAmount,
        lowStockCount,
        monthlyRevenue: revenue,
        recentOrders: recentOrders.data || [],
        topProducts: topProductsList,
        totalDealers: totalDealers.count || 0,
        totalProducts: totalProducts.count || 0,
        recentPayments: recentPayments.data || [],
        overdueInvoices: overdueInvoices.data || [],
      };
    },
    refetchInterval: 30000,
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

const modeLabels: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank", cheque: "Cheque", upi: "UPI",
};

export default function Dashboard() {
  const { data, isLoading } = useDashboardStats();

  const stats = [
    { title: "Today's Orders", value: data ? String(data.todayOrders) : "—", icon: ShoppingCart, color: "text-primary", link: "/sales/orders" },
    { title: "Pending Payments", value: data ? formatCurrency(data.pendingAmount) : "—", icon: CreditCard, color: "text-warning", link: "/finance/outstanding" },
    { title: "Low Stock Alerts", value: data ? String(data.lowStockCount) : "—", icon: AlertTriangle, color: "text-destructive", link: "/inventory/alerts" },
    { title: "Monthly Revenue", value: data ? formatCurrency(data.monthlyRevenue) : "—", icon: TrendingUp, color: "text-success", link: "/reports/sales-register" },
  ];

  const secondaryStats = [
    { title: "Active Dealers", value: data ? String(data.totalDealers) : "—", icon: Users, link: "/masters/dealers" },
    { title: "Active Products", value: data ? String(data.totalProducts) : "—", icon: Package, link: "/masters/products" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back to Raizechem Admin Panel</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border rounded-lg px-3 py-1.5">
            <CalendarDays className="h-4 w-4" />
            {format(new Date(), "dd MMM yyyy")}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Link to="/sales/invoices"><Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />New Invoice</Button></Link>
          <Link to="/finance/payments"><Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Record Payment</Button></Link>
          <Link to="/sales/orders"><Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />New Order</Button></Link>
          <Link to="/masters/dealers"><Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add Dealer</Button></Link>
          <Link to="/inventory/stock-in"><Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Stock In</Button></Link>
        </div>

        {/* Primary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.title} to={stat.link}>
              <Card className="hover:shadow-md transition-all hover:border-primary/20 cursor-pointer group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                  ) : (
                    <div className="text-2xl font-bold">{stat.value}</div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {secondaryStats.map((stat) => (
            <Link key={stat.title} to={stat.link}>
              <Card className="hover:shadow-md transition-all hover:border-primary/20 cursor-pointer group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                  ) : (
                    <div className="text-2xl font-bold">{stat.value}</div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Three-column grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Recent Orders</CardTitle>
                <Link to="/sales/orders"><Button variant="ghost" size="sm" className="text-xs gap-1">View All<ArrowRight className="h-3 w-3" /></Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />)}</div>
              ) : !data?.recentOrders?.length ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No orders yet</p>
                  <Link to="/sales/orders"><Button variant="link" size="sm" className="mt-1 text-xs">Create your first order →</Button></Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-medium text-xs">{order.order_number}</span>
                        <p className="text-muted-foreground text-xs truncate">{(order.dealers as any)?.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium text-xs">{formatCurrency(Number(order.total_amount))}</span>
                        <Badge variant="secondary" className={`text-[10px] ${statusColors[order.status] || ""}`}>{order.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Recent Payments</CardTitle>
                <Link to="/finance/payments"><Button variant="ghost" size="sm" className="text-xs gap-1">View All<ArrowRight className="h-3 w-3" /></Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />)}</div>
              ) : !data?.recentPayments?.length ? (
                <div className="text-center py-8">
                  <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No payments yet</p>
                  <Link to="/finance/payments"><Button variant="link" size="sm" className="mt-1 text-xs">Record a payment →</Button></Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{(p.dealers as any)?.name}</p>
                        <p className="text-muted-foreground text-xs">{p.payment_date}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-xs text-success">{formatCurrency(Number(p.amount))}</span>
                        <Badge variant="outline" className="text-[10px]">{modeLabels[p.payment_mode] || p.payment_mode}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overdue Invoices */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-destructive" />Overdue Invoices</CardTitle>
                <Link to="/finance/outstanding"><Button variant="ghost" size="sm" className="text-xs gap-1">View All<ArrowRight className="h-3 w-3" /></Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />)}</div>
              ) : !data?.overdueInvoices?.length ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No overdue invoices 🎉</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.overdueInvoices.map((inv: any) => {
                    const due = Number(inv.total_amount) - Number(inv.amount_paid);
                    const daysOverdue = differenceInDays(new Date(), new Date(inv.due_date));
                    return (
                      <div key={inv.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0 flex-1">
                          <span className="font-mono font-medium text-xs">{inv.invoice_number}</span>
                          <p className="text-muted-foreground text-xs truncate">{(inv.dealers as any)?.name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium text-xs text-destructive">{formatCurrency(due)}</span>
                          <Badge variant="destructive" className="text-[10px]">{daysOverdue}d</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-primary" />
              Top Products — {format(new Date(), "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 w-full animate-pulse rounded bg-muted" />
            ) : !data?.topProducts?.length ? (
              <div className="text-center py-12">
                <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No product data yet</p>
                <Link to="/sales/invoices"><Button variant="link" size="sm" className="mt-1 text-xs">Create an invoice to see data →</Button></Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.topProducts} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} tickLine={false} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
