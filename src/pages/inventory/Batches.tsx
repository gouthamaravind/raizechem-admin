import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";

export default function Batches() {
  const [search, setSearch] = useState("");

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_batches")
        .select("*, products(name, unit)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = batches.filter((b: any) => {
    const s = search.toLowerCase();
    return b.batch_no?.toLowerCase().includes(s) || b.products?.name?.toLowerCase().includes(s);
  });

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 90;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold tracking-tight">Batches</h1><p className="text-muted-foreground">All product batches</p></div>
          <Button variant="outline" onClick={() => exportToCsv("batches.csv", filtered.map((b: any) => ({ product: b.products?.name, batch_no: b.batch_no, mfg_date: b.mfg_date, exp_date: b.exp_date, purchase_rate: b.purchase_rate, current_qty: b.current_qty })), [{ key: "product", label: "Product" }, { key: "batch_no", label: "Batch No" }, { key: "mfg_date", label: "Mfg Date" }, { key: "exp_date", label: "Exp Date" }, { key: "purchase_rate", label: "Purchase Rate" }, { key: "current_qty", label: "Current Qty" }])}><Download className="h-4 w-4 mr-2" />CSV</Button>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by product or batch number..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No batches. Use Stock In to add inventory.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch No</TableHead><TableHead>Mfg Date</TableHead><TableHead>Exp Date</TableHead><TableHead>Purchase Rate</TableHead><TableHead>Current Qty</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.products?.name}</TableCell>
                      <TableCell>{b.batch_no}</TableCell>
                      <TableCell>{b.mfg_date || "—"}</TableCell>
                      <TableCell>
                        {b.exp_date || "—"}
                        {isExpiringSoon(b.exp_date) && <Badge variant="destructive" className="ml-2 text-[10px]">Expiring</Badge>}
                      </TableCell>
                      <TableCell>₹{Number(b.purchase_rate).toLocaleString("en-IN")}</TableCell>
                      <TableCell className={Number(b.current_qty) <= 0 ? "text-destructive font-semibold" : ""}>{b.current_qty} {b.products?.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
