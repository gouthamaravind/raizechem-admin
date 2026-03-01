import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ArrowRight, Check, X, Truck, Package } from "lucide-react";
import { format } from "date-fns";

interface TransferItem {
  product_id: string;
  batch_id: string;
  qty: number;
  product_name?: string;
  batch_no?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  in_transit: "default",
  received: "default",
  cancelled: "destructive",
};

export default function StockTransfers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromWh, setFromWh] = useState("");
  const [toWh, setToWh] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [qty, setQty] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["stock-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_transfers")
        .select("*, from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(name, code), to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(name, code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["batches-for-transfer", selectedProduct, fromWh],
    queryFn: async () => {
      if (!selectedProduct) return [];
      let q = supabase.from("product_batches").select("id, batch_no, current_qty, warehouse_id").eq("product_id", selectedProduct).gt("current_qty", 0);
      if (fromWh) q = q.or(`warehouse_id.eq.${fromWh},warehouse_id.is.null`);
      const { data, error } = await q.order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProduct,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!fromWh || !toWh || items.length === 0) throw new Error("Fill all required fields");
      // Get next transfer number
      const { data: settings } = await supabase.from("company_settings").select("next_transfer_number").limit(1).single();
      const num = settings?.next_transfer_number || 1;
      const transferNum = `ST/${new Date().getFullYear()}/${String(num).padStart(3, "0")}`;

      const { data: transfer, error } = await supabase.from("stock_transfers").insert({
        transfer_number: transferNum,
        from_warehouse_id: fromWh,
        to_warehouse_id: toWh,
        notes,
        created_by: user?.id,
      } as any).select().single();
      if (error) throw error;

      // Insert items
      const { error: itemsErr } = await supabase.from("stock_transfer_items").insert(
        items.map((it) => ({ transfer_id: transfer.id, product_id: it.product_id, batch_id: it.batch_id, qty: it.qty })) as any
      );
      if (itemsErr) throw itemsErr;

      // Increment counter
      await supabase.from("company_settings").update({ next_transfer_number: num + 1 }).not("id", "is", null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      toast.success("Stock transfer created");
      setOpen(false);
      setItems([]);
      setFromWh("");
      setToWh("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ transferId, action }: { transferId: string; action: string }) => {
      const { error } = await supabase.rpc("execute_stock_transfer", {
        p_transfer_id: transferId,
        p_action: action,
        p_user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      toast.success(`Transfer ${action === "approve" ? "approved & dispatched" : action === "receive" ? "received" : "cancelled"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => {
    if (!selectedProduct || !selectedBatch || !qty || Number(qty) <= 0) return;
    const product = products.find((p) => p.id === selectedProduct);
    const batch = batches.find((b) => b.id === selectedBatch);
    setItems((prev) => [...prev, {
      product_id: selectedProduct,
      batch_id: selectedBatch,
      qty: Number(qty),
      product_name: product?.name,
      batch_no: batch?.batch_no,
    }]);
    setSelectedProduct("");
    setSelectedBatch("");
    setQty("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1>
            <p className="text-muted-foreground">Transfer stock between warehouses with approval workflow</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Transfer</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Stock Transfer</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Warehouse *</Label>
                    <Select value={fromWh} onValueChange={setFromWh}>
                      <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        {warehouses.filter((w) => w.id !== toWh).map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Warehouse *</Label>
                    <Select value={toWh} onValueChange={setToWh}>
                      <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                      <SelectContent>
                        {warehouses.filter((w) => w.id !== fromWh).map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="font-semibold">Items</Label>
                  <div className="grid grid-cols-4 gap-2">
                    <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v); setSelectedBatch(""); }}>
                      <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedBatch} onValueChange={setSelectedBatch} disabled={!selectedProduct}>
                      <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                      <SelectContent>
                        {batches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.batch_no} (Qty: {b.current_qty})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
                    <Button type="button" variant="secondary" onClick={addItem}>Add</Button>
                  </div>
                  {items.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{it.product_name}</TableCell>
                            <TableCell className="text-sm font-mono">{it.batch_no}</TableCell>
                            <TableCell>{it.qty}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <Button className="w-full" disabled={createMutation.isPending || items.length === 0} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? "Creating..." : "Create Transfer (Draft)"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />All Transfers</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer #</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.transfer_number}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{t.from_warehouse?.name}</span>
                        <ArrowRight className="h-3 w-3 inline mx-1.5 text-muted-foreground" />
                        <span className="font-medium">{t.to_warehouse?.name}</span>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(t.transfer_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[t.status] as any || "secondary"} className="capitalize">{t.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {t.status === "draft" && (
                            <>
                              <Button size="sm" variant="default" onClick={() => actionMutation.mutate({ transferId: t.id, action: "approve" })} disabled={actionMutation.isPending}>
                                <Check className="h-3 w-3 mr-1" />Approve & Dispatch
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => actionMutation.mutate({ transferId: t.id, action: "cancel" })} disabled={actionMutation.isPending}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {t.status === "in_transit" && (
                            <>
                              <Button size="sm" variant="default" onClick={() => actionMutation.mutate({ transferId: t.id, action: "receive" })} disabled={actionMutation.isPending}>
                                <Package className="h-3 w-3 mr-1" />Receive
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => actionMutation.mutate({ transferId: t.id, action: "cancel" })} disabled={actionMutation.isPending}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {transfers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No stock transfers yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
