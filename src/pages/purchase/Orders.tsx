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
import { Search, Plus, Trash2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { useNavigate } from "react-router-dom";

type LineItem = { product_id: string; qty: number; rate: number };

export default function PurchaseOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ product_id: "", qty: 1, rate: 0 }]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-list"], queryFn: async () => { const { data } = await supabase.from("suppliers").select("id, name").eq("status", "active").order("name"); return data || []; } });
  const { data: products = [] } = useQuery({ queryKey: ["products-list"], queryFn: async () => { const { data } = await supabase.from("products").select("id, name, purchase_price_default, unit").eq("is_active", true).order("name"); return data || []; } });

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!supplierId || items.length === 0) throw new Error("Select supplier and add items");
      const validItems = items.filter((i) => i.product_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid item");

      const p_items = validItems.map((i) => ({
        product_id: i.product_id,
        qty: i.qty,
        rate: i.rate,
      }));

      const { data, error } = await supabase.rpc("create_po_atomic" as any, {
        p_supplier_id: supplierId,
        p_notes: notes || null,
        p_created_by: user?.id,
        p_items: p_items,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      setDialogOpen(false); setSupplierId(""); setNotes(""); setItems([{ product_id: "", qty: 1, rate: 0 }]);
      toast.success("Purchase order created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  const handleConvertToPI = (order: any) => {
    navigate("/purchase/invoices", { state: { convertPO: order } });
  };

  const filtered = orders.filter((o: any) => {
    const s = search.toLowerCase();
    const match = o.po_number?.toLowerCase().includes(s) || o.suppliers?.name?.toLowerCase().includes(s);
    return match && (statusFilter === "all" || o.status === statusFilter);
  });

  const addItem = () => setItems([...items, { product_id: "", qty: 1, rate: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: any) => { const n = [...items]; (n[i] as any)[field] = val; setItems(n); };

  const statusColors: Record<string, string> = { draft: "secondary", confirmed: "default", received: "default", cancelled: "destructive" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1><p className="text-muted-foreground">Manage purchase orders to suppliers</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("purchase-orders.csv", filtered.map((o: any) => ({ po_number: o.po_number, supplier: o.suppliers?.name, date: o.po_date, status: o.status, total: o.total_amount })), [{ key: "po_number", label: "PO #" }, { key: "supplier", label: "Supplier" }, { key: "date", label: "Date" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New PO</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createOrder.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Supplier *</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Line Items</Label>
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 items-end">
                        <Select value={item.product_id} onValueChange={(v) => { updateItem(i, "product_id", v); const p = products.find((p: any) => p.id === v); if (p) updateItem(i, "rate", Number((p as any).purchase_price_default) || 0); }}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                          <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" className="w-20" placeholder="Qty" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} />
                        <Input type="number" className="w-28" placeholder="Rate" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} />
                        <span className="text-sm w-24 text-right">₹{(item.qty * item.rate).toLocaleString("en-IN")}</span>
                        {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Item</Button>
                  </div>
                  <div className="text-right font-semibold">Total: ₹{items.reduce((s, i) => s + i.qty * i.rate, 0).toLocaleString("en-IN")}</div>
                  <Button type="submit" className="w-full" disabled={createOrder.isPending}>{createOrder.isPending ? "Creating..." : "Create PO"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search purchase orders..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No purchase orders found.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.po_number}</TableCell>
                      <TableCell>{o.suppliers?.name}</TableCell>
                      <TableCell>{o.po_date}</TableCell>
                      <TableCell>₹{Number(o.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={statusColors[o.status] as any}>{o.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {o.status === "draft" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: o.id, status: "confirmed" })}>Confirm</Button>}
                          {o.status === "confirmed" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: o.id, status: "received" })}>Received</Button>
                              <Button size="sm" variant="default" onClick={() => handleConvertToPI(o)} title="Convert to Purchase Invoice"><FileText className="h-3.5 w-3.5 mr-1" />Invoice</Button>
                            </>
                          )}
                        </div>
                      </TableCell>
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
