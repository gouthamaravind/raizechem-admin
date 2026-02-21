import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

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
  type AgingRow = { dealer: string; current: number; d0_30: number; d31_60: number; d61_plus: number; total: number };
  const dealerMap = new Map<string, AgingRow>();

  invoices.forEach((inv: any) => {
    const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
    if (outstanding <= 0) return;
    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
    const days = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
    const key = inv.dealer_id;
    if (!dealerMap.has(key)) dealerMap.set(key, { dealer: inv.dealers?.name || "Unknown", current: 0, d0_30: 0, d31_60: 0, d61_plus: 0, total: 0 });
    const row = dealerMap.get(key)!;
    row.total += outstanding;
    if (days <= 0) row.current += outstanding;
    else if (days <= 30) row.d0_30 += outstanding;
    else if (days <= 60) row.d31_60 += outstanding;
    else row.d61_plus += outstanding;
  });

  const rows = Array.from(dealerMap.values()).sort((a, b) => b.total - a.total);
  const grandTotal = rows.reduce((s, r) => ({ current: s.current + r.current, d0_30: s.d0_30 + r.d0_30, d31_60: s.d31_60 + r.d31_60, d61_plus: s.d61_plus + r.d61_plus, total: s.total + r.total }), { current: 0, d0_30: 0, d31_60: 0, d61_plus: 0, total: 0 });

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

  const cols = [
    { key: "dealer", label: "Dealer" }, { key: "current", label: "Current" },
    { key: "d0_30", label: "0-30 Days" }, { key: "d31_60", label: "31-60 Days" },
    { key: "d61_plus", label: "61+ Days" }, { key: "total", label: "Total" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Outstanding Aging</h1><p className="text-muted-foreground">Dealer-wise aging analysis</p></div>
          <Button variant="outline" onClick={() => exportToCsv("outstanding-aging.csv", rows, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Current</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{fmt(grandTotal.current)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">0-30 Days</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-yellow-600">{fmt(grandTotal.d0_30)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">31-60 Days</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-orange-600">{fmt(grandTotal.d31_60)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">61+ Days</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-destructive">{fmt(grandTotal.d61_plus)}</p></CardContent></Card>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : rows.length === 0 ? <p className="text-muted-foreground text-center py-8">No outstanding amounts.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Dealer</TableHead><TableHead className="text-right">Current</TableHead><TableHead className="text-right">0-30 Days</TableHead><TableHead className="text-right">31-60 Days</TableHead><TableHead className="text-right">61+ Days</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.dealer}>
                      <TableCell className="font-medium">{r.dealer}</TableCell>
                      <TableCell className="text-right">{fmt(r.current)}</TableCell>
                      <TableCell className="text-right">{fmt(r.d0_30)}</TableCell>
                      <TableCell className="text-right">{fmt(r.d31_60)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(r.d61_plus)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Grand Total</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.current)}</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.d0_30)}</TableCell>
                    <TableCell className="text-right">{fmt(grandTotal.d31_60)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(grandTotal.d61_plus)}</TableCell>
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
