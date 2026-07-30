"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import { PurchaseForm, FORM_A_CODES, EXPENSE_CODES, fmtDate } from "@/lib/jobOrders";

type FormType = "A" | "B";
interface DraftItem { description: string; budget: string; ppn: boolean; supplierName: string; code: string; file: File | null; }

function blankItem(): DraftItem {
  return { description: "", budget: "", ppn: false, supplierName: "", code: "", file: null };
}

function formMatches(f: PurchaseForm, term: string): boolean {
  return (
    f.name.toLowerCase().includes(term) ||
    f.customer_name.toLowerCase().includes(term) ||
    f.po_so_number.toLowerCase().includes(term) ||
    fmtDate(f.request_date).includes(term)
  );
}

export default function FormPage() {
  const [forms, setForms] = useState<PurchaseForm[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<FormType | null>(null);

  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [poSoNumber, setPoSoNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  async function load() {
    const res = await fetch("/api/purchase-forms", { cache: "no-store" });
    const data = await res.json();
    setForms(data.forms ?? []);
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setFormType(null);
    setName(""); setCustomerName(""); setPoSoNumber(""); setPurpose("");
    setItems([blankItem()]);
    setShowForm(false);
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

  const totalBudget = items.reduce((sum, it) => sum + (Number(it.budget) || 0), 0);

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
      formData.append("items", JSON.stringify(items.map((it) => ({
        description: it.description, budget: it.budget, ppn: it.ppn, supplierName: it.supplierName, code: it.code,
      }))));
      items.forEach((it, i) => { if (it.file) formData.append(`attachment_${i}`, it.file); });

      const res = await fetch("/api/purchase-forms", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to submit form."); return; }
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  const codeOptions = formType === "B" ? EXPENSE_CODES.map((e) => ({ value: e.code, label: `${e.code} - ${e.label}` })) : FORM_A_CODES.map((c) => ({ value: c, label: c }));
  const canSubmit = formType && name.trim() && items.some((it) => it.description.trim()) && !saving;

  const formsA = (forms ?? []).filter((f) => f.form_type === "A");
  const formsB = (forms ?? []).filter((f) => f.form_type === "B");

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Submit a form</h2>
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
                <h2 style={{ textAlign: "center", margin: "0 0 4px" }}>
                  {formType === "A" ? "FORM A (INVENTORY/SERVICE)" : "FORM B (EXPENSE)"}
                </h2>
                <p className="subtle" style={{ textAlign: "center", marginTop: 0 }}>
                  {formType === "A" ? "Accurate Module: RI - PI" : (
                    <>Accurate Module: OP - JV<br />*Fixed Asset price is &ge; Rp.1.000.000</>
                  )}
                  {" — "}
                  <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setFormType(formType === "A" ? "B" : "A")}>
                    switch to {formType === "A" ? "Form B" : "Form A"}
                  </span>
                </p>

                <div className="form-sheet" style={{ gridTemplateColumns: "1fr", maxWidth: 480, margin: "14px auto" }}>
                  <div className="form-sheet-col">
                    <div className="form-row"><label>Request Date</label><span>:</span><span>{fmtDate(todayIso)}</span></div>
                    <div className="form-row"><label>Name</label><span>:</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="form-row"><label>Customer Name</label><span>:</span><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value.toUpperCase())} /></div>
                    <div className="form-row"><label>PO / SO Number</label><span>:</span><input type="text" value={poSoNumber} onChange={(e) => setPoSoNumber(e.target.value.toUpperCase())} /></div>
                    <div className="form-row"><label>Purpose</label><span>:</span><input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
                  </div>
                </div>

                {formType === "B" && (
                  <div className="card" style={{ background: "var(--panel-muted)" }}>
                    <div className="subtle" style={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", marginBottom: 8 }}>Expense Code</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px" }}>
                      <div>
                        {EXPENSE_CODES.slice(0, 7).map((e) => (
                          <div key={e.code} style={{ fontSize: "0.82rem", padding: "3px 0" }}><b>{e.code})</b> {e.label}</div>
                        ))}
                      </div>
                      <div>
                        {EXPENSE_CODES.slice(7).map((e) => (
                          <div key={e.code} style={{ fontSize: "0.82rem", padding: "3px 0" }}><b>{e.code})</b> {e.label}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: "auto", marginTop: 14 }}>
                  <table className="data-table fixed">
                    <colgroup>
                      <col style={{ width: "4%" }} /><col style={{ width: "26%" }} /><col style={{ width: "12%" }} />
                      <col style={{ width: "6%" }} /><col style={{ width: "16%" }} /><col style={{ width: "16%" }} />
                      <col style={{ width: "14%" }} /><col style={{ width: "6%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>No.</th><th>Item Description</th><th>Budget (IDR)</th><th>PPN</th>
                        <th>Supplier Name</th><th>Code</th><th>Attachment</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><input type="text" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} style={{ fontSize: "0.82rem" }} /></td>
                          <td><input type="number" value={it.budget} onChange={(e) => updateItem(i, { budget: e.target.value })} style={{ fontSize: "0.82rem" }} /></td>
                          <td style={{ textAlign: "center" }}><input type="checkbox" checked={it.ppn} onChange={(e) => updateItem(i, { ppn: e.target.checked })} style={{ width: "auto" }} /></td>
                          <td><input type="text" value={it.supplierName} onChange={(e) => updateItem(i, { supplierName: e.target.value })} style={{ fontSize: "0.82rem" }} /></td>
                          <td>
                            <select value={it.code} onChange={(e) => updateItem(i, { code: e.target.value })} style={{ fontSize: "0.78rem" }}>
                              <option value="">Select...</option>
                              {codeOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <input type="file" accept="application/pdf,image/*" onChange={(e) => updateItem(i, { file: e.target.files?.[0] || null })} style={{ fontSize: "0.72rem" }} />
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
                  <button className="btn" onClick={submit} disabled={!canSubmit}>{saving ? "Submitting..." : "Submit form"}</button>
                  <button className="btn secondary" onClick={resetForm}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!forms ? <p className="subtle">Loading...</p> : (
        <>
          <FormList title="Form A — Inventory/Service" items={formsA} onViewFile={viewFile} />
          <FormList title="Form B — Expense" items={formsB} onViewFile={viewFile} />
        </>
      )}
    </>
  );
}

function FormList({ title, items, onViewFile }: { title: string; items: PurchaseForm[]; onViewFile: (path: string) => void }) {
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, formMatches);
  return (
    <Collapsible title={title} count={items.length}>
      {items.length === 0 ? <p className="subtle">None yet.</p> : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Name</th><th>Customer</th><th>PO/SO</th><th>Purpose</th><th>Items</th><th>Total</th></tr>
              </thead>
              <tbody>
                {pageItems.map((f) => {
                  const total = f.items.reduce((n, it) => n + Number(it.budget || 0), 0);
                  return (
                    <Fragment key={f.id}>
                      <tr>
                        <td>{fmtDate(f.request_date)}</td>
                        <td>{f.name}</td>
                        <td>{f.customer_name || <span className="subtle">-</span>}</td>
                        <td>{f.po_so_number || <span className="subtle">-</span>}</td>
                        <td>{f.purpose}</td>
                        <td>{f.items.length}</td>
                        <td>Rp {total.toLocaleString("id-ID")}</td>
                      </tr>
                      <tr>
                        <td colSpan={7} style={{ background: "var(--panel-muted)" }}>
                          <div style={{ overflowX: "auto" }}>
                            <table className="data-table">
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
