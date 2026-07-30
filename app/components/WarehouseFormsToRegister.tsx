"use client";

import { useEffect, useState } from "react";
import { usePagedSearch } from "@/app/components/usePagedSearch";
import { SearchBox, Pager } from "@/app/components/Pager";
import Collapsible from "@/app/components/Collapsible";
import { PurchaseForm, fmtDate } from "@/lib/jobOrders";

function formMatches(f: PurchaseForm, term: string): boolean {
  return (
    f.customer_name.toLowerCase().includes(term) ||
    f.po_so_number.toLowerCase().includes(term) ||
    fmtDate(f.request_date).includes(term)
  );
}

// Only Form A requests that came from Warehouse Manager's Not Available ->
// Local Purchase flow, once fully approved - a normal Form A submission
// (even for the same customer/SO) never shows up here.
export default function WarehouseFormsToRegister() {
  const [forms, setForms] = useState<PurchaseForm[] | null>(null);

  useEffect(() => {
    fetch("/api/purchase-forms", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setForms(d.forms ?? []));
  }, []);

  const items = (forms ?? []).filter((f) => f.form_type === "A" && f.status === "approved" && f.source === "warehouse_local_purchase");
  const { search, setSearch, page, setPage, totalPages, pageItems, totalCount } = usePagedSearch(items, formMatches);

  return (
    <Collapsible title="Form A - Inventory To Be Register For Production" count={forms ? items.length : undefined}>
      {!forms ? <p className="subtle">Loading...</p> : items.length === 0 ? <p className="subtle">None yet.</p> : (
        <>
          <SearchBox value={search} onChange={setSearch} />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Customer</th><th>SO Number</th><th>Purpose</th><th>Total</th></tr></thead>
              <tbody>
                {pageItems.map((f) => {
                  const total = f.items.reduce((n, it) => n + Number(it.budget || 0), 0);
                  return (
                    <tr key={f.id}>
                      <td>{fmtDate(f.request_date)}</td>
                      <td>{f.customer_name || <span className="subtle">-</span>}</td>
                      <td>{f.po_so_number || <span className="subtle">-</span>}</td>
                      <td>{f.purpose}</td>
                      <td>Rp {total.toLocaleString("id-ID")}</td>
                    </tr>
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
