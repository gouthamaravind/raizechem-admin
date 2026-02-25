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

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Bordered cell used in the employee details grid */
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <td className="border border-neutral-400 px-3 py-1.5">
      <span className="font-semibold text-neutral-700">{label}</span>
    </td>
  );
}

export default function PayslipPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payslip, isLoading } = useQuery({
    queryKey: ["payslip-print", id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("payslips")
          .select("*, employees(name, designation, department, pan, uan, bank_account, email, phone, date_of_joining), payroll_runs(month, year)")
          .eq("id", id!)
          .maybeSingle();
        if (error) throw error;
        return data;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  const { data: company } = useQuery({
    queryKey: ["company-settings-payslip"],
    queryFn: async () => {
      try {
        const { data } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
        return data;
      } catch {
        return null;
      }
    },
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!payslip) return <div className="p-8 text-center text-muted-foreground">Payslip not found</div>;

  const slip = payslip as any;
  const emp = slip.employees;
  const run = slip.payroll_runs;
  const monthName = run ? MONTHS[run.month - 1] : "";
  const yearStr = run?.year || "";
  const earnings = (slip.earnings || {}) as Record<string, number>;
  const deductions = (slip.deductions || {}) as Record<string, number>;
  const earningEntries = Object.entries(earnings);
  const deductionEntries = Object.entries(deductions);
  const maxRows = Math.max(earningEntries.length, deductionEntries.length, 1);
  const totalEarnings = earningEntries.reduce((s, [, v]) => s + v, 0);
  const totalDeductions = deductionEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div>
      {/* Toolbar — hidden during print */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-background border-b z-50 p-3 flex gap-2 items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
      </div>

      {/* ─── A4 Payslip ─── */}
      <div className="max-w-[210mm] mx-auto mt-16 print:mt-0 p-8 print:p-6 print:pt-2 font-[system-ui] text-[11px] leading-tight text-neutral-900">

        {/* Company Header */}
        <div className="flex items-center justify-between border-b-2 border-emerald-700 pb-3 mb-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-800">{company?.company_name || "Company"}</h1>
            {company?.address_line1 && (
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {company.address_line1}{company?.address_line2 ? `, ${company.address_line2}` : ""}{company?.city ? `, ${company.city}` : ""}{company?.state ? `, ${company.state}` : ""}{company?.pincode ? ` — ${company.pincode}` : ""}
              </p>
            )}
          </div>
          <div className="text-right text-[10px] text-neutral-500">
            {company?.gst_number && <p>GSTIN: {company.gst_number}</p>}
            {company?.pan_number && <p>PAN: {company.pan_number}</p>}
          </div>
        </div>

        {/* ─── Payslip Title Row ─── */}
        <table className="w-full border-collapse mt-0">
          <tbody>
            <tr className="bg-neutral-100">
              <td className="border border-neutral-400 px-3 py-2 font-bold text-[12px]">PaySlip</td>
              <td className="border border-neutral-400 px-3 py-2 font-bold text-[12px]">Payslip for the month</td>
              <td className="border border-neutral-400 px-3 py-2 text-[12px]">{monthName} — {yearStr}</td>
              <td className="border border-neutral-400 px-3 py-2 font-bold text-[12px]">Status</td>
              <td className="border border-neutral-400 px-3 py-2 text-[12px] uppercase">{slip.payment_status}</td>
            </tr>
          </tbody>
        </table>

        {/* ─── Employee Details Grid ─── */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700 w-[15%]">Employee Name</td>
              <td className="border border-neutral-400 px-3 py-1.5 w-[20%]">{emp?.name || "—"}</td>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700 w-[15%]">Designation</td>
              <td className="border border-neutral-400 px-3 py-1.5 w-[20%]">{emp?.designation || "—"}</td>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700 w-[15%]">Department</td>
              <td className="border border-neutral-400 px-3 py-1.5 w-[15%]">{emp?.department || "—"}</td>
            </tr>
            <tr>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700">PAN</td>
              <td className="border border-neutral-400 px-3 py-1.5">{emp?.pan || "—"}</td>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700">UAN</td>
              <td className="border border-neutral-400 px-3 py-1.5">{emp?.uan || "—"}</td>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700">Payment Mode</td>
              <td className="border border-neutral-400 px-3 py-1.5">Bank Transfer</td>
            </tr>
            <tr>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700">Bank Account</td>
              <td className="border border-neutral-400 px-3 py-1.5">{emp?.bank_account || "—"}</td>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700">Joining Date</td>
              <td className="border border-neutral-400 px-3 py-1.5">{emp?.date_of_joining || "—"}</td>
              <td className="border border-neutral-400 px-3 py-1.5 font-semibold text-neutral-700" colSpan={2}></td>
            </tr>
          </tbody>
        </table>

        {/* ─── Earnings & Deductions Table ─── */}
        <table className="w-full border-collapse mt-3">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-400 px-3 py-2 text-left w-[30%]">Earnings</th>
              <th className="border border-neutral-400 px-3 py-2 text-right w-[20%]">Amount</th>
              <th className="border border-neutral-400 px-3 py-2 text-left w-[30%]">Deductions &amp; Recoveries</th>
              <th className="border border-neutral-400 px-3 py-2 text-right w-[20%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, i) => (
              <tr key={i}>
                <td className="border border-neutral-400 px-3 py-1.5">{earningEntries[i]?.[0] || ""}</td>
                <td className="border border-neutral-400 px-3 py-1.5 text-right font-mono">{earningEntries[i] ? fmt(earningEntries[i][1]) : ""}</td>
                <td className="border border-neutral-400 px-3 py-1.5">{deductionEntries[i]?.[0] || ""}</td>
                <td className="border border-neutral-400 px-3 py-1.5 text-right font-mono">{deductionEntries[i] ? fmt(deductionEntries[i][1]) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Totals row */}
            <tr className="font-semibold bg-neutral-50">
              <td className="border border-neutral-400 px-3 py-2 text-right">Amount Total :</td>
              <td className="border border-neutral-400 px-3 py-2 text-right font-mono">{fmt(totalEarnings)}</td>
              <td className="border border-neutral-400 px-3 py-2 text-right">Amount Total :</td>
              <td className="border border-neutral-400 px-3 py-2 text-right font-mono">{fmt(totalDeductions)}</td>
            </tr>
            {/* Net Pay row */}
            <tr className="font-bold text-[12px]">
              <td className="border border-neutral-400 px-3 py-2" colSpan={2}></td>
              <td className="border border-neutral-400 px-3 py-2 text-right">Net Pay :</td>
              <td className="border border-neutral-400 px-3 py-2 text-right font-mono">{fmt(Number(slip.net_pay))}</td>
            </tr>
          </tfoot>
        </table>

        {/* ─── Net Pay in Words ─── */}
        <div className="border border-neutral-400 border-t-0 px-3 py-2 bg-neutral-50">
          <span className="font-semibold">Net Pay : </span>
          <span>{numberToWords(Number(slip.net_pay))}</span>
        </div>

        {/* ─── Footer ─── */}
        <p className="text-[10px] text-emerald-700 font-semibold italic mt-6">
          *This is a computer generated statement, does not require signature.
        </p>

        {/* Signature blocks */}
        <div className="grid grid-cols-2 mt-12">
          <div>
            <div className="border-t border-neutral-500 w-40 pt-1 text-[10px] text-neutral-500">Employee Signature</div>
          </div>
          <div className="text-right">
            <div className="border-t border-neutral-500 w-48 ml-auto pt-1 text-[10px] text-neutral-500">
              For {company?.company_name || "Company"}<br />Authorised Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
