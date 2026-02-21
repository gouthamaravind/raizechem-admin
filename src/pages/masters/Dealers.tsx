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
import { Search, Plus, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";

const emptyForm = {
  name: "", gst_number: "", contact_person: "", phone: "", email: "",
  address_line1: "", address_line2: "", city: "", state: "", state_code: "",
  pincode: "", credit_limit: 0, payment_terms_days: 30,
  shipping_address_line1: "", shipping_address_line2: "", shipping_city: "",
  shipping_state: "", shipping_pincode: "",
};

export default function Dealers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: dealers = [], isLoading } = useQuery({
    queryKey: ["dealers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

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
      setDialogOpen(false); setEditId(null); setForm(emptyForm);
      toast.success(editId ? "Dealer updated" : "Dealer added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = dealers.filter((d: any) => {
    const s = search.toLowerCase();
    const match = d.name?.toLowerCase().includes(s) || d.city?.toLowerCase().includes(s) || d.gst_number?.toLowerCase().includes(s);
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
      shipping_pincode: d.shipping_pincode || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(editId ? { ...form, id: editId } : form);
  };

  const handleExport = () => {
    exportToCsv("dealers.csv", filtered, [
      { key: "name", label: "Name" }, { key: "gst_number", label: "GSTIN" },
      { key: "phone", label: "Phone" }, { key: "city", label: "City" },
      { key: "state", label: "State" }, { key: "state_code", label: "State Code" },
      { key: "credit_limit", label: "Credit Limit" }, { key: "status", label: "Status" },
    ]);
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dealers</h1>
            <p className="text-muted-foreground">Manage your dealer network</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Dealer</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Edit Dealer" : "Add Dealer"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2"><Label>Name *</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
                    <div className="space-y-2"><Label>GSTIN</Label><Input value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                  </div>
                  <h4 className="font-semibold text-sm pt-2">Billing Address</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2"><Label>Address Line 1</Label><Input value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} /></div>
                    <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
                    <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
                    <div className="space-y-2"><Label>State Code</Label><Input value={form.state_code} onChange={(e) => set("state_code", e.target.value)} placeholder="e.g. 36" /></div>
                    <div className="space-y-2"><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} /></div>
                  </div>
                  <h4 className="font-semibold text-sm pt-2">Shipping Address</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2"><Label>Address Line 1</Label><Input value={form.shipping_address_line1} onChange={(e) => set("shipping_address_line1", e.target.value)} /></div>
                    <div className="space-y-2"><Label>City</Label><Input value={form.shipping_city} onChange={(e) => set("shipping_city", e.target.value)} /></div>
                    <div className="space-y-2"><Label>State</Label><Input value={form.shipping_state} onChange={(e) => set("shipping_state", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Pincode</Label><Input value={form.shipping_pincode} onChange={(e) => set("shipping_pincode", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2"><Label>Credit Limit (₹)</Label><Input type="number" value={form.credit_limit} onChange={(e) => set("credit_limit", Number(e.target.value))} /></div>
                    <div className="space-y-2"><Label>Payment Terms (days)</Label><Input type="number" value={form.payment_terms_days} onChange={(e) => set("payment_terms_days", Number(e.target.value))} /></div>
                  </div>
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
              <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search dealers..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No dealers found.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>GSTIN</TableHead><TableHead>City</TableHead>
                  <TableHead>State Code</TableHead><TableHead>Phone</TableHead><TableHead>Credit Limit</TableHead>
                  <TableHead>Status</TableHead><TableHead className="w-10"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.gst_number || "—"}</TableCell>
                      <TableCell>{d.city || "—"}</TableCell>
                      <TableCell>{d.state_code || "—"}</TableCell>
                      <TableCell>{d.phone || "—"}</TableCell>
                      <TableCell>₹{(d.credit_limit || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
