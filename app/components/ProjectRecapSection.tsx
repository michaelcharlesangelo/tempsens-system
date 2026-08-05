"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import ProjectStatusSlider from "@/app/components/ProjectStatusSlider";
import TruncatedText from "@/app/components/TruncatedText";
import { Currency, CURRENCY_SYMBOLS, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { Project, ProjectCostItem, ProjectReport, ProjectStatus, lineItemsTotal } from "@/lib/projects";
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

// "(5/8) waiting on supplier" - short date + the latest progress comment
// (or just the status if no comment was typed).
function lastUpdateLabel(p: Project): string {
  if (p.progress.length === 0) return "-";
  const last = p.progress[p.progress.length - 1];
  const d = new Date(last.changed_at);
  const text = last.comment || (last.status === "finished" ? "Finished" : "On-going");
  return `(${d.getDate()}/${d.getMonth() + 1}) ${text}`;
}

// A phone camera photo can easily be several MB - downscale and
// re-encode as JPEG until it's under the cap, since there's no hovering
// on a phone but there is a data cap on Supabase Storage uploads over a
// mobile connection.
function compressImage(file: File, maxBytes = 1024 * 1024): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size <= maxBytes) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.85;
      const tryExport = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxBytes || quality <= 0.3) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
          } else {
            quality -= 0.15;
            tryExport();
          }
        }, "image/jpeg", quality);
      };
      tryExport();
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
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
  const [expandedDescription, setExpandedDescription] = useState<Record<string, boolean>>({});

  const [budgetOpenFor, setBudgetOpenFor] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<LineItemDraft>(blankLineItemDraft());
  const [savingLineItem, setSavingLineItem] = useState(false);

  // Project Manager's own accumulated Cost total/list (the recap's Cost
  // column) - separate from the Status panel's per-update Cost below.
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
  const [compressingPhotos, setCompressingPhotos] = useState(false);

  // Same idea for Cost logged against the update currently being composed
  // - a session-local list of new line items, only actually saved (tied to
  // the new progress entry) once the main Save button fires. Not the
  // accumulated project-wide total - that's Project Manager's Cost column.
  const [costSessionItems, setCostSessionItems] = useState<Record<string, CostDraft[]>>({});
  const [costSessionModalFor, setCostSessionModalFor] = useState<string | null>(null);
  const [costSessionRowDraft, setCostSessionRowDraft] = useState<CostDraft>(blankCostDraft());

  // Viewing an already-saved report/cost tied to a past Progress History
  // entry (via the buttons next to that entry) - both floating, same as
  // the compose modals, easier to use on a phone.
  const [reportViewFor, setReportViewFor] = useState<{ entryId: string; report: ProjectReport } | null>(null);
  const [costViewFor, setCostViewFor] = useState<{ entryId: string; items: ProjectCostItem[] } | null>(null);

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
      const progressId: string | undefined = data.entry?.id;

      const draft = reportDraft[p.id];
      if (draft && progressId) {
        const fd = new FormData();
        fd.append("report", draft.report);
        fd.append("nextStep", draft.nextStep);
        fd.append("submittedBy", currentRole.label);
        fd.append("progressId", progressId);
        draft.photos.forEach((f) => fd.append("photos", f));
        await fetch(`/api/projects/${p.id}/reports`, { method: "POST", body: fd });
      }

      const costItems = costSessionItems[p.id] ?? [];
      if (costItems.length > 0 && progressId) {
        await Promise.all(costItems.map((it) => fetch(`/api/projects/${p.id}/cost`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...it, unitPrice: parsePrice(it.unitPrice), submittedBy: currentRole.label, progressId }),
        })));
      }

      setProgressComment((cur) => ({ ...cur, [p.id]: "" }));
      setReportDraft((cur) => ({ ...cur, [p.id]: null }));
      setCostSessionItems((cur) => ({ ...cur, [p.id]: [] }));
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
  async function addDraftPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setCompressingPhotos(true);
    try {
      const compressed = await Promise.all(Array.from(files).map((f) => compressImage(f)));
      setDraftModalText((cur) => ({ ...cur, photos: [...cur.photos, ...compressed] }));
    } finally {
      setCompressingPhotos(false);
    }
  }

  function openCostSessionModal(projectId: string) {
    setCostSessionModalFor(projectId);
    setCostSessionRowDraft(blankCostDraft());
  }
  function addCostSessionItem() {
    if (!costSessionModalFor || !costSessionRowDraft.itemDescription.trim()) return;
    setCostSessionItems((cur) => ({
      ...cur,
      [costSessionModalFor!]: [...(cur[costSessionModalFor!] ?? []), costSessionRowDraft],
    }));
    setCostSessionRowDraft(blankCostDraft());
  }
  function removeCostSessionItem(index: number) {
    if (!costSessionModalFor) return;
    setCostSessionItems((cur) => ({
      ...cur,
      [costSessionModalFor!]: (cur[costSessionModalFor!] ?? []).filter((_, i) => i !== index),
    }));
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
    setReportViewFor(null);
    load();
  }
  async function removeReportPhoto(projectId: string, reportId: string, path: string) {
    if (!confirm("Remove this photo? In case it was the wrong attachment.")) return;
    const fd = new FormData();
    fd.append("removePhoto", path);
    await fetch(`/api/projects/${projectId}/reports/${reportId}`, { method: "PATCH", body: fd });
    load();
    // Keep the modal's photo list in sync without waiting for a full reload.
    setReportViewFor((cur) => cur ? { ...cur, report: { ...cur.report, photo_paths: cur.report.photo_paths.filter((p) => p !== path) } } : cur);
  }

  const statusVisible: Record<ProjectStatus, boolean> = { ongoing: showOngoing, finished: showFinished };
  const filtered = (projects ?? []).filter((p) => statusVisible[p.status]);
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(filtered, projectMatches);

  const costModalProject = (projects ?? []).find((p) => p.id === costModalFor) ?? null;
  const costSessionProject = (projects ?? []).find((p) => p.id === costSessionModalFor) ?? null;
  const costSessionRunningTotal = (costSessionModalFor ? (costSessionItems[costSessionModalFor] ?? []) : [])
    .reduce((n, it) => n + (Number(it.qty) || 0) * (Number(parsePrice(it.unitPrice)) || 0), 0);

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
                    <th>Project Number</th><th>PO Date</th><th>PO Number</th><th>Not PO</th><th>Sales</th><th>Customer Name</th>
                    <th>Project Description</th><th>Status</th><th>Last Update</th>
                    {canManage && <th>Budgeting</th>}
                    {canManage && <th>Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const meta = p.status === "finished" ? { label: "Finished", color: "var(--good)" } : { label: "On-going", color: "#eab308" };
                    const budgetTotal = lineItemsTotal(p.budget_items);
                    const costTotal = lineItemsTotal(p.cost_items);
                    const colSpan = canManage ? 11 : 9;
                    const descExpanded = !!expandedDescription[p.id];
                    return (
                      <Fragment key={p.id}>
                        <tr>
                          <td>{p.project_number}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{p.po_date ? fmtDate(p.po_date) : <span className="subtle">-</span>}</td>
                          <td>{p.po_number || <span className="subtle">-</span>}</td>
                          <td>{!p.has_po && <span className="pill pill-rejected" style={{ fontSize: "0.65rem" }}>NOT PO</span>}</td>
                          <td>{p.sales}</td>
                          <td>{p.customer_name}</td>
                          <td style={{ maxWidth: 160, cursor: "pointer" }} onClick={() => setExpandedDescription((cur) => ({ ...cur, [p.id]: !cur[p.id] }))}>
                            {/* Hover tooltips don't exist on a phone - click to
                                expand/collapse instead, works identically on
                                both desktop and touch. */}
                            <span style={descExpanded ? undefined : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {p.project_description}
                            </span>
                          </td>
                          <td>
                            <span className="pill" style={{ background: meta.color, color: "white", cursor: "pointer" }} onClick={() => openStatus(p)}>
                              {meta.label}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.8rem" }}>{lastUpdateLabel(p)}</td>
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
                                  <span className="pill" style={{ background: meta.color, color: "white", fontSize: "0.8rem" }} title="Only Project Manager can mark a project Finished">{meta.label}</span>
                                )}
                                <div className="field" style={{ marginTop: 10, maxWidth: 480 }}>
                                  <label>Progress (Short recap)</label>
                                  <input
                                    type="text" value={progressComment[p.id] ?? ""}
                                    onChange={(e) => setProgressComment((cur) => ({ ...cur, [p.id]: e.target.value }))}
                                    placeholder="e.g. Waiting on supplier confirmation"
                                    style={{ fontSize: "0.85rem" }}
                                  />
                                </div>
                                <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.8rem" }}>
                                    <input type="checkbox" checked={!!reportDraft[p.id]} onChange={() => openDraftReportModal(p.id)} /> Report
                                  </label>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.8rem" }}>
                                    <input type="checkbox" checked={(costSessionItems[p.id] ?? []).length > 0} onChange={() => openCostSessionModal(p.id)} /> Cost
                                  </label>
                                </div>
                                <button
                                  className="btn" style={{ marginTop: 12 }}
                                  disabled={savingStatusId === p.id || !(progressComment[p.id] ?? "").trim()}
                                  onClick={() => saveStatus(p)}
                                >
                                  {savingStatusId === p.id ? "Saving..." : "Save"}
                                </button>

                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                  <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Progress History</div>
                                  {p.progress.length === 0 ? <p className="subtle" style={{ margin: 0, fontSize: "0.8rem" }}>No updates yet.</p> : (
                                    [...p.progress].reverse().map((h) => {
                                      const linkedReport = p.reports.find((r) => r.progress_id === h.id);
                                      const linkedCostItems = p.cost_items.filter((it) => it.progress_id === h.id);
                                      return (
                                        <div key={h.id} style={{ fontSize: "0.8rem", padding: "6px 0", borderBottom: "1px solid var(--panel-muted)" }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            {editingProgressId === h.id ? (
                                              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                                                <input type="text" value={editProgressComment} onChange={(e) => setEditProgressComment(e.target.value)} style={{ flex: 1, fontSize: "0.85rem" }} />
                                                <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 8px" }} onClick={() => saveEditProgress(p.id, h.id)}>Save</button>
                                              </div>
                                            ) : (
                                              <div style={{ fontSize: "0.8rem" }}>
                                                <b>{h.changed_by}</b> <span className="subtle" style={{ fontSize: "0.75rem" }}>({fmtDateTime(h.changed_at)})</span> — <span className="pill" style={{ fontSize: "0.65rem", background: h.status === "finished" ? "var(--good)" : "#eab308", color: "white" }}>{h.status === "finished" ? "Finished" : "On-going"}</span>{h.comment ? `: ${h.comment}` : ""}
                                              </div>
                                            )}
                                            <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                                              {canManage && editingProgressId !== h.id && (
                                                <>
                                                  <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "2px 6px" }} onClick={() => startEditProgress(h.id, h.comment)}>Edit</button>
                                                  <button className="btn danger" style={{ fontSize: "0.7rem", padding: "2px 6px" }} onClick={() => deleteProgress(p.id, h.id)}>Delete</button>
                                                </>
                                              )}
                                              {linkedReport && (
                                                <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "2px 6px" }} onClick={() => setReportViewFor({ entryId: h.id, report: linkedReport })}>Report</button>
                                              )}
                                              <button className="btn secondary" style={{ fontSize: "0.7rem", padding: "2px 6px" }} onClick={() => setCostViewFor({ entryId: h.id, items: linkedCostItems })}>Cost</button>
                                            </div>
                                          </div>
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
              <input type="file" accept="image/*" multiple disabled={compressingPhotos} onChange={(e) => addDraftPhotos(e.target.files)} />
              {compressingPhotos && <p className="subtle" style={{ fontSize: "0.78rem", margin: "4px 0 0" }}>Resizing photo(s)...</p>}
              {draftModalText.photos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {draftModalText.photos.map((f, i) => (
                    <span key={i} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--panel-muted)", color: "var(--text)", fontSize: "0.72rem" }}>
                      {f.name} ({Math.round(f.size / 1024)}kb)
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

      {reportViewFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0 }}>Report</h2>
            <div style={{ fontSize: "0.85rem" }}>
              <div><b>Report:</b> {reportViewFor.report.report || <span className="subtle">-</span>}</div>
              <div style={{ marginTop: 6 }}><b>Next Step:</b> {reportViewFor.report.next_step || <span className="subtle">-</span>}</div>
              {reportViewFor.report.photo_paths.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {reportViewFor.report.photo_paths.map((path, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 6px" }} onClick={() => viewPhoto(path)}>Photo{reportViewFor.report.photo_paths.length > 1 ? ` ${i + 1}` : ""}</button>
                      {canManage && (
                        <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 5px" }} title="Remove this photo" onClick={() => removeReportPhoto(reportViewFor.report.project_id, reportViewFor.report.id, path)}>✕</button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {canManage && (
                <button className="btn danger" onClick={() => deleteReport(reportViewFor.report.project_id, reportViewFor.report.id)}>Delete Report</button>
              )}
              <button className="btn secondary" onClick={() => setReportViewFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {costViewFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 700, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0 }}>Cost for this update</h2>
            {costViewFor.items.length === 0 ? <p className="subtle">No cost logged for this update.</p> : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>PO Code</th><th>Submitted By</th><th>Item Description</th><th>Supplier</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total Price</th></tr></thead>
                  <tbody>
                    {costViewFor.items.map((it) => (
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
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={8} style={{ textAlign: "right" }}>Total</td>
                      <td>{CURRENCY_SYMBOLS[costViewFor.items[0]?.unit_price_currency ?? "IDR"]} {lineItemsTotal(costViewFor.items).toLocaleString("id-ID")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <button className="btn secondary" onClick={() => setCostViewFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {costSessionModalFor && costSessionProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ maxWidth: 700, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginTop: 0 }}>Cost for this update</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>PO Code</th><th>Item Description</th><th>Supplier</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total Price</th><th></th></tr></thead>
                <tbody>
                  {(costSessionItems[costSessionModalFor] ?? []).map((it, i) => (
                    <tr key={i}>
                      <td>{it.poCode || <span className="subtle">-</span>}</td>
                      <td><TruncatedText text={it.itemDescription} /></td>
                      <td>{it.supplier}</td>
                      <td>{it.qty}</td>
                      <td>{it.unit}</td>
                      <td>{CURRENCY_SYMBOLS[it.unitPriceCurrency]} {(Number(parsePrice(it.unitPrice)) || 0).toLocaleString("id-ID")}</td>
                      <td>{CURRENCY_SYMBOLS[it.unitPriceCurrency]} {((Number(it.qty) || 0) * (Number(parsePrice(it.unitPrice)) || 0)).toLocaleString("id-ID")}</td>
                      <td><button className="btn danger" style={{ fontSize: "0.68rem", padding: "3px 6px" }} onClick={() => removeCostSessionItem(i)}>Remove</button></td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--panel-muted)" }}>
                    <td><input type="text" value={costSessionRowDraft.poCode} onChange={(e) => setCostSessionRowDraft({ ...costSessionRowDraft, poCode: e.target.value.toUpperCase() })} placeholder="PO Code" style={{ fontSize: "0.8rem", width: 90 }} /></td>
                    <td><input type="text" value={costSessionRowDraft.itemDescription} onChange={(e) => setCostSessionRowDraft({ ...costSessionRowDraft, itemDescription: e.target.value })} placeholder="Description" style={{ fontSize: "0.8rem" }} /></td>
                    <td><input type="text" value={costSessionRowDraft.supplier} onChange={(e) => setCostSessionRowDraft({ ...costSessionRowDraft, supplier: e.target.value })} style={{ fontSize: "0.8rem", width: 100 }} /></td>
                    <td><input type="number" value={costSessionRowDraft.qty} onChange={(e) => setCostSessionRowDraft({ ...costSessionRowDraft, qty: e.target.value })} style={{ fontSize: "0.8rem", width: 55 }} /></td>
                    <td><input type="text" value={costSessionRowDraft.unit} onChange={(e) => setCostSessionRowDraft({ ...costSessionRowDraft, unit: e.target.value })} style={{ fontSize: "0.8rem", width: 55 }} /></td>
                    <td style={{ display: "flex", gap: 2 }}>
                      <select value={costSessionRowDraft.unitPriceCurrency} onChange={(e) => setCostSessionRowDraft({ ...costSessionRowDraft, unitPriceCurrency: e.target.value as Currency })} style={{ fontSize: "0.75rem", width: 55 }}>
                        {(Object.keys(CURRENCY_SYMBOLS) as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="text" inputMode="numeric" value={costSessionRowDraft.unitPrice} onChange={(e) => setCostSessionRowDraft({ ...costSessionRowDraft, unitPrice: formatPrice(e.target.value) })} style={{ fontSize: "0.8rem", width: 80 }} />
                    </td>
                    <td className="subtle">{CURRENCY_SYMBOLS[costSessionRowDraft.unitPriceCurrency]} {((Number(costSessionRowDraft.qty) || 0) * (Number(parsePrice(costSessionRowDraft.unitPrice)) || 0)).toLocaleString("id-ID")}</td>
                    <td><button className="btn secondary" style={{ fontSize: "0.7rem", padding: "3px 8px" }} disabled={!costSessionRowDraft.itemDescription.trim()} onClick={addCostSessionItem}>+ Add</button></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={6} style={{ textAlign: "right" }}>Total</td>
                    <td>{CURRENCY_SYMBOLS[costSessionRowDraft.unitPriceCurrency]} {costSessionRunningTotal.toLocaleString("id-ID")}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="subtle" style={{ fontSize: "0.78rem" }}>Saved together with this update when you click the main Save button below.</p>
            <div style={{ marginTop: 10 }}>
              <button className="btn secondary" onClick={() => setCostSessionModalFor(null)}>Done</button>
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
