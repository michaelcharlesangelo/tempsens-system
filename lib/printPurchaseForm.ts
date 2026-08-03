import { PurchaseForm, FORM_C_CODES, EXPENSE_CODES, fmtDate, fmtDateTime } from "@/lib/jobOrders";

export type FormType = "A" | "B" | "C" | "D";

// Form A/B items carry description/budget/ppn/supplierName/code/file - Form
// C/D items carry itemCode/description/qty/unit/code/remarks instead.
export const ITEM_SHAPE_FORMS: FormType[] = ["C", "D"];

export const FORM_TYPE_TITLES: Record<FormType, string> = {
  A: "FORM A (INVENTORY/SERVICE)", B: "FORM B (EXPENSE)", C: "FORM C (INVENTORY OUT)", D: "FORM D (STOCK REQUEST)",
};

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Shared by the Form page (printing your own submitted forms) and Warehouse
// Manager's "Form A - Inventory To Be Register" table (printing an approved
// Form A once it's landed there) - same printout either way.
export function printForm(form: PurchaseForm) {
  const isItemShape = ITEM_SHAPE_FORMS.includes(form.form_type);
  const rows = isItemShape
    ? form.items.map((it) => `
      <tr>
        <td>${esc(it.item_code || "-")}</td><td>${esc(it.description)}</td><td>${esc(it.qty)}</td>
        <td>${esc(it.unit)}</td><td>${esc(it.code)}</td><td>${esc(it.remarks || "-")}</td>
      </tr>`).join("")
    : form.items.map((it) => `
      <tr>
        <td>${esc(it.description)}</td><td>Rp ${esc(Number(it.budget).toLocaleString("id-ID"))}</td>
        <td>${it.ppn ? "Yes" : "-"}</td><td>${esc(it.supplier_name)}</td><td>${esc(it.code)}</td>
      </tr>`).join("");
  const total = form.items.reduce((n, it) => n + Number(it.budget || 0), 0);
  const title = FORM_TYPE_TITLES[form.form_type];

  const comments = form.history.filter((h) => h.comment);
  const commentRows = comments.length
    ? comments.map((h) => `<div class="comment"><b>${esc(h.changed_by)}</b> <span class="muted">(${esc(fmtDateTime(h.changed_at))})</span>: ${esc(h.comment)}</div>`).join("")
    : `<div class="muted">None.</div>`;

  const codeLegend = (codes: { code: string; label: string }[], heading: string) => `
    <div class="section-title">${esc(heading)}</div>
    <div class="expense-codes">
      ${codes.map((e) => `<div>${e.code === "J" ? "<b>J)</b> Fixed Asset*<div class=\"muted\" style=\"font-size:8.5px;padding-left:12px;\">*Fixed Asset price is &ge; Rp.1.000.000</div>" : `<b>${esc(e.code)})</b> ${esc(e.label)}`}</div>`).join("")}
    </div>
  `;
  const expenseCodeSection = form.form_type === "B" ? codeLegend(EXPENSE_CODES, "Expense Code")
    : form.form_type === "C" ? codeLegend(FORM_C_CODES, "Code")
    : "";

  const html = `
    <html><head><meta charset="utf-8"><title>${esc(title)} - ${esc(form.name)}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.45; }
      h1 { font-size: 16px; text-align: center; }
      table.info { width: 100%; border-collapse: collapse; margin: 10px 0; table-layout: fixed; }
      table.info td { padding: 4px 6px; vertical-align: top; word-wrap: break-word; }
      table.info td.label { font-weight: bold; width: 25%; white-space: nowrap; }
      table.items { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
      table.items th, table.items td { border: 1px solid #999; padding: 5px 7px; text-align: left; font-size: 10px; line-height: 1.4; word-wrap: break-word; }
      table.items th { background: #eee; }
      .total { text-align: right; font-weight: bold; margin-top: 8px; }
      .section-title { font-weight: bold; text-transform: uppercase; font-size: 10px; margin: 10px 0 4px; border-top: 1px solid #999; padding-top: 6px; }
      .comment { font-size: 10px; padding: 2px 0; }
      .muted { color: #666; }
      .expense-codes { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; font-size: 9.5px; background: #f4f4f4; padding: 8px 10px; border-radius: 4px; }
    </style>
    </head><body onload="window.focus();window.print();">
      <h1>${esc(title)}</h1>
      <table class="info">
        <tr><td class="label">Request Date</td><td>${esc(fmtDate(form.request_date))}</td></tr>
        <tr><td class="label">Name</td><td>${esc(form.name)}</td></tr>
        ${form.customer_name ? `<tr><td class="label">Customer Name</td><td>${esc(form.customer_name)}</td></tr>` : ""}
        ${form.po_so_number ? `<tr><td class="label">PO / SO Number</td><td>${esc(form.po_so_number)}</td></tr>` : ""}
        <tr><td class="label">Purpose</td><td>${esc(form.purpose)}</td></tr>
      </table>

      ${expenseCodeSection}

      <table class="items" style="margin-top:10px">
        <thead><tr>${isItemShape
          ? "<th>Item Code</th><th>Item Description</th><th>Qty</th><th>Unit</th><th>Code</th><th>Remarks</th>"
          : "<th>Item Description</th><th>Budget (IDR)</th><th>PPN</th><th>Supplier Name</th><th>Code</th>"}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${isItemShape ? "" : `<div class="total">Total Budget: Rp ${total.toLocaleString("id-ID")}</div>`}

      <div class="section-title">Comments</div>
      ${commentRows}
    </body></html>
  `;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(blobUrl, "_blank", "width=850,height=1100");
}
