import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { COMPANY_STATE_CODE } from "@/lib/gst";

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

  // Indian numbering: last 3 digits, then groups of 2
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
    if (group > 0) {
      result = convertGroup(group) + (scales[scaleIdx] || "") + " " + result;
    }
    scaleIdx++;
  }

  result = result.trim() + " Rupees";
  if (paise > 0) result += " and " + convertGroup(paise).trim() + " Paise";
  return result + " Only";
}

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
        .select("*, products(name, unit, hsn_code), product_batches(batch_no)")
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

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found</div>;

  const inv = invoice as any;
  const dealer = inv.dealers;
  const isIntra = dealer?.state_code === COMPANY_STATE_CODE;
  const placeOfSupply = inv.place_of_supply || dealer?.state || "Telangana";

  const exportEwayBill = () => {
    const data = {
      invoice_number: inv.invoice_number, invoice_date: inv.invoice_date,
      seller_gstin: company?.gst_number, buyer_gstin: dealer?.gst_number,
      place_of_supply: placeOfSupply, transport_mode: inv.transport_mode,
      vehicle_no: inv.vehicle_no, dispatch_from: inv.dispatch_from || `${company?.city}, ${company?.state}`,
      delivery_to: inv.delivery_to || `${dealer?.shipping_city || dealer?.city}, ${dealer?.shipping_state || dealer?.state}`,
      total_value: inv.total_amount,
      items: items.map((it: any) => ({
        hsn_code: it.hsn_code || it.products?.hsn_code, product: it.products?.name,
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

  return (
    <div>
      {/* Action bar - hidden in print */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-background border-b z-50 p-3 flex gap-2 items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
        <Button variant="outline" size="sm" onClick={exportEwayBill}><Download className="h-4 w-4 mr-1" />E-Way Bill JSON</Button>
      </div>

      {/* Print content */}
      <div className="max-w-[210mm] mx-auto p-8 print:p-6 print:pt-0 mt-16 print:mt-0 text-sm">
        <h2 className="text-center text-lg font-bold mb-1">TAX INVOICE</h2>

        {/* Seller / Buyer */}
        <div className="grid grid-cols-2 border border-foreground/30 mb-2">
          <div className="p-3 border-r border-foreground/30">
            <p className="font-bold text-base">{company?.company_name || "Raizechem Pvt Ltd"}</p>
            {company?.legal_name && <p className="text-xs text-muted-foreground">{company.legal_name}</p>}
            <p>{company?.address_line1}{company?.address_line2 ? `, ${company.address_line2}` : ""}</p>
            <p>{company?.city}, {company?.state} - {company?.pincode}</p>
            <p><strong>GSTIN:</strong> {company?.gst_number || "—"}</p>
            <p><strong>State:</strong> {company?.state} (Code: {COMPANY_STATE_CODE})</p>
          </div>
          <div className="p-3">
            <p className="font-bold">Bill To: {dealer?.name}</p>
            <p>{dealer?.address_line1}{dealer?.address_line2 ? `, ${dealer.address_line2}` : ""}</p>
            <p>{dealer?.city}, {dealer?.state} - {dealer?.pincode}</p>
            <p><strong>GSTIN:</strong> {dealer?.gst_number || "Unregistered"}</p>
            <p><strong>State:</strong> {dealer?.state} (Code: {dealer?.state_code || "—"})</p>
          </div>
        </div>

        {/* Invoice details */}
        <div className="grid grid-cols-4 border border-foreground/30 mb-2 text-xs">
          <div className="p-2 border-r border-foreground/30"><strong>Invoice #:</strong> {inv.invoice_number}</div>
          <div className="p-2 border-r border-foreground/30"><strong>Date:</strong> {inv.invoice_date}</div>
          <div className="p-2 border-r border-foreground/30"><strong>Due:</strong> {inv.due_date || "—"}</div>
          <div className="p-2"><strong>Place of Supply:</strong> {placeOfSupply}</div>
        </div>

        {/* E-way bill fields if present */}
        {(inv.transport_mode || inv.vehicle_no) && (
          <div className="grid grid-cols-4 border border-foreground/30 mb-2 text-xs">
            <div className="p-2 border-r border-foreground/30"><strong>Transport:</strong> {inv.transport_mode || "—"}</div>
            <div className="p-2 border-r border-foreground/30"><strong>Vehicle:</strong> {inv.vehicle_no || "—"}</div>
            <div className="p-2 border-r border-foreground/30"><strong>From:</strong> {inv.dispatch_from || "—"}</div>
            <div className="p-2"><strong>To:</strong> {inv.delivery_to || "—"}</div>
          </div>
        )}

        {/* Items table */}
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
                <td className="border border-foreground/30 p-1.5">{it.products?.name}</td>
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

        {/* Totals */}
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
            <div className="flex justify-between font-bold text-sm border-t pt-1"><span>Grand Total:</span><span>₹{Number(inv.total_amount).toFixed(2)}</span></div>
          </div>
        </div>

        <p className="text-xs mb-4"><strong>Amount in words:</strong> {numberToWords(Number(inv.total_amount))}</p>

        {/* Bank details */}
        {company?.bank_name && (
          <div className="text-xs border border-foreground/30 p-3 mb-4">
            <p className="font-bold mb-1">Bank Details:</p>
            <p>Bank: {company.bank_name} | A/C: {company.bank_account} | IFSC: {company.bank_ifsc}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 mt-12 text-xs">
          <div><p className="border-t border-foreground/30 pt-1 w-40">Receiver's Signature</p></div>
          <div className="text-right"><p className="border-t border-foreground/30 pt-1 w-48 ml-auto">For {company?.company_name || "Raizechem Pvt Ltd"}<br />Authorised Signatory</p></div>
        </div>
      </div>
    </div>
  );
}
