"use client";

import { Fragment, ReactNode, useState } from "react";
import { JobOrder, JobOrderHistoryEntry, fmtDate, fmtDateTime, rejectedByFromHistory } from "@/lib/jobOrders";

// Shared list table used by Sales Support, Sales Manager, Operational
// Manager and General Manager - same column layout everywhere, only the
// trailing "actions" cell differs (Approve/Reject vs Edit/Cancel vs none).
//
// Defined at module scope (stable identity) so parent re-renders (e.g. a
// comment textarea's onChange) never remount this table or its inputs.
export default function JoListTable({
  items,
  onView,
  showProgress,
  progressLabel,
  renderActions,
}: {
  items: JobOrder[];
  onView: (id: string, type: "drawing" | "po") => void;
  showProgress?: boolean;
  progressLabel?: (jo: JobOrder) => string;
  renderActions?: (jo: JobOrder) => ReactNode;
}) {
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>JO Date</th><th>SO Number</th><th>Item Code</th><th>Sales</th><th>Customer Name</th>
            <th>Item Description</th><th>Qty</th><th>Drawing</th><th>PO</th>
            {showProgress && <th>Progress</th>}
            <th>Comments</th>
            {renderActions && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((jo) => {
            const commented = (jo.history ?? []).filter((h) => h.comment);
            const rejectedBy = rejectedByFromHistory(jo.history);
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
                  <td><button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onView(jo.id, "drawing")}>View</button></td>
                  <td><button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onView(jo.id, "po")}>View</button></td>
                  {showProgress && (
                    <td>
                      <span className={`pill pill-${jo.status}`}>{progressLabel ? progressLabel(jo) : jo.status}</span>
                      {jo.status === "rejected" && rejectedBy && (
                        <div className="subtle" style={{ fontSize: "0.7rem", marginTop: 3 }}>Rejected by {rejectedBy}</div>
                      )}
                    </td>
                  )}
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
                  {renderActions && <td>{renderActions(jo)}</td>}
                </tr>
                {historyOpenId === jo.id && commented.length > 0 && (
                  <tr>
                    <td colSpan={20} style={{ background: "var(--panel-muted)" }}>
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
