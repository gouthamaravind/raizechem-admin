import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DemoModeProvider } from "@/hooks/useDemoMode";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import { MODULE_ACCESS } from "@/types/roles";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Dealers from "./pages/masters/Dealers";
import Products from "./pages/masters/Products";
import Suppliers from "./pages/masters/Suppliers";
import Batches from "./pages/inventory/Batches";
import StockIn from "./pages/inventory/StockIn";
import Alerts from "./pages/inventory/Alerts";
import Orders from "./pages/sales/Orders";
import Invoices from "./pages/sales/Invoices";
import InvoicePrint from "./pages/sales/InvoicePrint";
import Returns from "./pages/sales/Returns";
import PurchaseOrders from "./pages/purchase/Orders";
import PurchaseInvoices from "./pages/purchase/Invoices";
import PurchaseReturns from "./pages/purchase/Returns";
import Ledger from "./pages/finance/Ledger";
import Outstanding from "./pages/finance/Outstanding";
import Payments from "./pages/finance/Payments";
import SupplierLedger from "./pages/finance/SupplierLedger";
import SupplierOutstanding from "./pages/finance/SupplierOutstanding";
import SupplierPayments from "./pages/finance/SupplierPayments";
import CompanySettings from "./pages/settings/CompanySettings";
import UserManagement from "./pages/settings/UserManagement";
import FinancialYears from "./pages/settings/FinancialYears";
import SalesRegister from "./pages/reports/SalesRegister";
import PurchaseRegister from "./pages/reports/PurchaseRegister";
import OutstandingAging from "./pages/reports/OutstandingAging";
import BatchStockReport from "./pages/reports/BatchStockReport";
import GSTSummary from "./pages/reports/GSTSummary";
import TdsTcsReport from "./pages/reports/TdsTcsReport";
import HrEmployees from "./pages/hr/Employees";
import SalaryComponents from "./pages/hr/SalaryComponents";
import HrPayroll from "./pages/hr/Payroll";
import HrPayslips from "./pages/hr/Payslips";
import AuditLogs from "./pages/settings/AuditLogs";
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

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => <ProtectedRoute>{children}</ProtectedRoute>;
const M = ({ children }: { children: React.ReactNode }) => <MobileGuard>{children}</MobileGuard>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DemoModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/masters/dealers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><Dealers /></RoleGuard></P>} />
            <Route path="/masters/suppliers" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><Suppliers /></RoleGuard></P>} />
            <Route path="/masters/products" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.masters}><Products /></RoleGuard></P>} />
            <Route path="/inventory/batches" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><Batches /></RoleGuard></P>} />
            <Route path="/inventory/stock-in" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><StockIn /></RoleGuard></P>} />
            <Route path="/inventory/alerts" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.inventory}><Alerts /></RoleGuard></P>} />
            <Route path="/sales/orders" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><Orders /></RoleGuard></P>} />
            <Route path="/sales/invoices" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><Invoices /></RoleGuard></P>} />
            <Route path="/sales/invoices/:id/print" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><InvoicePrint /></RoleGuard></P>} />
            <Route path="/sales/returns" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.sales}><Returns /></RoleGuard></P>} />
            <Route path="/purchase/orders" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.purchase}><PurchaseOrders /></RoleGuard></P>} />
            <Route path="/purchase/invoices" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.purchase}><PurchaseInvoices /></RoleGuard></P>} />
            <Route path="/purchase/returns" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.purchase}><PurchaseReturns /></RoleGuard></P>} />
            <Route path="/finance/ledger" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Ledger /></RoleGuard></P>} />
            <Route path="/finance/outstanding" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Outstanding /></RoleGuard></P>} />
            <Route path="/finance/payments" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><Payments /></RoleGuard></P>} />
            <Route path="/finance/supplier-ledger" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><SupplierLedger /></RoleGuard></P>} />
            <Route path="/finance/supplier-outstanding" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><SupplierOutstanding /></RoleGuard></P>} />
            <Route path="/finance/supplier-payments" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.finance}><SupplierPayments /></RoleGuard></P>} />
            <Route path="/settings/company" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><CompanySettings /></RoleGuard></P>} />
            <Route path="/settings/users" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><UserManagement /></RoleGuard></P>} />
            <Route path="/settings/financial-years" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><FinancialYears /></RoleGuard></P>} />
            <Route path="/settings/audit-logs" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.settings}><AuditLogs /></RoleGuard></P>} />
            <Route path="/reports/sales-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><SalesRegister /></RoleGuard></P>} />
            <Route path="/reports/purchase-register" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><PurchaseRegister /></RoleGuard></P>} />
            <Route path="/reports/outstanding-aging" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><OutstandingAging /></RoleGuard></P>} />
            <Route path="/reports/batch-stock" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><BatchStockReport /></RoleGuard></P>} />
            <Route path="/reports/gst-summary" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><GSTSummary /></RoleGuard></P>} />
            <Route path="/reports/tds-tcs" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.reports}><TdsTcsReport /></RoleGuard></P>} />
            <Route path="/hr/employees" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><HrEmployees /></RoleGuard></P>} />
            <Route path="/hr/salary-components" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><SalaryComponents /></RoleGuard></P>} />
            <Route path="/hr/payroll" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><HrPayroll /></RoleGuard></P>} />
            <Route path="/hr/payslips" element={<P><RoleGuard allowedRoles={MODULE_ACCESS.hr}><HrPayslips /></RoleGuard></P>} />
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </DemoModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
