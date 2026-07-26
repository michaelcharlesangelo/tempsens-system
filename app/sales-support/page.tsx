"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { JobOrder, fmtDate, salesSupportProgressLabel } from "@/lib/jobOrders";

export default function SalesSupportPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/job-orders?tab=jo-input", { cache: "no-store" });
    const data = await res.json();
    setJobOrders(data.jobOrders ?? []);
  }

  useEffect(() => { load(); }, []);

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

  const cancellable = ["draft", "pending_approval", "approved", "acknowledged", "in_progress", "qc"];

  return (
    <>
      <TabNav active="/sales-support" />
      {message && <div className="warn">{message}</div>}
      <div className="card">
        <h2>Job Orders I've Submitted</h2>
        {!jobOrders ? <p className="subtle">Loading...</p> : jobOrders.length === 0 ? <p className="subtle">None yet.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>JO Date</th><th>SO Number</th><th>Customer</th><th>Item Code</th><th>Qty</th><th>Progress</th><th></th></tr>
              </thead>
              <tbody>
                {jobOrders.map((jo) => (
                  <tr key={jo.id}>
                    <td>{fmtDate(jo.created_at)}</td>
                    <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                    <td>{jo.customer_name}</td>
                    <td>{jo.item_no}</td>
                    <td>{jo.quantity}</td>
                    <td><span className={`pill pill-${jo.status}`}>{salesSupportProgressLabel(jo)}</span></td>
                    <td>
                      {cancellable.includes(jo.status) && (
                        <button className="btn danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => cancelJo(jo.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
