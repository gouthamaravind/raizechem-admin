import {
  LayoutDashboard, Users, Package, Boxes, ArrowDownToLine, AlertTriangle,
  ShoppingCart, FileText, RotateCcw, BookOpen, CreditCard, Banknote, Building2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
} from "@/components/ui/sidebar";

const navGroups = [
  {
    label: "",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Masters",
    items: [
      { title: "Dealers", url: "/masters/dealers", icon: Users },
      { title: "Products", url: "/masters/products", icon: Package },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Batches", url: "/inventory/batches", icon: Boxes },
      { title: "Stock In", url: "/inventory/stock-in", icon: ArrowDownToLine },
      { title: "Alerts", url: "/inventory/alerts", icon: AlertTriangle },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Orders", url: "/sales/orders", icon: ShoppingCart },
      { title: "Invoices", url: "/sales/invoices", icon: FileText },
      { title: "Returns", url: "/sales/returns", icon: RotateCcw },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Ledger", url: "/finance/ledger", icon: BookOpen },
      { title: "Outstanding", url: "/finance/outstanding", icon: CreditCard },
      { title: "Payments", url: "/finance/payments", icon: Banknote },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "Company", url: "/settings/company", icon: Building2 }],
  },
];

export function AppSidebar() {
  const location = useLocation();

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
        {navGroups.map((group) => (
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
