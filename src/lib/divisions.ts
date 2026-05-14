// Telangana sales divisions used for dealer territory mapping & field-ops assignment
export const DIVISIONS = [
  "SURYAPET",
  "MIRYALAGUDA",
  "KHAMMAM",
  "BHADRACHALAM",
  "WARANGAL",
  "PARKAL",
  "NARSAMPET",
  "NIZAMABAD",
  "ADILABAD",
  "MAHABUBNAGAR",
  "KARIMNAGAR",
  "SANGAREDDY",
  "SIDDIPET",
] as const;

export type Division = (typeof DIVISIONS)[number];
