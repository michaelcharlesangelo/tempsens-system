"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import {
  Complaint, JobOrder, PoOut, Supplier, SupplierTabCategory, SUPPLIER_TAB_CATEGORIES, PO_OUT_STATUSES, COMPLAINT_STATUSES,
  complaintMatchesSearch, joMatchesSearch, dashboardStatusLabel, fmtDate, fmtDateTime,
} from "@/lib/jobOrders";

interface CategoryTotal { category: string; qty: number; }

const PO_COLUMNS: { key: string; label: string }[] = [
  { key: "poDate", label: "PO Date" },
  { key: "days", label: "Days" },
  { key: "deadline", label: "Deadline" },
  { key: "poNumber", label: "PO Number" },
  { key: "itemCode", label: "Item Code" },
  { key: "sales", label: "Sales" },
  { key: "customerName", label: "Customer Name" },
  { key: "itemDescription", label: "Item Description" },
  { key: "qty", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "supplier", label: "Supplier" },
  { key: "status", label: "Status" },
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

// Read-only view of the PO OUT RECAP table - no Edit, status badge only
// opens the history (no way to change it from here, that's Exim's page).
// Kept at module scope like the rest of the app's list-table components.
function PoOutRecapSection() {
  const [pos, setPos] = useState<PoOut[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeTab, setActiveTab] = useState<SupplierTabCategory | "ALL">("ALL");
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/po-out", { cache: "no-store" }).then((r) => r.json()).then((d) => setPos(d.pos ?? []));
    fetch("/api/suppliers", { cache: "no-store" }).then((r) => r.json()).then((d) => setSuppliers(d.suppliers ?? []));
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

  const supplierCategory = new Map(suppliers.map((s) => [s.name, s.tab_category]));
  const filtered = (pos ?? []).filter((p) => activeTab === "ALL" || supplierCategory.get(p.supplier) === activeTab);
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
      case "poNumber": return p.po_number;
      case "itemCode": return p.item_code;
      case "sales": return p.sales;
      case "customerName": return p.customer_name;
      case "itemDescription": return p.item_description;
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
      default: return null;
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: 0 }}>PO OUT RECAP ({pos?.length ?? "..."})</h2>
      {!pos ? <p className="subtle">Loading...</p> : pos.length === 0 ? <p className="subtle">None yet.</p> : (
        <>
          <div style={{ display: "flex", gap: 2, margin: "10px 0 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
            <button
              className="btn secondary"
              style={{ fontSize: "0.75rem", borderRadius: "6px 6px 0 0", borderBottom: "none", background: activeTab === "ALL" ? "var(--accent)" : undefined, color: activeTab === "ALL" ? "white" : undefined }}
              onClick={() => setActiveTab("ALL")}
            >
              All
            </button>
            {SUPPLIER_TAB_CATEGORIES.map((c) => (
              <button
                key={c.value}
                className="btn secondary"
                style={{ fontSize: "0.75rem", borderRadius: "6px 6px 0 0", borderBottom: "none", background: activeTab === c.value ? "var(--accent)" : undefined, color: activeTab === c.value ? "white" : undefined }}
                onClick={() => setActiveTab(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>

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
  const [yearlyByCategory, setYearlyByCategory] = useState<CategoryTotal[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setActiveJobOrders(d.activeJobOrders ?? []);
      setYearlyByCategory(d.yearlyByCategory ?? []);
      setYear(d.year ?? null);
    });
    fetch("/api/complaints", { cache: "no-store" }).then((r) => r.json()).then((d) => setComplaints(d.complaints ?? []));
  }, []);

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
            <td>{c.item_description}</td>
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

  function ComplaintTable({ items, title, historyItems, historyTitle }: { items: Complaint[]; title: string; historyItems: Complaint[]; historyTitle: string }) {
    const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, complaintMatchesSearch, 5);
    const [historyOpen, setHistoryOpen] = useState(false);
    const historyPaged = usePagedSearch(historyItems, complaintMatchesSearch, 5);
    const [logOpenId, setLogOpenId] = useState<string | null>(null);
    return (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>{title} ({items.length})</h2>
          <button className="btn secondary" onClick={() => setHistoryOpen((v) => !v)}>
            {historyOpen ? "Hide History" : `History (${historyItems.length})`}
          </button>
        </div>
        {items.length === 0 ? <p className="subtle">None.</p> : (
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
        {historyOpen && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <h3 style={{ margin: "0 0 8px" }}>{historyTitle} ({historyItems.length})</h3>
            {historyItems.length === 0 ? <p className="subtle">None yet.</p> : (
              <>
              <SearchBox value={historyPaged.search} onChange={historyPaged.setSearch} />
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Photos Update</th></tr>
                  </thead>
                  <tbody>{complaintRows(historyPaged.pageItems, logOpenId, setLogOpenId)}</tbody>
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

  function CurrentJobOrders({ items }: { items: JobOrder[] }) {
    const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, joMatchesSearch);
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
              {pageItems.map((jo) => (
                <tr key={jo.id}>
                  <td>{fmtDate(jo.jo_date)}</td>
                  <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                  <td>{jo.item_no}</td>
                  <td>{jo.sales_person_name}</td>
                  <td>{jo.customer_name}</td>
                  <td>{jo.item_description}</td>
                  <td>{jo.quantity}</td>
                  <td>{daysCount(jo)}</td>
                  <td>{fmtDate(jo.finish_date || jo.finish_estimation)}</td>
                  <td><span className={`pill pill-${jo.status}`}>{dashboardStatusLabel(jo.status, jo.current_station_name, jo.status === "completed" && jo.finish_date ? daysSince(jo.finish_date) : undefined)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
      </>
    );
  }

  // Same auto-archive rule as the Complaints tab: done complaints drop off
  // 7 days after resolution (or immediately if manually archived there).
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  function isExpired(c: Complaint): boolean {
    return c.status === "done" && !!c.resolved_at && Date.now() - new Date(c.resolved_at).getTime() > SEVEN_DAYS_MS;
  }
  const visibleComplaints = (complaints ?? []).filter((c) => !c.archived && !isExpired(c));
  const historyComplaints = (complaints ?? []).filter((c) => c.archived || isExpired(c));
  const indonesia = visibleComplaints.filter((c) => !c.is_traded);
  const traded = visibleComplaints.filter((c) => c.is_traded);
  const historyIndonesia = historyComplaints.filter((c) => !c.is_traded);
  const historyTraded = historyComplaints.filter((c) => c.is_traded);

  return (
    <>

      <div className="card">
        <h2 style={{ margin: 0 }}>Current Job Orders ({activeJobOrders?.length ?? "..."})</h2>
        {!activeJobOrders ? <p className="subtle">Loading...</p> : activeJobOrders.length === 0 ? <p className="subtle">Nothing active right now.</p> : (
          <CurrentJobOrders items={activeJobOrders} />
        )}
      </div>

      <PoOutRecapSection />

      <div className="card">
        <h2>{year ?? ""} Production</h2>
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

      {!complaints ? <p className="subtle">Loading...</p> : (
        <>
          <ComplaintTable items={indonesia} title="Complaints — Tempsens Indonesia" historyItems={historyIndonesia} historyTitle="History — Tempsens Indonesia" />
          <ComplaintTable items={traded} title="Complaints — Traded Item" historyItems={historyTraded} historyTitle="History — Traded Item" />
        </>
      )}
    </>
  );
}
