import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify caller is admin
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    }
  );
  const {
    data: { user: caller },
  } = await supabaseUser.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: caller.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { action, ...body } = await req.json();

  try {
    if (action === "list") {
      // List all users with their roles
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw error;

      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      const rolesMap: Record<string, string[]> = {};
      for (const r of roles || []) {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      }

      const result = users.users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || "",
        created_at: u.created_at,
        roles: rolesMap[u.id] || [],
      }));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, full_name, roles } = body;
      if (!email || !password || !full_name) {
        throw new Error("email, password, full_name required");
      }

      // Domain check
      if (!email.endsWith("@raizechem.in")) {
        throw new Error("Only @raizechem.in emails allowed");
      }

      const { data: newUser, error } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      if (error) throw error;

      // Assign roles
      if (roles && roles.length > 0 && newUser.user) {
        const roleRows = roles.map((role: string) => ({
          user_id: newUser.user.id,
          role,
          assigned_by: caller.id,
        }));
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .insert(roleRows);
        if (roleErr) throw roleErr;
      }

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_roles") {
      const { user_id, roles } = body;
      if (!user_id) throw new Error("user_id required");

      // Delete existing roles
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);

      // Insert new roles
      if (roles && roles.length > 0) {
        const roleRows = roles.map((role: string) => ({
          user_id,
          role,
          assigned_by: caller.id,
        }));
        const { error } = await supabaseAdmin
          .from("user_roles")
          .insert(roleRows);
        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
