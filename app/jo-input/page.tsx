"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { ItemCategory, SalesPerson } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; }

function formatDdMmmYyyy(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${day}-${month}-${d.getFullYear()}`;
}

export default function JoInputPage() {
  const [customerName, setCustomerName] = useState("");
  const [soNo, setSoNo] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [itemNo, setItemNo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [drawingNumber, setDrawingNumber] = useState("");
  const [salesPersonName, setSalesPersonName] = useState("");
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<string | null>(null);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayDisplay = formatDdMmmYyyy(todayIso);

  useEffect(() => {
    fetch("/api/item-categories", { cache: "no-store" }).then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
    fetch("/api/sales-people", { cache: "no-store" }).then((r) => r.json()).then((d) => setSalesPeople(d.salesPeople ?? []));
  }, []);

  async function onItemNoChange(value: string) {
    setItemNo(value);
    if (!value) { setCatalogSuggestions([]); return; }
    const res = await fetch(`/api/item-catalog?q=${encodeURIComponent(value)}`, { cache: "no-store" });
    const data = await res.json();
    setCatalogSuggestions(data.items ?? []);
  }

  function pickSuggestion(item: CatalogItem) {
    setItemNo(item.item_no);
    setCatalogSuggestions([]);
  }

  function onDrawingChange(file: File | null) {
    setDrawingFile(file);
    if (drawingPreview) URL.revokeObjectURL(drawingPreview);
    setDrawingPreview(file ? URL.createObjectURL(file) : null);
  }

  function resetForm() {
    setCustomerName(""); setSoNo(""); setItemDescription(""); setItemCategory("");
    setQuantity("1"); setItemNo(""); setDeadline(""); setUrgent(false); setDrawingNumber("");
    setSalesPersonName("");
    onDrawingChange(null);
    setPoFile(null);
    setFileInputKey((k) => k + 1);
  }

  async function submit() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("customerName", customerName);
      formData.append("soNo", soNo);
      formData.append("itemCategory", itemCategory);
      formData.append("itemDescription", itemDescription);
      formData.append("quantity", quantity);
      formData.append("itemNo", itemNo);
      formData.append("salesPersonName", salesPersonName);
      formData.append("deadline", deadline);
      formData.append("urgent", String(urgent));
      formData.append("drawingNumber", drawingNumber);
      if (drawingFile) formData.append("drawing", drawingFile);
      if (poFile) formData.append("po", poFile);

      const res = await fetch("/api/job-orders", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create job order."); return; }
      setSuccess(`Created ${data.jobOrder.jo_number} — sent to Sales Manager for approval.`);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TabNav active="" />
      <p style={{ marginBottom: 10 }}><a href="/dashboard" className="subtle">← Back to Dashboard</a></p>

      <div className="card" style={{ maxWidth: 720 }}>
        <h2 style={{ textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>Job Order</h2>

        <div className="form-sheet" style={{ marginTop: 18 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Customer Name</label><span>:</span><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
            <div className="form-row"><label>SO Number</label><span>:</span><input type="text" value={soNo} onChange={(e) => setSoNo(e.target.value)} /></div>
            <div className="form-row"><label>Item Description</label><span>:</span><input type="text" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} /></div>
            <div className="form-row"><label>Category</label><span>:</span>
              <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                <option value="">Select...</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Quantity</label><span>:</span><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          </div>

          <div className="form-sheet-col">
            <div className="form-row" style={{ position: "relative" }}>
              <label>Item Code</label><span>:</span>
              <input type="text" value={itemNo} onChange={(e) => onItemNoChange(e.target.value)} autoComplete="off" />
              {catalogSuggestions.length > 0 && (
                <div style={{ position: "absolute", zIndex: 10, top: "100%", left: "35%", background: "white", border: "1px solid var(--border)", borderRadius: 8, width: "65%", maxHeight: 160, overflowY: "auto" }}>
                  {catalogSuggestions.map((s) => (
                    <div key={s.item_no} onClick={() => pickSuggestion(s)} style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--panel-muted)" }}>
                      <b>{s.item_no}</b> — {s.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-row"><label>JO Date</label><span>:</span><span className="subtle">{todayDisplay} (today)</span></div>
            <div className="form-row">
              <label>Deadline</label><span>:</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="date" value={deadline} min={todayIso} onChange={(e) => setDeadline(e.target.value)} style={{ flex: 1 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 4, margin: 0, textTransform: "none", fontSize: "0.78rem", whiteSpace: "nowrap", cursor: "pointer" }}>
                  <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} style={{ width: 14, height: 14 }} />
                  Urgent
                </label>
              </div>
            </div>
            {deadline && <div className="form-row"><label></label><span></span><span className="subtle">{formatDdMmmYyyy(deadline)}</span></div>}
            <div className="form-row"><label>Drawing Number</label><span>:</span><input type="text" value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} /></div>
            <div className="form-row"><label>Sales</label><span>:</span>
              <select value={salesPersonName} onChange={(e) => setSalesPersonName(e.target.value)}>
                <option value="">Select...</option>
                {salesPeople.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="field">
            <label>Drawing file (PDF/JPG)</label>
            <input key={`drawing-${fileInputKey}`} type="file" accept="application/pdf,image/*" onChange={(e) => onDrawingChange(e.target.files?.[0] || null)} />
            {drawingPreview && (
              drawingFile?.type === "application/pdf" ? (
                <iframe src={drawingPreview} style={{ marginTop: 8, width: "100%", height: 260, border: "1px solid var(--border)", borderRadius: 8 }} title="Drawing PDF preview" />
              ) : (
                <img src={drawingPreview} alt="Drawing preview" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
              )
            )}
          </div>
          <div className="field">
            <label>PO attachment (PDF/JPG)</label>
            <input key={`po-${fileInputKey}`} type="file" accept="application/pdf,image/*" onChange={(e) => setPoFile(e.target.files?.[0] || null)} />
            {poFile && <p className="subtle" style={{ marginTop: 6 }}>{poFile.name} selected</p>}
          </div>
        </div>

        {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
        {success && <p style={{ color: "var(--good)", fontSize: "0.85rem", marginTop: 12 }}>{success}</p>}
        <button className="btn" style={{ marginTop: 12 }} onClick={submit} disabled={saving || !customerName.trim()}>
          {saving ? "Creating..." : "Create Job Order"}
        </button>
      </div>
    </>
  );
}
