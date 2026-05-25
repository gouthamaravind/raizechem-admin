import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, Search, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9A-Z]$/;

type BranchForm = {
  id: string;
  branch_name: string;
  branch_code: string;
  gst_number: string;
  legal_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  phone: string;
  email: string;
};

export function BranchesEditor() {
  const qc = useQueryClient();
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("branch_name");
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Branches (Dispatch Locations)</CardTitle>
            <CardDescription>
              GSTIN and pincode are required for E-Way Bills. Use "Auto-fill from GSTIN" to populate from the GST portal.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <div className="py-4 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading branches…</div>}
        {branches.map((b: any) => (
          <BranchRow key={b.id} branch={b} onSaved={() => qc.invalidateQueries({ queryKey: ["branches-admin"] })} />
        ))}
      </CardContent>
    </Card>
  );
}

function BranchRow({ branch, onSaved }: { branch: any; onSaved: () => void }) {
  const [f, setF] = useState<BranchForm>({
    id: branch.id, branch_name: branch.branch_name || "", branch_code: branch.branch_code || "",
    gst_number: branch.gst_number || "", legal_name: branch.legal_name || "",
    address_line1: branch.address_line1 || "", address_line2: branch.address_line2 || "",
    city: branch.city || "", state: branch.state || "", state_code: branch.state_code || "",
    pincode: branch.pincode || "", phone: branch.phone || "", email: branch.email || "",
  });
  const set = (k: keyof BranchForm, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    setF({
      id: branch.id, branch_name: branch.branch_name || "", branch_code: branch.branch_code || "",
      gst_number: branch.gst_number || "", legal_name: branch.legal_name || "",
      address_line1: branch.address_line1 || "", address_line2: branch.address_line2 || "",
      city: branch.city || "", state: branch.state || "", state_code: branch.state_code || "",
      pincode: branch.pincode || "", phone: branch.phone || "", email: branch.email || "",
    });
  }, [branch.id]);

  const autofill = useMutation({
    mutationFn: async () => {
      const g = f.gst_number.trim().toUpperCase();
      if (!GSTIN_RE.test(g)) throw new Error("Enter a valid 15-char GSTIN first");
      const { data, error } = await supabase.functions.invoke("gstin-lookup", { body: { gstin: g } });
      if (error) throw error;
      const d = (data as any)?.data;
      if (!d) throw new Error("No data returned");
      return d;
    },
    onSuccess: (d: any) => {
      setF((x) => ({
        ...x,
        gst_number: x.gst_number.toUpperCase(),
        legal_name: d.legal_name || x.legal_name,
        address_line1: typeof d.address === "string" ? d.address : x.address_line1,
        pincode: d.pincode || x.pincode,
        state_code: d.state_code || x.state_code,
        city: d.city || x.city,
        state: d.state || x.state,
      }));
      toast.success("Branch fields filled from GSTIN — review and click Save");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...f };
      delete payload.id;
      if (payload.gst_number && !GSTIN_RE.test(payload.gst_number)) throw new Error("GSTIN must be 15 characters");
      if (payload.pincode && !/^\d{6}$/.test(payload.pincode)) throw new Error("Pincode must be 6 digits");
      const { error } = await supabase.from("branches").update(payload).eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`${f.branch_name} saved`); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const missing = !f.pincode || !f.gst_number;

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-card/40">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{f.branch_name} <span className="text-xs font-normal text-muted-foreground">({f.branch_code})</span></h3>
          {missing && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" />
              Missing {[!f.pincode && "pincode", !f.gst_number && "GSTIN"].filter(Boolean).join(" & ")} — E-Way Bills will fail.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">GSTIN</Label>
          <div className="flex gap-2">
            <Input value={f.gst_number} onChange={(e) => set("gst_number", e.target.value.toUpperCase())} maxLength={15} className="font-mono" placeholder="36AAACR1234A1Z5" />
            <Button type="button" variant="outline" size="sm" onClick={() => autofill.mutate()} disabled={autofill.isPending}>
              {autofill.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" />Auto-fill</>}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pincode <span className="text-destructive">*</span></Label>
          <Input value={f.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} maxLength={6} placeholder="500001" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Legal Name</Label><Input value={f.legal_name} onChange={(e) => set("legal_name", e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">State Code</Label><Input value={f.state_code} onChange={(e) => set("state_code", e.target.value)} maxLength={2} /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Address Line 1</Label><Input value={f.address_line1} onChange={(e) => set("address_line1", e.target.value)} /></div>
      <div className="space-y-1"><Label className="text-xs">Address Line 2</Label><Input value={f.address_line2} onChange={(e) => set("address_line2", e.target.value)} /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">City</Label><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">State</Label><Input value={f.state} onChange={(e) => set("state", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending} size="sm">
          {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Branch</>}
        </Button>
      </div>
    </div>
  );
}
