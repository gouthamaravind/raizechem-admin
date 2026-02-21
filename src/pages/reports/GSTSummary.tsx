import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GSTSummary() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);
  const [year, setYear] = useState(String(now.getFullYear()));

  // Fetch invoice items with invoice + product info
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gst-items", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*, invoices!inner(invoice_number, invoice_date, dealer_id, dealers(name, gst_number, state_code)), products(name)")
        .gte("invoices.invoice_date", from)
        .lte("invoices.invoice_date", to);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch credit note items
  const { data: cnItems = [] } = useQuery({
    queryKey: ["gst-cn-items", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_note_items")
        .select("*, credit_notes!inner(credit_note_number, credit_date, dealer_id, dealers(name, gst_number))")
        .gte("credit_notes.credit_date", from)
        .lte("credit_notes.credit_date", to);
      if (error) throw error;
      return data || [];
    },
  });

  // Monthly data for tax liability
  const { data: monthlyInvoices = [] } = useQuery({
    queryKey: ["gst-monthly", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_date, subtotal, cgst_total, sgst_total, igst_total, total_amount")
        .gte("invoice_date", `${year}-01-01`)
        .lte("invoice_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: monthlyCNs = [] } = useQuery({
    queryKey: ["gst-monthly-cn", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("credit_date, subtotal, cgst_total, sgst_total, igst_total, total_amount")
        .gte("credit_date", `${year}-01-01`)
        .lte("credit_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // === HSN Summary ===
  const hsnMap: Record<string, { hsn: string; product: string; gstRate: number; taxableValue: number; cgst: number; sgst: number; igst: number; total: number; qty: number }> = {};
  items.forEach((it: any) => {
    const key = `${it.hsn_code || "N/A"}-${it.gst_rate}`;
    if (!hsnMap[key]) hsnMap[key] = { hsn: it.hsn_code || "N/A", product: it.products?.name || "", gstRate: it.gst_rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0, qty: 0 };
    hsnMap[key].taxableValue += Number(it.amount);
    hsnMap[key].cgst += Number(it.cgst_amount);
    hsnMap[key].sgst += Number(it.sgst_amount);
    hsnMap[key].igst += Number(it.igst_amount);
    hsnMap[key].total += Number(it.total_amount);
    hsnMap[key].qty += Number(it.qty);
  });
  const hsnRows = Object.values(hsnMap).sort((a, b) => a.hsn.localeCompare(b.hsn));
  const hsnTotals = hsnRows.reduce((a, r) => ({ taxableValue: a.taxableValue + r.taxableValue, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, igst: a.igst + r.igst, total: a.total + r.total }), { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  // === GSTR-1 B2B Summary ===
  const b2bMap: Record<string, { dealer: string; gstin: string; invoices: number; taxableValue: number; cgst: number; sgst: number; igst: number; total: number }> = {};
  items.forEach((it: any) => {
    const inv = it.invoices;
    const gstin = inv?.dealers?.gst_number || "Unregistered";
    const key = `${inv?.dealer_id}-${inv?.invoice_number}`;
    if (!b2bMap[gstin]) b2bMap[gstin] = { dealer: inv?.dealers?.name || "", gstin, invoices: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    b2bMap[gstin].taxableValue += Number(it.amount);
    b2bMap[gstin].cgst += Number(it.cgst_amount);
    b2bMap[gstin].sgst += Number(it.sgst_amount);
    b2bMap[gstin].igst += Number(it.igst_amount);
    b2bMap[gstin].total += Number(it.total_amount);
  });
  // Count unique invoices per GSTIN
  const gstinInvMap: Record<string, Set<string>> = {};
  items.forEach((it: any) => {
    const gstin = it.invoices?.dealers?.gst_number || "Unregistered";
    if (!gstinInvMap[gstin]) gstinInvMap[gstin] = new Set();
    gstinInvMap[gstin].add(it.invoices?.invoice_number);
  });
  Object.keys(b2bMap).forEach((k) => { b2bMap[k].invoices = gstinInvMap[k]?.size || 0; });
  const b2bRows = Object.values(b2bMap).sort((a, b) => a.dealer.localeCompare(b.dealer));

  // === Monthly Tax Liability ===
  const monthlyData = months.map((name, idx) => {
    const m = String(idx + 1).padStart(2, "0");
    const invs = monthlyInvoices.filter((i: any) => i.invoice_date?.startsWith(`${year}-${m}`));
    const cns = monthlyCNs.filter((c: any) => c.credit_date?.startsWith(`${year}-${m}`));
    const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);
    return {
      month: name,
      salesTaxable: sum(invs, "subtotal"),
      cgst: sum(invs, "cgst_total") - sum(cns, "cgst_total"),
      sgst: sum(invs, "sgst_total") - sum(cns, "sgst_total"),
      igst: sum(invs, "igst_total") - sum(cns, "igst_total"),
      cnAmount: sum(cns, "total_amount"),
      netLiability: sum(invs, "cgst_total") + sum(invs, "sgst_total") + sum(invs, "igst_total") - sum(cns, "cgst_total") - sum(cns, "sgst_total") - sum(cns, "igst_total"),
    };
  });
  const yearTotals = monthlyData.reduce((a, r) => ({
    salesTaxable: a.salesTaxable + r.salesTaxable, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst,
    igst: a.igst + r.igst, cnAmount: a.cnAmount + r.cnAmount, netLiability: a.netLiability + r.netLiability,
  }), { salesTaxable: 0, cgst: 0, sgst: 0, igst: 0, cnAmount: 0, netLiability: 0 });

  // Export functions
  const exportHSN = () => exportToCsv("hsn-summary.csv", hsnRows.map((r) => ({ ...r, taxableValue: r.taxableValue.toFixed(2), cgst: r.cgst.toFixed(2), sgst: r.sgst.toFixed(2), igst: r.igst.toFixed(2), total: r.total.toFixed(2) })), [
    { key: "hsn", label: "HSN Code" }, { key: "product", label: "Product" }, { key: "gstRate", label: "GST %" },
    { key: "qty", label: "Qty" }, { key: "taxableValue", label: "Taxable Value" },
    { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" }, { key: "igst", label: "IGST" }, { key: "total", label: "Total" },
  ]);

  const exportGSTR1 = () => exportToCsv("gstr1-b2b.csv", b2bRows.map((r) => ({ ...r, taxableValue: r.taxableValue.toFixed(2), cgst: r.cgst.toFixed(2), sgst: r.sgst.toFixed(2), igst: r.igst.toFixed(2), total: r.total.toFixed(2) })), [
    { key: "gstin", label: "GSTIN" }, { key: "dealer", label: "Dealer" }, { key: "invoices", label: "No. of Invoices" },
    { key: "taxableValue", label: "Taxable Value" }, { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" },
    { key: "igst", label: "IGST" }, { key: "total", label: "Invoice Value" },
  ]);

  const exportMonthly = () => exportToCsv("monthly-tax-liability.csv", monthlyData.map((r) => ({ ...r, salesTaxable: r.salesTaxable.toFixed(2), cgst: r.cgst.toFixed(2), sgst: r.sgst.toFixed(2), igst: r.igst.toFixed(2), cnAmount: r.cnAmount.toFixed(2), netLiability: r.netLiability.toFixed(2) })), [
    { key: "month", label: "Month" }, { key: "salesTaxable", label: "Taxable Sales" },
    { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" }, { key: "igst", label: "IGST" },
    { key: "cnAmount", label: "Credit Notes" }, { key: "netLiability", label: "Net Liability" },
  ]);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GST Summary</h1>
          <p className="text-muted-foreground">HSN-wise tax summary, GSTR-1 format, and monthly tax liability</p>
        </div>

        <Tabs defaultValue="hsn">
          <TabsList>
            <TabsTrigger value="hsn">HSN Summary</TabsTrigger>
            <TabsTrigger value="gstr1">GSTR-1 (B2B)</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Liability</TabsTrigger>
          </TabsList>

          {/* HSN Summary */}
          <TabsContent value="hsn">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>HSN-wise Tax Summary</CardTitle>
                <Button variant="outline" size="sm" onClick={exportHSN}><Download className="h-4 w-4 mr-2" />CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 flex-wrap items-end">
                  <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                  <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                </div>
                {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : hsnRows.length === 0 ? <p className="text-muted-foreground text-center py-8">No data found.</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>HSN Code</TableHead><TableHead>Product</TableHead><TableHead className="text-right">GST %</TableHead>
                        <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Taxable Value</TableHead>
                        <TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hsnRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.hsn}</TableCell>
                          <TableCell>{r.product}</TableCell>
                          <TableCell className="text-right">{r.gstRate}%</TableCell>
                          <TableCell className="text-right">{r.qty}</TableCell>
                          <TableCell className="text-right">{fmt(r.taxableValue)}</TableCell>
                          <TableCell className="text-right">{fmt(r.cgst)}</TableCell>
                          <TableCell className="text-right">{fmt(r.sgst)}</TableCell>
                          <TableCell className="text-right">{fmt(r.igst)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.cgst + r.sgst + r.igst)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={4}>Total</TableCell>
                        <TableCell className="text-right">{fmt(hsnTotals.taxableValue)}</TableCell>
                        <TableCell className="text-right">{fmt(hsnTotals.cgst)}</TableCell>
                        <TableCell className="text-right">{fmt(hsnTotals.sgst)}</TableCell>
                        <TableCell className="text-right">{fmt(hsnTotals.igst)}</TableCell>
                        <TableCell className="text-right">{fmt(hsnTotals.cgst + hsnTotals.sgst + hsnTotals.igst)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GSTR-1 B2B */}
          <TabsContent value="gstr1">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>GSTR-1 B2B Summary</CardTitle>
                <Button variant="outline" size="sm" onClick={exportGSTR1}><Download className="h-4 w-4 mr-2" />CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 flex-wrap items-end">
                  <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                  <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                </div>
                {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : b2bRows.length === 0 ? <p className="text-muted-foreground text-center py-8">No data found.</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>GSTIN</TableHead><TableHead>Dealer</TableHead><TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Taxable Value</TableHead><TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">Invoice Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {b2bRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.gstin}</TableCell>
                          <TableCell>{r.dealer}</TableCell>
                          <TableCell className="text-right">{r.invoices}</TableCell>
                          <TableCell className="text-right">{fmt(r.taxableValue)}</TableCell>
                          <TableCell className="text-right">{fmt(r.cgst)}</TableCell>
                          <TableCell className="text-right">{fmt(r.sgst)}</TableCell>
                          <TableCell className="text-right">{fmt(r.igst)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly Tax Liability */}
          <TabsContent value="monthly">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Monthly Tax Liability</CardTitle>
                <Button variant="outline" size="sm" onClick={exportMonthly}><Download className="h-4 w-4 mr-2" />CSV</Button>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4 items-end">
                  <div className="space-y-1">
                    <Label>Financial Year</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead><TableHead className="text-right">Taxable Sales</TableHead>
                      <TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Credit Notes</TableHead>
                      <TableHead className="text-right">Net Liability</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((r) => (
                      <TableRow key={r.month} className={r.netLiability === 0 && r.salesTaxable === 0 ? "text-muted-foreground" : ""}>
                        <TableCell>{r.month}</TableCell>
                        <TableCell className="text-right">{fmt(r.salesTaxable)}</TableCell>
                        <TableCell className="text-right">{fmt(r.cgst)}</TableCell>
                        <TableCell className="text-right">{fmt(r.sgst)}</TableCell>
                        <TableCell className="text-right">{fmt(r.igst)}</TableCell>
                        <TableCell className="text-right text-destructive">{r.cnAmount > 0 ? `-${fmt(r.cnAmount)}` : fmt(0)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(r.netLiability)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{fmt(yearTotals.salesTaxable)}</TableCell>
                      <TableCell className="text-right">{fmt(yearTotals.cgst)}</TableCell>
                      <TableCell className="text-right">{fmt(yearTotals.sgst)}</TableCell>
                      <TableCell className="text-right">{fmt(yearTotals.igst)}</TableCell>
                      <TableCell className="text-right text-destructive">{yearTotals.cnAmount > 0 ? `-${fmt(yearTotals.cnAmount)}` : fmt(0)}</TableCell>
                      <TableCell className="text-right">{fmt(yearTotals.netLiability)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
