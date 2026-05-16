import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse, FileText, ArrowLeftRight, Boxes, ScrollText, AlertTriangle } from "lucide-react";

const tiles = [
  { to: "/warehouse/waybills", icon: FileText, title: "E-Way Bill Log", desc: "Generate, track and cancel NIC e-way bills" },
  { to: "/sales/branch-transfers", icon: ArrowLeftRight, title: "Branch Transfers", desc: "Move stock between TG and AP, convert to invoice" },
  { to: "/inventory/warehouses", icon: Warehouse, title: "Godowns & Bins", desc: "Manage warehouses and bin locations" },
  { to: "/inventory/stock-transfers", icon: Boxes, title: "Stock Transfers", desc: "Inter-godown stock movement" },
  { to: "/inventory/batches", icon: ScrollText, title: "Batch Tracking", desc: "Batch numbers, expiry, traceability" },
  { to: "/inventory/alerts", icon: AlertTriangle, title: "Stock Alerts", desc: "Low stock and expiry notifications" },
];

export default function WarehouseHome() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouse</h1>
          <p className="text-muted-foreground">Dispatch, e-way bills, godowns and stock control</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <Link key={t.to} to={t.to}>
              <Card className="glass-card-hover h-full transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <t.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{t.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
