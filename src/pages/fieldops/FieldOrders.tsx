import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Check, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const statusLabels: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved → Sales Order",
  converted: "Approved → Sales Order",
  rejected: "Rejected",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  converted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

export default function FieldOpsFieldOrders() {
  const { hasRole, user } = useAuth();
  const qc = useQueryClient();
  const isAdminOrSales = hasRole("admin") || hasRole("sales");
  const isAdmin = hasRole("admin");
  const [search, setSearch] = useState("");
  const [approveDialog, setApproveDialog] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const pg = usePagination(50);

  const { data: employees = [] } = useQuery({
    queryKey: ["fieldops-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employee_profiles").select("user_id, name");
      return data || [];
    },
  });

  const { data: ordersRaw = [], isLoading } = useQuery({
    queryKey: ["fieldops-field-orders", pg.page, search],
    queryFn: async () => {
      let query = supabase.from("field_orders").select("*, dealers(name), field_order_items(*, products(name, unit))").order("created_at", { ascending: false }).range(pg.range.from, pg.range.to + 1);
      if (!isAdmin && !hasRole("accounts")) query = query.eq("created_by_user_id", user?.id || "");
      if (search) {
        query = query.or(`dealers.name.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
  const orders = ordersRaw.slice(0, pg.pageSize);

  const empMap = new Map(employees.map((e: any) => [e.user_id, e.name]));

  const approveMutation = useMutation({
    mutationFn: async ({ fieldOrderId, approveNotes }: { fieldOrderId: string; approveNotes?: string }) => {
      const { data, error } = await supabase.rpc("approve_field_order_atomic", {
        p_field_order_id: fieldOrderId,
        p_notes: approveNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fieldops-field-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setApproveDialog(null);
      setNotes("");
      toast.success(`Order approved! Main order created.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("field_orders").update({ status: "rejected", manager_approval_status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fieldops-field-orders"] });
      toast.success("Field order rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Ops — Field Orders</h1>
          <p className="text-muted-foreground">Review and approve field orders into the sales pipeline</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by dealer..." className="pl-8" value={search} onChange={e => { setSearch(e.target.value); pg.resetPage(); }} />
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <TableSkeleton columns={7} />
            ) : orders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No field orders found.</p>
            ) : (
              <div className="overflow-x-auto space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Dealer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdminOrSales && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o: any) => {
                      const items = o.field_order_items || [];
                      const total = items.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.expected_rate), 0);
                      return (
                        <TableRow key={o.id}>
                          <TableCell>{format(new Date(o.created_at), "dd MMM")}</TableCell>
                          <TableCell className="font-medium">{empMap.get(o.created_by_user_id) || o.created_by_user_id.slice(0,8)}</TableCell>
                          <TableCell>{(o.dealers as any)?.name}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5 text-xs">
                              {items.map((it: any) => (
                                <div key={it.id}>{(it.products as any)?.name} × {it.qty} @ ₹{Number(it.expected_rate)}</div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">₹{total.toLocaleString("en-IN")}</TableCell>
                          <TableCell><Badge className={statusColors[o.status] || ""}>{statusLabels[o.status] || o.status}</Badge></TableCell>
                          {isAdminOrSales && (
                            <TableCell>
                              {o.status === "pending" && (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="default" onClick={() => setApproveDialog(o)}>
                                    <Check className="h-4 w-4 mr-1" />Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(o.id)} disabled={rejectMutation.isPending}>
                                    <X className="h-4 w-4 mr-1" />Reject
                                  </Button>
                                </div>
                              )}
                              {(o.status === "converted" || o.status === "approved") && o.approved_order_id && (
                                <Button asChild size="sm" variant="outline">
                                  <Link to={`/sales/orders?highlight=${o.approved_order_id}`}>
                                    View Sales Order <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                  </Link>
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <TablePagination 
                  page={pg.page} 
                  pageSize={pg.pageSize} 
                  totalFetched={ordersRaw.length} 
                  onPrev={pg.prevPage} 
                  onNext={pg.nextPage} 
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={v => { if (!v) { setApproveDialog(null); setNotes(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Field Order</DialogTitle></DialogHeader>
          {approveDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will create an official sales order for <strong>{(approveDialog.dealers as any)?.name}</strong> with automated sequential numbering.
              </p>
              <div className="space-y-2">
                <Label>Approval Notes (Optional)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any comments for the office..." />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancel</Button>
                <Button onClick={() => approveMutation.mutate({ fieldOrderId: approveDialog.id, approveNotes: notes })} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
