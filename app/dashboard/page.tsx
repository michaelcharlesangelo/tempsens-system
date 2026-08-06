"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import TruncatedText from "@/app/components/TruncatedText";
import ProjectRecapSection from "@/app/components/ProjectRecapSection";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import {
  Complaint, JobOrder, PoOut, Shipment, PO_OUT_STATUSES, COMPLAINT_STATUSES,
  FabricationItem,
  complaintMatchesSearch, joMatchesSearch, dashboardStatusLabel, fmtDate, fmtDateTime, daysBetweenDates,
} from "@/lib/jobOrders";

// Year tabs shared by every year-filterable section on this page - starts
// at 2026 (the earliest year this data matters for) and grows forward as
// real years pass, newest first, defaulting to the current year.
function yearsFrom2026(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= 2026; y--) years.push(y);
  return years;
}

function YearTabs({ years, selected, onSelect }: { years: number[]; selected: number; onSelect: (y: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      {years.map((y) => (
        <button
          key={y}
          className="btn secondary"
          style={{ fontSize: "0.75rem", background: selected === y ? "var(--accent)" : undefined, color: selected === y ? "white" : undefined }}
          onClick={() => onSelect(y)}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

function fabricationRecapMatches(f: FabricationItem, term: string): boolean {
  return f.so_no.toLowerCase().includes(term) || f.description.toLowerCase().includes(term) || fmtDate(f.jo_date).includes(term);
}

async function viewFabricationRecapPhoto(path: string) {
  const res = await fetch(`/api/complaints/x/photo?path=${encodeURIComponent(path)}`, { cache: "no-store" });
  const data = await res.json();
  if (data.url) window.open(data.url, "_blank");
}

// Read-only copy of the Production Manager Fabrication JO table - no edit,
// comment, photo upload, remove, or print, just a look at what's on-going.
function FabricationRecapSection({ items }: { items: FabricationItem[] }) {
  const ongoing = items.filter((f) => f.status === "production");
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(ongoing, fabricationRecapMatches);
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <h3 style={{ margin: "0 0 8px" }}>Fabrication JO — On-going ({ongoing.length})</h3>
      {totalCount === 0 ? <p className="subtle">Nothing on-going.</p> : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>JO Date</th><th>SO Number</th><th>Description</th><th>Qty</th><th>Unit</th><th>Comments</th><th>Photos</th></tr></thead>
              <tbody>
                {pageItems.map((f) => (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(f.jo_date)}</td>
                    <td>{f.so_no || <span className="subtle">-</span>}</td>
                    <td><TruncatedText text={f.description} /></td>
                    <td>{f.qty}</td>
                    <td>{f.unit}</td>
                    <td>{f.comment || <span className="subtle">-</span>}</td>
                    <td>
                      {f.photo_paths.length === 0 ? <span className="subtle">-</span> : f.photo_paths.map((p, i) => (
                        <button key={i} className="btn secondary" style={{ fontSize: "0.68rem", padding: "2px 6px", marginRight: 4 }} onClick={() => viewFabricationRecapPhoto(p)}>
                          Photo{f.photo_paths.length > 1 ? ` ${i + 1}` : ""}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}

interface CategoryTotal { category: string; qty: number; }

const PO_COLUMNS: { key: string; label: string }[] = [
  { key: "poDate", label: "PO Date" },
  { key: "days", label: "Days" },
  { key: "deadline", label: "Deadline" },
  { key: "estimation", label: "Estimation" },
  { key: "poNumber", label: "PO Number" },
  { key: "itemCode", label: "Item Code" },
  { key: "sales", label: "Sales" },
  { key: "customerName", label: "Customer Name" },
  { key: "itemDescription", label: "Item Description" },
  { key: "qty", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "supplier", label: "Supplier" },
  { key: "status", label: "Status" },
  { key: "etaJkt", label: "ETA JKT" },
];

function poMatches(p: PoOut, term: string): boolean {
  return (
    p.po_number.toLowerCase().includes(term) ||
    p.item_code.toLowerCase().includes(term) ||
    p.customer_name.toLowerCase().includes(term) ||
    p.supplier.toLowerCase().includes(term) ||
    fmtDate(p.po_date).includes(term)
  );
}

// Calendar-day difference (not elapsed-hours) - JO date 26/6 and today 27/6
// should read "1", regardless of what time of day either happened at.
function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
}

function daysBetween(startStr: string, endStr: string): number {
  const [y1, m1, d1] = startStr.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = endStr.slice(0, 10).split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

// Once a JO is finished, its Days count freezes at the jo_date -> finish_date
// span instead of continuing to climb every day it lingers in the 7-day
// post-finish window.
function daysCount(jo: JobOrder): number {
  if (jo.status === "completed" && jo.finish_date) return daysBetween(jo.jo_date, jo.finish_date);
  return daysSince(jo.jo_date);
}

// "05/08/2026 (6)" - the estimation date plus how many days after po_date
// it falls. Same convention as PO Out's own page.
function estimationLabel(p: PoOut): string {
  if (!p.estimation) return "-";
  return `${fmtDate(p.estimation)} (${daysBetweenDates(p.po_date, p.estimation)})`;
}

// Shown in the ETA JKT column once a PO is under Shipment status and Exim
// has filled in that shipment's ETA JKT - looked up by matching the PO's
// free-text shipment field to the Shipment Plan's shipment_number.
function etaJktFor(p: PoOut, shipments: Shipment[]): string | null {
  if (p.status !== "shipment" || !p.shipment) return null;
  const match = shipments.find((s) => s.shipment_number === p.shipment);
  return match?.eta_jkt ? fmtDate(match.eta_jkt) : null;
}

// Read-only view of the PO OUT RECAP table - no Edit, status badge only
// opens the history (no way to change it from here, that's Exim's page).
// Kept at module scope like the rest of the app's list-table components.
function PoOutRecapSection() {
  const [pos, setPos] = useState<PoOut[] | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [hideArrived, setHideArrived] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/po-out", { cache: "no-store" }).then((r) => r.json()).then((d) => setPos(d.pos ?? []));
    fetch("/api/shipments", { cache: "no-store" }).then((r) => r.json()).then((d) => setShipments(d.shipments ?? []));
  }, []);

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

  const filtered = (pos ?? []).filter((p) => (!hideArrived || p.status !== "arrived") && new Date(p.po_date).getFullYear() === year);
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(filtered, poMatches);
  const visibleCols = PO_COLUMNS.filter((c) => !hiddenCols.has(c.key));

  function cellFor(p: PoOut, key: string) {
    switch (key) {
      case "poDate": return fmtDate(p.po_date);
      case "days": return daysSince(p.po_date);
      case "deadline": return (
        <>
          {fmtDate(p.deadline)}
          {p.urgent && <span className="pill pill-rejected" style={{ marginLeft: 4, fontSize: "0.6rem" }}>URGENT</span>}
        </>
      );
      case "estimation": return estimationLabel(p);
      case "poNumber": return p.po_number;
      case "itemCode": return p.item_code;
      case "sales": return p.sales;
      case "customerName": return p.customer_name;
      case "itemDescription": return <TruncatedText text={p.item_description} />;
      case "qty": return p.qty;
      case "unit": return p.unit;
      case "supplier": return p.supplier;
      case "status": {
        const meta = PO_OUT_STATUSES.find((s) => s.value === p.status)!;
        return (
          <span className="pill" style={{ background: meta.color, color: "white", cursor: "pointer" }} onClick={() => setHistoryOpenId(historyOpenId === p.id ? null : p.id)}>
            {meta.label}
          </span>
        );
      }
      case "etaJkt": return etaJktFor(p, shipments) ?? <span className="subtle">-</span>;
      default: return null;
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>PO OUT RECAP ({pos?.length ?? "..."})</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <YearTabs years={yearsFrom2026()} selected={year} onSelect={setYear} />
          <ToggleSwitch checked={hideArrived} onChange={setHideArrived} label="Hide Arrived" color="var(--good)" />
        </div>
      </div>
      {!pos ? <p className="subtle">Loading...</p> : pos.length === 0 ? <p className="subtle">None yet.</p> : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
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
                  {PO_COLUMNS.map((c) => (
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

          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className="data-table">
              <thead>
                <tr>{visibleCols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      {visibleCols.map((c) => <td key={c.key}>{cellFor(p, c.key)}</td>)}
                    </tr>
                    {historyOpenId === p.id && (
                      <tr>
                        <td colSpan={visibleCols.length} style={{ background: "var(--panel-muted)" }}>
                          <div style={{ padding: "8px 2px" }}>
                            <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                              Updates from Exim Team
                            </div>
                            {p.history.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : p.history.map((h) => (
                              <div key={h.id} style={{ fontSize: "0.82rem", padding: "3px 0" }}>
                                <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [activeJobOrders, setActiveJobOrders] = useState<JobOrder[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [productionYear, setProductionYear] = useState(new Date().getFullYear());
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [fabricationItems, setFabricationItems] = useState<FabricationItem[]>([]);
  const [fabricationOpen, setFabricationOpen] = useState(false);
  const [hideFinishedJO, setHideFinishedJO] = useState(true);
  const [joYear, setJoYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setActiveJobOrders(d.activeJobOrders ?? []);
      setCategories(d.categories ?? []);
    });
    fetch("/api/complaints", { cache: "no-store" }).then((r) => r.json()).then((d) => setComplaints(d.complaints ?? []));
    fetch("/api/fabrication", { cache: "no-store" }).then((r) => r.json()).then((d) => setFabricationItems(d.items ?? []));
  }, []);

  // Client-computed so the Production bar graph's year tabs can recap any
  // year without a separate API round trip - activeJobOrders already has
  // every non-draft/pending/cancelled/rejected JO, completed or not.
  const yearlyByCategory: CategoryTotal[] = (() => {
    const byCategory = new Map<string, number>();
    categories.forEach((c) => byCategory.set(c, 0));
    (activeJobOrders ?? []).forEach((jo) => {
      if (jo.status !== "completed" || !jo.finish_date) return;
      if (new Date(jo.finish_date).getFullYear() !== productionYear) return;
      const cat = jo.item_category || "Uncategorized";
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(jo.quantity));
    });
    return Array.from(byCategory.entries()).map(([category, qty]) => ({ category, qty }));
  })();

  async function viewPhoto(path: string) {
    const res = await fetch(`/api/complaints/x/photo?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  function complaintRows(items: Complaint[], logOpenId: string | null, setLogOpenId: (id: string | null) => void) {
    return items.map((c) => {
      const meta = COMPLAINT_STATUSES.find((s) => s.value === c.status)!;
      return (
        <Fragment key={c.id}>
          <tr>
            <td>{fmtDate(c.created_at)}</td>
            <td>{c.customer_name}</td>
            <td>{c.so_no}</td>
            <td><TruncatedText text={c.item_description} /></td>
            <td>{c.quantity}</td>
            <td style={{ maxWidth: 180 }}>{c.problem_description}</td>
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
          </tr>
          {logOpenId === c.id && (
            <tr>
              <td colSpan={9} style={{ background: "var(--panel-muted)" }}>
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
    });
  }

  function ComplaintTable({ items, title }: { items: Complaint[]; title: string }) {
    const [hideFinished, setHideFinished] = useState(true);
    const visible = items.filter((c) => !hideFinished || c.status !== "done");
    const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(visible, complaintMatchesSearch, 5);
    const [logOpenId, setLogOpenId] = useState<string | null>(null);
    return (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>{title} ({items.length})</h2>
          <ToggleSwitch checked={hideFinished} onChange={setHideFinished} label="Hide Finished" color="var(--good)" />
        </div>
        {items.length === 0 ? <p className="subtle">None.</p> : totalCount === 0 ? <p className="subtle">Nothing to show for the selected filter.</p> : (
          <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Photos Update</th></tr>
              </thead>
              <tbody>{complaintRows(pageItems, logOpenId, setLogOpenId)}</tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
          </>
        )}
      </div>
    );
  }

  function CurrentJobOrders({ items }: { items: JobOrder[] }) {
    const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, joMatchesSearch);
    const [logOpenId, setLogOpenId] = useState<string | null>(null);
    return (
      <>
        <SearchBox value={search} onChange={setSearch} />
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer Name</th>
                <th>Item Description</th><th>Qty</th><th>Days</th><th>Estimation</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((jo) => {
                const commented = (jo.history ?? []).filter((h) => h.comment);
                return (
                <Fragment key={jo.id}>
                  <tr>
                    <td>{fmtDate(jo.jo_date)}</td>
                    <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                    <td>{jo.item_no}</td>
                    <td>{jo.sales_person_name}</td>
                    <td>{jo.customer_name}</td>
                    <td><TruncatedText text={jo.item_description} /></td>
                    <td>{jo.quantity}</td>
                    <td>{daysCount(jo)}</td>
                    <td>{fmtDate(jo.finish_date || jo.finish_estimation)}</td>
                    <td>
                      <span
                        className={`pill pill-${jo.status}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => setLogOpenId(logOpenId === jo.id ? null : jo.id)}
                        title="Click to view progress/comments"
                      >
                        {dashboardStatusLabel(jo.status, jo.current_station_name, jo.status === "completed" && jo.finish_date ? daysSince(jo.finish_date) : undefined)}
                      </span>
                    </td>
                  </tr>
                  {logOpenId === jo.id && (
                    <tr>
                      <td colSpan={10} style={{ background: "var(--panel-muted)" }}>
                        <div style={{ padding: "8px 2px" }}>
                          <div className="subtle" style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Progress / Comments</div>
                          {commented.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No updates yet.</p> : commented.map((h) => (
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
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
      </>
    );
  }

  // Manually-archived complaints (Engineering's own housekeeping action)
  // stay excluded regardless of the Hide Finished toggle; everything else
  // is shown/hidden by status via that toggle instead of a time window.
  const visibleComplaints = (complaints ?? []).filter((c) => !c.archived);
  const indonesia = visibleComplaints.filter((c) => !c.is_traded);
  const traded = visibleComplaints.filter((c) => c.is_traded);

  const joFiltered = (activeJobOrders ?? []).filter((jo) => {
    if (hideFinishedJO && jo.status === "completed") return false;
    return new Date(jo.jo_date).getFullYear() === joYear;
  });

  return (
    <>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Current Job Orders ({activeJobOrders?.length ?? "..."})</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <YearTabs years={yearsFrom2026()} selected={joYear} onSelect={setJoYear} />
            <ToggleSwitch checked={hideFinishedJO} onChange={setHideFinishedJO} label="Hide Finished" color="var(--good)" />
            <button className="btn secondary" onClick={() => setFabricationOpen((v) => !v)}>
              {fabricationOpen ? "Hide Fabrication JO" : "Fabrication JO"}
            </button>
          </div>
        </div>
        {!activeJobOrders ? <p className="subtle">Loading...</p> : joFiltered.length === 0 ? <p className="subtle">Nothing to show for the selected filters.</p> : (
          <CurrentJobOrders items={joFiltered} />
        )}
        {fabricationOpen && <FabricationRecapSection items={fabricationItems} />}
      </div>

      <PoOutRecapSection />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>{productionYear} Production</h2>
          <YearTabs years={yearsFrom2026()} selected={productionYear} onSelect={setProductionYear} />
        </div>
        {yearlyByCategory.length === 0 ? <p className="subtle">No item categories set up yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(() => {
              const total = yearlyByCategory.reduce((n, c) => n + c.qty, 0) || 1;
              return yearlyByCategory.map((c) => {
                const share = c.qty / total;
                return (
                  <div key={c.category} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{c.category}</div>
                    <div style={{ background: "var(--panel-muted)", borderRadius: 6, height: 20, overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(share * 100, c.qty > 0 ? 2 : 0)}%`, height: "100%", background: "var(--accent)", borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: "0.82rem", textAlign: "right" }}>{c.qty} pcs</div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      <ProjectRecapSection canManage={false} showYearTabs />

      {!complaints ? <p className="subtle">Loading...</p> : (
        <>
          <ComplaintTable items={indonesia} title="Complaints — Tempsens Indonesia" />
          <ComplaintTable items={traded} title="Complaints — Traded Item" />
        </>
      )}
    </>
  );
}
