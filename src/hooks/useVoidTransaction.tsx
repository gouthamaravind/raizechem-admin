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

      // Use atomic server-side functions for invoices and payments
      if (table === "invoices") {
        const { error } = await supabase.rpc("void_invoice_atomic" as any, {
          p_invoice_id: id,
          p_reason: reason,
          p_voided_by: user?.id,
        });
        if (error) throw error;
        return;
      }

      if (table === "payments") {
        const { error } = await supabase.rpc("void_payment_atomic" as any, {
          p_payment_id: id,
          p_reason: reason,
          p_voided_by: user?.id,
        });
        if (error) throw error;
        return;
      }

      // For other tables, use the existing client-side approach
      const { error } = await supabase.from(table).update({
        status: "void",
        void_reason: reason,
        voided_at: new Date().toISOString(),
        voided_by: user?.id,
      } as any).eq("id", id);
      if (error) throw error;

      if (table === "credit_notes") {
        await reverseCreditNote(id, user?.id);
      } else if (table === "debit_notes") {
        await reverseDebitNote(id, user?.id);
        await reverseDebitNoteSupplierLedger(id);
      } else if (table === "purchase_invoices") {
        await reversePurchaseInvoice(id, user?.id);
      }
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-available"] });
      qc.invalidateQueries({ queryKey: ["outstanding-invoices"] });
      toast.success("Transaction voided with reversing entries");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

async function reverseCreditNote(cnId: string, userId?: string) {
  const { data: cn } = await supabase.from("credit_notes").select("*, credit_note_items(*)").eq("id", cnId).single();
  if (!cn) return;

  await supabase.from("ledger_entries").insert({
    dealer_id: cn.dealer_id,
    entry_date: new Date().toISOString().split("T")[0],
    entry_type: "void",
    ref_id: cnId,
    description: `VOID: Credit Note ${cn.credit_note_number}`,
    debit: Number(cn.total_amount),
    credit: 0,
  });

  const items = (cn as any).credit_note_items || [];
  for (const item of items) {
    const { data: batch } = await supabase.from("product_batches").select("current_qty").eq("id", item.batch_id).single();
    if (batch) {
      await supabase.from("product_batches").update({
        current_qty: Math.max(0, Number(batch.current_qty) - Number(item.qty)),
      }).eq("id", item.batch_id);
    }
    await supabase.from("inventory_txn").insert({
      txn_type: "ADJUSTMENT" as any,
      ref_type: "void_credit_note",
      ref_id: cnId,
      product_id: item.product_id,
      batch_id: item.batch_id,
      qty_in: 0,
      qty_out: Number(item.qty),
      rate: Number(item.rate),
      created_by: userId,
      notes: `VOID reversal: Credit Note ${cn.credit_note_number}`,
    });
  }
}

async function reverseDebitNote(dnId: string, userId?: string) {
  const { data: dn } = await supabase.from("debit_notes").select("*, debit_note_items(*)").eq("id", dnId).single();
  if (!dn) return;

  const items = (dn as any).debit_note_items || [];
  for (const item of items) {
    const { data: batch } = await supabase.from("product_batches").select("current_qty").eq("id", item.batch_id).single();
    if (batch) {
      await supabase.from("product_batches").update({
        current_qty: Number(batch.current_qty) + Number(item.qty),
      }).eq("id", item.batch_id);
    }
    await supabase.from("inventory_txn").insert({
      txn_type: "ADJUSTMENT" as any,
      ref_type: "void_debit_note",
      ref_id: dnId,
      product_id: item.product_id,
      batch_id: item.batch_id,
      qty_in: Number(item.qty),
      qty_out: 0,
      rate: Number(item.rate),
      created_by: userId,
      notes: `VOID reversal: Debit Note ${dn.debit_note_number}`,
    });
  }
}

async function reversePurchaseInvoice(piId: string, userId?: string) {
  const { data: pi } = await supabase.from("purchase_invoices").select("*, purchase_invoice_items(*)").eq("id", piId).single();
  if (!pi) return;

  await supabase.from("supplier_ledger_entries" as any).insert({
    supplier_id: pi.supplier_id,
    entry_date: new Date().toISOString().split("T")[0],
    entry_type: "void",
    ref_id: piId,
    description: `VOID: Purchase Invoice ${pi.pi_number}`,
    debit: Number(pi.total_amount),
    credit: 0,
  });

  const items = (pi as any).purchase_invoice_items || [];
  for (const item of items) {
    if (!item.batch_id) continue;
    const { data: batch } = await supabase.from("product_batches").select("current_qty").eq("id", item.batch_id).single();
    if (batch) {
      await supabase.from("product_batches").update({
        current_qty: Math.max(0, Number(batch.current_qty) - Number(item.qty)),
      }).eq("id", item.batch_id);
    }
    await supabase.from("inventory_txn").insert({
      txn_type: "ADJUSTMENT" as any,
      ref_type: "void_purchase_invoice",
      ref_id: piId,
      product_id: item.product_id,
      batch_id: item.batch_id,
      qty_in: 0,
      qty_out: Number(item.qty),
      rate: Number(item.rate),
      created_by: userId,
      notes: `VOID reversal: Purchase Invoice ${pi.pi_number}`,
    });
  }

  await supabase.from("purchase_invoices").update({ amount_paid: 0 } as any).eq("id", piId);
}

async function reverseDebitNoteSupplierLedger(dnId: string) {
  const { data: dn } = await supabase.from("debit_notes").select("*").eq("id", dnId).single();
  if (!dn) return;

  await supabase.from("supplier_ledger_entries" as any).insert({
    supplier_id: dn.supplier_id,
    entry_date: new Date().toISOString().split("T")[0],
    entry_type: "void",
    ref_id: dnId,
    description: `VOID: Debit Note ${dn.debit_note_number}`,
    debit: 0,
    credit: Number(dn.total_amount),
  });
}
