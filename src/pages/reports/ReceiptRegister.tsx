import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RegisterDrillDown, DateRangeFilter } from "@/components/reports/RegisterDrillDown";

export default function ReceiptRegister() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const { branchId } = useBranch();

  const { data = [], isLoading } = useQuery({
    queryKey: ["receipt-register", from, to, branchId],
    queryFn: async () => {
      let arQ = (supabase.from("advance_receipts" as any) as any)
        .select("id, receipt_number, receipt_date, gross_amount, payment_mode, status, dealers(name)")
        .gte("receipt_date", from).lte("receipt_date", to);
      if (branchId) arQ = arQ.eq("branch_id", branchId);
      const { data: ars } = await arQ;
      return (ars || []).map((r: any) => ({
        id: r.id,
        number: r.receipt_number,
        date: r.receipt_date,
        party: r.dealers?.name,
        amount: Number(r.gross_amount),
        status: r.status === "VOID" ? "void" : r.status,
      }));
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipt Register</h1>
          <p className="text-muted-foreground">Advance receipts and payments-in from dealers.</p>
        </div>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <RegisterDrillDown title="Receipts" vouchers={data} loading={isLoading} />
      </div>
    </DashboardLayout>
  );
}
