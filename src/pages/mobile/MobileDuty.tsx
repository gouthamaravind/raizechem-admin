import { useState, useEffect, useCallback } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin, Play, Square, Navigation, Settings, ShieldCheck, Activity, BatteryCharging } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useBackgroundTracking } from "@/hooks/useBackgroundTracking";
import { useDutyTimer } from "@/hooks/useDutyTimer";
import { useLocationCapture } from "@/hooks/useLocationCapture";

type TrackingMode = "low" | "normal" | "high";

const TRACKING_LABELS: Record<TrackingMode, string> = {
  low: "Low (every 5 min)",
  normal: "Normal (~30 sec)",
  high: "High (~20 sec)",
};

const CONSENT_KEY = "fieldops_location_consent";

type ActiveSession = {
  id: string;
  start_time: string;
  tracking_mode?: string | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unable to capture current location";
}

export default function MobileDuty() {
  const { startDuty, stopDuty, addLocations, getTodaySummary, pendingSync, loading } = useFieldOps();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [liveKm, setLiveKm] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("normal");
  const [showSettings, setShowSettings] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const { startTracking, stopTracking, queue, flushQueue, isTracking } = useBackgroundTracking();
  const { getLocation } = useLocationCapture();
  const elapsed = useDutyTimer(activeSession?.start_time);

  const hasConsent = () => localStorage.getItem(CONSENT_KEY) === "true";

  const loadSummary = useCallback(async () => {
    const { data } = await getTodaySummary();
    const d = data as any;
    if (d) {
      setActiveSession(d.active_session || null);
      setLiveKm(d.live_km || 0);
      if (d.active_session?.tracking_mode) {
        setTrackingMode(d.active_session.tracking_mode as TrackingMode);
      }
    }
    setPageLoading(false);
  }, []);

  useEffect(() => {
    loadSummary();
    return () => undefined;
  }, []);

  // Resume background tracking if a session is already active when the page mounts
  useEffect(() => {
    if (activeSession && !isTracking) {
      startTracking(activeSession.id, trackingMode);
    }
    if (!activeSession && isTracking) {
      stopTracking();
    }
  }, [activeSession, trackingMode, isTracking, startTracking, stopTracking]);

  const doStart = async () => {
    try {
      const loc = await getLocation();
      const { data, error } = await startDuty(loc.lat, loc.lng, trackingMode);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession(data.session);
      startTracking(data.session.id, trackingMode);
      toast({ title: "Duty Started", description: `Tracking: ${TRACKING_LABELS[trackingMode]}` });
    } catch {
      const { data, error } = await startDuty(undefined, undefined, trackingMode);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession(data.session);
      startTracking(data.session.id, trackingMode);
      toast({ title: "Duty Started", description: "Location unavailable" });
    }
  };

  const handleStart = async () => {
    if (!hasConsent()) {
      setPendingStart(true);
      setShowConsent(true);
      return;
    }
    await doStart();
  };

  const handleConsentAccept = async () => {
    localStorage.setItem(CONSENT_KEY, "true");
    setShowConsent(false);
    if (pendingStart) {
      setPendingStart(false);
      await doStart();
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
    await stopTracking();
    setActiveSession(null);
    toast({ title: "Duty Ended" });
    loadSummary();
  };

  const handleManualLocation = async () => {
    if (!activeSession) return;
    try {
      const loc = await getLocation();
      const { error } = await addLocations(activeSession.id, [{ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, recorded_at: new Date().toISOString() }]);
      if (error) toast({ title: "Error", description: error, variant: "destructive" });
      else toast({ title: "Location Captured", description: `Accuracy: ${loc.accuracy.toFixed(0)}m` });
    } catch (error) {
      toast({ title: "Location Error", description: getErrorMessage(error), variant: "destructive" });
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
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>Background tracking active</span>
            <span className="rounded-full bg-accent px-2 py-0.5">queued: {queue.length}</span>
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
              <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Tracking: {TRACKING_LABELS[trackingMode]}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Queue</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{queue.length}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Mode</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{trackingMode}</p>
                </div>
              </div>
            </div>

            {/* Tracking Mode Selector */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowSettings(true)}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <Settings className="h-4 w-4" />
                Tune Tracking
              </Button>
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
            <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-border bg-card shadow-lg shadow-primary/10">
              <img src="/raizechem-field-logo.png" alt="RaizeChem" className="h-16 w-16 object-contain" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Ready to start duty?</h2>
              <p className="text-sm text-muted-foreground">Begin GPS-backed field activity tracking for today.</p>
            </div>

            {/* Pre-start tracking mode */}
            <div className="w-full space-y-3 rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BatteryCharging className="h-4 w-4 text-primary" />
                <span>Tracking Mode</span>
              </div>
              <Select value={trackingMode} onValueChange={(v) => setTrackingMode(v as TrackingMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{TRACKING_LABELS.low}</SelectItem>
                  <SelectItem value="normal">{TRACKING_LABELS.normal}</SelectItem>
                  <SelectItem value="high">{TRACKING_LABELS.high}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Choose a balanced mode for routine visits, or high accuracy for route-heavy days.
              </p>
            </div>

            <Button
              onClick={handleStart}
              className="w-full h-14 text-lg gap-2"
              disabled={loading}
            >
              <Play className="h-5 w-5" />
              Start Duty
            </Button>
          </div>
        )}
      </div>

      {/* Tracking Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tracking Settings</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Capture Frequency</Label>
              <Select value={trackingMode} onValueChange={(v) => setTrackingMode(v as TrackingMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{TRACKING_LABELS.low}</SelectItem>
                  <SelectItem value="normal">{TRACKING_LABELS.normal}</SelectItem>
                  <SelectItem value="high">{TRACKING_LABELS.high}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Higher frequency = more accurate distance but uses more battery and data.
              </p>
            </div>
            <Button className="w-full" onClick={() => setShowSettings(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location Consent Dialog */}
      <Dialog open={showConsent} onOpenChange={(v) => { if (!v) { setShowConsent(false); setPendingStart(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Location Permission
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-foreground leading-relaxed">
              Raizechem collects your device location <strong>only while you are on duty</strong> to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Calculate distance traveled for incentive computation</li>
              <li>Record dealer visit check-in / check-out locations</li>
              <li>Generate route reports for your daily activity summary</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Location data is encrypted and stored securely. Points older than 30 days are summarized 
              and detailed GPS coordinates are removed. Your location is <strong>never tracked</strong> when 
              duty is not active. You can change tracking frequency in settings.
            </p>
            <p className="text-xs text-muted-foreground border-t pt-3">
              By tapping "I Agree", you consent to location collection during active duty sessions as described above.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowConsent(false); setPendingStart(false); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleConsentAccept}>
                I Agree & Start
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
