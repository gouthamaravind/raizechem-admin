import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types/roles";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AppRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { userRoles, loading } = useAuth();

  if (loading) return null;

  const hasAccess = userRoles.some((r) => allowedRoles.includes(r));
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
