"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import ProjectStatusSlider from "@/app/components/ProjectStatusSlider";
import TruncatedText from "@/app/components/TruncatedText";
import { Currency, CURRENCY_SYMBOLS, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { Project, ProjectStatus, lineItemsTotal } from "@/lib/projects";
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

// canManage: Project Manager's own page - shows PO Value/Budgeting/Cost
// columns, can add Budgeting lines, and can edit/delete progress entries.
// The read-only Project tab (canManage=false) hides those columns but can
// still log Progress/Report/Cost via the Status panel - "anyone" per the
// spec, just without the management controls.
export default function ProjectRecapSection({ canManage }: { canManage: boolean }) {
  const currentRole = getCurrentRole();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showOngoing, setShowOngoing] = useState(true);
  const [showFinished, setShowFinished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [budgetOpenFor, setBudgetOpenFor] = useState<string | null>(null);
  const [costOpenFor, setCostOpenFor] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<LineItemDraft>(blankLineItemDraft());
  const [costDraft, setCostDraft] = useState<CostDraft>(blankCostDraft());
  const [savingLineItem, setSavingLineItem] = useState(false);

  const [statusOpenFor, setStatusOpenFor] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<Record<string, ProjectStatus>>({});
  const [progressComment, setProgressComment] = useState<Record<string, string>>({});
  const [costCheckOpen, setCostCheckOpen] = useState<Record<string, boolean>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  const [reportModalFor, setReportModalFor] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [nextStepText, setNextStepText] = useState("");
  const [reportPhotos, setReportPhotos] = useState<File[]>([]);
  const [savingReport, setSavingReport] = useState(false);

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
  function toggleCost(projectId: string) {
    setCostOpenFor((cur) => (cur === projectId ? null : projectId));
    setCostDraft(blankCostDraft());
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
  }

  async function saveStatus(p: Project) {
    setSavingStatusId(p.id);
    try {
      await fetch(`/api/projects/${p.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusDraft[p.id] ?? p.status, comment: progressComment[p.id] ?? "", changedBy: currentRole.label }),
      });
      setProgressComment((cur) => ({ ...cur, [p.id]: "" }));
      load();
    } finally {
      setSavingStatusId(null);
    }
  }

  function openReportModal(projectId: string) {
    setReportModalFor(projectId);
    setReportText("");
    setNextStepText("");
    setReportPhotos([]);
  }

  async function saveReport() {
    if (!reportModalFor) return;
    setSavingReport(true);
    try {
      const fd = new FormData();
      fd.append("report", reportText);
      fd.append("nextStep", nextStepText);
      fd.append("submittedBy", currentRole.label);
      reportPhotos.forEach((f) => fd.append("photos", f));
      await fetch(`/api/projects/${reportModalFor}/reports`, { method: "POST", body: fd });
      setReportModalFor(null);
      load();
    } finally {
      setSavingReport(false);
    }
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

  const statusVisible: Record<ProjectStatus, boolean> = { ongoing: showOngoing, finished: showFinished };
  const filtered = (projects ?? []).filter((p) => statusVisible[p.status]);
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(filtered, projectMatches);

  // Shared by the dedicated Cost column (canManage) and the Status panel's
  // Cost checkbox (both pages) - one fill-in table + list + running total.
  function renderCostBlock(p: Project) {
    const total = lineItemsTotal(p.cost_items);
    return (
      <div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>PO Code</th><th>Item Description</th><th>Supplier</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total Price</th><th></th></tr></thead>
            <tbody>
              {p.cost_items.map((it) => (
                <tr key={it.id}>
                  <td>{it.po_code || <span className="subtle">-</span>}</td>
                  <td><TruncatedText text={it.item_description} /></td>
                  <td>{it.supplier}</td>
                  <td>{it.qty}</td>
                  <td>{it.unit}</td>
                  <td>{CURRENCY_SYMBOLS[it.unit_price_currency]} {Number(it.unit_price).toLocaleString("id-ID")}</td>
                  <td>{CURRENCY_SYMBOLS[it.unit_price_currency]} {Number(it.total_price).toLocaleString("id-ID")}</td>
                  <td><button className="btn danger" style={{ fontSize: "0.68rem", padding: "3px 6px" }} onClick={() => deleteCostItem(p.id, it.id)}>Remove</button></td>
                </tr>
              ))}
              <tr style={{ background: "var(--panel-muted)" }}>
                <td><input type="text" value={costDraft.poCode} onChange={(e) => setCostDraft({ ...costDraft, poCode: e.target.value.toUpperCase() })} placeholder="PO Code" style={{ fontSize: "0.8rem", width: 90 }} /></td>
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
                <td><button className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 8px" }} disabled={savingLineItem || !costDraft.itemDescription.trim()} onClick={() => addCostItem(p.id)}>+ Add</button></td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={6} style={{ textAlign: "right" }}>Total</td>
                <td>{CURRENCY_SYMBOLS[p.cost_items[0]?.unit_price_currency ?? "IDR"]} {total.toLocaleString("id-ID")}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

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
                          <td style={{ whiteSpace: "nowrap" }}>{p.has_po ? fmtDate(p.po_date) : <span className="subtle">-</span>}</td>
                          <td>{p.has_po ? p.po_number : <span className="subtle">-</span>}</td>
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
                              <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => toggleCost(p.id)}>
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

                        {canManage && costOpenFor === p.id && (
                          <tr>
                            <td colSpan={colSpan} style={{ background: "var(--panel-muted)" }}>
                              <div style={{ padding: "8px 2px" }}>
                                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
                                {renderCostBlock(p)}
                              </div>
                            </td>
                          </tr>
                        )}

                        {statusOpenFor === p.id && (
                          <tr>
                            <td colSpan={colSpan} style={{ background: "var(--panel-muted)" }}>
                              <div style={{ padding: "8px 2px" }}>
                                <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Update progress</div>
                                <ProjectStatusSlider status={statusDraft[p.id] ?? p.status} onChange={(s) => setStatusDraft((cur) => ({ ...cur, [p.id]: s }))} />
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
                                    <input type="checkbox" checked={false} onChange={() => openReportModal(p.id)} /> Report
                                  </label>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.82rem" }}>
                                    <input
                                      type="checkbox" checked={!!costCheckOpen[p.id]}
                                      onChange={(e) => setCostCheckOpen((cur) => ({ ...cur, [p.id]: e.target.checked }))}
                                    /> Cost
                                  </label>
                                </div>
                                {costCheckOpen[p.id] && <div style={{ marginTop: 10 }}>{renderCostBlock(p)}</div>}
                                <button className="btn" style={{ marginTop: 12 }} disabled={savingStatusId === p.id} onClick={() => saveStatus(p)}>
                                  {savingStatusId === p.id ? "Saving..." : "Save"}
                                </button>

                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                  <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Progress History</div>
                                  {p.progress.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : (
                                    [...p.progress].reverse().map((h) => (
                                      <div key={h.id} style={{ fontSize: "0.82rem", padding: "4px 0", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
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
                                    ))
                                  )}
                                </div>

                                {p.reports.length > 0 && (
                                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                    <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Reports</div>
                                    {p.reports.map((r) => (
                                      <div key={r.id} style={{ fontSize: "0.82rem", padding: "6px 0", borderBottom: "1px solid var(--panel-muted)" }}>
                                        <b>{r.submitted_by}</b> <span className="subtle">({fmtDateTime(r.created_at)})</span>
                                        <div style={{ marginTop: 2 }}><b>Report:</b> {r.report || <span className="subtle">-</span>}</div>
                                        <div><b>Next Step:</b> {r.next_step || <span className="subtle">-</span>}</div>
                                        {r.photo_paths.length > 0 && (
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                            {r.photo_paths.map((path, i) => (
                                              <button key={i} className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px" }} onClick={() => viewPhoto(path)}>Photo{r.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
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

      {reportModalFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0 }}>Report</h2>
            <div className="field">
              <label>Report</label>
              <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={4} />
            </div>
            <div className="field">
              <label>Next Step</label>
              <textarea value={nextStepText} onChange={(e) => setNextStepText(e.target.value)} rows={4} />
            </div>
            <div className="field">
              <label>Photos</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setReportPhotos((cur) => [...cur, ...Array.from(e.target.files || [])])} />
              {reportPhotos.length > 0 && (
                <div className="subtle" style={{ fontSize: "0.78rem", marginTop: 4 }}>{reportPhotos.length} photo(s) attached</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={saveReport} disabled={savingReport}>{savingReport ? "Saving..." : "Save Report"}</button>
              <button className="btn secondary" onClick={() => setReportModalFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
