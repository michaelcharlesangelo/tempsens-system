"use client";

import { useEffect, useState } from "react";
import { JobOrder, STATUS_LABELS, APPROVAL_LAYERS } from "@/lib/jobOrders";

export default function ApprovalTabView({ tab, layer, label }: { tab: string; layer: 1 | 2 | 3; label: string }) {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/job-orders?status=pending_approval&tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    setJobOrders((data.jobOrders ?? []).filter((j: JobOrder) => j.current_approval_layer === layer));
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

  return (
    <div className="card">
      <h2>{label} — pending approval</h2>
      {message && <div className="warn">{message}</div>}
      {!jobOrders ? <p className="subtle">Loading...</p> : jobOrders.length === 0 ? <p className="subtle">Nothing waiting on you right now.</p> : (
        jobOrders.map((jo) => (
          <div key={jo.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <b>{jo.jo_number}</b> — {jo.customer_name}
                {jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 8 }}>URGENT</span>}
              </div>
              <span className={`pill pill-${jo.status}`}>{STATUS_LABELS[jo.status]}</span>
            </div>
            <p className="subtle" style={{ margin: "6px 0 2px" }}>{jo.item_category} · {jo.item_no} · Qty {jo.quantity} · SO {jo.so_no}</p>
            <p style={{ margin: "4px 0" }}>{jo.item_description}</p>
            <p className="subtle">Submitted by {jo.sales_person_name || "Sales Support"} on {new Date(jo.created_at).toLocaleDateString()}</p>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button className="btn secondary" onClick={() => viewFile(jo.id, "drawing")}>View drawing</button>
              <button className="btn secondary" onClick={() => viewFile(jo.id, "po")}>View PO</button>
              <button className="btn secondary" onClick={() => setExpanded(expanded === jo.id ? null : jo.id)}>
                {expanded === jo.id ? "Cancel" : "Approve / Reject"}
              </button>
            </div>

            {expanded === jo.id && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--panel-muted)", paddingTop: 10 }}>
                <div className="field"><label>Comment (optional)</label><input type="text" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
                <button className="btn" style={{ marginRight: 8 }} onClick={() => act(jo.id, "approve")}>Approve</button>
                <button className="btn danger" onClick={() => act(jo.id, "reject")}>Reject</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
