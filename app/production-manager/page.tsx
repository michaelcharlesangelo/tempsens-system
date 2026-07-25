"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { JobOrder, STATUS_LABELS } from "@/lib/jobOrders";

interface BomRow { itemNo: string; description: string; qty: string; unit: string; materialReady: boolean; }
const BLANK_ROW: BomRow = { itemNo: "", description: "", qty: "", unit: "pcs", materialReady: true };
const ROW_COUNT = 10;

export default function ProductionManagerPage() {
  const [approved, setApproved] = useState<JobOrder[]>([]);
  const [acknowledged, setAcknowledged] = useState<JobOrder[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [ackTarget, setAckTarget] = useState<JobOrder | null>(null);
  const [serialNo, setSerialNo] = useState("");
  const [finishEstimation, setFinishEstimation] = useState("");

  const [bomTarget, setBomTarget] = useState<JobOrder | null>(null);
  const [rows, setRows] = useState<BomRow[]>(Array.from({ length: ROW_COUNT }, () => ({ ...BLANK_ROW })));

  async function load() {
    const [approvedRes, ackRes] = await Promise.all([
      fetch("/api/job-orders?status=approved&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=acknowledged&tab=production-manager", { cache: "no-store" }),
    ]);
    setApproved((await approvedRes.json()).jobOrders ?? []);
    setAcknowledged((await ackRes.json()).jobOrders ?? []);
  }

  useEffect(() => { load(); }, []);

  function openAckModal(jo: JobOrder) {
    setAckTarget(jo);
    setSerialNo("");
    setFinishEstimation("");
  }

  async function submitAcknowledge() {
    if (!ackTarget) return;
    const res = await fetch(`/api/job-orders/${ackTarget.id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge", serialNo, finishEstimation, by: "Production Manager" }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to acknowledge."); return; }
    setAckTarget(null);
    load();
  }

  function openBomModal(jo: JobOrder) {
    setBomTarget(jo);
    setRows(Array.from({ length: ROW_COUNT }, () => ({ ...BLANK_ROW })));
  }

  function updateRow(idx: number, patch: Partial<BomRow>) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  async function submitBom() {
    if (!bomTarget) return;
    setMessage(null);
    const res = await fetch(`/api/job-orders/${bomTarget.id}/bom`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: rows.map((r) => ({ itemNo: r.itemNo, description: r.description, qty: r.qty, unit: r.unit, materialReady: r.materialReady })) }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save BOM."); return; }
    setBomTarget(null);
    setMessage(`BOM saved for ${bomTarget.jo_number}.`);
  }

  return (
    <>
      <TabNav active="/production-manager" />
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <h2>Not yet acknowledged ({approved.length})</h2>
        {approved.length === 0 ? <p className="subtle">Nothing waiting.</p> : (
          <table className="data-table">
            <thead><tr><th>JO Number</th><th>Customer</th><th>Item No.</th><th>Qty</th><th></th></tr></thead>
            <tbody>
              {approved.map((jo) => (
                <tr key={jo.id}>
                  <td>{jo.jo_number}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                  <td>{jo.customer_name}</td>
                  <td>{jo.item_no}</td>
                  <td>{jo.quantity}</td>
                  <td><button className="btn secondary" onClick={() => openAckModal(jo)}>Acknowledge</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Acknowledged ({acknowledged.length})</h2>
        {acknowledged.length === 0 ? <p className="subtle">None yet.</p> : (
          <table className="data-table">
            <thead><tr><th>JO Number</th><th>Customer</th><th>Serial No.</th><th>Finish est.</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {acknowledged.map((jo) => (
                <tr key={jo.id}>
                  <td>{jo.jo_number}</td>
                  <td>{jo.customer_name}</td>
                  <td>{jo.serial_no || "-"}</td>
                  <td>{jo.finish_estimation ? new Date(jo.finish_estimation).toLocaleDateString() : "-"}</td>
                  <td><span className={`pill pill-${jo.status}`}>{STATUS_LABELS[jo.status]}</span></td>
                  <td><button className="btn secondary" onClick={() => openBomModal(jo)}>Fill BOM</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ackTarget && (
        <div className="card" style={{ maxWidth: 420 }}>
          <h2>Acknowledge {ackTarget.jo_number}</h2>
          <div className="field"><label>Serial No.</label><input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} /></div>
          <div className="field"><label>Finish estimation date</label><input type="date" value={finishEstimation} onChange={(e) => setFinishEstimation(e.target.value)} /></div>
          <button className="btn" onClick={submitAcknowledge} style={{ marginRight: 8 }}>Confirm acknowledge</button>
          <button className="btn secondary" onClick={() => setAckTarget(null)}>Cancel</button>
        </div>
      )}

      {bomTarget && (
        <div className="card">
          <h2>Material BOM — {bomTarget.jo_number}</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Item No.</th><th>Description</th><th>Qty</th><th>Unit</th><th>Not ready</th></tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td><input type="text" value={row.itemNo} onChange={(e) => updateRow(i, { itemNo: e.target.value })} style={{ minWidth: 100 }} /></td>
                    <td><input type="text" value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} style={{ minWidth: 160 }} /></td>
                    <td><input type="number" value={row.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} style={{ width: 70 }} /></td>
                    <td><input type="text" value={row.unit} onChange={(e) => updateRow(i, { unit: e.target.value })} style={{ width: 60 }} /></td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!row.materialReady} onChange={(e) => updateRow(i, { materialReady: !e.target.checked })} style={{ width: "auto" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" style={{ marginTop: 10, marginRight: 8 }} onClick={submitBom}>Submit BOM</button>
          <button className="btn secondary" onClick={() => setBomTarget(null)}>Cancel</button>
        </div>
      )}
    </>
  );
}
