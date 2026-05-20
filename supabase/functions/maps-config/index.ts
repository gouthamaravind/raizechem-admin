// Returns the public Google Maps browser key + tracking id to the frontend.
// The key is referrer-restricted in Google Cloud Console, so exposure is safe.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const browserKey =
    Deno.env.get("GOOGLE_MAPS_BROWSER_KEY") ||
    Deno.env.get("VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY") ||
    "";
  return new Response(
    JSON.stringify({
      browserKey,
      mapId: Deno.env.get("GOOGLE_MAPS_MAP_ID") || "",
      trackingId:
        Deno.env.get("GOOGLE_MAPS_TRACKING_ID") ||
        Deno.env.get("VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID") ||
        "",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
