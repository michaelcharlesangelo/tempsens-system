"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import TruncatedText from "@/app/components/TruncatedText";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import { Complaint, JobOrder, COMPLAINT_STATUSES, complaintMatchesSearch, fmtDate, fmtDateTime } from "@/lib/jobOrders";

interface SalesAccount { id: string; full_name: string; }

type ComplaintType = "indonesia" | "traded";

interface EditDraft {
  customerName: string; soNo: string; itemDescription: string; quantity: string; problemDescription: string;
}

// Module-scope (not defined inside ComplaintsPage's render body) so typing
// in the parent's action-text input doesn't redefine this component and
// force a remount every keystroke - see CLAUDE.md's "table components at
// module scope" convention.
function ComplaintTable({
  items, title,
  viewPhoto, editingId, editDraft, startEdit, setEditDraft, saveEdit, deleteComplaint, saving,
  logOpenId, setLogOpenId,
}: {
  items: Complaint[]; title: string;
  viewPhoto: (path: string) => void;
  editingId: string | null; editDraft: EditDraft | null;
  startEdit: (c: Complaint) => void; setEditDraft: (d: EditDraft) => void;
  saveEdit: (id: string) => void; deleteComplaint: (id: string) => void; saving: boolean;
  logOpenId: string | null; setLogOpenId: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hideFinished, setHideFinished] = useState(true);
  const visible = items.filter((c) => !hideFinished || c.status !== "done");
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(visible, complaintMatchesSearch);

  // A plain function (not a nested component) - called directly inside
  // .map() below rather than as a JSX tag, so it doesn't introduce a new
  // component identity that would remount on every parent re-render.
  function renderRow(c: Complaint) {
    const isEditing = editingId === c.id;
    const d = editDraft;
    const meta = COMPLAINT_STATUSES.find((s) => s.value === c.status)!;
    return (
      <Fragment key={c.id}>
        <tr>
          <td>{fmtDate(c.created_at)}</td>
          <td>{isEditing && d ? <input type="text" value={d.customerName} onChange={(e) => setEditDraft({ ...d, customerName: e.target.value })} style={{ fontSize: "0.82rem" }} /> : c.customer_name}</td>
          <td>{isEditing && d ? <input type="text" value={d.soNo} onChange={(e) => setEditDraft({ ...d, soNo: e.target.value.toUpperCase() })} style={{ fontSize: "0.82rem" }} /> : c.so_no}</td>
          <td>{isEditing && d ? <input type="text" value={d.itemDescription} onChange={(e) => setEditDraft({ ...d, itemDescription: e.target.value })} style={{ fontSize: "0.82rem" }} /> : <TruncatedText text={c.item_description} />}</td>
          <td>{isEditing && d ? <input type="number" value={d.quantity} onChange={(e) => setEditDraft({ ...d, quantity: e.target.value })} style={{ fontSize: "0.82rem", width: 60 }} /> : c.quantity}</td>
          <td style={{ maxWidth: 180 }}>{isEditing && d ? <input type="text" value={d.problemDescription} onChange={(e) => setEditDraft({ ...d, problemDescription: e.target.value })} style={{ fontSize: "0.82rem" }} /> : c.problem_description}</td>
          <td>
            {c.photo_paths.length === 0 ? <span className="subtle">-</span> : c.photo_paths.map((p, i) => (
              <button key={i} className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 6px", marginRight: 4 }} onClick={() => viewPhoto(p)}>View{c.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
            ))}
          </td>
          <td>
            <span className="pill" style={{ background: meta.color, color: "white", cursor: "pointer" }} onClick={() => setLogOpenId(logOpenId === c.id ? null : c.id)}>
              {meta.label}
            </span>
          </td>
          <td>
            {(c.engineering_photo_paths ?? []).length === 0 ? <span className="subtle">-</span> : (c.engineering_photo_paths ?? []).map((p, i) => (
              <button key={i} className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 6px", marginRight: 4 }} onClick={() => viewPhoto(p)}>View{(c.engineering_photo_paths ?? []).length > 1 ? ` ${i + 1}` : ""}</button>
            ))}
          </td>
          <td style={{ whiteSpace: "nowrap" }}>
            {isEditing ? (
              <>
                <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} disabled={saving} onClick={() => saveEdit(c.id)}>Save</button>{" "}
                <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => deleteComplaint(c.id)}>Delete</button>
              </>
            ) : (
              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => startEdit(c)}>Edit</button>
            )}
          </td>
        </tr>
        {logOpenId === c.id && (
          <tr>
            <td colSpan={10} style={{ background: "var(--panel-muted)" }}>
              <div style={{ padding: "8px 2px" }}>
                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Updates from Engineering</div>
                {c.history.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : c.history.map((h) => (
                  <div key={h.id} style={{ fontSize: "0.82rem", padding: "3px 0" }}>
                    <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpen((v) => !v)}>
          <span style={{ display: "inline-block", fontSize: "0.75em", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
          {title} ({items.length})
        </h2>
        <ToggleSwitch checked={hideFinished} onChange={setHideFinished} label="Hide Finished" color="var(--good)" />
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {items.length === 0 ? <p className="subtle">None.</p> : totalCount === 0 ? <p className="subtle">Nothing to show for the selected filter.</p> : (
            <>
              <SearchBox value={search} onChange={setSearch} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Photos Update</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c) => renderRow(c))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [salesAccounts, setSalesAccounts] = useState<SalesAccount[]>([]);
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
  // Staged as an array (not a single FileList) so a second file-picker
  // round adds to what's already chosen instead of replacing it - native
  // <input type=file> selection always replaces the FileList otherwise.
  const [photos, setPhotos] = useState<File[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<FileList | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [logOpenId, setLogOpenId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/complaints", { cache: "no-store" });
    const data = await res.json();
    setComplaints(data.complaints ?? []);
  }

  useEffect(() => {
    load();
    fetch("/api/production-accounts?forSales=true", { cache: "no-store" }).then((r) => r.json()).then((d) => setSalesAccounts(d.accounts ?? []));
    fetch("/api/job-orders", { cache: "no-store" }).then((r) => r.json()).then((d) => setJobOrders(d.jobOrders ?? []));
  }, []);

  function resetForm() {
    setComplaintType(null);
    setSoNo(""); setSoSuggestOpen(false);
    setCustomerName(""); setItemDescription(""); setQuantity("1");
    setProblemDescription(""); setSubmittedBy("");
    setPhotos([]);
    setPendingPhotos(null);
    setFileInputKey((k) => k + 1);
    setShowForm(false);
  }

  function addPendingPhotos() {
    if (!pendingPhotos || pendingPhotos.length === 0) return;
    setPhotos((cur) => [...cur, ...Array.from(pendingPhotos)]);
    setPendingPhotos(null);
    setFileInputKey((k) => k + 1);
  }

  function removePhoto(i: number) {
    setPhotos((cur) => cur.filter((_, idx) => idx !== i));
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
    // Prefill straight from the JO's own sales person regardless of
    // whether that name still shows up in the current qualifying-account
    // list (e.g. their position changed since) - a strict match here was
    // silently leaving the field blank whenever that happened.
    if (jo.sales_person_name) setSubmittedBy(jo.sales_person_name);
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
      photos.forEach((f) => formData.append("photos", f));

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

  function startEdit(c: Complaint) {
    setEditingId(c.id);
    setEditDraft({
      customerName: c.customer_name, soNo: c.so_no, itemDescription: c.item_description,
      quantity: String(c.quantity), problemDescription: c.problem_description,
    });
    setLogOpenId(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/complaints/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: editDraft.customerName, soNo: editDraft.soNo, itemDescription: editDraft.itemDescription,
          quantity: editDraft.quantity, problemDescription: editDraft.problemDescription,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMessage(data.error || "Failed to save changes."); return; }
      setEditingId(null);
      setEditDraft(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteComplaint(id: string) {
    if (!confirm("Delete this complaint? This can't be undone.")) return;
    const res = await fetch(`/api/complaints/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || "Failed to delete."); return; }
    setEditingId(null);
    setEditDraft(null);
    load();
  }

  // Manually-archived complaints (Engineering's own housekeeping action)
  // stay excluded regardless of the Hide Finished toggle; everything else
  // is shown/hidden by status via that toggle instead of a time window.
  const visible = (complaints ?? []).filter((c) => !c.archived);
  const indonesia = visible.filter((c) => !c.is_traded);
  const traded = visible.filter((c) => c.is_traded);

  const canSubmit = complaintType && customerName.trim() && !saving;

  const tableProps = {
    viewPhoto, editingId, editDraft, startEdit, setEditDraft, saveEdit, deleteComplaint, saving, logOpenId, setLogOpenId,
  };

  return (
    <>

      {message && <div className="warn">{message}</div>}

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
                <div className="pill-toggle equal-width">
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
                      {/* Covers the case where the JO's sales person isn't (or is no longer) in the
                          qualifying-position list - still shown/selected instead of silently blank. */}
                      {submittedBy && !salesAccounts.some((a) => a.full_name === submittedBy) && (
                        <option value={submittedBy}>{submittedBy}</option>
                      )}
                      {salesAccounts.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Problem description</label>
                  <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} />
                </div>
                <div className="field">
                  <label>Photos (PDF/JPG)</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input key={fileInputKey} type="file" accept="application/pdf,image/jpeg" multiple onChange={(e) => setPendingPhotos(e.target.files)} />
                    <button type="button" className="btn secondary" style={{ fontSize: "0.78rem" }} onClick={addPendingPhotos} disabled={!pendingPhotos || pendingPhotos.length === 0}>
                      Add
                    </button>
                  </div>
                  {photos.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {photos.map((f, i) => (
                        <span key={i} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {f.name}
                          <button type="button" onClick={() => removePhoto(i)} style={{ border: "none", background: "none", cursor: "pointer", fontWeight: 700, lineHeight: 1, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
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
          <ComplaintTable items={indonesia} title="Complaints — Tempsens Indonesia" {...tableProps} />
          <ComplaintTable items={traded} title="Complaints — Traded Item" {...tableProps} />
        </>
      )}
    </>
  );
}
