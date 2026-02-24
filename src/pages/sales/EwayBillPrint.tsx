import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { COMPANY_STATE_CODE } from "@/lib/gst";

const TRANSPORT_MODES: Record<string, string> = {
  road: "1 - Road", rail: "2 - Rail", air: "3 - Air", ship: "4 - Ship",
};

export default function EwayBillPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice-ewb", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("*, dealers(name, gst_number, address_line1, address_line2, city, state, pincode, state_code, shipping_address_line1, shipping_city, shipping_state, shipping_pincode)")
        .eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["invoice-items-ewb", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoice_items")
        .select("*, products(name, unit, hsn_code)")
        .eq("invoice_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: company } = useQuery({
    queryKey: ["company-settings-ewb"],
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
  const totalTaxable = items.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalCgst = items.reduce((s: number, i: any) => s + Number(i.cgst_amount), 0);
  const totalSgst = items.reduce((s: number, i: any) => s + Number(i.sgst_amount), 0);
  const totalIgst = items.reduce((s: number, i: any) => s + Number(i.igst_amount), 0);

  const exportJson = () => {
    const data = {
      invoice_number: inv.invoice_number, invoice_date: inv.invoice_date,
      seller_gstin: company?.gst_number, buyer_gstin: dealer?.gst_number,
      place_of_supply: inv.place_of_supply || dealer?.state,
      transport_mode: inv.transport_mode, vehicle_no: inv.vehicle_no,
      dispatch_from: inv.dispatch_from || `${company?.city}, ${company?.state}`,
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
      <div className="print:hidden fixed top-0 left-0 right-0 bg-background border-b z-50 p-3 flex gap-2 items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
        <Button variant="outline" size="sm" onClick={exportJson}><Download className="h-4 w-4 mr-1" />Export JSON</Button>
      </div>

      <div className="max-w-[210mm] mx-auto p-8 print:p-6 print:pt-0 mt-16 print:mt-0 text-sm">
        {/* Header */}
        <div className="border-2 border-foreground/50">
          <div className="text-center py-3 border-b border-foreground/50 bg-muted/30">
            <h1 className="text-lg font-bold tracking-wide">E-WAY BILL</h1>
            <p className="text-xs text-muted-foreground">Generated under GST provisions — For transport of goods</p>
          </div>

          {/* Part A – Supply Details */}
          <div className="p-4 border-b border-foreground/50">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Part A — Supply Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">GSTIN of Supplier:</span><span>{company?.gst_number || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">GSTIN of Recipient:</span><span>{dealer?.gst_number || "Unregistered"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Place of Dispatch:</span><span>{inv.dispatch_from || `${company?.city}, ${company?.state}`}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Place of Delivery:</span><span>{inv.delivery_to || `${dealer?.shipping_city || dealer?.city}, ${dealer?.shipping_state || dealer?.state}`}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Document No:</span><span>{inv.invoice_number}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Document Date:</span><span>{inv.invoice_date}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Supply Type:</span><span>{isIntra ? "Inward/Outward (Intra-State)" : "Inward/Outward (Inter-State)"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Sub-Type:</span><span>Supply</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Document Type:</span><span>Tax Invoice</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Transaction Type:</span><span>Regular</span></div>
            </div>
          </div>

          {/* Seller & Buyer */}
          <div className="grid grid-cols-2 border-b border-foreground/50">
            <div className="p-4 border-r border-foreground/50">
              <p className="font-bold text-xs uppercase text-muted-foreground mb-2">From (Supplier)</p>
              <div className="text-xs space-y-1">
                <p className="font-semibold">{company?.company_name}</p>
                {company?.legal_name && <p>{company.legal_name}</p>}
                <p>{company?.address_line1}{company?.address_line2 ? `, ${company.address_line2}` : ""}</p>
                <p>{company?.city}, {company?.state} — {company?.pincode}</p>
                <p>GSTIN: {company?.gst_number} | State Code: {COMPANY_STATE_CODE}</p>
              </div>
            </div>
            <div className="p-4">
              <p className="font-bold text-xs uppercase text-muted-foreground mb-2">To (Recipient)</p>
              <div className="text-xs space-y-1">
                <p className="font-semibold">{dealer?.name}</p>
                <p>{dealer?.address_line1}{dealer?.address_line2 ? `, ${dealer.address_line2}` : ""}</p>
                <p>{dealer?.city}, {dealer?.state} — {dealer?.pincode}</p>
                <p>GSTIN: {dealer?.gst_number || "Unregistered"} | State Code: {dealer?.state_code || "—"}</p>
              </div>
            </div>
          </div>

          {/* Item Details */}
          <div className="p-4 border-b border-foreground/50">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Item Details</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-foreground/30 p-1.5 text-left">#</th>
                  <th className="border border-foreground/30 p-1.5 text-left">Product Name</th>
                  <th className="border border-foreground/30 p-1.5">HSN</th>
                  <th className="border border-foreground/30 p-1.5 text-right">Qty</th>
                  <th className="border border-foreground/30 p-1.5">Unit</th>
                  <th className="border border-foreground/30 p-1.5 text-right">Taxable Value</th>
                  <th className="border border-foreground/30 p-1.5 text-right">Tax Rate</th>
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
              <tfoot>
                <tr className="font-semibold bg-muted/30">
                  <td colSpan={5} className="border border-foreground/30 p-1.5 text-right">Totals:</td>
                  <td className="border border-foreground/30 p-1.5 text-right">₹{totalTaxable.toFixed(2)}</td>
                  <td className="border border-foreground/30 p-1.5"></td>
                  {isIntra ? (
                    <>
                      <td className="border border-foreground/30 p-1.5 text-right">₹{totalCgst.toFixed(2)}</td>
                      <td className="border border-foreground/30 p-1.5 text-right">₹{totalSgst.toFixed(2)}</td>
                    </>
                  ) : (
                    <td className="border border-foreground/30 p-1.5 text-right">₹{totalIgst.toFixed(2)}</td>
                  )}
                  <td className="border border-foreground/30 p-1.5 text-right">₹{Number(inv.total_amount).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Part B – Transport Details */}
          <div className="p-4">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Part B — Transport Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Mode of Transport:</span><span>{TRANSPORT_MODES[inv.transport_mode] || inv.transport_mode || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Vehicle Number:</span><span className="font-mono">{inv.vehicle_no || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Transporter Name:</span><span>—</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Transporter ID:</span><span>—</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Approx Distance (KM):</span><span>—</span></div>
              <div className="flex gap-2"><span className="font-semibold w-36 shrink-0">Transport Doc No:</span><span>—</span></div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-foreground/50 p-4 text-xs text-muted-foreground text-center">
            <p>This is a computer-generated E-Way Bill document. Actual E-Way Bill must be generated on the GST portal (ewaybillgst.gov.in)</p>
            <p className="mt-1">Invoice Total: <strong className="text-foreground">₹{Number(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}