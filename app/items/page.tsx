"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TabNav from "@/app/components/TabNav";
import { JobOrder, JobOrderStatus, fmtDate } from "@/lib/jobOrders";

// Only JOs that have cleared approval are meaningful to search here - a
// draft or rejected JO doesn't have a settled item code / BOM to link to.
const VISIBLE_STATUSES: JobOrderStatus[] = ["approved", "acknowledged", "in_progress", "qc", "completed"];

export default function ItemsPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/job-orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setJobOrders(d.jobOrders ?? []));
  }, []);

  const rows = useMemo(() => {
    const visible = (jobOrders ?? []).filter((jo) => VISIBLE_STATUSES.includes(jo.status));
    const term = search.trim().toLowerCase();
    const filtered = term
      ? visible.filter((jo) =>
          jo.so_no.toLowerCase().includes(term) ||
          jo.item_no.toLowerCase().includes(term) ||
          fmtDate(jo.jo_date).includes(term)
        )
      : visible;
    return [...filtered].sort((a, b) => (a.jo_date < b.jo_date ? 1 : -1));
  }, [jobOrders, search]);

  return (
    <>
      <TabNav active="/items" />

      <div className="card">
        <h2>Item Codes</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Every item code used on an approved job order. Search by date, SO number, or item code, then open a
          row to see that job order's final BOM.
        </p>

        <input
          type="text"
          placeholder="Search by date, SO number, or item code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 14, maxWidth: 360 }}
        />

        {!jobOrders ? <p className="subtle">Loading...</p> : rows.length === 0 ? <p className="subtle">No matching item codes.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Description</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((jo) => (
                  <tr key={jo.id}>
                    <td>{fmtDate(jo.jo_date)}</td>
                    <td>{jo.so_no}</td>
                    <td>{jo.item_no}</td>
                    <td>{jo.item_description}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} href={`/production-manager/${jo.id}`}>
                        View JO
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
