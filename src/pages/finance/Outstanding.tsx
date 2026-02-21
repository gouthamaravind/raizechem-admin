import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

export default function Outstanding() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["outstanding-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, dealers(name)").neq("status", "paid").order("due_date");
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const agingData = invoices.map((inv: any) => {
    const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    let bucket = "Current";
    if (daysOverdue > 90) bucket = "90+ days";
    else if (daysOverdue > 60) bucket = "60-90 days";
    else if (daysOverdue > 30) bucket = "30-60 days";
    else if (daysOverdue > 0) bucket = "0-30 days";
    return { ...inv, outstanding, daysOverdue, bucket };
  });

  // Group by dealer
  const dealerMap = new Map<string, { name: string; total: number; items: any[] }>();
  agingData.forEach((inv: any) => {
    const key = inv.dealer_id;
    if (!dealerMap.has(key)) dealerMap.set(key, { name: inv.dealers?.name || "Unknown", total: 0, items: [] });
    const d = dealerMap.get(key)!;
    d.total += inv.outstanding;
    d.items.push(inv);
  });

  const totalOutstanding = agingData.reduce((s: number, i: any) => s + i.outstanding, 0);
  const bucketColors: Record<string, string> = { "Current": "default", "0-30 days": "secondary", "30-60 days": "outline", "60-90 days": "destructive", "90+ days": "destructive" };

  const exportData = agingData.map((i: any) => ({
    invoice: i.invoice_number, dealer: i.dealers?.name, date: i.invoice_date,
    due_date: i.due_date, total: i.total_amount, paid: i.amount_paid,
    outstanding: i.outstanding, aging: i.bucket,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Outstanding</h1><p className="text-muted-foreground">Total outstanding: ₹{totalOutstanding.toLocaleString("en-IN")}</p></div>
          <Button variant="outline" onClick={() => exportToCsv("outstanding.csv", exportData, [{ key: "invoice", label: "Invoice #" }, { key: "dealer", label: "Dealer" }, { key: "date", label: "Date" }, { key: "due_date", label: "Due Date" }, { key: "total", label: "Total" }, { key: "paid", label: "Paid" }, { key: "outstanding", label: "Outstanding" }, { key: "aging", label: "Aging" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
        </div>

        {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : dealerMap.size === 0 ? <p className="text-muted-foreground text-center py-8">No outstanding amounts.</p> : (
          Array.from(dealerMap.entries()).map(([dealerId, dealer]) => (
            <Card key={dealerId}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span>{dealer.name}</span>
                  <span className="text-destructive">₹{dealer.total.toLocaleString("en-IN")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Due Date</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Outstanding</TableHead><TableHead>Aging</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dealer.items.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.invoice_date}</TableCell>
                        <TableCell>{inv.due_date || "—"}</TableCell>
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
