"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import { PurchaseForm, fmtDate, fmtDateTime } from "@/lib/jobOrders";

const ITEM_SHAPE_TYPES = ["C", "D"];

function formMatches(f: PurchaseForm, term: string): boolean {
  return (
    f.name.toLowerCase().includes(term) ||
    f.customer_name.toLowerCase().includes(term) ||
    f.po_so_number.toLowerCase().includes(term) ||
    fmtDate(f.request_date).includes(term)
  );
}

// Pending-approval Form A/B requests waiting on this layer - same shape as
// the Form page's own list, plus a Type column, with Approve/Reject +
// comment instead of Edit/Cancel. Used by Operational Manager (layer 1)
// and General Manager (layer 2).
export default function FormApprovalView({ layer, label }: { layer: 1 | 2; label: string }) {
  const [forms, setForms] = useState<PurchaseForm[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/purchase-forms", { cache: "no-store" });
    const data = await res.json();
    setForms(data.forms ?? []);
  }

  useEffect(() => { load(); }, []);

  async function viewFile(path: string) {
    const res = await fetch(`/api/purchase-forms/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  function toggleExpand(id: string) {
    setMessage(null);
    setComment("");
    setExpanded((cur) => (cur === id ? null : id));
  }

  async function act(id: string, action: "approve" | "reject") {
    setMessage(null);
    setActing(true);
    try {
      const res = await fetch(`/api/purchase-forms/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment, by: label }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Action failed."); return; }
      setComment(""); setExpanded(null);
      load();
    } finally {
      setActing(false);
    }
  }

  // usePagedSearch (a hook) must run on every render regardless of loading
  // state - calling it after an early "loading" return skipped it on the
  // first render and broke React's hook-order rule, which is what crashed
  // this page entirely.
  const pending = (forms ?? []).filter((f) => f.status === "pending_approval" && f.current_approval_layer === layer);
  const expandedForm = expanded ? pending.find((f) => f.id === expanded) : null;
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(pending, formMatches);

  if (!forms) return <p className="subtle">Loading...</p>;

  return (
    <Collapsible
      title="Form Request"
      count={pending.length}
      defaultOpen
      actions={pending.length > 0 && <span className="subtle" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>Action Required</span>}
    >
      {message && <div className="warn">{message}</div>}
      {pending.length === 0 ? (
        <p className="subtle">Nothing waiting on you right now.</p>
      ) : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Name</th><th>Customer</th><th>PO/SO</th><th>Purpose</th><th>Total</th><th>Comments</th><th></th></tr>
              </thead>
              <tbody>
                {pageItems.map((f) => {
                  const isItemShape = ITEM_SHAPE_TYPES.includes(f.form_type);
                  const total = f.items.reduce((n, it) => n + Number(it.budget || 0), 0);
                  const commented = f.history.filter((h) => h.comment);
                  return (
                    <Fragment key={f.id}>
                      <tr>
                        <td>{fmtDate(f.request_date)}</td>
                        <td>Form {f.form_type}</td>
                        <td>{f.name}</td>
                        <td>{f.customer_name || <span className="subtle">-</span>}</td>
                        <td>{f.po_so_number || <span className="subtle">-</span>}</td>
                        <td>{f.purpose}</td>
                        <td>{isItemShape ? <span className="subtle">-</span> : `Rp ${total.toLocaleString("id-ID")}`}</td>
                        <td>
                          <button
                            className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                            onClick={() => setCommentsOpenId(commentsOpenId === f.id ? null : f.id)}
                            disabled={commented.length === 0}
                          >
                            {commentsOpenId === f.id ? "Hide" : `View (${commented.length})`}
                          </button>
                        </td>
                        <td>
                          <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => toggleExpand(f.id)}>
                            {expanded === f.id ? "Cancel" : "Review"}
                          </button>
                        </td>
                      </tr>
                      {commentsOpenId === f.id && commented.length > 0 && (
                        <tr>
                          <td colSpan={9} style={{ background: "var(--panel-muted)" }}>
                            {commented.map((h) => (
                              <div key={h.id} style={{ fontSize: "0.82rem", padding: "4px 0" }}>
                                <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                      {expanded === f.id && (
                        <tr>
                          <td colSpan={9} style={{ background: "var(--panel-muted)" }}>
                            <div style={{ overflowX: "auto" }}>
                              <table className="data-table">
                                {isItemShape ? (
                                  <>
                                    <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Code</th><th>Remarks</th></tr></thead>
                                    <tbody>
                                      {f.items.map((it) => (
                                        <tr key={it.id}>
                                          <td>{it.item_code || <span className="subtle">-</span>}</td>
                                          <td>{it.description}</td>
                                          <td>{it.qty}</td>
                                          <td>{it.unit}</td>
                                          <td>{it.code}</td>
                                          <td>{it.remarks || <span className="subtle">-</span>}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </>
                                ) : (
                                  <>
                                    <thead><tr><th>Description</th><th>Budget</th><th>PPN</th><th>Supplier</th><th>Code</th><th>Attachment</th></tr></thead>
                                    <tbody>
                                      {f.items.map((it) => (
                                        <tr key={it.id}>
                                          <td>{it.description}</td>
                                          <td>Rp {Number(it.budget).toLocaleString("id-ID")}</td>
                                          <td>{it.ppn ? "✓" : "-"}</td>
                                          <td>{it.supplier_name}</td>
                                          <td>{it.code}</td>
                                          <td>
                                            {it.attachment_path ? (
                                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => viewFile(it.attachment_path!)}>View</button>
                                            ) : <span className="subtle">-</span>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </>
                                )}
                              </table>
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

      {expandedForm && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="subtle" style={{ marginBottom: 8 }}>
            Deciding on <b>Form {expandedForm.form_type}</b> — {expandedForm.name}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <button className="btn" style={{ fontSize: "0.85rem" }} disabled={acting} onClick={() => act(expandedForm.id, "approve")}>Approve</button>
            <button className="btn danger" style={{ fontSize: "0.85rem" }} disabled={acting} onClick={() => act(expandedForm.id, "reject")}>Reject</button>
          </div>
        </div>
      )}
    </Collapsible>
  );
}
