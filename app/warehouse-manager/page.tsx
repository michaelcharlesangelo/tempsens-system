"use client";

import { useEffect, useMemo, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
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

function soBlockMatches(block: SoBlock, term: string): boolean {
  return block.so_no.toLowerCase().includes(term) || block.items.some((i) => i.item_no.toLowerCase().includes(term) || fmtDate(i.req_date).includes(term));
}

function notAvailableMatches(item: NotAvailableItem, term: string): boolean {
  return item.item_no.toLowerCase().includes(term) || item.jo_number.toLowerCase().includes(term);
}

export default function WarehouseManagerPage() {
  const [items, setItems] = useState<PrepareItem[] | null>(null);
  const [notAvailable, setNotAvailable] = useState<NotAvailableItem[] | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  // Actual Qty draft only - unit isn't typed by Warehouse Manager, it
  // always follows the BOM row's own unit.
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [savingBlock, setSavingBlock] = useState<string | null>(null);

  async function loadPrepare() {
    const res = await fetch("/api/warehouse/prepare-list", { cache: "no-store" });
    const data = await res.json();
    const rows: PrepareItem[] = data.items ?? [];
    setItems(rows);
    setQtyDraft((cur) => {
      const next = { ...cur };
      for (const row of rows) {
        if (!(row.id in next)) next[row.id] = row.actual_qty != null ? String(row.actual_qty) : "";
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

  const toPrepareAll = useMemo(() => groupBySo((items ?? []).filter((i) => !i.material_prepared)), [items]);
  const preparedAll = useMemo(() => groupBySo((items ?? []).filter((i) => i.material_prepared)), [items]);

  const toPreparePaged = usePagedSearch(toPrepareAll, soBlockMatches);
  const preparedPaged = usePagedSearch(preparedAll, soBlockMatches);
  const notAvailablePaged = usePagedSearch(notAvailable ?? [], notAvailableMatches);
  const toPrepare = toPreparePaged.pageItems;
  const prepared = preparedPaged.pageItems;

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
    return (qtyDraft[row.id] ?? "").trim() !== "";
  }

  async function markBlockPrepared(block: SoBlock) {
    setSavingBlock(block.so_no);
    try {
      await Promise.all(block.items.map((row) =>
        fetch(`/api/job-orders/${row.job_order_id}/bom/${row.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actualQty: qtyDraft[row.id], actualUnit: row.unit, materialPrepared: true }),
        })
      ));
      // One SO block can span multiple job orders - note it on each so
      // Production Manager sees "Material has been prepared" in Comments.
      const jobOrderIds = Array.from(new Set(block.items.map((row) => row.job_order_id)));
      await Promise.all(jobOrderIds.map((joId) =>
        fetch(`/api/job-orders/${joId}/history`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changedBy: "Warehouse Manager", comment: "Material has been prepared." }),
        })
      ));
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
          <h2 style={{ margin: 0 }}>Material To Be Prepared ({toPrepareAll.reduce((n, b) => n + b.items.length, 0)})</h2>
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

        {!items ? <p className="subtle">Loading...</p> : toPrepareAll.length === 0 ? <p className="subtle">Nothing to prepare right now.</p> : (
          <SearchBox value={toPreparePaged.search} onChange={toPreparePaged.setSearch} />
        )}
        {items && toPrepareAll.length > 0 && (
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
                        <th>Actual Qty</th>
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
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="number"
                                value={qtyDraft[row.id] ?? ""}
                                onChange={(e) => setQtyDraft((cur) => ({ ...cur, [row.id]: e.target.value }))}
                                style={{ width: 80 }}
                              />
                              <span className="subtle">{row.unit}</span>
                            </div>
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
        {items && toPrepareAll.length > 0 && (
          <Pager page={toPreparePaged.page} totalPages={toPreparePaged.totalPages} totalCount={toPreparePaged.totalCount} onChange={toPreparePaged.setPage} />
        )}
      </div>

      <div className="card">
        <h2>Not Available — Needs Purchase ({notAvailable?.length ?? "..."})</h2>
        {!notAvailable ? <p className="subtle">Loading...</p> : notAvailable.length === 0 ? <p className="subtle">Nothing flagged right now.</p> : (
          <>
          <SearchBox value={notAvailablePaged.search} onChange={notAvailablePaged.setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>JO Number</th><th>Customer</th><th>Item Code</th><th>Description</th><th>Qty</th><th>Procurement</th></tr></thead>
              <tbody>
                {notAvailablePaged.pageItems.map((i) => (
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
          <Pager page={notAvailablePaged.page} totalPages={notAvailablePaged.totalPages} totalCount={notAvailablePaged.totalCount} onChange={notAvailablePaged.setPage} />
          </>
        )}
      </div>

      <div className="card">
        <h2>Prepared ({preparedAll.reduce((n, b) => n + b.items.length, 0)})</h2>
        {!items ? <p className="subtle">Loading...</p> : preparedAll.length === 0 ? <p className="subtle">Nothing prepared yet.</p> : (
          <SearchBox value={preparedPaged.search} onChange={preparedPaged.setSearch} />
        )}
        {items && preparedAll.length > 0 && (
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
                      <th>Actual Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.items.map((row) => (
                      <tr key={row.id}>
                        <td>{row.item_no}</td>
                        <td>{row.description}</td>
                        <td className="subtle">{row.comment || "-"}</td>
                        <td>{row.qty} {row.unit}</td>
                        <td>{row.actual_qty ?? "-"} {row.actual_unit ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
        {items && preparedAll.length > 0 && (
          <Pager page={preparedPaged.page} totalPages={preparedPaged.totalPages} totalCount={preparedPaged.totalCount} onChange={preparedPaged.setPage} />
        )}
      </div>
    </>
  );
}
