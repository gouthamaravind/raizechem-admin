import { useState, useEffect, useCallback, useMemo } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MapPin, Play, Square, Navigation, ShieldCheck, Activity, Map as MapIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useBackgroundTracking } from "@/hooks/useBackgroundTracking";
import { useDutyTimer } from "@/hooks/useDutyTimer";
import { useLocationCapture } from "@/hooks/useLocationCapture";
import { GMap } from "@/components/maps/GMap";
import { Device } from "@capacitor/device";
import { Badge } from "@/components/ui/badge";


type ActiveSession = {
  id: string;
  start_time: string;
};

const CONSENT_KEY = "fieldops_location_consent_v1";

export default function MobileDuty() {
  const { startDuty, stopDuty, addLocations, getTodaySummary, pendingSync, loading } = useFieldOps();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [liveKm, setLiveKm] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const { startTracking, stopTracking, queue, isTracking } = useBackgroundTracking();
  const { getLocation } = useLocationCapture();
  const elapsed = useDutyTimer(activeSession?.start_time);

  const hasConsent = () => localStorage.getItem(CONSENT_KEY) === "true";

  const getBattery = async () => {
    try {
      const info = await Device.getBatteryInfo();
      if (info.batteryLevel === undefined) return undefined;
      // Force whole number conversion (0-100)
      // On some platforms level is 0.90, on others it might be 90.
      const level = info.batteryLevel <= 1 ? info.batteryLevel * 100 : info.batteryLevel;
      return Math.round(level);
    } catch {
      return undefined;
    }
  };

  const getDeviceInfo = async () => {
    try {
      const info = await Device.getInfo();
      return `${info.manufacturer} ${info.model}`;
    } catch {
      return "Unknown Android";
    }
  };

  const doStart = async () => {
    try {
      const loc = await getLocation();
      const battery = await getBattery();
      await getDeviceInfo();
      const { data, error } = await startDuty(loc.lat, loc.lng, "normal", battery);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession((data as any).session);
      startTracking((data as any).session.id, "normal");
      toast({ title: "Duty Started" });
    } catch {
      const battery = await getBattery();
      const { data, error } = await startDuty(undefined, undefined, "normal", battery);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession((data as any).session);
      startTracking((data as any).session.id, "normal");
      toast({ title: "Duty Started", description: "Location unavailable" });
    }
  };

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await getTodaySummary();
      const summary = data as any;
      if (summary?.active_session) {
        setActiveSession({
          id: summary.active_session.id,
          start_time: summary.active_session.start_time,
        });
        if (!isTracking) startTracking(summary.active_session.id, summary.active_session.tracking_mode || "normal");
      }
      if (typeof summary?.live_km === "number") setLiveKm(summary.live_km);
    } catch { /* noop */ }
  }, [getTodaySummary, startTracking, isTracking]);

  useEffect(() => {
    loadSummary().finally(() => setPageLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleStart = () => {
    if (!hasConsent()) { setShowConsent(true); return; }
    setPendingStart(true);
    doStart().finally(() => setPendingStart(false));
  };

  const handleConsentAccept = () => {
    localStorage.setItem(CONSENT_KEY, "true");
    setShowConsent(false);
    setPendingStart(true);
    doStart().finally(() => setPendingStart(false));
  };


  const handleStop = async () => {
    if (!activeSession) return;
    const battery = await getBattery();
    try {
      const loc = await getLocation();
      const { error } = await stopDuty(activeSession.id, loc.lat, loc.lng, battery);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
    } catch {
      const { error } = await stopDuty(activeSession.id, undefined, undefined, battery);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
    }
    await stopTracking();
    setActiveSession(null);
    toast({ title: "Duty Ended" });
    loadSummary();
  };

  const pathPositions = useMemo(() => {
    if (!queue.length) return [];
    return queue.map(p => ({ lat: p.lat, lng: p.lng }));
  }, [queue]);

  const currentPos = pathPositions.length > 0 ? pathPositions[pathPositions.length - 1] : null;


  const handleManualLocation = async () => {
    if (!activeSession) return;
    try {
      const loc = await getLocation();
      const { error } = await addLocations(activeSession.id, [{ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, recorded_at: new Date().toISOString() }]);
      if (error) toast({ title: "Error", description: error, variant: "destructive" });
      else toast({ title: "Location Captured", description: `Accuracy: ${loc.accuracy.toFixed(0)}m` });
    } catch {
      toast({ title: "Location Error", description: "Unable to capture location", variant: "destructive" });
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
        {isTracking && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span>Background tracking active</span>
              <span className="rounded-full bg-accent px-2 py-0.5 ml-auto text-[10px]">pings: {queue.length}</span>
            </div>

            {/* Path Map */}
            <div className="h-48 w-full rounded-2xl overflow-hidden border border-border shadow-sm relative">
              <GMap
                height="100%"
                center={currentPos || { lat: 17.385, lng: 78.4867 }}
                zoom={15}
                fitBounds={false}
                markers={currentPos ? [{ id: "me", lat: currentPos.lat, lng: currentPos.lng, color: "hsl(var(--primary))" }] : []}
                polylines={pathPositions.length > 1 ? [{ path: pathPositions, color: "hsl(var(--primary))" }] : []}
              />

              <div className="absolute bottom-2 right-2 z-[1000]">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[10px] py-0 px-2 h-5">
                  <MapIcon className="h-2.5 w-2.5 mr-1" /> Live Path
                </Badge>
              </div>
            </div>
          </div>
        )}

        {activeSession ? (
          <div className="space-y-6">
            {/* Timer Display */}
            <div className="rounded-[1.9rem] border border-border bg-card p-6 text-center shadow-sm">
              <div className="mb-4 flex items-center justify-center gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground">
                  On Duty
                </span>
              </div>
              <p className="text-4xl font-mono font-bold tracking-tight text-foreground">{elapsed}</p>
              <p className="mt-2 text-sm font-medium text-primary">{liveKm} km traveled</p>
              <div className="mt-4 grid grid-cols-1">
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Automatic Tracking Status</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">Active ({queue.length} pings)</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStop}
              variant="destructive"
              className="w-full h-14 text-lg gap-2"
              disabled={loading}
            >
              <Square className="h-5 w-5" />
              Stop Duty
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 items-center justify-center py-8">
            <div className="rounded-full bg-accent p-8 text-primary">
              <ShieldCheck className="h-12 w-12" />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Ready to start duty?</h2>
              <p className="text-sm text-muted-foreground">Begin GPS-backed field activity tracking for today.</p>
            </div>

            <Button
              onClick={handleStart}
              className="w-full h-14 text-lg gap-2"
              disabled={loading || pendingStart}
            >
              <Play className="h-5 w-5" />
              Start Duty
            </Button>
          </div>
        )}
      </div>

      {/* Consent Dialog */}
      <Dialog open={showConsent} onOpenChange={setShowConsent}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Location Tracking Consent</DialogTitle>
            <DialogDescription className="py-4 space-y-4">
              <p>
                RaizeChem collects location data to enable automated distance tracking and route history **only while you are on duty**.
              </p>
              <p className="text-foreground font-medium">
                Data is collected in the background even when the app is closed or not in use to ensure accurate kilometer calculation for your travel incentives.
              </p>
              <p>
                Tracking stops immediately when you click "Stop Duty". We do not track your location while you are off-duty.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button className="w-full h-12" onClick={handleConsentAccept}>
              I Agree & Start
            </Button>
            <Button variant="ghost" className="w-full h-12" onClick={() => setShowConsent(false)}>
              Not Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
