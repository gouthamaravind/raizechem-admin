import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function uniqueEmployeeCode(
  supabaseAdmin: ReturnType<typeof createClient>,
  requestedCode: string | undefined,
  email: string
) {
  const base = (requestedCode || email.split("@")[0] || "EMP")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "EMP";

  let candidate = base;
  let attempt = 0;

  while (attempt < 20) {
    const { data: existing } = await supabaseAdmin
      .from("employee_profiles")
      .select("id")
      .eq("employee_code", candidate)
      .maybeSingle();

    if (!existing) return candidate;

    attempt += 1;
    candidate = `${base.slice(0, 6)}${String(Date.now()).slice(-4)}${attempt}`;
  }

  return `EMP${String(Date.now()).slice(-6)}`;
}

async function upsertEmployeeProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    user_id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    employee_code?: string | null;
    roles?: string[];
  }
) {
  const role = params.roles?.includes("fieldops") ? "fieldops" : params.roles?.[0] || "sales";

  const { data: existing } = await supabaseAdmin
    .from("employee_profiles")
    .select("id, employee_code")
    .eq("user_id", params.user_id)
    .maybeSingle();

  const employeeCode = existing?.employee_code || await uniqueEmployeeCode(
    supabaseAdmin,
    params.employee_code || undefined,
    params.email
  );

  const payload = {
    user_id: params.user_id,
    employee_code: employeeCode,
    name: params.full_name,
    phone: params.phone || null,
    role,
    is_active: true,
  };

  const { error } = existing
    ? await supabaseAdmin.from("employee_profiles").update(payload).eq("user_id", params.user_id)
    : await supabaseAdmin.from("employee_profiles").insert(payload);

  if (error) throw error;
}

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

      const { data: employeeProfiles } = await supabaseAdmin
        .from("employee_profiles")
        .select("user_id, employee_code, phone, is_active");

      const employeeMap = new Map((employeeProfiles || []).map((profile) => [profile.user_id, profile]));

      const result = users.users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || "",
        created_at: u.created_at,
        roles: rolesMap[u.id] || [],
        employee_code: employeeMap.get(u.id)?.employee_code || null,
        phone: employeeMap.get(u.id)?.phone || null,
        employee_active: employeeMap.get(u.id)?.is_active ?? null,
      }));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, full_name, roles, phone, employee_code } = body;
      if (!email || !password || !full_name) {
        throw new Error("email, password, full_name required");
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

      if (newUser.user && roles?.includes("fieldops")) {
        await upsertEmployeeProfile(supabaseAdmin, {
          user_id: newUser.user.id,
          full_name,
          email,
          phone,
          employee_code,
          roles,
        });
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

      const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(user_id);
      const userEmail = userRecord.user?.email || `${user_id}@raizechem.in`;
      const fullName = (userRecord.user?.user_metadata?.full_name as string | undefined) || userRecord.user?.email || "Employee";

      if (roles?.includes("fieldops")) {
        await upsertEmployeeProfile(supabaseAdmin, {
          user_id,
          full_name: fullName,
          email: userEmail,
          roles,
        });
      } else {
        await supabaseAdmin
          .from("employee_profiles")
          .update({ is_active: false, role: roles?.[0] || "sales" })
          .eq("user_id", user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password) throw new Error("user_id and password required");
      if (String(password).length < 6) throw new Error("Password must be at least 6 characters");

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_dealer_assignments") {
      const { data: assignments, error } = await supabaseAdmin
        .from("dealer_assignments")
        .select("id, dealer_id, user_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const dealerIds = [...new Set((assignments || []).map((row) => row.dealer_id))];
      const userIds = [...new Set((assignments || []).map((row) => row.user_id))];

      const [{ data: dealers }, { data: employeeProfiles }, { data: profiles }] = await Promise.all([
        dealerIds.length
          ? supabaseAdmin.from("dealers").select("id, name, city, pincode").in("id", dealerIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? supabaseAdmin.from("employee_profiles").select("user_id, name, employee_code").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
          : Promise.resolve({ data: [] }),
      ]);

      const dealerMap = new Map((dealers || []).map((dealer) => [dealer.id, dealer]));
      const employeeMap = new Map((employeeProfiles || []).map((profile) => [profile.user_id, profile]));
      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

      const result = (assignments || []).map((assignment) => ({
        ...assignment,
        dealer: dealerMap.get(assignment.dealer_id) || null,
        employee: employeeMap.get(assignment.user_id) || null,
        profile: profileMap.get(assignment.user_id) || null,
      }));

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assign_dealer") {
      const { dealer_id, user_id } = body;
      if (!dealer_id || !user_id) throw new Error("dealer_id and user_id required");

      const { error } = await supabaseAdmin
        .from("dealer_assignments")
        .insert({ dealer_id, user_id, assigned_by: caller.id });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unassign_dealer") {
      const { assignment_id } = body;
      if (!assignment_id) throw new Error("assignment_id required");

      const { error } = await supabaseAdmin
        .from("dealer_assignments")
        .delete()
        .eq("id", assignment_id);
      if (error) throw error;

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
