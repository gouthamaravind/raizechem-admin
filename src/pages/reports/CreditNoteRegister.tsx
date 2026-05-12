import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RegisterDrillDown, DateRangeFilter } from "@/components/reports/RegisterDrillDown";

export default function CreditNoteRegister() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const { branchId } = useBranch();

  const { data = [], isLoading } = useQuery({
    queryKey: ["cn-register", from, to, branchId],
    queryFn: async () => {
      let q = supabase.from("credit_notes").select("*, dealers(name)")
        .gte("credit_date", from).lte("credit_date", to)
        .order("credit_date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        number: c.credit_note_number,
        date: c.credit_date,
        party: c.dealers?.name,
        amount: Number(c.total_amount),
        status: c.status,
      }));
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit Note Register</h1>
          <p className="text-muted-foreground">Sales return credit notes issued to dealers.</p>
        </div>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <RegisterDrillDown title="Credit Notes" vouchers={data} loading={isLoading} />
      </div>
    </DashboardLayout>
  );
}
