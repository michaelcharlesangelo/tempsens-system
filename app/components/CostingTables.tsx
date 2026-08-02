"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import TruncatedText from "@/app/components/TruncatedText";
import { JobOrder, JobOrderHistoryEntry, joMatchesSearch, fmtDate, fmtDateTime } from "@/lib/jobOrders";

// Shared between Sales Support (finish-costing-only) and Sales Support
// Supervisor (both tables) - same underlying data regardless of who's
// looking, since costing isn't scoped per-person.
export default function CostingTables({
  tab, includeToBeCosting = true, filterBySubmitter,
}: { tab: string; includeToBeCosting?: boolean; filterBySubmitter?: string }) {
  const [completed, setCompleted] = useState<JobOrder[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/job-orders?status=completed&tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    const all: JobOrder[] = data.jobOrders ?? [];
    // `tab` above only gates PO visibility, not who submitted it - filter
    // client-side the same way SubmittedJobOrders scopes "mine" until real
    // per-account login exists.
    setCompleted(filterBySubmitter ? all.filter((jo) => jo.sales_support_name === filterBySubmitter) : all);
  }

  useEffect(() => { load(); }, [tab]);

  async function viewFile(id: string, type: "drawing" | "po") {
    const res = await fetch(`/api/job-orders/${id}/file?type=${type}&tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Can't open file."); return; }
    window.open(data.url, "_blank");
  }

  async function markCosted(jo: JobOrder) {
    if (!confirm(`Mark SO ${jo.so_no} as costing finished? This can't be undone.`)) return;
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

  function FileCells({ jo }: { jo: JobOrder }) {
    return (
      <>
        <td><button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewFile(jo.id, "drawing")}>View</button></td>
        <td><button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewFile(jo.id, "po")}>View</button></td>
        <td><a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }}>JO →</a></td>
      </>
    );
  }

  function CommentsCell({ jo }: { jo: JobOrder }) {
    const commented = (jo.history ?? []).filter((h) => h.comment);
    return (
      <td>
        <button
          className="btn secondary"
          style={{ fontSize: "0.72rem", padding: "3px 8px" }}
          onClick={() => setHistoryOpenId(historyOpenId === jo.id ? null : jo.id)}
          disabled={commented.length === 0}
        >
          {historyOpenId === jo.id ? "Hide" : `View (${commented.length})`}
        </button>
      </td>
    );
  }

  function CommentsRow({ jo, colSpan }: { jo: JobOrder; colSpan: number }) {
    const commented = (jo.history ?? []).filter((h) => h.comment);
    if (historyOpenId !== jo.id || commented.length === 0) return null;
    return (
      <tr>
        <td colSpan={colSpan} style={{ background: "var(--panel-muted)" }}>
          {commented.map((h: JobOrderHistoryEntry) => (
            <div key={h.id} style={{ fontSize: "0.82rem", padding: "4px 0" }}>
              <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
            </div>
          ))}
        </td>
      </tr>
    );
  }

  return (
    <>
      {message && <div className="warn">{message}</div>}

      {includeToBeCosting && (
        <Collapsible title="Job Orders To Be Costing" count={toBeCosting.length}>
          <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
            Ready items from production, waiting on costing in the separate costing system.
          </p>
          {!completed ? <p className="subtle">Loading...</p> : toBeCosting.length === 0 ? <p className="subtle">None right now.</p> : (
            <>
              <SearchBox value={toBeCostingPaged.search} onChange={toBeCostingPaged.setSearch} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Customer Name</th><th>Item Description</th><th>Qty</th><th>Drawing</th><th>PO</th><th>Job Order</th><th>Comments</th><th>Costing</th></tr></thead>
                  <tbody>
                    {toBeCostingPaged.pageItems.map((jo) => (
                      <Fragment key={jo.id}>
                        <tr>
                          <td>{fmtDate(jo.jo_date)}</td>
                          <td>{jo.so_no}</td>
                          <td>{jo.item_no}</td>
                          <td>{jo.customer_name}</td>
                          <td><TruncatedText text={jo.item_description} /></td>
                          <td>{jo.quantity}</td>
                          <FileCells jo={jo} />
                          <CommentsCell jo={jo} />
                          <td style={{ textAlign: "center" }}>
                            <input type="checkbox" checked={false} disabled={saving === jo.id} onChange={() => markCosted(jo)} style={{ width: "auto" }} />
                          </td>
                        </tr>
                        <CommentsRow jo={jo} colSpan={11} />
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={toBeCostingPaged.page} totalPages={toBeCostingPaged.totalPages} totalCount={toBeCostingPaged.totalCount} onChange={toBeCostingPaged.setPage} />
            </>
          )}
        </Collapsible>
      )}

      <Collapsible title="Job Order Finish Costing" count={finishedCosting.length}>
        {!completed ? <p className="subtle">Loading...</p> : finishedCosting.length === 0 ? <p className="subtle">None yet.</p> : (
          <>
            <SearchBox value={finishedCostingPaged.search} onChange={finishedCostingPaged.setSearch} />
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Customer Name</th><th>Item Description</th><th>Qty</th><th>Drawing</th><th>PO</th><th>Job Order</th><th>Comments</th></tr></thead>
                <tbody>
                  {finishedCostingPaged.pageItems.map((jo) => (
                    <Fragment key={jo.id}>
                      <tr>
                        <td>{fmtDate(jo.jo_date)}</td>
                        <td>{jo.so_no}</td>
                        <td>{jo.item_no}</td>
                        <td>{jo.customer_name}</td>
                        <td><TruncatedText text={jo.item_description} /></td>
                        <td>{jo.quantity}</td>
                        <FileCells jo={jo} />
                        <CommentsCell jo={jo} />
                      </tr>
                      <CommentsRow jo={jo} colSpan={10} />
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={finishedCostingPaged.page} totalPages={finishedCostingPaged.totalPages} totalCount={finishedCostingPaged.totalCount} onChange={finishedCostingPaged.setPage} />
          </>
        )}
      </Collapsible>
    </>
  );
}
