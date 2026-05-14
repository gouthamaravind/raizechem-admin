import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, MapPin, Phone, Mail, Building2, AlertTriangle, ShieldCheck, IndianRupee } from "lucide-react";
import { useDealerOverdue } from "@/hooks/useDealerOverdue";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN") : "—");

export default function Dealer360() {
  const { id } = useParams<{ id: string }>();
  const { getOverdue, threshold } = useDealerOverdue();

  const { data: dealer, isLoading } = useQuery({
    queryKey: ["dealer-360", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("dealers").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: priceLevel } = useQuery({
    queryKey: ["dealer-360-pl", dealer?.price_level_id],
    enabled: !!dealer?.price_level_id,
    queryFn: async () => {
      const { data } = await supabase.from("price_levels").select("name").eq("id", dealer!.price_level_id!).maybeSingle();
      return data;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["dealer-360-invoices", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status")
        .eq("dealer_id", id!)
        .order("invoice_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["dealer-360-orders", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, order_date, total_amount, status")
        .eq("dealer_id", id!)
        .order("order_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["dealer-360-visits", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dealer_visits")
        .select("id, checkin_time, checkout_time, activity_type, is_photo_verified, notes")
        .eq("dealer_id", id!)
        .order("checkin_time", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["dealer-360-receipts", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advance_receipts")
        .select("id, receipt_number, receipt_date, gross_amount, balance_amount, status")
        .eq("dealer_id", id!)
        .order("receipt_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const totalOutstanding = invoices.reduce(
      (s: number, i: any) => s + Math.max(0, Number(i.total_amount) - Number(i.amount_paid)),
      0,
    );
    const totalSales = invoices
      .filter((i: any) => i.status !== "void")
      .reduce((s: number, i: any) => s + Number(i.total_amount), 0);
    const advanceBal = receipts.reduce((s: number, r: any) => s + Number(r.balance_amount || 0), 0);
    return {
      totalOutstanding,
      totalSales,
      advanceBal,
      invoiceCount: invoices.length,
      orderCount: orders.length,
      visitCount: visits.length,
    };
  }, [invoices, orders, visits, receipts]);

  const overdue = id ? getOverdue(id) : undefined;
  const blocked = !!overdue;
  const creditLimit = Number(dealer?.credit_limit || 0);
  const creditUsedPct = creditLimit > 0 ? Math.min(100, (stats.totalOutstanding / creditLimit) * 100) : 0;

  if (isLoading || !dealer) {
    return (
      <DashboardLayout>
        <div className="text-muted-foreground">Loading dealer profile…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/masters/dealers"><ArrowLeft className="h-4 w-4 mr-1" />Dealers</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{dealer.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                {dealer.gst_number && <span className="font-mono">{dealer.gst_number}</span>}
                {priceLevel?.name && <Badge variant="secondary">Tier: {priceLevel.name}</Badge>}
                <Badge variant={dealer.status === "active" ? "default" : "outline"}>{dealer.status}</Badge>
                {blocked && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Credit Blocked ({overdue?.maxDaysOverdue}d)
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Outstanding</CardDescription></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{fmtINR(stats.totalOutstanding)}</div>
              {creditLimit > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Limit {fmtINR(creditLimit)} • {creditUsedPct.toFixed(0)}% used
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Lifetime Sales</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{fmtINR(stats.totalSales)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Advance Balance</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{fmtINR(stats.advanceBal)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Activity</CardDescription></CardHeader>
            <CardContent>
              <div className="text-sm">{stats.invoiceCount} invoices</div>
              <div className="text-sm">{stats.orderCount} orders</div>
              <div className="text-sm">{stats.visitCount} visits</div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue alert */}
        {blocked && (
          <Card className="border-destructive">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Credit control: New sales blocked</p>
                <p className="text-muted-foreground">
                  {overdue?.overdueInvoiceCount} invoice(s) overdue beyond policy threshold of {threshold} days. Total
                  overdue {fmtINR(overdue?.totalOverdue || 0)}.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile + Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Contact & Address</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {dealer.contact_person && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{dealer.contact_person}</div>}
              {dealer.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{dealer.phone}</div>}
              {dealer.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{dealer.email}</div>}
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  {dealer.address_line1 && <div>{dealer.address_line1}</div>}
                  {dealer.address_line2 && <div>{dealer.address_line2}</div>}
                  <div>
                    {[dealer.city, dealer.state, dealer.pincode].filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Payment Terms</p>
                  <p className="font-semibold">{dealer.payment_terms_days || 0} days</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Credit Limit</p>
                  <p className="font-semibold">{fmtINR(creditLimit)}</p>
                </div>
                {dealer.gst_status && (
                  <div className="col-span-2 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">GST: {dealer.gst_status}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <Tabs defaultValue="invoices">
                <TabsList>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                  <TabsTrigger value="receipts">Receipts</TabsTrigger>
                  <TabsTrigger value="visits">Visits</TabsTrigger>
                </TabsList>

                <TabsContent value="invoices" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices</TableCell></TableRow>
                      )}
                      {invoices.map((i: any) => {
                        const out = Math.max(0, Number(i.total_amount) - Number(i.amount_paid));
                        return (
                          <TableRow key={i.id}>
                            <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                            <TableCell>{fmtDate(i.invoice_date)}</TableCell>
                            <TableCell>{fmtDate(i.due_date)}</TableCell>
                            <TableCell className="text-right">{fmtINR(Number(i.total_amount))}</TableCell>
                            <TableCell className="text-right">{out > 0 ? fmtINR(out) : "—"}</TableCell>
                            <TableCell><Badge variant={i.status === "void" ? "destructive" : "outline"}>{i.status}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="orders" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No orders</TableCell></TableRow>
                      )}
                      {orders.map((o: any) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                          <TableCell>{fmtDate(o.order_date)}</TableCell>
                          <TableCell className="text-right">{fmtINR(Number(o.total_amount))}</TableCell>
                          <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="receipts" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No advance receipts</TableCell></TableRow>
                      )}
                      {receipts.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.receipt_number}</TableCell>
                          <TableCell>{fmtDate(r.receipt_date)}</TableCell>
                          <TableCell className="text-right">{fmtINR(Number(r.gross_amount))}</TableCell>
                          <TableCell className="text-right">{fmtINR(Number(r.balance_amount))}</TableCell>
                          <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="visits" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No visits</TableCell></TableRow>
                      )}
                      {visits.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs">{new Date(v.checkin_time).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs">{v.checkout_time ? new Date(v.checkout_time).toLocaleString("en-IN") : "—"}</TableCell>
                          <TableCell><Badge variant="secondary">{v.activity_type}</Badge></TableCell>
                          <TableCell>
                            {v.is_photo_verified
                              ? <Badge className="bg-green-600 hover:bg-green-700">Photo ✓</Badge>
                              : <Badge variant="outline">No photo</Badge>}
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate">{v.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
