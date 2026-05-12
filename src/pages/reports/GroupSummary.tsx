import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function GroupSummary() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);

  const { data: accounts = [] } = useQuery({
    queryKey: ["la-all"],
    queryFn: async () => {
      const { data } = await supabase.from("ledger_accounts").select("id, name, account_type, parent_type").eq("is_active", true);
      return data || [];
    },
  });

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["gs-lines", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("voucher_lines")
        .select("account_id, debit, credit, vouchers!inner(voucher_date, status)")
        .gte("vouchers.voucher_date", from).lte("vouchers.voucher_date", to);
      return (data || []).filter((l: any) => l.vouchers?.status !== "void");
    },
  });

  const groups = useMemo(() => {
    const accMap = new Map(accounts.map((a: any) => [a.id, a]));
    const totals: Record<string, { debit: number; credit: number; accounts: Record<string, { name: string; debit: number; credit: number }> }> = {};
    for (const l of lines as any[]) {
      const acc: any = accMap.get(l.account_id);
      if (!acc) continue;
      const grp = acc.parent_type || acc.account_type || "Other";
      totals[grp] ??= { debit: 0, credit: 0, accounts: {} };
      totals[grp].debit += Number(l.debit);
      totals[grp].credit += Number(l.credit);
      totals[grp].accounts[acc.id] ??= { name: acc.name, debit: 0, credit: 0 };
      totals[grp].accounts[acc.id].debit += Number(l.debit);
      totals[grp].accounts[acc.id].credit += Number(l.credit);
    }
    return totals;
  }, [lines, accounts]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Group Summary</h1>
          <p className="text-muted-foreground">Account groups (Assets, Liabilities, Income, Expense) with totals.</p>
        </div>
        <Card>
          <CardContent className="pt-4 flex gap-4 items-end">
            <div className="space-y-1"><Label>From</Label><Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Group / Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {Object.entries(groups).map(([grp, g]) => (
                    <>
                      <TableRow key={grp} className="font-semibold bg-muted/40">
                        <TableCell className="capitalize">{grp}</TableCell>
                        <TableCell className="text-right">₹{g.debit.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{g.credit.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{(g.debit - g.credit).toFixed(2)}</TableCell>
                      </TableRow>
                      {Object.values(g.accounts).map((a, i) => (
                        <TableRow key={`${grp}-${i}`}>
                          <TableCell className="pl-8 text-sm">{a.name}</TableCell>
                          <TableCell className="text-right text-sm">₹{a.debit.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm">₹{a.credit.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm">₹{(a.debit - a.credit).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
