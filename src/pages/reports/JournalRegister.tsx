import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RegisterDrillDown, DateRangeFilter } from "@/components/reports/RegisterDrillDown";

export default function JournalRegister() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const { branchId } = useBranch();

  const { data = [], isLoading } = useQuery({
    queryKey: ["journal-register", from, to, branchId],
    queryFn: async () => {
      let q = supabase.from("vouchers").select("*")
        .eq("voucher_type", "journal")
        .gte("voucher_date", from).lte("voucher_date", to)
        .order("voucher_date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((v: any) => ({
        id: v.id,
        number: v.voucher_number,
        date: v.voucher_date,
        party: v.narration,
        amount: Number(v.total_amount),
        status: v.status,
      }));
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal Register</h1>
          <p className="text-muted-foreground">All journal vouchers (manual debit/credit entries).</p>
        </div>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <RegisterDrillDown title="Journals" vouchers={data} loading={isLoading} />
      </div>
    </DashboardLayout>
  );
}
