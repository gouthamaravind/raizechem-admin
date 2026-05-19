import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, CheckCircle2, XCircle } from "lucide-react";

function startOfMonthIso(d: Date) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  return dt.toISOString().slice(0, 10);
}
function endOfMonthIso(d: Date) {
  const dt = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return dt.toISOString().slice(0, 10);
}

export default function Attendance() {
  const today = new Date();
  const [from, setFrom] = useState(startOfMonthIso(today));
  const [to, setTo] = useState(endOfMonthIso(today));
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-days", from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_attendance_days")
        .select("user_id, full_name, attendance_date, total_hours, is_present")
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .order("attendance_date", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        user_id: string;
        full_name: string | null;
        attendance_date: string;
        total_hours: number;
        is_present: boolean;
      }>;
    },
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data || []).filter((r) => !s || (r.full_name || "").toLowerCase().includes(s));
  }, [data, search]);

  const summary = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.is_present).length;
    return { total, present, absent: total - present };
  }, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Attendance
          </h1>
          <p className="text-sm text-muted-foreground">
            A day is marked Present when total duty hours (IST) are ≥ 7.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
            </div>
            <Input
              placeholder="Search employee"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
            <div className="ml-auto flex gap-2">
              <Badge variant="outline">{summary.total} days</Badge>
              <Badge className="bg-success/15 text-success border-success/30">{summary.present} present</Badge>
              <Badge variant="destructive">{summary.absent} absent</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No records</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={`${r.user_id}-${r.attendance_date}`}>
                  <TableCell className="font-mono text-xs">{r.attendance_date}</TableCell>
                  <TableCell>{r.full_name || r.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.total_hours).toFixed(2)}</TableCell>
                  <TableCell>
                    {r.is_present ? (
                      <Badge className="bg-success/15 text-success border-success/30 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Present
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="inline-flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Absent
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
