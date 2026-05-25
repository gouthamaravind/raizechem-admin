// Daily cron: scans dealers with overdue invoices and enqueues reminder emails.
// Tiers: 15-day (yellow, soft), 7-day (red, urgent). Throttle: 1 reminder per dealer per 7 days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: require CRON_SECRET or service-role bearer
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (bearer !== serviceKey && (!cronSecret || bearer !== cronSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );


  const today = new Date();
  const isoDay = today.toISOString().slice(0, 10);

  // Fetch open invoices with dealer info
  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, dealer_id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status, dealers(id, name, email, contact_person)")
    .not("status", "in", "(paid,void)");
  if (invErr) return new Response(JSON.stringify({ error: invErr.message }), { status: 500, headers: corsHeaders });

  type Item = { invoice_number: string; invoice_date: string; due_date: string | null; outstanding: number; days_overdue: number };
  const dealerMap = new Map<string, { dealer: any; items: Item[]; total: number; maxDays: number }>();

  for (const inv of invoices || []) {
    const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
    if (outstanding <= 0.01) continue;
    const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
    const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
    if (days < 7) continue; // only act once dealer crosses the 7-day soft warning
    const dealer: any = (inv as any).dealers;
    if (!dealer?.email) continue;
    const key = inv.dealer_id;
    if (!dealerMap.has(key)) dealerMap.set(key, { dealer, items: [], total: 0, maxDays: 0 });
    const d = dealerMap.get(key)!;
    d.items.push({
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      outstanding,
      days_overdue: days,
    });
    d.total += outstanding;
    if (days > d.maxDays) d.maxDays = days;
  }

  // Throttle: skip dealers already reminded in last 7 days
  const cutoff = new Date(today.getTime() - 7 * 86400000).toISOString();
  const dealerIds = Array.from(dealerMap.keys());
  const { data: recent } = dealerIds.length
    ? await supabase.from("reminder_log").select("dealer_id").eq("status", "sent").gte("sent_at", cutoff).in("dealer_id", dealerIds)
    : { data: [] as any[] };
  const recentlyReminded = new Set((recent || []).map((r: any) => r.dealer_id));

  let sent = 0, skipped = 0, failed = 0;
  for (const [dealerId, d] of dealerMap) {
    // Tier gate: 7-day band → red, 15-day band → yellow. Always send if >= 7 days
    const tier = d.maxDays >= 30 ? "critical" : d.maxDays >= 15 ? "warning" : "early";
    if (recentlyReminded.has(dealerId)) { skipped++; continue; }

    try {
      const { error: sErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "dealer-overdue-reminder",
          recipientEmail: d.dealer.email,
          idempotencyKey: `auto-reminder-${dealerId}-${isoDay}`,
          templateData: {
            dealerName: d.dealer.name,
            contactPerson: d.dealer.contact_person,
            totalOutstanding: d.total,
            maxDaysOverdue: d.maxDays,
            invoices: d.items.sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 25),
          },
        },
      });
      if (sErr) throw sErr;
      await supabase.from("reminder_log").insert({
        dealer_id: dealerId, channel: "email", status: "sent", recipient: d.dealer.email,
        total_outstanding: d.total, max_days_overdue: d.maxDays, invoice_count: d.items.length, tier,
      });
      sent++;
    } catch (e: any) {
      await supabase.from("reminder_log").insert({
        dealer_id: dealerId, channel: "email", status: "failed",
        total_outstanding: d.total, max_days_overdue: d.maxDays, invoice_count: d.items.length, tier,
        error_message: (e?.message ?? "unknown").slice(0, 500),
      });
      failed++;
    }
  }

  return new Response(JSON.stringify({ sent, skipped, failed, dealerCount: dealerMap.size }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
