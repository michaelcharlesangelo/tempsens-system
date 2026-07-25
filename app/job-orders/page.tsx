"use client";

import { useEffect, useState } from "react";
import NavBar from "@/app/components/NavBar";
import { JobOrder, JobOrderStatus, STATUS_LABELS } from "@/lib/jobOrders";

const FILTERS: { value: JobOrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "qc", label: "QC" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export default function JobOrdersListPage() {
  const [jobOrders, setJobOrders] = useState<JobOrder[] | null>(null);
  const [filter, setFilter] = useState<JobOrderStatus | "all">("all");

  useEffect(() => {
    const url = filter === "all" ? "/api/job-orders" : `/api/job-orders?status=${filter}`;
    setJobOrders(null);
    fetch(url, { cache: "no-store" }).then((r) => r.json()).then((d) => setJobOrders(d.jobOrders ?? []));
  }, [filter]);

  return (
    <>
      <NavBar active="job-orders" />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Job orders</h2>
          <a href="/job-orders/new" className="btn">+ New job order</a>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={filter === f.value ? "btn" : "btn secondary"}
              onClick={() => setFilter(f.value)}
              style={{ fontSize: "0.78rem", padding: "6px 12px" }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!jobOrders ? (
          <p className="subtle">Loading...</p>
        ) : jobOrders.length === 0 ? (
          <p className="subtle">No job orders found.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>JO Number</th><th>Customer</th><th>Status</th><th>Due</th><th>Created</th></tr></thead>
            <tbody>
              {jobOrders.map((jo) => (
                <tr key={jo.id}>
                  <td><a href={`/job-orders/${jo.id}`}>{jo.jo_number}</a></td>
                  <td>{jo.customer_name}</td>
                  <td><span className={`pill pill-${jo.status}`}>{STATUS_LABELS[jo.status]}</span></td>
                  <td>{jo.due_date ? new Date(jo.due_date).toLocaleDateString() : "-"}</td>
                  <td>{new Date(jo.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
