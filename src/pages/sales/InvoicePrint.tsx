import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download, FileText } from "lucide-react";
import { toast } from "sonner";

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Lakh", "Crore"];
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
  if (lastThree > 0 && remainder > 0) result = " " + result;
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

// --- Template renderers ---

function StandardTemplate({ inv, dealer, items, company, branch, isIntra, placeOfSupply }: any) {
  // HSN-wise tax summary
  const hsnMap = new Map<string, { taxable: number; cgst: number; sgst: number; igst: number; rate: number }>();
  items.forEach((it: any) => {
    const hsn = it.hsn_code || it.products?.hsn_code || "—";
    const r = hsnMap.get(hsn) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: Number(it.gst_rate) };
    r.taxable += Number(it.amount);
    r.cgst += Number(it.cgst_amount || 0);
    r.sgst += Number(it.sgst_amount || 0);
    r.igst += Number(it.igst_amount || 0);
    hsnMap.set(hsn, r);
  });
  const totalQty = items.reduce((s: number, it: any) => s + Number(it.qty), 0);
  const unitLabel = items[0]?.products?.unit || "Nos";
  const subtotal = Number(inv.subtotal);
  const cgst = Number(inv.cgst_total || 0);
  const sgst = Number(inv.sgst_total || 0);
  const igst = Number(inv.igst_total || 0);
  const roundOff = Number(inv.round_off || 0);
  const totalTax = isIntra ? cgst + sgst : igst;

  const taxInWords = (() => {
    const intPart = Math.floor(totalTax);
    const paise = Math.round((totalTax - intPart) * 100);
    let s = "INR " + numberToWords(intPart).replace(" Rupees", "").replace(" Only", "");
    if (paise > 0) s += " and " + numberToWords(paise / 100).replace(/.*and /, "").replace(" Only", "");
    return s + " Only";
  })();

  return (
    <div className="max-w-[210mm] mx-auto p-4 print:p-2 print:pt-0 mt-16 print:mt-0 text-[11px] leading-tight">
      <div className="border-2 border-foreground">
        <h2 className="text-center text-sm font-bold py-1 border-b-2 border-foreground">TAX INVOICE</h2>

        {/* Seller + Invoice metadata */}
        <div className="grid grid-cols-2 border-b-2 border-foreground">
          <div className="p-2 border-r-2 border-foreground flex gap-2">
            {company?.logo_url && <img src={company.logo_url} alt="" className="h-14 w-14 object-contain shrink-0" crossOrigin="anonymous" />}
            <div className="flex-1">
              <p className="font-bold text-[13px]">{company?.company_name || "Raizechem Pvt. Ltd"}</p>
              <p>{company?.address_line1}{company?.address_line2 ? `, ${company.address_line2}` : ""}</p>
              <p>{company?.city}{company?.state ? `, ${company.state}` : ""} {company?.pincode || ""}</p>
              <p>GSTIN/UIN: <span className="font-semibold">{company?.gst_number || "—"}</span></p>
              <p>State Name : {company?.state || "—"}, Code : {(company as any)?.state_code || "36"}</p>
              {company?.phone && <p>Contact : {company.phone}</p>}
              {company?.email && <p>E-Mail : {company.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 text-[10px]">
            <div className="p-1.5 border-r border-b border-foreground"><div className="text-foreground/60">Invoice No.</div><div className="font-bold">{inv.invoice_number}</div></div>
            <div className="p-1.5 border-b border-foreground"><div className="text-foreground/60">Dated</div><div className="font-bold">{inv.invoice_date}</div></div>
            <div className="p-1.5 border-r border-b border-foreground"><div className="text-foreground/60">Delivery Note</div><div>{inv.delivery_note || ""}</div></div>
            <div className="p-1.5 border-b border-foreground"><div className="text-foreground/60">Mode/Terms of Payment</div><div>{inv.payment_terms || ""}</div></div>
            <div className="p-1.5 border-r border-b border-foreground"><div className="text-foreground/60">Reference No. &amp; Date</div><div>{inv.reference_no || ""}</div></div>
            <div className="p-1.5 border-b border-foreground"><div className="text-foreground/60">Other References</div><div>{inv.other_reference || ""}</div></div>
            <div className="p-1.5 border-r border-b border-foreground"><div className="text-foreground/60">Buyer's Order No.</div><div>{inv.buyer_order_no || ""}</div></div>
            <div className="p-1.5 border-b border-foreground"><div className="text-foreground/60">Dated</div><div>{inv.buyer_order_date || ""}</div></div>
            <div className="p-1.5 border-r border-b border-foreground"><div className="text-foreground/60">Dispatched through</div><div className="font-bold">{inv.transport_mode || ""}</div></div>
            <div className="p-1.5 border-b border-foreground"><div className="text-foreground/60">Destination</div><div className="font-bold">{inv.delivery_to || dealer?.city || ""}</div></div>
            <div className="p-1.5 border-r border-foreground col-span-1"><div className="text-foreground/60">e-Way Bill No.</div><div className="font-bold">{inv.eway_bill_no || ""}</div></div>
            <div className="p-1.5"><div className="text-foreground/60">Vehicle No.</div><div className="font-bold">{inv.vehicle_no || ""}</div></div>
          </div>
        </div>

        {/* Consignee + Buyer */}
        <div className="grid grid-cols-2 border-b-2 border-foreground">
          <div className="p-2 border-r-2 border-foreground">
            <p className="text-foreground/60 text-[10px]">Consignee (Ship to)</p>
            <p className="font-bold uppercase">{dealer?.name}</p>
            <p>{dealer?.shipping_address_line1 || dealer?.address_line1}{(dealer?.shipping_address_line2 || dealer?.address_line2) ? `, ${dealer.shipping_address_line2 || dealer.address_line2}` : ""}</p>
            <p>{dealer?.shipping_city || dealer?.city}, {dealer?.shipping_state || dealer?.state} {dealer?.shipping_pincode || dealer?.pincode || ""}</p>
            <p>GSTIN/UIN : {dealer?.gst_number || "Unregistered"}</p>
            <p>State Name : {dealer?.shipping_state || dealer?.state}, Code : {dealer?.state_code || "—"}</p>
          </div>
          <div className="p-2">
            <p className="text-foreground/60 text-[10px]">Buyer (Bill to)</p>
            <p className="font-bold uppercase">{dealer?.name}</p>
            <p>{dealer?.address_line1}{dealer?.address_line2 ? `, ${dealer.address_line2}` : ""}</p>
            <p>{dealer?.city}, {dealer?.state} {dealer?.pincode || ""}</p>
            <p>GSTIN/UIN : {dealer?.gst_number || "Unregistered"}</p>
            <p>State Name : {dealer?.state}, Code : {dealer?.state_code || "—"}</p>
            <p>Place of Supply : {placeOfSupply}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="border-r border-foreground p-1 w-8">Sl No.</th>
              <th className="border-r border-foreground p-1 text-left">Description of Goods</th>
              <th className="border-r border-foreground p-1 w-16">HSN/SAC</th>
              <th className="border-r border-foreground p-1 w-20">Quantity</th>
              <th className="border-r border-foreground p-1 w-16 text-right">Rate</th>
              <th className="border-r border-foreground p-1 w-10">per</th>
              <th className="p-1 w-24 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, idx: number) => {
              const desc = it.products?.brand
                ? `${it.products.brand} — ${it.products.name}`
                : it.products?.name;
              const batch = it.product_batches?.batch_no || it.batch_no;
              return (
                <tr key={it.id} className="align-top">
                  <td className="border-r border-foreground p-1 text-center">{idx + 1}</td>
                  <td className="border-r border-foreground p-1">
                    <div className="font-bold uppercase">{desc}</div>
                    {batch && <div className="italic text-[10px]">Batch : {batch}</div>}
                    {it.mfg_date && <div className="italic text-[10px]">Mfg Dt. : {it.mfg_date}</div>}
                    {it.expiry_date && <div className="italic text-[10px]">Expiry : {it.expiry_date}</div>}
                  </td>
                  <td className="border-r border-foreground p-1 text-center">{it.hsn_code || it.products?.hsn_code || "—"}</td>
                  <td className="border-r border-foreground p-1 text-right font-bold">{it.qty} {it.products?.unit || "Nos"}</td>
                  <td className="border-r border-foreground p-1 text-right">{Number(it.rate).toFixed(2)}</td>
                  <td className="border-r border-foreground p-1 text-center">{it.products?.unit || "Nos"}</td>
                  <td className="p-1 text-right font-bold">{Number(it.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
            {/* Spacer */}
            <tr><td colSpan={7} className="p-1">&nbsp;</td></tr>
            {/* Subtotal */}
            <tr>
              <td className="border-r border-foreground p-1"></td>
              <td className="border-r border-foreground p-1 text-right italic" colSpan={5}></td>
              <td className="p-1 text-right">{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            {isIntra ? (
              <>
                <tr><td className="border-r border-foreground p-1"></td><td className="border-r border-foreground p-1 text-right" colSpan={5}>CGST</td><td className="p-1 text-right">{cgst.toFixed(2)}</td></tr>
                <tr><td className="border-r border-foreground p-1"></td><td className="border-r border-foreground p-1 text-right" colSpan={5}>SGST</td><td className="p-1 text-right">{sgst.toFixed(2)}</td></tr>
              </>
            ) : (
              <tr><td className="border-r border-foreground p-1"></td><td className="border-r border-foreground p-1 text-right" colSpan={5}>IGST</td><td className="p-1 text-right">{igst.toFixed(2)}</td></tr>
            )}
            {roundOff !== 0 && (
              <tr><td className="border-r border-foreground p-1"></td><td className="border-r border-foreground p-1 text-right" colSpan={5}>Round Off</td><td className="p-1 text-right">{roundOff > 0 ? "" : "(-)"}{Math.abs(roundOff).toFixed(2)}</td></tr>
            )}
            <tr className="border-t-2 border-foreground font-bold">
              <td className="border-r border-foreground p-1"></td>
              <td className="border-r border-foreground p-1">Total</td>
              <td className="border-r border-foreground p-1"></td>
              <td className="border-r border-foreground p-1 text-right">{totalQty} {unitLabel}</td>
              <td className="border-r border-foreground p-1"></td>
              <td className="border-r border-foreground p-1"></td>
              <td className="p-1 text-right">₹ {Number(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div className="border-t-2 border-foreground p-2">
          <p className="text-[10px] text-foreground/60">Amount Chargeable (in words)</p>
          <p className="font-bold">INR {numberToWords(Number(inv.total_amount)).replace(" Rupees", "").replace(" Only", "")} Only</p>
          <p className="text-right italic text-[10px]">E. &amp; O.E</p>
        </div>

        {/* HSN-wise tax summary */}
        <table className="w-full border-collapse text-[10.5px] border-t-2 border-foreground">
          <thead>
            <tr className="border-b border-foreground">
              <th rowSpan={2} className="border-r border-foreground p-1">HSN/SAC</th>
              <th rowSpan={2} className="border-r border-foreground p-1">Taxable Value</th>
              {isIntra ? (
                <>
                  <th colSpan={2} className="border-r border-foreground p-1">CGST</th>
                  <th colSpan={2} className="border-r border-foreground p-1">SGST/UTGST</th>
                </>
              ) : (
                <th colSpan={2} className="border-r border-foreground p-1">IGST</th>
              )}
              <th rowSpan={2} className="p-1">Total Tax Amount</th>
            </tr>
            <tr className="border-b border-foreground">
              <th className="border-r border-foreground p-1">Rate</th>
              <th className="border-r border-foreground p-1">Amount</th>
              {isIntra && <><th className="border-r border-foreground p-1">Rate</th><th className="border-r border-foreground p-1">Amount</th></>}
            </tr>
          </thead>
          <tbody>
            {Array.from(hsnMap.entries()).map(([hsn, r]) => (
              <tr key={hsn}>
                <td className="border-r border-foreground p-1 text-center">{hsn}</td>
                <td className="border-r border-foreground p-1 text-right">{r.taxable.toFixed(2)}</td>
                {isIntra ? (
                  <>
                    <td className="border-r border-foreground p-1 text-center">{(r.rate / 2).toFixed(1)}%</td>
                    <td className="border-r border-foreground p-1 text-right">{r.cgst.toFixed(2)}</td>
                    <td className="border-r border-foreground p-1 text-center">{(r.rate / 2).toFixed(1)}%</td>
                    <td className="border-r border-foreground p-1 text-right">{r.sgst.toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td className="border-r border-foreground p-1 text-center">{r.rate}%</td>
                    <td className="border-r border-foreground p-1 text-right">{r.igst.toFixed(2)}</td>
                  </>
                )}
                <td className="p-1 text-right">{(r.cgst + r.sgst + r.igst).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-foreground">
              <td className="border-r border-foreground p-1 text-right">Total</td>
              <td className="border-r border-foreground p-1 text-right">{subtotal.toFixed(2)}</td>
              {isIntra ? (
                <>
                  <td className="border-r border-foreground p-1"></td>
                  <td className="border-r border-foreground p-1 text-right">{cgst.toFixed(2)}</td>
                  <td className="border-r border-foreground p-1"></td>
                  <td className="border-r border-foreground p-1 text-right">{sgst.toFixed(2)}</td>
                </>
              ) : (
                <>
                  <td className="border-r border-foreground p-1"></td>
                  <td className="border-r border-foreground p-1 text-right">{igst.toFixed(2)}</td>
                </>
              )}
              <td className="p-1 text-right">{totalTax.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Tax amount in words + PAN */}
        <div className="border-t-2 border-foreground p-2">
          <p>Tax Amount (in words) : <span className="font-bold">{taxInWords}</span></p>
          {company?.pan_number && <p className="mt-1">Company's PAN : <span className="font-bold">{company.pan_number}</span></p>}
        </div>

        {/* Declaration + Bank */}
        <div className="grid grid-cols-2 border-t-2 border-foreground">
          <div className="p-2 border-r-2 border-foreground">
            <p className="text-[10px] text-foreground/60">Declaration</p>
            <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
          </div>
          <div className="p-2">
            <p className="text-[10px] text-foreground/60">Company's Bank Details</p>
            {company?.bank_name && <p>Bank Name : <span className="font-bold">{company.bank_name}</span></p>}
            {company?.bank_account && <p>A/c No. : <span className="font-bold">{company.bank_account}</span></p>}
            {company?.bank_ifsc && <p>Branch &amp; IFS Code : <span className="font-bold">{company.bank_ifsc}</span></p>}
          </div>
        </div>

        {/* Signature */}
        <div className="border-t-2 border-foreground p-2 flex justify-end">
          <div className="text-right">
            <p className="font-bold">for {company?.company_name || "Raizechem Pvt. Ltd"}</p>
            <div className="h-12" />
            <p className="border-t border-foreground pt-1">Authorised Signatory</p>
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] mt-1">This is a Computer Generated Invoice</p>
    </div>
  );
}


function RetailTemplate({ inv, dealer, items, company, isIntra, placeOfSupply }: any) {
  return (
    <div className="max-w-[80mm] mx-auto p-4 print:p-2 mt-16 print:mt-0 text-xs font-mono">
      <div className="text-center mb-3">
        <p className="font-bold text-sm">{company?.company_name || "Raizechem Pvt Ltd"}</p>
        <p>{company?.address_line1}, {company?.city}</p>
        <p>GSTIN: {company?.gst_number || "—"}</p>
        <p>Ph: {company?.phone || "—"}</p>
      </div>
      <div className="border-t border-dashed border-foreground/40 my-2" />
      <p className="font-bold">RETAIL INVOICE</p>
      <p>No: {inv.invoice_number} | Date: {inv.invoice_date}</p>
      <p>Customer: {dealer?.name}</p>
      {dealer?.gst_number && <p>GSTIN: {dealer.gst_number}</p>}
      <div className="border-t border-dashed border-foreground/40 my-2" />
      <table className="w-full">
        <thead><tr><th className="text-left">Item</th><th className="text-right">Qty</th><th className="text-right">Amt</th></tr></thead>
        <tbody>
          {items.map((it: any) => (
            <tr key={it.id}>
              <td>{it.products?.brand ? `${it.products.brand} — ${it.products.name}` : it.products?.name}</td>
              <td className="text-right">{it.qty}</td>
              <td className="text-right">₹{Number(it.total_amount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-foreground/40 my-2" />
      <div className="flex justify-between"><span>Subtotal:</span><span>₹{Number(inv.subtotal).toFixed(2)}</span></div>
      {isIntra ? (
        <>
          <div className="flex justify-between"><span>CGST:</span><span>₹{Number(inv.cgst_total).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>SGST:</span><span>₹{Number(inv.sgst_total).toFixed(2)}</span></div>
        </>
      ) : (
        <div className="flex justify-between"><span>IGST:</span><span>₹{Number(inv.igst_total).toFixed(2)}</span></div>
      )}
      {Number(inv.round_off || 0) !== 0 && (
        <div className="flex justify-between text-[10px]"><span>Round Off:</span><span>{Number(inv.round_off) > 0 ? "+" : ""}₹{Number(inv.round_off).toFixed(2)}</span></div>
      )}
      <div className="border-t border-dashed border-foreground/40 my-1" />
      <div className="flex justify-between font-bold text-sm"><span>TOTAL:</span><span>₹{Number(inv.total_amount).toFixed(2)}</span></div>
      <div className="text-center mt-4 text-[10px]">Thank you for your business!</div>
    </div>
  );
}

function ExportTemplate({ inv, dealer, items, company, isIntra, placeOfSupply }: any) {
  return (
    <div className="max-w-[210mm] mx-auto p-8 print:p-6 print:pt-0 mt-16 print:mt-0 text-sm">
      <div className="border-2 border-foreground/50 p-6">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold uppercase tracking-wide">Commercial Invoice</h2>
          <p className="text-xs text-muted-foreground">For Export / Supply to SEZ</p>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div className="space-y-1">
            <p className="font-bold text-xs uppercase text-muted-foreground">Exporter</p>
            <p className="font-bold">{company?.company_name}</p>
            {company?.legal_name && <p className="text-xs">{company.legal_name}</p>}
            <p className="text-xs">{company?.address_line1}, {company?.city}, {company?.state} - {company?.pincode}</p>
            <p className="text-xs">GSTIN: {company?.gst_number} | PAN: {company?.pan_number || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-xs uppercase text-muted-foreground">Consignee / Buyer</p>
            <p className="font-bold">{dealer?.name}</p>
            <p className="text-xs">{dealer?.address_line1}, {dealer?.city}, {dealer?.state} - {dealer?.pincode}</p>
            <p className="text-xs">GSTIN: {dealer?.gst_number || "N/A"}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4 text-xs border-y border-foreground/30 py-2">
          <div><strong>Invoice No:</strong> {inv.invoice_number}</div>
          <div><strong>Date:</strong> {inv.invoice_date}</div>
          <div><strong>Place of Supply:</strong> {placeOfSupply}</div>
        </div>
        <ItemsTable items={items} isIntra={isIntra} />
        <TotalBlock inv={inv} isIntra={isIntra} />
        <p className="text-xs mb-4"><strong>Amount in words:</strong> {numberToWords(Number(inv.total_amount))}</p>
        {company?.bank_name && (
          <div className="text-xs border border-foreground/30 p-3 mb-4">
            <p className="font-bold mb-1">Bank Details for Remittance:</p>
            <p>Bank: {company.bank_name} | A/C: {company.bank_account} | IFSC: {company.bank_ifsc}</p>
          </div>
        )}
        <div className="mt-8 text-xs">
          <p>Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
        </div>
        <SignatureBlock companyName={company?.company_name} />
      </div>
    </div>
  );
}

// Shared sub-components
function ItemsTable({ items, isIntra }: { items: any[]; isIntra: boolean }) {
  return (
    <table className="w-full border-collapse border border-foreground/30 text-xs mb-2">
      <thead>
        <tr className="bg-muted/50">
          <th className="border border-foreground/30 p-1.5 text-left">#</th>
          <th className="border border-foreground/30 p-1.5 text-left">Item</th>
          <th className="border border-foreground/30 p-1.5">HSN</th>
          <th className="border border-foreground/30 p-1.5 text-right">Qty</th>
          <th className="border border-foreground/30 p-1.5">Unit</th>
          <th className="border border-foreground/30 p-1.5 text-right">Rate</th>
          <th className="border border-foreground/30 p-1.5 text-right">Amount</th>
          <th className="border border-foreground/30 p-1.5 text-right">GST%</th>
          {isIntra ? (
            <>
              <th className="border border-foreground/30 p-1.5 text-right">CGST</th>
              <th className="border border-foreground/30 p-1.5 text-right">SGST</th>
            </>
          ) : (
            <th className="border border-foreground/30 p-1.5 text-right">IGST</th>
          )}
          <th className="border border-foreground/30 p-1.5 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it: any, idx: number) => (
          <tr key={it.id}>
            <td className="border border-foreground/30 p-1.5">{idx + 1}</td>
            <td className="border border-foreground/30 p-1.5">{it.products?.brand ? <><span className="font-semibold">{it.products.brand}</span><div className="text-[10px] text-foreground/70">{it.products.name}</div></> : it.products?.name}</td>
            <td className="border border-foreground/30 p-1.5 text-center">{it.hsn_code || it.products?.hsn_code || "—"}</td>
            <td className="border border-foreground/30 p-1.5 text-right">{it.qty}</td>
            <td className="border border-foreground/30 p-1.5 text-center">{it.products?.unit}</td>
            <td className="border border-foreground/30 p-1.5 text-right">₹{Number(it.rate).toFixed(2)}</td>
            <td className="border border-foreground/30 p-1.5 text-right">₹{Number(it.amount).toFixed(2)}</td>
            <td className="border border-foreground/30 p-1.5 text-right">{it.gst_rate}%</td>
            {isIntra ? (
              <>
                <td className="border border-foreground/30 p-1.5 text-right">₹{Number(it.cgst_amount).toFixed(2)}</td>
                <td className="border border-foreground/30 p-1.5 text-right">₹{Number(it.sgst_amount).toFixed(2)}</td>
              </>
            ) : (
              <td className="border border-foreground/30 p-1.5 text-right">₹{Number(it.igst_amount).toFixed(2)}</td>
            )}
            <td className="border border-foreground/30 p-1.5 text-right font-medium">₹{Number(it.total_amount).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalBlock({ inv, isIntra }: { inv: any; isIntra: boolean }) {
  const roundOff = Number(inv.round_off || 0);
  return (
    <div className="flex justify-end mb-4">
      <div className="w-64 text-xs space-y-1">
        <div className="flex justify-between"><span>Subtotal:</span><span>₹{Number(inv.subtotal).toFixed(2)}</span></div>
        {isIntra ? (
          <>
            <div className="flex justify-between"><span>CGST:</span><span>₹{Number(inv.cgst_total).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>SGST:</span><span>₹{Number(inv.sgst_total).toFixed(2)}</span></div>
          </>
        ) : (
          <div className="flex justify-between"><span>IGST:</span><span>₹{Number(inv.igst_total).toFixed(2)}</span></div>
        )}
        {roundOff !== 0 && (
          <div className="flex justify-between text-muted-foreground"><span>Round Off:</span><span>{roundOff > 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between font-bold text-sm border-t pt-1"><span>Grand Total:</span><span>₹{Number(inv.total_amount).toFixed(2)}</span></div>
      </div>
    </div>
  );
}

function SignatureBlock({ companyName }: { companyName?: string }) {
  return (
    <div className="grid grid-cols-2 mt-12 text-xs">
      <div><p className="border-t border-foreground/30 pt-1 w-40">Receiver's Signature</p></div>
      <div className="text-right"><p className="border-t border-foreground/30 pt-1 w-48 ml-auto">For {companyName || "Raizechem Pvt Ltd"}<br />Authorised Signatory</p></div>
    </div>
  );
}

// --- Main component ---

export default function InvoicePrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice-print", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("*, dealers(name, gst_number, address_line1, address_line2, city, state, pincode, state_code, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode)")
        .eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["invoice-items-print", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoice_items")
        .select("*, products(name, brand, unit, hsn_code), product_batches(batch_no)")
        .eq("invoice_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: company } = useQuery({
    queryKey: ["company-settings-print"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).single();
      return data;
    },
  });

  const { data: branch } = useQuery({
    queryKey: ["invoice-branch-print", (invoice as any)?.branch_id],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").eq("id", (invoice as any).branch_id).maybeSingle();
      return data;
    },
    enabled: !!(invoice as any)?.branch_id,
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

  const inv = invoice as any;
  const dealer = inv.dealers;
  const isIntra = dealer?.state_code === ((branch as any)?.state_code || (company as any)?.state_code || "36");
  const placeOfSupply = inv.place_of_supply || dealer?.state || "Telangana";
  const template = (company as any)?.invoice_template || "standard";

  const exportEwayBill = () => {
    const data = {
      invoice_number: inv.invoice_number, invoice_date: inv.invoice_date,
      seller_gstin: company?.gst_number, buyer_gstin: dealer?.gst_number,
      place_of_supply: placeOfSupply, transport_mode: inv.transport_mode,
      vehicle_no: inv.vehicle_no, dispatch_from: inv.dispatch_from || `${company?.city}, ${company?.state}`,
      delivery_to: inv.delivery_to || `${dealer?.shipping_city || dealer?.city}, ${dealer?.shipping_state || dealer?.state}`,
      total_value: inv.total_amount,
      items: items.map((it: any) => ({
        hsn_code: it.hsn_code || it.products?.hsn_code, product: it.products?.brand ? `${it.products.brand} — ${it.products.name}` : it.products?.name,
        qty: it.qty, unit: it.products?.unit, rate: it.rate, taxable_value: it.amount,
        cgst: it.cgst_amount, sgst: it.sgst_amount, igst: it.igst_amount,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `eway-bill-${inv.invoice_number}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    try {
      toast.info("Generating PDF...");
      const { data, error } = await supabase.functions.invoke("generate-pdf", {
        body: { type: "invoice", id },
      });
      if (error) throw error;
      // data is HTML string, open in new window for print-to-PDF
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(typeof data === "string" ? data : JSON.stringify(data));
        w.document.close();
        setTimeout(() => w.print(), 500);
      }
      toast.success("PDF ready — use Print > Save as PDF");
    } catch (e: any) {
      toast.error("PDF generation failed: " + e.message);
    }
  };

  const templateProps = { inv, dealer, items, company, branch, isIntra, placeOfSupply };

  return (
    <div>
      <div className="print:hidden fixed top-0 left-0 right-0 bg-background border-b z-50 p-3 flex gap-2 items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
        <Button variant="outline" size="sm" onClick={downloadPDF}><FileText className="h-4 w-4 mr-1" />PDF</Button>
        <Button variant="outline" size="sm" onClick={exportEwayBill}><Download className="h-4 w-4 mr-1" />E-Way Bill JSON</Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/sales/invoices/${id}/eway-bill`)}><FileText className="h-4 w-4 mr-1" />E-Way Bill</Button>
        <span className="ml-auto text-xs text-muted-foreground">Template: {template}</span>
      </div>
      {template === "retail" ? <RetailTemplate {...templateProps} /> :
       template === "export" ? <ExportTemplate {...templateProps} /> :
       <StandardTemplate {...templateProps} />}
    </div>
  );
}
