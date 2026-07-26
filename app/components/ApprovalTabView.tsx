"use client";

import { useEffect, useState } from "react";
import { JobOrder, fmtDate } from "@/lib/jobOrders";

export default function ApprovalTabView({ tab, layer, label }: { tab: string; layer: 1 | 2 | 3; label: string }) {
  const [allJobOrders, setAllJobOrders] = useState<JobOrder[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/job-orders?tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    setAllJobOrders(data.jobOrders ?? []);
  }

  useEffect(() => { load(); }, []);

  async function viewFile(id: string, type: "drawing" | "po") {
    const res = await fetch(`/api/job-orders/${id}/file?type=${type}&tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Can't open file."); return; }
    window.open(data.url, "_blank");
  }

  async function act(id: string, action: "approve" | "reject") {
    setMessage(null);
    const res = await fetch(`/api/job-orders/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment, by: label }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Action failed."); return; }
    setComment(""); setExpanded(null);
    load();
  }

  if (!allJobOrders) return <p className="subtle">Loading...</p>;

  const pending = allJobOrders.filter((j) => j.status === "pending_approval" && j.current_approval_layer === layer);
  const passedThisLayer = allJobOrders.filter((j) => {
    if (j.status === "rejected" || j.status === "cancelled" || j.status === "draft") return false;
    if (j.status === "pending_approval") return (j.current_approval_layer ?? 0) > layer;
    return true;
  });
  const rejected = allJobOrders.filter((j) => j.status === "rejected");

  function MiniTable({ items, showActions }: { items: JobOrder[]; showActions: boolean }) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer</th>
              <th>Item Description</th><th>Qty</th><th>Deadline</th>
              {showActions && <th style={{ minWidth: 260 }}>Files / Decision</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((jo) => (
              <tr key={jo.id}>
                <td>{fmtDate(jo.created_at)}</td>
                <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                <td>{jo.item_no}</td>
                <td>{jo.sales_person_name}</td>
                <td>{jo.customer_name}</td>
                <td>{jo.item_description}</td>
                <td>{jo.quantity}</td>
                <td>{fmtDate(jo.deadline)}</td>
                {showActions && (
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div>
                          <div className="subtle" style={{ fontSize: "0.68rem" }}>DRAWING</div>
                          <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewFile(jo.id, "drawing")}>View</button>
                        </div>
                        <div>
                          <div className="subtle" style={{ fontSize: "0.68rem" }}>PO</div>
                          <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewFile(jo.id, "po")}>View</button>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="subtle" style={{ fontSize: "0.68rem" }}>&nbsp;</div>
                          <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => setExpanded(expanded === jo.id ? null : jo.id)}>
                            {expanded === jo.id ? "Cancel" : "Approve / Reject"}
                          </button>
                        </div>
                      </div>
                      {expanded === jo.id && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", borderTop: "1px solid var(--panel-muted)", paddingTop: 6 }}>
                          <input type="text" placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} style={{ flex: 1 }} />
                          <button className="btn" style={{ fontSize: "0.75rem", padding: "5px 10px" }} onClick={() => act(jo.id, "approve")}>Approve</button>
                          <button className="btn danger" style={{ fontSize: "0.75rem", padding: "5px 10px" }} onClick={() => act(jo.id, "reject")}>Reject</button>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2>{label} — Pending Approval ({pending.length})</h2>
        {message && <div className="warn">{message}</div>}
        {pending.length === 0 ? <p className="subtle">Nothing waiting on you right now.</p> : <MiniTable items={pending} showActions />}
      </div>

      <div className="card">
        <h2>Approved (passed {label})</h2>
        {passedThisLayer.length === 0 ? <p className="subtle">None yet.</p> : <MiniTable items={passedThisLayer} showActions={false} />}
      </div>

      <div className="card">
        <h2>Rejected</h2>
        {rejected.length === 0 ? <p className="subtle">None.</p> : <MiniTable items={rejected} showActions={false} />}
      </div>
    </>
  );
}
