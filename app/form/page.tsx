"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import { PurchaseForm, PurchaseFormItem, FORM_A_CODES, EXPENSE_CODES, fmtDate, fmtDateTime } from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

type FormType = "A" | "B";
interface DraftItem {
  description: string; budget: string; ppn: boolean; supplierName: string; code: string;
  file: File | null; existingPath?: string | null; existingFilename?: string | null;
}

function blankItem(): DraftItem {
  return { description: "", budget: "", ppn: false, supplierName: "", code: "", file: null };
}

function formatBudget(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}
function parseBudget(display: string): string {
  return display.replace(/\D/g, "");
}

function formMatches(f: PurchaseForm, term: string): boolean {
  return (
    f.name.toLowerCase().includes(term) ||
    f.customer_name.toLowerCase().includes(term) ||
    f.po_so_number.toLowerCase().includes(term) ||
    fmtDate(f.request_date).includes(term)
  );
}

function statusLabel(f: PurchaseForm): string {
  if (f.status === "pending_approval") return f.current_approval_layer === 2 ? "Pending — General Manager" : "Pending — Operational Manager";
  if (f.status === "approved") return "Approved";
  if (f.status === "rejected") return "Rejected";
  return "Cancelled";
}
function statusColor(f: PurchaseForm): { bg: string; fg: string } {
  if (f.status === "approved") return { bg: "#dcfce7", fg: "#15803d" };
  if (f.status === "rejected") return { bg: "#fee2e2", fg: "#b91c1c" };
  if (f.status === "cancelled") return { bg: "var(--panel-muted)", fg: "var(--text-muted)" };
  return { bg: "var(--warn-bg)", fg: "var(--warn-text)" };
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function printForm(form: PurchaseForm) {
  const rows = form.items.map((it) => `
    <tr>
      <td>${esc(it.description)}</td><td>Rp ${esc(Number(it.budget).toLocaleString("id-ID"))}</td>
      <td>${it.ppn ? "Yes" : "-"}</td><td>${esc(it.supplier_name)}</td><td>${esc(it.code)}</td>
    </tr>`).join("");
  const total = form.items.reduce((n, it) => n + Number(it.budget || 0), 0);
  const title = form.form_type === "A" ? "FORM A (INVENTORY/SERVICE)" : "FORM B (EXPENSE)";

  const comments = form.history.filter((h) => h.comment);
  const commentRows = comments.length
    ? comments.map((h) => `<div class="comment"><b>${esc(h.changed_by)}</b> <span class="muted">(${esc(fmtDateTime(h.changed_at))})</span>: ${esc(h.comment)}</div>`).join("")
    : `<div class="muted">None.</div>`;

  const expenseCodeSection = form.form_type === "B" ? `
    <div class="section-title">Expense Code</div>
    <div class="expense-codes">
      ${EXPENSE_CODES.map((e) => `<div>${e.code === "J" ? "<b>J)</b> Fixed Asset*<div class=\"muted\" style=\"font-size:8.5px;padding-left:12px;\">*Fixed Asset price is &ge; Rp.1.000.000</div>" : `<b>${esc(e.code)})</b> ${esc(e.label)}`}</div>`).join("")}
    </div>
  ` : "";

  const html = `
    <html><head><meta charset="utf-8"><title>${esc(title)} - ${esc(form.name)}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.45; }
      h1 { font-size: 16px; text-align: center; }
      table.info { width: 100%; border-collapse: collapse; margin: 10px 0; table-layout: fixed; }
      table.info td { padding: 4px 6px; vertical-align: top; word-wrap: break-word; }
      table.info td.label { font-weight: bold; width: 25%; white-space: nowrap; }
      table.items { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
      table.items th, table.items td { border: 1px solid #999; padding: 5px 7px; text-align: left; font-size: 10px; line-height: 1.4; word-wrap: break-word; }
      table.items th { background: #eee; }
      .total { text-align: right; font-weight: bold; margin-top: 8px; }
      .section-title { font-weight: bold; text-transform: uppercase; font-size: 10px; margin: 10px 0 4px; border-top: 1px solid #999; padding-top: 6px; }
      .comment { font-size: 10px; padding: 2px 0; }
      .muted { color: #666; }
      .expense-codes { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; font-size: 9.5px; background: #f4f4f4; padding: 8px 10px; border-radius: 4px; }
    </style>
    </head><body onload="window.focus();window.print();">
      <h1>${esc(title)}</h1>
      <table class="info">
        <tr><td class="label">Request Date</td><td>${esc(fmtDate(form.request_date))}</td></tr>
        <tr><td class="label">Name</td><td>${esc(form.name)}</td></tr>
        ${form.customer_name ? `<tr><td class="label">Customer Name</td><td>${esc(form.customer_name)}</td></tr>` : ""}
        ${form.po_so_number ? `<tr><td class="label">PO / SO Number</td><td>${esc(form.po_so_number)}</td></tr>` : ""}
        <tr><td class="label">Purpose</td><td>${esc(form.purpose)}</td></tr>
      </table>

      ${expenseCodeSection}

      <table class="items" style="margin-top:10px">
        <thead><tr><th>Item Description</th><th>Budget (IDR)</th><th>PPN</th><th>Supplier Name</th><th>Code</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">Total Budget: Rp ${total.toLocaleString("id-ID")}</div>

      <div class="section-title">Comments</div>
      ${commentRows}
    </body></html>
  `;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(blobUrl, "_blank", "width=850,height=1100");
}

export default function FormPage() {
  return (
    <Suspense fallback={<p className="subtle">Loading...</p>}>
      <FormPageInner />
    </Suspense>
  );
}

function FormPageInner() {
  const searchParams = useSearchParams();

  const [forms, setForms] = useState<PurchaseForm[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<FormType | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sourceTag, setSourceTag] = useState<string | null>(null);
  const [bomRowId, setBomRowId] = useState<string | null>(null);
  const [jobOrderId, setJobOrderId] = useState<string | null>(null);
  const [justSubmittedFromWarehouse, setJustSubmittedFromWarehouse] = useState(false);

  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [poSoNumber, setPoSoNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentRole = getCurrentRole();

  async function load() {
    const res = await fetch("/api/purchase-forms", { cache: "no-store" });
    const data = await res.json();
    setForms(data.forms ?? []);
  }

  useEffect(() => { load(); }, []);

  // Arriving from Warehouse Manager's "Not Available -> Local Purchase" -
  // prefill and jump straight into Form A, tagged so the approved result
  // routes to Sales Support Supervisor's dedicated table.
  useEffect(() => {
    const src = searchParams.get("source");
    if (!src) return;
    setSourceTag(src);
    setFormType("A");
    setShowForm(true);
    setName(searchParams.get("name") || "Warehouse Manager");
    setCustomerName(searchParams.get("customerName") || "");
    setPoSoNumber(searchParams.get("poSoNumber") || "");
    setBomRowId(searchParams.get("bomRowId"));
    setJobOrderId(searchParams.get("jobOrderId"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setFormType(null);
    setEditingId(null);
    setSourceTag(null);
    setBomRowId(null);
    setJobOrderId(null);
    setJustSubmittedFromWarehouse(false);
    setName(""); setCustomerName(""); setPoSoNumber(""); setPurpose("");
    setItems([blankItem()]);
    setShowForm(false);
  }

  function startEdit(f: PurchaseForm) {
    setEditingId(f.id);
    setFormType(f.form_type);
    setName(f.name);
    setCustomerName(f.customer_name);
    setPoSoNumber(f.po_so_number);
    setPurpose(f.purpose);
    setItems(f.items.length > 0 ? f.items.map((it) => ({
      description: it.description, budget: it.budget ? Number(it.budget).toLocaleString("id-ID") : "",
      ppn: it.ppn, supplierName: it.supplier_name, code: it.code, file: null,
      existingPath: it.attachment_path, existingFilename: it.attachment_filename,
    })) : [blankItem()]);
    setShowForm(true);
    setError(null);
  }

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addItemRow() {
    setItems((cur) => [...cur, blankItem()]);
  }

  function removeItemRow(i: number) {
    setItems((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur));
  }

  const totalBudget = items.reduce((sum, it) => sum + (Number(parseBudget(it.budget)) || 0), 0);

  async function viewFile(path: string) {
    const res = await fetch(`/api/purchase-forms/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  async function submit() {
    if (!formType) return;
    setError(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("formType", formType);
      formData.append("requestDate", todayIso);
      formData.append("name", name);
      formData.append("customerName", customerName);
      formData.append("poSoNumber", poSoNumber);
      formData.append("purpose", purpose);
      if (!editingId) {
        formData.append("submittedBy", currentRole.label);
        if (sourceTag) formData.append("source", sourceTag);
        if (bomRowId) formData.append("bomRowId", bomRowId);
        if (jobOrderId) formData.append("jobOrderId", jobOrderId);
      }
      formData.append("items", JSON.stringify(items.map((it) => ({
        description: it.description, budget: parseBudget(it.budget), ppn: it.ppn, supplierName: it.supplierName, code: it.code,
        existingPath: it.existingPath ?? null, existingFilename: it.existingFilename ?? null,
      }))));
      items.forEach((it, i) => { if (it.file) formData.append(`attachment_${i}`, it.file); });

      const wasWarehouseFlow = !editingId && sourceTag === "warehouse_local_purchase";
      const url = editingId ? `/api/purchase-forms/${editingId}` : "/api/purchase-forms";
      const res = await fetch(url, { method: editingId ? "PATCH" : "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to submit form."); return; }
      resetForm();
      if (wasWarehouseFlow) setJustSubmittedFromWarehouse(true);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function cancelForm(id: string) {
    if (!confirm("Cancel this form? This can't be undone.")) return;
    const res = await fetch(`/api/purchase-forms/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", by: currentRole.label }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Failed to cancel."); return; }
    load();
  }

  const codeOptions = formType === "B" ? EXPENSE_CODES.map((e) => ({ value: e.code, label: `${e.code} - ${e.label}` })) : FORM_A_CODES.map((c) => ({ value: c, label: c }));
  const canSubmit = formType && name.trim() && items.some((it) => it.description.trim())
    && items.every((it) => !it.description.trim() || it.code) && !saving;

  const formsA = (forms ?? []).filter((f) => f.form_type === "A");
  const formsB = (forms ?? []).filter((f) => f.form_type === "B");

  return (
    <>
      {sourceTag === "warehouse_local_purchase" && showForm && (
        <p style={{ marginBottom: 10 }}><a href="/warehouse-manager" className="subtle">← Back to Warehouse Manager</a></p>
      )}
      <div className="card">
        {justSubmittedFromWarehouse && (
          <div className="warn" style={{ marginTop: 0, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Form submitted for approval.</span>
            <a href="/jo-input" className="btn secondary" style={{ fontSize: "0.8rem" }}>Go to JO page</a>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>{editingId ? "Edit form" : "Submit a form"}</h2>
          {!showForm && <button className="btn" onClick={() => setShowForm(true)}>+ New Form</button>}
        </div>

        {showForm && (
          <div style={{ marginTop: 14 }}>
            {!formType ? (
              <div className="field">
                <label>Which form do you need?</label>
                <div className="pill-toggle equal-width">
                  <button onClick={() => setFormType("A")}>Form A (Inventory/Service)</button>
                  <button onClick={() => setFormType("B")}>Form B (Expense)</button>
                </div>
              </div>
            ) : (
              <>
                <p className="subtle" style={{ marginTop: -4 }}>
                  {formType === "A" ? "Form A (Inventory/Service)" : "Form B (Expense)"} —{" "}
                  <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => { setFormType(null); setItems([blankItem()]); }}>
                    change type
                  </span>
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                  <div style={{ width: 140 }} />
                  <h2 style={{ margin: 0, textAlign: "center", flex: 1 }}>
                    {formType === "A" ? "FORM A (INVENTORY/SERVICE)" : "FORM B (EXPENSE)"}
                  </h2>
                  <div className="subtle" style={{ fontSize: "0.8rem", width: 140, textAlign: "right", whiteSpace: "nowrap" }}>
                    Request Date: {fmtDate(todayIso)}
                  </div>
                </div>
                <p className="subtle" style={{ textAlign: "center", marginTop: 4 }}>
                  {formType === "A" ? "Accurate Module: RI - PI" : "Accurate Module: OP - JV"}
                </p>

                <div className="form-sheet" style={{ marginTop: 18 }}>
                  <div className="form-sheet-col">
                    <div className="form-row"><label>Name</label><span>:</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="form-row"><label>Purpose</label><span>:</span><input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
                  </div>
                  <div className="form-sheet-col">
                    <div className="form-row"><label>Customer Name</label><span>:</span><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value.toUpperCase())} /></div>
                    <div className="form-row"><label>PO / SO Number</label><span>:</span><input type="text" value={poSoNumber} onChange={(e) => setPoSoNumber(e.target.value.toUpperCase())} /></div>
                  </div>
                </div>

                {formType === "B" && (
                  <div className="card" style={{ background: "var(--panel-muted)", marginTop: 14 }}>
                    <div className="subtle" style={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", marginBottom: 8 }}>Expense Code</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px" }}>
                      <div>
                        {EXPENSE_CODES.slice(0, 7).map((e) => (
                          <div key={e.code} style={{ fontSize: "0.82rem", padding: "3px 0" }}><b>{e.code})</b> {e.label}</div>
                        ))}
                      </div>
                      <div>
                        {EXPENSE_CODES.slice(7).map((e) => (
                          <Fragment key={e.code}>
                            <div style={{ fontSize: "0.82rem", padding: "3px 0" }}><b>{e.code})</b> {e.label}</div>
                            {e.code === "J" && (
                              <div className="subtle" style={{ fontSize: "0.74rem", paddingLeft: 22 }}>*Fixed Asset price is &ge; Rp.1.000.000</div>
                            )}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: "auto", marginTop: 14 }}>
                  <table className="data-table fixed">
                    <colgroup>
                      <col style={{ width: "4%" }} /><col style={{ width: "29%" }} /><col style={{ width: "10%" }} />
                      <col style={{ width: "7%" }} /><col style={{ width: "16%" }} /><col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} /><col style={{ width: "6%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>No.</th><th>Item Description</th><th>Budget (IDR)</th><th style={{ textAlign: "center", paddingLeft: 10 }}>PPN</th>
                        <th>Supplier Name</th><th>Code</th><th>Attachment</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><input type="text" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} style={{ fontSize: "0.82rem" }} /></td>
                          <td>
                            <input
                              type="text" inputMode="numeric" value={it.budget}
                              onChange={(e) => updateItem(i, { budget: formatBudget(e.target.value) })}
                              placeholder="0" style={{ fontSize: "0.82rem" }}
                            />
                          </td>
                          <td style={{ textAlign: "center", verticalAlign: "middle", paddingLeft: 10 }}>
                            <input type="checkbox" checked={it.ppn} onChange={(e) => updateItem(i, { ppn: e.target.checked })} style={{ width: 16, height: 16 }} />
                          </td>
                          <td><input type="text" value={it.supplierName} onChange={(e) => updateItem(i, { supplierName: e.target.value })} style={{ fontSize: "0.82rem" }} /></td>
                          <td>
                            <select
                              value={it.code} onChange={(e) => updateItem(i, { code: e.target.value })}
                              style={{ fontSize: "0.78rem", borderColor: it.description.trim() && !it.code ? "#dc2626" : undefined }}
                            >
                              <option value="">Select...</option>
                              {codeOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <input type="file" accept="application/pdf,image/*" onChange={(e) => updateItem(i, { file: e.target.files?.[0] || null })} style={{ fontSize: "0.72rem" }} />
                            {it.existingFilename && !it.file && <div className="subtle" style={{ fontSize: "0.68rem" }}>Current: {it.existingFilename}</div>}
                          </td>
                          <td>
                            <button className="btn danger" style={{ padding: "3px 7px", fontSize: "0.7rem" }} onClick={() => removeItemRow(i)} disabled={items.length === 1}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn secondary" style={{ marginTop: 10 }} onClick={addItemRow}>+ Add item</button>

                <div style={{ textAlign: "right", marginTop: 10, fontWeight: 700 }}>
                  Total Budget: Rp {totalBudget.toLocaleString("id-ID")}
                </div>

                {error && <p className="error-text">{error}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn" onClick={submit} disabled={!canSubmit}>{saving ? "Saving..." : editingId ? "Save Changes" : "Submit form"}</button>
                  <button className="btn secondary" onClick={resetForm}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {message && <div className="warn">{message}</div>}

      {!forms ? <p className="subtle">Loading...</p> : (
        <>
          <FormList title="Form A — Inventory/Service" items={formsA} onViewFile={viewFile} onEdit={startEdit} onCancel={cancelForm} onPrint={printForm} />
          <FormList title="Form B — Expense" items={formsB} onViewFile={viewFile} onEdit={startEdit} onCancel={cancelForm} onPrint={printForm} />
        </>
      )}
    </>
  );
}

// Kept at module scope (not nested in FormPageInner) so re-renders from
// typing in the submission form above never remount this list.
function FormList({
  title, items, onViewFile, onEdit, onCancel, onPrint,
}: {
  title: string; items: PurchaseForm[]; onViewFile: (path: string) => void;
  onEdit: (f: PurchaseForm) => void; onCancel: (id: string) => void; onPrint: (f: PurchaseForm) => void;
}) {
  const [showPending, setShowPending] = useState(true);
  const [showApproved, setShowApproved] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const filtered = items.filter((f) => (
    (f.status === "pending_approval" && showPending) ||
    (f.status === "approved" && showApproved) ||
    (f.status === "rejected" && showRejected) ||
    (f.status === "cancelled" && showCancelled)
  ));

  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(filtered, formMatches);
  const [openId, setOpenId] = useState<string | null>(null);
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);

  return (
    <Collapsible
      title={title}
      count={items.length}
      actions={
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <ToggleSwitch checked={showPending} onChange={setShowPending} label={`Pending (${items.filter((f) => f.status === "pending_approval").length})`} />
          <ToggleSwitch checked={showApproved} onChange={setShowApproved} label={`Approved (${items.filter((f) => f.status === "approved").length})`} color="var(--good)" />
          <ToggleSwitch checked={showRejected} onChange={setShowRejected} label={`Rejected (${items.filter((f) => f.status === "rejected").length})`} color="var(--bad)" />
          <ToggleSwitch checked={showCancelled} onChange={setShowCancelled} label={`Cancelled (${items.filter((f) => f.status === "cancelled").length})`} />
        </div>
      }
    >
      {filtered.length === 0 ? <p className="subtle">Nothing to show for the selected filters.</p> : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Name</th><th>Customer</th><th>PO/SO</th><th>Purpose</th><th>Total</th><th>Status</th><th>Comments</th><th></th></tr>
              </thead>
              <tbody>
                {pageItems.map((f) => {
                  const total = f.items.reduce((n, it) => n + Number(it.budget || 0), 0);
                  const commented = f.history.filter((h) => h.comment);
                  const sc = statusColor(f);
                  return (
                    <Fragment key={f.id}>
                      <tr>
                        <td>{fmtDate(f.request_date)}</td>
                        <td>{f.name}</td>
                        <td>{f.customer_name || <span className="subtle">-</span>}</td>
                        <td>{f.po_so_number || <span className="subtle">-</span>}</td>
                        <td>{f.purpose}</td>
                        <td>Rp {total.toLocaleString("id-ID")}</td>
                        <td><span className="pill" style={{ background: sc.bg, color: sc.fg }}>{statusLabel(f)}</span></td>
                        <td>
                          <button
                            className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                            onClick={() => setCommentsOpenId(commentsOpenId === f.id ? null : f.id)}
                            disabled={commented.length === 0}
                          >
                            {commentsOpenId === f.id ? "Hide" : `View (${commented.length})`}
                          </button>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => setOpenId(openId === f.id ? null : f.id)}>
                            {openId === f.id ? "Hide" : "View"}
                          </button>{" "}
                          {f.status === "pending_approval" && (
                            <>
                              <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onEdit(f)}>Edit</button>{" "}
                              <button className="btn danger" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onCancel(f.id)}>Cancel</button>
                            </>
                          )}
                          {f.status === "approved" && (
                            <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onPrint(f)}>Print Form</button>
                          )}
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
                      {openId === f.id && (
                        <tr>
                          <td colSpan={9} style={{ background: "var(--panel-muted)" }}>
                            <div style={{ overflowX: "auto" }}>
                              <table className="data-table">
                                <thead><tr><th>Description</th><th>Budget</th><th>PPN</th><th>Supplier</th><th>Code</th><th>Attachment</th></tr></thead>
                                <tbody>
                                  {f.items.map((it: PurchaseFormItem) => (
                                    <tr key={it.id}>
                                      <td>{it.description}</td>
                                      <td>Rp {Number(it.budget).toLocaleString("id-ID")}</td>
                                      <td>{it.ppn ? "✓" : "-"}</td>
                                      <td>{it.supplier_name}</td>
                                      <td>{it.code}</td>
                                      <td>
                                        {it.attachment_path ? (
                                          <button className="btn secondary" style={{ fontSize: "0.72rem", padding: "3px 8px" }} onClick={() => onViewFile(it.attachment_path!)}>View</button>
                                        ) : <span className="subtle">-</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
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
    </Collapsible>
  );
}
