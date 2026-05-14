import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, BookOpen, X, AlertCircle, Lock, Unlock } from "lucide-react";
import { format } from "date-fns";
import { ReceiptProRata, type ProRataAllocation } from "@/components/finance/ReceiptProRata";

const VOUCHER_TYPES = [
  { value: "journal", label: "Journal Voucher", prefix: "JV", counterKey: "next_journal_number" },
  { value: "contra", label: "Contra Voucher", prefix: "CV", counterKey: "next_contra_number" },
  { value: "receipt", label: "Receipt Voucher", prefix: "RV", counterKey: "next_receipt_voucher_number" },
  { value: "payment", label: "Payment Voucher", prefix: "PV", counterKey: "next_payment_voucher_number" },
];

interface VoucherLine {
  account_id: string;
  account_name?: string;
  dealer_id?: string;
  supplier_id?: string;
  debit: number;
  credit: number;
  narration: string;
}

export default function Vouchers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ id: string; num: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voucherType, setVoucherType] = useState("journal");
  const [narration, setNarration] = useState("");
  const [voucherDate, setVoucherDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lines, setLines] = useState<VoucherLine[]>([
    { account_id: "", debit: 0, credit: 0, narration: "" },
    { account_id: "", debit: 0, credit: 0, narration: "" },
  ]);
  const [activeTab, setActiveTab] = useState("all");
  const [proRataAllocations, setProRataAllocations] = useState<ProRataAllocation[]>([]);
  const [proRataDiscount, setProRataDiscount] = useState(0);

  const { data: accounts = [] } = useQuery({
    queryKey: ["ledger-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_accounts").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: dealers = [] } = useQuery({
    queryKey: ["dealers-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("id, name").eq("status", "active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["vouchers", activeTab],
    queryFn: async () => {
      let q = supabase.from("vouchers").select("*").order("created_at", { ascending: false });
      if (activeTab !== "all") q = q.eq("voucher_type", activeTab);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Find the dealer selected in a receipt voucher (credit-side dealer account line)
  const receiptDealerId = useMemo(() => {
    if (voucherType !== "receipt") return null;
    for (const line of lines) {
      if (!line.account_id || !line.dealer_id) continue;
      const acct = accounts.find((a) => a.id === line.account_id);
      if (acct?.account_type === "dealer" && line.credit > 0) return line.dealer_id;
    }
    return null;
  }, [voucherType, lines, accounts]);

  // Receipt amount = total credit on dealer lines
  const receiptAmount = useMemo(() => {
    if (voucherType !== "receipt") return 0;
    return lines.reduce((sum, l) => {
      const acct = accounts.find((a) => a.id === l.account_id);
      if (acct?.account_type === "dealer" && l.credit > 0) return sum + l.credit;
      return sum;
    }, 0);
  }, [voucherType, lines, accounts]);

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleAllocationsChange = (allocs: ProRataAllocation[], discount: number) => {
    setProRataAllocations(allocs);
    setProRataDiscount(discount);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isBalanced) throw new Error("Debit and Credit must be equal and > 0");
      const vtConfig = VOUCHER_TYPES.find((v) => v.value === voucherType)!;

      const { data: settings } = await supabase.from("company_settings").select("*").limit(1).single();
      const num = (settings as any)?.[vtConfig.counterKey] || 1;
      const year = new Date().getFullYear();
      const voucherNum = `${vtConfig.prefix}/${year}/${String(num).padStart(3, "0")}`;

      const { data: voucher, error } = await supabase.from("vouchers").insert({
        voucher_number: voucherNum,
        voucher_type: voucherType,
        voucher_date: voucherDate,
        narration,
        total_amount: totalDebit,
        created_by: user?.id,
      } as any).select().single();
      if (error) throw error;

      const lineInserts = lines.filter((l) => l.account_id && (l.debit > 0 || l.credit > 0)).map((l) => ({
        voucher_id: voucher.id,
        account_id: l.account_id,
        dealer_id: l.dealer_id || null,
        supplier_id: l.supplier_id || null,
        debit: l.debit || 0,
        credit: l.credit || 0,
        narration: l.narration || null,
      }));

      const { error: linesErr } = await supabase.from("voucher_lines").insert(lineInserts as any);
      if (linesErr) throw linesErr;

      await supabase.from("company_settings").update({ [vtConfig.counterKey]: num + 1 } as any).not("id", "is", null);

      // If receipt voucher with pro-rata allocations, record them
      if (voucherType === "receipt" && proRataAllocations.length > 0 && receiptDealerId) {
        for (const alloc of proRataAllocations) {
          // Update invoice amount_paid
          const { data: inv } = await supabase
            .from("invoices")
            .select("amount_paid")
            .eq("id", alloc.invoice_id)
            .single();
          if (inv) {
            const newPaid = Number(inv.amount_paid) + alloc.allocated;
            await supabase.from("invoices").update({ amount_paid: newPaid } as any).eq("id", alloc.invoice_id);
          }

          // Ledger entry for payment
          await supabase.from("ledger_entries").insert({
            dealer_id: receiptDealerId,
            entry_type: "payment",
            entry_date: voucherDate,
            credit: alloc.allocated,
            description: `Receipt Voucher ${voucherNum} against ${alloc.invoice_number}`,
            ref_id: voucher.id,
          });

          // Pro-rata credit ledger entry
          if (alloc.prorata_discount > 0) {
            await supabase.from("ledger_entries").insert({
              dealer_id: receiptDealerId,
              entry_type: "prorata_credit",
              entry_date: voucherDate,
              credit: alloc.prorata_discount,
              description: `PR ${alloc.prorata_rate.toFixed(2)}% (${alloc.days_elapsed}d) on ${alloc.invoice_number}`,
              ref_id: voucher.id,
            });

            // Also update invoice amount_paid with discount
            const { data: inv2 } = await supabase
              .from("invoices")
              .select("amount_paid")
              .eq("id", alloc.invoice_id)
              .single();
            if (inv2) {
              await supabase.from("invoices").update({
                amount_paid: Number(inv2.amount_paid) + alloc.prorata_discount,
              } as any).eq("id", alloc.invoice_id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      if (proRataDiscount > 0) {
        toast.success(`Voucher created! Pro rata credit of ₹${proRataDiscount.toLocaleString("en-IN")} applied.`);
      } else {
        toast.success("Voucher created");
      }
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!voidTarget || !voidReason) throw new Error("Provide a reason");
      const { error } = await supabase.from("vouchers").update({
        status: "void",
        void_reason: voidReason,
        voided_at: new Date().toISOString(),
        voided_by: user?.id,
      }).eq("id", voidTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success("Voucher voided");
      setVoidTarget(null);
      setVoidReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setOpen(false);
    setVoucherType("journal");
    setNarration("");
    setVoucherDate(format(new Date(), "yyyy-MM-dd"));
    setLines([
      { account_id: "", debit: 0, credit: 0, narration: "" },
      { account_id: "", debit: 0, credit: 0, narration: "" },
    ]);
    setProRataAllocations([]);
    setProRataDiscount(0);
  };

  const updateLine = (idx: number, field: keyof VoucherLine, value: any) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const getAccountForType = (type: string) => {
    if (type === "contra") return accounts.filter((a) => ["cash", "bank"].includes(a.account_type));
    return accounts;
  };

  const filteredAccounts = getAccountForType(voucherType);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vouchers</h1>
            <p className="text-muted-foreground">Journal, Contra, Receipt & Payment vouchers</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Voucher</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Voucher</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Voucher Type *</Label>
                    <Select value={voucherType} onValueChange={setVoucherType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VOUCHER_TYPES.map((vt) => (
                          <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Narration</Label>
                    <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Description" />
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Entries (Double-Entry)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { account_id: "", debit: 0, credit: 0, narration: "" }])}>
                      <Plus className="h-3 w-3 mr-1" />Add Line
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Party (optional)</TableHead>
                        <TableHead className="w-[120px]">Debit (₹)</TableHead>
                        <TableHead className="w-[120px]">Credit (₹)</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, i) => {
                        const acct = accounts.find((a) => a.id === line.account_id);
                        const showDealer = acct?.account_type === "dealer";
                        const showSupplier = acct?.account_type === "supplier";
                        return (
                          <TableRow key={i}>
                            <TableCell>
                              <Select value={line.account_id} onValueChange={(v) => updateLine(i, "account_id", v)}>
                                <SelectTrigger className="text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                                <SelectContent>
                                  {filteredAccounts.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {showDealer && (
                                <Select value={line.dealer_id || ""} onValueChange={(v) => updateLine(i, "dealer_id", v)}>
                                  <SelectTrigger className="text-xs"><SelectValue placeholder="Dealer" /></SelectTrigger>
                                  <SelectContent>
                                    {dealers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {showSupplier && (
                                <Select value={line.supplier_id || ""} onValueChange={(v) => updateLine(i, "supplier_id", v)}>
                                  <SelectTrigger className="text-xs"><SelectValue placeholder="Supplier" /></SelectTrigger>
                                  <SelectContent>
                                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {!showDealer && !showSupplier && <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="0" step="0.01" value={line.debit || ""} onChange={(e) => updateLine(i, "debit", Number(e.target.value))} className="text-right text-sm" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="0" step="0.01" value={line.credit || ""} onChange={(e) => updateLine(i, "credit", Number(e.target.value))} className="text-right text-sm" />
                            </TableCell>
                            <TableCell>
                              {lines.length > 2 && (
                                <Button variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}>
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-semibold border-t-2">
                        <TableCell colSpan={2} className="text-right">Total</TableCell>
                        <TableCell className="text-right">₹{totalDebit.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{totalCredit.toFixed(2)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>

                  {!isBalanced && totalDebit + totalCredit > 0 && (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4" />
                      Difference: ₹{Math.abs(totalDebit - totalCredit).toFixed(2)} — Debit & Credit must match
                    </div>
                  )}
                </div>

                {/* Pro Rata section for Receipt vouchers */}
                {voucherType === "receipt" && receiptDealerId && receiptAmount > 0 && (
                  <ReceiptProRata
                    dealerId={receiptDealerId}
                    voucherDate={voucherDate}
                    receiptAmount={receiptAmount}
                    onAllocationsChange={handleAllocationsChange}
                  />
                )}

                {/* Pro rata info hint for receipt type */}
                {voucherType === "receipt" && !receiptDealerId && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/50 rounded-md p-3">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Select a dealer account on the Credit side to enable bill-wise pro rata allocation.
                  </div>
                )}

                <Button className="w-full" disabled={createMutation.isPending || !isBalanced} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? "Creating..." : "Create Voucher"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="journal">Journal</TabsTrigger>
            <TabsTrigger value="contra">Contra</TabsTrigger>
            <TabsTrigger value="receipt">Receipt</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Vouchers</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voucher #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Narration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vouchers.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-sm">{v.voucher_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{v.voucher_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(v.voucher_date), "dd MMM yyyy")}</TableCell>
                          <TableCell className="font-medium">₹{Number(v.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{v.narration || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={v.status === "void" ? "destructive" : "default"} className="capitalize">{v.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {v.status === "active" && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setVoidTarget({ id: v.id, num: v.voucher_number })}>
                                Void
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {vouchers.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No vouchers yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Void Dialog */}
        <Dialog open={!!voidTarget} onOpenChange={(v) => { if (!v) { setVoidTarget(null); setVoidReason(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Void Voucher — {voidTarget?.num}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Input required value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding" />
              </div>
              <Button variant="destructive" className="w-full" disabled={voidMutation.isPending || !voidReason} onClick={() => voidMutation.mutate()}>
                {voidMutation.isPending ? "Voiding..." : "Confirm Void"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
