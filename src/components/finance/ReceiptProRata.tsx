import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Calculator, Receipt, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdjMethod = "agst_ref" | "advance" | "new_ref" | "on_account";

const ADJ_METHODS: { value: AdjMethod; label: string }[] = [
  { value: "agst_ref", label: "Agst Ref" },
  { value: "advance", label: "Advance" },
  { value: "new_ref", label: "New Ref" },
  { value: "on_account", label: "On Account" },
];

export interface ProRataAllocation {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  outstanding: number;
  allocated: number;
  days_elapsed: number;
  prorata_rate: number;
  prorata_discount: number;
  adj_method: AdjMethod;
}

interface ReceiptProRataProps {
  dealerId: string;
  voucherDate: string;
  receiptAmount: number;
  onAllocationsChange: (allocations: ProRataAllocation[], totalDiscount: number) => void;
}

export function ReceiptProRata({ dealerId, voucherDate, receiptAmount, onAllocationsChange }: ReceiptProRataProps) {
  const [allocations, setAllocations] = useState<ProRataAllocation[]>([]);

  const { data: outstandingInvoices = [], isLoading } = useQuery({
    queryKey: ["outstanding-for-receipt", dealerId],
    enabled: !!dealerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total_amount, amount_paid")
        .eq("dealer_id", dealerId)
        .eq("status", "issued")
        .order("invoice_date", { ascending: true });
      if (error) throw error;
      return (data || []).filter((inv) => inv.total_amount - inv.amount_paid > 0.01);
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["prorata-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("prorata_90day_pct").limit(1).single();
      return data;
    },
  });

  const maxPct = settings?.prorata_90day_pct ?? 12;

  // Initialize with one empty Agst Ref line
  useEffect(() => {
    if (outstandingInvoices.length > 0 && allocations.length === 0) {
      setAllocations([createEmptyLine("agst_ref")]);
    }
  }, [outstandingInvoices]);

  function createEmptyLine(method: AdjMethod): ProRataAllocation {
    return {
      invoice_id: "",
      invoice_number: "",
      invoice_date: "",
      outstanding: 0,
      allocated: 0,
      days_elapsed: 0,
      prorata_rate: 0,
      prorata_discount: 0,
      adj_method: method,
    };
  }

  // Recalculate pro-rata whenever allocations or date changes
  const computed = useMemo(() => {
    return allocations.map((a) => {
      // Only Agst Ref lines get PR calculation
      if (a.adj_method !== "agst_ref" || a.allocated <= 0 || !a.invoice_date) {
        return { ...a, days_elapsed: 0, prorata_rate: 0, prorata_discount: 0 };
      }

      const invDate = new Date(a.invoice_date);
      const vDate = new Date(voucherDate);
      const diffMs = vDate.getTime() - invDate.getTime();
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      let rate: number;
      if (days >= 90) {
        rate = maxPct;
      } else {
        rate = +(days * maxPct / 90).toFixed(4);
      }

      const discount = +(a.allocated * rate / 100).toFixed(2);
      return { ...a, days_elapsed: days, prorata_rate: rate, prorata_discount: discount };
    });
  }, [allocations, voucherDate, maxPct]);

  const totalAllocated = computed.reduce((s, a) => s + a.allocated, 0);
  const totalDiscount = computed.reduce((s, a) => s + a.prorata_discount, 0);
  const unallocated = +(receiptAmount - totalAllocated).toFixed(2);

  // Already-selected invoice IDs (to prevent duplicates)
  const selectedInvIds = new Set(allocations.filter((a) => a.invoice_id).map((a) => a.invoice_id));

  // Notify parent
  useEffect(() => {
    onAllocationsChange(computed.filter((a) => a.allocated > 0), totalDiscount);
  }, [computed, totalDiscount]);

  const updateLine = (idx: number, updates: Partial<ProRataAllocation>) => {
    setAllocations((prev) => prev.map((a, i) => (i === idx ? { ...a, ...updates } : a)));
  };

  const addLine = () => {
    setAllocations((prev) => [...prev, createEmptyLine("agst_ref")]);
  };

  const removeLine = (idx: number) => {
    setAllocations((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectInvoice = (idx: number, invoiceId: string) => {
    const inv = outstandingInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const outstanding = +(inv.total_amount - inv.amount_paid).toFixed(2);
    updateLine(idx, {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      outstanding,
      allocated: Math.min(outstanding, Math.max(0, unallocated + (allocations[idx]?.allocated || 0))),
    });
  };

  const changeMethod = (idx: number, method: AdjMethod) => {
    if (method === "agst_ref") {
      updateLine(idx, { adj_method: method, invoice_id: "", invoice_number: "", invoice_date: "", outstanding: 0, allocated: 0 });
    } else if (method === "on_account" || method === "advance" || method === "new_ref") {
      // For non-invoice methods, clear invoice fields
      updateLine(idx, {
        adj_method: method,
        invoice_id: "",
        invoice_number: method === "advance" ? "(Advance)" : method === "new_ref" ? "(New Ref)" : "(On Account)",
        invoice_date: voucherDate,
        outstanding: 0,
        allocated: Math.max(0, unallocated + (allocations[idx]?.allocated || 0)),
      });
    }
  };

  // Auto-allocate FIFO
  const autoAllocate = () => {
    let remaining = receiptAmount;
    const newAllocs: ProRataAllocation[] = outstandingInvoices.map((inv) => {
      const outstanding = +(inv.total_amount - inv.amount_paid).toFixed(2);
      if (remaining <= 0) {
        return { ...createEmptyLine("agst_ref"), invoice_id: inv.id, invoice_number: inv.invoice_number, invoice_date: inv.invoice_date, outstanding, allocated: 0 };
      }
      const alloc = Math.min(remaining, outstanding);
      remaining -= alloc;
      return { ...createEmptyLine("agst_ref"), invoice_id: inv.id, invoice_number: inv.invoice_number, invoice_date: inv.invoice_date, outstanding, allocated: +alloc.toFixed(2) };
    }).filter((a) => a.allocated > 0);

    // If there's remaining after all invoices, add as On Account
    if (remaining > 0.01) {
      newAllocs.push({
        ...createEmptyLine("on_account"),
        invoice_number: "(On Account)",
        invoice_date: voucherDate,
        allocated: +remaining.toFixed(2),
      });
    }

    setAllocations(newAllocs.length > 0 ? newAllocs : [createEmptyLine("agst_ref")]);
  };

  if (!dealerId) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Bill-wise Allocation (Pro Rata)
        </Label>
        <div className="flex gap-2">
          <button type="button" onClick={autoAllocate} className="text-xs text-primary hover:underline font-medium">
            Auto-allocate (FIFO)
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading invoices...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[110px]">Method of Adj.</TableHead>
                  <TableHead className="text-xs">Bill Ref / Name</TableHead>
                  <TableHead className="text-xs text-right">Outstanding</TableHead>
                  <TableHead className="text-xs text-right w-[120px]">Amount (₹)</TableHead>
                  <TableHead className="text-xs text-center">Days</TableHead>
                  <TableHead className="text-xs text-right">PR Rate %</TableHead>
                  <TableHead className="text-xs text-right">PR Discount</TableHead>
                  <TableHead className="text-xs w-[36px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computed.map((a, i) => (
                  <TableRow key={i} className={a.allocated > 0 ? "bg-primary/5" : ""}>
                    {/* Method of Adj. */}
                    <TableCell>
                      <Select value={a.adj_method} onValueChange={(v) => changeMethod(i, v as AdjMethod)}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADJ_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Bill Reference */}
                    <TableCell>
                      {a.adj_method === "agst_ref" ? (
                        <Select value={a.invoice_id || ""} onValueChange={(v) => selectInvoice(i, v)}>
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue placeholder="Select invoice" />
                          </SelectTrigger>
                          <SelectContent>
                            {outstandingInvoices
                              .filter((inv) => inv.id === a.invoice_id || !selectedInvIds.has(inv.id))
                              .map((inv) => (
                                <SelectItem key={inv.id} value={inv.id}>
                                  {inv.invoice_number} ({inv.invoice_date})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {a.adj_method === "advance" && "Advance Payment"}
                          {a.adj_method === "new_ref" && "New Reference"}
                          {a.adj_method === "on_account" && "On Account"}
                        </span>
                      )}
                    </TableCell>

                    {/* Outstanding */}
                    <TableCell className="text-right text-xs">
                      {a.adj_method === "agst_ref" && a.outstanding > 0
                        ? `₹${a.outstanding.toLocaleString("en-IN")}`
                        : "—"}
                    </TableCell>

                    {/* Allocated Amount */}
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={a.adj_method === "agst_ref" ? a.outstanding : undefined}
                        step="0.01"
                        value={a.allocated || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const capped = a.adj_method === "agst_ref" ? Math.min(val, a.outstanding) : val;
                          updateLine(i, { allocated: Math.max(0, capped) });
                        }}
                        className="text-right text-xs h-8"
                      />
                    </TableCell>

                    {/* Days Elapsed */}
                    <TableCell className="text-center">
                      {a.adj_method === "agst_ref" && a.allocated > 0 ? (
                        <Badge
                          variant={a.days_elapsed > 60 ? "destructive" : a.days_elapsed > 30 ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {a.days_elapsed}d
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* PR Rate */}
                    <TableCell className="text-right text-xs">
                      {a.adj_method === "agst_ref" && a.allocated > 0
                        ? `${a.prorata_rate.toFixed(2)}%`
                        : "—"}
                    </TableCell>

                    {/* PR Discount */}
                    <TableCell className="text-right text-xs font-semibold text-primary">
                      {a.prorata_discount > 0
                        ? `₹${a.prorata_discount.toLocaleString("en-IN")}`
                        : "—"}
                    </TableCell>

                    {/* Remove */}
                    <TableCell>
                      {allocations.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeLine(i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                <TableRow className="font-semibold border-t-2 bg-muted/50">
                  <TableCell colSpan={3} className="text-right text-xs">Total</TableCell>
                  <TableCell className="text-right text-xs">₹{totalAllocated.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right text-xs text-primary">
                    {totalDiscount > 0 ? `₹${totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Add line button */}
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3 w-3 mr-1" />Add Line
          </Button>

          {/* Summary panel */}
          <div className="rounded-md bg-background border p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span>Receipt Amount</span>
              <span className="font-medium">₹{receiptAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Allocated</span>
              <span className="font-medium">₹{totalAllocated.toLocaleString("en-IN")}</span>
            </div>
            {unallocated > 0.01 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Unallocated</span>
                <span>₹{unallocated.toLocaleString("en-IN")}</span>
              </div>
            )}
            {totalDiscount > 0 && (
              <div className="flex justify-between border-t pt-1.5">
                <span className="flex items-center gap-1">
                  <Calculator className="h-3.5 w-3.5 text-primary" />
                  Pro Rata Credit ({maxPct}% / 90 days linear)
                </span>
                <span className="font-bold text-primary">₹{totalDiscount.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          {totalAllocated > receiptAmount + 0.01 && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              Allocated exceeds receipt amount by ₹{(totalAllocated - receiptAmount).toFixed(2)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
