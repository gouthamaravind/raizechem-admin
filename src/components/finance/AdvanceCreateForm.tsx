import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  dealers: any[];
  onSuccess: () => void;
  alteringFrom?: { id: string; receipt_number: string; reason: string } | null;
  initial?: { dealer_id?: string; amount?: number; payment_mode?: string; reference_number?: string; notes?: string } | null;
}

export function AdvanceCreateForm({ dealers, onSuccess, alteringFrom, initial }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dealerId, setDealerId] = useState(initial?.dealer_id || "");
  const [amount, setAmount] = useState(initial?.amount || 0);
  const [mode, setMode] = useState(initial?.payment_mode || "bank_transfer");
  const [refNo, setRefNo] = useState(initial?.reference_number || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);

  const create = useMutation({
    mutationFn: async () => {
      if (!dealerId || amount <= 0) throw new Error("Select dealer and enter amount");

      if (alteringFrom) {
        const { error: vErr } = await supabase.rpc("void_advance_receipt_atomic" as any, {
          p_receipt_id: alteringFrom.id,
          p_reason: `ALTER: ${alteringFrom.reason}`,
          p_voided_by: user?.id,
        });
        if (vErr) throw new Error("Could not void original advance: " + vErr.message);
      }

      const { data, error } = await supabase.rpc("create_advance_receipt_atomic" as any, {
        p_dealer_id: dealerId,
        p_receipt_date: receiptDate,
        p_payment_mode: mode,
        p_reference_number: refNo || null,
        p_amount: amount,
        p_notes: notes || null,
        p_created_by: user?.id,
      });
      if (error) throw error;

      if (alteringFrom && data) {
        const newId = (data as any).receipt_id || (data as any).advance_receipt_id;
        const newNumber = (data as any).receipt_number;
        await supabase.from("audit_logs" as any).insert({
          table_name: "advance_receipts",
          record_id: alteringFrom.id,
          action: "ALTER",
          actor_user_id: user?.id,
          new_data: { alter_reason: alteringFrom.reason, replaced_by_id: newId, replaced_by_number: newNumber, strategy: "void+create" },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advance-receipts"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["dealer-advance-balance"] });
      toast.success(alteringFrom ? "Advance altered — original voided, replacement created" : "Advance receipt created");
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
      <div className="space-y-2">
        <Label>Dealer *</Label>
        <Select value={dealerId} onValueChange={setDealerId}>
          <SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger>
          <SelectContent>{dealers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Amount (₹) *</Label>
          <Input type="number" required min={0.01} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="neft">NEFT</SelectItem>
              <SelectItem value="rtgs">RTGS</SelectItem>
              <SelectItem value="imps">IMPS</SelectItem>
              <SelectItem value="dd">Demand Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Reference No.</Label>
          <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Creating..." : "Create Advance Receipt"}
      </Button>
    </form>
  );
}
