import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function StockSummary() {
  const [method, setMethod] = useState<"fifo" | "weighted_avg">("fifo");

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["stock-summary-batches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_batches")
        .select("*, products(name, unit, hsn_code)")
        .gt("current_qty", 0)
        .order("product_id").order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // Group by product
  const productMap = new Map<string, { name: string; unit: string; hsn: string; batches: any[] }>();
  batches.forEach((b: any) => {
    const pid = b.product_id;
    const cur = productMap.get(pid) || { name: b.products?.name, unit: b.products?.unit, hsn: b.products?.hsn_code || "", batches: [] };
    cur.batches.push(b);
    productMap.set(pid, cur);
  });

  type StockRow = {
    product: string; unit: string; hsn: string;
    totalQty: number; avgRate: number; fifoRate: number;
    fifoValue: number; weightedAvgValue: number;
  };

  const rows: StockRow[] = [];

  productMap.forEach((prod) => {
    const totalQty = prod.batches.reduce((s: number, b: any) => s + Number(b.current_qty), 0);
    const totalCost = prod.batches.reduce((s: number, b: any) => s + Number(b.current_qty) * Number(b.purchase_rate), 0);

    // Weighted average rate
    const weightedAvgRate = totalQty > 0 ? totalCost / totalQty : 0;

    // FIFO valuation: oldest batches first (already ordered by created_at)
    let fifoValue = 0;
    let fifoRate = 0;
    let remaining = totalQty;
    for (const b of prod.batches) {
      const bQty = Number(b.current_qty);
      const bRate = Number(b.purchase_rate);
      if (remaining <= 0) break;
      const use = Math.min(remaining, bQty);
      fifoValue += use * bRate;
      remaining -= use;
    }
    fifoRate = totalQty > 0 ? fifoValue / totalQty : 0;

    rows.push({
      product: prod.name, unit: prod.unit, hsn: prod.hsn,
      totalQty, avgRate: weightedAvgRate, fifoRate,
      fifoValue, weightedAvgValue: totalCost,
    });
  });

  const totalValue = rows.reduce((s, r) => s + (method === "fifo" ? r.fifoValue : r.weightedAvgValue), 0);

  const exportData = rows.map((r) => ({
    product: r.product, hsn: r.hsn, unit: r.unit, qty: r.totalQty,
    rate: method === "fifo" ? r.fifoRate.toFixed(2) : r.avgRate.toFixed(2),
    value: method === "fifo" ? r.fifoValue.toFixed(2) : r.weightedAvgValue.toFixed(2),
    method: method === "fifo" ? "FIFO" : "Weighted Avg",
  }));
  const cols = [
    { key: "product", label: "Product" }, { key: "hsn", label: "HSN" },
    { key: "unit", label: "Unit" }, { key: "qty", label: "Qty" },
    { key: "rate", label: "Rate" }, { key: "value", label: "Value" },
    { key: "method", label: "Method" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stock Summary</h1>
            <p className="text-muted-foreground">Total value: ₹{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fifo">FIFO Valuation</SelectItem>
                <SelectItem value="weighted_avg">Weighted Avg</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => exportToCsv("stock-summary.csv", exportData, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("stock-summary.xlsx", exportData, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : rows.length === 0 ? <p className="text-muted-foreground text-center py-8">No stock found.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate (₹)</TableHead>
                    <TableHead className="text-right">Value (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.product}</TableCell>
                      <TableCell className="text-muted-foreground">{r.hsn || "—"}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right">{r.totalQty}</TableCell>
                      <TableCell className="text-right">
                        ₹{(method === "fifo" ? r.fifoRate : r.avgRate).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{(method === "fifo" ? r.fifoValue : r.weightedAvgValue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-bold">Total Inventory Value</TableCell>
                    <TableCell className="text-right font-bold">₹{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
