import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Plus, Pencil } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type BatchForm = {
  product_id: string;
  batch_no: string;
  mfg_date: string;
  exp_date: string;
  purchase_rate: number;
  current_qty: number;
};

const emptyForm: BatchForm = { product_id: "", batch_no: "", mfg_date: "", exp_date: "", purchase_rate: 0, current_qty: 0 };

export default function Batches() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"create" | "alter" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BatchForm>(emptyForm);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_batches")
        .select("*, products(name, unit)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, unit, purchase_price_default").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(
    () => batches.filter((b: any) => {
      const s = search.toLowerCase();
      return b.batch_no?.toLowerCase().includes(s) || b.products?.name?.toLowerCase().includes(s);
    }),
    [batches, search]
  );

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const d = new Date(date);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 90;
  };

  const openCreate = () => { setMode("create"); setEditingId(null); setForm(emptyForm); };
  const openAlter = (b: any) => {
    setMode("alter");
    setEditingId(b.id);
    setForm({
      product_id: b.product_id,
      batch_no: b.batch_no || "",
      mfg_date: b.mfg_date || "",
      exp_date: b.exp_date || "",
      purchase_rate: Number(b.purchase_rate) || 0,
      current_qty: Number(b.current_qty) || 0,
    });
  };
  const close = () => { setMode(null); setEditingId(null); setForm(emptyForm); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.product_id || !form.batch_no) throw new Error("Product and Batch No are required");

      if (mode === "create") {
        const { data: existing } = await supabase
          .from("product_batches").select("id")
          .eq("product_id", form.product_id).eq("batch_no", form.batch_no).maybeSingle();
        if (existing) throw new Error("Batch number already exists for this product");

        const { error } = await supabase.from("product_batches").insert({
          product_id: form.product_id,
          batch_no: form.batch_no,
          mfg_date: form.mfg_date || null,
          exp_date: form.exp_date || null,
          purchase_rate: form.purchase_rate,
          current_qty: form.current_qty,
          created_by: user?.id,
        });
        if (error) throw error;
      } else if (mode === "alter" && editingId) {
        const { error } = await supabase.from("product_batches").update({
          product_id: form.product_id,
          batch_no: form.batch_no,
          mfg_date: form.mfg_date || null,
          exp_date: form.exp_date || null,
          purchase_rate: form.purchase_rate,
          current_qty: form.current_qty,
        }).eq("id", editingId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      toast.success(mode === "create" ? "Batch created" : "Batch updated");
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Batches</h1><p className="text-muted-foreground">All product batches</p></div>
          <div className="flex gap-2">
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Create</Button>
            <Button variant="outline" onClick={() => exportToCsv("batches.csv", filtered.map((b: any) => ({ product: b.products?.name, batch_no: b.batch_no, mfg_date: b.mfg_date, exp_date: b.exp_date, purchase_rate: b.purchase_rate, current_qty: b.current_qty })), [{ key: "product", label: "Product" }, { key: "batch_no", label: "Batch No" }, { key: "mfg_date", label: "Mfg Date" }, { key: "exp_date", label: "Exp Date" }, { key: "purchase_rate", label: "Purchase Rate" }, { key: "current_qty", label: "Current Qty" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by product or batch number..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No batches. Click Create or use Stock In.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch No</TableHead><TableHead>Mfg Date</TableHead><TableHead>Exp Date</TableHead><TableHead>Purchase Rate</TableHead><TableHead>Current Qty</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.products?.name}</TableCell>
                      <TableCell>{b.batch_no}</TableCell>
                      <TableCell>{b.mfg_date || "—"}</TableCell>
                      <TableCell>
                        {b.exp_date || "—"}
                        {isExpiringSoon(b.exp_date) && <Badge variant="destructive" className="ml-2 text-[10px]">Expiring</Badge>}
                      </TableCell>
                      <TableCell>₹{Number(b.purchase_rate).toLocaleString("en-IN")}</TableCell>
                      <TableCell className={Number(b.current_qty) <= 0 ? "text-destructive font-semibold" : ""}>{b.current_qty} {b.products?.unit}</TableCell>
                      <TableCell className="text-right">
                        {isAdmin ? (
                          <Button size="sm" variant="ghost" onClick={() => openAlter(b)}><Pencil className="h-4 w-4 mr-1" />Alter</Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Admin only</span>
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

      <Dialog open={mode !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{mode === "create" ? "Create Batch" : "Alter Batch"}</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => {
                  const p: any = products.find((p: any) => p.id === v);
                  setForm((f) => ({
                    ...f,
                    product_id: v,
                    purchase_rate: f.purchase_rate || (p ? Number(p.purchase_price_default) || 0 : 0),
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Batch No *</Label><Input required value={form.batch_no} onChange={(e) => setForm((f) => ({ ...f, batch_no: e.target.value }))} placeholder="e.g. B2025-001" /></div>
              <div className="space-y-2"><Label>Current Qty</Label><Input type="number" min={0} step="0.01" value={form.current_qty || ""} onChange={(e) => setForm((f) => ({ ...f, current_qty: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Purchase Rate (₹)</Label><Input type="number" min={0} step="0.01" value={form.purchase_rate || ""} onChange={(e) => setForm((f) => ({ ...f, purchase_rate: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Mfg Date</Label><Input type="date" value={form.mfg_date} onChange={(e) => setForm((f) => ({ ...f, mfg_date: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Exp Date</Label><Input type="date" value={form.exp_date} onChange={(e) => setForm((f) => ({ ...f, exp_date: e.target.value }))} /></div>
            </div>
            {mode === "alter" && (
              <p className="text-xs text-muted-foreground">Note: Altering Current Qty does not create a stock ledger entry. Use Stock In for receipts.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : mode === "create" ? "Create" : "Update"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
