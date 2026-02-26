import { useState } from "react";
import {
  LayoutDashboard, Users, Package, Boxes, ArrowDownToLine, AlertTriangle,
  ShoppingCart, FileText, RotateCcw, BookOpen, CreditCard, Banknote, Building2,
  BarChart3, TrendingDown, ClipboardList, PackageSearch, UserCog, Receipt,
  Truck, FileInput, Undo2, CalendarDays, Landmark, UserCheck, Calculator, Wallet, FileBarChart,
  ScrollText, Radio, MapPinned, ClipboardCheck, BadgeCheck, Grid3X3,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MODULE_ACCESS } from "@/types/roles";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navGroups = [
  {
    label: "",
    module: "dashboard",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Masters",
    module: "masters",
    items: [
      { title: "Dealers", url: "/masters/dealers", icon: Users },
      { title: "Suppliers", url: "/masters/suppliers", icon: Truck },
      { title: "Products", url: "/masters/products", icon: Package },
      { title: "Price Levels", url: "/masters/price-levels", icon: Receipt },
      { title: "Transporters", url: "/masters/transporters", icon: Truck },
    ],
  },
  {
    label: "Inventory",
    module: "inventory",
    items: [
      { title: "Batches", url: "/inventory/batches", icon: Boxes },
      { title: "Stock In", url: "/inventory/stock-in", icon: ArrowDownToLine },
      { title: "Alerts", url: "/inventory/alerts", icon: AlertTriangle },
    ],
  },
  {
    label: "Sales",
    module: "sales",
    items: [
      { title: "Orders", url: "/sales/orders", icon: ShoppingCart },
      { title: "Invoices", url: "/sales/invoices", icon: FileText },
      { title: "Returns", url: "/sales/returns", icon: RotateCcw },
    ],
  },
  {
    label: "Purchase",
    module: "purchase",
    items: [
      { title: "Orders", url: "/purchase/orders", icon: FileInput },
      { title: "Invoices", url: "/purchase/invoices", icon: FileText },
      { title: "Returns", url: "/purchase/returns", icon: Undo2 },
    ],
  },
  {
    label: "Finance",
    module: "finance",
    items: [
      { title: "Dealer Ledger", url: "/finance/ledger", icon: BookOpen },
      { title: "Dealer Outstanding", url: "/finance/outstanding", icon: CreditCard },
      { title: "Dealer Payments", url: "/finance/payments", icon: Banknote },
      { title: "Supplier Ledger", url: "/finance/supplier-ledger", icon: BookOpen },
      { title: "Supplier Outstanding", url: "/finance/supplier-outstanding", icon: CreditCard },
      { title: "Supplier Payments", url: "/finance/supplier-payments", icon: Banknote },
      { title: "Advance Receipts", url: "/finance/advances", icon: Wallet },
    ],
  },
  {
    label: "Reports",
    module: "reports",
    items: [
      { title: "Sales Register", url: "/reports/sales-register", icon: BarChart3 },
      { title: "Purchase Register", url: "/reports/purchase-register", icon: ClipboardList },
      { title: "Outstanding Aging", url: "/reports/outstanding-aging", icon: TrendingDown },
      { title: "Batch Stock", url: "/reports/batch-stock", icon: PackageSearch },
      { title: "GST Summary", url: "/reports/gst-summary", icon: Receipt },
      { title: "TDS / TCS", url: "/reports/tds-tcs", icon: Landmark },
      { title: "Price Matrix", url: "/reports/price-matrix", icon: Grid3X3 },
    ],
  },
  {
    label: "HR & Payroll",
    module: "hr",
    items: [
      { title: "Employees", url: "/hr/employees", icon: UserCheck },
      { title: "Salary Structure", url: "/hr/salary-components", icon: Calculator },
      { title: "Payroll", url: "/hr/payroll", icon: Wallet },
      { title: "Payslips", url: "/hr/payslips", icon: FileBarChart },
    ],
  },
  {
    label: "Field Ops",
    module: "fieldops",
    items: [
      { title: "Duty Sessions", url: "/fieldops/sessions", icon: Radio },
      { title: "Visits", url: "/fieldops/visits", icon: MapPinned },
      { title: "Field Orders", url: "/fieldops/field-orders", icon: ClipboardCheck },
      { title: "Field Payments", url: "/fieldops/payments", icon: BadgeCheck },
    ],
  },
  {
    label: "Settings",
    module: "settings",
    items: [
      { title: "Company", url: "/settings/company", icon: Building2 },
      { title: "Users", url: "/settings/users", icon: UserCog },
      { title: "Financial Years", url: "/settings/financial-years", icon: CalendarDays },
      { title: "Opening Balances", url: "/settings/opening-balances", icon: Landmark },
      { title: "Audit Logs", url: "/settings/audit-logs", icon: ScrollText },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { userRoles } = useAuth();

  const hasModuleAccess = (module: string) => {
    const allowed = MODULE_ACCESS[module as keyof typeof MODULE_ACCESS];
    if (!allowed) return true;
    return userRoles.some((r) => allowed.includes(r));
  };

  const isGroupActive = (group: typeof navGroups[0]) =>
    group.items.some(
      (item) => location.pathname === item.url || location.pathname.startsWith(item.url + "/")
    );

  return (
    <Sidebar className="border-r-0 glass">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <img src="/favicon.svg" alt="Raizechem" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Raizechem</h2>
            <p className="text-[10px] text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {navGroups.filter((g) => hasModuleAccess(g.module)).map((group) => {
          // Dashboard group — no collapsible wrapper
          if (!group.label) {
            return (
              <SidebarGroup key="main">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.url || location.pathname.startsWith(item.url + "/")}
                        >
                          <NavLink to={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          const active = isGroupActive(group);

          return (
            <Collapsible key={group.label} defaultOpen={active}>
              <SidebarGroup>
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold flex items-center justify-between cursor-pointer hover:text-sidebar-foreground/80 transition-colors pr-2">
                    {group.label}
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton
                            asChild
                            isActive={location.pathname === item.url || location.pathname.startsWith(item.url + "/")}
                          >
                            <NavLink to={item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
