"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TabNav from "@/app/components/TabNav";
import DateField from "@/app/components/DateField";
import { JobOrder, BomItem, fmtDate } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; }

export default function ProductionJobOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [bom, setBom] = useState<BomItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [serialNo, setSerialNo] = useState("");
  const [finishDate, setFinishDate] = useState("");

  const [newItemNo, setNewItemNo] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("pcs");
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([]);
  const [savingRow, setSavingRow] = useState(false);

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ itemNo: string; description: string; qty: string; unit: string }>({ itemNo: "", description: "", qty: "", unit: "" });

  async function load() {
    const res = await fetch(`/api/job-orders/${id}?tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    setJobOrder(data.jobOrder);
    setBom(data.bom ?? []);
    setSerialNo(data.jobOrder?.serial_no || "");
    setFinishDate(data.jobOrder?.finish_date ? data.jobOrder.finish_date.slice(0, 10) : "");
  }

  useEffect(() => { if (id) load(); }, [id]);

  useEffect(() => {
    if (jobOrder && jobOrder.status === "approved") {
      fetch(`/api/job-orders/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge", by: "Production Manager" }),
      }).then(() => load());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOrder?.status]);

  async function saveDetails() {
    const res = await fetch(`/api/job-orders/${id}/details`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serialNo, finishDate }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save."); return; }
    setMessage("Saved.");
    load();
  }

  async function onNewItemNoChange(value: string) {
    setNewItemNo(value);
    if (!value) { setSuggestions([]); return; }
    const res = await fetch(`/api/item-catalog?q=${encodeURIComponent(value)}`, { cache: "no-store" });
    const data = await res.json();
    setSuggestions(data.items ?? []);
  }

  function pickSuggestion(item: CatalogItem) {
    setNewItemNo(item.item_no);
    setNewDescription(item.description);
    setSuggestions([]);
  }

  async function addRow() {
    if (!newItemNo.trim()) return;
    setSavingRow(true);
    const res = await fetch(`/api/job-orders/${id}/bom`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemNo: newItemNo, description: newDescription, qty: newQty, unit: newUnit, materialReady: true }),
    });
    const data = await res.json();
    setSavingRow(false);
    if (!res.ok) { setMessage(data.error || "Failed to add item."); return; }
    setNewItemNo(""); setNewDescription(""); setNewQty("1"); setNewUnit("pcs");
    load();
  }

  function startEditRow(row: BomItem) {
    setEditingRowId(row.id);
    setEditDraft({ itemNo: row.item_no, description: row.description, qty: String(row.qty), unit: row.unit });
  }

  async function saveEditRow(rowId: string) {
    await fetch(`/api/job-orders/${id}/bom/${rowId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemNo: editDraft.itemNo, description: editDraft.description, qty: editDraft.qty, unit: editDraft.unit }),
    });
    setEditingRowId(null);
    load();
  }

  async function toggleNotAvailable(row: BomItem) {
    await fetch(`/api/job-orders/${id}/bom/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialReady: !row.material_ready }),
    });
    load();
  }

  async function deleteRow(rowId: string) {
    if (!confirm("Remove this BOM item?")) return;
    await fetch(`/api/job-orders/${id}/bom/${rowId}`, { method: "DELETE" });
    load();
  }

  async function sendToQc() {
    const res = await fetch(`/api/job-orders/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_to_qc", by: "Production Manager" }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); return; }
    load();
  }

  if (!jobOrder) {
    return (<><TabNav active="/production-manager" /><p className="subtle">Loading...</p></>);
  }

  return (
    <>
      <TabNav active="/production-manager" />
      <p style={{ marginBottom: 10 }}><a href="/production-manager" className="subtle">← Back to Production Manager</a></p>
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <h2>{jobOrder.jo_number} — {jobOrder.customer_name}</h2>
        <div className="form-sheet" style={{ gridTemplateColumns: "1fr" }}>
          <div className="form-sheet-col">
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Customer Name</label><span>:</span><span>{jobOrder.customer_name}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>SO Number</label><span>:</span><span>{jobOrder.so_no}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Item Description</label><span>:</span><span style={{ whiteSpace: "nowrap" }}>{jobOrder.item_description}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Category</label><span>:</span><span>{jobOrder.item_category}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Quantity</label><span>:</span><span>{jobOrder.quantity}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Item Code</label><span>:</span><span>{jobOrder.item_no}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>JO Date</label><span>:</span><span>{fmtDate(jobOrder.created_at)}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Deadline</label><span>:</span><span style={{ whiteSpace: "nowrap" }}>{fmtDate(jobOrder.deadline)}{jobOrder.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Drawing Number</label><span>:</span><span style={{ whiteSpace: "nowrap" }}>{jobOrder.drawing_number || "-"}</span></div>
            <div className="form-row" style={{ gridTemplateColumns: "140px 14px 1fr" }}><label>Sales</label><span>:</span><span>{jobOrder.sales_person_name}</span></div>
          </div>
        </div>

        <div className="form-sheet" style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Serial Number</label><span>:</span><input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} /></div>
          </div>
          <div className="form-sheet-col">
            <div className="form-row"><label>Finish Date</label><span>:</span><DateField value={finishDate} onChange={setFinishDate} /></div>
          </div>
        </div>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={saveDetails}>Save Serial No. / Finish Date</button>

        {["acknowledged", "in_progress"].includes(jobOrder.status) && (
          <button className="btn" style={{ marginTop: 10, marginLeft: 8 }} onClick={sendToQc}>Send to QC</button>
        )}
      </div>

      <div className="card">
        <h2>Material BOM</h2>
        {bom.length === 0 ? <p className="subtle">No items yet.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Not Available</th><th></th></tr></thead>
              <tbody>
                {bom.map((row) => (
                  <tr key={row.id}>
                    {editingRowId === row.id ? (
                      <>
                        <td><input type="text" value={editDraft.itemNo} onChange={(e) => setEditDraft({ ...editDraft, itemNo: e.target.value })} /></td>
                        <td><input type="text" value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
                        <td><input type="number" value={editDraft.qty} onChange={(e) => setEditDraft({ ...editDraft, qty: e.target.value })} style={{ width: 70 }} /></td>
                        <td><input type="text" value={editDraft.unit} onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })} style={{ width: 60 }} /></td>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={!row.material_ready} onChange={() => toggleNotAvailable(row)} style={{ width: "auto" }} /></td>
                        <td><button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => saveEditRow(row.id)}>Save</button></td>
                      </>
                    ) : (
                      <>
                        <td>{row.item_no}</td>
                        <td>{row.description}</td>
                        <td>{row.qty}</td>
                        <td>{row.unit}</td>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={!row.material_ready} onChange={() => toggleNotAvailable(row)} style={{ width: "auto" }} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => startEditRow(row)}>Edit</button>{" "}
                          <button className="btn danger" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => deleteRow(row.id)}>Remove</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid" style={{ marginTop: 14 }}>
          <div className="field" style={{ position: "relative" }}>
            <label>Item Code</label>
            <input type="text" value={newItemNo} onChange={(e) => onNewItemNoChange(e.target.value)} autoComplete="off" />
            {suggestions.length > 0 && (
              <div style={{ position: "absolute", zIndex: 10, background: "white", border: "1px solid var(--border)", borderRadius: 8, width: "100%", maxHeight: 160, overflowY: "auto" }}>
                {suggestions.map((s) => (
                  <div key={s.item_no} onClick={() => pickSuggestion(s)} style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--panel-muted)" }}>
                    <b>{s.item_no}</b> — {s.description}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field"><label>Description</label><input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} /></div>
          <div className="field"><label>Qty</label><input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} /></div>
          <div className="field"><label>Unit</label><input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} /></div>
        </div>
        <button className="btn secondary" onClick={addRow} disabled={savingRow || !newItemNo.trim()}>{savingRow ? "Adding..." : "+ Add item (auto-saves)"}</button>
      </div>
    </>
  );
}
