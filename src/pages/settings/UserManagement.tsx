import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Shield, UserPlus } from "lucide-react";

const ALL_ROLES = ["admin", "sales", "accounts", "inventory", "warehouse", "fieldops"] as const;

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: string[];
}

interface CoverageRow {
  id: string;
  user_id: string;
  pincode: string;
  created_at: string;
}

function invoke(action: string, body: Record<string, unknown> = {}) {
  return supabase.functions.invoke("manage-users", {
    body: { action, ...body },
  });
}

export default function UserManagement() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const [form, setForm] = useState({ email: "", password: "", full_name: "", roles: [] as string[] });

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["manage-users"],
    queryFn: async () => {
      const { data, error } = await invoke("list");
      if (error) throw error;
      return data as UserRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await invoke("create", form);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-users"] });
      toast.success("Employee created");
      setForm({ email: "", password: "", full_name: "", roles: [] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Pincode coverage (employee_pincodes)
  const { data: coverages = [], isLoading: coveragesLoading } = useQuery<CoverageRow[]>({
    queryKey: ["employee-pincodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_pincodes")
        .select("id, user_id, pincode, created_at")
        .order("pincode", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [coverageForm, setCoverageForm] = useState<{ user_id: string; pincode: string }>({ user_id: "", pincode: "" });

  const addCoverage = useMutation({
    mutationFn: async () => {
      if (!coverageForm.user_id || !coverageForm.pincode) throw new Error("Select employee and enter pincode");
      const { error } = await supabase.from("employee_pincodes").insert({
        user_id: coverageForm.user_id,
        pincode: coverageForm.pincode.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-pincodes"] });
      qc.invalidateQueries({ queryKey: ["pincode-assignees"] });
      toast.success("Pincode assigned");
      setCoverageForm({ user_id: "", pincode: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCoverage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_pincodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-pincodes"] });
      qc.invalidateQueries({ queryKey: ["pincode-assignees"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Pincode lookup
  const [lookupPin, setLookupPin] = useState("");
  const { data: lookupAssignees = [], refetch: refetchLookup, isFetching: lookupLoading } = useQuery({
    queryKey: ["pincode-assignees", lookupPin],
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pincode_assignees", { p_pincode: lookupPin.trim() });
      if (error) throw error;
      return data || [];
    },
  });

  const rolesMutation = useMutation({
    mutationFn: async ({ user_id, roles }: { user_id: string; roles: string[] }) => {
      const { data, error } = await invoke("update_roles", { user_id, roles });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-users"] });
      toast.success("Roles updated");
      setEditUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = (role: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Create employee accounts and manage roles</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Employee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Create Employee Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Rahul Sharma" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@raizechem.in" />
                  <p className="text-xs text-muted-foreground">Must be @raizechem.in domain</p>
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input required type="password" minLength={6} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
                </div>
                <div className="space-y-2">
                  <Label>Roles</Label>
                  <div className="flex flex-wrap gap-3">
                    {ALL_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={form.roles.includes(role)} onCheckedChange={() => toggleRole(role, form.roles, (v) => setForm((f) => ({ ...f, roles: v })))} />
                        <span className="text-sm capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>Employees</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && <span className="text-muted-foreground text-xs">No roles</span>}
                          {u.roles.map((r) => (
                            <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize text-xs">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => { setEditUser(u); setEditRoles(u.roles); }}>
                          <Shield className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Roles Dialog */}
        <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Roles — {editUser?.full_name || editUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={editRoles.includes(role)} onCheckedChange={() => toggleRole(role, editRoles, setEditRoles)} />
                    <span className="text-sm capitalize">{role}</span>
                  </label>
                ))}
              </div>
              <Button className="w-full" disabled={rolesMutation.isPending} onClick={() => editUser && rolesMutation.mutate({ user_id: editUser.id, roles: editRoles })}>
                {rolesMutation.isPending ? "Saving..." : "Save Roles"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Coverage Assignment */}
        <Card>
          <CardHeader><CardTitle>Pincode Coverage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Employee</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={coverageForm.user_id}
                  onChange={(e) => setCoverageForm((f) => ({ ...f, user_id: e.target.value }))}
                >
                  <option value="">Select employee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Pincode</Label>
                <Input
                  value={coverageForm.pincode}
                  onChange={(e) => setCoverageForm((f) => ({ ...f, pincode: e.target.value }))}
                  placeholder="500001"
                  maxLength={6}
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={() => addCoverage.mutate()} disabled={addCoverage.isPending}>
                  {addCoverage.isPending ? "Assigning..." : "Assign Pincode"}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Pincode</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coveragesLoading ? (
                    <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>
                  ) : coverages.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground text-sm">No pincodes assigned yet</TableCell></TableRow>
                  ) : (
                    coverages.map((c) => {
                      const user = users.find((u) => u.id === c.user_id);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>{user?.full_name || user?.email || c.user_id}</TableCell>
                          <TableCell>{c.pincode}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => deleteCoverage.mutate(c.id)} disabled={deleteCoverage.isPending}>
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pincode Lookup */}
        <Card>
          <CardHeader><CardTitle>Find Assignee by Pincode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input
                className="md:w-64"
                placeholder="Enter pincode"
                value={lookupPin}
                onChange={(e) => setLookupPin(e.target.value)}
                maxLength={6}
              />
              <Button type="button" onClick={() => refetchLookup()} disabled={!lookupPin || lookupLoading}>
                {lookupLoading ? "Searching..." : "Lookup"}
              </Button>
            </div>
            {lookupAssignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lookupAssignees.map((a: any) => (
                  <Badge key={a.user_id} variant="secondary" className="flex items-center gap-2 text-xs">
                    <Shield className="h-3 w-3" /> {a.full_name || a.user_id} · {a.pincode}
                  </Badge>
                ))}
              </div>
            ) : (
              !!lookupPin && !lookupLoading && <p className="text-sm text-muted-foreground">No assignees for {lookupPin}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
