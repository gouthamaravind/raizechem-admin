import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    google?: any;
    __googleMapsLoading?: Promise<void>;
    __initGoogleMaps?: () => void;
  }
}

let cachedKey: string | null = null;

async function fetchBrowserKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const { data, error } = await supabase.functions.invoke("maps-config");
  if (error || !data?.browserKey) throw new Error("Failed to load Google Maps config");
  cachedKey = data.browserKey as string;
  return cachedKey;
}

export function useGoogleMaps(libraries: string[] = ["maps", "marker"]) {
  const [ready, setReady] = useState<boolean>(!!window.google?.maps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.google?.maps) { setReady(true); return; }
    let cancelled = false;

    (async () => {
      try {
        if (!window.__googleMapsLoading) {
          const key = await fetchBrowserKey();
          window.__googleMapsLoading = new Promise<void>((resolve) => {
            window.__initGoogleMaps = () => resolve();
            const s = document.createElement("script");
            const libs = libraries.join(",");
            s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=${libs}&loading=async&callback=__initGoogleMaps`;
            s.async = true;
            s.defer = true;
            s.onerror = () => { setError("Failed to load Google Maps script"); };
            document.head.appendChild(s);
          });
        }
        await window.__googleMapsLoading;
        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Maps load failed");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { ready, error, google: ready ? window.google : null };
}
