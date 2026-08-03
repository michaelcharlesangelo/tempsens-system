"use client";

import { Fragment, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import DateField from "@/app/components/DateField";
import PoStatusSlider from "@/app/components/PoStatusSlider";
import ShipmentStatusSlider from "@/app/components/ShipmentStatusSlider";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import TruncatedText from "@/app/components/TruncatedText";
import {
  PoOut, Shipment, Supplier, SupplierTabCategory, SUPPLIER_TAB_CATEGORIES, PoOutStatus, PO_OUT_STATUSES,
  ShipmentStatus, SHIPMENT_STATUSES,
  HsCode, ShipmentPackingBox, CURRENCY_SYMBOLS,
  fmtDate, fmtDateTime, exportPoOutRecapToExcel,
} from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

function m3For(lengthCm: number, widthCm: number, heightCm: number): number {
  return (lengthCm * widthCm * heightCm) / 1_000_000;
}

interface PackingBoxDraft { boxNo: string; lengthCm: string; widthCm: string; heightCm: string; grossWeightKg: string; netWeightKg: string; }
function blankPackingBoxDraft(): PackingBoxDraft {
  return { boxNo: "", lengthCm: "", widthCm: "", heightCm: "", grossWeightKg: "", netWeightKg: "" };
}

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
  { key: "totalPrice", label: "Total Price" },
  { key: "supplier", label: "Supplier" },
  { key: "status", label: "Status" },
  { key: "oc", label: "OC" },
  { key: "origin", label: "Origin" },
  { key: "via", label: "Via" },
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
    case "totalPrice": return `${CURRENCY_SYMBOLS[p.unit_price_currency]} ${Number(p.total_price).toLocaleString("id-ID")}`;
    case "via": return p.via ?? "";
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

type SortKey = "po_date" | "po_number" | "item_code" | "sales" | "customer_name" | "supplier" | "shipment" | "status" | "via";

const RECAP_COLUMNS: { key: string; label: string; sortKey?: SortKey }[] = [
  { key: "poDate", label: "PO Date", sortKey: "po_date" },
  { key: "days", label: "Days" },
  { key: "deadline", label: "Deadline" },
  { key: "poNumber", label: "PO Number", sortKey: "po_number" },
  { key: "itemCode", label: "Item Code", sortKey: "item_code" },
  { key: "sales", label: "Sales", sortKey: "sales" },
  { key: "customerName", label: "Customer Name", sortKey: "customer_name" },
  { key: "itemDescription", label: "Item Description" },
  { key: "qty", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "totalPrice", label: "Total Price" },
  { key: "supplier", label: "Supplier", sortKey: "supplier" },
  { key: "status", label: "Status", sortKey: "status" },
  { key: "oc", label: "OC" },
  { key: "origin", label: "Origin" },
  { key: "via", label: "Via", sortKey: "via" },
  { key: "shipment", label: "Shipment", sortKey: "shipment" },
];
// Hide the lower-traffic columns by default so the wide table actually
// fits without scrolling for the fields people check daily - the rest
// are one click away via Columns.
const RECAP_DEFAULT_HIDDEN = new Set(["days", "oc", "origin"]);

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
  const [hideArrived, setHideArrived] = useState(true);
  const [statusUpdateOpenFor, setStatusUpdateOpenFor] = useState<string | null>(null);
  const [shipmentStatusDraft, setShipmentStatusDraft] = useState<Record<string, ShipmentStatus>>({});
  const [shipmentCommentDraft, setShipmentCommentDraft] = useState<Record<string, string>>({});
  const [savingShipmentStatusId, setSavingShipmentStatusId] = useState<string | null>(null);

  // ---------------- PO table ----------------
  const [pos, setPos] = useState<PoOut[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [hsCodes, setHsCodes] = useState<HsCode[]>([]);
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
  const [boxDraft, setBoxDraft] = useState<Record<string, string>>({});
  const [hsCodeDraft, setHsCodeDraft] = useState<Record<string, string>>({});
  const [bmDraft, setBmDraft] = useState<Record<string, string>>({});
  const [hsSuggestOpenId, setHsSuggestOpenId] = useState<string | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(RECAP_DEFAULT_HIDDEN);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  // ---------------- Shipment recap ----------------
  const [recapOpenFor, setRecapOpenFor] = useState<string | null>(null); // shipment_number
  const [packingListOpen, setPackingListOpen] = useState(false);
  const [packingBoxes, setPackingBoxes] = useState<ShipmentPackingBox[] | null>(null);
  const [newBoxDraft, setNewBoxDraft] = useState<PackingBoxDraft>(blankPackingBoxDraft());
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editBoxDraft, setEditBoxDraft] = useState<PackingBoxDraft>(blankPackingBoxDraft());
  const [savingBox, setSavingBox] = useState(false);

  async function loadPos() {
    const res = await fetch("/api/po-out", { cache: "no-store" });
    const data = await res.json();
    setPos(data.pos ?? []);
  }
  async function loadHsCodes() {
    const res = await fetch("/api/hs-codes", { cache: "no-store" });
    const data = await res.json();
    setHsCodes(data.hsCodes ?? []);
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

  useEffect(() => { loadPos(); loadSuppliers(); loadShipments(); loadHsCodes(); }, []);

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
    // Renaming the shipment number cascades to every PO Out row that had
    // it selected (see the API route) - reload both so the recap table
    // reflects the new name immediately instead of on next page load.
    loadShipments();
    loadPos();
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

  const shipmentsVisible = (shipments ?? []).filter((s) => !hideArrived || s.status !== "arrived");
  const shipmentsPaged = usePagedSearch(shipmentsVisible, shipmentMatches);

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

  // Shipment/Via are their own standalone dropdowns (not gated behind the
  // OC/Origin Edit flow) - picking a value saves immediately.
  async function updatePoField(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/po-out/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save."); return; }
    loadPos();
    if (patch.hsCode) loadHsCodes();
  }

  async function saveBoxHsCode(p: PoOut) {
    const code = hsCodeDraft[p.id] ?? p.hs_code;
    const bm = bmDraft[p.id] ?? String(bmFor(code) ?? "");
    await updatePoField(p.id, { box: boxDraft[p.id] ?? p.box, hsCode: code, bm });
  }

  function pickHsSuggestion(p: PoOut, code: HsCode) {
    setHsCodeDraft((cur) => ({ ...cur, [p.id]: code.code }));
    setBmDraft((cur) => ({ ...cur, [p.id]: String(code.bm) }));
    setHsSuggestOpenId(null);
    updatePoField(p.id, { box: boxDraft[p.id] ?? p.box, hsCode: code.code, bm: code.bm });
  }

  function openShipmentStatus(s: Shipment) {
    if (statusUpdateOpenFor === s.id) { setStatusUpdateOpenFor(null); return; }
    setStatusUpdateOpenFor(s.id);
    setShipmentStatusDraft((cur) => ({ ...cur, [s.id]: s.status }));
    setShipmentCommentDraft((cur) => ({ ...cur, [s.id]: cur[s.id] ?? "" }));
  }

  async function saveShipmentStatus(s: Shipment) {
    const status = shipmentStatusDraft[s.id] ?? s.status;
    const comment = (shipmentCommentDraft[s.id] ?? "").trim();
    // Moving forward cascades every PO Out row on this shipment and can't
    // be undone from here - moving back to Plan, or just posting a
    // comment without changing status, doesn't touch PO Out rows at all.
    if ((status === "shipment" || status === "arrived") && status !== s.status) {
      const label = SHIPMENT_STATUSES.find((st) => st.value === status)?.label ?? status;
      if (!confirm(`Mark shipment ${s.shipment_number} as ${label}? This moves every affected PO Out row on this shipment to ${label} status, and can't be undone.`)) return;
    }
    setSavingShipmentStatusId(s.id);
    try {
      await fetch(`/api/shipments/${s.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment, changedBy: currentRole.label }),
      });
      setShipmentCommentDraft((cur) => ({ ...cur, [s.id]: "" }));
      await Promise.all([loadShipments(), loadPos()]);
    } finally {
      setSavingShipmentStatusId(null);
    }
  }

  function bmFor(code: string): number | null {
    const match = hsCodes.find((h) => h.code === code.trim().toUpperCase());
    return match ? match.bm : null;
  }

  async function openRecap(shipmentNumber: string) {
    if (recapOpenFor === shipmentNumber) { setRecapOpenFor(null); setPackingListOpen(false); return; }
    setRecapOpenFor(shipmentNumber);
    setPackingListOpen(false);
    setPackingBoxes(null);
  }

  async function togglePackingList(shipmentNumber: string) {
    if (packingListOpen) { setPackingListOpen(false); return; }
    setPackingListOpen(true);
    const s = (shipments ?? []).find((sh) => sh.shipment_number === shipmentNumber);
    if (!s) { setPackingBoxes([]); return; }
    const res = await fetch(`/api/shipments/${s.id}/packing-boxes`, { cache: "no-store" });
    const data = await res.json();
    setPackingBoxes(data.boxes ?? []);
  }

  async function addPackingBox(shipmentNumber: string) {
    const s = (shipments ?? []).find((sh) => sh.shipment_number === shipmentNumber);
    if (!s) return;
    setSavingBox(true);
    try {
      const res = await fetch(`/api/shipments/${s.id}/packing-boxes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxNo: newBoxDraft.boxNo, lengthCm: newBoxDraft.lengthCm, widthCm: newBoxDraft.widthCm,
          heightCm: newBoxDraft.heightCm, grossWeightKg: newBoxDraft.grossWeightKg, netWeightKg: newBoxDraft.netWeightKg,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to add box."); return; }
      setNewBoxDraft(blankPackingBoxDraft());
      togglePackingList(shipmentNumber); // refresh (re-open with same state)
      setPackingListOpen(true);
      const refreshed = await fetch(`/api/shipments/${s.id}/packing-boxes`, { cache: "no-store" });
      setPackingBoxes((await refreshed.json()).boxes ?? []);
    } finally {
      setSavingBox(false);
    }
  }

  function startEditBox(box: ShipmentPackingBox) {
    setEditingBoxId(box.id);
    setEditBoxDraft({
      boxNo: box.box_no, lengthCm: String(box.length_cm), widthCm: String(box.width_cm), heightCm: String(box.height_cm),
      grossWeightKg: String(box.gross_weight_kg), netWeightKg: String(box.net_weight_kg),
    });
  }

  async function saveEditBox(shipmentNumber: string, boxId: string) {
    const s = (shipments ?? []).find((sh) => sh.shipment_number === shipmentNumber);
    if (!s) return;
    await fetch(`/api/shipments/${s.id}/packing-boxes/${boxId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boxNo: editBoxDraft.boxNo, lengthCm: editBoxDraft.lengthCm, widthCm: editBoxDraft.widthCm,
        heightCm: editBoxDraft.heightCm, grossWeightKg: editBoxDraft.grossWeightKg, netWeightKg: editBoxDraft.netWeightKg,
      }),
    });
    setEditingBoxId(null);
    const refreshed = await fetch(`/api/shipments/${s.id}/packing-boxes`, { cache: "no-store" });
    setPackingBoxes((await refreshed.json()).boxes ?? []);
  }

  async function deleteBox(shipmentNumber: string, boxId: string) {
    if (!confirm("Remove this box?")) return;
    const s = (shipments ?? []).find((sh) => sh.shipment_number === shipmentNumber);
    if (!s) return;
    await fetch(`/api/shipments/${s.id}/packing-boxes/${boxId}`, { method: "DELETE" });
    const refreshed = await fetch(`/api/shipments/${s.id}/packing-boxes`, { cache: "no-store" });
    setPackingBoxes((await refreshed.json()).boxes ?? []);
  }

  function sortBy(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortKey(key);
    setSortDir("asc");
  }

  useEffect(() => {
    if (!columnsMenuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) setColumnsMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsMenuOpen]);

  function toggleColumn(key: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function buildRecapCells(p: PoOut, isEditingFields: boolean, fd: FieldsDraft | null): { key: string; node: ReactNode }[] {
    return [
      { key: "poDate", node: fmtDate(p.po_date) },
      { key: "days", node: daysSince(p.po_date) },
      {
        key: "deadline",
        node: (
          <span style={{ whiteSpace: "nowrap" }}>
            {fmtDate(p.deadline)}
            {p.urgent && <span className="pill pill-rejected" style={{ marginLeft: 4, fontSize: "0.6rem" }}>URGENT</span>}
          </span>
        ),
      },
      { key: "poNumber", node: p.po_number },
      { key: "itemCode", node: p.item_code },
      { key: "sales", node: p.sales },
      { key: "customerName", node: p.customer_name },
      { key: "itemDescription", node: <TruncatedText text={p.item_description} /> },
      { key: "qty", node: p.qty },
      { key: "unit", node: p.unit },
      { key: "totalPrice", node: `${CURRENCY_SYMBOLS[p.unit_price_currency]} ${Number(p.total_price).toLocaleString("id-ID")}` },
      { key: "supplier", node: p.supplier },
      {
        key: "status",
        node: (() => {
          const meta = { production: { label: "Production", color: "#eab308" }, shipment: { label: "Shipment", color: "#3b82f6" }, arrived: { label: "Arrived", color: "#22c55e" } }[p.status];
          return (
            <span className="pill" style={{ background: meta.color, color: "white", cursor: "pointer" }} onClick={() => openUpdates(p)}>
              {meta.label}
            </span>
          );
        })(),
      },
      { key: "oc", node: isEditingFields && fd ? <input type="text" value={fd.oc} onChange={(e) => setFieldsDraft({ ...fd, oc: e.target.value })} style={{ fontSize: "0.8rem", width: 90 }} /> : (p.oc || <span className="subtle">-</span>) },
      { key: "origin", node: isEditingFields && fd ? <input type="text" value={fd.origin} onChange={(e) => setFieldsDraft({ ...fd, origin: e.target.value.toUpperCase() })} style={{ fontSize: "0.8rem", width: 100 }} /> : (p.origin || <span className="subtle">-</span>) },
      {
        key: "via",
        node: (
          <select value={p.via ?? ""} onChange={(e) => updatePoField(p.id, { via: e.target.value })} style={{ fontSize: "0.8rem", minWidth: 72 }}>
            <option value="">Select...</option>
            <option value="AIR">AIR</option>
            <option value="SEA">SEA</option>
          </select>
        ),
      },
      {
        key: "shipment",
        node: (
          <select value={p.shipment} onChange={(e) => updatePoField(p.id, { shipment: e.target.value })} style={{ fontSize: "0.8rem", minWidth: 120 }}>
            <option value="">Select...</option>
            {(shipments ?? []).filter((s) => s.shipment_number).map((s) => <option key={s.id} value={s.shipment_number}>{s.shipment_number}</option>)}
          </select>
        ),
      },
    ];
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

      <Collapsible
        title="Shipment Plan"
        count={shipments?.length}
        defaultOpen
        actions={<ToggleSwitch checked={hideArrived} onChange={setHideArrived} label="Hide Arrived" />}
      >
        {!showShipmentForm && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {shipments && shipments.length > 0 ? <SearchBox value={shipmentsPaged.search} onChange={shipmentsPaged.setSearch} /> : <div />}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Link href="/hs-codes" className="subtle" style={{ fontSize: "0.85rem", textDecoration: "underline", cursor: "pointer" }}>HS Code</Link>
              <button className="btn" onClick={() => setShowShipmentForm(true)}>+ New Shipment</button>
            </div>
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
                    <th>AWB/BL</th><th>ATD</th><th>ETA JKT</th><th>SPPB</th><th>Delivery</th><th>Files</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {shipmentsPaged.pageItems.map((s) => {
                    const isEditing = editingShipmentId === s.id;
                    const d = editShipmentDraft;
                    return (
                      <Fragment key={s.id}>
                      <tr>
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
                        <td style={{ textAlign: "center" }}>
                          {(() => {
                            const meta = SHIPMENT_STATUSES.find((st) => st.value === s.status) ?? SHIPMENT_STATUSES[0];
                            return (
                              <span className="pill" style={{ background: meta.color, color: "white", cursor: "pointer" }} onClick={() => openShipmentStatus(s)}>
                                {meta.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <>
                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => saveShipmentEdit(s.id)}>Save</button>{" "}
                              <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => deleteShipment(s.id)}>Delete</button>
                            </>
                          ) : (
                            <>
                              {s.shipment_number && (
                                <>
                                  <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => openRecap(s.shipment_number)}>
                                    {recapOpenFor === s.shipment_number ? "Hide Recap" : "Recap"}
                                  </button>{" "}
                                </>
                              )}
                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => startShipmentEdit(s)}>Edit</button>
                            </>
                          )}
                        </td>
                      </tr>
                      {statusUpdateOpenFor === s.id && (
                        <tr>
                          <td colSpan={13} style={{ background: "var(--panel-muted)" }}>
                            <div style={{ padding: "8px 2px" }}>
                              <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Update shipment status</div>
                              <ShipmentStatusSlider status={shipmentStatusDraft[s.id] ?? s.status} onChange={(st) => setShipmentStatusDraft((cur) => ({ ...cur, [s.id]: st }))} />
                              <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 520 }}>
                                <input
                                  type="text" placeholder="Comment (e.g. Shipment delayed) - posted to every PO Out row on this shipment"
                                  value={shipmentCommentDraft[s.id] ?? ""} onChange={(e) => setShipmentCommentDraft((cur) => ({ ...cur, [s.id]: e.target.value }))}
                                  style={{ flex: 1 }}
                                />
                                <button className="btn secondary" disabled={savingShipmentStatusId === s.id} onClick={() => saveShipmentStatus(s)}>
                                  {savingShipmentStatusId === s.id ? "Saving..." : "Save"}
                                </button>
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
            <Pager page={shipmentsPaged.page} totalPages={shipmentsPaged.totalPages} totalCount={shipmentsPaged.totalCount} onChange={shipmentsPaged.setPage} />

            {recapOpenFor && (() => {
              const items = (pos ?? []).filter((p) => p.shipment === recapOpenFor);
              // Items are usually all in one currency, but sum per-currency
              // rather than assuming IDR, since a shipment can mix suppliers.
              const totalsByCurrency = new Map<string, number>();
              items.forEach((p) => totalsByCurrency.set(p.unit_price_currency, (totalsByCurrency.get(p.unit_price_currency) ?? 0) + Number(p.total_price || 0)));
              return (
                <div className="card" style={{ marginTop: 14, background: "var(--panel-muted)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Shipment Recap — {recapOpenFor}</h3>
                    <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => togglePackingList(recapOpenFor)}>
                      {packingListOpen ? "Hide Packing List" : "Packing List"}
                    </button>
                  </div>
                  <div style={{ overflowX: "auto", marginTop: 10 }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>PO Number</th><th>Item Code</th><th>Customer Name</th><th>Item Description</th><th>Qty</th><th>Total Price</th><th>Box</th><th>HS Code</th><th>BM (%)</th></tr>
                      </thead>
                      <tbody>
                        {items.map((p) => {
                          const bm = bmFor(hsCodeDraft[p.id] ?? p.hs_code);
                          const term = (hsCodeDraft[p.id] ?? p.hs_code ?? "").trim().toUpperCase();
                          const suggestions = hsCodes.filter((h) => (term ? h.code.includes(term) : true));
                          return (
                            <tr key={p.id}>
                              <td>{p.po_number}</td>
                              <td>{p.item_code}</td>
                              <td>{p.customer_name}</td>
                              <td><TruncatedText text={p.item_description} /></td>
                              <td>{p.qty}</td>
                              <td>{CURRENCY_SYMBOLS[p.unit_price_currency]} {Number(p.total_price).toLocaleString("id-ID")}</td>
                              <td>
                                <input
                                  type="text" value={boxDraft[p.id] ?? p.box} style={{ fontSize: "0.8rem", width: 70 }}
                                  onChange={(e) => setBoxDraft((cur) => ({ ...cur, [p.id]: e.target.value }))}
                                  onBlur={() => saveBoxHsCode(p)}
                                />
                              </td>
                              <td style={{ position: "relative" }}>
                                <input
                                  type="text" value={hsCodeDraft[p.id] ?? p.hs_code} style={{ fontSize: "0.8rem", width: 90 }}
                                  onChange={(e) => { setHsCodeDraft((cur) => ({ ...cur, [p.id]: e.target.value.toUpperCase() })); setHsSuggestOpenId(p.id); }}
                                  onFocus={() => setHsSuggestOpenId(p.id)}
                                  onBlur={() => { setTimeout(() => setHsSuggestOpenId((cur) => (cur === p.id ? null : cur)), 150); saveBoxHsCode(p); }}
                                  placeholder="Not registered? type it"
                                />
                                {hsSuggestOpenId === p.id && suggestions.length > 0 && (
                                  <div
                                    style={{
                                      position: "absolute", zIndex: 20, top: "100%", left: 0, marginTop: 2, minWidth: 200,
                                      background: "var(--panel, #fff)", border: "1px solid var(--border)", borderRadius: 6,
                                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)", maxHeight: 160, overflowY: "auto",
                                    }}
                                  >
                                    {suggestions.slice(0, 8).map((h) => (
                                      <div
                                        key={h.id} onMouseDown={() => pickHsSuggestion(p, h)}
                                        style={{ padding: "6px 8px", cursor: "pointer", fontSize: "0.78rem", borderBottom: "1px solid var(--panel-muted)" }}
                                      >
                                        <b>{h.code}</b> — {h.description || <span className="subtle">no description yet</span>} ({h.bm}%)
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number" value={bmDraft[p.id] ?? (bm !== null ? String(bm) : "")} style={{ fontSize: "0.8rem", width: 60 }}
                                  onChange={(e) => setBmDraft((cur) => ({ ...cur, [p.id]: e.target.value }))}
                                  onBlur={() => saveBoxHsCode(p)}
                                  placeholder="Not registered? type it"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ fontWeight: 700 }}>
                          <td colSpan={5} style={{ textAlign: "right" }}>Total</td>
                          <td>
                            {Array.from(totalsByCurrency.entries()).map(([currency, sum]) => (
                              <div key={currency}>{CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] ?? currency} {sum.toLocaleString("id-ID")}</div>
                            ))}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {packingListOpen && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                      <div className="subtle" style={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", marginBottom: 8 }}>Packing List</div>
                      {packingBoxes === null ? <p className="subtle">Loading...</p> : (
                        <div style={{ overflowX: "auto" }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Box No.</th><th>Length (cm)</th><th>Width (cm)</th><th>Height (cm)</th><th>M3</th>
                                <th>Gross Weight (kg)</th><th>Net Weight (kg)</th><th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {packingBoxes.map((box) => {
                                const isEditing = editingBoxId === box.id;
                                const d = editBoxDraft;
                                const m3 = isEditing
                                  ? m3For(Number(d.lengthCm) || 0, Number(d.widthCm) || 0, Number(d.heightCm) || 0)
                                  : m3For(box.length_cm, box.width_cm, box.height_cm);
                                return (
                                  <tr key={box.id}>
                                    <td>{isEditing ? <input type="text" value={d.boxNo} onChange={(e) => setEditBoxDraft({ ...d, boxNo: e.target.value })} style={{ width: 70 }} /> : box.box_no}</td>
                                    <td>{isEditing ? <input type="number" value={d.lengthCm} onChange={(e) => setEditBoxDraft({ ...d, lengthCm: e.target.value })} style={{ width: 70 }} /> : box.length_cm}</td>
                                    <td>{isEditing ? <input type="number" value={d.widthCm} onChange={(e) => setEditBoxDraft({ ...d, widthCm: e.target.value })} style={{ width: 70 }} /> : box.width_cm}</td>
                                    <td>{isEditing ? <input type="number" value={d.heightCm} onChange={(e) => setEditBoxDraft({ ...d, heightCm: e.target.value })} style={{ width: 70 }} /> : box.height_cm}</td>
                                    <td>{m3.toFixed(4)}</td>
                                    <td>{isEditing ? <input type="number" value={d.grossWeightKg} onChange={(e) => setEditBoxDraft({ ...d, grossWeightKg: e.target.value })} style={{ width: 80 }} /> : box.gross_weight_kg}</td>
                                    <td>{isEditing ? <input type="number" value={d.netWeightKg} onChange={(e) => setEditBoxDraft({ ...d, netWeightKg: e.target.value })} style={{ width: 80 }} /> : box.net_weight_kg}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                      {isEditing ? (
                                        <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => saveEditBox(recapOpenFor, box.id)}>Save</button>
                                      ) : (
                                        <>
                                          <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => startEditBox(box)}>Edit</button>{" "}
                                          <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => deleteBox(recapOpenFor, box.id)}>Delete</button>
                                        </>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr>
                                <td><input type="text" value={newBoxDraft.boxNo} onChange={(e) => setNewBoxDraft({ ...newBoxDraft, boxNo: e.target.value })} placeholder="Box No." style={{ width: 70 }} /></td>
                                <td><input type="number" value={newBoxDraft.lengthCm} onChange={(e) => setNewBoxDraft({ ...newBoxDraft, lengthCm: e.target.value })} style={{ width: 70 }} /></td>
                                <td><input type="number" value={newBoxDraft.widthCm} onChange={(e) => setNewBoxDraft({ ...newBoxDraft, widthCm: e.target.value })} style={{ width: 70 }} /></td>
                                <td><input type="number" value={newBoxDraft.heightCm} onChange={(e) => setNewBoxDraft({ ...newBoxDraft, heightCm: e.target.value })} style={{ width: 70 }} /></td>
                                <td className="subtle">{m3For(Number(newBoxDraft.lengthCm) || 0, Number(newBoxDraft.widthCm) || 0, Number(newBoxDraft.heightCm) || 0).toFixed(4)}</td>
                                <td><input type="number" value={newBoxDraft.grossWeightKg} onChange={(e) => setNewBoxDraft({ ...newBoxDraft, grossWeightKg: e.target.value })} style={{ width: 80 }} /></td>
                                <td><input type="number" value={newBoxDraft.netWeightKg} onChange={(e) => setNewBoxDraft({ ...newBoxDraft, netWeightKg: e.target.value })} style={{ width: 80 }} /></td>
                                <td>
                                  <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} disabled={savingBox} onClick={() => addPackingBox(recapOpenFor)}>+ Add</button>
                                </td>
                              </tr>
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700 }}>
                                <td colSpan={4} style={{ textAlign: "right" }}>Total</td>
                                <td>{packingBoxes.reduce((n, b) => n + m3For(b.length_cm, b.width_cm, b.height_cm), 0).toFixed(4)}</td>
                                <td>{packingBoxes.reduce((n, b) => n + Number(b.gross_weight_kg || 0), 0).toLocaleString("id-ID")}</td>
                                <td>{packingBoxes.reduce((n, b) => n + Number(b.net_weight_kg || 0), 0).toLocaleString("id-ID")}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <SearchBox value={search} onChange={setSearch} />
              <div ref={columnsMenuRef} style={{ position: "relative" }}>
                <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => setColumnsMenuOpen((o) => !o)}>Columns ▾</button>
                {columnsMenuOpen && (
                  <div
                    style={{
                      position: "absolute", top: "100%", right: 0, zIndex: 15, marginTop: 4,
                      background: "var(--panel, #fff)", border: "1px solid var(--border)", borderRadius: 8,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: 10, width: 200,
                    }}
                  >
                    {RECAP_COLUMNS.map((c) => (
                      <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", padding: "3px 0", cursor: "pointer" }}>
                        <input type="checkbox" checked={!hiddenCols.has(c.key)} onChange={() => toggleColumn(c.key)} /> {c.label}
                      </label>
                    ))}
                    <button className="btn secondary" style={{ fontSize: "0.72rem", marginTop: 6, width: "100%" }} onClick={() => setHiddenCols(new Set())}>
                      Unhide all
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {RECAP_COLUMNS.filter((c) => !hiddenCols.has(c.key)).map((c) =>
                      c.sortKey ? (
                        <th key={c.key} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => sortBy(c.sortKey!)}>
                          {c.label} {sortKey === c.sortKey ? (sortDir === "asc" ? "▲" : "▼") : ""}
                        </th>
                      ) : <th key={c.key}>{c.label}</th>
                    )}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const isEditingFields = editingFieldsId === p.id;
                    const fd = fieldsDraft;
                    const cells = buildRecapCells(p, isEditingFields, fd).filter((c) => !hiddenCols.has(c.key));
                    return (
                      <Fragment key={p.id}>
                        <tr>
                          {cells.map((c) => <td key={c.key}>{c.node}</td>)}
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
                            <td colSpan={cells.length + 1} style={{ background: "var(--panel-muted)" }}>
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
