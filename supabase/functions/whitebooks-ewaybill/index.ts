import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Whitebooks base. Production: https://api.whitebooks.in  Sandbox: https://apisandbox.whitebooks.in
const RAW_BASE = Deno.env.get("WHITEBOOKS_BASE_URL") ?? "https://api.whitebooks.in";
// Strip any path the user pasted; we always append the canonical wrapper path.
const ORIGIN = RAW_BASE
  .replace(/\/+$/, "")
  .replace(/\/(api\/)?ewaybill(api)?\/?(v[\d.]+)?\/?$/i, "")
  .replace(/\/eway\/?.*$/i, "");
// Whitebooks simplified e-Way Bill wrapper path (matches their Swagger / Postman collection)
const WHITEBOOKS_BASE = `${ORIGIN}/ewaybillapi/v1.03/`;
const WHITEBOOKS_AUTH_ENDPOINT = `${WHITEBOOKS_BASE}authenticate`;
const WHITEBOOKS_GENERATE_ENDPOINT = `${WHITEBOOKS_BASE}ewayapi/genewaybill`;
const WHITEBOOKS_CANCEL_ENDPOINT = `${WHITEBOOKS_BASE}ewayapi/canewb`;
const CLIENT_ID = Deno.env.get("WHITEBOOKS_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("WHITEBOOKS_CLIENT_SECRET") ?? "";
const GSTIN = Deno.env.get("WHITEBOOKS_GSTIN") ?? "";
const EMAIL = Deno.env.get("WHITEBOOKS_EMAIL") ?? "";
const GST_USERNAME = Deno.env.get("WHITEBOOKS_EWB_USERNAME") ?? ""; // NIC API username (e.g. Raize@1234_API_NEW)
const GST_PASSWORD = Deno.env.get("WHITEBOOKS_EWB_PASSWORD") ?? "";
const IP_ADDRESS = Deno.env.get("WHITEBOOKS_IP_ADDRESS") ?? "127.0.0.1";

// Per Whitebooks docs:
// - Auth endpoint takes email/username/password as QUERY params and
//   ip_address/client_id/client_secret/gstin as HEADERS.
// - Subsequent calls reuse the header set plus an `authtoken` header.
function authHeaders(): Record<string, string> {
  return {
    "accept": "*/*",
    "ip_address": IP_ADDRESS,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "gstin": GSTIN,
  };
}

function apiHeaders(authToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "accept": "*/*",
    "ip_address": IP_ADDRESS,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "gstin": GSTIN,
    "gst_username": GST_USERNAME,
    "authtoken": authToken,
  };
}

let cachedAuthToken: string | null = null;
let cachedAuthExpiry = 0;

async function getAuthToken(): Promise<string> {
  if (cachedAuthToken && Date.now() < cachedAuthExpiry) return cachedAuthToken;
  const url = new URL(WHITEBOOKS_AUTH_ENDPOINT);
  url.searchParams.set("email", EMAIL);
  url.searchParams.set("username", GST_USERNAME);
  url.searchParams.set("password", GST_PASSWORD);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
  });

  const rawText = await res.text();
  let json: any = {};
  try { json = JSON.parse(rawText); } catch { /* keep raw */ }
  const token =
    json?.authtoken ||
    json?.data?.authtoken ||
    json?.AuthToken ||
    json?.result?.authtoken;
  if (!res.ok || !token) {
    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { respHeaders[k] = v; });
    const sent = baseHeaders();
    const sentMasked = {
      email: sent.email,
      gst_username: sent.gst_username,
      password_len: sent.password.length,
      client_id_preview: sent.client_id.slice(0, 6) + "...",
      client_secret_len: sent.client_secret.length,
      Gstin: sent.Gstin,
      ip_address: sent.ip_address,
    };
    throw new Error(JSON.stringify({
      msg: "Whitebooks auth failed",
      status: res.status,
      raw: rawText.slice(0, 800),
      response_headers: respHeaders,
      sent_headers: sentMasked,
      url: WHITEBOOKS_AUTH_ENDPOINT,
    }));
  }
  cachedAuthToken = token;
  cachedAuthExpiry = Date.now() + 5.5 * 60 * 60 * 1000;
  return token;
}

async function getHeaders() {
  const authToken = await getAuthToken();
  return { ...baseHeaders(), authtoken: authToken };
}

async function readWhitebooksJson(response: Response) {
  const raw = await response.text();
  if (!raw.trim()) return { raw, json: {} };
  try {
    return { raw, json: JSON.parse(raw) };
  } catch {
    return { raw, json: { status_cd: "0", error: { message: raw.slice(0, 500) } } };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = url.searchParams.get("action") ?? (body as any).action ?? "generate";

    if (action === "auth_test") {
      try {
        const token = await getAuthToken();
        return new Response(JSON.stringify({ ok: true, token_preview: token.slice(0, 12) + "...", base: ORIGIN }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e), base: ORIGIN }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!body.waybill_id) {
      return new Response(
        JSON.stringify({ error: "waybill_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Fetch waybill data
    const { data: wb, error: wbErr } = await supabase
      .from("waybills")
      .select("*, branches(*)")
      .eq("id", body.waybill_id)
      .single();

    if (wbErr || !wb) {
      return new Response(JSON.stringify({ error: "Waybill not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate") {
      // 2. Fetch items
      const items = wb.source_type === "invoice"
        ? (await supabase.from("invoice_items").select("*, products(name, hsn_code, unit)").eq("invoice_id", wb.source_id)).data ?? []
        : (await supabase.from("branch_transfer_items").select("*, products(name, hsn_code, unit)").eq("branch_transfer_id", wb.source_id)).data ?? [];

      // 3. Construct Whitebooks Simplified JSON Payload
      const payload = {
        supplyType: "O",
        subSupplyType: wb.source_type === "branch_transfer" ? "5" : "1", // 5 = Own use, 1 = Supply
        docType: wb.source_type === "branch_transfer" ? "CHL" : "INV",
        docNo: wb.source_number,
        docDate: new Date(wb.created_at).toLocaleDateString("en-GB"), // DD/MM/YYYY
        fromGstin: wb.from_gstin || GSTIN,
        fromTrdName: wb.branches?.legal_name || wb.branches?.branch_name || "",
        fromAddr1: wb.branches?.address_line1 || "",
        fromAddr2: wb.branches?.address_line2 || "",
        fromPlace: wb.branches?.city || "",
        fromPincode: Number(wb.branches?.pincode || 0),
        fromStateCode: Number(wb.from_state_code || 36),
        actFromStateCode: Number(wb.from_state_code || 36),
        toGstin: wb.to_gstin || "URP",
        toTrdName: wb.to_gstin === "URP" ? "Unregistered Person" : "",
        toAddr1: "",
        toAddr2: "",
        toPlace: "",
        toPincode: 0,
        toStateCode: Number(wb.to_state_code || 36),
        actToStateCode: Number(wb.to_state_code || 36),
        transactionType: 1,
        totalValue: Number(wb.taxable_value),
        cgstValue: Number(wb.cgst_total),
        sgstValue: Number(wb.sgst_total),
        igstValue: Number(wb.igst_total),
        cessValue: 0,
        totInvValue: Number(wb.doc_value),
        transMode: wb.transport_mode === "road" ? "1" : "1",
        transDistance: String(wb.distance_km || 0),
        transporterName: wb.transporter_name || "",
        transporterId: wb.transporter_gstin || "",
        transDocNo: wb.transport_doc_no || "",
        transDocDate: wb.transport_doc_date ? new Date(wb.transport_doc_date).toLocaleDateString("en-GB") : "",
        vehicleNo: (wb.vehicle_no || "").replace(/[^A-Z0-9]/gi, "").toUpperCase(),
        vehicleType: wb.vehicle_type || "R",
        itemList: items.map((i: any, idx: number) => ({
          itemNo: idx + 1,
          productName: i.products?.name || "Product",
          productDesc: i.products?.name || "",
          hsnCode: Number(i.hsn_code || i.products?.hsn_code || 0),
          quantity: Number(i.qty),
          qtyUnit: i.products?.unit || "NOS",
          cgstRate: Number(i.gst_rate || 0) / 2,
          sgstRate: Number(i.gst_rate || 0) / 2,
          igstRate: 0,
          cessRate: 0,
          taxableAmount: Number(i.amount),
        })),
      };

      // 4. Call Whitebooks API
      const response = await fetch(WHITEBOOKS_GENERATE_ENDPOINT, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });

      const { raw, json: result } = await readWhitebooksJson(response);
      const data = result?.data ?? result;
      const ewbNo = data?.ewayBillNo ?? data?.ewbNo;
      const isOk = response.ok && (result?.status === 1 || result?.status_cd === 1 || ewbNo);

      if (!isOk || !ewbNo) {
        const errorMsg = result?.error?.message
          || (Array.isArray(result?.error) ? result.error.map((e: any) => e.errorMessage || e.errorCode).join("; ") : null)
          || result?.message
          || data?.message
          || raw.slice(0, 500)
          || JSON.stringify(result).slice(0, 500)
          || `WhiteBooks returned HTTP ${response.status} with an empty response`;
        await supabase.from("waybills").update({
          status: "failed",
          error_msg: errorMsg,
          gsp_request: payload,
          gsp_response: result,
        }).eq("id", wb.id);

        return new Response(JSON.stringify({ error: errorMsg, raw: result }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 5. Update Waybill with Success
      await supabase.from("waybills").update({
        ewb_number: String(ewbNo),
        status: "generated",
        ewb_date: data?.ewayBillDate || new Date().toISOString(),
        valid_until: data?.validUpto,
        gsp_request: payload,
        gsp_response: result,
        error_msg: null,
      }).eq("id", wb.id);

      return new Response(JSON.stringify({ ok: true, ewb_number: ewbNo }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cancel") {
      const { reason } = body;
      const payload = {
        ewbNo: Number(wb.ewb_number),
        cancelRsnCode: 4, // 4 = Data entry error
        cancelRmrk: reason || "Cancelled from ERP",
      };

      const response = await fetch(WHITEBOOKS_CANCEL_ENDPOINT, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });

      const { json: result } = await readWhitebooksJson(response);

      if (!response.ok || result.error) {
        return new Response(JSON.stringify({ error: result.error?.message || "Cancel failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("waybills").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      }).eq("id", wb.id);

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
