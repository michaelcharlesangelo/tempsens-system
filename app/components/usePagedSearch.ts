import { useMemo, useState } from "react";

// Shared paging (10/page) + search behavior for every list table in the
// app - one hook per table instance, so tables on the same page (e.g.
// Pending / Approved / Rejected) page independently.
export function usePagedSearch<T>(items: T[], matches: (item: T, term: string) => boolean, pageSize = 10) {
  const [search, setSearchRaw] = useState("");
  const [page, setPage] = useState(1);

  function setSearch(value: string) {
    setSearchRaw(value);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((i) => matches(i, term)) : items;
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  return { search, setSearch, page: safePage, setPage, totalPages, pageItems, totalCount: filtered.length };
}
