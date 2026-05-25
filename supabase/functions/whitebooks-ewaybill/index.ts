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
  const status_cd = String(json?.status_cd ?? "");
  // Whitebooks /authenticate validates creds but does NOT return an authtoken.
  // Some deployments echo one in data.authtoken; otherwise treat status_cd=="1" as success.
  const token =
    json?.authtoken ||
    json?.data?.authtoken ||
    json?.AuthToken ||
    json?.result?.authtoken ||
    (status_cd === "1" ? "VALIDATED" : null);
  if (!res.ok || status_cd !== "1" || !token) {
    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { respHeaders[k] = v; });
    throw new Error(JSON.stringify({
      msg: "Whitebooks auth failed",
      status: res.status,
      status_cd,
      raw: rawText.slice(0, 800),
      response_headers: respHeaders,
      sent: {
        email: EMAIL,
        username: GST_USERNAME,
        password_len: GST_PASSWORD.length,
        client_id_preview: CLIENT_ID.slice(0, 6) + "...",
        client_secret_len: CLIENT_SECRET.length,
        gstin: GSTIN,
        ip_address: IP_ADDRESS,
      },
      url: url.toString().replace(GST_PASSWORD, "***"),
    }));
  }
  cachedAuthToken = token;
  cachedAuthExpiry = Date.now() + 5.5 * 60 * 60 * 1000;
  return token;
}

async function getHeaders() {
  const authToken = await getAuthToken();
  const h = apiHeaders(authToken);
  if (authToken === "VALIDATED") delete (h as any).authtoken;
  return h;
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
      // 2. Fetch line items
      const items = wb.source_type === "invoice"
        ? (await supabase.from("invoice_items").select("*, products(name, hsn_code, unit)").eq("invoice_id", wb.source_id)).data ?? []
        : (await supabase.from("branch_transfer_items").select("*, products(name, hsn_code, unit)").eq("branch_transfer_id", wb.source_id)).data ?? [];

      if (!items.length) {
        return new Response(JSON.stringify({ error: "Source document has no items" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 3. Fetch recipient (dealer for invoice, destination branch for transfer)
      let toName = "", toAddr1 = "", toAddr2 = "", toPlace = "", toPincode = 0, toGstinResolved = wb.to_gstin || "URP", toStateCode = Number(wb.to_state_code || 36);
      let docDate = new Date(wb.created_at);
      if (wb.source_type === "invoice") {
        const { data: inv } = await supabase.from("invoices").select("*, dealers(*)").eq("id", wb.source_id).single();
        const d = inv?.dealers;
        if (d) {
          toName = d.gst_legal_name || d.gst_trade_name || d.name || "";
          toAddr1 = d.shipping_address_line1 || d.address_line1 || "";
          toAddr2 = d.shipping_address_line2 || d.address_line2 || "";
          toPlace = d.shipping_city || d.city || "";
          toPincode = Number((d.shipping_pincode || d.pincode || "0").toString().replace(/\D/g, "")) || 0;
          toGstinResolved = wb.to_gstin || d.gst_number || "URP";
          toStateCode = Number(wb.to_state_code || d.state_code || 36);
        }
        if (inv?.invoice_date) docDate = new Date(inv.invoice_date);
      } else {
        const { data: bt } = await supabase.from("branch_transfers").select("*, to_branch:branches!branch_transfers_to_branch_id_fkey(*)").eq("id", wb.source_id).single();
        const b = bt?.to_branch;
        if (b) {
          toName = b.legal_name || b.branch_name || "";
          toAddr1 = b.address_line1 || "";
          toAddr2 = b.address_line2 || "";
          toPlace = b.city || "";
          toPincode = Number((b.pincode || "0").toString().replace(/\D/g, "")) || 0;
          toGstinResolved = wb.to_gstin || b.gst_number || "";
          toStateCode = Number(wb.to_state_code || b.state_code || 36);
        }
        if (bt?.transfer_date) docDate = new Date(bt.transfer_date);
      }

      // 4. Pre-validation (clearer than NIC error codes)
      const fromStateCode = Number(wb.from_state_code || wb.branches?.state_code || 36);
      const isInterState = fromStateCode !== toStateCode;
      const distance = Number(wb.distance_km || 0);
      const vehicleNo = (wb.vehicle_no || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const transMode = wb.transport_mode === "rail" ? "2" : wb.transport_mode === "air" ? "3" : wb.transport_mode === "ship" ? "4" : "1";

      const errors: string[] = [];
      if (distance < 1 || distance > 4000) errors.push("distance_km must be 1-4000");
      if (transMode === "1" && !vehicleNo) errors.push("vehicle_no required for road");
      if (!toAddr1) errors.push("recipient address missing");
      if (!toPlace) errors.push("recipient city missing");
      if (!toPincode) errors.push("recipient pincode missing");
      if (toGstinResolved !== "URP" && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9A-Z]$/.test(toGstinResolved)) errors.push("recipient GSTIN invalid");
      if (errors.length) {
        return new Response(JSON.stringify({ error: "Validation: " + errors.join(", ") }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 5. Construct Whitebooks/NIC payload
      const payload = {
        supplyType: "O",
        subSupplyType: wb.source_type === "branch_transfer" ? "5" : "1",
        docType: wb.source_type === "branch_transfer" ? "CHL" : "INV",
        docNo: wb.source_number,
        docDate: docDate.toLocaleDateString("en-GB"),
        fromGstin: wb.from_gstin || GSTIN,
        fromTrdName: wb.branches?.legal_name || wb.branches?.branch_name || "",
        fromAddr1: wb.branches?.address_line1 || "",
        fromAddr2: wb.branches?.address_line2 || "",
        fromPlace: wb.branches?.city || "",
        fromPincode: Number((wb.branches?.pincode || "0").toString().replace(/\D/g, "")) || 0,
        fromStateCode,
        actFromStateCode: fromStateCode,
        toGstin: toGstinResolved,
        toTrdName: toName || (toGstinResolved === "URP" ? "Unregistered Person" : ""),
        toAddr1,
        toAddr2,
        toPlace,
        toPincode,
        toStateCode,
        actToStateCode: toStateCode,
        transactionType: 1,
        totalValue: Number(wb.taxable_value),
        cgstValue: isInterState ? 0 : Number(wb.cgst_total),
        sgstValue: isInterState ? 0 : Number(wb.sgst_total),
        igstValue: isInterState ? Number(wb.igst_total || (Number(wb.cgst_total) + Number(wb.sgst_total))) : 0,
        cessValue: 0,
        totInvValue: Number(wb.doc_value),
        transMode,
        transDistance: String(distance),
        transporterName: wb.transporter_name || "",
        transporterId: wb.transporter_gstin || "",
        transDocNo: wb.transport_doc_no || "",
        transDocDate: wb.transport_doc_date ? new Date(wb.transport_doc_date).toLocaleDateString("en-GB") : "",
        vehicleNo,
        vehicleType: wb.vehicle_type || "R",
        itemList: items.map((i: any, idx: number) => {
          const gstRate = Number(i.gst_rate || 0);
          return {
            itemNo: idx + 1,
            productName: (i.products?.name || "Product").slice(0, 100),
            productDesc: (i.products?.name || "").slice(0, 100),
            hsnCode: Number((i.hsn_code || i.products?.hsn_code || "0").toString().replace(/\D/g, "")) || 0,
            quantity: Number(i.qty),
            qtyUnit: i.products?.unit || "NOS",
            cgstRate: isInterState ? 0 : gstRate / 2,
            sgstRate: isInterState ? 0 : gstRate / 2,
            igstRate: isInterState ? gstRate : 0,
            cessRate: 0,
            taxableAmount: Number(i.amount),
          };
        }),
      };

      // 6. Call Whitebooks
      const response = await fetch(WHITEBOOKS_GENERATE_ENDPOINT, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });

      const { raw, json: result } = await readWhitebooksJson(response);
      const data = result?.data ?? result;
      const ewbNo = data?.ewayBillNo ?? data?.ewbNo;
      const statusCd = String(result?.status_cd ?? result?.status ?? "");
      const isOk = response.ok && (statusCd === "1" || !!ewbNo);

      if (!isOk || !ewbNo) {
        const errs = Array.isArray(result?.error)
          ? result.error.map((e: any) => e.errorMessage || e.errorCode || JSON.stringify(e)).join("; ")
          : (result?.error?.message || result?.error?.errorMessage || result?.errorDesc || result?.message || data?.message);
        const errorMsg = errs || raw.slice(0, 500) || `WhiteBooks HTTP ${response.status}`;
        await supabase.from("waybills").update({
          status: "failed",
          error_msg: errorMsg,
          gsp_request: payload,
          gsp_response: result,
        }).eq("id", wb.id);
        return new Response(JSON.stringify({ error: errorMsg, raw: result }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("waybills").update({
        ewb_number: String(ewbNo),
        status: "generated",
        ewb_date: data?.ewayBillDate ? new Date(data.ewayBillDate).toISOString() : new Date().toISOString(),
        valid_until: data?.validUpto ? new Date(data.validUpto).toISOString() : null,
        gsp_request: payload,
        gsp_response: result,
        error_msg: null,
        generated_at: new Date().toISOString(),
      }).eq("id", wb.id);

      return new Response(JSON.stringify({ ok: true, ewb_number: ewbNo, valid_until: data?.validUpto }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
