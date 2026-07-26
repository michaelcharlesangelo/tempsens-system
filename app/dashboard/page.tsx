"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { JobOrder, dashboardStatusLabel, fmtDate } from "@/lib/jobOrders";

interface CategoryTotal { category: string; qty: number; }

function daysSince(isoDate: string): number {
  const start = new Date(isoDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const [activeJobOrders, setActiveJobOrders] = useState<JobOrder[] | null>(null);
  const [yearlyByCategory, setYearlyByCategory] = useState<CategoryTotal[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [openComplaints, setOpenComplaints] = useState<number>(0);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setActiveJobOrders(d.activeJobOrders ?? []);
      setYearlyByCategory(d.yearlyByCategory ?? []);
      setYear(d.year ?? null);
    });
    fetch("/api/complaints", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const open = (d.complaints ?? []).filter((c: { status: string }) => c.status !== "done").length;
      setOpenComplaints(open);
    });
  }, []);

  return (
    <>
      <TabNav active="/dashboard" />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Current Job Orders ({activeJobOrders?.length ?? "..."})</h2>
          <a href="/jo-input" className="btn">+ New Job Order</a>
        </div>
        {!activeJobOrders ? <p className="subtle">Loading...</p> : activeJobOrders.length === 0 ? <p className="subtle">Nothing active right now.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer Name</th>
                  <th>Item Description</th><th>Qty</th><th>Days</th><th>Estimation</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeJobOrders.map((jo) => (
                  <tr key={jo.id}>
                    <td>{fmtDate(jo.created_at)}</td>
                    <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                    <td>{jo.item_no}</td>
                    <td>{jo.sales_person_name}</td>
                    <td>{jo.customer_name}</td>
                    <td>{jo.item_description}</td>
                    <td>{jo.quantity}</td>
                    <td>{daysSince(jo.created_at)}</td>
                    <td>{fmtDate(jo.finish_estimation)}</td>
                    <td><span className={`pill pill-${jo.status}`}>{dashboardStatusLabel(jo.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Production</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Placeholder until production floor tracking is wired up — Qty will reflect real progress later.
        </p>
        {!activeJobOrders ? <p className="subtle">Loading...</p> : activeJobOrders.length === 0 ? <p className="subtle">Nothing in production right now.</p> : (
          <table className="data-table">
            <thead><tr><th>Item Code</th><th>Item Description</th><th>Qty</th></tr></thead>
            <tbody>
              {activeJobOrders.map((jo) => <tr key={jo.id}><td>{jo.item_no}</td><td>{jo.item_description}</td><td>0</td></tr>)}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>{year ?? ""} Production So Far (Completed, By Item Category)</h2>
        {yearlyByCategory.length === 0 ? <p className="subtle">Nothing completed yet this year.</p> : (
          <table className="data-table">
            <thead><tr><th>Category</th><th>Quantity</th></tr></thead>
            <tbody>
              {yearlyByCategory.map((c) => <tr key={c.category}><td>{c.category}</td><td>{c.qty} pcs</td></tr>)}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Product Complaints</h2>
        <p className="subtle" style={{ marginBottom: 10 }}>{openComplaints} still open (not marked Done)</p>
        <a href="/complaints" className="btn secondary">View complaints →</a>
      </div>
    </>
  );
}
