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

export default function SupplierPayments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState("bank_transfer");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  // Read supplier payments from supplier_ledger_entries with entry_type = 'payment'
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["supplier-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_ledger_entries" as any)
        .select("*, suppliers(name)")
        .eq("entry_type", "payment")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!supplierId || amount <= 0) throw new Error("Select supplier and enter amount");

      // Supplier ledger entry (debit = we paid them, reduces our liability)
      await supabase.from("supplier_ledger_entries" as any).insert({
        supplier_id: supplierId,
        entry_date: paymentDate,
        entry_type: "payment",
        description: `Payment made (${mode}) ${refNo ? `Ref: ${refNo}` : ""} ${notes ? `— ${notes}` : ""}`.trim(),
        debit: amount,
        credit: 0,
      });

      // Auto-apply to oldest unpaid purchase invoices
      let remaining = amount;
      const { data: unpaid } = await supabase
        .from("purchase_invoices")
        .select("id, total_amount, amount_paid")
        .eq("supplier_id", supplierId)
        .neq("status", "paid")
        .neq("status", "void")
        .order("pi_date");

      if (unpaid) {
        for (const inv of unpaid) {
          if (remaining <= 0) break;
          const due = Number(inv.total_amount) - Number(inv.amount_paid);
          const apply = Math.min(remaining, due);
          const newPaid = Number(inv.amount_paid) + apply;
          const newStatus = newPaid >= Number(inv.total_amount) ? "paid" : "partially_paid";
          await supabase.from("purchase_invoices").update({ amount_paid: newPaid, status: newStatus }).eq("id", inv.id);
          remaining -= apply;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-payments"] });
      qc.invalidateQueries({ queryKey: ["supplier-ledger"] });
      qc.invalidateQueries({ queryKey: ["supplier-outstanding"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      setDialogOpen(false);
      setSupplierId(""); setAmount(0); setMode("bank_transfer"); setRefNo(""); setNotes("");
      toast.success("Supplier payment recorded and applied");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (payments as any[]).filter((p: any) => {
    const s = search.toLowerCase();
    return p.suppliers?.name?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
  });

  const modeLabels: Record<string, string> = { cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", upi: "UPI" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Supplier Payments</h1>
            <p className="text-muted-foreground">Record payments made to suppliers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Record Payment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Record Supplier Payment</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createPayment.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Amount (₹) *</Label><Input type="number" required min={0.01} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select value={mode} onValueChange={setMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Reference No.</Label><Input value={refNo} onChange={(e) => setRefNo(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={createPayment.isPending}>
                  {createPayment.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search payments..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No supplier payments recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.suppliers?.name}</TableCell>
                        <TableCell>{p.entry_date}</TableCell>
                        <TableCell className="font-semibold">₹{Number(p.debit).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm">{p.description || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
