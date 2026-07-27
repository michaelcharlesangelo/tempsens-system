"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
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

  function ComplaintTable({ items, title }: { items: Complaint[]; title: string }) {
    const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, complaintMatchesSearch);
    return (
      <div className="card">
        <h2>{title} ({items.length})</h2>
        {items.length === 0 ? <p className="subtle">None.</p> : (
          <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Customer</th><th>SO No.</th><th>Item</th><th>Qty</th><th>Problem</th><th>Photos</th><th>Status</th><th>Suggested action</th></tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
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
                  <td><span className={`pill pill-${jo.status}`}>{dashboardStatusLabel(jo.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
      </>
    );
  }

  const indonesia = (complaints ?? []).filter((c) => !c.is_traded);
  const traded = (complaints ?? []).filter((c) => c.is_traded);

  return (
    <>
      <TabNav active="/dashboard" />

      <div className="card">
        <h2 style={{ margin: 0 }}>Current Job Orders ({activeJobOrders?.length ?? "..."})</h2>
        {!activeJobOrders ? <p className="subtle">Loading...</p> : activeJobOrders.length === 0 ? <p className="subtle">Nothing active right now.</p> : (
          <CurrentJobOrders items={activeJobOrders} />
        )}
      </div>

      <div className="card">
        <h2>{year ?? ""} Production So Far (Completed, By Item Category)</h2>
        {yearlyByCategory.length === 0 ? <p className="subtle">No item categories set up yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Category</th><th>Quantity</th></tr></thead>
            <tbody>
              {yearlyByCategory.map((c) => <tr key={c.category}><td>{c.category}</td><td>{c.qty} pcs</td></tr>)}
            </tbody>
          </table>
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
