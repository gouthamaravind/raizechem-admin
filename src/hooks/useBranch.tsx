import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Branch {
  id: string;
  branch_code: string;
  branch_name: string;
  gst_number: string | null;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  is_active: boolean;
  is_default: boolean;
}

interface BranchContextType {
  branches: Branch[];
  activeBranch: Branch | null;
  setActiveBranch: (branch: Branch) => void;
  branchId: string | null;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | null>(null);

const BRANCH_STORAGE_KEY = "raizechem_active_branch";

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);

  // Fetch all branches
  const { data: allBranches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as Branch[];
    },
    enabled: !!user,
  });

  // Fetch user's branch assignments (non-admin)
  const { data: userBranchIds = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["user-branches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_branches")
        .select("branch_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((ub) => ub.branch_id);
    },
    enabled: !!user && !isAdmin,
  });

  // Filter branches based on access
  const branches = isAdmin
    ? allBranches
    : allBranches.filter((b) => userBranchIds.includes(b.id));

  // Restore saved branch or pick default
  useEffect(() => {
    if (branches.length === 0 || activeBranch) return;
    const saved = localStorage.getItem(BRANCH_STORAGE_KEY);
    const savedBranch = saved ? branches.find((b) => b.id === saved) : null;
    const defaultBranch = savedBranch || branches.find((b) => b.is_default) || branches[0];
    if (defaultBranch) setActiveBranchState(defaultBranch);
  }, [branches, activeBranch]);

  const setActiveBranch = (branch: Branch) => {
    setActiveBranchState(branch);
    localStorage.setItem(BRANCH_STORAGE_KEY, branch.id);
  };

  return (
    <BranchContext.Provider
      value={{
        branches,
        activeBranch,
        setActiveBranch,
        branchId: activeBranch?.id || null,
        isLoading: branchesLoading || assignmentsLoading,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
