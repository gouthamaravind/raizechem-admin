import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";

export default function Alerts() {
  const { data: products = [] } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, unit, min_stock_alert_qty").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["batches-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_batches").select("product_id, current_qty, exp_date");
      if (error) throw error;
      return data;
    },
  });

  // Low stock alerts
  const lowStock = products.map((p: any) => {
    const pBatches = batches.filter((b: any) => b.product_id === p.id);
    const totalQty = pBatches.reduce((sum: number, b: any) => sum + Number(b.current_qty), 0);
    return { ...p, totalQty, isLow: totalQty < Number(p.min_stock_alert_qty) && Number(p.min_stock_alert_qty) > 0 };
  }).filter((p) => p.isLow);

  // Expiring soon (within 60 days)
  const now = new Date();
  const expiringSoon = batches.filter((b: any) => {
    if (!b.exp_date) return false;
    const d = new Date(b.exp_date);
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 60;
  }).map((b: any) => {
    const product = products.find((p: any) => p.id === b.product_id);
    return { ...b, productName: product?.name || "Unknown", unit: product?.unit || "" };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Inventory Alerts</h1><p className="text-muted-foreground">Low stock and near-expiry warnings</p></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Low Stock ({lowStock.length})</CardTitle></CardHeader>
            <CardContent>
              {lowStock.length === 0 ? <p className="text-muted-foreground text-center py-8">All products are well stocked.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Current Qty</TableHead><TableHead>Min Required</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {lowStock.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell><Badge variant="destructive">{p.totalQty} {p.unit}</Badge></TableCell>
                        <TableCell>{Number(p.min_stock_alert_qty)} {p.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-warning" />Expiring Soon ({expiringSoon.length})</CardTitle></CardHeader>
            <CardContent>
              {expiringSoon.length === 0 ? <p className="text-muted-foreground text-center py-8">No batches expiring within 60 days.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Exp Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {expiringSoon.map((b: any) => (
                      <TableRow key={b.product_id + b.exp_date}>
                        <TableCell className="font-medium">{b.productName}</TableCell>
                        <TableCell>{b.current_qty} {b.unit}</TableCell>
                        <TableCell><Badge variant="outline" className="text-warning border-warning">{b.exp_date}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
