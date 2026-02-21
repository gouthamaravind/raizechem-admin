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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle, Lock } from "lucide-react";
import { toast } from "sonner";

export default function FinancialYears() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingFyId, setClosingFyId] = useState<string | null>(null);
  const [closingNotes, setClosingNotes] = useState("");
  const [fyCode, setFyCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: fys = [], isLoading } = useQuery({
    queryKey: ["financial-years"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_years").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createFY = useMutation({
    mutationFn: async () => {
      if (!fyCode || !startDate || !endDate) throw new Error("All fields required");
      const { error } = await supabase.from("financial_years").insert({
        fy_code: fyCode, start_date: startDate, end_date: endDate, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-years"] });
      setDialogOpen(false); setFyCode(""); setStartDate(""); setEndDate("");
      toast.success("Financial year created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActiveFY = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all first
      await supabase.from("financial_years").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      const { error } = await supabase.from("financial_years").update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-years"] });
      toast.success("Active financial year updated");
    },
  });

  const closeFY = useMutation({
    mutationFn: async () => {
      if (!closingFyId) throw new Error("No FY selected");
      const fy = fys.find((f: any) => f.id === closingFyId) as any;
      if (!fy) throw new Error("FY not found");

      // Get all dealers with ledger entries in this FY period
      const { data: dealerEntries } = await supabase
        .from("ledger_entries")
        .select("dealer_id, debit, credit")
        .gte("entry_date", fy.start_date)
        .lte("entry_date", fy.end_date);

      // Calculate net balance per dealer
      const balanceMap: Record<string, { debit: number; credit: number }> = {};
      (dealerEntries || []).forEach((e: any) => {
        if (!balanceMap[e.dealer_id]) balanceMap[e.dealer_id] = { debit: 0, credit: 0 };
        balanceMap[e.dealer_id].debit += Number(e.debit);
        balanceMap[e.dealer_id].credit += Number(e.credit);
      });

      // Find or create the next FY
      const nextFy = fys.find((f: any) => f.start_date > fy.end_date && !f.is_closed) as any;
      if (!nextFy) throw new Error("Create the next financial year first before closing this one");

      // Write opening balances for next FY
      const openingBalances = Object.entries(balanceMap).map(([entityId, bal]) => ({
        fy_id: nextFy.id,
        entity_type: "dealer",
        entity_id: entityId,
        opening_debit: bal.debit,
        opening_credit: bal.credit,
      }));

      if (openingBalances.length > 0) {
        const { error: obErr } = await supabase.from("opening_balances").upsert(openingBalances, { onConflict: "fy_id,entity_type,entity_id" });
        if (obErr) throw obErr;
      }

      // Mark FY as closed
      const { error } = await supabase.from("financial_years").update({
        is_closed: true, is_active: false, closing_notes: closingNotes || null,
      }).eq("id", closingFyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-years"] });
      setCloseDialogOpen(false); setClosingFyId(null); setClosingNotes("");
      toast.success("Financial year closed — opening balances carried forward");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suggestFY = () => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    setFyCode(`${year}-${String(year + 1).slice(2)}`);
    setStartDate(`${year}-04-01`);
    setEndDate(`${year + 1}-03-31`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financial Years</h1>
            <p className="text-muted-foreground">Manage financial years and year-end closing</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New FY</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Financial Year</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createFY.mutate(); }} className="space-y-4">
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={suggestFY}>Auto-fill current FY</Button>
                </div>
                <div className="space-y-2"><Label>FY Code *</Label><Input required value={fyCode} onChange={(e) => setFyCode(e.target.value)} placeholder="e.g. 2025-26" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Start Date *</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="space-y-2"><Label>End Date *</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createFY.isPending}>{createFY.isPending ? "Creating..." : "Create FY"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>All Financial Years</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : fys.length === 0 ? <p className="text-muted-foreground text-center py-8">No financial years created yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>FY Code</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead>
                  <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fys.map((fy: any) => (
                    <TableRow key={fy.id}>
                      <TableCell className="font-medium">{fy.fy_code}</TableCell>
                      <TableCell>{fy.start_date}</TableCell>
                      <TableCell>{fy.end_date}</TableCell>
                      <TableCell className="space-x-1">
                        {fy.is_active && <Badge>Active</Badge>}
                        {fy.is_closed && <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Closed</Badge>}
                        {!fy.is_active && !fy.is_closed && <Badge variant="outline">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="space-x-2">
                        {!fy.is_active && !fy.is_closed && (
                          <Button size="sm" variant="outline" onClick={() => setActiveFY.mutate(fy.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" />Set Active
                          </Button>
                        )}
                        {!fy.is_closed && (
                          <Button size="sm" variant="destructive" onClick={() => { setClosingFyId(fy.id); setCloseDialogOpen(true); }}>
                            <Lock className="h-3 w-3 mr-1" />Close FY
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Close FY Dialog */}
        <Dialog open={closeDialogOpen} onOpenChange={(v) => { setCloseDialogOpen(v); if (!v) { setClosingFyId(null); setClosingNotes(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Close Financial Year</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will calculate all dealer balances and carry them forward as opening balances to the next FY. Make sure the next FY exists before closing.</p>
            <div className="space-y-2"><Label>Closing Notes (optional)</Label><Textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} /></div>
            <Button className="w-full" variant="destructive" onClick={() => closeFY.mutate()} disabled={closeFY.isPending}>
              {closeFY.isPending ? "Closing..." : "Confirm Close & Carry Forward"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
