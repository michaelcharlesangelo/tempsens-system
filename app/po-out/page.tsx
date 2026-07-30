"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import { PoOut, PO_OUT_SUPPLIERS, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

interface SalesAccount { id: string; full_name: string; }

function blank() {
  return {
    poDate: new Date().toISOString().slice(0, 10), deadline: "", poNumber: "", itemCode: "",
    sales: "", customerName: "", itemDescription: "", qty: "1", unit: "pcs",
    unitPrice: "", unitSellingPrice: "", supplier: "", stockExport: "stock" as "stock" | "export",
  };
}

function poMatches(p: PoOut, term: string): boolean {
  return (
    p.po_number.toLowerCase().includes(term) ||
    p.item_code.toLowerCase().includes(term) ||
    p.customer_name.toLowerCase().includes(term) ||
    p.supplier.toLowerCase().includes(term) ||
    fmtDate(p.po_date).includes(term)
  );
}

export default function PoOutPage() {
  const [pos, setPos] = useState<PoOut[] | null>(null);
  const [salesAccounts, setSalesAccounts] = useState<SalesAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const currentRole = getCurrentRole();

  async function load() {
    const res = await fetch("/api/po-out", { cache: "no-store" });
    const data = await res.json();
    setPos(data.pos ?? []);
  }

  useEffect(() => {
    load();
    fetch("/api/production-accounts?forSales=true", { cache: "no-store" }).then((r) => r.json()).then((d) => setSalesAccounts(d.accounts ?? []));
  }, []);

  function resetForm() {
    setDraft(blank());
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(p: PoOut) {
    setEditingId(p.id);
    setDraft({
      poDate: p.po_date.slice(0, 10), deadline: p.deadline ? p.deadline.slice(0, 10) : "",
      poNumber: p.po_number, itemCode: p.item_code, sales: p.sales, customerName: p.customer_name,
      itemDescription: p.item_description, qty: String(p.qty), unit: p.unit,
      unitPrice: String(p.unit_price), unitSellingPrice: String(p.unit_selling_price),
      supplier: p.supplier, stockExport: p.stock_export,
    });
    setShowForm(true);
    setError(null);
  }

  const totalPrice = (Number(draft.qty) || 0) * (Number(draft.unitPrice) || 0);

  async function submit() {
    if (!draft.poNumber.trim() || !draft.supplier) { setError("PO Number and Supplier are required."); return; }
    setError(null);
    setSaving(true);
    try {
      const url = editingId ? `/api/po-out/${editingId}` : "/api/po-out";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, submittedBy: currentRole.label }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function cancelPo(id: string) {
    if (!confirm("Cancel this PO? This can't be undone.")) return;
    const res = await fetch(`/api/po-out/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to cancel."); return; }
    load();
  }

  async function addComment(id: string) {
    if (!commentDraft.trim()) return;
    await fetch(`/api/po-out/${id}/comment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: commentDraft, changedBy: currentRole.label }),
    });
    setCommentDraft("");
    load();
  }

  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(pos ?? [], poMatches);

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>PO Out</h2>
            <p className="subtle" style={{ margin: "2px 0 0", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Filled in by Sales Support
            </p>
          </div>
          {!showForm && <button className="btn" onClick={() => setShowForm(true)}>+ New</button>}
        </div>

        {showForm && (
          <div style={{ marginTop: 14 }}>
            <div className="grid">
              <div className="field"><label>PO Date</label><input type="date" value={draft.poDate} onChange={(e) => setDraft({ ...draft, poDate: e.target.value })} /></div>
              <div className="field"><label>Deadline</label><input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></div>
              <div className="field"><label>PO Number</label><input type="text" value={draft.poNumber} onChange={(e) => setDraft({ ...draft, poNumber: e.target.value.toUpperCase() })} /></div>
              <div className="field"><label>Item Code</label><input type="text" value={draft.itemCode} onChange={(e) => setDraft({ ...draft, itemCode: e.target.value.toUpperCase() })} /></div>
              <div className="field">
                <label>Sales</label>
                <select value={draft.sales} onChange={(e) => setDraft({ ...draft, sales: e.target.value })}>
                  <option value="">Select...</option>
                  {salesAccounts.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                </select>
              </div>
              <div className="field"><label>Customer Name</label><input type="text" value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value.toUpperCase() })} /></div>
              <div className="field"><label>Item Description</label><input type="text" value={draft.itemDescription} onChange={(e) => setDraft({ ...draft, itemDescription: e.target.value })} /></div>
              <div className="field"><label>Qty</label><input type="number" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /></div>
              <div className="field"><label>Unit</label><input type="text" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></div>
              <div className="field"><label>Unit Price</label><input type="number" value={draft.unitPrice} onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })} /></div>
              <div className="field"><label>Total Price</label><div className="subtle" style={{ padding: "8px 0" }}>{totalPrice.toLocaleString("id-ID")}</div></div>
              <div className="field"><label>Unit Selling Price</label><input type="number" value={draft.unitSellingPrice} onChange={(e) => setDraft({ ...draft, unitSellingPrice: e.target.value })} /></div>
              <div className="field">
                <label>Supplier</label>
                <select value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}>
                  <option value="">Select...</option>
                  {PO_OUT_SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Stock / Export</label>
                <div className="pill-toggle equal-width">
                  <button className={draft.stockExport === "stock" ? "active" : ""} onClick={() => setDraft({ ...draft, stockExport: "stock" })}>Stock</button>
                  <button className={draft.stockExport === "export" ? "active" : ""} onClick={() => setDraft({ ...draft, stockExport: "export" })}>Export</button>
                </div>
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={submit} disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Submit"}</button>
              <button className="btn secondary" onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {message && <div className="warn">{message}</div>}

      <Collapsible title="PO Out" count={pos?.length}>
        {!pos ? <p className="subtle">Loading...</p> : pos.length === 0 ? <p className="subtle">None yet.</p> : (
          <>
            <SearchBox value={search} onChange={setSearch} />
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO Date</th><th>Deadline</th><th>PO Number</th><th>Item Code</th><th>Sales</th>
                    <th>Customer Name</th><th>Item Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th>
                    <th>Total Price</th><th>Unit Selling Price</th><th>Supplier</th><th>Type</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const commented = p.history.filter((h) => h.comment);
                    return (
                      <Fragment key={p.id}>
                        <tr style={p.status === "cancelled" ? { opacity: 0.55 } : undefined}>
                          <td>{fmtDate(p.po_date)}</td>
                          <td>{fmtDate(p.deadline)}</td>
                          <td>{p.po_number}</td>
                          <td>{p.item_code}</td>
                          <td>{p.sales}</td>
                          <td>{p.customer_name}</td>
                          <td>{p.item_description}</td>
                          <td>{p.qty}</td>
                          <td>{p.unit}</td>
                          <td>{Number(p.unit_price).toLocaleString("id-ID")}</td>
                          <td>{Number(p.total_price).toLocaleString("id-ID")}</td>
                          <td>{Number(p.unit_selling_price).toLocaleString("id-ID")}</td>
                          <td>{p.supplier}</td>
                          <td style={{ textTransform: "capitalize" }}>{p.stock_export}</td>
                          <td>{p.status === "cancelled" ? <span className="pill pill-cancelled">Cancelled</span> : <span className="pill pill-approved">Active</span>}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {p.status === "active" && (
                              <>
                                <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => startEdit(p)}>Edit</button>{" "}
                              </>
                            )}
                            <button
                              className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                              onClick={() => setCommentOpenId(commentOpenId === p.id ? null : p.id)}
                            >
                              {commentOpenId === p.id ? "Hide" : `Comment (${commented.length})`}
                            </button>{" "}
                            {p.status === "active" && (
                              <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => cancelPo(p.id)}>Cancel</button>
                            )}
                          </td>
                        </tr>
                        {commentOpenId === p.id && (
                          <tr>
                            <td colSpan={16} style={{ background: "var(--panel-muted)" }}>
                              {commented.map((h) => (
                                <div key={h.id} style={{ fontSize: "0.82rem", padding: "4px 0" }}>
                                  <b>{h.changed_by}</b> <span className="subtle">({fmtDateTime(h.changed_at)})</span>: {h.comment}
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                <input type="text" placeholder="Add a comment..." value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} style={{ flex: 1 }} />
                                <button className="btn secondary" style={{ fontSize: "0.75rem" }} onClick={() => addComment(p.id)} disabled={!commentDraft.trim()}>Add</button>
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
      </Collapsible>
    </>
  );
}
