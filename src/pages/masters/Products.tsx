import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBranch } from "@/hooks/useBranch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, Pencil, Download, Tags, Package } from "lucide-react";
import { AlterButton } from "@/components/tally/AlterButton";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductPacksDialog } from "@/components/products/ProductPacksDialog";

const emptyForm = {
  name: "", slug: "", hsn_code: "", unit: "KG", gst_rate: 18,
  category: "", description: "", sale_price: 0, purchase_price_default: 0,
  min_stock_alert_qty: 0, brand: "",
};
const UNITS = ["KG", "L", "MT", "PCS", "DRUM", "BAG", "BOX", "TON", "GM", "ML"];
const GST_RATES = [0, 5, 12, 18, 28];
const CATEGORIES = ["Pesticide", "Herbicide", "Fertiliser", "Insecticide"];

type FormErrors = Partial<Record<keyof typeof emptyForm, string>>;

export default function Products() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formLevelPrices, setFormLevelPrices] = useState<Record<string, string>>({});
  const [pricingProductId, setPricingProductId] = useState<string | null>(null);
  const [levelPrices, setLevelPrices] = useState<Record<string, string>>({});
  const [packsProduct, setPacksProduct] = useState<any | null>(null);
  const qc = useQueryClient();
  const { branchId } = useBranch();

  // Fetch price levels
  const { data: priceLevels = [] } = useQuery({
    queryKey: ["price_levels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_levels").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all product price levels for display
  const { data: allProductPrices = [] } = useQuery({
    queryKey: ["product_price_levels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_price_levels").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", branchId],
    queryFn: async () => {
      let q = supabase.from("products").select("*").order("name");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: packCounts = {} } = useQuery({
    queryKey: ["product_packs_count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_packs").select("product_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.product_id] = (counts[r.product_id] || 0) + 1; });
      return counts;
    },
  });

  const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Product name is required";
    if (form.name.length > 200) e.name = "Name too long (max 200)";
    if (form.hsn_code && !/^\d{4,8}$/.test(form.hsn_code)) e.hsn_code = "HSN must be 4-8 digits";
    if (form.sale_price < 0) e.sale_price = "Cannot be negative";
    if (form.purchase_price_default < 0) e.purchase_price_default = "Cannot be negative";
    if (form.min_stock_alert_qty < 0) e.min_stock_alert_qty = "Cannot be negative";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      const slug = rest.slug || rest.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      let productId = id;
      if (id) {
        const { error } = await supabase.from("products").update({ ...rest, slug }).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert({ ...rest, slug, branch_id: branchId }).select("id").single();
        if (error) throw error;
        productId = data.id;
      }
      // Save price levels inline
      const upserts = Object.entries(formLevelPrices)
        .filter(([, val]) => val !== "" && Number(val) >= 0)
        .map(([levelId, price]) => ({ product_id: productId, price_level_id: levelId, price: Number(price) }));
      await supabase.from("product_price_levels").delete().eq("product_id", productId);
      if (upserts.length > 0) {
        const { error: plErr } = await supabase.from("product_price_levels").insert(upserts);
        if (plErr) throw plErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product_price_levels"] });
      setDialogOpen(false); setEditId(null); setForm(emptyForm); setErrors({}); setFormLevelPrices({});
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

  const savePricesMutation = useMutation({
    mutationFn: async ({ productId, prices }: { productId: string; prices: Record<string, string> }) => {
      // Upsert all price levels for this product
      const upserts = Object.entries(prices)
        .filter(([, val]) => val !== "" && Number(val) >= 0)
        .map(([levelId, price]) => ({
          product_id: productId,
          price_level_id: levelId,
          price: Number(price),
        }));
      
      // Delete existing prices for this product first
      await supabase.from("product_price_levels").delete().eq("product_id", productId);
      
      if (upserts.length > 0) {
        const { error } = await supabase.from("product_price_levels").insert(upserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_price_levels"] });
      setPricingProductId(null);
      setLevelPrices({});
      toast.success("Price levels saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPricing = (productId: string) => {
    setPricingProductId(productId);
    const existing: Record<string, string> = {};
    allProductPrices.filter((pp: any) => pp.product_id === productId).forEach((pp: any) => {
      existing[pp.price_level_id] = String(pp.price);
    });
    setLevelPrices(existing);
  };

  const filtered = products.filter((p: any) => {
    const s = search.toLowerCase();
    const match = p.name?.toLowerCase().includes(s) || p.hsn_code?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s);
    return match && (catFilter === "all" || p.category === catFilter);
  });

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, slug: p.slug || "", hsn_code: p.hsn_code || "", unit: p.unit,
      gst_rate: p.gst_rate, category: p.category || "", description: p.description || "",
      sale_price: p.sale_price || 0, purchase_price_default: p.purchase_price_default || 0,
      min_stock_alert_qty: p.min_stock_alert_qty || 0, brand: p.brand || "",
    });
    // Pre-fill price levels for editing
    const existing: Record<string, string> = {};
    allProductPrices.filter((pp: any) => pp.product_id === p.id).forEach((pp: any) => {
      existing[pp.price_level_id] = String(pp.price);
    });
    setFormLevelPrices(existing);
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(editId ? { ...form, id: editId } : form);
  };

  const set = (k: string, v: any) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof FormErrors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const FieldError = ({ field }: { field: keyof FormErrors }) =>
    errors[field] ? <p className="text-xs text-destructive mt-1">{errors[field]}</p> : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">Manage your product catalog ({filtered.length} of {products.length})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("products.csv", filtered, [
              { key: "name", label: "Name" }, { key: "hsn_code", label: "HSN" }, { key: "unit", label: "Unit" },
              { key: "gst_rate", label: "GST %" }, { key: "sale_price", label: "Sale Price" },
              { key: "purchase_price_default", label: "Purchase Price" }, { key: "category", label: "Category" },
              { key: "min_stock_alert_qty", label: "Min Alert Qty" },
            ])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); setErrors({}); setFormLevelPrices({}); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Create</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Alter Product" : "Create Product"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Product Info */}
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-foreground">Product Details</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <Label>Name <span className="text-destructive">*</span></Label>
                        <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Hydrochloric Acid 35%" className={errors.name ? "border-destructive" : ""} />
                        <FieldError field="name" />
                      </div>
                      <div className="space-y-1">
                        <Label>HSN Code</Label>
                        <Input value={form.hsn_code} onChange={(e) => set("hsn_code", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 28061010" maxLength={8} className={`font-mono ${errors.hsn_code ? "border-destructive" : ""}`} />
                        <FieldError field="hsn_code" />
                      </div>
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Select value={form.category || "none"} onValueChange={(v) => set("category", v === "none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Raizechem Brand</Label>
                        <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. ShieldX, Azotricon" />
                      </div>
                      <div className="space-y-1">
                        <Label>Description</Label>
                        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional notes" rows={1} className="resize-none" />
                      </div>
                    </div>
                  </fieldset>

                  {/* Pricing & Tax */}
                  <fieldset className="space-y-3 border-t pt-4">
                    <legend className="text-sm font-semibold text-foreground">Pricing & Tax</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Unit of Measure</Label>
                        <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>GST Rate</Label>
                        <Select value={String(form.gst_rate)} onValueChange={(v) => set("gst_rate", Number(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Sale Price (₹ per {form.unit})</Label>
                        <Input type="number" value={form.sale_price || ""} onChange={(e) => set("sale_price", Number(e.target.value))} min={0} step="0.01" className={errors.sale_price ? "border-destructive" : ""} />
                        <FieldError field="sale_price" />
                      </div>
                      <div className="space-y-1">
                        <Label>Purchase Price (₹ per {form.unit})</Label>
                        <Input type="number" value={form.purchase_price_default || ""} onChange={(e) => set("purchase_price_default", Number(e.target.value))} min={0} step="0.01" className={errors.purchase_price_default ? "border-destructive" : ""} />
                        <FieldError field="purchase_price_default" />
                      </div>
                    </div>
                    {form.sale_price > 0 && form.gst_rate > 0 && (
                      <div className="rounded-md bg-accent/50 p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span>Base Price</span><span>₹{form.sale_price.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>GST ({form.gst_rate}%)</span><span>₹{(form.sale_price * form.gst_rate / 100).toFixed(2)}</span></div>
                        <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Selling Price (incl. GST)</span><span>₹{(form.sale_price * (1 + form.gst_rate / 100)).toFixed(2)}</span></div>
                      </div>
                    )}
                  </fieldset>

                  {/* Price Levels (Retail, Dealer, etc.) */}
                  {priceLevels.length > 0 && (
                    <fieldset className="space-y-3 border-t pt-4">
                      <legend className="text-sm font-semibold text-foreground">Price Levels</legend>
                      <p className="text-xs text-muted-foreground">Set custom prices per tier. Leave blank to use default sale price.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {priceLevels.map((pl: any) => (
                          <div key={pl.id} className="space-y-1">
                            <Label className="text-xs">{pl.name}</Label>
                            <Input
                              type="number" min={0} step="0.01"
                              placeholder={`₹ ${form.sale_price || 0}`}
                              value={formLevelPrices[pl.id] || ""}
                              onChange={(e) => setFormLevelPrices(prev => ({ ...prev, [pl.id]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {/* Inventory */}
                  <fieldset className="space-y-3 border-t pt-4">
                    <legend className="text-sm font-semibold text-foreground">Inventory Settings</legend>
                    <div className="space-y-1">
                      <Label>Min Stock Alert Qty ({form.unit})</Label>
                      <Input type="number" value={form.min_stock_alert_qty || ""} onChange={(e) => set("min_stock_alert_qty", Number(e.target.value))} min={0} placeholder="Alert when stock falls below this" className={errors.min_stock_alert_qty ? "border-destructive" : ""} />
                      <p className="text-xs text-muted-foreground">Leave 0 to disable stock alerts for this product</p>
                      <FieldError field="min_stock_alert_qty" />
                    </div>
                  </fieldset>

                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : editId ? "Alter" : "Create"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, HSN, or category..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="w-40"><SelectValue placeholder="All Categories" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No products found.</p> : (
              <div className="overflow-x-auto">
                <Table>
                   <TableHeader><TableRow>
                     <TableHead>Name</TableHead><TableHead>Brand</TableHead><TableHead>HSN</TableHead><TableHead>Unit</TableHead>
                     <TableHead>GST</TableHead><TableHead>Sale Price</TableHead><TableHead>Packs</TableHead><TableHead>Price Levels</TableHead>
                     <TableHead>Category</TableHead><TableHead>Active</TableHead>
                     <TableHead className="w-20"></TableHead>
                   </TableRow></TableHeader>
                   <TableBody>
                     {filtered.map((p: any) => {
                       const productPriceCount = allProductPrices.filter((pp: any) => pp.product_id === p.id).length;
                       return (
                       <TableRow key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                         <TableCell className="font-medium">{p.name}</TableCell>
                         <TableCell className="text-xs text-muted-foreground">{p.brand || "—"}</TableCell>
                         <TableCell className="text-xs font-mono text-muted-foreground">{p.hsn_code || "—"}</TableCell>
                         <TableCell>{p.unit}</TableCell>
                         <TableCell>{p.gst_rate}%</TableCell>
                         <TableCell>₹{(p.sale_price || 0).toLocaleString("en-IN")}</TableCell>
                         <TableCell>
                           <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setPacksProduct(p)}>
                             <Package className="h-3 w-3" />
                             {(packCounts as any)[p.id] ? `${(packCounts as any)[p.id]} packs` : "Add"}
                           </Button>
                         </TableCell>
                         <TableCell>
                           <Popover open={pricingProductId === p.id} onOpenChange={(open) => { if (open) openPricing(p.id); else { setPricingProductId(null); setLevelPrices({}); } }}>
                             <PopoverTrigger asChild>
                               <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                 <Tags className="h-3 w-3" />
                                 {productPriceCount > 0 ? `${productPriceCount} set` : "Set"}
                               </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-72" align="start">
                               <div className="space-y-3">
                                 <p className="text-sm font-semibold">Price Levels — {p.name}</p>
                                 <p className="text-xs text-muted-foreground">Base sale price: ₹{(p.sale_price || 0).toLocaleString("en-IN")}</p>
                                 {priceLevels.length === 0 ? (
                                   <p className="text-xs text-muted-foreground">No price levels configured. Go to Masters → Price Levels to add them.</p>
                                 ) : (
                                   <div className="space-y-2">
                                     {priceLevels.map((pl: any) => (
                                       <div key={pl.id} className="flex items-center gap-2">
                                         <Label className="text-xs w-24 shrink-0">{pl.name}</Label>
                                         <Input
                                           type="number" min={0} step="0.01"
                                           className="h-8 text-xs"
                                           placeholder={`₹ ${p.sale_price || 0}`}
                                           value={levelPrices[pl.id] || ""}
                                           onChange={(e) => setLevelPrices(prev => ({ ...prev, [pl.id]: e.target.value }))}
                                         />
                                       </div>
                                     ))}
                                     <Button size="sm" className="w-full mt-2" disabled={savePricesMutation.isPending}
                                       onClick={() => savePricesMutation.mutate({ productId: p.id, prices: levelPrices })}>
                                       {savePricesMutation.isPending ? "Saving..." : "Save Prices"}
                                     </Button>
                                   </div>
                                 )}
                               </div>
                             </PopoverContent>
                           </Popover>
                         </TableCell>
                         <TableCell>{p.category ? <Badge variant="secondary">{p.category}</Badge> : "—"}</TableCell>
                         <TableCell><Switch checked={p.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })} /></TableCell>
                         <TableCell>
                           <AlterButton onClick={() => openEdit(p)} />
                         </TableCell>
                       </TableRow>
                     );})}
                   </TableBody>
                 </Table>
               </div>
             )}
           </CardContent>
          </Card>
        </div>
        <ProductPacksDialog
          open={!!packsProduct}
          onOpenChange={(v) => { if (!v) setPacksProduct(null); }}
          product={packsProduct}
        />
      </DashboardLayout>
   );
 }
