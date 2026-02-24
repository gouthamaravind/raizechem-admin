import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function PriceLevels() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", is_default: false, sort_order: 0 });
  const qc = useQueryClient();

  const { data: levels = [], isLoading } = useQuery({
    queryKey: ["price_levels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_levels").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Count dealers per level
  const { data: dealerCounts = {} } = useQuery({
    queryKey: ["dealer_price_level_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("price_level_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((d: any) => { if (d.price_level_id) counts[d.price_level_id] = (counts[d.price_level_id] || 0) + 1; });
      return counts;
    },
  });

  // Count products with pricing per level
  const { data: productCounts = {} } = useQuery({
    queryKey: ["product_price_level_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_price_levels").select("price_level_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((d: any) => { counts[d.price_level_id] = (counts[d.price_level_id] || 0) + 1; });
      return counts;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      if (id) {
        const { error } = await supabase.from("price_levels").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("price_levels").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price_levels"] });
      setDialogOpen(false); setEditId(null); setForm({ name: "", description: "", is_default: false, sort_order: 0 });
      toast.success(editId ? "Price level updated" : "Price level added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_levels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price_levels"] });
      toast.success("Price level deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (l: any) => {
    setEditId(l.id);
    setForm({ name: l.name, description: l.description || "", is_default: l.is_default, sort_order: l.sort_order });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    mutation.mutate(editId ? { ...form, id: editId } : form);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Price Levels</h1>
            <p className="text-muted-foreground">Define pricing tiers for different customer types</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm({ name: "", description: "", is_default: false, sort_order: 0 }); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Level</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Price Level" : "Add Price Level"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>Name <span className="text-destructive">*</span></Label>
                  <Input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Distributor" />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={2} className="resize-none" />
                </div>
                <div className="space-y-1">
                  <Label>Sort Order</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
                </div>
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editId ? "Update" : "Add"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Tags className="h-4 w-4" />Configured Levels</CardTitle>
            <CardDescription>Assign these levels to dealers, then set per-product prices in the Products page.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : levels.length === 0 ? <p className="text-muted-foreground text-center py-8">No price levels configured.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Description</TableHead>
                  <TableHead>Dealers</TableHead><TableHead>Products Priced</TableHead>
                  <TableHead>Default</TableHead><TableHead>Order</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {levels.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.description || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{(dealerCounts as any)[l.id] || 0}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{(productCounts as any)[l.id] || 0}</Badge></TableCell>
                      <TableCell>{l.is_default ? <Badge>Default</Badge> : "—"}</TableCell>
                      <TableCell>{l.sort_order}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {!l.is_default && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this price level?")) deleteMutation.mutate(l.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
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
