-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor).
-- This is a NEW, separate Supabase project from the thermocouple pricer.

-- ---------------------------------------------------------------------------
-- Profiles - extends Supabase Auth's built-in auth.users with app fields.
-- `role` drives approval routing (see job_orders below) - expected values:
-- 'admin', 'sales_support', 'sales_manager', 'operational_manager', 'gm_md',
-- 'production_manager', 'production_user', 'warehouse_manager', 'qc'.
-- Free-text rather than an enum so adding a role later needs no migration.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'sales_support',
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------------
-- Item categories - Thermocouple, RTD, Thermowell, Heater, Level Sensor,
-- Fittings, etc. Kept as an editable table (not a hardcoded list) since
-- more will be added over time. Drives which QC fields show up later.
-- ---------------------------------------------------------------------------
create table if not exists item_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into item_categories (name) values
  ('Thermocouple'), ('RTD'), ('Thermowell'), ('Heater'), ('Level Sensor'), ('Fittings')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Item catalog - grows automatically as BOM items are entered. When a BOM
-- line uses an item_code that already exists here, its description
-- auto-fills; when a new code is used, it gets added here for next time.
-- This is a code->description lookup, NOT a stock/quantity tracker (that's
-- deliberately kept separate for now, per your call).
-- ---------------------------------------------------------------------------
create table if not exists item_catalog (
  item_code text primary key,
  description text not null default '',
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Station barcodes (QR codes) - the ~10 fixed process stations printed and
-- stuck up on the production floor. Registered here by an admin, each gets
-- a unique code that's rendered as a printable QR image.
-- ---------------------------------------------------------------------------
create table if not exists station_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- the actual QR content, e.g. a short random token
  station_name text not null, -- e.g. "Winding", "Assembly", "Cement Curing"
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Job orders - the core entity, matching the manual JO form fields.
--
-- Approval is a 3-LAYER sequential process (not one single approver):
-- pending_approval + current_approval_layer 1 -> Sales Manager
-- pending_approval + current_approval_layer 2 -> Operational Manager
-- pending_approval + current_approval_layer 3 -> GM/MD
-- Any layer rejecting moves status straight to 'rejected'. Passing layer 3
-- moves status to 'approved'. Routing is by ROLE (any user with that role
-- can act), not a hand-picked person per job order.
--
-- po_attachment_url is restricted at the API level to the 3 approval roles
-- + admin - production/workshop must never see it.
-- ---------------------------------------------------------------------------
create table if not exists job_orders (
  id uuid primary key default gen_random_uuid(),
  jo_number text not null unique, -- e.g. JO-2026-0001

  customer_name text not null,
  so_no text not null default '',
  item_category text not null default '',
  item_description text not null default '',
  drawing_url text, -- uploaded PDF/JPG
  quantity numeric not null default 1,
  item_code text not null default '',
  serial_no text not null default '',
  deadline date,
  finish_date timestamptz, -- auto-set on final completion
  po_attachment_url text, -- restricted visibility, see above
  barcode text unique, -- this job order's own QR code content

  status text not null default 'draft'
    check (status in (
      'draft','pending_approval','approved','rejected',
      'acknowledged','in_progress','qc','completed','cancelled'
    )),
  current_approval_layer smallint, -- 1, 2, or 3 while status = pending_approval

  material_issued boolean not null default false,
  material_issued_at timestamptz,

  created_by uuid not null references profiles(id),
  acknowledged_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Audit trail of every status change / approval decision.
create table if not exists job_order_history (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  status text not null,
  changed_by uuid not null references profiles(id),
  comment text not null default '',
  changed_at timestamptz not null default now()
);

-- Material BOM - filled in by Production Manager during Acknowledge.
create table if not exists job_order_bom (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  item_code text not null,
  description text not null default '',
  estimated_qty numeric not null default 0,
  actual_qty numeric not null default 0,
  unit text not null default 'pcs',
  created_at timestamptz not null default now()
);

-- Purchase requests - e.g. warehouse escalating unavailable material.
create table if not exists purchase_requests (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  bom_item_id uuid references job_order_bom(id) on delete set null,
  item_name text not null,
  quantity numeric not null default 1,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','ordered','received')),
  requested_by uuid not null references profiles(id),
  approver_id uuid references profiles(id),
  notes text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Production floor scan log - drives step tracking + KPI/timing. Each row
-- is one scan event: someone scanned a station's QR + this job order's QR.
-- Regular production users can only insert; only managers can delete
-- (enforced in application code).
create table if not exists production_logs (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  station_id uuid not null references station_codes(id),
  scanned_by uuid not null references profiles(id),
  scanned_at timestamptz not null default now()
);

-- QC records - which fields matter depends on the job order's item_category
-- (Thermocouple -> continuity, RTD -> resistance; megger @500VDC >2Mohm and
-- 100degC temperature test apply generally). calibration_data is jsonb so
-- the UI can store whichever fields are relevant without a migration.
create table if not exists qc_records (
  id uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references job_orders(id) on delete cascade,
  performed_by uuid not null references profiles(id),
  result text not null default 'pending' check (result in ('pending','pass','fail')),
  calibration_data jsonb not null default '{}'::jsonb,
  report_notes text not null default '',
  performed_at timestamptz not null default now()
);

-- Notifications - drives the badge count on login.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread on notifications(user_id, read);
create index if not exists idx_job_orders_status on job_orders(status);
create index if not exists idx_job_order_bom_job on job_order_bom(job_order_id);
create index if not exists idx_purchase_requests_job on purchase_requests(job_order_id);
create index if not exists idx_qc_records_job on qc_records(job_order_id);
create index if not exists idx_production_logs_job on production_logs(job_order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: locked down by default. Server-side API routes use
-- the service_role key (bypasses RLS) and enforce who-can-do-what in
-- application code by checking the logged-in user's role - so no public
-- policies are needed here.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table item_categories enable row level security;
alter table item_catalog enable row level security;
alter table station_codes enable row level security;
alter table job_orders enable row level security;
alter table job_order_history enable row level security;
alter table job_order_bom enable row level security;
alter table purchase_requests enable row level security;
alter table production_logs enable row level security;
alter table qc_records enable row level security;
alter table notifications enable row level security;

-- ---------------------------------------------------------------------------
-- Thermocouple pricing module - same simple key/value pattern as the
-- standalone pricer project. Separate, fresh dataset from that project's
-- Supabase - rates/config aren't shared automatically between the two.
-- ---------------------------------------------------------------------------
create table if not exists app_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_kv enable row level security;

-- ---------------------------------------------------------------------------
-- Storage bucket for job order file attachments (drawings, PO). Private -
-- files are only ever served through the app's own API routes (which check
-- role before generating a short-lived signed URL), never accessed via a
-- public Supabase Storage URL directly. This is what actually enforces
-- "production/workshop can't see the PO" at the file level, not just by
-- hiding a field in JSON.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-order-files', 'job-order-files', false)
on conflict (id) do nothing;

