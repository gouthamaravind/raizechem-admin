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

export default function Orders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dealerId, setDealerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ product_id: "", qty: 1, rate: 0 }]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, dealers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list"], queryFn: async () => { const { data } = await supabase.from("dealers").select("id, name, price_level_id").eq("status", "active").order("name"); return data || []; } });
  const { data: products = [] } = useQuery({ queryKey: ["products-list"], queryFn: async () => { const { data } = await supabase.from("products").select("id, name, sale_price, unit").eq("is_active", true).order("name"); return data || []; } });
  const { data: priceLevelPrices = [] } = useQuery({ queryKey: ["price-level-prices"], queryFn: async () => { const { data } = await supabase.from("product_price_levels").select("product_id, price_level_id, price"); return data || []; } });
  const selectedDealer = dealers.find((d: any) => d.id === dealerId) as any;

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!dealerId || items.length === 0) throw new Error("Select dealer and add items");
      const validItems = items.filter((i) => i.product_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid item");

      const total = validItems.reduce((s, i) => s + i.qty * i.rate, 0);

      // Get sequential order number
      const { data: settings } = await supabase.from("company_settings").select("next_order_number, id").limit(1).single();
      const nextNum = settings?.next_order_number || 1;
      const orderNum = `ORD/${new Date().getFullYear()}/${String(nextNum).padStart(3, "0")}`;

      const { data: order, error } = await supabase.from("orders").insert({
        order_number: orderNum, dealer_id: dealerId, total_amount: total,
        notes, created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      // Increment order number
      await supabase.from("company_settings").update({ next_order_number: nextNum + 1 } as any).eq("id", settings?.id as any);

      const orderItems = validItems.map((i) => ({
        order_id: order.id, product_id: i.product_id, qty: i.qty,
        rate: i.rate, amount: i.qty * i.rate,
      }));
      const { error: itemErr } = await supabase.from("order_items").insert(orderItems);
      if (itemErr) throw itemErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setDialogOpen(false); setDealerId(""); setNotes(""); setItems([{ product_id: "", qty: 1, rate: 0 }]);
      toast.success("Order created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const handleConvertToInvoice = (order: any) => {
    // Navigate to invoices page with order data in state
    navigate("/sales/invoices", { state: { convertOrder: order } });
  };

  const filtered = orders.filter((o: any) => {
    const s = search.toLowerCase();
    const match = o.order_number?.toLowerCase().includes(s) || o.dealers?.name?.toLowerCase().includes(s);
    return match && (statusFilter === "all" || o.status === statusFilter);
  });

  const addItem = () => setItems([...items, { product_id: "", qty: 1, rate: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: any) => { const n = [...items]; (n[i] as any)[field] = val; setItems(n); };

  const statusColors: Record<string, string> = { draft: "secondary", confirmed: "default", dispatched: "outline", delivered: "default", cancelled: "destructive" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Orders</h1><p className="text-muted-foreground">Manage sales orders</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("orders.csv", filtered.map((o: any) => ({ order_number: o.order_number, dealer: o.dealers?.name, date: o.order_date, status: o.status, total: o.total_amount })), [{ key: "order_number", label: "Order #" }, { key: "dealer", label: "Dealer" }, { key: "date", label: "Date" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Order</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Order</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createOrder.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dealer *</Label>
                      <Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger><SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Line Items</Label>
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 items-end">
                        <Select value={item.product_id} onValueChange={(v) => { updateItem(i, "product_id", v); const p = products.find((p: any) => p.id === v); if (p) { const plId = selectedDealer?.price_level_id; const plPrice = plId ? priceLevelPrices.find((pp: any) => pp.product_id === v && pp.price_level_id === plId) : null; updateItem(i, "rate", plPrice ? Number(plPrice.price) : (Number((p as any).sale_price) || 0)); } }}>
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
                  <Button type="submit" className="w-full" disabled={createOrder.isPending}>{createOrder.isPending ? "Creating..." : "Create Order"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search orders..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="confirmed">Confirmed</SelectItem><SelectItem value="dispatched">Dispatched</SelectItem><SelectItem value="delivered">Delivered</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No orders found.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Dealer</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.order_number}</TableCell>
                      <TableCell>{o.dealers?.name}</TableCell>
                      <TableCell>{o.order_date}</TableCell>
                      <TableCell>₹{Number(o.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={statusColors[o.status] as any}>{o.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {o.status === "draft" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: o.id, status: "confirmed" })}>Confirm</Button>}
                          {o.status === "confirmed" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: o.id, status: "dispatched" })}>Dispatch</Button>
                              <Button size="sm" variant="default" onClick={() => handleConvertToInvoice(o)} title="Convert to Invoice"><FileText className="h-3.5 w-3.5 mr-1" />Invoice</Button>
                            </>
                          )}
                          {o.status === "dispatched" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: o.id, status: "delivered" })}>Delivered</Button>}
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
