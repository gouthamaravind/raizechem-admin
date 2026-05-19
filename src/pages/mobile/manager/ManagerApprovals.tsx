import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type FO = {
  id: string;
  dealer_id: string;
  status: string;
  notes: string | null;
  manager_approval_status: string;
  created_at: string;
  approved_order_id: string | null;
  dealer?: { name?: string | null } | null;
  items?: { id: string; qty: number; expected_rate: number; product?: { name: string } | null }[];
};

export default function ManagerApprovals() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [items, setItems] = useState<FO[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<FO | null>(null);
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("field_orders")
      .select("id, dealer_id, status, notes, manager_approval_status, created_at, approved_order_id, dealer:dealers(name), items:field_order_items(id, qty, expected_rate, product:products(name))")
      .eq("manager_approval_status", tab)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      if (mode === "approve") {
        const { data, error } = await supabase.rpc("approve_field_order_atomic", {
          p_field_order_id: target.id, p_notes: notes || null,
        });
        if (error) throw error;
        toast.success(`Approved → Order created`);
      } else {
        if (!notes.trim()) { toast.error("Reason required"); setBusy(false); return; }
        const { error } = await supabase.rpc("reject_field_order", {
          p_field_order_id: target.id, p_reason: notes,
        });
        if (error) throw error;
        toast.success("Rejected");
      }
      setTarget(null); setNotes(""); load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setBusy(false); }
  };

  const open = (fo: FO, m: "approve" | "reject") => { setTarget(fo); setMode(m); setNotes(""); };

  return (
    <MobileLayout title="Approvals">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No {tab} field orders.</p>
          ) : items.map((fo) => {
            const total = (fo.items || []).reduce((s, i) => s + i.qty * i.expected_rate, 0);
            return (
              <Card key={fo.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{fo.dealer?.name || "Dealer"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(fo.created_at), "dd MMM yyyy, HH:mm")}</p>
                    </div>
                    <Badge variant={tab === "pending" ? "default" : tab === "approved" ? "secondary" : "destructive"}>
                      {fo.manager_approval_status}
                    </Badge>
                  </div>
                  {fo.items && fo.items.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
                      {fo.items.slice(0, 5).map((i) => (
                        <div key={i.id} className="flex justify-between text-xs">
                          <span className="truncate">{i.product?.name || "Product"}</span>
                          <span className="text-muted-foreground">{i.qty} × ₹{i.expected_rate}</span>
                        </div>
                      ))}
                      {fo.items.length > 5 && <p className="text-xs text-muted-foreground">+{fo.items.length - 5} more</p>}
                      <div className="flex justify-between border-t pt-1 text-xs font-semibold">
                        <span>Total</span><span>₹{total.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  {fo.notes && <p className="text-xs text-muted-foreground italic">{fo.notes}</p>}
                  {tab === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => open(fo, "approve")}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => open(fo, "reject")}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <Sheet open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{mode === "approve" ? "Approve order" : "Reject order"}</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {mode === "approve" ? "Notes (optional)" : "Reason (required)"}
            </label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <SheetFooter>
            <Button onClick={submit} disabled={busy} className="w-full">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "approve" ? "Approve & create order" : "Reject"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </MobileLayout>
  );
}
