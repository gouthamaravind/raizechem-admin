import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const ALLOWED_ROLES = ["admin", "sales", "accounts"];
const RATE_LIMIT = 10;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return json({ success: false, error: "Unauthorized" }, 401);
      }
      userId = claimsData.claims.sub as string;
    } catch (authErr) {
      console.error("Auth error:", authErr);
      return json({ success: false, error: "Unauthorized – session expired, please re-login" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Role check
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return json({ success: false, error: "Forbidden: insufficient role" }, 403);
    }

    // Parse body
    const body = await req.json();
    const gstNo = (body.gstNo || "").toUpperCase().trim();

    if (!gstNo || !GSTIN_RE.test(gstNo)) {
      return json({ success: false, error: "Invalid GSTIN format" }, 400);
    }

    // Rate limiting
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await adminClient
      .from("api_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", "verify-gst")
      .gte("called_at", oneMinuteAgo);

    if ((count || 0) >= RATE_LIMIT) {
      return json({ success: false, error: "Rate limit exceeded. Max 10 lookups per minute." }, 429);
    }

    await adminClient.from("api_rate_limits").insert({
      user_id: userId,
      endpoint: "verify-gst",
    });

    // Get Appyflow secret
    const appflowSecret = Deno.env.get("APPFLOW_SECRET");
    if (!appflowSecret) {
      await logVerification(adminClient, gstNo, userId, "error", { error: "APPFLOW_SECRET not configured" });
      return json({ success: false, error: "GST verification API is not configured." }, 503);
    }

    // Call Appyflow API
    let apiResponse: Response;
    try {
      const url = `https://appyflow.in/api/verifyGST?key_secret=${encodeURIComponent(appflowSecret)}&gstNo=${encodeURIComponent(gstNo)}`;
      apiResponse = await fetch(url, { method: "GET" });
    } catch (fetchErr) {
      await logVerification(adminClient, gstNo, userId, "provider_error", { error: "Provider unreachable" });
      return json({ success: false, error: "GST verification provider is unreachable. Try again later." }, 502);
    }

    const raw = await apiResponse.json();

    // Check for error responses
    if (raw.error === true || raw.flag === false) {
      const errMsg = raw.message || raw.error || "Invalid GST or API error";
      await logVerification(adminClient, gstNo, userId, "api_error", raw);
      return json({ success: false, error: errMsg }, 400);
    }

    // Appyflow wraps data inside taxpayerInfo
    const info = raw.taxpayerInfo || raw;

    // Normalize Appyflow response
    const pradr = info.pradr?.addr || info.pradr || {};
    const addressParts = [
      pradr.bnm, pradr.st, pradr.loc,
      pradr.bno, pradr.dst, pradr.flno,
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : (pradr.adr || "");

    const normalized = {
      legal_name: info.lgnm || "",
      trade_name: info.tradeNam || "",
      gst_status: info.sts || "",
      registration_date: info.rgdt || null,
      state_code: info.pradr?.addr?.stcd ? undefined : (info.stj?.split(" - ")?.[0] || gstNo.substring(0, 2)),
      state: pradr.stcd || "",
      address: fullAddress,
      pincode: pradr.pncd || "",
      constitution: info.ctb || "",
    };

    await logVerification(adminClient, gstNo, userId, "success", { normalized, raw_status: info.sts });

    // Also log to audit_logs
    await adminClient.from("audit_logs").insert({
      table_name: "dealers",
      record_id: "00000000-0000-0000-0000-000000000000",
      action: "GSTIN_LOOKUP",
      actor_user_id: userId,
      actor_role: userRoles.join(","),
      new_data: { gstNo, status: raw.sts, legal_name: raw.lgnm },
    });

    return json({ success: true, data: normalized });
  } catch (err) {
    console.error("verify-gst error:", err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

async function logVerification(
  client: any, gstNo: string, userId: string, status: string, responseJson: any
) {
  try {
    await client.from("gst_verification_logs").insert({
      gst_no: gstNo,
      verified_by: userId,
      status,
      response_json: responseJson,
    });
  } catch (e) {
    console.error("Failed to log verification:", e);
  }
}
