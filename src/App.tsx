import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BranchProvider } from "@/hooks/useBranch";
import { MaintenanceMode } from "@/components/MaintenanceMode";
import { Capacitor } from "@capacitor/core";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { MODULE_ACCESS } from "@/types/roles";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Dealers from "./pages/masters/Dealers";
import Products from "./pages/masters/Products";
import Suppliers from "./pages/masters/Suppliers";
import PriceLevels from "./pages/masters/PriceLevels";
import Transporters from "./pages/masters/Transporters";
import Batches from "./pages/inventory/Batches";
import StockIn from "./pages/inventory/StockIn";
import Alerts from "./pages/inventory/Alerts";
import BOM from "./pages/inventory/BOM";
import WarehousesPage from "./pages/inventory/Warehouses";
import StockTransfersPage from "./pages/inventory/StockTransfers";
import PricingMatrixPage from "./pages/inventory/PricingMatrix";
import BulkPricingUpdate from "./pages/inventory/BulkPricingUpdate";
import Orders from "./pages/sales/Orders";
import Invoices from "./pages/sales/Invoices";
import InvoicePrint from "./pages/sales/InvoicePrint";
import EwayBillPrint from "./pages/sales/EwayBillPrint";
import Returns from "./pages/sales/Returns";
import BranchTransfers from "./pages/sales/BranchTransfers";
import PurchaseOrders from "./pages/purchase/Orders";
import PurchaseInvoices from "./pages/purchase/Invoices";
import PurchaseReturns from "./pages/purchase/Returns";
import Ledger from "./pages/finance/Ledger";
import Outstanding from "./pages/finance/Outstanding";
import Payments from "./pages/finance/Payments";
import SupplierLedger from "./pages/finance/SupplierLedger";
import SupplierOutstanding from "./pages/finance/SupplierOutstanding";
import SupplierPayments from "./pages/finance/SupplierPayments";
import Advances from "./pages/finance/Advances";
import Vouchers from "./pages/finance/Vouchers";
import CompanySettings from "./pages/settings/CompanySettings";
import UserManagement from "./pages/settings/UserManagement";
import FinancialYears from "./pages/settings/FinancialYears";
import SalesRegister from "./pages/reports/SalesRegister";
import PurchaseRegister from "./pages/reports/PurchaseRegister";
import OutstandingAging from "./pages/reports/OutstandingAging";
import BatchStockReport from "./pages/reports/BatchStockReport";
import GSTSummary from "./pages/reports/GSTSummary";
import PriceMatrix from "./pages/reports/PriceMatrix";
import TdsTcsReport from "./pages/reports/TdsTcsReport";
import TrialBalance from "./pages/reports/TrialBalance";
import ProfitAndLoss from "./pages/reports/ProfitAndLoss";
import BalanceSheet from "./pages/reports/BalanceSheet";
import StockSummary from "./pages/reports/StockSummary";
import Gstr2bReconciliation from "./pages/reports/Gstr2bReconciliation";
import ReportsHub from "./pages/reports/Hub";
import PaymentRegister from "./pages/reports/PaymentRegister";
import ReceiptRegister from "./pages/reports/ReceiptRegister";
import ContraRegister from "./pages/reports/ContraRegister";
import JournalRegister from "./pages/reports/JournalRegister";
import CreditNoteRegister from "./pages/reports/CreditNoteRegister";
import DebitNoteRegister from "./pages/reports/DebitNoteRegister";
import CashBankBook from "./pages/reports/CashBankBook";
import GroupSummary from "./pages/reports/GroupSummary";
import GroupVouchers from "./pages/reports/GroupVouchers";
import VoucherClarification from "./pages/reports/VoucherClarification";
import HrEmployees from "./pages/hr/Employees";
import SalaryComponents from "./pages/hr/SalaryComponents";
import HrPayroll from "./pages/hr/Payroll";
import HrPayslips from "./pages/hr/Payslips";
import PayslipPrint from "./pages/hr/PayslipPrint";
import AuditLogs from "./pages/settings/AuditLogs";
import OpeningBalances from "./pages/settings/OpeningBalances";
import HelpDocs from "./pages/settings/HelpDocs";
import FieldOpsSessions from "./pages/fieldops/Sessions";
import FieldOpsLocations from "./pages/fieldops/Locations";
import FieldOpsVisits from "./pages/fieldops/Visits";
import FieldOpsFieldOrders from "./pages/fieldops/FieldOrders";
import FieldOpsPayments from "./pages/fieldops/FieldPayments";
import PincodeCoverage from "./pages/fieldops/PincodeCoverage";
import MobileLogin from "./pages/mobile/MobileLogin";
import MobileHome from "./pages/mobile/MobileHome";
import MobileDuty from "./pages/mobile/MobileDuty";
import MobileDealers from "./pages/mobile/MobileDealers";
import MobileCheckin from "./pages/mobile/MobileCheckin";
import MobileCheckout from "./pages/mobile/MobileCheckout";
import MobileOrders from "./pages/mobile/MobileOrders";
import MobileNewOrder from "./pages/mobile/MobileNewOrder";
import MobilePayments from "./pages/mobile/MobilePayments";
import MobileNewPayment from "./pages/mobile/MobileNewPayment";
import { MobileGuard } from "./components/mobile/MobileGuard";
import Features from "./pages/Features";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import UserPolicy from "./pages/legal/UserPolicy";
import TermsOfUse from "./pages/legal/TermsOfUse";

const MAINTENANCE_MODE = false;

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) return <Navigate to="/m/home" replace />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
};
const M = ({ children }: { children: React.ReactNode }) => <MobileGuard>{children}</MobileGuard>;

const App = () => {
  if (MAINTENANCE_MODE) {
    return <MaintenanceMode />;
  }

  const isNative = Capacitor.isNativePlatform();
  const defaultRedirect = isNative ? "/m/home" : "/dashboard";

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BranchProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/features" element={<Features />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/user-policy" element={<UserPolicy />} />
              <Route path="/terms-of-use" element={<TermsOfUse />} />
              <Route path="/dashboard" element={<P><Dashboard /></P>} />
              <Route path="/masters/dealers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><Dealers /></RoleGuard></P>} />
              <Route path="/masters/suppliers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><Suppliers /></RoleGuard></P>} />
              <Route path="/masters/products" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><Products /></RoleGuard></P>} />
              <Route path="/masters/price-levels" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><PriceLevels /></RoleGuard></P>} />
              <Route path="/masters/transporters" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><Transporters /></RoleGuard></P>} />
              <Route path="/inventory/batches" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><Batches /></RoleGuard></P>} />
              <Route path="/inventory/stock-in" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><StockIn /></RoleGuard></P>} />
              <Route path="/inventory/alerts" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><Alerts /></RoleGuard></P>} />
              <Route path="/inventory/bom" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><BOM /></RoleGuard></P>} />
              <Route path="/inventory/warehouses" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><WarehousesPage /></RoleGuard></P>} />
              <Route path="/inventory/stock-transfers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><StockTransfersPage /></RoleGuard></P>} />
              <Route path="/inventory/pricing-matrix" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><PricingMatrixPage /></RoleGuard></P>} />
              <Route path="/inventory/bulk-pricing" element={<P><RoleGuard allowedRoles={["admin"]}><BulkPricingUpdate /></RoleGuard></P>} />
              <Route path="/sales/orders" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><Orders /></RoleGuard></P>} />
              <Route path="/sales/invoices" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><Invoices /></RoleGuard></P>} />
              <Route path="/sales/invoices/:id/print" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><InvoicePrint /></RoleGuard></P>} />
              <Route path="/sales/invoices/:id/eway-bill" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><EwayBillPrint /></RoleGuard></P>} />
              <Route path="/sales/returns" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><Returns /></RoleGuard></P>} />
              <Route path="/sales/branch-transfers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><BranchTransfers /></RoleGuard></P>} />
              <Route path="/purchase/orders" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.purchase}><PurchaseOrders /></RoleGuard></P>} />
              <Route path="/purchase/invoices" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.purchase}><PurchaseInvoices /></RoleGuard></P>} />
              <Route path="/purchase/returns" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.purchase}><PurchaseReturns /></RoleGuard></P>} />
              <Route path="/finance/ledger" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Ledger /></RoleGuard></P>} />
              <Route path="/finance/outstanding" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Outstanding /></RoleGuard></P>} />
              <Route path="/finance/payments" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Payments /></RoleGuard></P>} />
              <Route path="/finance/supplier-ledger" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><SupplierLedger /></RoleGuard></P>} />
              <Route path="/finance/supplier-outstanding" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><SupplierOutstanding /></RoleGuard></P>} />
              <Route path="/finance/supplier-payments" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><SupplierPayments /></RoleGuard></P>} />
              <Route path="/finance/advances" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Advances /></RoleGuard></P>} />
              <Route path="/finance/vouchers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Vouchers /></RoleGuard></P>} />
              <Route path="/settings/company" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><CompanySettings /></RoleGuard></P>} />
              <Route path="/settings/users" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><UserManagement /></RoleGuard></P>} />
              <Route path="/settings/financial-years" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><FinancialYears /></RoleGuard></P>} />
              <Route path="/settings/audit-logs" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><AuditLogs /></RoleGuard></P>} />
              <Route path="/settings/opening-balances" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><OpeningBalances /></RoleGuard></P>} />
              <Route path="/settings/help" element={<P><HelpDocs /></P>} />
              <Route path="/reports/sales-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><SalesRegister /></RoleGuard></P>} />
              <Route path="/reports/purchase-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><PurchaseRegister /></RoleGuard></P>} />
              <Route path="/reports/outstanding-aging" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><OutstandingAging /></RoleGuard></P>} />
              <Route path="/reports/batch-stock" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><BatchStockReport /></RoleGuard></P>} />
              <Route path="/reports/gst-summary" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><GSTSummary /></RoleGuard></P>} />
              <Route path="/reports/tds-tcs" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><TdsTcsReport /></RoleGuard></P>} />
              <Route path="/reports/price-matrix" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><PriceMatrix /></RoleGuard></P>} />
              <Route path="/reports/trial-balance" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><TrialBalance /></RoleGuard></P>} />
              <Route path="/reports/profit-loss" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><ProfitAndLoss /></RoleGuard></P>} />
              <Route path="/reports/balance-sheet" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><BalanceSheet /></RoleGuard></P>} />
              <Route path="/reports/stock-summary" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><StockSummary /></RoleGuard></P>} />
              <Route path="/reports/gstr2b-recon" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><Gstr2bReconciliation /></RoleGuard></P>} />
              <Route path="/reports" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><ReportsHub /></RoleGuard></P>} />
              <Route path="/reports/payment-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><PaymentRegister /></RoleGuard></P>} />
              <Route path="/reports/receipt-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><ReceiptRegister /></RoleGuard></P>} />
              <Route path="/reports/contra-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><ContraRegister /></RoleGuard></P>} />
              <Route path="/reports/journal-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><JournalRegister /></RoleGuard></P>} />
              <Route path="/reports/credit-note-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><CreditNoteRegister /></RoleGuard></P>} />
              <Route path="/reports/debit-note-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><DebitNoteRegister /></RoleGuard></P>} />
              <Route path="/reports/cash-bank-book" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><CashBankBook /></RoleGuard></P>} />
              <Route path="/reports/group-summary" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><GroupSummary /></RoleGuard></P>} />
              <Route path="/reports/group-vouchers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><GroupVouchers /></RoleGuard></P>} />
              <Route path="/reports/voucher-clarification" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><VoucherClarification /></RoleGuard></P>} />
              <Route path="/hr/employees" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><HrEmployees /></RoleGuard></P>} />
              <Route path="/hr/salary-components" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><SalaryComponents /></RoleGuard></P>} />
              <Route path="/hr/payroll" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><HrPayroll /></RoleGuard></P>} />
              <Route path="/hr/payslips" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><HrPayslips /></RoleGuard></P>} />
              <Route path="/hr/payslips/:id/print" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><PayslipPrint /></RoleGuard></P>} />
              {/* Field Ops Routes */}
              <Route path="/fieldops/sessions" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.fieldops}><FieldOpsSessions /></RoleGuard></P>} />
              <Route path="/fieldops/locations/:sessionId" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.fieldops}><FieldOpsLocations /></RoleGuard></P>} />
              <Route path="/fieldops/visits" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.fieldops}><FieldOpsVisits /></RoleGuard></P>} />
              <Route path="/fieldops/field-orders" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.fieldops}><FieldOpsFieldOrders /></RoleGuard></P>} />
              <Route path="/fieldops/payments" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.fieldops}><FieldOpsPayments /></RoleGuard></P>} />
              <Route path="/fieldops/pincodes" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.fieldops}><PincodeCoverage /></RoleGuard></P>} />
              {/* Mobile Routes */}
              <Route path="/m/login" element={<MobileLogin />} />
              <Route path="/m/home" element={<M><MobileHome /></M>} />
              <Route path="/m/duty" element={<M><MobileDuty /></M>} />
              <Route path="/m/dealers" element={<M><MobileDealers /></M>} />
              <Route path="/m/visits/checkin" element={<M><MobileCheckin /></M>} />
              <Route path="/m/visits/checkout" element={<M><MobileCheckout /></M>} />
              <Route path="/m/orders" element={<M><MobileOrders /></M>} />
              <Route path="/m/orders/new" element={<M><MobileNewOrder /></M>} />
              <Route path="/m/payments" element={<M><MobilePayments /></M>} />
              <Route path="/m/payments/new" element={<M><MobileNewPayment /></M>} />
              <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
              <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </BranchProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
