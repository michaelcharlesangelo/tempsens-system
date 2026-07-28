"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import DateField from "@/app/components/DateField";
import QrImage from "@/app/components/QrImage";
import { JobOrder, BomItem, JobOrderHistoryEntry, ProductionLog, fmtDate, fmtDateTime } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; unit?: string; }

export default function ProductionJobOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [bom, setBom] = useState<BomItem[]>([]);
  const [history, setHistory] = useState<JobOrderHistoryEntry[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  // One entry per unit (padded/truncated to match quantity) - a JO with
  // qty>1 needs a serial number per unit, not a single value.
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
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
    const qty = Math.max(1, Number(data.jobOrder?.quantity) || 1);
    const existing: string[] = data.jobOrder?.serial_numbers ?? [];
    setSerialNumbers(Array.from({ length: qty }, (_, i) => existing[i] ?? ""));
    setFinishDate(data.jobOrder?.finish_date ? data.jobOrder.finish_date.slice(0, 10) : "");
  }

  useEffect(() => { if (id) load(); }, [id]);

  async function printJobOrder() {
    if (!jobOrder) return;

    // QC parameter names/values routinely contain <, >, & (e.g. "IR > 100MΩ")
    // - interpolated raw into this HTML string, those characters break the
    // markup and garble the printed page. React escapes automatically for
    // the on-screen table; this string template doesn't, so it must be done
    // by hand for every dynamic value below.
    const esc = (value: unknown): string =>
      String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    const qrDataUrl = jobOrder.barcode ? await QRCode.toDataURL(jobOrder.barcode, { width: 110, margin: 1 }) : "";

    const bomRows = bom.map((b) => `
      <tr>
        <td>${esc(b.item_no)}</td><td>${esc(b.description)}</td><td>${esc(b.qty)}</td><td>${esc(b.unit)}</td>
        <td>${esc(b.actual_qty ?? "-")}</td><td>${esc(b.actual_unit ?? "-")}</td><td>${esc(b.comment || "-")}</td>
      </tr>`).join("");

    const comments = history.filter((h) => h.comment);
    const commentRows = comments.length
      ? comments.map((h) => `<div class="comment"><b>${esc(h.changed_by)}</b> <span class="muted">(${esc(fmtDateTime(h.changed_at))})</span>: ${esc(h.comment)}</div>`).join("")
      : `<div class="muted">None.</div>`;

    const qcRows = productionLogs.flatMap((log) =>
      (log.results.length > 0 ? log.results : [{ parameter: "-", actual: "-" }]).map((r) => `
        <tr>
          <td>${esc(fmtDateTime(log.scanned_at))}</td><td>${esc(log.station?.station_name ?? "-")}</td>
          <td>${esc(r.parameter)}</td><td>${esc(r.actual || "-")}</td><td>${esc(log.account?.full_name ?? log.scanned_by_label ?? "-")}</td>
        </tr>`)
    ).join("");

    const title = `Job Order, ${esc(jobOrder.so_no)}`;
    const html = `
      <html><head><title>${title}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .header h1 { font-size: 18px; margin: 0; flex: 1; text-align: center; }
        .qr { display: flex; align-items: center; gap: 8px; }
        .qr img { display: block; }
        table.info { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        table.info td { padding: 3px 6px; vertical-align: top; }
        table.info td.label { font-weight: bold; width: 110px; white-space: nowrap; }
        .section-title { font-weight: bold; text-transform: uppercase; font-size: 10px; margin: 10px 0 4px; border-top: 1px solid #999; padding-top: 6px; }
        .comment { font-size: 10px; padding: 2px 0; }
        .muted { color: #666; }
        table.bom, table.qc { width: 100%; border-collapse: collapse; margin-top: 4px; table-layout: fixed; }
        table.bom th, table.bom td, table.qc th, table.qc td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 10px; word-wrap: break-word; }
        table.bom th { background: #eee; }
        table.qc th { background: #eee; }
      </style>
      </head><body onload="window.focus();window.print();">
        <div class="header">
          <div style="width:70px"></div>
          <h1>JOB ORDER</h1>
          <div class="qr">
            ${qrDataUrl ? `<img src="${qrDataUrl}" width="60" height="60" />` : ""}
          </div>
        </div>
        <table class="info">
          <tr><td class="label">Customer Name</td><td>${esc(jobOrder.customer_name)}</td><td class="label">Item Code</td><td>${esc(jobOrder.item_no)}</td></tr>
          <tr><td class="label">SO Number</td><td>${esc(jobOrder.so_no)}</td><td class="label">JO Date</td><td>${esc(fmtDate(jobOrder.created_at))}</td></tr>
          <tr><td class="label">Item Description</td><td>${esc(jobOrder.item_description)}</td><td class="label">Deadline</td><td>${esc(fmtDate(jobOrder.deadline))}</td></tr>
          <tr><td class="label">Category</td><td>${esc(jobOrder.item_category)}</td><td class="label">Drawing Number</td><td>${esc(jobOrder.drawing_number || "-")}</td></tr>
          <tr><td class="label">Quantity</td><td>${esc(jobOrder.quantity)}</td><td class="label">Sales</td><td>${esc(jobOrder.sales_person_name)}</td></tr>
          <tr><td class="label">Serial Number(s)</td><td>${esc((jobOrder.serial_numbers ?? []).filter(Boolean).join(", ") || "-")}</td><td class="label">Finish Date</td><td>${esc(fmtDate(jobOrder.finish_date))}</td></tr>
        </table>

        <div class="section-title">Comments</div>
        ${commentRows}

        <div class="section-title">Material BOM</div>
        <table class="bom">
          <colgroup>
            <col style="width:10%"><col style="width:44%"><col style="width:6%"><col style="width:6%">
            <col style="width:7%"><col style="width:7%"><col style="width:20%">
          </colgroup>
          <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Actual</th><th>Unit</th><th>Comment (to Warehouse)</th></tr></thead>
          <tbody>${bomRows || `<tr><td colspan="7">No items yet.</td></tr>`}</tbody>
        </table>

        <div class="section-title">QC — Parameter</div>
        <table class="qc">
          <thead><tr><th>Time</th><th>Station</th><th>Parameter</th><th>Actual</th><th>Checked By</th></tr></thead>
          <tbody>${qcRows || `<tr><td colspan="5">No station scans yet.</td></tr>`}</tbody>
        </table>
      </body></html>
    `;

    // Blob URL instead of window.open("") + document.write - gives the
    // print window a real URL/title instead of "about:blank" in the
    // browser's own print header/footer.
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(blobUrl, "_blank", "width=850,height=1100");
  }

  async function saveDetails() {
    const res = await fetch(`/api/job-orders/${id}/details`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serialNumbers, finishDate }),
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
    return <p className="subtle">Loading...</p>;
  }

  const minFinishDate = jobOrder.jo_date ? jobOrder.jo_date.slice(0, 10) : jobOrder.created_at.slice(0, 10);

  return (
    <>
      <p style={{ marginBottom: 10 }}>
        <a
          href="/production-manager"
          className="subtle"
          onClick={(e) => {
            // Goes back to whichever tab actually linked here (Sales
            // Support Supervisor's costing table, Production Manager's own
            // list, etc.) instead of always landing on Production Manager.
            if (typeof window !== "undefined" && window.history.length > 1) {
              e.preventDefault();
              router.back();
            }
          }}
        >
          ← Back
        </a>
      </p>
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ width: 60 }} />
          <h2 style={{ margin: 0, textAlign: "center", flex: 1 }}>JOB ORDER</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px", whiteSpace: "nowrap" }} onClick={printJobOrder}>Print JO</button>
            {jobOrder.barcode && <QrImage value={jobOrder.barcode} size={60} />}
          </div>
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
                Comments
              </div>
              {history.filter((h) => h.comment).length === 0 ? (
                <p className="subtle" style={{ fontSize: "0.8rem", margin: 0 }}>None yet.</p>
              ) : (
                history.filter((h) => h.comment).map((h) => (
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
            <div className="form-row" style={{ alignItems: serialNumbers.length > 1 ? "flex-start" : "center" }}>
              <label style={{ paddingTop: serialNumbers.length > 1 ? 6 : 0 }}>Serial Number{serialNumbers.length > 1 ? "s" : ""}</label>
              <span>:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {serialNumbers.map((sn, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {serialNumbers.length > 1 && <span className="subtle" style={{ fontSize: "0.72rem" }}>#{i + 1}</span>}
                    <input
                      type="text"
                      value={sn}
                      onChange={(e) => setSerialNumbers((cur) => cur.map((v, vi) => (vi === i ? e.target.value : v)))}
                      style={serialNumbers.length > 1 ? { width: 110 } : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="form-sheet-col">
            <div className="form-row"><label>Est. Finish Date</label><span>:</span><DateField value={finishDate} onChange={setFinishDate} min={minFinishDate} /></div>
          </div>
        </div>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={saveDetails}>Save Serial Number(s) / Est. Finish Date</button>
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
            <table className="data-table fixed">
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Actual</th><th>Unit</th><th>N/A</th><th>Comment (to Warehouse)</th><th></th></tr></thead>
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
        <h2>QC — Parameter</h2>
        {productionLogs.length === 0 ? <p className="subtle" style={{ marginTop: 10 }}>No station scans yet.</p> : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="data-table">
              <thead><tr><th>Time</th><th>Station</th><th>Parameter</th><th>Actual</th><th>Checked By</th></tr></thead>
              <tbody>
                {productionLogs.flatMap((log) =>
                  (log.results.length > 0 ? log.results : [{ parameter: "-", actual: "-" }]).map((r, i) => (
                    <tr key={`${log.id}-${i}`}>
                      <td>{fmtDateTime(log.scanned_at)}</td>
                      <td>{log.station?.station_name ?? "-"}</td>
                      <td>{r.parameter}</td>
                      <td>{r.actual || "-"}</td>
                      <td>{log.account?.full_name ?? log.scanned_by_label ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
