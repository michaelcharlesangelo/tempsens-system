"use client";

import { useEffect, useState } from "react";
import DateField from "@/app/components/DateField";
import ProjectRecapSection from "@/app/components/ProjectRecapSection";
import { Currency, CURRENCY_SYMBOLS } from "@/lib/jobOrders";
import { getCurrentRole } from "@/lib/roles";

interface SalesAccount { id: string; full_name: string; }

interface Draft {
  projectNumber: string; customerName: string; projectDescription: string;
  hasPo: boolean; poDate: string; poNumber: string; poValue: string; poValueCurrency: Currency; sales: string;
}

function blank(): Draft {
  return {
    projectNumber: "", customerName: "", projectDescription: "",
    hasPo: true, poDate: "", poNumber: "", poValue: "", poValueCurrency: "IDR", sales: "",
  };
}

function formatPrice(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}
function parsePrice(display: string): string {
  return display.replace(/\D/g, "");
}

export default function ProjectManagerPage() {
  const currentRole = getCurrentRole();
  const [salesAccounts, setSalesAccounts] = useState<SalesAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(blank());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/production-accounts?forSales=true", { cache: "no-store" }).then((r) => r.json()).then((d) => setSalesAccounts(d.accounts ?? []));
  }, []);

  function resetForm() {
    setDraft(blank());
    setShowForm(false);
    setError(null);
  }

  async function submit() {
    if (!draft.projectNumber.trim() || !draft.customerName.trim()) {
      setError("Project Number and Customer Name are required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, poValue: parsePrice(draft.poValue), submittedBy: currentRole.label }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      resetForm();
      setRefreshKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>PROJECT</h2>
          {!showForm && <button className="btn" onClick={() => setShowForm(true)}>+ New</button>}
        </div>

        {showForm && (
          <div style={{ marginTop: 14 }}>
            <div className="form-sheet" style={{ marginTop: 14 }}>
              <div className="form-sheet-col">
                <div className="form-row"><label>Project Number</label><span>:</span><input type="text" value={draft.projectNumber} onChange={(e) => setDraft({ ...draft, projectNumber: e.target.value.toUpperCase() })} /></div>
                <div className="form-row"><label>Customer Name</label><span>:</span><input type="text" value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value.toUpperCase() })} /></div>
                <div className="form-row">
                  <label>Project Description</label><span>:</span>
                  <textarea rows={2} value={draft.projectDescription} onChange={(e) => setDraft({ ...draft, projectDescription: e.target.value })} />
                </div>
              </div>
              <div className="form-sheet-col">
                <div className="form-row"><label>PO Date</label><span>:</span><DateField value={draft.poDate} onChange={(v) => setDraft({ ...draft, poDate: v })} /></div>
                <div className="form-row"><label>PO Number</label><span>:</span><input type="text" value={draft.poNumber} onChange={(e) => setDraft({ ...draft, poNumber: e.target.value.toUpperCase() })} /></div>
                <div className="form-row">
                  <label>PO Value</label><span>:</span>
                  <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <select
                      value={draft.poValueCurrency}
                      onChange={(e) => setDraft({ ...draft, poValueCurrency: e.target.value as Currency })}
                      style={{ border: "none", borderRight: "1px solid var(--border)", background: "var(--panel-muted)", fontSize: "0.74rem", padding: "0 2px", borderRadius: 0, flex: "none", width: 50 }}
                    >
                      {(Object.keys(CURRENCY_SYMBOLS) as Currency[]).map((c) => <option key={c} value={c}>{CURRENCY_SYMBOLS[c]}</option>)}
                    </select>
                    <input
                      type="text" inputMode="numeric" value={draft.poValue}
                      onChange={(e) => setDraft({ ...draft, poValue: formatPrice(e.target.value) })}
                      style={{ border: "none", flex: 1, minWidth: 0, width: "100%" }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label>Sales</label><span>:</span>
                  <select value={draft.sales} onChange={(e) => setDraft({ ...draft, sales: e.target.value })}>
                    <option value="">Select...</option>
                    {salesAccounts.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Submit"}</button>
              <button className="btn secondary" onClick={resetForm}>Cancel</button>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={!draft.hasPo} onChange={(e) => setDraft({ ...draft, hasPo: !e.target.checked })} style={{ width: 15, height: 15 }} /> Not PO
              </label>
            </div>
          </div>
        )}
      </div>

      <ProjectRecapSection key={refreshKey} canManage />
    </>
  );
}
