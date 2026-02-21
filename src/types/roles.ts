export type AppRole = "admin" | "sales" | "warehouse" | "accounts" | "inventory";

// Module access rules (overlapping)
export const MODULE_ACCESS: Record<string, AppRole[]> = {
  dashboard: ["admin", "sales", "warehouse", "accounts", "inventory"],
  masters: ["admin", "sales", "inventory"],
  inventory: ["admin", "inventory", "warehouse"],
  sales: ["admin", "sales", "inventory"],
  purchase: ["admin", "inventory", "warehouse"],
  finance: ["admin", "accounts", "sales"],
  settings: ["admin"],
  reports: ["admin", "accounts", "sales", "inventory"],
  hr: ["admin"],
};
