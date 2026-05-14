import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useBranch } from "@/hooks/useBranch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, FileDown, Loader2, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { exportTablePdf } from "@/lib/pdf-export";

const fmt = (n: number) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function DealerClosure() {
  const { user } = useAuth();
  const { branchId } = useBranch();
  const qc = useQueryClient();
  const [dealerId, setDealerId] = useState<string>("");
  const [closureDate, setClosureDate] = useState(new Date().toISOString().slice(0, 10));
  const [applySD, setApplySD] = useState(true);
  const [notes, setNotes] = useState("");

  const { data: dealers = [] } = useQuery({
    queryKey: ["closure-dealers", branchId],
    queryFn: async () => {
      let q = supabase.from("dealers").select("id,name,gst_number,closure_status,closed_at,security_deposit_amount,sd_balance").order("name");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: snapshot, isLoading: snapLoading } = useQuery({
    queryKey: ["closure-snapshot", dealerId],
    enabled: !!dealerId,
    queryFn: async () => {
      const dealer = dealers.find((d: any) => d.id === dealerId);
      const [{ data: invoices }, { data: advances }] = await Promise.all([
        supabase.from("invoices").select("invoice_number,invoice_date,total_amount,amount_paid,status")
          .eq("dealer_id", dealerId).not("status", "in", "(paid,void)"),
        supabase.from("advance_receipts").select("receipt_number,receipt_date,balance_amount,status")
          .eq("dealer_id", dealerId).eq("status", "OPEN"),
      ]);
      const outstanding = (invoices || []).reduce((s: number, i: any) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0);
      const advance = (advances || []).reduce((s: number, a: any) => s + Number(a.balance_amount), 0);
      const sd = Number(dealer?.sd_balance) || 0;
      return { dealer, invoices: invoices || [], advances: advances || [], outstanding, advance, sd };
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["closure-history", dealerId],
    enabled: !!dealerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("closure_statements").select("*").eq("dealer_id", dealerId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const sdApply = applySD && snapshot ? Math.min(snapshot.sd, Math.max(snapshot.outstanding - snapshot.advance, 0)) : 0;
  const netSettlement = snapshot ? snapshot.outstanding - snapshot.advance - sdApply : 0;
  const dealer = snapshot?.dealer;
  const isClosed = dealer?.closure_status === "closed";

  const closeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("close_dealer_atomic", {
        p_dealer_id: dealerId,
        p_closure_date: closureDate,
        p_apply_sd: applySD,
        p_notes: notes || null,
        p_user_id: user!.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      toast({ title: "Dealership closed", description: `Net settlement: ${fmt(res.net_settlement)}` });
      qc.invalidateQueries({ queryKey: ["closure-dealers"] });
      qc.invalidateQueries({ queryKey: ["closure-snapshot", dealerId] });
      qc.invalidateQueries({ queryKey: ["closure-history", dealerId] });
    },
    onError: (e: any) => toast({ title: "Closure failed", description: e.message, variant: "destructive" }),
  });

  const downloadStatement = (row: any) => {
    const rows = [
      ["Total Outstanding", fmt(row.total_outstanding)],
      ["Less: Advance Balance", fmt(row.advance_balance)],
      ["Less: Security Deposit Applied", fmt(row.sd_applied)],
      ["Net Settlement", fmt(row.net_settlement)],
    ];
    exportTablePdf({
      title: "Dealership Closure Statement",
      subtitle: `${dealer?.name} — Closed on ${row.closure_date}`,
      filename: `closure-${(dealer?.name || "dealer").replace(/\s+/g, "_")}-${row.closure_date}.pdf`,
      columns: ["Item", "Amount"],
      rows,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dealership Closure</h1>
          <p className="text-muted-foreground">Snapshot outstanding, adjust SD, and freeze a dealer account.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Select Dealer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label>Dealer</Label>
                <Select value={dealerId} onValueChange={setDealerId}>
                  <SelectTrigger><SelectValue placeholder="Select dealer to close…" /></SelectTrigger>
                  <SelectContent>
                    {dealers.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} {d.closure_status === "closed" ? "(closed)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Closure Date</Label>
                <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {dealerId && snapLoading && (
          <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading snapshot…</p>
        )}

        {snapshot && (
          <>
            {isClosed && (
              <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>This dealer is already closed</AlertTitle>
                <AlertDescription>Closed on {dealer?.closed_at ?? "—"}. View past statements below.</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{fmt(snapshot.outstanding)}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Advance Balance</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{fmt(snapshot.advance)}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">SD Balance</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{fmt(snapshot.sd)}</p></CardContent></Card>
              <Card className="border-primary"><CardHeader className="pb-2"><CardTitle className="text-sm">Net Settlement</CardTitle></CardHeader><CardContent>
                <p className={`text-2xl font-bold ${netSettlement > 0 ? "text-destructive" : "text-emerald-600"}`}>{fmt(Math.abs(netSettlement))}</p>
                <p className="text-xs text-muted-foreground">{netSettlement > 0 ? "Receivable from dealer" : "Refundable to dealer"}</p>
              </CardContent></Card>
            </div>

            {snapshot.invoices.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Open Invoices</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Outstanding</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {snapshot.invoices.map((i: any) => (
                        <TableRow key={i.invoice_number}>
                          <TableCell>{i.invoice_number}</TableCell>
                          <TableCell>{i.invoice_date}</TableCell>
                          <TableCell>{fmt(i.total_amount)}</TableCell>
                          <TableCell>{fmt(i.amount_paid)}</TableCell>
                          <TableCell className="font-semibold text-destructive">{fmt(i.total_amount - i.amount_paid)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {!isClosed && (
              <Card>
                <CardHeader><CardTitle>Confirm Closure</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="applySD" checked={applySD} onCheckedChange={(v) => setApplySD(v === true)} disabled={snapshot.sd <= 0} />
                    <Label htmlFor="applySD" className="cursor-pointer">
                      Apply Security Deposit ({fmt(sdApply)} of {fmt(snapshot.sd)}) against outstanding
                    </Label>
                  </div>
                  <div className="space-y-1">
                    <Label>Closure Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for closure, settlement details…" rows={3} />
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>This action freezes the dealer</AlertTitle>
                    <AlertDescription>
                      Once closed, no new sales orders, invoices, or receipts can be posted.
                      The SD ledger entry will be created if applied. This cannot be undone via the UI.
                    </AlertDescription>
                  </Alert>
                  <Button variant="destructive" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate()}>
                    {closeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Close Dealership
                  </Button>
                </CardContent>
              </Card>
            )}

            {history.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Closure History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Outstanding</TableHead><TableHead>Advance</TableHead><TableHead>SD Applied</TableHead><TableHead>Net</TableHead><TableHead>Notes</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {history.map((h: any) => (
                        <TableRow key={h.id}>
                          <TableCell>{h.closure_date}</TableCell>
                          <TableCell>{fmt(h.total_outstanding)}</TableCell>
                          <TableCell>{fmt(h.advance_balance)}</TableCell>
                          <TableCell>{fmt(h.sd_applied)}</TableCell>
                          <TableCell className="font-semibold">{fmt(h.net_settlement)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{h.notes || "—"}</TableCell>
                          <TableCell><Button size="sm" variant="outline" onClick={() => downloadStatement(h)}><FileDown className="h-4 w-4 mr-1" />PDF</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
