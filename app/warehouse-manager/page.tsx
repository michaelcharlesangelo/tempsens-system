"use client";

import { useEffect, useState } from "react";
import TabNav from "@/app/components/TabNav";

interface NotReadyItem {
  id: string;
  job_order_id: string;
  jo_number: string;
  customer_name: string;
  item_no: string;
  description: string;
  qty: number;
  unit: string;
}

export default function WarehouseManagerPage() {
  const [items, setItems] = useState<NotReadyItem[] | null>(null);

  useEffect(() => {
    fetch("/api/warehouse/not-ready", { cache: "no-store" }).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, []);

  return (
    <>
      <TabNav active="/warehouse-manager" />
      <div className="card">
        <h2>Material not ready — needs purchase</h2>
        <p className="subtle" style={{ marginTop: -6, marginBottom: 12 }}>
          Flagged by Production Manager while filling BOM for each acknowledged job order.
        </p>
        {!items ? <p className="subtle">Loading...</p> : items.length === 0 ? <p className="subtle">Nothing flagged right now.</p> : (
          <table className="data-table">
            <thead><tr><th>JO Number</th><th>Customer</th><th>Item No.</th><th>Description</th><th>Qty</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.jo_number}</td>
                  <td>{it.customer_name}</td>
                  <td>{it.item_no}</td>
                  <td>{it.description}</td>
                  <td>{it.qty} {it.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
