import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Ledger() {
  const [dealerId, setDealerId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list"], queryFn: async () => { const { data } = await supabase.from("dealers").select("id, name").order("name"); return data || []; } });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["ledger", dealerId, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from("ledger_entries").select("*, dealers(name)").order("entry_date", { ascending: false }).order("created_at", { ascending: false });
      if (dealerId !== "all") q = q.eq("dealer_id", dealerId);
      if (dateFrom) q = q.gte("entry_date", dateFrom);
      if (dateTo) q = q.lte("entry_date", dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Running balance
  let runningBalance = 0;
  const withBalance = [...entries].reverse().map((e: any) => {
    runningBalance += Number(e.debit) - Number(e.credit);
    return { ...e, balance: runningBalance };
  }).reverse();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Ledger</h1><p className="text-muted-foreground">Dealer-wise financial ledger</p></div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1 min-w-[200px]">
                <Label className="text-xs">Dealer</Label>
                <Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Dealers</SelectItem>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : withBalance.length === 0 ? <p className="text-muted-foreground text-center py-8">No ledger entries.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Dealer</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {withBalance.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.entry_date}</TableCell>
                      <TableCell>{e.dealers?.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{e.entry_type}</Badge></TableCell>
                      <TableCell className="text-sm">{e.description || "—"}</TableCell>
                      <TableCell className="text-right">{Number(e.debit) > 0 ? `₹${Number(e.debit).toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className="text-right">{Number(e.credit) > 0 ? `₹${Number(e.credit).toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className={`text-right font-medium ${e.balance > 0 ? "text-destructive" : "text-success"}`}>₹{Math.abs(e.balance).toLocaleString("en-IN")} {e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}</TableCell>
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
