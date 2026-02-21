import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function CompanySettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    company_name: "", legal_name: "", gst_number: "", pan_number: "",
    address_line1: "", address_line2: "", city: "", state: "", pincode: "",
    phone: "", email: "", bank_name: "", bank_account: "", bank_ifsc: "",
    invoice_series: "RC",
  });

  const { data: settings } = useQuery({
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
        company_name: settings.company_name || "", legal_name: (settings as any).legal_name || "",
        gst_number: settings.gst_number || "", pan_number: settings.pan_number || "",
        address_line1: settings.address_line1 || "", address_line2: settings.address_line2 || "",
        city: settings.city || "", state: settings.state || "", pincode: settings.pincode || "",
        phone: settings.phone || "", email: settings.email || "",
        bank_name: settings.bank_name || "", bank_account: settings.bank_account || "",
        bank_ifsc: settings.bank_ifsc || "", invoice_series: (settings as any).invoice_series || "RC",
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
      toast.success("Company settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Company Settings</h1><p className="text-muted-foreground">Manage company profile for invoices</p></div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Company Info</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Company Name</Label><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
              <div className="space-y-2"><Label>Legal Name</Label><Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} /></div>
              <div className="space-y-2"><Label>GSTIN</Label><Input value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} /></div>
              <div className="space-y-2"><Label>PAN</Label><Input value={form.pan_number} onChange={(e) => set("pan_number", e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="space-y-2"><Label>Invoice Series</Label><Input value={form.invoice_series} onChange={(e) => set("invoice_series", e.target.value)} placeholder="e.g. RC" /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Address</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Address Line 1</Label><Input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} /></div>
              <div className="col-span-2 space-y-2"><Label>Address Line 2</Label><Input value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} /></div>
              <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
              <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
              <div className="space-y-2"><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} /></div>
              <div className="space-y-2"><Label>Account Number</Label><Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} /></div>
              <div className="space-y-2"><Label>IFSC Code</Label><Input value={form.bank_ifsc} onChange={(e) => set("bank_ifsc", e.target.value)} /></div>
            </CardContent>
          </Card>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : "Save Settings"}</Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
