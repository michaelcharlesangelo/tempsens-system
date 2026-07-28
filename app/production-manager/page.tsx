"use client";

import { Fragment, useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import Collapsible from "@/app/components/Collapsible";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { JobOrder, JobOrderHistoryEntry, joMatchesSearch, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { printFileUrl } from "@/lib/printFile";

function JoTable({
  items, mode, acking, historyOpenId, setHistoryOpenId, viewDrawing, printDrawing, acknowledge, finishing, onFinish,
}: {
  items: JobOrder[]; mode: "not_acknowledged" | "open"; acking: string | null;
  historyOpenId: string | null; setHistoryOpenId: (id: string | null) => void;
  viewDrawing: (id: string) => void; printDrawing: (id: string) => void; acknowledge: (id: string) => void;
  finishing?: string | null; onFinish?: (jo: JobOrder) => void;
}) {
  const showFinish = mode === "open" && !!onFinish;
  const colCount = showFinish ? 13 : 12;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <colgroup>
          <col style={{ width: "7%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "5%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "8%" }} />
          {showFinish && <col style={{ width: "6%" }} />}
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer</th>
            <th>Item Description</th><th>Qty</th><th>Deadline</th><th>Drawing</th><th>Material</th><th>Comments</th>
            {showFinish && <th>Finish</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((jo) => {
            const commented = (jo.history ?? []).filter((h) => h.comment);
            return (
              <Fragment key={jo.id}>
                <tr>
                  <td>{fmtDate(jo.created_at)}</td>
                  <td>{jo.so_no}{jo.urgent && <span className="pill pill-rejected" style={{ marginLeft: 6 }}>URGENT</span>}</td>
                  <td>{jo.item_no}</td>
                  <td>{jo.sales_person_name}</td>
                  <td>{jo.customer_name}</td>
                  <td>{jo.item_description}</td>
                  <td>{jo.quantity}</td>
                  <td>{fmtDate(jo.deadline)}</td>
                  <td>
                    <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewDrawing(jo.id)}>View</button>{" "}
                    <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => printDrawing(jo.id)}>Print</button>
                  </td>
                  <td style={{ textAlign: "center", background: jo.material_prepared_all ? "#d3f5d3" : undefined }}>
                    <input
                      type="checkbox"
                      checked={!!jo.material_prepared_all}
                      disabled
                      readOnly
                      style={{ width: 20, height: 20, accentColor: "var(--good)" }}
                      title="Ticked once Warehouse Manager has prepared all material"
                    />
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
                  {showFinish && (
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={false}
                        disabled={finishing === jo.id}
                        onChange={() => onFinish!(jo)}
                        style={{ width: 20, height: 20, accentColor: "var(--good)" }}
                        title="Tick once all material is finished - moves this JO to Finished Production"
                      />
                    </td>
                  )}
                  <td>
                    {mode === "not_acknowledged" ? (
                      <button className="btn" style={{ fontSize: "0.78rem", padding: "5px 10px" }} disabled={acking === jo.id} onClick={() => acknowledge(jo.id)}>
                        {acking === jo.id ? "Acknowledging..." : "Acknowledge"}
                      </button>
                    ) : (
                      <a href={`/production-manager/${jo.id}`} className="btn secondary" style={{ fontSize: "0.78rem", padding: "5px 10px" }}>JO →</a>
                    )}
                  </td>
                </tr>
                {historyOpenId === jo.id && commented.length > 0 && (
                  <tr>
                    <td colSpan={colCount} style={{ background: "var(--panel-muted)" }}>
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
  items, mode, acking, historyOpenId, setHistoryOpenId, viewDrawing, printDrawing, acknowledge, finishing, onFinish,
}: {
  items: JobOrder[]; mode: "not_acknowledged" | "open"; acking: string | null;
  historyOpenId: string | null; setHistoryOpenId: (id: string | null) => void;
  viewDrawing: (id: string) => void; printDrawing: (id: string) => void; acknowledge: (id: string) => void;
  finishing?: string | null; onFinish?: (jo: JobOrder) => void;
}) {
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, joMatchesSearch);
  return (
    <>
      <SearchBox value={search} onChange={setSearch} />
      <JoTable
        items={pageItems} mode={mode} acking={acking} historyOpenId={historyOpenId} setHistoryOpenId={setHistoryOpenId}
        viewDrawing={viewDrawing} printDrawing={printDrawing} acknowledge={acknowledge} finishing={finishing} onFinish={onFinish}
      />
      <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </>
  );
}

export default function ProductionManagerPage() {
  const [notAcknowledged, setNotAcknowledged] = useState<JobOrder[]>([]);
  const [acknowledged, setAcknowledged] = useState<JobOrder[]>([]);
  const [readyForProduction, setReadyForProduction] = useState<JobOrder[]>([]);
  const [finishedProduction, setFinishedProduction] = useState<JobOrder[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  async function load() {
    const [approvedRes, ackRes, inProgressRes, completedRes] = await Promise.all([
      fetch("/api/job-orders?status=approved&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=acknowledged&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=in_progress&tab=production-manager", { cache: "no-store" }),
      fetch("/api/job-orders?status=completed&tab=production-manager", { cache: "no-store" }),
    ]);
    setNotAcknowledged((await approvedRes.json()).jobOrders ?? []);
    const ack: JobOrder[] = (await ackRes.json()).jobOrders ?? [];
    const inProg: JobOrder[] = (await inProgressRes.json()).jobOrders ?? [];
    const combined = [...ack, ...inProg];
    setAcknowledged(combined.filter((jo) => !jo.ready_for_production));
    setReadyForProduction(combined.filter((jo) => jo.ready_for_production));
    setFinishedProduction((await completedRes.json()).jobOrders ?? []);
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
    if (!confirm(`Mark SO ${jo.so_no} as finished production? This moves it to Finished Production.`)) return;
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

  const sharedProps = { acking, historyOpenId, setHistoryOpenId, viewDrawing, printDrawing, acknowledge };

  return (
    <>
      <TabNav active="/production-manager" />
      {message && <div className="warn">{message}</div>}

      <Collapsible
        title="Not Yet Acknowledged"
        count={notAcknowledged.length}
        actions={notAcknowledged.length > 0 && <span className="subtle" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>Action Required</span>}
      >
        {notAcknowledged.length === 0 ? <p className="subtle">Nothing waiting.</p> : <PagedJoSection items={notAcknowledged} mode="not_acknowledged" {...sharedProps} />}
      </Collapsible>

      <Collapsible title="Acknowledged" count={acknowledged.length}>
        {acknowledged.length === 0 ? <p className="subtle">None yet.</p> : <PagedJoSection items={acknowledged} mode="open" {...sharedProps} />}
      </Collapsible>

      <Collapsible title="Ready for Production" count={readyForProduction.length}>
        {readyForProduction.length === 0 ? <p className="subtle">None yet.</p> : (
          <PagedJoSection items={readyForProduction} mode="open" {...sharedProps} finishing={finishing} onFinish={finishProduction} />
        )}
      </Collapsible>

      <Collapsible title="Finished Production" count={finishedProduction.length}>
        {finishedProduction.length === 0 ? <p className="subtle">None yet.</p> : <PagedJoSection items={finishedProduction} mode="open" {...sharedProps} />}
      </Collapsible>
    </>
  );
}
