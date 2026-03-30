import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranch } from "@/hooks/useBranch";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const { activeBranch } = useBranch();
  const navigate = useNavigate();

  const { data: overdueInvoices = [] } = useQuery({
    queryKey: ["notifications-overdue", activeBranchId],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("id, invoice_number, dealer_id, total_amount, amount_paid, due_date, dealers(name)")
        .not("status", "eq", "void")
        .not("status", "eq", "paid")
        .lt("due_date", new Date().toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(20);

      if (activeBranchId) {
        query = query.eq("branch_id", activeBranchId);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
    enabled: !!session,
    refetchInterval: 5 * 60 * 1000, // 5 min
  });

  const { data: lowStockBatches = [] } = useQuery({
    queryKey: ["notifications-lowstock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_batches")
        .select("id, batch_no, current_qty, products(name)")
        .lte("current_qty", 10)
        .gt("current_qty", 0)
        .order("current_qty", { ascending: true })
        .limit(10);
      if (error) return [];
      return data || [];
    },
    enabled: !!session,
    refetchInterval: 10 * 60 * 1000,
  });

  const totalCount = overdueInvoices.length + lowStockBatches.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <p className="text-xs text-muted-foreground">{totalCount} alerts</p>
        </div>
        <ScrollArea className="max-h-80">
          {totalCount === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              All clear! No pending alerts.
            </div>
          )}

          {overdueInvoices.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Overdue Invoices</p>
              {overdueInvoices.map((inv: any) => {
                const days = differenceInDays(new Date(), new Date(inv.due_date));
                const due = inv.total_amount - inv.amount_paid;
                return (
                  <button
                    key={inv.id}
                    onClick={() => { setOpen(false); navigate("/finance/outstanding"); }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(inv.dealers as any)?.name} · ₹{due.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      {days}d
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}

          {lowStockBatches.length > 0 && (
            <div className="px-3 py-2 border-t">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Low Stock</p>
              {lowStockBatches.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => { setOpen(false); navigate("/inventory/alerts"); }}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{(b.products as any)?.name}</p>
                    <p className="text-xs text-muted-foreground">Batch: {b.batch_no}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {b.current_qty} left
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
