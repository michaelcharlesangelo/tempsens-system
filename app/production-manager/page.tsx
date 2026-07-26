"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { JobOrder, fmtDate } from "@/lib/jobOrders";

export default function ProductionManagerPage() {
  const [notAcknowledged, setNotAcknowledged] = useState<JobOrder[]>([]);
  const [acknowledged, setAcknowledged] = useState<JobOrder[]>([]);

  async function load() {
    const [approvedRes, ackRes, inProgressRes] = await Promise.all([
      fetch("/api/job-orders?status=approved&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=acknowledged&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=in_progress&tab=production-manager", { cache: "no-store" }),
    ]);
    setNotAcknowledged((await approvedRes.json()).jobOrders ?? []);
    const ack = (await ackRes.json()).jobOrders ?? [];
    const inProg = (await inProgressRes.json()).jobOrders ?? [];
    setAcknowledged([...ack, ...inProg]);
  }

  useEffect(() => { load(); }, []);

  function JoTable({ items }: { items: JobOrder[] }) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr><th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Customer</th><th>Item Description</th><th>Qty</th><th>Deadline</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((jo) => (
              <tr key={jo.id}>
                <td>{fmtDate(jo.created_at)}</td>
                <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                <td>{jo.item_no}</td>
                <td>{jo.customer_name}</td>
                <td>{jo.item_description}</td>
                <td>{jo.quantity}</td>
                <td>{fmtDate(jo.deadline)}</td>
                <td><a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }}>Job Order →</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <TabNav active="/production-manager" />

      <div className="card">
        <h2>Not Yet Acknowledged ({notAcknowledged.length})</h2>
        {notAcknowledged.length === 0 ? <p className="subtle">Nothing waiting.</p> : <JoTable items={notAcknowledged} />}
      </div>

      <div className="card">
        <h2>Acknowledged ({acknowledged.length})</h2>
        {acknowledged.length === 0 ? <p className="subtle">None yet.</p> : <JoTable items={acknowledged} />}
      </div>
    </>
  );
}
