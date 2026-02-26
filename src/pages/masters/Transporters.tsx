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
import { Search, Plus, Pencil, ShieldCheck, RefreshCw, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const INDIAN_STATES = [
  { code: "01", name: "Jammu & Kashmir" }, { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" }, { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" }, { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" }, { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" }, { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" }, { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" }, { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" }, { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" }, { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" }, { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" }, { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" }, { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli" }, { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh" }, { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" }, { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" }, { code: "34", name: "Puducherry" },
  { code: "36", name: "Telangana" }, { code: "37", name: "Andhra Pradesh (New)" },
];

function isGstinValid(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

const emptyForm = {
  name: "", gst_number: "", contact_person: "", phone: "", email: "",
  address_line1: "", city: "", state: "", state_code: "", pincode: "",
  vehicle_types: "", notes: "", status: "active",
};

export default function Transporters() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [gstFetching, setGstFetching] = useState(false);
  const [gstVerifiedAt, setGstVerifiedAt] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: transporters = [], isLoading } = useQuery({
    queryKey: ["transporters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transporters" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      if (gstVerifiedAt) rest.gst_last_verified_at = gstVerifiedAt;
      if (id) {
        const { error } = await supabase.from("transporters" as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transporters" as any).insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transporters"] });
      setDialogOpen(false); setEditId(null); setForm(emptyForm); setGstVerifiedAt(null);
      toast.success(editId ? "Transporter updated" : "Transporter added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleGstFetch = async () => {
    if (!isGstinValid(form.gst_number)) {
      toast.error("Enter a valid 15-character GSTIN first");
      return;
    }
    setGstFetching(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("verify-gst", {
        body: { gstNo: form.gst_number },
      });
      if (fnError) throw new Error(fnError.message || "Lookup failed");
      if (!fnData?.success) throw new Error(fnData?.error || "Lookup failed");

      const d = fnData.data;
      const stateCode = d.state_code || form.gst_number.substring(0, 2);
      const stateName = INDIAN_STATES.find((s) => s.code === stateCode)?.name || "";

      setForm((f) => ({
        ...f,
        name: d.trade_name || d.legal_name || f.name,
        contact_person: d.legal_name || f.contact_person,
        state_code: stateCode,
        state: stateName,
        address_line1: d.address || f.address_line1,
        pincode: d.pincode || f.pincode,
      }));
      setGstVerifiedAt(new Date().toISOString());

      if (d.gst_status && d.gst_status !== "Active") {
        toast.warning(`GST status is "${d.gst_status}" — not Active`);
      } else {
        toast.success("✓ GST Verified Successfully");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch GST details");
    } finally {
      setGstFetching(false);
    }
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      name: t.name || "", gst_number: t.gst_number || "", contact_person: t.contact_person || "",
      phone: t.phone || "", email: t.email || "", address_line1: t.address_line1 || "",
      city: t.city || "", state: t.state || "", state_code: t.state_code || "",
      pincode: t.pincode || "", vehicle_types: t.vehicle_types || "", notes: t.notes || "",
      status: t.status || "active",
    });
    setGstVerifiedAt(t.gst_last_verified_at || null);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Transport name is required"); return; }
    mutation.mutate(editId ? { ...form, id: editId } : form);
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const filtered = transporters.filter((t: any) => {
    const s = search.toLowerCase();
    return t.name?.toLowerCase().includes(s) || t.gst_number?.toLowerCase().includes(s) || t.city?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transporters</h1>
            <p className="text-muted-foreground">Manage transport partners</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); setGstVerifiedAt(null); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Transporter</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? "Edit Transporter" : "Add Transporter"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-foreground">Basic Information</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1">
                      <Label>Transport Name <span className="text-destructive">*</span></Label>
                      <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sri Balaji Transport" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label>GSTIN</Label>
                      <div className="flex gap-2">
                        <Input
                          value={form.gst_number}
                          onChange={(e) => set("gst_number", e.target.value.toUpperCase())}
                          placeholder="e.g. 36AABCT1332E1ZT"
                          maxLength={15}
                          className="font-mono flex-1"
                        />
                        <Button
                          type="button" variant="outline" size="sm"
                          disabled={!isGstinValid(form.gst_number) || gstFetching}
                          onClick={handleGstFetch}
                          className="shrink-0"
                        >
                          {gstFetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : gstVerifiedAt ? <RefreshCw className="h-4 w-4 mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                          {gstFetching ? "Fetching..." : gstVerifiedAt ? "Re-Verify" : "Fetch GST"}
                        </Button>
                      </div>
                      {gstVerifiedAt && (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                          <ShieldCheck className="h-3 w-3" />
                          Verified {new Date(gstVerifiedAt).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Contact Person</Label>
                      <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => set("status", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="space-y-3 border-t pt-4">
                  <legend className="text-sm font-semibold text-foreground">Address</legend>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1">
                      <Label>Address</Label>
                      <Input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} />
                    </div>
                    <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
                    <div className="space-y-1">
                      <Label>State</Label>
                      <Select value={form.state_code} onValueChange={(v) => { const s = INDIAN_STATES.find((s) => s.code === v); set("state_code", v); set("state", s?.name || ""); }}>
                        <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                        <SelectContent className="max-h-56">
                          {INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} maxLength={6} /></div>
                  </div>
                </fieldset>

                <fieldset className="space-y-3 border-t pt-4">
                  <legend className="text-sm font-semibold text-foreground">Additional Details</legend>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <Label>Vehicle Types</Label>
                      <Input value={form.vehicle_types} onChange={(e) => set("vehicle_types", e.target.value)} placeholder="e.g. 14ft, 17ft, 22ft, Container" />
                      <p className="text-xs text-muted-foreground">Comma-separated list of available vehicle types</p>
                    </div>
                    <div className="space-y-1">
                      <Label>Notes</Label>
                      <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes..." rows={2} />
                    </div>
                  </div>
                </fieldset>

                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editId ? "Update Transporter" : "Add Transporter"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transporters..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No transporters found. Add your first transporter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>City / State</TableHead>
                      <TableHead>Vehicle Types</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {t.gst_number || "—"}
                            {t.gst_last_verified_at && <ShieldCheck className="h-3 w-3 text-green-500" />}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{t.contact_person || "—"}<br /><span className="text-xs text-muted-foreground">{t.phone || ""}</span></TableCell>
                        <TableCell className="text-sm">{[t.city, t.state].filter(Boolean).join(", ") || "—"}</TableCell>
                        <TableCell className="text-sm">{t.vehicle_types || "—"}</TableCell>
                        <TableCell><Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
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
