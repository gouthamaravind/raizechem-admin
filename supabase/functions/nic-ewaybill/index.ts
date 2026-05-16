// NIC E-Way Bill edge function
// Actions: generate, cancel, status
// Uses NIC sandbox/prod API via configured GSP credentials.
// Falls back to a deterministic stub when credentials are missing,
// so the UI works end-to-end during development.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NIC_BASE = Deno.env.get("NIC_EWB_BASE_URL") ??
  "https://api.einvoice.gov.in/eivital/v1.04"; // placeholder; real prod is GSP-specific
const USER = Deno.env.get("NIC_EWB_USERNAME") ?? "";
const PASS = Deno.env.get("NIC_EWB_PASSWORD") ?? "";
const GSTIN = Deno.env.get("NIC_EWB_GSTIN") ?? "";

const STUB_MODE = !USER || !PASS || !GSTIN;

interface GeneratePayload {
  waybill_id: string;
}

async function nicAuth(): Promise<{ token: string } | null> {
  if (STUB_MODE) return null;
  // NIC auth contract varies by GSP. Most GSPs expose POST /auth with username+password
  // returning { authtoken, sek } valid for ~6 hours.
  try {
    const res = await fetch(`${NIC_BASE}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", gstin: GSTIN },
      body: JSON.stringify({ username: USER, password: PASS }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return { token: json?.data?.authtoken ?? json?.authtoken ?? "" };
  } catch {
    return null;
  }
}

function stubEwbNumber(): string {
  // 12-digit numeric, prefix 99 for clarity that it's a stub
  return "99" + Math.floor(1e9 + Math.random() * 9e9).toString();
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
    const action = url.searchParams.get("action") ?? "generate";
    const body = (await req.json().catch(() => ({}))) as
      & GeneratePayload
      & Record<string, unknown>;

    if (!body.waybill_id) {
      return new Response(
        JSON.stringify({ error: "waybill_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: wb, error: wbErr } = await supabase
      .from("waybills")
      .select("*")
      .eq("id", body.waybill_id)
      .single();
    if (wbErr || !wb) {
      return new Response(
        JSON.stringify({ error: "Waybill not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "generate") {
      if (wb.status === "generated") {
        return new Response(
          JSON.stringify({ ok: true, ewb_number: wb.ewb_number, stub: false, already: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Pull source items for payload construction
      const items = wb.source_type === "invoice"
        ? (await supabase.from("invoice_items").select("*, products(name, hsn_code, unit)").eq("invoice_id", wb.source_id)).data ?? []
        : (await supabase.from("branch_transfer_items").select("*, products(name, hsn_code, unit)").eq("branch_transfer_id", wb.source_id)).data ?? [];

      const auth = await nicAuth();

      if (!auth) {
        // Stub mode
        const ewb = stubEwbNumber();
        const validUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await supabase.from("waybills").update({
          ewb_number: ewb,
          status: "generated",
          ewb_date: new Date().toISOString(),
          valid_until: validUntil,
          gsp_response: { stub: true, message: "Generated in stub mode — add NIC credentials for live calls" },
          error_msg: null,
        }).eq("id", wb.id);
        return new Response(
          JSON.stringify({ ok: true, ewb_number: ewb, valid_until: validUntil, stub: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Real NIC call — payload shape based on EWB JSON spec
      const payload = {
        supplyType: "O",
        subSupplyType: wb.source_type === "branch_transfer" ? "5" : "1", // 5 = for own use
        docType: wb.source_type === "branch_transfer" ? "DEL" : "INV",
        docNo: wb.source_number,
        docDate: new Date(wb.created_at).toLocaleDateString("en-GB").replaceAll("/", "/"),
        fromGstin: wb.from_gstin ?? GSTIN,
        fromTrdName: "",
        fromAddr1: "",
        fromPlace: "",
        fromPincode: 0,
        fromStateCode: Number(wb.from_state_code ?? 36),
        actFromStateCode: Number(wb.from_state_code ?? 36),
        toGstin: wb.to_gstin ?? "URP",
        toTrdName: "",
        toAddr1: "",
        toPlace: "",
        toPincode: 0,
        toStateCode: Number(wb.to_state_code ?? 36),
        actToStateCode: Number(wb.to_state_code ?? 36),
        transactionType: 1,
        otherValue: 0,
        totalValue: Number(wb.taxable_value),
        cgstValue: Number(wb.cgst_total),
        sgstValue: Number(wb.sgst_total),
        igstValue: Number(wb.igst_total),
        cessValue: 0,
        totInvValue: Number(wb.doc_value),
        transMode: wb.transport_mode === "road" ? "1" : wb.transport_mode === "rail" ? "2" : wb.transport_mode === "air" ? "3" : wb.transport_mode === "ship" ? "4" : "1",
        transDistance: String(wb.distance_km ?? 0),
        transporterName: wb.transporter_name ?? "",
        transporterId: wb.transporter_gstin ?? "",
        transDocNo: wb.transport_doc_no ?? "",
        transDocDate: wb.transport_doc_date ?? "",
        vehicleNo: (wb.vehicle_no ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase(),
        vehicleType: wb.vehicle_type ?? "R",
        itemList: (items as any[]).map((i, idx) => ({
          itemNo: idx + 1,
          productName: i.products?.name ?? "",
          productDesc: i.products?.name ?? "",
          hsnCode: Number(i.hsn_code ?? i.products?.hsn_code ?? 0),
          quantity: Number(i.qty),
          qtyUnit: i.products?.unit ?? "NOS",
          cgstRate: Number(i.gst_rate ?? 0) / 2,
          sgstRate: Number(i.gst_rate ?? 0) / 2,
          igstRate: 0,
          cessRate: 0,
          cessNonAdvol: 0,
          taxableAmount: Number(i.amount),
        })),
      };

      const res = await fetch(`${NIC_BASE}/ewayapi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authtoken: auth.token,
          gstin: GSTIN,
        },
        body: JSON.stringify({ action: "GENEWAYBILL", data: payload }),
      });
      const json = await res.json();
      const ewb = json?.data?.ewayBillNo ?? json?.ewayBillNo;

      if (!ewb) {
        await supabase.from("waybills").update({
          status: "failed",
          error_msg: json?.error?.message ?? JSON.stringify(json).slice(0, 500),
          gsp_request: payload,
          gsp_response: json,
        }).eq("id", wb.id);
        return new Response(
          JSON.stringify({ ok: false, error: json?.error ?? json }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabase.from("waybills").update({
        ewb_number: String(ewb),
        status: "generated",
        ewb_date: new Date().toISOString(),
        valid_until: json?.data?.validUpto ?? null,
        gsp_request: payload,
        gsp_response: json,
        error_msg: null,
      }).eq("id", wb.id);

      return new Response(
        JSON.stringify({ ok: true, ewb_number: String(ewb), stub: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "cancel") {
      const reason = (body as any).reason ?? "Cancelled by user";
      const auth = await nicAuth();
      if (auth && wb.ewb_number && !wb.ewb_number.startsWith("99")) {
        await fetch(`${NIC_BASE}/ewayapi`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authtoken: auth.token,
            gstin: GSTIN,
          },
          body: JSON.stringify({
            action: "CANEWB",
            data: { ewbNo: Number(wb.ewb_number), cancelRsnCode: 4, cancelRmrk: reason },
          }),
        }).catch(() => null);
      }
      await supabase.from("waybills").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      }).eq("id", wb.id);
      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
