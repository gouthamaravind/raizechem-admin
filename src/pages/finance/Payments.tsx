import { useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBranch } from "@/hooks/useBranch";
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
import { AlterButton } from "@/components/tally/AlterButton";
import { AlterReasonDialog } from "@/components/tally/AlterReasonDialog";

export default function Payments() {
  const { user, hasRole, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [voidTarget, setVoidTarget] = useState<{ id: string; label: string } | null>(null);
  const [allocViewId, setAllocViewId] = useState<string | null>(null);
  const [alterTarget, setAlterTarget] = useState<{ id: string; label: string } | null>(null);
  const [alteringFrom, setAlteringFrom] = useState<{ id: string; label: string; reason: string } | null>(null);

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

  const pg = usePagination();
  const { branchId } = useBranch();

  const { data: paymentsRaw = [], isLoading } = useQuery({
    queryKey: ["payments", pg.page, branchId],
    queryFn: async () => {
      let q = supabase.from("payments").select("*, dealers(name)").order("created_at", { ascending: false }).range(pg.range.from, pg.range.to + 1);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const payments = paymentsRaw.slice(0, pg.pageSize);

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list", branchId], queryFn: async () => { let q = supabase.from("dealers").select("id, name").eq("status", "active").order("name"); if (branchId) q = q.eq("branch_id", branchId); const { data } = await q; return data || []; } });

  const { data: allocations = [] } = useQuery({
    queryKey: ["payment-allocations", allocViewId],
    enabled: !!allocViewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_allocations" as any)
        .select("id, allocated_amount, days_elapsed, prorata_rate, prorata_discount, invoice_id, invoices(invoice_number, total_amount, invoice_date)")
        .eq("payment_id", allocViewId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!dealerId || amount <= 0) throw new Error("Select dealer and enter amount");

      // ALTER: void original first (reverses allocations + ledger) before recording new payment
      if (alteringFrom) {
        const { error: vErr } = await supabase.rpc("void_payment_atomic" as any, {
          p_payment_id: alteringFrom.id,
          p_reason: `ALTER: ${alteringFrom.reason}`,
          p_voided_by: user?.id,
        });
        if (vErr) throw new Error("Could not void original payment: " + vErr.message);
      }

      const { data: paymentResult, error } = await supabase.rpc("record_payment_atomic" as any, {
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

      // Apply pro rata credit if payment was recorded
      const paymentId = paymentResult?.payment_id || paymentResult;
      if (paymentId) {
        const { data: proRataDiscount } = await supabase.rpc("apply_prorata_credit" as any, {
          p_payment_id: paymentId,
        });

        if (alteringFrom) {
          await supabase.from("audit_logs" as any).insert({
            table_name: "payments",
            record_id: alteringFrom.id,
            action: "ALTER",
            actor_user_id: user?.id,
            new_data: { alter_reason: alteringFrom.reason, replaced_by_id: paymentId, strategy: "void+create" },
          });
        }

        return proRataDiscount as number | null;
      }
      return null;
    },
    onSuccess: (proRataDiscount) => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["outstanding-invoices"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      const wasAlter = !!alteringFrom;
      setDialogOpen(false); resetForm();
      setAlteringFrom(null);
      if (wasAlter) {
        toast.success("Payment altered — original voided, replacement recorded");
      } else if (proRataDiscount && proRataDiscount > 0) {
        toast.success(`Payment recorded! Pro rata credit of ₹${Number(proRataDiscount).toLocaleString("en-IN")} applied.`);
      } else {
        toast.success("Payment recorded and applied to invoices");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startAlter = async (paymentId: string) => {
    const { data: p } = await supabase.from("payments").select("*").eq("id", paymentId).single();
    if (!p) { toast.error("Payment not found"); return; }
    setDealerId(p.dealer_id);
    setAmount(Number(p.amount));
    setMode(p.payment_mode || "bank_transfer");
    setRefNo(p.reference_number || "");
    setNotes(p.notes || "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTdsRate(Number(p.tds_rate ?? 0));
    setTcsRate(Number(p.tcs_rate ?? 0));
    setDialogOpen(true);
  };

  const resetForm = () => {
    setDealerId(""); setAmount(0); setMode("bank_transfer"); setRefNo(""); setNotes("");
    setTdsRate(0); setTcsRate(0);
  };

  const filtered = payments.filter((p: any) => {
    const s = search.toLowerCase();
    return p.dealers?.name?.toLowerCase().includes(s) || p.reference_number?.toLowerCase().includes(s);
  });

  const modeLabels: Record<string, string> = { cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", upi: "UPI", neft: "NEFT", rtgs: "RTGS", imps: "IMPS", dd: "Demand Draft" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Payments</h1><p className="text-muted-foreground">Record payments from dealers with TDS/TCS</p></div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setAlteringFrom(null); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Record Payment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{alteringFrom ? `Alter Payment ${alteringFrom.label} → new` : "Record Payment"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createPayment.mutate(); }} className="space-y-4">
                <div className="space-y-2"><Label>Dealer *</Label><Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Gross Amount (₹) *</Label><Input type="number" required min={0.01} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Mode</Label><Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="neft">NEFT</SelectItem><SelectItem value="rtgs">RTGS</SelectItem><SelectItem value="imps">IMPS</SelectItem><SelectItem value="dd">Demand Draft</SelectItem></SelectContent></Select></div>
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
              <>
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
                          {isAdmin && p.status !== "void" && (
                            <AlterButton onClick={() => setAlterTarget({ id: p.id, label: `₹${Number(p.amount).toLocaleString("en-IN")}` })} />
                          )}
                          {canVoid && p.status !== "void" && (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setVoidTarget({ id: p.id, label: `₹${Number(p.amount).toLocaleString("en-IN")}` })}><Ban className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination page={pg.page} pageSize={pg.pageSize} totalFetched={paymentsRaw.length} onPrev={pg.prevPage} onNext={pg.nextPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocations Viewer with Pro Rata Details */}
      <Dialog open={!!allocViewId} onOpenChange={(v) => { if (!v) setAllocViewId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payment Allocations & Pro Rata</DialogTitle></DialogHeader>
          {allocations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No allocations found for this payment.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-center">Days</TableHead>
                      <TableHead className="text-right">Rate %</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(allocations as any[]).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.invoices?.invoice_number || "—"}</TableCell>
                        <TableCell>{a.invoices?.invoice_date || "—"}</TableCell>
                        <TableCell className="text-right">₹{Number(a.allocated_amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center">
                          {a.days_elapsed != null ? (
                            <Badge variant={a.days_elapsed > 60 ? "destructive" : a.days_elapsed > 30 ? "secondary" : "outline"} className="text-xs">
                              {a.days_elapsed}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">{Number(a.prorata_rate) > 0 ? `${Number(a.prorata_rate).toFixed(4)}%` : "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {Number(a.prorata_discount) > 0 ? `₹${Number(a.prorata_discount).toLocaleString("en-IN")}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Totals */}
              {(() => {
                const totalAlloc = (allocations as any[]).reduce((s: number, a: any) => s + Number(a.allocated_amount), 0);
                const totalDiscount = (allocations as any[]).reduce((s: number, a: any) => s + Number(a.prorata_discount || 0), 0);
                return (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>Total Allocated</span><span className="font-semibold">₹{totalAlloc.toLocaleString("en-IN")}</span></div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between border-t pt-1"><span>Total Pro Rata Credit</span><span className="font-bold text-primary">₹{totalDiscount.toLocaleString("en-IN")}</span></div>
                    )}
                  </div>
                );
              })()}
            </>
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

      <AlterReasonDialog
        open={!!alterTarget}
        onOpenChange={(v) => { if (!v) setAlterTarget(null); }}
        title={`Payment ${alterTarget?.label || ""}`}
        onConfirm={(reason) => {
          if (!alterTarget) return;
          setAlteringFrom({ id: alterTarget.id, label: alterTarget.label, reason });
          startAlter(alterTarget.id);
          setAlterTarget(null);
        }}
      />
    </DashboardLayout>
  );
}
