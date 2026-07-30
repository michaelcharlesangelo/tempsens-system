"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import DateField from "@/app/components/DateField";
import PoStatusSlider from "@/app/components/PoStatusSlider";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import {
  PoOut, Shipment, Supplier, SupplierTabCategory, SUPPLIER_TAB_CATEGORIES, PoOutStatus, PO_OUT_STATUSES,
  fmtDate, fmtDateTime, exportPoOutRecapToExcel,
} from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

const EXIM_COLUMNS: { key: string; label: string }[] = [
  { key: "poDate", label: "PO Date" },
  { key: "days", label: "Days" },
  { key: "deadline", label: "Deadline" },
  { key: "poNumber", label: "PO Number" },
  { key: "itemCode", label: "Item Code" },
  { key: "sales", label: "Sales" },
  { key: "customerName", label: "Customer Name" },
  { key: "itemDescription", label: "Item Description" },
  { key: "qty", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "supplier", label: "Supplier" },
  { key: "status", label: "Status" },
  { key: "oc", label: "OC" },
  { key: "origin", label: "Origin" },
  { key: "shipment", label: "Shipment" },
];

function eximCellText(p: PoOut, key: string): string {
  switch (key) {
    case "poDate": return fmtDate(p.po_date);
    case "days": return String(daysSince(p.po_date));
    case "deadline": return fmtDate(p.deadline) + (p.urgent ? " (URGENT)" : "");
    case "poNumber": return p.po_number;
    case "itemCode": return p.item_code;
    case "sales": return p.sales;
    case "customerName": return p.customer_name;
    case "itemDescription": return p.item_description;
    case "qty": return String(p.qty);
    case "unit": return p.unit;
    case "supplier": return p.supplier;
    case "status": return PO_OUT_STATUSES.find((s) => s.value === p.status)?.label ?? p.status;
    case "oc": return p.oc;
    case "origin": return p.origin;
    case "shipment": return p.shipment;
    default: return "";
  }
}

// Calendar-day difference, same convention as Dashboard's daysSince.
function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
}

function poMatches(p: PoOut, term: string): boolean {
  return (
    p.po_number.toLowerCase().includes(term) ||
    p.item_code.toLowerCase().includes(term) ||
    p.customer_name.toLowerCase().includes(term) ||
    p.supplier.toLowerCase().includes(term) ||
    fmtDate(p.po_date).includes(term)
  );
}

type SortKey = "po_date" | "po_number" | "item_code" | "sales" | "customer_name" | "supplier" | "shipment";

interface FieldsDraft { oc: string; origin: string; }

interface ShipmentDraft {
  shipmentNumber: string; supplier: string; shipmentVia: string; incoterms: string; invoice: string;
  awbBl: string; atd: string; etaJkt: string; sppb: string; delivery: string;
}

function blankShipmentDraft(): ShipmentDraft {
  return { shipmentNumber: "", supplier: "", shipmentVia: "", incoterms: "", invoice: "", awbBl: "", atd: "", etaJkt: "", sppb: "", delivery: "" };
}

function shipmentMatches(s: Shipment, term: string): boolean {
  return s.shipment_number.toLowerCase().includes(term) || s.supplier.toLowerCase().includes(term) || s.invoice.toLowerCase().includes(term);
}

export default function EximPage() {
  const currentRole = getCurrentRole();

  // ---------------- Shipment Plan ----------------
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState<ShipmentDraft>(blankShipmentDraft());
  const [awbBlFile, setAwbBlFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);
  const [editShipmentDraft, setEditShipmentDraft] = useState<ShipmentDraft | null>(null);
  const [editAwbBlFile, setEditAwbBlFile] = useState<File | null>(null);
  const [editPhotoFiles, setEditPhotoFiles] = useState<File[]>([]);

  // ---------------- PO table ----------------
  const [pos, setPos] = useState<PoOut[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeTab, setActiveTab] = useState<SupplierTabCategory | "ALL">("ALL");
  const [showProduction, setShowProduction] = useState(true);
  const [showShipment, setShowShipment] = useState(true);
  const [showArrived, setShowArrived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [updatesOpenId, setUpdatesOpenId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<Record<string, PoOutStatus>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [editingFieldsId, setEditingFieldsId] = useState<string | null>(null);
  const [fieldsDraft, setFieldsDraft] = useState<FieldsDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadPos() {
    const res = await fetch("/api/po-out", { cache: "no-store" });
    const data = await res.json();
    setPos(data.pos ?? []);
  }
  async function loadSuppliers() {
    const res = await fetch("/api/suppliers", { cache: "no-store" });
    const data = await res.json();
    setSuppliers(data.suppliers ?? []);
  }
  async function loadShipments() {
    const res = await fetch("/api/shipments", { cache: "no-store" });
    const data = await res.json();
    setShipments(data.shipments ?? []);
  }

  useEffect(() => { loadPos(); loadSuppliers(); loadShipments(); }, []);

  // ---------------- Shipment Plan actions ----------------
  function resetShipmentForm() {
    setShipmentDraft(blankShipmentDraft());
    setAwbBlFile(null);
    setPhotoFiles([]);
    setShowShipmentForm(false);
    setShipmentError(null);
  }

  async function submitShipment() {
    if (!shipmentDraft.shipmentNumber.trim()) { setShipmentError("Shipment Number is required."); return; }
    setShipmentError(null);
    setShipmentSaving(true);
    try {
      const fd = new FormData();
      fd.append("shipmentNumber", shipmentDraft.shipmentNumber);
      fd.append("supplier", shipmentDraft.supplier);
      fd.append("shipmentVia", shipmentDraft.shipmentVia);
      fd.append("incoterms", shipmentDraft.incoterms);
      fd.append("invoice", shipmentDraft.invoice);
      fd.append("awbBl", shipmentDraft.awbBl);
      fd.append("atd", shipmentDraft.atd);
      fd.append("etaJkt", shipmentDraft.etaJkt);
      fd.append("sppb", shipmentDraft.sppb);
      fd.append("delivery", shipmentDraft.delivery);
      fd.append("submittedBy", currentRole.label);
      if (awbBlFile) fd.append("awbBlFile", awbBlFile);
      photoFiles.forEach((f) => fd.append("photos", f));

      const res = await fetch("/api/shipments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setShipmentError(data.error || "Failed to save shipment."); return; }
      resetShipmentForm();
      loadShipments();
    } finally {
      setShipmentSaving(false);
    }
  }

  function startShipmentEdit(s: Shipment) {
    setEditingShipmentId(s.id);
    setEditShipmentDraft({
      shipmentNumber: s.shipment_number, supplier: s.supplier, shipmentVia: s.shipment_via, incoterms: s.incoterms,
      invoice: s.invoice, awbBl: s.awb_bl, atd: s.atd ? s.atd.slice(0, 10) : "", etaJkt: s.eta_jkt ? s.eta_jkt.slice(0, 10) : "",
      sppb: s.sppb, delivery: s.delivery,
    });
    setEditAwbBlFile(null);
    setEditPhotoFiles([]);
  }

  async function saveShipmentEdit(id: string) {
    if (!editShipmentDraft) return;
    const fd = new FormData();
    fd.append("shipmentNumber", editShipmentDraft.shipmentNumber);
    fd.append("supplier", editShipmentDraft.supplier);
    fd.append("shipmentVia", editShipmentDraft.shipmentVia);
    fd.append("incoterms", editShipmentDraft.incoterms);
    fd.append("invoice", editShipmentDraft.invoice);
    fd.append("awbBl", editShipmentDraft.awbBl);
    fd.append("atd", editShipmentDraft.atd);
    fd.append("etaJkt", editShipmentDraft.etaJkt);
    fd.append("sppb", editShipmentDraft.sppb);
    fd.append("delivery", editShipmentDraft.delivery);
    if (editAwbBlFile) fd.append("awbBlFile", editAwbBlFile);
    editPhotoFiles.forEach((f) => fd.append("photos", f));

    const res = await fetch(`/api/shipments/${id}`, { method: "PATCH", body: fd });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save shipment."); return; }
    setEditingShipmentId(null);
    setEditShipmentDraft(null);
    loadShipments();
  }

  async function deleteShipment(id: string) {
    if (!confirm("Delete this shipment? This can't be undone.")) return;
    const res = await fetch(`/api/shipments/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || "Failed to delete."); return; }
    setEditingShipmentId(null);
    setEditShipmentDraft(null);
    loadShipments();
  }

  async function viewFile(path: string) {
    const res = await fetch(`/api/purchase-forms/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  const shipmentsPaged = usePagedSearch(shipments ?? [], shipmentMatches);

  // ---------------- PO table actions ----------------
  function openUpdates(p: PoOut) {
    if (updatesOpenId === p.id) { setUpdatesOpenId(null); return; }
    setUpdatesOpenId(p.id);
    setStatusDraft((cur) => ({ ...cur, [p.id]: p.status }));
    setCommentDraft((cur) => ({ ...cur, [p.id]: cur[p.id] ?? "" }));
  }

  async function saveStatusUpdate(p: PoOut) {
    const status = statusDraft[p.id] ?? p.status;
    const comment = (commentDraft[p.id] ?? "").trim();
    setSavingStatusId(p.id);
    try {
      const res = await fetch(`/api/po-out/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setStatus", status, comment, changedBy: currentRole.label }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to save update."); return; }
      setCommentDraft((cur) => ({ ...cur, [p.id]: "" }));
      loadPos();
    } finally {
      setSavingStatusId(null);
    }
  }

  function startFieldsEdit(p: PoOut) {
    setEditingFieldsId(p.id);
    setFieldsDraft({ oc: p.oc, origin: p.origin });
  }

  async function saveFieldsEdit(id: string) {
    if (!fieldsDraft) return;
    const res = await fetch(`/api/po-out/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fieldsDraft),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save."); return; }
    setEditingFieldsId(null);
    setFieldsDraft(null);
    loadPos();
  }

  // Shipment is its own standalone dropdown (not gated behind the OC/Origin
  // Edit flow) - picking a value saves immediately.
  async function updateShipment(id: string, shipment: string) {
    const res = await fetch(`/api/po-out/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shipment }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save."); return; }
    loadPos();
  }

  function sortBy(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortKey(key);
    setSortDir("asc");
  }

  const supplierCategory = new Map(suppliers.map((s) => [s.name, s.tab_category]));
  const statusVisible: Record<PoOutStatus, boolean> = { production: showProduction, shipment: showShipment, arrived: showArrived };
  const filtered = (pos ?? []).filter((p) => (activeTab === "ALL" || supplierCategory.get(p.supplier) === activeTab) && statusVisible[p.status]);
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(sorted, poMatches);

  return (
    <>
      {message && <div className="warn">{message}</div>}

      <Collapsible title="Shipment Plan" count={shipments?.length} defaultOpen>
        {!showShipmentForm && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {shipments && shipments.length > 0 ? <SearchBox value={shipmentsPaged.search} onChange={shipmentsPaged.setSearch} /> : <div />}
            <button className="btn" onClick={() => setShowShipmentForm(true)}>+ New Shipment</button>
          </div>
        )}

        {showShipmentForm && (
          <div style={{ marginBottom: 18 }}>
            <div className="form-sheet" style={{ marginTop: 4 }}>
              <div className="form-sheet-col">
                <div className="form-row"><label>Shipment Number</label><span>:</span><input type="text" value={shipmentDraft.shipmentNumber} onChange={(e) => setShipmentDraft({ ...shipmentDraft, shipmentNumber: e.target.value.toUpperCase() })} /></div>
                <div className="form-row">
                  <label>Supplier</label><span>:</span>
                  <select value={shipmentDraft.supplier} onChange={(e) => setShipmentDraft({ ...shipmentDraft, supplier: e.target.value })}>
                    <option value="">Select...</option>
                    {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-row"><label>Shipment Via</label><span>:</span><input type="text" value={shipmentDraft.shipmentVia} onChange={(e) => setShipmentDraft({ ...shipmentDraft, shipmentVia: e.target.value })} /></div>
                <div className="form-row"><label>Incoterms</label><span>:</span><input type="text" value={shipmentDraft.incoterms} onChange={(e) => setShipmentDraft({ ...shipmentDraft, incoterms: e.target.value.toUpperCase() })} /></div>
                <div className="form-row"><label>Invoice</label><span>:</span><input type="text" value={shipmentDraft.invoice} onChange={(e) => setShipmentDraft({ ...shipmentDraft, invoice: e.target.value })} /></div>
              </div>
              <div className="form-sheet-col">
                <div className="form-row"><label>AWB/BL</label><span>:</span><input type="text" value={shipmentDraft.awbBl} onChange={(e) => setShipmentDraft({ ...shipmentDraft, awbBl: e.target.value })} /></div>
                <div className="form-row"><label>ATD</label><span>:</span><DateField value={shipmentDraft.atd} onChange={(v) => setShipmentDraft({ ...shipmentDraft, atd: v })} /></div>
                <div className="form-row"><label>ETA JKT</label><span>:</span><DateField value={shipmentDraft.etaJkt} onChange={(v) => setShipmentDraft({ ...shipmentDraft, etaJkt: v })} /></div>
                <div className="form-row"><label>SPPB</label><span>:</span><input type="text" value={shipmentDraft.sppb} onChange={(e) => setShipmentDraft({ ...shipmentDraft, sppb: e.target.value })} /></div>
                <div className="form-row"><label>Delivery</label><span>:</span><input type="text" value={shipmentDraft.delivery} onChange={(e) => setShipmentDraft({ ...shipmentDraft, delivery: e.target.value })} /></div>
              </div>
            </div>

            <div className="form-sheet" style={{ marginTop: 18 }}>
              <div className="form-sheet-col">
                <div className="form-row">
                  <label>AWB/BL</label><span>:</span>
                  <input type="file" onChange={(e) => setAwbBlFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div className="form-sheet-col">
                <div className="form-row">
                  <label>Photos</label><span>:</span>
                  <input type="file" multiple onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} />
                </div>
              </div>
            </div>

            {shipmentError && <p className="error-text">{shipmentError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={submitShipment} disabled={shipmentSaving}>{shipmentSaving ? "Saving..." : "Submit"}</button>
              <button className="btn secondary" onClick={resetShipmentForm}>Cancel</button>
            </div>
          </div>
        )}

        {!shipments ? <p className="subtle">Loading...</p> : shipments.length === 0 ? <p className="subtle">No shipments drafted yet.</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Shipment No.</th><th>Supplier</th><th>Via</th><th>Incoterms</th><th>Invoice</th>
                    <th>AWB/BL</th><th>ATD</th><th>ETA JKT</th><th>SPPB</th><th>Delivery</th><th>Files</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {shipmentsPaged.pageItems.map((s) => {
                    const isEditing = editingShipmentId === s.id;
                    const d = editShipmentDraft;
                    return (
                      <tr key={s.id}>
                        <td>{isEditing && d ? <input type="text" value={d.shipmentNumber} onChange={(e) => setEditShipmentDraft({ ...d, shipmentNumber: e.target.value.toUpperCase() })} style={{ fontSize: "0.8rem", width: 100 }} /> : s.shipment_number}</td>
                        <td>
                          {isEditing && d ? (
                            <select value={d.supplier} onChange={(e) => setEditShipmentDraft({ ...d, supplier: e.target.value })} style={{ fontSize: "0.8rem" }}>
                              <option value="">Select...</option>
                              {suppliers.map((sp) => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
                            </select>
                          ) : s.supplier || <span className="subtle">-</span>}
                        </td>
                        <td>{isEditing && d ? <input type="text" value={d.shipmentVia} onChange={(e) => setEditShipmentDraft({ ...d, shipmentVia: e.target.value })} style={{ fontSize: "0.8rem", width: 90 }} /> : s.shipment_via || <span className="subtle">-</span>}</td>
                        <td>{isEditing && d ? <input type="text" value={d.incoterms} onChange={(e) => setEditShipmentDraft({ ...d, incoterms: e.target.value.toUpperCase() })} style={{ fontSize: "0.8rem", width: 80 }} /> : s.incoterms || <span className="subtle">-</span>}</td>
                        <td>{isEditing && d ? <input type="text" value={d.invoice} onChange={(e) => setEditShipmentDraft({ ...d, invoice: e.target.value })} style={{ fontSize: "0.8rem", width: 100 }} /> : s.invoice || <span className="subtle">-</span>}</td>
                        <td>{isEditing && d ? <input type="text" value={d.awbBl} onChange={(e) => setEditShipmentDraft({ ...d, awbBl: e.target.value })} style={{ fontSize: "0.8rem", width: 100 }} /> : s.awb_bl || <span className="subtle">-</span>}</td>
                        <td>{isEditing && d ? <DateField value={d.atd} onChange={(v) => setEditShipmentDraft({ ...d, atd: v })} /> : fmtDate(s.atd)}</td>
                        <td>{isEditing && d ? <DateField value={d.etaJkt} onChange={(v) => setEditShipmentDraft({ ...d, etaJkt: v })} /> : fmtDate(s.eta_jkt)}</td>
                        <td>{isEditing && d ? <input type="text" value={d.sppb} onChange={(e) => setEditShipmentDraft({ ...d, sppb: e.target.value })} style={{ fontSize: "0.8rem", width: 80 }} /> : s.sppb || <span className="subtle">-</span>}</td>
                        <td>{isEditing && d ? <input type="text" value={d.delivery} onChange={(e) => setEditShipmentDraft({ ...d, delivery: e.target.value })} style={{ fontSize: "0.8rem", width: 90 }} /> : s.delivery || <span className="subtle">-</span>}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <>
                              <div style={{ fontSize: "0.68rem", marginBottom: 2 }}>AWB/BL: <input type="file" onChange={(e) => setEditAwbBlFile(e.target.files?.[0] || null)} style={{ fontSize: "0.68rem" }} /></div>
                              <div style={{ fontSize: "0.68rem" }}>Photos: <input type="file" multiple onChange={(e) => setEditPhotoFiles(Array.from(e.target.files || []))} style={{ fontSize: "0.68rem" }} /></div>
                            </>
                          ) : (
                            <>
                              {s.awb_bl_file_path && <button className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px", marginRight: 4 }} onClick={() => viewFile(s.awb_bl_file_path!)}>AWB/BL</button>}
                              {s.photo_paths.map((p, i) => (
                                <button key={i} className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px", marginRight: 4 }} onClick={() => viewFile(p)}>Photo{s.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
                              ))}
                              {!s.awb_bl_file_path && s.photo_paths.length === 0 && <span className="subtle">-</span>}
                            </>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <>
                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => saveShipmentEdit(s.id)}>Save</button>{" "}
                              <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => deleteShipment(s.id)}>Delete</button>
                            </>
                          ) : (
                            <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => startShipmentEdit(s)}>Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={shipmentsPaged.page} totalPages={shipmentsPaged.totalPages} totalCount={shipmentsPaged.totalCount} onChange={shipmentsPaged.setPage} />
          </>
        )}
      </Collapsible>

      <Collapsible
        title="PO Out Recap"
        count={pos?.length}
        defaultOpen
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <ToggleSwitch checked={showProduction} onChange={setShowProduction} label="Production" color={PO_OUT_STATUSES[0].color} />
            <ToggleSwitch checked={showShipment} onChange={setShowShipment} label="Shipment" color={PO_OUT_STATUSES[1].color} />
            <ToggleSwitch checked={showArrived} onChange={setShowArrived} label="Arrived" color={PO_OUT_STATUSES[2].color} />
            <button
              className="btn secondary" style={{ fontSize: "0.75rem" }}
              onClick={() => exportPoOutRecapToExcel("exim-po-out-recap", sorted, EXIM_COLUMNS, eximCellText, suppliers)}
            >
              Export to Excel
            </button>
          </div>
        }
      >
        {!pos ? <p className="subtle">Loading...</p> : pos.length === 0 ? <p className="subtle">None yet.</p> : (
          <>
            <div style={{ display: "flex", gap: 2, marginBottom: 14, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <button
                className="btn secondary"
                style={{ fontSize: "0.75rem", borderRadius: "6px 6px 0 0", borderBottom: "none", background: activeTab === "ALL" ? "var(--accent)" : undefined, color: activeTab === "ALL" ? "white" : undefined }}
                onClick={() => setActiveTab("ALL")}
              >
                All
              </button>
              {SUPPLIER_TAB_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  className="btn secondary"
                  style={{ fontSize: "0.75rem", borderRadius: "6px 6px 0 0", borderBottom: "none", background: activeTab === c.value ? "var(--accent)" : undefined, color: activeTab === c.value ? "white" : undefined }}
                  onClick={() => setActiveTab(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <SearchBox value={search} onChange={setSearch} />

            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy("po_date")}>PO Date {sortKey === "po_date" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                    <th>Days</th><th>Deadline</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy("po_number")}>PO Number {sortKey === "po_number" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy("item_code")}>Item Code {sortKey === "item_code" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy("sales")}>Sales {sortKey === "sales" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy("customer_name")}>Customer Name {sortKey === "customer_name" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                    <th>Item Description</th><th>Qty</th><th>Unit</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy("supplier")}>Supplier {sortKey === "supplier" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                    <th>Status</th><th>OC</th><th>Origin</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy("shipment")}>Shipment {sortKey === "shipment" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const isEditingFields = editingFieldsId === p.id;
                    const fd = fieldsDraft;
                    return (
                      <Fragment key={p.id}>
                        <tr>
                          <td>{fmtDate(p.po_date)}</td>
                          <td>{daysSince(p.po_date)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {fmtDate(p.deadline)}
                            {p.urgent && <span className="pill pill-rejected" style={{ marginLeft: 4, fontSize: "0.6rem" }}>URGENT</span>}
                          </td>
                          <td>{p.po_number}</td>
                          <td>{p.item_code}</td>
                          <td>{p.sales}</td>
                          <td>{p.customer_name}</td>
                          <td>{p.item_description}</td>
                          <td>{p.qty}</td>
                          <td>{p.unit}</td>
                          <td>{p.supplier}</td>
                          <td>
                            {(() => {
                              const meta = { production: { label: "Production", color: "#eab308" }, shipment: { label: "Shipment", color: "#3b82f6" }, arrived: { label: "Arrived", color: "#22c55e" } }[p.status];
                              return (
                                <span className="pill" style={{ background: meta.color, color: "white", cursor: "pointer" }} onClick={() => openUpdates(p)}>
                                  {meta.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td>{isEditingFields && fd ? <input type="text" value={fd.oc} onChange={(e) => setFieldsDraft({ ...fd, oc: e.target.value })} style={{ fontSize: "0.8rem", width: 90 }} /> : (p.oc || <span className="subtle">-</span>)}</td>
                          <td>{isEditingFields && fd ? <input type="text" value={fd.origin} onChange={(e) => setFieldsDraft({ ...fd, origin: e.target.value.toUpperCase() })} style={{ fontSize: "0.8rem", width: 100 }} /> : (p.origin || <span className="subtle">-</span>)}</td>
                          <td>
                            <select value={p.shipment} onChange={(e) => updateShipment(p.id, e.target.value)} style={{ fontSize: "0.8rem" }}>
                              <option value="">Select...</option>
                              {(shipments ?? []).filter((s) => s.shipment_number).map((s) => <option key={s.id} value={s.shipment_number}>{s.shipment_number}</option>)}
                            </select>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {isEditingFields ? (
                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => saveFieldsEdit(p.id)}>Save</button>
                            ) : (
                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => startFieldsEdit(p)}>Edit</button>
                            )}
                          </td>
                        </tr>
                        {updatesOpenId === p.id && (
                          <tr>
                            <td colSpan={16} style={{ background: "var(--panel-muted)" }}>
                              <div style={{ padding: "8px 2px" }}>
                                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Update progress</div>
                                <PoStatusSlider status={statusDraft[p.id] ?? p.status} onChange={(s) => setStatusDraft((cur) => ({ ...cur, [p.id]: s }))} />
                                <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 520 }}>
                                  <input
                                    type="text" placeholder="Comment (e.g. Still on progress, estimate finish 26/07)"
                                    value={commentDraft[p.id] ?? ""} onChange={(e) => setCommentDraft((cur) => ({ ...cur, [p.id]: e.target.value }))}
                                    style={{ flex: 1 }}
                                  />
                                  <button className="btn secondary" disabled={savingStatusId === p.id} onClick={() => saveStatusUpdate(p)}>
                                    {savingStatusId === p.id ? "Saving..." : "Save"}
                                  </button>
                                </div>
                                <div style={{ marginTop: 12 }}>
                                  {p.history.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : p.history.map((h) => (
                                    <div key={h.id} style={{ fontSize: "0.82rem", padding: "3px 0" }}>
                                      <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
          </>
        )}
      </Collapsible>
    </>
  );
}
