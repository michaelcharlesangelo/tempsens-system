"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { HsCode } from "@/lib/jobOrders";

function hsCodeMatches(h: HsCode, term: string): boolean {
  return h.code.toLowerCase().includes(term) || h.description.toLowerCase().includes(term);
}

export default function HsCodesPage() {
  const [items, setItems] = useState<HsCode[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBm, setNewBm] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editBm, setEditBm] = useState("");

  async function load() {
    const res = await fetch("/api/hs-codes", { cache: "no-store" });
    const data = await res.json();
    setItems(data.hsCodes ?? []);
  }

  useEffect(() => { load(); }, []);

  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items ?? [], hsCodeMatches);

  async function addItem() {
    if (!newCode.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/hs-codes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode, description: newDescription, bm: newBm }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to add HS Code."); return; }
      setNewCode(""); setNewDescription(""); setNewBm("");
      load();
    } finally {
      setAdding(false);
    }
  }

  function startEdit(h: HsCode) {
    setEditingId(h.id);
    setEditDescription(h.description);
    setEditBm(String(h.bm));
  }

  async function saveEdit(id: string) {
    await fetch(`/api/hs-codes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: editDescription, bm: editBm }),
    });
    setEditingId(null);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this HS Code?")) return;
    await fetch(`/api/hs-codes/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <p style={{ marginBottom: 10 }}><Link href="/exim" className="subtle">← Back to Exim</Link></p>
      <div className="card">
        <h2>HS Code</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          HS Code registry with each code&apos;s BM (import duty %). Typing a new code directly into the Exim
          shipment recap auto-adds a bare entry here with a blank description - fill it in below.
        </p>

        {message && <div className="warn">{message}</div>}
        <SearchBox value={search} onChange={setSearch} />

        {!items ? <p className="subtle">Loading...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table fixed">
                <colgroup>
                  <col style={{ width: "15%" }} /><col style={{ width: "55%" }} /><col style={{ width: "10%" }} /><col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Code</th><th>Description</th><th>BM (%)</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "var(--panel-muted)" }}>
                    <td><input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="CODE" style={{ fontSize: "0.82rem" }} /></td>
                    <td><input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" style={{ fontSize: "0.82rem" }} /></td>
                    <td><input type="number" value={newBm} onChange={(e) => setNewBm(e.target.value)} placeholder="0" style={{ fontSize: "0.82rem" }} /></td>
                    <td>
                      <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={addItem} disabled={adding || !newCode.trim()}>
                        {adding ? "Adding..." : "+ Add"}
                      </button>
                    </td>
                  </tr>
                  {totalCount === 0 ? (
                    <tr><td colSpan={4} className="subtle">No matching HS Codes.</td></tr>
                  ) : (
                    pageItems.map((h) => (
                      <tr key={h.id}>
                        <td>{h.code}</td>
                        <td>
                          {editingId === h.id ? (
                            <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: "100%" }} />
                          ) : (
                            h.description || <span className="subtle">-</span>
                          )}
                        </td>
                        <td>
                          {editingId === h.id ? (
                            <input type="number" value={editBm} onChange={(e) => setEditBm(e.target.value)} style={{ maxWidth: 70 }} />
                          ) : (
                            `${h.bm}%`
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {editingId === h.id ? (
                            <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => saveEdit(h.id)}>Save</button>
                          ) : (
                            <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => startEdit(h)}>Edit</button>
                          )}{" "}
                          <button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteItem(h.id)}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
