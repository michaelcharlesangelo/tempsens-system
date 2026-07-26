# Tempsens System

Next.js 14 (App Router) + Supabase. Manages Job Orders (JOs) through a
3-layer sequential approval chain, then production, then warehouse.

## Stack & conventions

- **No login** on the 6 workflow tabs (Dashboard, Sales Support, Sales
  Manager, Operational Manager, General Manager, Production Manager,
  Warehouse Manager) and Admin — these simulate each role's POV for now,
  real accounts planned later. Production/QC floor staff have real
  username+password login (`production_accounts` table), not yet wired
  into a scanner UI.
- **Supabase schema workflow**: always run `supabase/reset.sql` then
  `supabase/schema.sql` fresh in the Supabase SQL editor before testing
  schema changes — `reset.sql` drops everything first, so `schema.sql`'s
  `create table` definitions (not `alter table add column if not exists`)
  are the right way to add new columns. This project has had several
  schema changes; always re-run both after pulling changes that touch
  `supabase/schema.sql`.
- **Dates**: use `fmtDate()` (dd/mm/yyyy) or `fmtDateLong()` (dd-Mmm-yyyy)
  from `lib/jobOrders.ts` — never `toLocaleDateString()` directly (defaults
  to US mm/dd/yyyy). The `DateField` component
  (`app/components/DateField.tsx`) is the standard date picker: read-only
  dd-Mmm-yyyy text field with an invisible native `<input type="date">`
  overlay, opened via `showPicker()` on click, plus a small calendar icon.
  Reuse it for any new date field. Known limitation: the native calendar's
  week-start day (Sunday vs Monday) is controlled by browser/OS locale,
  not by the page — can't be fixed with CSS/HTML. A custom-built calendar
  widget would be the only way to force Monday-start; not built yet
  (queued below, low priority).
- **`.form-row` / `.form-sheet` CSS classes** (in `app/globals.css`) render
  the label : value two-column layout used on the JO form and JO detail
  pages. Labels must stay `white-space: nowrap` — a past bug had "Drawing
  Number" wrapping to 2 lines inside a too-narrow column.
- **`JoListTable`** (`app/components/JoListTable.tsx`) is the shared table
  used by Sales Support / Sales Manager / Operational Manager / General
  Manager list views: JO Date, SO Number, Item Code, Sales, Customer, Item
  Description, Qty, Drawing (View), PO (View), optional Progress column,
  Comments (expandable history), and a trailing actions slot
  (`renderActions`) that differs per tab (Edit+Cancel for Sales Support,
  Approve/Reject trigger for the 3 approval tabs). Keep new list views
  consistent with this shape rather than building bespoke tables.
- **Table components must be defined at module scope**, not inside another
  component's render body — a past bug had a table redefined on every
  keystroke of a nearby text input, which remounted the DOM and broke
  focus.
- **`job_order_history`** is the audit trail (status, changed_by, comment,
  changed_at) written on every create/edit/approve/reject/acknowledge. List
  API responses embed it as `history` (oldest first) so every layer can
  see earlier layers' comments. Edits write a diff-based comment (e.g.
  `Edited — Qty: "10" → "15"`) — see `TRACKED_FIELDS` in
  `app/api/job-orders/[id]/edit/route.ts`. `rejectedByFromHistory()` in
  `lib/jobOrders.ts` derives "rejected by X"; `JoListTable` also shows the
  timestamp of the rejecting entry.
- **`sales_person_name` vs `sales_support_name`**: two distinct fields.
  `sales_person_name` is the Sales rep the JO is for (dropdown from
  `sales_people`). `sales_support_name` is a free-text field for whoever
  in Sales Support actually created/edited the JO — this is what shows as
  the "changed_by" on creation/edit history log entries, not the sales rep.
- **`item_catalog.kind`** distinguishes `'finished'` item codes (typed as
  the JO's Item Code by Sales Support, shown on the top-level **Items**
  tab) from `'material'` item codes (typed into a JO's BOM by Production
  Manager, shown under **Admin > Items**). Keep upserts tagging the
  correct `kind`.
- **`job_orders.ready_for_production`** (boolean) drives the Production
  Manager's 3rd list table. Not a `status` value — a separate flag set
  from a checkbox on the JO detail page (top-right of the Material BOM
  card) once BOM/material is confirmed ready.
- **`job_orders.barcode`** is already generated (via `generateShortCode()`
  in `lib/jobOrders.ts`) on every JO at creation — it just wasn't
  displayed anywhere until recently. Render it with `QrImage`
  (`app/components/QrImage.tsx`, wraps the `qrcode` package) — currently
  shown on the Production Manager JO detail page. If it needs to show
  elsewhere (e.g. a printable JO sheet, Sales Support view), reuse
  `QrImage value={jobOrder.barcode}`.
- **`printFileUrl(url, isPdf)`** (`lib/printFile.ts`) opens a dedicated
  print window and auto-triggers `window.print()` on load — one click to
  print, no need to open the file and hunt for the browser's print button.
  The `/api/job-orders/[id]/file` route returns `{ url, isPdf }` — use the
  `isPdf` flag rather than re-detecting file type client-side.
- **`job_order_bom`** has `actual_qty`, `actual_unit`, `comment` columns.
  `comment` is written by Production Manager (per-row note) and visible
  to Warehouse Manager; `actual_qty`/`actual_unit` are filled in by
  Warehouse Manager when preparing material, then reflected back on
  Production Manager's BOM table. The BOM row PATCH route
  (`app/api/job-orders/[id]/bom/[rowId]/route.ts`) accepts `actualQty`,
  `actualUnit`, `comment` in its body — the Warehouse Manager UI
  (`app/warehouse-manager/page.tsx`) uses all three, grouped into per-SO
  blocks with a single Prepared action per block (see Status: done).

## Status: done

Everything through the "23-item batch" (calendar icon, Created By field,
edit file preview + change log, reject/accept log with time, Action
Required titles, Production Manager Print Drawing button + QR code
display + BOM layout/comment/actual-qty columns + Ready for Production
placement, new BOM items sorting to top) is implemented and described
in the conventions above. Also done, from earlier rounds: DateField
click-to-open + min-date enforcement, file preview layout fix, comment
box focus bug, Approve/Reject panel no longer shifts the table, full
comment chain across approval layers, Sales Support Edit/Cancel +
list-shape parity with the approval tabs, Production Manager 3-table
split (Not Yet Acknowledged / Acknowledged / Ready for Production) with
Sales column + Drawing view, Admin/Items split (finished vs material item
codes) with Admin's Items sub-tab made editable. Also done, verified
working: **Warehouse Manager rebuild** (`app/warehouse-manager/page.tsx`)
— BOM prep rows grouped into per-SO blocks, Actual Qty/Unit inputs gating
a single per-block "Prepared" action, a separate Prepared table with an
Edit button to un-prepare a block without losing entered values, and a
recap keyed on (item code, SO) pairs sorted A→Z by item code; **Items tab
redesign** (`app/items/page.tsx`) — single searchable table sourced from
`job_orders` (JO Date, SO Number, Item Code, Description) with a link
into each JO's BOM on Production Manager's detail page; **Admin > Account
tab** (`app/admin/page.tsx`) — Production/QC accounts and Sales people
moved into one "Account" sub-tab (replacing the old standalone "Sales"
tab), with an extensible `positions` list (add/delete) and a position
dropdown per person; **Dashboard "Production" section** — placeholder
table (Item Code, Description, Qty hardcoded to 0) ahead of real
production floor tracking.

## Status: not yet done (queued, in priority order)

1. **Complaints redesign**: list view + "+ New Complaint" button. New
   complaint flow: choose "Tempsens Indonesia" or "Traded Item" first.
   - Tempsens Indonesia: SO Number field with autocomplete (typing
     "SO-12" suggests SO-121/122/123 from existing JOs); picking one
     auto-fills Customer Name + Item Description; user still fills Qty,
     Problem Description, photos/PDF attachment.
   - Traded Item: fully manual — SO Number, Customer Name, Item
     Description, Qty, Problem Description, photos/PDF attachment.
2. Custom calendar widget for Monday-start weeks (low priority — see
   DateField note above for why this needs a custom build, not a CSS fix).

## Older backlog, not yet started

- Printable filled-BOM sheet for the production floor (once BOM/material
  is ready) — separate from the Drawing print button, which is done.
- Production Manager "Finish" button → new "Finished" table.
- Production floor scanner (scan JO → scan station).
- Granular per-check QC (Dimensional / Continuity / I.R. / Temperature,
  each independent OK/NOT OK).
- Production summary reports (date-range + year-to-date by category).
- Confirm the BOM "Not Available" checkbox optimistic-update fix actually
  resolved the "sometimes doesn't stick" symptom — root cause was never
  confirmed, only patched defensively.

Work through these in the order listed unless told otherwise. Before
starting a queued item, briefly state the implementation plan so it can
be confirmed before code is written — past sessions had a couple of
misunderstandings (a comment being shown where it wasn't wanted, a layout
change going further than intended) that a quick plan-check would have
caught early.
