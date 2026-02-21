import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { toast } from "sonner";

export default function StockIn() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [qty, setQty] = useState(0);
  const [rate, setRate] = useState(0);
  const [search, setSearch] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, unit, purchase_price_default").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: recentTxns = [] } = useQuery({
    queryKey: ["recent-stock-in"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_txn").select("*, products(name), product_batches(batch_no)").eq("txn_type", "PURCHASE").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const stockInMutation = useMutation({
    mutationFn: async () => {
      if (!productId || !batchNo || qty <= 0) throw new Error("Fill all required fields");

      // Check if batch exists
      const { data: existing } = await supabase.from("product_batches").select("id, current_qty").eq("product_id", productId).eq("batch_no", batchNo).maybeSingle();

      let batchId: string;
      if (existing) {
        // Update existing batch qty
        const { error } = await supabase.from("product_batches").update({ current_qty: Number(existing.current_qty) + qty, purchase_rate: rate }).eq("id", existing.id);
        if (error) throw error;
        batchId = existing.id;
      } else {
        // Create new batch
        const { data, error } = await supabase.from("product_batches").insert({
          product_id: productId, batch_no: batchNo, mfg_date: mfgDate || null,
          exp_date: expDate || null, purchase_rate: rate, current_qty: qty,
          created_by: user?.id,
        }).select("id").single();
        if (error) throw error;
        batchId = data.id;
      }

      // Create inventory txn
      const { error: txnErr } = await supabase.from("inventory_txn").insert({
        txn_type: "PURCHASE" as any, ref_type: "stock_in", product_id: productId,
        batch_id: batchId, qty_in: qty, qty_out: 0, rate, created_by: user?.id,
      });
      if (txnErr) throw txnErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["recent-stock-in"] });
      setProductId(""); setBatchNo(""); setMfgDate(""); setExpDate(""); setQty(0); setRate(0);
      toast.success("Stock added successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedProduct = products.find((p: any) => p.id === productId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Stock In</h1><p className="text-muted-foreground">Record incoming stock purchases</p></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>New Stock Entry</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); stockInMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select value={productId} onValueChange={(v) => { setProductId(v); const p = products.find((p: any) => p.id === v); if (p) setRate(Number((p as any).purchase_price_default) || 0); }}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Batch No *</Label><Input required value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="e.g. B2025-001" /></div>
                  <div className="space-y-2"><Label>Quantity *</Label><Input type="number" required min={0.01} step="0.01" value={qty || ""} onChange={(e) => setQty(Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label>Purchase Rate (₹)</Label><Input type="number" min={0} step="0.01" value={rate || ""} onChange={(e) => setRate(Number(e.target.value))} /></div>
                  <div className="space-y-2"><Label>Mfg Date</Label><Input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Exp Date</Label><Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={stockInMutation.isPending}>{stockInMutation.isPending ? "Adding..." : "Add Stock"}</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent Stock Entries</CardTitle></CardHeader>
            <CardContent>
              {recentTxns.length === 0 ? <p className="text-muted-foreground text-center py-8">No entries yet.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {recentTxns.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.products?.name}</TableCell>
                        <TableCell>{t.product_batches?.batch_no}</TableCell>
                        <TableCell>{t.qty_in}</TableCell>
                        <TableCell>₹{Number(t.rate).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
