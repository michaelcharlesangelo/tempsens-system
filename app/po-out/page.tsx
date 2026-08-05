"use client";

import { CSSProperties, Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import DateField from "@/app/components/DateField";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import TruncatedText from "@/app/components/TruncatedText";
import {
  PoOut, Supplier, SupplierTabCategory, SUPPLIER_TAB_CATEGORIES, Currency, CURRENCY_SYMBOLS, PoOutStatus, PO_OUT_STATUSES,
  fmtDate, fmtDateTime, daysBetweenDates, exportPoOutRecapToExcel,
} from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

// Same convention as Form page's Budget field - "." thousand separators as
// you type, digits-only underneath so it parses back cleanly on submit.
function formatPrice(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}
function parsePrice(display: string): string {
  return display.replace(/\D/g, "");
}

interface SalesAccount { id: string; full_name: string; }

interface Draft {
  poDate: string; deadline: string; estimation: string; urgent: boolean; poNumber: string; itemCode: string;
  sales: string; customerName: string; itemDescription: string; qty: string; unit: string;
  unitPrice: string; unitPriceCurrency: Currency; unitSellingPrice: string; unitSellingPriceCurrency: Currency;
  supplier: string;
}

function blank(): Draft {
  return {
    poDate: new Date().toISOString().slice(0, 10), deadline: "", estimation: "", urgent: false, poNumber: "", itemCode: "",
    sales: "", customerName: "", itemDescription: "", qty: "1", unit: "pcs",
    unitPrice: "", unitPriceCurrency: "IDR", unitSellingPrice: "", unitSellingPriceCurrency: "IDR", supplier: "",
  };
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

// Calendar-day difference, same convention as Dashboard/Exim's daysSince.
function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
}

// "05/08/2026 (6)" - the estimation date plus how many days after po_date
// it falls.
function estimationLabel(p: PoOut): string {
  if (!p.estimation) return "-";
  return `${fmtDate(p.estimation)} (${daysBetweenDates(p.po_date, p.estimation)})`;
}

type SortKey = "po_number" | "item_code" | "sales" | "customer_name" | "supplier";

const COLUMNS: { key: string; label: string; sortKey?: SortKey }[] = [
  { key: "poDate", label: "PO Date" },
  { key: "days", label: "Days" },
  { key: "deadline", label: "Deadline" },
  { key: "estimation", label: "Estimation" },
  { key: "poNumber", label: "PO Number", sortKey: "po_number" },
  { key: "itemCode", label: "Item Code", sortKey: "item_code" },
  { key: "sales", label: "Sales", sortKey: "sales" },
  { key: "customerName", label: "Customer Name", sortKey: "customer_name" },
  { key: "itemDescription", label: "Item Description" },
  { key: "qty", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "totalPrice", label: "Total Price" },
  { key: "unitSellingPrice", label: "Unit Selling Price" },
  { key: "supplier", label: "Supplier", sortKey: "supplier" },
  { key: "status", label: "Status" },
];

function poCellText(p: PoOut, key: string): string {
  switch (key) {
    case "poDate": return fmtDate(p.po_date);
    case "days": return String(daysSince(p.po_date));
    case "deadline": return fmtDate(p.deadline) + (p.urgent ? " (URGENT)" : "");
    case "estimation": return estimationLabel(p);
    case "poNumber": return p.po_number;
    case "itemCode": return p.item_code;
    case "sales": return p.sales;
    case "customerName": return p.customer_name;
    case "itemDescription": return p.item_description;
    case "qty": return String(p.qty);
    case "unit": return p.unit;
    case "unitPrice": return `${p.unit_price_currency} ${Number(p.unit_price).toLocaleString("id-ID")}`;
    case "totalPrice": return `${p.unit_price_currency} ${Number(p.total_price).toLocaleString("id-ID")}`;
    case "unitSellingPrice": return `${p.unit_selling_price_currency} ${Number(p.unit_selling_price).toLocaleString("id-ID")}`;
    case "supplier": return p.supplier;
    case "status": return PO_OUT_STATUSES.find((s) => s.value === p.status)?.label ?? p.status;
    default: return "";
  }
}

// Kept at module scope so re-renders elsewhere on the page never remount
// (and lose focus / mid-typed "new supplier" state on) this control.
function SupplierSelect({
  value, onChange, suppliers, onSupplierAdded, style,
}: {
  value: string; onChange: (v: string) => void; suppliers: Supplier[]; onSupplierAdded: (s: Supplier) => void; style?: CSSProperties;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  if (adding) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        <input
          type="text" autoFocus placeholder="New supplier name" value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())} style={{ fontSize: "0.82rem", ...style }}
        />
        <button
          type="button" className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.72rem", flex: "none" }}
          onClick={async () => {
            const trimmed = name.trim();
            if (!trimmed) { setAdding(false); return; }
            const res = await fetch("/api/suppliers", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: trimmed, tabCategory: "OTHER_IMPORT" }),
            });
            const data = await res.json();
            if (res.ok) { onSupplierAdded(data.supplier); onChange(data.supplier.name); }
            setName(""); setAdding(false);
          }}
        >
          Add
        </button>
        <button type="button" className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.72rem", flex: "none" }} onClick={() => { setAdding(false); setName(""); }}>×</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0, ...style }}>
        <option value="">Select...</option>
        {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
      <button type="button" className="btn secondary" style={{ padding: "0 10px", fontSize: "0.9rem", flex: "none" }} title="Add new supplier" onClick={() => setAdding(true)}>+</button>
    </div>
  );
}

function CurrencyInput({
  value, currency, onValueChange, onCurrencyChange, readOnly, compact,
}: {
  value: string; currency: Currency; onValueChange?: (v: string) => void; onCurrencyChange?: (c: Currency) => void; readOnly?: boolean; compact?: boolean;
}) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: readOnly ? "var(--panel-muted)" : undefined }}>
      <select
        value={currency}
        disabled={readOnly}
        onChange={(e) => onCurrencyChange?.(e.target.value as Currency)}
        style={{ border: "none", borderRight: "1px solid var(--border)", background: "var(--panel-muted)", fontSize: compact ? "0.68rem" : "0.74rem", padding: "0 2px", borderRadius: 0, flex: "none", width: compact ? 40 : 50 }}
      >
        {(Object.keys(CURRENCY_SYMBOLS) as Currency[]).map((c) => <option key={c} value={c}>{CURRENCY_SYMBOLS[c]}</option>)}
      </select>
      <input
        type="text" inputMode="numeric" readOnly={readOnly} value={value}
        onChange={(e) => onValueChange?.(formatPrice(e.target.value))}
        style={{ border: "none", flex: 1, minWidth: 0, width: "100%", fontSize: compact ? "0.8rem" : undefined }}
      />
    </div>
  );
}

export default function PoOutPage() {
  const [pos, setPos] = useState<PoOut[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesAccounts, setSalesAccounts] = useState<SalesAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(blank());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [updatesOpenId, setUpdatesOpenId] = useState<string | null>(null);
  const [moreItems, setMoreItems] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState<SupplierTabCategory | "ALL">("ALL");
  // Arrived starts off - it'll pile up fast once shipments actually land,
  // and by then it's no longer the thing Sales Support needs eyes on daily.
  const [showProduction, setShowProduction] = useState(true);
  const [showShipment, setShowShipment] = useState(true);
  const [showArrived, setShowArrived] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  const currentRole = getCurrentRole();

  async function load() {
    const res = await fetch("/api/po-out", { cache: "no-store" });
    const data = await res.json();
    setPos(data.pos ?? []);
  }
  async function loadSuppliers() {
    const res = await fetch("/api/suppliers", { cache: "no-store" });
    const data = await res.json();
    setSuppliers(data.suppliers ?? []);
  }

  useEffect(() => {
    load();
    loadSuppliers();
    fetch("/api/production-accounts?forSales=true", { cache: "no-store" }).then((r) => r.json()).then((d) => setSalesAccounts(d.accounts ?? []));
  }, []);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) setColumnsMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsMenuOpen]);

  function addSupplierToList(s: Supplier) {
    setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function resetForm() {
    setDraft(blank());
    setShowForm(false);
    setError(null);
    setMoreItems(false);
  }

  const totalPrice = (Number(draft.qty) || 0) * (Number(parsePrice(draft.unitPrice)) || 0);

  async function submit() {
    if (!draft.poNumber.trim() || !draft.supplier) { setError("PO Number and Supplier are required."); return; }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/po-out", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft, unitPrice: parsePrice(draft.unitPrice), unitSellingPrice: parsePrice(draft.unitSellingPrice),
          submittedBy: currentRole.label,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      if (moreItems) {
        // Same PO, next line item - carry over the fields that are shared
        // across a PO's lines, clear the item-specific ones, keep the form
        // open (and everything still editable, just pre-filled).
        setDraft((d) => ({
          ...blank(),
          supplier: d.supplier, deadline: d.deadline, poNumber: d.poNumber,
          customerName: d.customerName, sales: d.sales,
        }));
      } else {
        resetForm();
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  function startRowEdit(p: PoOut) {
    setEditingId(p.id);
    setEditDraft({
      poDate: p.po_date.slice(0, 10), deadline: p.deadline ? p.deadline.slice(0, 10) : "",
      estimation: p.estimation ? p.estimation.slice(0, 10) : "", urgent: p.urgent,
      poNumber: p.po_number, itemCode: p.item_code, sales: p.sales, customerName: p.customer_name,
      itemDescription: p.item_description, qty: String(p.qty), unit: p.unit,
      unitPrice: formatPrice(String(p.unit_price)), unitPriceCurrency: p.unit_price_currency,
      unitSellingPrice: formatPrice(String(p.unit_selling_price)), unitSellingPriceCurrency: p.unit_selling_price_currency,
      supplier: p.supplier,
    });
  }

  async function saveRowEdit(id: string) {
    if (!editDraft) return;
    const res = await fetch(`/api/po-out/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editDraft, unitPrice: parsePrice(editDraft.unitPrice), unitSellingPrice: parsePrice(editDraft.unitSellingPrice) }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to save changes."); return; }
    setEditingId(null);
    setEditDraft(null);
    load();
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this PO Out entry? This can't be undone.")) return;
    const res = await fetch(`/api/po-out/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || "Failed to delete."); return; }
    setEditingId(null);
    setEditDraft(null);
    load();
  }

  function sortBy(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortKey(key);
    setSortDir("asc");
  }

  function toggleColumn(key: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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

  function buildRowCells(p: PoOut, isEditing: boolean): { key: string; node: ReactNode }[] {
    const d = editDraft;
    return [
      { key: "poDate", node: isEditing && d ? <DateField value={d.poDate} onChange={(v) => setEditDraft({ ...d, poDate: v })} /> : fmtDate(p.po_date) },
      { key: "days", node: daysSince(p.po_date) },
      {
        key: "deadline",
        node: isEditing && d ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DateField value={d.deadline} onChange={(v) => setEditDraft({ ...d, deadline: v })} />
            <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.7rem", whiteSpace: "nowrap", cursor: "pointer" }}>
              <input type="checkbox" checked={d.urgent} onChange={(e) => setEditDraft({ ...d, urgent: e.target.checked })} /> Urgent
            </label>
          </div>
        ) : (
          <>
            {fmtDate(p.deadline)}
            {p.urgent && <span className="pill pill-rejected" style={{ marginLeft: 4, fontSize: "0.6rem" }}>URGENT</span>}
          </>
        ),
      },
      {
        key: "estimation",
        node: isEditing && d ? (
          <DateField value={d.estimation} onChange={(v) => setEditDraft({ ...d, estimation: v })} />
        ) : (
          estimationLabel(p)
        ),
      },
      { key: "poNumber", node: isEditing && d ? <input type="text" value={d.poNumber} onChange={(e) => setEditDraft({ ...d, poNumber: e.target.value.toUpperCase() })} style={{ fontSize: "0.8rem", width: 100 }} /> : p.po_number },
      { key: "itemCode", node: isEditing && d ? <input type="text" value={d.itemCode} onChange={(e) => setEditDraft({ ...d, itemCode: e.target.value.toUpperCase() })} style={{ fontSize: "0.8rem", width: 100 }} /> : p.item_code },
      {
        key: "sales",
        node: isEditing && d ? (
          <select value={d.sales} onChange={(e) => setEditDraft({ ...d, sales: e.target.value })} style={{ fontSize: "0.8rem" }}>
            <option value="">Select...</option>
            {salesAccounts.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
          </select>
        ) : p.sales,
      },
      { key: "customerName", node: isEditing && d ? <input type="text" value={d.customerName} onChange={(e) => setEditDraft({ ...d, customerName: e.target.value.toUpperCase() })} style={{ fontSize: "0.8rem", width: 120 }} /> : p.customer_name },
      { key: "itemDescription", node: isEditing && d ? <input type="text" value={d.itemDescription} onChange={(e) => setEditDraft({ ...d, itemDescription: e.target.value })} style={{ fontSize: "0.8rem", width: 160 }} /> : <TruncatedText text={p.item_description} /> },
      { key: "qty", node: isEditing && d ? <input type="number" value={d.qty} onChange={(e) => setEditDraft({ ...d, qty: e.target.value })} style={{ fontSize: "0.8rem", width: 60 }} /> : p.qty },
      { key: "unit", node: isEditing && d ? <input type="text" value={d.unit} onChange={(e) => setEditDraft({ ...d, unit: e.target.value })} style={{ fontSize: "0.8rem", width: 60 }} /> : p.unit },
      {
        key: "unitPrice",
        node: isEditing && d ? (
          <CurrencyInput value={d.unitPrice} currency={d.unitPriceCurrency} onValueChange={(v) => setEditDraft({ ...d, unitPrice: v })} onCurrencyChange={(c) => setEditDraft({ ...d, unitPriceCurrency: c })} compact />
        ) : `${CURRENCY_SYMBOLS[p.unit_price_currency]} ${Number(p.unit_price).toLocaleString("id-ID")}`,
      },
      {
        key: "totalPrice",
        node: isEditing && d ? (
          <CurrencyInput value={((Number(d.qty) || 0) * (Number(parsePrice(d.unitPrice)) || 0)).toLocaleString("id-ID")} currency={d.unitPriceCurrency} readOnly compact />
        ) : `${CURRENCY_SYMBOLS[p.unit_price_currency]} ${Number(p.total_price).toLocaleString("id-ID")}`,
      },
      {
        key: "unitSellingPrice",
        node: isEditing && d ? (
          <CurrencyInput value={d.unitSellingPrice} currency={d.unitSellingPriceCurrency} onValueChange={(v) => setEditDraft({ ...d, unitSellingPrice: v })} onCurrencyChange={(c) => setEditDraft({ ...d, unitSellingPriceCurrency: c })} compact />
        ) : `${CURRENCY_SYMBOLS[p.unit_selling_price_currency]} ${Number(p.unit_selling_price).toLocaleString("id-ID")}`,
      },
      {
        key: "supplier",
        node: isEditing && d ? (
          <SupplierSelect value={d.supplier} onChange={(v) => setEditDraft({ ...d, supplier: v })} suppliers={suppliers} onSupplierAdded={addSupplierToList} style={{ fontSize: "0.8rem" }} />
        ) : p.supplier,
      },
      {
        key: "status",
        node: (() => {
          const meta = PO_OUT_STATUSES.find((s) => s.value === p.status)!;
          return (
            <span
              className="pill"
              style={{ background: meta.color, color: "white", cursor: "pointer" }}
              onClick={() => setUpdatesOpenId(updatesOpenId === p.id ? null : p.id)}
              title="Click to view updates from Exim Team — status is changed on the Exim page"
            >
              {meta.label}
            </span>
          );
        })(),
      },
    ];
  }

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>PO Out</h2>
          {!showForm && <button className="btn" onClick={() => setShowForm(true)}>+ New</button>}
        </div>

        {showForm && (
          <div style={{ marginTop: 14 }}>
            <div className="form-sheet" style={{ marginTop: 14 }}>
              <div className="form-sheet-col">
                <div className="form-row">
                  <label>Supplier</label><span>:</span>
                  <SupplierSelect value={draft.supplier} onChange={(v) => setDraft({ ...draft, supplier: v })} suppliers={suppliers} onSupplierAdded={addSupplierToList} />
                </div>
                <div className="form-row">
                  <label>PO Date</label><span>:</span>
                  <DateField value={draft.poDate} onChange={(v) => setDraft({ ...draft, poDate: v })} />
                </div>
                <div className="form-row">
                  <label>Deadline</label><span>:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}><DateField value={draft.deadline} onChange={(v) => setDraft({ ...draft, deadline: v })} /></div>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={draft.urgent} onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })} style={{ width: 15, height: 15 }} /> Urgent
                    </label>
                  </div>
                </div>
                <div className="form-row">
                  <label>Estimation</label><span>:</span>
                  <DateField value={draft.estimation} onChange={(v) => setDraft({ ...draft, estimation: v })} />
                </div>
                <div className="form-row"><label>PO Number</label><span>:</span><input type="text" value={draft.poNumber} onChange={(e) => setDraft({ ...draft, poNumber: e.target.value.toUpperCase() })} /></div>
                <div className="form-row"><label>Item Code</label><span>:</span><input type="text" value={draft.itemCode} onChange={(e) => setDraft({ ...draft, itemCode: e.target.value.toUpperCase() })} /></div>
                <div className="form-row"><label>Item Description</label><span>:</span><input type="text" value={draft.itemDescription} onChange={(e) => setDraft({ ...draft, itemDescription: e.target.value })} /></div>
                <div className="form-row"><label>Customer Name</label><span>:</span><input type="text" value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value.toUpperCase() })} /></div>
              </div>
              <div className="form-sheet-col">
                <div className="form-row" style={{ visibility: "hidden" }}><label>Spacer</label><span>:</span><input type="text" readOnly value="" /></div>
                <div className="form-row"><label>Qty</label><span>:</span><input type="number" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /></div>
                <div className="form-row"><label>Unit</label><span>:</span><input type="text" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></div>
                <div className="form-row">
                  <label>Unit Price</label><span>:</span>
                  <CurrencyInput value={draft.unitPrice} currency={draft.unitPriceCurrency} onValueChange={(v) => setDraft({ ...draft, unitPrice: v })} onCurrencyChange={(c) => setDraft({ ...draft, unitPriceCurrency: c })} />
                </div>
                <div className="form-row">
                  <label>Total Price</label><span>:</span>
                  <CurrencyInput value={totalPrice.toLocaleString("id-ID")} currency={draft.unitPriceCurrency} readOnly />
                </div>
                <div className="form-row">
                  <label>Unit Selling Price</label><span>:</span>
                  <CurrencyInput value={draft.unitSellingPrice} currency={draft.unitSellingPriceCurrency} onValueChange={(v) => setDraft({ ...draft, unitSellingPrice: v })} onCurrencyChange={(c) => setDraft({ ...draft, unitSellingPriceCurrency: c })} />
                </div>
                <div className="form-row">
                  <label>Sales</label><span>:</span>
                  <select value={draft.sales} onChange={(e) => setDraft({ ...draft, sales: e.target.value })}>
                    <option value="">Select...</option>
                    {salesAccounts.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Submit"}</button>
              <button className="btn secondary" onClick={resetForm}>Cancel</button>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={moreItems} onChange={(e) => setMoreItems(e.target.checked)} style={{ width: 15, height: 15 }} /> More Items
              </label>
            </div>
          </div>
        )}
      </div>

      {message && <div className="warn">{message}</div>}

      <Collapsible
        title="PO OUT RECAP"
        count={pos?.length}
        defaultOpen
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <ToggleSwitch checked={showProduction} onChange={setShowProduction} label="Production" color={PO_OUT_STATUSES[0].color} />
            <ToggleSwitch checked={showShipment} onChange={setShowShipment} label="Shipment" color={PO_OUT_STATUSES[1].color} />
            <ToggleSwitch checked={showArrived} onChange={setShowArrived} label="Arrived" color={PO_OUT_STATUSES[2].color} />
            <button
              className="btn secondary" style={{ fontSize: "0.75rem" }}
              onClick={() => exportPoOutRecapToExcel("po-out-recap", sorted, COLUMNS.filter((c) => !hiddenCols.has(c.key)), poCellText, suppliers)}
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
                style={{
                  fontSize: "0.75rem", borderRadius: "6px 6px 0 0", borderBottom: "none",
                  background: activeTab === "ALL" ? "var(--accent)" : undefined, color: activeTab === "ALL" ? "white" : undefined,
                }}
                onClick={() => setActiveTab("ALL")}
              >
                All
              </button>
              {SUPPLIER_TAB_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  className="btn secondary"
                  style={{
                    fontSize: "0.75rem", borderRadius: "6px 6px 0 0", borderBottom: "none",
                    background: activeTab === c.value ? "var(--accent)" : undefined, color: activeTab === c.value ? "white" : undefined,
                  }}
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
                    {COLUMNS.map((c) => (
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
                    {COLUMNS.filter((c) => !hiddenCols.has(c.key)).map((c) =>
                      c.sortKey ? (
                        <th key={c.key} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => sortBy(c.sortKey!)}>
                          {c.label} {sortKey === c.sortKey ? (sortDir === "asc" ? "▲" : "▼") : ""}
                        </th>
                      ) : (
                        <th key={c.key}>{c.label}</th>
                      )
                    )}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const isEditing = editingId === p.id;
                    const cells = buildRowCells(p, isEditing).filter((c) => !hiddenCols.has(c.key));
                    return (
                      <Fragment key={p.id}>
                        <tr>
                          {cells.map((c) => <td key={c.key}>{c.node}</td>)}
                          <td style={{ whiteSpace: "nowrap" }}>
                            {isEditing ? (
                              <>
                                <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => saveRowEdit(p.id)}>Save</button>{" "}
                                <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => deleteRow(p.id)}>Delete</button>
                              </>
                            ) : (
                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => startRowEdit(p)}>Edit</button>
                            )}
                          </td>
                        </tr>
                        {updatesOpenId === p.id && (
                          <tr>
                            <td colSpan={cells.length + 1} style={{ background: "var(--panel-muted)" }}>
                              <div style={{ padding: "8px 2px" }}>
                                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                                  Updates from Exim Team
                                </div>
                                <div>
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
