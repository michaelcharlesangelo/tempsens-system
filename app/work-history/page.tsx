"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import TruncatedText from "@/app/components/TruncatedText";
import { JobOrder, JobOrderStatus, joMatchesSearch, fmtDate, formatSerialRange } from "@/lib/jobOrders";

// Work History is the finished record, not a work-in-progress tracker -
// only JOs that have actually finished production show up here. Their
// detail page (/production-manager/[id]) already goes read-only/print-view
// automatically once status is "completed", so linking there is safe.
const VISIBLE_STATUSES: JobOrderStatus[] = ["completed"];

type SortCol = "jo_date" | "so_no" | "customer_name" | "item_no" | "item_description" | "quantity";

export default function WorkHistoryPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("jo_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/job-orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setJobOrders(d.jobOrders ?? []));
  }, []);

  function sortBy(col: SortCol) {
    if (sortCol === col) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortCol(col);
    setSortDir("asc");
  }

  const sorted = useMemo(() => {
    const visible = (jobOrders ?? []).filter((jo) => VISIBLE_STATUSES.includes(jo.status));
    return [...visible].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [jobOrders, sortCol, sortDir]);

  const { search, setSearch, page, setPage, totalPages, pageItems: rows, totalCount } = usePagedSearch(sorted, joMatchesSearch);

  function SortHeader({ col, children }: { col: SortCol; children: ReactNode }) {
    return (
      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy(col)}>
        {children} {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <>
      <div className="card">
        <h2>Work History</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Every item code used on a finished job order. Search by date, SO number, or item code, then open a
          row to see that job order's final BOM (read-only, print view).
        </p>

        <SearchBox value={search} onChange={setSearch} />

        {!jobOrders ? <p className="subtle">Loading...</p> : totalCount === 0 ? <p className="subtle">No matching item codes.</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader col="jo_date">JO Date</SortHeader>
                    <SortHeader col="so_no">SO Number</SortHeader>
                    <SortHeader col="customer_name">Customer Name</SortHeader>
                    <SortHeader col="item_no">Item Code</SortHeader>
                    <SortHeader col="item_description">Description</SortHeader>
                    <SortHeader col="quantity">Qty</SortHeader>
                    <th>Serial Number(s)</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((jo) => {
                    const serialLabel = formatSerialRange(jo.serial_numbers ?? []);
                    return (
                    <tr key={jo.id}>
                      <td>{fmtDate(jo.jo_date)}</td>
                      <td>{jo.so_no}</td>
                      <td>{jo.customer_name}</td>
                      <td>{jo.item_no}</td>
                      <td><TruncatedText text={jo.item_description} /></td>
                      <td>{jo.quantity}</td>
                      <td>{serialLabel === "-" ? <span className="subtle">-</span> : serialLabel}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Link className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} href={`/production-manager/${jo.id}`}>
                          View JO
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
