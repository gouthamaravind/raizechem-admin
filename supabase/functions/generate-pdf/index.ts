import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const scales = ["","Thousand","Lakh","Crore"];
  const intPart = Math.floor(num);
  const paise = Math.round((num - intPart) * 100);
  function convertGroup(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + " " + ones[n % 10] + " ";
    return ones[Math.floor(n / 100)] + " Hundred " + convertGroup(n % 100);
  }
  let result = "";
  let remainder = intPart;
  const lastThree = remainder % 1000;
  remainder = Math.floor(remainder / 1000);
  result = convertGroup(lastThree);
  let scaleIdx = 1;
  while (remainder > 0) {
    const group = remainder % 100;
    remainder = Math.floor(remainder / 100);
    if (group > 0) result = convertGroup(group) + (scales[scaleIdx] || "") + " " + result;
    scaleIdx++;
  }
  result = result.trim() + " Rupees";
  if (paise > 0) result += " and " + convertGroup(paise).trim() + " Paise";
  return result + " Only";
}

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function generateInvoiceHTML(inv: any, items: any[], company: any, dealer: any) {
  const isIntra = dealer?.state_code === "36";
  const itemRows = items.map((it: any, idx: number) => `
    <tr>
      <td>${idx + 1}</td><td>${esc(it.products?.name)}</td><td>${esc(it.hsn_code || it.products?.hsn_code || "—")}</td>
      <td style="text-align:right">${it.qty}</td><td>${esc(it.products?.unit)}</td>
      <td style="text-align:right">${fmt(Number(it.rate))}</td><td style="text-align:right">${fmt(Number(it.amount))}</td>
      <td style="text-align:right">${it.gst_rate}%</td>
      ${isIntra ? `<td style="text-align:right">${fmt(Number(it.cgst_amount))}</td><td style="text-align:right">${fmt(Number(it.sgst_amount))}</td>` : `<td style="text-align:right">${fmt(Number(it.igst_amount))}</td>`}
      <td style="text-align:right">${fmt(Number(it.total_amount))}</td>
    </tr>`).join("");

  const taxHeaders = isIntra ? "<th>CGST</th><th>SGST</th>" : "<th>IGST</th>";
  const taxTotals = isIntra
    ? `<div>CGST: ${fmt(Number(inv.cgst_total))}</div><div>SGST: ${fmt(Number(inv.sgst_total))}</div>`
    : `<div>IGST: ${fmt(Number(inv.igst_total))}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#333}
    h2{text-align:center;margin:0 0 10px}
    table{width:100%;border-collapse:collapse;margin:8px 0}
    th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
    th{background:#f5f5f5;font-weight:600}
    .header{display:flex;justify-content:space-between;border:1px solid #ccc;margin-bottom:8px}
    .header>div{padding:8px;flex:1}
    .header>div:first-child{border-right:1px solid #ccc}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #ccc;margin-bottom:8px}
    .meta>div{padding:6px;border-right:1px solid #ccc}
    .meta>div:last-child{border-right:none}
    .totals{text-align:right;margin:10px 0}
    .totals>div{margin:2px 0}
    .grand-total{font-size:14px;font-weight:bold;border-top:2px solid #333;padding-top:4px}
    .bank{border:1px solid #ccc;padding:8px;margin:10px 0;font-size:10px}
    .signatures{display:flex;justify-content:space-between;margin-top:60px}
    .signatures>div{border-top:1px solid #333;padding-top:4px;width:150px;text-align:center;font-size:10px}
  </style></head><body>
    <h2>TAX INVOICE</h2>
    <div class="header">
      <div>
        <strong style="font-size:13px">${esc(company?.company_name || "Company")}</strong><br>
        ${company?.legal_name ? `<span style="font-size:10px;color:#666">${esc(company.legal_name)}</span><br>` : ""}
        ${esc(company?.address_line1 || "")}${company?.address_line2 ? `, ${esc(company.address_line2)}` : ""}<br>
        ${esc(company?.city || "")}, ${esc(company?.state || "")} - ${esc(company?.pincode || "")}<br>
        <strong>GSTIN:</strong> ${esc(company?.gst_number || "—")}
      </div>
      <div>
        <strong>Bill To: ${esc(dealer?.name)}</strong><br>
        ${esc(dealer?.address_line1 || "")}${dealer?.address_line2 ? `, ${esc(dealer.address_line2)}` : ""}<br>
        ${esc(dealer?.city || "")}, ${esc(dealer?.state || "")} - ${esc(dealer?.pincode || "")}<br>
        <strong>GSTIN:</strong> ${esc(dealer?.gst_number || "Unregistered")}
      </div>
    </div>
    <div class="meta">
      <div><strong>Invoice #:</strong> ${esc(inv.invoice_number)}</div>
      <div><strong>Date:</strong> ${inv.invoice_date}</div>
      <div><strong>Due:</strong> ${inv.due_date || "—"}</div>
      <div><strong>Place of Supply:</strong> ${esc(inv.place_of_supply || dealer?.state || "")}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th>GST%</th>${taxHeaders}<th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals">
      <div>Subtotal: ${fmt(Number(inv.subtotal))}</div>
      ${taxTotals}
      <div class="grand-total">Grand Total: ${fmt(Number(inv.total_amount))}</div>
    </div>
    <div><strong>Amount in words:</strong> ${numberToWords(Number(inv.total_amount))}</div>
    ${company?.bank_name ? `<div class="bank"><strong>Bank Details:</strong> ${esc(company.bank_name)} | A/C: ${esc(company.bank_account)} | IFSC: ${esc(company.bank_ifsc)}</div>` : ""}
    <div class="signatures">
      <div>Receiver's Signature</div>
      <div>For ${esc(company?.company_name || "Company")}<br>Authorised Signatory</div>
    </div>
  </body></html>`;
}

function generateCreditNoteHTML(cn: any, items: any[], company: any, dealer: any) {
  const isIntra = dealer?.state_code === "36";
  const itemRows = items.map((it: any, idx: number) => `
    <tr>
      <td>${idx + 1}</td><td>${esc(it.products?.name)}</td><td>${esc(it.hsn_code || "—")}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${fmt(Number(it.rate))}</td><td style="text-align:right">${fmt(Number(it.amount))}</td>
      ${isIntra ? `<td style="text-align:right">${fmt(Number(it.cgst_amount))}</td><td style="text-align:right">${fmt(Number(it.sgst_amount))}</td>` : `<td style="text-align:right">${fmt(Number(it.igst_amount))}</td>`}
      <td style="text-align:right">${fmt(Number(it.total_amount))}</td>
    </tr>`).join("");

  const taxHeaders = isIntra ? "<th>CGST</th><th>SGST</th>" : "<th>IGST</th>";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#333}
    h2{text-align:center;margin:0 0 10px;color:#dc2626}
    table{width:100%;border-collapse:collapse;margin:8px 0}
    th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
    th{background:#fef2f2;font-weight:600}
    .header{display:flex;justify-content:space-between;border:1px solid #ccc;margin-bottom:8px}
    .header>div{padding:8px;flex:1}
    .header>div:first-child{border-right:1px solid #ccc}
    .totals{text-align:right;margin:10px 0}
    .grand-total{font-size:14px;font-weight:bold;border-top:2px solid #dc2626;padding-top:4px;color:#dc2626}
  </style></head><body>
    <h2>CREDIT NOTE</h2>
    <div class="header">
      <div>
        <strong>${esc(company?.company_name || "Company")}</strong><br>
        GSTIN: ${esc(company?.gst_number || "—")}
      </div>
      <div>
        <strong>${esc(dealer?.name)}</strong><br>
        GSTIN: ${esc(dealer?.gst_number || "Unregistered")}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #ccc;margin-bottom:8px">
      <div style="padding:6px;border-right:1px solid #ccc"><strong>CN #:</strong> ${esc(cn.credit_note_number)}</div>
      <div style="padding:6px;border-right:1px solid #ccc"><strong>Date:</strong> ${cn.credit_date}</div>
      <div style="padding:6px"><strong>Against Invoice:</strong> ${esc(cn.invoices?.invoice_number || "—")}</div>
    </div>
    ${cn.reason ? `<div style="margin-bottom:8px"><strong>Reason:</strong> ${esc(cn.reason)}</div>` : ""}
    <table>
      <thead><tr><th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th>${taxHeaders}<th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals">
      <div>Subtotal: ${fmt(Number(cn.subtotal))}</div>
      ${isIntra ? `<div>CGST: ${fmt(Number(cn.cgst_total))}</div><div>SGST: ${fmt(Number(cn.sgst_total))}</div>` : `<div>IGST: ${fmt(Number(cn.igst_total))}</div>`}
      <div class="grand-total">Total Credit: ${fmt(Number(cn.total_amount))}</div>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { type, id } = await req.json();
    if (!type || !id) {
      return new Response(JSON.stringify({ error: "type and id required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch company settings
    const { data: company } = await supabase.from("company_settings").select("*").limit(1).single();

    let html = "";

    if (type === "invoice") {
      const { data: inv, error: invErr } = await supabase.from("invoices")
        .select("*, dealers(name, gst_number, address_line1, address_line2, city, state, pincode, state_code)")
        .eq("id", id).single();
      if (invErr) throw invErr;

      const { data: items } = await supabase.from("invoice_items")
        .select("*, products(name, unit, hsn_code)")
        .eq("invoice_id", id);

      html = generateInvoiceHTML(inv, items || [], company, inv.dealers);
    } else if (type === "credit_note") {
      const { data: cn, error: cnErr } = await supabase.from("credit_notes")
        .select("*, dealers(name, gst_number, state_code), invoices(invoice_number)")
        .eq("id", id).single();
      if (cnErr) throw cnErr;

      const { data: items } = await supabase.from("credit_note_items")
        .select("*, products(name, unit, hsn_code)")
        .eq("credit_note_id", id);

      html = generateCreditNoteHTML(cn, items || [], company, cn.dealers);
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use 'invoice' or 'credit_note'" }), { status: 400, headers: corsHeaders });
    }

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
