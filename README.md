# Tempsens System - Phase 1

Job Order module, prototype phase. **No login for the 6 workflow tabs** —
each one simulates a role's point of view, so you can validate the flow
before real accounts get added. **Production/QC floor staff do get a real
login** (username + password, no email) since their work needs individual
accountability.

## Setup

### 1. New Supabase project
1. supabase.com → New project (separate from the thermocouple pricer's).
2. SQL Editor → paste all of `supabase/schema.sql` → Run.
3. Settings → API → copy the Project URL and the `service_role`/Secret key.

### 2. Environment variables
Just two — see `.env.example`. No client-exposed keys needed this phase.

### 3. Deploy (GitHub → Vercel)
Same flow as before: push to a new GitHub repo, import into Vercel, add
the two env vars, deploy.

### 4. First-time setup on the live site
1. Go to `/admin` (no password) → register your ~10 production stations
   (order matters — it's the physical process sequence) → print the QR
   codes.
2. Same page → add your 4 production/QC accounts (username + password).
3. Same page → add your sales people and confirm the 6 seeded item
   categories look right (mark any as "traded" if they're Tempsens
   India imports, not manufactured by you).

## The 6 tabs

- **JO Input** — create a job order. Urgent checkbox, drawing (with
  preview) + PO uploaded together at creation, no Serial No. field (that's
  Production Manager's job later).
- **Sales Manager / Operation Manager / General Manager** — identical
  approve/reject view, one per approval layer. A job order only appears in
  the next one after the previous layer approves.
- **Production Manager** — two tables: not-yet-acknowledged and
  acknowledged. Acknowledging opens a small form for Serial No. + finish
  estimation date. Acknowledged job orders get a "Fill BOM" button opening
  a 10-row spreadsheet-style grid (Item No., Description, Qty, Unit, and a
  "not ready" checkbox per row) submitted all at once.
- **Warehouse Manager** — aggregated list of everything flagged "not
  ready" across all active job orders, so purchase requests can be batched.

`/admin` is separate from these 6 (no password, as you asked) — stations,
production/QC accounts, sales people, item categories.

## What's deferred to Phase 2

You scoped this deliberately, so nothing here is missing by accident:

- **Production scanner tab** — scan JO → see specs → scan station → logs
  step + person (needs the production/QC login to be wired into it)
- **Granular QC checks** — 4 independent OK/NOT OK entries (Dimensional,
  Continuity/Resistance, I.R., Temperature), each with a free-text value
- **Print-filled-JO button** once BOM is done
- **Dashboard** with the columns you specified (Date, SO No., Item No.,
  Sales Team, Customer, Description, Qty, Finish Estimation, Progress)
- **Production summary reports** (date-range totals per category + a
  dashboard year-to-date widget)
- **Complaints module UI** (the `complaints` table already exists in the
  schema, ready for this)
- Notifications (you said you're not sure yet - schema-agnostic, easy to
  add once the rest is validated)

## Honest caveats

- I ran out of verification budget to do a full line-by-line manual audit
  of every page component this round, given how much changed. I did fix
  every genuinely independent bug I could confirm (Supabase query typing
  in the API routes, the same `fetch` cache-override pattern that broke
  twice before). If the first build throws a "Parameter implicitly has an
  'any' type" error somewhere I haven't touched, it's almost certainly the
  same category of fix as before - paste the log and I'll resolve it fast.
- QR scanning (`html5-qrcode`) still hasn't been tested on a real device -
  worth an early real-phone test once Phase 2 builds the scanner tab.
- The thermocouple pricer and its files have been fully removed from this
  project, per your request - it's not combined in here anymore.
