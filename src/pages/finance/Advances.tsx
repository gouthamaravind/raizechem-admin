import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Ban, Eye } from "lucide-react";
import { toast } from "sonner";
import { VoidDialog } from "@/components/VoidDialog";
import { AdvanceCreateForm } from "@/components/finance/AdvanceCreateForm";
import { AdvanceAllocationsView } from "@/components/finance/AdvanceAllocationsView";

export default function Advances() {
  const { hasRole } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dealerFilter, setDealerFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ id: string; label: string } | null>(null);
  const [allocViewId, setAllocViewId] = useState<string | null>(null);

  const canManage = hasRole("admin") || hasRole("accounts");
  const pg = usePagination();

  const { data: advancesRaw = [], isLoading } = useQuery({
    queryKey: ["advance-receipts", pg.page, statusFilter, dealerFilter],
    queryFn: async () => {
      let q = supabase.from("advance_receipts" as any).select("*, dealers(name)").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (dealerFilter !== "all") q = q.eq("dealer_id", dealerFilter);
      const { data, error } = await q.range(pg.range.from, pg.range.to + 1);
      if (error) throw error;
      return data as any[];
    },
  });
  const advances = advancesRaw.slice(0, pg.pageSize);

  const { data: dealers = [] } = useQuery({
    queryKey: ["dealers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("dealers").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const voidAdvance = async (reason: string) => {
    if (!voidTarget) return;
    const { error } = await supabase.rpc("void_advance_receipt_atomic" as any, {
      p_receipt_id: voidTarget.id,
      p_reason: reason,
      p_voided_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Advance receipt voided");
    setVoidTarget(null);
    // Invalidation handled by component remount
    window.location.reload();
  };

  const filtered = advances.filter((a: any) => {
    const s = search.toLowerCase();
    return a.receipt_number?.toLowerCase().includes(s) || a.dealers?.name?.toLowerCase().includes(s);
  });

  const modeLabels: Record<string, string> = { cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", upi: "UPI" };
  const statusVariant = (s: string) => s === "VOID" ? "destructive" as const : s === "ADJUSTED" ? "default" as const : "secondary" as const;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Advance Receipts</h1>
            <p className="text-muted-foreground">Tally-style advance collections from dealers</p>
          </div>
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Advance</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Advance Receipt</DialogTitle></DialogHeader>
                <AdvanceCreateForm dealers={dealers} onSuccess={() => setDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search receipts..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={dealerFilter} onValueChange={setDealerFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Dealers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dealers</SelectItem>
                  {dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ADJUSTED">Adjusted</SelectItem>
                  <SelectItem value="VOID">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No advance receipts found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Dealer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Adjusted</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.receipt_number}</TableCell>
                          <TableCell>{a.dealers?.name}</TableCell>
                          <TableCell>{a.receipt_date}</TableCell>
                          <TableCell>₹{Number(a.gross_amount).toLocaleString("en-IN")}</TableCell>
                          <TableCell>₹{Number(a.adjusted_amount).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="font-semibold">₹{Number(a.balance_amount).toLocaleString("en-IN")}</TableCell>
                          <TableCell><Badge variant="outline">{modeLabels[a.payment_mode] || a.payment_mode}</Badge></TableCell>
                          <TableCell><Badge variant={statusVariant(a.status)}>{a.status}</Badge></TableCell>
                          <TableCell className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setAllocViewId(a.id)} title="View allocations"><Eye className="h-4 w-4" /></Button>
                            {canManage && a.status !== "VOID" && (
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setVoidTarget({ id: a.id, label: a.receipt_number })}><Ban className="h-4 w-4" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination page={pg.page} pageSize={pg.pageSize} totalFetched={advancesRaw.length} onPrev={pg.prevPage} onNext={pg.nextPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AdvanceAllocationsView allocViewId={allocViewId} onClose={() => setAllocViewId(null)} />

      <VoidDialog
        open={!!voidTarget}
        onOpenChange={(v) => { if (!v) setVoidTarget(null); }}
        onConfirm={voidAdvance}
        isPending={false}
        title={`Advance ${voidTarget?.label || ""}`}
      />
    </DashboardLayout>
  );
}
