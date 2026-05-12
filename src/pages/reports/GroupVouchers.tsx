import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegisterDrillDown } from "@/components/reports/RegisterDrillDown";

export default function GroupVouchers() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [groupType, setGroupType] = useState<string>("");

  const { data: groupTypes = [] } = useQuery({
    queryKey: ["la-group-types"],
    queryFn: async () => {
      const { data } = await supabase.from("ledger_accounts").select("parent_type, account_type").eq("is_active", true);
      const set = new Set<string>();
      (data || []).forEach((a: any) => set.add(a.parent_type || a.account_type));
      return Array.from(set).filter(Boolean);
    },
  });

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["gv-vouchers", groupType, from, to],
    enabled: !!groupType,
    queryFn: async () => {
      const { data: accs } = await supabase.from("ledger_accounts").select("id")
        .or(`parent_type.eq.${groupType},account_type.eq.${groupType}`);
      const ids = (accs || []).map((a: any) => a.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("voucher_lines")
        .select("vouchers!inner(id, voucher_number, voucher_date, voucher_type, total_amount, status, narration)")
        .in("account_id", ids)
        .gte("vouchers.voucher_date", from).lte("vouchers.voucher_date", to);
      const seen = new Set<string>();
      const out: any[] = [];
      for (const row of (data || []) as any[]) {
        const v = row.vouchers;
        if (!v || seen.has(v.id)) continue;
        seen.add(v.id);
        out.push({ id: v.id, number: v.voucher_number, date: v.voucher_date, party: `${v.voucher_type} — ${v.narration ?? ""}`, amount: Number(v.total_amount), status: v.status });
      }
      return out;
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Group Vouchers</h1>
          <p className="text-muted-foreground">All vouchers touching accounts in a selected group.</p>
        </div>
        <Card>
          <CardContent className="pt-4 flex gap-4 flex-wrap items-end">
            <div className="space-y-1">
              <Label>Group</Label>
              <Select value={groupType} onValueChange={setGroupType}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>{groupTypes.map((g: string) => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>From</Label><Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
          </CardContent>
        </Card>
        {!groupType ? <Card><CardContent className="py-8 text-center text-muted-foreground">Select a group to view its vouchers.</CardContent></Card>
          : <RegisterDrillDown title="Group Vouchers" vouchers={vouchers} loading={isLoading} />}
      </div>
    </DashboardLayout>
  );
}
