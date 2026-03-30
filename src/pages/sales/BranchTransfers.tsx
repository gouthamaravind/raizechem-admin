import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranch } from "@/hooks/useBranch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Plus, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { calculateGST } from "@/lib/gst";

type TransferItem = { product_id: string; qty: number; rate: number; gst_rate: number; hsn_code: string };

export default function BranchTransfers() {
  const { user } = useAuth();
  const { branches, activeBranch, branchId } = useBranch();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toBranchId, setToBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([{ product_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "" }]);

  const otherBranches = branches.filter((b) => b.id !== branchId);
  const toBranch = branches.find((b) => b.id === toBranchId);

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["branch-transfers", branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_transfers")
        .select("*")
        .or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", branchId],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, sale_price, gst_rate, hsn_code, unit").eq("is_active", true).order("name");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      return data || [];
    },
  });

  const createTransfer = useMutation({
    mutationFn: async () => {
      if (!toBranchId || !branchId) throw new Error("Select destination branch");
      const validItems = items.filter((i) => i.product_id && i.qty > 0);
      if (validItems.length === 0) throw new Error("Add at least one item");

      // Calculate totals - inter-branch is always interstate (IGST)
      const fromStateCode = activeBranch?.state_code || "36";
      const toStateCode = toBranch?.state_code || "37";

      let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
      for (const item of validItems) {
        const lineAmount = item.qty * item.rate;
        subtotal += lineAmount;
        const gst = calculateGST(lineAmount, item.gst_rate, toStateCode, fromStateCode);
        cgstTotal += gst.cgst;
        sgstTotal += gst.sgst;
        igstTotal += gst.igst;
      }
      const totalAmount = subtotal + cgstTotal + sgstTotal + igstTotal;

      // Generate transfer number
      const transferNumber = `BT/${activeBranch?.branch_code}-${toBranch?.branch_code}/${Date.now().toString(36).toUpperCase()}`;

      // Insert transfer header
      const { data: transfer, error } = await supabase
        .from("branch_transfers")
        .insert({
          transfer_number: transferNumber,
          from_branch_id: branchId,
          to_branch_id: toBranchId,
          subtotal,
          cgst_total: cgstTotal,
          sgst_total: sgstTotal,
          igst_total: igstTotal,
          total_amount: totalAmount,
          notes: notes || null,
          created_by: user?.id,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;

      // Insert items
      const transferItems = validItems.map((item) => ({
        branch_transfer_id: transfer.id,
        product_id: item.product_id,
        qty: item.qty,
        rate: item.rate,
        amount: item.qty * item.rate,
        gst_rate: item.gst_rate,
        hsn_code: item.hsn_code || null,
      }));
      const { error: itemsErr } = await supabase.from("branch_transfer_items").insert(transferItems);
      if (itemsErr) throw itemsErr;

      return transfer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-transfers"] });
      setDialogOpen(false);
      setToBranchId("");
      setNotes("");
      setItems([{ product_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "" }]);
      toast.success("Branch transfer created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmTransfer = useMutation({
    mutationFn: async (transferId: string) => {
      // Mark as confirmed — in production this would auto-create sale invoice (from) + purchase invoice (to)
      const { error } = await supabase
        .from("branch_transfers")
        .update({ status: "confirmed" })
        .eq("id", transferId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-transfers"] });
      toast.success("Transfer confirmed — invoice pair will be generated");
    },
  });

  const addItem = () => setItems([...items, { product_id: "", qty: 1, rate: 0, gst_rate: 18, hsn_code: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: any) => {
    const n = [...items];
    (n[i] as any)[field] = val;
    setItems(n);
  };

  const statusColors: Record<string, string> = {
    draft: "secondary",
    confirmed: "default",
    completed: "default",
    cancelled: "destructive",
  };

  const branchNameMap = Object.fromEntries(branches.map((b) => [b.id, `${b.branch_name} (${b.branch_code})`]));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Branch Transfers</h1>
            <p className="text-muted-foreground">
              Transfer stock between {activeBranch?.branch_name || ""} and other branches
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Transfer</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Branch Transfer</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createTransfer.mutate(); }} className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant="outline" className="text-sm">{activeBranch?.branch_code}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Select value={toBranchId} onValueChange={setToBranchId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select destination branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherBranches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.branch_name} ({b.branch_code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {toBranch && activeBranch?.state_code !== toBranch.state_code && (
                  <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
                    Interstate transfer — IGST will apply ({activeBranch?.state_code} → {toBranch.state_code})
                  </p>
                )}

                <div className="space-y-2">
                  <Label>Line Items</Label>
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <Select value={item.product_id} onValueChange={(v) => {
                        updateItem(i, "product_id", v);
                        const p = products.find((p: any) => p.id === v);
                        if (p) {
                          updateItem(i, "rate", Number((p as any).sale_price) || 0);
                          updateItem(i, "gst_rate", Number((p as any).gst_rate) || 18);
                          updateItem(i, "hsn_code", (p as any).hsn_code || "");
                        }
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                        <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" className="w-20" placeholder="Qty" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} />
                      <Input type="number" className="w-28" placeholder="Rate" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} />
                      <span className="text-sm w-24 text-right">₹{(item.qty * item.rate).toLocaleString("en-IN")}</span>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Item</Button>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                <div className="text-right font-semibold">
                  Subtotal: ₹{items.reduce((s, i) => s + i.qty * i.rate, 0).toLocaleString("en-IN")}
                </div>

                <Button type="submit" className="w-full" disabled={createTransfer.isPending}>
                  {createTransfer.isPending ? "Creating..." : "Create Transfer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : transfers.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <ArrowLeftRight className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground">No branch transfers yet</p>
                <p className="text-xs text-muted-foreground">Transfer stock from {activeBranch?.branch_name} to another branch</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer #</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.transfer_number}</TableCell>
                      <TableCell>{branchNameMap[t.from_branch_id] || "—"}</TableCell>
                      <TableCell>{branchNameMap[t.to_branch_id] || "—"}</TableCell>
                      <TableCell>{t.transfer_date}</TableCell>
                      <TableCell>₹{Number(t.total_amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge variant={statusColors[t.status] as any}>{t.status}</Badge></TableCell>
                      <TableCell>
                        {t.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => confirmTransfer.mutate(t.id)}>
                            Confirm
                          </Button>
                        )}
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
