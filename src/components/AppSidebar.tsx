import {
  LayoutDashboard, Users, Package, Boxes, ArrowDownToLine, AlertTriangle,
  ShoppingCart, FileText, RotateCcw, BookOpen, CreditCard, Banknote, Building2,
  BarChart3, TrendingDown, ClipboardList, PackageSearch, UserCog, Receipt,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MODULE_ACCESS } from "@/types/roles";
import type { AppRole } from "@/types/roles";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
} from "@/components/ui/sidebar";

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
      { title: "Products", url: "/masters/products", icon: Package },
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
    label: "Finance",
    module: "finance",
    items: [
      { title: "Ledger", url: "/finance/ledger", icon: BookOpen },
      { title: "Outstanding", url: "/finance/outstanding", icon: CreditCard },
      { title: "Payments", url: "/finance/payments", icon: Banknote },
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
    ],
  },
  {
    label: "Settings",
    module: "settings",
    items: [
      { title: "Company", url: "/settings/company", icon: Building2 },
      { title: "Users", url: "/settings/users", icon: UserCog },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { userRoles } = useAuth();

  const hasModuleAccess = (module: string) => {
    const allowed = MODULE_ACCESS[module];
    if (!allowed) return true;
    return userRoles.some((r: AppRole) => allowed.includes(r));
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">R</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sidebar-foreground">Raizechem</h2>
            <p className="text-[10px] text-sidebar-foreground/60">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {navGroups.filter((g) => hasModuleAccess(g.module)).map((group) => (
          <SidebarGroup key={group.label || "main"}>
            {group.label && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url || location.pathname.startsWith(item.url + "/")}>
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
