import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Ban } from "lucide-react";
import { toast } from "sonner";
import { calculateGST } from "@/lib/gst";
import { useVoidTransaction } from "@/hooks/useVoidTransaction";
import { VoidDialog } from "@/components/VoidDialog";
import { AlterButton } from "@/components/tally/AlterButton";
import { AlterReasonDialog } from "@/components/tally/AlterReasonDialog";

type ReturnItem = { product_id: string; batch_id: string; qty: number; rate: number; gst_rate: number; hsn_code: string };

export default function Returns() {
  const { user, hasRole, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ id: string; label: string } | null>(null);
  const [alterTarget, setAlterTarget] = useState<{ id: string; label: string } | null>(null);
  const [alteringFrom, setAlteringFrom] = useState<{ id: string; number: string; reason: string } | null>(null);

  const voidMutation = useVoidTransaction({ table: "credit_notes", invalidateKeys: [["credit-notes"]] });
  const canVoid = hasRole("admin") || hasRole("accounts");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);

  const { data: creditNotes = [], isLoading } = useQuery({
    queryKey: ["credit-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_notes").select("*, dealers(name), invoices(invoice_number)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-for-return"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, dealer_id, dealers(name, state_code)").neq("status", "void");
      return data || [];
    },
  });

  const { data: invoiceItems = [] } = useQuery({
    queryKey: ["invoice-items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data } = await supabase.from("invoice_items").select("*, products(name), product_batches(batch_no)").eq("invoice_id", invoiceId);
      return data || [];
    },
  });

  // Populate return items when invoice items load
  useEffect(() => {
    if (invoiceId && invoiceItems.length > 0 && items.length === 0) {
      setItems(invoiceItems.map((ii: any) => ({
        product_id: ii.product_id, batch_id: ii.batch_id, qty: 0,
        rate: Number(ii.rate), gst_rate: Number(ii.gst_rate), hsn_code: ii.hsn_code || "",
      })));
    }
  }, [invoiceId, invoiceItems, items.length]);

  const selectedInvoice = invoices.find((i: any) => i.id === invoiceId) as any;
  const dealerStateCode = selectedInvoice?.dealers?.state_code;

  const createReturn = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.qty > 0);
      if (!invoiceId || validItems.length === 0) throw new Error("Select invoice and return qty");

      // ALTER: void original CN first (restores stock + reverses ledger)
      if (alteringFrom) {
        const { error: vErr } = await supabase.rpc("void_credit_note_atomic" as any, {
          p_cn_id: alteringFrom.id,
          p_reason: `ALTER: ${alteringFrom.reason}`,
          p_voided_by: user?.id,
        });
        if (vErr) throw new Error("Could not void original credit note: " + vErr.message);
      }

      const computedItems = validItems.map((item) => {
        const amount = item.qty * item.rate;
        const gst = calculateGST(amount, item.gst_rate, dealerStateCode);
        return {
          product_id: item.product_id, batch_id: item.batch_id,
          hsn_code: item.hsn_code, qty: item.qty, rate: item.rate,
          amount, gst_rate: item.gst_rate,
          cgst_amount: gst.cgst, sgst_amount: gst.sgst,
          igst_amount: gst.igst, total_amount: gst.totalWithGst,
        };
      });

      const { data, error } = await supabase.rpc("create_credit_note_atomic" as any, {
        p_invoice_id: invoiceId,
        p_reason: reason,
        p_created_by: user?.id,
        p_items: computedItems,
      });
      if (error) throw error;

      if (alteringFrom && data) {
        const newCnId = (data as any).credit_note_id || (data as any).cn_id;
        const newCnNumber = (data as any).credit_note_number;
        await supabase.from("audit_logs" as any).insert({
          table_name: "credit_notes",
          record_id: alteringFrom.id,
          action: "ALTER",
          actor_user_id: user?.id,
          new_data: { alter_reason: alteringFrom.reason, replaced_by_id: newCnId, replaced_by_number: newCnNumber, strategy: "void+create" },
        });
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      const wasAlter = !!alteringFrom;
      setDialogOpen(false); setInvoiceId(""); setReason(""); setItems([]);
      setAlteringFrom(null);
      toast.success(wasAlter ? "Credit note altered — original voided, replacement created" : "Credit note created, stock restored");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startAlter = async (cnId: string) => {
    const { data: cn } = await supabase.from("credit_notes").select("*").eq("id", cnId).single();
    if (!cn) { toast.error("Credit note not found"); return; }
    const { data: cnItems } = await supabase.from("credit_note_items").select("*").eq("credit_note_id", cnId);
    setInvoiceId(cn.invoice_id);
    setReason(cn.reason || "");
    setItems((cnItems || []).map((it: any) => ({
      product_id: it.product_id, batch_id: it.batch_id,
      qty: Number(it.qty), rate: Number(it.rate),
      gst_rate: Number(it.gst_rate ?? 18), hsn_code: it.hsn_code || "",
    })));
    setDialogOpen(true);
  };

  const filtered = creditNotes.filter((cn: any) => {
    const s = search.toLowerCase();
    return cn.credit_note_number?.toLowerCase().includes(s) || cn.dealers?.name?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Sales Returns</h1><p className="text-muted-foreground">Process returns and credit notes</p></div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setInvoiceId(""); setItems([]); setReason(""); setAlteringFrom(null); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Return</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{alteringFrom ? `Alter Credit Note ${alteringFrom.number} → new` : "Create Credit Note"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createReturn.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Invoice *</Label>
                  <Select value={invoiceId} onValueChange={(v) => { setInvoiceId(v); setItems([]); }}>
                    <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                    <SelectContent>{invoices.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {i.dealers?.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {items.length > 0 && (
                  <div className="space-y-2">
                    <Label>Return Quantities</Label>
                    {items.map((item, i) => {
                      const ii = invoiceItems[i] as any;
                      return (
                        <div key={i} className="flex gap-3 items-center text-sm">
                          <span className="flex-1">{ii?.products?.name} (Batch: {ii?.product_batches?.batch_no}) — Invoiced: {ii?.qty}</span>
                          <Input type="number" className="w-20" min={0} max={Number(ii?.qty)} value={item.qty || ""} onChange={(e) => { const n = [...items]; n[i].qty = Number(e.target.value); setItems(n); }} placeholder="Return qty" />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-2"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={createReturn.isPending}>{createReturn.isPending ? "Processing..." : "Create Credit Note"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardHeader className="pb-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search credit notes..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No credit notes yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>CN #</TableHead><TableHead>Invoice</TableHead><TableHead>Dealer</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((cn: any) => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-medium">{cn.credit_note_number}</TableCell>
                      <TableCell>{cn.invoices?.invoice_number}</TableCell>
                      <TableCell>{cn.dealers?.name}</TableCell>
                      <TableCell>{cn.credit_date}</TableCell>
                      <TableCell>₹{Number(cn.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={cn.status === "void" ? "destructive" : "default"}>{cn.status || "active"}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{cn.reason || "—"}</TableCell>
                      <TableCell className="flex gap-1">
                        {isAdmin && cn.status !== "void" && (
                          <AlterButton onClick={() => setAlterTarget({ id: cn.id, label: cn.credit_note_number })} />
                        )}
                        {canVoid && cn.status !== "void" && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setVoidTarget({ id: cn.id, label: cn.credit_note_number })}><Ban className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <VoidDialog
        open={!!voidTarget}
        onOpenChange={(v) => { if (!v) setVoidTarget(null); }}
        onConfirm={(reason) => { if (voidTarget) voidMutation.mutate({ id: voidTarget.id, reason }, { onSuccess: () => setVoidTarget(null) }); }}
        isPending={voidMutation.isPending}
        title={`Credit Note ${voidTarget?.label || ""}`}
      />

      <AlterReasonDialog
        open={!!alterTarget}
        onOpenChange={(v) => { if (!v) setAlterTarget(null); }}
        title={`Credit Note ${alterTarget?.label || ""}`}
        onConfirm={(reason) => {
          if (!alterTarget) return;
          setAlteringFrom({ id: alterTarget.id, number: alterTarget.label, reason });
          startAlter(alterTarget.id);
          setAlterTarget(null);
        }}
      />
    </DashboardLayout>
  );
}
