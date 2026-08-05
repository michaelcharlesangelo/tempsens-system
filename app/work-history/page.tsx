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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type SortCol = "jo_date" | "so_no" | "customer_name" | "item_no" | "item_description" | "quantity";

interface CategoryTotal { category: string; qty: number; }
interface ItemCategory { name: string; }

export default function WorkHistoryPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [sortCol, setSortCol] = useState<SortCol>("jo_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // "" (All) for month - both the table and the production bar graph below
  // are recapped by this same year/month selection, keyed off finish_date
  // (when the JO actually completed), matching how the production totals
  // are already defined on Dashboard.
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | "">("");

  useEffect(() => {
    fetch("/api/job-orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setJobOrders(d.jobOrders ?? []));
    fetch("/api/item-categories", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  function sortBy(col: SortCol) {
    if (sortCol === col) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortCol(col);
    setSortDir("asc");
  }

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    (jobOrders ?? []).forEach((jo) => {
      if (jo.finish_date) years.add(new Date(jo.finish_date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [jobOrders]);

  function inSelectedPeriod(jo: JobOrder): boolean {
    if (!jo.finish_date) return false;
    const d = new Date(jo.finish_date);
    if (d.getFullYear() !== selectedYear) return false;
    if (selectedMonth !== "" && d.getMonth() !== selectedMonth) return false;
    return true;
  }

  const sorted = useMemo(() => {
    const visible = (jobOrders ?? []).filter((jo) => VISIBLE_STATUSES.includes(jo.status) && inSelectedPeriod(jo));
    return [...visible].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOrders, sortCol, sortDir, selectedYear, selectedMonth]);

  const yearlyByCategory: CategoryTotal[] = useMemo(() => {
    const byCategory = new Map<string, number>();
    categories.forEach((c) => byCategory.set(c.name, 0));
    (jobOrders ?? []).forEach((jo) => {
      if (jo.status !== "completed" || !inSelectedPeriod(jo)) return;
      const cat = jo.item_category || "Uncategorized";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(jo.quantity));
    });
    return Array.from(byCategory.entries()).map(([category, qty]) => ({ category, qty }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOrders, categories, selectedYear, selectedMonth]);

  const periodLabel = `${selectedYear}${selectedMonth !== "" ? ` ${MONTH_NAMES[selectedMonth]}` : ""}`;

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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <span className="subtle" style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase" }}>Period</span>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: "auto", fontSize: "0.85rem" }}>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value === "" ? "" : Number(e.target.value))} style={{ width: "auto", fontSize: "0.85rem" }}>
            <option value="">All Months</option>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>

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

      <div className="card">
        <h2>{periodLabel} Production</h2>
        {yearlyByCategory.length === 0 ? <p className="subtle">No item categories set up yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(() => {
              const total = yearlyByCategory.reduce((n, c) => n + c.qty, 0) || 1;
              return yearlyByCategory.map((c) => {
                const share = c.qty / total;
                return (
                  <div key={c.category} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{c.category}</div>
                    <div style={{ background: "var(--panel-muted)", borderRadius: 6, height: 20, overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(share * 100, c.qty > 0 ? 2 : 0)}%`, height: "100%", background: "var(--accent)", borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: "0.82rem", textAlign: "right" }}>{c.qty} pcs</div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </>
  );
}
