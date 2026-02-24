import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Data retention: after 30 days, thin out location points.
// Keep only every Nth point (enough for km computation) and delete the rest.
const RETENTION_DAYS = 30;
const KEEP_EVERY_NTH = 5; // Keep 1 in 5 points — enough for distance calc

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for cleanup
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    // Get all completed sessions older than retention period
    const { data: oldSessions, error: sessErr } = await supabase
      .from("duty_sessions")
      .select("id")
      .eq("status", "completed")
      .lt("end_time", cutoffISO);

    if (sessErr) throw sessErr;
    if (!oldSessions || oldSessions.length === 0) {
      return new Response(JSON.stringify({ message: "No old sessions to clean up", cleaned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalDeleted = 0;

    for (const session of oldSessions) {
      // Get all points for this session ordered by time
      const { data: points, error: pErr } = await supabase
        .from("location_points")
        .select("id")
        .eq("duty_session_id", session.id)
        .order("recorded_at", { ascending: true });

      if (pErr || !points || points.length <= KEEP_EVERY_NTH) continue;

      // Identify points to delete (keep every Nth, always keep first and last)
      const toDelete: string[] = [];
      for (let i = 0; i < points.length; i++) {
        if (i === 0 || i === points.length - 1) continue; // Keep first and last
        if (i % KEEP_EVERY_NTH !== 0) {
          toDelete.push(points[i].id);
        }
      }

      if (toDelete.length > 0) {
        // Delete in batches of 100
        for (let j = 0; j < toDelete.length; j += 100) {
          const batch = toDelete.slice(j, j + 100);
          const { error: delErr } = await supabase
            .from("location_points")
            .delete()
            .in("id", batch);
          if (delErr) console.error(`Delete error for session ${session.id}:`, delErr);
        }
        totalDeleted += toDelete.length;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Cleanup complete`,
        sessions_processed: oldSessions.length,
        points_deleted: totalDeleted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
