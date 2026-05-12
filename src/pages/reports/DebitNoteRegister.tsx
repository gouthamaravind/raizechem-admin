import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RegisterDrillDown, DateRangeFilter } from "@/components/reports/RegisterDrillDown";

export default function DebitNoteRegister() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const { branchId } = useBranch();

  const { data = [], isLoading } = useQuery({
    queryKey: ["dn-register", from, to, branchId],
    queryFn: async () => {
      let q = supabase.from("debit_notes").select("*, suppliers(name)")
        .gte("debit_date", from).lte("debit_date", to)
        .order("debit_date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        number: c.debit_note_number,
        date: c.debit_date,
        party: c.suppliers?.name,
        amount: Number(c.total_amount),
        status: c.status,
      }));
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debit Note Register</h1>
          <p className="text-muted-foreground">Purchase return debit notes raised to suppliers.</p>
        </div>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <RegisterDrillDown title="Debit Notes" vouchers={data} loading={isLoading} />
      </div>
    </DashboardLayout>
  );
}
