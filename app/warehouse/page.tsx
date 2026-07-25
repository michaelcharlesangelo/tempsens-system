"use client";

import { Fragment, useEffect, useState } from "react";
import NavBar from "@/app/components/NavBar";

interface MaterialItem {
  itemCode: string;
  description: string;
  unit: string;
  totalEstimatedQty: number;
  joBreakdown: { joNumber: string; customerName: string; qty: number }[];
}
interface JoSummary { id: string; jo_number: string; customer_name: string; material_issued: boolean; }

export default function WarehousePage() {
  const [items, setItems] = useState<MaterialItem[] | null>(null);
  const [jobOrders, setJobOrders] = useState<JoSummary[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/warehouse/material-needed", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setJobOrders(d.jobOrders ?? []); });
  }, []);

  return (
    <>
      <NavBar active="warehouse" />
      <div className="card">
        <h2>Material needed</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Combined raw material requirement across all acknowledged / in-progress job orders.
        </p>
        {!items ? <p className="subtle">Loading...</p> : items.length === 0 ? <p className="subtle">Nothing needed right now.</p> : (
          <table className="data-table">
            <thead><tr><th>Item code</th><th>Description</th><th>Total needed</th><th></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.itemCode}>
                  <tr>
                    <td>{item.itemCode}</td>
                    <td>{item.description}</td>
                    <td>{item.totalEstimatedQty} {item.unit}</td>
                    <td>
                      <button className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }} onClick={() => setExpanded(expanded === item.itemCode ? null : item.itemCode)}>
                        {expanded === item.itemCode ? "Hide" : "Breakdown"}
                      </button>
                    </td>
                  </tr>
                  {expanded === item.itemCode && (
                    <tr>
                      <td colSpan={4} style={{ background: "var(--panel-muted)" }}>
                        {item.joBreakdown.map((b, i) => (
                          <div key={i} style={{ fontSize: "0.82rem", padding: "3px 0" }}>{b.joNumber} — {b.customerName}: {b.qty}</div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Job orders awaiting material</h2>
        {jobOrders.length === 0 ? <p className="subtle">None.</p> : (
          <table className="data-table">
            <thead><tr><th>JO Number</th><th>Customer</th><th>Material status</th><th></th></tr></thead>
            <tbody>
              {jobOrders.map((jo) => (
                <tr key={jo.id}>
                  <td>{jo.jo_number}</td>
                  <td>{jo.customer_name}</td>
                  <td>{jo.material_issued ? "Issued" : "Not yet issued"}</td>
                  <td><a href={`/job-orders/${jo.id}`}>Open →</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
