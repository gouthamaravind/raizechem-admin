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
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";

const emptyForm = {
  name: "", designation: "", department: "", date_of_joining: "",
  basic_salary: 0, bank_account: "", pan: "", uan: "", phone: "", email: "",
};

export default function Employees() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      if (id) {
        const { error } = await supabase.from("employees").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setDialogOpen(false); setEditId(null); setForm(emptyForm);
      toast.success(editId ? "Employee updated" : "Employee added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = employees.filter((emp: any) => {
    const s = search.toLowerCase();
    return emp.name?.toLowerCase().includes(s) || emp.department?.toLowerCase().includes(s) || emp.designation?.toLowerCase().includes(s);
  });

  const openEdit = (emp: any) => {
    setEditId(emp.id);
    setForm({
      name: emp.name || "", designation: emp.designation || "", department: emp.department || "",
      date_of_joining: emp.date_of_joining || "", basic_salary: emp.basic_salary || 0,
      bank_account: emp.bank_account || "", pan: emp.pan || "", uan: emp.uan || "",
      phone: emp.phone || "", email: emp.email || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, date_of_joining: form.date_of_joining || null };
    mutation.mutate(editId ? { ...payload, id: editId } : payload);
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">Manage employee master data</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("employees.csv", filtered, [
              { key: "name", label: "Name" }, { key: "designation", label: "Designation" },
              { key: "department", label: "Department" }, { key: "basic_salary", label: "Basic Salary" },
              { key: "pan", label: "PAN" }, { key: "phone", label: "Phone" }, { key: "status", label: "Status" },
            ])}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Employee</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2"><Label>Name *</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Designation</Label><Input value={form.designation} onChange={(e) => set("designation", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => set("department", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Date of Joining</Label><Input type="date" value={form.date_of_joining} onChange={(e) => set("date_of_joining", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Basic Salary (₹)</Label><Input type="number" value={form.basic_salary} onChange={(e) => set("basic_salary", Number(e.target.value))} /></div>
                    <div className="space-y-2"><Label>PAN</Label><Input value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} maxLength={10} className="font-mono" /></div>
                    <div className="space-y-2"><Label>UAN (PF Number)</Label><Input value={form.uan} onChange={(e) => set("uan", e.target.value)} className="font-mono" /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                    <div className="col-span-2 space-y-2"><Label>Bank Account</Label><Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} className="font-mono" /></div>
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : editId ? "Update Employee" : "Add Employee"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search employees..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No employees found.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Department</TableHead>
                  <TableHead className="text-right">Basic Salary</TableHead><TableHead>PAN</TableHead>
                  <TableHead>Status</TableHead><TableHead className="w-10"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.designation || "—"}</TableCell>
                      <TableCell>{emp.department || "—"}</TableCell>
                      <TableCell className="text-right">₹{Number(emp.basic_salary || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="font-mono text-sm">{emp.pan || "—"}</TableCell>
                      <TableCell><Badge variant={emp.status === "active" ? "default" : "secondary"}>{emp.status}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
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
