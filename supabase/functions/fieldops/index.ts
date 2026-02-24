import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_POINTS_PER_DAY = 600;
const MAX_ACCURACY_METERS = 100;

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");

  return { supabase, userId: data.claims.sub as string };
}

function ok(data: any) {
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

async function getTodayPointCount(supabase: any, userId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("location_points")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("recorded_at", todayStart.toISOString());
  return count || 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await authenticate(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ========== START DUTY ==========
    if (action === "start-duty" && req.method === "POST") {
      const { lat, lng, tracking_mode } = await req.json();

      // Validate tracking_mode
      const validModes = ["low", "normal", "high"];
      const mode = validModes.includes(tracking_mode) ? tracking_mode : "normal";

      // Check no active session exists
      const { data: existing } = await supabase
        .from("duty_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1);

      if (existing && existing.length > 0) {
        return err("You already have an active duty session");
      }

      const { data: session, error: sessErr } = await supabase
        .from("duty_sessions")
        .insert({
          user_id: userId,
          start_location: lat && lng ? { lat, lng } : null,
          tracking_mode: mode,
        })
        .select("id, start_time, status, tracking_mode")
        .single();

      if (sessErr) throw sessErr;

      // Record first location point
      if (lat && lng) {
        await supabase.from("location_points").insert({
          duty_session_id: session.id,
          user_id: userId,
          lat,
          lng,
          source: "gps",
        });
      }

      return ok({ session });
    }

    // ========== STOP DUTY ==========
    if (action === "stop-duty" && req.method === "POST") {
      const { session_id, lat, lng } = await req.json();
      if (!session_id) return err("session_id required");

      // Record final location
      if (lat && lng) {
        await supabase.from("location_points").insert({
          duty_session_id: session_id,
          user_id: userId,
          lat,
          lng,
          source: "gps",
        });

        await supabase
          .from("duty_sessions")
          .update({ end_location: { lat, lng } })
          .eq("id", session_id);
      }

      // Finalize via SQL function
      const { data, error: rpcErr } = await supabase.rpc("finalize_duty_session", {
        _session_id: session_id,
      });

      if (rpcErr) throw rpcErr;
      return ok({ result: data });
    }

    // ========== ADD LOCATION POINTS (BATCH) ==========
    if (action === "add-locations" && req.method === "POST") {
      const { session_id, points, force_low_accuracy } = await req.json();
      if (!session_id || !Array.isArray(points) || points.length === 0) {
        return err("session_id and points[] required");
      }

      // Daily cap check
      const todayCount = await getTodayPointCount(supabase, userId);
      const remaining = MAX_POINTS_PER_DAY - todayCount;
      if (remaining <= 0) {
        return err(`Daily location cap reached (${MAX_POINTS_PER_DAY} points). No more points accepted today.`);
      }

      // Filter and validate points
      const accepted: any[] = [];
      const rejected: any[] = [];

      for (const p of points.slice(0, remaining)) {
        // Validate coordinates
        if (typeof p.lat !== "number" || typeof p.lng !== "number" ||
            p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
          rejected.push({ ...p, reason: "invalid_coordinates" });
          continue;
        }

        // Accuracy check
        const accuracy = typeof p.accuracy === "number" ? p.accuracy : null;
        if (accuracy !== null && accuracy > MAX_ACCURACY_METERS && !force_low_accuracy) {
          rejected.push({ ...p, reason: "low_accuracy", accuracy });
          continue;
        }

        accepted.push({
          duty_session_id: session_id,
          user_id: userId,
          lat: p.lat,
          lng: p.lng,
          accuracy: accuracy,
          source: p.source || "gps",
          recorded_at: p.recorded_at || new Date().toISOString(),
        });
      }

      if (accepted.length > 0) {
        const { error: insErr } = await supabase
          .from("location_points")
          .insert(accepted);
        if (insErr) throw insErr;
      }

      return ok({
        inserted: accepted.length,
        rejected: rejected.length,
        rejected_details: rejected.length > 0 ? rejected : undefined,
        daily_remaining: remaining - accepted.length,
      });
    }

    // ========== CHECK-IN VISIT ==========
    if (action === "checkin-visit" && req.method === "POST") {
      const { dealer_id, session_id, lat, lng, notes } = await req.json();
      if (!dealer_id) return err("dealer_id required");

      const { data: visit, error: vErr } = await supabase
        .from("dealer_visits")
        .insert({
          user_id: userId,
          dealer_id,
          duty_session_id: session_id || null,
          checkin_latlng: lat && lng ? { lat, lng } : null,
          notes: notes || null,
        })
        .select("id, checkin_time")
        .single();

      if (vErr) throw vErr;
      return ok({ visit });
    }

    // ========== CHECK-OUT VISIT ==========
    if (action === "checkout-visit" && req.method === "POST") {
      const { visit_id, lat, lng, notes, photo_url } = await req.json();
      if (!visit_id) return err("visit_id required");

      const updateData: any = { checkout_time: new Date().toISOString() };
      if (lat && lng) updateData.checkout_latlng = { lat, lng };
      if (notes) updateData.notes = notes;
      if (photo_url) updateData.photo_url = photo_url;

      const { data: visit, error: vErr } = await supabase
        .from("dealer_visits")
        .update(updateData)
        .eq("id", visit_id)
        .eq("user_id", userId)
        .select("id, checkin_time, checkout_time")
        .single();

      if (vErr) throw vErr;
      return ok({ visit });
    }

    // ========== CREATE FIELD ORDER ==========
    if (action === "create-field-order" && req.method === "POST") {
      const { dealer_id, session_id, notes, requested_delivery_date, items } =
        await req.json();
      if (!dealer_id || !Array.isArray(items) || items.length === 0) {
        return err("dealer_id and items[] required");
      }

      const { data: fo, error: foErr } = await supabase
        .from("field_orders")
        .insert({
          created_by_user_id: userId,
          dealer_id,
          duty_session_id: session_id || null,
          notes: notes || null,
          requested_delivery_date: requested_delivery_date || null,
        })
        .select("id")
        .single();

      if (foErr) throw foErr;

      const orderItems = items.map((it: any) => ({
        field_order_id: fo.id,
        product_id: it.product_id,
        qty: it.qty,
        expected_rate: it.expected_rate || 0,
      }));

      const { error: itemErr } = await supabase
        .from("field_order_items")
        .insert(orderItems);

      if (itemErr) throw itemErr;

      return ok({ field_order_id: fo.id, items_count: orderItems.length });
    }

    // ========== RECORD FIELD PAYMENT ==========
    if (action === "record-payment" && req.method === "POST") {
      const { dealer_id, amount, mode, reference_no, payment_date, notes, attachment_url } =
        await req.json();

      if (!dealer_id || !amount) return err("dealer_id and amount required");

      const { data: payment, error: pErr } = await supabase
        .from("field_payments")
        .insert({
          created_by_user_id: userId,
          dealer_id,
          amount,
          mode: mode || "cash",
          reference_no: reference_no || null,
          payment_date: payment_date || new Date().toISOString().split("T")[0],
          notes: notes || null,
          attachment_url: attachment_url || null,
        })
        .select("id, amount, status")
        .single();

      if (pErr) throw pErr;
      return ok({ payment });
    }

    // ========== TODAY SUMMARY ==========
    if (action === "today-summary" && req.method === "GET") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      // Active session
      const { data: activeSessions } = await supabase
        .from("duty_sessions")
        .select("id, start_time, status, total_km, total_duration_mins, incentive_amount, tracking_mode")
        .eq("user_id", userId)
        .gte("start_time", todayISO)
        .order("start_time", { ascending: false })
        .limit(5);

      // Today's visits
      const { data: visits } = await supabase
        .from("dealer_visits")
        .select("id, dealer_id, checkin_time, checkout_time, dealers(name)")
        .eq("user_id", userId)
        .gte("checkin_time", todayISO);

      // Today's field orders
      const { data: orders } = await supabase
        .from("field_orders")
        .select("id, dealer_id, status, dealers(name)")
        .eq("created_by_user_id", userId)
        .gte("created_at", todayISO);

      // Today's field payments
      const { data: payments } = await supabase
        .from("field_payments")
        .select("id, dealer_id, amount, mode, status, dealers(name)")
        .eq("created_by_user_id", userId)
        .gte("created_at", todayISO);

      // Live km for active session
      let liveKm = 0;
      const activeSession = activeSessions?.find((s: any) => s.status === "active");
      if (activeSession) {
        const { data: kmResult } = await supabase.rpc("compute_session_km", {
          _session_id: activeSession.id,
        });
        liveKm = kmResult || 0;
      }

      // Daily point count
      const pointCount = await getTodayPointCount(supabase, userId);

      return ok({
        sessions: activeSessions || [],
        active_session: activeSession || null,
        live_km: liveKm,
        visits_count: visits?.length || 0,
        visits: visits || [],
        orders_count: orders?.length || 0,
        orders: orders || [],
        payments_count: payments?.length || 0,
        payments_total: (payments || []).reduce(
          (s: number, p: any) => s + Number(p.amount),
          0
        ),
        payments: payments || [],
        daily_points_used: pointCount,
        daily_points_remaining: MAX_POINTS_PER_DAY - pointCount,
      });
    }

    return err(`Unknown action: ${action}. Valid actions: start-duty, stop-duty, add-locations, checkin-visit, checkout-visit, create-field-order, record-payment, today-summary`);
  } catch (e: any) {
    if (e.message === "Unauthorized") {
      return err("Unauthorized", 401);
    }
    return err(e.message, 500);
  }
});
