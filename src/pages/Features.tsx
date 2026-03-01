import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, FileText, RotateCcw,
  BookOpen, CreditCard, Banknote, BarChart3, TrendingDown, Receipt, Truck,
  UserCheck, Calculator, Wallet, Radio, MapPinned, ScrollText, Building2,
  UserCog, CalendarDays, AlertTriangle, ArrowDownToLine, WarehouseIcon,
  Combine, Scale, PieChart, Sheet, Grid3X3, Landmark, ClipboardCheck,
  BadgeCheck, HelpCircle, Shield, Smartphone, Globe, Zap, ChevronRight,
  ArrowLeft, type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FeatureModule {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  features: { name: string; icon: LucideIcon; desc: string }[];
}

const modules: FeatureModule[] = [
  {
    title: "Masters",
    description: "Central data hub for dealers, suppliers, products, pricing & transport partners.",
    icon: Users,
    color: "from-primary/20 to-accent",
    features: [
      { name: "Dealer Management", icon: Users, desc: "Full dealer profiles with GST verification, credit limits & payment terms." },
      { name: "Supplier Management", icon: Truck, desc: "Track suppliers with purchase history, outstanding & contact details." },
      { name: "Product Catalog", icon: Package, desc: "Products with HSN codes, GST rates, units & multi-level pricing." },
      { name: "Price Levels", icon: Receipt, desc: "Tiered pricing structures for different dealer categories." },
      { name: "Transporters", icon: Truck, desc: "Manage transport partners for dispatch and e-way bill generation." },
    ],
  },
  {
    title: "Inventory",
    description: "End-to-end inventory control with batch tracking, warehousing & BOM.",
    icon: Boxes,
    color: "from-chart-1/20 to-chart-2/10",
    features: [
      { name: "Batch Tracking", icon: Boxes, desc: "Track every batch with manufacture/expiry dates and current stock." },
      { name: "Stock In", icon: ArrowDownToLine, desc: "Record stock receipts against purchase invoices or standalone." },
      { name: "Warehouses & Bins", icon: WarehouseIcon, desc: "Multi-godown support with bin locations for precise stock placement." },
      { name: "Stock Transfers", icon: Truck, desc: "Inter-warehouse transfers with Draft → In Transit → Received workflow." },
      { name: "Low Stock Alerts", icon: AlertTriangle, desc: "Automatic alerts when batch quantities fall below reorder levels." },
      { name: "Bill of Materials", icon: Combine, desc: "Define raw material recipes for manufactured products." },
    ],
  },
  {
    title: "Sales",
    description: "Complete sales cycle from order booking to invoicing and returns.",
    icon: ShoppingCart,
    color: "from-chart-3/20 to-chart-1/10",
    features: [
      { name: "Sales Orders", icon: ShoppingCart, desc: "Create, approve and track orders with automatic pricing lookups." },
      { name: "Tax Invoices", icon: FileText, desc: "GST-compliant invoices with auto-calculated CGST/SGST/IGST." },
      { name: "Credit Notes", icon: RotateCcw, desc: "Process returns with inventory reversal and ledger adjustments." },
    ],
  },
  {
    title: "Purchase",
    description: "Streamlined procurement with purchase orders, invoices & debit notes.",
    icon: FileText,
    color: "from-chart-4/20 to-chart-2/10",
    features: [
      { name: "Purchase Orders", icon: FileText, desc: "Raise POs against suppliers with approval workflows." },
      { name: "Purchase Invoices", icon: FileText, desc: "Record supplier invoices and auto-create stock-in entries." },
      { name: "Debit Notes", icon: RotateCcw, desc: "Handle purchase returns with supplier ledger adjustments." },
    ],
  },
  {
    title: "Finance",
    description: "Double-entry accounting with dealer/supplier ledgers, payments & vouchers.",
    icon: Banknote,
    color: "from-warning/20 to-chart-4/10",
    features: [
      { name: "Dealer Ledger", icon: BookOpen, desc: "Complete transaction history per dealer with running balance." },
      { name: "Dealer Outstanding", icon: CreditCard, desc: "Real-time outstanding with aging analysis and overdue alerts." },
      { name: "Payments & Receipts", icon: Banknote, desc: "Record payments with TDS/TCS and multi-invoice allocation." },
      { name: "Supplier Accounts", icon: BookOpen, desc: "Supplier ledger, outstanding tracking & payment management." },
      { name: "Advance Receipts", icon: Wallet, desc: "Accept advance payments and allocate against future invoices." },
      { name: "Journal Vouchers", icon: ScrollText, desc: "Double-entry journal entries for adjustments & provisions." },
      { name: "Contra Vouchers", icon: ScrollText, desc: "Cash ↔ Bank transfer entries with restricted account selection." },
    ],
  },
  {
    title: "Reports",
    description: "Comprehensive MIS reports for sales, purchases, stock & financials.",
    icon: BarChart3,
    color: "from-primary/15 to-chart-3/10",
    features: [
      { name: "Sales Register", icon: BarChart3, desc: "Detailed sales report with filters by date, dealer & product." },
      { name: "Purchase Register", icon: BarChart3, desc: "Purchase analysis with supplier-wise and product-wise breakdowns." },
      { name: "Outstanding Aging", icon: TrendingDown, desc: "Aging buckets (0-30, 31-60, 61-90, 90+) for receivables." },
      { name: "Trial Balance", icon: Scale, desc: "Debit/credit summary across all ledger accounts." },
      { name: "Profit & Loss", icon: PieChart, desc: "Income vs expenses with gross and net profit calculation." },
      { name: "Balance Sheet", icon: Sheet, desc: "Assets, liabilities & equity snapshot at any date." },
      { name: "GST Summary", icon: Receipt, desc: "GSTR-1 and GSTR-3B ready summaries with HSN breakdowns." },
      { name: "Stock Summary", icon: WarehouseIcon, desc: "Warehouse-wise stock valuation with batch details." },
      { name: "Price Matrix", icon: Grid3X3, desc: "Cross-reference pricing across products and price levels." },
    ],
  },
  {
    title: "HR & Payroll",
    description: "Employee management with salary structures, payroll runs & payslips.",
    icon: UserCheck,
    color: "from-chart-2/20 to-chart-4/10",
    features: [
      { name: "Employee Directory", icon: UserCheck, desc: "Manage employee profiles, departments & designations." },
      { name: "Salary Structure", icon: Calculator, desc: "Define earning & deduction components with formulas." },
      { name: "Payroll Processing", icon: Wallet, desc: "Monthly payroll runs with automatic calculations." },
      { name: "Payslips", icon: FileText, desc: "Generate and print formatted payslips for employees." },
    ],
  },
  {
    title: "Field Operations",
    description: "GPS-tracked field sales with duty sessions, dealer visits & mobile orders.",
    icon: Radio,
    color: "from-destructive/15 to-warning/10",
    features: [
      { name: "Duty Sessions", icon: Radio, desc: "Track field staff on/off duty with GPS location logging." },
      { name: "Dealer Visits", icon: MapPinned, desc: "Check-in/check-out at dealer locations with photo proof." },
      { name: "Field Orders", icon: ClipboardCheck, desc: "Capture orders on-the-go with offline support." },
      { name: "Field Payments", icon: BadgeCheck, desc: "Record collections in the field with receipt attachments." },
    ],
  },
  {
    title: "Settings & Admin",
    description: "Company configuration, user roles, financial years & audit trail.",
    icon: Building2,
    color: "from-muted to-muted/50",
    features: [
      { name: "Company Profile", icon: Building2, desc: "GST details, bank info, invoice series & templates." },
      { name: "User Management", icon: UserCog, desc: "Role-based access control with granular module permissions." },
      { name: "Financial Years", icon: CalendarDays, desc: "Multi-year support with year-end closing workflows." },
      { name: "Opening Balances", icon: Landmark, desc: "Set opening balances for dealers & suppliers per FY." },
      { name: "Audit Logs", icon: ScrollText, desc: "Complete audit trail of all create, update & delete actions." },
    ],
  },
];

const highlights = [
  { icon: Shield, title: "Role-Based Access", desc: "Admin, Manager, Accountant, Viewer & Field roles with module-level permissions." },
  { icon: Smartphone, title: "Mobile-First Field App", desc: "Dedicated mobile interface for field staff with offline-capable workflows." },
  { icon: Globe, title: "GST Compliant", desc: "Built for Indian GST with auto-tax calculation, HSN codes & return-ready reports." },
  { icon: Zap, title: "Real-Time Sync", desc: "Live data updates across all users with instant reflection of changes." },
];

export default function Features() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <img src="/favicon.svg" alt="Raizechem" className="w-5 h-5" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Raizechem</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-6">
            <Zap className="h-3.5 w-3.5" />
            All-in-One Business Platform
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
            Everything you need to
            <br />
            <span className="text-primary">run your business</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            From inventory and invoicing to field operations and financial reporting — 
            Raizechem brings every aspect of your agro-chemical business into one powerful platform.
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {highlights.map((h) => (
            <div key={h.title} className="group rounded-2xl border border-border/50 bg-card p-6 backdrop-blur-sm hover:shadow-md transition-all duration-300">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                <h.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">{h.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="space-y-20">
          {modules.map((mod, idx) => (
            <div key={mod.title} className={cn("flex flex-col gap-8", idx % 2 === 1 && "lg:flex-row-reverse")}>
              {/* Module header card */}
              <div className="lg:w-2/5 flex-shrink-0">
                <div className={cn("sticky top-24 rounded-3xl bg-gradient-to-br p-8", mod.color)}>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-background/80 text-foreground shadow-sm">
                    <mod.icon className="h-6 w-6" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-foreground">{mod.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                    {mod.features.length} features
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </div>

              {/* Feature cards */}
              <div className="lg:w-3/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mod.features.map((f) => (
                  <div
                    key={f.name}
                    className="group rounded-2xl border border-border/50 bg-card p-5 backdrop-blur-sm hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{f.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50 bg-gradient-to-b from-accent/30 to-background">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground">Ready to get started?</h2>
          <p className="mt-3 text-muted-foreground">Sign in to explore all features in your dashboard.</p>
          <Link
            to="/dashboard"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Raizechem. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
