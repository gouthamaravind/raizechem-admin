import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { MapPin, CheckCircle } from "lucide-react";

export default function MobileCheckin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dealerId = params.get("dealer") || "";
  const dealerName = params.get("name") || "Dealer";
  const { checkinVisit, loading } = useFieldOps();
  const [notes, setNotes] = useState("");

  const handleCheckin = async () => {
    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const { data, error } = await checkinVisit(dealerId, undefined, lat, lng, notes || undefined);
    if (error) {
      toast({ title: "Check-in failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Checked In", description: `Visit to ${dealerName} started` });
      navigate(`/m/visits/checkout?visit=${data.visit.id}&name=${encodeURIComponent(dealerName)}`);
    }
  };

  return (
    <MobileLayout title="Check In">
      <div className="space-y-6 max-w-md mx-auto">
        <div className="bg-card rounded-2xl p-6 border border-border text-center">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">{dealerName}</h2>
          <p className="text-sm text-muted-foreground">Check in to this dealer</p>
        </div>

        <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-12 text-base"
        />

        <Button onClick={handleCheckin} className="w-full h-14 text-base gap-2" disabled={loading}>
          <CheckCircle className="h-5 w-5" />
          Check In Now
        </Button>
      </div>
    </MobileLayout>
  );
}
