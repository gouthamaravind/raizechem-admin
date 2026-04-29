import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Send, RefreshCw } from "lucide-react";
import { useFieldCatalog } from "@/hooks/useFieldCatalog";
import { SyncBadge } from "@/components/mobile/SyncBadge";

const MODES = ["cash", "upi", "cheque", "bank_transfer", "neft", "rtgs", "imps", "dd"];

export default function MobileNewPayment() {
  const navigate = useNavigate();
  const { recordPayment, loading, pendingSync } = useFieldOps();
  const { dealers, isLoading, isFetching, refetch, hasCoverageFilter, assignedPincodes } = useFieldCatalog();
  const [dealerId, setDealerId] = useState("");
  const [dealerSearch, setDealerSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");

  const filteredDealers = dealers.filter((d) => d.name.toLowerCase().includes(dealerSearch.toLowerCase()));
  const dealerName = dealers.find((d) => d.id === dealerId)?.name;

  const handleSubmit = async () => {
    if (!dealerId || !amount) { toast({ title: "Dealer and amount required", variant: "destructive" }); return; }
    const { error } = await recordPayment(dealerId, Number(amount), mode, referenceNo || undefined, undefined, notes || undefined);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Payment Recorded" });
      navigate("/m/payments");
    }
  };

  return (
    <MobileLayout title="Record Payment">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <SyncBadge count={pendingSync.length} />
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {hasCoverageFilter && (
          <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Dealer list filtered to your assigned pincodes: {assignedPincodes.join(", ")}
          </div>
        )}

        {/* Dealer */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Dealer</label>
          {dealerId ? (
            <div className="flex items-center justify-between bg-accent rounded-lg p-3">
              <span className="font-medium text-accent-foreground">{dealerName}</span>
              <button onClick={() => setDealerId("")} className="text-xs text-destructive">Change</button>
            </div>
          ) : (
            <>
              <Input placeholder="Search dealer..." value={dealerSearch} onChange={(e) => setDealerSearch(e.target.value)} className="h-11" />
              {isLoading && (
                <div className="space-y-2">
                  <div className="h-10 rounded-lg border border-border bg-card animate-pulse" />
                  <div className="h-10 rounded-lg border border-border bg-card animate-pulse" />
                </div>
              )}
              {dealerSearch && (
                <div className="bg-card border border-border rounded-lg max-h-40 overflow-y-auto">
                  {filteredDealers.slice(0, 10).map((d) => (
                    <button key={d.id} onClick={() => { setDealerId(d.id); setDealerSearch(""); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0">
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Amount ₹</label>
          <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-xl font-bold" min={1} />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Payment Mode</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                }`}
              >
                {m.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <Input placeholder="Reference No. (optional)" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="h-11" />
        <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />

        <Button onClick={handleSubmit} className="w-full h-14 text-base gap-2" disabled={loading || !dealerId || !amount}>
          <Send className="h-5 w-5" />
          Record Payment
        </Button>
      </div>
    </MobileLayout>
  );
}
