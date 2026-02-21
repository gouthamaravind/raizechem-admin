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
import { Search, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { calculateGST } from "@/lib/gst";

type PIItem = { product_id: string; qty: number; rate: number; gst_rate: number; hsn_code: string; batch_no: string; mfg_date: string; exp_date: string };

export default function PurchaseInvoices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [piNumber, setPiNumber] = useState("");
  const [piDate, setPiDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<PIItem[]>([{ product_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "", batch_no: "", mfg_date: "", exp_date: "" }]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_invoices").select("*, suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-list"], queryFn: async () => { const { data } = await supabase.from("suppliers").select("id, name, state_code").eq("status", "active").order("name"); return data || []; } });
  const { data: products = [] } = useQuery({ queryKey: ["products-list"], queryFn: async () => { const { data } = await supabase.from("products").select("id, name, purchase_price_default, gst_rate, hsn_code, unit").eq("is_active", true).order("name"); return data || []; } });

  const selectedSupplier = suppliers.find((s: any) => s.id === supplierId) as any;

  const computedItems = items.map((item) => {
    const amount = item.qty * item.rate;
    const gst = calculateGST(amount, item.gst_rate, selectedSupplier?.state_code);
    return { ...item, amount, ...gst };
  });
  const subtotal = computedItems.reduce((s, i) => s + i.amount, 0);
  const cgstTotal = computedItems.reduce((s, i) => s + i.cgst, 0);
  const sgstTotal = computedItems.reduce((s, i) => s + i.sgst, 0);
  const igstTotal = computedItems.reduce((s, i) => s + i.igst, 0);
  const grandTotal = subtotal + cgstTotal + sgstTotal + igstTotal;

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!supplierId || !piNumber) throw new Error("Select supplier and enter invoice number");
      const validItems = computedItems.filter((i) => i.product_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid item");

      // Create purchase invoice
      const { data: pi, error } = await supabase.from("purchase_invoices").insert({
        pi_number: piNumber, supplier_id: supplierId, pi_date: piDate,
        subtotal, cgst_total: cgstTotal, sgst_total: sgstTotal,
        igst_total: igstTotal, total_amount: grandTotal, created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      // For each item: create batch, then insert PI item with batch_id, then inventory txn
      for (const item of validItems) {
        // Create product batch (auto stock-in)
        const { data: batch, error: batchErr } = await supabase.from("product_batches").insert({
          product_id: item.product_id,
          batch_no: item.batch_no || `B-${Date.now().toString(36).toUpperCase()}`,
          current_qty: item.qty,
          purchase_rate: item.rate,
          mfg_date: item.mfg_date || null,
          exp_date: item.exp_date || null,
          created_by: user?.id,
        }).select("id").single();
        if (batchErr) throw batchErr;

        // Insert PI item
        await supabase.from("purchase_invoice_items").insert({
          purchase_invoice_id: pi.id, product_id: item.product_id, batch_id: batch.id,
          hsn_code: item.hsn_code, qty: item.qty, rate: item.rate, amount: item.amount,
          gst_rate: item.gst_rate, cgst_amount: item.cgst, sgst_amount: item.sgst,
          igst_amount: item.igst, total_amount: item.totalWithGst,
        });

        // Inventory transaction
        await supabase.from("inventory_txn").insert({
          txn_type: "PURCHASE" as any, ref_type: "purchase_invoice", ref_id: pi.id,
          product_id: item.product_id, batch_id: batch.id,
          qty_in: item.qty, qty_out: 0, rate: item.rate, created_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      setDialogOpen(false); setSupplierId(""); setPiNumber("");
      setItems([{ product_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "", batch_no: "", mfg_date: "", exp_date: "" }]);
      toast.success("Purchase invoice created — stock added automatically");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => setItems([...items, { product_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "", batch_no: "", mfg_date: "", exp_date: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };

  const filtered = invoices.filter((inv: any) => {
    const s = search.toLowerCase();
    return inv.pi_number?.toLowerCase().includes(s) || inv.suppliers?.name?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Purchase Invoices</h1><p className="text-muted-foreground">Record purchases with GST — auto stock-in</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("purchase-invoices.csv", filtered.map((i: any) => ({ pi_number: i.pi_number, supplier: i.suppliers?.name, date: i.pi_date, subtotal: i.subtotal, cgst: i.cgst_total, sgst: i.sgst_total, igst: i.igst_total, total: i.total_amount, status: i.status })), [{ key: "pi_number", label: "PI #" }, { key: "supplier", label: "Supplier" }, { key: "date", label: "Date" }, { key: "subtotal", label: "Subtotal" }, { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" }, { key: "igst", label: "IGST" }, { key: "total", label: "Total" }, { key: "status", label: "Status" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Purchase Invoice</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Purchase Invoice</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createInvoice.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Supplier *</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2"><Label>Invoice Number *</Label><Input required value={piNumber} onChange={(e) => setPiNumber(e.target.value)} placeholder="Supplier invoice #" /></div>
                    <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={piDate} onChange={(e) => setPiDate(e.target.value)} /></div>
                  </div>
                  {selectedSupplier && <p className="text-sm text-muted-foreground">GST: {selectedSupplier.state_code === "36" ? "Intra-state (CGST+SGST)" : "Inter-state (IGST)"}</p>}
                  <div className="space-y-2">
                    <Label>Line Items (batch auto-created per item)</Label>
                    {items.map((item, i) => (
                      <div key={i} className="space-y-2 border rounded-lg p-3">
                        <div className="flex gap-2 items-end">
                          <Select value={item.product_id} onValueChange={(v) => {
                            const p = products.find((p: any) => p.id === v) as any;
                            updateItem(i, "product_id", v);
                            if (p) { updateItem(i, "rate", Number(p.purchase_price_default) || 0); updateItem(i, "gst_rate", Number(p.gst_rate)); updateItem(i, "hsn_code", p.hsn_code || ""); }
                          }}>
                            <SelectTrigger className="w-44"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="number" className="w-16" placeholder="Qty" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} />
                          <Input type="number" className="w-24" placeholder="Rate" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} />
                          <span className="text-xs w-20">₹{(item.qty * item.rate).toFixed(2)}</span>
                          {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                        <div className="flex gap-2">
                          <Input className="w-32" placeholder="Batch No" value={item.batch_no} onChange={(e) => updateItem(i, "batch_no", e.target.value)} />
                          <Input type="date" className="w-36" value={item.mfg_date} onChange={(e) => updateItem(i, "mfg_date", e.target.value)} title="Mfg Date" />
                          <Input type="date" className="w-36" value={item.exp_date} onChange={(e) => updateItem(i, "exp_date", e.target.value)} title="Exp Date" />
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Item</Button>
                  </div>
                  <div className="border-t pt-3 space-y-1 text-sm text-right">
                    <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
                    {cgstTotal > 0 && <p>CGST: ₹{cgstTotal.toFixed(2)}</p>}
                    {sgstTotal > 0 && <p>SGST: ₹{sgstTotal.toFixed(2)}</p>}
                    {igstTotal > 0 && <p>IGST: ₹{igstTotal.toFixed(2)}</p>}
                    <p className="text-lg font-bold">Grand Total: ₹{grandTotal.toFixed(2)}</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={createInvoice.isPending}>{createInvoice.isPending ? "Creating..." : "Create Purchase Invoice"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search purchase invoices..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No purchase invoices yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>PI #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Subtotal</TableHead><TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>IGST</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.pi_number}</TableCell>
                      <TableCell>{inv.suppliers?.name}</TableCell>
                      <TableCell>{inv.pi_date}</TableCell>
                      <TableCell>₹{Number(inv.subtotal).toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{Number(inv.cgst_total).toFixed(2)}</TableCell>
                      <TableCell>₹{Number(inv.sgst_total).toFixed(2)}</TableCell>
                      <TableCell>₹{Number(inv.igst_total).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge></TableCell>
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
