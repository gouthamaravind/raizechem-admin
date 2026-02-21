import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

const currentFY = () => {
  const now = new Date();
  const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${yr}-${(yr + 1).toString().slice(-2)}`;
};

const quarters = [
  { label: "Q1 (Apr–Jun)", months: [3, 4, 5] },
  { label: "Q2 (Jul–Sep)", months: [6, 7, 8] },
  { label: "Q3 (Oct–Dec)", months: [9, 10, 11] },
  { label: "Q4 (Jan–Mar)", months: [0, 1, 2] },
];

function getQuarterDates(fy: string, qIdx: number) {
  const startYear = parseInt(fy.split("-")[0]);
  const q = quarters[qIdx];
  const year = qIdx < 3 ? startYear : startYear + 1;
  const startMonth = q.months[0];
  const endMonth = q.months[2];
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export default function TdsTcsReport() {
  const fy = currentFY();
  const [quarter, setQuarter] = useState("0");

  const dates = useMemo(() => getQuarterDates(fy, parseInt(quarter)), [fy, quarter]);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["tds-tcs-report", dates.start, dates.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, dealers(name, gst_number)")
        .gte("payment_date", dates.start)
        .lte("payment_date", dates.end)
        .order("payment_date");
      if (error) throw error;
      return data || [];
    },
  });

  const withDeductions = payments.filter(
    (p: any) => Number(p.tds_amount) > 0 || Number(p.tcs_amount) > 0
  );

  // Dealer-wise summary
  const dealerSummary = useMemo(() => {
    const map: Record<string, { name: string; gstin: string; grossTotal: number; tdsTotal: number; tcsTotal: number; netTotal: number; count: number }> = {};
    withDeductions.forEach((p: any) => {
      const did = p.dealer_id;
      if (!map[did]) map[did] = { name: p.dealers?.name || "", gstin: p.dealers?.gst_number || "", grossTotal: 0, tdsTotal: 0, tcsTotal: 0, netTotal: 0, count: 0 };
      map[did].grossTotal += Number(p.amount);
      map[did].tdsTotal += Number(p.tds_amount);
      map[did].tcsTotal += Number(p.tcs_amount);
      map[did].netTotal += Number(p.net_amount);
      map[did].count++;
    });
    return Object.values(map).sort((a, b) => b.tdsTotal + b.tcsTotal - (a.tdsTotal + a.tcsTotal));
  }, [withDeductions]);

  const totals = useMemo(() => ({
    gross: dealerSummary.reduce((s, d) => s + d.grossTotal, 0),
    tds: dealerSummary.reduce((s, d) => s + d.tdsTotal, 0),
    tcs: dealerSummary.reduce((s, d) => s + d.tcsTotal, 0),
    net: dealerSummary.reduce((s, d) => s + d.netTotal, 0),
  }), [dealerSummary]);

  const handleExport = () => {
    const cols = [
      { key: "dealer", label: "Dealer" }, { key: "gstin", label: "GSTIN" },
      { key: "date", label: "Date" }, { key: "gross", label: "Gross Amount" },
      { key: "tds_rate", label: "TDS Rate %" }, { key: "tds_amt", label: "TDS Amount" },
      { key: "tcs_rate", label: "TCS Rate %" }, { key: "tcs_amt", label: "TCS Amount" },
      { key: "net", label: "Net Amount" }, { key: "mode", label: "Mode" },
      { key: "ref", label: "Reference" },
    ];
    const rows = withDeductions.map((p: any) => ({
      dealer: p.dealers?.name || "", gstin: p.dealers?.gst_number || "",
      date: p.payment_date, gross: Number(p.amount),
      tds_rate: Number(p.tds_rate), tds_amt: Number(p.tds_amount),
      tcs_rate: Number(p.tcs_rate), tcs_amt: Number(p.tcs_amount),
      net: Number(p.net_amount), mode: p.payment_mode,
      ref: p.reference_number || "",
    }));
    exportToCsv(`TDS_TCS_${fy}_${quarters[parseInt(quarter)].label}.csv`, rows, cols);
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TDS / TCS Report</h1>
            <p className="text-muted-foreground">FY {fy} — Quarterly deduction summary</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {quarters.map((q, i) => (
                  <SelectItem key={i} value={String(i)}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={withDeductions.length === 0}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-2xl font-bold">{withDeductions.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total TDS Deducted</p><p className="text-2xl font-bold text-destructive">{fmt(totals.tds)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total TCS Collected</p><p className="text-2xl font-bold text-primary">{fmt(totals.tcs)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Net Receivable</p><p className="text-2xl font-bold">{fmt(totals.net)}</p></CardContent></Card>
        </div>

        {/* Dealer-wise summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dealer-wise Summary</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : dealerSummary.length === 0 ? <p className="text-muted-foreground text-center py-8">No TDS/TCS deductions in this quarter.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealer</TableHead><TableHead>GSTIN</TableHead><TableHead>Txns</TableHead>
                    <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right">TCS</TableHead><TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealerSummary.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-xs">{d.gstin || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{d.count}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(d.grossTotal)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(d.tdsTotal)}</TableCell>
                      <TableCell className="text-right text-primary">{fmt(d.tcsTotal)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(d.netTotal)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">{fmt(totals.gross)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(totals.tds)}</TableCell>
                    <TableCell className="text-right text-primary">{fmt(totals.tcs)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.net)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Transaction detail */}
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction Details</CardTitle></CardHeader>
          <CardContent>
            {withDeductions.length === 0 ? <p className="text-muted-foreground text-center py-4">No transactions.</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Dealer</TableHead><TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">TDS %</TableHead><TableHead className="text-right">TDS Amt</TableHead>
                      <TableHead className="text-right">TCS %</TableHead><TableHead className="text-right">TCS Amt</TableHead>
                      <TableHead className="text-right">Net</TableHead><TableHead>Ref</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withDeductions.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.payment_date}</TableCell>
                        <TableCell className="font-medium">{p.dealers?.name}</TableCell>
                        <TableCell className="text-right">{fmt(Number(p.amount))}</TableCell>
                        <TableCell className="text-right">{Number(p.tds_rate) || "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{fmt(Number(p.tds_amount))}</TableCell>
                        <TableCell className="text-right">{Number(p.tcs_rate) || "—"}</TableCell>
                        <TableCell className="text-right text-primary">{fmt(Number(p.tcs_amount))}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(Number(p.net_amount))}</TableCell>
                        <TableCell className="text-xs">{p.reference_number || "—"}</TableCell>
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
