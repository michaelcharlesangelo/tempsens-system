"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import { PurchaseForm, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

function formMatches(f: PurchaseForm, term: string): boolean {
  return (
    f.customer_name.toLowerCase().includes(term) ||
    f.po_so_number.toLowerCase().includes(term) ||
    fmtDate(f.request_date).includes(term)
  );
}

// Only Form A requests that came from Warehouse Manager's Not Available ->
// Local Purchase flow, once fully approved - a normal Form A submission
// (even for the same customer/SO) never shows up here. Once Sales Support
// Supervisor types in the real item code and saves, the row is marked
// registered and drops off this table for good.
export default function WarehouseFormsToRegister() {
  const [forms, setForms] = useState<PurchaseForm[] | null>(null);
  const [itemCodeDraft, setItemCodeDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);
  const currentRole = getCurrentRole();

  async function load() {
    const res = await fetch("/api/purchase-forms", { cache: "no-store" });
    const data = await res.json();
    setForms(data.forms ?? []);
  }

  useEffect(() => { load(); }, []);

  const items = (forms ?? []).filter((f) => f.form_type === "A" && f.status === "approved" && f.source === "warehouse_local_purchase" && !f.registered);
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, formMatches);

  async function saveItemCode(f: PurchaseForm) {
    const itemNo = (itemCodeDraft[f.id] ?? "").trim();
    if (!itemNo || !f.bom_row_id || !f.job_order_id) return;
    setSavingId(f.id);
    try {
      const bomRes = await fetch(`/api/job-orders/${f.job_order_id}/bom/${f.bom_row_id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemNo, actualQty: 1 }),
      });
      if (!bomRes.ok) { setMessage("Failed to save item code."); return; }
      const regRes = await fetch(`/api/purchase-forms/${f.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", by: currentRole.label }),
      });
      if (!regRes.ok) { setMessage("Failed to register form."); return; }
      load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Collapsible title="Form A - Inventory To Be Register For Production" count={forms ? items.length : undefined}>
      {message && <div className="warn">{message}</div>}
      {!forms ? <p className="subtle">Loading...</p> : items.length === 0 ? <p className="subtle">None yet.</p> : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Customer</th><th>SO Number</th><th>Purpose</th><th>Total</th><th>Comments</th><th>Item Code</th><th></th></tr></thead>
              <tbody>
                {pageItems.map((f) => {
                  const total = f.items.reduce((n, it) => n + Number(it.budget || 0), 0);
                  const canSave = !!f.bom_row_id && !!f.job_order_id;
                  const commented = f.history.filter((h) => h.comment);
                  return (
                    <Fragment key={f.id}>
                      <tr>
                        <td>{fmtDate(f.request_date)}</td>
                        <td>{f.customer_name || <span className="subtle">-</span>}</td>
                        <td>{f.po_so_number || <span className="subtle">-</span>}</td>
                        <td>{f.purpose}</td>
                        <td>Rp {total.toLocaleString("id-ID")}</td>
                        <td>
                          <button
                            className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                            onClick={() => setCommentsOpenId(commentsOpenId === f.id ? null : f.id)}
                            disabled={commented.length === 0}
                          >
                            {commentsOpenId === f.id ? "Hide" : `View (${commented.length})`}
                          </button>
                        </td>
                        <td>
                          {canSave ? (
                            <input
                              type="text" value={itemCodeDraft[f.id] ?? ""}
                              onChange={(e) => setItemCodeDraft((d) => ({ ...d, [f.id]: e.target.value.toUpperCase() }))}
                              placeholder="ITEM CODE" style={{ fontSize: "0.82rem", width: 140 }}
                            />
                          ) : (
                            <span className="subtle" title="This form wasn't raised from the Not Available flow, so there's no BOM row to register it against.">Not linked to a BOM row</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                            disabled={!canSave || !(itemCodeDraft[f.id] ?? "").trim() || savingId === f.id}
                            onClick={() => saveItemCode(f)}
                          >
                            {savingId === f.id ? "Saving..." : "Save"}
                          </button>
                        </td>
                      </tr>
                      {commentsOpenId === f.id && commented.length > 0 && (
                        <tr>
                          <td colSpan={8} style={{ background: "var(--panel-muted)" }}>
                            {commented.map((h) => (
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
          <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
        </>
      )}
    </Collapsible>
  );
}
