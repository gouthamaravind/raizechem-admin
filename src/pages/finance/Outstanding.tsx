import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBranch } from "@/hooks/useBranch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Mail, Loader2 } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { toast } from "@/hooks/use-toast";

export default function Outstanding() {
  const { branchId } = useBranch();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const sendReminder = async (dealerId: string, dealerName: string, items: any[], total: number) => {
    setSendingId(dealerId);
    try {
      const { data: dealer, error: dErr } = await supabase
        .from("dealers")
        .select("email, contact_person")
        .eq("id", dealerId)
        .maybeSingle();
      if (dErr) throw dErr;
      if (!dealer?.email) {
        toast({ title: "No email on file", description: `Add an email to ${dealerName} first.`, variant: "destructive" });
        return;
      }
      const maxDays = items.reduce((m, i) => Math.max(m, i.daysOverdue), 0);
      const tier = maxDays > 90 ? "critical" : maxDays > 30 ? "warning" : "early";
      const invoices = items.map((i: any) => ({
        invoice_number: i.invoice_number,
        invoice_date: i.invoice_date,
        due_date: i.due_date,
        outstanding: i.outstanding,
        days_overdue: i.daysOverdue,
      }));

      const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "dealer-overdue-reminder",
          recipientEmail: dealer.email,
          idempotencyKey: `reminder-${dealerId}-${new Date().toISOString().slice(0,10)}`,
          templateData: {
            dealerName,
            contactPerson: dealer.contact_person,
            totalOutstanding: total,
            maxDaysOverdue: maxDays,
            invoices,
          },
        },
      });
      if (sendErr) throw sendErr;

      await supabase.from("reminder_log").insert({
        dealer_id: dealerId,
        channel: "email",
        status: "sent",
        recipient: dealer.email,
        total_outstanding: total,
        max_days_overdue: maxDays,
        invoice_count: items.length,
        tier,
      });

      toast({ title: "Reminder queued", description: `Email queued to ${dealer.email}` });
    } catch (e: any) {
      await supabase.from("reminder_log").insert({
        dealer_id: dealerId, channel: "email", status: "failed",
        total_outstanding: total, error_message: e?.message?.slice(0, 500) ?? "unknown",
      });
      toast({ title: "Reminder failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["outstanding-invoices", branchId],
    queryFn: async () => {
      let q = supabase.from("invoices").select("*, dealers(name)").neq("status", "paid").neq("status", "void").order("due_date");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
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
    if (daysOverdue > 360) bucket = "360+ days";
    else if (daysOverdue > 180) bucket = "181-360 days";
    else if (daysOverdue > 120) bucket = "121-180 days";
    else if (daysOverdue > 90) bucket = "91-120 days";
    else if (daysOverdue > 60) bucket = "60-90 days";
    else if (daysOverdue > 30) bucket = "30-60 days";
    else if (daysOverdue > 0) bucket = "0-30 days";
    return { ...inv, outstanding, daysOverdue, bucket };
  }).filter((inv: any) => inv.outstanding > 0.01);

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
  const bucketColors: Record<string, string> = { "Current": "default", "0-30 days": "secondary", "30-60 days": "outline", "60-90 days": "destructive", "91-120 days": "destructive", "121-180 days": "destructive", "181-360 days": "destructive", "360+ days": "destructive" };

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
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{dealer.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-destructive">₹{dealer.total.toLocaleString("en-IN")}</span>
                    <Button size="sm" variant="outline" disabled={sendingId === dealerId}
                      onClick={() => sendReminder(dealerId, dealer.name, dealer.items, dealer.total)}>
                      {sendingId === dealerId
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <><Mail className="h-4 w-4 mr-2" />Remind Please</>}
                    </Button>
                  </div>
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
