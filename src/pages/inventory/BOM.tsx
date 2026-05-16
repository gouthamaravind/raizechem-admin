import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type BOMItem = {
  raw_material_id: string;
  qty: number;
  unit: string;
  purchase_rate: number;
  packing_rate: number;
  scheme_1: number;
  scheme_2: number;
  scheme_3: number;
  notes: string;
};

const UNITS = ["kg", "g", "L", "ml", "pcs", "box", "bag"];
const blankItem = (): BOMItem => ({
  raw_material_id: "", qty: 1, unit: "kg",
  purchase_rate: 0, packing_rate: 0, scheme_1: 0, scheme_2: 0, scheme_3: 0, notes: "",
});

const itemEffective = (i: BOMItem) =>
  i.qty * (i.purchase_rate + i.packing_rate) - (i.scheme_1 + i.scheme_2 + i.scheme_3);

export default function BOM() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [bomName, setBomName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BOMItem[]>([blankItem()]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ["bom-headers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bom_headers" as any)
        .select("*, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ["bom-items", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const { data, error } = await supabase.from("bom_items" as any)
        .select("*, products:raw_material_id(name, unit)")
        .eq("bom_id", expandedId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, unit").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const totalCost = items.reduce((s, i) => s + itemEffective(i), 0);

  const createBOM = useMutation({
    mutationFn: async () => {
      if (!productId || !bomName) throw new Error("Select product and enter BOM name");
      const valid = items.filter((i) => i.raw_material_id && i.qty > 0);
      if (valid.length === 0) throw new Error("Add at least one raw material");

      const { data: header, error: hErr } = await supabase.from("bom_headers" as any)
        .insert({
          product_id: productId, bom_name: bomName, notes: notes || null,
          created_by: user?.id, computed_cost: totalCost,
        })
        .select("id").single();
      if (hErr) throw hErr;

      const payload = valid.map((i) => ({
        bom_id: (header as any).id,
        raw_material_id: i.raw_material_id,
        qty: i.qty,
        unit: i.unit || null,
        purchase_rate: i.purchase_rate,
        packing_rate: i.packing_rate,
        scheme_1: i.scheme_1, scheme_2: i.scheme_2, scheme_3: i.scheme_3,
        notes: i.notes || null,
      }));

      const { error: iErr } = await supabase.from("bom_items" as any).insert(payload);
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom-headers"] });
      setDialogOpen(false);
      setProductId(""); setBomName(""); setNotes("");
      setItems([blankItem()]);
      toast.success("BOM created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => setItems([...items, blankItem()]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, f: keyof BOMItem, v: any) => {
    const n = [...items]; (n[i] as any)[f] = v; setItems(n);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bill of Materials</h1>
            <p className="text-muted-foreground">Define raw material, packing & scheme costs per finished product</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Create</Button></DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Bill of Materials</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createBOM.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Finished Product *</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>BOM Name *</Label>
                    <Input value={bomName} onChange={(e) => setBomName(e.target.value)} placeholder="e.g. Standard Recipe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Raw Materials & Pricing</Label>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">Material</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-24">Unit</TableHead>
                          <TableHead className="w-28">Purchase ₹</TableHead>
                          <TableHead className="w-24">Packing ₹</TableHead>
                          <TableHead className="w-20">Sch.1</TableHead>
                          <TableHead className="w-20">Sch.2</TableHead>
                          <TableHead className="w-20">Sch.3</TableHead>
                          <TableHead className="w-24 text-right">Effective</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Select value={item.raw_material_id} onValueChange={(v) => {
                                updateItem(i, "raw_material_id", v);
                                const p = products.find((p: any) => p.id === v);
                                if (p && (p as any).unit) updateItem(i, "unit", (p as any).unit);
                              }}>
                                <SelectTrigger><SelectValue placeholder="Material" /></SelectTrigger>
                                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell><Input type="number" step="0.01" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} /></TableCell>
                            <TableCell>
                              <Select value={item.unit} onValueChange={(v) => updateItem(i, "unit", v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell><Input type="number" step="0.01" value={item.purchase_rate || ""} onChange={(e) => updateItem(i, "purchase_rate", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={item.packing_rate || ""} onChange={(e) => updateItem(i, "packing_rate", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={item.scheme_1 || ""} onChange={(e) => updateItem(i, "scheme_1", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={item.scheme_2 || ""} onChange={(e) => updateItem(i, "scheme_2", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={item.scheme_3 || ""} onChange={(e) => updateItem(i, "scheme_3", Number(e.target.value))} /></TableCell>
                            <TableCell className="text-right font-mono text-sm">₹{itemEffective(item).toFixed(2)}</TableCell>
                            <TableCell>
                              {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Material</Button>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total BOM Cost: </span>
                      <span className="font-bold text-lg">₹{totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createBOM.isPending}>
                  {createBOM.isPending ? "Creating..." : `Create BOM (Cost: ₹${totalCost.toFixed(2)})`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : boms.length === 0 ? <p className="text-muted-foreground text-center py-8">No BOMs created yet.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>BOM Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Computed Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boms.map((b: any) => (
                    <Fragment key={b.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                        <TableCell>{expandedId === b.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{b.products?.name}</TableCell>
                        <TableCell>{b.bom_name}</TableCell>
                        <TableCell><Badge variant="outline">v{b.version || 1}</Badge></TableCell>
                        <TableCell className="text-right font-mono">₹{Number(b.computed_cost || 0).toFixed(2)}</TableCell>
                        <TableCell><Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{new Date(b.created_at).toLocaleDateString("en-IN")}</TableCell>
                      </TableRow>
                      {expandedId === b.id && bomItems.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="text-xs font-medium mb-2 text-muted-foreground">RAW MATERIALS</div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Material</TableHead>
                                  <TableHead>Qty</TableHead>
                                  <TableHead>Purchase</TableHead>
                                  <TableHead>Packing</TableHead>
                                  <TableHead>Schemes</TableHead>
                                  <TableHead className="text-right">Effective</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {bomItems.map((item: any) => {
                                  const eff = item.qty * (Number(item.purchase_rate||0) + Number(item.packing_rate||0)) - (Number(item.scheme_1||0)+Number(item.scheme_2||0)+Number(item.scheme_3||0));
                                  return (
                                    <TableRow key={item.id}>
                                      <TableCell className="font-medium">{item.products?.name}</TableCell>
                                      <TableCell>{item.qty} {item.unit || item.products?.unit || ""}</TableCell>
                                      <TableCell>₹{Number(item.purchase_rate||0).toFixed(2)}</TableCell>
                                      <TableCell>₹{Number(item.packing_rate||0).toFixed(2)}</TableCell>
                                      <TableCell className="text-xs">
                                        {Number(item.scheme_1||0)>0 && <span>S1: ₹{item.scheme_1} </span>}
                                        {Number(item.scheme_2||0)>0 && <span>S2: ₹{item.scheme_2} </span>}
                                        {Number(item.scheme_3||0)>0 && <span>S3: ₹{item.scheme_3}</span>}
                                      </TableCell>
                                      <TableCell className="text-right font-mono">₹{eff.toFixed(2)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
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
