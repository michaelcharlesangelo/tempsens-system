"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { ItemCategory, SalesPerson } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; }

export default function JoInputPage() {
  const [customerName, setCustomerName] = useState("");
  const [soNo, setSoNo] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [itemNo, setItemNo] = useState("");
  const [salesPersonName, setSalesPersonName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<string | null>(null);
  const [poFile, setPoFile] = useState<File | null>(null);

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

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
    setItemDescription(item.description);
    setCatalogSuggestions([]);
  }

  function onDrawingChange(file: File | null) {
    setDrawingFile(file);
    if (drawingPreview) URL.revokeObjectURL(drawingPreview);
    setDrawingPreview(file ? URL.createObjectURL(file) : null);
  }

  function resetForm() {
    setCustomerName(""); setSoNo(""); setItemCategory(""); setItemDescription("");
    setQuantity("1"); setItemNo(""); setSalesPersonName(""); setDeadline(""); setUrgent(false);
    onDrawingChange(null); setPoFile(null);
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
      if (drawingFile) formData.append("drawing", drawingFile);
      if (poFile) formData.append("po", poFile);

      const res = await fetch("/api/job-orders", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create job order."); return; }
      setSuccess(`Created ${data.jobOrder.jo_number}.`);
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

        <div className="form-sheet">
          <div className="form-sheet-col">
            <div className="form-row"><label>Nama Customer</label><span>:</span><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
            <div className="form-row"><label>Nomor SO</label><span>:</span><input type="text" value={soNo} onChange={(e) => setSoNo(e.target.value)} /></div>
            <div className="form-row"><label>Nama Barang</label><span>:</span><input type="text" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} /></div>
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
            <div className="form-row"><label>Qty</label><span>:</span><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          </div>

          <div className="form-sheet-col">
            <div className="form-row"><label>Tanggal JO</label><span>:</span><span className="subtle">{today} (today)</span></div>
            <div className="form-row"><label>Deadline</label><span>:</span><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
            <div className="form-row">
              <label>Urgent</label><span>:</span>
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} style={{ width: "auto" }} />
            </div>
            <div className="form-row"><label>Category</label><span>:</span>
              <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                <option value="">Select...</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
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
            <label>Drawing No. (PDF/JPG)</label>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => onDrawingChange(e.target.files?.[0] || null)} />
            {drawingPreview && (
              drawingFile?.type === "application/pdf" ? (
                <p className="subtle" style={{ marginTop: 6 }}>{drawingFile.name} (PDF selected)</p>
              ) : (
                <img src={drawingPreview} alt="Drawing preview" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
              )
            )}
          </div>
          <div className="field">
            <label>PO attachment (PDF/JPG)</label>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setPoFile(e.target.files?.[0] || null)} />
            {poFile && <p className="subtle" style={{ marginTop: 6 }}>{poFile.name} selected</p>}
          </div>
        </div>

        {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
        {success && <p style={{ color: "var(--good)", fontSize: "0.85rem", marginTop: 12 }}>{success}</p>}
        <button className="btn" style={{ marginTop: 12 }} onClick={submit} disabled={saving || !customerName.trim()}>
          {saving ? "Creating..." : "Create job order"}
        </button>
        <p className="subtle" style={{ marginTop: 10 }}>
          Bill of Material is filled in later by the Production Manager after approval.
        </p>
      </div>
    </>
  );
}
