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
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { calculateGST } from "@/lib/gst";

type ReturnItem = { product_id: string; batch_id: string; qty: number; rate: number; gst_rate: number; hsn_code: string };

export default function Returns() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
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
      const { data } = await supabase.from("invoices").select("id, invoice_number, dealer_id, dealers(name, state_code)").eq("status", "issued");
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

  const loadInvoiceItems = (invId: string) => {
    setInvoiceId(invId);
    // Items will be loaded via query, user picks qty to return
  };

  // When invoiceItems load, populate return items
  const populateItems = () => {
    if (invoiceItems.length > 0 && items.length === 0) {
      setItems(invoiceItems.map((ii: any) => ({
        product_id: ii.product_id, batch_id: ii.batch_id, qty: 0,
        rate: Number(ii.rate), gst_rate: Number(ii.gst_rate), hsn_code: ii.hsn_code || "",
      })));
    }
  };
  if (invoiceId && invoiceItems.length > 0 && items.length === 0) populateItems();

  const selectedInvoice = invoices.find((i: any) => i.id === invoiceId) as any;
  const dealerStateCode = selectedInvoice?.dealers?.state_code;

  const createReturn = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.qty > 0);
      if (!invoiceId || validItems.length === 0) throw new Error("Select invoice and return qty");

      const inv = selectedInvoice;
      const computedItems = validItems.map((item) => {
        const amount = item.qty * item.rate;
        const gst = calculateGST(amount, item.gst_rate, dealerStateCode);
        return { ...item, amount, ...gst };
      });

      const subtotal = computedItems.reduce((s, i) => s + i.amount, 0);
      const cgstTotal = computedItems.reduce((s, i) => s + i.cgst, 0);
      const sgstTotal = computedItems.reduce((s, i) => s + i.sgst, 0);
      const igstTotal = computedItems.reduce((s, i) => s + i.igst, 0);
      const total = subtotal + cgstTotal + sgstTotal + igstTotal;

      const cnNum = `CN/${Date.now().toString(36).toUpperCase()}`;
      const { data: cn, error } = await supabase.from("credit_notes").insert({
        credit_note_number: cnNum, invoice_id: invoiceId, dealer_id: inv.dealer_id,
        subtotal, cgst_total: cgstTotal, sgst_total: sgstTotal, igst_total: igstTotal,
        total_amount: total, reason, created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      const cnItems = computedItems.map((i) => ({
        credit_note_id: cn.id, product_id: i.product_id, batch_id: i.batch_id,
        hsn_code: i.hsn_code, qty: i.qty, rate: i.rate, amount: i.amount,
        gst_rate: i.gst_rate, cgst_amount: i.cgst, sgst_amount: i.sgst,
        igst_amount: i.igst, total_amount: i.totalWithGst,
      }));
      await supabase.from("credit_note_items").insert(cnItems);

      // Add stock back + inventory txn
      for (const item of computedItems) {
        const { data: batch } = await supabase.from("product_batches").select("current_qty").eq("id", item.batch_id).single();
        if (batch) {
          await supabase.from("product_batches").update({ current_qty: Number(batch.current_qty) + item.qty }).eq("id", item.batch_id);
        }
        await supabase.from("inventory_txn").insert({
          txn_type: "SALE_RETURN" as any, ref_type: "credit_note", ref_id: cn.id,
          product_id: item.product_id, batch_id: item.batch_id,
          qty_in: item.qty, qty_out: 0, rate: item.rate, created_by: user?.id,
        });
      }

      // Ledger entry (credit)
      await supabase.from("ledger_entries").insert({
        dealer_id: inv.dealer_id, entry_type: "credit_note", ref_id: cn.id,
        description: `Credit Note ${cnNum}`, debit: 0, credit: total,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      setDialogOpen(false); setInvoiceId(""); setReason(""); setItems([]);
      toast.success("Credit note created, stock restored");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = creditNotes.filter((cn: any) => {
    const s = search.toLowerCase();
    return cn.credit_note_number?.toLowerCase().includes(s) || cn.dealers?.name?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Sales Returns</h1><p className="text-muted-foreground">Process returns and credit notes</p></div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setInvoiceId(""); setItems([]); setReason(""); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Return</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Credit Note</DialogTitle></DialogHeader>
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
                <TableHeader><TableRow><TableHead>CN #</TableHead><TableHead>Invoice</TableHead><TableHead>Dealer</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((cn: any) => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-medium">{cn.credit_note_number}</TableCell>
                      <TableCell>{cn.invoices?.invoice_number}</TableCell>
                      <TableCell>{cn.dealers?.name}</TableCell>
                      <TableCell>{cn.credit_date}</TableCell>
                      <TableCell>₹{Number(cn.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{cn.reason || "—"}</TableCell>
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
