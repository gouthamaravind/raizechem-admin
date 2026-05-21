import { useCallback, useEffect, useRef, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Network } from "@capacitor/network";
import { Device } from "@capacitor/device";
import { useFieldOps } from "./useFieldOps";

type TrackingMode = "low" | "normal" | "high";

const INTERVAL_MS: Record<TrackingMode, number> = {
  low: 5 * 60 * 1000,
  normal: 60 * 1000 * 0.5, // ~30s
  high: 20 * 1000,
};

const BATCH_INTERVAL_MS = 2 * 60 * 1000;
const STORAGE_KEY = "fieldops_location_queue";
const MAX_QUEUED_POINTS = 1000;

interface QueuedPoint {
  lat: number;
  lng: number;
  accuracy?: number | null;
  recorded_at: string;
  battery_level?: number;
}

function loadQueue(): QueuedPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedPoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

export function useBackgroundTracking() {
  const { addLocations } = useFieldOps();
  const [isTracking, setIsTracking] = useState(false);
  const [queue, setQueue] = useState<QueuedPoint[]>(loadQueue());
  const watchId = useRef<string | null>(null);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<string | null>(null);
  const modeRef = useRef<TrackingMode>("normal");
  const networkUnsub = useRef<(() => void) | null>(null);

  const persist = useCallback((next: QueuedPoint[]) => {
    setQueue(next);
    saveQueue(next);
  }, []);

  const enqueue = useCallback((point: QueuedPoint) => {
    const next = [...loadQueue(), point].slice(-MAX_QUEUED_POINTS);
    persist(next);
  }, [persist]);

  const flush = useCallback(async () => {
    const sessionId = sessionRef.current;
    if (!sessionId) return;
    const current = loadQueue();
    if (!current.length) return;
    const batch = current.slice(0, 50);
    const remaining = current.slice(50);
    const { error } = await addLocations(sessionId, batch);
    if (error) return; // keep queue for retry
    persist(remaining);
  }, [addLocations, persist]);

  const start = useCallback(async (sessionId: string, mode: TrackingMode = "normal") => {
    if (isTracking) await stop();

    sessionRef.current = sessionId;
    modeRef.current = mode;
    const interval = INTERVAL_MS[mode] || INTERVAL_MS.normal;

    // Request permissions step-by-step for "Always Allow"
    const permStatus = await Geolocation.checkPermissions();
    if (permStatus.location !== 'granted') {
      await Geolocation.requestPermissions();
    }
    
    // For Android, we need to specifically ask for background after foreground is granted
    // Capacitor's requestPermissions doesn't always trigger the background prompt automatically on all versions
    const secondStatus = await Geolocation.checkPermissions();
    if (secondStatus.location === 'granted' && secondStatus.coarseLocation === 'granted') {
       // This will trigger the OS prompt for "Allow all the time" if manifest has ACCESS_BACKGROUND_LOCATION
       try {
         await Geolocation.requestPermissions();
       } catch (e) {
         console.warn("Background permission request failed or already granted", e);
       }
    }

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

    // Watch position (Capacitor keeps running in background more reliably than navigator)
    watchId.current = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 20000,
    }, async (pos, err) => {
      if (err || !pos) return;
      const battery = await getBattery();
      enqueue({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        recorded_at: new Date().toISOString(),
        battery_level: battery,
      });
    });

    // Polling interval to ensure captures even if watch throttles
    batchTimer.current = setInterval(async () => {
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
        const battery = await getBattery();
        enqueue({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          recorded_at: new Date().toISOString(),
          battery_level: battery,
        });
      } catch {
        // Fallback for battery even if GPS fails
        const battery = await getBattery();
        if (battery !== undefined) {
           // We could record a battery-only ping here if needed
        }
      }
      flush();
    }, Math.min(interval, BATCH_INTERVAL_MS));

    // Network listener for offline → online flush
    Network.getStatus().then((status) => { if (status.connected) flush(); });
    const listener = Network.addListener("networkStatusChange", (status) => {
      if (status.connected) flush();
    });
    networkUnsub.current = async () => { const l = await listener; l.remove(); };

    setIsTracking(true);
  }, [enqueue, flush, isTracking]);

  const stop = useCallback(async () => {
    if (watchId.current) {
      await Geolocation.clearWatch({ id: watchId.current });
      watchId.current = null;
    }
    if (batchTimer.current) {
      clearInterval(batchTimer.current);
      batchTimer.current = null;
    }
    if (networkUnsub.current) {
      await networkUnsub.current();
      networkUnsub.current = null;
    }
    await flush();
    sessionRef.current = null;
    setIsTracking(false);
  }, [flush]);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return {
    isTracking,
    queue,
    startTracking: start,
    stopTracking: stop,
    flushQueue: flush,
  };
}
