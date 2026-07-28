"use client";

import { useEffect, useState } from "react";
import JoListTable from "@/app/components/JoListTable";
import Collapsible from "@/app/components/Collapsible";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { JobOrder, joMatchesSearch, salesSupportProgressLabel } from "@/lib/jobOrders";

const EDITABLE_STATUSES = ["draft", "pending_approval"];
// Cancellable only up until Sales Manager (layer 1) approves it - once it
// moves past that, Sales Support/Supervisor/Operational Manager can no
// longer cancel, even mid-production.
function canCancel(jo: JobOrder): boolean {
  return jo.status === "draft" || (jo.status === "pending_approval" && jo.current_approval_layer === 1);
}
// The other tabs that actively tag new job orders with their own name.
// Sales Support is the original/default role, so anything NOT tagged as
// one of these (blank, or a name typed into the old "Created By" field
// before tagging existed) falls under Sales Support by default.
const OTHER_TAGGED_ROLES = ["Operational Manager", "Sales Support Supervisor"];

// Shared "Job Orders I've Submitted" card - same capability (create/edit/
// cancel) is available from more than one tab since there's no per-user
// login yet to scope "mine" by; `tab` controls file-visibility permissions
// and `by` is the name recorded on the cancel history entry.
export default function SubmittedJobOrders({
  tab, by, defaultOpen = false, pageSize = 10,
}: { tab: string; by: string; defaultOpen?: boolean; pageSize?: number }) {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/job-orders?tab=${tab}`, { cache: "no-store" });
    const data = await res.json();
    // Not real per-account scoping yet (no login) - `sales_support_name`
    // is tagged with `by` at creation time (see the ?by= param on the
    // "+ New Job Order" link below) as a stand-in so each tab's list
    // doesn't show every job order ever created. Once real accounts +
    // login exist, this becomes genuine per-user filtering.
    const all: JobOrder[] = data.jobOrders ?? [];
    setJobOrders(all.filter((jo) => {
      if (by === "Sales Support") return !OTHER_TAGGED_ROLES.includes(jo.sales_support_name);
      return jo.sales_support_name === by;
    }));
  }

  useEffect(() => { load(); }, [tab, by]);

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

  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(jobOrders ?? [], joMatchesSearch, pageSize);

  return (
    <Collapsible
      title="Job Orders I've Submitted"
      count={jobOrders?.length}
      defaultOpen={defaultOpen}
      actions={<a href={`/jo-input?by=${encodeURIComponent(by)}`} className="btn">+ New Job Order</a>}
    >
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
                  <a href={`/jo-input?edit=${jo.id}&by=${encodeURIComponent(by)}`} className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>Edit</a>
                )}
                {canCancel(jo) && (
                  <button className="btn danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => cancelJo(jo.id)}>Cancel</button>
                )}
              </div>
            )}
          />
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </Collapsible>
  );
}
