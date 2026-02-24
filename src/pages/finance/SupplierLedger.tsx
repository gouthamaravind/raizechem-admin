import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function SupplierLedger() {
  const [supplierId, setSupplierId] = useState("all");
  const [fyId, setFyId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: fys = [] } = useQuery({
    queryKey: ["financial-years"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_years").select("*").order("start_date", { ascending: false });
      return data || [];
    },
  });

  const selectedFy = fys.find((f: any) => f.id === fyId) as any;

  const { data: openingBalance } = useQuery({
    queryKey: ["supplier-opening-balance", fyId, supplierId],
    enabled: fyId !== "all" && supplierId !== "all",
    queryFn: async () => {
      const { data } = await supabase.from("opening_balances")
        .select("*")
        .eq("fy_id", fyId)
        .eq("entity_type", "supplier")
        .eq("entity_id", supplierId)
        .maybeSingle();
      return data;
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["supplier-ledger", supplierId, fyId, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from("supplier_ledger_entries" as any)
        .select("*, suppliers(name)")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (supplierId !== "all") q = q.eq("supplier_id", supplierId);
      if (fyId !== "all" && selectedFy) {
        q = q.gte("entry_date", selectedFy.start_date).lte("entry_date", selectedFy.end_date);
      } else {
        if (dateFrom) q = q.gte("entry_date", dateFrom);
        if (dateTo) q = q.lte("entry_date", dateTo);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const obDebit = openingBalance ? Number(openingBalance.opening_debit) : 0;
  const obCredit = openingBalance ? Number(openingBalance.opening_credit) : 0;
  const obNet = obDebit - obCredit;
  const hasOpeningBalance = fyId !== "all" && supplierId !== "all" && (obDebit > 0 || obCredit > 0);

  // For suppliers: credit = we owe them, debit = they owe us (returns/payments)
  // Positive balance = we owe supplier (Cr), negative = supplier owes us (Dr)
  let runningBalance = hasOpeningBalance ? obNet : 0;
  const withBalance = [...(entries as any[])].reverse().map((e: any) => {
    runningBalance += Number(e.debit) - Number(e.credit);
    return { ...e, balance: runningBalance };
  }).reverse();

  const handleFyChange = (v: string) => {
    setFyId(v);
    if (v !== "all") {
      const fy = fys.find((f: any) => f.id === v) as any;
      if (fy) { setDateFrom(fy.start_date); setDateTo(fy.end_date); }
    } else {
      setDateFrom(""); setDateTo("");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Ledger</h1>
          <p className="text-muted-foreground">Supplier-wise financial ledger</p>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1 min-w-[200px]">
                <Label className="text-xs">Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">Financial Year</Label>
                <Select value={fyId} onValueChange={handleFyChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    {fys.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.fy_code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {fyId === "all" && (
                <>
                  <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : withBalance.length === 0 && !hasOpeningBalance ? (
              <p className="text-muted-foreground text-center py-8">No supplier ledger entries.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hasOpeningBalance && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>{selectedFy?.start_date}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell><Badge variant="outline">Opening Bal</Badge></TableCell>
                      <TableCell className="text-sm">Opening balance carried forward</TableCell>
                      <TableCell className="text-right">{obDebit > 0 ? `₹${obDebit.toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className="text-right">{obCredit > 0 ? `₹${obCredit.toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className={`text-right font-medium ${obNet < 0 ? "text-destructive" : "text-success"}`}>
                        ₹{Math.abs(obNet).toLocaleString("en-IN")} {obNet < 0 ? "Cr" : obNet > 0 ? "Dr" : ""}
                      </TableCell>
                    </TableRow>
                  )}
                  {withBalance.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.entry_date}</TableCell>
                      <TableCell>{e.suppliers?.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{e.entry_type}</Badge></TableCell>
                      <TableCell className="text-sm">{e.description || "—"}</TableCell>
                      <TableCell className="text-right">{Number(e.debit) > 0 ? `₹${Number(e.debit).toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className="text-right">{Number(e.credit) > 0 ? `₹${Number(e.credit).toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className={`text-right font-medium ${e.balance < 0 ? "text-destructive" : "text-success"}`}>
                        ₹{Math.abs(e.balance).toLocaleString("en-IN")} {e.balance < 0 ? "Cr" : e.balance > 0 ? "Dr" : ""}
                      </TableCell>
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
