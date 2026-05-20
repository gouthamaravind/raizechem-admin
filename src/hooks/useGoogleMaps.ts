import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type GoogleMapsApi = { maps?: Record<string, unknown> };

declare global {
  interface Window {
    google?: GoogleMapsApi;
    __googleMapsLoading?: Promise<void>;
    __initGoogleMaps?: () => void;
  }
}

let cachedConfig: { browserKey: string; trackingId?: string } | null = null;

async function fetchMapsConfig(): Promise<{ browserKey: string; trackingId?: string }> {
  if (cachedConfig) return cachedConfig;

  const envBrowserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const envTrackingId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (envBrowserKey) {
    cachedConfig = { browserKey: envBrowserKey, trackingId: envTrackingId };
    return cachedConfig;
  }

  const { data, error } = await supabase.functions.invoke("maps-config");
  if (error || !data?.browserKey) throw new Error("Failed to load Google Maps config");
  cachedConfig = { browserKey: data.browserKey as string, trackingId: data.trackingId as string | undefined };
  return cachedConfig;
}

export function useGoogleMaps(libraries: string[] = ["maps", "marker"]) {
  const librariesParam = libraries.join(",");
  const [ready, setReady] = useState<boolean>(!!window.google?.maps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.google?.maps) { setReady(true); return; }
    let cancelled = false;

    (async () => {
      try {
        if (!window.__googleMapsLoading) {
          const { browserKey, trackingId } = await fetchMapsConfig();
          window.__googleMapsLoading = new Promise<void>((resolve) => {
            window.__initGoogleMaps = () => resolve();
            const s = document.createElement("script");
            const params = new URLSearchParams({
              key: browserKey,
              libraries: librariesParam,
              loading: "async",
              callback: "__initGoogleMaps",
              auth_referrer_policy: "origin",
            });
            if (trackingId) params.set("channel", trackingId);
            s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
            s.async = true;
            s.defer = true;
            s.onerror = () => { setError("Failed to load Google Maps script"); };
            document.head.appendChild(s);
          });
        }
        await window.__googleMapsLoading;
        if (!cancelled) setReady(true);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Maps load failed");
      }
    })();

    return () => { cancelled = true; };
  }, [librariesParam]);

  return { ready, error, google: ready ? window.google : null };
}
