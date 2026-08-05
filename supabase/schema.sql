-- Run this in your Supabase project's SQL Editor.
-- No Supabase Auth used in this phase - the 6 workflow tabs (JO Input,
-- Sales Manager, Operation Manager, GM, Production Manager, Warehouse
-- Manager) are open, no-login POV tabs for now (real accounts planned
-- later). Only Production/QC floor staff get a real login, via a simple
-- username+password table below (no email at all).

-- ---------------------------------------------------------------------------
-- Position types - extensible list of roles assignable to people in
-- Admin > Account (Sales Support, Sales Manager, Production, QC, etc).
-- Seeded with the initial set; more can be added from the admin UI.
-- ---------------------------------------------------------------------------
create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sequence smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into positions (name, sequence) values
  ('Sales Support', 1), ('Sales Manager', 2), ('Operational Manager', 3),
  ('Production Manager', 4), ('Warehouse Manager', 5), ('Production', 6),
  ('QC', 7), ('Sales', 8), ('Engineering', 9), ('General Manager', 10)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Production/QC accounts - the ~4 floor staff who log into the scan/QC
-- page. Simple username+password (hashed in application code, same
-- lightweight approach as the thermocouple pricer's admin password).
-- ---------------------------------------------------------------------------
create table if not exists production_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  full_name text not null,
  position_id uuid references positions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sales teams - groups one Sales Support person with the Sales reps and
-- the single Sales Manager they route to. When that Sales Support person
-- submits a JO (picked on the JO Input form), it's routed to their team's
-- Sales Manager instead of the shared, unfiltered queue. A Sales Support
-- person with no team (or a JO with no submitter picked) stays visible to
-- every Sales Manager - see /sales-manager's "Viewing as" filter.
-- ---------------------------------------------------------------------------
create table if not exists sales_teams (
  id uuid primary key default gen_random_uuid(),
  sales_support_account_id uuid references production_accounts(id) on delete cascade,
  sales_manager_account_id uuid references production_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (sales_support_account_id)
);

create table if not exists sales_team_members (
  team_id uuid not null references sales_teams(id) on delete cascade,
  sales_account_id uuid not null references production_accounts(id) on delete cascade,
  primary key (team_id, sales_account_id)
);

alter table sales_teams enable row level security;
alter table sales_team_members enable row level security;

-- ---------------------------------------------------------------------------
-- Sales people - lightweight reference list so the JO Input tab can
-- attribute "who created this" without needing real accounts yet.
-- ---------------------------------------------------------------------------
create table if not exists sales_people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text not null default '',
  password_hash text not null default '', -- groundwork for later login, not enforced yet
  position_id uuid references positions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Item categories - editable list, seeded with your 6. `sequence` lets
-- them be reordered in the admin UI.
-- ---------------------------------------------------------------------------
create table if not exists item_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_traded boolean not null default false, -- true = Tempsens India traded item, false = we manufacture
  sequence smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into item_categories (name, sequence) values
  ('Thermocouple', 1), ('RTD', 2), ('Thermowell', 3), ('Heater', 4), ('Level Sensor', 5), ('Fittings', 6)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Saved BOM templates - one per finished-product item_no, overwritten with
-- the latest snapshot whenever a job order for that item_no is completed.
-- Lets Production Manager recall "what did we use last time" on a repeat
-- order instead of retyping the whole BOM from scratch.
-- ---------------------------------------------------------------------------
create table if not exists product_bom_templates (
  item_no text primary key,
  description text not null default '',
  bom_snapshot jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now(),
  source_jo_number text not null default '',
  drawing_path text,
  drawing_number text not null default ''
);

-- ---------------------------------------------------------------------------
-- Item catalog - grows automatically as BOM items are entered (item no. ->
-- description auto-fill for next time).
-- ---------------------------------------------------------------------------
create table if not exists item_catalog (
  item_no text primary key,
  description text not null default '',
  category text,
  kind text not null default 'material' check (kind in ('finished','material')), -- 'finished' = JO item code (Items tab), 'material' = BOM component (Admin > Items)
  unit text not null default 'pcs', -- material default unit, autofills the BOM row's unit when item code is picked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Back Office - admin-managed staff records with a position, distinct from
-- Production/QC (no email) and Sales Person (may not have a position).
-- ---------------------------------------------------------------------------
create table if not exists back_office (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null default '',
  password_hash text not null default '',
  position_id uuid references positions(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Station codes (QR) - the physical process stations, in a fixed printable
-- ORDER (so "progress" can be shown as "step 5 of 10"). Reorderable.
-- ---------------------------------------------------------------------------
create table if not exists station_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  station_name text not null,
  description text not null default '',
  parameters text[] not null default '{}', -- target specs the production floor checks against, e.g. "200degC for 60min"
  sequence smallint not null default 0, -- display/process order, editable
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Job orders - core entity.
--
-- Approval: 3-layer sequential, routed by which TAB acts (no per-user
-- identity yet for these roles) - current_approval_layer 1/2/3 = Sales
-- Manager / Operational Manager / GM tab.
--
-- po_attachment_path is restricted at the API level (only served to the
-- Sales Manager / Operational Manager / GM / JO Input tabs, never to
-- Production/Warehouse).
-- ---------------------------------------------------------------------------
create table if not exists job_orders (
  id uuid primary key default gen_random_uuid(),
  jo_number text not null unique,

  jo_date date not null default current_date,
  customer_name text not null,
  so_no text not null default '',
  item_category text not null default '',
  item_description text not null default '',
  drawing_path text, -- uploaded PDF/JPG, private storage path
  drawing_filename text, -- original uploaded file name, for display (drawing_path is a generated storage path)
  drawing_number text not null default '', -- reference number, separate from the uploaded file
  quantity numeric not null default 1,
  item_no text not null default '',
  sales_person_name text not null default '',
  sales_support_name text not null default '', -- who at Sales Support actually created the JO (distinct from the Sales rep)
  -- Which specific Sales Support person submitted this (picked on the JO
  -- Input form) - drives team-based routing to that person's Sales
  -- Manager. Null for JOs created before this existed, or from tabs other
  -- than Sales Support - those fall back to visible-to-everyone.
  sales_support_account_id uuid references production_accounts(id) on delete set null,
  deadline date,
  urgent boolean not null default false,
  po_attachment_path text, -- restricted visibility, see above
  po_attachment_filename text, -- original uploaded file name, for display

  serial_numbers text[] not null default '{}', -- one entry per unit (qty), filled by Production Manager
  finish_estimation date, -- filled by Production Manager at acknowledge
  finish_date timestamptz, -- auto-set when production clicks Finish

  current_station_name text, -- last station scanned on the Production floor page (display-only, not part of the status state machine)
  ready_for_production boolean not null default false, -- ticked by Production Manager once BOM/material is confirmed ready

  costing_done boolean not null default false, -- ticked by Sales Support Supervisor once costing is finished (external system); irreversible in the UI

  barcode text unique,

  status text not null default 'draft'
    check (status in (
      'draft','pending_approval','approved','rejected',
      'acknowledged','in_progress','qc','completed','cancelled'
    )),
  current_approval_layer smallint,

  created_at timestamptz not null default now(),
  approved_at timestamptz,
  acknowledged_at timestamptz
);

create table if not exists job_order_history (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  status text not null,
  changed_by text not null default '', -- tab/person name, free text (no auth yet for these roles)
  comment text not null default '',
  changed_at timestamptz not null default now()
);

-- Material BOM - filled in by Production Manager during Acknowledge, as a
-- spreadsheet-style grid submitted all at once.
create table if not exists job_order_bom (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  item_no text not null,
  description text not null default '',
  qty numeric not null default 0,
  unit text not null default 'pcs',
  material_ready boolean not null default true, -- false = "not available", needs purchase
  material_prepared boolean not null default false, -- warehouse's prep checklist, only relevant when material_ready = true
  actual_qty numeric, -- filled in by Warehouse Manager when preparing material
  actual_unit text,
  comment text not null default '', -- Production Manager's note per BOM row, visible to Warehouse Manager
  procurement_method text check (procurement_method in ('import','local_purchase')), -- set by warehouse for not-available items
  created_at timestamptz not null default now()
);

-- Production floor scan log - drives step tracking. Production login is
-- bypassed for now (scanned_by_label carries a plain text label instead);
-- scanned_by stays for when real per-account login is wired in later.
create table if not exists production_logs (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  station_id uuid not null references station_codes(id),
  scanned_by uuid references production_accounts(id), -- null while Production login is bypassed (see CLAUDE.md)
  scanned_by_label text, -- e.g. "Production" - used in place of a real account while login is bypassed
  results jsonb not null default '[]'::jsonb, -- [{parameter, actual, unit}] - one scan covers every parameter for every unit (unit = 0-based index into quantity/serial_numbers) at that station
  scanned_at timestamptz not null default now()
);

-- QC records - 4 independent checks, each submitted separately (possibly
-- by different people at different times), each with a free-text value
-- and an OK/NOT OK result.
create table if not exists qc_checks (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  check_type text not null check (check_type in ('dimensional','continuity_resistance','ir_check','temperature')),
  result text not null check (result in ('ok','not_ok')),
  value_text text not null default '', -- free-fill value, e.g. "113 Ohm", "-0.2 at 100degC"
  performed_by uuid not null references production_accounts(id),
  performed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Production complaints - two implicit groups via item_categories.is_traded
-- (we-manufacture vs Tempsens-India-traded), filled in by Sales.
-- ---------------------------------------------------------------------------
create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  so_no text not null default '',
  item_description text not null default '',
  quantity numeric not null default 1,
  is_traded boolean not null default false, -- which of the 2 tables this belongs in
  problem_description text not null default '',
  photo_paths text[] not null default '{}', -- private storage paths, multiple files
  status text not null default 'not_done' check (status in ('not_done','in_progress','done')),
  suggested_action text not null default '', -- filled by QC Manager
  submitted_by text not null default '', -- sales person name, free text
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  archived boolean not null default false,
  -- Engineering's own photos (e.g. proof of fix) - kept separate from the
  -- original submitter's photo_paths above, shown under its own "Photos
  -- Update" column instead of merged into the initial submission's photos.
  engineering_photo_paths text[] not null default '{}'
);

-- Engineering's status/progress log (app/engineering) - separate page from
-- the main Complaints table, same pattern as po_out_history/Exim: each
-- entry pairs a status with a free-text comment, attributed and timestamped.
create table if not exists complaint_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  changed_by text not null default '',
  comment text not null default '',
  status text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_complaint_history_complaint on complaint_history(complaint_id);
alter table complaint_history enable row level security;

-- ---------------------------------------------------------------------------
-- Purchase request forms - Form A (Inventory/Service), Form B (Expense),
-- Form C (Inventory Out), Form D (Stock Request), based on the paper
-- "Pengajuan Pembelian Barang" forms. One header row with N line items.
-- A/B carry budget/supplier/code/attachment per item; C/D carry
-- item_code/qty/unit/remarks per item instead (see purchase_form_items).
-- ---------------------------------------------------------------------------
create table if not exists purchase_forms (
  id uuid primary key default gen_random_uuid(),
  form_type text not null check (form_type in ('A','B','C','D')),
  request_date date not null default current_date,
  name text not null default '',
  customer_name text not null default '', -- Form A only, shown blank for Form B
  po_so_number text not null default '', -- Form A only
  purpose text not null default '',
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected','cancelled')),
  -- 2-layer approval: 1 = Operational Manager, 2 = General Manager.
  -- Starts at 2 when submitted_by = 'Operational Manager' (can't approve
  -- their own submission at layer 1); everyone else, including General
  -- Manager, starts at 1 and still needs their own real GM approval at
  -- layer 2 - submitting doesn't auto-approve.
  current_approval_layer smallint,
  submitted_by text not null default '', -- role tag, e.g. "Sales Support", "Warehouse Manager"
  -- Tags a form created via Warehouse Manager's Not Available -> Local
  -- Purchase flow specifically, so only THAT path's approved forms show
  -- up on Sales Support Supervisor's dedicated table - a normal form
  -- submission (even for the same customer/SO) never does.
  source text,
  -- Only set for the Not Available -> Local Purchase flow - links the
  -- approved Form A back to the exact BOM row it was raised for, so Sales
  -- Support Supervisor's item-code registration can update that specific
  -- row (not just guess by SO number, which can have several N/A rows).
  bom_row_id uuid references job_order_bom(id) on delete set null,
  job_order_id uuid references job_orders(id) on delete set null,
  -- True once Sales Support Supervisor has typed in the real item code and
  -- saved - at that point the form drops off their registration table.
  registered boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists purchase_form_items (
  id uuid primary key default gen_random_uuid(),
  purchase_form_id uuid not null references purchase_forms(id) on delete cascade,
  seq smallint not null default 0,
  description text not null default '', -- Form A/B: Item Description - Form C/D: Item Description too
  budget numeric not null default 0, -- Form A/B only
  ppn boolean not null default false, -- Form A/B only
  supplier_name text not null default '', -- Form A/B only
  code text not null default '', -- Form A: INVENTORY/SERVICE - Form B: letter A-M (EXPENSE_CODES) - Form C: letter A-H (FORM_C_CODES) - Form D: INVENTORY/CONSUMABLE
  attachment_path text, -- Form A/B only
  attachment_filename text, -- Form A/B only
  item_code text not null default '', -- Form C/D only
  qty numeric not null default 0, -- Form C/D only
  unit text not null default '', -- Form C/D only
  remarks text not null default '', -- Form C/D only
  created_at timestamptz not null default now()
);

-- Audit trail for purchase forms, mirroring job_order_history.
create table if not exists purchase_form_history (
  id uuid primary key default gen_random_uuid(),
  purchase_form_id uuid not null references purchase_forms(id) on delete cascade,
  status text not null default '',
  changed_by text not null default '',
  comment text not null default '',
  changed_at timestamptz not null default now()
);

create index if not exists idx_purchase_form_items_form on purchase_form_items(purchase_form_id);
create index if not exists idx_purchase_form_history_form on purchase_form_history(purchase_form_id);
alter table purchase_forms enable row level security;
alter table purchase_form_items enable row level security;
alter table purchase_form_history enable row level security;

-- ---------------------------------------------------------------------------
-- PO Out - purchase orders placed with suppliers, filled in by Sales
-- Support. Simple record + status/comment log, no approval chain.
-- ---------------------------------------------------------------------------
create table if not exists po_out (
  id uuid primary key default gen_random_uuid(),
  po_date date not null default current_date,
  deadline date,
  urgent boolean not null default false,
  po_number text not null default '',
  item_code text not null default '',
  sales text not null default '',
  customer_name text not null default '',
  item_description text not null default '',
  qty numeric not null default 0,
  unit text not null default 'pcs',
  unit_price numeric not null default 0,
  unit_price_currency text not null default 'IDR' check (unit_price_currency in ('IDR','USD','SGD','EUR','CNY','JPY')),
  total_price numeric not null default 0, -- qty * unit_price, computed client-side on save
  unit_selling_price numeric not null default 0,
  unit_selling_price_currency text not null default 'IDR' check (unit_selling_price_currency in ('IDR','USD','SGD','EUR','CNY','JPY')),
  supplier text not null default '',
  status text not null default 'production' check (status in ('production','shipment','arrived')),
  -- Export Import's own operational fields (app/exim) - not filled in by
  -- Sales Support, and not touched by the PO Out Recap entry form/edit.
  oc text not null default '', -- Order Confirmation reference
  origin text not null default '', -- country/port of origin
  shipment text not null default '', -- free-text shipment number tie-in to the Shipment Plan table
  via text check (via in ('AIR','SEA')),
  box text not null default '', -- which packing box(es) this line item was packed into
  hs_code text not null default '', -- free-text, matched against hs_codes.code - BM% is looked up from there, not stored here
  submitted_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists po_out_history (
  id uuid primary key default gen_random_uuid(),
  po_out_id uuid not null references po_out(id) on delete cascade,
  changed_by text not null default '',
  comment text not null default '',
  status text, -- set when this entry represents a status-slider change rather than a free-text comment
  changed_at timestamptz not null default now()
);

create index if not exists idx_po_out_history_po on po_out_history(po_out_id);
alter table po_out enable row level security;
alter table po_out_history enable row level security;

-- Supplier directory backing the PO Out supplier dropdown and its 7-tab
-- Excel-style filter bar. tab_category is one of 7 fixed groups; suppliers
-- can be added inline from the PO Out form (default OTHER_IMPORT) or
-- managed from Settings > Supplier.
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tab_category text not null default 'OTHER_IMPORT'
    check (tab_category in ('TEMPSENS','ALLEIMA','OTHER_INDIA','OTHER_IMPORT','LOCAL','EXPORT','STOCK_TAJ')),
  created_at timestamptz not null default now()
);

alter table suppliers enable row level security;

insert into suppliers (name, tab_category) values
  ('TEMPSENS INDIA', 'TEMPSENS'), ('TEMPSENS CABLE', 'TEMPSENS'), ('TEMPSENS HEATER', 'TEMPSENS'), ('TEMPSENS GERMANY', 'TEMPSENS'),
  ('ALLEIMA', 'ALLEIMA'),
  ('PYROSENS', 'OTHER_INDIA'), ('CODINA', 'OTHER_INDIA'),
  ('PMJ', 'OTHER_IMPORT'), ('SAFINA', 'OTHER_IMPORT'), ('HUAJING', 'OTHER_IMPORT'), ('SUPER SYSTEMS', 'OTHER_IMPORT'),
  ('OHKURA', 'OTHER_IMPORT'), ('GONGTAO', 'OTHER_IMPORT'), ('HIGHLION', 'OTHER_IMPORT'), ('LEADSHINE', 'OTHER_IMPORT'), ('SINRI', 'OTHER_IMPORT'),
  ('LOCAL', 'LOCAL'),
  ('EXPORT', 'EXPORT'),
  ('STOCK TAJ', 'STOCK_TAJ')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Shipment Plan - Export Import's own table (app/exim), independent of any
-- single PO Out row (a shipment can cover several POs) - draft-first, so
-- every field is optional except a shipment number.
-- ---------------------------------------------------------------------------
create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_number text not null default '',
  supplier text not null default '',
  shipment_via text not null default '',
  incoterms text not null default '',
  invoice text not null default '',
  awb_bl text not null default '',
  atd date,
  eta_jkt date,
  sppb text not null default '',
  delivery text not null default '',
  awb_bl_file_path text,
  awb_bl_file_name text,
  photo_paths text[] not null default '{}',
  submitted_by text not null default '',
  -- Plan -> Shipment -> Arrived, mirroring PO Out's own 3-stage status but
  -- one level up (per shipment, not per PO Out row) - see
  -- /api/shipments/[id]/status. Moving to Shipment cascades every PO Out
  -- row still at 'production' on this shipment to 'shipment'; moving to
  -- Arrived cascades every PO Out row on this shipment to 'arrived'. Any
  -- comment entered alongside a status change (or on its own, without
  -- changing status) is written to every PO Out row's history on this
  -- shipment, e.g. a "Shipment delayed" note.
  status text not null default 'plan' check (status in ('plan','shipment','arrived')),
  created_at timestamptz not null default now()
);

alter table shipments enable row level security;

-- ---------------------------------------------------------------------------
-- HS Code registry (app/hs-codes) - code + description + BM (import duty %).
-- A code typed directly into a PO Out row's HS Code cell auto-creates a bare
-- entry here (blank description, BM 0) via upsert so the recap table always
-- has something to look up against; the registry page is where the
-- description/BM actually get filled in afterward.
-- ---------------------------------------------------------------------------
create table if not exists hs_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  bm numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table hs_codes enable row level security;

-- ---------------------------------------------------------------------------
-- Packing list boxes for a shipment (app/exim shipment recap) - m3 is
-- computed client-side from length*width*height/1,000,000 and stored
-- alongside so it doesn't need recomputing on every read.
-- ---------------------------------------------------------------------------
create table if not exists shipment_packing_boxes (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  box_no text not null default '',
  length_cm numeric not null default 0,
  width_cm numeric not null default 0,
  height_cm numeric not null default 0,
  gross_weight_kg numeric not null default 0,
  net_weight_kg numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table shipment_packing_boxes enable row level security;

-- ---------------------------------------------------------------------------
-- Fabrication items (app/production-manager) - a lighter-weight parallel
-- workflow to the main BOM: pieces sent to the machine shop. job_order_id is
-- nullable - rows added from inside a JO's detail page (Fabrication table
-- under Material BOM) inherit jo_date/so_no from that JO; rows added via the
-- top-level "+New Fabrication JO" button on the list page are typed in
-- manually and stand alone. Both surface in the same top-level Fabrication
-- Job Order table - status flips 'production' -> 'finish' via the same
-- Finish tickbox from either place.
-- ---------------------------------------------------------------------------
create table if not exists fabrication_items (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid references job_orders(id) on delete cascade,
  jo_date date not null default current_date,
  so_no text not null default '',
  description text not null default '',
  qty numeric not null default 0,
  unit text not null default 'pcs',
  status text not null default 'production' check (status in ('production','finish')),
  comment text not null default '', -- note to Machine Shop
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table fabrication_items enable row level security;

create index if not exists idx_job_orders_status on job_orders(status);
create index if not exists idx_job_order_bom_job on job_order_bom(job_order_id);
create index if not exists idx_production_logs_job on production_logs(job_order_id);
create index if not exists idx_qc_checks_job on qc_checks(job_order_id);
create index if not exists idx_complaints_traded on complaints(is_traded);
create index if not exists idx_fabrication_items_job on fabrication_items(job_order_id);
create index if not exists idx_shipment_packing_boxes_shipment on shipment_packing_boxes(shipment_id);

alter table positions enable row level security;
alter table production_accounts enable row level security;
alter table sales_people enable row level security;
alter table back_office enable row level security;
alter table item_categories enable row level security;
alter table item_catalog enable row level security;
alter table product_bom_templates enable row level security;
alter table station_codes enable row level security;
alter table job_orders enable row level security;
alter table job_order_history enable row level security;
alter table job_order_bom enable row level security;
alter table production_logs enable row level security;
alter table qc_checks enable row level security;
alter table complaints enable row level security;

-- ---------------------------------------------------------------------------
-- Projects (app/project-manager, app/project) - Project Manager's own
-- tracked work items, each optionally tied to a PO. Two-stage status
-- (ongoing/finished, not the approval-chain kind) with its own audit trail,
-- plus separate budgeted-vs-actual costing broken into line items.
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null default '',
  customer_name text not null default '',
  project_description text not null default '',
  -- False for a project with no PO of its own ("Not PO" on the form) -
  -- po_date/po_number/po_value stay blank in that case.
  has_po boolean not null default true,
  po_date date,
  po_number text not null default '',
  po_value numeric not null default 0,
  po_value_currency text not null default 'IDR' check (po_value_currency in ('IDR','USD','SGD','EUR','CNY','JPY')),
  sales text not null default '',
  status text not null default 'ongoing' check (status in ('ongoing','finished')),
  submitted_by text not null default '',
  created_at timestamptz not null default now()
);

-- Budgeted line items (planned) - shown behind the recap's "Budgeting"
-- total, same shape as costing below but without a PO Code (a budget line
-- isn't tied to any specific purchase yet).
create table if not exists project_budget_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  item_description text not null default '',
  supplier text not null default '',
  qty numeric not null default 0,
  unit text not null default 'pcs',
  unit_price numeric not null default 0,
  unit_price_currency text not null default 'IDR' check (unit_price_currency in ('IDR','USD','SGD','EUR','CNY','JPY')),
  total_price numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Actual cost/payment line items (real spend) - shown behind the recap's
-- "Cost" total. Addable from the Project Manager page or from anyone's
-- read-only Project tab via the same Status -> Cost flow.
create table if not exists project_cost_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  po_code text not null default '',
  item_description text not null default '',
  supplier text not null default '',
  qty numeric not null default 0,
  unit text not null default 'pcs',
  unit_price numeric not null default 0,
  unit_price_currency text not null default 'IDR' check (unit_price_currency in ('IDR','USD','SGD','EUR','CNY','JPY')),
  total_price numeric not null default 0,
  submitted_by text not null default '',
  created_at timestamptz not null default now()
);

-- Audit trail for the Status panel's Ongoing/Finished slider + short
-- "Progress" recap comment - mirrors job_order_history/po_out_history.
-- Anyone can add an entry from the Project tab; only Project Manager can
-- edit/delete one (from their own page).
create table if not exists project_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null check (status in ('ongoing','finished')),
  comment text not null default '',
  changed_by text not null default '',
  changed_at timestamptz not null default now()
);

-- The Status panel's "Report" floating form - free-text report + next
-- step, plus attached photos. Separate from project_progress since a
-- report is a bigger, occasional write-up rather than a quick status note.
create table if not exists project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Ties a report to the specific progress update it was filed alongside,
  -- so the Status panel's Progress History can show a "Report" button on
  -- that exact entry instead of a separate project-wide list. Nullable -
  -- older rows (or a report saved outside a progress save) may not have one.
  progress_id uuid references project_progress(id) on delete set null,
  report text not null default '',
  next_step text not null default '',
  photo_paths text[] not null default '{}',
  submitted_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_project_budget_items_project on project_budget_items(project_id);
create index if not exists idx_project_cost_items_project on project_cost_items(project_id);
create index if not exists idx_project_progress_project on project_progress(project_id);
create index if not exists idx_project_reports_project on project_reports(project_id);

alter table projects enable row level security;
alter table project_budget_items enable row level security;
alter table project_cost_items enable row level security;
alter table project_progress enable row level security;
alter table project_reports enable row level security;

-- ---------------------------------------------------------------------------
-- Private storage bucket for drawings, PO attachments, and complaint
-- photos. Served only through app API routes that check visibility rules,
-- never via a public Supabase Storage URL.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tempsens-files', 'tempsens-files', false)
on conflict (id) do nothing;

-- Force PostgREST to pick up the schema immediately rather than waiting
-- for its next automatic reload.
notify pgrst, 'reload schema';
