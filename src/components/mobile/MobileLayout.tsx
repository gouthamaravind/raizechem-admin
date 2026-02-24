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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-lg font-semibold">{title || "Field Sales"}</h1>
          {profile && <p className="text-xs opacity-80">{profile.full_name}</p>}
        </div>
        <button onClick={signOut} className="p-2 rounded-full hover:bg-primary/80 transition-colors">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 py-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex justify-around py-2 px-1 safe-bottom">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs transition-colors min-w-[56px]",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
