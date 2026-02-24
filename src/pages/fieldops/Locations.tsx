import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin } from "lucide-react";
import { format } from "date-fns";

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
      const { data, error } = await supabase.from("location_points").select("*").eq("duty_session_id", sessionId!).order("recorded_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
  });

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
              Session {sessionId?.slice(0, 8)} — {session ? format(new Date(session.start_time), "dd MMM yyyy") : "..."} — {points.length} points recorded
            </p>
          </div>
        </div>

        {/* Summary */}
        {session && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Distance</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{Number(session.total_km).toFixed(2)} km</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Points Recorded</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{points.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Duration</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{Math.floor(session.total_duration_mins / 60)}h {session.total_duration_mins % 60}m</div></CardContent>
            </Card>
          </div>
        )}

        {/* Location Points Table */}
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />GPS Points</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : points.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No location points recorded for this session.</p>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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
