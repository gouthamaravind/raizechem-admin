// Client-side mock data for demo mode — never hits the database

export const MOCK_DASHBOARD = {
  todayOrders: 7,
  pendingAmount: 156400,
  lowStockCount: 3,
  monthlyRevenue: 489200,
  totalDealers: 12,
  totalProducts: 24,
  recentOrders: [
    { id: "m1", order_number: "ORD-2026-012", order_date: "2026-02-21", total_amount: 45000, status: "confirmed", dealers: { name: "Mehta Chemicals Ltd" } },
    { id: "m2", order_number: "ORD-2026-011", order_date: "2026-02-21", total_amount: 32800, status: "dispatched", dealers: { name: "Patel Distributors" } },
    { id: "m3", order_number: "ORD-2026-010", order_date: "2026-02-20", total_amount: 78500, status: "delivered", dealers: { name: "Singh Trading Co" } },
    { id: "m4", order_number: "ORD-2026-009", order_date: "2026-02-20", total_amount: 19200, status: "draft", dealers: { name: "Kumar Enterprises" } },
    { id: "m5", order_number: "ORD-2026-008", order_date: "2026-02-19", total_amount: 56700, status: "confirmed", dealers: { name: "Sharma Pharma Pvt Ltd" } },
  ],
  topProducts: [
    { name: "Sodium Hydroxide", qty: 2400, amount: 132000 },
    { name: "Hydrochloric Acid", qty: 1800, amount: 81000 },
    { name: "Isopropyl Alcohol", qty: 650, amount: 78000 },
    { name: "Citric Acid", qty: 500, amount: 47500 },
    { name: "Sulphuric Acid", qty: 900, amount: 34200 },
  ],
};

export const MOCK_DEALERS = [
  { id: "d1", name: "Mehta Chemicals Ltd", gst_number: "36AABCM1234A1Z5", city: "Hyderabad", state: "Telangana", state_code: "36", phone: "+91 98765 43210", credit_limit: 500000, status: "active" },
  { id: "d2", name: "Patel Distributors", gst_number: "27AABCP5678B1Z3", city: "Mumbai", state: "Maharashtra", state_code: "27", phone: "+91 87654 32109", credit_limit: 300000, status: "active" },
  { id: "d3", name: "Kumar Enterprises", gst_number: "29AABCK9012C1Z1", city: "Bangalore", state: "Karnataka", state_code: "29", phone: "+91 76543 21098", credit_limit: 200000, status: "active" },
  { id: "d4", name: "Singh Trading Co", gst_number: "07AABCS3456D1Z9", city: "New Delhi", state: "Delhi", state_code: "07", phone: "+91 65432 10987", credit_limit: 400000, status: "active" },
  { id: "d5", name: "Sharma Pharma Pvt Ltd", gst_number: "36AABCS7890E1Z7", city: "Hyderabad", state: "Telangana", state_code: "36", phone: "+91 54321 09876", credit_limit: 600000, status: "active" },
  { id: "d6", name: "Gupta Chemicals", gst_number: "09AABCG1122F1Z4", city: "Lucknow", state: "Uttar Pradesh", state_code: "09", phone: "+91 91234 56789", credit_limit: 250000, status: "active" },
];

export const MOCK_PRODUCTS = [
  { id: "p1", name: "Hydrochloric Acid 35%", hsn_code: "28061000", unit: "KG", gst_rate: 18, category: "Acids", sale_price: 45, purchase_price_default: 32, min_stock_alert_qty: 100, is_active: true },
  { id: "p2", name: "Sodium Hydroxide Flakes", hsn_code: "28151100", unit: "KG", gst_rate: 18, category: "Alkalis", sale_price: 55, purchase_price_default: 40, min_stock_alert_qty: 200, is_active: true },
  { id: "p3", name: "Sulphuric Acid 98%", hsn_code: "28070010", unit: "KG", gst_rate: 18, category: "Acids", sale_price: 38, purchase_price_default: 25, min_stock_alert_qty: 150, is_active: true },
  { id: "p4", name: "Calcium Carbonate Powder", hsn_code: "28365000", unit: "KG", gst_rate: 12, category: "Powders", sale_price: 22, purchase_price_default: 15, min_stock_alert_qty: 300, is_active: true },
  { id: "p5", name: "Isopropyl Alcohol 99%", hsn_code: "29051200", unit: "LTR", gst_rate: 18, category: "Solvents", sale_price: 120, purchase_price_default: 85, min_stock_alert_qty: 50, is_active: true },
  { id: "p6", name: "Citric Acid Monohydrate", hsn_code: "29181400", unit: "KG", gst_rate: 18, category: "Acids", sale_price: 95, purchase_price_default: 72, min_stock_alert_qty: 100, is_active: true },
  { id: "p7", name: "Toluene Technical Grade", hsn_code: "29023000", unit: "LTR", gst_rate: 18, category: "Solvents", sale_price: 78, purchase_price_default: 58, min_stock_alert_qty: 80, is_active: true },
  { id: "p8", name: "Zinc Oxide 99.5%", hsn_code: "28170010", unit: "KG", gst_rate: 18, category: "Oxides", sale_price: 165, purchase_price_default: 130, min_stock_alert_qty: 50, is_active: true },
];

export const MOCK_SUPPLIERS = [
  { id: "s1", name: "Gujarat Chemicals Corp", gst_number: "24AABCG1111A1Z5", city: "Ahmedabad", state: "Gujarat", state_code: "24", phone: "+91 98111 22233", payment_terms_days: 30, status: "active" },
  { id: "s2", name: "Andhra Raw Materials Ltd", gst_number: "37AABCA2222B1Z3", city: "Visakhapatnam", state: "Andhra Pradesh", state_code: "37", phone: "+91 87222 33344", payment_terms_days: 45, status: "active" },
  { id: "s3", name: "Tamil Nadu Solvents Pvt", gst_number: "33AABCT3333C1Z1", city: "Chennai", state: "Tamil Nadu", state_code: "33", phone: "+91 76333 44455", payment_terms_days: 30, status: "active" },
];

export const MOCK_EMPLOYEES = [
  { id: "e1", name: "Ramesh Iyer", designation: "Senior Chemist", department: "Production", basic_salary: 35000, pan: "ABCDE1234F", phone: "+91 98765 11111", status: "active" },
  { id: "e2", name: "Priya Nair", designation: "Accounts Manager", department: "Finance", basic_salary: 40000, pan: "FGHIJ5678K", phone: "+91 98765 22222", status: "active" },
  { id: "e3", name: "Sunil Verma", designation: "Warehouse Supervisor", department: "Operations", basic_salary: 28000, pan: "KLMNO9012P", phone: "+91 98765 33333", status: "active" },
  { id: "e4", name: "Deepa Krishnan", designation: "Sales Executive", department: "Sales", basic_salary: 30000, pan: "QRSTU3456V", phone: "+91 98765 44444", status: "active" },
  { id: "e5", name: "Arjun Reddy", designation: "Lab Technician", department: "QC", basic_salary: 25000, pan: "WXYZ07890A", phone: "+91 98765 55555", status: "active" },
];
