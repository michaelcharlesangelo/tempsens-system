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
  const [history, setHistory] = useState<{ id: string; status: string; changed_by: string; comment: string; changed_at: string }[]>([]);
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
    setHistory(data.history ?? []);
    setSerialNo(data.jobOrder?.serial_no || "");
    setFinishDate(data.jobOrder?.finish_date ? data.jobOrder.finish_date.slice(0, 10) : "");
  }

  useEffect(() => { if (id) load(); }, [id]);

  async function viewDrawing() {
    const res = await fetch(`/api/job-orders/${id}/file?type=drawing&tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "No drawing on file."); return; }
    window.open(data.url, "_blank");
  }

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

  async function toggleReadyForProduction() {
    const res = await fetch(`/api/job-orders/${id}/details`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readyForProduction: !jobOrder?.ready_for_production }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to update."); return; }
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
    // Optimistic update - reflect the click immediately instead of waiting
    // on the reload roundtrip, which is what made the tick feel like it
    // "sometimes doesn't stick" on a slow connection.
    const nextReady = !row.material_ready;
    setBom((cur) => cur.map((r) => (r.id === row.id ? { ...r, material_ready: nextReady } : r)));
    try {
      const res = await fetch(`/api/job-orders/${id}/bom/${row.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialReady: nextReady }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setBom((cur) => cur.map((r) => (r.id === row.id ? { ...r, material_ready: row.material_ready } : r)));
      setMessage("Couldn't save that change - please try again.");
      return;
    }
    load();
  }

  async function deleteRow(rowId: string) {
    if (!confirm("Remove this BOM item?")) return;
    await fetch(`/api/job-orders/${id}/bom/${rowId}`, { method: "DELETE" });
    load();
  }

  if (!jobOrder) {
    return (<><TabNav active="/production-manager" /><p className="subtle">Loading...</p></>);
  }

  const minFinishDate = jobOrder.jo_date ? jobOrder.jo_date.slice(0, 10) : jobOrder.created_at.slice(0, 10);

  return (
    <>
      <TabNav active="/production-manager" />
      <p style={{ marginBottom: 10 }}><a href="/production-manager" className="subtle">← Back to Production Manager</a></p>
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>{jobOrder.jo_number} — {jobOrder.customer_name}</h2>
          <button className="btn secondary" onClick={viewDrawing}>View / Print Drawing</button>
        </div>
        <div className="form-sheet" style={{ marginTop: 14 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Customer Name</label><span>:</span><span>{jobOrder.customer_name}</span></div>
            <div className="form-row"><label>SO Number</label><span>:</span><span>{jobOrder.so_no}</span></div>
            <div className="form-row"><label>Item Description</label><span>:</span><span>{jobOrder.item_description}</span></div>
            <div className="form-row"><label>Category</label><span>:</span><span>{jobOrder.item_category}</span></div>
            <div className="form-row"><label>Quantity</label><span>:</span><span>{jobOrder.quantity}</span></div>
          </div>
          <div className="form-sheet-col">
            <div className="form-row"><label>Item Code</label><span>:</span><span>{jobOrder.item_no}</span></div>
            <div className="form-row"><label>JO Date</label><span>:</span><span>{fmtDate(jobOrder.created_at)}</span></div>
            <div className="form-row"><label>Deadline</label><span>:</span><span>{fmtDate(jobOrder.deadline)}{jobOrder.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</span></div>
            <div className="form-row"><label>Drawing Number</label><span>:</span><span>{jobOrder.drawing_number || "-"}</span></div>
            <div className="form-row"><label>Sales</label><span>:</span><span>{jobOrder.sales_person_name}</span></div>
          </div>
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div className="subtle" style={{ marginBottom: 6, fontWeight: 700 }}>Approval Comments</div>
            {history.filter((h) => h.comment).length === 0 ? (
              <p className="subtle">No comments left along the way.</p>
            ) : (
              history.filter((h) => h.comment).map((h) => (
                <div key={h.id} style={{ fontSize: "0.85rem", padding: "4px 0", borderBottom: "1px solid var(--panel-muted)" }}>
                  <b>{h.changed_by}</b> <span className="subtle">({fmtDate(h.changed_at)})</span>: {h.comment}
                </div>
              ))
            )}
          </div>
        )}

        <div className="form-sheet" style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Serial Number</label><span>:</span><input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} /></div>
          </div>
          <div className="form-sheet-col">
            <div className="form-row"><label>Finish Date</label><span>:</span><DateField value={finishDate} onChange={setFinishDate} min={minFinishDate} /></div>
          </div>
        </div>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={saveDetails}>Save Serial No. / Finish Date</button>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, textTransform: "none", cursor: "pointer" }}>
          <input type="checkbox" checked={jobOrder.ready_for_production} onChange={toggleReadyForProduction} style={{ width: "auto" }} />
          Ready for Production
        </label>
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
