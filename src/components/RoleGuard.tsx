import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types/roles";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AppRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  // Auth bypass — login system temporarily disabled
  return <>{children}</>;
}
