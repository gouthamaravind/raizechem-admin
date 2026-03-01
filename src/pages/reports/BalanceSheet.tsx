import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export default function BalanceSheet() {
  // Trade Receivables (dealer outstanding)
  const { data: invoices = [] } = useQuery({
    queryKey: ["bs-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("total_amount, amount_paid, status");
      return (data || []).filter((i: any) => i.status !== "void");
    },
  });

  // Trade Payables (supplier outstanding)
  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ["bs-purchase-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_invoices" as any).select("total_amount, amount_paid, status");
      return (data || []).filter((i: any) => i.status !== "void");
    },
  });

  // Inventory value
  const { data: batches = [] } = useQuery({
    queryKey: ["bs-batches"],
    queryFn: async () => {
      const { data } = await supabase.from("product_batches").select("current_qty, purchase_rate");
      return data || [];
    },
  });

  // Advance receipts (liability - money received in advance)
  const { data: advances = [] } = useQuery({
    queryKey: ["bs-advances"],
    queryFn: async () => {
      const { data } = await supabase.from("advance_receipts" as any).select("balance_amount, status");
      return (data || []).filter((a: any) => a.status === "OPEN");
    },
  });

  const tradeReceivables = invoices.reduce((s: number, i: any) =>
    s + Math.max(0, Number(i.total_amount) - Number(i.amount_paid)), 0);

  const inventoryValue = batches.reduce((s: number, b: any) =>
    s + Math.max(0, Number(b.current_qty)) * Number(b.purchase_rate), 0);

  const totalAssets = tradeReceivables + inventoryValue;

  const tradePayables = purchaseInvoices.reduce((s: number, i: any) =>
    s + Math.max(0, Number(i.total_amount) - Number(i.amount_paid)), 0);

  const advanceLiability = advances.reduce((s: number, a: any) => s + Number(a.balance_amount), 0);

  const totalLiabilities = tradePayables + advanceLiability;

  type Row = { section: string; particular: string; amount: number };
  const rows: Row[] = [
    { section: "ASSETS", particular: "Trade Receivables (Sundry Debtors)", amount: tradeReceivables },
    { section: "ASSETS", particular: "Inventory (at cost)", amount: inventoryValue },
    { section: "ASSETS", particular: "Total Assets", amount: totalAssets },
    { section: "", particular: "", amount: 0 },
    { section: "LIABILITIES", particular: "Trade Payables (Sundry Creditors)", amount: tradePayables },
    { section: "LIABILITIES", particular: "Advance Receipts from Dealers", amount: advanceLiability },
    { section: "LIABILITIES", particular: "Total Liabilities", amount: totalLiabilities },
    { section: "", particular: "", amount: 0 },
    { section: "NET", particular: "Net Worth (Assets − Liabilities)", amount: totalAssets - totalLiabilities },
  ];

  const exportRows = rows.filter(r => r.particular);
  const cols = [{ key: "section", label: "Section" }, { key: "particular", label: "Particular" }, { key: "amount", label: "Amount (₹)" }];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Balance Sheet</h1>
            <p className="text-muted-foreground">Assets, liabilities and net worth summary</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCsv("balance-sheet.csv", exportRows, cols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={() => exportToXlsx("balance-sheet.xlsx", exportRows, cols)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              {rows.map((r, i) => {
                if (!r.particular) return <div key={i} className="h-4" />;
                const isTotal = r.particular.startsWith("Total") || r.particular.startsWith("Net Worth");
                return (
                  <div key={i} className={`flex justify-between py-2 px-3 rounded ${isTotal ? "bg-muted font-semibold" : ""}`}>
                    <span>{r.particular}</span>
                    <span>₹{r.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
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
