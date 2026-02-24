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
import { Search, Plus, Ban, Eye } from "lucide-react";
import { toast } from "sonner";
import { useVoidTransaction } from "@/hooks/useVoidTransaction";
import { VoidDialog } from "@/components/VoidDialog";

export default function Payments() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [voidTarget, setVoidTarget] = useState<{ id: string; label: string } | null>(null);
  const [allocViewId, setAllocViewId] = useState<string | null>(null);

  const voidMutation = useVoidTransaction({
    table: "payments",
    invalidateKeys: [["payments"]],
  });
  const canVoid = hasRole("admin") || hasRole("accounts");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dealerId, setDealerId] = useState("");
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState("bank_transfer");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [tdsRate, setTdsRate] = useState(0);
  const [tcsRate, setTcsRate] = useState(0);

  const tdsAmount = amount > 0 ? +(amount * tdsRate / 100).toFixed(2) : 0;
  const tcsAmount = amount > 0 ? +(amount * tcsRate / 100).toFixed(2) : 0;
  const netAmount = amount > 0 ? +(amount - tdsAmount + tcsAmount).toFixed(2) : 0;

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*, dealers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list"], queryFn: async () => { const { data } = await supabase.from("dealers").select("id, name").eq("status", "active").order("name"); return data || []; } });

  const { data: allocations = [] } = useQuery({
    queryKey: ["payment-allocations", allocViewId],
    enabled: !!allocViewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_allocations" as any)
        .select("id, allocated_amount, invoice_id, invoices(invoice_number, total_amount, invoice_date)")
        .eq("payment_id", allocViewId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!dealerId || amount <= 0) throw new Error("Select dealer and enter amount");

      const { error } = await supabase.rpc("record_payment_atomic" as any, {
        p_dealer_id: dealerId,
        p_payment_date: paymentDate,
        p_amount: amount,
        p_payment_mode: mode,
        p_reference_number: refNo || null,
        p_notes: notes || null,
        p_created_by: user?.id,
        p_tds_rate: tdsRate,
        p_tds_amount: tdsAmount,
        p_tcs_rate: tcsRate,
        p_tcs_amount: tcsAmount,
        p_net_amount: netAmount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["outstanding-invoices"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setDialogOpen(false); resetForm();
      toast.success("Payment recorded and applied to invoices");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setDealerId(""); setAmount(0); setMode("bank_transfer"); setRefNo(""); setNotes("");
    setTdsRate(0); setTcsRate(0);
  };

  const filtered = payments.filter((p: any) => {
    const s = search.toLowerCase();
    return p.dealers?.name?.toLowerCase().includes(s) || p.reference_number?.toLowerCase().includes(s);
  });

  const modeLabels: Record<string, string> = { cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", upi: "UPI" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Payments</h1><p className="text-muted-foreground">Record payments from dealers with TDS/TCS</p></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Record Payment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createPayment.mutate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Dealer *</Label><Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Gross Amount (₹) *</Label><Input type="number" required min={0.01} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Mode</Label><Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="upi">UPI</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Reference No.</Label><Input value={refNo} onChange={(e) => setRefNo(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>TDS Rate (%)</Label><Input type="number" min={0} max={100} step="0.01" value={tdsRate || ""} onChange={(e) => setTdsRate(Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label>TCS Rate (%)</Label><Input type="number" min={0} max={100} step="0.01" value={tcsRate || ""} onChange={(e) => setTcsRate(Number(e.target.value))} /></div>
                </div>
                {(tdsRate > 0 || tcsRate > 0) && (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    {tdsRate > 0 && <div className="flex justify-between"><span>TDS ({tdsRate}%)</span><span className="text-destructive">− ₹{tdsAmount.toLocaleString("en-IN")}</span></div>}
                    {tcsRate > 0 && <div className="flex justify-between"><span>TCS ({tcsRate}%)</span><span className="text-primary">+ ₹{tcsAmount.toLocaleString("en-IN")}</span></div>}
                    <div className="flex justify-between font-semibold border-t pt-1"><span>Net Receivable</span><span>₹{netAmount.toLocaleString("en-IN")}</span></div>
                  </div>
                )}
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Dealer</TableHead><TableHead>Date</TableHead><TableHead>Gross Amt</TableHead><TableHead>TDS</TableHead><TableHead>TCS</TableHead><TableHead>Net Amt</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.dealers?.name}</TableCell>
                        <TableCell>{p.payment_date}</TableCell>
                        <TableCell>₹{Number(p.amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{Number(p.tds_amount) > 0 ? <span className="text-destructive">₹{Number(p.tds_amount).toLocaleString("en-IN")} ({p.tds_rate}%)</span> : "—"}</TableCell>
                        <TableCell>{Number(p.tcs_amount) > 0 ? <span className="text-primary">₹{Number(p.tcs_amount).toLocaleString("en-IN")} ({p.tcs_rate}%)</span> : "—"}</TableCell>
                        <TableCell className="font-semibold">₹{Number(p.net_amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell><Badge variant="outline">{modeLabels[p.payment_mode] || p.payment_mode}</Badge></TableCell>
                        <TableCell className="text-sm">{p.reference_number || "—"}</TableCell>
                        <TableCell><Badge variant={p.status === "void" ? "destructive" : "default"}>{p.status || "active"}</Badge></TableCell>
                        <TableCell className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setAllocViewId(p.id)} title="View allocations"><Eye className="h-4 w-4" /></Button>
                          {canVoid && p.status !== "void" && (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setVoidTarget({ id: p.id, label: `₹${Number(p.amount).toLocaleString("en-IN")}` })}><Ban className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocations Viewer */}
      <Dialog open={!!allocViewId} onOpenChange={(v) => { if (!v) setAllocViewId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment Allocations</DialogTitle></DialogHeader>
          {allocations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No allocations found for this payment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Invoice Total</TableHead>
                  <TableHead>Allocated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.invoices?.invoice_number || "—"}</TableCell>
                    <TableCell>{a.invoices?.invoice_date || "—"}</TableCell>
                    <TableCell>₹{Number(a.invoices?.total_amount || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="font-semibold text-primary">₹{Number(a.allocated_amount).toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <VoidDialog
        open={!!voidTarget}
        onOpenChange={(v) => { if (!v) setVoidTarget(null); }}
        onConfirm={(reason) => { if (voidTarget) voidMutation.mutate({ id: voidTarget.id, reason }, { onSuccess: () => setVoidTarget(null) }); }}
        isPending={voidMutation.isPending}
        title={`Payment ${voidTarget?.label || ""}`}
      />
    </DashboardLayout>
  );
}
