import { useState, useEffect, useRef, useCallback } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin, Play, Square, Navigation, Settings, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type TrackingMode = "low" | "normal" | "high";

const TRACKING_INTERVALS: Record<TrackingMode, number> = {
  low: 5 * 60 * 1000,
  normal: 3 * 60 * 1000,
  high: 1 * 60 * 1000,
};

const TRACKING_LABELS: Record<TrackingMode, string> = {
  low: "Low (every 5 min)",
  normal: "Normal (every 3 min)",
  high: "High (every 1 min)",
};

const CONSENT_KEY = "fieldops_location_consent";

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
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("normal");
  const [showSettings, setShowSettings] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const locationIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const hasConsent = () => localStorage.getItem(CONSENT_KEY) === "true";

  const loadSummary = useCallback(async () => {
    const { data } = await getTodaySummary();
    if (data) {
      setActiveSession(data.active_session || null);
      setLiveKm(data.live_km || 0);
      if (data.active_session?.tracking_mode) {
        setTrackingMode(data.active_session.tracking_mode as TrackingMode);
      }
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

  // Auto-capture location based on tracking mode
  useEffect(() => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    if (!activeSession) return;

    const interval = TRACKING_INTERVALS[trackingMode] || TRACKING_INTERVALS.normal;

    const captureLocation = async () => {
      try {
        const loc = await getLocation();
        if (loc.accuracy > 100) {
          // High inaccuracy — still send but flag it; server will validate
          console.warn(`Low accuracy GPS: ${loc.accuracy.toFixed(0)}m`);
        }
        await addLocations(activeSession.id, [{
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          recorded_at: new Date().toISOString(),
        }]);
      } catch {}
    };

    locationIntervalRef.current = setInterval(captureLocation, interval);
    return () => { if (locationIntervalRef.current) clearInterval(locationIntervalRef.current); };
  }, [activeSession, trackingMode]);

  const doStart = async () => {
    try {
      const loc = await getLocation();
      const { data, error } = await startDuty(loc.lat, loc.lng, trackingMode);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession(data.session);
      toast({ title: "Duty Started", description: `Tracking: ${TRACKING_LABELS[trackingMode]}` });
    } catch {
      const { data, error } = await startDuty(undefined, undefined, trackingMode);
      if (error) { toast({ title: "Error", description: error, variant: "destructive" }); return; }
      setActiveSession(data.session);
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
      else toast({ title: "Location Captured", description: `Accuracy: ${loc.accuracy.toFixed(0)}m` });
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
              <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Tracking: {TRACKING_LABELS[trackingMode]}</span>
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
                Tracking Settings
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
            <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center">
              <MapPin className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground">Ready to Start?</h2>
              <p className="text-sm text-muted-foreground">Begin tracking your field activity</p>
            </div>

            {/* Pre-start tracking mode */}
            <div className="w-full space-y-2">
              <Label className="text-sm text-muted-foreground">Tracking Mode</Label>
              <Select value={trackingMode} onValueChange={(v) => setTrackingMode(v as TrackingMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{TRACKING_LABELS.low}</SelectItem>
                  <SelectItem value="normal">{TRACKING_LABELS.normal}</SelectItem>
                  <SelectItem value="high">{TRACKING_LABELS.high}</SelectItem>
                </SelectContent>
              </Select>
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
