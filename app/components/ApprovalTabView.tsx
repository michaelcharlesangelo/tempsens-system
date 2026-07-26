"use client";

import { useEffect, useState } from "react";
import { JobOrder, fmtDate } from "@/lib/jobOrders";

// Defined at module scope (not inside the component) so it keeps a stable
// identity across re-renders. Previously this was declared inside the
// component body, which meant React treated it as a brand-new component type
// on every keystroke in the comment box, remounting the whole table (and
// losing input focus) on every character typed.
function MiniTable({
  items,
  showActions,
  expandedId,
  onView,
  onToggleExpand,
}: {
  items: JobOrder[];
  showActions: boolean;
  expandedId: string | null;
  onView: (id: string, type: "drawing" | "po") => void;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer</th>
            <th>Item Description</th><th>Qty</th><th>Deadline</th>
            <th>Drawing</th><th>PO</th>
            {showActions && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((jo) => (
            <tr key={jo.id} style={expandedId === jo.id ? { background: "var(--panel-muted)" } : undefined}>
              <td>{fmtDate(jo.created_at)}</td>
              <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
              <td>{jo.item_no}</td>
              <td>{jo.sales_person_name}</td>
              <td>{jo.customer_name}</td>
              <td>{jo.item_description}</td>
              <td>{jo.quantity}</td>
              <td>{fmtDate(jo.deadline)}</td>
              <td><button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onView(jo.id, "drawing")}>View</button></td>
              <td><button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onView(jo.id, "po")}>View</button></td>
              {showActions && (
                <td>
                  <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => onToggleExpand(jo.id)}>
                    {expandedId === jo.id ? "Cancel" : "Approve / Reject"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          <MiniTable items={pending} showActions expandedId={expanded} onView={viewFile} onToggleExpand={toggleExpand} />
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
        {passedThisLayer.length === 0 ? <p className="subtle">None yet.</p> : (
          <MiniTable items={passedThisLayer} showActions={false} expandedId={null} onView={viewFile} onToggleExpand={() => {}} />
        )}
      </div>

      <div className="card">
        <h2>Rejected</h2>
        {rejected.length === 0 ? <p className="subtle">None.</p> : (
          <MiniTable items={rejected} showActions={false} expandedId={null} onView={viewFile} onToggleExpand={() => {}} />
        )}
      </div>
    </>
  );
}
