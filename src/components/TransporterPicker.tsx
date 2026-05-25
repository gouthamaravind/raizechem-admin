import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export interface TransporterOption {
  id: string;
  name: string;
  gst_number: string | null;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9A-Z]$/;

interface Props {
  value: string;
  onChange: (id: string, transporter: TransporterOption | null) => void;
  branchId?: string | null;
  className?: string;
}

export function TransporterPicker({ value, onChange, branchId, className }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [gstin, setGstin] = useState("");
  const [name, setName] = useState("");

  const { data: transporters = [] } = useQuery<TransporterOption[]>({
    queryKey: ["transporters-active", branchId],
    queryFn: async () => {
      let q = supabase.from("transporters" as any).select("id, name, gst_number").eq("status", "active").order("name");
      const { data } = await q;
      return ((data as any) || []) as TransporterOption[];
    },
  });

  const lookupAndCreate = useMutation({
    mutationFn: async () => {
      const g = gstin.trim().toUpperCase();
      if (!GSTIN_RE.test(g)) throw new Error("Invalid GSTIN format (must be 15 chars)");

      // Existing?
      const { data: existing } = await supabase
        .from("transporters" as any)
        .select("id, name, gst_number")
        .eq("gst_number", g)
        .maybeSingle();
      if (existing) return existing as unknown as TransporterOption;

      // Lookup
      const { data: lookup, error: lookupErr } = await supabase.functions.invoke("gstin-lookup", { body: { gstin: g } });
      if (lookupErr) throw lookupErr;
      const d = (lookup as any)?.data;
      const resolvedName = name.trim() || d?.trade_name || d?.legal_name || g;

      const insertPayload: any = {
        name: resolvedName,
        gst_number: g,
        gst_legal_name: d?.legal_name || null,
        gst_trade_name: d?.trade_name || null,
        gst_status: d?.status || null,
        gst_last_verified_at: new Date().toISOString(),
        state_code: d?.state_code || g.substring(0, 2),
        address_line1: typeof d?.address === "string" ? d.address : null,
        pincode: d?.pincode || null,
        branch_id: branchId || null,
        status: "active",
      };
      const { data: created, error } = await supabase
        .from("transporters" as any)
        .insert(insertPayload)
        .select("id, name, gst_number")
        .single();
      if (error) throw error;
      return created as unknown as TransporterOption;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["transporters-active"] });
      onChange(t.id, t);
      toast.success(`Transporter "${t.name}" added`);
      setAddOpen(false);
      setGstin("");
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={`flex gap-2 ${className || ""}`}>
      <Select
        value={value || "__none__"}
        onValueChange={(v) => {
          if (v === "__none__") return onChange("", null);
          const t = transporters.find((x) => x.id === v) || null;
          onChange(v, t);
        }}
      >
        <SelectTrigger className="flex-1"><SelectValue placeholder="Select transporter…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {transporters.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}{t.gst_number ? ` — ${t.gst_number}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" onClick={() => setAddOpen(true)} title="Add via GSTIN">
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Transporter via GSTIN</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>GSTIN</Label>
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 36AAOCR3849R1ZA"
                maxLength={15}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Display Name <span className="text-xs text-muted-foreground">(optional — fetched from GST if blank)</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Transporter name" />
            </div>
            <Button className="w-full" onClick={() => lookupAndCreate.mutate()} disabled={lookupAndCreate.isPending}>
              {lookupAndCreate.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Looking up…</> : <><Search className="h-4 w-4 mr-2" />Lookup & Add</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
