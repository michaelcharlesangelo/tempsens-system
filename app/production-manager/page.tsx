"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { JobOrder, fmtDate } from "@/lib/jobOrders";
import { printFileUrl } from "@/lib/printFile";

export default function ProductionManagerPage() {
  const [notAcknowledged, setNotAcknowledged] = useState<JobOrder[]>([]);
  const [acknowledged, setAcknowledged] = useState<JobOrder[]>([]);
  const [readyForProduction, setReadyForProduction] = useState<JobOrder[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);

  async function load() {
    const [approvedRes, ackRes, inProgressRes] = await Promise.all([
      fetch("/api/job-orders?status=approved&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=acknowledged&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=in_progress&tab=production-manager", { cache: "no-store" }),
    ]);
    setNotAcknowledged((await approvedRes.json()).jobOrders ?? []);
    const ack: JobOrder[] = (await ackRes.json()).jobOrders ?? [];
    const inProg: JobOrder[] = (await inProgressRes.json()).jobOrders ?? [];
    const combined = [...ack, ...inProg];
    setAcknowledged(combined.filter((jo) => !jo.ready_for_production));
    setReadyForProduction(combined.filter((jo) => jo.ready_for_production));
  }

  useEffect(() => { load(); }, []);

  async function viewDrawing(id: string) {
    const res = await fetch(`/api/job-orders/${id}/file?type=drawing&tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "No drawing on file."); return; }
    window.open(data.url, "_blank");
  }

  async function printDrawing(id: string) {
    const res = await fetch(`/api/job-orders/${id}/file?type=drawing&tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "No drawing on file."); return; }
    printFileUrl(data.url, !!data.isPdf);
  }

  async function acknowledge(id: string) {
    setAcking(id);
    const res = await fetch(`/api/job-orders/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge", by: "Production Manager" }),
    });
    const data = await res.json();
    setAcking(null);
    if (!res.ok) { setMessage(data.error || "Failed to acknowledge."); return; }
    load();
  }

  function JoTable({ items, mode }: { items: JobOrder[]; mode: "not_acknowledged" | "open" }) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer</th>
              <th>Item Description</th><th>Qty</th><th>Deadline</th><th>Drawing</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((jo) => (
              <tr key={jo.id}>
                <td>{fmtDate(jo.created_at)}</td>
                <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                <td>{jo.item_no}</td>
                <td>{jo.sales_person_name}</td>
                <td>{jo.customer_name}</td>
                <td>{jo.item_description}</td>
                <td>{jo.quantity}</td>
                <td>{fmtDate(jo.deadline)}</td>
                <td>
                  <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewDrawing(jo.id)}>View</button>{" "}
                  <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => printDrawing(jo.id)}>Print</button>
                </td>
                <td>
                  {mode === "not_acknowledged" ? (
                    <button className="btn" style={{ fontSize: "0.78rem", padding: "5px 10px" }} disabled={acking === jo.id} onClick={() => acknowledge(jo.id)}>
                      {acking === jo.id ? "Acknowledging..." : "Acknowledge"}
                    </button>
                  ) : (
                    <a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }}>Job Order →</a>
                  )}
                </td>
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
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <h2>Not Yet Acknowledged ({notAcknowledged.length})</h2>
        {notAcknowledged.length > 0 && <p className="subtle" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em", marginTop: -6 }}>Action Required</p>}
        {notAcknowledged.length === 0 ? <p className="subtle">Nothing waiting.</p> : <JoTable items={notAcknowledged} mode="not_acknowledged" />}
      </div>

      <div className="card">
        <h2>Acknowledged ({acknowledged.length})</h2>
        {acknowledged.length === 0 ? <p className="subtle">None yet.</p> : <JoTable items={acknowledged} mode="open" />}
      </div>

      <div className="card">
        <h2>Ready for Production ({readyForProduction.length})</h2>
        {readyForProduction.length === 0 ? <p className="subtle">None yet.</p> : <JoTable items={readyForProduction} mode="open" />}
      </div>
    </>
  );
}
