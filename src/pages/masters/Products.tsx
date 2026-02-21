import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";

const emptyForm = { name: "", slug: "", hsn_code: "", unit: "KG", gst_rate: 18, category: "", description: "", sale_price: 0, purchase_price_default: 0, min_stock_alert_qty: 0 };
const units = ["KG", "L", "MT", "PCS", "DRUM", "BAG", "BOX"];

export default function Products() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      const slug = rest.slug || rest.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      if (id) {
        const { error } = await supabase.from("products").update({ ...rest, slug }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...rest, slug });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false); setEditId(null); setForm(emptyForm);
      toast.success(editId ? "Product updated" : "Product added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("products").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const filtered = products.filter((p: any) => {
    const s = search.toLowerCase();
    const match = p.name?.toLowerCase().includes(s) || p.hsn_code?.toLowerCase().includes(s);
    return match && (catFilter === "all" || p.category === catFilter);
  });

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ name: p.name, slug: p.slug || "", hsn_code: p.hsn_code || "", unit: p.unit, gst_rate: p.gst_rate, category: p.category || "", description: p.description || "", sale_price: p.sale_price || 0, purchase_price_default: p.purchase_price_default || 0, min_stock_alert_qty: p.min_stock_alert_qty || 0 });
    setDialogOpen(true);
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Products</h1><p className="text-muted-foreground">Manage your product catalog</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("products.csv", filtered, [{ key: "name", label: "Name" }, { key: "hsn_code", label: "HSN" }, { key: "unit", label: "Unit" }, { key: "gst_rate", label: "GST %" }, { key: "sale_price", label: "Sale Price" }, { key: "category", label: "Category" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(editId ? { ...form, id: editId } : form); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2"><Label>Name *</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
                    <div className="space-y-2"><Label>HSN Code</Label><Input value={form.hsn_code} onChange={(e) => set("hsn_code", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Unit</Label><Select value={form.unit} onValueChange={(v) => set("unit", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>GST Rate (%)</Label><Input type="number" value={form.gst_rate} onChange={(e) => set("gst_rate", Number(e.target.value))} /></div>
                    <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Sale Price (₹)</Label><Input type="number" value={form.sale_price} onChange={(e) => set("sale_price", Number(e.target.value))} /></div>
                    <div className="space-y-2"><Label>Default Purchase Price (₹)</Label><Input type="number" value={form.purchase_price_default} onChange={(e) => set("purchase_price_default", Number(e.target.value))} /></div>
                    <div className="space-y-2"><Label>Min Stock Alert Qty</Label><Input type="number" value={form.min_stock_alert_qty} onChange={(e) => set("min_stock_alert_qty", Number(e.target.value))} /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : editId ? "Update" : "Add Product"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search products or HSN..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="w-40"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No products found.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>HSN</TableHead><TableHead>Unit</TableHead><TableHead>GST %</TableHead><TableHead>Sale Price</TableHead><TableHead>Category</TableHead><TableHead>Active</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.hsn_code || "—"}</TableCell>
                      <TableCell>{p.unit}</TableCell>
                      <TableCell>{p.gst_rate}%</TableCell>
                      <TableCell>₹{(p.sale_price || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>{p.category ? <Badge variant="secondary">{p.category}</Badge> : "—"}</TableCell>
                      <TableCell><Switch checked={p.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
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
