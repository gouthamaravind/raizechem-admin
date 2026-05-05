import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, MapPin, ShoppingCart, CreditCard, Users, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/m/home", icon: Home, label: "Home" },
  { path: "/m/duty", icon: MapPin, label: "Duty" },
  { path: "/m/dealers", icon: Users, label: "Dealers" },
  { path: "/m/orders", icon: ShoppingCart, label: "Orders" },
  { path: "/m/payments", icon: CreditCard, label: "Payments" },
];

export function MobileLayout({ children, title }: { children: ReactNode; title?: string }) {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_hsl(var(--accent))_0%,_hsl(var(--background))_52%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
              <img src="/raizechem-field-logo.png" alt="RaizeChem" className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{title || "Field Sales"}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.full_name || "RaizeChem Field"}
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 mx-3 mb-3 rounded-3xl border border-border bg-background/96 px-1 py-2 shadow-lg backdrop-blur">
        <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "bg-accent text-primary font-semibold"
                  : "text-muted-foreground"
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
