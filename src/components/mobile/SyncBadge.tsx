import { CloudOff } from "lucide-react";

export function SyncBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 bg-warning text-warning-foreground px-3 py-1.5 rounded-full text-xs font-medium">
      <CloudOff className="h-3.5 w-3.5" />
      <span>{count} sync pending</span>
    </div>
  );
}
