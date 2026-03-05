import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function TrialBalance() {
  const now = new Date();
  const fyStart = now.getMonth() >= 3
    ? `${now.getFullYear()}-04-01`
    : `${now.getFullYear() - 1}-04-01`;
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);

  const { data: financialYears = [] } = useQuery({
    queryKey: ["fy-list-tb"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_years").select("*").order("start_date", { ascending: false });
      return data || [];
    },
  });

  const [selectedFY, setSelectedFY] = useState("custom");

  const handleFYChange = (val: string) => {
    setSelectedFY(val);
    if (val !== "custom") {
      const fy = financialYears.find((f: any) => f.id === val);
      if (fy) {
        setFrom(fy.start_date);
        setTo(fy.end_date);
      }
    }
  };

  const { data: dealerLedger = [] } = useQuery({
    queryKey: ["trial-dealer-ledger", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_entries")
        .select("dealer_id, debit, credit, dealers(name)")
        .gte("entry_date", from)
        .lte("entry_date", to);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: supplierLedger = [] } = useQuery({
    queryKey: ["trial-supplier-ledger", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_ledger_entries" as any)
        .select("supplier_id, debit, credit, suppliers(name)")
        .gte("entry_date", from)
        .lte("entry_date", to);
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate dealer balances
  const dealerMap = new Map<string, { name: string; debit: number; credit: number }>();
  dealerLedger.forEach((e: any) => {
    const key = e.dealer_id;
    const cur = dealerMap.get(key) || { name: e.dealers?.name || "Unknown", debit: 0, credit: 0 };
    cur.debit += Number(e.debit);
    cur.credit += Number(e.credit);
    dealerMap.set(key, cur);
  });

  // Aggregate supplier balances
  const supplierMap = new Map<string, { name: string; debit: number; credit: number }>();
  supplierLedger.forEach((e: any) => {
    const key = e.supplier_id;
    const cur = supplierMap.get(key) || { name: e.suppliers?.name || "Unknown", debit: 0, credit: 0 };
    cur.debit += Number(e.debit);
    cur.credit += Number(e.credit);
    supplierMap.set(key, cur);
  });

  type Row = { account: string; type: string; debit: number; credit: number };
  const rows: Row[] = [];

  dealerMap.forEach((v) => {
    const net = v.debit - v.credit;
    rows.push({ account: v.name, type: "Sundry Debtor", debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  });

  supplierMap.forEach((v) => {
    const net = v.credit - v.debit;
    rows.push({ account: v.name, type: "Sundry Creditor", debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0 });
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  const cols = [
    { key: "account", label: "Account" },
    { key: "type", label: "Type" },
    { key: "debit", label: "Debit (₹)" },
    { key: "credit", label: "Credit (₹)" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
            <p className="text-muted-foreground">Consolidated debit & credit balances</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("trial-balance.csv", rows, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("trial-balance.xlsx", rows, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Period</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1 min-w-[180px]">
              <Label>Financial Year</Label>
              <Select value={selectedFY} onValueChange={handleFYChange}>
                <SelectTrigger><SelectValue placeholder="Custom" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Range</SelectItem>
                  {financialYears.map((fy: any) => (
                    <SelectItem key={fy.id} value={fy.id}>{fy.fy_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setSelectedFY("custom"); }} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setSelectedFY("custom"); }} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {rows.length === 0 ? <p className="text-muted-foreground text-center py-8">No ledger data found.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.filter(r => r.debit > 0 || r.credit > 0).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.account}</TableCell>
                      <TableCell className="text-muted-foreground">{r.type}</TableCell>
                      <TableCell className="text-right">{r.debit > 0 ? `₹${r.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                      <TableCell className="text-right">{r.credit > 0 ? `₹${r.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold">₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
