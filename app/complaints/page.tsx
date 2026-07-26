"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { Complaint, SalesPerson, fmtDate } from "@/lib/jobOrders";

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isTraded, setIsTraded] = useState(false);
  const [problemDescription, setProblemDescription] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionText, setActionText] = useState("");

  async function load() {
    const res = await fetch("/api/complaints", { cache: "no-store" });
    const data = await res.json();
    setComplaints(data.complaints ?? []);
  }

  useEffect(() => {
    load();
    fetch("/api/sales-people", { cache: "no-store" }).then((r) => r.json()).then((d) => setSalesPeople(d.salesPeople ?? []));
  }, []);

  function resetForm() {
    setCustomerName(""); setPoNumber(""); setItemDescription(""); setQuantity("1");
    setIsTraded(false); setProblemDescription(""); setSubmittedBy("");
    setPhotos(null);
    setFileInputKey((k) => k + 1);
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("customerName", customerName);
      formData.append("poNumber", poNumber);
      formData.append("itemDescription", itemDescription);
      formData.append("quantity", quantity);
      formData.append("isTraded", String(isTraded));
      formData.append("problemDescription", problemDescription);
      formData.append("submittedBy", submittedBy);
      if (photos) Array.from(photos).forEach((f: File) => formData.append("photos", f));

      const res = await fetch("/api/complaints", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to submit complaint."); return; }
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function viewPhoto(path: string) {
    const res = await fetch(`/api/complaints/x/photo?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/complaints/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    load();
  }

  async function saveAction(id: string) {
    await fetch(`/api/complaints/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestedAction: actionText }),
    });
    setEditingActionId(null);
    load();
  }

  function ComplaintTable({ items, title }: { items: Complaint[]; title: string }) {
    return (
      <div className="card">
        <h2>{title} ({items.length})</h2>
        {items.length === 0 ? <p className="subtle">None.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Customer</th><th>PO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Suggested action</th></tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDate(c.created_at)}</td>
                    <td>{c.customer_name}</td>
                    <td>{c.po_number}</td>
                    <td>{c.item_description}</td>
                    <td>{c.quantity}</td>
                    <td style={{ maxWidth: 180 }}>{c.problem_description}</td>
                    <td>
                      {c.photo_paths.map((p, i) => (
                        <button key={i} className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 6px", marginRight: 4 }} onClick={() => viewPhoto(p)}>#{i + 1}</button>
                      ))}
                    </td>
                    <td>
                      <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)}>
                        <option value="not_done">Not Done</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      {editingActionId === c.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <input type="text" value={actionText} onChange={(e) => setActionText(e.target.value)} />
                          <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => saveAction(c.id)}>Save</button>
                        </div>
                      ) : (
                        <span onClick={() => { setEditingActionId(c.id); setActionText(c.suggested_action); }} style={{ cursor: "pointer" }}>
                          {c.suggested_action || <span className="subtle">Click to add...</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const manufactured = (complaints ?? []).filter((c) => !c.is_traded);
  const traded = (complaints ?? []).filter((c) => c.is_traded);

  return (
    <>
      <TabNav active="/complaints" />

      <div className="card">
        <h2>Submit a complaint</h2>
        <div className="grid">
          <div className="field"><label>Customer name</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div className="field"><label>PO number</label><input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /></div>
          <div className="field"><label>Item description</label><input type="text" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} /></div>
          <div className="field"><label>Quantity</label><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <div className="field">
            <label>Sales person</label>
            <select value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)}>
              <option value="">Select...</option>
              {salesPeople.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Product type</label>
            <div className="pill-toggle">
              <button className={!isTraded ? "active" : ""} onClick={() => setIsTraded(false)}>We manufacture</button>
              <button className={isTraded ? "active" : ""} onClick={() => setIsTraded(true)}>Traded (Tempsens India)</button>
            </div>
          </div>
        </div>
        <div className="field">
          <label>Problem description</label>
          <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>Photos (gallery, PDF, JPEG, etc.)</label>
          <input key={fileInputKey} type="file" accept="image/*,application/pdf" multiple onChange={(e) => setPhotos(e.target.files)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" onClick={submit} disabled={saving || !customerName.trim()}>{saving ? "Submitting..." : "Submit complaint"}</button>
      </div>

      {!complaints ? <p className="subtle">Loading...</p> : (
        <>
          <ComplaintTable items={manufactured} title="Complaints — We Manufacture" />
          <ComplaintTable items={traded} title="Complaints — Traded (Tempsens India)" />
        </>
      )}
    </>
  );
}
