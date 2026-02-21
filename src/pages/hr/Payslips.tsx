import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Printer } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Payslips() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [viewSlip, setViewSlip] = useState<any>(null);

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
      const { data, error } = await supabase.from("payslips").select("*, employees(name, designation, department, pan, uan, bank_account)").eq("payroll_run_id", payrollRun.id);
      if (error) throw error;
      return data;
    },
    enabled: !!payrollRun,
  });

  const { data: company } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).single();
      return data;
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payslips</h1>
            <p className="text-muted-foreground">View and print individual payslips</p>
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

        <Card>
          <CardHeader><CardTitle className="text-base">{MONTHS[month - 1]} {year}</CardTitle></CardHeader>
          <CardContent>
            {payslips.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payslips for this period</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Employee</TableHead><TableHead>Department</TableHead>
                  <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Status</TableHead><TableHead className="w-10"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payslips.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.employees?.name}</TableCell>
                      <TableCell>{s.employees?.department || "—"}</TableCell>
                      <TableCell className="text-right">₹{Number(s.gross).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right font-medium">₹{Number(s.net_pay).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={s.payment_status === "paid" ? "default" : "secondary"}>{s.payment_status}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewSlip(s)}><Printer className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payslip detail dialog */}
        <Dialog open={!!viewSlip} onOpenChange={(v) => !v && setViewSlip(null)}>
          <DialogContent className="max-w-lg print:shadow-none">
            <DialogHeader>
              <DialogTitle>Payslip — {MONTHS[month - 1]} {year}</DialogTitle>
            </DialogHeader>
            {viewSlip && (
              <div className="space-y-4 text-sm" id="payslip-print">
                <div className="text-center">
                  <p className="font-bold text-base">{company?.company_name || "Company"}</p>
                  <p className="text-xs text-muted-foreground">{company?.address_line1}, {company?.city}, {company?.state}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><strong>Employee:</strong> {viewSlip.employees?.name}</div>
                  <div><strong>Designation:</strong> {viewSlip.employees?.designation || "—"}</div>
                  <div><strong>Department:</strong> {viewSlip.employees?.department || "—"}</div>
                  <div><strong>PAN:</strong> {viewSlip.employees?.pan || "—"}</div>
                  <div><strong>UAN:</strong> {viewSlip.employees?.uan || "—"}</div>
                  <div><strong>Bank A/C:</strong> {viewSlip.employees?.bank_account || "—"}</div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold mb-2">Earnings</p>
                    {Object.entries(viewSlip.earnings as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs py-0.5">
                        <span>{k}</span><span>₹{v.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-xs border-t mt-1 pt-1">
                      <span>Gross</span><span>₹{Number(viewSlip.gross).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Deductions</p>
                    {Object.entries(viewSlip.deductions as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs py-0.5">
                        <span>{k}</span><span>₹{v.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-xs border-t mt-1 pt-1">
                      <span>Total</span><span>₹{Object.values(viewSlip.deductions as Record<string, number>).reduce((a, b) => a + b, 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Net Pay</span><span>₹{Number(viewSlip.net_pay).toLocaleString("en-IN")}</span>
                </div>
                <Button className="w-full" variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />Print Payslip
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
