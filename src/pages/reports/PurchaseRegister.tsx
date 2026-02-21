import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

export default function PurchaseRegister() {
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["purchase-register", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_txn")
        .select("*, products(name, unit), product_batches(batch_no)")
        .eq("txn_type", "PURCHASE")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totalQty = txns.reduce((s: number, t: any) => s + Number(t.qty_in), 0);
  const totalValue = txns.reduce((s: number, t: any) => s + Number(t.qty_in) * Number(t.rate), 0);

  const exportData = txns.map((t: any) => ({
    product: t.products?.name, batch: t.product_batches?.batch_no,
    qty: t.qty_in, unit: t.products?.unit, rate: t.rate,
    value: (Number(t.qty_in) * Number(t.rate)).toFixed(2),
    date: new Date(t.created_at).toLocaleDateString("en-IN"),
  }));

  const cols = [
    { key: "product", label: "Product" }, { key: "batch", label: "Batch" },
    { key: "qty", label: "Qty" }, { key: "unit", label: "Unit" },
    { key: "rate", label: "Rate" }, { key: "value", label: "Value" },
    { key: "date", label: "Date" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Purchase Register</h1><p className="text-muted-foreground">Stock-in entries report</p></div>
          <Button variant="outline" onClick={() => exportToCsv("purchase-register.csv", exportData, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
        </div>
        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent className="flex gap-4 items-end">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : txns.length === 0 ? <p className="text-muted-foreground text-center py-8">No purchases found.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {txns.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.products?.name}</TableCell>
                      <TableCell>{t.product_batches?.batch_no}</TableCell>
                      <TableCell className="text-right">{t.qty_in}</TableCell>
                      <TableCell>{t.products?.unit}</TableCell>
                      <TableCell className="text-right">₹{Number(t.rate).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{(Number(t.qty_in) * Number(t.rate)).toLocaleString("en-IN")}</TableCell>
                      <TableCell>{new Date(t.created_at).toLocaleDateString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{totalQty}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">₹{totalValue.toLocaleString("en-IN")}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
