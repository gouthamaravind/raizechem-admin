import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, MapPin, ShoppingCart, CreditCard, Users, LogOut,
  ShieldCheck, FileText, BarChart3, MoreHorizontal, ClipboardCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getMobileShell, type MobileShell } from "@/types/roles";

type NavItem = { path: string; icon: any; label: string };

const NAV_BY_SHELL: Record<MobileShell, NavItem[]> = {
  fieldops: [
    { path: "/m/fieldops/home", icon: Home, label: "Home" },
    { path: "/m/fieldops/duty", icon: MapPin, label: "Duty" },
    { path: "/m/fieldops/dealers", icon: Users, label: "Dealers" },
    { path: "/m/fieldops/orders", icon: ShoppingCart, label: "Orders" },
    { path: "/m/fieldops/payments", icon: CreditCard, label: "Pay" },
  ],
  manager: [
    { path: "/m/manager/home", icon: Home, label: "Home" },
    { path: "/m/manager/approvals", icon: ClipboardCheck, label: "Approvals" },
    { path: "/m/manager/orders", icon: ShoppingCart, label: "Orders" },
    { path: "/m/manager/dealers", icon: Users, label: "Dealers" },
    { path: "/m/manager/more", icon: MoreHorizontal, label: "More" },
  ],
  sales: [
    { path: "/m/sales/home", icon: Home, label: "Home" },
    { path: "/m/sales/orders", icon: ShoppingCart, label: "Orders" },
    { path: "/m/sales/invoices", icon: FileText, label: "Invoices" },
    { path: "/m/sales/dealers", icon: Users, label: "Dealers" },
    { path: "/m/sales/more", icon: MoreHorizontal, label: "More" },
  ],
  admin: [
    { path: "/m/admin/home", icon: Home, label: "Home" },
    { path: "/m/admin/approvals", icon: ShieldCheck, label: "Approvals" },
    { path: "/m/admin/reports", icon: BarChart3, label: "Reports" },
    { path: "/m/admin/dealers", icon: Users, label: "Dealers" },
    { path: "/m/admin/more", icon: MoreHorizontal, label: "More" },
  ],
};

function shellFromPath(pathname: string, fallback: MobileShell): MobileShell {
  const m = pathname.match(/^\/m\/(admin|manager|sales|fieldops)(\/|$)/);
  return (m?.[1] as MobileShell) || fallback;
}

export function MobileLayout({ children, title }: { children: ReactNode; title?: string }) {
  const location = useLocation();
  const { signOut, profile, userRoles } = useAuth();
  const userShell = getMobileShell(userRoles);
  const shell = shellFromPath(location.pathname, userShell);
  const navItems = NAV_BY_SHELL[shell];

  const shellLabel: Record<MobileShell, string> = {
    admin: "Admin",
    manager: "Manager",
    sales: "Sales",
    fieldops: "Field Ops",
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_hsl(var(--accent))_0%,_hsl(var(--background))_52%)]">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
              <img src="/raizechem-field-logo.png" alt="RaizeChem" className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{title || shellLabel[shell]}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.full_name || "RaizeChem"} · {shellLabel[shell]}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="rounded-full border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 pb-24">{children}</main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 mx-3 mb-3 rounded-3xl border border-border bg-background/96 px-1 py-2 shadow-lg backdrop-blur">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] transition-colors",
                  isActive ? "bg-accent text-primary font-semibold" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
