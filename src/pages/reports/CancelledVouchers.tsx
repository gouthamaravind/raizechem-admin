import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToXlsx } from "@/lib/xlsx-export";
import { exportTablePdf } from "@/lib/pdf-export";

type Row = {
  date: string;
  type: string;
  number: string;
  amount: number;
  reason: string;
  voided_at: string;
};

export default function CancelledVouchers() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cancelled-vouchers", dateFrom, dateTo],
    queryFn: async (): Promise<Row[]> => {
      const out: Row[] = [];

      const { data: invs } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_date, total_amount, void_reason, voided_at")
        .eq("status", "void")
        .gte("invoice_date", dateFrom).lte("invoice_date", dateTo);
      (invs || []).forEach((i: any) => out.push({
        date: i.invoice_date, type: "Sales Invoice", number: i.invoice_number,
        amount: Number(i.total_amount || 0), reason: i.void_reason || "—",
        voided_at: i.voided_at || "",
      }));

      const { data: cns } = await supabase
        .from("credit_notes")
        .select("credit_note_number, credit_date, total_amount, void_reason, voided_at")
        .eq("status", "void")
        .gte("credit_date", dateFrom).lte("credit_date", dateTo);
      (cns || []).forEach((c: any) => out.push({
        date: c.credit_date, type: "Credit Note", number: c.credit_note_number,
        amount: Number(c.total_amount || 0), reason: c.void_reason || "—",
        voided_at: c.voided_at || "",
      }));

      const { data: dns } = await supabase
        .from("debit_notes")
        .select("debit_note_number, debit_date, total_amount, void_reason, voided_at")
        .eq("status", "void")
        .gte("debit_date", dateFrom).lte("debit_date", dateTo);
      (dns || []).forEach((d: any) => out.push({
        date: d.debit_date, type: "Debit Note", number: d.debit_note_number,
        amount: Number(d.total_amount || 0), reason: d.void_reason || "—",
        voided_at: d.voided_at || "",
      }));

      const { data: vchs } = await supabase
        .from("vouchers")
        .select("voucher_number, voucher_date, voucher_type, total_amount, void_reason, voided_at")
        .eq("status", "void")
        .gte("voucher_date", dateFrom).lte("voucher_date", dateTo);
      (vchs || []).forEach((v: any) => out.push({
        date: v.voucher_date, type: v.voucher_type || "Voucher", number: v.voucher_number,
        amount: Number(v.total_amount || 0), reason: v.void_reason || "—",
        voided_at: v.voided_at || "",
      }));

      const { data: ars } = await supabase
        .from("advance_receipts")
        .select("receipt_number, receipt_date, gross_amount, void_reason, voided_at")
        .eq("status", "VOID")
        .gte("receipt_date", dateFrom).lte("receipt_date", dateTo);
      (ars || []).forEach((a: any) => out.push({
        date: a.receipt_date, type: "Advance Receipt", number: a.receipt_number,
        amount: Number(a.gross_amount || 0), reason: a.void_reason || "—",
        voided_at: a.voided_at || "",
      }));

      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      return out;
    },
  });

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const handleExportXlsx = () => {
    exportToXlsx(`cancelled_vouchers_${dateFrom}_${dateTo}.xlsx`, rows, [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "number", label: "Number" },
      { key: "amount", label: "Amount" },
      { key: "reason", label: "Void Reason" },
      { key: "voided_at", label: "Voided At" },
    ]);
  };

  const handleExportPdf = () => {
    exportTablePdf({
      title: "Cancelled / Void Vouchers Register",
      subtitle: `${dateFrom} to ${dateTo}`,
      filename: `cancelled_vouchers_${dateFrom}_${dateTo}.pdf`,
      columns: ["Date", "Type", "Number", "Amount", "Reason", "Voided At"],
      rows: rows.map((r) => [
        r.date, r.type, r.number,
        `₹${r.amount.toLocaleString("en-IN")}`,
        r.reason,
        r.voided_at ? new Date(r.voided_at).toLocaleString() : "",
      ]),
      footerSummary: [
        { label: "Total Voided Amount", value: `₹${total.toLocaleString("en-IN")}` },
        { label: "Entries", value: String(rows.length) },
      ],
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cancelled / Void Vouchers</h1>
            <p className="text-muted-foreground">All voided invoices, notes, vouchers and advance receipts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!rows.length}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No cancelled vouchers in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Void Reason</TableHead>
                    <TableHead>Voided At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={`${r.type}-${r.number}-${idx}`}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell><Badge variant="destructive" className="capitalize">{r.type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.number}</TableCell>
                      <TableCell className="text-right">₹{r.amount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.voided_at ? new Date(r.voided_at).toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {rows.length > 0 && (
            <div className="border-t px-6 py-3 flex justify-end gap-8 text-sm">
              <div><span className="text-muted-foreground">Total Voided: </span><span className="font-bold text-destructive">₹{total.toLocaleString("en-IN")}</span></div>
              <div><span className="text-muted-foreground">Entries: </span><span className="font-bold">{rows.length}</span></div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
