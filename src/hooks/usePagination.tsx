import { useState, useCallback } from "react";

const DEFAULT_PAGE_SIZE = 50;

export function usePagination(pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);

  const range = {
    from: page * pageSize,
    to: (page + 1) * pageSize - 1,
  };

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const resetPage = useCallback(() => setPage(0), []);

  return { page, pageSize, range, nextPage, prevPage, resetPage, setPage };
}
