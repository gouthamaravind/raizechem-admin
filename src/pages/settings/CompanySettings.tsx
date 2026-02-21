import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building2, MapPin, Landmark, FileText, Upload, Loader2, Trash2 } from "lucide-react";

export default function CompanySettings() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    company_name: "", legal_name: "", gst_number: "", pan_number: "",
    address_line1: "", address_line2: "", city: "", state: "", pincode: "",
    phone: "", email: "", bank_name: "", bank_account: "", bank_ifsc: "",
    invoice_series: "RC", logo_url: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || "", legal_name: settings.legal_name || "",
        gst_number: settings.gst_number || "", pan_number: settings.pan_number || "",
        address_line1: settings.address_line1 || "", address_line2: settings.address_line2 || "",
        city: settings.city || "", state: settings.state || "", pincode: settings.pincode || "",
        phone: settings.phone || "", email: settings.email || "",
        bank_name: settings.bank_name || "", bank_account: settings.bank_account || "",
        bank_ifsc: settings.bank_ifsc || "", invoice_series: settings.invoice_series || "RC",
        logo_url: settings.logo_url || "",
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("No settings found");
      const { error } = await supabase.from("company_settings").update(form as any).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Company settings saved successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo.${ext}`;
      // Remove old logo if exists
      await supabase.storage.from("company-assets").remove([path]);
      const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: urlData.publicUrl }));
      toast.success("Logo uploaded! Don't forget to save.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setForm((f) => ({ ...f, logo_url: "" }));
    toast.info("Logo removed. Save to confirm.");
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-muted-foreground">Manage your company profile, branding, and invoice details</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-6">
          {/* Logo & Branding */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Company Logo</CardTitle>
                  <CardDescription>This logo will appear on invoices and reports</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative h-24 w-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Company logo" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Building2 className="h-10 w-10 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {uploading ? "Uploading..." : "Upload Logo"}
                    </Button>
                    {form.logo_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                        <Trash2 className="h-4 w-4 mr-2" />Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 2MB.</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>Basic details used on invoices and GST filings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="e.g. Raizechem Pvt Ltd" />
                </div>
                <div className="space-y-2">
                  <Label>Legal Name</Label>
                  <Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="As per GST registration" />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input value={form.gst_number} onChange={(e) => set("gst_number", e.target.value.toUpperCase())} placeholder="e.g. 36AAACR1234A1Z5" maxLength={15} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>PAN</Label>
                  <Input value={form.pan_number} onChange={(e) => set("pan_number", e.target.value.toUpperCase())} placeholder="e.g. AAACR1234A" maxLength={10} className="font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="info@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Series</Label>
                  <Input value={form.invoice_series} onChange={(e) => set("invoice_series", e.target.value.toUpperCase())} placeholder="e.g. RC" maxLength={5} className="font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Registered Address</CardTitle>
                  <CardDescription>Address printed on invoices and e-way bills</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Address Line 1</Label>
                <Input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} placeholder="Building, Street" />
              </div>
              <div className="space-y-2">
                <Label>Address Line 2</Label>
                <Input value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} placeholder="Area, Landmark" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Hyderabad" />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Telangana" />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} placeholder="500001" maxLength={6} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Bank Details</CardTitle>
                  <CardDescription>Bank information printed on invoices for payment</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="e.g. HDFC Bank" />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} placeholder="Account number" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input value={form.bank_ifsc} onChange={(e) => set("bank_ifsc", e.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" maxLength={11} className="font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex items-center gap-4 pt-2">
            <Button type="submit" disabled={mutation.isPending} className="px-8">
              {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Settings"}
            </Button>
            <p className="text-xs text-muted-foreground">Changes will reflect on all new invoices</p>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
