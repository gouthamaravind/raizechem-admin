import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RegisterDrillDown, DateRangeFilter } from "@/components/reports/RegisterDrillDown";

export default function PaymentRegister() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const { branchId } = useBranch();

  const { data = [], isLoading } = useQuery({
    queryKey: ["payment-register", from, to, branchId],
    queryFn: async () => {
      let q = supabase.from("payments").select("id, payment_date, net_amount, amount, payment_mode, reference_number, status, dealers(name)")
        .gte("payment_date", from).lte("payment_date", to)
        .order("payment_date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        number: `PMT-${p.reference_number || p.id.slice(0, 8)}`,
        date: p.payment_date,
        party: p.dealers?.name,
        amount: Number(p.net_amount ?? p.amount),
        status: p.status,
      }));
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Register</h1>
          <p className="text-muted-foreground">All payments received from dealers — drill into year, month, day.</p>
        </div>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <RegisterDrillDown title="Payments" vouchers={data} loading={isLoading} amountLabel="Net Amount" />
      </div>
    </DashboardLayout>
  );
}
