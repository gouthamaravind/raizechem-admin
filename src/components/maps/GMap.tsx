import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Loader2 } from "lucide-react";

export interface GMapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  title?: string;
  accuracy?: number;
  popupHtml?: string;
}

interface GMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: GMapMarker[];
  polylines?: { path: { lat: number; lng: number }[]; color?: string; dashed?: boolean }[];
  fitBounds?: boolean;
  height?: number | string;
  className?: string;
  onMapReady?: (map: any) => void;
}

export function GMap({
  center,
  zoom = 13,
  markers = [],
  polylines = [],
  fitBounds = true,
  height = 300,
  className = "",
  onMapReady,
}: GMapProps) {
  const { ready, error, google } = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlayRefs = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  // Init map once
  useEffect(() => {
    if (!ready || !google || !containerRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: center || { lat: 17.385, lng: 78.4867 },
      zoom,
      disableDefaultUI: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });
    infoRef.current = new google.maps.InfoWindow();
    onMapReady?.(mapRef.current);
  }, [ready]);

  // Re-render overlays when markers/polylines change
  useEffect(() => {
    if (!ready || !google || !mapRef.current) return;
    overlayRefs.current.forEach((o) => o.setMap?.(null));
    overlayRefs.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    for (const m of markers) {
      if (!m.lat || !m.lng) continue;
      hasPoints = true;
      const pos = { lat: m.lat, lng: m.lng };
      const color = m.color || "#3b82f6";
      const marker = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: m.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      if (m.popupHtml) {
        marker.addListener("click", () => {
          infoRef.current.setContent(m.popupHtml);
          infoRef.current.open(mapRef.current, marker);
        });
      }
      overlayRefs.current.push(marker);

      if (m.accuracy && m.accuracy > 0) {
        const circle = new google.maps.Circle({
          center: pos,
          radius: Math.min(m.accuracy, 200),
          map: mapRef.current,
          strokeColor: color,
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: color,
          fillOpacity: 0.12,
        });
        overlayRefs.current.push(circle);
      }
      bounds.extend(pos);
    }

    for (const pl of polylines) {
      if (!pl.path?.length) continue;
      const line = new google.maps.Polyline({
        path: pl.path,
        map: mapRef.current,
        strokeColor: pl.color || "#3b82f6",
        strokeOpacity: pl.dashed ? 0 : 0.85,
        strokeWeight: 3,
        icons: pl.dashed
          ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "10px" }]
          : undefined,
      });
      overlayRefs.current.push(line);
      pl.path.forEach((p) => { bounds.extend(p); hasPoints = true; });
    }

    if (fitBounds && hasPoints && !bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 40);
      const listener = google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
        if (mapRef.current.getZoom() > 16) mapRef.current.setZoom(16);
      });
    } else if (center) {
      mapRef.current.setCenter(center);
    }
  }, [ready, JSON.stringify(markers), JSON.stringify(polylines), fitBounds]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted text-destructive text-sm p-4 ${className}`} style={{ height }}>
        {error}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
        </div>
      )}
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
    </div>
  );
}
