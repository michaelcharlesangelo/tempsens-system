# Tempsens System

Internal company system, starting with the Job Order module. Real user
accounts (Supabase Auth), role-based approval, and in-app notifications
(badge count on login, not push - more reliable given daily use and iPhone
involved).

## Setup

### 1. Create a new Supabase project
This is **separate** from the thermocouple pricer's Supabase project - don't
reuse that one.

1. supabase.com → New project.
2. SQL Editor → paste all of `supabase/schema.sql` → Run. This creates every
   table, the auto-profile-on-signup trigger, seeds the 6 item categories,
   and creates the private storage bucket for drawing/PO attachments.
3. Settings → API → copy: Project URL, `anon` `public` key, and
   `service_role` key.

### 2. Environment variables
See `.env.example` - both the plain and `NEXT_PUBLIC_`-prefixed versions of
the Supabase URL/anon key are needed (server routes use the plain ones,
the login page needs the public ones).

### 3. First account = you, then set your role to admin
1. Deploy first, then go to `/login` on the live site and sign up normally.
2. Go to Supabase → Table Editor → `profiles` → find your row → change
   `role` to `admin`. (The signup trigger defaults everyone to
   `sales_support` - you set the first admin manually, once.)
3. Everyone else who signs up afterward, you can set their role from the
   same table (no admin UI for this yet - quick to add if you want one).

Expected role values (free text, so you're not locked to exactly these):
`admin`, `sales_support`, `sales_manager`, `operational_manager`, `gm_md`,
`production_manager`, `production_user`, `warehouse_manager`, `qc`.

### 4. Register your ~10 station QR codes
Once logged in as admin: `/stations` → add each station (e.g. "Winding",
"Assembly", "Cement Curing") → print the page (button provided) → stick
the printed QR codes up on the production floor.

## How the workflow maps to your job order form

1. **Create** (`/job-orders/new`) - Sales Support fills in Customer, SO No.,
   Item Category, Item Code (autocompletes from past entries), Description,
   Qty, Serial No., Deadline. Drawing/PO/BOM are added after creation, from
   the job order's own page.
2. **Submit for approval** → routes to whoever currently holds the
   `sales_manager` role.
3. **3-layer sequential approval**: Sales Manager → Operational Manager →
   GM/MD, each with a simple Approve/Reject. Any rejection stops it there.
   The **PO attachment is only visible to these 3 roles** (+ admin +
   sales_support) - enforced by checking role before generating a
   short-lived signed URL to the file, not just by hiding a field, so
   production genuinely cannot access the file even if they had the link.
4. **Acknowledge** (Production Manager only) - also where the actual BOM
   list gets filled in.
5. **Warehouse** (`/warehouse`) - aggregated material list combining every
   acknowledged/in-progress job order's BOM. "Mark material issued" is a
   flag on the job order, not a full status change.
6. **Production scanning** - on a job order's page, "Scan station QR" opens
   the camera (or choose-from-library) to log who did what step, when.
   First scan auto-moves the job order from Acknowledged to In Progress.
   Regular users can add scan entries; only managers can delete one.
7. **QC** - fields shown adapt to the item category (Thermocouple →
   continuity, RTD → resistance; Megger @500VDC >2MΩ and 100°C temperature
   test always available).
8. **Complete** - sets the finish date, and the job order becomes
   printable (browser print button) for your separate costing software.

## Things I want to flag honestly

- **QR scanning (`html5-qrcode`) hasn't been tested on a real device** - I
  built it against the library's documented API, but I have no way to run
  a live camera test in the environment I build in. Test it on an actual
  phone early; if the camera doesn't start or file scanning errors out, the
  fix is likely a small adjustment to `app/components/QrScanner.tsx`, not a
  rebuild - paste me whatever error shows and I'll fix it.
- **No role-management UI yet** - assigning roles is done directly in
  Supabase's Table Editor for now. Easy to add a proper page if this gets
  tedious.
- **The warehouse "material needed" list is a live report**, not a stock
  tracker - it just sums BOM quantities across active job orders. You
  mentioned wanting to keep this separate from real stock levels for now,
  which is exactly what this does.
- **The thermocouple pricer here is a fresh, separate dataset** - its rates
  and config don't sync with the standalone pricer project. Re-enter them
  once, or leave the standalone one running independently - your call.
- I was not able to run `npm install` or actually build/start this project
  in my environment (no internet access here) - I verified it structurally
  with a real TypeScript parse (zero errors, only expected "module not
  found" noise from not having `node_modules`), but the first real
  `npm install && npm run build` on your end is the true first test.

## Not built yet (by design, this round)
Sales CRM (customer log, visit planning/scheduling, reports), technical
datasheet calculators (heater power, heat loss), and sales complaints -
all confirmed as later phases, job orders first.
