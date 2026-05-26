import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { EWB_ERROR_CODES } from "./error-codes.ts";

/**
 * Enhanced Error Parsing
 * Extracts 3-digit NIC error codes and provides friendly explanations.
 */
function enrichEwbError(raw: any): { codes: string[]; friendly: string; original: string } {
  const original = typeof raw === 'string' ? raw : JSON.stringify(raw);
  if (!original || original === '{}') return { codes: [], friendly: "Unknown Error", original };
  
  const matches = Array.from(original.matchAll(/\b(\d{3,4})\b/g)).map((m) => m[1]);
  const codes = Array.from(new Set(matches)).filter((c) => EWB_ERROR_CODES[c]);
  
  if (!codes.length) return { codes: [], friendly: original.slice(0, 500), original };
  
  const explained = codes.map((c) => `${c}: ${EWB_ERROR_CODES[c]}`).join(" • ");
  return { 
    codes, 
    friendly: explained.length > 500 ? explained.slice(0, 500) + "..." : explained, 
    original 
  };
}

/**
 * Parse NIC Custom Date String (e.g., "26/05/2026 11:30:00 AM") into ISO
 */
function parseNicDate(s: any): string | null {
  if (!s) return null;
  const str = String(s).trim();
  // Match DD/MM/YYYY HH:MM:SS AM/PM
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (m) {
    let [, d, mo, y, hh = "0", mm = "0", ss = "0", ap] = m;
    let h = parseInt(hh);
    if (ap?.toUpperCase() === "PM" && h < 12) h += 12;
    if (ap?.toUpperCase() === "AM" && h === 12) h = 0;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, h, +mm, +ss));
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

/**
 * Safe numeric conversion
 */
function toNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const s = String(v).trim().replace(/\D/g, "");
  if (!s) return fallback;
  const n = parseInt(s);
  return isNaN(n) ? fallback : n;
}

/**
 * Format Date as DD/MM/YYYY (NIC standard)
 */
function formatNicDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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
  
  console.log(`[EWB] Authenticating for GSTIN: ${GSTIN}...`);
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
  try { json = JSON.parse(rawText); } catch { /* ignore */ }
  
  const token = json?.data?.authtoken || json?.authtoken || (json?.status_cd === "1" ? "VALIDATED" : "");
  
  if (!res.ok || !token || json?.status_cd === "0") {
    console.error(`[EWB] Auth Failed: ${rawText}`);
    throw new Error(`Whitebooks auth failed: ${json?.error?.message || rawText.slice(0, 100)}`);
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
      const items = wb.source_type === "invoice"
        ? (await supabase.from("invoice_items").select("*, products(name, hsn_code, unit)").eq("invoice_id", wb.source_id)).data ?? []
        : (await supabase.from("branch_transfer_items").select("*, products(name, hsn_code, unit)").eq("branch_transfer_id", wb.source_id)).data ?? [];

      if (!items.length) return new Response(JSON.stringify({ error: "No items found" }), { status: 400, headers: corsHeaders });

      const branch = wb.branches;
      let toGstin = wb.to_gstin || "URP", 
          toName = "Unregistered Person", 
          toAddr1 = "", 
          toAddr2 = "", 
          toCity = "", 
          toPincode = 0, 
          toStateCode = 36;
      let docDate = wb.created_at;

      if (wb.source_type === "invoice") {
        const { data: inv } = await supabase.from("invoices").select("*, dealers(*)").eq("id", wb.source_id).single();
        const d = inv?.dealers;
        if (d) {
          toGstin = d.gst_number || "URP";
          toName = (d.gst_legal_name || d.name || "Customer").slice(0, 99);
          toAddr1 = (d.shipping_address_line1 || d.address_line1 || "Address").slice(0, 99);
          toAddr2 = (d.shipping_address_line2 || d.address_line2 || "").slice(0, 99);
          toCity = (d.shipping_city || d.city || "City").slice(0, 49);
          toPincode = toNum(d.shipping_pincode || d.pincode);
          toStateCode = toNum(d.state_code || d.gst_number?.slice(0, 2), 36);
        }
        if (inv?.invoice_date) docDate = inv.invoice_date;
      } else {
        const { data: bt } = await supabase.from("branch_transfers").select("*, to_branch:branches!branch_transfers_to_branch_id_fkey(*)").eq("id", wb.source_id).single();
        const b = bt?.to_branch;
        if (b) {
          toGstin = b.gst_number || "";
          toName = (b.legal_name || b.branch_name || "Branch").slice(0, 99);
          toAddr1 = (b.address_line1 || "Address").slice(0, 99);
          toAddr2 = (b.address_line2 || "").slice(0, 99);
          toCity = (b.city || "City").slice(0, 49);
          toPincode = toNum(b.pincode);
          toStateCode = toNum(b.state_code || b.gst_number?.slice(0, 2), 36);
        }
        if (bt?.transfer_date) docDate = bt.transfer_date;
      }

      const fromStateCode = toNum(wb.from_state_code || branch?.state_code || branch?.gst_number?.slice(0, 2), 36);
      const isInterState = fromStateCode !== toStateCode;

      const payload = {
        supplyType: "O",
        subSupplyType: wb.source_type === "branch_transfer" ? "5" : "1",
        docType: wb.source_type === "branch_transfer" ? "CHL" : "INV",
        docNo: wb.source_number,
        docDate: formatNicDate(docDate),
        fromGstin: branch?.gst_number || GSTIN,
        fromTrdName: (branch?.legal_name || branch?.branch_name || "Seller").slice(0, 99),
        fromAddr1: (branch?.address_line1 || "Address").slice(0, 99),
        fromAddr2: (branch?.address_line2 || "").slice(0, 99),
        fromPlace: (branch?.city || "City").slice(0, 49),
        fromPincode: toNum(branch?.pincode),
        fromStateCode: fromStateCode,
        actualFromStateCode: fromStateCode,
        toGstin: toGstin === "URP" ? "URP" : toGstin,
        toTrdName: toName,
        toAddr1: toAddr1,
        toAddr2: toAddr2,
        toPlace: toCity,
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
        transMode: (wb.vehicle_no || "").length >= 6 ? "1" : "",
        transDistance: 0,
        transporterName: (wb.transporter_name || "").slice(0, 99),
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
            qtyUnit: (i.products?.unit || "NOS").slice(0, 8),
            taxableAmount: Number(i.amount),
            sgstRate: isInterState ? 0 : gstRate / 2,
            cgstRate: isInterState ? 0 : gstRate / 2,
            igstRate: isInterState ? gstRate : 0,
            cessRate: 0,
          };
        }),
      };

      const response = await fetch(withEmail(WHITEBOOKS_GENERATE_ENDPOINT), {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const data = result?.data || result;

      if (!response.ok || !data?.ewayBillNo) {
        const rawErr = result?.error?.message || result?.message || JSON.stringify(result);
        const enriched = enrichEwbError(rawErr);
        await supabase.from("waybills").update({ status: "failed", error_msg: enriched.friendly, gsp_request: payload, gsp_response: result }).eq("id", wb.id);
        return new Response(JSON.stringify({ error: enriched.friendly }), { status: 400, headers: corsHeaders });
      }

      await supabase.from("waybills").update({
        ewb_number: String(data.ewayBillNo),
        status: "generated",
        ewb_date: parseNicDate(data.ewayBillDate) || new Date().toISOString(),
        valid_until: parseNicDate(data.validUpto),
        gsp_request: payload,
        gsp_response: result,
        error_msg: null,
      }).eq("id", wb.id);

      return new Response(JSON.stringify({ ok: true, ewb_number: data.ewayBillNo }), { headers: corsHeaders });
    }

    if (action === "cancel") {
      const payload = { ewbNo: Number(wb.ewb_number), cancelRsnCode: 4, cancelRmrk: (body.reason || "Cancelled").slice(0, 99) };
      const response = await fetch(withEmail(WHITEBOOKS_CANCEL_ENDPOINT), { method: "POST", headers: await getHeaders(), body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || result?.status_cd === "0") throw new Error(result?.error?.message || "Cancel failed");
      await supabase.from("waybills").update({ status: "cancelled", cancelled_at: new Date().toISOString(), gsp_response: result }).eq("id", wb.id);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
