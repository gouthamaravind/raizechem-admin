import { useState } from "react";
import { LogOut, Search, Bell, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeTour } from "@/components/WelcomeTour";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { CommandSearch } from "@/components/CommandSearch";
import { NotificationsPopover } from "@/components/NotificationsPopover";

export function TopBar() {
  const { profile, userRoles, signOut } = useAuth();
  const [tourOpen, setTourOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-14 border-b glass flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 h-9 w-64 rounded-lg border border-border/50 bg-background/50 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <BranchSwitcher />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setTourOpen(true)}>
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Product Tour</TooltipContent>
        </Tooltip>

        <NotificationsPopover />

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{profile?.full_name || "User"}</p>
            {userRoles.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1 capitalize">
                {userRoles[0]}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <WelcomeTour open={tourOpen} onOpenChange={setTourOpen} />
    </header>
  );
}
