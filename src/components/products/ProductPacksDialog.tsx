import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface Pack {
  id?: string;
  _local?: string;
  product_id?: string;
  pack_label: string;
  units_per_case: number;
  unit_size: number | null;
  unit_uom: string | null;
  purchase_price: number;
  packing_cost: number;
  price_finished_goods: number;
  scheme_1: number;
  scheme_2: number;
  margin: number;
  basic_price: number;
  gst_amount: number;
  price_inclusive_gst: number;
  mrp: number;
  sort_order: number;
  is_active: boolean;
  _dirty?: boolean;
  _deleted?: boolean;
}

const UOMS = ["ml", "L", "g", "kg", "GM"];

const blank = (sort: number): Pack => ({
  _local: crypto.randomUUID(),
  pack_label: "",
  units_per_case: 1,
  unit_size: null,
  unit_uom: "ml",
  purchase_price: 0,
  packing_cost: 0,
  price_finished_goods: 0,
  scheme_1: 0,
  scheme_2: 0,
  margin: 0,
  basic_price: 0,
  gst_amount: 0,
  price_inclusive_gst: 0,
  mrp: 0,
  sort_order: sort,
  is_active: true,
  _dirty: true,
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: { id: string; name: string; brand?: string | null; gst_rate?: number } | null;
}

export function ProductPacksDialog({ open, onOpenChange, product }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Pack[]>([]);

  const { data: existing = [], isLoading } = useQuery({
    queryKey: ["product_packs", product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      const { data, error } = await supabase
        .from("product_packs")
        .select("*")
        .eq("product_id", product.id)
        .order("sort_order");
      if (error) throw error;
      return data as Pack[];
    },
    enabled: !!product?.id && open,
  });

  useEffect(() => {
    if (existing) setRows(existing.map((r) => ({ ...r })));
  }, [existing]);

  const update = (idx: number, patch: Partial<Pack>) => {
    setRows((rs) =>
      rs.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch, _dirty: true };
        // auto compute GST + inclusive when basic_price or gst rate context changes
        const gstRate = product?.gst_rate ?? 18;
        if ("basic_price" in patch) {
          next.gst_amount = +(next.basic_price * gstRate / 100).toFixed(2);
          next.price_inclusive_gst = +(next.basic_price + next.gst_amount).toFixed(2);
        }
        return next;
      })
    );
  };

  const addRow = () => setRows((rs) => [...rs, blank(rs.length)]);
  const removeRow = (idx: number) =>
    setRows((rs) =>
      rs.map((r, i) => (i === idx ? { ...r, _deleted: true, _dirty: true } : r))
    );

  const save = useMutation({
    mutationFn: async () => {
      if (!product?.id) return;
      const toDelete = rows.filter((r) => r._deleted && r.id).map((r) => r.id!);
      const toUpsert = rows
        .filter((r) => !r._deleted && r._dirty && r.pack_label.trim())
        .map(({ _local, _dirty, _deleted, ...r }) => ({
          ...r,
          product_id: product.id,
        }));

      if (toDelete.length) {
        const { error } = await supabase.from("product_packs").delete().in("id", toDelete);
        if (error) throw error;
      }
      if (toUpsert.length) {
        const { error } = await supabase.from("product_packs").upsert(toUpsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_packs"] });
      qc.invalidateQueries({ queryKey: ["product_packs_count"] });
      toast.success("Packs saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = rows.filter((r) => !r._deleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Pack Variants — {product?.name}</DialogTitle>
          <DialogDescription>
            Define each pack size sold in cartons. e.g. "10 x 1L", "20 x 500ml". GST auto-calculated from product's GST rate ({product?.gst_rate ?? 18}%).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Pack Label</TableHead>
                    <TableHead>Qty/Case</TableHead>
                    <TableHead>Unit Size</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Purchase ₹</TableHead>
                    <TableHead>Packing ₹</TableHead>
                    <TableHead>FG Price ₹</TableHead>
                    <TableHead>Scheme 1</TableHead>
                    <TableHead>Scheme 2</TableHead>
                    <TableHead>Margin %</TableHead>
                    <TableHead>Basic ₹</TableHead>
                    <TableHead>GST ₹</TableHead>
                    <TableHead>Incl. GST ₹</TableHead>
                    <TableHead>MRP ₹</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center text-muted-foreground py-6">
                        No packs yet. Click "Add Pack" below.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((r) => {
                      const idx = rows.indexOf(r);
                      const cell = (k: keyof Pack, w = "w-20") => (
                        <Input
                          type="number"
                          step="0.01"
                          className={`${w} h-8 text-xs`}
                          value={(r[k] as number) ?? 0}
                          onChange={(e) => update(idx, { [k]: Number(e.target.value) } as any)}
                        />
                      );
                      return (
                        <TableRow key={r.id || r._local}>
                          <TableCell>
                            <Input
                              className="w-28 h-8 text-xs"
                              placeholder="20 x 500"
                              value={r.pack_label}
                              onChange={(e) => update(idx, { pack_label: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>{cell("units_per_case", "w-16")}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              className="w-20 h-8 text-xs"
                              value={r.unit_size ?? ""}
                              onChange={(e) => update(idx, { unit_size: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={r.unit_uom || "ml"} onValueChange={(v) => update(idx, { unit_uom: v })}>
                              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{UOMS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{cell("purchase_price")}</TableCell>
                          <TableCell>{cell("packing_cost")}</TableCell>
                          <TableCell>{cell("price_finished_goods")}</TableCell>
                          <TableCell>{cell("scheme_1")}</TableCell>
                          <TableCell>{cell("scheme_2")}</TableCell>
                          <TableCell>{cell("margin", "w-16")}</TableCell>
                          <TableCell>{cell("basic_price")}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{r.gst_amount.toFixed(2)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium">{r.price_inclusive_gst.toFixed(2)}</span>
                          </TableCell>
                          <TableCell>{cell("mrp")}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-2" />Add Pack
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving..." : "Save All"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
