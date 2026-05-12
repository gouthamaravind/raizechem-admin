import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportToCsv } from "@/lib/csv-export";
import { exportToXlsx } from "@/lib/xlsx-export";

export interface DrillVoucher {
  id: string;
  number: string;
  date: string; // ISO yyyy-mm-dd
  party?: string;
  amount: number;
  status?: string;
  extra?: Record<string, any>;
}

interface Props {
  title: string;
  vouchers: DrillVoucher[];
  loading?: boolean;
  amountLabel?: string;
  emptyText?: string;
  /** optional render for voucher row click (e.g., navigate to print) */
  onVoucherClick?: (v: DrillVoucher) => void;
}

const MONTH_NAMES = ["April","May","June","July","August","September","October","November","December","January","February","March"];
// FY-aligned month index → calendar month (0-11)
const FY_MONTH_TO_CAL = [3,4,5,6,7,8,9,10,11,0,1,2];

function getFY(dateStr: string): number {
  const d = new Date(dateStr);
  const m = d.getMonth();
  const y = d.getFullYear();
  return m >= 3 ? y : y - 1;
}

export function RegisterDrillDown({ title, vouchers, loading, amountLabel = "Amount", emptyText = "No vouchers", onVoucherClick }: Props) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set()); // key: `${year}-${m}`
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set()); // key: `${year}-${m}-${d}`

  // Group: year → month(0-11) → day → vouchers
  const tree = useMemo(() => {
    const t: Record<number, Record<number, Record<number, DrillVoucher[]>>> = {};
    for (const v of vouchers) {
      const fy = getFY(v.date);
      const dt = new Date(v.date);
      const m = dt.getMonth();
      const d = dt.getDate();
      t[fy] ??= {};
      t[fy][m] ??= {};
      t[fy][m][d] ??= [];
      t[fy][m][d].push(v);
    }
    return t;
  }, [vouchers]);

  const years = Object.keys(tree).map(Number).sort((a, b) => b - a);

  const toggle = (set: Set<string | number>, key: any, setter: any) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  const countAndCancelled = (list: DrillVoucher[]) => {
    let cancelled = 0;
    for (const v of list) if (v.status === "void" || v.status === "VOID" || v.status === "cancelled") cancelled++;
    return { total: list.length, cancelled };
  };

  const exportRows = vouchers.map(v => ({
    number: v.number, date: v.date, party: v.party ?? "", amount: v.amount, status: v.status ?? "",
  }));
  const cols = [
    { key: "number", label: "Voucher #" },
    { key: "date", label: "Date" },
    { key: "party", label: "Party" },
    { key: "amount", label: amountLabel },
    { key: "status", label: "Status" },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">{title}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportToCsv(`${title}.csv`, exportRows, cols)}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToXlsx(`${title}.xlsx`, exportRows, cols)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : years.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{emptyText}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Particulars</TableHead>
                <TableHead className="text-right">Total Vouchers</TableHead>
                <TableHead className="text-right">(cancelled)</TableHead>
                <TableHead className="text-right">{amountLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map(year => {
                const allYearVouchers = Object.values(tree[year]).flatMap(m => Object.values(m).flat());
                const yc = countAndCancelled(allYearVouchers);
                const ySum = allYearVouchers.reduce((s, v) => s + v.amount, 0);
                const yearOpen = expandedYears.has(year);
                return (
                  <>
                    <TableRow key={`y-${year}`} className="cursor-pointer hover:bg-muted/40 font-semibold" onClick={() => toggle(expandedYears as any, year, setExpandedYears)}>
                      <TableCell className="flex items-center gap-1">
                        {yearOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        FY {year}-{(year + 1).toString().slice(-2)} (1-Apr-{year.toString().slice(-2)} to 31-Mar-{(year + 1).toString().slice(-2)})
                      </TableCell>
                      <TableCell className="text-right">{yc.total}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{yc.cancelled || ""}</TableCell>
                      <TableCell className="text-right">₹{ySum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>

                    {yearOpen && FY_MONTH_TO_CAL.map((calM, fyIdx) => {
                      const monthBucket = tree[year][calM];
                      if (!monthBucket) return null;
                      const monthList = Object.values(monthBucket).flat();
                      if (monthList.length === 0) return null;
                      const mc = countAndCancelled(monthList);
                      const mSum = monthList.reduce((s, v) => s + v.amount, 0);
                      const mKey = `${year}-${calM}`;
                      const monthOpen = expandedMonths.has(mKey);
                      return (
                        <>
                          <TableRow key={`m-${mKey}`} className="cursor-pointer hover:bg-muted/30" onClick={() => toggle(expandedMonths as any, mKey, setExpandedMonths)}>
                            <TableCell className="pl-8 flex items-center gap-1">
                              {monthOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {MONTH_NAMES[fyIdx]}
                            </TableCell>
                            <TableCell className="text-right">{mc.total}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{mc.cancelled || ""}</TableCell>
                            <TableCell className="text-right">₹{mSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>

                          {monthOpen && Object.keys(monthBucket).map(Number).sort((a, b) => a - b).map(day => {
                            const dayList = monthBucket[day];
                            const dc = countAndCancelled(dayList);
                            const dSum = dayList.reduce((s, v) => s + v.amount, 0);
                            const dKey = `${mKey}-${day}`;
                            const dayOpen = expandedDays.has(dKey);
                            return (
                              <>
                                <TableRow key={`d-${dKey}`} className="cursor-pointer hover:bg-muted/20" onClick={() => toggle(expandedDays as any, dKey, setExpandedDays)}>
                                  <TableCell className="pl-16 flex items-center gap-1">
                                    {dayOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    {day}-{MONTH_NAMES[fyIdx].slice(0, 3)}-{(calM < 3 ? year + 1 : year).toString().slice(-2)}
                                  </TableCell>
                                  <TableCell className="text-right">{dc.total}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{dc.cancelled || ""}</TableCell>
                                  <TableCell className="text-right">₹{dSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                {dayOpen && dayList.map(v => (
                                  <TableRow
                                    key={`v-${v.id}`}
                                    className={`hover:bg-accent/40 ${onVoucherClick ? "cursor-pointer" : ""} ${v.status === "void" || v.status === "VOID" || v.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}
                                    onClick={() => onVoucherClick?.(v)}
                                  >
                                    <TableCell className="pl-24 text-sm">
                                      {v.number} {v.party ? `— ${v.party}` : ""}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">{v.status ?? "active"}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-sm">₹{v.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                  </TableRow>
                                ))}
                              </>
                            );
                          })}
                        </>
                      );
                    })}
                  </>
                );
              })}
              <TableRow className="font-bold border-t-2">
                <TableCell>Grand Total</TableCell>
                <TableCell className="text-right">{vouchers.length}</TableCell>
                <TableCell className="text-right text-muted-foreground">{vouchers.filter(v => v.status === "void" || v.status === "VOID" || v.status === "cancelled").length || ""}</TableCell>
                <TableCell className="text-right">₹{vouchers.reduce((s, v) => s + v.amount, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function DateRangeFilter({ from, to, onFromChange, onToChange }: { from: string; to: string; onFromChange: (s: string) => void; onToChange: (s: string) => void }) {
  return (
    <Card>
      <CardContent className="pt-4 flex gap-4 flex-wrap items-end">
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" className="w-40" value={from} onChange={(e) => onFromChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" className="w-40" value={to} onChange={(e) => onToChange(e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}
