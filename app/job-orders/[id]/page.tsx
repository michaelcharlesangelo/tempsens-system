"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import NavBar from "@/app/components/NavBar";
import QrImage from "@/app/components/QrImage";
import QrScanner from "@/app/components/QrScanner";
import { JobOrder, BomItem, PurchaseRequest, QcRecord, JobOrderHistoryEntry, ProductionLog, STATUS_LABELS, APPROVAL_LAYERS } from "@/lib/jobOrders";

interface ProfileOption { id: string; full_name: string; email: string; role: string; }
interface CatalogItem { item_code: string; description: string; }
interface StationOption { id: string; station_name: string; }

export default function JobOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [bom, setBom] = useState<BomItem[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [qcRecords, setQcRecords] = useState<QcRecord[]>([]);
  const [history, setHistory] = useState<JobOrderHistoryEntry[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [myProfile, setMyProfile] = useState<ProfileOption | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [bomCode, setBomCode] = useState("");
  const [bomDesc, setBomDesc] = useState("");
  const [bomSuggestions, setBomSuggestions] = useState<CatalogItem[]>([]);
  const [bomEstQty, setBomEstQty] = useState("1");
  const [bomActQty, setBomActQty] = useState("0");
  const [bomUnit, setBomUnit] = useState("pcs");

  const [prItem, setPrItem] = useState("");
  const [prQty, setPrQty] = useState("1");
  const [prBomItemId, setPrBomItemId] = useState("");
  const [prApproverId, setPrApproverId] = useState("");

  const [qcResult, setQcResult] = useState("pending");
  const [qcContinuity, setQcContinuity] = useState("pass");
  const [qcResistance, setQcResistance] = useState("");
  const [qcMegger, setQcMegger] = useState("");
  const [qcTemp, setQcTemp] = useState("pass");
  const [qcNotes, setQcNotes] = useState("");

  const [actionComment, setActionComment] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [drawingUrl, setDrawingUrl] = useState<string | null>(null);
  const [poUrl, setPoUrl] = useState<string | null>(null);

  const profileMap: Record<string, ProfileOption> = Object.fromEntries(profiles.map((p) => [p.id, p]));

  async function load() {
    const [detailRes, profilesRes, meRes, stationsRes] = await Promise.all([
      fetch(`/api/job-orders/${id}`, { cache: "no-store" }),
      fetch("/api/profiles", { cache: "no-store" }),
      fetch("/api/profile", { cache: "no-store" }),
      fetch("/api/station-codes", { cache: "no-store" }),
    ]);
    const detail = await detailRes.json();
    setJobOrder(detail.jobOrder);
    setBom(detail.bom ?? []);
    setPurchaseRequests(detail.purchaseRequests ?? []);
    setQcRecords(detail.qcRecords ?? []);
    setHistory(detail.history ?? []);
    setProductionLogs(detail.productionLogs ?? []);
    setProfiles((await profilesRes.json()).profiles ?? []);
    setMyProfile((await meRes.json()).profile ?? null);
    setStations(((await stationsRes.json()).stations ?? []).filter((s: { active: boolean }) => s.active));
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setMessage(null);
    const res = await fetch(`/api/job-orders/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment: actionComment, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Action failed."); return; }
    setActionComment("");
    load();
  }

  async function onBomCodeChange(value: string) {
    setBomCode(value);
    if (!value) { setBomSuggestions([]); return; }
    const res = await fetch(`/api/item-catalog?q=${encodeURIComponent(value)}`, { cache: "no-store" });
    const data = await res.json();
    setBomSuggestions(data.items ?? []);
  }

  async function addBomItem() {
    const res = await fetch(`/api/job-orders/${id}/bom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemCode: bomCode, description: bomDesc, estimatedQty: Number(bomEstQty), actualQty: Number(bomActQty), unit: bomUnit }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to add item."); return; }
    setBomCode(""); setBomDesc(""); setBomEstQty("1"); setBomActQty("0"); setBomSuggestions([]);
    load();
  }

  async function addPurchaseRequest() {
    const res = await fetch(`/api/job-orders/${id}/purchase-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: prItem, quantity: Number(prQty), bomItemId: prBomItemId || null, approverId: prApproverId || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to create purchase request."); return; }
    setPrItem(""); setPrQty("1"); setPrBomItemId(""); setPrApproverId("");
    load();
  }

  async function updatePrStatus(prId: string, status: string) {
    const res = await fetch(`/api/job-orders/${id}/purchase-requests/${prId}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to update."); return; }
    load();
  }

  async function addQcRecord() {
    const calibrationData: Record<string, unknown> = { meggerMOhm: qcMegger, temperatureTest: qcTemp };
    if (jobOrder?.item_category === "Thermocouple") calibrationData.continuity = qcContinuity;
    if (jobOrder?.item_category === "RTD") calibrationData.resistanceOhm = qcResistance;

    const res = await fetch(`/api/job-orders/${id}/qc`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: qcResult, reportNotes: qcNotes, calibrationData }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to add QC record."); return; }
    setQcNotes(""); setQcResult("pending"); setQcMegger(""); setQcResistance("");
    load();
  }

  async function markMaterialIssued() {
    const res = await fetch(`/api/job-orders/${id}/material-issued`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed."); return; }
    load();
  }

  async function onStationScan(stationCode: string) {
    setShowScanner(false);
    const res = await fetch(`/api/job-orders/${id}/scan`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stationCode }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Scan failed."); return; }
    setMessage(`Logged: ${data.station.station_name}`);
    load();
  }

  async function deleteLog(logId: string) {
    if (!confirm("Delete this production log entry?")) return;
    await fetch(`/api/job-orders/${id}/scan/${logId}/delete`, { method: "POST" });
    load();
  }

  async function uploadFile(type: "drawing" | "po", file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    const res = await fetch(`/api/job-orders/${id}/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Upload failed."); return; }
    load();
  }

  async function viewFile(type: "drawing" | "po") {
    const res = await fetch(`/api/job-orders/${id}/file?type=${type}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Can't open file."); return; }
    window.open(data.url, "_blank");
  }

  if (!jobOrder) {
    return (<><NavBar active="job-orders" /><p className="subtle">Loading...</p></>);
  }

  const isAdmin = myProfile?.role === "admin";
  const currentLayer = APPROVAL_LAYERS.find((l) => l.layer === jobOrder.current_approval_layer);
  const canApprove = currentLayer && myProfile && (isAdmin || myProfile.role === currentLayer.role);
  const canAcknowledge = myProfile && (isAdmin || myProfile.role === "production_manager");
  const canManageWarehouse = myProfile && (isAdmin || myProfile.role === "warehouse_manager");
  const canDeleteLogs = myProfile && ["admin", "production_manager", "warehouse_manager", "operational_manager"].includes(myProfile.role);
  const poVisible = jobOrder.po_attachment_url !== undefined;

  return (
    <>
      <NavBar active="job-orders" />
      {message && <div className="warn">{message}</div>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>{jobOrder.jo_number} — {jobOrder.customer_name}</h2>
            <p className="subtle" style={{ marginTop: 4 }}>{jobOrder.item_description || "No description."}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className={`pill pill-${jobOrder.status}`}>
              {STATUS_LABELS[jobOrder.status]}{currentLayer ? ` — ${currentLayer.label}` : ""}
            </span>
            {jobOrder.barcode && <QrImage value={jobOrder.barcode} size={70} />}
          </div>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          <div><label>SO No.</label><p>{jobOrder.so_no || "-"}</p></div>
          <div><label>Item category</label><p>{jobOrder.item_category || "-"}</p></div>
          <div><label>Item code</label><p>{jobOrder.item_code || "-"}</p></div>
          <div><label>Quantity</label><p>{jobOrder.quantity}</p></div>
          <div><label>Serial No.</label><p>{jobOrder.serial_no || "-"}</p></div>
          <div><label>Deadline</label><p>{jobOrder.deadline ? new Date(jobOrder.deadline).toLocaleDateString() : "-"}</p></div>
          <div><label>Finish date</label><p>{jobOrder.finish_date ? new Date(jobOrder.finish_date).toLocaleString() : "-"}</p></div>
          <div><label>Created</label><p>{new Date(jobOrder.created_at).toLocaleString()}</p></div>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          <div>
            <label>Drawing</label>
            {jobOrder.drawing_url ? (
              <button className="btn secondary" onClick={() => viewFile("drawing")}>View drawing</button>
            ) : (
              <input type="file" accept="application/pdf,image/*" onChange={(e) => e.target.files?.[0] && uploadFile("drawing", e.target.files[0])} />
            )}
          </div>
          {poVisible && (
            <div>
              <label>PO attachment (approvers only)</label>
              {jobOrder.po_attachment_url ? (
                <button className="btn secondary" onClick={() => viewFile("po")}>View PO</button>
              ) : (
                <input type="file" accept="application/pdf,image/*" onChange={(e) => e.target.files?.[0] && uploadFile("po", e.target.files[0])} />
              )}
            </div>
          )}
        </div>

        {/* Status actions */}
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          {jobOrder.status === "draft" && (
            <button className="btn" onClick={() => doAction("submit")}>Submit for approval</button>
          )}

          {jobOrder.status === "pending_approval" && canApprove && (
            <>
              <div className="field" style={{ maxWidth: 400 }}>
                <label>Comment (optional)</label>
                <input type="text" value={actionComment} onChange={(e) => setActionComment(e.target.value)} />
              </div>
              <button className="btn" onClick={() => doAction("approve")} style={{ marginRight: 8 }}>Approve ({currentLayer?.label})</button>
              <button className="btn danger" onClick={() => doAction("reject")}>Reject</button>
            </>
          )}
          {jobOrder.status === "pending_approval" && !canApprove && (
            <p className="subtle">Waiting on {currentLayer?.label}.</p>
          )}

          {jobOrder.status === "approved" && canAcknowledge && (
            <button className="btn" onClick={() => doAction("acknowledge")}>Acknowledge (Production Manager)</button>
          )}
          {jobOrder.status === "approved" && !canAcknowledge && (
            <p className="subtle">Waiting on Production Manager to acknowledge.</p>
          )}

          {["acknowledged", "in_progress"].includes(jobOrder.status) && (
            <button className="btn" onClick={() => doAction("send_to_qc")}>Send to QC</button>
          )}
          {jobOrder.status === "qc" && (
            <button className="btn" onClick={() => doAction("complete")}>Mark completed</button>
          )}
          {jobOrder.status === "completed" && (
            <button className="btn secondary" onClick={() => window.print()}>Print job order</button>
          )}

          {["draft", "pending_approval", "approved", "acknowledged", "in_progress", "qc"].includes(jobOrder.status) && (
            <button className="btn secondary" style={{ marginLeft: 8 }} onClick={() => doAction("cancel")}>Cancel</button>
          )}
        </div>
      </div>

      {/* Warehouse */}
      {["acknowledged", "in_progress"].includes(jobOrder.status) && (
        <div className="card">
          <h2>Warehouse</h2>
          <p className="subtle">Material status: {jobOrder.material_issued ? `Issued at ${new Date(jobOrder.material_issued_at!).toLocaleString()}` : "Not yet issued"}</p>
          {canManageWarehouse && !jobOrder.material_issued && (
            <button className="btn secondary" onClick={markMaterialIssued}>Mark material issued</button>
          )}
        </div>
      )}

      {/* BOM */}
      <div className="card">
        <h2>Material BOM</h2>
        {bom.length === 0 ? <p className="subtle">No items yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Item code</th><th>Description</th><th>Est. qty</th><th>Actual qty</th></tr></thead>
            <tbody>
              {bom.map((b) => (
                <tr key={b.id}><td>{b.item_code}</td><td>{b.description}</td><td>{b.estimated_qty} {b.unit}</td><td>{b.actual_qty} {b.unit}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="field" style={{ position: "relative" }}>
            <label>Item code</label>
            <input type="text" value={bomCode} onChange={(e) => onBomCodeChange(e.target.value)} autoComplete="off" />
            {bomSuggestions.length > 0 && (
              <div style={{ position: "absolute", zIndex: 10, background: "white", border: "1px solid var(--border)", borderRadius: 8, width: "100%", maxHeight: 160, overflowY: "auto" }}>
                {bomSuggestions.map((s) => (
                  <div key={s.item_code} onClick={() => { setBomCode(s.item_code); setBomDesc(s.description); setBomSuggestions([]); }} style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--panel-muted)" }}>
                    <b>{s.item_code}</b> — {s.description}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field"><label>Description</label><input type="text" value={bomDesc} onChange={(e) => setBomDesc(e.target.value)} /></div>
          <div className="field"><label>Estimated qty</label><input type="number" value={bomEstQty} onChange={(e) => setBomEstQty(e.target.value)} /></div>
          <div className="field"><label>Actual qty</label><input type="number" value={bomActQty} onChange={(e) => setBomActQty(e.target.value)} /></div>
          <div className="field"><label>Unit</label><input type="text" value={bomUnit} onChange={(e) => setBomUnit(e.target.value)} /></div>
        </div>
        <button className="btn secondary" onClick={addBomItem} disabled={!bomCode.trim()}>+ Add BOM item</button>
      </div>

      {/* Purchase requests */}
      <div className="card">
        <h2>Purchase requests</h2>
        {purchaseRequests.length === 0 ? <p className="subtle">None yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Status</th><th>Approver</th><th></th></tr></thead>
            <tbody>
              {purchaseRequests.map((pr) => (
                <tr key={pr.id}>
                  <td>{pr.item_name}</td><td>{pr.quantity}</td>
                  <td><span className={`pill pill-${pr.status}`}>{pr.status}</span></td>
                  <td>{pr.approver_id ? (profileMap[pr.approver_id]?.full_name || "-") : "-"}</td>
                  <td>
                    {pr.status === "pending" && myProfile && (isAdmin || myProfile.id === pr.approver_id) && (
                      <>
                        <button className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 8px" }} onClick={() => updatePrStatus(pr.id, "approved")}>Approve</button>{" "}
                        <button className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 8px" }} onClick={() => updatePrStatus(pr.id, "rejected")}>Reject</button>
                      </>
                    )}
                    {pr.status === "approved" && <button className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 8px" }} onClick={() => updatePrStatus(pr.id, "ordered")}>Mark ordered</button>}
                    {pr.status === "ordered" && <button className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 8px" }} onClick={() => updatePrStatus(pr.id, "received")}>Mark received</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="field"><label>Item name</label><input type="text" value={prItem} onChange={(e) => setPrItem(e.target.value)} /></div>
          <div className="field"><label>Quantity</label><input type="number" value={prQty} onChange={(e) => setPrQty(e.target.value)} /></div>
          <div className="field">
            <label>Link to BOM item (optional)</label>
            <select value={prBomItemId} onChange={(e) => setPrBomItemId(e.target.value)}>
              <option value="">None</option>
              {bom.map((b) => <option key={b.id} value={b.id}>{b.item_code}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Approver</label>
            <select value={prApproverId} onChange={(e) => setPrApproverId(e.target.value)}>
              <option value="">Select...</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </div>
        </div>
        <button className="btn secondary" onClick={addPurchaseRequest} disabled={!prItem.trim()}>+ Request purchase</button>
      </div>

      {/* Production scanning */}
      {["acknowledged", "in_progress"].includes(jobOrder.status) && (
        <div className="card">
          <h2>Production log</h2>
          <p className="subtle">Scan a station QR code to log a production step against this job order.</p>
          {!showScanner ? (
            <button className="btn secondary" onClick={() => setShowScanner(true)}>Scan station QR</button>
          ) : (
            <QrScanner onScan={onStationScan} onClose={() => setShowScanner(false)} />
          )}
          {productionLogs.length > 0 && (
            <table className="data-table" style={{ marginTop: 14 }}>
              <thead><tr><th>Station</th><th>By</th><th>When</th><th></th></tr></thead>
              <tbody>
                {productionLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{stations.find((s) => s.id === log.station_id)?.station_name || "-"}</td>
                    <td>{profileMap[log.scanned_by]?.full_name || "-"}</td>
                    <td>{new Date(log.scanned_at).toLocaleString()}</td>
                    <td>{canDeleteLogs && <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => deleteLog(log.id)}>Delete</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* QC */}
      <div className="card">
        <h2>QC records</h2>
        {qcRecords.length === 0 ? <p className="subtle">None yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Result</th><th>Details</th><th>Notes</th></tr></thead>
            <tbody>
              {qcRecords.map((q) => (
                <tr key={q.id}>
                  <td>{new Date(q.performed_at).toLocaleString()}</td>
                  <td><span className={`pill pill-${q.result}`}>{q.result}</span></td>
                  <td style={{ fontSize: "0.8rem" }}>{JSON.stringify(q.calibration_data)}</td>
                  <td>{q.report_notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Overall result</label>
            <select value={qcResult} onChange={(e) => setQcResult(e.target.value)}>
              <option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option>
            </select>
          </div>
          {jobOrder.item_category === "Thermocouple" && (
            <div className="field">
              <label>Continuity</label>
              <select value={qcContinuity} onChange={(e) => setQcContinuity(e.target.value)}>
                <option value="pass">Pass</option><option value="fail">Fail</option>
              </select>
            </div>
          )}
          {jobOrder.item_category === "RTD" && (
            <div className="field"><label>Resistance (Ω)</label><input type="text" value={qcResistance} onChange={(e) => setQcResistance(e.target.value)} /></div>
          )}
          <div className="field"><label>Megger (MΩ, must be &gt;2)</label><input type="text" value={qcMegger} onChange={(e) => setQcMegger(e.target.value)} /></div>
          <div className="field">
            <label>Temperature test (100°C)</label>
            <select value={qcTemp} onChange={(e) => setQcTemp(e.target.value)}>
              <option value="pass">Pass</option><option value="fail">Fail</option>
            </select>
          </div>
        </div>
        <div className="field"><label>Report notes</label><input type="text" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} /></div>
        <button className="btn secondary" onClick={addQcRecord}>+ Add QC record</button>
      </div>

      {/* History */}
      <div className="card">
        <h2>History</h2>
        {history.length === 0 ? <p className="subtle">No history yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Status</th><th>By</th><th>Comment</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.changed_at).toLocaleString()}</td>
                  <td>{h.status}</td>
                  <td>{profileMap[h.changed_by]?.full_name || "-"}</td>
                  <td>{h.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
