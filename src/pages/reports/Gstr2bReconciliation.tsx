import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, CheckCircle2, XCircle, AlertTriangle, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseGstr2bJson(json: any): any[] {
  const entries: any[] = [];
  try {
    // Standard GSTR-2B JSON structure from GST portal
    const data = json?.data?.docdata || json?.docdata || json;
    
    // B2B Invoices
    const b2b = data?.b2b || json?.b2b || [];
    b2b.forEach((supplier: any) => {
      const gstin = supplier.ctin || supplier.gstin || "";
      const name = supplier.trdnm || supplier.supplier_name || "";
      (supplier.inv || []).forEach((inv: any) => {
        const taxable = (inv.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.txval || 0), 0);
        const igst = (inv.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.iamt || 0), 0);
        const cgst = (inv.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.camt || 0), 0);
        const sgst = (inv.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.samt || 0), 0);
        const cess = (inv.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.csamt || 0), 0);
        entries.push({
          supplier_gstin: gstin,
          supplier_name: name,
          invoice_number: inv.inum || "",
          invoice_date: parseGstDate(inv.dt),
          invoice_value: Number(inv.val || 0),
          taxable_value: taxable,
          igst, cgst, sgst, cess,
          place_of_supply: inv.pos || "",
          reverse_charge: inv.rev === "Y",
          itc_availability: inv.itc_avl || "Yes",
          doc_type: "B2B",
        });
      });
    });

    // CDN (Credit/Debit Notes)
    const cdn = data?.cdnr || json?.cdnr || [];
    cdn.forEach((supplier: any) => {
      const gstin = supplier.ctin || "";
      const name = supplier.trdnm || "";
      (supplier.nt || []).forEach((note: any) => {
        const taxable = (note.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.txval || 0), 0);
        const igst = (note.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.iamt || 0), 0);
        const cgst = (note.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.camt || 0), 0);
        const sgst = (note.itms || []).reduce((s: number, it: any) => s + Number(it.itm_det?.samt || 0), 0);
        entries.push({
          supplier_gstin: gstin,
          supplier_name: name,
          invoice_number: note.ntnum || note.nt_num || "",
          invoice_date: parseGstDate(note.dt || note.nt_dt),
          invoice_value: Number(note.val || note.nt_val || 0),
          taxable_value: taxable,
          igst, cgst, sgst, cess: 0,
          place_of_supply: note.pos || "",
          reverse_charge: false,
          itc_availability: note.itc_avl || "Yes",
          doc_type: note.typ === "C" ? "Credit Note" : "Debit Note",
        });
      });
    });
  } catch (e) {
    console.error("GSTR-2B parse error:", e);
  }
  return entries;
}

function parseGstDate(d: string): string {
  if (!d) return new Date().toISOString().split("T")[0];
  // Format: DD-MM-YYYY or DD/MM/YYYY
  const parts = d.split(/[-\/]/);
  if (parts.length === 3 && parts[0].length <= 2) return `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
  return d;
}

function normalizeInvNum(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export default function Gstr2bReconciliation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [returnPeriod, setReturnPeriod] = useState("");
  const [tab, setTab] = useState("all");

  // Fetch uploaded entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["gstr2b-entries", returnPeriod],
    queryFn: async () => {
      let q = supabase.from("gstr2b_entries").select("*, purchase_invoices(pi_number, pi_date, total_amount)").order("supplier_gstin");
      if (returnPeriod) q = q.eq("return_period", returnPeriod);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch purchase invoices for matching
  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ["pi-for-recon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices")
        .select("id, pi_number, pi_date, total_amount, cgst_total, sgst_total, igst_total, subtotal, status, suppliers(name, gst_number)")
        .neq("status", "void");
      if (error) throw error;
      return data || [];
    },
  });

  // Distinct return periods
  const { data: periods = [] } = useQuery({
    queryKey: ["gstr2b-periods"],
    queryFn: async () => {
      const { data } = await supabase.from("gstr2b_entries").select("return_period").order("return_period", { ascending: false });
      const unique = [...new Set((data || []).map((d: any) => d.return_period))];
      return unique as string[];
    },
  });

  // Upload + parse mutation
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const json = JSON.parse(text);
      const period = json?.data?.rtnprd || json?.rtnprd || returnPeriod || "Unknown";
      const parsed = parseGstr2bJson(json);
      if (parsed.length === 0) throw new Error("No B2B entries found in the uploaded JSON. Please check the file format.");

      // Auto-match against purchase invoices
      const piMap = new Map<string, any>();
      purchaseInvoices.forEach((pi: any) => {
        const key = normalizeInvNum(pi.pi_number);
        piMap.set(key, pi);
        // Also try with supplier GSTIN prefix
        if (pi.suppliers?.gst_number) {
          piMap.set(`${pi.suppliers.gst_number}_${key}`, pi);
        }
      });

      const rows = parsed.map((entry) => {
        const normNum = normalizeInvNum(entry.invoice_number);
        // Try exact match, then GSTIN+number
        let matched = piMap.get(normNum) || piMap.get(`${entry.supplier_gstin}_${normNum}`);
        
        let match_status = "not_in_books";
        let matched_pi_id = null;
        let mismatch_reasons: string[] = [];

        if (matched) {
          matched_pi_id = matched.id;
          const valDiff = Math.abs(Number(matched.total_amount) - entry.invoice_value);
          const taxDiff = Math.abs((Number(matched.igst_total) + Number(matched.cgst_total) + Number(matched.sgst_total)) - (entry.igst + entry.cgst + entry.sgst));
          
          if (valDiff < 1 && taxDiff < 1) {
            match_status = "matched";
          } else {
            match_status = "mismatch";
            if (valDiff >= 1) mismatch_reasons.push(`Value diff: ₹${valDiff.toFixed(2)}`);
            if (taxDiff >= 1) mismatch_reasons.push(`Tax diff: ₹${taxDiff.toFixed(2)}`);
          }
        }

        return {
          ...entry,
          return_period: period,
          match_status,
          matched_pi_id,
          mismatch_reasons: mismatch_reasons.length > 0 ? mismatch_reasons : null,
          uploaded_by: user?.id,
        };
      });

      // Delete existing entries for this period first, then insert
      await supabase.from("gstr2b_entries").delete().eq("return_period", period);
      
      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("gstr2b_entries").insert(batch);
        if (error) throw error;
      }

      setReturnPeriod(period);
      return { count: rows.length, period };
    },
    onSuccess: (d) => {
      toast.success(`Uploaded ${d.count} entries for period ${d.period}`);
      qc.invalidateQueries({ queryKey: ["gstr2b-entries"] });
      qc.invalidateQueries({ queryKey: ["gstr2b-periods"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMut.mutate(file);
    e.target.value = "";
  };

  // Stats
  const matched = entries.filter((e: any) => e.match_status === "matched");
  const mismatched = entries.filter((e: any) => e.match_status === "mismatch");
  const notInBooks = entries.filter((e: any) => e.match_status === "not_in_books");
  const pending = entries.filter((e: any) => e.match_status === "pending");

  // Find PIs not in GSTR-2B (only if a period is selected)
  const entryPiIds = new Set(entries.filter((e: any) => e.matched_pi_id).map((e: any) => e.matched_pi_id));
  const notInGstr2b = returnPeriod 
    ? purchaseInvoices.filter((pi: any) => !entryPiIds.has(pi.id))
    : [];

  const filtered = tab === "all" ? entries 
    : tab === "matched" ? matched 
    : tab === "mismatch" ? mismatched 
    : tab === "not_in_books" ? notInBooks 
    : pending;

  const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const statusBadge = (s: string) => {
    switch (s) {
      case "matched": return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" />Matched</Badge>;
      case "mismatch": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Mismatch</Badge>;
      case "not_in_books": return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3 mr-1" />Not in Books</Badge>;
      default: return <Badge variant="secondary"><FileQuestion className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const exportCols = [
    { key: "supplier_gstin", label: "GSTIN" }, { key: "supplier_name", label: "Supplier" },
    { key: "invoice_number", label: "Invoice #" }, { key: "invoice_date", label: "Date" },
    { key: "invoice_value", label: "Value" }, { key: "taxable_value", label: "Taxable" },
    { key: "igst", label: "IGST" }, { key: "cgst", label: "CGST" }, { key: "sgst", label: "SGST" },
    { key: "match_status", label: "Status" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GSTR-2B Reconciliation</h1>
            <p className="text-muted-foreground">Compare purchase invoices against GSTR-2B data</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploadMut.isPending}>
              <Upload className="h-4 w-4 mr-2" />{uploadMut.isPending ? "Processing..." : "Upload GSTR-2B JSON"}
            </Button>
            {entries.length > 0 && (
              <>
                <Button variant="outline" onClick={() => exportToCsv("gstr2b-recon.csv", entries, exportCols)}><Download className="h-4 w-4 mr-2" />CSV</Button>
                <Button variant="outline" onClick={() => exportToXlsx("gstr2b-recon.xlsx", entries, exportCols)}><Download className="h-4 w-4 mr-2" />Excel</Button>
              </>
            )}
          </div>
        </div>

        {/* Period filter */}
        {periods.length > 0 && (
          <Card>
            <CardContent className="pt-4 flex items-end gap-4">
              <div className="space-y-1 min-w-[200px]">
                <Label>Return Period</Label>
                <Select value={returnPeriod} onValueChange={setReturnPeriod}>
                  <SelectTrigger><SelectValue placeholder="All periods" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Periods</SelectItem>
                    {periods.map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Entries</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{entries.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Matched</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-emerald-600">{matched.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mismatch</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-destructive">{mismatched.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Not in Books</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-amber-600">{notInBooks.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Not in GSTR-2B</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-blue-600">{notInGstr2b.length}</p></CardContent>
          </Card>
        </div>

        {/* Data tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
            <TabsTrigger value="matched">Matched ({matched.length})</TabsTrigger>
            <TabsTrigger value="mismatch">Mismatch ({mismatched.length})</TabsTrigger>
            <TabsTrigger value="not_in_books">Not in Books ({notInBooks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : entries.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">No GSTR-2B data uploaded yet.</p>
                    <p className="text-sm text-muted-foreground">Download your GSTR-2B JSON from the GST portal and upload it here for automatic reconciliation.</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No entries in this category.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>GSTIN</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">IGST</TableHead>
                          <TableHead className="text-right">CGST</TableHead>
                          <TableHead className="text-right">SGST</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((e: any) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-mono text-xs">{e.supplier_gstin}</TableCell>
                            <TableCell className="font-medium">{e.supplier_name || "—"}</TableCell>
                            <TableCell>{e.invoice_number}</TableCell>
                            <TableCell>{e.invoice_date}</TableCell>
                            <TableCell className="text-right">{fmt(e.invoice_value)}</TableCell>
                            <TableCell className="text-right">{fmt(e.igst)}</TableCell>
                            <TableCell className="text-right">{fmt(e.cgst)}</TableCell>
                            <TableCell className="text-right">{fmt(e.sgst)}</TableCell>
                            <TableCell>{statusBadge(e.match_status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                              {e.mismatch_reasons ? (Array.isArray(e.mismatch_reasons) ? e.mismatch_reasons.join(", ") : String(e.mismatch_reasons)) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Not in GSTR-2B section */}
        {returnPeriod && notInGstr2b.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5 text-blue-600" />
                Purchase Invoices Not in GSTR-2B ({notInGstr2b.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PI #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notInGstr2b.slice(0, 50).map((pi: any) => (
                    <TableRow key={pi.id}>
                      <TableCell className="font-medium">{pi.pi_number}</TableCell>
                      <TableCell>{pi.suppliers?.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{pi.suppliers?.gst_number || "—"}</TableCell>
                      <TableCell>{pi.pi_date}</TableCell>
                      <TableCell className="text-right">{fmt(pi.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
