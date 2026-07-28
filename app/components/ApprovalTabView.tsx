"use client";

import { useEffect, useState } from "react";
import { JobOrder, joMatchesSearch } from "@/lib/jobOrders";
import JoListTable from "@/app/components/JoListTable";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import ToggleSwitch from "@/app/components/ToggleSwitch";

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
  const approvedHere = allJobOrders.filter((j) => {
    if (j.status === "rejected" || j.status === "cancelled" || j.status === "draft") return false;
    if (j.status === "pending_approval") return (j.current_approval_layer ?? 0) > layer;
    return true;
  });
  const rejected = allJobOrders.filter((j) => j.status === "rejected");
  const expandedJo = expanded ? pending.find((j) => j.id === expanded) : null;

  return (
    <ApprovalTabViewInner
      {...{ pending, approvedHere, rejected, expandedJo, message, comment, setComment, acting, toggleExpand, act, viewFile, expanded, label }}
    />
  );
}

function ApprovalTabViewInner({
  pending, approvedHere, rejected, expandedJo, message, comment, setComment, acting, toggleExpand, act, viewFile, expanded, label,
}: {
  pending: JobOrder[]; approvedHere: JobOrder[]; rejected: JobOrder[]; expandedJo: JobOrder | null | undefined;
  message: string | null; comment: string; setComment: (v: string) => void; acting: boolean;
  toggleExpand: (id: string) => void; act: (id: string, action: "approve" | "reject") => void;
  viewFile: (id: string, type: "drawing" | "po") => void; expanded: string | null; label: string;
}) {
  const [showActionRequired, setShowActionRequired] = useState(true);
  const [showApproved, setShowApproved] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  // One combined list instead of 3 separate tables - which buckets feed it
  // is controlled by the 3 toggles above, default to just Action Required.
  const combined = [
    ...(showActionRequired ? pending : []),
    ...(showApproved ? approvedHere : []),
    ...(showRejected ? rejected : []),
  ];
  const combinedPaged = usePagedSearch(combined, joMatchesSearch);

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <h2 style={{ margin: 0 }}>Job Order Request ({combined.length})</h2>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <ToggleSwitch checked={showActionRequired} onChange={setShowActionRequired} label={`Action Required (${pending.length})`} />
            <ToggleSwitch checked={showApproved} onChange={setShowApproved} label={`Approved (${approvedHere.length})`} />
            <ToggleSwitch checked={showRejected} onChange={setShowRejected} label={`Rejected (${rejected.length})`} />
          </div>
        </div>

        {message && <div className="warn">{message}</div>}

        {combined.length === 0 ? (
          <p className="subtle">Nothing to show for the selected filters.</p>
        ) : (
          <>
            <SearchBox value={combinedPaged.search} onChange={combinedPaged.setSearch} />
            <JoListTable
              items={combinedPaged.pageItems}
              onView={viewFile}
              renderActions={(jo) => (
                pending.some((p) => p.id === jo.id) ? (
                  <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => toggleExpand(jo.id)}>
                    {expanded === jo.id ? "Cancel" : "Approve / Reject"}
                  </button>
                ) : null
              )}
            />
            <Pager page={combinedPaged.page} totalPages={combinedPaged.totalPages} totalCount={combinedPaged.totalCount} onChange={combinedPaged.setPage} />
          </>
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
    </>
  );
}
