import { LogOut, Search, Bell, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";

export function TopBar() {
  const { profile, userRoles, signOut } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8 w-64 h-9 bg-muted/50 border-0" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Demo Mode Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border">
          <FlaskConical className={`h-3.5 w-3.5 ${isDemoMode ? "text-primary" : "text-muted-foreground"}`} />
          <Label htmlFor="demo-toggle" className="text-xs font-medium cursor-pointer select-none">Demo</Label>
          <Switch id="demo-toggle" checked={isDemoMode} onCheckedChange={toggleDemoMode} className="scale-75" />
        </div>

        {isDemoMode && (
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5 animate-pulse">
            Mock Data
          </Badge>
        )}

        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{profile?.full_name || "User"}</p>
            <div className="flex gap-1 mt-1 justify-end">
              {userRoles.map((role) => (
                <Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
