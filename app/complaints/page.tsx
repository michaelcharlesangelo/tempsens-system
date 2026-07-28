"use client";

import { useEffect, useMemo, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { Complaint, JobOrder, SalesPerson, complaintMatchesSearch, fmtDate } from "@/lib/jobOrders";

type ComplaintType = "indonesia" | "traded";

// Module-scope (not defined inside ComplaintsPage's render body) so typing
// in the parent's action-text input doesn't redefine this component and
// force a remount every keystroke - see CLAUDE.md's "table components at
// module scope" convention.
function ComplaintTable({
  items, title, showFinish, historyItems, historyTitle,
  viewPhoto, updateStatus, editingActionId, actionText, setEditingActionId, setActionText, saveAction,
  finishing, finishComplaint,
}: {
  items: Complaint[]; title: string; showFinish: boolean;
  historyItems: Complaint[]; historyTitle: string;
  viewPhoto: (path: string) => void;
  updateStatus: (id: string, status: string) => void;
  editingActionId: string | null; actionText: string;
  setEditingActionId: (id: string | null) => void; setActionText: (t: string) => void;
  saveAction: (id: string) => void;
  finishing: string | null; finishComplaint: (c: Complaint) => void;
}) {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, complaintMatchesSearch);
  const historyPaged = usePagedSearch(historyItems, complaintMatchesSearch);

  // A plain function (not a nested component) - called directly inside
  // .map() below rather than as a JSX tag, so it doesn't introduce a new
  // component identity that would remount on every parent re-render (e.g.
  // every keystroke while editing actionText).
  function renderRow(c: Complaint, editable: boolean) {
    return (
      <tr key={c.id}>
        <td>{fmtDate(c.created_at)}</td>
        <td>{c.customer_name}</td>
        <td>{c.so_no}</td>
        <td>{c.item_description}</td>
        <td>{c.quantity}</td>
        <td style={{ maxWidth: 180 }}>{c.problem_description}</td>
        <td>
          {c.photo_paths.map((p, i) => (
            <button key={i} className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 6px", marginRight: 4 }} onClick={() => viewPhoto(p)}>View{c.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
          ))}
        </td>
        <td>
          {editable ? (
            <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)}>
              <option value="not_done">Not Done</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          ) : (
            c.status === "done" ? "Done" : c.status === "in_progress" ? "In Progress" : "Not Done"
          )}
        </td>
        <td style={{ minWidth: 180 }}>
          {editable && editingActionId === c.id ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input type="text" value={actionText} onChange={(e) => setActionText(e.target.value)} />
              <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => saveAction(c.id)}>Save</button>
            </div>
          ) : editable ? (
            <span onClick={() => { setEditingActionId(c.id); setActionText(c.suggested_action); }} style={{ cursor: "pointer" }}>
              {c.suggested_action || <span className="subtle">Click to add...</span>}
            </span>
          ) : (
            c.suggested_action || <span className="subtle">-</span>
          )}
        </td>
        {showFinish && (
          <td style={{ textAlign: "center" }}>
            {editable && c.status === "done" && (
              <input
                type="checkbox"
                checked={false}
                disabled={finishing === c.id}
                onChange={() => finishComplaint(c)}
                style={{ width: 20, height: 20, accentColor: "var(--good)" }}
                title="Tick once resolved to move this complaint to History"
              />
            )}
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setOpen((v) => !v)}>
          <span style={{ display: "inline-block", fontSize: "0.75em", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
          {title} ({items.length})
        </h2>
        <button className="btn secondary" onClick={() => setHistoryOpen((v) => !v)}>
          {historyOpen ? "Hide History" : `History (${historyItems.length})`}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {items.length === 0 ? <p className="subtle">None.</p> : (
            <>
              <SearchBox value={search} onChange={setSearch} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <colgroup>
                    <col style={{ width: "8%" }} /><col style={{ width: "12%" }} /><col style={{ width: "8%" }} />
                    <col style={{ width: "14%" }} /><col style={{ width: "5%" }} /><col style={{ width: "18%" }} />
                    <col style={{ width: "8%" }} /><col style={{ width: "10%" }} /><col style={{ width: "12%" }} />
                    {showFinish && <col style={{ width: "5%" }} />}
                  </colgroup>
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Suggested action</th>{showFinish && <th>Finish</th>}</tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c) => renderRow(c, true))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
            </>
          )}
        </div>
      )}

      {historyOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 8px" }}>{historyTitle} ({historyItems.length})</h3>
          {historyItems.length === 0 ? <p className="subtle">None yet.</p> : (
            <>
              <SearchBox value={historyPaged.search} onChange={historyPaged.setSearch} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <colgroup>
                    <col style={{ width: "9%" }} /><col style={{ width: "13%" }} /><col style={{ width: "9%" }} />
                    <col style={{ width: "15%" }} /><col style={{ width: "6%" }} /><col style={{ width: "20%" }} />
                    <col style={{ width: "9%" }} /><col style={{ width: "10%" }} /><col style={{ width: "9%" }} />
                  </colgroup>
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Suggested action</th></tr>
                  </thead>
                  <tbody>
                    {historyPaged.pageItems.map((c) => renderRow(c, false))}
                  </tbody>
                </table>
              </div>
              <Pager page={historyPaged.page} totalPages={historyPaged.totalPages} totalCount={historyPaged.totalCount} onChange={historyPaged.setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [finishing, setFinishing] = useState<string | null>(null);

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
    const matched = salesPeople.find((p) => p.name === jo.sales_person_name);
    if (matched) setSubmittedBy(matched.name);
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

  async function finishComplaint(c: Complaint) {
    if (!confirm(`Mark this complaint (SO ${c.so_no}) as finished? It will move to History.`)) return;
    setFinishing(c.id);
    try {
      await fetch(`/api/complaints/${c.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }),
      });
      load();
    } finally {
      setFinishing(null);
    }
  }

  // Done complaints drop off the main table 7 days after resolution even
  // without a manual Finish tick, matching the Dashboard's auto-archive.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  function isExpired(c: Complaint): boolean {
    return c.status === "done" && !!c.resolved_at && Date.now() - new Date(c.resolved_at).getTime() > SEVEN_DAYS_MS;
  }

  const visible = (complaints ?? []).filter((c) => !c.archived && !isExpired(c));
  const history = (complaints ?? []).filter((c) => c.archived || isExpired(c));

  const indonesia = visible.filter((c) => !c.is_traded);
  const traded = visible.filter((c) => c.is_traded);
  const historyIndonesia = history.filter((c) => !c.is_traded);
  const historyTraded = history.filter((c) => c.is_traded);

  const canSubmit = complaintType && customerName.trim() && !saving;

  const tableProps = {
    viewPhoto, updateStatus, editingActionId, actionText, setEditingActionId, setActionText, saveAction, finishing, finishComplaint,
  };

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
                      {salesPeople.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Problem description</label>
                  <textarea value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} />
                </div>
                <div className="field">
                  <label>Photos (PDF/JPG)</label>
                  <input key={fileInputKey} type="file" accept="application/pdf,image/jpeg" multiple onChange={(e) => setPhotos(e.target.files)} />
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
          <ComplaintTable
            items={indonesia} title="Complaints — Tempsens Indonesia" showFinish
            historyItems={historyIndonesia} historyTitle="History — Tempsens Indonesia"
            {...tableProps}
          />
          <ComplaintTable
            items={traded} title="Complaints — Traded Item" showFinish
            historyItems={historyTraded} historyTitle="History — Traded Item"
            {...tableProps}
          />
        </>
      )}
    </>
  );
}
