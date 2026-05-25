import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import {
  Download, Upload, Save, Search, ChevronRight, ChevronDown,
  Plus, Trash2, RotateCcw, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const HSN_RE = /^(\d{4}|\d{6}|\d{8})$/;
const isValidHsn = (v: string) => !v || HSN_RE.test(v.trim());


type Product = {
  id: string; name: string; brand: string | null; category: string | null;
  slug: string | null; hsn_code: string | null; gst_rate: number;
};
type Pack = {
  id: string; product_id: string; pack_label: string; units_per_case: number;
  unit_size: number | null; unit_uom: string | null;
  batch_no: string | null;
  purchase_price: number; packing_cost: number; price_finished_goods: number;
  scheme_1: number; scheme_2: number; margin: number;
  basic_price: number; gst_amount: number; price_inclusive_gst: number; mrp: number;
  is_active: boolean; sort_order: number;
};

const NUM_FIELDS = new Set<keyof Pack>([
  "units_per_case", "unit_size", "purchase_price", "packing_cost",
  "price_finished_goods", "scheme_1", "scheme_2", "margin",
  "basic_price", "gst_amount", "price_inclusive_gst", "mrp",
]);

type ViewMode = "pricing" | "costing" | "all";

const PRICING_COLS: Array<{ key: keyof Pack; label: string }> = [
  { key: "basic_price", label: "Basic" },
  { key: "gst_amount", label: "GST" },
  { key: "price_inclusive_gst", label: "Incl GST" },
  { key: "mrp", label: "MRP" },
];
const COSTING_COLS: Array<{ key: keyof Pack; label: string }> = [
  { key: "purchase_price", label: "Purchase" },
  { key: "packing_cost", label: "Packing" },
  { key: "price_finished_goods", label: "PFG" },
  { key: "scheme_1", label: "Sch1" },
  { key: "scheme_2", label: "Sch2" },
  { key: "margin", label: "Margin" },
];

const UOM_OPTIONS = ["L", "ml", "kg", "g"];
const fmt = (n: number) => n ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";

export default function PriceList() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("pricing");
  const [edits, setEdits] = useState<Record<string, Partial<Pack>>>({});
  const [pendingNew, setPendingNew] = useState<Record<string, Partial<Pack>[]>>({});
  const [productEdits, setProductEdits] = useState<Record<string, { hsn_code?: string; gst_rate?: number }>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState<{ id: string; label: string } | null>(null);
  const [bulkHsn, setBulkHsn] = useState("");
  const [bulkGst, setBulkGst] = useState<string>("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ brand: "", name: "", category: "Fungicide", hsn_code: "", gst_rate: 18 });
  const [creatingProduct, setCreatingProduct] = useState(false);

  const createNewProduct = async () => {
    if (!newProduct.brand.trim() || !newProduct.name.trim()) {
      toast.error("Brand and technical name are required");
      return;
    }
    if (newProduct.hsn_code && !HSN_RE.test(newProduct.hsn_code.trim())) {
      toast.error("HSN must be 4, 6, or 8 digits");
      return;
    }
    setCreatingProduct(true);
    try {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      const slug = `rc-${String((count || 0) + 1).padStart(3, "0")}`;
      const { error } = await supabase.from("products").insert({
        brand: newProduct.brand.trim(),
        name: newProduct.name.trim(),
        category: newProduct.category,
        slug,
        hsn_code: newProduct.hsn_code.trim() || null,
        gst_rate: newProduct.gst_rate,
        unit: "L",
        is_active: true,
      });
      if (error) throw error;
      toast.success(`Added ${newProduct.brand}`);
      setNewProduct({ brand: "", name: "", category: "Fungicide", hsn_code: "", gst_rate: 18 });
      setNewProductOpen(false);
      qc.invalidateQueries({ queryKey: ["pricelist-products"] });
    } catch (e: any) {
      toast.error(e.message || "Could not add product");
    } finally {
      setCreatingProduct(false);
    }
  };

  const { data: products = [], isLoading: lp } = useQuery<Product[]>({
    queryKey: ["pricelist-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, brand, category, slug, hsn_code, gst_rate")
        .eq("is_active", true).order("category").order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
  });

  const { data: packs = [], isLoading: lk } = useQuery<Pack[]>({
    queryKey: ["pricelist-packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_packs")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Pack[];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort() as string[],
    [products]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter(p => {
      if (category !== "all" && p.category !== category) return false;
      if (!s) return true;
      return (
        p.name.toLowerCase().includes(s) ||
        (p.brand || "").toLowerCase().includes(s) ||
        (p.slug || "").toLowerCase().includes(s)
      );
    });
  }, [products, search, category]);

  const packsByProduct = useMemo(() => {
    const m: Record<string, Pack[]> = {};
    for (const pk of packs) (m[pk.product_id] ||= []).push(pk);
    return m;
  }, [packs]);

  const getVal = (pk: Pack, field: keyof Pack) => {
    const e = edits[pk.id];
    return (e && field in e ? (e as any)[field] : (pk as any)[field]) ?? "";
  };

  const setVal = (pk: Pack, field: keyof Pack, raw: string) => {
    const v = NUM_FIELDS.has(field) ? (raw === "" ? 0 : Number(raw)) : raw;
    setEdits(prev => ({ ...prev, [pk.id]: { ...(prev[pk.id] || {}), [field]: v } }));
  };

  const setNewVal = (productId: string, idx: number, field: keyof Pack, raw: string) => {
    const v = NUM_FIELDS.has(field) ? (raw === "" ? 0 : Number(raw)) : raw;
    setPendingNew(prev => {
      const list = [...(prev[productId] || [])];
      list[idx] = { ...(list[idx] || {}), [field]: v };
      return { ...prev, [productId]: list };
    });
  };

  const addPackRow = (productId: string) => {
    setCollapsed(prev => { const n = new Set(prev); n.delete(productId); return n; });
    setPendingNew(prev => ({
      ...prev,
      [productId]: [
        ...(prev[productId] || []),
        { pack_label: "", units_per_case: 1, unit_size: 1, unit_uom: "L", batch_no: "" },
      ],
    }));
  };

  const removePendingNew = (productId: string, idx: number) => {
    setPendingNew(prev => {
      const list = [...(prev[productId] || [])];
      list.splice(idx, 1);
      const next = { ...prev };
      if (list.length) next[productId] = list; else delete next[productId];
      return next;
    });
  };

  const toggle = (id: string) => setCollapsed(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(filtered.map(p => p.id)));

  const getProdVal = (p: Product, field: "hsn_code" | "gst_rate") => {
    const e = productEdits[p.id];
    return (e && field in e ? (e as any)[field] : (p as any)[field]) ?? "";
  };
  const setProdVal = (p: Product, field: "hsn_code" | "gst_rate", raw: string) => {
    const v = field === "gst_rate" ? (raw === "" ? 0 : Number(raw)) : raw;
    setProductEdits(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), [field]: v } }));
  };
  const saveProduct = async (p: Product) => {
    const patch = productEdits[p.id];
    if (!patch) return;
    if (patch.hsn_code !== undefined && !isValidHsn(String(patch.hsn_code))) {
      toast.error("HSN must be 4, 6, or 8 digits");
      return;
    }
    setSavingProduct(p.id);
    try {
      const clean = { ...patch, hsn_code: patch.hsn_code ? String(patch.hsn_code).trim() : patch.hsn_code };
      const { error } = await supabase.from("products").update(clean).eq("id", p.id);
      if (error) throw error;
      toast.success(`Updated ${p.brand || p.name}`);
      setProductEdits(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      qc.invalidateQueries({ queryKey: ["pricelist-products"] });
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSavingProduct(null);
    }
  };

  const applyBulk = async () => {
    const hsn = bulkHsn.trim();
    const gst = bulkGst === "" ? null : Number(bulkGst);
    if (!hsn && gst === null) { toast.error("Enter HSN or GST to apply"); return; }
    if (hsn && !HSN_RE.test(hsn)) { toast.error("HSN must be 4, 6, or 8 digits"); return; }
    setBulkApplying(true);
    try {
      const ids = filtered.map(p => p.id);
      const patch: any = {};
      if (hsn) patch.hsn_code = hsn;
      if (gst !== null) patch.gst_rate = gst;
      const { error } = await supabase.from("products").update(patch).in("id", ids);
      if (error) throw error;
      toast.success(`Applied to ${ids.length} product${ids.length === 1 ? "" : "s"}`);
      setBulkHsn(""); setBulkGst("");
      qc.invalidateQueries({ queryKey: ["pricelist-products"] });
    } catch (e: any) {
      toast.error(e.message || "Bulk apply failed");
    } finally {
      setBulkApplying(false);
      setConfirmBulk(false);
    }
  };


  const editCount = Object.keys(edits).length;
  const newCount = Object.values(pendingNew).reduce((n, l) => n + l.length, 0);
  const dirty = editCount + newCount;

  const resetAll = () => { setEdits({}); setPendingNew({}); };

  const saveAll = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const updates = Object.entries(edits).map(([id, patch]) => ({ id, ...patch }));
      for (const row of updates) {
        const { id, ...patch } = row as any;
        const { error } = await supabase.from("product_packs").update(patch).eq("id", id);
        if (error) throw error;
      }
      const inserts: any[] = [];
      for (const [productId, list] of Object.entries(pendingNew)) {
        for (const row of list) {
          if (!row.pack_label) continue;
          inserts.push({ ...row, product_id: productId, is_active: true });
        }
      }
      if (inserts.length) {
        const { error } = await supabase.from("product_packs").insert(inserts);
        if (error) throw error;
      }
      toast.success(`Saved ${updates.length + inserts.length} pack${updates.length + inserts.length === 1 ? "" : "s"}`);
      setEdits({}); setPendingNew({});
      qc.invalidateQueries({ queryKey: ["pricelist-packs"] });
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deletePack = async () => {
    if (!confirmDel) return;
    try {
      const { error } = await supabase
        .from("product_packs").update({ is_active: false }).eq("id", confirmDel.id);
      if (error) throw error;
      toast.success(`Removed pack ${confirmDel.label}`);
      qc.invalidateQueries({ queryKey: ["pricelist-packs"] });
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setConfirmDel(null);
    }
  };

  const exportXlsx = () => {
    const rows: any[] = [];
    for (const p of products) {
      const ps = packsByProduct[p.id] || [];
      if (!ps.length) {
        rows.push({
          Category: p.category, Brand: p.brand, "Technical Name": p.name,
          Slug: p.slug, HSN: p.hsn_code, "GST %": p.gst_rate,
        });
        continue;
      }
      for (const pk of ps) {
        rows.push({
          Category: p.category, Brand: p.brand, "Technical Name": p.name,
          Slug: p.slug, HSN: p.hsn_code, "GST %": p.gst_rate,
          "Pack Label": pk.pack_label, "Units/Case": pk.units_per_case,
          "Unit Size": pk.unit_size, UOM: pk.unit_uom,
          "Purchase Price": pk.purchase_price, "Packing Cost": pk.packing_cost,
          PFG: pk.price_finished_goods, Scheme1: pk.scheme_1, Scheme2: pk.scheme_2,
          Margin: pk.margin, "Basic Price": pk.basic_price,
          "GST Amt": pk.gst_amount, "Price Incl GST": pk.price_inclusive_gst, MRP: pk.mrp,
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Price List");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Raizechem_Price_List_${stamp}.xlsx`);
  };

  const importXlsx = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
      const bySlug = new Map(products.map(p => [p.slug, p]));
      const byName = new Map(products.map(p => [p.name.toLowerCase(), p]));
      let updated = 0, missing = 0;
      for (const r of rows) {
        const slug = r["Slug"] || r.slug;
        const nm = (r["Technical Name"] || r.name || "").toString().toLowerCase();
        const product = (slug && bySlug.get(slug)) || (nm && byName.get(nm));
        if (!product) { missing++; continue; }
        const packLabel = r["Pack Label"] || r.pack_label;
        if (!packLabel) continue;
        const existing = (packsByProduct[product.id] || []).find(x => x.pack_label === packLabel);
        const patch: any = {
          product_id: product.id, pack_label: packLabel,
          units_per_case: Number(r["Units/Case"] ?? r.units_per_case ?? 0),
          unit_size: r["Unit Size"] != null ? Number(r["Unit Size"]) : null,
          unit_uom: r["UOM"] ?? r.unit_uom ?? null,
          purchase_price: Number(r["Purchase Price"] ?? 0),
          packing_cost: Number(r["Packing Cost"] ?? 0),
          price_finished_goods: Number(r["PFG"] ?? 0),
          scheme_1: Number(r["Scheme1"] ?? 0),
          scheme_2: Number(r["Scheme2"] ?? 0),
          margin: Number(r["Margin"] ?? 0),
          basic_price: Number(r["Basic Price"] ?? 0),
          gst_amount: Number(r["GST Amt"] ?? 0),
          price_inclusive_gst: Number(r["Price Incl GST"] ?? 0),
          mrp: Number(r["MRP"] ?? 0),
          is_active: true,
        };
        if (existing) {
          const { error } = await supabase.from("product_packs").update(patch).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("product_packs").insert(patch);
          if (error) throw error;
        }
        updated++;
      }
      toast.success(`Imported ${updated} packs${missing ? ` (${missing} skipped — product not found)` : ""}`);
      qc.invalidateQueries({ queryKey: ["pricelist-packs"] });
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const cols = view === "pricing" ? PRICING_COLS : view === "costing" ? COSTING_COLS : [...PRICING_COLS, ...COSTING_COLS];
  const totalPacks = filtered.reduce((n, p) => n + (packsByProduct[p.id]?.length || 0), 0);

  return (
    <DashboardLayout>
    <div className="container mx-auto py-6 space-y-4 max-w-[1400px]">


      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Price List</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-manage carton pricing. Edits are highlighted; click Save to commit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => e.target.files?.[0] && importXlsx(e.target.files[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          {dirty > 0 && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Discard
            </Button>
          )}
          <Button size="sm" onClick={saveAll} disabled={!dirty || saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving…" : dirty ? `Save (${dirty})` : "Save"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brand, technical name, or slug…"
                className="pl-9 h-9" value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                {categories.map(c => (
                  <TabsTrigger key={c} value={c} className="text-xs">{c}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">View:</span>
              <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
                <TabsList className="h-9">
                  <TabsTrigger value="pricing" className="text-xs">Pricing</TabsTrigger>
                  <TabsTrigger value="costing" className="text-xs">Costing</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={expandAll}>Expand all</Button>
              <Button variant="ghost" size="sm" className="text-xs h-8" onClick={collapseAll}>Collapse all</Button>
              <Badge variant="secondary" className="ml-1">
                {filtered.length} products · {totalPacks} packs
              </Badge>
            </div>
          </div>
          {/* Bulk apply HSN/GST */}
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <Wand2 className="h-4 w-4 text-muted-foreground mb-2" />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Bulk HSN</label>
              <Input
                className={cn("h-8 text-xs w-32", bulkHsn && !HSN_RE.test(bulkHsn.trim()) && "border-destructive")}
                placeholder="4/6/8 digits" value={bulkHsn}
                onChange={e => setBulkHsn(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Bulk GST %</label>
              <Select value={bulkGst} onValueChange={setBulkGst}>
                <SelectTrigger className="h-8 text-xs w-24"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {[0, 5, 12, 18, 28].map(r => (
                    <SelectItem key={r} value={String(r)} className="text-xs">{r}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm" variant="outline"
              disabled={bulkApplying || (!bulkHsn && bulkGst === "")}
              onClick={() => setConfirmBulk(true)}
            >
              {bulkApplying ? "Applying…" : `Apply to ${filtered.length} filtered`}
            </Button>
            <span className="text-[11px] text-muted-foreground ml-auto">
              Updates every product currently visible. Use search/category to narrow scope first.
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0 border-t">
          {/* Sticky column header */}
          <div className="bg-muted/40 border-b text-[11px] uppercase tracking-wide text-muted-foreground font-medium sticky top-0 z-10">
            <div className="grid items-center gap-2 px-3 py-2"
              style={{ gridTemplateColumns: `28px minmax(140px,1.2fr) 70px 70px 70px 110px ${cols.map(()=>"minmax(80px,1fr)").join(" ")} 36px` }}>
              <div></div>
              <div>Pack</div>
              <div className="text-right">Units</div>
              <div className="text-right">Size</div>
              <div>UOM</div>
              <div>Batch No</div>
              {cols.map(c => <div key={c.key} className="text-right">{c.label}</div>)}
              <div></div>
            </div>
          </div>

          {(lp || lk) && (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading price list…</div>
          )}

          {!lp && !lk && filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No products match the current filter.
            </div>
          )}

          <div className="divide-y">
            {filtered.map(p => {
              const ps = packsByProduct[p.id] || [];
              const isCollapsed = collapsed.has(p.id);
              const newRows = pendingNew[p.id] || [];
              const prices = ps.map(x => x.price_inclusive_gst).filter(Boolean);
              const min = prices.length ? Math.min(...prices) : 0;
              const max = prices.length ? Math.max(...prices) : 0;

              return (
                <div key={p.id} className="bg-card">
                  {/* Product header */}
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors text-left"
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-primary">
                          {p.brand || <span className="text-muted-foreground italic">No brand</span>}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm truncate">{p.name}</span>
                        {p.category && <Badge variant="outline" className="text-[10px] h-5">{p.category}</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{p.slug || "—"}</span>
                        <span>·</span>
                        <span>HSN {p.hsn_code || "—"}</span>
                        <span>·</span>
                        <span>GST {p.gst_rate}%</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-medium">{ps.length} pack{ps.length === 1 ? "" : "s"}</div>
                      {prices.length > 0 && (
                        <div className="text-muted-foreground">
                          {min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`}
                        </div>
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); addPackRow(p.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); addPackRow(p.id); } }}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Pack
                    </div>
                  </button>

                  {/* Pack rows */}
                  {!isCollapsed && (
                    <div className="bg-muted/10 border-t">
                      {/* Product master fields editor */}
                      <div className="flex flex-wrap items-end gap-3 px-3 py-2.5 border-b bg-background/60">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">HSN Code</label>
                          <Input
                            className={cn(
                              "h-8 text-xs w-32",
                              !isValidHsn(String(getProdVal(p, "hsn_code") || "")) && "border-destructive"
                            )}
                            placeholder="e.g. 38089390"
                            value={getProdVal(p, "hsn_code") as string}
                            onChange={e => setProdVal(p, "hsn_code", e.target.value)}
                          />
                          {!isValidHsn(String(getProdVal(p, "hsn_code") || "")) && (
                            <span className="text-[10px] text-destructive">Must be 4, 6, or 8 digits</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">GST %</label>
                          <Select
                            value={String(getProdVal(p, "gst_rate") ?? 18)}
                            onValueChange={v => setProdVal(p, "gst_rate", v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[0, 5, 12, 18, 28].map(r => (
                                <SelectItem key={r} value={String(r)} className="text-xs">{r}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          size="sm"
                          variant={productEdits[p.id] ? "default" : "outline"}
                          disabled={!productEdits[p.id] || savingProduct === p.id}
                          onClick={() => saveProduct(p)}
                        >
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                          {savingProduct === p.id ? "Saving…" : "Add to Products"}
                        </Button>
                        {productEdits[p.id] && (
                          <span className="text-[11px] text-warning">Unsaved product changes</span>
                        )}
                      </div>

                      {ps.length === 0 && newRows.length === 0 && (
                        <div className="px-3 py-4 text-xs text-muted-foreground italic">
                          No packs configured. Click <span className="font-medium">+ Pack</span> to add one.
                        </div>
                      )}
                      {ps.map(pk => {
                        const isDirty = !!edits[pk.id];
                        return (
                          <PackRow
                            key={pk.id}
                            cols={cols}
                            dirty={isDirty}
                            values={{
                              pack_label: getVal(pk, "pack_label") as any,
                              units_per_case: getVal(pk, "units_per_case") as any,
                              unit_size: getVal(pk, "unit_size") as any,
                              unit_uom: getVal(pk, "unit_uom") as any,
                              batch_no: getVal(pk, "batch_no") as any,
                              ...Object.fromEntries(cols.map(c => [c.key, getVal(pk, c.key)])) as any,
                            }}
                            onChange={(f, v) => setVal(pk, f, v)}
                            onDelete={() => setConfirmDel({ id: pk.id, label: pk.pack_label })}
                          />
                        );
                      })}
                      {newRows.map((row, idx) => (
                        <PackRow
                          key={`new-${p.id}-${idx}`}
                          cols={cols}
                          isNew
                          values={{
                            pack_label: (row.pack_label as any) ?? "",
                            units_per_case: (row.units_per_case as any) ?? 1,
                            unit_size: (row.unit_size as any) ?? 1,
                            unit_uom: (row.unit_uom as any) ?? "L",
                            batch_no: (row.batch_no as any) ?? "",
                            ...Object.fromEntries(cols.map(c => [c.key, (row as any)[c.key] ?? 0])) as any,
                          }}
                          onChange={(f, v) => setNewVal(p.id, idx, f, v)}
                          onDelete={() => removePendingNew(p.id, idx)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title="Remove this pack?"
        description={confirmDel ? `Pack "${confirmDel.label}" will be deactivated. You can re-add it later.` : ""}
        confirmText="Remove"
        variant="destructive"
        onConfirm={deletePack}
      />
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Apply to ${filtered.length} products?`}
        description={`This will overwrite ${bulkHsn ? `HSN to "${bulkHsn}"` : ""}${bulkHsn && bulkGst !== "" ? " and " : ""}${bulkGst !== "" ? `GST to ${bulkGst}%` : ""} on every currently filtered product.`}
        confirmText="Apply"
        onConfirm={applyBulk}
      />
    </div>
    </DashboardLayout>
  );
}

function PackRow({
  cols, dirty, isNew, values, onChange, onDelete,
}: {
  cols: Array<{ key: keyof Pack; label: string }>;
  dirty?: boolean;
  isNew?: boolean;
  values: Record<string, any>;
  onChange: (field: keyof Pack, value: string) => void;
  onDelete: () => void;
}) {
  const inputCls = "h-8 text-xs bg-background border-input focus:ring-1 focus:ring-primary";
  return (
    <div
      className={cn(
        "grid items-center gap-2 px-3 py-1.5 border-b last:border-b-0 transition-colors",
        dirty && "bg-yellow-500/10",
        isNew && "bg-emerald-500/10",
      )}
      style={{ gridTemplateColumns: `28px minmax(140px,1.2fr) 70px 70px 70px 110px ${cols.map(()=>"minmax(80px,1fr)").join(" ")} 36px` }}
    >
      <div className="text-muted-foreground text-[11px]">{isNew ? "NEW" : ""}</div>
      <Input className={inputCls} placeholder="e.g. 10 x 1"
        value={values.pack_label} onChange={e => onChange("pack_label", e.target.value)} />
      <Input className={cn(inputCls, "text-right")} type="number" min={0}
        value={values.units_per_case} onChange={e => onChange("units_per_case", e.target.value)} />
      <Input className={cn(inputCls, "text-right")} type="number" min={0} step="0.01"
        value={values.unit_size} onChange={e => onChange("unit_size", e.target.value)} />
      <Select value={values.unit_uom || ""} onValueChange={(v) => onChange("unit_uom", v)}>
        <SelectTrigger className={cn(inputCls, "px-2")}><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {UOM_OPTIONS.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input className={inputCls} placeholder="Batch #"
        value={values.batch_no ?? ""} onChange={e => onChange("batch_no" as any, e.target.value)} />
      {cols.map(c => (
        <Input key={c.key} className={cn(inputCls, "text-right")} type="number" step="0.01"
          value={values[c.key]} onChange={e => onChange(c.key, e.target.value)} />
      ))}
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
