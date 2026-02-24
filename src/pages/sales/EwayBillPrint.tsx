import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import { COMPANY_STATE_CODE } from "@/lib/gst";

const TRANSPORT_MODES: Record<string, string> = {
  road: "1 - Road", rail: "2 - Rail", air: "3 - Air", ship: "4 - Ship",
};

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex text-xs py-0.5">
      <span className="w-44 shrink-0 font-semibold">{label}</span>
      <span className="px-2">:</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

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

  const companyAddress = [company?.address_line1, company?.address_line2].filter(Boolean).join(", ");
  const dealerAddress = [dealer?.address_line1, dealer?.address_line2].filter(Boolean).join(", ");
  const shippingAddress = dealer?.shipping_address_line1 || dealerAddress;

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
        <div className="border-2 border-foreground/50">
          {/* Company Name Header */}
          <div className="text-center py-2 border-b border-foreground/50 bg-muted/30">
            <p className="font-bold text-base">{company?.company_name || "Company"}</p>
          </div>

          {/* Title Bar */}
          <div className="text-center py-1.5 border-b border-foreground/50 bg-muted/20">
            <p className="text-xs font-semibold">Additional Details : {isIntra ? "Local Sales" : "Inter-State Sales"} - Taxable</p>
          </div>

          {/* E-Way Bill Details */}
          <div className="p-4 border-b border-foreground/50">
            <p className="text-center font-bold text-sm mb-3">e-Way Bill Details</p>
            <div className="grid grid-cols-2 gap-x-8">
              <DetailRow label="e-Way Bill No." value="—" />
              <DetailRow label="Date" value="—" />
              <DetailRow label="Sub Type" value="Supply" />
              <DetailRow label="Document Type" value="Tax Invoice" />
            </div>
          </div>

          {/* Consignor Details (From) */}
          <div className="p-4 border-b border-foreground/50">
            <p className="text-center font-bold text-xs mb-3 uppercase">Consignor Details [From]</p>
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <DetailRow label="Mailing Name" value={company?.company_name || "—"} bold />
                <DetailRow label="GSTIN/UIN" value={company?.gst_number || "—"} bold />
                <DetailRow label="State" value={company?.state || "—"} bold />
              </div>
              <div>
                <DetailRow label="Address Type" value="●Primary" bold />
                <DetailRow label="Address1" value={companyAddress || "—"} />
                <DetailRow label="Address2" value="" />
                <DetailRow label="Pincode" value={company?.pincode || "—"} bold />
                <DetailRow label="Place" value={company?.city || "—"} />
                <DetailRow label="Actual State" value={company?.state || "—"} bold />
              </div>
            </div>
          </div>

          {/* Consignee Details (To) */}
          <div className="p-4 border-b border-foreground/50">
            <p className="text-center font-bold text-xs mb-3 uppercase">Consignee Details [To]</p>
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <DetailRow label="Mailing Name" value={dealer?.name || "—"} bold />
                <DetailRow label="GSTIN/UIN" value={dealer?.gst_number || "Unregistered"} bold />
                <DetailRow label="State" value={dealer?.state || "—"} bold />
              </div>
              <div>
                <DetailRow label="Address Type" value="●Primary" bold />
                <DetailRow label="Address1" value={shippingAddress || "—"} />
                <DetailRow label="Address2" value="" />
                <DetailRow label="Pincode" value={dealer?.pincode || "—"} bold />
                <DetailRow label="Place" value={dealer?.shipping_city || dealer?.city || "—"} />
                <DetailRow label="Actual State" value={dealer?.shipping_state || dealer?.state || "—"} bold />
              </div>
            </div>
          </div>

          {/* Item Details */}
          <div className="p-4 border-b border-foreground/50">
            <p className="text-center font-bold text-xs mb-3 uppercase">Item Details</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-foreground/30 p-1.5 text-left">#</th>
                  <th className="border border-foreground/30 p-1.5 text-left">Name of Item</th>
                  <th className="border border-foreground/30 p-1.5">HSN/SAC</th>
                  <th className="border border-foreground/30 p-1.5 text-right">Qty</th>
                  <th className="border border-foreground/30 p-1.5">Unit</th>
                  <th className="border border-foreground/30 p-1.5 text-right">Rate per</th>
                  <th className="border border-foreground/30 p-1.5 text-right">Taxable Value</th>
                  {isIntra ? (
                    <>
                      <th className="border border-foreground/30 p-1.5 text-right">CGST</th>
                      <th className="border border-foreground/30 p-1.5 text-right">SGST</th>
                    </>
                  ) : (
                    <th className="border border-foreground/30 p-1.5 text-right">IGST</th>
                  )}
                  <th className="border border-foreground/30 p-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, idx: number) => (
                  <tr key={it.id}>
                    <td className="border border-foreground/30 p-1.5">{idx + 1}</td>
                    <td className="border border-foreground/30 p-1.5">{it.products?.name}</td>
                    <td className="border border-foreground/30 p-1.5 text-center">{it.hsn_code || it.products?.hsn_code || "—"}</td>
                    <td className="border border-foreground/30 p-1.5 text-right">{it.qty} {it.products?.unit}</td>
                    <td className="border border-foreground/30 p-1.5 text-center">{it.products?.unit}</td>
                    <td className="border border-foreground/30 p-1.5 text-right">₹{Number(it.rate).toFixed(2)}</td>
                    <td className="border border-foreground/30 p-1.5 text-right">₹{Number(it.amount).toFixed(2)}</td>
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
                  <td colSpan={6} className="border border-foreground/30 p-1.5 text-right">Totals:</td>
                  <td className="border border-foreground/30 p-1.5 text-right">₹{totalTaxable.toFixed(2)}</td>
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

          {/* Transport Details — Tally-style */}
          <div className="p-4 border-b border-foreground/50">
            <p className="text-center font-bold text-xs mb-3 uppercase">Transport Details</p>
            <div className="grid grid-cols-2 gap-x-8">
              <DetailRow label="Transporter Name" value="●None" />
              <DetailRow label="Transporter ID" value="—" />
            </div>
            <p className="font-semibold text-xs mt-3 mb-1">Part B Details</p>
            <div className="grid grid-cols-2 gap-x-8">
              <DetailRow label="Mode" value={TRANSPORT_MODES[inv.transport_mode] || "●Not Applicable"} />
              <DetailRow label="Vehicle Type" value="●Not Applicable" />
              <DetailRow label="Doc/Lading/RR/AirWay No." value="—" />
              <DetailRow label="Date" value="—" />
              <DetailRow label="Vehicle Number" value={inv.vehicle_no || "—"} />
            </div>
          </div>

          {/* Invoice Reference */}
          <div className="p-3 text-xs text-muted-foreground">
            <div className="grid grid-cols-2 gap-x-8">
              <DetailRow label="Document No" value={inv.invoice_number} bold />
              <DetailRow label="Document Date" value={inv.invoice_date} bold />
              <DetailRow label="Invoice Total" value={`₹${Number(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} bold />
              <DetailRow label="Place of Supply" value={inv.place_of_supply || dealer?.state || "—"} />
            </div>
            <p className="text-center mt-3 text-[10px]">This is a computer-generated E-Way Bill document. Actual E-Way Bill must be generated on the GST portal (ewaybillgst.gov.in)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
