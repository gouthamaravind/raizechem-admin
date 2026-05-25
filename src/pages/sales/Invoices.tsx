import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranch } from "@/hooks/useBranch";
import { useNavigate, useLocation } from "react-router-dom";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Trash2, Download, Printer, Ban, Truck } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { calculateGST } from "@/lib/gst";
import { useVoidTransaction } from "@/hooks/useVoidTransaction";
import { VoidDialog } from "@/components/VoidDialog";
import { AlterButton } from "@/components/tally/AlterButton";
import { AlterReasonDialog } from "@/components/tally/AlterReasonDialog";
import { TransporterPicker } from "@/components/TransporterPicker";

import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Database } from "@/integrations/supabase/types";

type Dealer = Database["public"]["Tables"]["dealers"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Batch = Database["public"]["Tables"]["product_batches"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { dealers: { name: string } | null };

type InvItem = { product_id: string; pack_id?: string | null; batch_id: string; qty: number; rate: number; gst_rate: number; hsn_code: string; discount_pct: number; discount_amount: number };

export default function Invoices() {
  const { user, hasRole, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ id: string; label: string } | null>(null);
  const [alterTarget, setAlterTarget] = useState<{ id: string; label: string } | null>(null);
  const [alteringFrom, setAlteringFrom] = useState<{ id: string; number: string; reason: string } | null>(null);

  const voidMutation = useVoidTransaction({
    table: "invoices",
    invalidateKeys: [["invoices"], ["outstanding-invoices"]],
  });
  const canVoid = hasRole("admin") || hasRole("accounts");
  const [dealerId, setDealerId] = useState("");
  const [convertingOrderId, setConvertingOrderId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<InvItem[]>([{ product_id: "", pack_id: null, batch_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "", discount_pct: 0, discount_amount: 0 }]);
  // E-way bill fields
  const [transportMode, setTransportMode] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [dispatchFrom, setDispatchFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [transporterId, setTransporterId] = useState("");
  // Advance adjustment
  const [adjustAdvance, setAdjustAdvance] = useState(false);
  const [advanceAdjustAmount, setAdvanceAdjustAmount] = useState(0);

  const pg = usePagination();
  const { branchId, activeBranch } = useBranch();

  const { data: invoicesRaw = [], isLoading } = useQuery({
    queryKey: ["invoices", pg.page, branchId],
    queryFn: async () => {
      let q = supabase.from("invoices").select("*, dealers(name)").order("created_at", { ascending: false }).range(pg.range.from, pg.range.to + 1);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Invoice[];
    },
  });
  const invoices = invoicesRaw.slice(0, pg.pageSize);

  const { data: dealers = [] } = useQuery<Dealer[]>({ queryKey: ["dealers-list", branchId], queryFn: async () => { let q = supabase.from("dealers").select("id, name, state_code, state, payment_terms_days, price_level_id").eq("status", "active").order("name"); if (branchId) q = q.eq("branch_id", branchId); const { data } = await q; return (data || []) as unknown as Dealer[]; } });
  const { data: companySettings } = useQuery({ queryKey: ["company-settings"], queryFn: async () => { const { data } = await supabase.from("company_settings").select("state_code, state").limit(1).single(); return data; } });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["products-list", branchId], queryFn: async () => { let q = supabase.from("products").select("id, name, brand, sale_price, gst_rate, hsn_code, unit").eq("is_active", true).order("name"); if (branchId) q = q.eq("branch_id", branchId); const { data } = await q; return (data || []) as unknown as Product[]; } });
  const { data: batches = [] } = useQuery<Batch[]>({ queryKey: ["batches-available", branchId], queryFn: async () => { let q = supabase.from("product_batches").select("id, product_id, batch_no, current_qty").gt("current_qty", 0); if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`); const { data } = await q; return (data || []) as unknown as Batch[]; } });
  const { data: packs = [] } = useQuery<any[]>({ queryKey: ["product-packs-all"], queryFn: async () => { const { data } = await supabase.from("product_packs").select("id, product_id, pack_label, units_per_case, unit_size, unit_uom, basic_price, price_inclusive_gst").eq("is_active", true).order("sort_order"); return data || []; } });

  const { data: priceLevelPrices = [] } = useQuery({ queryKey: ["price-level-prices"], queryFn: async () => { const { data } = await supabase.from("product_price_levels").select("product_id, price_level_id, price"); return data || []; } });

  // Dealer advance balance
  const { data: dealerAdvanceBalance = 0 } = useQuery({
    queryKey: ["dealer-advance-balance", dealerId],
    enabled: !!dealerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advance_receipts")
        .select("balance_amount")
        .eq("dealer_id", dealerId)
        .eq("status", "OPEN");
      if (error) return 0;
      return (data || []).reduce((sum: number, r) => sum + Number(r.balance_amount), 0);
    },
  });

  // Handle Order → Invoice conversion from navigation state
  useEffect(() => {
    const convertOrder = (location.state as any)?.convertOrder;
    if (convertOrder && products.length > 0) {
      setDealerId(convertOrder.dealer_id);
      setConvertingOrderId(convertOrder.id);
      // Fetch order items and pre-fill
      supabase
        .from("order_items")
        .select("*, products(gst_rate, hsn_code)")
        .eq("order_id", convertOrder.id)
        .then(({ data: orderItems }) => {
          if (orderItems && orderItems.length > 0) {
            setItems(
              orderItems.map((oi: any) => ({
                product_id: oi.product_id,
                batch_id: "",
                qty: Number(oi.qty),
                rate: Number(oi.rate),
                gst_rate: Number(oi.products?.gst_rate ?? 18),
                hsn_code: oi.products?.hsn_code || "",
                discount_pct: Number(oi.discount_pct ?? 0),
                discount_amount: Number(oi.discount_amount ?? 0),
              }))
            );
          }
          setDialogOpen(true);
        });
      // Clear navigation state so refresh doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state, products.length]);

  const selectedDealer = dealers.find((d) => d.id === dealerId);

  const computedItems = items.map((item) => {
    const grossAmount = item.qty * item.rate;
    const discountAmt = item.discount_amount + (grossAmount * item.discount_pct / 100);
    const amount = grossAmount - discountAmt;
    const gst = calculateGST(amount, item.gst_rate, selectedDealer?.state_code, companySettings?.state_code || "36");
    return { ...item, amount, discountAmt, ...gst };
  });
  const subtotal = computedItems.reduce((s, i) => s + i.amount, 0);
  const cgstTotal = computedItems.reduce((s, i) => s + i.cgst, 0);
  const sgstTotal = computedItems.reduce((s, i) => s + i.sgst, 0);
  const igstTotal = computedItems.reduce((s, i) => s + i.igst, 0);
  const grandTotal = subtotal + cgstTotal + sgstTotal + igstTotal;
  const roundOff = Math.round(grandTotal) - grandTotal;
  const roundedTotal = Math.round(grandTotal);

  const startAlter = async (invId: string, invNo: string) => {
    // fetch invoice header
    const { data: inv } = await supabase.from("invoices").select("*").eq("id", invId).single();
    if (!inv) { toast.error("Invoice not found"); return; }
    const { data: invItems } = await supabase.from("invoice_items").select("*").eq("invoice_id", invId);
    setDealerId(inv.dealer_id);
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setTransportMode(inv.transport_mode || "");
    setVehicleNo(inv.vehicle_no || "");
    setDispatchFrom(inv.dispatch_from || "");
    setDeliveryTo(inv.delivery_to || "");
    setTransporterId((inv as any).transporter_id || "");
    setItems((invItems || []).map((it: any) => ({
      product_id: it.product_id,
      pack_id: it.pack_id || null,
      batch_id: it.batch_id,
      qty: Number(it.qty),
      rate: Number(it.rate),
      gst_rate: Number(it.gst_rate ?? 18),
      hsn_code: it.hsn_code || "",
      discount_pct: Number(it.discount_pct ?? 0),
      discount_amount: Number(it.discount_amount ?? 0),
    })));
    setAdjustAdvance(false); setAdvanceAdjustAmount(0);
    setDialogOpen(true);
  };

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!dealerId) throw new Error("Select dealer");
      const validItems = computedItems.filter((i) => i.product_id && i.batch_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one valid item with batch");

      // ALTER: void the original first so its stock & ledger are restored before the new doc consumes them.
      if (alteringFrom) {
        const { error: vErr } = await supabase.rpc("void_invoice_atomic" as any, {
          p_invoice_id: alteringFrom.id,
          p_reason: `ALTER: ${alteringFrom.reason}`,
          p_voided_by: user?.id,
        });
        if (vErr) throw new Error("Could not void original invoice: " + vErr.message);
      }

      const dueDate = selectedDealer?.payment_terms_days
        ? new Date(Date.now() + Number(selectedDealer.payment_terms_days) * 86400000).toISOString().split("T")[0]
        : null;

      const companyStateCode = companySettings?.state_code || "36";
      const placeOfSupply = selectedDealer?.state_code === companyStateCode ? (companySettings?.state || "Telangana") : (selectedDealer?.state || "");

      const itemsPayload = validItems.map((i) => ({
        product_id: i.product_id, pack_id: i.pack_id || null, batch_id: i.batch_id, hsn_code: i.hsn_code,
        qty: i.qty, rate: i.rate, amount: i.amount,
        gst_rate: i.gst_rate, cgst_amount: i.cgst, sgst_amount: i.sgst,
        igst_amount: i.igst, total_amount: i.totalWithGst,
        discount_pct: i.discount_pct, discount_amount: i.discount_amount,
      }));

      const { data, error } = await supabase.rpc("create_invoice_atomic", {
        p_dealer_id: dealerId,
        p_invoice_date: invoiceDate,
        p_subtotal: subtotal,
        p_cgst_total: cgstTotal,
        p_sgst_total: sgstTotal,
        p_igst_total: igstTotal,
        p_total_amount: grandTotal,
        p_created_by: user?.id,
        p_transport_mode: transportMode || null,
        p_vehicle_no: vehicleNo || null,
        p_dispatch_from: dispatchFrom || null,
        p_delivery_to: deliveryTo || null,
        p_place_of_supply: placeOfSupply || null,
        p_due_date: dueDate,
        p_items: itemsPayload,
        p_round_off: roundOff,
        p_order_id: convertingOrderId,
        p_branch_id: branchId || null,
      } as any);
      if (error) throw error;

      const newInvoiceId = (data as any)?.invoice_id;
      if (newInvoiceId && transporterId) {
        await supabase.from("invoices").update({ transporter_id: transporterId } as any).eq("id", newInvoiceId);
      }



      // Allocate advance if requested
      if (adjustAdvance && advanceAdjustAmount > 0 && data) {
        const invoiceId = (data as any).invoice_id;
        if (invoiceId) {
          const { error: allocErr } = await supabase.rpc("allocate_advance_to_invoice_atomic" as any, {
            p_invoice_id: invoiceId,
            p_dealer_id: dealerId,
            p_amount_to_allocate: advanceAdjustAmount,
            p_allocated_by: user?.id,
          });
          if (allocErr) toast.error("Invoice created but advance allocation failed: " + allocErr.message);
        }
      }

      // ALTER: write audit linking old → new
      if (alteringFrom && data) {
        const newInvoiceId = (data as any).invoice_id;
        const newInvoiceNumber = (data as any).invoice_number;
        await supabase.from("audit_logs" as any).insert({
          table_name: "invoices",
          record_id: alteringFrom.id,
          action: "ALTER",
          actor_user_id: user?.id,
          new_data: {
            alter_reason: alteringFrom.reason,
            replaced_by_id: newInvoiceId,
            replaced_by_number: newInvoiceNumber,
            strategy: "void+create",
          },
        });
      }
    },
    onSuccess: async () => {
      // Invoice created from an order: keep order as 'confirmed'.
      // Order will auto-transition to 'dispatched' when E-Way Bill is generated (DB trigger).
      if (convertingOrderId) {
        qc.invalidateQueries({ queryKey: ["orders"] });
        setConvertingOrderId(null);
      }
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-available"] });
      qc.invalidateQueries({ queryKey: ["advance-receipts"] });
      qc.invalidateQueries({ queryKey: ["dealer-advance-balance"] });

      const wasAlter = !!alteringFrom;
      setDialogOpen(false); setDealerId("");
      setItems([{ product_id: "", pack_id: null, batch_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "", discount_pct: 0, discount_amount: 0 }]);
      setTransportMode(""); setVehicleNo(""); setDispatchFrom(""); setDeliveryTo("");
      setAdjustAdvance(false); setAdvanceAdjustAmount(0);
      setAlteringFrom(null);
      toast.success(wasAlter ? "Invoice altered — original voided, replacement created" : "Invoice created with GST and ledger entry");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => setItems([...items, { product_id: "", pack_id: null, batch_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "", discount_pct: 0, discount_amount: 0 }]);
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
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setAlteringFrom(null); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Create</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{alteringFrom ? `Alter Invoice ${alteringFrom.number} → new` : "Create Invoice"}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createInvoice.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Dealer *</Label>
                      <Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
                    {selectedDealer && <div className="space-y-2"><Label>GST Type</Label><p className="text-sm font-medium pt-2">{selectedDealer.state_code === (companySettings?.state_code || "36") ? "Intra-state (CGST+SGST)" : "Inter-state (IGST)"}</p></div>}
                  </div>
                  <div className="space-y-2">
                    <Label>Line Items (select batch for each)</Label>
                    {items.map((item, i) => {
                      const productBatches = batches.filter((b: any) => b.product_id === item.product_id);
                      const productPacks = packs.filter((p: any) => p.product_id === item.product_id);
                      const selectedPack = productPacks.find((p: any) => p.id === item.pack_id);
                      return (
                        <div key={i} className="flex gap-2 items-end flex-wrap">
                          <Select value={item.product_id} onValueChange={(v) => {
                            const p = products.find((p: any) => p.id === v) as any;
                            updateItem(i, "product_id", v);
                            updateItem(i, "pack_id", null);
                            if (p) {
                              const plId = selectedDealer?.price_level_id;
                              const plPrice = plId ? priceLevelPrices.find((pp: any) => pp.product_id === v && pp.price_level_id === plId) : null;
                              updateItem(i, "rate", plPrice ? Number(plPrice.price) : (Number(p.sale_price) || 0));
                              updateItem(i, "gst_rate", Number(p.gst_rate)); updateItem(i, "hsn_code", p.hsn_code || "");
                            }
                          }}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.brand ? `${p.brand} — ${p.name}` : p.name}</SelectItem>)}</SelectContent>
                          </Select>
                          {productPacks.length > 0 && (
                            <Select value={item.pack_id || ""} onValueChange={(v) => {
                              updateItem(i, "pack_id", v);
                              const pk = productPacks.find((p: any) => p.id === v);
                              if (pk && Number(pk.basic_price) > 0) updateItem(i, "rate", Number(pk.basic_price));
                            }}>
                              <SelectTrigger className="w-44"><SelectValue placeholder="Pack / Carton" /></SelectTrigger>
                              <SelectContent>{productPacks.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.pack_label} ({p.units_per_case}×{p.unit_size}{p.unit_uom})</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                          <Select value={item.batch_id} onValueChange={(v) => updateItem(i, "batch_id", v)}>
                            <SelectTrigger className="w-36"><SelectValue placeholder="Batch" /></SelectTrigger>
                            <SelectContent>{productBatches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_no} (Qty: {b.current_qty})</SelectItem>)}</SelectContent>
                          </Select>
                          <Input type="number" className="w-16" placeholder={selectedPack ? "Cartons" : "Qty"} value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} title={selectedPack ? `1 carton = ${selectedPack.units_per_case} × ${selectedPack.unit_size}${selectedPack.unit_uom}` : "Quantity"} />
                          <Input type="number" className="w-24" placeholder={selectedPack ? "Rate/carton" : "Rate"} value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} />
                          <Input type="number" className="w-16" placeholder="Disc%" value={item.discount_pct || ""} onChange={(e) => updateItem(i, "discount_pct", Number(e.target.value))} title="Discount %" />
                          <Input type="number" className="w-20" placeholder="Disc₹" value={item.discount_amount || ""} onChange={(e) => updateItem(i, "discount_amount", Number(e.target.value))} title="Discount Amount" />
                          <span className="text-xs w-20">₹{(item.qty * item.rate - item.discount_amount - (item.qty * item.rate * item.discount_pct / 100)).toFixed(2)}</span>
                          {selectedPack && item.qty > 0 && <span className="text-[10px] text-muted-foreground w-full pl-1">= {(item.qty * Number(selectedPack.units_per_case)).toLocaleString()} bottles ({item.qty} × {selectedPack.units_per_case})</span>}
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
                  {/* Advance Adjustment */}
                  {dealerId && dealerAdvanceBalance > 0 && (
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox id="adjust-advance" checked={adjustAdvance} onCheckedChange={(v) => {
                          setAdjustAdvance(!!v);
                          if (v) setAdvanceAdjustAmount(Math.min(roundedTotal, dealerAdvanceBalance));
                          else setAdvanceAdjustAmount(0);
                        }} />
                        <Label htmlFor="adjust-advance" className="cursor-pointer">
                          Adjust from advance balance (Available: <span className="font-semibold text-primary">₹{dealerAdvanceBalance.toLocaleString("en-IN")}</span>)
                        </Label>
                      </div>
                      {adjustAdvance && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Adjust Amount:</Label>
                          <Input type="number" className="w-32" min={0.01} max={Math.min(roundedTotal, dealerAdvanceBalance)} step="0.01"
                            value={advanceAdjustAmount || ""} onChange={(e) => setAdvanceAdjustAmount(Math.min(Number(e.target.value), roundedTotal, dealerAdvanceBalance))} />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="border-t pt-3 space-y-1 text-sm text-right">
                    <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
                    {cgstTotal > 0 && <p>CGST: ₹{cgstTotal.toFixed(2)}</p>}
                    {sgstTotal > 0 && <p>SGST: ₹{sgstTotal.toFixed(2)}</p>}
                    {igstTotal > 0 && <p>IGST: ₹{igstTotal.toFixed(2)}</p>}
                    {roundOff !== 0 && (
                      <p className="text-muted-foreground">Round Off: {roundOff > 0 ? "+" : ""}₹{roundOff.toFixed(2)}</p>
                    )}
                    <p className="text-lg font-bold">Grand Total: ₹{roundedTotal.toFixed(2)}</p>
                    {adjustAdvance && advanceAdjustAmount > 0 && (
                      <p className="text-primary">Less Advance: −₹{advanceAdjustAmount.toFixed(2)}</p>
                    )}
                    {adjustAdvance && advanceAdjustAmount > 0 && (
                      <p className="text-lg font-bold">Net Due: ₹{(roundedTotal - advanceAdjustAmount).toFixed(2)}</p>
                    )}
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
            {isLoading ? <TableSkeleton columns={10} /> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No invoices yet.</p> : (
              <>
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
                        <Button variant="ghost" size="icon" title="Print" onClick={() => navigate(`/sales/invoices/${inv.id}/print`)}><Printer className="h-4 w-4" /></Button>
                        {inv.status !== "void" && (
                          <Button variant="ghost" size="icon" title="Generate E-Way Bill" onClick={() => navigate("/warehouse/waybills", { state: { prefillInvoiceId: inv.id } })}><Truck className="h-4 w-4" /></Button>
                        )}
                        {isAdmin && inv.status !== "void" && (
                          <AlterButton onClick={() => setAlterTarget({ id: inv.id, label: inv.invoice_number })} />
                        )}
                        {canVoid && inv.status !== "void" && (
                          <Button variant="ghost" size="icon" className="text-destructive" title="Void" onClick={() => setVoidTarget({ id: inv.id, label: inv.invoice_number })}><Ban className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination page={pg.page} pageSize={pg.pageSize} totalFetched={invoicesRaw.length} onPrev={pg.prevPage} onNext={pg.nextPage} />
              </>
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

      <AlterReasonDialog
        open={!!alterTarget}
        onOpenChange={(v) => { if (!v) setAlterTarget(null); }}
        title={`Invoice ${alterTarget?.label || ""}`}
        onConfirm={(reason) => {
          if (!alterTarget) return;
          setAlteringFrom({ id: alterTarget.id, number: alterTarget.label, reason });
          startAlter(alterTarget.id, alterTarget.label);
          setAlterTarget(null);
        }}
      />
    </DashboardLayout>
  );
}
