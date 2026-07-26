"use client";

import { useEffect, useMemo, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { fmtDate } from "@/lib/jobOrders";

interface PrepareItem {
  id: string; job_order_id: string; jo_number: string; so_no: string; req_date: string | null;
  item_no: string; description: string; qty: number; unit: string; comment: string;
  material_prepared: boolean; actual_qty: number | null; actual_unit: string | null;
}
interface NotAvailableItem {
  id: string; job_order_id: string; jo_number: string; customer_name: string; item_no: string; description: string; qty: number; unit: string; procurement_method: string | null;
}
interface SoBlock {
  so_no: string;
  req_date: string | null;
  items: PrepareItem[];
}

function groupBySo(items: PrepareItem[]): SoBlock[] {
  const map = new Map<string, SoBlock>();
  for (const item of items) {
    let block = map.get(item.so_no);
    if (!block) {
      block = { so_no: item.so_no, req_date: item.req_date, items: [] };
      map.set(item.so_no, block);
    }
    block.items.push(item);
  }
  return Array.from(map.values());
}

export default function WarehouseManagerPage() {
  const [items, setItems] = useState<PrepareItem[] | null>(null);
  const [notAvailable, setNotAvailable] = useState<NotAvailableItem[] | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  // Local drafts for Actual Qty / Actual Unit, keyed by BOM row id, so partially
  // filled-in blocks aren't lost between renders and unfilled rows gate the button.
  const [draft, setDraft] = useState<Record<string, { qty: string; unit: string }>>({});
  const [savingBlock, setSavingBlock] = useState<string | null>(null);

  async function loadPrepare() {
    const res = await fetch("/api/warehouse/prepare-list", { cache: "no-store" });
    const data = await res.json();
    const rows: PrepareItem[] = data.items ?? [];
    setItems(rows);
    setDraft((cur) => {
      const next = { ...cur };
      for (const row of rows) {
        if (!next[row.id]) {
          next[row.id] = { qty: row.actual_qty != null ? String(row.actual_qty) : "", unit: row.actual_unit ?? row.unit };
        }
      }
      return next;
    });
  }
  async function loadNotAvailable() {
    const res = await fetch("/api/warehouse/not-ready", { cache: "no-store" });
    const data = await res.json();
    setNotAvailable(data.items ?? []);
  }

  useEffect(() => { loadPrepare(); loadNotAvailable(); }, []);

  const toPrepare = useMemo(() => groupBySo((items ?? []).filter((i) => !i.material_prepared)), [items]);
  const prepared = useMemo(() => groupBySo((items ?? []).filter((i) => i.material_prepared)), [items]);

  const recap = useMemo(() => {
    const map = new Map<string, { itemNo: string; soNo: string; description: string; totalQty: number; unit: string }>();
    (items ?? []).filter((i) => !i.material_prepared).forEach((i) => {
      const key = `${i.item_no}::${i.so_no}`;
      const existing = map.get(key);
      if (existing) existing.totalQty += i.qty;
      else map.set(key, { itemNo: i.item_no, soNo: i.so_no, description: i.description, totalQty: i.qty, unit: i.unit });
    });
    return Array.from(map.values()).sort((a, b) => a.itemNo.localeCompare(b.itemNo) || a.soNo.localeCompare(b.soNo));
  }, [items]);

  function isRowFilled(row: PrepareItem) {
    const d = draft[row.id];
    return !!d && d.qty.trim() !== "" && d.unit.trim() !== "";
  }

  async function markBlockPrepared(block: SoBlock) {
    setSavingBlock(block.so_no);
    try {
      await Promise.all(block.items.map((row) => {
        const d = draft[row.id];
        return fetch(`/api/job-orders/${row.job_order_id}/bom/${row.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actualQty: d.qty, actualUnit: d.unit, materialPrepared: true }),
        });
      }));
      await loadPrepare();
    } finally {
      setSavingBlock(null);
    }
  }

  async function unprepareBlock(block: SoBlock) {
    setSavingBlock(block.so_no);
    try {
      await Promise.all(block.items.map((row) =>
        fetch(`/api/job-orders/${row.job_order_id}/bom/${row.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materialPrepared: false }),
        })
      ));
      await loadPrepare();
    } finally {
      setSavingBlock(null);
    }
  }

  async function setProcurement(item: NotAvailableItem, method: "import" | "local_purchase") {
    await fetch(`/api/job-orders/${item.job_order_id}/bom/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ procurementMethod: method }),
    });
    loadNotAvailable();
  }

  return (
    <>
      <TabNav active="/warehouse-manager" />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Material To Be Prepared ({toPrepare.reduce((n, b) => n + b.items.length, 0)})</h2>
          <button className="btn secondary" onClick={() => setShowRecap((s) => !s)}>{showRecap ? "Hide recap" : "Recap"}</button>
        </div>

        {showRecap && (
          <table className="data-table" style={{ marginBottom: 14, background: "var(--panel-muted)" }}>
            <thead><tr><th>Item Code</th><th>SO Number</th><th>Description</th><th>Total Needed</th></tr></thead>
            <tbody>
              {recap.map((r) => <tr key={`${r.itemNo}::${r.soNo}`}><td>{r.itemNo}</td><td>{r.soNo}</td><td>{r.description}</td><td>{r.totalQty} {r.unit}</td></tr>)}
            </tbody>
          </table>
        )}

        {!items ? <p className="subtle">Loading...</p> : toPrepare.length === 0 ? <p className="subtle">Nothing to prepare right now.</p> : (
          toPrepare.map((block) => {
            const allFilled = block.items.every(isRowFilled);
            return (
              <div key={block.so_no} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <strong>SO {block.so_no}</strong>
                  <span className="subtle">Req: {fmtDate(block.req_date)}</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item Code</th><th>Item Description</th><th>Comment</th><th>Qty</th>
                        <th>Actual Qty</th><th>Actual Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.items.map((row) => (
                        <tr key={row.id}>
                          <td>{row.item_no}</td>
                          <td>{row.description}</td>
                          <td className="subtle">{row.comment || "-"}</td>
                          <td>{row.qty} {row.unit}</td>
                          <td>
                            <input
                              type="number"
                              value={draft[row.id]?.qty ?? ""}
                              onChange={(e) => setDraft((cur) => ({ ...cur, [row.id]: { qty: e.target.value, unit: cur[row.id]?.unit ?? row.unit } }))}
                              style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={draft[row.id]?.unit ?? ""}
                              onChange={(e) => setDraft((cur) => ({ ...cur, [row.id]: { qty: cur[row.id]?.qty ?? "", unit: e.target.value } }))}
                              style={{ width: 60 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 8, textAlign: "right" }}>
                  <button
                    className="btn"
                    disabled={!allFilled || savingBlock === block.so_no}
                    onClick={() => markBlockPrepared(block)}
                  >
                    {savingBlock === block.so_no ? "Saving..." : "Prepared"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <h2>Prepared ({prepared.reduce((n, b) => n + b.items.length, 0)})</h2>
        {!items ? <p className="subtle">Loading...</p> : prepared.length === 0 ? <p className="subtle">Nothing prepared yet.</p> : (
          prepared.map((block) => (
            <div key={block.so_no} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <strong>SO {block.so_no}</strong>
                <button className="btn secondary" disabled={savingBlock === block.so_no} onClick={() => unprepareBlock(block)}>
                  {savingBlock === block.so_no ? "Saving..." : "Edit"}
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Code</th><th>Item Description</th><th>Comment</th><th>Qty</th>
                      <th>Actual Qty</th><th>Actual Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.items.map((row) => (
                      <tr key={row.id}>
                        <td>{row.item_no}</td>
                        <td>{row.description}</td>
                        <td className="subtle">{row.comment || "-"}</td>
                        <td>{row.qty} {row.unit}</td>
                        <td>{row.actual_qty ?? "-"}</td>
                        <td>{row.actual_unit ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>Not Available — Needs Purchase ({notAvailable?.length ?? "..."})</h2>
        {!notAvailable ? <p className="subtle">Loading...</p> : notAvailable.length === 0 ? <p className="subtle">Nothing flagged right now.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>JO Number</th><th>Customer</th><th>Item Code</th><th>Description</th><th>Qty</th><th>Procurement</th></tr></thead>
              <tbody>
                {notAvailable.map((i) => (
                  <tr key={i.id}>
                    <td>{i.jo_number}</td>
                    <td>{i.customer_name}</td>
                    <td>{i.item_no}</td>
                    <td>{i.description}</td>
                    <td>{i.qty} {i.unit}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className={i.procurement_method === "import" ? "btn" : "btn secondary"} style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setProcurement(i, "import")}>Import</button>
                        <button className={i.procurement_method === "local_purchase" ? "btn" : "btn secondary"} style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setProcurement(i, "local_purchase")}>Local Purchase</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
