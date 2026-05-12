import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen, Wallet, Users, Layers, FileText,
  ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Receipt, ShoppingCart,
  ClipboardList, FileMinus, FilePlus, Scale, PieChart, Sheet,
  TrendingDown, AlertTriangle,
} from "lucide-react";

const sections = [
  {
    title: "Account Books",
    items: [
      { label: "Cash / Bank Books", to: "/reports/cash-bank-book", icon: Wallet, desc: "Bank-wise running balance" },
      { label: "Ledger", to: "/finance/ledger", icon: BookOpen, desc: "Party-wise account ledger" },
      { label: "Group Summary", to: "/reports/group-summary", icon: Layers, desc: "Account groups summary" },
      { label: "Group Vouchers", to: "/reports/group-vouchers", icon: FileText, desc: "Vouchers by group" },
    ],
  },
  {
    title: "Registers",
    items: [
      { label: "Contra Register", to: "/reports/contra-register", icon: ArrowLeftRight, desc: "Bank ↔ cash transfers" },
      { label: "Payment Register", to: "/reports/payment-register", icon: ArrowUpFromLine, desc: "All payment vouchers" },
      { label: "Receipt Register", to: "/reports/receipt-register", icon: ArrowDownToLine, desc: "Receipts & advances" },
      { label: "Sales Register", to: "/reports/sales-register", icon: Receipt, desc: "Sales invoices with GST" },
      { label: "Purchase Register", to: "/reports/purchase-register", icon: ShoppingCart, desc: "Purchase invoices with GST" },
      { label: "Journal Register", to: "/reports/journal-register", icon: ClipboardList, desc: "All journal vouchers" },
      { label: "Debit Note Register", to: "/reports/debit-note-register", icon: FileMinus, desc: "Debit notes (purchase returns)" },
      { label: "Credit Note Register", to: "/reports/credit-note-register", icon: FilePlus, desc: "Credit notes (sales returns)" },
    ],
  },
  {
    title: "Statements",
    items: [
      { label: "Trial Balance", to: "/reports/trial-balance", icon: Scale, desc: "Debit & credit balances" },
      { label: "Profit & Loss", to: "/reports/profit-loss", icon: PieChart, desc: "Income & expense statement" },
      { label: "Balance Sheet", to: "/reports/balance-sheet", icon: Sheet, desc: "Assets, liabilities, net worth" },
      { label: "Outstanding Aging", to: "/reports/outstanding-aging", icon: TrendingDown, desc: "Receivables aging" },
      { label: "GST Summary", to: "/reports/gst-summary", icon: Receipt, desc: "GSTR returns summary" },
    ],
  },
  {
    title: "Exception Reports",
    items: [
      { label: "Voucher Clarification", to: "/reports/voucher-clarification", icon: AlertTriangle, desc: "Cancelled / void / unbalanced" },
    ],
  },
];

export default function Hub() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Display More Reports</h1>
          <p className="text-muted-foreground">Tally-style report gateway — drill from year → month → day → voucher.</p>
        </div>

        {sections.map(section => (
          <div key={section.title} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {section.items.map(item => (
                <Link key={item.to} to={item.to}>
                  <Card className="glass-card-hover h-full transition-all hover:scale-[1.02]">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <item.icon className="h-5 w-5 text-primary" />
                        {item.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">{item.desc}</CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
