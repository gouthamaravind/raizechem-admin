import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Dealers from "./pages/masters/Dealers";
import Products from "./pages/masters/Products";
import Batches from "./pages/inventory/Batches";
import StockIn from "./pages/inventory/StockIn";
import Alerts from "./pages/inventory/Alerts";
import Orders from "./pages/sales/Orders";
import Invoices from "./pages/sales/Invoices";
import Returns from "./pages/sales/Returns";
import Ledger from "./pages/finance/Ledger";
import Outstanding from "./pages/finance/Outstanding";
import Payments from "./pages/finance/Payments";
import CompanySettings from "./pages/settings/CompanySettings";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => <ProtectedRoute>{children}</ProtectedRoute>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/masters/dealers" element={<P><Dealers /></P>} />
            <Route path="/masters/products" element={<P><Products /></P>} />
            <Route path="/inventory/batches" element={<P><Batches /></P>} />
            <Route path="/inventory/stock-in" element={<P><StockIn /></P>} />
            <Route path="/inventory/alerts" element={<P><Alerts /></P>} />
            <Route path="/sales/orders" element={<P><Orders /></P>} />
            <Route path="/sales/invoices" element={<P><Invoices /></P>} />
            <Route path="/sales/returns" element={<P><Returns /></P>} />
            <Route path="/finance/ledger" element={<P><Ledger /></P>} />
            <Route path="/finance/outstanding" element={<P><Outstanding /></P>} />
            <Route path="/finance/payments" element={<P><Payments /></P>} />
            <Route path="/settings/company" element={<P><CompanySettings /></P>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
