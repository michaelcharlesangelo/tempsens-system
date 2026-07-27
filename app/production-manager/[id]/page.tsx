"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TabNav from "@/app/components/TabNav";
import DateField from "@/app/components/DateField";
import QrImage from "@/app/components/QrImage";
import { JobOrder, BomItem, JobOrderHistoryEntry, ProductionLog, fmtDate, fmtDateTime } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; unit?: string; }

// Only approval-layer comments are relevant here - Sales Support's own
// create/edit history is noise for Production Manager.
const APPROVAL_COMMENT_AUTHORS = ["Sales Manager", "Operational Manager", "General Manager"];

export default function ProductionJobOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [bom, setBom] = useState<BomItem[]>([]);
  const [history, setHistory] = useState<JobOrderHistoryEntry[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

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
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch(`/api/job-orders/${id}?tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    setJobOrder(data.jobOrder);
    // Newest item first, so a freshly added row shows up at the top instead
    // of getting buried at the bottom of a long BOM.
    const rows: BomItem[] = data.bom ?? [];
    setBom([...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    setHistory(data.history ?? []);
    setProductionLogs(data.productionLogs ?? []);
    setSerialNo(data.jobOrder?.serial_no || "");
    setFinishDate(data.jobOrder?.finish_date ? data.jobOrder.finish_date.slice(0, 10) : "");
  }

  useEffect(() => { if (id) load(); }, [id]);

  function printJobOrder() {
    if (!jobOrder) return;
    const w = window.open("", "_blank", "width=850,height=1100");
    if (!w) return;
    const rows = bom.map((b) => `<tr><td>${b.item_no}</td><td>${b.description}</td><td>${b.qty}</td><td>${b.unit}</td></tr>`).join("");
    w.document.write(`
      <html><head><title>${jobOrder.jo_number}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
        h1 { font-size: 16px; text-align: center; margin: 0 0 10px; }
        table.info { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        table.info td { padding: 3px 6px; vertical-align: top; }
        table.info td.label { font-weight: bold; width: 110px; }
        table.bom { width: 100%; border-collapse: collapse; }
        table.bom th, table.bom td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 10px; }
        table.bom th { background: #eee; }
      </style>
      </head><body onload="window.focus();window.print();">
        <h1>JOB ORDER — ${jobOrder.jo_number}</h1>
        <table class="info">
          <tr><td class="label">Customer Name</td><td>${jobOrder.customer_name}</td><td class="label">Item Code</td><td>${jobOrder.item_no}</td></tr>
          <tr><td class="label">SO Number</td><td>${jobOrder.so_no}</td><td class="label">JO Date</td><td>${fmtDate(jobOrder.created_at)}</td></tr>
          <tr><td class="label">Item Description</td><td>${jobOrder.item_description}</td><td class="label">Deadline</td><td>${fmtDate(jobOrder.deadline)}</td></tr>
          <tr><td class="label">Category</td><td>${jobOrder.item_category}</td><td class="label">Drawing Number</td><td>${jobOrder.drawing_number || "-"}</td></tr>
          <tr><td class="label">Quantity</td><td>${jobOrder.quantity}</td><td class="label">Sales</td><td>${jobOrder.sales_person_name}</td></tr>
        </table>
        <table class="bom">
          <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4">No items yet.</td></tr>`}</tbody>
        </table>
      </body></html>
    `);
    w.document.close();
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
    const items: CatalogItem[] = data.items ?? [];
    setSuggestions(items);
    // Exact match while typing (no click needed) - autofills unit/description
    // straight away since the code is already fully known to the catalog.
    const exact = items.find((s) => s.item_no.toLowerCase() === value.toLowerCase());
    if (exact) {
      if (exact.unit) setNewUnit(exact.unit);
      if (exact.description) setNewDescription(exact.description);
    }
  }

  function pickSuggestion(item: CatalogItem) {
    setNewItemNo(item.item_no);
    setNewDescription(item.description);
    if (item.unit) setNewUnit(item.unit);
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

  async function saveComment(row: BomItem) {
    const comment = commentDraft[row.id] ?? row.comment ?? "";
    await fetch(`/api/job-orders/${id}/bom/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    setSavedRowId(row.id);
    setTimeout(() => setSavedRowId((cur) => (cur === row.id ? null : cur)), 1800);
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ width: 92 }} />
          <h2 style={{ margin: 0, textAlign: "center", flex: 1 }}>JOB ORDER</h2>
          {jobOrder.barcode && (
            <div style={{ textAlign: "center" }}>
              <button className="btn secondary" style={{ marginBottom: 6 }} onClick={printJobOrder}>Print JO</button>
              <div><QrImage value={jobOrder.barcode} size={92} /></div>
              <div className="subtle" style={{ fontSize: "0.68rem", marginTop: 2 }}>{jobOrder.barcode}</div>
            </div>
          )}
        </div>

        <div className="form-sheet" style={{ marginTop: 6 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Customer Name</label><span>:</span><span>{jobOrder.customer_name}</span></div>
            <div className="form-row"><label>SO Number</label><span>:</span><span>{jobOrder.so_no}</span></div>
            <div className="form-row"><label>Item Description</label><span>:</span><span>{jobOrder.item_description}</span></div>
            <div className="form-row"><label>Category</label><span>:</span><span>{jobOrder.item_category}</span></div>
            <div className="form-row"><label>Quantity</label><span>:</span><span>{jobOrder.quantity}</span></div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--panel-muted)" }}>
              <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
                Comments (Sales / Operational / General Manager)
              </div>
              {history.filter((h) => APPROVAL_COMMENT_AUTHORS.includes(h.changed_by) && h.comment).length === 0 ? (
                <p className="subtle" style={{ fontSize: "0.8rem", margin: 0 }}>None yet.</p>
              ) : (
                history.filter((h) => APPROVAL_COMMENT_AUTHORS.includes(h.changed_by) && h.comment).map((h) => (
                  <div key={h.id} style={{ fontSize: "0.8rem", padding: "3px 0" }}>
                    <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="form-sheet-col">
            <div className="form-row"><label>Item Code</label><span>:</span><span>{jobOrder.item_no}</span></div>
            <div className="form-row"><label>JO Date</label><span>:</span><span>{fmtDate(jobOrder.created_at)}</span></div>
            <div className="form-row"><label>Deadline</label><span>:</span><span>{fmtDate(jobOrder.deadline)}{jobOrder.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</span></div>
            <div className="form-row"><label>Drawing Number</label><span>:</span><span>{jobOrder.drawing_number || "-"}</span></div>
            <div className="form-row"><label>Sales</label><span>:</span><span>{jobOrder.sales_person_name}</span></div>
          </div>
        </div>

        <div className="form-sheet" style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Serial Number</label><span>:</span><input type="text" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} /></div>
          </div>
          <div className="form-sheet-col">
            <div className="form-row"><label>Finish Date</label><span>:</span><DateField value={finishDate} onChange={setFinishDate} min={minFinishDate} /></div>
          </div>
        </div>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={saveDetails}>Save Serial No. / Finish Date</button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Material BOM</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
            <input type="checkbox" checked={jobOrder.ready_for_production} onChange={toggleReadyForProduction} style={{ width: "auto" }} />
            Ready for Production
          </label>
        </div>

        {bom.length === 0 ? <p className="subtle" style={{ marginTop: 10 }}>No items yet.</p> : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="data-table">
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Actual Qty</th><th>Actual Unit</th><th>N/A</th><th>Comment (to Warehouse)</th><th></th></tr></thead>
              <tbody>
                {bom.map((row) => (
                  <tr key={row.id}>
                    {editingRowId === row.id ? (
                      <>
                        <td><input type="text" value={editDraft.itemNo} onChange={(e) => setEditDraft({ ...editDraft, itemNo: e.target.value })} /></td>
                        <td><input type="text" value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
                        <td><input type="number" value={editDraft.qty} onChange={(e) => setEditDraft({ ...editDraft, qty: e.target.value })} style={{ width: 60 }} /></td>
                        <td><input type="text" value={editDraft.unit} onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })} style={{ width: 55 }} /></td>
                        <td className="subtle">{row.actual_qty ?? "-"}</td>
                        <td className="subtle">{row.actual_unit ?? "-"}</td>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={!row.material_ready} onChange={() => toggleNotAvailable(row)} style={{ width: "auto" }} /></td>
                        <td className="subtle">{row.comment || "-"}</td>
                        <td><button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => saveEditRow(row.id)}>Save</button></td>
                      </>
                    ) : (
                      <>
                        <td>{row.item_no}</td>
                        <td>{row.description}</td>
                        <td>{row.qty}</td>
                        <td>{row.unit}</td>
                        <td>{row.actual_qty ?? <span className="subtle">-</span>}</td>
                        <td>{row.actual_unit ?? <span className="subtle">-</span>}</td>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={!row.material_ready} onChange={() => toggleNotAvailable(row)} style={{ width: "auto" }} /></td>
                        <td>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input
                              type="text"
                              placeholder="Note for Warehouse..."
                              value={commentDraft[row.id] ?? row.comment ?? ""}
                              onChange={(e) => setCommentDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                              style={{ fontSize: "0.78rem", padding: "4px 6px" }}
                            />
                            <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "4px 6px" }} onClick={() => saveComment(row)}>Save</button>
                            {savedRowId === row.id && <span style={{ color: "var(--good)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>✓ Saved</span>}
                          </div>
                        </td>
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

        <div className="grid" style={{ marginTop: 14, gridTemplateColumns: "0.5fr 2fr 0.4fr 0.4fr" }}>
          <div className="field" style={{ position: "relative" }}>
            <label>Item Code</label>
            <input type="text" value={newItemNo} onChange={(e) => onNewItemNoChange(e.target.value)} autoComplete="off" style={{ maxWidth: 130 }} />
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

      <div className="card">
        <h2>QC — Station Scans</h2>
        {productionLogs.length === 0 ? <p className="subtle" style={{ marginTop: 10 }}>No station scans yet.</p> : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="data-table">
              <thead><tr><th>Time</th><th>Station</th><th>Parameter</th><th>Actual</th><th>By</th></tr></thead>
              <tbody>
                {productionLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{fmtDateTime(log.scanned_at)}</td>
                    <td>{log.station?.station_name ?? "-"}</td>
                    <td>{log.station?.parameter || "-"}</td>
                    <td>{log.actual_value || "-"}</td>
                    <td>{log.account?.full_name ?? "-"}</td>
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
