"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { fmtDate } from "@/lib/jobOrders";

interface PrepareItem {
  id: string; job_order_id: string; jo_number: string; so_no: string; req_date: string | null;
  item_no: string; description: string; qty: number; unit: string; material_prepared: boolean;
}
interface NotAvailableItem {
  id: string; job_order_id: string; jo_number: string; customer_name: string; item_no: string; description: string; qty: number; unit: string; procurement_method: string | null;
}

export default function WarehouseManagerPage() {
  const [prepareItems, setPrepareItems] = useState<PrepareItem[] | null>(null);
  const [notAvailable, setNotAvailable] = useState<NotAvailableItem[] | null>(null);
  const [showRecap, setShowRecap] = useState(false);

  async function loadPrepare() {
    const res = await fetch("/api/warehouse/prepare-list", { cache: "no-store" });
    const data = await res.json();
    setPrepareItems(data.items ?? []);
  }
  async function loadNotAvailable() {
    const res = await fetch("/api/warehouse/not-ready", { cache: "no-store" });
    const data = await res.json();
    setNotAvailable(data.items ?? []);
  }

  useEffect(() => { loadPrepare(); loadNotAvailable(); }, []);

  async function togglePrepared(item: PrepareItem) {
    await fetch(`/api/job-orders/${item.job_order_id}/bom/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialPrepared: !item.material_prepared }),
    });
    loadPrepare();
  }

  async function setProcurement(item: NotAvailableItem, method: "import" | "local_purchase") {
    await fetch(`/api/job-orders/${item.job_order_id}/bom/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ procurementMethod: method }),
    });
    loadNotAvailable();
  }

  const recap = new Map<string, { itemNo: string; description: string; totalQty: number; unit: string }>();
  (prepareItems ?? []).forEach((i) => {
    const existing = recap.get(i.item_no);
    if (existing) existing.totalQty += i.qty;
    else recap.set(i.item_no, { itemNo: i.item_no, description: i.description, totalQty: i.qty, unit: i.unit });
  });

  return (
    <>
      <TabNav active="/warehouse-manager" />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Material To Be Prepared ({prepareItems?.length ?? "..."})</h2>
          <button className="btn secondary" onClick={() => setShowRecap((s) => !s)}>{showRecap ? "Hide recap" : "Recap"}</button>
        </div>

        {showRecap && (
          <table className="data-table" style={{ marginBottom: 14, background: "var(--panel-muted)" }}>
            <thead><tr><th>Item Code</th><th>Description</th><th>Total Needed</th></tr></thead>
            <tbody>
              {Array.from(recap.values()).map((r) => <tr key={r.itemNo}><td>{r.itemNo}</td><td>{r.description}</td><td>{r.totalQty} {r.unit}</td></tr>)}
            </tbody>
          </table>
        )}

        {!prepareItems ? <p className="subtle">Loading...</p> : prepareItems.length === 0 ? <p className="subtle">Nothing to prepare right now.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Req Date</th><th>SO Number</th><th>Item Code</th><th>Item Description</th><th>Qty</th><th>Prepared</th></tr></thead>
              <tbody>
                {prepareItems.map((i) => (
                  <tr key={i.id}>
                    <td>{fmtDate(i.req_date)}</td>
                    <td>{i.so_no}</td>
                    <td>{i.item_no}</td>
                    <td>{i.description}</td>
                    <td>{i.qty} {i.unit}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={i.material_prepared} onChange={() => togglePrepared(i)} style={{ width: "auto" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Not Available — Needs Purchase ({notAvailable?.length ?? "..."})</h2>
        {!notAvailable ? <p className="subtle">Loading...</p> : notAvailable.length === 0 ? <p className="subtle">Nothing flagged right now.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>JO Number</th><th>Customer</th><th>Item Code</th><th>Description</th><th>Qty</th><th>Procurement</th></tr></thead>
              <tbody>
                {notAvailable.map((i) => (
                  <tr key={i.id}>
                    <td>{i.jo_number}</td>
                    <td>{i.customer_name}</td>
                    <td>{i.item_no}</td>
                    <td>{i.description}</td>
                    <td>{i.qty} {i.unit}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className={i.procurement_method === "import" ? "btn" : "btn secondary"} style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setProcurement(i, "import")}>Import</button>
                        <button className={i.procurement_method === "local_purchase" ? "btn" : "btn secondary"} style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setProcurement(i, "local_purchase")}>Local Purchase</button>
                      </div>
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
