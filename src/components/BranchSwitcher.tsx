import { useBranch } from "@/hooks/useBranch";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const branchColors: Record<string, string> = {
  TG: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  AP: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export function BranchSwitcher() {
  const { branches, activeBranch, setActiveBranch } = useBranch();

  if (branches.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-2.5 font-medium border-border/60",
            activeBranch && branchColors[activeBranch.branch_code]
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{activeBranch?.branch_name}</span>
          <span className="sm:hidden">{activeBranch?.branch_code}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => setActiveBranch(branch)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  branch.branch_code === "TG" ? "bg-amber-500" : "bg-blue-500"
                )}
              />
              <span>{branch.branch_name}</span>
              <span className="text-xs text-muted-foreground">({branch.branch_code})</span>
            </div>
            {activeBranch?.id === branch.id && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
