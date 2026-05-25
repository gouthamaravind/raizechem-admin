import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, Upload, Save, Search } from "lucide-react";

type Product = {
  id: string; name: string; brand: string | null; category: string | null;
  slug: string | null; hsn_code: string | null; gst_rate: number;
};
type Pack = {
  id: string; product_id: string; pack_label: string; units_per_case: number;
  unit_size: number | null; unit_uom: string | null;
  purchase_price: number; packing_cost: number; price_finished_goods: number;
  scheme_1: number; scheme_2: number; margin: number;
  basic_price: number; gst_amount: number; price_inclusive_gst: number; mrp: number;
  is_active: boolean; sort_order: number;
};

const NUM_COLS: (keyof Pack)[] = [
  "units_per_case", "unit_size", "purchase_price", "packing_cost",
  "price_finished_goods", "scheme_1", "scheme_2", "margin",
  "basic_price", "gst_amount", "price_inclusive_gst", "mrp",
];

export default function PriceList() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [edits, setEdits] = useState<Record<string, Partial<Pack>>>({});
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
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

  const { data: packs = [] } = useQuery<Pack[]>({
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
    () => Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[],
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
    const v = NUM_COLS.includes(field) ? (raw === "" ? 0 : Number(raw)) : raw;
    setEdits(prev => ({ ...prev, [pk.id]: { ...(prev[pk.id] || {}), [field]: v } }));
  };

  const dirtyCount = Object.keys(edits).length;

  const saveAll = async () => {
    if (!dirtyCount) return;
    setSaving(true);
    try {
      const rows = Object.entries(edits).map(([id, patch]) => ({ id, ...patch }));
      for (const row of rows) {
        const { id, ...patch } = row as any;
        const { error } = await supabase.from("product_packs").update(patch).eq("id", id);
        if (error) throw error;
      }
      toast.success(`Saved ${rows.length} pack${rows.length === 1 ? "" : "s"}`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ["pricelist-packs"] });
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
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
        const existing = (packsByProduct[product.id] || []).find(
          x => x.pack_label === packLabel
        );
        const patch: any = {
          product_id: product.id,
          pack_label: packLabel,
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

  return (
    <div className="container mx-auto py-6 space-y-4 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Price List</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-manage pack pricing for all products. Edits are highlighted; click Save to commit.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls"
            className="hidden"
            onChange={e => e.target.files?.[0] && importXlsx(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button variant="outline" onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={saveAll} disabled={!dirtyCount || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : `Save${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brand, technical name, or slug…"
                className="pl-8" value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                {categories.map(c => (
                  <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Badge variant="secondary">
              {filtered.length} products · {filtered.reduce((n, p) => n + (packsByProduct[p.id]?.length || 0), 0)} packs
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2 min-w-[220px]">Product</th>
                  <th className="p-2">Pack</th>
                  <th className="p-2 text-right">Units</th>
                  <th className="p-2 text-right">Size</th>
                  <th className="p-2">UOM</th>
                  <th className="p-2 text-right">Purchase</th>
                  <th className="p-2 text-right">Packing</th>
                  <th className="p-2 text-right">PFG</th>
                  <th className="p-2 text-right">Sch1</th>
                  <th className="p-2 text-right">Sch2</th>
                  <th className="p-2 text-right">Margin</th>
                  <th className="p-2 text-right">Basic</th>
                  <th className="p-2 text-right">GST Amt</th>
                  <th className="p-2 text-right">Incl GST</th>
                  <th className="p-2 text-right">MRP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const ps = packsByProduct[p.id] || [];
                  return (
                    <>
                      <tr key={p.id} className="bg-accent/30 border-t">
                        <td className="p-2 font-semibold" colSpan={15}>
                          <span className="text-primary">{p.brand || "—"}</span>
                          <span className="text-muted-foreground"> · {p.name}</span>
                          {p.category && <Badge variant="outline" className="ml-2">{p.category}</Badge>}
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {p.slug} · HSN {p.hsn_code || "—"} · GST {p.gst_rate}%
                          </span>
                        </td>
                      </tr>
                      {ps.length === 0 && (
                        <tr><td className="p-2 text-muted-foreground italic" colSpan={15}>
                          No packs configured.
                        </td></tr>
                      )}
                      {ps.map(pk => {
                        const dirty = !!edits[pk.id];
                        return (
                          <tr key={pk.id} className={`border-t ${dirty ? "bg-yellow-500/10" : ""}`}>
                            <td className="p-1.5"></td>
                            <td className="p-1.5">
                              <Input className="h-7 text-xs w-32" value={getVal(pk, "pack_label")}
                                onChange={e => setVal(pk, "pack_label", e.target.value)} />
                            </td>
                            {(["units_per_case", "unit_size"] as const).map(f => (
                              <td key={f} className="p-1.5">
                                <Input className="h-7 text-xs w-16 text-right" type="number"
                                  value={getVal(pk, f)} onChange={e => setVal(pk, f, e.target.value)} />
                              </td>
                            ))}
                            <td className="p-1.5">
                              <Input className="h-7 text-xs w-16" value={getVal(pk, "unit_uom")}
                                onChange={e => setVal(pk, "unit_uom", e.target.value)} />
                            </td>
                            {(["purchase_price", "packing_cost", "price_finished_goods",
                               "scheme_1", "scheme_2", "margin", "basic_price",
                               "gst_amount", "price_inclusive_gst", "mrp"] as const).map(f => (
                              <td key={f} className="p-1.5">
                                <Input className="h-7 text-xs w-20 text-right" type="number" step="0.01"
                                  value={getVal(pk, f)} onChange={e => setVal(pk, f, e.target.value)} />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="p-8 text-center text-muted-foreground">
                    No products match the current filter.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
