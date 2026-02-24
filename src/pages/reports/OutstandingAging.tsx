import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function OutstandingAging() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["aging-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, dealers(name)").neq("status", "paid").order("dealer_id");
      if (error) throw error;
      return data || [];
    },
  });

  const now = new Date();
  type AgingRow = { dealer: string; current: number; d0_30: number; d31_60: number; d61_90: number; d91_120: number; d121_180: number; d181_360: number; d360_plus: number; total: number };
  const dealerMap = new Map<string, AgingRow>();

  invoices.forEach((inv: any) => {
    const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
    if (outstanding <= 0) return;
    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
    const days = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
    const key = inv.dealer_id;
    if (!dealerMap.has(key)) dealerMap.set(key, { dealer: inv.dealers?.name || "Unknown", current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, d121_180: 0, d181_360: 0, d360_plus: 0, total: 0 });
    const row = dealerMap.get(key)!;
    row.total += outstanding;
    if (days <= 0) row.current += outstanding;
    else if (days <= 30) row.d0_30 += outstanding;
    else if (days <= 60) row.d31_60 += outstanding;
    else if (days <= 90) row.d61_90 += outstanding;
    else if (days <= 120) row.d91_120 += outstanding;
    else if (days <= 180) row.d121_180 += outstanding;
    else if (days <= 360) row.d181_360 += outstanding;
    else row.d360_plus += outstanding;
  });

  const rows = Array.from(dealerMap.values()).sort((a, b) => b.total - a.total);
  const zero = { current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, d121_180: 0, d181_360: 0, d360_plus: 0, total: 0 };
  const grandTotal = rows.reduce((s, r) => ({ current: s.current + r.current, d0_30: s.d0_30 + r.d0_30, d31_60: s.d31_60 + r.d31_60, d61_90: s.d61_90 + r.d61_90, d91_120: s.d91_120 + r.d91_120, d121_180: s.d121_180 + r.d121_180, d181_360: s.d181_360 + r.d181_360, d360_plus: s.d360_plus + r.d360_plus, total: s.total + r.total }), zero);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

  const cols = [
    { key: "dealer", label: "Dealer" }, { key: "current", label: "Current" },
    { key: "d0_30", label: "0-30 Days" }, { key: "d31_60", label: "31-60 Days" },
    { key: "d61_90", label: "61-90 Days" }, { key: "d91_120", label: "91-120 Days" },
    { key: "d121_180", label: "121-180 Days" }, { key: "d181_360", label: "181-360 Days" },
    { key: "d360_plus", label: "360+ Days" }, { key: "total", label: "Total" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Outstanding Aging</h1><p className="text-muted-foreground">Dealer-wise aging analysis</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("outstanding-aging.csv", rows, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("outstanding-aging.xlsx", rows, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Current</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{fmt(grandTotal.current)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">0-30</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-yellow-600">{fmt(grandTotal.d0_30)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">31-60</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-orange-600">{fmt(grandTotal.d31_60)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">61-90</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-orange-600">{fmt(grandTotal.d61_90)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">91-120</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-destructive">{fmt(grandTotal.d91_120)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">121-180</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-destructive">{fmt(grandTotal.d121_180)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">181-360</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-destructive">{fmt(grandTotal.d181_360)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">360+</CardTitle></CardHeader><CardContent><p className="text-lg font-bold text-destructive">{fmt(grandTotal.d360_plus)}</p></CardContent></Card>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : rows.length === 0 ? <p className="text-muted-foreground text-center py-8">No outstanding amounts.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Dealer</TableHead><TableHead className="text-right">Current</TableHead><TableHead className="text-right">0-30</TableHead><TableHead className="text-right">31-60</TableHead><TableHead className="text-right">61-90</TableHead><TableHead className="text-right">91-120</TableHead><TableHead className="text-right">121-180</TableHead><TableHead className="text-right">181-360</TableHead><TableHead className="text-right">360+</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.dealer}>
                      <TableCell className="font-medium">{r.dealer}</TableCell>
                      <TableCell className="text-right">{fmt(r.current)}</TableCell>
                      <TableCell className="text-right">{fmt(r.d0_30)}</TableCell>
                      <TableCell className="text-right">{fmt(r.d31_60)}</TableCell>
                      <TableCell className="text-right">{fmt(r.d61_90)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(r.d91_120)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(r.d121_180)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(r.d181_360)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(r.d360_plus)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Grand Total</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.current)}</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.d0_30)}</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.d31_60)}</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.d61_90)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(grandTotal.d91_120)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(grandTotal.d121_180)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(grandTotal.d181_360)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(grandTotal.d360_plus)}</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.total)}</TableCell>
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
