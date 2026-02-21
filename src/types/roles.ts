export type AppRole = "admin" | "sales" | "warehouse" | "accounts" | "inventory";

// Module access rules (overlapping)
export const MODULE_ACCESS: Record<string, AppRole[]> = {
  dashboard: ["admin", "sales", "warehouse", "accounts", "inventory"],
  masters: ["admin", "sales"],
  inventory: ["admin", "inventory", "warehouse"],
  sales: ["admin", "sales", "inventory"], // inventory can view orders
  finance: ["admin", "accounts", "sales"], // sales can view invoices
  settings: ["admin"],
  reports: ["admin", "accounts", "sales", "inventory"],
};
