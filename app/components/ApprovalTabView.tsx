"use client";

import { useEffect, useState } from "react";
import { JobOrder } from "@/lib/jobOrders";
import JoListTable from "@/app/components/JoListTable";

export default function ApprovalTabView({ tab, layer, label }: { tab: string; layer: 1 | 2 | 3; label: string }) {
  const [allJobOrders, setAllJobOrders] = useState<JobOrder[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

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

  function toggleExpand(id: string) {
    setMessage(null);
    setComment("");
    setExpanded((cur) => (cur === id ? null : id));
  }

  async function act(id: string, action: "approve" | "reject") {
    setMessage(null);
    setActing(true);
    try {
      const res = await fetch(`/api/job-orders/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment, by: label }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Action failed."); return; }
      setComment(""); setExpanded(null);
      load();
    } finally {
      setActing(false);
    }
  }

  if (!allJobOrders) return <p className="subtle">Loading...</p>;

  const pending = allJobOrders.filter((j) => j.status === "pending_approval" && j.current_approval_layer === layer);
  const passedThisLayer = allJobOrders.filter((j) => {
    if (j.status === "rejected" || j.status === "cancelled" || j.status === "draft") return false;
    if (j.status === "pending_approval") return (j.current_approval_layer ?? 0) > layer;
    return true;
  });
  const rejected = allJobOrders.filter((j) => j.status === "rejected");
  const expandedJo = expanded ? pending.find((j) => j.id === expanded) : null;

  return (
    <>
      <div className="card">
        <h2>{label} — Pending Approval ({pending.length})</h2>
        {message && <div className="warn">{message}</div>}
        {pending.length === 0 ? (
          <p className="subtle">Nothing waiting on you right now.</p>
        ) : (
          <JoListTable
            items={pending}
            onView={viewFile}
            renderActions={(jo) => (
              <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => toggleExpand(jo.id)}>
                {expanded === jo.id ? "Cancel" : "Approve / Reject"}
              </button>
            )}
          />
        )}

        {/* Decision panel lives outside the table on purpose - putting it
            inside a table row made the whole table jump/shift every time it
            opened or closed. It now stays fixed at the bottom of the card. */}
        {expandedJo && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div className="subtle" style={{ marginBottom: 8 }}>
              Deciding on <b>{expandedJo.jo_number}</b> — {expandedJo.customer_name}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button className="btn" style={{ fontSize: "0.85rem" }} disabled={acting} onClick={() => act(expandedJo.id, "approve")}>Approve</button>
              <button className="btn danger" style={{ fontSize: "0.85rem" }} disabled={acting} onClick={() => act(expandedJo.id, "reject")}>Reject</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Approved (passed {label})</h2>
        {passedThisLayer.length === 0 ? <p className="subtle">None yet.</p> : <JoListTable items={passedThisLayer} onView={viewFile} />}
      </div>

      <div className="card">
        <h2>Rejected</h2>
        {rejected.length === 0 ? <p className="subtle">None.</p> : <JoListTable items={rejected} onView={viewFile} />}
      </div>
    </>
  );
}
