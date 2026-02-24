import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

export default function SupplierOutstanding() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["supplier-outstanding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("*, suppliers(name)")
        .neq("status", "paid")
        .neq("status", "void")
        .order("pi_date");
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const agingData = invoices.map((inv: any) => {
    const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
    const piDate = new Date(inv.pi_date);
    const daysOld = Math.floor((now.getTime() - piDate.getTime()) / (1000 * 60 * 60 * 24));
    let bucket = "Current";
    if (daysOld > 360) bucket = "360+ days";
    else if (daysOld > 180) bucket = "181-360 days";
    else if (daysOld > 120) bucket = "121-180 days";
    else if (daysOld > 90) bucket = "91-120 days";
    else if (daysOld > 60) bucket = "60-90 days";
    else if (daysOld > 30) bucket = "30-60 days";
    else if (daysOld > 0) bucket = "0-30 days";
    return { ...inv, outstanding, daysOld, bucket };
  }).filter((inv: any) => inv.outstanding > 0);

  const supplierMap = new Map<string, { name: string; total: number; items: any[] }>();
  agingData.forEach((inv: any) => {
    const key = inv.supplier_id;
    if (!supplierMap.has(key)) supplierMap.set(key, { name: inv.suppliers?.name || "Unknown", total: 0, items: [] });
    const s = supplierMap.get(key)!;
    s.total += inv.outstanding;
    s.items.push(inv);
  });

  const totalOutstanding = agingData.reduce((s: number, i: any) => s + i.outstanding, 0);
  const bucketColors: Record<string, string> = { Current: "default", "0-30 days": "secondary", "30-60 days": "outline", "60-90 days": "destructive", "91-120 days": "destructive", "121-180 days": "destructive", "181-360 days": "destructive", "360+ days": "destructive" };

  const exportData = agingData.map((i: any) => ({
    pi_number: i.pi_number, supplier: i.suppliers?.name, date: i.pi_date,
    total: i.total_amount, paid: i.amount_paid, outstanding: i.outstanding, aging: i.bucket,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Supplier Outstanding</h1>
            <p className="text-muted-foreground">Total payable: ₹{totalOutstanding.toLocaleString("en-IN")}</p>
          </div>
          <Button variant="outline" onClick={() => exportToCsv("supplier-outstanding.csv", exportData, [
            { key: "pi_number", label: "PI #" }, { key: "supplier", label: "Supplier" }, { key: "date", label: "Date" },
            { key: "total", label: "Total" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" }, { key: "aging", label: "Aging" },
          ])}>
            <Download className="h-4 w-4 mr-2" />CSV
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : supplierMap.size === 0 ? (
          <p className="text-muted-foreground text-center py-8">No outstanding payables.</p>
        ) : (
          Array.from(supplierMap.entries()).map(([sid, supplier]) => (
            <Card key={sid}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span>{supplier.name}</span>
                  <span className="text-destructive">₹{supplier.total.toLocaleString("en-IN")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Aging</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplier.items.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.pi_number}</TableCell>
                        <TableCell>{inv.pi_date}</TableCell>
                        <TableCell>₹{Number(inv.total_amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell>₹{Number(inv.amount_paid).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="font-semibold text-destructive">₹{inv.outstanding.toLocaleString("en-IN")}</TableCell>
                        <TableCell><Badge variant={bucketColors[inv.bucket] as any}>{inv.bucket}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
