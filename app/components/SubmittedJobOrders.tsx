"use client";

import { useEffect, useState } from "react";
import JoListTable from "@/app/components/JoListTable";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { JobOrder, joMatchesSearch, salesSupportProgressLabel } from "@/lib/jobOrders";

const EDITABLE_STATUSES = ["draft", "pending_approval"];
const CANCELLABLE_STATUSES = ["draft", "pending_approval", "approved", "acknowledged", "in_progress", "qc"];

// Shared "Job Orders I've Submitted" card - same capability (create/edit/
// cancel) is available from more than one tab since there's no per-user
// login yet to scope "mine" by; `tab` controls file-visibility permissions
// and `by` is the name recorded on the cancel history entry.
export default function SubmittedJobOrders({ tab, by }: { tab: string; by: string }) {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/job-orders?tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    setJobOrders(data.jobOrders ?? []);
  }

  useEffect(() => { load(); }, [tab]);

  async function viewFile(id: string, type: "drawing" | "po") {
    const res = await fetch(`/api/job-orders/${id}/file?type=${type}&tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Can't open file."); return; }
    window.open(data.url, "_blank");
  }

  async function cancelJo(id: string) {
    if (!confirm("Cancel this job order? This can't be undone.")) return;
    const res = await fetch(`/api/job-orders/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", by }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to cancel."); return; }
    load();
  }

  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(jobOrders ?? [], joMatchesSearch);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Job Orders I've Submitted</h2>
        <a href="/jo-input" className="btn">+ New Job Order</a>
      </div>
      {message && <div className="warn">{message}</div>}
      {!jobOrders ? <p className="subtle">Loading...</p> : jobOrders.length === 0 ? <p className="subtle">None yet.</p> : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <JoListTable
            items={pageItems}
            onView={viewFile}
            showProgress
            progressLabel={salesSupportProgressLabel}
            renderActions={(jo) => (
              <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                {EDITABLE_STATUSES.includes(jo.status) && (
                  <a href={`/jo-input?edit=${jo.id}`} className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>Edit</a>
                )}
                {CANCELLABLE_STATUSES.includes(jo.status) && (
                  <button className="btn danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => cancelJo(jo.id)}>Cancel</button>
                )}
              </div>
            )}
          />
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}
