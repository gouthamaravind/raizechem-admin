import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { EWB_ERROR_CODES } from "./error-codes.ts";

function enrichEwbError(raw: string): { codes: string[]; friendly: string; original: string } {
  const original = String(raw ?? "").trim();
  if (!original) return { codes: [], friendly: "", original };
  const matches = Array.from(original.matchAll(/\b(\d{3})\b/g)).map((m) => m[1]);
  const codes = Array.from(new Set(matches)).filter((c) => EWB_ERROR_CODES[c]);
  if (!codes.length) return { codes: [], friendly: original, original };
  const explained = codes.map((c) => `${c}: ${EWB_ERROR_CODES[c]}`).join(" • ");
  return { codes, friendly: `${explained}${original.includes(explained) ? "" : ` — NIC said: ${original}`}`, original };
}

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

  // Auth: require authenticated user with admin or accounts role
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Role check: admin or accounts only
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "accounts");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden: admin or accounts role required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


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
      const lastSegment = (s?: string | null) => {
        const parts = String(s || "").split(",").map((p) => p.trim()).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : "";
      };
      if (wb.source_type === "invoice") {
        const { data: inv } = await supabase.from("invoices").select("*, dealers(*)").eq("id", wb.source_id).single();
        const d = inv?.dealers;
        if (d) {
          toName = d.gst_legal_name || d.gst_trade_name || d.name || "";
          toAddr1 = d.shipping_address_line1 || d.address_line1 || "";
          toAddr2 = d.shipping_address_line2 || d.address_line2 || "";
          toPlace = d.shipping_city || d.city || lastSegment(d.shipping_address_line1 || d.address_line1) || d.state || "";
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
          toPlace = b.city || lastSegment(b.address_line1) || b.state || "";
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

      // 5. Construct Whitebooks/NIC payload (schema per WhiteBooks v1.03 genewaybill)
      // transactionType: 1=Regular, 2=Bill-To-Ship-To, 3=Bill-From-Dispatch-From, 4=Combo of 2 & 3
      const transactionType = Number(wb.transaction_type || body.transaction_type || 1);
      const cgstValue = isInterState ? 0 : Number(wb.cgst_total || 0);
      const sgstValue = isInterState ? 0 : Number(wb.sgst_total || 0);
      const igstValue = isInterState ? Number(wb.igst_total || 0) : 0;
      const cessValue = Number(wb.cess_total || 0);
      const cessNonAdvolValue = Number(wb.cess_non_advol_total || 0);
      const taxableValue = Number(wb.taxable_value || 0);
      const totInvValue = Number(wb.doc_value || (taxableValue + cgstValue + sgstValue + igstValue + cessValue + cessNonAdvolValue));

      const payload = {
        supplyType: "O",
        subSupplyType: wb.source_type === "branch_transfer" ? "5" : "1",
        subSupplyDesc: " ",
        docType: wb.source_type === "branch_transfer" ? "CHL" : "INV",
        docNo: wb.source_number,
        docDate: docDate.toLocaleDateString("en-GB"),
        fromGstin: wb.from_gstin || GSTIN,
        fromTrdName: wb.branches?.legal_name || wb.branches?.branch_name || "",
        fromAddr1: wb.branches?.address_line1 || "",
        fromAddr2: wb.branches?.address_line2 || "",
        fromPlace: wb.branches?.city || "",
        actFromStateCode: fromStateCode,
        fromPincode: Number((wb.branches?.pincode || "0").toString().replace(/\D/g, "")) || 0,
        fromStateCode,
        toGstin: toGstinResolved,
        toTrdName: toName || (toGstinResolved === "URP" ? "Unregistered Person" : ""),
        toAddr1,
        toAddr2,
        toPlace,
        toPincode,
        actToStateCode: toStateCode,
        toStateCode,
        transactionType,
        totalValue: taxableValue,
        cgstValue,
        sgstValue,
        igstValue,
        cessValue,
        cessNonAdvolValue,
        totInvValue,
        otherValue: 0,
        transMode,
        transDistance: String(distance),
        transporterName: wb.transporter_name || "",
        transporterId: wb.transporter_gstin || "",
        transDocNo: wb.transport_doc_no || "",
        transDocDate: wb.transport_doc_date ? new Date(wb.transport_doc_date).toLocaleDateString("en-GB") : "",
        vehicleNo,
        vehicleType: wb.vehicle_type || "R",
        itemList: items.map((i: any) => {
          const gstRate = Number(i.gst_rate || 0);
          return {
            productName: (i.products?.name || "Product").slice(0, 100),
            productDesc: (i.products?.name || "").slice(0, 100),
            hsnCode: Number((i.hsn_code || i.products?.hsn_code || "0").toString().replace(/\D/g, "")) || 0,
            quantity: Number(i.qty),
            qtyUnit: i.products?.unit || "NOS",
            taxableAmount: Number(i.amount),
            sgstRate: isInterState ? 0 : gstRate / 2,
            cgstRate: isInterState ? 0 : gstRate / 2,
            igstRate: isInterState ? gstRate : 0,
            cessRate: Number(i.cess_rate || 0),
            cessNonadvol: Number(i.cess_non_advol || 0),
          };
        }),
      };

      // 6. Call Whitebooks (retry once with fresh token if response is the bare {status_cd:"0"} auth-rejection)
      let response = await fetch(WHITEBOOKS_GENERATE_ENDPOINT, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });
      let parsed = await readWhitebooksJson(response);
      const isBareAuthReject = (r: any) =>
        r && typeof r === "object" && String(r.status_cd ?? "") === "0" && !r.error && !r.errorDesc && !r.message && !r.data;
      if (isBareAuthReject(parsed.json)) {
        cachedAuthToken = null; cachedAuthExpiry = 0;
        response = await fetch(WHITEBOOKS_GENERATE_ENDPOINT, {
          method: "POST",
          headers: await getHeaders(),
          body: JSON.stringify(payload),
        });
        parsed = await readWhitebooksJson(response);
      }
      const { raw, json: result } = parsed;
      const data = result?.data ?? result;
      const ewbNo = data?.ewayBillNo ?? data?.ewbNo;
      const statusCd = String(result?.status_cd ?? result?.status ?? "");
      const isOk = response.ok && (statusCd === "1" || !!ewbNo);

      if (!isOk || !ewbNo) {
        const errs = Array.isArray(result?.error)
          ? result.error.map((e: any) => `${e.errorCode ?? ""} ${e.errorMessage ?? e.error_msg ?? ""}`.trim()).join("; ")
          : (result?.error?.message || result?.error?.errorMessage || result?.errorDesc || result?.message || data?.message);
        let rawErr = errs || raw.slice(0, 500) || `WhiteBooks HTTP ${response.status}`;
        if (isBareAuthReject(result)) {
          rawErr = "Whitebooks rejected the request with status_cd=0 and no detail. Most likely the GSP authtoken/credentials are not valid for the NIC e-Way Bill API — re-check WHITEBOOKS_EWB_USERNAME / PASSWORD and that this GSTIN has API access enabled on the e-Way Bill portal (User Management → Create API User).";
        }
        const enriched = enrichEwbError(rawErr);
        await supabase.from("waybills").update({
          status: "failed",
          error_msg: enriched.friendly || rawErr,
          gsp_request: payload,
          gsp_response: result,
        }).eq("id", wb.id);
        return new Response(JSON.stringify({ error: enriched.friendly || rawErr, codes: enriched.codes, raw: result }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      const { reason, cancel_reason_code } = body;
      if (!wb.ewb_number) {
        return new Response(JSON.stringify({ error: "Waybill has no EWB number to cancel" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const payload = {
        ewbNo: Number(wb.ewb_number),
        cancelRsnCode: Number(cancel_reason_code || 4), // 1=Duplicate, 2=Order Cancelled, 3=Data Entry Mistake, 4=Others
        cancelRmrk: (reason || "Cancelled from ERP").slice(0, 100),
      };

      const response = await fetch(WHITEBOOKS_CANCEL_ENDPOINT, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });

      const { raw, json: result } = await readWhitebooksJson(response);
      const statusCd = String(result?.status_cd ?? result?.status ?? "");
      const okCancel = response.ok && (statusCd === "1" || result?.data?.cancelDate);
      if (!okCancel) {
        const errs = Array.isArray(result?.error)
          ? result.error.map((e: any) => `${e.errorCode ?? ""} ${e.errorMessage ?? ""}`.trim()).join("; ")
          : (result?.error?.message || result?.errorDesc || result?.message);
        const rawErr = errs || raw.slice(0, 500) || "Cancel failed";
        const enriched = enrichEwbError(rawErr);
        return new Response(JSON.stringify({ error: enriched.friendly || rawErr, codes: enriched.codes, raw: result }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("waybills").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
        gsp_response: result,
      }).eq("id", wb.id);

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
