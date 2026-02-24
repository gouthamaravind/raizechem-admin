import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, Download, Printer, Ban } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { calculateGST } from "@/lib/gst";
import { useVoidTransaction } from "@/hooks/useVoidTransaction";
import { VoidDialog } from "@/components/VoidDialog";

type InvItem = { product_id: string; batch_id: string; qty: number; rate: number; gst_rate: number; hsn_code: string };

function getFinancialYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return String(year);
}

export default function Invoices() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ id: string; label: string } | null>(null);

  const voidMutation = useVoidTransaction({
    table: "invoices",
    invalidateKeys: [["invoices"], ["outstanding-invoices"]],
  });
  const canVoid = hasRole("admin") || hasRole("accounts");
  const [dealerId, setDealerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<InvItem[]>([{ product_id: "", batch_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "" }]);
  // E-way bill fields
  const [transportMode, setTransportMode] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [dispatchFrom, setDispatchFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, dealers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list"], queryFn: async () => { const { data } = await supabase.from("dealers").select("id, name, state_code, payment_terms_days").eq("status", "active").order("name"); return data || []; } });
  const { data: products = [] } = useQuery({ queryKey: ["products-list"], queryFn: async () => { const { data } = await supabase.from("products").select("id, name, sale_price, gst_rate, hsn_code, unit").eq("is_active", true).order("name"); return data || []; } });
  const { data: batches = [] } = useQuery({ queryKey: ["batches-available"], queryFn: async () => { const { data } = await supabase.from("product_batches").select("id, product_id, batch_no, current_qty").gt("current_qty", 0); return data || []; } });
  const { data: companySettings } = useQuery({ queryKey: ["company-settings-inv"], queryFn: async () => { const { data } = await supabase.from("company_settings").select("invoice_series, next_invoice_number").limit(1).single(); return data; } });

  const selectedDealer = dealers.find((d: any) => d.id === dealerId) as any;

  const computedItems = items.map((item) => {
    const amount = item.qty * item.rate;
    const gst = calculateGST(amount, item.gst_rate, selectedDealer?.state_code);
    return { ...item, amount, ...gst };
  });
  const subtotal = computedItems.reduce((s, i) => s + i.amount, 0);
  const cgstTotal = computedItems.reduce((s, i) => s + i.cgst, 0);
  const sgstTotal = computedItems.reduce((s, i) => s + i.sgst, 0);
  const igstTotal = computedItems.reduce((s, i) => s + i.igst, 0);
  const grandTotal = subtotal + cgstTotal + sgstTotal + igstTotal;

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!dealerId) throw new Error("Select dealer");
      const validItems = computedItems.filter((i) => i.product_id && i.batch_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid item with batch");

      for (const item of validItems) {
        const batch = batches.find((b: any) => b.id === item.batch_id) as any;
        if (!batch || Number(batch.current_qty) < item.qty) throw new Error(`Insufficient stock for batch ${batch?.batch_no || item.batch_id}`);
      }

      // Generate invoice number: PREFIX/YYYY/001
      const prefix = (companySettings as any)?.invoice_series || "RC";
      const nextNum = (companySettings as any)?.next_invoice_number || 1;
      const fy = getFinancialYear();
      const invNum = `${prefix}/${fy}/${String(nextNum).padStart(3, "0")}`;

      const dueDate = selectedDealer?.payment_terms_days
        ? new Date(Date.now() + Number(selectedDealer.payment_terms_days) * 86400000).toISOString().split("T")[0]
        : null;

      const placeOfSupply = selectedDealer?.state_code === "36" ? "Telangana" : (selectedDealer?.state || "");

      const { data: inv, error } = await supabase.from("invoices").insert({
        invoice_number: invNum, dealer_id: dealerId, invoice_date: invoiceDate,
        due_date: dueDate, subtotal, cgst_total: cgstTotal, sgst_total: sgstTotal,
        igst_total: igstTotal, total_amount: grandTotal, created_by: user?.id,
        transport_mode: transportMode || null, vehicle_no: vehicleNo || null,
        dispatch_from: dispatchFrom || null, delivery_to: deliveryTo || null,
        place_of_supply: placeOfSupply || null,
      } as any).select("id").single();
      if (error) throw error;

      // Increment invoice number
      await supabase.from("company_settings").update({ next_invoice_number: nextNum + 1 } as any).not("id", "is", null);

      const invItems = validItems.map((i) => ({
        invoice_id: inv.id, product_id: i.product_id, batch_id: i.batch_id,
        hsn_code: i.hsn_code, qty: i.qty, rate: i.rate, amount: i.amount,
        gst_rate: i.gst_rate, cgst_amount: i.cgst, sgst_amount: i.sgst,
        igst_amount: i.igst, total_amount: i.totalWithGst,
      }));
      const { error: itemErr } = await supabase.from("invoice_items").insert(invItems);
      if (itemErr) throw itemErr;

      for (const item of validItems) {
        const batch = batches.find((b: any) => b.id === item.batch_id) as any;
        await supabase.from("product_batches").update({ current_qty: Number(batch.current_qty) - item.qty }).eq("id", item.batch_id);
        await supabase.from("inventory_txn").insert({
          txn_type: "SALE" as any, ref_type: "invoice", ref_id: inv.id,
          product_id: item.product_id, batch_id: item.batch_id,
          qty_in: 0, qty_out: item.qty, rate: item.rate, created_by: user?.id,
        });
      }

      await supabase.from("ledger_entries").insert({
        dealer_id: dealerId, entry_date: invoiceDate, entry_type: "invoice",
        ref_id: inv.id, description: `Invoice ${invNum}`, debit: grandTotal, credit: 0,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-available"] });
      qc.invalidateQueries({ queryKey: ["company-settings-inv"] });
      setDialogOpen(false); setDealerId("");
      setItems([{ product_id: "", batch_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "" }]);
      setTransportMode(""); setVehicleNo(""); setDispatchFrom(""); setDeliveryTo("");
      toast.success("Invoice created with GST and ledger entry");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => setItems([...items, { product_id: "", batch_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };

  const filtered = invoices.filter((inv: any) => {
    const s = search.toLowerCase();
    return inv.invoice_number?.toLowerCase().includes(s) || inv.dealers?.name?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Invoices</h1><p className="text-muted-foreground">GST-compliant invoicing</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("invoices.csv", filtered.map((i: any) => ({ invoice_number: i.invoice_number, dealer: i.dealers?.name, date: i.invoice_date, subtotal: i.subtotal, cgst: i.cgst_total, sgst: i.sgst_total, igst: i.igst_total, total: i.total_amount, paid: i.amount_paid, status: i.status })), [{ key: "invoice_number", label: "Invoice #" }, { key: "dealer", label: "Dealer" }, { key: "date", label: "Date" }, { key: "subtotal", label: "Subtotal" }, { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" }, { key: "igst", label: "IGST" }, { key: "total", label: "Total" }, { key: "paid", label: "Paid" }, { key: "status", label: "Status" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Invoice</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createInvoice.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Dealer *</Label>
                      <Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
                    {selectedDealer && <div className="space-y-2"><Label>GST Type</Label><p className="text-sm font-medium pt-2">{selectedDealer.state_code === "36" ? "Intra-state (CGST+SGST)" : "Inter-state (IGST)"}</p></div>}
                  </div>
                  <div className="space-y-2">
                    <Label>Line Items (select batch for each)</Label>
                    {items.map((item, i) => {
                      const productBatches = batches.filter((b: any) => b.product_id === item.product_id);
                      return (
                        <div key={i} className="flex gap-2 items-end flex-wrap">
                          <Select value={item.product_id} onValueChange={(v) => {
                            const p = products.find((p: any) => p.id === v) as any;
                            updateItem(i, "product_id", v);
                            if (p) { updateItem(i, "rate", Number(p.sale_price) || 0); updateItem(i, "gst_rate", Number(p.gst_rate)); updateItem(i, "hsn_code", p.hsn_code || ""); }
                          }}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={item.batch_id} onValueChange={(v) => updateItem(i, "batch_id", v)}>
                            <SelectTrigger className="w-36"><SelectValue placeholder="Batch" /></SelectTrigger>
                            <SelectContent>{productBatches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_no} (Qty: {b.current_qty})</SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="number" className="w-16" placeholder="Qty" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} />
                          <Input type="number" className="w-24" placeholder="Rate" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} />
                          <span className="text-xs w-20">₹{(item.qty * item.rate).toFixed(2)}</span>
                          {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Item</Button>
                  </div>
                  {/* E-way Bill Fields */}
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-muted-foreground">E-Way Bill Details (optional)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Transport Mode</Label>
                        <Select value={transportMode} onValueChange={setTransportMode}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="road">Road</SelectItem><SelectItem value="rail">Rail</SelectItem><SelectItem value="air">Air</SelectItem><SelectItem value="ship">Ship</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">Vehicle No</Label><Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. TS09AB1234" /></div>
                      <div className="space-y-1"><Label className="text-xs">Dispatch From</Label><Input value={dispatchFrom} onChange={(e) => setDispatchFrom(e.target.value)} placeholder="City, State" /></div>
                      <div className="space-y-1"><Label className="text-xs">Delivery To</Label><Input value={deliveryTo} onChange={(e) => setDeliveryTo(e.target.value)} placeholder="City, State" /></div>
                    </div>
                  </div>
                  <div className="border-t pt-3 space-y-1 text-sm text-right">
                    <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
                    {cgstTotal > 0 && <p>CGST: ₹{cgstTotal.toFixed(2)}</p>}
                    {sgstTotal > 0 && <p>SGST: ₹{sgstTotal.toFixed(2)}</p>}
                    {igstTotal > 0 && <p>IGST: ₹{igstTotal.toFixed(2)}</p>}
                    <p className="text-lg font-bold">Grand Total: ₹{grandTotal.toFixed(2)}</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={createInvoice.isPending}>{createInvoice.isPending ? "Creating..." : "Create Invoice"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search invoices..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No invoices yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Dealer</TableHead><TableHead>Date</TableHead><TableHead>Subtotal</TableHead><TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>IGST</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.dealers?.name}</TableCell>
                      <TableCell>{inv.invoice_date}</TableCell>
                      <TableCell>₹{Number(inv.subtotal).toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{Number(inv.cgst_total).toFixed(2)}</TableCell>
                      <TableCell>₹{Number(inv.sgst_total).toFixed(2)}</TableCell>
                      <TableCell>₹{Number(inv.igst_total).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={inv.status === "void" ? "destructive" : inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/sales/invoices/${inv.id}/print`)}><Printer className="h-4 w-4" /></Button>
                        {canVoid && inv.status !== "void" && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setVoidTarget({ id: inv.id, label: inv.invoice_number })}><Ban className="h-4 w-4" /></Button>
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
        title={`Invoice ${voidTarget?.label || ""}`}
      />
    </DashboardLayout>
  );
}
