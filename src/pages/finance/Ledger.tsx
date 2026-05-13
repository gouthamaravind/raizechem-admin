import { useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useBranch } from "@/hooks/useBranch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportToXlsx } from "@/lib/xlsx-export";
import { exportTablePdf, safeFileSlug } from "@/lib/pdf-export";

export default function Ledger() {
  const { branchId } = useBranch();
  const [dealerId, setDealerId] = useState("all");
  const [fyId, setFyId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: dealers = [] } = useQuery({ queryKey: ["dealers-list", branchId], queryFn: async () => { let q = supabase.from("dealers").select("id, name").order("name"); if (branchId) q = q.eq("branch_id", branchId); const { data } = await q; return data || []; } });

  const { data: fys = [] } = useQuery({
    queryKey: ["financial-years"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_years").select("*").order("start_date", { ascending: false });
      return data || [];
    },
  });

  const selectedFy = fys.find((f: any) => f.id === fyId) as any;

  // Opening balance for selected dealer + FY
  const { data: openingBalance } = useQuery({
    queryKey: ["opening-balance", fyId, dealerId],
    enabled: fyId !== "all" && dealerId !== "all",
    queryFn: async () => {
      const { data } = await supabase.from("opening_balances")
        .select("*")
        .eq("fy_id", fyId)
        .eq("entity_type", "dealer")
        .eq("entity_id", dealerId)
        .maybeSingle();
      return data;
    },
  });

  const pg = usePagination();

  const { data: entriesRaw = [], isLoading } = useQuery({
    queryKey: ["ledger", dealerId, fyId, dateFrom, dateTo, pg.page],
    queryFn: async () => {
      let q = supabase.from("ledger_entries").select("*, dealers(name)").order("entry_date", { ascending: false }).order("created_at", { ascending: false });
      if (dealerId !== "all") q = q.eq("dealer_id", dealerId);

      // Apply FY date range if selected
      if (fyId !== "all" && selectedFy) {
        q = q.gte("entry_date", selectedFy.start_date).lte("entry_date", selectedFy.end_date);
      } else {
        if (dateFrom) q = q.gte("entry_date", dateFrom);
        if (dateTo) q = q.lte("entry_date", dateTo);
      }

      q = q.range(pg.range.from, pg.range.to + 1);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const entries = entriesRaw.slice(0, pg.pageSize);

  // Running balance with opening balance
  const obDebit = openingBalance ? Number(openingBalance.opening_debit) : 0;
  const obCredit = openingBalance ? Number(openingBalance.opening_credit) : 0;
  const obNet = obDebit - obCredit;
  const hasOpeningBalance = fyId !== "all" && dealerId !== "all" && (obDebit > 0 || obCredit > 0);

  let runningBalance = hasOpeningBalance ? obNet : 0;
  const withBalance = [...entries].reverse().map((e: any) => {
    runningBalance += Number(e.debit) - Number(e.credit);
    return { ...e, balance: runningBalance };
  }).reverse();

  // When FY is selected, auto-set date fields for display
  const handleFyChange = (v: string) => {
    setFyId(v); pg.resetPage();
    if (v !== "all") {
      const fy = fys.find((f: any) => f.id === v) as any;
      if (fy) { setDateFrom(fy.start_date); setDateTo(fy.end_date); }
    } else {
      setDateFrom(""); setDateTo("");
    }
  };

  const selectedDealer = dealers.find((d: any) => d.id === dealerId) as any;
  const dealerNameSlug = selectedDealer ? safeFileSlug(selectedDealer.name) : "all_dealers";
  const periodLabel = fyId !== "all" && selectedFy ? selectedFy.fy_code
    : (dateFrom || dateTo) ? `${dateFrom || "start"}_to_${dateTo || "today"}` : "all_time";

  const buildExportRows = () => {
    const data: any[] = [];
    if (hasOpeningBalance) {
      data.push({
        date: selectedFy?.start_date,
        dealer: "—",
        type: "Opening Balance",
        description: "Opening balance carried forward",
        debit: obDebit || "",
        credit: obCredit || "",
        balance: `${Math.abs(obNet).toLocaleString("en-IN")} ${obNet > 0 ? "Dr" : obNet < 0 ? "Cr" : ""}`,
      });
    }
    withBalance.forEach((e: any) => data.push({
      date: e.entry_date,
      dealer: e.dealers?.name || "",
      type: e.entry_type,
      description: e.description || "",
      debit: Number(e.debit) > 0 ? Number(e.debit) : "",
      credit: Number(e.credit) > 0 ? Number(e.credit) : "",
      balance: `${Math.abs(e.balance).toLocaleString("en-IN")} ${e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}`,
    }));
    return data;
  };

  const handleExportXlsx = () => {
    exportToXlsx(`${dealerNameSlug}_ledger_${periodLabel}.xlsx`, buildExportRows(), [
      { key: "date", label: "Date" },
      { key: "dealer", label: "Dealer" },
      { key: "type", label: "Type" },
      { key: "description", label: "Description" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
      { key: "balance", label: "Balance" },
    ]);
  };

  const handleExportPdf = () => {
    const data = buildExportRows();
    exportTablePdf({
      title: selectedDealer ? `${selectedDealer.name} — Ledger` : "Dealer Ledger",
      subtitle: `Period: ${periodLabel}`,
      filename: `${dealerNameSlug}.pdf`,
      columns: ["Date", "Dealer", "Type", "Description", "Debit", "Credit", "Balance"],
      rows: data.map((r) => [
        r.date, r.dealer, r.type, r.description,
        r.debit ? `₹${Number(r.debit).toLocaleString("en-IN")}` : "",
        r.credit ? `₹${Number(r.credit).toLocaleString("en-IN")}` : "",
        r.balance,
      ]),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div><h1 className="text-2xl font-bold tracking-tight">Ledger</h1><p className="text-muted-foreground">Dealer-wise financial ledger</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!withBalance.length && !hasOpeningBalance}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!withBalance.length && !hasOpeningBalance}>
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1 min-w-[200px]">
                <Label className="text-xs">Dealer</Label>
                <Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Dealers</SelectItem>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1 min-w-[160px]">
                <Label className="text-xs">Financial Year</Label>
                <Select value={fyId} onValueChange={handleFyChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Time</SelectItem>{fys.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.fy_code}</SelectItem>)}</SelectContent></Select>
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
            {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : withBalance.length === 0 && !hasOpeningBalance ? <p className="text-muted-foreground text-center py-8">No ledger entries.</p> : (
              <>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Dealer</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {hasOpeningBalance && (
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>{selectedFy?.start_date}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell><Badge variant="outline">Opening Bal</Badge></TableCell>
                      <TableCell className="text-sm">Opening balance carried forward</TableCell>
                      <TableCell className="text-right">{obDebit > 0 ? `₹${obDebit.toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className="text-right">{obCredit > 0 ? `₹${obCredit.toLocaleString("en-IN")}` : ""}</TableCell>
                      <TableCell className={`text-right font-medium ${obNet > 0 ? "text-destructive" : "text-success"}`}>₹{Math.abs(obNet).toLocaleString("en-IN")} {obNet > 0 ? "Dr" : obNet < 0 ? "Cr" : ""}</TableCell>
                    </TableRow>
                  )}
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
              <TablePagination page={pg.page} pageSize={pg.pageSize} totalFetched={entriesRaw.length} onPrev={pg.prevPage} onNext={pg.nextPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
