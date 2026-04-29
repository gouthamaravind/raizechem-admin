import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface EmployeeProfile {
  user_id: string;
  name: string | null;
}

interface CoverageRow {
  id: string;
  user_id: string;
  pincode: string;
  created_at: string;
  profiles?: { full_name?: string | null } | null;
  employee_profiles?: { name?: string | null } | null;
}

interface LookupAssigneeRow {
  user_id: string;
  full_name?: string | null;
  pincode: string;
}

export default function PincodeCoverage() {
  const qc = useQueryClient();
  const [pincodeFilter, setPincodeFilter] = useState("");
  const [lookupPin, setLookupPin] = useState("");
  const [form, setForm] = useState<{ user_id: string; pincode: string }>({ user_id: "", pincode: "" });

  const { data: employees = [] } = useQuery<EmployeeProfile[]>({
    queryKey: ["employee-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_profiles").select("user_id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: coverages = [], isLoading } = useQuery<CoverageRow[]>({
    queryKey: ["employee-pincodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_pincodes")
        .select("id, user_id, pincode, created_at, profiles(full_name), employee_profiles(name)")
        .order("pincode", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredCoverages = useMemo(() => {
    const pin = pincodeFilter.trim();
    if (!pin) return coverages;
    return coverages.filter((c) => c.pincode.includes(pin));
  }, [coverages, pincodeFilter]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.user_id || !form.pincode) throw new Error("Select employee and enter pincode");
      const { error } = await supabase.from("employee_pincodes").insert({ user_id: form.user_id, pincode: form.pincode.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-pincodes"] });
      qc.invalidateQueries({ queryKey: ["pincode-assignees"] });
      toast.success("Pincode assigned");
      setForm({ user_id: "", pincode: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_pincodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-pincodes"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: lookup = [], refetch: refetchLookup, isFetching: lookupLoading } = useQuery<LookupAssigneeRow[]>({
    queryKey: ["pincode-assignees", lookupPin],
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc<LookupAssigneeRow[]>(
        "get_pincode_assignees",
        { p_pincode: lookupPin.trim() }
      );
      if (error) throw error;
      return data || [];
    },
  });

  const employeeName = (userId: string) => {
    const emp = employees.find((e) => e.user_id === userId);
    return emp?.name || userId.slice(0, 8);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pincode Coverage</h1>
            <p className="text-muted-foreground">Assign field reps to pincodes for routing and filtering.</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Assign Pincode</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Employee</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.user_id}
                  onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.user_id} value={e.user_id}>{e.name || e.user_id}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Pincode</label>
                <Input value={form.pincode} maxLength={6} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} placeholder="500001" />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Assigning..." : "Assign"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assignments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 w-48" placeholder="Filter by pincode" value={pincodeFilter} onChange={(e) => setPincodeFilter(e.target.value)} />
              </div>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pincode</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>
                  ) : filteredCoverages.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground text-sm">No assignments</TableCell></TableRow>
                  ) : (
                    filteredCoverages.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.employee_profiles?.name || c.profiles?.full_name || employeeName(c.user_id)}</TableCell>
                        <TableCell>{c.pincode}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lookup by Pincode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input className="md:w-48" placeholder="Enter pincode" maxLength={6} value={lookupPin} onChange={(e) => setLookupPin(e.target.value)} />
              <Button onClick={() => refetchLookup()} disabled={!lookupPin || lookupLoading}>{lookupLoading ? "Searching..." : "Lookup"}</Button>
            </div>
            {lookup.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lookup.map((a) => (
                  <Badge key={a.user_id} variant="secondary" className="text-xs">
                    {a.full_name || a.user_id} · {a.pincode}
                  </Badge>
                ))}
              </div>
            ) : !!lookupPin && !lookupLoading ? (
              <p className="text-sm text-muted-foreground">No assignees for {lookupPin}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
