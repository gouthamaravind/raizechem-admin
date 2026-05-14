import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_ref: string | null;
  requested_by: string;
  approver_role: string;
  status: ApprovalStatus;
  notes: string | null;
  decision_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useApprovals(status?: ApprovalStatus | "all") {
  return useQuery({
    queryKey: ["approval_requests", status ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("approval_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ApprovalRequest[];
    },
  });
}

export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ["approval_requests", "pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useRequestApproval() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entity_type: string;
      entity_id: string;
      entity_ref?: string;
      approver_role?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("approval_requests").insert({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        entity_ref: input.entity_ref ?? null,
        approver_role: input.approver_role ?? "admin",
        notes: input.notes ?? null,
        requested_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval_requests"] });
      toast.success("Approval requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDecideApproval() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      decision: "approved" | "rejected";
      decision_notes?: string;
    }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: input.decision,
          decision_notes: input.decision_notes ?? null,
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
        } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["approval_requests"] });
      toast.success(vars.decision === "approved" ? "Approved" : "Rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
