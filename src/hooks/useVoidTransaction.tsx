import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type VoidableTable = "invoices" | "payments" | "credit_notes" | "debit_notes" | "purchase_invoices";

interface VoidOptions {
  table: VoidableTable;
  invalidateKeys: string[][];
}

export function useVoidTransaction({ table, invalidateKeys }: VoidOptions) {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!reason.trim()) throw new Error("Void reason is required");

      if (table === "invoices") {
        const { error } = await supabase.rpc("void_invoice_atomic" as any, {
          p_invoice_id: id, p_reason: reason, p_voided_by: user?.id,
        });
        if (error) throw error;
        return;
      }

      if (table === "payments") {
        const { error } = await supabase.rpc("void_payment_atomic" as any, {
          p_payment_id: id, p_reason: reason, p_voided_by: user?.id,
        });
        if (error) throw error;
        return;
      }

      if (table === "purchase_invoices") {
        const { error } = await supabase.rpc("void_purchase_invoice_atomic" as any, {
          p_pi_id: id, p_reason: reason, p_voided_by: user?.id,
        });
        if (error) throw error;
        return;
      }

      if (table === "credit_notes") {
        const { error } = await supabase.rpc("void_credit_note_atomic" as any, {
          p_cn_id: id, p_reason: reason, p_voided_by: user?.id,
        });
        if (error) throw error;
        return;
      }

      if (table === "debit_notes") {
        const { error } = await supabase.rpc("void_debit_note_atomic" as any, {
          p_dn_id: id, p_reason: reason, p_voided_by: user?.id,
        });
        if (error) throw error;
        return;
      }
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["supplier-ledger"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-available"] });
      qc.invalidateQueries({ queryKey: ["outstanding-invoices"] });
      qc.invalidateQueries({ queryKey: ["supplier-outstanding"] });
      toast.success("Transaction voided with reversing entries");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
