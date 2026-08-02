"use client";

import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Collapsible from "@/app/components/Collapsible";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import DateField from "@/app/components/DateField";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import TruncatedText from "@/app/components/TruncatedText";
import { JobOrder, JobOrderHistoryEntry, FabricationItem, joMatchesSearch, fmtDate, fmtDateTime, formatSerialRange } from "@/lib/jobOrders";
import { printFileUrl } from "@/lib/printFile";

function fabricationMatches(f: FabricationItem, term: string): boolean {
  return f.so_no.toLowerCase().includes(term) || f.description.toLowerCase().includes(term) || fmtDate(f.jo_date).includes(term);
}

// Every fabrication item across every JO (plus standalone ones added via
// "+New Fabrication JO"), with a Production/Finish toggle filter - same
// underlying rows as the Fabrication table on a JO's own detail page, this
// is just the cross-JO view of them.
function FabricationJoSection({ items, onToggleStatus, togglingId }: {
  items: FabricationItem[]; onToggleStatus: (item: FabricationItem) => void; togglingId: string | null;
}) {
  const [showProduction, setShowProduction] = useState(true);
  const [showFinish, setShowFinish] = useState(false);

  const filtered = items.filter((f) => (f.status === "production" && showProduction) || (f.status === "finish" && showFinish));
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(filtered, fabricationMatches);

  return (
    <>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
        <ToggleSwitch checked={showProduction} onChange={setShowProduction} label={`Production (${items.filter((f) => f.status === "production").length})`} />
        <ToggleSwitch checked={showFinish} onChange={setShowFinish} label={`Finish (${items.filter((f) => f.status === "finish").length})`} color="var(--good)" />
      </div>
      {totalCount === 0 ? <p className="subtle">Nothing to show for the selected filters.</p> : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>JO Date</th><th>SO Number</th><th>Item Description</th><th>Qty</th><th>Unit</th><th>Status</th></tr></thead>
              <tbody>
                {pageItems.map((f) => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(f.jo_date)}</td>
                    <td>{f.so_no || <span className="subtle">-</span>}</td>
                    <td><TruncatedText text={f.description} /></td>
                    <td>{f.qty}</td>
                    <td>{f.unit}</td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          cursor: togglingId === f.id ? "default" : "pointer",
                          background: f.status === "finish" ? "#dcfce7" : "var(--warn-bg)",
                          color: f.status === "finish" ? "#15803d" : "var(--warn-text)",
                        }}
                        onClick={() => togglingId !== f.id && onToggleStatus(f)}
                        title="Click to update status"
                      >
                        {f.status === "finish" ? "Finish" : "Production"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </>
  );
}

type AllJoSortCol = "jo_date" | "so_no" | "customer_name" | "item_no" | "serial_number";

const ALL_JO_COLUMNS: { key: string; label: string; sortCol?: AllJoSortCol }[] = [
  { key: "jo_date", label: "JO Date", sortCol: "jo_date" },
  { key: "so_no", label: "SO Number", sortCol: "so_no" },
  { key: "customer_name", label: "Customer Name", sortCol: "customer_name" },
  { key: "item_no", label: "Item Code", sortCol: "item_no" },
  { key: "item_description", label: "Description" },
  { key: "quantity", label: "Qty" },
  { key: "serial_number", label: "Serial Number(s)", sortCol: "serial_number" },
  { key: "status", label: "Status" },
  { key: "category", label: "Category" },
  { key: "sales", label: "Sales" },
  { key: "deadline", label: "Deadline" },
];
// The extra detail columns start hidden - the default view stays the
// original compact list, with the rest available via Columns.
const ALL_JO_DEFAULT_HIDDEN = new Set(["status", "category", "sales", "deadline"]);

function allJoCellText(jo: JobOrder, key: string): string {
  switch (key) {
    case "jo_date": return fmtDate(jo.jo_date);
    case "so_no": return jo.so_no;
    case "customer_name": return jo.customer_name;
    case "item_no": return jo.item_no;
    case "item_description": return jo.item_description;
    case "quantity": return String(jo.quantity);
    case "serial_number": return formatSerialRange(jo.serial_numbers ?? []);
    case "status": return jo.status;
    case "category": return jo.item_category;
    case "sales": return jo.sales_person_name;
    case "deadline": return fmtDate(jo.deadline);
    default: return "";
  }
}

async function exportAllJobOrdersToExcel(rows: JobOrder[], columns: { key: string; label: string }[]) {
  const XLSX = await import("xlsx");
  const header = columns.map((c) => c.label);
  const body = rows.map((jo) => columns.map((c) => allJoCellText(jo, c.key)));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "All Job Orders");
  XLSX.writeFile(workbook, `all-job-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Reference table for the whole job order history (any status) - lets
// Production look up the most recent serial number for an item before
// filling in a new JO's Serial Number field. Category toggles default to
// all-on; categories are derived from the data instead of hardcoded so a
// newly added item_category shows up automatically.
function AllJobOrdersSection({ jobOrders }: { jobOrders: JobOrder[] }) {
  const [offCategories, setOffCategories] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<AllJoSortCol>("jo_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(ALL_JO_DEFAULT_HIDDEN);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(jobOrders.map((jo) => jo.item_category).filter(Boolean))).sort(),
    [jobOrders]
  );

  useEffect(() => {
    if (!columnsMenuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) setColumnsMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [columnsMenuOpen]);

  function toggleColumn(key: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function sortBy(col: AllJoSortCol) {
    if (sortCol === col) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortCol(col);
    setSortDir("asc");
  }

  const sorted = useMemo(() => {
    const visible = jobOrders.filter((jo) => !offCategories.has(jo.item_category));
    return [...visible].sort((a, b) => {
      const av = sortCol === "serial_number" ? (a.serial_numbers?.[0] ?? "") : a[sortCol];
      const bv = sortCol === "serial_number" ? (b.serial_numbers?.[0] ?? "") : b[sortCol];
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [jobOrders, offCategories, sortCol, sortDir]);

  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(sorted, joMatchesSearch);
  const visibleCols = ALL_JO_COLUMNS.filter((c) => !hiddenCols.has(c.key));

  function cellFor(jo: JobOrder, key: string) {
    if (key === "serial_number") {
      const serialLabel = formatSerialRange(jo.serial_numbers ?? []);
      return serialLabel === "-" ? <span className="subtle">-</span> : serialLabel;
    }
    if (key === "item_description") return <TruncatedText text={jo.item_description} />;
    return allJoCellText(jo, key);
  }

  return (
    <>
      <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
        Every job order regardless of status - use this to look up the last serial number used before filling in a new one.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        {categories.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {categories.map((cat) => (
              <ToggleSwitch
                key={cat}
                checked={!offCategories.has(cat)}
                label={cat}
                onChange={(v) => setOffCategories((cur) => {
                  const next = new Set(cur);
                  if (v) next.delete(cat); else next.add(cat);
                  return next;
                })}
              />
            ))}
          </div>
        )}
        <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => exportAllJobOrdersToExcel(sorted, visibleCols)}>
          Export to Excel
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SearchBox value={search} onChange={setSearch} />
        <div ref={columnsMenuRef} style={{ position: "relative" }}>
          <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => setColumnsMenuOpen((o) => !o)}>Columns ▾</button>
          {columnsMenuOpen && (
            <div
              style={{
                position: "absolute", top: "100%", right: 0, zIndex: 15, marginTop: 4,
                background: "var(--panel, #fff)", border: "1px solid var(--border)", borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: 10, width: 200,
              }}
            >
              {ALL_JO_COLUMNS.map((c) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", padding: "3px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={!hiddenCols.has(c.key)} onChange={() => toggleColumn(c.key)} /> {c.label}
                </label>
              ))}
              <button className="btn secondary" style={{ fontSize: "0.72rem", marginTop: 6, width: "100%" }} onClick={() => setHiddenCols(new Set())}>
                Unhide all
              </button>
            </div>
          )}
        </div>
      </div>
      {totalCount === 0 ? <p className="subtle" style={{ marginTop: 10 }}>No matching job orders.</p> : (
        <>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className="data-table">
              <thead>
                <tr>
                  {visibleCols.map((c) => (
                    c.sortCol ? (
                      <th key={c.key} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => sortBy(c.sortCol!)}>
                        {c.label} {sortCol === c.sortCol ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </th>
                    ) : <th key={c.key}>{c.label}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((jo) => (
                  <tr key={jo.id}>
                    {visibleCols.map((c) => <td key={c.key} style={c.key === "jo_date" || c.key === "deadline" ? { whiteSpace: "nowrap" } : undefined}>{cellFor(jo, c.key)}</td>)}
                    <td style={{ whiteSpace: "nowrap" }}>
                      <a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>View</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </>
  );
}

// Row-level stage within the single "In Production" table - replaces the
// old 3-way table split (Not Acknowledged / Acknowledged / Ready for
// Production) with one status pill per row instead.
function stageOf(jo: JobOrder): { label: string; twoLine?: [string, string]; bg: string; fg: string } {
  if (jo.status === "completed") return { label: "Finished", bg: "#dcfce7", fg: "#15803d" };
  if (jo.status === "approved") return { label: "Awaiting Acknowledgement", twoLine: ["Awaiting", "Acknowledgement"], bg: "var(--panel-muted)", fg: "var(--text-muted)" };
  if (jo.material_prepared_all) return { label: "Material Ready", bg: "#dcfce7", fg: "#15803d" };
  return { label: "Preparing Material", bg: "var(--warn-bg)", fg: "var(--warn-text)" };
}

function JoTable({
  items, historyOpenId, setHistoryOpenId, viewDrawing, printDrawing, acking, acknowledge, finishing, onFinish,
  commentDraft, setCommentDraft, savingCommentId, onAddComment,
}: {
  items: JobOrder[];
  historyOpenId: string | null; setHistoryOpenId: (id: string | null) => void;
  viewDrawing: (id: string) => void; printDrawing: (id: string) => void;
  acking: string | null; acknowledge: (id: string) => void;
  finishing: string | null; onFinish: (jo: JobOrder) => void;
  commentDraft: Record<string, string>; setCommentDraft: (fn: (cur: Record<string, string>) => Record<string, string>) => void;
  savingCommentId: string | null; onAddComment: (jo: JobOrder) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table fixed">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer</th>
            <th>Item Description</th><th>Qty</th><th>Deadline</th><th>Drawing</th><th>Status</th><th>Comments</th>
            <th>JO</th>
          </tr>
        </thead>
        <tbody>
          {items.map((jo) => {
            const commented = (jo.history ?? []).filter((h) => h.comment);
            const stage = stageOf(jo);
            return (
              <Fragment key={jo.id}>
                <tr>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(jo.created_at)}</td>
                  <td>
                    {jo.so_no}
                    {jo.urgent && <span className="pill pill-rejected" style={{ display: "block", width: "fit-content", marginTop: 2 }}>URGENT</span>}
                  </td>
                  <td>{jo.item_no}</td>
                  <td>{jo.sales_person_name}</td>
                  <td>{jo.customer_name}</td>
                  <td><TruncatedText text={jo.item_description} /></td>
                  <td>{jo.quantity}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(jo.deadline)}</td>
                  <td>
                    <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewDrawing(jo.id)}>View</button>{" "}
                    <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => printDrawing(jo.id)}>Print</button>
                  </td>
                  <td>
                    <span
                      className="pill"
                      style={{ background: stage.bg, color: stage.fg, whiteSpace: stage.twoLine ? "normal" : "nowrap", lineHeight: 1.3, cursor: "pointer" }}
                      onClick={() => setHistoryOpenId(historyOpenId === jo.id ? null : jo.id)}
                      title="Click to add or view progress/comments"
                    >
                      {stage.twoLine ? <>{stage.twoLine[0]}<br />{stage.twoLine[1]}</> : stage.label}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                      onClick={() => setHistoryOpenId(historyOpenId === jo.id ? null : jo.id)}
                    >
                      {historyOpenId === jo.id ? "Hide" : `View (${commented.length})`}
                    </button>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {jo.status === "completed" ? (
                      <a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }}>View</a>
                    ) : jo.status === "approved" ? (
                      <button className="btn" style={{ fontSize: "0.78rem", padding: "5px 10px" }} disabled={acking === jo.id} onClick={() => acknowledge(jo.id)}>
                        {acking === jo.id ? "Acknowledging..." : "Acknowledge"}
                      </button>
                    ) : jo.material_prepared_all ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }}>JO →</a>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, textTransform: "none", cursor: "pointer", fontSize: "0.7rem", fontWeight: 600 }} title="Tick once production is finished">
                          <input
                            type="checkbox"
                            checked={false}
                            disabled={finishing === jo.id}
                            onChange={() => onFinish(jo)}
                            style={{ width: 16, height: 16, accentColor: "var(--good)" }}
                          />
                          Finish
                        </label>
                      </div>
                    ) : (
                      <a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }}>JO →</a>
                    )}
                  </td>
                </tr>
                {historyOpenId === jo.id && (
                  <tr>
                    <td colSpan={12} style={{ background: "var(--panel-muted)" }}>
                      <div style={{ padding: "8px 2px" }}>
                        <div style={{ display: "flex", gap: 8, maxWidth: 520 }}>
                          <input
                            type="text" placeholder="Add a comment or remark..."
                            value={commentDraft[jo.id] ?? ""} onChange={(e) => setCommentDraft((cur) => ({ ...cur, [jo.id]: e.target.value }))}
                            style={{ flex: 1 }}
                          />
                          <button className="btn secondary" disabled={savingCommentId === jo.id || !(commentDraft[jo.id] ?? "").trim()} onClick={() => onAddComment(jo)}>
                            {savingCommentId === jo.id ? "Saving..." : "Save"}
                          </button>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          {commented.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : commented.map((h: JobOrderHistoryEntry) => (
                            <div key={h.id} style={{ fontSize: "0.82rem", padding: "4px 0" }}>
                              <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                            </div>
                          ))}
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
  );
}

function PagedJoSection({
  items, historyOpenId, setHistoryOpenId, viewDrawing, printDrawing, acking, acknowledge, finishing, onFinish,
  commentDraft, setCommentDraft, savingCommentId, onAddComment,
}: {
  items: JobOrder[];
  historyOpenId: string | null; setHistoryOpenId: (id: string | null) => void;
  viewDrawing: (id: string) => void; printDrawing: (id: string) => void;
  acking: string | null; acknowledge: (id: string) => void;
  finishing: string | null; onFinish: (jo: JobOrder) => void;
  commentDraft: Record<string, string>; setCommentDraft: (fn: (cur: Record<string, string>) => Record<string, string>) => void;
  savingCommentId: string | null; onAddComment: (jo: JobOrder) => void;
}) {
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, joMatchesSearch);
  return (
    <>
      <SearchBox value={search} onChange={setSearch} />
      <JoTable
        items={pageItems} historyOpenId={historyOpenId} setHistoryOpenId={setHistoryOpenId}
        viewDrawing={viewDrawing} printDrawing={printDrawing} acking={acking} acknowledge={acknowledge}
        finishing={finishing} onFinish={onFinish}
        commentDraft={commentDraft} setCommentDraft={setCommentDraft} savingCommentId={savingCommentId} onAddComment={onAddComment}
      />
      <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </>
  );
}

export default function ProductionManagerPage() {
  const [inProduction, setInProduction] = useState<JobOrder[]>([]);
  const [finishedProduction, setFinishedProduction] = useState<JobOrder[]>([]);
  const [allJobOrders, setAllJobOrders] = useState<JobOrder[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);

  const [fabricationItems, setFabricationItems] = useState<FabricationItem[]>([]);
  const [togglingFabId, setTogglingFabId] = useState<string | null>(null);
  const [showNewFabForm, setShowNewFabForm] = useState(false);
  const [newFabJoDate, setNewFabJoDate] = useState(new Date().toISOString().slice(0, 10));
  const [newFabSoNo, setNewFabSoNo] = useState("");
  const [newFabDescription, setNewFabDescription] = useState("");
  const [newFabQty, setNewFabQty] = useState("1");
  const [newFabUnit, setNewFabUnit] = useState("pcs");
  const [savingNewFab, setSavingNewFab] = useState(false);

  async function load() {
    const [approvedRes, ackRes, inProgressRes, qcRes, completedRes, allRes, fabRes] = await Promise.all([
      fetch("/api/job-orders?status=approved&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=acknowledged&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=in_progress&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=qc&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=completed&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?tab=production-manager", { cache: "no-store" }),
      fetch("/api/fabrication", { cache: "no-store" }),
    ]);
    const approved: JobOrder[] = (await approvedRes.json()).jobOrders ?? [];
    const acknowledged: JobOrder[] = (await ackRes.json()).jobOrders ?? [];
    const inProgress: JobOrder[] = (await inProgressRes.json()).jobOrders ?? [];
    const qc: JobOrder[] = (await qcRes.json()).jobOrders ?? [];
    // One table, ordered by urgency of what needs attention: needs
    // acknowledging first, then everything already moving through
    // production. Status pill on each row shows exactly where it's at.
    setInProduction([...approved, ...acknowledged, ...inProgress, ...qc]);
    setFinishedProduction((await completedRes.json()).jobOrders ?? []);
    setAllJobOrders((await allRes.json()).jobOrders ?? []);
    setFabricationItems((await fabRes.json()).items ?? []);
  }

  useEffect(() => { load(); }, []);

  async function viewDrawing(id: string) {
    const res = await fetch(`/api/job-orders/${id}/file?type=drawing&tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "No drawing on file."); return; }
    window.open(data.url, "_blank");
  }

  async function printDrawing(id: string) {
    const res = await fetch(`/api/job-orders/${id}/file?type=drawing&tab=production-manager`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "No drawing on file."); return; }
    printFileUrl(data.url, !!data.isPdf);
  }

  async function acknowledge(id: string) {
    setAcking(id);
    const res = await fetch(`/api/job-orders/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge", by: "Production Manager" }),
    });
    const data = await res.json();
    setAcking(null);
    if (!res.ok) { setMessage(data.error || "Failed to acknowledge."); return; }
    load();
  }

  async function finishProduction(jo: JobOrder) {
    if (!confirm(`Mark SO ${jo.so_no} as finished production? This moves it to Finished Production and it can no longer be edited.`)) return;
    setFinishing(jo.id);
    try {
      const res = await fetch(`/api/job-orders/${jo.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", by: "Production Manager", comment: "Production finished." }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to finish."); return; }
      load();
    } finally {
      setFinishing(null);
    }
  }

  async function addComment(jo: JobOrder) {
    const comment = (commentDraft[jo.id] ?? "").trim();
    if (!comment) return;
    setSavingCommentId(jo.id);
    try {
      const res = await fetch(`/api/job-orders/${jo.id}/history`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changedBy: "Production Manager", comment }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to save comment."); return; }
      setCommentDraft((cur) => ({ ...cur, [jo.id]: "" }));
      load();
    } finally {
      setSavingCommentId(null);
    }
  }

  async function toggleFabricationStatus(item: FabricationItem) {
    setTogglingFabId(item.id);
    try {
      const fd = new FormData();
      fd.append("status", item.status === "finish" ? "production" : "finish");
      await fetch(`/api/fabrication/${item.id}`, { method: "PATCH", body: fd });
      load();
    } finally {
      setTogglingFabId(null);
    }
  }

  function resetNewFabForm() {
    setShowNewFabForm(false);
    setNewFabJoDate(new Date().toISOString().slice(0, 10));
    setNewFabSoNo(""); setNewFabDescription(""); setNewFabQty("1"); setNewFabUnit("pcs");
  }

  async function submitNewFabrication() {
    if (!newFabDescription.trim()) return;
    setSavingNewFab(true);
    try {
      const res = await fetch("/api/fabrication", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joDate: newFabJoDate, soNo: newFabSoNo, description: newFabDescription, qty: newFabQty, unit: newFabUnit }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to add fabrication JO."); return; }
      resetNewFabForm();
      load();
    } finally {
      setSavingNewFab(false);
    }
  }

  const sharedProps = {
    historyOpenId, setHistoryOpenId, viewDrawing, printDrawing, acking, acknowledge, finishing, onFinish: finishProduction,
    commentDraft, setCommentDraft, savingCommentId, onAddComment: addComment,
  };

  return (
    <>
      {message && <div className="warn">{message}</div>}

      <Collapsible
        title="In Production"
        count={inProduction.length}
        defaultOpen
        actions={inProduction.some((jo) => jo.status === "approved") && <span className="subtle" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>Action Required</span>}
      >
        {inProduction.length === 0 ? <p className="subtle">Nothing in production right now.</p> : <PagedJoSection items={inProduction} {...sharedProps} />}
      </Collapsible>

      <Collapsible
        title="Fabrication Job Order"
        count={fabricationItems.length}
        defaultOpen
        actions={
          !showNewFabForm && <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => setShowNewFabForm(true)}>+ New Fabrication JO</button>
        }
      >
        {showNewFabForm && (
          <div className="card" style={{ background: "var(--panel-muted)", marginBottom: 14 }}>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 2fr 0.6fr 0.6fr" }}>
              <div className="field"><label>JO Date</label><DateField value={newFabJoDate} onChange={setNewFabJoDate} /></div>
              <div className="field"><label>SO Number</label><input type="text" value={newFabSoNo} onChange={(e) => setNewFabSoNo(e.target.value.toUpperCase())} /></div>
              <div className="field"><label>Item Description</label><input type="text" value={newFabDescription} onChange={(e) => setNewFabDescription(e.target.value)} /></div>
              <div className="field"><label>Qty</label><input type="number" value={newFabQty} onChange={(e) => setNewFabQty(e.target.value)} /></div>
              <div className="field"><label>Unit</label><input type="text" value={newFabUnit} onChange={(e) => setNewFabUnit(e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={submitNewFabrication} disabled={savingNewFab || !newFabDescription.trim()}>{savingNewFab ? "Saving..." : "Submit"}</button>
              <button className="btn secondary" onClick={resetNewFabForm}>Cancel</button>
            </div>
          </div>
        )}
        {fabricationItems.length === 0 ? <p className="subtle">Nothing yet.</p> : (
          <FabricationJoSection items={fabricationItems} onToggleStatus={toggleFabricationStatus} togglingId={togglingFabId} />
        )}
      </Collapsible>

      <Collapsible title="Finished Production" count={finishedProduction.length}>
        {finishedProduction.length === 0 ? <p className="subtle">None yet.</p> : <PagedJoSection items={finishedProduction} {...sharedProps} />}
      </Collapsible>

      <Collapsible title="All Job Orders" count={allJobOrders.length}>
        {allJobOrders.length === 0 ? <p className="subtle">No job orders yet.</p> : <AllJobOrdersSection jobOrders={allJobOrders} />}
      </Collapsible>
    </>
  );
}
