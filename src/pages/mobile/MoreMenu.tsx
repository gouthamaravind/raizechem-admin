import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

const SECTIONS: Record<string, { groups: { title: string; links: { label: string; to: string }[] }[] }> = {
  admin: {
    groups: [
      { title: "Masters", links: [
        { label: "Dealers", to: "/masters/dealers" },
        { label: "Suppliers", to: "/masters/suppliers" },
        { label: "Products", to: "/masters/products" },
        { label: "Price Levels", to: "/masters/price-levels" },
        { label: "Transporters", to: "/masters/transporters" },
      ]},
      { title: "Inventory", links: [
        { label: "Batches", to: "/inventory/batches" },
        { label: "Stock In", to: "/inventory/stock-in" },
        { label: "Warehouses", to: "/inventory/warehouses" },
        { label: "Stock Transfers", to: "/inventory/stock-transfers" },
        { label: "Alerts", to: "/inventory/alerts" },
      ]},
      { title: "Sales", links: [
        { label: "Orders", to: "/sales/orders" },
        { label: "Invoices", to: "/sales/invoices" },
        { label: "Returns", to: "/sales/returns" },
      ]},
      { title: "Purchase", links: [
        { label: "Orders", to: "/purchase/orders" },
        { label: "Invoices", to: "/purchase/invoices" },
        { label: "Returns", to: "/purchase/returns" },
      ]},
      { title: "Finance", links: [
        { label: "Ledger", to: "/finance/ledger" },
        { label: "Outstanding", to: "/finance/outstanding" },
        { label: "Payments", to: "/finance/payments" },
        { label: "Vouchers", to: "/finance/vouchers" },
        { label: "Daybook", to: "/finance/daybook" },
      ]},
      { title: "Reports", links: [
        { label: "Reports Hub", to: "/reports" },
      ]},
      { title: "Settings", links: [
        { label: "Company", to: "/settings/company" },
        { label: "Users", to: "/settings/users" },
        { label: "Audit Logs", to: "/settings/audit-logs" },
      ]},
    ],
  },
  manager: {
    groups: [
      { title: "Operations", links: [
        { label: "Field Sessions", to: "/fieldops/sessions" },
        { label: "Field Orders", to: "/fieldops/field-orders" },
        { label: "Field Payments", to: "/fieldops/payments" },
        { label: "Visits", to: "/fieldops/visits" },
      ]},
      { title: "Sales", links: [
        { label: "Orders", to: "/sales/orders" },
        { label: "Invoices", to: "/sales/invoices" },
      ]},
      { title: "Reports", links: [
        { label: "Sales Register", to: "/reports/sales-register" },
        { label: "Outstanding", to: "/reports/outstanding-aging" },
      ]},
    ],
  },
  sales: {
    groups: [
      { title: "Sales", links: [
        { label: "Orders", to: "/sales/orders" },
        { label: "Invoices", to: "/sales/invoices" },
        { label: "Returns", to: "/sales/returns" },
      ]},
      { title: "Finance", links: [
        { label: "Outstanding", to: "/finance/outstanding" },
        { label: "Payments", to: "/finance/payments" },
      ]},
      { title: "Masters", links: [
        { label: "Dealers", to: "/masters/dealers" },
        { label: "Products", to: "/masters/products" },
      ]},
    ],
  },
};

export default function MoreMenu({ shell }: { shell: "admin" | "manager" | "sales" }) {
  const data = SECTIONS[shell];
  return (
    <MobileLayout title="More">
      <div className="space-y-6">
        {data.groups.map((g) => (
          <div key={g.title} className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h3>
            <Card>
              <CardContent className="p-0 divide-y">
                {g.links.map((l) => (
                  <Link key={l.to} to={l.to} className="flex items-center justify-between px-4 py-3 hover:bg-accent/40">
                    <span className="text-sm font-medium">{l.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </MobileLayout>
  );
}
