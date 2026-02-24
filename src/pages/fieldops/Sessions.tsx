import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Clock, Navigation, IndianRupee, ShoppingCart, CreditCard, Users } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FieldOpsSessions() {
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();
  const isAdminOrAccounts = hasRole("admin") || hasRole("accounts");
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [detailSession, setDetailSession] = useState<any>(null);

  // Summary stats
  const { data: todayStats } = useQuery({
    queryKey: ["fieldops-today-stats", dateFilter],
    queryFn: async () => {
      const [sessions, orders, payments] = await Promise.all([
        supabase.from("duty_sessions").select("id, status, total_km").gte("start_time", `${dateFilter}T00:00:00`).lte("start_time", `${dateFilter}T23:59:59`),
        supabase.from("field_orders").select("id", { count: "exact", head: true }).gte("created_at", `${dateFilter}T00:00:00`).lte("created_at", `${dateFilter}T23:59:59`),
        supabase.from("field_payments").select("amount").gte("created_at", `${dateFilter}T00:00:00`).lte("created_at", `${dateFilter}T23:59:59`),
      ]);
      const activeSessions = (sessions.data || []).filter(s => s.status === "active").length;
      const totalKm = (sessions.data || []).reduce((s, d) => s + Number(d.total_km || 0), 0);
      const totalPayments = (payments.data || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      return { activeSessions, totalKm: totalKm.toFixed(1), totalOrders: orders.count || 0, totalPayments };
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["fieldops-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employee_profiles").select("user_id, name, employee_code").eq("is_active", true);
      return data || [];
    },
    enabled: isAdminOrAccounts,
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["fieldops-sessions", dateFilter, statusFilter, employeeFilter],
    queryFn: async () => {
      let query = supabase.from("duty_sessions").select("*").gte("start_time", `${dateFilter}T00:00:00`).lte("start_time", `${dateFilter}T23:59:59`).order("start_time", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (employeeFilter !== "all") query = query.eq("user_id", employeeFilter);
      if (!isAdminOrAccounts) query = query.eq("user_id", user?.id || "");
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Map user_id to employee name
  const empMap = new Map(employees.map((e: any) => [e.user_id, e.name]));

  const summaryCards = [
    { title: "Active Sessions", value: todayStats?.activeSessions ?? "—", icon: Users, color: "text-primary" },
    { title: "Total KM", value: todayStats ? `${todayStats.totalKm} km` : "—", icon: Navigation, color: "text-accent-foreground" },
    { title: "Orders Submitted", value: todayStats?.totalOrders ?? "—", icon: ShoppingCart, color: "text-warning" },
    { title: "Payments Recorded", value: todayStats ? formatCurrency(todayStats.totalPayments) : "—", icon: CreditCard, color: "text-success" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Ops — Duty Sessions</h1>
          <p className="text-muted-foreground">Monitor field employee duty sessions, distance, and incentives</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(s => (
            <Card key={s.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-44" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {isAdminOrAccounts && (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Employee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e: any) => <SelectItem key={e.user_id} value={e.user_id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Sessions Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : sessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No sessions found for this date.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdminOrAccounts && <TableHead>Employee</TableHead>}
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>KM</TableHead>
                      <TableHead>Incentive</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s: any) => (
                      <TableRow key={s.id}>
                        {isAdminOrAccounts && <TableCell className="font-medium">{empMap.get(s.user_id) || s.user_id.slice(0,8)}</TableCell>}
                        <TableCell>{format(new Date(s.start_time), "hh:mm a")}</TableCell>
                        <TableCell>{s.end_time ? format(new Date(s.end_time), "hh:mm a") : "—"}</TableCell>
                        <TableCell>{s.total_duration_mins > 0 ? formatDuration(s.total_duration_mins) : "—"}</TableCell>
                        <TableCell>{Number(s.total_km).toFixed(1)} km</TableCell>
                        <TableCell>{formatCurrency(Number(s.incentive_amount))}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setDetailSession(s)}>
                              <Clock className="h-4 w-4 mr-1" />Detail
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/fieldops/locations/${s.id}`)}>
                              <MapPin className="h-4 w-4 mr-1" />Track
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailSession} onOpenChange={v => { if (!v) setDetailSession(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Session Detail</DialogTitle></DialogHeader>
          {detailSession && (
            <div className="space-y-3 text-sm">
              {isAdminOrAccounts && <div className="flex justify-between"><span className="text-muted-foreground">Employee</span><span className="font-medium">{empMap.get(detailSession.user_id) || detailSession.user_id.slice(0,8)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{format(new Date(detailSession.start_time), "dd MMM yyyy, hh:mm a")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{detailSession.end_time ? format(new Date(detailSession.end_time), "dd MMM yyyy, hh:mm a") : "Still active"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{formatDuration(detailSession.total_duration_mins)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Distance</span><span>{Number(detailSession.total_km).toFixed(2)} km</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Incentive</span><span className="font-semibold text-primary">{formatCurrency(Number(detailSession.incentive_amount))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={detailSession.status === "active" ? "default" : "secondary"}>{detailSession.status}</Badge></div>
              {detailSession.start_location && (
                <div className="flex justify-between"><span className="text-muted-foreground">Start Location</span><span className="text-xs">{JSON.stringify(detailSession.start_location)}</span></div>
              )}
              <Button className="w-full mt-2" variant="outline" onClick={() => { setDetailSession(null); navigate(`/fieldops/locations/${detailSession.id}`); }}>
                <MapPin className="h-4 w-4 mr-2" />View Location Trail
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
