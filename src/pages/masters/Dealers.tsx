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
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Pencil, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";

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

const emptyForm = {
  name: "", gst_number: "", contact_person: "", phone: "", email: "",
  address_line1: "", address_line2: "", city: "", state: "", state_code: "",
  pincode: "", credit_limit: 0, payment_terms_days: 30,
  shipping_address_line1: "", shipping_address_line2: "", shipping_city: "",
  shipping_state: "", shipping_pincode: "", price_level_id: "",
};

type FormErrors = Partial<Record<keyof typeof emptyForm, string>>;

function validateGSTIN(gstin: string): boolean {
  if (!gstin) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

function validatePincode(pin: string): boolean {
  if (!pin) return true;
  return /^[1-9][0-9]{5}$/.test(pin);
}

function validatePhone(phone: string): boolean {
  if (!phone) return true;
  return /^[+]?[\d\s-]{10,15}$/.test(phone);
}

export default function Dealers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const qc = useQueryClient();

  const { data: dealers = [], isLoading } = useQuery({
    queryKey: ["dealers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: priceLevels = [] } = useQuery({
    queryKey: ["price_levels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_levels").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const priceLevelMap = Object.fromEntries(priceLevels.map((pl: any) => [pl.id, pl.name]));

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Dealer name is required";
    if (form.name.length > 200) e.name = "Name too long (max 200 chars)";
    if (!validateGSTIN(form.gst_number)) e.gst_number = "Invalid GSTIN format (e.g. 36AABCT1332E1ZT)";
    if (!validatePhone(form.phone)) e.phone = "Invalid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email address";
    if (!validatePincode(form.pincode)) e.pincode = "Invalid pincode (6 digits)";
    if (!validatePincode(form.shipping_pincode)) e.shipping_pincode = "Invalid pincode (6 digits)";
    if (form.credit_limit < 0) e.credit_limit = "Cannot be negative";
    if (form.payment_terms_days < 0 || form.payment_terms_days > 365) e.payment_terms_days = "Must be 0-365 days";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      if (id) {
        const { error } = await supabase.from("dealers").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dealers").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealers"] });
      setDialogOpen(false); setEditId(null); setForm(emptyForm); setErrors({});
      toast.success(editId ? "Dealer updated" : "Dealer added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = dealers.filter((d: any) => {
    const s = search.toLowerCase();
    const match = d.name?.toLowerCase().includes(s) || d.city?.toLowerCase().includes(s) || d.gst_number?.toLowerCase().includes(s) || d.contact_person?.toLowerCase().includes(s);
    return match && (statusFilter === "all" || d.status === statusFilter);
  });

  const openEdit = (d: any) => {
    setEditId(d.id);
    setForm({
      name: d.name || "", gst_number: d.gst_number || "", contact_person: d.contact_person || "",
      phone: d.phone || "", email: d.email || "", address_line1: d.address_line1 || "",
      address_line2: d.address_line2 || "", city: d.city || "", state: d.state || "",
      state_code: d.state_code || "", pincode: d.pincode || "",
      credit_limit: d.credit_limit || 0, payment_terms_days: d.payment_terms_days || 30,
      shipping_address_line1: d.shipping_address_line1 || "", shipping_address_line2: d.shipping_address_line2 || "",
      shipping_city: d.shipping_city || "", shipping_state: d.shipping_state || "",
      shipping_pincode: d.shipping_pincode || "", price_level_id: d.price_level_id || "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const submitData: any = { ...form };
    if (!submitData.price_level_id) submitData.price_level_id = null;
    if (sameAsBilling) {
      submitData.shipping_address_line1 = form.address_line1;
      submitData.shipping_address_line2 = form.address_line2;
      submitData.shipping_city = form.city;
      submitData.shipping_state = form.state;
      submitData.shipping_pincode = form.pincode;
    }
    mutation.mutate(editId ? { ...submitData, id: editId } : submitData);
  };

  const handleExport = () => {
    exportToCsv("dealers.csv", filtered, [
      { key: "name", label: "Name" }, { key: "gst_number", label: "GSTIN" },
      { key: "contact_person", label: "Contact Person" }, { key: "phone", label: "Phone" },
      { key: "email", label: "Email" }, { key: "city", label: "City" },
      { key: "state", label: "State" }, { key: "state_code", label: "State Code" },
      { key: "credit_limit", label: "Credit Limit" }, { key: "payment_terms_days", label: "Payment Terms (Days)" },
      { key: "status", label: "Status" },
    ]);
  };

  const handleStateChange = (stateCode: string) => {
    const state = INDIAN_STATES.find((s) => s.code === stateCode);
    setForm((f) => ({ ...f, state_code: stateCode, state: state?.name || "" }));
    // Auto-fill GSTIN state prefix
    if (form.gst_number && form.gst_number.length >= 2) {
      setForm((f) => ({ ...f, gst_number: stateCode + f.gst_number.slice(2) }));
    }
  };

  const set = (key: string, val: any) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const FieldError = ({ field }: { field: keyof FormErrors }) => 
    errors[field] ? <p className="text-xs text-destructive mt-1">{errors[field]}</p> : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dealers</h1>
            <p className="text-muted-foreground">Manage your dealer network ({filtered.length} of {dealers.length})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); setErrors({}); setSameAsBilling(false); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Dealer</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Edit Dealer" : "Add Dealer"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Basic Info */}
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-foreground">Basic Information</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <Label>Dealer Name <span className="text-destructive">*</span></Label>
                        <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Mehta Chemicals Ltd" className={errors.name ? "border-destructive" : ""} />
                        <FieldError field="name" />
                      </div>
                      <div className="space-y-1">
                        <Label>GSTIN</Label>
                        <Input value={form.gst_number} onChange={(e) => set("gst_number", e.target.value.toUpperCase())} placeholder="e.g. 36AABCT1332E1ZT" maxLength={15} className={`font-mono ${errors.gst_number ? "border-destructive" : ""}`} />
                        <FieldError field="gst_number" />
                      </div>
                      <div className="space-y-1">
                        <Label>Contact Person</Label>
                        <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} placeholder="Full name" />
                      </div>
                      <div className="space-y-1">
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" className={errors.phone ? "border-destructive" : ""} />
                        <FieldError field="phone" />
                      </div>
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="dealer@example.com" className={errors.email ? "border-destructive" : ""} />
                        <FieldError field="email" />
                      </div>
                    </div>
                  </fieldset>

                  {/* Billing Address */}
                  <fieldset className="space-y-3 border-t pt-4">
                    <legend className="text-sm font-semibold text-foreground">Billing Address</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1"><Label>Address Line 1</Label><Input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} placeholder="Building, Street" /></div>
                      <div className="col-span-2 space-y-1"><Label>Address Line 2</Label><Input value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} placeholder="Area, Landmark" /></div>
                      <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
                      <div className="space-y-1">
                        <Label>State</Label>
                        <Select value={form.state_code} onValueChange={handleStateChange}>
                          <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                          <SelectContent className="max-h-56">
                            {INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Pincode</Label>
                        <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} placeholder="500001" maxLength={6} className={errors.pincode ? "border-destructive" : ""} />
                        <FieldError field="pincode" />
                      </div>
                    </div>
                  </fieldset>

                  {/* Shipping Address */}
                  <fieldset className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <legend className="text-sm font-semibold text-foreground">Shipping Address</legend>
                      <div className="flex items-center gap-2">
                        <Checkbox id="same-billing" checked={sameAsBilling} onCheckedChange={(v) => setSameAsBilling(!!v)} />
                        <label htmlFor="same-billing" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                          <Copy className="h-3 w-3" /> Same as billing
                        </label>
                      </div>
                    </div>
                    {!sameAsBilling && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1"><Label>Address Line 1</Label><Input value={form.shipping_address_line1} onChange={(e) => set("shipping_address_line1", e.target.value)} /></div>
                        <div className="space-y-1"><Label>City</Label><Input value={form.shipping_city} onChange={(e) => set("shipping_city", e.target.value)} /></div>
                        <div className="space-y-1"><Label>State</Label><Input value={form.shipping_state} onChange={(e) => set("shipping_state", e.target.value)} /></div>
                        <div className="space-y-1">
                          <Label>Pincode</Label>
                          <Input value={form.shipping_pincode} onChange={(e) => set("shipping_pincode", e.target.value)} maxLength={6} className={errors.shipping_pincode ? "border-destructive" : ""} />
                          <FieldError field="shipping_pincode" />
                        </div>
                      </div>
                    )}
                  </fieldset>

                   {/* Commercial Terms */}
                   <fieldset className="space-y-3 border-t pt-4">
                     <legend className="text-sm font-semibold text-foreground">Commercial Terms</legend>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <Label>Price Level</Label>
                         <Select value={form.price_level_id || "none"} onValueChange={(v) => set("price_level_id", v === "none" ? "" : v)}>
                           <SelectTrigger><SelectValue placeholder="Select Price Level" /></SelectTrigger>
                           <SelectContent>
                             <SelectItem value="none">— Default (Sale Price) —</SelectItem>
                             {priceLevels.map((pl: any) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                         <p className="text-xs text-muted-foreground">Determines product pricing for this dealer</p>
                       </div>
                       <div className="space-y-1">
                         <Label>Credit Limit (₹)</Label>
                         <Input type="number" value={form.credit_limit} onChange={(e) => set("credit_limit", Number(e.target.value))} min={0} className={errors.credit_limit ? "border-destructive" : ""} />
                         <FieldError field="credit_limit" />
                       </div>
                       <div className="space-y-1">
                         <Label>Payment Terms (days)</Label>
                         <Input type="number" value={form.payment_terms_days} onChange={(e) => set("payment_terms_days", Number(e.target.value))} min={0} max={365} className={errors.payment_terms_days ? "border-destructive" : ""} />
                         <FieldError field="payment_terms_days" />
                       </div>
                     </div>
                   </fieldset>

                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : editId ? "Update Dealer" : "Add Dealer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, city, GSTIN, contact..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No dealers found.</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                     <TableHead>Name</TableHead><TableHead>GSTIN</TableHead><TableHead>Contact</TableHead>
                     <TableHead>City / State</TableHead><TableHead>Price Level</TableHead><TableHead>Credit Limit</TableHead>
                     <TableHead>Terms</TableHead><TableHead>Status</TableHead><TableHead className="w-10"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{d.gst_number || "—"}</TableCell>
                        <TableCell className="text-sm">{d.contact_person || "—"}</TableCell>
                         <TableCell className="text-sm">{[d.city, d.state].filter(Boolean).join(", ") || "—"}</TableCell>
                         <TableCell>{d.price_level_id ? <Badge variant="outline">{priceLevelMap[d.price_level_id] || "—"}</Badge> : <span className="text-muted-foreground text-xs">Default</span>}</TableCell>
                        <TableCell>₹{(d.credit_limit || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm">{d.payment_terms_days || 30}d</TableCell>
                        <TableCell><Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
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
