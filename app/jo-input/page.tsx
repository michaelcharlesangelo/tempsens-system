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
      setSuccess(`Created ${data.jobOrder.jo_number}. Ready for the next one.`);
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TabNav active="/jo-input" />
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>New job order</h2>
        <div className="grid">
          <div className="field">
            <label>Customer name</label>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="field">
            <label>SO No.</label>
            <input type="text" value={soNo} onChange={(e) => setSoNo(e.target.value)} />
          </div>
          <div className="field">
            <label>Item category</label>
            <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
              <option value="">Select...</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ position: "relative" }}>
            <label>Item No.</label>
            <input type="text" value={itemNo} onChange={(e) => onItemNoChange(e.target.value)} autoComplete="off" />
            {catalogSuggestions.length > 0 && (
              <div style={{ position: "absolute", zIndex: 10, background: "white", border: "1px solid var(--border)", borderRadius: 8, width: "100%", maxHeight: 160, overflowY: "auto" }}>
                {catalogSuggestions.map((s) => (
                  <div key={s.item_no} onClick={() => pickSuggestion(s)} style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--panel-muted)" }}>
                    <b>{s.item_no}</b> — {s.description}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="field">
            <label>Sales person</label>
            <select value={salesPersonName} onChange={(e) => setSalesPersonName(e.target.value)}>
              <option value="">Select...</option>
              {salesPeople.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" id="urgent" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} style={{ width: "auto" }} />
          <label htmlFor="urgent" style={{ margin: 0, textTransform: "none", fontSize: "0.9rem", cursor: "pointer" }}>Mark as urgent</label>
        </div>

        <div className="field">
          <label>Item description</label>
          <textarea value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
        </div>

        <div className="grid">
          <div className="field">
            <label>Drawing (PDF/JPG)</label>
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

        {error && <p className="error-text">{error}</p>}
        {success && <p style={{ color: "var(--good)", fontSize: "0.85rem" }}>{success}</p>}
        <button className="btn" onClick={submit} disabled={saving || !customerName.trim()}>
          {saving ? "Creating..." : "Create job order (draft)"}
        </button>
      </div>
    </>
  );
}
