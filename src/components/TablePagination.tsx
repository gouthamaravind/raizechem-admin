import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalFetched: number;
  onPrev: () => void;
  onNext: () => void;
}

export function TablePagination({ page, pageSize, totalFetched, onPrev, onNext }: TablePaginationProps) {
  const hasNext = totalFetched > pageSize; // We fetch pageSize+1 to detect more
  const start = page * pageSize + 1;
  const end = start + Math.min(totalFetched, pageSize) - 1;

  return (
    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
      <span>Showing {start}–{end}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4 mr-1" />Prev
        </Button>
        <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext}>
          Next<ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
