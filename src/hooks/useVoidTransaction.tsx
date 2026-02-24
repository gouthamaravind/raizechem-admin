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

      // Mark the record as void
      const { error } = await supabase.from(table).update({
        status: "void",
        void_reason: reason,
        voided_at: new Date().toISOString(),
        voided_by: user?.id,
      } as any).eq("id", id);
      if (error) throw error;

      // Create reversing entries based on table type
      if (table === "invoices") {
        await reverseInvoice(id, user?.id);
      } else if (table === "payments") {
        await reversePayment(id, user?.id);
      } else if (table === "credit_notes") {
        await reverseCreditNote(id, user?.id);
      } else if (table === "debit_notes") {
        await reverseDebitNote(id, user?.id);
      } else if (table === "purchase_invoices") {
        await reversePurchaseInvoice(id, user?.id);
      }
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-available"] });
      toast.success("Transaction voided with reversing entries");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

async function reverseInvoice(invoiceId: string, userId?: string) {
  // Get invoice details
  const { data: inv } = await supabase.from("invoices").select("*, invoice_items(*)").eq("id", invoiceId).single();
  if (!inv) return;

  // Reversing ledger entry (credit to offset the original debit)
  await supabase.from("ledger_entries").insert({
    dealer_id: inv.dealer_id,
    entry_date: new Date().toISOString().split("T")[0],
    entry_type: "void",
    ref_id: invoiceId,
    description: `VOID: Invoice ${inv.invoice_number}`,
    debit: 0,
    credit: Number(inv.total_amount),
  });

  // Reverse inventory (add stock back)
  const items = (inv as any).invoice_items || [];
  for (const item of items) {
    // Restore batch qty
    const { data: batch } = await supabase.from("product_batches").select("current_qty").eq("id", item.batch_id).single();
    if (batch) {
      await supabase.from("product_batches").update({
        current_qty: Number(batch.current_qty) + Number(item.qty),
      }).eq("id", item.batch_id);
    }
    // Reversing inventory txn
    await supabase.from("inventory_txn").insert({
      txn_type: "ADJUSTMENT" as any,
      ref_type: "void_invoice",
      ref_id: invoiceId,
      product_id: item.product_id,
      batch_id: item.batch_id,
      qty_in: Number(item.qty),
      qty_out: 0,
      rate: Number(item.rate),
      created_by: userId,
      notes: `VOID reversal: Invoice ${inv.invoice_number}`,
    });
  }

  // Reset amount_paid on the invoice
  await supabase.from("invoices").update({ amount_paid: 0 } as any).eq("id", invoiceId);
}

async function reversePayment(paymentId: string, userId?: string) {
  const { data: pmt } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  if (!pmt) return;

  // Reversing ledger entry (debit to offset the original credit)
  await supabase.from("ledger_entries").insert({
    dealer_id: pmt.dealer_id,
    entry_date: new Date().toISOString().split("T")[0],
    entry_type: "void",
    ref_id: paymentId,
    description: `VOID: Payment ₹${Number(pmt.amount).toLocaleString("en-IN")}`,
    debit: Number(pmt.amount),
    credit: 0,
  });

  // Note: we don't reverse invoice amount_paid here as it would require
  // knowing which invoices were auto-applied. This keeps the ledger correct
  // and outstanding will reflect from ledger balance.
}

async function reverseCreditNote(cnId: string, userId?: string) {
  const { data: cn } = await supabase.from("credit_notes").select("*, credit_note_items(*)").eq("id", cnId).single();
  if (!cn) return;

  // Reversing ledger entry (debit to offset the original credit)
  await supabase.from("ledger_entries").insert({
    dealer_id: cn.dealer_id,
    entry_date: new Date().toISOString().split("T")[0],
    entry_type: "void",
    ref_id: cnId,
    description: `VOID: Credit Note ${cn.credit_note_number}`,
    debit: Number(cn.total_amount),
    credit: 0,
  });

  // Reverse inventory (remove stock that was added back)
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

  // Reverse inventory (add stock back that was removed)
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

  // Reverse inventory (remove stock that was added)
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
}
