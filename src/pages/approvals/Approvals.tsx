import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ShieldCheck, Check, X, Inbox } from "lucide-react";
import { useApprovals, useDecideApproval, type ApprovalRequest, type ApprovalStatus } from "@/hooks/useApprovals";

const STATUS_COLORS: Record<ApprovalStatus, "default" | "secondary" | "destructive"> = {
  pending: "default",
  approved: "secondary",
  rejected: "destructive",
};

export default function Approvals() {
  const [tab, setTab] = useState<ApprovalStatus | "all">("pending");
  const { data: items = [], isLoading } = useApprovals(tab);
  const decide = useDecideApproval();
  const [target, setTarget] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [notes, setNotes] = useState("");

  const open = (req: ApprovalRequest, d: "approved" | "rejected") => {
    setTarget(req);
    setDecision(d);
    setNotes("");
  };

  const submit = async () => {
    if (!target) return;
    await decide.mutateAsync({ id: target.id, decision, decision_notes: notes || undefined });
    setTarget(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Approvals
          </h1>
          <p className="text-muted-foreground">
            Review and decide on requests raised across orders, invoices, and master changes.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" /> Requests ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No requests in this view.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Approver</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[160px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">
                            {format(new Date(r.created_at), "dd MMM, hh:mm a")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{r.entity_type.replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.entity_ref || r.entity_id.slice(0, 8)}</TableCell>
                          <TableCell className="capitalize text-sm">{r.approver_role}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">
                            {r.notes || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_COLORS[r.status]} className="capitalize">{r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === "pending" ? (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="default" onClick={() => open(r, "approved")}>
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => open(r, "rejected")}>
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {r.decided_at ? format(new Date(r.decided_at), "dd MMM") : "—"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="capitalize">
                {decision === "approved" ? "Approve" : "Reject"} request
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <span className="capitalize">{target?.entity_type.replace(/_/g, " ")}</span> ·{" "}
                <span className="font-mono">{target?.entity_ref || target?.entity_id.slice(0, 8)}</span>
              </div>
              <div className="space-y-2">
                <Label>Decision notes {decision === "rejected" && "*"}</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={decision === "approved" ? "Optional remarks" : "Reason for rejection"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
              <Button
                variant={decision === "approved" ? "default" : "destructive"}
                disabled={decide.isPending || (decision === "rejected" && !notes)}
                onClick={submit}
              >
                {decide.isPending ? "Saving…" : `Confirm ${decision}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
