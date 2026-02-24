import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function MobileGuard({ children }: { children: ReactNode }) {
  const { session, userRoles, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/m/login" replace />;

  const hasSalesOrAdmin = userRoles.some(r => r === "sales" || r === "admin");
  if (!hasSalesOrAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">Only sales employees can access the mobile app.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
