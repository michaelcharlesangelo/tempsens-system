-- Run this FIRST in Supabase's SQL Editor, then run schema.sql fresh
-- afterward. This fixes "could not find X in the schema cache" errors,
-- which happen when an older/partial version of the schema got run before
-- and the new one (create table IF NOT EXISTS) silently skipped tables
-- that already existed with the old, wrong column names.

drop table if exists complaints cascade;
drop table if exists qc_checks cascade;
drop table if exists production_logs cascade;
drop table if exists job_order_bom cascade;
drop table if exists job_order_history cascade;
drop table if exists job_orders cascade;
drop table if exists station_codes cascade;
drop table if exists item_catalog cascade;
drop table if exists item_categories cascade;
drop table if exists sales_people cascade;
drop table if exists sales_team_members cascade;
drop table if exists sales_teams cascade;
drop table if exists production_accounts cascade;
drop table if exists back_office cascade;
drop table if exists positions cascade;
drop table if exists purchase_form_history cascade;
drop table if exists purchase_form_items cascade;
drop table if exists purchase_forms cascade;
drop table if exists po_out_history cascade;
drop table if exists po_out cascade;
drop table if exists suppliers cascade;
drop table if exists shipments cascade;

-- Force PostgREST (the API layer) to forget its old cached schema and
-- pick up the fresh one immediately, instead of waiting for its next
-- automatic reload.
notify pgrst, 'reload schema';
