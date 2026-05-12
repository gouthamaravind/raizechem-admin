import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

export default function CashBankBook() {
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [accountId, setAccountId] = useState<string>("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["cash-bank-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("ledger_accounts")
        .select("id, name, account_type")
        .in("account_type", ["cash", "bank"])
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Use voucher_lines to get entries against this account
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["cb-lines", accountId, from, to],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_lines")
        .select("debit, credit, narration, vouchers!inner(voucher_number, voucher_date, voucher_type, status)")
        .eq("account_id", accountId)
        .gte("vouchers.voucher_date", from)
        .lte("vouchers.voucher_date", to);
      if (error) throw error;
      return (data || [])
        .filter((l: any) => l.vouchers?.status !== "void")
        .sort((a: any, b: any) => a.vouchers.voucher_date.localeCompare(b.vouchers.voucher_date));
    },
  });

  const rows = useMemo(() => {
    let bal = 0;
    return lines.map((l: any) => {
      bal += Number(l.debit) - Number(l.credit);
      return {
        date: l.vouchers.voucher_date,
        voucher: l.vouchers.voucher_number,
        type: l.vouchers.voucher_type,
        narration: l.narration,
        debit: Number(l.debit),
        credit: Number(l.credit),
        balance: bal,
      };
    });
  }, [lines]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cash / Bank Book</h1>
            <p className="text-muted-foreground">Account-wise transactions with running balance.</p>
          </div>
          <Button variant="outline" disabled={!rows.length} onClick={() => exportToCsv("cash-bank-book.csv", rows, [
            { key: "date", label: "Date" }, { key: "voucher", label: "Voucher #" },
            { key: "type", label: "Type" }, { key: "narration", label: "Narration" },
            { key: "debit", label: "Debit" }, { key: "credit", label: "Credit" }, { key: "balance", label: "Balance" },
          ])}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4 flex gap-4 flex-wrap items-end">
            <div className="space-y-1">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select cash/bank account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>From</Label><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {!accountId ? <p className="text-muted-foreground text-center py-8">Select an account to view its book.</p>
              : isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p>
              : rows.length === 0 ? <p className="text-muted-foreground text-center py-8">No transactions in this period.</p>
              : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Type</TableHead><TableHead>Narration</TableHead>
                    <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.date}</TableCell><TableCell className="font-medium">{r.voucher}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                        <TableCell className="text-sm">{r.narration}</TableCell>
                        <TableCell className="text-right">{r.debit ? `₹${r.debit.toFixed(2)}` : ""}</TableCell>
                        <TableCell className="text-right">{r.credit ? `₹${r.credit.toFixed(2)}` : ""}</TableCell>
                        <TableCell className="text-right font-semibold">₹{r.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
