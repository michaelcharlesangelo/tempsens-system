"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import SubmittedJobOrders from "@/app/components/SubmittedJobOrders";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { JobOrder, joMatchesSearch, fmtDate } from "@/lib/jobOrders";

export default function SalesSupportSupervisorPage() {
  const [completed, setCompleted] = useState<JobOrder[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/job-orders?status=completed&tab=sales-support-supervisor", { cache: "no-store" });
    const data = await res.json();
    setCompleted(data.jobOrders ?? []);
  }

  useEffect(() => { load(); }, []);

  async function markCosted(jo: JobOrder) {
    if (!confirm(`Mark ${jo.jo_number} as costing finished? This can't be undone.`)) return;
    setSaving(jo.id);
    try {
      const res = await fetch(`/api/job-orders/${jo.id}/details`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costingDone: true }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to update."); return; }
      load();
    } finally {
      setSaving(null);
    }
  }

  const toBeCosting = (completed ?? []).filter((jo) => !jo.costing_done);
  const finishedCosting = (completed ?? []).filter((jo) => jo.costing_done);

  const toBeCostingPaged = usePagedSearch(toBeCosting, joMatchesSearch);
  const finishedCostingPaged = usePagedSearch(finishedCosting, joMatchesSearch);

  return (
    <>
      <TabNav active="/sales-support-supervisor" />
      <SubmittedJobOrders tab="sales-support-supervisor" by="Sales Support Supervisor" />

      {message && <div className="warn">{message}</div>}

      <div className="card">
        <h2>Job Orders To Be Costing ({toBeCosting.length})</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Ready items from production, waiting on costing in the separate costing system.
        </p>
        {!completed ? <p className="subtle">Loading...</p> : toBeCosting.length === 0 ? <p className="subtle">None right now.</p> : (
          <>
            <SearchBox value={toBeCostingPaged.search} onChange={toBeCostingPaged.setSearch} />
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Customer</th><th>Item Description</th><th>Qty</th><th>Costing</th></tr></thead>
                <tbody>
                  {toBeCostingPaged.pageItems.map((jo) => (
                    <tr key={jo.id}>
                      <td>{fmtDate(jo.jo_date)}</td>
                      <td>{jo.so_no}</td>
                      <td>{jo.item_no}</td>
                      <td>{jo.customer_name}</td>
                      <td>{jo.item_description}</td>
                      <td>{jo.quantity}</td>
                      <td style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={false} disabled={saving === jo.id} onChange={() => markCosted(jo)} style={{ width: "auto" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={toBeCostingPaged.page} totalPages={toBeCostingPaged.totalPages} totalCount={toBeCostingPaged.totalCount} onChange={toBeCostingPaged.setPage} />
          </>
        )}
      </div>

      <div className="card">
        <h2>Job Order Finish Costing ({finishedCosting.length})</h2>
        {!completed ? <p className="subtle">Loading...</p> : finishedCosting.length === 0 ? <p className="subtle">None yet.</p> : (
          <>
            <SearchBox value={finishedCostingPaged.search} onChange={finishedCostingPaged.setSearch} />
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Customer</th><th>Item Description</th><th>Qty</th></tr></thead>
                <tbody>
                  {finishedCostingPaged.pageItems.map((jo) => (
                    <tr key={jo.id}>
                      <td>{fmtDate(jo.jo_date)}</td>
                      <td>{jo.so_no}</td>
                      <td>{jo.item_no}</td>
                      <td>{jo.customer_name}</td>
                      <td>{jo.item_description}</td>
                      <td>{jo.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={finishedCostingPaged.page} totalPages={finishedCostingPaged.totalPages} totalCount={finishedCostingPaged.totalCount} onChange={finishedCostingPaged.setPage} />
          </>
        )}
      </div>
    </>
  );
}
