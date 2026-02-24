import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function OpeningBalances() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<"dealer" | "supplier">("dealer");
  const [entityId, setEntityId] = useState("");
  const [fyId, setFyId] = useState("");
  const [openingDebit, setOpeningDebit] = useState(0);
  const [openingCredit, setOpeningCredit] = useState(0);
  const [tab, setTab] = useState("dealer");

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ["opening-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opening_balances")
        .select("*, financial_years(fy_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dealers = [] } = useQuery({
    queryKey: ["dealers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("dealers").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: fys = [] } = useQuery({
    queryKey: ["financial-years"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_years").select("id, fy_code").order("start_date", { ascending: false });
      return data || [];
    },
  });

  // Get entity names for display
  const getEntityName = (entityId: string, entityType: string) => {
    if (entityType === "dealer") return dealers.find((d: any) => d.id === entityId)?.name || entityId;
    return suppliers.find((s: any) => s.id === entityId)?.name || entityId;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!entityId || !fyId) throw new Error("Select entity and financial year");

      if (editId) {
        const { error } = await supabase
          .from("opening_balances")
          .update({ opening_debit: openingDebit, opening_credit: openingCredit })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("opening_balances").insert({
          entity_id: entityId,
          entity_type: entityType,
          fy_id: fyId,
          opening_debit: openingDebit,
          opening_credit: openingCredit,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opening-balances"] });
      resetForm();
      toast.success(editId ? "Balance updated" : "Opening balance added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opening_balances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opening-balances"] });
      toast.success("Balance deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditId(null);
    setEntityId("");
    setFyId("");
    setOpeningDebit(0);
    setOpeningCredit(0);
    setEntityType("dealer");
  };

  const openEdit = (b: any) => {
    setEditId(b.id);
    setEntityType(b.entity_type);
    setEntityId(b.entity_id);
    setFyId(b.fy_id);
    setOpeningDebit(Number(b.opening_debit));
    setOpeningCredit(Number(b.opening_credit));
    setDialogOpen(true);
  };

  const filteredBalances = balances.filter((b: any) => {
    const matchTab = b.entity_type === tab;
    const s = search.toLowerCase();
    const name = getEntityName(b.entity_id, b.entity_type).toLowerCase();
    return matchTab && name.includes(s);
  });

  const entities = entityType === "dealer" ? dealers : suppliers;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Opening Balances</h1>
            <p className="text-muted-foreground">Set opening balances for dealers and suppliers per financial year</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Balance</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Opening Balance</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select value={entityType} onValueChange={(v: "dealer" | "supplier") => { setEntityType(v); setEntityId(""); }} disabled={!!editId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dealer">Dealer</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{entityType === "dealer" ? "Dealer" : "Supplier"} *</Label>
                  <Select value={entityId} onValueChange={setEntityId} disabled={!!editId}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{entities.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Financial Year *</Label>
                  <Select value={fyId} onValueChange={setFyId} disabled={!!editId}>
                    <SelectTrigger><SelectValue placeholder="Select FY" /></SelectTrigger>
                    <SelectContent>{fys.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.fy_code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Opening Debit (₹)</Label>
                    <Input type="number" min={0} step="0.01" value={openingDebit || ""} onChange={(e) => setOpeningDebit(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Opening Credit (₹)</Label>
                    <Input type="number" min={0} step="0.01" value={openingCredit || ""} onChange={(e) => setOpeningCredit(Number(e.target.value))} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Add Balance"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <Tabs value={tab} onValueChange={setTab} className="flex-1">
                <TabsList>
                  <TabsTrigger value="dealer">Dealers</TabsTrigger>
                  <TabsTrigger value="supplier">Suppliers</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : filteredBalances.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No opening balances set.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tab === "dealer" ? "Dealer" : "Supplier"}</TableHead>
                    <TableHead>Financial Year</TableHead>
                    <TableHead>Opening Debit</TableHead>
                    <TableHead>Opening Credit</TableHead>
                    <TableHead>Net Balance</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBalances.map((b: any) => {
                    const net = Number(b.opening_debit) - Number(b.opening_credit);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{getEntityName(b.entity_id, b.entity_type)}</TableCell>
                        <TableCell>{b.financial_years?.fy_code}</TableCell>
                        <TableCell>₹{Number(b.opening_debit).toLocaleString("en-IN")}</TableCell>
                        <TableCell>₹{Number(b.opening_credit).toLocaleString("en-IN")}</TableCell>
                        <TableCell className={net > 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                          ₹{Math.abs(net).toLocaleString("en-IN")} {net > 0 ? "Dr" : net < 0 ? "Cr" : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}