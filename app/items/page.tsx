"use client";

import { Fragment, useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";

interface CatalogItem { item_no: string; description: string; unit: string; }
interface UsageMonth { label: string; qty: number; }
type SortCol = "item_no" | "description";

function catalogMatches(item: CatalogItem, term: string): boolean {
  return item.item_no.toLowerCase().includes(term) || item.description.toLowerCase().includes(term);
}

export default function ItemsPage() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("item_no");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [newItemNo, setNewItemNo] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [adding, setAdding] = useState(false);

  const [editingItemNo, setEditingItemNo] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState("");
  const [editingUnit, setEditingUnit] = useState("");

  const [usageOpenFor, setUsageOpenFor] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageMonth[] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/item-catalog?kind=material", { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => { load(); }, []);

  function sortBy(col: SortCol) {
    if (sortCol === col) { setSortDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSortCol(col);
    setSortDir("asc");
  }

  const sorted = [...(items ?? [])].sort((a, b) => {
    const cmp = a[sortCol].localeCompare(b[sortCol]);
    return sortDir === "asc" ? cmp : -cmp;
  });
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(sorted, catalogMatches);

  async function addItem() {
    if (!newItemNo.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/item-catalog", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemNo: newItemNo, description: newDescription, unit: newUnit }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to add item."); return; }
      setNewItemNo(""); setNewDescription(""); setNewUnit("pcs");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(itemNo: string) {
    await fetch("/api/item-catalog", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemNo, description: editingDesc, unit: editingUnit }),
    });
    setEditingItemNo(null);
    load();
  }

  async function deleteItem(itemNo: string) {
    if (!confirm(`Delete item "${itemNo}"?`)) return;
    await fetch(`/api/item-catalog?itemNo=${encodeURIComponent(itemNo)}`, { method: "DELETE" });
    load();
  }

  async function toggleUsage(itemNo: string) {
    if (usageOpenFor === itemNo) { setUsageOpenFor(null); return; }
    setUsageOpenFor(itemNo);
    setUsageData(null);
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/item-catalog/${encodeURIComponent(itemNo)}/usage`, { cache: "no-store" });
      const data = await res.json();
      setUsageData(data.months ?? []);
    } finally {
      setUsageLoading(false);
    }
  }

  const maxQty = Math.max(1, ...(usageData ?? []).map((m) => m.qty));

  function SortHeader({ col, children }: { col: SortCol; children: React.ReactNode }) {
    return (
      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => sortBy(col)}>
        {children} {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <>
      <div className="card">
        <h2>Items</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Material item codes used across BOMs. Click Item Code or Description to sort. Add a new code directly in
          the table below, or check monthly usage before reordering.
        </p>

        {message && <div className="warn">{message}</div>}
        <SearchBox value={search} onChange={setSearch} />

        {!items ? <p className="subtle">Loading...</p> : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table fixed">
                <colgroup>
                  <col style={{ width: "12%" }} /><col style={{ width: "58%" }} /><col style={{ width: "8%" }} /><col style={{ width: "22%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <SortHeader col="item_no">Item Code</SortHeader>
                    <SortHeader col="description">Description</SortHeader>
                    <th>Unit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "var(--panel-muted)" }}>
                    <td><input type="text" value={newItemNo} onChange={(e) => setNewItemNo(e.target.value.toUpperCase())} placeholder="ITEM CODE" style={{ fontSize: "0.82rem" }} /></td>
                    <td><input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" style={{ fontSize: "0.82rem" }} /></td>
                    <td><input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="pcs" style={{ fontSize: "0.82rem" }} /></td>
                    <td>
                      <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={addItem} disabled={adding || !newItemNo.trim()}>
                        {adding ? "Adding..." : "+ Add"}
                      </button>
                    </td>
                  </tr>
                  {totalCount === 0 ? (
                    <tr><td colSpan={4} className="subtle">No matching items.</td></tr>
                  ) : (
                    pageItems.map((i) => (
                      <Fragment key={i.item_no}>
                        <tr>
                          <td>{i.item_no}</td>
                          <td>
                            {editingItemNo === i.item_no ? (
                              <input type="text" value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} style={{ width: "100%" }} />
                            ) : (
                              i.description
                            )}
                          </td>
                          <td>
                            {editingItemNo === i.item_no ? (
                              <input type="text" value={editingUnit} onChange={(e) => setEditingUnit(e.target.value)} style={{ maxWidth: 70 }} />
                            ) : (
                              i.unit
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {editingItemNo === i.item_no ? (
                              <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => saveEdit(i.item_no)}>Save</button>
                            ) : (
                              <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => { setEditingItemNo(i.item_no); setEditingDesc(i.description); setEditingUnit(i.unit); }}>Edit</button>
                            )}{" "}
                            <button className="btn secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => toggleUsage(i.item_no)}>
                              {usageOpenFor === i.item_no ? "Hide Usage" : "Usage"}
                            </button>{" "}
                            <button className="btn danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }} onClick={() => deleteItem(i.item_no)}>Delete</button>
                          </td>
                        </tr>
                        {usageOpenFor === i.item_no && (
                          <tr>
                            <td colSpan={4} style={{ background: "var(--panel-muted)" }}>
                              {usageLoading ? (
                                <p className="subtle" style={{ margin: "8px 0" }}>Loading usage...</p>
                              ) : (
                                <div style={{ padding: "12px 4px" }}>
                                  <div className="subtle" style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
                                    Monthly usage — {i.item_no}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                                    {(usageData ?? []).map((m) => (
                                      <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                        <div className="subtle" style={{ fontSize: "0.68rem" }}>{m.qty > 0 ? m.qty : ""}</div>
                                        <div
                                          style={{
                                            width: "100%", maxWidth: 26, borderRadius: "3px 3px 0 0",
                                            background: m.qty > 0 ? "var(--accent)" : "var(--border)",
                                            height: Math.max(3, (m.qty / maxQty) * 64),
                                          }}
                                          title={`${m.label}: ${m.qty} ${i.unit}`}
                                        />
                                        <div className="subtle" style={{ fontSize: "0.65rem" }}>{m.label}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
