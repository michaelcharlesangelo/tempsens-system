"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { JobOrder, STATUS_LABELS } from "@/lib/jobOrders";

interface CategoryTotal { category: string; qty: number; }

export default function DashboardPage() {
  const [activeJobOrders, setActiveJobOrders] = useState<JobOrder[] | null>(null);
  const [yearlyByCategory, setYearlyByCategory] = useState<CategoryTotal[]>([]);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setActiveJobOrders(d.activeJobOrders ?? []);
      setYearlyByCategory(d.yearlyByCategory ?? []);
      setYear(d.year ?? null);
    });
  }, []);

  return (
    <>
      <TabNav active="/dashboard" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Job Orders</h2>
        <a href="/jo-input" className="btn">+ New Job Order</a>
      </div>

      <div className="card">
        <h2>Current job orders ({activeJobOrders?.length ?? "..."})</h2>
        {!activeJobOrders ? <p className="subtle">Loading...</p> : activeJobOrders.length === 0 ? <p className="subtle">Nothing active right now.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>JO Number</th><th>Customer</th><th>Item No.</th><th>Sales</th><th>Qty</th><th>Status</th><th>Deadline</th></tr>
              </thead>
              <tbody>
                {activeJobOrders.map((jo) => (
                  <tr key={jo.id}>
                    <td>{jo.jo_number}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                    <td>{jo.customer_name}</td>
                    <td>{jo.item_no}</td>
                    <td>{jo.sales_person_name}</td>
                    <td>{jo.quantity}</td>
                    <td><span className={`pill pill-${jo.status}`}>{STATUS_LABELS[jo.status]}</span></td>
                    <td>{jo.deadline ? new Date(jo.deadline).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>{year ?? ""} production so far (completed, by item category)</h2>
        {yearlyByCategory.length === 0 ? <p className="subtle">Nothing completed yet this year.</p> : (
          <table className="data-table">
            <thead><tr><th>Category</th><th>Quantity</th></tr></thead>
            <tbody>
              {yearlyByCategory.map((c) => <tr key={c.category}><td>{c.category}</td><td>{c.qty} pcs</td></tr>)}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
