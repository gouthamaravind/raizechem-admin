import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create user
  const { data: user, error } = await supabase.auth.admin.createUser({
    email: "admin@raizechem.in",
    password: "Raize@123",
    email_confirm: true,
    user_metadata: { full_name: "Admin" },
  });

  if (error && !error.message.includes("already been registered")) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, headers: { "Content-Type": "application/json" } 
    });
  }

  // Get user id
  let userId = user?.user?.id;
  if (!userId) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const existing = users?.users?.find((u: any) => u.email === "admin@raizechem.in");
    userId = existing?.id;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Could not find user" }), { 
      status: 400, headers: { "Content-Type": "application/json" } 
    });
  }

  // Assign admin role
  const { error: roleErr } = await supabase.from("user_roles").upsert(
    { user_id: userId, role: "admin" },
    { onConflict: "user_id,role" }
  );

  // Ensure company settings row exists
  const { data: existing } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
  if (!existing) {
    await supabase.from("company_settings").insert({ 
      company_name: "Raizechem Pvt Ltd", invoice_series: "RC", state: "Telangana" 
    });
  }

  return new Response(JSON.stringify({ 
    success: true, userId, roleError: roleErr?.message 
  }), { headers: { "Content-Type": "application/json" } });
});
