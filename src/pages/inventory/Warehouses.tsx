import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Warehouse, MapPin, Trash2 } from "lucide-react";
import { AlterButton } from "@/components/tally/AlterButton";

interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface BinRow {
  id: string;
  warehouse_id: string;
  bin_code: string;
  description: string | null;
  is_active: boolean;
}

const emptyWarehouse = { name: "", code: "", address_line1: "", city: "", state: "", pincode: "" };
const emptyBin = { warehouse_id: "", bin_code: "", description: "" };

export default function Warehouses() {
  const qc = useQueryClient();
  const [whOpen, setWhOpen] = useState(false);
  const [binOpen, setBinOpen] = useState(false);
  const [form, setForm] = useState(emptyWarehouse);
  const [binForm, setBinForm] = useState(emptyBin);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedWh, setSelectedWh] = useState<string | null>(null);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").order("created_at");
      if (error) throw error;
      return data as WarehouseRow[];
    },
  });

  const { data: bins = [] } = useQuery({
    queryKey: ["warehouse-bins", selectedWh],
    queryFn: async () => {
      if (!selectedWh) return [];
      const { data, error } = await supabase.from("warehouse_bins").select("*").eq("warehouse_id", selectedWh).order("bin_code");
      if (error) throw error;
      return data as BinRow[];
    },
    enabled: !!selectedWh,
  });

  const whMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("warehouses").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouses").insert(form as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(editId ? "Warehouse updated" : "Warehouse created");
      setForm(emptyWarehouse);
      setEditId(null);
      setWhOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const binMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("warehouse_bins").insert({ ...binForm, warehouse_id: selectedWh } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouse-bins"] });
      toast.success("Bin added");
      setBinForm(emptyBin);
      setBinOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("warehouses").update({ is_active: active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["warehouses"] });
  };

  const setDefault = async (id: string) => {
    await supabase.from("warehouses").update({ is_default: false }).neq("id", id);
    await supabase.from("warehouses").update({ is_default: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["warehouses"] });
    toast.success("Default warehouse updated");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Warehouses / Godowns</h1>
            <p className="text-muted-foreground">Manage storage locations and bin locations</p>
          </div>
          <Dialog open={whOpen} onOpenChange={setWhOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm(emptyWarehouse); setEditId(null); }}>
                <Plus className="h-4 w-4 mr-2" />Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Alter" : "Create"} Warehouse</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); whMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Main Godown" />
                  </div>
                  <div className="space-y-2">
                    <Label>Code *</Label>
                    <Input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WH-01" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={form.address_line1} onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} maxLength={6} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={whMutation.isPending}>
                  {whMutation.isPending ? "Saving..." : editId ? "Alter" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="warehouses" onValueChange={(v) => { if (v === "bins" && warehouses.length > 0 && !selectedWh) setSelectedWh(warehouses[0].id); }}>
          <TabsList>
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
            <TabsTrigger value="bins">Bin Locations</TabsTrigger>
          </TabsList>

          <TabsContent value="warehouses">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Warehouse className="h-5 w-5" />All Warehouses</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warehouses.map((wh) => (
                        <TableRow key={wh.id}>
                          <TableCell className="font-mono text-sm">{wh.code}</TableCell>
                          <TableCell className="font-medium">{wh.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {[wh.city, wh.state].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell>
                            <Switch checked={wh.is_active} onCheckedChange={(v) => toggleActive(wh.id, v)} />
                          </TableCell>
                          <TableCell>
                            {wh.is_default ? (
                              <Badge>Default</Badge>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => setDefault(wh.id)} className="text-xs">Set Default</Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <AlterButton onClick={() => {
                              setForm({ name: wh.name, code: wh.code, address_line1: wh.address_line1 || "", city: wh.city || "", state: wh.state || "", pincode: wh.pincode || "" });
                              setEditId(wh.id);
                              setWhOpen(true);
                            }} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {warehouses.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No warehouses yet. Add your first one.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bins">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Bin Locations</CardTitle>
                  <div className="flex items-center gap-3">
                    <select
                      className="rounded-md border px-3 py-1.5 text-sm bg-background"
                      value={selectedWh || ""}
                      onChange={(e) => setSelectedWh(e.target.value)}
                    >
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                      ))}
                    </select>
                    <Dialog open={binOpen} onOpenChange={setBinOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={!selectedWh}><Plus className="h-4 w-4 mr-1" />Add Bin</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add Bin Location</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); binMutation.mutate(); }} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Bin Code *</Label>
                            <Input required value={binForm.bin_code} onChange={(e) => setBinForm((f) => ({ ...f, bin_code: e.target.value.toUpperCase() }))} placeholder="A-01-01" />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={binForm.description} onChange={(e) => setBinForm((f) => ({ ...f, description: e.target.value }))} placeholder="Row A, Shelf 1, Position 1" />
                          </div>
                          <Button type="submit" className="w-full" disabled={binMutation.isPending}>
                            {binMutation.isPending ? "Adding..." : "Add Bin"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bin Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bins.map((bin) => (
                      <TableRow key={bin.id}>
                        <TableCell className="font-mono text-sm">{bin.bin_code}</TableCell>
                        <TableCell>{bin.description || "—"}</TableCell>
                        <TableCell><Badge variant={bin.is_active ? "default" : "secondary"}>{bin.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {bins.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No bins defined for this warehouse.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
