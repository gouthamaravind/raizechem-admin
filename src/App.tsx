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
import StubPage from "./pages/StubPage";

const queryClient = new QueryClient();

const ProtectedStub = ({ title, description }: { title: string; description: string }) => (
  <ProtectedRoute><StubPage title={title} description={description} /></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/masters/dealers" element={<ProtectedRoute><Dealers /></ProtectedRoute>} />
            <Route path="/masters/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/inventory/batches" element={<ProtectedStub title="Batches" description="Manage product batches" />} />
            <Route path="/inventory/stock-in" element={<ProtectedStub title="Stock In" description="Record incoming stock" />} />
            <Route path="/inventory/alerts" element={<ProtectedStub title="Alerts" description="Low stock and expiry alerts" />} />
            <Route path="/sales/orders" element={<ProtectedStub title="Orders" description="Manage sales orders" />} />
            <Route path="/sales/invoices" element={<ProtectedStub title="Invoices" description="Generate and manage invoices" />} />
            <Route path="/sales/returns" element={<ProtectedStub title="Returns" description="Process sales returns" />} />
            <Route path="/finance/ledger" element={<ProtectedStub title="Ledger" description="Dealer-wise ledger" />} />
            <Route path="/finance/outstanding" element={<ProtectedStub title="Outstanding" description="Pending payment tracking" />} />
            <Route path="/finance/payments" element={<ProtectedStub title="Payments" description="Record received payments" />} />
            <Route path="/settings/company" element={<ProtectedStub title="Company Settings" description="Manage company profile" />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
