import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Route, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { GMap } from "@/components/maps/GMap";

export default function FieldOpsLocations() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { data: session } = useQuery({
    queryKey: ["fieldops-session", sessionId],
    queryFn: async () => {
      const { data } = await supabase.from("duty_sessions").select("*").eq("id", sessionId!).single();
      return data;
    },
    enabled: !!sessionId,
  });

  const { data: points = [], isLoading } = useQuery({
    queryKey: ["fieldops-locations", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("location_points")
        .select("*").eq("duty_session_id", sessionId!)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
  });

  const rawPath = useMemo(
    () => points.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
              .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [points]
  );

  // Snap trail to roads via Google Roads API
  const { data: snap } = useQuery({
    queryKey: ["fieldops-snap", sessionId, points.length],
    enabled: !!sessionId && points.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-roads", {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      return data as { geometry: [number, number][]; km: number; snapped: boolean };
    },
  });

  const snappedPath = (snap?.geometry || []).map(([lat, lng]) => ({ lat, lng }));

  const markers = [];
  const endPoint = snappedPath.length > 1 ? snappedPath : rawPath;
  if (endPoint.length > 0) {
    markers.push({ id: "start", lat: endPoint[0].lat, lng: endPoint[0].lng, color: "hsl(142 76% 36%)", title: "Start" });
    if (endPoint.length > 1) {
      const last = endPoint[endPoint.length - 1];
      markers.push({ id: "end", lat: last.lat, lng: last.lng, color: "hsl(0 84% 60%)", title: "End" });
    }
  }

  const polylines = [];
  if (rawPath.length > 1) polylines.push({ path: rawPath, color: "#3b82f6", dashed: true });
  if (snappedPath.length > 1) polylines.push({ path: snappedPath, color: "hsl(142 76% 36%)" });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fieldops/sessions")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Location Trail</h1>
            <p className="text-muted-foreground">
              Session {sessionId?.slice(0, 8)} — {session ? format(new Date(session.start_time), "dd MMM yyyy") : "..."} — {points.length} points
            </p>
          </div>
        </div>

        {session && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recorded Distance</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{Number(session.total_km).toFixed(2)} km</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" />Road-Snapped</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{snap?.snapped ? `${snap.km.toFixed(2)} km` : "—"}</div>
                {snap?.snapped && <Badge variant="secondary" className="mt-1 text-xs">via Google Roads</Badge>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Points</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{points.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Duration</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{Math.floor(session.total_duration_mins / 60)}h {session.total_duration_mins % 60}m</div></CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />Trail Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            {endPoint.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No GPS points to plot.</div>
            ) : (
              <GMap markers={markers} polylines={polylines} height={500} fitBounds />
            )}
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 border-2 border-white" />Start</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white" />End</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-600" />Snapped to road</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 border-t border-dashed border-blue-500" />Raw GPS</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />GPS Points ({points.length})</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : points.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No location points recorded.</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Latitude</TableHead>
                      <TableHead>Longitude</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {points.map((p: any, idx: number) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>{format(new Date(p.recorded_at), "hh:mm:ss a")}</TableCell>
                        <TableCell className="font-mono text-xs">{Number(p.lat).toFixed(6)}</TableCell>
                        <TableCell className="font-mono text-xs">{Number(p.lng).toFixed(6)}</TableCell>
                        <TableCell>{p.accuracy ? `${Number(p.accuracy).toFixed(0)}m` : "—"}</TableCell>
                        <TableCell>{p.source || "gps"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
