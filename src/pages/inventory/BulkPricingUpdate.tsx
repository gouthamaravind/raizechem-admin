import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { computeStack } from "./PricingMatrix";
import { Search, Save } from "lucide-react";

type Row = any;
type Edit = {
  purchase_price?: number; packing_price?: number;
  scheme_1?: number; scheme_2?: number; scheme_3?: number;
  margin_pct?: number; gst_rate?: number;
};

export default function BulkPricingUpdate() {
  const { user, userRoles } = useAuth();
  const isAdmin = userRoles.includes("admin");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, Edit>>({});

  const { data: rows = [] as Row[], isLoading, refetch } = useQuery<Row[]>({
    queryKey: ["bulk-pricing"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("product_pricing_matrix" as any) as any)
        .select("*, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      !q || r.products?.name?.toLowerCase().includes(q) || r.slab_label?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const apply = useMutation({
    mutationFn: async () => {
      const updates = Array.from(selected).map((id) => {
        const r = rows.find((x: Row) => x.id === id);
        const e = edits[id] || {};
        const merged = {
          purchase_price: e.purchase_price ?? Number(r.purchase_price),
          packing_price: e.packing_price ?? Number(r.packing_price),
          scheme_1: e.scheme_1 ?? Number(r.scheme_1),
          scheme_2: e.scheme_2 ?? Number(r.scheme_2),
          scheme_3: e.scheme_3 ?? Number(r.scheme_3),
          margin_pct: e.margin_pct ?? Number(r.margin_pct),
          gst_rate: e.gst_rate ?? Number(r.gst_rate),
        };
        const c = computeStack({
          slab_label: "", slab_min: 0, slab_max: null, ...merged,
        } as any);
        return { id, ...merged, ex_gst_price: c.exGst, mrp: c.mrp };
      });

      const { data, error } = await supabase.rpc("bulk_update_pricing_matrix" as any, {
        p_updates: updates, p_user_id: user?.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Updated ${data?.updated_count ?? selected.size} rows`);
      setSelected(new Set()); setEdits({}); refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r: Row) => r.id)));
  };

  const setEdit = (id: string, field: keyof Edit, val: number) => {
    setEdits((p) => ({ ...p, [id]: { ...p[id], [field]: val } }));
    setSelected((p) => new Set(p).add(id));
  };

  const previewMrp = (r: Row) => {
    const e = edits[r.id] || {};
    const merged = {
      purchase_price: e.purchase_price ?? Number(r.purchase_price),
      packing_price: e.packing_price ?? Number(r.packing_price),
      scheme_1: e.scheme_1 ?? Number(r.scheme_1),
      scheme_2: e.scheme_2 ?? Number(r.scheme_2),
      scheme_3: e.scheme_3 ?? Number(r.scheme_3),
      margin_pct: e.margin_pct ?? Number(r.margin_pct),
      gst_rate: e.gst_rate ?? Number(r.gst_rate),
    };
    return computeStack({ slab_label: "", slab_min: 0, slab_max: null, ...merged } as any).mrp;
  };

  if (!isAdmin) {
    return <DashboardLayout><Card><CardContent className="py-8 text-center text-muted-foreground">HQ Admin only.</CardContent></Card></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">HQ Bulk Pricing Update</h1>
            <p className="text-muted-foreground">Edit any row inline; selected rows commit in one action. Locked rows are skipped.</p>
          </div>
          <Button onClick={() => apply.mutate()} disabled={selected.size === 0 || apply.isPending}>
            <Save className="h-4 w-4 mr-2" />Apply ({selected.size})
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search product or slab..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Slab</TableHead>
                      <TableHead>Purchase</TableHead>
                      <TableHead>Packing</TableHead>
                      <TableHead>S1</TableHead>
                      <TableHead>S2</TableHead>
                      <TableHead>S3</TableHead>
                      <TableHead>Margin%</TableHead>
                      <TableHead>GST%</TableHead>
                      <TableHead className="text-right">Current MRP</TableHead>
                      <TableHead className="text-right">New MRP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r: Row) => {
                      const newMrp = previewMrp(r);
                      const changed = Math.abs(newMrp - Number(r.mrp)) > 0.01;
                      return (
                        <TableRow key={r.id} className={r.is_locked ? "opacity-50" : ""}>
                          <TableCell><Checkbox checked={selected.has(r.id)} disabled={r.is_locked} onCheckedChange={(v) => {
                            const n = new Set(selected); v ? n.add(r.id) : n.delete(r.id); setSelected(n);
                          }} /></TableCell>
                          <TableCell className="font-medium whitespace-nowrap">
                            {r.products?.name} {r.is_locked && <Badge variant="secondary" className="ml-1 text-[10px]">Locked</Badge>}
                          </TableCell>
                          <TableCell>{r.slab_label}</TableCell>
                          {(["purchase_price","packing_price","scheme_1","scheme_2","scheme_3","margin_pct","gst_rate"] as const).map((f) => (
                            <TableCell key={f}>
                              <Input type="number" step="0.01" className="w-20 h-8" disabled={r.is_locked}
                                defaultValue={Number(r[f])}
                                onChange={(e) => setEdit(r.id, f as keyof Edit, Number(e.target.value))} />
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono">₹{Number(r.mrp).toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-mono ${changed ? "text-primary font-bold" : ""}`}>₹{newMrp.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
