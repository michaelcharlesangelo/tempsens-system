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
  results jsonb not null default '[]'::jsonb, -- [{parameter, actual}] - one scan covers every parameter configured for that station
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
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Purchase request forms - Form A (Inventory/Service) and Form B (Expense),
-- based on the paper "Pengajuan Pembelian Barang" forms. One header row
-- with N line items each carrying its own budget/supplier/code/attachment.
-- ---------------------------------------------------------------------------
create table if not exists purchase_forms (
  id uuid primary key default gen_random_uuid(),
  form_type text not null check (form_type in ('A','B')),
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
  created_at timestamptz not null default now()
);

create table if not exists purchase_form_items (
  id uuid primary key default gen_random_uuid(),
  purchase_form_id uuid not null references purchase_forms(id) on delete cascade,
  seq smallint not null default 0,
  description text not null default '',
  budget numeric not null default 0,
  ppn boolean not null default false,
  supplier_name text not null default '',
  code text not null default '', -- Form A: INVENTORY/SERVICE - Form B: letter A-M (see EXPENSE_CODES)
  attachment_path text,
  attachment_filename text,
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
-- Support. Simple record + comment log, no approval chain.
-- ---------------------------------------------------------------------------
create table if not exists po_out (
  id uuid primary key default gen_random_uuid(),
  po_date date not null default current_date,
  deadline date,
  po_number text not null default '',
  item_code text not null default '',
  sales text not null default '',
  customer_name text not null default '',
  item_description text not null default '',
  qty numeric not null default 0,
  unit text not null default 'pcs',
  unit_price numeric not null default 0,
  total_price numeric not null default 0, -- qty * unit_price, computed client-side on save
  unit_selling_price numeric not null default 0,
  supplier text not null default '',
  stock_export text not null default 'stock' check (stock_export in ('stock','export')),
  status text not null default 'active' check (status in ('active','cancelled')),
  submitted_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists po_out_history (
  id uuid primary key default gen_random_uuid(),
  po_out_id uuid not null references po_out(id) on delete cascade,
  changed_by text not null default '',
  comment text not null default '',
  changed_at timestamptz not null default now()
);

create index if not exists idx_po_out_history_po on po_out_history(po_out_id);
alter table po_out enable row level security;
alter table po_out_history enable row level security;

create index if not exists idx_job_orders_status on job_orders(status);
create index if not exists idx_job_order_bom_job on job_order_bom(job_order_id);
create index if not exists idx_production_logs_job on production_logs(job_order_id);
create index if not exists idx_qc_checks_job on qc_checks(job_order_id);
create index if not exists idx_complaints_traded on complaints(is_traded);

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
