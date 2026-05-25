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

export function getMobileShell(roles: AppRole[]): MobileShell {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("sales")) return "sales";
  if (roles.includes("fieldops")) return "fieldops";
  // warehouse / accounts / inventory → admin shell (read-only-ish via MoreMenu)
  return "admin";
}
