import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { name: "", type: "earning", is_percentage: false, value: 0, description: "" };

export default function SalaryComponents() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["salary-components"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salary_components").select("*").order("type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, ...rest } = values;
      if (id) {
        const { error } = await supabase.from("salary_components").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("salary_components").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-components"] });
      setDialogOpen(false); setEditId(null); setForm(emptyForm);
      toast.success(editId ? "Component updated" : "Component added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({ name: c.name, type: c.type, is_percentage: c.is_percentage, value: c.value, description: c.description || "" });
    setDialogOpen(true);
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const earnings = components.filter((c: any) => c.type === "earning");
  const deductions = components.filter((c: any) => c.type === "deduction");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Salary Components</h1>
            <p className="text-muted-foreground">Configure earnings and deductions for payroll</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Component</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Component" : "Add Component"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(editId ? { ...form, id: editId } : form); }} className="space-y-4">
                <div className="space-y-2"><Label>Name *</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HRA, PF, ESI" /></div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => set("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earning">Earning</SelectItem>
                      <SelectItem value="deduction">Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.is_percentage} onCheckedChange={(v) => set("is_percentage", v)} />
                  <Label>Calculate as percentage of Basic</Label>
                </div>
                <div className="space-y-2">
                  <Label>{form.is_percentage ? "Percentage (%)" : "Fixed Amount (₹)"}</Label>
                  <Input type="number" step="0.01" value={form.value} onChange={(e) => set("value", Number(e.target.value))} />
                </div>
                <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : editId ? "Update" : "Add Component"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Earnings</CardTitle><CardDescription>Added to gross salary</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <p className="text-muted-foreground text-center py-4">Loading...</p> : earnings.length === 0 ? <p className="text-muted-foreground text-center py-4">No earnings configured</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {earnings.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.is_percentage ? `${c.value}%` : `₹${Number(c.value).toLocaleString("en-IN")}`}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Deductions</CardTitle><CardDescription>Subtracted from gross salary</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <p className="text-muted-foreground text-center py-4">Loading...</p> : deductions.length === 0 ? <p className="text-muted-foreground text-center py-4">No deductions configured</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {deductions.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.is_percentage ? `${c.value}%` : `₹${Number(c.value).toLocaleString("en-IN")}`}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
