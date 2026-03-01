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
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type BOMItem = { raw_material_id: string; qty: number; unit: string; notes: string };

export default function BOM() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [bomName, setBomName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BOMItem[]>([{ raw_material_id: "", qty: 1, unit: "", notes: "" }]);
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

  const createBOM = useMutation({
    mutationFn: async () => {
      if (!productId || !bomName) throw new Error("Select product and enter BOM name");
      const validItems = items.filter((i) => i.raw_material_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one raw material");

      const { data: header, error: hErr } = await supabase.from("bom_headers" as any)
        .insert({ product_id: productId, bom_name: bomName, notes: notes || null, created_by: user?.id })
        .select("id")
        .single();
      if (hErr) throw hErr;

      const bomItemsPayload = validItems.map((i) => ({
        bom_id: (header as any).id,
        raw_material_id: i.raw_material_id,
        qty: i.qty,
        unit: i.unit || null,
        notes: i.notes || null,
      }));

      const { error: iErr } = await supabase.from("bom_items" as any).insert(bomItemsPayload);
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom-headers"] });
      setDialogOpen(false);
      setProductId(""); setBomName(""); setNotes("");
      setItems([{ raw_material_id: "", qty: 1, unit: "", notes: "" }]);
      toast.success("BOM created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => setItems([...items, { raw_material_id: "", qty: 1, unit: "", notes: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, f: string, v: any) => { const n = [...items]; (n[i] as any)[f] = v; setItems(n); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bill of Materials</h1>
            <p className="text-muted-foreground">Define raw material requirements for finished products</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New BOM</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                  <Label>Raw Materials</Label>
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <Select value={item.raw_material_id} onValueChange={(v) => {
                        updateItem(i, "raw_material_id", v);
                        const p = products.find((p: any) => p.id === v);
                        if (p) updateItem(i, "unit", (p as any).unit || "");
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Material" /></SelectTrigger>
                        <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" className="w-20" placeholder="Qty" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} />
                      <Input className="w-20" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} />
                      {items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Material</Button>
                </div>
                <Button type="submit" className="w-full" disabled={createBOM.isPending}>{createBOM.isPending ? "Creating..." : "Create BOM"}</Button>
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
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boms.map((b: any) => (
                    <>
                      <TableRow key={b.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                        <TableCell>{expandedId === b.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{b.products?.name}</TableCell>
                        <TableCell>{b.bom_name}</TableCell>
                        <TableCell><Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{b.notes || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(b.created_at).toLocaleDateString("en-IN")}</TableCell>
                      </TableRow>
                      {expandedId === b.id && bomItems.length > 0 && (
                        <TableRow key={b.id + "-items"}>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="text-xs font-medium mb-2 text-muted-foreground">RAW MATERIALS</div>
                            <div className="space-y-1">
                              {bomItems.map((item: any) => (
                                <div key={item.id} className="flex gap-4 text-sm">
                                  <span className="font-medium">{item.products?.name}</span>
                                  <span>{item.qty} {item.unit || item.products?.unit || ""}</span>
                                  {item.notes && <span className="text-muted-foreground">— {item.notes}</span>}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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
