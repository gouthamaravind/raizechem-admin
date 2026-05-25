import { useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBranch } from "@/hooks/useBranch";
import { useDealerOverdue } from "@/hooks/useDealerOverdue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, Download, FileText, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { useNavigate } from "react-router-dom";
import { AlterButton } from "@/components/tally/AlterButton";

type LineItem = { product_id: string; pack_id: string; qty: number; rate: number };

export default function Orders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alterId, setAlterId] = useState<string | null>(null);
  const [alterReason, setAlterReason] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ product_id: "", pack_id: "", qty: 1, rate: 0 }]);
  const [priceLevelOverride, setPriceLevelOverride] = useState<string>("default");
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: string; total: number } | null>(null);

  const { isOverdue, getOverdue } = useDealerOverdue();
  const { branchId } = useBranch();

  const pg = usePagination();

  const { data: ordersRaw = [], isLoading } = useQuery({
    queryKey: ["orders", pg.page, branchId],
    queryFn: async () => {
      let q = supabase.from("orders").select("*, dealers(name)").order("created_at", { ascending: false }).range(pg.range.from, pg.range.to + 1);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const orders = ordersRaw.slice(0, pg.pageSize);
  const orderIds = orders.map((o: any) => o.id);

  const { data: orderInvoices = [] } = useQuery({
    queryKey: ["orders-invoices", orderIds],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, order_id, invoice_number, status")
        .in("order_id", orderIds);
      return data || [];
    },
  });
  const invoiceIds = (orderInvoices as any[]).map((i: any) => i.id);
  const { data: invoiceWaybills = [] } = useQuery({
    queryKey: ["orders-waybills", invoiceIds],
    enabled: invoiceIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from("waybills" as any) as any)
        .select("id, source_id, status, ewb_number")
        .eq("source_type", "invoice")
        .in("source_id", invoiceIds);
      return data || [];
    },
  });
  const invoiceForOrder = (orderId: string) =>
    (orderInvoices as any[]).find((i: any) => i.order_id === orderId && i.status !== "voided");
  const waybillForInvoice = (invoiceId: string) =>
    (invoiceWaybills as any[]).find((w: any) => w.source_id === invoiceId && w.status === "generated");

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list", branchId], queryFn: async () => { let q = supabase.from("dealers").select("id, name, price_level_id").eq("status", "active").order("name"); if (branchId) q = q.eq("branch_id", branchId); const { data } = await q; return data || []; } });
  const { data: products = [] } = useQuery({ queryKey: ["products-list", branchId], queryFn: async () => { let q = supabase.from("products").select("id, name, brand, sale_price, unit, gst_rate").eq("is_active", true).order("name"); if (branchId) q = q.eq("branch_id", branchId); const { data } = await q; return data || []; } });
  const { data: packs = [] } = useQuery({ queryKey: ["product-packs-all"], queryFn: async () => { const { data } = await supabase.from("product_packs").select("id, product_id, pack_label, units_per_case, unit_size, unit_uom, price_finished_goods, mrp").eq("is_active", true).order("sort_order"); return data || []; } });
  const { data: priceLevels = [] } = useQuery({ queryKey: ["price-levels"], queryFn: async () => { const { data } = await supabase.from("price_levels").select("id, name").order("sort_order"); return data || []; } });
  const { data: priceLevelPrices = [] } = useQuery({ queryKey: ["price-level-prices"], queryFn: async () => { const { data } = await supabase.from("product_price_levels").select("product_id, price_level_id, price"); return data || []; } });
  const selectedDealer = dealers.find((d: any) => d.id === dealerId) as any;
  const effectivePriceLevelId = priceLevelOverride && priceLevelOverride !== "default" ? priceLevelOverride : selectedDealer?.price_level_id;

  const productLabel = (p: any) => p.brand ? `${p.brand} — ${p.name}` : p.name;
  const packLabel = (pk: any) => {
    const size = pk.unit_size ? `${pk.unit_size}${pk.unit_uom || ""}` : pk.pack_label;
    return `${pk.pack_label} · ${size} × ${pk.units_per_case}/case`;
  };
  const packsFor = (productId: string) => packs.filter((p: any) => p.product_id === productId);
  const resolveRate = (productId: string, packId: string) => {
    const pk = packs.find((p: any) => p.id === packId) as any;
    if (effectivePriceLevelId) {
      const plPrice = priceLevelPrices.find((pp: any) => pp.product_id === productId && pp.price_level_id === effectivePriceLevelId) as any;
      if (plPrice && pk) return Number(plPrice.price) * Number(pk.units_per_case || 1);
      if (plPrice) return Number(plPrice.price);
    }
    if (pk) return Number(pk.price_finished_goods) || 0;
    const p = products.find((x: any) => x.id === productId) as any;
    return p ? Number(p.sale_price) || 0 : 0;
  };

  const saveOrder = useMutation({
    mutationFn: async () => {
      if (!dealerId || items.length === 0) throw new Error("Select dealer and add items");
      if (!alterId && isOverdue(dealerId)) {
        const info = getOverdue(dealerId);
        throw new Error(`Order blocked: This dealer has ₹${info?.totalOverdue.toLocaleString("en-IN")} overdue by ${info?.maxDaysOverdue} days (>120 days). Collect payment first.`);
      }
      const validItems = items.filter((i) => i.product_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid item");

      const p_items = validItems.map((i) => ({
        product_id: i.product_id,
        pack_id: i.pack_id || null,
        qty: i.qty,
        rate: i.rate,
      }));

      if (alterId) {
        if (!alterReason.trim()) throw new Error("Alter reason is required");
        const { data, error } = await supabase.rpc("alter_order_atomic" as any, {
          p_order_id: alterId,
          p_dealer_id: dealerId,
          p_notes: notes || null,
          p_items: p_items,
          p_altered_by: user?.id,
          p_reason: alterReason,
        });
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase.rpc("create_order_atomic" as any, {
        p_dealer_id: dealerId,
        p_notes: notes || null,
        p_created_by: user?.id,
        p_items: p_items,
        p_branch_id: branchId || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (alterId) {
        setDialogOpen(false); setAlterId(null); setAlterReason("");
        setDealerId(""); setNotes(""); setItems([{ product_id: "", pack_id: "", qty: 1, rate: 0 }]);
        toast.success("Order altered");
      } else {
        setDialogOpen(false);
        setCreatedOrder({ id: data?.order_id, number: data?.order_number, total: Number(data?.total_amount || 0) });
        toast.success("Order created");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAlter = async (o: any) => {
    const { data: rows } = await supabase.from("order_items").select("*").eq("order_id", o.id);
    setAlterId(o.id);
    setDealerId(o.dealer_id);
    setNotes(o.notes || "");
    setAlterReason("");
    setPriceLevelOverride("default");
    setItems((rows || []).map((r: any) => ({
      product_id: r.product_id, pack_id: r.pack_id || "", qty: Number(r.qty), rate: Number(r.rate),
    })));
    setDialogOpen(true);
  };

  const openCreate = () => {
    setAlterId(null); setAlterReason("");
    setDealerId(""); setNotes("");
    setPriceLevelOverride("default");
    setItems([{ product_id: "", pack_id: "", qty: 1, rate: 0 }]);
    setDialogOpen(true);
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const handleConvertToInvoice = (order: any) => {
    navigate("/sales/invoices", { state: { convertOrder: order } });
  };

  // Confirm draft → confirmed → navigate to invoice page (optionally with waybill intent)
  const confirmAndInvoice = async (withWaybill: boolean) => {
    if (!createdOrder) return;
    const { error } = await supabase.from("orders").update({ status: "confirmed" as any }).eq("id", createdOrder.id);
    if (error) { toast.error(error.message); return; }
    const { data: full } = await supabase.from("orders").select("*, dealers(*)").eq("id", createdOrder.id).single();
    setCreatedOrder(null);
    setDealerId(""); setNotes(""); setItems([{ product_id: "", pack_id: "", qty: 1, rate: 0 }]);
    navigate("/sales/invoices", { state: { convertOrder: full, autoWaybill: withWaybill } });
  };

  const filtered = orders.filter((o: any) => {
    const s = search.toLowerCase();
    const match = o.order_number?.toLowerCase().includes(s) || o.dealers?.name?.toLowerCase().includes(s);
    return match && (statusFilter === "all" || o.status === statusFilter);
  });

  const addItem = () => setItems([...items, { product_id: "", pack_id: "", qty: 1, rate: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: any) => { const n = [...items]; (n[i] as any)[field] = val; setItems(n); };

  const statusColors: Record<string, string> = { draft: "secondary", confirmed: "default", dispatched: "outline", delivered: "default", cancelled: "destructive" };

  const previewLines = createdOrder ? items.filter(i => i.product_id && i.qty > 0).map((it) => {
    const p = products.find((x: any) => x.id === it.product_id) as any;
    const pk = packs.find((x: any) => x.id === it.pack_id) as any;
    const gstRate = Number(p?.gst_rate || 0);
    const lineBase = it.qty * it.rate;
    const lineGst = lineBase * gstRate / 100;
    return { name: p ? productLabel(p) : "—", pack: pk ? packLabel(pk) : "—", qty: it.qty, rate: it.rate, gstRate, gst: lineGst, total: lineBase + lineGst };
  }) : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Orders</h1><p className="text-muted-foreground">Manage sales orders</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("orders.csv", filtered.map((o: any) => ({ order_number: o.order_number, dealer: o.dealers?.name, date: o.order_date, status: o.status, total: o.total_amount })), [{ key: "order_number", label: "Order #" }, { key: "dealer", label: "Dealer" }, { key: "date", label: "Date" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setAlterId(null); setAlterReason(""); } }}>
              <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Create</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{alterId ? "Alter Order" : "Create Order"}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveOrder.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Dealer *</Label>
                      <Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger><SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Price Level</Label>
                      <Select value={priceLevelOverride} onValueChange={setPriceLevelOverride}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Dealer default</SelectItem>
                          {priceLevels.map((pl: any) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                  </div>
                  {alterId && (
                    <div className="space-y-2">
                      <Label>Alter reason *</Label>
                      <Input value={alterReason} onChange={(e) => setAlterReason(e.target.value)} placeholder="Why is this order being altered?" required />
                    </div>
                  )}
                  {!alterId && dealerId && isOverdue(dealerId) && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This dealer has payments overdue by {getOverdue(dealerId)?.maxDaysOverdue} days (₹{getOverdue(dealerId)?.totalOverdue.toLocaleString("en-IN")} outstanding). New orders are blocked until payments are collected.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label>Line Items <span className="text-xs text-muted-foreground font-normal">(Qty = number of packs)</span></Label>
                    {items.map((item, i) => {
                      const productPacks = packsFor(item.product_id);
                      return (
                        <div key={i} className="flex gap-2 items-end flex-wrap">
                          <Select value={item.product_id} onValueChange={(v) => {
                            const firstPack = packs.find((p: any) => p.product_id === v) as any;
                            const newPackId = firstPack?.id || "";
                            const rate = resolveRate(v, newPackId);
                            const n = [...items]; n[i] = { ...n[i], product_id: v, pack_id: newPackId, rate }; setItems(n);
                          }}>
                            <SelectTrigger className="min-w-[220px] flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{productLabel(p)}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={item.pack_id} onValueChange={(v) => { const n = [...items]; n[i] = { ...n[i], pack_id: v, rate: resolveRate(n[i].product_id, v) }; setItems(n); }} disabled={!item.product_id || productPacks.length === 0}>
                            <SelectTrigger className="min-w-[200px]"><SelectValue placeholder={productPacks.length === 0 ? "No packs" : "Pack"} /></SelectTrigger>
                            <SelectContent>{productPacks.map((pk: any) => <SelectItem key={pk.id} value={pk.id}>{packLabel(pk)}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="number" className="w-20" placeholder="Packs" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} title="Number of packs" />
                          <Input type="number" className="w-28" placeholder="Rate/pack" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} title="Rate per pack" />
                          <span className="text-sm w-24 text-right">₹{(item.qty * item.rate).toLocaleString("en-IN")}</span>
                          {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      );
                    })}
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Item</Button>
                  </div>
                  <div className="text-right font-semibold">Subtotal: ₹{items.reduce((s, i) => s + (i.qty * i.rate), 0).toLocaleString("en-IN")} <span className="text-xs text-muted-foreground font-normal">(GST added on invoice)</span></div>
                  <Button type="submit" className="w-full" disabled={saveOrder.isPending || (!alterId && isOverdue(dealerId))}>{saveOrder.isPending ? "Saving..." : alterId ? "Alter Order" : isOverdue(dealerId) ? "Blocked — Overdue >120 days" : "Create Order"}</Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Post-create preview popup */}
            <Dialog open={!!createdOrder} onOpenChange={(o) => { if (!o) setCreatedOrder(null); }}>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Order Preview — {createdOrder?.number}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">Dealer: <span className="font-medium text-foreground">{selectedDealer?.name}</span></div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Pack</TableHead><TableHead className="text-right">Packs</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">GST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {previewLines.map((l, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{l.pack}</TableCell>
                          <TableCell className="text-right">{l.qty}</TableCell>
                          <TableCell className="text-right">₹{l.rate.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right">{l.gstRate}% (₹{l.gst.toFixed(2)})</TableCell>
                          <TableCell className="text-right font-semibold">₹{l.total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end text-base font-semibold">Grand Total (incl. GST): ₹{previewLines.reduce((s, l) => s + l.total, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2 border-t">
                    <Button variant="ghost" onClick={() => { setCreatedOrder(null); setDealerId(""); setNotes(""); setItems([{ product_id: "", pack_id: "", qty: 1, rate: 0 }]); }}>Keep as Draft</Button>
                    <Button variant="outline" onClick={() => confirmAndInvoice(false)}>Confirm & Generate Invoice</Button>
                    <Button onClick={() => confirmAndInvoice(true)}><FileText className="h-4 w-4 mr-2" />Invoice + E-Way Bill</Button>
                  </div>
                </div>
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
              <>
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
                        <div className="flex flex-wrap gap-1">
                          {o.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: o.id, status: "confirmed" })}>Confirm</Button>
                          )}
                          {o.status === "confirmed" && (() => {
                            const inv = invoiceForOrder(o.id);
                            if (!inv) {
                              return (
                                <Button size="sm" variant="default" onClick={() => handleConvertToInvoice(o)} title="Create tax invoice">
                                  <FileText className="h-3.5 w-3.5 mr-1" />Create Invoice
                                </Button>
                              );
                            }
                            const wb = waybillForInvoice(inv.id);
                            return (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => navigate(`/sales/invoices`)} title={`Invoice ${inv.invoice_number}`}>
                                  <FileText className="h-3.5 w-3.5 mr-1" />{inv.invoice_number}
                                </Button>
                                {!wb ? (
                                  <Button size="sm" variant="default" onClick={() => navigate("/warehouse/waybills", { state: { prefillInvoiceId: inv.id } })}>
                                    Generate E-Way Bill
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="text-xs">EWB: {wb.ewb_number || "—"}</Badge>
                                )}
                              </>
                            );
                          })()}
                          {o.status === "dispatched" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: o.id, status: "delivered" })}>Mark Delivered</Button>}
                          {o.status !== "cancelled" && o.status !== "delivered" && <AlterButton onClick={() => openAlter(o)} />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination page={pg.page} pageSize={pg.pageSize} totalFetched={ordersRaw.length} onPrev={pg.prevPage} onNext={pg.nextPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
