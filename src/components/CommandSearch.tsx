import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MODULE_ACCESS } from "@/types/roles";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Package, Boxes, ArrowDownToLine, AlertTriangle,
  ShoppingCart, FileText, RotateCcw, BookOpen, CreditCard, Banknote,
  Building2, BarChart3, TrendingDown, ClipboardList, PackageSearch,
  UserCog, Receipt, Truck, FileInput, Undo2, CalendarDays, Landmark,
  UserCheck, Calculator, Wallet, FileBarChart, ScrollText, Radio,
  MapPinned, ClipboardCheck, BadgeCheck, Grid3X3, HelpCircle, Scale,
  PieChart, Sheet, WarehouseIcon, Combine, ArrowLeftRight,
} from "lucide-react";
import type { AppRole } from "@/types/roles";

const allPages = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { title: "Dealers", url: "/masters/dealers", icon: Users, module: "masters" },
  { title: "Suppliers", url: "/masters/suppliers", icon: Truck, module: "masters" },
  { title: "Products", url: "/masters/products", icon: Package, module: "masters" },
  { title: "Price Levels", url: "/masters/price-levels", icon: Receipt, module: "masters" },
  { title: "Transporters", url: "/masters/transporters", icon: Truck, module: "masters" },
  { title: "Batches", url: "/inventory/batches", icon: Boxes, module: "inventory" },
  { title: "Stock In", url: "/inventory/stock-in", icon: ArrowDownToLine, module: "inventory" },
  { title: "Warehouses", url: "/inventory/warehouses", icon: WarehouseIcon, module: "inventory" },
  { title: "Stock Transfers", url: "/inventory/stock-transfers", icon: Truck, module: "inventory" },
  { title: "Inventory Alerts", url: "/inventory/alerts", icon: AlertTriangle, module: "inventory" },
  { title: "Bill of Materials", url: "/inventory/bom", icon: Combine, module: "inventory" },
  { title: "Sales Orders", url: "/sales/orders", icon: ShoppingCart, module: "sales" },
  { title: "Sales Invoices", url: "/sales/invoices", icon: FileText, module: "sales" },
  { title: "Sales Returns", url: "/sales/returns", icon: RotateCcw, module: "sales" },
  { title: "Branch Transfers", url: "/sales/branch-transfers", icon: ArrowLeftRight, module: "sales" },
  { title: "Purchase Orders", url: "/purchase/orders", icon: FileInput, module: "purchase" },
  { title: "Purchase Invoices", url: "/purchase/invoices", icon: FileText, module: "purchase" },
  { title: "Purchase Returns", url: "/purchase/returns", icon: Undo2, module: "purchase" },
  { title: "Dealer Ledger", url: "/finance/ledger", icon: BookOpen, module: "finance" },
  { title: "Dealer Outstanding", url: "/finance/outstanding", icon: CreditCard, module: "finance" },
  { title: "Dealer Payments", url: "/finance/payments", icon: Banknote, module: "finance" },
  { title: "Supplier Ledger", url: "/finance/supplier-ledger", icon: BookOpen, module: "finance" },
  { title: "Supplier Outstanding", url: "/finance/supplier-outstanding", icon: CreditCard, module: "finance" },
  { title: "Supplier Payments", url: "/finance/supplier-payments", icon: Banknote, module: "finance" },
  { title: "Advance Receipts", url: "/finance/advances", icon: Wallet, module: "finance" },
  { title: "Vouchers", url: "/finance/vouchers", icon: ScrollText, module: "finance" },
  { title: "Sales Register", url: "/reports/sales-register", icon: BarChart3, module: "reports" },
  { title: "Purchase Register", url: "/reports/purchase-register", icon: ClipboardList, module: "reports" },
  { title: "Outstanding Aging", url: "/reports/outstanding-aging", icon: TrendingDown, module: "reports" },
  { title: "Batch Stock Report", url: "/reports/batch-stock", icon: PackageSearch, module: "reports" },
  { title: "Stock Summary", url: "/reports/stock-summary", icon: WarehouseIcon, module: "reports" },
  { title: "Trial Balance", url: "/reports/trial-balance", icon: Scale, module: "reports" },
  { title: "Profit & Loss", url: "/reports/profit-loss", icon: PieChart, module: "reports" },
  { title: "Balance Sheet", url: "/reports/balance-sheet", icon: Sheet, module: "reports" },
  { title: "GST Summary", url: "/reports/gst-summary", icon: Receipt, module: "reports" },
  { title: "TDS / TCS", url: "/reports/tds-tcs", icon: Landmark, module: "reports" },
  { title: "Price Matrix", url: "/reports/price-matrix", icon: Grid3X3, module: "reports" },
  { title: "GSTR-2B Recon", url: "/reports/gstr2b-recon", icon: FileBarChart, module: "reports" },
  { title: "Employees", url: "/hr/employees", icon: UserCheck, module: "hr" },
  { title: "Salary Structure", url: "/hr/salary-components", icon: Calculator, module: "hr" },
  { title: "Payroll", url: "/hr/payroll", icon: Wallet, module: "hr" },
  { title: "Payslips", url: "/hr/payslips", icon: FileBarChart, module: "hr" },
  { title: "Duty Sessions", url: "/fieldops/sessions", icon: Radio, module: "fieldops" },
  { title: "Visits", url: "/fieldops/visits", icon: MapPinned, module: "fieldops" },
  { title: "Field Orders", url: "/fieldops/field-orders", icon: ClipboardCheck, module: "fieldops" },
  { title: "Field Payments", url: "/fieldops/payments", icon: BadgeCheck, module: "fieldops" },
  { title: "Company Settings", url: "/settings/company", icon: Building2, module: "settings" },
  { title: "User Management", url: "/settings/users", icon: UserCog, module: "settings" },
  { title: "Financial Years", url: "/settings/financial-years", icon: CalendarDays, module: "settings" },
  { title: "Opening Balances", url: "/settings/opening-balances", icon: Landmark, module: "settings" },
  { title: "Audit Logs", url: "/settings/audit-logs", icon: ScrollText, module: "settings" },
  { title: "Help & Docs", url: "/settings/help", icon: HelpCircle, module: "settings" },
];

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { userRoles } = useAuth();

  const hasAccess = (module: string) => {
    const allowed = MODULE_ACCESS[module as keyof typeof MODULE_ACCESS];
    if (!allowed) return true;
    return userRoles.some((r) => allowed.includes(r as AppRole));
  };

  const filteredPages = allPages.filter((p) => hasAccess(p.module));

  // Group by module
  const groups = filteredPages.reduce<Record<string, typeof allPages>>((acc, page) => {
    const label = page.module.charAt(0).toUpperCase() + page.module.slice(1);
    if (!acc[label]) acc[label] = [];
    acc[label].push(page);
    return acc;
  }, {});

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelect = useCallback((url: string) => {
    onOpenChange(false);
    navigate(url);
  }, [navigate, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages... (⌘K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(groups).map(([label, pages]) => (
          <CommandGroup key={label} heading={label}>
            {pages.map((page) => (
              <CommandItem key={page.url} onSelect={() => handleSelect(page.url)} className="cursor-pointer">
                <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
