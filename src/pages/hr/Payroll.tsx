import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, CheckCircle, Download, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/lib/csv-export";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Payroll() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("status", "active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: components = [] } = useQuery({
    queryKey: ["salary-components-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("salary_components").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollRun } = useQuery({
    queryKey: ["payroll-run", month, year],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_runs").select("*").eq("month", month).eq("year", year).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["payslips", payrollRun?.id],
    queryFn: async () => {
      if (!payrollRun) return [];
      const { data, error } = await supabase.from("payslips").select("*, employees(name, designation, department)").eq("payroll_run_id", payrollRun.id);
      if (error) throw error;
      return data;
    },
    enabled: !!payrollRun,
  });

  const processPayroll = useMutation({
    mutationFn: async () => {
      if (payrollRun) throw new Error("Payroll already processed for this month");
      if (employees.length === 0) throw new Error("No active employees");
      if (components.length === 0) throw new Error("No salary components configured");

      const earnings = components.filter((c: any) => c.type === "earning");
      const deductions = components.filter((c: any) => c.type === "deduction");

      let totalGross = 0, totalDeductions = 0, totalNet = 0;
      const slips: any[] = [];

      for (const emp of employees) {
        const basic = Number(emp.basic_salary) || 0;
        const earnObj: Record<string, number> = { Basic: basic };
        let gross = basic;

        for (const e of earnings) {
          const amt = e.is_percentage ? (basic * Number(e.value)) / 100 : Number(e.value);
          earnObj[e.name] = Math.round(amt);
          gross += Math.round(amt);
        }

        const dedObj: Record<string, number> = {};
        let dedTotal = 0;
        for (const d of deductions) {
          const amt = d.is_percentage ? (basic * Number(d.value)) / 100 : Number(d.value);
          dedObj[d.name] = Math.round(amt);
          dedTotal += Math.round(amt);
        }

        const net = gross - dedTotal;
        totalGross += gross;
        totalDeductions += dedTotal;
        totalNet += net;

        slips.push({
          employee_id: emp.id, basic, gross, net_pay: net,
          earnings: earnObj, deductions: dedObj,
        });
      }

      // Create payroll run
      const { data: run, error: runErr } = await supabase.from("payroll_runs").insert({
        month, year, status: "processed", total_gross: totalGross,
        total_deductions: totalDeductions, total_net: totalNet, processed_at: new Date().toISOString(),
      }).select().single();
      if (runErr) throw runErr;

      // Create payslips
      const { error: slipErr } = await supabase.from("payslips").insert(
        slips.map((s) => ({ ...s, payroll_run_id: run.id }))
      );
      if (slipErr) throw slipErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-run", month, year] });
      qc.invalidateQueries({ queryKey: ["payslips"] });
      toast.success("Payroll processed successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      if (!payrollRun) return;
      await supabase.from("payroll_runs").update({ status: "paid" }).eq("id", payrollRun.id);
      await supabase.from("payslips").update({ payment_status: "paid" }).eq("payroll_run_id", payrollRun.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-run", month, year] });
      qc.invalidateQueries({ queryKey: ["payslips"] });
      toast.success("Payroll marked as paid");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = () => {
    exportToCsv(`payroll-${MONTHS[month - 1]}-${year}.csv`, payslips.map((s: any) => ({
      name: s.employees?.name, designation: s.employees?.designation,
      basic: s.basic, gross: s.gross, deductions: Object.values(s.deductions as Record<string, number>).reduce((a, b) => a + b, 0),
      net_pay: s.net_pay, status: s.payment_status,
    })), [
      { key: "name", label: "Employee" }, { key: "designation", label: "Designation" },
      { key: "basic", label: "Basic" }, { key: "gross", label: "Gross" },
      { key: "deductions", label: "Deductions" }, { key: "net_pay", label: "Net Pay" },
      { key: "status", label: "Status" },
    ]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payroll Processing</h1>
            <p className="text-muted-foreground">Process and manage monthly payroll</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary cards */}
        {payrollRun && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Status</p><Badge variant={payrollRun.status === "paid" ? "default" : "secondary"} className="mt-1">{payrollRun.status}</Badge></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Gross</p><p className="text-2xl font-bold">₹{Number(payrollRun.total_gross).toLocaleString("en-IN")}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Deductions</p><p className="text-2xl font-bold">₹{Number(payrollRun.total_deductions).toLocaleString("en-IN")}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Net Payable</p><p className="text-2xl font-bold">₹{Number(payrollRun.total_net).toLocaleString("en-IN")}</p></CardContent></Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!payrollRun && (
            <Button onClick={() => processPayroll.mutate()} disabled={processPayroll.isPending}>
              <Play className="h-4 w-4 mr-2" />{processPayroll.isPending ? "Processing..." : "Process Payroll"}
            </Button>
          )}
          {payrollRun && payrollRun.status === "processed" && (
            <Button onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />Mark as Paid
            </Button>
          )}
          {payslips.length > 0 && (
            <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          )}
        </div>

        {/* Payslips table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{MONTHS[month - 1]} {year} Payslips</CardTitle>
            <CardDescription>{payslips.length} employee(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {payslips.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{payrollRun ? "No payslips found" : "Payroll not yet processed for this month"}</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Employee</TableHead><TableHead>Designation</TableHead>
                  <TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Payslip</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payslips.map((s: any) => {
                    const dedTotal = Object.values(s.deductions as Record<string, number>).reduce((a, b) => a + b, 0);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.employees?.name}</TableCell>
                        <TableCell>{s.employees?.designation || "—"}</TableCell>
                        <TableCell className="text-right">₹{Number(s.basic).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(s.gross).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{dedTotal.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-medium">₹{Number(s.net_pay).toLocaleString("en-IN")}</TableCell>
                        <TableCell><Badge variant={s.payment_status === "paid" ? "default" : "secondary"}>{s.payment_status}</Badge></TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/hr/payslips/${s.id}/print`)}>
                            <FileText className="h-4 w-4 mr-1" />View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
