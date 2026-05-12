import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface Issue {
  type: string;
  number: string;
  date: string;
  party: string;
  amount: number;
  reason: string;
  table: string;
}

export default function VoucherClarification() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["voucher-clarification", from, to],
    queryFn: async () => {
      const out: Issue[] = [];

      const [inv, pi, cn, dn, pmt, ar, vch] = await Promise.all([
        supabase.from("invoices").select("invoice_number, invoice_date, total_amount, status, void_reason, dealers(name)").eq("status", "void").gte("invoice_date", from).lte("invoice_date", to),
        (supabase.from("purchase_invoices" as any) as any).select("pi_number, pi_date, total_amount, status, void_reason, suppliers(name)").eq("status", "void").gte("pi_date", from).lte("pi_date", to),
        supabase.from("credit_notes").select("credit_note_number, credit_date, total_amount, status, void_reason, dealers(name)").eq("status", "void").gte("credit_date", from).lte("credit_date", to),
        supabase.from("debit_notes").select("debit_note_number, debit_date, total_amount, status, void_reason, suppliers(name)").eq("status", "void").gte("debit_date", from).lte("debit_date", to),
        supabase.from("payments").select("id, payment_date, net_amount, status, void_reason, dealers(name)").eq("status", "void").gte("payment_date", from).lte("payment_date", to),
        (supabase.from("advance_receipts" as any) as any).select("receipt_number, receipt_date, gross_amount, status, void_reason, dealers(name)").eq("status", "VOID").gte("receipt_date", from).lte("receipt_date", to),
        supabase.from("vouchers").select("voucher_number, voucher_date, voucher_type, total_amount, status, void_reason, narration").eq("status", "void").gte("voucher_date", from).lte("voucher_date", to),
      ]);

      (inv.data || []).forEach((r: any) => out.push({ type: "Invoice", number: r.invoice_number, date: r.invoice_date, party: r.dealers?.name ?? "", amount: Number(r.total_amount), reason: r.void_reason ?? "voided", table: "invoices" }));
      (pi.data || []).forEach((r: any) => out.push({ type: "Purchase Invoice", number: r.pi_number, date: r.pi_date, party: r.suppliers?.name ?? "", amount: Number(r.total_amount), reason: r.void_reason ?? "voided", table: "purchase_invoices" }));
      (cn.data || []).forEach((r: any) => out.push({ type: "Credit Note", number: r.credit_note_number, date: r.credit_date, party: r.dealers?.name ?? "", amount: Number(r.total_amount), reason: r.void_reason ?? "voided", table: "credit_notes" }));
      (dn.data || []).forEach((r: any) => out.push({ type: "Debit Note", number: r.debit_note_number, date: r.debit_date, party: r.suppliers?.name ?? "", amount: Number(r.total_amount), reason: r.void_reason ?? "voided", table: "debit_notes" }));
      (pmt.data || []).forEach((r: any) => out.push({ type: "Payment", number: r.id.slice(0, 8), date: r.payment_date, party: r.dealers?.name ?? "", amount: Number(r.net_amount), reason: r.void_reason ?? "voided", table: "payments" }));
      (ar.data || []).forEach((r: any) => out.push({ type: "Advance Receipt", number: r.receipt_number, date: r.receipt_date, party: r.dealers?.name ?? "", amount: Number(r.gross_amount), reason: r.void_reason ?? "voided", table: "advance_receipts" }));
      (vch.data || []).forEach((r: any) => out.push({ type: r.voucher_type, number: r.voucher_number, date: r.voucher_date, party: r.narration ?? "", amount: Number(r.total_amount), reason: r.void_reason ?? "voided", table: "vouchers" }));

      out.sort((a, b) => b.date.localeCompare(a.date));
      return out;
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Voucher Clarification</h1>
            <p className="text-muted-foreground">All voided / cancelled transactions across the system.</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-4 flex gap-4 items-end">
            <div className="space-y-1"><Label>From</Label><Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p>
              : issues.length === 0 ? <p className="text-muted-foreground text-center py-8">No exceptions found in this period.</p>
              : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Date</TableHead>
                    <TableHead>Party / Narration</TableHead><TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {issues.map((i, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Badge variant="outline" className="capitalize">{i.type}</Badge></TableCell>
                        <TableCell className="font-medium">{i.number}</TableCell>
                        <TableCell>{i.date}</TableCell>
                        <TableCell>{i.party}</TableCell>
                        <TableCell className="text-right line-through text-muted-foreground">₹{i.amount.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{i.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
