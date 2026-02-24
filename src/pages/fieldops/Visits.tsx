import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { format } from "date-fns";

function formatDuration(checkin: string, checkout: string | null) {
  if (!checkout) return "Still visiting";
  const mins = Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FieldOpsVisits() {
  const { hasRole, user } = useAuth();
  const isAdminOrAccounts = hasRole("admin") || hasRole("accounts");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: employees = [] } = useQuery({
    queryKey: ["fieldops-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employee_profiles").select("user_id, name");
      return data || [];
    },
    enabled: isAdminOrAccounts,
  });

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["fieldops-visits", dateFilter],
    queryFn: async () => {
      let query = supabase.from("dealer_visits").select("*, dealers(name)").gte("checkin_time", `${dateFilter}T00:00:00`).lte("checkin_time", `${dateFilter}T23:59:59`).order("checkin_time", { ascending: false });
      if (!isAdminOrAccounts) query = query.eq("user_id", user?.id || "");
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const empMap = new Map(employees.map((e: any) => [e.user_id, e.name]));

  const filtered = visits.filter((v: any) => {
    const s = search.toLowerCase();
    const dealerName = (v.dealers as any)?.name?.toLowerCase() || "";
    const empName = empMap.get(v.user_id)?.toLowerCase() || "";
    return dealerName.includes(s) || empName.includes(s) || v.notes?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Ops — Dealer Visits</h1>
          <p className="text-muted-foreground">Track employee check-in/out at dealer locations</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-44" />
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search dealer or employee..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No visits found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdminOrAccounts && <TableHead>Employee</TableHead>}
                      <TableHead>Dealer</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((v: any) => (
                      <TableRow key={v.id}>
                        {isAdminOrAccounts && <TableCell className="font-medium">{empMap.get(v.user_id) || v.user_id.slice(0,8)}</TableCell>}
                        <TableCell className="font-medium">{(v.dealers as any)?.name || "—"}</TableCell>
                        <TableCell>{format(new Date(v.checkin_time), "hh:mm a")}</TableCell>
                        <TableCell>{v.checkout_time ? format(new Date(v.checkout_time), "hh:mm a") : <Badge variant="default">Active</Badge>}</TableCell>
                        <TableCell>{formatDuration(v.checkin_time, v.checkout_time)}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{v.notes || "—"}</TableCell>
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
