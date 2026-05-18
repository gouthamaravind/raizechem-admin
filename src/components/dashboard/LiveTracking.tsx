import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Navigation, Clock, Users, Map, Filter, RefreshCw, Battery } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Fix default marker icons for leaflet in bundled apps
type LeafletIconPrototype = typeof L.Icon.Default.prototype & {
  _getIconUrl?: () => string;
};

delete (L.Icon.Default.prototype as LeafletIconPrototype)._getIconUrl;
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

function formatAge(ts?: string | null) {
  if (!ts) return "No ping";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "Just now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m ago`;
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
  accuracy?: number | null;
  batteryLevel?: number | null;
}

interface VisitPoint {
  visitId: string;
  dealerId: string;
  dealerName: string;
  userId: string;
  fullName: string;
  time: string;
  lat: number | null;
  lng: number | null;
  type: "checkin" | "checkout";
}

type ActiveDutyRow = {
  session_id: string;
  user_id: string;
  full_name?: string | null;
  start_time: string;
  total_km?: number | null;
  last_point?: {
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    recorded_at?: string | null;
  } | null;
};

type RecentVisitRow = {
  visit_id: string;
  dealer_id: string;
  dealer_name?: string | null;
  user_id: string;
  full_name?: string | null;
  checkin?: { time?: string | null; latlng?: { lat?: number; lng?: number } | null } | null;
  checkout?: { time?: string | null; latlng?: { lat?: number; lng?: number } | null } | null;
};

type LocationPointInsertPayload = {
  duty_session_id: string;
  lat: number | string;
  lng: number | string;
  accuracy?: number | null;
  recorded_at?: string | null;
};

type DutySessionUpdatePayload = {
  id: string;
  status?: string | null;
};
export function LiveTracking() {
  const qc = useQueryClient();
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);

  const { data: activeSessions, isLoading } = useQuery({
    queryKey: ["live-tracking-sessions"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_active_duty_locations");
      if (error) throw error;
      return ((data as ActiveDutyRow[]) || []).map((row: any) => {
        const last = row.last_point || {};
        const elapsed = Math.max(0, Math.round((Date.now() - new Date(row.start_time).getTime()) / 60000));
        return {
          sessionId: row.session_id,
          userId: row.user_id,
          name: row.full_name || row.user_id?.slice(0, 8),
          startTime: row.start_time,
          totalKm: Number(row.total_km || 0),
          durationMins: elapsed,
          lat: last.lat ? Number(last.lat) : null,
          lng: last.lng ? Number(last.lng) : null,
          accuracy: last.accuracy ?? null,
          lastUpdated: last.recorded_at || null,
          batteryLevel: row.battery_level ?? null,
        } as ActiveEmployee;
      });
    },
    refetchInterval: 20000,
  });

  const [timeWindow, setTimeWindow] = useState<"2h" | "8h" | "24h">("8h");
  const [pincodeFilter, setPincodeFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [showVisits, setShowVisits] = useState(true);

  const sinceIso = useMemo(() => {
    const hours = timeWindow === "2h" ? 2 : timeWindow === "24h" ? 24 : 8;
    return new Date(Date.now() - hours * 3600000).toISOString();
  }, [timeWindow]);

  const { data: visitPoints = [] } = useQuery({
    queryKey: ["recent-visits", sinceIso],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_recent_visits", { p_since: sinceIso });
      if (error) throw error;
      const rows = (data as RecentVisitRow[]) || [];
      const points: VisitPoint[] = [];
      rows.forEach((v) => {
        const checkin = v.checkin?.latlng;
        const checkout = v.checkout?.latlng;
        if (checkin?.lat && checkin?.lng) {
          points.push({
            visitId: v.visit_id,
            dealerId: v.dealer_id,
            dealerName: v.dealer_name,
            userId: v.user_id,
            fullName: v.full_name,
            time: v.checkin?.time,
            lat: Number(checkin.lat),
            lng: Number(checkin.lng),
            type: "checkin",
          });
        }
        if (checkout?.lat && checkout?.lng) {
          points.push({
            visitId: v.visit_id,
            dealerId: v.dealer_id,
            dealerName: v.dealer_name,
            userId: v.user_id,
            fullName: v.full_name,
            time: v.checkout?.time,
            lat: Number(checkout.lat),
            lng: Number(checkout.lng),
            type: "checkout",
          });
        }
      });
      return points;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (activeSessions) setEmployees(activeSessions);
  }, [activeSessions]);

  // Realtime nudges to refresh positions quickly
  useEffect(() => {
    const channel = supabase
      .channel("live-location-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_points" },
        (payload) => {
          const p = payload.new as LocationPointInsertPayload;
          setEmployees((prev) =>
            prev.map((e) =>
              e.sessionId === p.duty_session_id
                ? {
                    ...e,
                    lat: Number(p.lat),
                    lng: Number(p.lng),
                    accuracy: p.accuracy ?? e.accuracy,
                    lastUpdated: p.recorded_at,
                  }
                : e
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "duty_sessions" },
        (payload) => {
          const s = payload.new as DutySessionUpdatePayload;
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

  const filteredEmployees = useMemo(() => {
    const search = searchName.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesName = !search || e.name.toLowerCase().includes(search);
      // pincode filter placeholder: when provided, still show all (no geo -> pin mapping yet)
      const matchesPin = pincodeFilter.trim() ? true : true;
      return matchesName && matchesPin;
    });
  }, [employees, searchName, pincodeFilter]);

  const isStale = (lastUpdated?: string | null) => {
    if (!lastUpdated) return true;
    const ageMs = Date.now() - new Date(lastUpdated).getTime();
    return ageMs > 5 * 60 * 1000; // >5 minutes
  };

  const positions = useMemo(
    () =>
      filteredEmployees
        .filter((e) => e.lat && e.lng)
        .map((e) => [e.lat!, e.lng!] as [number, number]),
    [filteredEmployees]
  );

  const visitPositions = useMemo(
    () => visitPoints.filter((v) => v.lat && v.lng).map((v) => [v.lat!, v.lng!] as [number, number]),
    [visitPoints]
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
            <p className="text-xs text-muted-foreground">Recent visits ({timeWindow} window): {visitPoints.length}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultCenter: [number, number] = positions.length
    ? positions[0]
    : visitPositions[0] || [17.385, 78.4867];

  const staleCount = filteredEmployees.filter((e) => isStale(e.lastUpdated)).length;

  const handleManualRefresh = () => {
    qc.invalidateQueries({ queryKey: ["live-tracking-sessions"] });
    qc.invalidateQueries({ queryKey: ["recent-visits"] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />Live Field Tracking
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              {filteredEmployees.length} on duty
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Map className="h-3 w-3" /> {visitPoints.length} visits ({timeWindow})
            </Badge>
            {staleCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {staleCount} stale
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 w-44"
              placeholder="Search employee"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <Select value={timeWindow} onValueChange={(value: "2h" | "8h" | "24h") => setTimeWindow(value)}>
              <SelectTrigger className="h-9 w-28 text-xs">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2h">Last 2h</SelectItem>
                <SelectItem value="8h">Last 8h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
              </SelectContent>
            </Select>
            {/* Placeholder for pincode filter (needs dealer pin mapping) */}
            <Input
              className="h-9 w-24 text-xs"
              placeholder="Pincode"
              value={pincodeFilter}
              onChange={(e) => setPincodeFilter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Switch checked={showVisits} onCheckedChange={setShowVisits} id="toggle-visits" />
              <label htmlFor="toggle-visits" className="text-muted-foreground">Show visits</label>
            </div>
            <button
              className="text-xs text-primary inline-flex items-center gap-1"
              onClick={handleManualRefresh}
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden border" style={{ height: 300 }}>
          <MapContainer
            center={defaultCenter}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {positions.length > 0 && <FitBounds positions={positions} />}
            {filteredEmployees
              .filter((e) => e.lat && e.lng)
              .map((e, idx) => (
                <Marker
                  key={e.sessionId}
                  position={[e.lat!, e.lng!]}
                  icon={createColorIcon(isStale(e.lastUpdated) ? "#9ca3af" : colors[idx % colors.length])}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{e.name}</strong>
                      <br />
                      {e.totalKm.toFixed(1)} km · {formatDuration(e.durationMins)}
                      {e.accuracy != null && (
                        <div className="text-[11px] text-muted-foreground">±{Math.round(Number(e.accuracy))} m</div>
                      )}
                      {e.batteryLevel != null && (
                        <div className="text-[11px] flex items-center gap-1">
                          <Battery className={`h-3 w-3 ${Number(e.batteryLevel) < 0.2 ? 'text-destructive' : 'text-primary'}`} />
                          {Math.round(Number(e.batteryLevel) * 100)}% battery
                        </div>
                      )}
                      {e.lastUpdated && (
                        <div className="text-[11px] text-muted-foreground">
                          Last ping {new Date(e.lastUpdated).toLocaleTimeString()} {isStale(e.lastUpdated) && "(stale)"}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

            {showVisits && visitPoints
              .filter((v) => v.lat && v.lng)
              .map((v) => (
                <Marker
                  key={`${v.visitId}-${v.type}`}
                  position={[v.lat!, v.lng!]}
                  icon={createColorIcon(v.type === "checkin" ? "#22c55e" : "#9ca3af")}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      <div className="font-semibold">{v.dealerName || "Dealer"}</div>
                      <div className="text-xs text-muted-foreground">{v.fullName}</div>
                      <div className="text-xs">{v.type === "checkin" ? "Check-in" : "Check-out"}</div>
                      <div className="text-[11px] text-muted-foreground">{v.time ? formatAge(v.time) : ""}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        {/* Employee List */}
        <div className="space-y-2">
          {filteredEmployees.map((e, idx) => (
            <div
              key={e.sessionId}
              className="flex items-center justify-between text-sm border rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: isStale(e.lastUpdated) ? "#9ca3af" : colors[idx % colors.length] }}
                />
                <div className="min-w-0">
                  <p className="font-medium text-xs truncate">{e.name}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {e.lat && e.lng
                      ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`
                      : "No GPS yet"}
                  </p>
                  {e.lastUpdated && (
                    <p className={`text-[10px] ${isStale(e.lastUpdated) ? "text-destructive" : "text-muted-foreground"}`}>
                      Last ping {new Date(e.lastUpdated).toLocaleTimeString()}
                      {isStale(e.lastUpdated) && " • stale (>5m)"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                {e.batteryLevel != null && (
                  <span className="flex items-center gap-1">
                    <Battery className={`h-3 w-3 ${Number(e.batteryLevel) < 0.2 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    {Math.round(Number(e.batteryLevel) * 100)}%
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Navigation className="h-3 w-3" />{e.totalKm.toFixed(1)} km
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{formatDuration(e.durationMins)}
                </span>
                {e.accuracy != null && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />±{Math.round(Number(e.accuracy))}m
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
