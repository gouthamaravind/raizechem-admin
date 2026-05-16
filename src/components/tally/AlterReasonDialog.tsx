import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

interface AlterReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
  title: string;
  description?: string;
}

/**
 * Tally-style Alter confirmation. Captures a mandatory reason.
 * Safe strategy: the parent will void the original and open a fresh create dialog
 * prefilled from the source document. The new document gets a new number.
 */
export function AlterReasonDialog({ open, onOpenChange, onConfirm, isPending = false, title, description }: AlterReasonDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setReason(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Alter {title}
          </DialogTitle>
          <DialogDescription>
            {description || "The original voucher will be voided (reversing ledger + stock entries) and a new voucher with a fresh number will be created from its data. You can edit anything before saving."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason for alteration *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this voucher being altered?"
              required
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={!reason.trim() || isPending}
              onClick={() => { onConfirm(reason); setReason(""); }}
            >
              {isPending ? "Preparing..." : "Continue to Alter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
