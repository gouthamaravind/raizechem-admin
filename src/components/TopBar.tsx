import { useState } from "react";
import { LogOut, Search, Bell, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeTour } from "@/components/WelcomeTour";

export function TopBar() {
  const { profile, userRoles, signOut } = useAuth();
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <header className="h-14 border-b glass flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8 w-64 h-9 bg-background/50 border-border/50 rounded-lg" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setTourOpen(true)}>
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Product Tour</TooltipContent>
        </Tooltip>

        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
          <Bell className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">Yashwanth Reddy</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1">Director</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <WelcomeTour open={tourOpen} onOpenChange={setTourOpen} />
    </header>
  );
}
