"use client";

import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import Collapsible from "@/app/components/Collapsible";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { JobOrder, JobOrderHistoryEntry, joMatchesSearch, fmtDate, fmtDateTime, formatSerialRange } from "@/lib/jobOrders";
import { printFileUrl } from "@/lib/printFile";

type AllJoSortCol = "jo_date" | "so_no" | "customer_name" | "item_no" | "serial_number";

// Reference table for the whole job order history (any status) - lets
// Production look up the most recent serial number for an item before
// filling in a new JO's Serial Number field. Category toggles default to
// all-on; categories are derived from the data instead of hardcoded so a
// newly added item_category shows up automatically.
function AllJobOrdersSection({ jobOrders }: { jobOrders: JobOrder[] }) {
  const [offCategories, setOffCategories] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<AllJoSortCol>("jo_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const categories = useMemo(
    () => Array.from(new Set(jobOrders.map((jo) => jo.item_category).filter(Boolean))).sort(),
    [jobOrders]
  );

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

  function SortHeader({ col, children }: { col: AllJoSortCol; children: ReactNode }) {
    return (
      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy(col)}>
        {children} {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <>
      <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
        Every job order regardless of status - use this to look up the last serial number used before filling in a new one.
      </p>
      {categories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12 }}>
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
      <SearchBox value={search} onChange={setSearch} />
      {totalCount === 0 ? <p className="subtle">No matching job orders.</p> : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <SortHeader col="jo_date">JO Date</SortHeader>
                  <SortHeader col="so_no">SO Number</SortHeader>
                  <SortHeader col="customer_name">Customer Name</SortHeader>
                  <SortHeader col="item_no">Item Code</SortHeader>
                  <th>Description</th>
                  <th>Qty</th>
                  <SortHeader col="serial_number">Serial Number(s)</SortHeader>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((jo) => {
                  const serialLabel = formatSerialRange(jo.serial_numbers ?? []);
                  return (
                    <tr key={jo.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(jo.jo_date)}</td>
                      <td>{jo.so_no}</td>
                      <td>{jo.customer_name}</td>
                      <td>{jo.item_no}</td>
                      <td>{jo.item_description}</td>
                      <td>{jo.quantity}</td>
                      <td>{serialLabel === "-" ? <span className="subtle">-</span> : serialLabel}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>View</a>
                      </td>
                    </tr>
                  );
                })}
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
}: {
  items: JobOrder[];
  historyOpenId: string | null; setHistoryOpenId: (id: string | null) => void;
  viewDrawing: (id: string) => void; printDrawing: (id: string) => void;
  acking: string | null; acknowledge: (id: string) => void;
  finishing: string | null; onFinish: (jo: JobOrder) => void;
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
                  <td>{jo.item_description}</td>
                  <td>{jo.quantity}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(jo.deadline)}</td>
                  <td>
                    <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewDrawing(jo.id)}>View</button>{" "}
                    <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => printDrawing(jo.id)}>Print</button>
                  </td>
                  <td>
                    <span className="pill" style={{ background: stage.bg, color: stage.fg, whiteSpace: stage.twoLine ? "normal" : "nowrap", lineHeight: 1.3 }}>
                      {stage.twoLine ? <>{stage.twoLine[0]}<br />{stage.twoLine[1]}</> : stage.label}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                      onClick={() => setHistoryOpenId(historyOpenId === jo.id ? null : jo.id)}
                      disabled={commented.length === 0}
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
                {historyOpenId === jo.id && commented.length > 0 && (
                  <tr>
                    <td colSpan={12} style={{ background: "var(--panel-muted)" }}>
                      {commented.map((h: JobOrderHistoryEntry) => (
                        <div key={h.id} style={{ fontSize: "0.82rem", padding: "4px 0" }}>
                          <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                        </div>
                      ))}
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
}: {
  items: JobOrder[];
  historyOpenId: string | null; setHistoryOpenId: (id: string | null) => void;
  viewDrawing: (id: string) => void; printDrawing: (id: string) => void;
  acking: string | null; acknowledge: (id: string) => void;
  finishing: string | null; onFinish: (jo: JobOrder) => void;
}) {
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, joMatchesSearch);
  return (
    <>
      <SearchBox value={search} onChange={setSearch} />
      <JoTable
        items={pageItems} historyOpenId={historyOpenId} setHistoryOpenId={setHistoryOpenId}
        viewDrawing={viewDrawing} printDrawing={printDrawing} acking={acking} acknowledge={acknowledge}
        finishing={finishing} onFinish={onFinish}
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

  async function load() {
    const [approvedRes, ackRes, inProgressRes, qcRes, completedRes, allRes] = await Promise.all([
      fetch("/api/job-orders?status=approved&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=acknowledged&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=in_progress&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=qc&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=completed&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?tab=production-manager", { cache: "no-store" }),
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

  const sharedProps = { historyOpenId, setHistoryOpenId, viewDrawing, printDrawing, acking, acknowledge, finishing, onFinish: finishProduction };

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

      <Collapsible title="Finished Production" count={finishedProduction.length}>
        {finishedProduction.length === 0 ? <p className="subtle">None yet.</p> : <PagedJoSection items={finishedProduction} {...sharedProps} />}
      </Collapsible>

      <Collapsible title="All Job Orders" count={allJobOrders.length}>
        {allJobOrders.length === 0 ? <p className="subtle">No job orders yet.</p> : <AllJobOrdersSection jobOrders={allJobOrders} />}
      </Collapsible>
    </>
  );
}
