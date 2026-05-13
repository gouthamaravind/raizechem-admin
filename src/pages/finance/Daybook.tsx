import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBranch } from "@/hooks/useBranch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToXlsx } from "@/lib/xlsx-export";
import { exportTablePdf } from "@/lib/pdf-export";

type Row = {
  date: string;
  type: string;
  number: string;
  party: string;
  narration: string;
  debit: number;
  credit: number;
  status: string;
};

export default function Daybook() {
  const { branchId } = useBranch();
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["daybook", branchId, dateFrom, dateTo],
    queryFn: async (): Promise<Row[]> => {
      const out: Row[] = [];

      // Sales invoices
      let invQ = supabase
        .from("invoices")
        .select("invoice_number, invoice_date, total_amount, status, dealer_id, dealers(name)")
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo);
      if (branchId) invQ = invQ.eq("branch_id", branchId);
      const { data: invs } = await invQ;
      (invs || []).forEach((i: any) => out.push({
        date: i.invoice_date, type: "Sales Invoice", number: i.invoice_number,
        party: i.dealers?.name || "—", narration: "Sales", debit: Number(i.total_amount || 0),
        credit: 0, status: i.status,
      }));

      // Purchase invoices
      let piQ = supabase
        .from("purchase_invoices")
        .select("invoice_number, invoice_date, total_amount, status, suppliers(name)")
        .gte("invoice_date", dateFrom).lte("invoice_date", dateTo);
      if (branchId) piQ = piQ.eq("branch_id", branchId);
      const { data: pis } = await piQ;
      (pis || []).forEach((p: any) => out.push({
        date: p.invoice_date, type: "Purchase Invoice", number: p.invoice_number,
        party: p.suppliers?.name || "—", narration: "Purchase", debit: 0,
        credit: Number(p.total_amount || 0), status: p.status,
      }));

      // Receipts (dealer payments)
      let payQ = supabase
        .from("payments")
        .select("payment_date, amount, payment_mode, reference_number, dealers(name)")
        .gte("payment_date", dateFrom).lte("payment_date", dateTo);
      if (branchId) payQ = payQ.eq("branch_id", branchId);
      const { data: pays } = await payQ;
      (pays || []).forEach((p: any) => out.push({
        date: p.payment_date, type: "Receipt", number: p.reference_number || "—",
        party: p.dealers?.name || "—", narration: p.payment_mode || "Receipt",
        debit: 0, credit: Number(p.amount || 0), status: "active",
      }));

      // Vouchers (journal/contra/etc., includes supplier payment vouchers)
      const { data: vchs } = await supabase
        .from("vouchers")
        .select("voucher_number, voucher_date, voucher_type, total_amount, narration, status")
        .gte("voucher_date", dateFrom).lte("voucher_date", dateTo);
      (vchs || []).forEach((v: any) => out.push({
        date: v.voucher_date, type: (v.voucher_type || "Voucher"),
        number: v.voucher_number, party: "—",
        narration: v.narration || "—",
        debit: Number(v.total_amount || 0), credit: Number(v.total_amount || 0),
        status: v.status,
      }));

      // Credit notes
      let cnQ = supabase
        .from("credit_notes")
        .select("credit_note_number, credit_date, total_amount, status, dealers(name)")
        .gte("credit_date", dateFrom).lte("credit_date", dateTo);
      if (branchId) cnQ = cnQ.eq("branch_id", branchId);
      const { data: cns } = await cnQ;
      (cns || []).forEach((c: any) => out.push({
        date: c.credit_date, type: "Credit Note", number: c.credit_note_number,
        party: c.dealers?.name || "—", narration: "Credit Note",
        debit: 0, credit: Number(c.total_amount || 0), status: c.status,
      }));

      // Debit notes
      let dnQ = supabase
        .from("debit_notes")
        .select("debit_note_number, debit_date, total_amount, status, suppliers(name)")
        .gte("debit_date", dateFrom).lte("debit_date", dateTo);
      if (branchId) dnQ = dnQ.eq("branch_id", branchId);
      const { data: dns } = await dnQ;
      (dns || []).forEach((d: any) => out.push({
        date: d.debit_date, type: "Debit Note", number: d.debit_note_number,
        party: d.suppliers?.name || "—", narration: "Debit Note",
        debit: Number(d.total_amount || 0), credit: 0, status: d.status,
      }));

      out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return out;
    },
  });

  const totals = rows.reduce(
    (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
    { debit: 0, credit: 0 },
  );

  const handleExportXlsx = () => {
    exportToXlsx(`daybook_${dateFrom}_${dateTo}.xlsx`, rows, [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "number", label: "Number" },
      { key: "party", label: "Party" },
      { key: "narration", label: "Narration" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
      { key: "status", label: "Status" },
    ]);
  };

  const handleExportPdf = () => {
    exportTablePdf({
      title: "Daybook",
      subtitle: `${dateFrom} to ${dateTo}`,
      filename: `daybook_${dateFrom}_${dateTo}.pdf`,
      columns: ["Date", "Type", "Number", "Party", "Narration", "Debit", "Credit", "Status"],
      rows: rows.map((r) => [
        r.date, r.type, r.number, r.party, r.narration,
        r.debit ? `₹${r.debit.toLocaleString("en-IN")}` : "",
        r.credit ? `₹${r.credit.toLocaleString("en-IN")}` : "",
        r.status,
      ]),
      footerSummary: [
        { label: "Total Debit", value: `₹${totals.debit.toLocaleString("en-IN")}` },
        { label: "Total Credit", value: `₹${totals.credit.toLocaleString("en-IN")}` },
      ],
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Daybook</h1>
            <p className="text-muted-foreground">All vouchers and transactions for a date range</p>
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
              <p className="text-muted-foreground text-center py-8">No transactions in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={`${r.type}-${r.number}-${idx}`}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.number}</TableCell>
                      <TableCell>{r.party}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.narration}</TableCell>
                      <TableCell className="text-right">{r.debit ? `₹${r.debit.toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className="text-right">{r.credit ? `₹${r.credit.toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "void" || r.status === "cancelled" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {rows.length > 0 && (
            <div className="border-t px-6 py-3 flex justify-end gap-8 text-sm">
              <div><span className="text-muted-foreground">Total Debit: </span><span className="font-bold">₹{totals.debit.toLocaleString("en-IN")}</span></div>
              <div><span className="text-muted-foreground">Total Credit: </span><span className="font-bold">₹{totals.credit.toLocaleString("en-IN")}</span></div>
              <div><span className="text-muted-foreground">Entries: </span><span className="font-bold">{rows.length}</span></div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
