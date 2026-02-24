import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const TRACKED_TABLES = [
  "invoices", "invoice_items", "payments", "ledger_entries", "inventory_txn",
  "credit_notes", "credit_note_items", "purchase_invoices", "purchase_invoice_items",
  "debit_notes", "product_batches", "company_settings",
];

export default function AuditLogs() {
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", tableFilter, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from("audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(500);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (logs as any[]).filter((log) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return log.table_name?.toLowerCase().includes(s) ||
      log.record_id?.toLowerCase().includes(s) ||
      log.actor_role?.toLowerCase().includes(s);
  });

  const actionColor = (action: string) => {
    if (action === "INSERT") return "default";
    if (action === "UPDATE") return "secondary";
    if (action === "DELETE") return "destructive";
    return "outline";
  };

  // Compute diff between old and new data
  const computeDiff = (old_data: any, new_data: any) => {
    if (!old_data && new_data) return Object.entries(new_data).map(([k, v]) => ({ field: k, old: null, new: v, changed: true }));
    if (old_data && !new_data) return Object.entries(old_data).map(([k, v]) => ({ field: k, old: v, new: null, changed: true }));
    if (!old_data && !new_data) return [];

    const allKeys = new Set([...Object.keys(old_data || {}), ...Object.keys(new_data || {})]);
    return Array.from(allKeys).map((k) => ({
      field: k,
      old: old_data?.[k],
      new: new_data?.[k],
      changed: JSON.stringify(old_data?.[k]) !== JSON.stringify(new_data?.[k]),
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Track all changes to critical data</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">Table</Label>
                <Select value={tableFilter} onValueChange={setTableFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tables</SelectItem>
                    {TRACKED_TABLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-[120px]">
                <Label className="text-xs">Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="INSERT">INSERT</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by table, record ID, role..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No audit logs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Record ID</TableHead>
                      <TableHead>Actor Role</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">{log.table_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionColor(log.action) as any}>{log.action}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate">{log.record_id?.slice(0, 8)}...</TableCell>
                        <TableCell className="text-sm">{log.actor_role || "system"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail/Diff Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={(v) => { if (!v) setSelectedLog(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>
                Audit Detail — {selectedLog?.action} on {selectedLog?.table_name}
              </DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Record: <span className="font-mono">{selectedLog.record_id}</span></div>
                    <div>Time: {new Date(selectedLog.created_at).toLocaleString("en-IN")}</div>
                    <div>Actor: {selectedLog.actor_user_id?.slice(0, 8) || "system"}</div>
                    <div>Role: {selectedLog.actor_role || "—"}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Old Value</TableHead>
                          <TableHead>New Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {computeDiff(selectedLog.old_data, selectedLog.new_data)
                          .filter((d) => d.changed)
                          .map((d) => (
                            <TableRow key={d.field} className="bg-accent/20">
                              <TableCell className="font-mono text-xs font-medium">{d.field}</TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate text-destructive">
                                {d.old !== null && d.old !== undefined ? JSON.stringify(d.old) : "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate text-primary">
                                {d.new !== null && d.new !== undefined ? JSON.stringify(d.new) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
