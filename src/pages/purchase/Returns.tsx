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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Ban } from "lucide-react";
import { toast } from "sonner";
import { calculateGST } from "@/lib/gst";
import { useVoidTransaction } from "@/hooks/useVoidTransaction";
import { VoidDialog } from "@/components/VoidDialog";

type ReturnItem = { product_id: string; batch_id: string; qty: number; rate: number; gst_rate: number; hsn_code: string };

export default function PurchaseReturns() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ id: string; label: string } | null>(null);

  const voidMutation = useVoidTransaction({
    table: "debit_notes",
    invalidateKeys: [["debit-notes"]],
  });
  const canVoid = hasRole("admin") || hasRole("accounts");
  const [piId, setPiId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);

  const { data: debitNotes = [], isLoading } = useQuery({
    queryKey: ["debit-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("debit_notes").select("*, suppliers(name), purchase_invoices(pi_number)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ["pi-for-return"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_invoices").select("id, pi_number, supplier_id, suppliers(name, state_code)").eq("status", "received");
      return data || [];
    },
  });

  const { data: piItems = [] } = useQuery({
    queryKey: ["pi-items", piId],
    enabled: !!piId,
    queryFn: async () => {
      const { data } = await supabase.from("purchase_invoice_items").select("*, products(name), product_batches(batch_no)").eq("purchase_invoice_id", piId);
      return data || [];
    },
  });

  // Populate return items when PI items load
  if (piId && piItems.length > 0 && items.length === 0) {
    setItems(piItems.map((ii: any) => ({
      product_id: ii.product_id, batch_id: ii.batch_id, qty: 0,
      rate: Number(ii.rate), gst_rate: Number(ii.gst_rate), hsn_code: ii.hsn_code || "",
    })));
  }

  const selectedPI = purchaseInvoices.find((i: any) => i.id === piId) as any;
  const supplierStateCode = selectedPI?.suppliers?.state_code;

  const createReturn = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.qty > 0);
      if (!piId || validItems.length === 0) throw new Error("Select invoice and return qty");

      const computedItems = validItems.map((item) => {
        const amount = item.qty * item.rate;
        const gst = calculateGST(amount, item.gst_rate, supplierStateCode);
        return { ...item, amount, ...gst };
      });

      const subtotal = computedItems.reduce((s, i) => s + i.amount, 0);
      const cgstTotal = computedItems.reduce((s, i) => s + i.cgst, 0);
      const sgstTotal = computedItems.reduce((s, i) => s + i.sgst, 0);
      const igstTotal = computedItems.reduce((s, i) => s + i.igst, 0);
      const total = subtotal + cgstTotal + sgstTotal + igstTotal;

      const dnNum = `DN/${Date.now().toString(36).toUpperCase()}`;
      const { data: dn, error } = await supabase.from("debit_notes").insert({
        debit_note_number: dnNum, purchase_invoice_id: piId, supplier_id: selectedPI.supplier_id,
        subtotal, cgst_total: cgstTotal, sgst_total: sgstTotal, igst_total: igstTotal,
        total_amount: total, reason, created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      const dnItems = computedItems.map((i) => ({
        debit_note_id: dn.id, product_id: i.product_id, batch_id: i.batch_id,
        hsn_code: i.hsn_code, qty: i.qty, rate: i.rate, amount: i.amount,
        gst_rate: i.gst_rate, cgst_amount: i.cgst, sgst_amount: i.sgst,
        igst_amount: i.igst, total_amount: i.totalWithGst,
      }));
      await supabase.from("debit_note_items").insert(dnItems);

      // Reverse stock (reduce batch qty) + inventory txn
      for (const item of computedItems) {
        const { data: batch } = await supabase.from("product_batches").select("current_qty").eq("id", item.batch_id).single();
        if (batch) {
          await supabase.from("product_batches").update({ current_qty: Math.max(0, Number(batch.current_qty) - item.qty) }).eq("id", item.batch_id);
        }
        await supabase.from("inventory_txn").insert({
          txn_type: "ADJUSTMENT" as any, ref_type: "debit_note", ref_id: dn.id,
          product_id: item.product_id, batch_id: item.batch_id,
          qty_in: 0, qty_out: item.qty, rate: item.rate, created_by: user?.id,
          notes: `Purchase return - ${dnNum}`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debit-notes"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      setDialogOpen(false); setPiId(""); setReason(""); setItems([]);
      toast.success("Debit note created, stock reversed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = debitNotes.filter((dn: any) => {
    const s = search.toLowerCase();
    return dn.debit_note_number?.toLowerCase().includes(s) || dn.suppliers?.name?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Purchase Returns</h1><p className="text-muted-foreground">Process returns and debit notes</p></div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setPiId(""); setItems([]); setReason(""); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Return</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Debit Note</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createReturn.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Purchase Invoice *</Label>
                  <Select value={piId} onValueChange={(v) => { setPiId(v); setItems([]); }}>
                    <SelectTrigger><SelectValue placeholder="Select purchase invoice" /></SelectTrigger>
                    <SelectContent>{purchaseInvoices.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.pi_number} — {i.suppliers?.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {items.length > 0 && (
                  <div className="space-y-2">
                    <Label>Return Quantities</Label>
                    {items.map((item, i) => {
                      const ii = piItems[i] as any;
                      return (
                        <div key={i} className="flex gap-3 items-center text-sm">
                          <span className="flex-1">{ii?.products?.name} (Batch: {ii?.product_batches?.batch_no}) — Purchased: {ii?.qty}</span>
                          <Input type="number" className="w-20" min={0} max={Number(ii?.qty)} value={item.qty || ""} onChange={(e) => { const n = [...items]; n[i].qty = Number(e.target.value); setItems(n); }} placeholder="Return qty" />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-2"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={createReturn.isPending}>{createReturn.isPending ? "Processing..." : "Create Debit Note"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardHeader className="pb-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search debit notes..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No debit notes yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>DN #</TableHead><TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((dn: any) => (
                    <TableRow key={dn.id}>
                      <TableCell className="font-medium">{dn.debit_note_number}</TableCell>
                      <TableCell>{dn.purchase_invoices?.pi_number}</TableCell>
                      <TableCell>{dn.suppliers?.name}</TableCell>
                      <TableCell>{dn.debit_date}</TableCell>
                      <TableCell>₹{Number(dn.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={dn.status === "void" ? "destructive" : "default"}>{dn.status || "active"}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{dn.reason || "—"}</TableCell>
                      <TableCell>
                        {canVoid && dn.status !== "void" && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setVoidTarget({ id: dn.id, label: dn.debit_note_number })}><Ban className="h-4 w-4" /></Button>
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
        title={`Debit Note ${voidTarget?.label || ""}`}
      />
    </DashboardLayout>
  );
}
