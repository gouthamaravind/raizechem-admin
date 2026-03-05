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

export default function PurchaseRegister() {
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [supplierFilter, setSupplierFilter] = useState("all");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list-report"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase-register", from, to, supplierFilter],
    queryFn: async () => {
      let q = supabase.from("purchase_invoices").select("*, suppliers(name)")
        .neq("status", "void")
        .gte("pi_date", from).lte("pi_date", to)
        .order("pi_date", { ascending: false });
      if (supplierFilter !== "all") q = q.eq("supplier_id", supplierFilter);
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
    pi_number: i.pi_number, supplier: i.suppliers?.name, date: i.pi_date,
    subtotal: i.subtotal, cgst: i.cgst_total, sgst: i.sgst_total, igst: i.igst_total,
    total: i.total_amount, status: i.status,
  }));

  const cols = [
    { key: "pi_number", label: "Invoice #" }, { key: "supplier", label: "Supplier" },
    { key: "date", label: "Date" }, { key: "subtotal", label: "Subtotal" },
    { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" },
    { key: "igst", label: "IGST" }, { key: "total", label: "Total" }, { key: "status", label: "Status" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Purchase Register</h1><p className="text-muted-foreground">Purchase invoices with GST breakdown</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("purchase-register.csv", exportData, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("purchase-register.xlsx", exportData, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="space-y-1 min-w-[180px]">
              <Label>Supplier</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger><SelectValue placeholder="All Suppliers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : invoices.length === 0 ? <p className="text-muted-foreground text-center py-8">No purchase invoices found.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.pi_number}</TableCell>
                      <TableCell>{inv.suppliers?.name}</TableCell>
                      <TableCell>{new Date(inv.pi_date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(inv.subtotal).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(inv.cgst_total).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(inv.sgst_total).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(inv.igst_total).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right font-semibold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "partially_paid" ? "bg-yellow-100 text-yellow-700" : "bg-muted text-muted-foreground"}`}>{inv.status}</span></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₹{totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₹{totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₹{totals.igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
