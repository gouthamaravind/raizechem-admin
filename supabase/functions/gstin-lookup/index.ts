import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const ALLOWED_ROLES = ["admin", "sales", "accounts"];
const RATE_LIMIT = 10; // per user per minute

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Role check
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const hasAccess = userRoles.some((r: string) => ALLOWED_ROLES.includes(r));
    if (!hasAccess) {
      return json({ error: "Forbidden: insufficient role" }, 403);
    }

    // Parse body
    const body = await req.json();
    const gstin = (body.gstin || "").toUpperCase().trim();

    if (!gstin || !GSTIN_RE.test(gstin)) {
      return json({ error: "Invalid GSTIN format" }, 400);
    }

    // Rate limiting
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await adminClient
      .from("api_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", "gstin-lookup")
      .gte("called_at", oneMinuteAgo);

    if ((count || 0) >= RATE_LIMIT) {
      return json({ error: "Rate limit exceeded. Max 10 lookups per minute." }, 429);
    }

    // Record rate limit entry
    await adminClient.from("api_rate_limits").insert({
      user_id: userId,
      endpoint: "gstin-lookup",
    });

    // Call external GST API
    const apiBaseUrl = Deno.env.get("GST_API_BASE_URL");
    const apiKey = Deno.env.get("GST_API_KEY");

    if (!apiBaseUrl || !apiKey) {
      // Log the attempt
      await adminClient.from("audit_logs").insert({
        table_name: "dealers",
        record_id: "00000000-0000-0000-0000-000000000000",
        action: "GSTIN_LOOKUP_FAILED",
        actor_user_id: userId,
        actor_role: userRoles.join(","),
        new_data: { gstin, error: "API keys not configured" },
      });
      return json({ error: "GSTIN verification API is not configured. Please add GST_API_BASE_URL and GST_API_KEY secrets." }, 503);
    }

    // Make API call (generic provider pattern)
    let apiResponse: Response;
    try {
      const url = `${apiBaseUrl.replace(/\/$/, "")}/commonapi/v1.1/search?gstin=${gstin}&consent=Y`;
      apiResponse = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
      });
    } catch (fetchErr) {
      await adminClient.from("audit_logs").insert({
        table_name: "dealers",
        record_id: "00000000-0000-0000-0000-000000000000",
        action: "GSTIN_LOOKUP_FAILED",
        actor_user_id: userId,
        actor_role: userRoles.join(","),
        new_data: { gstin, error: "Provider unreachable" },
      });
      return json({ error: "GST verification provider is unreachable. Try again later." }, 502);
    }

    const raw = await apiResponse.json();

    // Normalize response (adapt to your provider's response shape)
    // Common providers: MasterGST, ClearTax, GSTN Setu, KYC API
    const data = raw.data || raw.result || raw;

    const normalized = {
      gstin,
      legal_name: data.lgnm || data.legal_name || data.legalName || "",
      trade_name: data.tradeNam || data.trade_name || data.tradeName || "",
      status: data.sts || data.status || data.gstStatus || "",
      registration_date: data.rgdt || data.registration_date || data.registrationDate || null,
      address: data.pradr?.adr || data.principal_address || data.address || null,
      state_code: data.pradr?.addr?.stcd || data.state_code || gstin.substring(0, 2),
      raw: data,
    };

    // Audit log
    await adminClient.from("audit_logs").insert({
      table_name: "dealers",
      record_id: "00000000-0000-0000-0000-000000000000",
      action: "GSTIN_LOOKUP",
      actor_user_id: userId,
      actor_role: userRoles.join(","),
      new_data: {
        gstin,
        status: normalized.status,
        legal_name: normalized.legal_name,
        provider_status: apiResponse.status,
      },
    });

    return json({ success: true, data: normalized });
  } catch (err) {
    console.error("gstin-lookup error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
