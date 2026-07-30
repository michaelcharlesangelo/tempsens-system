"use client";

import { useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { Complaint, JobOrder, complaintMatchesSearch, joMatchesSearch, dashboardStatusLabel, fmtDate } from "@/lib/jobOrders";

interface CategoryTotal { category: string; qty: number; }

// Calendar-day difference (not elapsed-hours) - JO date 26/6 and today 27/6
// should read "1", regardless of what time of day either happened at.
function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
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

  function complaintRows(items: Complaint[]) {
    return items.map((c) => (
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
        <td>{c.status === "not_done" ? "Not Done" : c.status === "in_progress" ? "In Progress" : "Done"}</td>
        <td style={{ minWidth: 180 }}>{c.suggested_action || <span className="subtle">-</span>}</td>
      </tr>
    ));
  }

  function ComplaintTable({ items, title, historyItems, historyTitle }: { items: Complaint[]; title: string; historyItems: Complaint[]; historyTitle: string }) {
    const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, complaintMatchesSearch, 5);
    const [historyOpen, setHistoryOpen] = useState(false);
    const historyPaged = usePagedSearch(historyItems, complaintMatchesSearch, 5);
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
                <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Suggested action</th></tr>
              </thead>
              <tbody>{complaintRows(pageItems)}</tbody>
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
                    <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Suggested action</th></tr>
                  </thead>
                  <tbody>{complaintRows(historyPaged.pageItems)}</tbody>
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
                  <td>{daysSince(jo.jo_date)}</td>
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
