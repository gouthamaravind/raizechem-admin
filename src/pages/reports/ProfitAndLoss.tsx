import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function ProfitAndLoss() {
  // Financial year selector
  const { data: fys = [] } = useQuery({
    queryKey: ["financial-years"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_years").select("*").order("start_date", { ascending: false });
      return data || [];
    },
  });

  const activeFy = fys.find((f: any) => f.is_active);
  const [selectedFyId, setSelectedFyId] = useState<string>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const selectedFy = fys.find((f: any) => f.id === selectedFyId) || activeFy;
  const dateFrom = customFrom || selectedFy?.start_date || "2020-01-01";
  const dateTo = customTo || selectedFy?.end_date || "2099-12-31";

  // Sales revenue (non-void invoices)
  const { data: invoices = [] } = useQuery({
    queryKey: ["pl-invoices", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("subtotal, cgst_total, sgst_total, igst_total, total_amount, status")
        .neq("status", "void")
        .gte("invoice_date", dateFrom)
        .lte("invoice_date", dateTo);
      return data || [];
    },
  });

  // Purchase cost (non-void)
  const { data: purchases = [] } = useQuery({
    queryKey: ["pl-purchases", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_invoices" as any)
        .select("subtotal, cgst_total, sgst_total, igst_total, total_amount, status")
        .neq("status", "void")
        .gte("pi_date", dateFrom)
        .lte("pi_date", dateTo);
      return (data || []);
    },
  });

  // Credit notes (returns from customers)
  const { data: creditNotes = [] } = useQuery({
    queryKey: ["pl-credit-notes", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_notes")
        .select("total_amount, status")
        .neq("status", "void")
        .gte("credit_date", dateFrom)
        .lte("credit_date", dateTo);
      return data || [];
    },
  });

  // Debit notes (returns to suppliers)
  const { data: debitNotes = [] } = useQuery({
    queryKey: ["pl-debit-notes", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("debit_notes")
        .select("total_amount, status")
        .neq("status", "void")
        .gte("debit_date", dateFrom)
        .lte("debit_date", dateTo);
      return data || [];
    },
  });

  // Payroll expenses
  const { data: payroll = [] } = useQuery({
    queryKey: ["pl-payroll", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_runs")
        .select("total_gross, total_net, status, month, year")
        .eq("status", "processed");
      // Filter by date range using year/month
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      return (data || []).filter((r: any) => {
        const d = new Date(r.year, r.month - 1, 1);
        return d >= fromDate && d <= toDate;
      });
    },
  });

  const salesRevenue = invoices.reduce((s: number, i: any) => s + Number(i.subtotal), 0);
  const salesReturns = creditNotes.reduce((s: number, i: any) => s + Number(i.total_amount), 0);
  const netSales = salesRevenue - salesReturns;

  const purchaseCost = purchases.reduce((s: number, i: any) => s + Number(i.subtotal), 0);
  const purchaseReturns = debitNotes.reduce((s: number, i: any) => s + Number(i.total_amount), 0);
  const netPurchases = purchaseCost - purchaseReturns;

  const grossProfit = netSales - netPurchases;
  const salaryExpense = payroll.reduce((s: number, r: any) => s + Number(r.total_gross), 0);
  const netProfit = grossProfit - salaryExpense;

  type Row = { particular: string; amount: number };
  const rows: Row[] = [
    { particular: "Sales Revenue", amount: salesRevenue },
    { particular: "Less: Sales Returns (Credit Notes)", amount: -salesReturns },
    { particular: "Net Sales", amount: netSales },
    { particular: "", amount: 0 },
    { particular: "Cost of Goods Sold (Purchases)", amount: purchaseCost },
    { particular: "Less: Purchase Returns (Debit Notes)", amount: -purchaseReturns },
    { particular: "Net Purchases", amount: netPurchases },
    { particular: "", amount: 0 },
    { particular: "Gross Profit", amount: grossProfit },
    { particular: "", amount: 0 },
    { particular: "Salary & Payroll Expense", amount: salaryExpense },
    { particular: "", amount: 0 },
    { particular: "Net Profit / (Loss)", amount: netProfit },
  ];

  const exportRows = rows.filter(r => r.particular);
  const cols = [{ key: "particular", label: "Particular" }, { key: "amount", label: "Amount (₹)" }];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profit & Loss Statement</h1>
            <p className="text-muted-foreground">Income and expense summary</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("profit-loss.csv", exportRows, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("profit-loss.xlsx", exportRows, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>

        {/* Date / FY Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-4 flex-wrap items-end">
              <div className="space-y-1">
                <Label>Financial Year</Label>
                <Select value={selectedFyId || activeFy?.id || ""} onValueChange={(v) => { setSelectedFyId(v); setCustomFrom(""); setCustomTo(""); }}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Select FY" /></SelectTrigger>
                  <SelectContent>
                    {fys.map((fy: any) => (
                      <SelectItem key={fy.id} value={fy.id}>{fy.fy_code}{fy.is_active ? " (Active)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" className="w-40" value={customFrom || dateFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" className="w-40" value={customTo || dateTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              {rows.map((r, i) => {
                if (!r.particular) return <div key={i} className="h-3" />;
                const isHeader = ["Net Sales", "Net Purchases", "Gross Profit", "Net Profit / (Loss)"].includes(r.particular);
                const isNegative = r.amount < 0;
                return (
                  <div key={i} className={`flex justify-between py-2 px-3 rounded ${isHeader ? "bg-muted font-semibold" : ""}`}>
                    <span>{r.particular}</span>
                    <span className={isNegative ? "text-destructive" : ""}>
                      {r.amount < 0 ? `(₹${Math.abs(r.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })})` : `₹${r.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
