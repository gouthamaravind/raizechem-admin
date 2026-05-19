// Snap-to-road via public OSRM (router.project-osrm.org).
// Accepts a list of GPS points (or a session_id) and returns the road-snapped
// polyline + corrected route distance. Optionally writes total_km back.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OSRM_BASE = "https://router.project-osrm.org";
// OSRM Match accepts up to 100 coordinates per request. We batch larger inputs.
const MATCH_BATCH = 90;

type Pt = { lat: number; lng: number; recorded_at?: string };

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function osrmMatch(batch: Pt[]) {
  if (batch.length < 2) return { geometry: [] as [number, number][], distance: 0 };
  const coords = batch.map((p) => `${p.lng},${p.lat}`).join(";");
  const radiuses = batch.map(() => 30).join(";"); // 30m tolerance
  const url = `${OSRM_BASE}/match/v1/driving/${coords}?geometries=geojson&overview=full&radiuses=${radiuses}&tidy=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = await res.json();
  if (json.code !== "Ok" || !json.matchings?.length) {
    return { geometry: [], distance: 0 };
  }
  const geom: [number, number][] = [];
  let distance = 0;
  for (const m of json.matchings) {
    distance += m.distance || 0;
    for (const c of m.geometry.coordinates as [number, number][]) {
      geom.push([c[1], c[0]]); // [lat, lng]
    }
  }
  return { geometry: geom, distance };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return err("Unauthorized", 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) return err("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const { session_id, points: rawPts, update_session } = body as {
      session_id?: string;
      points?: Pt[];
      update_session?: boolean;
    };

    let points: Pt[] = [];
    if (Array.isArray(rawPts) && rawPts.length > 0) {
      points = rawPts;
    } else if (session_id) {
      const { data, error } = await supabase
        .from("location_points")
        .select("lat,lng,recorded_at,accuracy")
        .eq("duty_session_id", session_id)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      // Drop low-accuracy outliers before snapping
      points = (data || [])
        .filter((p: any) => !p.accuracy || Number(p.accuracy) <= 100)
        .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng), recorded_at: p.recorded_at }));
    } else {
      return err("session_id or points[] required");
    }

    if (points.length < 2) {
      return ok({ geometry: points.map((p) => [p.lat, p.lng]), distance_m: 0, snapped: false });
    }

    // Batch OSRM calls
    const fullGeom: [number, number][] = [];
    let totalDistance = 0;
    for (let i = 0; i < points.length; i += MATCH_BATCH) {
      const batch = points.slice(i, Math.min(i + MATCH_BATCH, points.length));
      try {
        const r = await osrmMatch(batch);
        if (r.geometry.length) fullGeom.push(...r.geometry);
        totalDistance += r.distance;
      } catch (e) {
        console.error("OSRM batch failed, falling back to raw points", e);
        for (const p of batch) fullGeom.push([p.lat, p.lng]);
      }
    }

    const km = totalDistance / 1000;
    if (session_id && update_session && km > 0) {
      await supabase.from("duty_sessions").update({ total_km: km }).eq("id", session_id);
    }

    return ok({
      geometry: fullGeom,
      distance_m: Math.round(totalDistance),
      km: Math.round(km * 100) / 100,
      snapped: fullGeom.length > 0,
      input_points: points.length,
    });
  } catch (e: any) {
    console.error("osrm-snap error", e);
    return err(e?.message || "Internal error", 500);
  }
});
