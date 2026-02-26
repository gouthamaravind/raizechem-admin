import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  allocViewId: string | null;
  onClose: () => void;
}

export function AdvanceAllocationsView({ allocViewId, onClose }: Props) {
  const { data: allocations = [] } = useQuery({
    queryKey: ["advance-allocations", allocViewId],
    enabled: !!allocViewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advance_allocations" as any)
        .select("id, allocated_amount, allocated_at, invoice_id, invoices(invoice_number, total_amount, invoice_date)")
        .eq("advance_receipt_id", allocViewId!)
        .order("allocated_at");
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Dialog open={!!allocViewId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Advance Allocations</DialogTitle></DialogHeader>
        {(allocations as any[]).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No allocations yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Invoice Total</TableHead>
                <TableHead>Allocated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allocations as any[]).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.invoices?.invoice_number || "—"}</TableCell>
                  <TableCell>{a.invoices?.invoice_date || "—"}</TableCell>
                  <TableCell>₹{Number(a.invoices?.total_amount || 0).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="font-semibold text-primary">₹{Number(a.allocated_amount).toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
