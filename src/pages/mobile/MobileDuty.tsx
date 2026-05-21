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
import { supabase } from "@/integrations/supabase/client";

type ActiveSession = {
  id: string;
  start_time: string;
};

const CONSENT_KEY = "fieldops_location_consent_v1";

const appendUniquePoint = (points: { lat: number; lng: number }[], point: { lat: number; lng: number }) => {
  const last = points[points.length - 1];
  if (last && Math.abs(last.lat - point.lat) < 0.000001 && Math.abs(last.lng - point.lng) < 0.000001) {
    return points;
  }
  return [...points, point];
};

export default function MobileDuty() {
  const { startDuty, stopDuty, getTodaySummary, pendingSync, loading } = useFieldOps();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [liveKm, setLiveKm] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const { startTracking, stopTracking, queue, isTracking } = useBackgroundTracking();
  const { getLocation } = useLocationCapture();
  const elapsed = useDutyTimer(activeSession?.start_time);
  const [dbPoints, setDbPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);

  const hasConsent = () => localStorage.getItem(CONSENT_KEY) === "true";

  const getBattery = async () => {
    try {
      const info = await Device.getBatteryInfo();
      if (info.batteryLevel === undefined) return undefined;
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

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await getTodaySummary();
      const summary = data as any;
      if (summary?.active_session) {
        const sessId = summary.active_session.id;
        setActiveSession({
          id: sessId,
          start_time: summary.active_session.start_time,
        });
        if (!isTracking) startTracking(sessId, "normal");

        // Initial fetch of points for the trail
        const { data: pts } = await supabase
          .from("location_points")
          .select("lat,lng")
          .eq("duty_session_id", sessId)
          .order("recorded_at", { ascending: true });
        if (pts) {
          const points = pts.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
          setDbPoints(points);
          if (points.length) setLivePos(points[points.length - 1]);
        }
      } else {
        setActiveSession(null);
        setDbPoints([]);
        setLivePos(null);
      }
      if (typeof summary?.live_km === "number") setLiveKm(summary.live_km);
    } catch (e) {
      console.error("loadSummary failed", e);
    }
  }, [getTodaySummary, isTracking, startTracking]);

  // Real-time listener for new points to keep the trail updated
  useEffect(() => {
    if (!activeSession) { setDbPoints([]); return; }
    
    const channel = supabase
      .channel(`session-points-${activeSession.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_points", filter: `duty_session_id=eq.${activeSession.id}` },
        (payload) => {
          const newPt = { lat: Number(payload.new.lat), lng: Number(payload.new.lng) };
          setDbPoints(prev => [...prev, newPt]);
        }
      )
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [activeSession]);

  // Periodic KM refresh while on duty
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await getTodaySummary();
        const summary = data as any;
        if (typeof summary?.live_km === "number") {
          setLiveKm(summary.live_km);
        }
      } catch { /* noop */ }
    }, 60000);
    return () => clearInterval(interval);
  }, [activeSession, getTodaySummary]);

  // Keep the visible marker fresh even before the background batch sync completes.
  useEffect(() => {
    if (!activeSession) return;
    let cancelled = false;
    const refreshLivePosition = async () => {
      try {
        const loc = await getLocation();
        if (cancelled) return;
        const point = { lat: loc.lat, lng: loc.lng };
        setLivePos(point);
        setDbPoints((prev) => appendUniquePoint(prev, point));
      } catch {
        // Keep the last known point on screen when GPS is temporarily unavailable.
      }
    };
    void refreshLivePosition();
    const interval = setInterval(refreshLivePosition, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeSession, getLocation]);

  useEffect(() => {
    // Never block UI more than 4s — render the page even if summary fetch hangs
    const safety = setTimeout(() => setPageLoading(false), 4000);
    loadSummary().finally(() => {
      clearTimeout(safety);
      setPageLoading(false);
    });
    return () => clearTimeout(safety);
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

  const doStart = async () => {
    try {
      const loc = await getLocation();
      const battery = await getBattery();
      const device = await getDeviceInfo();
      const { data, error } = await startDuty(loc.lat, loc.lng, "normal", battery, device);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      const session = (data as any).session;
      setActiveSession(session);
      setLivePos({ lat: loc.lat, lng: loc.lng });
      setDbPoints([{ lat: loc.lat, lng: loc.lng }]);
      startTracking(session.id, "normal");
      toast({ title: "Duty Started" });
    } catch (e: any) {
      const battery = await getBattery();
      const device = await getDeviceInfo();
      const { data, error } = await startDuty(undefined, undefined, "normal", battery, device);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      const session = (data as any).session;
      setActiveSession(session);
      startTracking(session.id, "normal");
      toast({ title: "Duty Started", description: "Location unavailable" });
    }
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
    setDbPoints([]);
    toast({ title: "Duty Ended" });
    loadSummary();
  };

  const pathPositions = useMemo(() => {
    const local = queue.map(p => ({ lat: p.lat, lng: p.lng }));
    const combined = [...dbPoints, ...local];
    return livePos ? appendUniquePoint(combined, livePos) : combined;
  }, [dbPoints, queue, livePos]);

  const currentPos = pathPositions.length > 0 
    ? pathPositions[pathPositions.length - 1] 
    : livePos;

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

        {activeSession && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span>Background tracking active</span>
              <span className="rounded-full bg-accent px-2 py-0.5 ml-auto text-[10px]">pings: {queue.length}</span>
            </div>

            <div className="h-64 w-full rounded-2xl overflow-hidden border border-border shadow-sm relative">
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
            <div className="rounded-[1.9rem] border border-border bg-card p-6 text-center shadow-sm">
              <div className="mb-4 flex items-center justify-center gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground">
                  On Duty
                </span>
              </div>
              <p className="text-4xl font-mono font-bold tracking-tight text-foreground">{elapsed}</p>
              <p className="mt-2 text-sm font-medium text-primary">{liveKm.toFixed(2)} km traveled</p>
              <div className="mt-4 grid grid-cols-1">
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tracking Heartbeat</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">Active</p>
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

      <Dialog open={showConsent} onOpenChange={setShowConsent}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Location Tracking Consent</DialogTitle>
            <DialogDescription className="py-4 space-y-4">
              <p>
                RaizeChem collects location data to enable automated distance tracking and route history **only while you are on duty**.
              </p>
              <p className="text-foreground font-medium">
                Data is collected in the background even when the app is closed or not in use to ensure accurate kilometer calculation.
              </p>
              <p>
                Tracking stops immediately when you click "Stop Duty".
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
