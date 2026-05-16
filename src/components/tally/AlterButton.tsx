import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AlterButtonProps {
  onClick: () => void;
  size?: "icon" | "sm";
  label?: string;
}

/** Tally-style "Alter" trigger — admin only. Shows a disabled, tooltipped icon for non-admins. */
export function AlterButton({ onClick, size = "icon", label = "Alter" }: AlterButtonProps) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button variant="ghost" size={size === "icon" ? "icon" : "sm"} className={size === "icon" ? "h-8 w-8 opacity-40" : "opacity-40"} disabled aria-label="Alter (admin only)">
              <Pencil className="h-3.5 w-3.5" />
              {size !== "icon" && <span className="ml-1">{label}</span>}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Admin only</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      size={size === "icon" ? "icon" : "sm"}
      className={size === "icon" ? "h-8 w-8" : ""}
      onClick={onClick}
      aria-label={label}
    >
      <Pencil className="h-3.5 w-3.5" />
      {size !== "icon" && <span className="ml-1">{label}</span>}
    </Button>
  );
}
