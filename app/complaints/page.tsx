"use client";

import { useEffect, useMemo, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { Complaint, JobOrder, SalesPerson, fmtDate } from "@/lib/jobOrders";

type ComplaintType = "indonesia" | "traded";

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [complaintType, setComplaintType] = useState<ComplaintType | null>(null);

  const [soNo, setSoNo] = useState("");
  const [soSuggestOpen, setSoSuggestOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
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
    fetch("/api/job-orders", { cache: "no-store" }).then((r) => r.json()).then((d) => setJobOrders(d.jobOrders ?? []));
  }, []);

  function resetForm() {
    setComplaintType(null);
    setSoNo(""); setSoSuggestOpen(false);
    setCustomerName(""); setItemDescription(""); setQuantity("1");
    setProblemDescription(""); setSubmittedBy("");
    setPhotos(null);
    setFileInputKey((k) => k + 1);
    setShowForm(false);
  }

  const soSuggestions = useMemo(() => {
    const term = soNo.trim().toLowerCase();
    if (!term) return [];
    return jobOrders.filter((jo) => jo.so_no.toLowerCase().includes(term)).slice(0, 8);
  }, [soNo, jobOrders]);

  function pickSoSuggestion(jo: JobOrder) {
    setSoNo(jo.so_no);
    setCustomerName(jo.customer_name);
    setItemDescription(jo.item_description);
    setSoSuggestOpen(false);
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("customerName", customerName);
      formData.append("soNo", soNo);
      formData.append("itemDescription", itemDescription);
      formData.append("quantity", quantity);
      formData.append("isTraded", String(complaintType === "traded"));
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
                <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Suggested action</th></tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDate(c.created_at)}</td>
                    <td>{c.customer_name}</td>
                    <td>{c.so_no}</td>
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

  const indonesia = (complaints ?? []).filter((c) => !c.is_traded);
  const traded = (complaints ?? []).filter((c) => c.is_traded);

  const canSubmit = complaintType && customerName.trim() && !saving;

  return (
    <>
      <TabNav active="/complaints" />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Submit a complaint</h2>
          {!showForm && <button className="btn" onClick={() => setShowForm(true)}>+ New Complaint</button>}
        </div>

        {showForm && (
          <div style={{ marginTop: 14 }}>
            {!complaintType ? (
              <div className="field">
                <label>What kind of item is this complaint about?</label>
                <div className="pill-toggle">
                  <button onClick={() => setComplaintType("indonesia")}>Tempsens Indonesia</button>
                  <button onClick={() => setComplaintType("traded")}>Traded Item</button>
                </div>
              </div>
            ) : (
              <>
                <p className="subtle" style={{ marginTop: -4 }}>
                  {complaintType === "indonesia" ? "Tempsens Indonesia" : "Traded Item"} —{" "}
                  <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => { setComplaintType(null); setSoNo(""); setCustomerName(""); setItemDescription(""); }}>
                    change type
                  </span>
                </p>

                <div className="grid">
                  <div className="field" style={{ position: "relative" }}>
                    <label>SO Number</label>
                    <input
                      type="text"
                      value={soNo}
                      onChange={(e) => { setSoNo(e.target.value); setSoSuggestOpen(true); if (complaintType === "traded") return; setCustomerName(""); setItemDescription(""); }}
                      onFocus={() => setSoSuggestOpen(true)}
                      onBlur={() => setTimeout(() => setSoSuggestOpen(false), 150)}
                      placeholder="e.g. SO-121"
                    />
                    {complaintType === "indonesia" && soSuggestOpen && soSuggestions.length > 0 && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                        background: "var(--panel, #fff)", border: "1px solid var(--border)", borderRadius: 6,
                        marginTop: 2, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}>
                        {soSuggestions.map((jo) => (
                          <div
                            key={jo.id}
                            onMouseDown={() => pickSoSuggestion(jo)}
                            style={{ padding: "6px 10px", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid var(--panel-muted)" }}
                          >
                            <strong>{jo.so_no}</strong> — {jo.item_description} ({jo.item_no})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {complaintType === "indonesia" ? (
                    <>
                      <div className="field">
                        <label>Customer Name</label>
                        <div className="subtle" style={{ padding: "8px 0" }}>{customerName || "Select an SO number above"}</div>
                      </div>
                      <div className="field">
                        <label>Item Description</label>
                        <div className="subtle" style={{ padding: "8px 0" }}>{itemDescription || "Select an SO number above"}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field"><label>Customer Name</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
                      <div className="field"><label>Item Description</label><input type="text" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} /></div>
                    </>
                  )}

                  <div className="field"><label>Quantity</label><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
                  <div className="field">
                    <label>Sales person</label>
                    <select value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)}>
                      <option value="">Select...</option>
                      {salesPeople.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
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
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={submit} disabled={!canSubmit}>{saving ? "Submitting..." : "Submit complaint"}</button>
                  <button className="btn secondary" onClick={resetForm}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!complaints ? <p className="subtle">Loading...</p> : (
        <>
          <ComplaintTable items={indonesia} title="Complaints — Tempsens Indonesia" />
          <ComplaintTable items={traded} title="Complaints — Traded Item" />
        </>
      )}
    </>
  );
}
