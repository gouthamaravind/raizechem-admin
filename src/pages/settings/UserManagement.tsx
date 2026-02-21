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

const ALL_ROLES = ["admin", "sales", "accounts", "inventory", "warehouse"] as const;

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: string[];
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
      </div>
    </DashboardLayout>
  );
}
