import { useState, useEffect, useRef, useCallback } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { MapPin, Play, Square, Navigation } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function getLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export default function MobileDuty() {
  const { startDuty, stopDuty, addLocations, getTodaySummary, pendingSync, loading } = useFieldOps();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [liveKm, setLiveKm] = useState(0);
  const [elapsed, setElapsed] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const locationIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const loadSummary = useCallback(async () => {
    const { data } = await getTodaySummary();
    if (data) {
      setActiveSession(data.active_session || null);
      setLiveKm(data.live_km || 0);
    }
    setPageLoading(false);
  }, []);

  useEffect(() => {
    loadSummary();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!activeSession) { setElapsed(""); return; }

    const updateElapsed = () => {
      const start = new Date(activeSession.start_time).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    updateElapsed();
    intervalRef.current = setInterval(updateElapsed, 1000);
  }, [activeSession]);

  // Auto-capture location every 3 minutes
  useEffect(() => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    if (!activeSession) return;

    const captureLocation = async () => {
      try {
        const loc = await getLocation();
        await addLocations(activeSession.id, [{ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, recorded_at: new Date().toISOString() }]);
      } catch {}
    };

    locationIntervalRef.current = setInterval(captureLocation, 3 * 60 * 1000);
    return () => { if (locationIntervalRef.current) clearInterval(locationIntervalRef.current); };
  }, [activeSession]);

  const handleStart = async () => {
    try {
      const loc = await getLocation();
      const { data, error } = await startDuty(loc.lat, loc.lng);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession(data.session);
      toast({ title: "Duty Started", description: "Location tracking active" });
    } catch {
      // Start without location
      const { data, error } = await startDuty();
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession(data.session);
      toast({ title: "Duty Started", description: "Location unavailable" });
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;
    try {
      const loc = await getLocation();
      const { error } = await stopDuty(activeSession.id, loc.lat, loc.lng);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
    } catch {
      const { error } = await stopDuty(activeSession.id);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
    }
    setActiveSession(null);
    toast({ title: "Duty Ended" });
    loadSummary();
  };

  const handleManualLocation = async () => {
    if (!activeSession) return;
    try {
      const loc = await getLocation();
      const { error } = await addLocations(activeSession.id, [{ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy }]);
      if (error) toast({ title: "Error", description: error, variant: "destructive" });
      else toast({ title: "Location Captured" });
    } catch (e: any) {
      toast({ title: "Location Error", description: e.message, variant: "destructive" });
    }
  };

  if (pageLoading) {
    return (
      <MobileLayout title="Duty">
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Duty">
      <div className="space-y-6">
        <SyncBadge count={pendingSync.length} />

        {activeSession ? (
          <div className="space-y-6">
            {/* Timer Display */}
            <div className="bg-card rounded-2xl p-6 border border-border text-center shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">On Duty</p>
              <p className="text-4xl font-mono font-bold text-foreground">{elapsed}</p>
              <p className="text-sm text-primary mt-2 font-medium">{liveKm} km traveled</p>
            </div>

            <Button
              onClick={handleManualLocation}
              variant="outline"
              className="w-full h-14 text-base gap-2"
              disabled={loading}
            >
              <Navigation className="h-5 w-5" />
              Add Location Now
            </Button>

            <Button
              onClick={handleStop}
              variant="destructive"
              className="w-full h-14 text-base gap-2"
              disabled={loading}
            >
              <Square className="h-5 w-5" />
              Stop Duty
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center">
              <MapPin className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground">Ready to Start?</h2>
              <p className="text-sm text-muted-foreground">Begin tracking your field activity</p>
            </div>
            <Button
              onClick={handleStart}
              className="w-full h-14 text-lg gap-2"
              disabled={loading}
            >
              <Play className="h-6 w-6" />
              Start Duty
            </Button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
