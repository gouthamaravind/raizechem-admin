import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const OVERDUE_THRESHOLD_DAYS = 120;
const EMPTY_MAP = new Map<string, OverdueDealer>();

export interface OverdueDealer {
  dealer_id: string;
  maxDaysOverdue: number;
  totalOverdue: number;
  overdueInvoiceCount: number;
}

/**
 * Returns a map of dealer_id → overdue info for dealers with any invoice overdue > 120 days.
 */
export function useDealerOverdue() {
  const { data: overdueMap, isLoading } = useQuery({
    queryKey: ["dealer-overdue-120"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, dealer_id, total_amount, amount_paid, due_date, invoice_date")
        .neq("status", "paid")
        .neq("status", "void");
      if (error) throw error;

      const now = new Date();
      const map = new Map<string, OverdueDealer>();

      (data || []).forEach((inv: any) => {
        const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
        if (outstanding <= 0.01) return;

        const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= OVERDUE_THRESHOLD_DAYS) return;

        const existing = map.get(inv.dealer_id);
        if (existing) {
          existing.maxDaysOverdue = Math.max(existing.maxDaysOverdue, daysOverdue);
          existing.totalOverdue += outstanding;
          existing.overdueInvoiceCount += 1;
        } else {
          map.set(inv.dealer_id, {
            dealer_id: inv.dealer_id,
            maxDaysOverdue: daysOverdue,
            totalOverdue: outstanding,
            overdueInvoiceCount: 1,
          });
        }
      });

      return map;
    },
    staleTime: 60_000,
  });

  const safeMap = overdueMap ?? EMPTY_MAP;
  const isOverdue = (dealerId: string) => safeMap.has(dealerId);
  const getOverdue = (dealerId: string) => safeMap.get(dealerId);

  return { overdueMap: safeMap, isOverdue, getOverdue, isLoading };
}
