import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Users, Package, Boxes, ShoppingCart, FileText,
  CreditCard, BookOpen, Wallet, BarChart3, UserCheck, Radio, HelpCircle,
  Calculator, Truck, ArrowRight,
} from "lucide-react";

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <Card className="mb-4">
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground space-y-2">{children}</CardContent>
  </Card>
);

const Formula = ({ label, formula }: { label: string; formula: string }) => (
  <div className="flex flex-wrap items-center gap-2 py-1">
    <Badge variant="outline" className="font-medium text-foreground">{label}</Badge>
    <ArrowRight className="h-3 w-3 text-muted-foreground" />
    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{formula}</code>
  </div>
);

export default function HelpDocs() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Help & Documentation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete guide to features, workflows, and calculation logic used across the application.
          </p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="masters">Masters</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="purchase">Purchase</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
            <TabsTrigger value="gst">GST & Tax</TabsTrigger>
            <TabsTrigger value="hr">HR & Payroll</TabsTrigger>
            <TabsTrigger value="fieldops">Field Ops</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview">
            <Section icon={LayoutDashboard} title="Application Overview">
              <p>
                This is a full-featured distribution management system designed for chemical / FMCG distributors.
                It covers the complete cycle from purchase to sales, inventory, payments, GST compliance, payroll, and field operations.
              </p>
              <p><strong>Roles:</strong> admin, accounts, sales, inventory, hr, field_ops. Each role has access to specific modules configured via role-based access control (RBAC).</p>
              <p><strong>Financial Year:</strong> All transactions are scoped to the active financial year (April–March). Opening balances carry forward when a new year is activated.</p>
            </Section>
            <Section icon={Calculator} title="Core Calculation Principles">
              <p>All monetary values are rounded to 2 decimal places. GST split uses floor for CGST and remainder for SGST to ensure totals match exactly.</p>
              <Formula label="Rounding" formula="Math.round(value × 100) / 100" />
              <Formula label="GST Split (Intra)" formula="CGST = floor(gst / 2 × 100) / 100; SGST = gst − CGST" />
            </Section>
          </TabsContent>

          {/* ── Masters ── */}
          <TabsContent value="masters">
            <Section icon={Users} title="Dealers">
              <p>Dealers are your customers. Each dealer has billing & shipping addresses, GST details (auto-fetched via GSTIN lookup), credit limit, payment terms, price level, and preferred transporter.</p>
              <p><strong>GST Auto-Fetch:</strong> Enter a 15-digit GSTIN → system calls the verification API → populates legal name, trade name, address, registration date, and status automatically.</p>
              <p><strong>State Code:</strong> First 2 digits of GSTIN determine the state code, which drives Intra/Inter-state GST calculation.</p>
              <p><strong>Credit Limit:</strong> Soft limit — system warns but does not block orders when exceeded.</p>
            </Section>
            <Section icon={Truck} title="Suppliers">
              <p>Suppliers are your vendors. Same structure as dealers with GST verification. Used in purchase orders and purchase invoices.</p>
            </Section>
            <Section icon={Package} title="Products">
              <p>Each product has: name, HSN code, GST rate (%), unit, category, sale price, purchase price, and minimum stock alert quantity.</p>
              <p><strong>Price Levels:</strong> Multiple price tiers (e.g., Retail, Wholesale, Distributor). Each dealer is assigned a price level. During order/invoice creation, the system auto-picks the rate from the dealer's assigned price level.</p>
            </Section>
            <Section icon={Truck} title="Transporters">
              <p>Transport partners with GST details, contact info, and vehicle types. Linked to dealers as "Preferred Transporter" for auto-fill on invoices and e-way bills.</p>
            </Section>
          </TabsContent>

          {/* ── Inventory ── */}
          <TabsContent value="inventory">
            <Section icon={Boxes} title="Batches & Stock">
              <p>Every product unit is tracked via batches. Each batch has: batch number, manufacturing date, expiry date, purchase rate, and current quantity.</p>
              <Formula label="Current Qty" formula="SUM(qty_in) − SUM(qty_out) from inventory_txn for that batch" />
              <p><strong>Stock In:</strong> Manual stock entry creates an inventory transaction (type: STOCK_IN) increasing the batch quantity.</p>
              <p><strong>Alerts:</strong> Products where current total stock falls below <code>min_stock_alert_qty</code> appear in the alerts page.</p>
            </Section>
            <Section icon={Boxes} title="Inventory Transactions">
              <p>Every stock movement is recorded as an inventory transaction with type:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>STOCK_IN:</strong> Manual stock addition</li>
                <li><strong>PURCHASE:</strong> From purchase invoice confirmation</li>
                <li><strong>SALE:</strong> From sales invoice confirmation (qty_out)</li>
                <li><strong>SALE_RETURN:</strong> Credit note increases stock back</li>
                <li><strong>PURCHASE_RETURN:</strong> Debit note decreases stock</li>
              </ul>
            </Section>
          </TabsContent>

          {/* ── Sales ── */}
          <TabsContent value="sales">
            <Section icon={ShoppingCart} title="Sales Orders">
              <p>Orders are booking requests from dealers. They don't affect inventory or ledger. Status flow:</p>
              <p><Badge variant="outline">Draft</Badge> → <Badge variant="outline">Confirmed</Badge> → <Badge variant="outline">Invoiced</Badge> / <Badge variant="outline">Cancelled</Badge></p>
              <Formula label="Order Total" formula="SUM(qty × rate) for all line items" />
              <p>Auto-numbering: ORD/{"{FY}"}/{"{seq}"} using company_settings.next_order_number with concurrency-safe SELECT FOR UPDATE.</p>
            </Section>
            <Section icon={FileText} title="Sales Invoices">
              <p>Invoices are the core financial document. Creating an invoice:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Picks batch (FIFO or manual), deducts inventory</li>
                <li>Calculates GST per line item based on dealer's state code</li>
                <li>Creates ledger DEBIT entry for the dealer</li>
                <li>Updates order status to "Invoiced" if linked</li>
              </ol>
              <Formula label="Line Amount" formula="qty × rate" />
              <Formula label="GST Amount" formula="line_amount × gst_rate / 100" />
              <Formula label="Intra-state" formula="CGST = GST/2, SGST = GST/2 (dealer state = company state)" />
              <Formula label="Inter-state" formula="IGST = full GST amount (dealer state ≠ company state)" />
              <Formula label="Invoice Total" formula="SUM(line_amount + line_gst) = subtotal + cgst_total + sgst_total + igst_total" />
              <p><strong>Due Date:</strong> invoice_date + dealer.payment_terms_days (default 30).</p>
            </Section>
            <Section icon={FileText} title="Sales Returns (Credit Notes)">
              <p>Credit notes reverse a sale partially or fully. They:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Increase batch stock (SALE_RETURN inventory txn)</li>
                <li>Create ledger CREDIT entry for the dealer</li>
                <li>Reduce the outstanding balance</li>
              </ul>
              <p>Numbering: CN/{"{FY}"}/{"{seq}"}</p>
            </Section>
          </TabsContent>

          {/* ── Purchase ── */}
          <TabsContent value="purchase">
            <Section icon={ShoppingCart} title="Purchase Orders">
              <p>POs are placed to suppliers. Similar structure to sales orders but for procurement.</p>
              <p>Numbering: PO/{"{FY}"}/{"{seq}"}</p>
            </Section>
            <Section icon={FileText} title="Purchase Invoices">
              <p>Recording a supplier invoice:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Increases batch stock (PURCHASE inventory txn)</li>
                <li>Creates supplier ledger CREDIT entry</li>
                <li>GST calculation same as sales but with supplier's state code</li>
              </ul>
            </Section>
            <Section icon={FileText} title="Purchase Returns (Debit Notes)">
              <p>Debit notes reverse a purchase. They decrease stock and create supplier ledger DEBIT entry.</p>
              <p>Numbering: DN/{"{FY}"}/{"{seq}"}</p>
            </Section>
          </TabsContent>

          {/* ── Finance ── */}
          <TabsContent value="finance">
            <Section icon={BookOpen} title="Dealer Ledger">
              <p>Every financial event creates a ledger entry for the dealer:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Invoice → DEBIT</strong> (dealer owes money)</li>
                <li><strong>Payment → CREDIT</strong> (dealer paid)</li>
                <li><strong>Credit Note → CREDIT</strong> (return reduces balance)</li>
                <li><strong>Advance Receipt → CREDIT</strong> (advance payment)</li>
                <li><strong>Advance Adjust → DEBIT</strong> (advance used against invoice)</li>
              </ul>
              <Formula label="Outstanding" formula="SUM(debit) − SUM(credit) for a dealer" />
            </Section>
            <Section icon={CreditCard} title="Payments & TDS/TCS">
              <p>Payments from dealers support TDS and TCS deductions:</p>
              <Formula label="Net Amount" formula="amount − tds_amount + tcs_amount" />
              <Formula label="TDS Amount" formula="amount × tds_rate / 100" />
              <Formula label="TCS Amount" formula="amount × tcs_rate / 100" />
              <p><strong>Payment Allocation:</strong> Each payment can be allocated against specific invoices. The invoice's <code>amount_paid</code> is updated accordingly.</p>
              <p><strong>Void:</strong> Voiding a payment reverses the ledger entry and resets allocated invoice amounts.</p>
            </Section>
            <Section icon={Wallet} title="Advance Receipts">
              <p>Tally-style advance collections from dealers before invoicing:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li><strong>Create:</strong> Record advance → creates ledger CREDIT → status OPEN</li>
                <li><strong>Allocate:</strong> During invoice creation, available advances are shown. FIFO allocation (oldest first) adjusts the advance against the invoice.</li>
                <li><strong>Void:</strong> Only if no allocations exist. Reverses ledger entry.</li>
              </ol>
              <Formula label="Balance Amount" formula="gross_amount − adjusted_amount" />
              <Formula label="After Allocation" formula="adjusted_amount += allocated; balance_amount -= allocated" />
              <p>Status transitions: <Badge variant="outline">OPEN</Badge> → <Badge variant="outline">ADJUSTED</Badge> (when balance = 0) or <Badge variant="outline">VOID</Badge></p>
              <p>Numbering: AR/{"{FY}"}/{"{seq}"}</p>
            </Section>
            <Section icon={BookOpen} title="Supplier Ledger & Payments">
              <p>Mirror of dealer finance but for suppliers. Purchase invoices create CREDIT entries; supplier payments create DEBIT entries.</p>
              <Formula label="Supplier Outstanding" formula="SUM(credit) − SUM(debit) for a supplier" />
            </Section>
            <Section icon={CreditCard} title="Outstanding & Aging">
              <p>Outstanding aging buckets invoices by days overdue:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Current (not yet due)</li>
                <li>1–30 days overdue</li>
                <li>31–60 days overdue</li>
                <li>61–90 days overdue</li>
                <li>90+ days overdue</li>
              </ul>
              <Formula label="Days Overdue" formula="today − due_date (if positive)" />
              <Formula label="Invoice Balance" formula="total_amount − amount_paid" />
            </Section>
          </TabsContent>

          {/* ── GST & Tax ── */}
          <TabsContent value="gst">
            <Section icon={Calculator} title="GST Calculation Logic">
              <p>GST is calculated per line item on every invoice (sales & purchase):</p>
              <Formula label="Taxable Amount" formula="qty × rate" />
              <Formula label="GST Amount" formula="taxable_amount × gst_rate / 100" />
              <p><strong>Intra-State</strong> (dealer state code = company state code):</p>
              <Formula label="CGST" formula="floor(gst_amount / 2 × 100) / 100" />
              <Formula label="SGST" formula="gst_amount − CGST" />
              <p><strong>Inter-State</strong> (different state codes):</p>
              <Formula label="IGST" formula="Full GST amount" />
              <Formula label="Total with GST" formula="round((taxable_amount + gst_amount) × 100) / 100" />
              <p><strong>Company State Code:</strong> Configured in Settings → Company. Defaults to "36" (Telangana). The first 2 digits of company GSTIN determine this.</p>
            </Section>
            <Section icon={FileText} title="GST Summary Report">
              <p>Aggregates all invoices for a period showing:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Total taxable value by GST rate slab</li>
                <li>CGST, SGST, IGST breakdowns</li>
                <li>B2B vs B2C classification</li>
                <li>HSN-wise summary</li>
              </ul>
              <p>Export available in GSTR-1 compatible format.</p>
            </Section>
            <Section icon={Calculator} title="TDS / TCS">
              <p><strong>TDS (Tax Deducted at Source):</strong> Deducted by the dealer from payment. Reduces net amount received.</p>
              <p><strong>TCS (Tax Collected at Source):</strong> Collected on top of the sale amount when applicable (e.g., for sales above ₹50L threshold).</p>
              <Formula label="TDS" formula="payment_amount × tds_rate%" />
              <Formula label="TCS" formula="payment_amount × tcs_rate%" />
              <p>TDS/TCS report aggregates all payments with TDS/TCS for filing compliance.</p>
            </Section>
          </TabsContent>

          {/* ── HR ── */}
          <TabsContent value="hr">
            <Section icon={UserCheck} title="Employees">
              <p>Employee master stores: name, department, designation, date of joining, basic salary, PAN, UAN, bank account details.</p>
            </Section>
            <Section icon={Calculator} title="Salary Structure">
              <p>Salary components are defined as either <strong>Earnings</strong> or <strong>Deductions</strong>, each with a calculation type:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Fixed:</strong> A flat amount per month</li>
                <li><strong>Percentage of Basic:</strong> Calculated as a % of employee's basic salary</li>
              </ul>
              <Formula label="Component (Fixed)" formula="amount = defined fixed value" />
              <Formula label="Component (%)" formula="amount = basic_salary × percentage / 100" />
            </Section>
            <Section icon={Wallet} title="Payroll Processing">
              <p>Payroll runs are created for a month/year. Processing calculates for each active employee:</p>
              <Formula label="Gross" formula="basic + SUM(all earning components)" />
              <Formula label="Total Deductions" formula="SUM(all deduction components)" />
              <Formula label="Net Pay" formula="gross − total_deductions" />
              <p>Payslips are generated per employee with full earnings/deductions breakdown. Status: Draft → Processed → Paid.</p>
            </Section>
          </TabsContent>

          {/* ── Field Ops ── */}
          <TabsContent value="fieldops">
            <Section icon={Radio} title="Duty Sessions">
              <p>Field staff start a "duty session" when beginning their day. The session tracks:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Start/end time and location</li>
                <li>GPS tracking points throughout the day</li>
                <li>Total duration and kilometers traveled</li>
                <li>Incentive amount based on rules</li>
              </ul>
              <Formula label="Duration" formula="end_time − start_time (in minutes)" />
              <Formula label="Distance" formula="Haversine formula between consecutive GPS points" />
            </Section>
            <Section icon={Users} title="Dealer Visits">
              <p>Field staff check in at a dealer location (GPS captured). They can add notes, take photos, and create field orders or collect payments during the visit.</p>
            </Section>
            <Section icon={ShoppingCart} title="Field Orders & Payments">
              <p><strong>Field Orders:</strong> Placed by field staff on behalf of dealers. These go through approval workflow: Pending → Approved (converts to sales order) or Rejected.</p>
              <p><strong>Field Payments:</strong> Cash/cheque collections recorded in the field with photo proof. Status: Pending → Verified → Rejected.</p>
            </Section>
            <Section icon={Calculator} title="Incentive Rules">
              <p>Configurable incentive rules for field staff:</p>
              <Formula label="KM Incentive" formula="(total_km − min_km_threshold) × per_km_rate (if total_km > threshold)" />
              <Formula label="Order Bonus" formula="number_of_orders × per_order_bonus" />
              <Formula label="Total Incentive" formula="km_incentive + order_bonus" />
            </Section>
          </TabsContent>

          {/* ── Reports ── */}
          <TabsContent value="reports">
            <Section icon={BarChart3} title="Sales Register">
              <p>Lists all sales invoices for a date range with dealer, subtotal, GST breakdowns, and total. Exportable to CSV/Excel.</p>
            </Section>
            <Section icon={BarChart3} title="Purchase Register">
              <p>Lists all purchase invoices for a date range with supplier details and GST breakdowns.</p>
            </Section>
            <Section icon={BarChart3} title="Outstanding Aging">
              <p>Shows dealer-wise outstanding balances bucketed by days overdue (current, 1–30, 31–60, 61–90, 90+).</p>
            </Section>
            <Section icon={Boxes} title="Batch Stock Report">
              <p>Shows current stock per product per batch with manufacturing/expiry dates and purchase rates.</p>
            </Section>
            <Section icon={BarChart3} title="Price Matrix">
              <p>Cross-tabular view of all products × all price levels showing the configured rate for each combination.</p>
            </Section>
          </TabsContent>

          {/* ── Settings ── */}
          <TabsContent value="settings">
            <Section icon={LayoutDashboard} title="Company Settings">
              <p>Configure: company name, legal name, GSTIN, PAN, address, bank details, invoice template, and auto-numbering sequences for orders, invoices, credit notes, debit notes, POs, and advance receipts.</p>
            </Section>
            <Section icon={Users} title="User Management">
              <p>Admin creates users with email/password and assigns roles. Roles control module access:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>admin:</strong> Full access to all modules</li>
                <li><strong>accounts:</strong> Finance, reports, masters</li>
                <li><strong>sales:</strong> Sales, masters (read), finance (read)</li>
                <li><strong>inventory:</strong> Inventory management</li>
                <li><strong>hr:</strong> HR & Payroll</li>
                <li><strong>field_ops:</strong> Mobile field operations</li>
              </ul>
            </Section>
            <Section icon={BookOpen} title="Financial Years & Opening Balances">
              <p><strong>Financial Years:</strong> Define FY periods (April–March). Only one can be active at a time. Closing a year prevents new transactions.</p>
              <p><strong>Opening Balances:</strong> Set dealer/supplier opening debit/credit balances for a financial year. These are the starting point for ledger calculations.</p>
            </Section>
            <Section icon={FileText} title="Audit Logs">
              <p>Every create, update, delete, void, and allocate action is logged with: actor, timestamp, table, record ID, old data, and new data. Filterable by action, table, and date range.</p>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
