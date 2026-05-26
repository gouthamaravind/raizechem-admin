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

function toNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const s = String(v).trim().replace(/\D/g, "");
  if (!s) return fallback;
  const n = parseInt(s);
  return isNaN(n) ? fallback : n;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAW_BASE = Deno.env.get("WHITEBOOKS_BASE_URL") ?? "https://api.whitebooks.in";
const ORIGIN = RAW_BASE.replace(/\/+$/, "").replace(/\/(api\/)?ewaybill(api)?\/?(v[\d.]+)?\/?$/i, "").replace(/\/eway\/?.*$/i, "");
const WHITEBOOKS_BASE = `${ORIGIN}/ewaybillapi/v1.03/`;
const WHITEBOOKS_GENERATE_ENDPOINT = `${WHITEBOOKS_BASE}ewayapi/genewaybill`;
const WHITEBOOKS_CANCEL_ENDPOINT = `${WHITEBOOKS_BASE}ewayapi/canewb`;
const WHITEBOOKS_AUTH_ENDPOINT = `${WHITEBOOKS_BASE}authenticate`;

const CLIENT_ID = Deno.env.get("WHITEBOOKS_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("WHITEBOOKS_CLIENT_SECRET") ?? "";
const GSTIN = Deno.env.get("WHITEBOOKS_GSTIN") ?? "";
const EMAIL = Deno.env.get("WHITEBOOKS_EMAIL") ?? "";
const GST_USERNAME = Deno.env.get("WHITEBOOKS_EWB_USERNAME") ?? "";
const GST_PASSWORD = Deno.env.get("WHITEBOOKS_EWB_PASSWORD") ?? "";
const IP_ADDRESS = Deno.env.get("WHITEBOOKS_IP_ADDRESS") ?? "127.0.0.1";

let cachedAuthToken: string | null = null;
let cachedAuthExpiry = 0;

function withEmail(endpoint: string): string {
  const u = new URL(endpoint);
  if (EMAIL) u.searchParams.set("email", EMAIL);
  return u.toString();
}

async function getAuthToken(): Promise<string> {
  if (cachedAuthToken && Date.now() < cachedAuthExpiry) return cachedAuthToken;
  const url = new URL(withEmail(WHITEBOOKS_AUTH_ENDPOINT));
  url.searchParams.set("username", GST_USERNAME);
  url.searchParams.set("password", GST_PASSWORD);
  
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "accept": "*/*",
      "ip_address": IP_ADDRESS,
      "client_id": CLIENT_ID,
      "client_secret": CLIENT_SECRET,
      "gstin": GSTIN,
    },
  });

  const rawText = await res.text();
  let json: any = {};
  try { json = JSON.parse(rawText); } catch { /* keep raw */ }
  
  const token = json?.data?.authtoken || json?.authtoken || (json?.status_cd === "1" ? "VALIDATED" : "");
  
  if (!res.ok || !token) {
    throw new Error(`Whitebooks auth failed: ${rawText.slice(0, 200)}`);
  }
  
  cachedAuthToken = token;
  cachedAuthExpiry = Date.now() + 5.5 * 60 * 60 * 1000;
  return token;
}

async function getHeaders() {
  const authToken = await getAuthToken();
  return {
    "Content-Type": "application/json",
    "accept": "*/*",
    "ip_address": IP_ADDRESS,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "gstin": GSTIN,
    "authtoken": authToken === "VALIDATED" ? "" : authToken,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = url.searchParams.get("action") ?? body.action ?? "generate";

    if (!body.waybill_id) return new Response(JSON.stringify({ error: "waybill_id required" }), { status: 400, headers: corsHeaders });

    const { data: wb, error: wbErr } = await supabase.from("waybills").select("*, branches(*)").eq("id", body.waybill_id).single();
    if (wbErr || !wb) return new Response(JSON.stringify({ error: "Waybill not found" }), { status: 404, headers: corsHeaders });

    if (action === "generate") {
      // 1. Fetch Source & Items
      const items = wb.source_type === "invoice"
        ? (await supabase.from("invoice_items").select("*, products(name, hsn_code, unit)").eq("invoice_id", wb.source_id)).data ?? []
        : (await supabase.from("branch_transfer_items").select("*, products(name, hsn_code, unit)").eq("branch_transfer_id", wb.source_id)).data ?? [];

      if (!items.length) return new Response(JSON.stringify({ error: "No items found" }), { status: 400, headers: corsHeaders });

      // 2. Resolve From/To Details
      const branch = wb.branches;
      let toGstin = wb.to_gstin || "URP", toName = "Unregistered Person", toAddr1 = "", toAddr2 = "", toCity = "", toPincode = 0, toStateCode = 36;
      let docDate = new Date(wb.created_at);

      if (wb.source_type === "invoice") {
        const { data: inv } = await supabase.from("invoices").select("*, dealers(*)").eq("id", wb.source_id).single();
        const d = inv?.dealers;
        if (d) {
          toGstin = d.gst_number || "URP";
          toName = d.gst_legal_name || d.name;
          toAddr1 = (d.shipping_address_line1 || d.address_line1 || "").slice(0, 100);
          toAddr2 = (d.shipping_address_line2 || d.address_line2 || "").slice(0, 100);
          toCity = d.shipping_city || d.city || "";
          toPincode = toNum(d.shipping_pincode || d.pincode);
          toStateCode = toNum(d.state_code, 36);
        }
        if (inv?.invoice_date) docDate = new Date(inv.invoice_date);
      } else {
        const { data: bt } = await supabase.from("branch_transfers").select("*, to_branch:branches!branch_transfers_to_branch_id_fkey(*)").eq("id", wb.source_id).single();
        const b = bt?.to_branch;
        if (b) {
          toGstin = b.gst_number || "";
          toName = b.legal_name || b.branch_name;
          toAddr1 = (b.address_line1 || "").slice(0, 100);
          toAddr2 = (b.address_line2 || "").slice(0, 100);
          toCity = b.city || "";
          toPincode = toNum(b.pincode);
          toStateCode = toNum(b.state_code, 36);
        }
      }

      const fromStateCode = toNum(wb.from_state_code || branch?.state_code, 36);
      const isInterState = fromStateCode !== toStateCode;

      // 3. Construct Payload
      const payload = {
        supplyType: "O",
        subSupplyType: wb.source_type === "branch_transfer" ? "5" : "1",
        docType: wb.source_type === "branch_transfer" ? "CHL" : "INV",
        docNo: wb.source_number,
        docDate: docDate.toLocaleDateString("en-GB"),
        fromGstin: branch?.gst_number || GSTIN,
        fromTrdName: branch?.legal_name || branch?.branch_name || "",
        fromAddr1: (branch?.address_line1 || "").slice(0, 100),
        fromAddr2: (branch?.address_line2 || "").slice(0, 100),
        fromPlace: branch?.city || "",
        fromPincode: toNum(branch?.pincode),
        fromStateCode: fromStateCode,
        actualFromStateCode: fromStateCode,
        toGstin: toGstin === "URP" ? "URP" : toGstin,
        toTrdName: toName,
        toAddr1: toAddr1 || "Address",
        toAddr2: toAddr2,
        toPlace: toCity || "City",
        toPincode: toPincode,
        toStateCode: toStateCode,
        actualToStateCode: toStateCode,
        transactionType: 1,
        totalValue: Number(wb.taxable_value),
        cgstValue: isInterState ? 0 : Number(wb.cgst_total),
        sgstValue: isInterState ? 0 : Number(wb.sgst_total),
        igstValue: isInterState ? Number(wb.igst_total) : 0,
        cessValue: 0,
        totInvValue: Number(wb.doc_value),
        transMode: (wb.vehicle_no || "").length > 5 ? "1" : "",
        transDistance: "0",
        transporterName: wb.transporter_name || "",
        transporterId: wb.transporter_gstin || "",
        vehicleNo: (wb.vehicle_no || "").replace(/[^A-Z0-9]/gi, "").toUpperCase(),
        vehicleType: wb.vehicle_type || "R",
        itemList: items.map((i: any, idx: number) => {
          const gstRate = Number(i.gst_rate || 0);
          return {
            itemNo: idx + 1,
            productName: (i.products?.name || "Product").slice(0, 100),
            productDesc: (i.products?.name || "").slice(0, 100),
            hsnCode: toNum(i.hsn_code || i.products?.hsn_code),
            quantity: Number(i.qty),
            qtyUnit: i.products?.unit || "NOS",
            cgstRate: isInterState ? 0 : gstRate / 2,
            sgstRate: isInterState ? 0 : gstRate / 2,
            igstRate: isInterState ? gstRate : 0,
            taxableAmount: Number(i.amount),
          };
        }),
      };

      // 4. API Call
      const response = await fetch(withEmail(WHITEBOOKS_GENERATE_ENDPOINT), {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const data = result?.data || result;

      if (!response.ok || !data?.ewayBillNo) {
        const err = result?.error?.message || result?.message || JSON.stringify(result);
        const enriched = enrichEwbError(err);
        await supabase.from("waybills").update({ status: "failed", error_msg: enriched.friendly, gsp_request: payload, gsp_response: result }).eq("id", wb.id);
        return new Response(JSON.stringify({ error: enriched.friendly }), { status: 400, headers: corsHeaders });
      }

      await supabase.from("waybills").update({
        ewb_number: String(data.ewayBillNo),
        status: "generated",
        ewb_date: new Date().toISOString(),
        valid_until: data.validUpto,
        gsp_request: payload,
        gsp_response: result,
      }).eq("id", wb.id);

      return new Response(JSON.stringify({ ok: true, ewb_number: data.ewayBillNo }), { headers: corsHeaders });
    }

    if (action === "cancel") {
      const payload = { ewbNo: Number(wb.ewb_number), cancelRsnCode: 4, cancelRmrk: body.reason || "Cancelled" };
      const response = await fetch(withEmail(WHITEBOOKS_CANCEL_ENDPOINT), { 
        method: "POST", 
        headers: await getHeaders(), 
        body: JSON.stringify(payload) 
      });
      if (!response.ok) throw new Error("Cancel failed");
      await supabase.from("waybills").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", wb.id);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
