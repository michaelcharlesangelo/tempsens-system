"use client";

import { useEffect, useState } from "react";
import NavBar from "@/app/components/NavBar";
import { JobOrder, STATUS_LABELS } from "@/lib/jobOrders";

export default function DashboardPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" }).then((r) => r.json()).then((d) => setProfileId(d.profile?.id));
    fetch("/api/job-orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setJobOrders(d.jobOrders ?? []));
  }, []);

  const pendingMyApproval = (jobOrders ?? []).filter((j) => j.status === "pending_approval" && j.approver_id === profileId);
  const recent = (jobOrders ?? []).slice(0, 8);

  return (
    <>
      <NavBar active="dashboard" />

      {pendingMyApproval.length > 0 && (
        <div className="card">
          <h2>Awaiting your approval ({pendingMyApproval.length})</h2>
          <table className="data-table">
            <thead><tr><th>JO Number</th><th>Customer</th><th></th></tr></thead>
            <tbody>
              {pendingMyApproval.map((jo) => (
                <tr key={jo.id}>
                  <td>{jo.jo_number}</td>
                  <td>{jo.customer_name}</td>
                  <td><a href={`/job-orders/${jo.id}`}>Review →</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Recent job orders</h2>
          <a href="/job-orders/new" className="btn">+ New job order</a>
        </div>
        {!jobOrders ? (
          <p className="subtle">Loading...</p>
        ) : recent.length === 0 ? (
          <p className="subtle">No job orders yet.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>JO Number</th><th>Customer</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {recent.map((jo) => (
                <tr key={jo.id}>
                  <td><a href={`/job-orders/${jo.id}`}>{jo.jo_number}</a></td>
                  <td>{jo.customer_name}</td>
                  <td><span className={`pill pill-${jo.status}`}>{STATUS_LABELS[jo.status]}</span></td>
                  <td>{new Date(jo.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="subtle" style={{ marginTop: 10 }}><a href="/job-orders">View all job orders →</a></p>
      </div>
    </>
  );
}
