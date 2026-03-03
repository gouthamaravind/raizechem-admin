import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Calculator, Receipt } from "lucide-react";

export interface ProRataAllocation {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  outstanding: number;
  allocated: number;
  days_elapsed: number;
  prorata_rate: number;
  prorata_discount: number;
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

  // Initialize allocations when invoices load
  useEffect(() => {
    if (outstandingInvoices.length > 0) {
      setAllocations(
        outstandingInvoices.map((inv) => ({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          outstanding: +(inv.total_amount - inv.amount_paid).toFixed(2),
          allocated: 0,
          days_elapsed: 0,
          prorata_rate: 0,
          prorata_discount: 0,
        }))
      );
    } else {
      setAllocations([]);
    }
  }, [outstandingInvoices]);

  // Recalculate pro-rata whenever allocations or date changes
  const computed = useMemo(() => {
    return allocations.map((a) => {
      if (a.allocated <= 0) return { ...a, days_elapsed: 0, prorata_rate: 0, prorata_discount: 0 };

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

  // Notify parent
  useEffect(() => {
    onAllocationsChange(computed.filter((a) => a.allocated > 0), totalDiscount);
  }, [computed, totalDiscount]);

  const updateAllocation = (idx: number, amount: number) => {
    setAllocations((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const capped = Math.min(Math.max(0, amount), a.outstanding);
        return { ...a, allocated: capped };
      })
    );
  };

  // Auto-allocate FIFO
  const autoAllocate = () => {
    let remaining = receiptAmount;
    setAllocations((prev) =>
      prev.map((a) => {
        if (remaining <= 0) return { ...a, allocated: 0 };
        const alloc = Math.min(remaining, a.outstanding);
        remaining -= alloc;
        return { ...a, allocated: +alloc.toFixed(2) };
      })
    );
  };

  if (!dealerId) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Bill-wise Allocation (Pro Rata)
        </Label>
        <button
          type="button"
          onClick={autoAllocate}
          className="text-xs text-primary hover:underline font-medium"
        >
          Auto-allocate (FIFO)
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading invoices...</p>
      ) : outstandingInvoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No outstanding invoices for this dealer.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Outstanding</TableHead>
                  <TableHead className="text-xs text-right w-[120px]">Allocate (₹)</TableHead>
                  <TableHead className="text-xs text-center">Days</TableHead>
                  <TableHead className="text-xs text-right">PR Rate %</TableHead>
                  <TableHead className="text-xs text-right">PR Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computed.map((a, i) => (
                  <TableRow key={a.invoice_id} className={a.allocated > 0 ? "bg-primary/5" : ""}>
                    <TableCell className="font-mono text-xs">{a.invoice_number}</TableCell>
                    <TableCell className="text-xs">{a.invoice_date}</TableCell>
                    <TableCell className="text-right text-xs">
                      ₹{a.outstanding.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={a.outstanding}
                        step="0.01"
                        value={a.allocated || ""}
                        onChange={(e) => updateAllocation(i, Number(e.target.value))}
                        className="text-right text-xs h-8"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {a.allocated > 0 ? (
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
                    <TableCell className="text-right text-xs">
                      {a.allocated > 0 ? `${a.prorata_rate.toFixed(2)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold text-primary">
                      {a.prorata_discount > 0 ? `₹${a.prorata_discount.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
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
                <span>Unallocated (On Account)</span>
                <span>₹{unallocated.toLocaleString("en-IN")}</span>
              </div>
            )}
            {totalDiscount > 0 && (
              <div className="flex justify-between border-t pt-1.5">
                <span className="flex items-center gap-1">
                  <Calculator className="h-3.5 w-3.5 text-primary" />
                  Pro Rata Credit ({maxPct}% / 90 days)
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
