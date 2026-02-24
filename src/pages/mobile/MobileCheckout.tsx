import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { LogOut } from "lucide-react";

export default function MobileCheckout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const visitId = params.get("visit") || "";
  const dealerName = params.get("name") || "Dealer";
  const { checkoutVisit, loading } = useFieldOps();
  const [notes, setNotes] = useState("");

  const handleCheckout = async () => {
    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const { error } = await checkoutVisit(visitId, lat, lng, notes || undefined);
    if (error) {
      toast({ title: "Check-out failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Checked Out", description: `Visit to ${dealerName} completed` });
      navigate("/m/dealers");
    }
  };

  return (
    <MobileLayout title="Check Out">
      <div className="space-y-6 max-w-md mx-auto">
        <div className="bg-card rounded-2xl p-6 border border-border text-center">
          <h2 className="text-lg font-bold text-foreground">{dealerName}</h2>
          <p className="text-sm text-muted-foreground">Ready to check out?</p>
        </div>

        <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-12 text-base"
        />

        <Button onClick={handleCheckout} variant="destructive" className="w-full h-14 text-base gap-2" disabled={loading}>
          <LogOut className="h-5 w-5" />
          Check Out
        </Button>
      </div>
    </MobileLayout>
  );
}
