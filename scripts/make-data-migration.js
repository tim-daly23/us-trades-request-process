/**
 * Generate SQL that copies the dev tenant data into another database.
 *
 *   node scripts/make-data-migration.js > scripts/migrate-dev-data.sql
 *
 * Three things make this more than a dump:
 *
 *  1. Crafts, levels and credentials were seeded independently in each
 *     database, so their UUIDs differ. Any column pointing at them is emitted
 *     as a lookup by code instead of a literal id.
 *
 *  2. app_users rows cannot come across — each is tied to an auth account that
 *     exists only in the source project. Columns referencing a user are
 *     resolved to the target's own agency account, or nulled where optional.
 *     Logins are recreated through the console, which creates the auth account
 *     too.
 *
 *  3. Insert order follows the foreign keys, and req_number_counters comes
 *     along so numbering continues rather than colliding with what was copied.
 */

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** The target's own agency user — every "who did this" column resolves here. */
const ACTOR = "(select id from app_users where user_type = 'agency' order by created_at limit 1)";

function lit(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'";
    return `array[${v.map((x) => lit(x)).join(", ")}]::uuid[]`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function all(table) {
  const { data, error } = await db.from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

(async () => {
  const [
    crafts, levels, credentials,
    customers, sites, contacts, workers,
    reqs, lines, reqReqs, placements, counters,
  ] = await Promise.all([
    all("crafts"), all("levels"), all("credentials"),
    all("customers"), all("sites"), all("site_contacts"), all("workers"),
    all("requisitions"), all("requisition_lines"),
    all("requisition_requirements"), all("placements"),
    all("req_number_counters"),
  ]);

  const craftCode = new Map(crafts.map((c) => [c.id, c.code]));
  const levelCode = new Map(levels.map((l) => [l.id, l.code]));
  const credCode = new Map(credentials.map((c) => [c.id, c.code]));

  const byCraft = (id) =>
    id && craftCode.has(id)
      ? `(select id from crafts where code = ${lit(craftCode.get(id))})`
      : "null";
  const byLevel = (id) =>
    id && levelCode.has(id)
      ? `(select id from levels where code = ${lit(levelCode.get(id))})`
      : "null";
  const byCred = (id) =>
    id && credCode.has(id)
      ? `(select id from credentials where code = ${lit(credCode.get(id))} and customer_id is null)`
      : "null";

  const out = [];
  const w = (s) => out.push(s);

  w(`-- =====================================================================`);
  w(`-- DATA MIGRATION — dev tenant data into this database`);
  w(`-- Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} from ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  w(`-- =====================================================================`);
  w(`-- Run once, top to bottom. Every insert is ON CONFLICT DO NOTHING, so a`);
  w(`-- partial re-run is safe.`);
  w(`--`);
  w(`-- NOT copied: portal logins. Each is tied to an auth account that exists`);
  w(`-- only in the source project, so they are recreated through the agency`);
  w(`-- console — which creates the auth account as well. Columns recording who`);
  w(`-- did something resolve to this database's own agency user.`);
  w(`--`);
  w(`-- Craft, level and credential references are resolved by code rather than`);
  w(`-- id: the catalogues were seeded separately in each database and their`);
  w(`-- UUIDs differ.`);
  w(`-- =====================================================================`);
  w("");
  w(`-- Requires an agency user to exist. Create yours first.`);
  w(`do $$ begin`);
  w(`  if not exists (select 1 from app_users where user_type = 'agency') then`);
  w(`    raise exception 'No agency user in this database. Create your login first.';`);
  w(`  end if;`);
  w(`end $$;`);
  w("");

  // ---- customers
  w(`-- ${customers.length} customer(s)`);
  for (const c of customers) {
    w(`insert into customers (id, slug, legal_name, display_name, status, billing_email,
  billing_terms_days, default_markup_pct, requires_internal_approval,
  candidate_approval_required, allow_requester_site_create, show_bill_rates,
  show_worker_contact_info, primary_color, accent_color, notes, created_at)
values (${lit(c.id)}, ${lit(c.slug)}, ${lit(c.legal_name)}, ${lit(c.display_name)},
  ${lit(c.status)}, ${lit(c.billing_email)}, ${lit(c.billing_terms_days)},
  ${lit(c.default_markup_pct)}, ${lit(c.requires_internal_approval)},
  ${lit(c.candidate_approval_required)}, ${lit(c.allow_requester_site_create)},
  ${lit(c.show_bill_rates)}, ${lit(c.show_worker_contact_info)},
  ${lit(c.primary_color)}, ${lit(c.accent_color)}, ${lit(c.notes)}, ${lit(c.created_at)})
on conflict (id) do nothing;`);
  }
  w("");

  // ---- sites
  w(`-- ${sites.length} site(s)`);
  for (const s of sites) {
    const creds = (s.default_credential_ids ?? [])
      .map((id) => byCred(id))
      .filter((x) => x !== "null");
    const credExpr = creds.length
      ? `array[${creds.join(", ")}]::uuid[]`
      : `'{}'::uuid[]`;
    w(`insert into sites (id, customer_id, name, address_line1, address_line2, city, state,
  postal_code, country, timezone, default_shift, default_hours_per_day,
  default_days_per_week, default_per_diem_rate, default_per_diem_policy,
  badging_lead_time_days, safety_council_required, safety_council_name,
  site_access_notes, default_credential_ids, status, created_by, created_at)
values (${lit(s.id)}, ${lit(s.customer_id)}, ${lit(s.name)}, ${lit(s.address_line1)},
  ${lit(s.address_line2)}, ${lit(s.city)}, ${lit(s.state)}, ${lit(s.postal_code)},
  ${lit(s.country)}, ${lit(s.timezone)}, ${lit(s.default_shift)},
  ${lit(s.default_hours_per_day)}, ${lit(s.default_days_per_week)},
  ${lit(s.default_per_diem_rate)}, ${lit(s.default_per_diem_policy)},
  ${lit(s.badging_lead_time_days)}, ${lit(s.safety_council_required)},
  ${lit(s.safety_council_name)}, ${lit(s.site_access_notes)}, ${credExpr},
  ${lit(s.status)}, ${ACTOR}, ${lit(s.created_at)})
on conflict (id) do nothing;`);
  }
  w("");

  // ---- site contacts
  w(`-- ${contacts.length} site contact(s)`);
  for (const c of contacts) {
    w(`insert into site_contacts (id, site_id, customer_id, name, role, phone, email, is_primary, created_at)
values (${lit(c.id)}, ${lit(c.site_id)}, ${lit(c.customer_id)}, ${lit(c.name)},
  ${lit(c.role)}, ${lit(c.phone)}, ${lit(c.email)}, ${lit(c.is_primary)}, ${lit(c.created_at)})
on conflict (id) do nothing;`);
  }
  w("");

  // ---- workers
  w(`-- ${workers.length} worker(s)`);
  for (const k of workers) {
    w(`insert into workers (id, first_name, last_name, preferred_name, email, phone, status,
  home_city, home_state, home_postal_code, willing_to_travel, max_travel_miles,
  per_diem_eligible, primary_craft_id, primary_level_id, years_experience,
  do_not_return, dnr_reason, internal_rating, notes, created_by, created_at)
values (${lit(k.id)}, ${lit(k.first_name)}, ${lit(k.last_name)}, ${lit(k.preferred_name)},
  ${lit(k.email)}, ${lit(k.phone)}, ${lit(k.status)}, ${lit(k.home_city)},
  ${lit(k.home_state)}, ${lit(k.home_postal_code)}, ${lit(k.willing_to_travel)},
  ${lit(k.max_travel_miles)}, ${lit(k.per_diem_eligible)}, ${byCraft(k.primary_craft_id)},
  ${byLevel(k.primary_level_id)}, ${lit(k.years_experience)}, ${lit(k.do_not_return)},
  ${lit(k.dnr_reason)}, ${lit(k.internal_rating)}, ${lit(k.notes)}, ${ACTOR}, ${lit(k.created_at)})
on conflict (id) do nothing;`);
  }
  w("");

  // ---- requisitions
  w(`-- ${reqs.length} requisition(s)`);
  for (const r of reqs) {
    w(`insert into requisitions (id, customer_id, req_number, site_id, title, project_name,
  po_number, cost_code, status, urgency, start_date, end_date, duration_weeks,
  is_ongoing, shift, shift_start_time, hours_per_day, days_per_week, per_diem_rate,
  per_diem_policy, travel_pay, mobilization_notes, scope_of_work, tools_provided_by,
  ppe_notes, special_instructions, created_by, submitted_by, submitted_at,
  acknowledged_by, acknowledged_at, owner_user_id, needed_by, cancelled_reason,
  closed_at, created_at)
values (${lit(r.id)}, ${lit(r.customer_id)}, ${lit(r.req_number)}, ${lit(r.site_id)},
  ${lit(r.title)}, ${lit(r.project_name)}, ${lit(r.po_number)}, ${lit(r.cost_code)},
  ${lit(r.status)}, ${lit(r.urgency)}, ${lit(r.start_date)}, ${lit(r.end_date)},
  ${lit(r.duration_weeks)}, ${lit(r.is_ongoing)}, ${lit(r.shift)}, ${lit(r.shift_start_time)},
  ${lit(r.hours_per_day)}, ${lit(r.days_per_week)}, ${lit(r.per_diem_rate)},
  ${lit(r.per_diem_policy)}, ${lit(r.travel_pay)}, ${lit(r.mobilization_notes)},
  ${lit(r.scope_of_work)}, ${lit(r.tools_provided_by)}, ${lit(r.ppe_notes)},
  ${lit(r.special_instructions)}, ${ACTOR}, ${r.submitted_by ? ACTOR : "null"},
  ${lit(r.submitted_at)}, ${r.acknowledged_by ? ACTOR : "null"}, ${lit(r.acknowledged_at)},
  ${r.owner_user_id ? ACTOR : "null"}, ${lit(r.needed_by)}, ${lit(r.cancelled_reason)},
  ${lit(r.closed_at)}, ${lit(r.created_at)})
on conflict (id) do nothing;`);
  }
  w("");

  // ---- lines
  w(`-- ${lines.length} craft line(s)`);
  for (const l of lines) {
    w(`insert into requisition_lines (id, requisition_id, customer_id, line_number, craft_id,
  level_id, quantity, start_date, end_date, hours_per_day, days_per_week,
  per_diem_rate, bill_rate, target_pay_rate, status, notes, created_at)
values (${lit(l.id)}, ${lit(l.requisition_id)}, ${lit(l.customer_id)}, ${lit(l.line_number)},
  ${byCraft(l.craft_id)}, ${byLevel(l.level_id)}, ${lit(l.quantity)}, ${lit(l.start_date)},
  ${lit(l.end_date)}, ${lit(l.hours_per_day)}, ${lit(l.days_per_week)},
  ${lit(l.per_diem_rate)}, ${lit(l.bill_rate)}, ${lit(l.target_pay_rate)},
  ${lit(l.status)}, ${lit(l.notes)}, ${lit(l.created_at)})
on conflict (id) do nothing;`);
  }
  w("");

  // ---- requirements
  w(`-- ${reqReqs.length} credential requirement(s)`);
  for (const r of reqReqs) {
    const cred = byCred(r.credential_id);
    if (cred === "null") continue;
    w(`insert into requisition_requirements (requisition_id, credential_id, is_required, state_code, notes)
values (${lit(r.requisition_id)}, ${cred}, ${lit(r.is_required)}, ${lit(r.state_code)}, ${lit(r.notes)})
on conflict do nothing;`);
  }
  w("");

  // ---- placements
  w(`-- ${placements.length} placement(s)`);
  for (const p of placements) {
    w(`insert into placements (id, requisition_line_id, requisition_id, customer_id, worker_id,
  stage, stage_changed_at, is_customer_visible, submitted_at, pay_rate, bill_rate,
  per_diem_rate, scheduled_start_date, scheduled_end_date, actual_start_date,
  actual_end_date, end_reason, credential_ready, created_by, created_at)
values (${lit(p.id)}, ${lit(p.requisition_line_id)}, ${lit(p.requisition_id)},
  ${lit(p.customer_id)}, ${lit(p.worker_id)}, ${lit(p.stage)}, ${lit(p.stage_changed_at)},
  ${lit(p.is_customer_visible)}, ${lit(p.submitted_at)}, ${lit(p.pay_rate)},
  ${lit(p.bill_rate)}, ${lit(p.per_diem_rate)}, ${lit(p.scheduled_start_date)},
  ${lit(p.scheduled_end_date)}, ${lit(p.actual_start_date)}, ${lit(p.actual_end_date)},
  ${lit(p.end_reason)}, ${lit(p.credential_ready)}, ${ACTOR}, ${lit(p.created_at)})
on conflict (id) do nothing;`);
  }
  w("");

  // ---- numbering
  w(`-- Carry the numbering forward so the next request does not reuse a number`);
  for (const c of counters) {
    w(`insert into req_number_counters (customer_id, year, last_value)
values (${lit(c.customer_id)}, ${lit(c.year)}, ${lit(c.last_value)})
on conflict (customer_id, year) do update set last_value = greatest(req_number_counters.last_value, excluded.last_value);`);
  }
  w("");

  w(`-- Recompute the fill counts from the placements just inserted.`);
  w(`update requisition_lines l set filled_count = filled_count;`);
  w("");
  w(`select 'customers' as t, count(*) from customers`);
  w(`union all select 'sites', count(*) from sites`);
  w(`union all select 'workers', count(*) from workers`);
  w(`union all select 'requisitions', count(*) from requisitions`);
  w(`union all select 'requisition_lines', count(*) from requisition_lines`);
  w(`union all select 'placements', count(*) from placements;`);

  console.log(out.join("\n"));
})();
