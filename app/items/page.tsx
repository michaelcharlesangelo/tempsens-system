"use client";

import { Fragment, useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";
import { BomTemplate, fmtDate } from "@/lib/jobOrders";

interface CatalogItem { item_no: string; description: string; }

export default function ProductsPage() {
  const [finishedItems, setFinishedItems] = useState<CatalogItem[] | null>(null);
  const [templates, setTemplates] = useState<BomTemplate[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/item-catalog?kind=finished", { cache: "no-store" }).then((r) => r.json()).then((d) => setFinishedItems(d.items ?? []));
    fetch("/api/bom-templates", { cache: "no-store" }).then((r) => r.json()).then((d) => setTemplates(d.templates ?? []));
  }, []);

  async function viewDrawing(itemNo: string) {
    const res = await fetch(`/api/bom-templates/${encodeURIComponent(itemNo)}/drawing`, { cache: "no-store" });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
    else alert(data.error || "No drawing on file for this item.");
  }

  return (
    <>
      <TabNav active="/items" />

      <div className="card">
        <h2>Finished Item Codes</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Every finished-product item code entered on a Job Order (Sales Support's Item Code field).
        </p>
        {!finishedItems ? <p className="subtle">Loading...</p> : finishedItems.length === 0 ? <p className="subtle">None yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Item Code</th><th>Description</th></tr></thead>
            <tbody>
              {finishedItems.map((i) => <tr key={i.item_no}><td>{i.item_no}</td><td>{i.description}</td></tr>)}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Item Code Library (Completed Job Orders)</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Every item code that's been through a completed job order, with its final BOM and drawing — reference
          this for repeat orders instead of starting from scratch.
        </p>
        {!templates ? <p className="subtle">Loading...</p> : templates.length === 0 ? <p className="subtle">Nothing completed yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Item Code</th><th>Description</th><th>Last JO</th><th>Drawing No.</th><th>Saved</th><th></th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <Fragment key={t.item_no}>
                  <tr>
                    <td>{t.item_no}</td>
                    <td>{t.description}</td>
                    <td>{t.source_jo_number}</td>
                    <td>{t.drawing_number || "-"}</td>
                    <td>{fmtDate(t.saved_at)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setExpanded(expanded === t.item_no ? null : t.item_no)}>
                        {expanded === t.item_no ? "Hide BOM" : "View BOM"}
                      </button>{" "}
                      {t.drawing_path && (
                        <button className="btn secondary" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => viewDrawing(t.item_no)}>Drawing</button>
                      )}
                    </td>
                  </tr>
                  {expanded === t.item_no && (
                    <tr>
                      <td colSpan={6} style={{ background: "var(--panel-muted)" }}>
                        {t.bom_snapshot.map((r, i) => (
                          <div key={i} style={{ fontSize: "0.82rem", padding: "3px 0" }}>{r.itemNo} — {r.description} — {r.qty} {r.unit}</div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
