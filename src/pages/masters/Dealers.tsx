import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBranch } from "@/hooks/useBranch";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Pencil, Download, Copy, RefreshCw, ShieldCheck, AlertTriangle, Loader2, UserPlus, X, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { useDealerOverdue } from "@/hooks/useDealerOverdue";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { DIVISIONS } from "@/lib/divisions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  preferred_transporter_id: "",
  division: "",
  security_deposit_amount: 0, sd_received_date: "", sd_mode: "",
};

type FormErrors = Partial<Record<keyof typeof emptyForm, string>>;

type FieldEmployee = {
  user_id: string;
  name: string;
  employee_code?: string | null;
};

type DealerAssignment = {
  id: string;
  dealer_id: string;
  user_id: string;
  created_at: string;
  employee?: {
    name?: string | null;
    employee_code?: string | null;
  } | null;
  profile?: {
    full_name?: string | null;
  } | null;
};

function invokeAdmin(action: string, body: Record<string, unknown> = {}) {
  return supabase.functions.invoke("manage-users", {
    body: { action, ...body },
  });
}

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

function isGstinValid(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

export default function Dealers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [gstFetching, setGstFetching] = useState(false);
  const [gstWarning, setGstWarning] = useState<string | null>(null);
  const [gstVerifiedAt, setGstVerifiedAt] = useState<string | null>(null);
  const qc = useQueryClient();
  const { branchId } = useBranch();
  const { hasRole } = useAuth();
  const { isOverdue, getOverdue } = useDealerOverdue();
  const canManageAssignments = hasRole("admin");
  const [assignmentDealer, setAssignmentDealer] = useState<{ id: string; name: string } | null>(null);
  const [selectedFieldUserId, setSelectedFieldUserId] = useState("");

  const { data: dealers = [], isLoading } = useQuery({
    queryKey: ["dealers", branchId],
    queryFn: async () => {
      let q = supabase.from("dealers").select("*").order("name");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
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

  const { data: transporters = [] } = useQuery({
    queryKey: ["transporters-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transporters" as any).select("id, name").eq("status", "active").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: fieldEmployees = [] } = useQuery<FieldEmployee[]>({
    queryKey: ["fieldops-employees"],
    enabled: canManageAssignments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("user_id, name, employee_code")
        .eq("is_active", true)
        .eq("role", "fieldops")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: dealerAssignments = [] } = useQuery<DealerAssignment[]>({
    queryKey: ["dealer-assignments"],
    enabled: canManageAssignments,
    queryFn: async () => {
      const { data, error } = await invokeAdmin("list_dealer_assignments");
      if (error) throw error;
      return (data || []) as DealerAssignment[];
    },
  });

  const assignDealerMutation = useMutation({
    mutationFn: async ({ dealer_id, user_id }: { dealer_id: string; user_id: string }) => {
      const { data, error } = await invokeAdmin("assign_dealer", { dealer_id, user_id });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealer-assignments"] });
      toast.success("Dealer assigned");
      setSelectedFieldUserId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassignDealerMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await invokeAdmin("unassign_dealer", { assignment_id: assignmentId });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealer-assignments"] });
      toast.success("Assignment removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const priceLevelMap = Object.fromEntries(priceLevels.map((pl: any) => [pl.id, pl.name]));
  const assignmentsByDealer = dealerAssignments.reduce<Record<string, DealerAssignment[]>>((acc, assignment) => {
    if (!acc[assignment.dealer_id]) acc[assignment.dealer_id] = [];
    acc[assignment.dealer_id].push(assignment);
    return acc;
  }, {});

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
        const { error } = await supabase.from("dealers").insert({ ...rest, branch_id: branchId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealers"] });
      setDialogOpen(false); setEditId(null); setForm(emptyForm); setErrors({}); setGstWarning(null); setGstVerifiedAt(null);
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
      preferred_transporter_id: d.preferred_transporter_id || "",
      division: d.division || "",
      security_deposit_amount: Number(d.security_deposit_amount) || 0,
      sd_received_date: d.sd_received_date || "",
      sd_mode: d.sd_mode || "",
    });
    setErrors({});
    setGstWarning(d.gst_status && d.gst_status !== "Active" ? `GST Status: ${d.gst_status}` : null);
    setGstVerifiedAt(d.gst_last_verified_at || null);
    setDialogOpen(true);
  };

  const handleGstFetch = async () => {
    if (!isGstinValid(form.gst_number)) {
      toast.error("Enter a valid 15-character GSTIN first");
      return;
    }
    setGstFetching(true);
    setGstWarning(null);
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
        setGstWarning(`GST Status: ${d.gst_status} — This GSTIN is not active. Proceed with caution.`);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const submitData: any = { ...form };
    if (!submitData.price_level_id) submitData.price_level_id = null;
    if (!submitData.preferred_transporter_id) submitData.preferred_transporter_id = null;
    if (!submitData.sd_received_date) submitData.sd_received_date = null;
    if (!submitData.sd_mode) submitData.sd_mode = null;
    // Initialize sd_balance to security_deposit_amount on create; preserve on edit
    if (!editId) submitData.sd_balance = submitData.security_deposit_amount;
    if (sameAsBilling) {
      submitData.shipping_address_line1 = form.address_line1;
      submitData.shipping_address_line2 = form.address_line2;
      submitData.shipping_city = form.city;
      submitData.shipping_state = form.state;
      submitData.shipping_pincode = form.pincode;
    }
    if (gstVerifiedAt) {
      submitData.gst_last_verified_at = gstVerifiedAt;
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
    if (form.gst_number && form.gst_number.length >= 2) {
      setForm((f) => ({ ...f, gst_number: stateCode + f.gst_number.slice(2) }));
    }
  };

  const set = (key: string, val: any) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key as keyof FormErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const fieldError = (field: keyof FormErrors) =>
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
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); setErrors({}); setSameAsBilling(false); setGstWarning(null); setGstVerifiedAt(null); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Dealer</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Edit Dealer" : "Add Dealer"}</DialogTitle></DialogHeader>

                {/* GST Warning Banner */}
                {gstWarning && (
                  <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 px-4 py-3 text-sm text-orange-800 dark:text-orange-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{gstWarning}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Basic Info */}
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-foreground">Basic Information</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1">
                        <Label>Dealer Name <span className="text-destructive">*</span></Label>
                        <Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Mehta Chemicals Ltd" className={errors.name ? "border-destructive" : ""} />
                        {fieldError("name")}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label>GSTIN</Label>
                        <div className="flex gap-2">
                          <Input
                            value={form.gst_number}
                            onChange={(e) => set("gst_number", e.target.value.toUpperCase())}
                            placeholder="e.g. 36AABCT1332E1ZT"
                            maxLength={15}
                            className={`font-mono flex-1 ${errors.gst_number ? "border-destructive" : ""}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!isGstinValid(form.gst_number) || gstFetching}
                            onClick={handleGstFetch}
                            className="shrink-0"
                          >
                            {gstFetching ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : gstVerifiedAt ? (
                              <RefreshCw className="h-4 w-4 mr-1" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 mr-1" />
                            )}
                            {gstFetching ? "Fetching..." : gstVerifiedAt ? "Re-Verify" : "Fetch GST"}
                          </Button>
                        </div>
                        {fieldError("gst_number")}
                        {gstVerifiedAt && (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                            <ShieldCheck className="h-3 w-3" />
                            Verified {new Date(gstVerifiedAt).toLocaleDateString("en-IN")}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label>Contact Person</Label>
                        <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} placeholder="Full name" />
                      </div>
                      <div className="space-y-1">
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" className={errors.phone ? "border-destructive" : ""} />
                        {fieldError("phone")}
                      </div>
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="dealer@example.com" className={errors.email ? "border-destructive" : ""} />
                        {fieldError("email")}
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
                        {fieldError("pincode")}
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
                          {fieldError("shipping_pincode")}
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
                         {fieldError("credit_limit")}
                       </div>
                        <div className="space-y-1">
                          <Label>Payment Terms (days)</Label>
                          <Input type="number" value={form.payment_terms_days} onChange={(e) => set("payment_terms_days", Number(e.target.value))} min={0} max={365} className={errors.payment_terms_days ? "border-destructive" : ""} />
                          {fieldError("payment_terms_days")}
                        </div>
                        <div className="space-y-1">
                          <Label>Preferred Transporter</Label>
                          <Select value={form.preferred_transporter_id || "none"} onValueChange={(v) => set("preferred_transporter_id", v === "none" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Select Transporter" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {transporters.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Default transport partner for this dealer</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label>Division / Territory</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                                {form.division || "Select division..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search division..." />
                                <CommandList>
                                  <CommandEmpty>No division found.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem value="" onSelect={() => set("division", "")}>
                                      <Check className={cn("mr-2 h-4 w-4", !form.division ? "opacity-100" : "opacity-0")} />
                                      — None —
                                    </CommandItem>
                                    {DIVISIONS.map((d) => (
                                      <CommandItem key={d} value={d} onSelect={() => set("division", d)}>
                                        <Check className={cn("mr-2 h-4 w-4", form.division === d ? "opacity-100" : "opacity-0")} />
                                        {d}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground">Sales territory used for field-ops routing</p>
                        </div>
                      </div>
                    </fieldset>

                    <fieldset className="space-y-3 border rounded-lg p-4">
                      <legend className="text-sm font-semibold px-2">Security Deposit</legend>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>SD Amount (₹)</Label>
                          <Input type="number" min={0} value={form.security_deposit_amount}
                            onChange={(e) => set("security_deposit_amount", Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Received Date</Label>
                          <Input type="date" value={form.sd_received_date}
                            onChange={(e) => set("sd_received_date", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Mode</Label>
                          <Select value={form.sd_mode || "none"} onValueChange={(v) => set("sd_mode", v === "none" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                              <SelectItem value="upi">UPI</SelectItem>
                            </SelectContent>
                          </Select>
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
                     <TableHead>Terms</TableHead><TableHead>Assigned Reps</TableHead><TableHead>Status</TableHead><TableHead className="w-10"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {d.name}
                            {isOverdue(d.id) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Payment overdue by {getOverdue(d.id)?.maxDaysOverdue} days (₹{getOverdue(d.id)?.totalOverdue.toLocaleString("en-IN")}) — Orders blocked
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {d.gst_number || "—"}
                            {d.gst_last_verified_at && <ShieldCheck className="h-3 w-3 text-green-500" />}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{d.contact_person || "—"}</TableCell>
                         <TableCell className="text-sm">
                           <div>{[d.city, d.state].filter(Boolean).join(", ") || "—"}</div>
                           {d.division && <Badge variant="secondary" className="text-[10px] mt-0.5">{d.division}</Badge>}
                         </TableCell>
                         <TableCell>{d.price_level_id ? <Badge variant="outline">{priceLevelMap[d.price_level_id] || "—"}</Badge> : <span className="text-muted-foreground text-xs">Default</span>}</TableCell>
                        <TableCell>₹{(d.credit_limit || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm">{d.payment_terms_days || 30}d</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(assignmentsByDealer[d.id] || []).length > 0 ? (
                              (assignmentsByDealer[d.id] || []).map((assignment) => (
                                <Badge key={assignment.id} variant="outline" className="text-xs">
                                  {assignment.employee?.name || assignment.profile?.full_name || assignment.user_id}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {canManageAssignments && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => { setAssignmentDealer({ id: d.id, name: d.name }); setSelectedFieldUserId(""); }}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="View 360° profile">
                              <Link to={`/masters/dealers/${d.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!assignmentDealer} onOpenChange={(v) => { if (!v) { setAssignmentDealer(null); setSelectedFieldUserId(""); } }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Assign Field Reps — {assignmentDealer?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedFieldUserId} onValueChange={setSelectedFieldUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select field employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldEmployees.map((employee) => (
                      <SelectItem key={employee.user_id} value={employee.user_id}>
                        {employee.name}{employee.employee_code ? ` · ${employee.employee_code}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => assignmentDealer && selectedFieldUserId && assignDealerMutation.mutate({ dealer_id: assignmentDealer.id, user_id: selectedFieldUserId })}
                  disabled={!assignmentDealer || !selectedFieldUserId || assignDealerMutation.isPending}
                >
                  {assignDealerMutation.isPending ? "Assigning..." : "Assign"}
                </Button>
              </div>

              <div className="space-y-2">
                {(assignmentDealer ? assignmentsByDealer[assignmentDealer.id] || [] : []).length > 0 ? (
                  (assignmentDealer ? assignmentsByDealer[assignmentDealer.id] || [] : []).map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{assignment.employee?.name || assignment.profile?.full_name || assignment.user_id}</p>
                        {assignment.employee?.employee_code && (
                          <p className="text-xs text-muted-foreground">{assignment.employee.employee_code}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unassignDealerMutation.mutate(assignment.id)}
                        disabled={unassignDealerMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No field reps assigned to this dealer yet.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
