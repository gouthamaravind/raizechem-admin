import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function SalesRegister() {
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [dealerFilter, setDealerFilter] = useState("all");

  const { data: dealers = [] } = useQuery({
    queryKey: ["dealers-list-report"],
    queryFn: async () => {
      const { data } = await supabase.from("dealers").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["sales-register", from, to, dealerFilter],
    queryFn: async () => {
      let q = supabase.from("invoices").select("*, dealers(name)")
        .gte("invoice_date", from).lte("invoice_date", to)
        .order("invoice_date", { ascending: false });
      if (dealerFilter !== "all") q = q.eq("dealer_id", dealerFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const totals = invoices.reduce((acc: any, inv: any) => ({
    subtotal: acc.subtotal + Number(inv.subtotal),
    cgst: acc.cgst + Number(inv.cgst_total),
    sgst: acc.sgst + Number(inv.sgst_total),
    igst: acc.igst + Number(inv.igst_total),
    total: acc.total + Number(inv.total_amount),
  }), { subtotal: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const exportData = invoices.map((i: any) => ({
    invoice_number: i.invoice_number, dealer: i.dealers?.name, date: i.invoice_date,
    subtotal: i.subtotal, cgst: i.cgst_total, sgst: i.sgst_total, igst: i.igst_total,
    total: i.total_amount, status: i.status,
  }));

  const cols = [
    { key: "invoice_number", label: "Invoice #" }, { key: "dealer", label: "Dealer" },
    { key: "date", label: "Date" }, { key: "subtotal", label: "Subtotal" },
    { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" },
    { key: "igst", label: "IGST" }, { key: "total", label: "Total" },
    { key: "status", label: "Status" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Sales Register</h1><p className="text-muted-foreground">Invoice-wise sales report with GST breakup</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("sales-register.csv", exportData, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("sales-register.xlsx", exportData, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Dealer</Label>
              <Select value={dealerFilter} onValueChange={setDealerFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dealers</SelectItem>
                  {dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : invoices.length === 0 ? <p className="text-muted-foreground text-center py-8">No invoices found.</p> : (
              <>
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Dealer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoices.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.dealers?.name}</TableCell>
                        <TableCell>{inv.invoice_date}</TableCell>
                        <TableCell className="text-right">₹{Number(inv.subtotal).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(inv.cgst_total).toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{Number(inv.sgst_total).toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{Number(inv.igst_total).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">₹{totals.subtotal.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totals.cgst.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{totals.sgst.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{totals.igst.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{totals.total.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
