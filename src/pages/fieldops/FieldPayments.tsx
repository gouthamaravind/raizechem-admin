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
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  verified: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

export default function FieldOpsPayments() {
  const { hasRole, user } = useAuth();
  const qc = useQueryClient();
  const canVerify = hasRole("admin") || hasRole("accounts");
  const [search, setSearch] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["fieldops-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employee_profiles").select("user_id, name");
      return data || [];
    },
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["fieldops-field-payments"],
    queryFn: async () => {
      let query = supabase.from("field_payments").select("*, dealers(name)").order("created_at", { ascending: false });
      if (!canVerify) query = query.eq("created_by_user_id", user?.id || "");
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const empMap = new Map(employees.map((e: any) => [e.user_id, e.name]));

  const verifyMutation = useMutation({
    mutationFn: async (payment: any) => {
      // 1. Update field payment status
      const { error: upErr } = await supabase.from("field_payments").update({ status: "verified" }).eq("id", payment.id);
      if (upErr) throw upErr;

      // 2. Create matching finance payment
      const { data: finPayment, error: payErr } = await supabase.from("payments").insert({
        dealer_id: payment.dealer_id,
        payment_date: payment.payment_date,
        amount: payment.amount,
        net_amount: payment.amount,
        payment_mode: payment.mode,
        reference_number: payment.reference_no,
        notes: `From field collection by ${empMap.get(payment.created_by_user_id) || "employee"}. ${payment.notes || ""}`.trim(),
        created_by: user?.id,
      }).select("id").single();
      if (payErr) throw payErr;

      // 3. Create ledger entry
      await supabase.from("ledger_entries").insert({
        dealer_id: payment.dealer_id,
        entry_date: payment.payment_date,
        entry_type: "payment",
        ref_id: finPayment.id,
        description: `Field payment verified (${payment.mode}) ${payment.reference_no ? `Ref: ${payment.reference_no}` : ""}`,
        debit: 0,
        credit: payment.amount,
      });

      // 4. Auto-apply to oldest unpaid invoices
      let remaining = Number(payment.amount);
      const { data: unpaid } = await supabase.from("invoices").select("id, total_amount, amount_paid").eq("dealer_id", payment.dealer_id).neq("status", "paid").order("invoice_date");
      if (unpaid) {
        for (const inv of unpaid) {
          if (remaining <= 0) break;
          const due = Number(inv.total_amount) - Number(inv.amount_paid);
          const apply = Math.min(remaining, due);
          const newPaid = Number(inv.amount_paid) + apply;
          const newStatus = newPaid >= Number(inv.total_amount) ? "paid" : "partially_paid";
          await supabase.from("invoices").update({ amount_paid: newPaid, status: newStatus }).eq("id", inv.id);
          remaining -= apply;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fieldops-field-payments"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      toast.success("Payment verified and posted to finance");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("field_payments").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fieldops-field-payments"] });
      toast.success("Field payment rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modeLabels: Record<string, string> = { cash: "Cash", upi: "UPI", neft: "NEFT", cheque: "Cheque", bank_transfer: "Bank Transfer" };

  const filtered = payments.filter((p: any) => {
    const s = search.toLowerCase();
    return (p.dealers as any)?.name?.toLowerCase().includes(s) || empMap.get(p.created_by_user_id)?.toLowerCase().includes(s) || p.reference_no?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Ops — Field Payments</h1>
          <p className="text-muted-foreground">Verify field-collected payments and post to finance ledger</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by dealer, employee, or ref..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No field payments found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Dealer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      {canVerify && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{format(new Date(p.payment_date), "dd MMM")}</TableCell>
                        <TableCell className="font-medium">{empMap.get(p.created_by_user_id) || p.created_by_user_id.slice(0,8)}</TableCell>
                        <TableCell>{(p.dealers as any)?.name}</TableCell>
                        <TableCell className="font-semibold">₹{Number(p.amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell><Badge variant="outline">{modeLabels[p.mode] || p.mode}</Badge></TableCell>
                        <TableCell className="text-sm">{p.reference_no || "—"}</TableCell>
                        <TableCell><Badge className={statusColors[p.status] || ""}>{p.status}</Badge></TableCell>
                        {canVerify && (
                          <TableCell>
                            {p.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" onClick={() => verifyMutation.mutate(p)} disabled={verifyMutation.isPending}>
                                  <Check className="h-4 w-4 mr-1" />Verify
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(p.id)} disabled={rejectMutation.isPending}>
                                  <X className="h-4 w-4 mr-1" />Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
