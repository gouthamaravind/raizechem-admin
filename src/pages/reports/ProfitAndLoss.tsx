import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function ProfitAndLoss() {
  // Sales revenue (non-void invoices)
  const { data: invoices = [] } = useQuery({
    queryKey: ["pl-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("subtotal, cgst_total, sgst_total, igst_total, total_amount, status");
      return (data || []).filter((i: any) => i.status !== "void");
    },
  });

  // Purchase cost (non-void)
  const { data: purchases = [] } = useQuery({
    queryKey: ["pl-purchases"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_invoices" as any).select("subtotal, cgst_total, sgst_total, igst_total, total_amount, status");
      return (data || []).filter((i: any) => i.status !== "void");
    },
  });

  // Credit notes (returns from customers)
  const { data: creditNotes = [] } = useQuery({
    queryKey: ["pl-credit-notes"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_notes").select("total_amount, status");
      return (data || []).filter((i: any) => i.status !== "void");
    },
  });

  // Debit notes (returns to suppliers)
  const { data: debitNotes = [] } = useQuery({
    queryKey: ["pl-debit-notes"],
    queryFn: async () => {
      const { data } = await supabase.from("debit_notes").select("total_amount, status");
      return (data || []).filter((i: any) => i.status !== "void");
    },
  });

  // Payroll expenses
  const { data: payroll = [] } = useQuery({
    queryKey: ["pl-payroll"],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_runs").select("total_gross, total_net, status").eq("status", "processed");
      return data || [];
    },
  });

  const salesRevenue = invoices.reduce((s: number, i: any) => s + Number(i.subtotal), 0);
  const salesGST = invoices.reduce((s: number, i: any) => s + Number(i.cgst_total) + Number(i.sgst_total) + Number(i.igst_total), 0);
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
