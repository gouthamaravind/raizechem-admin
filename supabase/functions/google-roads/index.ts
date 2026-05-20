// Snap-to-road via Google Roads API (replaces osrm-snap).
// POST { session_id?, points?: [{lat,lng}], update_session? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVER_KEY = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
const ROADS_BASE = "https://roads.googleapis.com/v1";
const SNAP_BATCH = 100; // Google Roads snapToRoads max 100 points/request

type Pt = { lat: number; lng: number };

function ok(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function err(m: string, s = 400) {
  return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function haversine(a: Pt, b: Pt) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function snapBatch(batch: Pt[]) {
  if (batch.length < 2) return { snapped: [] as Pt[], distance: 0 };
  const path = batch.map((p) => `${p.lat},${p.lng}`).join("|");
  const url = `${ROADS_BASE}/snapToRoads?interpolate=true&path=${encodeURIComponent(path)}&key=${SERVER_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Roads API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const snapped: Pt[] = (json.snappedPoints || []).map((sp: any) => ({
    lat: sp.location.latitude,
    lng: sp.location.longitude,
  }));
  let distance = 0;
  for (let i = 1; i < snapped.length; i++) distance += haversine(snapped[i - 1], snapped[i]);
  return { snapped, distance };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!SERVER_KEY) return err("GOOGLE_MAPS_SERVER_KEY not configured", 500);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return err("Unauthorized", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return err("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const { session_id, points: rawPts, update_session } = body as {
      session_id?: string; points?: Pt[]; update_session?: boolean;
    };

    let points: Pt[] = [];
    if (Array.isArray(rawPts) && rawPts.length > 0) {
      points = rawPts.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    } else if (session_id) {
      const { data, error } = await supabase
        .from("location_points")
        .select("lat,lng,accuracy,recorded_at")
        .eq("duty_session_id", session_id)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      points = (data || [])
        .filter((p: any) => !p.accuracy || Number(p.accuracy) <= 100)
        .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    } else {
      return err("session_id or points[] required");
    }

    if (points.length < 2) {
      return ok({ geometry: points.map((p) => [p.lat, p.lng]), distance_m: 0, snapped: false });
    }

    const fullSnap: Pt[] = [];
    let totalDistance = 0;
    for (let i = 0; i < points.length; i += SNAP_BATCH) {
      const batch = points.slice(i, Math.min(i + SNAP_BATCH, points.length));
      try {
        const r = await snapBatch(batch);
        fullSnap.push(...r.snapped);
        totalDistance += r.distance;
      } catch (e) {
        console.error("Google Roads batch failed, falling back", e);
        for (const p of batch) fullSnap.push(p);
      }
    }

    const km = totalDistance / 1000;
    if (session_id && update_session && km > 0) {
      await supabase.from("duty_sessions").update({ total_km: km }).eq("id", session_id);
    }

    return ok({
      geometry: fullSnap.map((p) => [p.lat, p.lng]),
      distance_m: Math.round(totalDistance),
      km: Math.round(km * 100) / 100,
      snapped: fullSnap.length > 0,
      input_points: points.length,
    });
  } catch (e: any) {
    console.error("google-roads error", e);
    return err(e?.message || "Internal error", 500);
  }
});
