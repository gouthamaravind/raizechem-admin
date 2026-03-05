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

const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

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
      if (fy) { setFrom(fy.start_date); setTo(fy.end_date); }
    }
  };

  // 1. Dealer ledger entries
  const { data: dealerLedger = [] } = useQuery({
    queryKey: ["trial-dealer-ledger", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_entries")
        .select("dealer_id, debit, credit, dealers(name)")
        .gte("entry_date", from).lte("entry_date", to);
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Supplier ledger entries
  const { data: supplierLedger = [] } = useQuery({
    queryKey: ["trial-supplier-ledger", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_ledger_entries" as any)
        .select("supplier_id, debit, credit, suppliers(name)")
        .gte("entry_date", from).lte("entry_date", to);
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Voucher lines (Journal, Contra, Receipt, Payment vouchers)
  const { data: voucherLines = [] } = useQuery({
    queryKey: ["trial-voucher-lines", from, to],
    queryFn: async () => {
      // First get active voucher IDs in date range
      const { data: vouchers, error: vErr } = await supabase
        .from("vouchers")
        .select("id")
        .neq("status", "void")
        .gte("voucher_date", from)
        .lte("voucher_date", to);
      if (vErr) throw vErr;
      if (!vouchers || vouchers.length === 0) return [];

      const voucherIds = vouchers.map((v: any) => v.id);
      const { data: lines, error: lErr } = await supabase
        .from("voucher_lines")
        .select("account_id, debit, credit, dealer_id, supplier_id, ledger_accounts(name, parent_type, account_type)")
        .in("voucher_id", voucherIds);
      if (lErr) throw lErr;
      return lines || [];
    },
  });

  // 4. Ledger accounts (for grouping)
  const { data: ledgerAccounts = [] } = useQuery({
    queryKey: ["ledger-accounts-tb"],
    queryFn: async () => {
      const { data } = await supabase.from("ledger_accounts").select("id, name, parent_type, account_type").eq("is_active", true);
      return data || [];
    },
  });

  // === Build Trial Balance rows ===
  type Row = { account: string; group: string; debit: number; credit: number; sortOrder: number };
  const rows: Row[] = [];

  // Group order for Tally-style display
  const groupOrder: Record<string, number> = {
    "Capital Account": 1, "Loans (Liability)": 2, "Current Liabilities": 3,
    "Fixed Assets": 4, "Investments": 5, "Current Assets": 6,
    "Sundry Debtors": 7, "Sundry Creditors": 8,
    "Sales Accounts": 9, "Purchase Accounts": 10,
    "Direct Expenses": 11, "Indirect Expenses": 12,
    "Direct Income": 13, "Indirect Income": 14,
    "Bank Accounts": 15, "Cash-in-Hand": 16,
    "Duties & Taxes": 17,
  };

  const parentTypeLabel: Record<string, string> = {
    asset: "Current Assets", liability: "Current Liabilities",
    income: "Direct Income", expense: "Direct Expenses",
    equity: "Capital Account",
  };

  // A. Dealer ledger → Sundry Debtors
  const dealerMap = new Map<string, { name: string; debit: number; credit: number }>();
  dealerLedger.forEach((e: any) => {
    const cur = dealerMap.get(e.dealer_id) || { name: e.dealers?.name || "Unknown", debit: 0, credit: 0 };
    cur.debit += Number(e.debit); cur.credit += Number(e.credit);
    dealerMap.set(e.dealer_id, cur);
  });
  // Also add dealer-linked voucher lines to dealer balances
  voucherLines.forEach((l: any) => {
    if (!l.dealer_id) return;
    const cur = dealerMap.get(l.dealer_id) || { name: "Unknown", debit: 0, credit: 0 };
    cur.debit += Number(l.debit); cur.credit += Number(l.credit);
    dealerMap.set(l.dealer_id, cur);
  });
  dealerMap.forEach((v) => {
    const net = v.debit - v.credit;
    if (Math.abs(net) > 0.01) {
      rows.push({ account: v.name, group: "Sundry Debtors", debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0, sortOrder: groupOrder["Sundry Debtors"] });
    }
  });

  // B. Supplier ledger → Sundry Creditors
  const supplierMap = new Map<string, { name: string; debit: number; credit: number }>();
  supplierLedger.forEach((e: any) => {
    const cur = supplierMap.get(e.supplier_id) || { name: e.suppliers?.name || "Unknown", debit: 0, credit: 0 };
    cur.debit += Number(e.debit); cur.credit += Number(e.credit);
    supplierMap.set(e.supplier_id, cur);
  });
  voucherLines.forEach((l: any) => {
    if (!l.supplier_id) return;
    const cur = supplierMap.get(l.supplier_id) || { name: "Unknown", debit: 0, credit: 0 };
    cur.debit += Number(l.debit); cur.credit += Number(l.credit);
    supplierMap.set(l.supplier_id, cur);
  });
  supplierMap.forEach((v) => {
    const net = v.credit - v.debit;
    if (Math.abs(net) > 0.01) {
      rows.push({ account: v.name, group: "Sundry Creditors", debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0, sortOrder: groupOrder["Sundry Creditors"] });
    }
  });

  // C. Ledger accounts from voucher lines (non-dealer, non-supplier lines)
  const accountMap = new Map<string, { name: string; group: string; debit: number; credit: number }>();
  voucherLines.forEach((l: any) => {
    if (l.dealer_id || l.supplier_id) return; // already counted above
    const acct = l.ledger_accounts;
    if (!acct) return;
    const key = l.account_id;
    const group = parentTypeLabel[acct.parent_type] || acct.parent_type;
    const cur = accountMap.get(key) || { name: acct.name, group, debit: 0, credit: 0 };
    cur.debit += Number(l.debit); cur.credit += Number(l.credit);
    accountMap.set(key, cur);
  });
  accountMap.forEach((v) => {
    const net = v.debit - v.credit;
    if (Math.abs(net) > 0.01) {
      const so = groupOrder[v.group] ?? 99;
      rows.push({ account: v.name, group: v.group, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0, sortOrder: so });
    }
  });

  // Sort by group order, then account name
  rows.sort((a, b) => a.sortOrder - b.sortOrder || a.account.localeCompare(b.account));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);

  const cols = [
    { key: "account", label: "Account" },
    { key: "group", label: "Group" },
    { key: "debit", label: "Debit (₹)" },
    { key: "credit", label: "Credit (₹)" },
  ];

  // Group rows by group for Tally-style display
  let lastGroup = "";

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

        {difference > 0.01 && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <p className="text-sm text-destructive font-medium">
                ⚠ Trial Balance does not tally — difference of ₹{difference.toLocaleString("en-IN", { minimumFractionDigits: 2 })}. Check for missing voucher entries or opening balances.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            {rows.length === 0 ? <p className="text-muted-foreground text-center py-8">No ledger data found.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Debit (₹)</TableHead>
                    <TableHead className="text-right">Credit (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const showGroup = r.group !== lastGroup;
                    lastGroup = r.group;
                    return (
                      <>
                        {showGroup && (
                          <TableRow key={`grp-${r.group}`} className="bg-muted/50">
                            <TableCell colSpan={4} className="font-semibold text-sm py-2">{r.group}</TableCell>
                          </TableRow>
                        )}
                        <TableRow key={i}>
                          <TableCell className="font-medium pl-8">{r.account}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{r.group}</TableCell>
                          <TableCell className="text-right">{fmt(r.debit)}</TableCell>
                          <TableCell className="text-right">{fmt(r.credit)}</TableCell>
                        </TableRow>
                      </>
                    );
                  })}
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
