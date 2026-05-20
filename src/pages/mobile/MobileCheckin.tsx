import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useFieldOps } from "@/hooks/useFieldOps";
import { useLocationCapture } from "@/hooks/useLocationCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapPin, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GMap } from "@/components/maps/GMap";

const ACTIVITY_TYPES = [
  { value: "visit", label: "General Visit" },
  { value: "order", label: "Order Taken" },
  { value: "collection", label: "Payment Collection" },
  { value: "complaint", label: "Complaint" },
  { value: "demo", label: "Product Demo" },
];

export default function MobileCheckin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dealerId = params.get("dealer") || "";
  const dealerName = params.get("name") || "Dealer";
  const { checkinVisit, loading } = useFieldOps();
  const { getLocation } = useLocationCapture();
  const [notes, setNotes] = useState("");
  const [activityType, setActivityType] = useState("visit");
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLocating(true);
      try {
        const loc = await getLocation();
        if (mounted) setPos(loc);
      } catch (e: any) {
        if (mounted) setLocError(e?.message || "Location unavailable");
      } finally {
        if (mounted) setLocating(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleCheckin = async () => {
    let lat = pos?.lat, lng = pos?.lng;
    if (!lat || !lng) {
      try {
        const fresh = await getLocation();
        lat = fresh.lat; lng = fresh.lng;
      } catch {}
    }

    const { data, error } = await checkinVisit(dealerId, undefined, lat, lng, notes || undefined);
    if (error) {
      toast({ title: "Check-in failed", description: error, variant: "destructive" });
      return;
    }
    const visitId = (data as any)?.visit?.id as string | undefined;
    if (visitId) {
      await supabase.from("dealer_visits").update({ activity_type: activityType } as any).eq("id", visitId);
    }
    toast({ title: "Checked In", description: `Visit to ${dealerName} started` });
    navigate(`/m/visits/checkout?visit=${visitId}&name=${encodeURIComponent(dealerName)}&activity=${activityType}`);
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

        {/* Live location preview */}
        <div className="rounded-2xl overflow-hidden border border-border bg-card">
          <div className="h-48 bg-muted">
            {locating ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Locating you…
              </div>
            ) : pos ? (
              <MapContainer
                center={[pos.lat, pos.lng]}
                zoom={16}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <Marker position={[pos.lat, pos.lng]} />
                <Circle
                  center={[pos.lat, pos.lng]}
                  radius={Math.min(pos.accuracy || 30, 200)}
                  pathOptions={{ color: "hsl(142 76% 36%)", fillColor: "hsl(142 76% 36%)", fillOpacity: 0.15, weight: 1 }}
                />
              </MapContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-destructive text-sm p-4 text-center">
                <MapPin className="h-5 w-5 mb-1" />
                {locError || "Could not get your location"}
              </div>
            )}
          </div>
          {pos && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span className="font-mono">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>
              <span>±{Math.round(pos.accuracy)} m</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Activity Type *</Label>
          <Select value={activityType} onValueChange={setActivityType}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
