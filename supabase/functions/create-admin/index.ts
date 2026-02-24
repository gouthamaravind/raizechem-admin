import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require a bootstrap token from environment to prevent unauthorized use
  const bootstrapToken = Deno.env.get("ADMIN_BOOTSTRAP_TOKEN");
  if (!bootstrapToken) {
    return new Response(
      JSON.stringify({
        error:
          "ADMIN_BOOTSTRAP_TOKEN not configured. Set it as a secret before using this function.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate the provided token
  let body: { token?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body. Provide { token, email, password }." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (body.token !== bootstrapToken) {
    return new Response(
      JSON.stringify({ error: "Invalid bootstrap token" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!body.email || !body.password) {
    return new Response(
      JSON.stringify({ error: "email and password are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create user
  const { data: user, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: "Admin" },
  });

  if (error && !error.message.includes("already been registered")) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get user id
  let userId = user?.user?.id;
  if (!userId) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const existing = users?.users?.find((u: any) => u.email === body.email);
    userId = existing?.id;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Could not find user" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Assign admin role
  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  // Ensure company settings row exists
  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!existing) {
    await supabase.from("company_settings").insert({
      company_name: "Raizechem Pvt Ltd",
      invoice_series: "RC",
      state: "Telangana",
    });
  }

  return new Response(
    JSON.stringify({ success: true, userId, roleError: roleErr?.message }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
