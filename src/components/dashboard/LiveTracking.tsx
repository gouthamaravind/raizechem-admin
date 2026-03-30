import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Navigation, Clock, Users } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for leaflet in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function createColorIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

interface ActiveEmployee {
  sessionId: string;
  userId: string;
  name: string;
  startTime: string;
  totalKm: number;
  durationMins: number;
  lat: number | null;
  lng: number | null;
  lastUpdated: string | null;
}

const MOCK_EMPLOYEES: ActiveEmployee[] = [
  { sessionId: "mock-1", userId: "u1", name: "Ravi Kumar", startTime: new Date(Date.now() - 3 * 3600000).toISOString(), totalKm: 42.3, durationMins: 180, lat: 17.4065, lng: 78.4772, lastUpdated: new Date().toISOString() },
  { sessionId: "mock-2", userId: "u2", name: "Suresh Babu", startTime: new Date(Date.now() - 2 * 3600000).toISOString(), totalKm: 28.7, durationMins: 120, lat: 17.4401, lng: 78.3489, lastUpdated: new Date().toISOString() },
  { sessionId: "mock-3", userId: "u3", name: "Priya Sharma", startTime: new Date(Date.now() - 1.5 * 3600000).toISOString(), totalKm: 15.1, durationMins: 90, lat: 17.3616, lng: 78.4747, lastUpdated: new Date().toISOString() },
  { sessionId: "mock-4", userId: "u4", name: "Venkat Reddy", startTime: new Date(Date.now() - 4 * 3600000).toISOString(), totalKm: 56.8, durationMins: 240, lat: 17.4948, lng: 78.3996, lastUpdated: new Date().toISOString() },
  { sessionId: "mock-5", userId: "u5", name: "Anita Desai", startTime: new Date(Date.now() - 0.5 * 3600000).toISOString(), totalKm: 6.2, durationMins: 30, lat: 17.3850, lng: 78.4867, lastUpdated: new Date().toISOString() },
];

export function LiveTracking() {
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);
  const [useMock, setUseMock] = useState(false);

  // Fetch active duty sessions with latest location
  const { data: activeSessions, isLoading } = useQuery({
    queryKey: ["live-tracking-sessions"],
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from("duty_sessions")
        .select("id, user_id, start_time, total_km, total_duration_mins, status")
        .eq("status", "active");

      if (!sessions?.length) return [];

      const userIds = [...new Set(sessions.map((s) => s.user_id))];

      const [empRes, locRes] = await Promise.all([
        supabase.from("employee_profiles").select("user_id, name").in("user_id", userIds),
        Promise.all(
          sessions.map((s) =>
            supabase
              .from("location_points")
              .select("lat, lng, recorded_at")
              .eq("duty_session_id", s.id)
              .order("recorded_at", { ascending: false })
              .limit(1)
              .then((r) => ({ sessionId: s.id, point: r.data?.[0] || null }))
          )
        ),
      ]);

      const empMap = new Map((empRes.data || []).map((e) => [e.user_id, e.name]));
      const locMap = new Map(locRes.map((l) => [l.sessionId, l.point]));

      return sessions.map((s): ActiveEmployee => {
        const loc = locMap.get(s.id);
        const elapsed = Math.round((Date.now() - new Date(s.start_time).getTime()) / 60000);
        return {
          sessionId: s.id,
          userId: s.user_id,
          name: empMap.get(s.user_id) || s.user_id.slice(0, 8),
          startTime: s.start_time,
          totalKm: Number(s.total_km),
          durationMins: elapsed,
          lat: loc ? Number(loc.lat) : null,
          lng: loc ? Number(loc.lng) : null,
          lastUpdated: loc?.recorded_at || null,
        };
      });
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (activeSessions && activeSessions.length > 0) {
      setEmployees(activeSessions);
      setUseMock(false);
    } else if (activeSessions && activeSessions.length === 0) {
      setEmployees(MOCK_EMPLOYEES);
      setUseMock(true);
    }
  }, [activeSessions]);

  // Realtime subscription for new location points
  useEffect(() => {
    const channel = supabase
      .channel("live-location-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_points" },
        (payload) => {
          const p = payload.new as any;
          setEmployees((prev) =>
            prev.map((e) =>
              e.sessionId === p.duty_session_id
                ? { ...e, lat: Number(p.lat), lng: Number(p.lng), lastUpdated: p.recorded_at }
                : e
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "duty_sessions" },
        (payload) => {
          const s = payload.new as any;
          if (s.status === "completed") {
            setEmployees((prev) => prev.filter((e) => e.sessionId !== s.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const positions = useMemo(
    () =>
      employees
        .filter((e) => e.lat && e.lng)
        .map((e) => [e.lat!, e.lng!] as [number, number]),
    [employees]
  );

  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />Live Field Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!employees.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />Live Field Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No employees on duty right now</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultCenter: [number, number] = positions.length
    ? positions[0]
    : [17.385, 78.4867]; // Hyderabad fallback

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />Live Field Tracking
          </CardTitle>
          <Badge variant="default" className="text-xs">
            {employees.length} on duty
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map */}
        <div className="rounded-lg overflow-hidden border" style={{ height: 300 }}>
          <MapContainer
            center={defaultCenter}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {positions.length > 0 && <FitBounds positions={positions} />}
            {employees
              .filter((e) => e.lat && e.lng)
              .map((e, idx) => (
                <Marker
                  key={e.sessionId}
                  position={[e.lat!, e.lng!]}
                  icon={createColorIcon(colors[idx % colors.length])}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{e.name}</strong>
                      <br />
                      {e.totalKm.toFixed(1)} km · {formatDuration(e.durationMins)}
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        {/* Employee List */}
        <div className="space-y-2">
          {employees.map((e, idx) => (
            <div
              key={e.sessionId}
              className="flex items-center justify-between text-sm border rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <div className="min-w-0">
                  <p className="font-medium text-xs truncate">{e.name}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {e.lat && e.lng
                      ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`
                      : "No GPS yet"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Navigation className="h-3 w-3" />{e.totalKm.toFixed(1)} km
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{formatDuration(e.durationMins)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
