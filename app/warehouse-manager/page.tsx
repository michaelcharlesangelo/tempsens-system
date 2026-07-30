"use client";

import { useEffect, useMemo, useState } from "react";
import Collapsible from "@/app/components/Collapsible";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import { fmtDate } from "@/lib/jobOrders";

interface PrepareItem {
  id: string; job_order_id: string; jo_number: string; so_no: string; req_date: string | null;
  item_no: string; description: string; qty: number; unit: string; comment: string;
  material_prepared: boolean; actual_qty: number | null; actual_unit: string | null; material_ready: boolean;
}
interface NotAvailableItem {
  id: string; job_order_id: string; jo_number: string; customer_name: string; so_no: string; req_date: string | null;
  item_no: string; description: string; qty: number; unit: string; comment: string;
  material_prepared: boolean; actual_qty: number | null; actual_unit: string | null; procurement_method: string | null;
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
  // SOs unticked here are left out of the recap - default is everything
  // ticked (nothing in this set) so the recap doesn't start out empty.
  const [recapExcludedSo, setRecapExcludedSo] = useState<Set<string>>(new Set());
  // Actual Qty draft only - unit isn't typed by Warehouse Manager, it
  // always follows the BOM row's own unit.
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [savingBlock, setSavingBlock] = useState<string | null>(null);

  async function loadPrepare() {
    const res = await fetch("/api/warehouse/prepare-list", { cache: "no-store" });
    const data = await res.json();
    const rows: PrepareItem[] = (data.items ?? []).map((r: PrepareItem) => ({ ...r, material_ready: true }));
    setItems(rows);
    seedQtyDraft(rows);
  }
  async function loadNotAvailable() {
    const res = await fetch("/api/warehouse/not-ready", { cache: "no-store" });
    const data = await res.json();
    const rows: NotAvailableItem[] = data.items ?? [];
    setNotAvailable(rows);
    seedQtyDraft(rows);
  }
  function seedQtyDraft(rows: { id: string; actual_qty: number | null }[]) {
    setQtyDraft((cur) => {
      const next = { ...cur };
      for (const row of rows) {
        if (!(row.id in next)) next[row.id] = row.actual_qty != null ? String(row.actual_qty) : "";
      }
      return next;
    });
  }

  useEffect(() => { loadPrepare(); loadNotAvailable(); }, []);

  // Not Available rows show here too (not just in their own table below) so
  // Warehouse Manager sees demand coming before Sales Support Supervisor has
  // even registered an item code for it - see material_ready per-row flag.
  const toPrepareAll = useMemo(() => {
    const ready: PrepareItem[] = (items ?? []).filter((i) => !i.material_prepared);
    const pending: PrepareItem[] = (notAvailable ?? [])
      .filter((i) => !i.material_prepared)
      .map((i) => ({
        id: i.id, job_order_id: i.job_order_id, jo_number: i.jo_number, so_no: i.so_no, req_date: i.req_date,
        item_no: i.item_no, description: i.description, qty: i.qty, unit: i.unit, comment: i.comment,
        material_prepared: i.material_prepared, actual_qty: i.actual_qty, actual_unit: i.actual_unit, material_ready: false,
      }));
    return groupBySo([...ready, ...pending]);
  }, [items, notAvailable]);
  const preparedAll = useMemo(() => groupBySo((items ?? []).filter((i) => i.material_prepared)), [items]);

  const toPreparePaged = usePagedSearch(toPrepareAll, soBlockMatches);
  const preparedPaged = usePagedSearch(preparedAll, soBlockMatches);
  const notAvailablePaged = usePagedSearch(notAvailable ?? [], notAvailableMatches);
  const toPrepare = toPreparePaged.pageItems;
  const prepared = preparedPaged.pageItems;

  function toggleRecapSo(soNo: string) {
    setRecapExcludedSo((prev) => {
      const next = new Set(prev);
      if (next.has(soNo)) next.delete(soNo); else next.add(soNo);
      return next;
    });
  }

  const recap = useMemo(() => {
    const map = new Map<string, { itemNo: string; soNo: string; description: string; totalQty: number; unit: string; comments: string[] }>();
    toPrepareAll.forEach((block) => {
      if (recapExcludedSo.has(block.so_no)) return;
      block.items.forEach((i) => {
        const key = `${i.item_no}::${i.so_no}`;
        const existing = map.get(key);
        if (existing) {
          existing.totalQty += i.qty;
          if (i.comment && !existing.comments.includes(i.comment)) existing.comments.push(i.comment);
        } else {
          map.set(key, { itemNo: i.item_no, soNo: i.so_no, description: i.description, totalQty: i.qty, unit: i.unit, comments: i.comment ? [i.comment] : [] });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.itemNo.localeCompare(b.itemNo) || a.soNo.localeCompare(b.soNo));
  }, [toPrepareAll, recapExcludedSo]);

  function isRowFilled(row: PrepareItem) {
    return (qtyDraft[row.id] ?? "").trim() !== "";
  }

  function printRecap() {
    // Blank "Actual" column on purpose - filled in by hand after printing,
    // once the physical quantity gathered is known.
    const rows = recap.map((r) => `
      <tr><td>${r.itemNo}</td><td>${r.soNo}</td><td>${r.description}</td><td>${r.totalQty} ${r.unit}</td><td></td><td>${r.comments.join("; ") || "-"}</td></tr>
    `).join("");
    const html = `
      <html><head><meta charset="utf-8"><title>Material Recap</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 16px; line-height: 1.4; }
        h1 { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; }
        th { background: #eee; }
      </style>
      </head><body onload="window.focus();window.print();">
        <h1>Material To Be Prepared — Recap</h1>
        <table>
          <thead><tr><th>Item Code</th><th>SO Number</th><th>Description</th><th>Total Needed</th><th>Actual</th><th>Comment</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">Nothing to prepare right now.</td></tr>`}</tbody>
        </table>
      </body></html>
    `;
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(blobUrl, "_blank", "width=750,height=1000");
  }

  async function markBlockPrepared(block: SoBlock) {
    if (!confirm(`Mark SO ${block.so_no} as prepared? This can't be edited afterward.`)) return;
    setSavingBlock(block.so_no);
    try {
      await Promise.all(block.items.map((row) =>
        fetch(`/api/job-orders/${row.job_order_id}/bom/${row.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          // materialReady: true too, in case this row started out as a Not
          // Available/"Pending item code" row - once it's actually prepared
          // it's resolved, so it should land in Prepared (sourced from
          // ready=true rows) and drop off Not Available for good.
          body: JSON.stringify({ actualQty: qtyDraft[row.id], actualUnit: row.unit, materialReady: true, materialPrepared: true }),
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
      await Promise.all([loadPrepare(), loadNotAvailable()]);
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

  // Local Purchase kicks off a Form A request straight from here, prefilled
  // and tagged so the approved result lands on Sales Support Supervisor's
  // dedicated table - only for this exact path, not a normal Form submission.
  async function goLocalPurchase(item: NotAvailableItem) {
    await setProcurement(item, "local_purchase");
    const params = new URLSearchParams({
      source: "warehouse_local_purchase",
      name: "Warehouse Manager",
      customerName: item.customer_name,
      poSoNumber: item.so_no,
      bomRowId: item.id,
      jobOrderId: item.job_order_id,
    });
    window.location.href = `/form?${params.toString()}`;
  }

  return (
    <>

      <Collapsible
        title="Material To Be Prepared"
        count={toPrepareAll.reduce((n, b) => n + b.items.length, 0)}
        defaultOpen
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn secondary" onClick={printRecap}>Print recap</button>
            <button className="btn secondary" onClick={() => setShowRecap((s) => !s)}>{showRecap ? "Hide recap" : "Recap"}</button>
          </div>
        }
      >
        {showRecap && (
          <table className="data-table" style={{ marginBottom: 14, background: "var(--panel-muted)" }}>
            <thead><tr><th>Item Code</th><th>SO Number</th><th>Description</th><th>Total Needed</th><th>Comment</th></tr></thead>
            <tbody>
              {recap.length === 0 ? (
                <tr><td colSpan={5} className="subtle">Nothing ticked for recap.</td></tr>
              ) : (
                recap.map((r) => <tr key={`${r.itemNo}::${r.soNo}`}><td>{r.itemNo}</td><td>{r.soNo}</td><td>{r.description}</td><td>{r.totalQty} {r.unit}</td><td className="subtle">{r.comments.join("; ") || "-"}</td></tr>)
              )}
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
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={!recapExcludedSo.has(block.so_no)} onChange={() => toggleRecapSo(block.so_no)} title="Include in recap" />
                    <strong>SO {block.so_no}</strong>
                  </label>
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
                          <td>
                            {row.item_no || <span className="subtle">-</span>}
                            {!row.material_ready && <span className="pill pill-pending_approval" style={{ marginLeft: 6, fontSize: "0.6rem" }}>Pending item code</span>}
                          </td>
                          <td>{row.description}</td>
                          <td className="subtle">{row.comment || "-"}</td>
                          <td>{row.qty} {row.unit}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="number"
                                value={qtyDraft[row.id] ?? ""}
                                onChange={(e) => setQtyDraft((cur) => ({ ...cur, [row.id]: e.target.value }))}
                                disabled={!row.item_no}
                                placeholder={!row.item_no ? "Awaiting item code" : undefined}
                                style={{ width: 90, padding: "5px 8px", fontSize: "0.85rem" }}
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
      </Collapsible>

      <Collapsible title="Not Available — Needs Purchase" count={notAvailable?.length} defaultOpen>
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
                      {i.item_no ? (
                        // Item code registered - procurement is settled, so
                        // the choice locks in (no more accidental re-clicks)
                        // and reads as resolved rather than an open action.
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            className="btn" disabled
                            style={{ fontSize: "0.75rem", padding: "4px 8px", background: "var(--good)", borderColor: "var(--good)", opacity: 1, cursor: "default" }}
                          >
                            {i.procurement_method === "import" ? "Import" : "Local Purchase"}
                          </button>
                          <span className="pill pill-approved">Approved</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className={i.procurement_method === "local_purchase" ? "btn" : "btn secondary"} style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => goLocalPurchase(i)}>Local Purchase</button>
                          <button className={i.procurement_method === "import" ? "btn" : "btn secondary"} style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setProcurement(i, "import")}>Import</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={notAvailablePaged.page} totalPages={notAvailablePaged.totalPages} totalCount={notAvailablePaged.totalCount} onChange={notAvailablePaged.setPage} />
          </>
        )}
      </Collapsible>

      <Collapsible title="Prepared" count={preparedAll.reduce((n, b) => n + b.items.length, 0)}>
        {!items ? <p className="subtle">Loading...</p> : preparedAll.length === 0 ? <p className="subtle">Nothing prepared yet.</p> : (
          <SearchBox value={preparedPaged.search} onChange={preparedPaged.setSearch} />
        )}
        {items && preparedAll.length > 0 && (
          prepared.map((block) => (
            <div key={block.so_no} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <strong>SO {block.so_no}</strong>
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
      </Collapsible>
    </>
  );
}
