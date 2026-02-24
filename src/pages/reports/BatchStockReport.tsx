import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function BatchStockReport() {
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["batch-stock-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_batches")
        .select("*, products(name, unit, hsn_code)")
        .order("product_id").order("batch_no");
      if (error) throw error;
      return data || [];
    },
  });

  const now = new Date();
  const exportData = batches.map((b: any) => ({
    product: b.products?.name, batch: b.batch_no, hsn: b.products?.hsn_code,
    unit: b.products?.unit, qty: b.current_qty, purchase_rate: b.purchase_rate,
    value: (Number(b.current_qty) * Number(b.purchase_rate)).toFixed(2),
    mfg_date: b.mfg_date || "", exp_date: b.exp_date || "",
    status: b.exp_date && new Date(b.exp_date) < now ? "Expired" : Number(b.current_qty) <= 0 ? "Empty" : "OK",
  }));

  const cols = [
    { key: "product", label: "Product" }, { key: "batch", label: "Batch" },
    { key: "hsn", label: "HSN" }, { key: "unit", label: "Unit" },
    { key: "qty", label: "Qty" }, { key: "purchase_rate", label: "Rate" },
    { key: "value", label: "Value" }, { key: "mfg_date", label: "Mfg Date" },
    { key: "exp_date", label: "Exp Date" }, { key: "status", label: "Status" },
  ];

  const totalValue = batches.reduce((s: number, b: any) => s + Number(b.current_qty) * Number(b.purchase_rate), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Batch Stock Report</h1>
            <p className="text-muted-foreground">Total inventory value: ₹{totalValue.toLocaleString("en-IN")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("batch-stock-report.csv", exportData, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("batch-stock-report.xlsx", exportData, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : batches.length === 0 ? <p className="text-muted-foreground text-center py-8">No batches found.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>HSN</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Exp Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {batches.map((b: any) => {
                    const expired = b.exp_date && new Date(b.exp_date) < now;
                    const empty = Number(b.current_qty) <= 0;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.products?.name}</TableCell>
                        <TableCell>{b.batch_no}</TableCell>
                        <TableCell className="text-muted-foreground">{b.products?.hsn_code || "—"}</TableCell>
                        <TableCell className="text-right">{b.current_qty}</TableCell>
                        <TableCell>{b.products?.unit}</TableCell>
                        <TableCell className="text-right">₹{Number(b.purchase_rate).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{(Number(b.current_qty) * Number(b.purchase_rate)).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{b.exp_date || "—"}</TableCell>
                        <TableCell>
                          {expired ? <Badge variant="destructive">Expired</Badge> : empty ? <Badge variant="secondary">Empty</Badge> : <Badge>OK</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
