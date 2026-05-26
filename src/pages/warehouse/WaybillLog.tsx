import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/hooks/useBranch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send, XCircle, FileText, Search, Printer, ExternalLink, AlertCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { explainEwbError } from "@/lib/ewb-error-codes";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TransporterPicker, type TransporterOption } from "@/components/TransporterPicker";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  generated: "default",
  cancelled: "destructive",
  expired: "outline",
  failed: "destructive",
};

export default function WaybillLog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { branchId } = useBranch();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [sourceType, setSourceType] = useState<"invoice" | "branch_transfer">("invoice");
  const [sourceId, setSourceId] = useState("");
  const [transportMode, setTransportMode] = useState("road");
  const [vehicleNo, setVehicleNo] = useState("");
  const [distance, setDistance] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [transporterGstin, setTransporterGstin] = useState("");


  useEffect(() => {
    const prefill = (location.state as any)?.prefillInvoiceId;
    if (prefill) {
      setSourceType("invoice");
      setSourceId(prefill);
      setOpenNew(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: waybills = [], isLoading } = useQuery({
    queryKey: ["waybills", branchId],
    queryFn: async () => {
      let q = supabase.from("waybills" as any).select("*").order("created_at", { ascending: false }).limit(200);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: branchRow } = useQuery({
    queryKey: ["branch-row", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, branch_name, pincode, gst_number").eq("id", branchId!).single();
      return data;
    },
  });
  const branchMissing: string[] = [];
  if (branchRow && !branchRow.pincode) branchMissing.push("pincode");
  if (branchRow && !branchRow.gst_number) branchMissing.push("GSTIN");

  const { data: sources = [] } = useQuery({
    queryKey: ["wb-sources", sourceType, branchId],
    enabled: openNew,
    queryFn: async () => {
      if (sourceType === "invoice") {
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, dealer_id, branch_id, transporter_id, dealers(name, gst_number, state_code)")
          .eq("branch_id", branchId!)
          .order("invoice_date", { ascending: false })
          .limit(100);
        return data || [];
      } else {
        const { data } = await supabase
          .from("branch_transfers")
          .select("id, transfer_number, total_amount, from_branch_id, to_branch_id")
          .eq("from_branch_id", branchId!)
          .order("created_at", { ascending: false })
          .limit(100);
        return data || [];
      }
    },
  });

  // Prefill transporter when invoice source is picked
  useEffect(() => {
    if (sourceType !== "invoice" || !sourceId) return;
    const src: any = (sources as any[]).find((s) => s.id === sourceId);
    if (!src?.transporter_id) return;
    supabase.from("transporters" as any).select("id, name, gst_number").eq("id", src.transporter_id).single().then(({ data }) => {
      if (data) {
        setTransporterId((data as any).id);
        setTransporterName((data as any).name || "");
        setTransporterGstin((data as any).gst_number || "");
      }
    });
  }, [sourceId, sourceType, sources]);

  const createWb = useMutation({
    mutationFn: async () => {
      if (!sourceId) throw new Error("Pick a source document");
      const src: any = (sources as any[]).find((s: any) => s.id === sourceId);
      if (!src) throw new Error("Source not loaded");
      if (!transporterGstin || transporterGstin.length !== 15) {
        throw new Error("Transporter with valid 15-char GSTIN required (we generate Part-A only)");
      }

      const { data: branch } = await supabase.from("branches").select("*").eq("id", branchId!).single();
      const docNumberRes = await supabase.rpc("next_waybill_number" as any, { p_branch_id: branchId });
      if (docNumberRes.error) throw docNumberRes.error;

      let toGstin = "", toStateCode = "";
      if (sourceType === "invoice") {
        toGstin = src.dealers?.gst_number ?? "";
        toStateCode = src.dealers?.state_code ?? "";
      } else {
        const { data: toBr } = await supabase.from("branches").select("gst_number, state_code").eq("id", src.to_branch_id).single();
        toGstin = toBr?.gst_number ?? "";
        toStateCode = toBr?.state_code ?? "";
      }

      // Pull tax breakup from source
      let taxable = 0, cgst = 0, sgst = 0, igst = 0, total = Number(src.total_amount ?? 0);
      if (sourceType === "invoice") {
        const { data: inv } = await supabase.from("invoices").select("subtotal, cgst_total, sgst_total, igst_total").eq("id", sourceId).single();
        taxable = Number(inv?.subtotal ?? 0); cgst = Number(inv?.cgst_total ?? 0); sgst = Number(inv?.sgst_total ?? 0); igst = Number(inv?.igst_total ?? 0);
      } else {
        const { data: bt } = await supabase.from("branch_transfers").select("subtotal, cgst_total, sgst_total, igst_total").eq("id", sourceId).single();
        taxable = Number(bt?.subtotal ?? 0); cgst = Number(bt?.cgst_total ?? 0); sgst = Number(bt?.sgst_total ?? 0); igst = Number(bt?.igst_total ?? 0);
      }

      const { data: wb, error } = await (supabase.from("waybills" as any) as any).insert({
        doc_number: docNumberRes.data,
        branch_id: branchId,
        source_type: sourceType,
        source_id: sourceId,
        source_number: sourceType === "invoice" ? src.invoice_number : src.transfer_number,
        status: "pending",
        transport_mode: transportMode,
        vehicle_no: null,
        distance_km: 0,
        transporter_name: transporterName || null,
        transporter_gstin: transporterGstin || null,
        from_gstin: branch?.gst_number ?? null,
        from_state_code: branch?.state_code ?? null,
        to_gstin: toGstin || null,
        to_state_code: toStateCode || null,
        taxable_value: taxable, cgst_total: cgst, sgst_total: sgst, igst_total: igst,
        doc_value: total,
      }).select("id").single();
      if (error) throw error;
      return wb.id as string;
    },
    onSuccess: (id) => {
      toast.success("Waybill draft created");
      setOpenNew(false);
      setSourceId(""); setVehicleNo(""); setDistance("");
      setTransporterId(""); setTransporterName(""); setTransporterGstin("");
      qc.invalidateQueries({ queryKey: ["waybills"] });
      generate.mutate(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async (waybill_id: string) => {
      const { data, error } = await supabase.functions.invoke("whitebooks-ewaybill", {
        body: { waybill_id, action: "generate" },
      });

      if (error) throw error;
      if ((data as any)?.error && !(data as any)?.recoverable) throw new Error(JSON.stringify((data as any).error));
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["waybills"] });
      if (data?.recoverable && data?.reason === "already_generated") {
        toast(data.error || "NIC already has an E-Way Bill for this document.", {
          duration: 12000,
          action: data?.waybill_id ? {
            label: "Attach #",
            onClick: () => attachEwb.mutate(data.waybill_id),
          } : undefined,
        });
        return;
      }
      toast.success(`E-Way Bill ${data.ewb_number}${data.stub ? " (stub mode)" : ""}`);
    },
    onError: (e: Error) => {
      const ex = explainEwbError(e.message);
      if (ex.codes.includes("604")) {
        toast(ex.friendly || "NIC already generated this E-Way Bill. Use Attach # to save the existing number.", {
          duration: 12000,
        });
        return;
      }
      toast.error(ex.friendly || ("Generate failed: " + e.message), { duration: 10000 });
    },
  });

  const attachEwb = useMutation({
    mutationFn: async (waybill_id: string) => {
      const ewb = prompt("Enter the EWB number shown on the NIC portal (12 digits):");
      if (!ewb) throw new Error("Cancelled");
      const clean = ewb.replace(/\D/g, "");
      if (clean.length < 10) throw new Error("EWB number must be at least 10 digits");
      const { error } = await supabase.from("waybills").update({
        ewb_number: clean,
        status: "generated",
        ewb_date: new Date().toISOString(),
        error_msg: null,
        generated_at: new Date().toISOString(),
      }).eq("id", waybill_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waybills"] });
      toast.success("EWB number attached");
    },
    onError: (e: Error) => { if (e.message !== "Cancelled") toast.error(e.message); },
  });

  const cancel = useMutation({
    mutationFn: async (waybill_id: string) => {
      const reason = prompt("Cancellation reason?", "Data entry error");
      if (!reason) throw new Error("Cancelled");
      const { data, error } = await supabase.functions.invoke("whitebooks-ewaybill", {
        body: { waybill_id, reason, action: "cancel" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waybills"] });
      toast.success("Waybill cancelled");
    },
    onError: (e: Error) => { if (e.message !== "Cancelled") toast.error(e.message); },
  });

  const filtered = (waybills as any[]).filter((w: any) => {
    const q = search.toLowerCase();
    return !q || w.doc_number?.toLowerCase().includes(q) || w.ewb_number?.toLowerCase?.().includes(q) || w.source_number?.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">E-Way Bill Log</h1>
            <p className="text-muted-foreground">NIC e-way bills issued from this branch</p>
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New E-Way Bill</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate New E-Way Bill</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Source</Label>
                    <Select value={sourceType} onValueChange={(v) => { setSourceType(v as any); setSourceId(""); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice">Tax Invoice</SelectItem>
                        <SelectItem value="branch_transfer">Branch Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Transport Mode</Label>
                    <Select value={transportMode} onValueChange={setTransportMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="road">Road</SelectItem>
                        <SelectItem value="rail">Rail</SelectItem>
                        <SelectItem value="air">Air</SelectItem>
                        <SelectItem value="ship">Ship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Document</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger><SelectValue placeholder="Pick a document…" /></SelectTrigger>
                    <SelectContent>
                      {(sources as any[]).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {sourceType === "invoice" ? `${s.invoice_number} — ₹${Number(s.total_amount).toLocaleString("en-IN")}` : `${s.transfer_number} — ₹${Number(s.total_amount).toLocaleString("en-IN")}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vehicle No <span className="text-destructive">*</span></Label>
                  <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} placeholder="TS09EE1234" required />
                  <p className="text-xs text-muted-foreground mt-1">Distance is auto-computed by NIC from dispatch & delivery pincodes.</p>
                </div>
                <div>
                  <Label>Transporter</Label>
                  <TransporterPicker
                    value={transporterId}
                    branchId={branchId}
                    onChange={(id, t: TransporterOption | null) => {
                      setTransporterId(id);
                      setTransporterName(t?.name || "");
                      setTransporterGstin(t?.gst_number || "");
                    }}
                  />
                </div>
                {branchMissing.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive">Branch is missing {branchMissing.join(" & ")}</p>
                      <p className="text-muted-foreground mt-0.5">
                        NIC will reject. Set it in <button type="button" onClick={() => navigate("/settings/company")} className="underline">Settings → Branches</button> (use Auto-fill from GSTIN).
                      </p>
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={() => createWb.mutate()} disabled={createWb.isPending || generate.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  {createWb.isPending || generate.isPending ? "Generating…" : "Create & Push to NIC"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search EWB / doc number" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isLoading ? <p className="text-center text-muted-foreground py-8">Loading…</p> : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">No e-way bills yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doc #</TableHead>
                    <TableHead>EWB #</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">{w.doc_number}</TableCell>
                      <TableCell className="font-mono">{w.ewb_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">{w.source_type === "invoice" ? "Invoice" : "Branch Tx"} • {w.source_number}</TableCell>
                      <TableCell className="text-xs">{w.vehicle_no || "—"}</TableCell>
                      <TableCell>₹{Number(w.doc_value).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={statusVariant[w.status] ?? "secondary"}>{w.status}</Badge>
                          {w.status === "failed" && w.error_msg && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="text-xs font-semibold mb-1">NIC error</p>
                                  <p className="text-xs whitespace-pre-wrap">{explainEwbError(w.error_msg).friendly || w.error_msg}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{w.valid_until ? new Date(w.valid_until).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(w.status === "pending" || w.status === "failed") && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => generate.mutate(w.id)}>
                                <Send className="h-3 w-3 mr-1" />Push
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => attachEwb.mutate(w.id)} title="Attach EWB number from NIC portal (use if NIC already generated it)">
                                Attach #
                              </Button>
                            </>
                          )}
                          {w.status === "generated" && (
                            <>
                              {w.source_type === "invoice" && (
                                <Button size="sm" variant="outline" onClick={() => navigate(`/sales/invoices/${w.source_id}/eway-bill`)}>
                                  <Printer className="h-3 w-3 mr-1" />Print
                                </Button>
                              )}
                              <Button size="sm" variant="outline" asChild>
                                <a href="https://ewaybillgst.gov.in" target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />NIC
                                </a>
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => cancel.mutate(w.id)}>
                                <XCircle className="h-3 w-3 mr-1" />Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
