import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
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
  const [orderNumber, setOrderNumber] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["fieldops-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employee_profiles").select("user_id, name");
      return data || [];
    },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["fieldops-field-orders"],
    queryFn: async () => {
      let query = supabase.from("field_orders").select("*, dealers(name), field_order_items(*, products(name, unit))").order("created_at", { ascending: false });
      if (!isAdmin && !hasRole("accounts")) query = query.eq("created_by_user_id", user?.id || "");
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const empMap = new Map(employees.map((e: any) => [e.user_id, e.name]));

  const approveMutation = useMutation({
    mutationFn: async ({ fieldOrderId, orderNum }: { fieldOrderId: string; orderNum: string }) => {
      const { data, error } = await supabase.rpc("approve_field_order", {
        _field_order_id: fieldOrderId,
        _order_number: orderNum,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (newOrderId) => {
      qc.invalidateQueries({ queryKey: ["fieldops-field-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setApproveDialog(null);
      setOrderNumber("");
      toast.success(`Order approved! Main order created.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("field_orders").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fieldops-field-orders"] });
      toast.success("Field order rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = orders.filter((o: any) => {
    const s = search.toLowerCase();
    return (o.dealers as any)?.name?.toLowerCase().includes(s) || empMap.get(o.created_by_user_id)?.toLowerCase().includes(s);
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
          <Input placeholder="Search by dealer or employee..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No field orders found.</p>
            ) : (
              <div className="overflow-x-auto">
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
                    {filtered.map((o: any) => {
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
                          <TableCell><Badge className={statusColors[o.status] || ""}>{o.status}</Badge></TableCell>
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
                              {o.status === "converted" && o.approved_order_id && (
                                <span className="text-xs text-muted-foreground">→ Order linked</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={v => { if (!v) { setApproveDialog(null); setOrderNumber(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Field Order</DialogTitle></DialogHeader>
          {approveDialog && (
            <form onSubmit={e => { e.preventDefault(); approveMutation.mutate({ fieldOrderId: approveDialog.id, orderNum: orderNumber }); }} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will create a main sales order for dealer <strong>{(approveDialog.dealers as any)?.name}</strong> and link it back.
              </p>
              <div className="space-y-2">
                <Label>Order Number *</Label>
                <Input required value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="e.g. ORD-2026-0042" />
              </div>
              <Button type="submit" className="w-full" disabled={approveMutation.isPending}>
                {approveMutation.isPending ? "Converting..." : "Approve & Create Order"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
