export type AppRole = "admin" | "manager" | "sales" | "warehouse" | "accounts" | "inventory" | "fieldops";

// Module access rules (overlapping)
export const MODULE_ACCESS: Record<string, AppRole[]> = {
  dashboard: ["admin", "manager", "sales", "warehouse", "accounts", "inventory"],
  masters: ["admin", "manager", "sales", "inventory"],
  inventory: ["admin", "inventory", "warehouse"],
  sales: ["admin", "manager", "sales", "inventory"],
  purchase: ["admin", "inventory", "warehouse"],
  finance: ["admin", "accounts", "sales", "manager"],
  settings: ["admin"],
  reports: ["admin", "manager", "accounts", "sales", "inventory"],
  hr: ["admin"],
  fieldops: ["admin", "manager", "accounts", "sales"],
  approvals: ["admin", "manager", "accounts", "sales", "inventory", "warehouse"],
};

// Priority for choosing the primary role (drives mobile shell selection).
const ROLE_PRIORITY: AppRole[] = [
  "admin",
  "manager",
  "sales",
  "accounts",
  "warehouse",
  "inventory",
  "fieldops",
];

export type MobileShell = "admin" | "manager" | "sales" | "fieldops";

export function getPrimaryRole(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return null;
}

export function getMobileShell(_roles: AppRole[]): MobileShell {
  // Mobile app is restricted to Field Ops only. All other roles use web.
  return "fieldops";
}
