"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DateField from "@/app/components/DateField";
import { ItemCategory, splitMatch } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; }
interface SalesAccount { id: string; full_name: string; }

// Bolds the portion of an item code that matches the current search term
// so the matched prefix stands out in suggestion lists.
function HighlightedCode({ text, term }: { text: string; term: string }) {
  const [before, match, after] = splitMatch(text, term);
  return <>{before}<b>{match}</b>{after}</>;
}

// Which page's "+ New Job Order" / "Edit" link launched this - drives the
// back link at the top so it returns to wherever the user actually came
// from instead of always landing on Sales Support.
const BACK_LINKS: Record<string, string> = {
  "Sales Support": "/sales-support",
  "Sales Support Supervisor": "/sales-support-supervisor",
  "Operational Manager": "/operational-manager",
};

export default function JoInputPage() {
  return (
    <Suspense fallback={<p className="subtle">Loading...</p>}>
      <JoInputInner />
    </Suspense>
  );
}

function JoInputInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditing = !!editId;
  // Tags a new JO with which tab created it - stands in for real per-user
  // "submitted by me" filtering until accounts/login exist.
  const createdByTab = searchParams.get("by") || "Sales Support";

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
  const [poPreview, setPoPreview] = useState<string | null>(null);
  const [existingDrawingUrl, setExistingDrawingUrl] = useState<string | null>(null);
  const [existingDrawingIsPdf, setExistingDrawingIsPdf] = useState(false);
  const [existingDrawingFilename, setExistingDrawingFilename] = useState<string | null>(null);
  const [existingPoUrl, setExistingPoUrl] = useState<string | null>(null);
  const [existingPoIsPdf, setExistingPoIsPdf] = useState(false);
  const [existingPoFilename, setExistingPoFilename] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [existingJoNumber, setExistingJoNumber] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [salesAccounts, setSalesAccounts] = useState<SalesAccount[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch("/api/item-categories", { cache: "no-store" }).then((r) => r.json()).then((d) => setCategories(d.categories ?? []));
    // Only Accounts with a Sales/Sales Manager/General Manager position
    // are selectable here - see SALES_QUALIFYING_POSITIONS.
    fetch("/api/production-accounts?forSales=true", { cache: "no-store" }).then((r) => r.json()).then((d) => setSalesAccounts(d.accounts ?? []));
  }, []);

  useEffect(() => {
    if (!editId) return;
    setLoadingExisting(true);
    fetch(`/api/job-orders/${editId}?tab=jo-input`, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const jo = d.jobOrder;
      if (!jo) { setError("Job order not found."); setLoadingExisting(false); return; }
      setExistingJoNumber(jo.jo_number);
      setCustomerName(jo.customer_name || "");
      setSoNo(jo.so_no || "");
      setItemDescription(jo.item_description || "");
      setItemCategory(jo.item_category || "");
      setQuantity(String(jo.quantity ?? 1));
      setItemNo(jo.item_no || "");
      setDeadline(jo.deadline ? jo.deadline.slice(0, 10) : "");
      setUrgent(!!jo.urgent);
      setDrawingNumber(jo.drawing_number || "");
      setSalesPersonName(jo.sales_person_name || "");
      if (jo.drawing_path) {
        setExistingDrawingIsPdf(jo.drawing_path.toLowerCase().endsWith(".pdf"));
        setExistingDrawingFilename(jo.drawing_filename || null);
        fetch(`/api/job-orders/${editId}/file?type=drawing&tab=jo-input`, { cache: "no-store" }).then((r) => r.json()).then((f) => setExistingDrawingUrl(f.url || null));
      }
      if (jo.po_attachment_path) {
        setExistingPoIsPdf(jo.po_attachment_path.toLowerCase().endsWith(".pdf"));
        setExistingPoFilename(jo.po_attachment_filename || null);
        fetch(`/api/job-orders/${editId}/file?type=po&tab=jo-input`, { cache: "no-store" }).then((r) => r.json()).then((f) => setExistingPoUrl(f.url || null));
      }
      setLoadingExisting(false);
    });
  }, [editId]);

  async function onItemNoChange(value: string) {
    const upper = value.toUpperCase();
    setItemNo(upper);
    if (!upper) { setCatalogSuggestions([]); return; }
    const res = await fetch(`/api/item-catalog?q=${encodeURIComponent(upper)}`, { cache: "no-store" });
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

  function onPoChange(file: File | null) {
    setPoFile(file);
    if (poPreview) URL.revokeObjectURL(poPreview);
    setPoPreview(file ? URL.createObjectURL(file) : null);
  }

  function resetForm() {
    setCustomerName(""); setSoNo(""); setItemDescription(""); setItemCategory("");
    setQuantity("1"); setItemNo(""); setDeadline(""); setUrgent(false); setDrawingNumber("");
    setSalesPersonName("");
    onDrawingChange(null);
    onPoChange(null);
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
      // Only tag on creation - editing shouldn't reassign whose "Submitted" list this shows under.
      if (!isEditing) formData.append("salesSupportName", createdByTab);
      formData.append("deadline", deadline);
      formData.append("urgent", String(urgent));
      formData.append("drawingNumber", drawingNumber);
      if (drawingFile) formData.append("drawing", drawingFile);
      if (poFile) formData.append("po", poFile);

      const url = isEditing ? `/api/job-orders/${editId}/edit` : "/api/job-orders";
      const res = await fetch(url, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save job order."); return; }

      if (isEditing) {
        setSuccess(`Saved changes to ${data.jobOrder.jo_number}.`);
      } else {
        setSuccess(`Created ${data.jobOrder.jo_number} — sent to Sales Manager for approval.`);
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p style={{ marginBottom: 10 }}><a href={BACK_LINKS[createdByTab] || "/sales-support"} className="subtle">← Back to {createdByTab}</a></p>

      <div className="card">
        <h2 style={{ textAlign: "center", marginTop: 0 }}>{isEditing ? `Edit Job Order${existingJoNumber ? ` — ${existingJoNumber}` : ""}` : "Job Order"}</h2>
        {loadingExisting ? <p className="subtle">Loading...</p> : (
        <>
        <div className="form-sheet" style={{ marginTop: 18 }}>
          <div className="form-sheet-col">
            <div className="form-row"><label>Customer Name</label><span>:</span><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value.toUpperCase())} /></div>
            <div className="form-row"><label>SO Number</label><span>:</span><input type="text" value={soNo} onChange={(e) => setSoNo(e.target.value.toUpperCase())} /></div>
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
                      <HighlightedCode text={s.item_no} term={itemNo} /> — {s.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-row"><label>JO Date</label><span>:</span><input type="text" readOnly value={new Date().toLocaleDateString("en-GB")} /></div>
            <div className="form-row">
              <label>Deadline</label><span>:</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}><DateField value={deadline} onChange={setDeadline} min={todayIso} /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 4, margin: 0, textTransform: "none", fontSize: "0.78rem", whiteSpace: "nowrap", cursor: "pointer" }}>
                  <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} style={{ width: 14, height: 14 }} />
                  Urgent
                </label>
              </div>
            </div>
            <div className="form-row"><label>Drawing Number</label><span>:</span><input type="text" value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value.toUpperCase())} /></div>
            <div className="form-row"><label>Sales</label><span>:</span>
              <select value={salesPersonName} onChange={(e) => setSalesPersonName(e.target.value)}>
                <option value="">Select...</option>
                {salesAccounts.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="field">
            <label>Drawing file (PDF/JPG){isEditing ? " — leave blank to keep existing" : ""}</label>
            <input key={`drawing-${fileInputKey}`} type="file" accept="application/pdf,image/*" onChange={(e) => onDrawingChange(e.target.files?.[0] || null)} />
            {drawingPreview ? (
              <div style={{ marginTop: 8 }}>
                {drawingFile?.type === "application/pdf" ? (
                  <iframe src={drawingPreview} style={{ display: "block", width: "100%", height: 260, border: "1px solid var(--border)", borderRadius: 8 }} title="Drawing PDF preview" />
                ) : (
                  <img src={drawingPreview} alt="Drawing preview" style={{ display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
                )}
              </div>
            ) : existingDrawingUrl && (
              <div style={{ marginTop: 8 }}>
                <div className="subtle" style={{ fontSize: "0.72rem", marginBottom: 4 }}>Current file: {existingDrawingFilename || "(unnamed)"}</div>
                {existingDrawingIsPdf ? (
                  <iframe src={existingDrawingUrl} style={{ display: "block", width: "100%", height: 260, border: "1px solid var(--border)", borderRadius: 8 }} title="Current drawing" />
                ) : (
                  <img src={existingDrawingUrl} alt="Current drawing" style={{ display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
                )}
              </div>
            )}
          </div>
          <div className="field">
            <label>PO attachment (PDF/JPG){isEditing ? " — leave blank to keep existing" : ""}</label>
            <input key={`po-${fileInputKey}`} type="file" accept="application/pdf,image/*" onChange={(e) => onPoChange(e.target.files?.[0] || null)} />
            {poPreview ? (
              <div style={{ marginTop: 8 }}>
                {poFile?.type === "application/pdf" ? (
                  <iframe src={poPreview} style={{ display: "block", width: "100%", height: 260, border: "1px solid var(--border)", borderRadius: 8 }} title="PO PDF preview" />
                ) : (
                  <img src={poPreview} alt="PO preview" style={{ display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
                )}
              </div>
            ) : existingPoUrl && (
              <div style={{ marginTop: 8 }}>
                <div className="subtle" style={{ fontSize: "0.72rem", marginBottom: 4 }}>Current file: {existingPoFilename || "(unnamed)"}</div>
                {existingPoIsPdf ? (
                  <iframe src={existingPoUrl} style={{ display: "block", width: "100%", height: 260, border: "1px solid var(--border)", borderRadius: 8 }} title="Current PO" />
                ) : (
                  <img src={existingPoUrl} alt="Current PO" style={{ display: "block", maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
        {success && <p style={{ color: "var(--good)", fontSize: "0.85rem", marginTop: 12 }}>{success}</p>}
        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={submit}
          disabled={saving || !customerName.trim() || !soNo.trim() || !itemDescription.trim() || !itemCategory.trim() || !itemNo.trim()}
        >
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Job Order"}
        </button>
        </>
        )}
      </div>
    </>
  );
}
