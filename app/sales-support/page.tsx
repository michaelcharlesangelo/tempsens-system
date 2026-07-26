"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import JoListTable from "@/app/components/JoListTable";
import { JobOrder, salesSupportProgressLabel } from "@/lib/jobOrders";

const EDITABLE_STATUSES = ["draft", "pending_approval"];
const CANCELLABLE_STATUSES = ["draft", "pending_approval", "approved", "acknowledged", "in_progress", "qc"];

export default function SalesSupportPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/job-orders?tab=jo-input", { cache: "no-store" });
    const data = await res.json();
    setJobOrders(data.jobOrders ?? []);
  }

  useEffect(() => { load(); }, []);

  async function viewFile(id: string, type: "drawing" | "po") {
    const res = await fetch(`/api/job-orders/${id}/file?type=${type}&tab=jo-input`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Can't open file."); return; }
    window.open(data.url, "_blank");
  }

  async function cancelJo(id: string) {
    if (!confirm("Cancel this job order? This can't be undone.")) return;
    const res = await fetch(`/api/job-orders/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", by: "Sales Support" }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to cancel."); return; }
    load();
  }

  return (
    <>
      <TabNav active="/sales-support" />
      {message && <div className="warn">{message}</div>}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Job Orders I've Submitted</h2>
          <a href="/jo-input" className="btn">+ New Job Order</a>
        </div>
        {!jobOrders ? <p className="subtle">Loading...</p> : jobOrders.length === 0 ? <p className="subtle">None yet.</p> : (
          <JoListTable
            items={jobOrders}
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
        )}
      </div>
    </>
  );
}
