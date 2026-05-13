import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock, Unlock, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";

type Slab = {
  slab_label: string;
  slab_min: number;
  slab_max: number | null;
  purchase_price: number;
  packing_price: number;
  scheme_1: number;
  scheme_2: number;
  scheme_3: number;
  margin_pct: number;
  gst_rate: number;
};

const blank = (): Slab => ({
  slab_label: "Default", slab_min: 0, slab_max: null,
  purchase_price: 0, packing_price: 0, scheme_1: 0, scheme_2: 0, scheme_3: 0,
  margin_pct: 20, gst_rate: 18,
});

export const computeStack = (s: Slab) => {
  const baseCost = s.purchase_price + s.packing_price;
  const afterSchemes = baseCost - (s.scheme_1 + s.scheme_2 + s.scheme_3);
  const exGst = afterSchemes * (1 + s.margin_pct / 100);
  const mrp = exGst * (1 + s.gst_rate / 100);
  return {
    baseCost: Math.max(0, baseCost),
    afterSchemes: Math.max(0, afterSchemes),
    exGst: Math.max(0, exGst),
    mrp: Math.max(0, mrp),
  };
};

export default function PricingMatrix() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slab, setSlab] = useState<Slab>(blank());

  const { data: products = [] } = useQuery({
    queryKey: ["products-pricing-list"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["pricing-matrix", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_pricing_matrix" as any)
        .select("*")
        .eq("product_id", productId)
        .order("slab_min");
      if (error) throw error;
      return data || [];
    },
  });

  const calc = useMemo(() => computeStack(slab), [slab]);

  const addSlab = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Select a product");
      if (!slab.slab_label) throw new Error("Slab label required");
      const c = computeStack(slab);
      const { error } = await supabase.from("product_pricing_matrix" as any).insert({
        product_id: productId,
        slab_label: slab.slab_label,
        slab_min: slab.slab_min,
        slab_max: slab.slab_max,
        purchase_price: slab.purchase_price,
        packing_price: slab.packing_price,
        scheme_1: slab.scheme_1, scheme_2: slab.scheme_2, scheme_3: slab.scheme_3,
        margin_pct: slab.margin_pct,
        gst_rate: slab.gst_rate,
        ex_gst_price: c.exGst,
        mrp: c.mrp,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slab added");
      setDialogOpen(false);
      setSlab(blank());
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleLock = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from("product_pricing_matrix" as any).update({
        is_locked: !row.is_locked,
        locked_at: !row.is_locked ? new Date().toISOString() : null,
        locked_by: !row.is_locked ? user?.id : null,
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_pricing_matrix" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricing Matrix</h1>
          <p className="text-muted-foreground">Custom turnover slabs per product → schemes → margin → GST → MRP</p>
        </div>

        <Card>
          <CardContent className="pt-6 flex items-end gap-3">
            <div className="space-y-2 flex-1 max-w-md">
              <Label>Select Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Pick a product to manage pricing" /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!productId}><Plus className="h-4 w-4 mr-2" />Add Slab</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Add Pricing Slab</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Slab Label *</Label>
                      <Input value={slab.slab_label} onChange={(e) => setSlab({ ...slab, slab_label: e.target.value })} placeholder="Retail / Distributor / Bulk" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>TO Min (₹)</Label>
                        <Input type="number" value={slab.slab_min || ""} onChange={(e) => setSlab({ ...slab, slab_min: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1">
                        <Label>TO Max (₹, blank=∞)</Label>
                        <Input type="number" value={slab.slab_max ?? ""} onChange={(e) => setSlab({ ...slab, slab_max: e.target.value ? Number(e.target.value) : null })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label>Purchase ₹</Label><Input type="number" step="0.01" value={slab.purchase_price || ""} onChange={(e) => setSlab({ ...slab, purchase_price: Number(e.target.value) })} /></div>
                      <div className="space-y-1"><Label>Packing ₹</Label><Input type="number" step="0.01" value={slab.packing_price || ""} onChange={(e) => setSlab({ ...slab, packing_price: Number(e.target.value) })} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1"><Label>Sch.1</Label><Input type="number" step="0.01" value={slab.scheme_1 || ""} onChange={(e) => setSlab({ ...slab, scheme_1: Number(e.target.value) })} /></div>
                      <div className="space-y-1"><Label>Sch.2</Label><Input type="number" step="0.01" value={slab.scheme_2 || ""} onChange={(e) => setSlab({ ...slab, scheme_2: Number(e.target.value) })} /></div>
                      <div className="space-y-1"><Label>Sch.3</Label><Input type="number" step="0.01" value={slab.scheme_3 || ""} onChange={(e) => setSlab({ ...slab, scheme_3: Number(e.target.value) })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label>Margin %</Label><Input type="number" step="0.01" value={slab.margin_pct || ""} onChange={(e) => setSlab({ ...slab, margin_pct: Number(e.target.value) })} /></div>
                      <div className="space-y-1"><Label>GST %</Label><Input type="number" step="0.01" value={slab.gst_rate || ""} onChange={(e) => setSlab({ ...slab, gst_rate: Number(e.target.value) })} /></div>
                    </div>
                  </div>

                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> Live Calculation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm font-mono">
                      <div className="flex justify-between"><span>Purchase + Packing</span><span>₹{calc.baseCost.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground">– (Sch1+Sch2+Sch3)</div>
                      <div className="flex justify-between border-t pt-1"><span>After Schemes (TO base)</span><span>₹{calc.afterSchemes.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground">+ Margin {slab.margin_pct}%</div>
                      <div className="flex justify-between border-t pt-1"><span className="font-semibold">Ex-GST Price</span><span className="font-semibold">₹{calc.exGst.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground">+ GST {slab.gst_rate}%</div>
                      <div className="flex justify-between border-t pt-2 text-base"><span className="font-bold">MRP (Incl. GST)</span><span className="font-bold text-primary">₹{calc.mrp.toFixed(2)}</span></div>
                    </CardContent>
                  </Card>
                </div>
                <Button onClick={() => addSlab.mutate()} disabled={addSlab.isPending} className="w-full">
                  {addSlab.isPending ? "Saving..." : "Save Slab"}
                </Button>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {productId && (
          <Card>
            <CardContent className="pt-6">
              {rows.length === 0 ? <p className="text-muted-foreground text-center py-8">No slabs defined for this product yet.</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slab</TableHead>
                      <TableHead>TO Range</TableHead>
                      <TableHead>Purchase</TableHead>
                      <TableHead>Packing</TableHead>
                      <TableHead>Schemes</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>GST</TableHead>
                      <TableHead className="text-right">Ex-GST</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.slab_label} {r.is_locked && <Badge variant="secondary" className="ml-1">Locked</Badge>}</TableCell>
                        <TableCell className="text-xs">₹{Number(r.slab_min).toLocaleString()} – {r.slab_max ? `₹${Number(r.slab_max).toLocaleString()}` : "∞"}</TableCell>
                        <TableCell>₹{Number(r.purchase_price).toFixed(2)}</TableCell>
                        <TableCell>₹{Number(r.packing_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">₹{(Number(r.scheme_1)+Number(r.scheme_2)+Number(r.scheme_3)).toFixed(2)}</TableCell>
                        <TableCell>{Number(r.margin_pct)}%</TableCell>
                        <TableCell>{Number(r.gst_rate)}%</TableCell>
                        <TableCell className="text-right font-mono">₹{Number(r.ex_gst_price).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">₹{Number(r.mrp).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => toggleLock.mutate(r)} title={r.is_locked ? "Unlock" : "Lock"}>
                              {r.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this slab?")) remove.mutate(r.id); }} disabled={r.is_locked}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
