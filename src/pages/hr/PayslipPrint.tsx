import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

export default function PayslipPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payslip, isLoading } = useQuery({
    queryKey: ["payslip-print", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("*, employees(name, designation, department, pan, uan, bank_account, email, phone, date_of_joining), payroll_runs(month, year)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: company } = useQuery({
    queryKey: ["company-settings-payslip"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).single();
      return data;
    },
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!payslip) return <div className="p-8 text-center">Payslip not found</div>;

  const slip = payslip as any;
  const emp = slip.employees;
  const run = slip.payroll_runs;
  const monthName = run ? MONTHS[run.month - 1] : "";
  const yearStr = run?.year || "";
  const earnings = (slip.earnings || {}) as Record<string, number>;
  const deductions = (slip.deductions || {}) as Record<string, number>;
  const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
  const earningEntries = Object.entries(earnings);
  const deductionEntries = Object.entries(deductions);
  const maxRows = Math.max(earningEntries.length, deductionEntries.length);

  return (
    <div>
      <div className="print:hidden fixed top-0 left-0 right-0 bg-background border-b z-50 p-3 flex gap-2 items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
      </div>

      <div className="max-w-[210mm] mx-auto p-8 print:p-6 print:pt-0 mt-16 print:mt-0 text-sm">
        <div className="border-2 border-foreground/50">
          {/* Company Header */}
          <div className="text-center py-4 border-b border-foreground/50 bg-muted/30">
            <h1 className="text-lg font-bold tracking-wide">{company?.company_name || "Company"}</h1>
            {company?.address_line1 && (
              <p className="text-xs text-muted-foreground">
                {company.address_line1}{company?.address_line2 ? `, ${company.address_line2}` : ""}, {company?.city}, {company?.state} — {company?.pincode}
              </p>
            )}
            {company?.gst_number && <p className="text-xs text-muted-foreground">GSTIN: {company.gst_number}</p>}
          </div>

          {/* Payslip Title */}
          <div className="text-center py-2 border-b border-foreground/50">
            <h2 className="font-bold text-base">PAYSLIP — {monthName} {yearStr}</h2>
          </div>

          {/* Employee Details */}
          <div className="p-4 border-b border-foreground/50">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">Employee Name:</span><span>{emp?.name || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">Designation:</span><span>{emp?.designation || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">Department:</span><span>{emp?.department || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">Date of Joining:</span><span>{emp?.date_of_joining || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">PAN:</span><span>{emp?.pan || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">UAN:</span><span>{emp?.uan || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">Bank Account:</span><span>{emp?.bank_account || "—"}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-32 shrink-0">Payment Status:</span><span className="font-medium uppercase">{slip.payment_status}</span></div>
            </div>
          </div>

          {/* Earnings & Deductions Table */}
          <div className="p-4 border-b border-foreground/50">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-foreground/30 p-2 text-left w-1/4">Earnings</th>
                  <th className="border border-foreground/30 p-2 text-right w-1/4">Amount (₹)</th>
                  <th className="border border-foreground/30 p-2 text-left w-1/4">Deductions</th>
                  <th className="border border-foreground/30 p-2 text-right w-1/4">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }).map((_, i) => (
                  <tr key={i}>
                    <td className="border border-foreground/30 p-2">{earningEntries[i]?.[0] || ""}</td>
                    <td className="border border-foreground/30 p-2 text-right">{earningEntries[i] ? `₹${earningEntries[i][1].toLocaleString("en-IN")}` : ""}</td>
                    <td className="border border-foreground/30 p-2">{deductionEntries[i]?.[0] || ""}</td>
                    <td className="border border-foreground/30 p-2 text-right">{deductionEntries[i] ? `₹${deductionEntries[i][1].toLocaleString("en-IN")}` : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold bg-muted/30">
                  <td className="border border-foreground/30 p-2 text-right">Gross Pay:</td>
                  <td className="border border-foreground/30 p-2 text-right">₹{Number(slip.gross).toLocaleString("en-IN")}</td>
                  <td className="border border-foreground/30 p-2 text-right">Total Deductions:</td>
                  <td className="border border-foreground/30 p-2 text-right">₹{totalDeductions.toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Net Pay */}
          <div className="p-4 border-b border-foreground/50">
            <div className="flex justify-between items-center text-base font-bold">
              <span>Net Pay (Take Home):</span>
              <span>₹{Number(slip.net_pay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <strong>Amount in words:</strong> {numberToWords(Number(slip.net_pay))}
            </p>
          </div>

          {/* Footer */}
          <div className="p-4">
            <div className="grid grid-cols-2 mt-8 text-xs">
              <div><p className="border-t border-foreground/30 pt-1 w-40">Employee Signature</p></div>
              <div className="text-right"><p className="border-t border-foreground/30 pt-1 w-48 ml-auto">For {company?.company_name || "Company"}<br />Authorised Signatory</p></div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-6">This is a computer-generated payslip and does not require a signature.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
