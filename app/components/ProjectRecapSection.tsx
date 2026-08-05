"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import ProjectStatusSlider from "@/app/components/ProjectStatusSlider";
import TruncatedText from "@/app/components/TruncatedText";
import { Currency, CURRENCY_SYMBOLS, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { Project, ProjectReport, ProjectStatus, lineItemsTotal } from "@/lib/projects";
import { getCurrentRole } from "@/lib/roles";

// Same "." thousand-separator-as-you-type convention as PO Out / Form.
function formatPrice(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}
function parsePrice(display: string): string {
  return display.replace(/\D/g, "");
}

function projectMatches(p: Project, term: string): boolean {
  return (
    p.project_number.toLowerCase().includes(term) ||
    p.customer_name.toLowerCase().includes(term) ||
    p.po_number.toLowerCase().includes(term)
  );
}

interface LineItemDraft { itemDescription: string; supplier: string; qty: string; unit: string; unitPrice: string; unitPriceCurrency: Currency; }
function blankLineItemDraft(): LineItemDraft {
  return { itemDescription: "", supplier: "", qty: "1", unit: "pcs", unitPrice: "", unitPriceCurrency: "IDR" };
}
interface CostDraft extends LineItemDraft { poCode: string; }
function blankCostDraft(): CostDraft {
  return { ...blankLineItemDraft(), poCode: "" };
}

interface ReportDraft { report: string; nextStep: string; photos: File[]; }
function blankReportDraft(): ReportDraft {
  return { report: "", nextStep: "", photos: [] };
}

// canManage: Project Manager's own page - shows PO Value/Budgeting/Cost
// columns, can add Budgeting lines, can change status to Finished, and
// can edit/delete progress entries and reports. The read-only Project tab
// (canManage=false) hides those columns and can't mark Finished, but can
// still log Progress/Report/Cost via the Status panel - "anyone" per spec.
export default function ProjectRecapSection({ canManage }: { canManage: boolean }) {
  const currentRole = getCurrentRole();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showOngoing, setShowOngoing] = useState(true);
  const [showFinished, setShowFinished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [budgetOpenFor, setBudgetOpenFor] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<LineItemDraft>(blankLineItemDraft());
  const [savingLineItem, setSavingLineItem] = useState(false);

  // Cost is a floating modal (same as Report) - one shared trigger used by
  // the recap's Cost column, the Status panel's Cost checkbox, and the
  // "Cost" button next to each Progress History entry.
  const [costModalFor, setCostModalFor] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState<CostDraft>(blankCostDraft());

  const [statusOpenFor, setStatusOpenFor] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<Record<string, ProjectStatus>>({});
  const [progressComment, setProgressComment] = useState<Record<string, string>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  // The Report checkbox's draft for the update currently being composed -
  // ticks (and stays ticked) once "Save Report" is used inside the modal,
  // without hitting the server yet; clicking the checkbox again reopens it
  // pre-filled for editing. Only actually saved to the server once the
  // main Save button fires, tied to the progress entry it was created for.
  const [reportDraft, setReportDraft] = useState<Record<string, ReportDraft | null>>({});
  const [draftModalFor, setDraftModalFor] = useState<string | null>(null);
  const [draftModalText, setDraftModalText] = useState<ReportDraft>(blankReportDraft());

  // Viewing/editing an already-saved report tied to a past Progress
  // History entry (via the "Report" button next to that entry).
  const [viewReportForEntry, setViewReportForEntry] = useState<string | null>(null);

  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [editProgressComment, setEditProgressComment] = useState("");

  async function load() {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const data = await res.json();
    setProjects(data.projects ?? []);
  }
  useEffect(() => { load(); }, []);

  async function viewPhoto(path: string) {
    const res = await fetch(`/api/complaints/x/photo?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  function toggleBudget(projectId: string) {
    setBudgetOpenFor((cur) => (cur === projectId ? null : projectId));
    setBudgetDraft(blankLineItemDraft());
  }

  async function addBudgetItem(projectId: string) {
    if (!budgetDraft.itemDescription.trim()) return;
    setSavingLineItem(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/budget`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...budgetDraft, unitPrice: parsePrice(budgetDraft.unitPrice) }),
      });
      if (!res.ok) { setMessage("Failed to add budget line."); return; }
      setBudgetDraft(blankLineItemDraft());
      load();
    } finally {
      setSavingLineItem(false);
    }
  }
  async function deleteBudgetItem(projectId: string, itemId: string) {
    if (!confirm("Remove this budget line?")) return;
    await fetch(`/api/projects/${projectId}/budget/${itemId}`, { method: "DELETE" });
    load();
  }

  function openCostModal(projectId: string) {
    setCostModalFor(projectId);
    setCostDraft(blankCostDraft());
  }

  async function addCostItem(projectId: string) {
    if (!costDraft.itemDescription.trim()) return;
    setSavingLineItem(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...costDraft, unitPrice: parsePrice(costDraft.unitPrice), submittedBy: currentRole.label }),
      });
      if (!res.ok) { setMessage("Failed to add cost line."); return; }
      setCostDraft(blankCostDraft());
      load();
    } finally {
      setSavingLineItem(false);
    }
  }
  async function deleteCostItem(projectId: string, itemId: string) {
    if (!confirm("Remove this cost line?")) return;
    await fetch(`/api/projects/${projectId}/cost/${itemId}`, { method: "DELETE" });
    load();
  }

  function openStatus(p: Project) {
    if (statusOpenFor === p.id) { setStatusOpenFor(null); return; }
    setStatusOpenFor(p.id);
    setStatusDraft((cur) => ({ ...cur, [p.id]: p.status }));
    setProgressComment((cur) => ({ ...cur, [p.id]: cur[p.id] ?? "" }));
    setViewReportForEntry(null);
  }

  async function saveStatus(p: Project) {
    setSavingStatusId(p.id);
    try {
      // Not manageable from the Project tab - Finished can only be set from
      // Project Manager's own page, so always resubmit the current status.
      const status = canManage ? (statusDraft[p.id] ?? p.status) : p.status;
      const res = await fetch(`/api/projects/${p.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment: progressComment[p.id] ?? "", changedBy: currentRole.label }),
      });
      const data = await res.json();
      const draft = reportDraft[p.id];
      if (draft && data.entry?.id) {
        const fd = new FormData();
        fd.append("report", draft.report);
        fd.append("nextStep", draft.nextStep);
        fd.append("submittedBy", currentRole.label);
        fd.append("progressId", data.entry.id);
        draft.photos.forEach((f) => fd.append("photos", f));
        await fetch(`/api/projects/${p.id}/reports`, { method: "POST", body: fd });
      }
      setProgressComment((cur) => ({ ...cur, [p.id]: "" }));
      setReportDraft((cur) => ({ ...cur, [p.id]: null }));
      load();
    } finally {
      setSavingStatusId(null);
    }
  }

  function openDraftReportModal(projectId: string) {
    setDraftModalFor(projectId);
    setDraftModalText(reportDraft[projectId] ?? blankReportDraft());
  }
  function saveDraftReport() {
    if (!draftModalFor) return;
    setReportDraft((cur) => ({ ...cur, [draftModalFor]: draftModalText }));
    setDraftModalFor(null);
  }

  function startEditProgress(entryId: string, comment: string) {
    setEditingProgressId(entryId);
    setEditProgressComment(comment);
  }
  async function saveEditProgress(projectId: string, entryId: string) {
    await fetch(`/api/projects/${projectId}/progress/${entryId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: editProgressComment }),
    });
    setEditingProgressId(null);
    load();
  }
  async function deleteProgress(projectId: string, entryId: string) {
    if (!confirm("Delete this progress entry? This can't be undone.")) return;
    await fetch(`/api/projects/${projectId}/progress/${entryId}`, { method: "DELETE" });
    load();
  }

  async function deleteReport(projectId: string, reportId: string) {
    if (!confirm("Delete this report? This can't be undone.")) return;
    await fetch(`/api/projects/${projectId}/reports/${reportId}`, { method: "DELETE" });
    load();
  }
  async function removeReportPhoto(projectId: string, reportId: string, path: string) {
    if (!confirm("Remove this photo? In case it was the wrong attachment.")) return;
    const fd = new FormData();
    fd.append("removePhoto", path);
    await fetch(`/api/projects/${projectId}/reports/${reportId}`, { method: "PATCH", body: fd });
    load();
  }

  const statusVisible: Record<ProjectStatus, boolean> = { ongoing: showOngoing, finished: showFinished };
  const filtered = (projects ?? []).filter((p) => statusVisible[p.status]);
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(filtered, projectMatches);

  const costModalProject = (projects ?? []).find((p) => p.id === costModalFor) ?? null;

  return (
    <>
      {message && <div className="warn">{message}</div>}

      <Collapsible
        title="PROJECT RECAP"
        count={projects?.length}
        defaultOpen
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <ToggleSwitch checked={showOngoing} onChange={setShowOngoing} label="On-going" color="#eab308" />
            <ToggleSwitch checked={showFinished} onChange={setShowFinished} label="Finished" color="var(--good)" />
          </div>
        }
      >
        {!projects ? <p className="subtle">Loading...</p> : totalCount === 0 ? <p className="subtle">Nothing to show for the selected filters.</p> : (
          <>
            <SearchBox value={search} onChange={setSearch} />
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project Number</th><th>PO Date</th><th>PO Number</th><th>Sales</th><th>Customer Name</th>
                    <th>Project Description</th><th>Status</th>
                    {canManage && <th>Budgeting</th>}
                    {canManage && <th>Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const meta = p.status === "finished" ? { label: "Finished", color: "var(--good)" } : { label: "On-going", color: "#eab308" };
                    const budgetTotal = lineItemsTotal(p.budget_items);
                    const costTotal = lineItemsTotal(p.cost_items);
                    const colSpan = canManage ? 9 : 7;
                    return (
                      <Fragment key={p.id}>
                        <tr>
                          <td>{p.project_number}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{p.po_date ? fmtDate(p.po_date) : <span className="subtle">-</span>}</td>
                          <td>{p.po_number || <span className="subtle">-</span>}</td>
                          <td>{p.sales}</td>
                          <td>{p.customer_name}</td>
                          <td style={{ maxWidth: 160 }}><span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={p.project_description}>{p.project_description}</span></td>
                          <td>
                            <span className="pill" style={{ background: meta.color, color: "white", cursor: "pointer" }} onClick={() => openStatus(p)}>
                              {meta.label}
                            </span>
                          </td>
                          {canManage && (
                            <td>
                              <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => toggleBudget(p.id)}>
                                {CURRENCY_SYMBOLS[p.budget_items[0]?.unit_price_currency ?? "IDR"]} {budgetTotal.toLocaleString("id-ID")}
                              </span>
                            </td>
                          )}
                          {canManage && (
                            <td>
                              <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => openCostModal(p.id)}>
                                {CURRENCY_SYMBOLS[p.cost_items[0]?.unit_price_currency ?? "IDR"]} {costTotal.toLocaleString("id-ID")}
                              </span>
                            </td>
                          )}
                        </tr>

                        {canManage && budgetOpenFor === p.id && (
                          <tr>
                            <td colSpan={colSpan} style={{ background: "var(--panel-muted)" }}>
                              <div style={{ padding: "8px 2px" }}>
                                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Budgeting</div>
                                <div style={{ overflowX: "auto" }}>
                                  <table className="data-table">
                                    <thead><tr><th>Item Description</th><th>Supplier</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total Price</th><th></th></tr></thead>
                                    <tbody>
                                      {p.budget_items.map((it) => (
                                        <tr key={it.id}>
                                          <td><TruncatedText text={it.item_description} /></td>
                                          <td>{it.supplier}</td>
                                          <td>{it.qty}</td>
                                          <td>{it.unit}</td>
                                          <td>{CURRENCY_SYMBOLS[it.unit_price_currency]} {Number(it.unit_price).toLocaleString("id-ID")}</td>
                                          <td>{CURRENCY_SYMBOLS[it.unit_price_currency]} {Number(it.total_price).toLocaleString("id-ID")}</td>
                                          <td><button className="btn danger" style={{ fontSize: "0.68rem", padding: "3px 6px" }} onClick={() => deleteBudgetItem(p.id, it.id)}>Remove</button></td>
                                        </tr>
                                      ))}
                                      <tr style={{ background: "var(--panel)" }}>
                                        <td><input type="text" value={budgetDraft.itemDescription} onChange={(e) => setBudgetDraft({ ...budgetDraft, itemDescription: e.target.value })} placeholder="Description" style={{ fontSize: "0.8rem" }} /></td>
                                        <td><input type="text" value={budgetDraft.supplier} onChange={(e) => setBudgetDraft({ ...budgetDraft, supplier: e.target.value })} style={{ fontSize: "0.8rem", width: 100 }} /></td>
                                        <td><input type="number" value={budgetDraft.qty} onChange={(e) => setBudgetDraft({ ...budgetDraft, qty: e.target.value })} style={{ fontSize: "0.8rem", width: 55 }} /></td>
                                        <td><input type="text" value={budgetDraft.unit} onChange={(e) => setBudgetDraft({ ...budgetDraft, unit: e.target.value })} style={{ fontSize: "0.8rem", width: 55 }} /></td>
                                        <td style={{ display: "flex", gap: 2 }}>
                                          <select value={budgetDraft.unitPriceCurrency} onChange={(e) => setBudgetDraft({ ...budgetDraft, unitPriceCurrency: e.target.value as Currency })} style={{ fontSize: "0.75rem", width: 55 }}>
                                            {(Object.keys(CURRENCY_SYMBOLS) as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
                                          </select>
                                          <input type="text" inputMode="numeric" value={budgetDraft.unitPrice} onChange={(e) => setBudgetDraft({ ...budgetDraft, unitPrice: formatPrice(e.target.value) })} style={{ fontSize: "0.8rem", width: 80 }} />
                                        </td>
                                        <td className="subtle">{CURRENCY_SYMBOLS[budgetDraft.unitPriceCurrency]} {((Number(budgetDraft.qty) || 0) * (Number(parsePrice(budgetDraft.unitPrice)) || 0)).toLocaleString("id-ID")}</td>
                                        <td><button className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 8px" }} disabled={savingLineItem || !budgetDraft.itemDescription.trim()} onClick={() => addBudgetItem(p.id)}>+ Add</button></td>
                                      </tr>
                                    </tbody>
                                    <tfoot>
                                      <tr style={{ fontWeight: 700 }}>
                                        <td colSpan={5} style={{ textAlign: "right" }}>Total</td>
                                        <td>{CURRENCY_SYMBOLS[p.budget_items[0]?.unit_price_currency ?? "IDR"]} {budgetTotal.toLocaleString("id-ID")}</td>
                                        <td></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {statusOpenFor === p.id && (
                          <tr>
                            <td colSpan={colSpan} style={{ background: "var(--panel-muted)" }}>
                              <div style={{ padding: "8px 2px" }}>
                                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Update progress</div>
                                {canManage ? (
                                  <ProjectStatusSlider status={statusDraft[p.id] ?? p.status} onChange={(s) => setStatusDraft((cur) => ({ ...cur, [p.id]: s }))} />
                                ) : (
                                  <span className="pill" style={{ background: meta.color, color: "white" }} title="Only Project Manager can mark a project Finished">{meta.label}</span>
                                )}
                                <div className="field" style={{ marginTop: 10, maxWidth: 480 }}>
                                  <label>Progress (Short recap)</label>
                                  <input
                                    type="text" value={progressComment[p.id] ?? ""}
                                    onChange={(e) => setProgressComment((cur) => ({ ...cur, [p.id]: e.target.value }))}
                                    placeholder="e.g. Waiting on supplier confirmation"
                                  />
                                </div>
                                <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.82rem" }}>
                                    <input type="checkbox" checked={!!reportDraft[p.id]} onChange={() => openDraftReportModal(p.id)} /> Report
                                  </label>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.82rem" }}>
                                    <input type="checkbox" checked={false} onChange={() => openCostModal(p.id)} /> Cost
                                  </label>
                                </div>
                                <button className="btn" style={{ marginTop: 12 }} disabled={savingStatusId === p.id} onClick={() => saveStatus(p)}>
                                  {savingStatusId === p.id ? "Saving..." : "Save"}
                                </button>

                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                  <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Progress History</div>
                                  {p.progress.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : (
                                    [...p.progress].reverse().map((h) => {
                                      const linkedReport: ProjectReport | undefined = p.reports.find((r) => r.progress_id === h.id);
                                      return (
                                        <div key={h.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--panel-muted)" }}>
                                          <div style={{ fontSize: "0.82rem", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                            {editingProgressId === h.id ? (
                                              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                                                <input type="text" value={editProgressComment} onChange={(e) => setEditProgressComment(e.target.value)} style={{ flex: 1 }} />
                                                <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 8px" }} onClick={() => saveEditProgress(p.id, h.id)}>Save</button>
                                              </div>
                                            ) : (
                                              <div>
                                                <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span> — <span className="pill" style={{ fontSize: "0.65rem", background: h.status === "finished" ? "var(--good)" : "#eab308", color: "white" }}>{h.status === "finished" ? "Finished" : "On-going"}</span>{h.comment ? `: ${h.comment}` : ""}
                                              </div>
                                            )}
                                            {canManage && editingProgressId !== h.id && (
                                              <div style={{ whiteSpace: "nowrap" }}>
                                                <button className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => startEditProgress(h.id, h.comment)}>Edit</button>{" "}
                                                <button className="btn danger" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => deleteProgress(p.id, h.id)}>Delete</button>
                                              </div>
                                            )}
                                          </div>
                                          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                            <button
                                              className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px" }}
                                              onClick={() => setViewReportForEntry(viewReportForEntry === h.id ? null : h.id)}
                                            >
                                              {viewReportForEntry === h.id ? "Hide Report" : `Report${linkedReport ? "" : " (none)"}`}
                                            </button>
                                            <button className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => openCostModal(p.id)}>Cost</button>
                                          </div>
                                          {viewReportForEntry === h.id && (
                                            <div style={{ fontSize: "0.8rem", marginTop: 6, padding: 8, background: "var(--panel)", borderRadius: 6 }}>
                                              {!linkedReport ? <p className="subtle" style={{ margin: 0 }}>No report attached to this update.</p> : (
                                                <>
                                                  <div><b>Report:</b> {linkedReport.report || <span className="subtle">-</span>}</div>
                                                  <div><b>Next Step:</b> {linkedReport.next_step || <span className="subtle">-</span>}</div>
                                                  {linkedReport.photo_paths.length > 0 && (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                                      {linkedReport.photo_paths.map((path, i) => (
                                                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                                          <button className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => viewPhoto(path)}>Photo{linkedReport.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
                                                          {canManage && (
                                                            <button className="btn danger" style={{ fontSize: "0.68rem", padding: "2px 5px" }} title="Remove this photo" onClick={() => removeReportPhoto(p.id, linkedReport.id, path)}>✕</button>
                                                          )}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                  {canManage && (
                                                    <button className="btn danger" style={{ fontSize: "0.68rem", padding: "3px 8px", marginTop: 6 }} onClick={() => deleteReport(p.id, linkedReport.id)}>Delete Report</button>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
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

      {draftModalFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0 }}>Report</h2>
            <div className="field">
              <label>Report</label>
              <textarea value={draftModalText.report} onChange={(e) => setDraftModalText({ ...draftModalText, report: e.target.value })} rows={4} />
            </div>
            <div className="field">
              <label>Next Step</label>
              <textarea value={draftModalText.nextStep} onChange={(e) => setDraftModalText({ ...draftModalText, nextStep: e.target.value })} rows={4} />
            </div>
            <div className="field">
              <label>Photos</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setDraftModalText({ ...draftModalText, photos: [...draftModalText.photos, ...Array.from(e.target.files || [])] })} />
              {draftModalText.photos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {draftModalText.photos.map((f, i) => (
                    <span key={i} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--panel-muted)", color: "var(--text)" }}>
                      {f.name}
                      <button
                        type="button" className="btn danger" style={{ fontSize: "0.65rem", padding: "1px 5px" }}
                        onClick={() => setDraftModalText({ ...draftModalText, photos: draftModalText.photos.filter((_, pi) => pi !== i) })}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={saveDraftReport}>Save Report</button>
              <button className="btn secondary" onClick={() => setDraftModalFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {costModalFor && costModalProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 900, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0 }}>Cost — {costModalProject.project_number}</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>PO Code</th><th>Submitted By</th><th>Item Description</th><th>Supplier</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total Price</th><th></th></tr></thead>
                <tbody>
                  {costModalProject.cost_items.map((it) => (
                    <tr key={it.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(it.created_at)}</td>
                      <td>{it.po_code || <span className="subtle">-</span>}</td>
                      <td>{it.submitted_by || <span className="subtle">-</span>}</td>
                      <td><TruncatedText text={it.item_description} /></td>
                      <td>{it.supplier}</td>
                      <td>{it.qty}</td>
                      <td>{it.unit}</td>
                      <td>{CURRENCY_SYMBOLS[it.unit_price_currency]} {Number(it.unit_price).toLocaleString("id-ID")}</td>
                      <td>{CURRENCY_SYMBOLS[it.unit_price_currency]} {Number(it.total_price).toLocaleString("id-ID")}</td>
                      <td><button className="btn danger" style={{ fontSize: "0.68rem", padding: "3px 6px" }} onClick={() => deleteCostItem(costModalProject.id, it.id)}>Remove</button></td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--panel-muted)" }}>
                    <td className="subtle">-</td>
                    <td><input type="text" value={costDraft.poCode} onChange={(e) => setCostDraft({ ...costDraft, poCode: e.target.value.toUpperCase() })} placeholder="PO Code" style={{ fontSize: "0.8rem", width: 90 }} /></td>
                    <td className="subtle">{currentRole.label}</td>
                    <td><input type="text" value={costDraft.itemDescription} onChange={(e) => setCostDraft({ ...costDraft, itemDescription: e.target.value })} placeholder="Description" style={{ fontSize: "0.8rem" }} /></td>
                    <td><input type="text" value={costDraft.supplier} onChange={(e) => setCostDraft({ ...costDraft, supplier: e.target.value })} style={{ fontSize: "0.8rem", width: 100 }} /></td>
                    <td><input type="number" value={costDraft.qty} onChange={(e) => setCostDraft({ ...costDraft, qty: e.target.value })} style={{ fontSize: "0.8rem", width: 55 }} /></td>
                    <td><input type="text" value={costDraft.unit} onChange={(e) => setCostDraft({ ...costDraft, unit: e.target.value })} style={{ fontSize: "0.8rem", width: 55 }} /></td>
                    <td style={{ display: "flex", gap: 2 }}>
                      <select value={costDraft.unitPriceCurrency} onChange={(e) => setCostDraft({ ...costDraft, unitPriceCurrency: e.target.value as Currency })} style={{ fontSize: "0.75rem", width: 55 }}>
                        {(Object.keys(CURRENCY_SYMBOLS) as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="text" inputMode="numeric" value={costDraft.unitPrice} onChange={(e) => setCostDraft({ ...costDraft, unitPrice: formatPrice(e.target.value) })} style={{ fontSize: "0.8rem", width: 80 }} />
                    </td>
                    <td className="subtle">{CURRENCY_SYMBOLS[costDraft.unitPriceCurrency]} {((Number(costDraft.qty) || 0) * (Number(parsePrice(costDraft.unitPrice)) || 0)).toLocaleString("id-ID")}</td>
                    <td><button className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 8px" }} disabled={savingLineItem || !costDraft.itemDescription.trim()} onClick={() => addCostItem(costModalProject.id)}>+ Add</button></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={8} style={{ textAlign: "right" }}>Total</td>
                    <td>{CURRENCY_SYMBOLS[costModalProject.cost_items[0]?.unit_price_currency ?? "IDR"]} {lineItemsTotal(costModalProject.cost_items).toLocaleString("id-ID")}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn secondary" onClick={() => setCostModalFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
