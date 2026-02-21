import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Payments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dealerId, setDealerId] = useState("");
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState("bank_transfer");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*, dealers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list"], queryFn: async () => { const { data } = await supabase.from("dealers").select("id, name").eq("status", "active").order("name"); return data || []; } });

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!dealerId || amount <= 0) throw new Error("Select dealer and enter amount");

      const { data: payment, error } = await supabase.from("payments").insert({
        dealer_id: dealerId, payment_date: paymentDate, amount,
        payment_mode: mode, reference_number: refNo || null, notes: notes || null,
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      // Ledger entry (credit)
      await supabase.from("ledger_entries").insert({
        dealer_id: dealerId, entry_date: paymentDate, entry_type: "payment",
        ref_id: payment.id, description: `Payment received (${mode}) ${refNo ? `Ref: ${refNo}` : ""}`,
        debit: 0, credit: amount,
      });

      // Auto-apply to oldest unpaid invoices
      let remaining = amount;
      const { data: unpaid } = await supabase.from("invoices").select("id, total_amount, amount_paid").eq("dealer_id", dealerId).neq("status", "paid").order("invoice_date");
      if (unpaid) {
        for (const inv of unpaid) {
          if (remaining <= 0) break;
          const due = Number(inv.total_amount) - Number(inv.amount_paid);
          const apply = Math.min(remaining, due);
          const newPaid = Number(inv.amount_paid) + apply;
          const newStatus = newPaid >= Number(inv.total_amount) ? "paid" : "partially_paid";
          await supabase.from("invoices").update({ amount_paid: newPaid, status: newStatus }).eq("id", inv.id);
          remaining -= apply;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["outstanding-invoices"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setDialogOpen(false); setDealerId(""); setAmount(0); setMode("bank_transfer"); setRefNo(""); setNotes("");
      toast.success("Payment recorded and applied to invoices");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = payments.filter((p: any) => {
    const s = search.toLowerCase();
    return p.dealers?.name?.toLowerCase().includes(s) || p.reference_number?.toLowerCase().includes(s);
  });

  const modeLabels: Record<string, string> = { cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", upi: "UPI" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Payments</h1><p className="text-muted-foreground">Record payments from dealers</p></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Record Payment</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createPayment.mutate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Dealer *</Label><Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Amount (₹) *</Label><Input type="number" required min={0.01} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Mode</Label><Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="upi">UPI</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Reference No.</Label><Input value={refNo} onChange={(e) => setRefNo(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={createPayment.isPending}>{createPayment.isPending ? "Recording..." : "Record Payment"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardHeader className="pb-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search payments..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No payments recorded.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Dealer</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.dealers?.name}</TableCell>
                      <TableCell>{p.payment_date}</TableCell>
                      <TableCell className="font-semibold text-success">₹{Number(p.amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant="outline">{modeLabels[p.payment_mode] || p.payment_mode}</Badge></TableCell>
                      <TableCell className="text-sm">{p.reference_number || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.notes || "—"}</TableCell>
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
