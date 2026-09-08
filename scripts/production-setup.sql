-- =====================================================================
-- PRODUCTION SETUP — run once, top to bottom, in a NEW Supabase project
-- =====================================================================
-- Every migration plus the reference catalogue, concatenated in order. Paste
-- the whole thing into the SQL Editor of the new project and Run.
--
-- Postgres wraps a multi-statement batch in one implicit transaction, so this
-- is all-or-nothing: a failure anywhere rolls the lot back and you can fix and
-- re-run rather than ending up half-migrated.
--
-- Afterwards, two things are NOT covered by this file and must be done by hand:
--
--   1. Authentication -> Hooks -> Customize Access Token (JWT) Claims
--      Enable it and select public.custom_access_token_hook. Without it every
--      policy evaluates against a null user_type and returns zero rows.
--
--   2. The first agency login. Create the auth user under
--      Authentication -> Users (Auto Confirm on), then insert its app_users
--      row — see the template at the end of this file. Everything after that
--      is done through the console.
--
-- Verify with scripts/verify_schema.sql, then scripts/test_rls.sql.
-- =====================================================================


-- =====================================================================
-- SOURCE: supabase/migrations/20260903120000_initial_schema.sql
-- =====================================================================

-- =====================================================================
-- US TRADES MANPOWER PORTAL — INITIAL SCHEMA
-- Target: Postgres 15+ (Supabase-compatible)
-- Isolation: shared schema, tenant column (customer_id) + Row Level Security
-- =====================================================================
-- CONVENTIONS
--   * All tenant-scoped tables carry customer_id and are protected by RLS.
--   * Agency (US Trades internal) users bypass tenant filters via JWT claim.
--   * Money is numeric(12,4). Never float.
--   * All timestamps are timestamptz, stored UTC.
--   * Soft-delete via deleted_at where history matters; hard delete elsewhere.
--
-- See docs/schema-review.md for the design decisions behind the non-obvious
-- parts (visibility gating, denormalized tenant columns, definer views).
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- =====================================================================
-- 0. ENUMS
-- =====================================================================

create type user_type          as enum ('agency', 'customer');

create type agency_role        as enum ('super_admin','ops_manager','recruiter','compliance','finance','viewer');

create type customer_role      as enum ('customer_admin','approver','requester','viewer');

create type customer_status    as enum ('prospect','active','on_hold','inactive');

create type domain_status      as enum ('pending','verifying','active','failed','removed');

create type site_status        as enum ('active','inactive');

create type requisition_status as enum (
  'draft',              -- customer is still editing
  'pending_approval',   -- customer-side internal approval required
  'submitted',          -- sent to US Trades
  'acknowledged',       -- US Trades has seen it and accepted it
  'sourcing',           -- actively recruiting
  'partially_filled',
  'filled',
  'active',             -- crew is on site
  'on_hold',
  'completed',
  'cancelled'
);

create type requisition_line_status as enum (
  'open','partially_filled','filled','cancelled','closed'
);

create type urgency as enum ('standard','urgent','emergency');

create type shift_type as enum ('day','night','swing','rotating','other');

create type per_diem_policy as enum (
  'none','daily_worked','daily_calendar','weekly','flat_per_hitch','customer_direct'
);

-- Full internal pipeline. Customer visibility is NOT derived from this
-- ordering — see placement_customer_visible_stages() below. Enum order is a
-- display/sort convenience only.
create type placement_stage as enum (
  'identified',            -- internal only
  'contacted',             -- internal only
  'screening',             -- internal only
  'credential_review',     -- internal only
  'submitted_to_customer', -- first customer-visible stage
  'customer_reviewing',
  'customer_approved',
  'customer_declined',
  'onboarding',            -- badging, DISA, drug screen, safety council
  'confirmed',             -- cleared and scheduled
  'started',               -- on site
  'completed',
  'ended_early',
  'no_show',
  'withdrawn',             -- worker backed out (can happen at ANY stage)
  'removed'                -- pulled by us or by customer (can happen at ANY stage)
);

create type worker_status as enum (
  'lead','candidate','available','assigned','inactive','do_not_return'
);

create type credential_kind as enum (
  'card','license','certification','training','screening','medical','other'
);

create type credential_state as enum (
  'missing','pending','submitted','verified','expired','rejected','waived'
);

create type verification_method as enum (
  'document_upload','third_party_lookup','self_attested','agency_verified'
);

create type notification_channel as enum ('in_app','email','sms');

create type sync_direction as enum ('pull','push');

create type sync_status as enum ('pending','running','success','partial','failed');


-- =====================================================================
-- 1. TENANTS, BRANDING, DOMAINS
-- =====================================================================

create table customers (
  id                    uuid primary key default gen_random_uuid(),
  slug                  citext not null unique,          -- 'acme' -> acme.portal.ustrades.com
  legal_name            text not null,
  display_name          text not null,
  status                customer_status not null default 'prospect',

  -- billing / commercial
  billing_email         citext,
  billing_terms_days    int default 30,
  default_markup_pct    numeric(6,3),
  msa_signed_at         timestamptz,
  msa_expires_at        timestamptz,
  coi_expires_at        timestamptz,

  -- behavior flags
  requires_internal_approval  boolean not null default false, -- customer-side approval before req reaches us
  candidate_approval_required boolean not null default true,  -- customer must approve each candidate
  allow_requester_site_create boolean not null default false,
  show_bill_rates             boolean not null default true,
  show_worker_contact_info    boolean not null default false,

  -- branding
  logo_url              text,
  logo_dark_url         text,
  favicon_url           text,
  primary_color         text default '#1F4E79',
  accent_color          text default '#E87722',
  login_background_url  text,
  email_from_name       text,
  theme                 jsonb not null default '{}'::jsonb,  -- extra design tokens

  tempworks_customer_id text,          -- TempWorks customerId
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index on customers (status) where deleted_at is null;

create table custom_domains (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  hostname        citext not null unique,      -- manpower.acmeindustrial.com
  is_primary      boolean not null default false,
  status          domain_status not null default 'pending',
  verification_token text,
  verified_at     timestamptz,
  ssl_issued_at   timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);
create index on custom_domains (customer_id);


-- =====================================================================
-- 2. USERS & ACCESS
-- =====================================================================
-- app_users mirrors the auth provider's user (Supabase auth.users.id).
-- customer_id + user_type + role are written SERVER-SIDE ONLY and mirrored
-- into the JWT app_metadata. A client must never be able to set these.

create table app_users (
  id              uuid primary key,                 -- == auth.users.id
  email           citext not null unique,
  full_name       text,
  phone           text,
  user_type       user_type not null,
  customer_id     uuid references customers(id) on delete cascade,
  agency_role     agency_role,
  customer_role   customer_role,
  title           text,
  avatar_url      text,
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  invited_by      uuid references app_users(id),
  invited_at      timestamptz,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint chk_user_shape check (
    (user_type = 'agency'   and customer_id is null and agency_role is not null and customer_role is null)
    or
    (user_type = 'customer' and customer_id is not null and customer_role is not null and agency_role is null)
  )
);
create index on app_users (customer_id) where user_type = 'customer';

-- Optional: restrict a requester to specific sites.
create table user_site_access (
  user_id  uuid not null references app_users(id) on delete cascade,
  site_id  uuid not null,
  primary key (user_id, site_id)
);


-- =====================================================================
-- 3. SITES (the saved-address dropdown)
-- =====================================================================

create table sites (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references customers(id) on delete cascade,
  name                text not null,                -- "Baytown Olefins Plant"
  site_code           text,                          -- customer's internal code
  address_line1       text not null,
  address_line2       text,
  city                text not null,
  state               text not null,
  postal_code         text not null,
  country             text not null default 'US',
  latitude            numeric(9,6),
  longitude           numeric(9,6),
  timezone            text default 'America/Chicago',

  -- operational defaults that pre-fill a new requisition
  default_shift            shift_type default 'day',
  default_hours_per_day    numeric(4,2) default 10,
  default_days_per_week    int default 6,
  default_per_diem_rate    numeric(10,2),
  default_per_diem_policy  per_diem_policy default 'daily_worked',
  reporting_location       text,                    -- "Gate 4, North Lot"
  reporting_time           time,
  parking_instructions     text,
  badging_lead_time_days   int default 3,
  safety_council_required  boolean default false,
  safety_council_name      text,
  site_access_notes        text,

  -- credentials this site ALWAYS requires; pre-checks the request form.
  -- Integrity is enforced by trg_sites_default_credentials (section 14),
  -- since Postgres has no FK on array elements.
  default_credential_ids   uuid[] not null default '{}',

  status              site_status not null default 'active',
  tempworks_worksite_id text,
  created_by          uuid references app_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index on sites (customer_id, status);

-- Partial unique: a soft-deleted site must not block reusing its name.
create unique index sites_customer_name_uniq
  on sites (customer_id, name) where deleted_at is null;

alter table user_site_access
  add constraint user_site_access_site_fk
  foreign key (site_id) references sites(id) on delete cascade;

create table site_contacts (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  name        text not null,
  role        text,                    -- "Superintendent", "Safety", "Receiving"
  phone       text,
  email       citext,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on site_contacts (site_id);


-- =====================================================================
-- 4. CRAFT / LEVEL CATALOG
-- =====================================================================

create table crafts (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,     -- 'PIPEFITTER'
  name         text not null,            -- 'Pipefitter'
  category     text,                     -- 'Mechanical'
  is_active    boolean not null default true,
  sort_order   int not null default 100,
  tempworks_job_title_id text
);

create table levels (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,     -- 'JOURNEYMAN'
  name         text not null,
  rank         int not null,             -- 10 helper … 50 general foreman
  is_active    boolean not null default true
);

-- Valid craft+level combos with default rates. Customer-specific rows override
-- the global row (customer_id is null = global default).
create table craft_level_rates (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references customers(id) on delete cascade,
  craft_id       uuid not null references crafts(id) on delete cascade,
  level_id       uuid not null references levels(id) on delete cascade,
  bill_rate      numeric(10,2),
  ot_multiplier  numeric(4,2) default 1.5,
  dt_multiplier  numeric(4,2) default 2.0,
  target_pay_rate numeric(10,2),
  effective_from date not null default current_date,
  effective_to   date
);

-- NOT a plain UNIQUE(customer_id, ...): NULL customer_id (the global default
-- row) compares distinct under SQL null semantics, which would allow unlimited
-- duplicate global rates for the same craft/level/date.
create unique index craft_level_rates_uniq
  on craft_level_rates (
    coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    craft_id, level_id, effective_from
  );
create index on craft_level_rates (customer_id, craft_id, level_id);


-- =====================================================================
-- 5. CREDENTIALS (the configurable checkbox catalog)
-- =====================================================================

create table credentials (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,             -- 'TWIC','NCCER','DISA','STATE_LICENSE'
  name                text not null,
  short_label         text,                      -- what shows on the checkbox
  description         text,
  kind                credential_kind not null default 'certification',
  issuing_body        text,
  has_expiration      boolean not null default true,
  default_valid_days  int,
  requires_document   boolean not null default true,
  requires_number     boolean not null default false,
  requires_state      boolean not null default false,  -- state licenses
  verification        verification_method not null default 'document_upload',
  -- null customer_id = global catalog item available to all tenants
  customer_id         uuid references customers(id) on delete cascade,
  is_active           boolean not null default true,
  sort_order          int not null default 100,
  created_at          timestamptz not null default now()
);

-- Code is unique PER OWNER, not globally: one tenant defining a custom
-- 'SITE_BADGE' must not block every other tenant from doing the same.
create unique index credentials_code_uniq
  on credentials (coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
create index on credentials (customer_id, is_active);

-- Which credentials appear on a given customer's request form, and defaults.
create table customer_credentials (
  customer_id    uuid not null references customers(id) on delete cascade,
  credential_id  uuid not null references credentials(id) on delete cascade,
  is_enabled     boolean not null default true,
  default_checked boolean not null default false,
  is_mandatory   boolean not null default false,   -- always required, cannot uncheck
  label_override text,
  sort_order     int not null default 100,
  primary key (customer_id, credential_id)
);


-- =====================================================================
-- 6. REQUISITIONS (manpower requests)
-- =====================================================================

create table requisitions (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references customers(id) on delete cascade,
  req_number          text not null,          -- 'ACME-2026-0142', generated
  site_id             uuid not null references sites(id),

  title               text,                   -- "Fall Turnaround — Unit 7"
  project_name        text,
  po_number           text,
  cost_code           text,
  status              requisition_status not null default 'draft',
  urgency             urgency not null default 'standard',

  -- schedule
  start_date          date not null,
  end_date            date,
  duration_weeks      numeric(5,2),
  is_ongoing          boolean not null default false,
  shift               shift_type not null default 'day',
  shift_start_time    time,
  hours_per_day       numeric(4,2) not null default 10,
  days_per_week       int not null default 6,
  estimated_total_hours numeric(10,2)
      generated always as (hours_per_day * days_per_week * coalesce(duration_weeks,0)) stored,

  -- pay / expenses (defaults; lines may override)
  per_diem_rate       numeric(10,2),
  per_diem_policy     per_diem_policy not null default 'daily_worked',
  travel_pay          numeric(10,2),
  mobilization_notes  text,

  -- context
  scope_of_work       text,
  tools_provided_by   text,                   -- 'customer' | 'worker' | 'agency'
  ppe_notes           text,
  special_instructions text,

  -- workflow metadata
  created_by          uuid not null references app_users(id),
  submitted_by        uuid references app_users(id),
  submitted_at        timestamptz,
  approved_by         uuid references app_users(id),   -- customer-side approver
  approved_at         timestamptz,
  acknowledged_by     uuid references app_users(id),   -- US Trades
  acknowledged_at     timestamptz,
  owner_user_id       uuid references app_users(id),   -- assigned US Trades recruiter
  needed_by           timestamptz,
  cancelled_reason    text,
  closed_at           timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (customer_id, req_number)
);
create index on requisitions (customer_id, status);
create index on requisitions (status, start_date);
create index on requisitions (site_id);
create index on requisitions (owner_user_id) where status not in ('completed','cancelled');

-- One row per craft+level ask. This is what makes "multiple levels on one
-- request" work, and it is the unit that maps to a TempWorks Job Order.
create table requisition_lines (
  id                 uuid primary key default gen_random_uuid(),
  requisition_id     uuid not null references requisitions(id) on delete cascade,
  customer_id        uuid not null references customers(id) on delete cascade, -- denormalized for RLS; pinned by trigger
  line_number        int not null,
  craft_id           uuid not null references crafts(id),
  level_id           uuid not null references levels(id),
  quantity           int not null check (quantity > 0),

  -- optional per-line overrides of the header values
  start_date         date,
  end_date           date,
  hours_per_day      numeric(4,2),
  days_per_week      int,
  per_diem_rate      numeric(10,2),
  bill_rate          numeric(10,2),
  target_pay_rate    numeric(10,2),

  status             requisition_line_status not null default 'open',
  filled_count       int not null default 0,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (requisition_id, line_number)
);
create index on requisition_lines (requisition_id);
create index on requisition_lines (customer_id, status);
create index on requisition_lines (craft_id, level_id) where status = 'open';

-- Header-level requirements: apply to every line on the requisition.
create table requisition_requirements (
  requisition_id  uuid not null references requisitions(id) on delete cascade,
  credential_id   uuid not null references credentials(id),
  is_required     boolean not null default true,   -- false = "preferred"
  state_code      text,                             -- for state licenses
  notes           text,
  primary key (requisition_id, credential_id)
);

-- Extra requirements that apply to ONE line only (e.g. only the Foreman
-- needs an NCCER supervisor cert). Effective set = header union line.
create table requisition_line_requirements (
  requisition_line_id uuid not null references requisition_lines(id) on delete cascade,
  credential_id       uuid not null references credentials(id),
  is_required         boolean not null default true,
  state_code          text,
  notes               text,
  primary key (requisition_line_id, credential_id)
);

create table requisition_attachments (
  id              uuid primary key default gen_random_uuid(),
  requisition_id  uuid not null references requisitions(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade, -- pinned by trigger
  file_name       text not null,
  storage_path    text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references app_users(id),
  is_internal     boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Threaded messages. is_internal rows are never returned to customer users.
create table requisition_comments (
  id              uuid primary key default gen_random_uuid(),
  requisition_id  uuid not null references requisitions(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade, -- pinned by trigger
  author_id       uuid not null references app_users(id),
  body            text not null,
  is_internal     boolean not null default false,
  parent_id       uuid references requisition_comments(id),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz
);
create index on requisition_comments (requisition_id, created_at);


-- =====================================================================
-- 7. WORKERS (candidates and employees are the same record)
-- =====================================================================

create table workers (
  id                  uuid primary key default gen_random_uuid(),
  first_name          text not null,
  last_name           text not null,
  preferred_name      text,
  email               citext,
  phone               text,
  status              worker_status not null default 'candidate',

  home_city           text,
  home_state          text,
  home_postal_code    text,
  latitude            numeric(9,6),
  longitude           numeric(9,6),
  willing_to_travel   boolean not null default true,
  max_travel_miles    int,
  per_diem_eligible   boolean not null default true,

  primary_craft_id    uuid references crafts(id),
  primary_level_id    uuid references levels(id),
  years_experience    numeric(4,1),
  resume_path         text,
  photo_path          text,

  -- rehire / performance
  do_not_return       boolean not null default false,
  dnr_reason          text,
  internal_rating     int check (internal_rating between 1 and 5),

  tempworks_employee_id text unique,
  tempworks_synced_at   timestamptz,

  notes               text,
  created_by          uuid references app_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index on workers (status) where deleted_at is null;
create index on workers (primary_craft_id, primary_level_id);
create index on workers using gin ((first_name || ' ' || last_name) gin_trgm_ops);

create table worker_crafts (
  worker_id   uuid not null references workers(id) on delete cascade,
  craft_id    uuid not null references crafts(id) on delete cascade,
  level_id    uuid not null references levels(id),
  years       numeric(4,1),
  is_primary  boolean not null default false,
  primary key (worker_id, craft_id)
);

create table worker_credentials (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references workers(id) on delete cascade,
  credential_id   uuid not null references credentials(id),
  state           credential_state not null default 'missing',
  identifier      text,                 -- card / license number
  state_code      text,
  issued_date     date,
  expiration_date date,
  document_path   text,
  verified_by     uuid references app_users(id),
  verified_at     timestamptz,
  rejection_reason text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index worker_credentials_uniq
  on worker_credentials (worker_id, credential_id, coalesce(state_code, ''));
create index on worker_credentials (credential_id, state);
create index on worker_credentials (expiration_date) where state = 'verified';

-- Per-customer clearance: DISA consortium, site badge, safety council card
create table worker_customer_clearances (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null references workers(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  site_id       uuid references sites(id) on delete cascade,
  badge_number  text,
  cleared_at    date,
  expires_at    date,
  is_barred     boolean not null default false,
  bar_reason    text,
  notes         text
);
create unique index worker_customer_clearances_uniq
  on worker_customer_clearances
  (worker_id, customer_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid));


-- =====================================================================
-- 8. PLACEMENTS (candidate -> slot pipeline)
-- =====================================================================

create table placements (
  id                    uuid primary key default gen_random_uuid(),
  requisition_line_id   uuid not null references requisition_lines(id) on delete cascade,
  requisition_id        uuid not null references requisitions(id) on delete cascade,
  customer_id           uuid not null references customers(id) on delete cascade,
  worker_id             uuid not null references workers(id),

  stage                 placement_stage not null default 'identified',
  stage_changed_at      timestamptz not null default now(),
  is_customer_visible   boolean not null default false,   -- set true at submitted_to_customer

  submitted_at          timestamptz,
  customer_decision_at  timestamptz,
  customer_decision_by  uuid references app_users(id),
  decline_reason        text,

  -- terms
  pay_rate              numeric(10,2),
  bill_rate             numeric(10,2),
  per_diem_rate         numeric(10,2),
  scheduled_start_date  date,
  scheduled_end_date    date,
  actual_start_date     date,
  actual_end_date       date,
  end_reason            text,

  -- compliance snapshot, recomputed on credential/req change
  credential_ready      boolean not null default false,
  credential_gaps       jsonb not null default '[]'::jsonb,
  compliance_checked_at timestamptz,

  tempworks_assignment_id text,
  tempworks_synced_at     timestamptz,

  created_by            uuid references app_users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (requisition_line_id, worker_id)
);
create index on placements (requisition_id, stage);
create index on placements (customer_id, is_customer_visible);
create index on placements (worker_id);
create index on placements (stage, scheduled_start_date);

create table placement_events (
  id            uuid primary key default gen_random_uuid(),
  placement_id  uuid not null references placements(id) on delete cascade,
  from_stage    placement_stage,
  to_stage      placement_stage not null,
  actor_id      uuid references app_users(id),
  actor_type    user_type,
  note          text,
  created_at    timestamptz not null default now()
);
create index on placement_events (placement_id, created_at);


-- =====================================================================
-- 9. NOTIFICATIONS & AUDIT
-- =====================================================================

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_users(id) on delete cascade,
  customer_id   uuid references customers(id) on delete cascade,
  event_key     text not null,          -- 'requisition.submitted'
  title         text not null,
  body          text,
  link_path     text,
  entity_type   text,
  entity_id     uuid,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on notifications (user_id, read_at, created_at desc);

create table notification_preferences (
  user_id     uuid not null references app_users(id) on delete cascade,
  event_key   text not null,
  channel     notification_channel not null,
  is_enabled  boolean not null default true,
  primary key (user_id, event_key, channel)
);

create table email_log (
  id            uuid primary key default gen_random_uuid(),
  to_email      citext not null,
  user_id       uuid references app_users(id),
  customer_id   uuid references customers(id),
  event_key     text,
  subject       text,
  provider_id   text,
  status        text,                   -- queued|sent|delivered|bounced|failed
  error         text,
  created_at    timestamptz not null default now()
);

create table audit_log (
  id            bigserial primary key,
  actor_id      uuid references app_users(id),
  actor_email   citext,
  actor_type    user_type,
  customer_id   uuid,
  action        text not null,          -- 'requisition.update'
  entity_type   text not null,
  entity_id     uuid,
  before_data   jsonb,
  after_data    jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index on audit_log (entity_type, entity_id, created_at desc);
create index on audit_log (customer_id, created_at desc);


-- =====================================================================
-- 10. TEMPWORKS INTEGRATION
-- =====================================================================

create table integration_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  entity        text not null,          -- 'employees','joborders','assignments','customers'
  direction     sync_direction not null,
  status        sync_status not null default 'pending',
  cursor_from   timestamptz,            -- dateLastUpdated watermark
  cursor_to     timestamptz,
  records_read  int default 0,
  records_written int default 0,
  error_count   int default 0,
  started_at    timestamptz default now(),
  finished_at   timestamptz,
  last_error    text
);

create table integration_entity_map (
  id             uuid primary key default gen_random_uuid(),
  local_type     text not null,         -- 'requisition_line','placement','worker','customer','site'
  local_id       uuid not null,
  remote_system  text not null default 'tempworks',
  remote_type    text not null,         -- 'joborder','assignment','employee','customer','worksite'
  remote_id      text not null,
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  remote_hash    text,
  unique (local_type, local_id, remote_system, remote_type),
  unique (remote_system, remote_type, remote_id)
);

create table integration_outbox (
  id             bigserial primary key,
  local_type     text not null,
  local_id       uuid not null,
  operation      text not null,         -- 'create','update','close'
  payload        jsonb not null,
  attempts       int not null default 0,
  next_attempt_at timestamptz not null default now(),
  status         sync_status not null default 'pending',
  last_error     text,
  created_at     timestamptz not null default now()
);
create index on integration_outbox (status, next_attempt_at);


-- =====================================================================
-- 11. HELPER FUNCTIONS FOR RLS
-- =====================================================================
-- These read claims that the auth layer places in the JWT app_metadata.
-- On Supabase: auth.jwt() -> 'app_metadata'.
-- If you are NOT on Supabase, the current_setting('app.*') fallbacks let a
-- transaction-scoped middleware SET LOCAL the same values.
--
-- NOTE the nullif() around current_setting: the GUC returns '' (empty string,
-- not NULL) when set-but-empty, and ''::jsonb raises invalid_text_representation
-- which would abort every policy evaluated on that request.

create or replace function jwt_claims() returns jsonb
language sql stable as $fn$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$fn$;

create or replace function auth_user_type() returns text
language sql stable as $fn$
  select coalesce(
    nullif(jwt_claims() -> 'app_metadata' ->> 'user_type', ''),
    nullif(current_setting('app.user_type', true), '')
  );
$fn$;

create or replace function auth_customer_id() returns uuid
language sql stable as $fn$
  select nullif(coalesce(
    jwt_claims() -> 'app_metadata' ->> 'customer_id',
    current_setting('app.customer_id', true)
  ), '')::uuid;
$fn$;

create or replace function auth_user_id() returns uuid
language sql stable as $fn$
  select nullif(coalesce(
    jwt_claims() ->> 'sub',
    current_setting('app.user_id', true)
  ), '')::uuid;
$fn$;

create or replace function auth_customer_role() returns text
language sql stable as $fn$
  select nullif(jwt_claims() -> 'app_metadata' ->> 'customer_role', '');
$fn$;

create or replace function is_agency() returns boolean
language sql stable as $fn$ select auth_user_type() = 'agency'; $fn$;

-- True when the row's tenant matches the caller, or the caller is US Trades staff.
create or replace function can_access_customer(target uuid) returns boolean
language sql stable as $fn$
  select is_agency() or (auth_customer_id() is not null and auth_customer_id() = target);
$fn$;

-- The single source of truth for "the customer has seen this candidate".
-- Deliberately an explicit list and NOT an enum-ordering comparison: 'withdrawn'
-- and 'removed' sort after 'submitted_to_customer' but can occur at any stage,
-- so `stage >= 'submitted_to_customer'` would expose internal-only candidates.
create or replace function placement_customer_visible_stages() returns placement_stage[]
language sql immutable as $fn$
  select array[
    'submitted_to_customer','customer_reviewing','customer_approved',
    'customer_declined','onboarding','confirmed','started','completed',
    'ended_early','no_show'
  ]::placement_stage[];
$fn$;


-- =====================================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================================

alter table customers                    enable row level security;
alter table custom_domains               enable row level security;
alter table app_users                    enable row level security;
alter table sites                        enable row level security;
alter table site_contacts                enable row level security;
alter table craft_level_rates            enable row level security;
alter table credentials                  enable row level security;
alter table customer_credentials         enable row level security;
alter table requisitions                 enable row level security;
alter table requisition_lines            enable row level security;
alter table requisition_requirements     enable row level security;
alter table requisition_line_requirements enable row level security;
alter table requisition_attachments      enable row level security;
alter table requisition_comments         enable row level security;
alter table placements                   enable row level security;
alter table placement_events             enable row level security;
alter table workers                      enable row level security;
alter table worker_credentials           enable row level security;
alter table worker_crafts                enable row level security;
alter table worker_customer_clearances   enable row level security;
alter table notifications                enable row level security;
alter table audit_log                    enable row level security;

-- --- tenant root
create policy customers_read on customers for select
  using (can_access_customer(id));
create policy customers_write on customers for all
  using (is_agency()) with check (is_agency());

create policy domains_read on custom_domains for select
  using (can_access_customer(customer_id));
create policy domains_write on custom_domains for all
  using (is_agency()) with check (is_agency());

-- --- users: customer users see only their own org's users
create policy users_read on app_users for select
  using (
    is_agency()
    or (user_type = 'customer' and customer_id = auth_customer_id())
  );
-- A customer_admin manages their own org's users. The WITH CHECK pins
-- user_type and forbids agency_role so they cannot escalate anyone to staff.
create policy users_write on app_users for all
  using (
    is_agency()
    or (customer_id = auth_customer_id() and auth_customer_role() = 'customer_admin')
  )
  with check (
    is_agency()
    or (customer_id = auth_customer_id()
        and user_type = 'customer'
        and agency_role is null)
  );

-- --- sites
create policy sites_read on sites for select
  using (can_access_customer(customer_id) and deleted_at is null);
create policy sites_write on sites for all
  using (can_access_customer(customer_id))
  with check (can_access_customer(customer_id));

create policy site_contacts_all on site_contacts for all
  using (can_access_customer(customer_id))
  with check (can_access_customer(customer_id));

-- --- rates: hide from customer if show_bill_rates is off.
-- Global rows (customer_id is null) MUST be readable, otherwise a tenant with
-- no rate overrides sees no rates at all.
create policy rates_read on craft_level_rates for select
  using (
    is_agency()
    or ((craft_level_rates.customer_id is null
         or craft_level_rates.customer_id = auth_customer_id())
        and exists (select 1 from customers c
                     where c.id = auth_customer_id() and c.show_bill_rates))
  );
create policy rates_write on craft_level_rates for all
  using (is_agency()) with check (is_agency());

-- --- credentials catalog: global rows + own-tenant rows
create policy credentials_read on credentials for select
  using (customer_id is null or can_access_customer(customer_id));
create policy credentials_write on credentials for all
  using (is_agency()) with check (is_agency());

create policy customer_credentials_read on customer_credentials for select
  using (can_access_customer(customer_id));
create policy customer_credentials_write on customer_credentials for all
  using (is_agency()) with check (is_agency());

-- --- requisitions
create policy req_read on requisitions for select
  using (can_access_customer(customer_id) and deleted_at is null);
create policy req_insert on requisitions for insert
  with check (can_access_customer(customer_id));
create policy req_update on requisitions for update
  using (
    is_agency()
    or (customer_id = auth_customer_id() and status in ('draft','pending_approval','submitted'))
  )
  with check (can_access_customer(customer_id));
create policy req_delete on requisitions for delete
  using (is_agency() or (customer_id = auth_customer_id() and status = 'draft'));

-- Lines and requirements inherit the HEADER's editability window. Without this,
-- a requester could change quantity or bill_rate on an active requisition that
-- already has crew on site.
create policy req_lines_read on requisition_lines for select
  using (can_access_customer(customer_id));
create policy req_lines_write on requisition_lines for all
  using (
    is_agency()
    or exists (select 1 from requisitions r
                where r.id = requisition_id
                  and r.customer_id = auth_customer_id()
                  and r.status in ('draft','pending_approval','submitted'))
  )
  with check (
    is_agency()
    or exists (select 1 from requisitions r
                where r.id = requisition_id
                  and r.customer_id = auth_customer_id()
                  and r.status in ('draft','pending_approval','submitted'))
  );

create policy req_reqs_read on requisition_requirements for select
  using (exists (select 1 from requisitions r
                 where r.id = requisition_id and can_access_customer(r.customer_id)));
create policy req_reqs_write on requisition_requirements for all
  using (exists (select 1 from requisitions r
                 where r.id = requisition_id
                   and (is_agency() or (r.customer_id = auth_customer_id()
                        and r.status in ('draft','pending_approval','submitted')))))
  with check (exists (select 1 from requisitions r
                 where r.id = requisition_id
                   and (is_agency() or (r.customer_id = auth_customer_id()
                        and r.status in ('draft','pending_approval','submitted')))));

create policy req_line_reqs_read on requisition_line_requirements for select
  using (exists (select 1 from requisition_lines l
                 where l.id = requisition_line_id and can_access_customer(l.customer_id)));
create policy req_line_reqs_write on requisition_line_requirements for all
  using (exists (select 1 from requisition_lines l
                 join requisitions r on r.id = l.requisition_id
                 where l.id = requisition_line_id
                   and (is_agency() or (r.customer_id = auth_customer_id()
                        and r.status in ('draft','pending_approval','submitted')))))
  with check (exists (select 1 from requisition_lines l
                 join requisitions r on r.id = l.requisition_id
                 where l.id = requisition_line_id
                   and (is_agency() or (r.customer_id = auth_customer_id()
                        and r.status in ('draft','pending_approval','submitted')))));

create policy req_attach_read on requisition_attachments for select
  using (can_access_customer(customer_id) and (is_agency() or not is_internal));
create policy req_attach_write on requisition_attachments for all
  using (can_access_customer(customer_id))
  with check (can_access_customer(customer_id) and (is_agency() or not is_internal));

create policy req_comments_read on requisition_comments for select
  using (can_access_customer(customer_id) and (is_agency() or not is_internal));
create policy req_comments_insert on requisition_comments for insert
  with check (can_access_customer(customer_id) and (is_agency() or not is_internal));
create policy req_comments_update on requisition_comments for update
  using (author_id = auth_user_id() and can_access_customer(customer_id))
  with check (author_id = auth_user_id());
create policy req_comments_delete on requisition_comments for delete
  using (is_agency() or author_id = auth_user_id());

-- --- placements: THE critical rule.
-- Customers see a placement only once it has been submitted to them.
create policy placements_read on placements for select
  using (
    is_agency()
    or (customer_id = auth_customer_id() and is_customer_visible = true)
  );
create policy placements_write on placements for all
  using (is_agency()) with check (is_agency());
-- Customer approve/decline goes through customer_decide_placement() (section 15),
-- a SECURITY DEFINER RPC, not a direct UPDATE.

create policy placement_events_read on placement_events for select
  using (
    is_agency()
    or exists (select 1 from placements p
               where p.id = placement_id
                 and p.customer_id = auth_customer_id()
                 and p.is_customer_visible)
  );
create policy placement_events_write on placement_events for all
  using (is_agency()) with check (is_agency());

-- --- workers: agency-only by default. Customers reach worker data only through
-- the customer_candidate_view below, which exposes a redacted projection.
create policy workers_agency on workers for all
  using (is_agency()) with check (is_agency());
create policy worker_credentials_agency on worker_credentials for all
  using (is_agency()) with check (is_agency());
create policy worker_crafts_agency on worker_crafts for all
  using (is_agency()) with check (is_agency());
create policy clearances_read on worker_customer_clearances for select
  using (can_access_customer(customer_id));
create policy clearances_write on worker_customer_clearances for all
  using (is_agency()) with check (is_agency());

-- --- notifications: read/update your own, but INSERT is deliberately closed.
-- A FOR ALL policy keyed on user_id = auth_user_id() makes it impossible to
-- notify anyone else, which kills every cross-user event ("recruiter, a req was
-- submitted"). Writes go through emit_notification() in section 15.
create policy notifications_read on notifications for select
  using (user_id = auth_user_id());
create policy notifications_update_own on notifications for update
  using (user_id = auth_user_id()) with check (user_id = auth_user_id());
create policy notifications_delete_own on notifications for delete
  using (user_id = auth_user_id());

-- --- audit: readable by tenant, never client-writable (definer function only).
create policy audit_read on audit_log for select
  using (is_agency() or customer_id = auth_customer_id());
create policy audit_no_client_insert on audit_log for insert with check (false);

-- --- remaining tables. Every table in `public` must have RLS enabled, even
-- when the policy is simply "agency only" or "global read". The CI check that
-- fails the build on rowsecurity = false depends on this being exhaustive.

-- site access grants: scoped through the site's tenant
alter table user_site_access enable row level security;
create policy user_site_access_all on user_site_access for all
  using (exists (select 1 from sites s
                  where s.id = site_id and can_access_customer(s.customer_id)))
  with check (exists (select 1 from sites s
                  where s.id = site_id and can_access_customer(s.customer_id)));

-- global reference catalogs: everyone signed in reads, only agency writes
alter table crafts enable row level security;
create policy crafts_read  on crafts for select using (auth_user_type() is not null);
create policy crafts_write on crafts for all
  using (is_agency()) with check (is_agency());

alter table levels enable row level security;
create policy levels_read  on levels for select using (auth_user_type() is not null);
create policy levels_write on levels for all
  using (is_agency()) with check (is_agency());

-- per-user preferences: own rows only
alter table notification_preferences enable row level security;
create policy notif_prefs_own on notification_preferences for all
  using (user_id = auth_user_id()) with check (user_id = auth_user_id());

-- email log holds addresses across every tenant: agency only
alter table email_log enable row level security;
create policy email_log_agency on email_log for all
  using (is_agency()) with check (is_agency());

-- integration plumbing: agency only, never customer-readable
alter table integration_sync_runs enable row level security;
create policy sync_runs_agency on integration_sync_runs for all
  using (is_agency()) with check (is_agency());

alter table integration_entity_map enable row level security;
create policy entity_map_agency on integration_entity_map for all
  using (is_agency()) with check (is_agency());

alter table integration_outbox enable row level security;
create policy outbox_agency on integration_outbox for all
  using (is_agency()) with check (is_agency());


-- =====================================================================
-- 13. VIEWS
-- =====================================================================

-- !! SECURITY NOTE — READ BEFORE ADDING A VIEW !!
-- In Postgres, a view defaults to security_invoker = false, which means it runs
-- with the VIEW OWNER's privileges and therefore BYPASSES the caller's RLS on
-- the underlying tables. A tenant-scoped view without `security_invoker = true`
-- is a cross-tenant data leak. Every view below is either marked
-- security_invoker = true, or carries its own explicit tenant predicate AND
-- security_barrier = true.
-- There is a regression test for this in tests/rls.test.ts — keep it passing.

-- Fill progress per requisition, used on both dashboards.
-- LEFT JOIN so a requisition with no lines yet still appears (at 0%) instead of
-- silently vanishing from the dashboard.
create or replace view requisition_fill_summary
with (security_invoker = true) as
select
  r.id                                               as requisition_id,
  r.customer_id,
  coalesce(sum(l.quantity), 0)                       as total_requested,
  coalesce(sum(l.filled_count), 0)                   as total_filled,
  coalesce(sum(l.quantity) - sum(l.filled_count), 0) as total_open,
  count(l.id) filter (where l.status = 'open')       as open_lines,
  round(100.0 * coalesce(sum(l.filled_count), 0)
        / nullif(sum(l.quantity), 0), 1)             as pct_filled
from requisitions r
left join requisition_lines l
       on l.requisition_id = r.id and l.status <> 'cancelled'
where r.deleted_at is null
group by r.id, r.customer_id;

-- Redacted candidate projection for the customer portal.
-- This one is DELIBERATELY a definer view: customers have no RLS grant on
-- `workers`, so an invoker view would return nothing. Because RLS is bypassed
-- here, the tenant predicate is written into the view body itself (see the
-- WHERE clause) and must never be removed. security_barrier stops the planner
-- from evaluating a cheap user-supplied qual before that predicate.
-- Contact info is exposed only if the customer is configured for it.
create or replace view customer_candidate_view
with (security_invoker = false, security_barrier = true) as
select
  p.id                    as placement_id,
  p.customer_id,
  p.requisition_id,
  p.requisition_line_id,
  p.stage,
  p.stage_changed_at,
  p.submitted_at,
  p.scheduled_start_date,
  p.actual_start_date,
  p.credential_ready,
  p.credential_gaps,
  w.first_name,
  left(w.last_name, 1) || '.'  as last_initial,
  case when c.show_worker_contact_info then w.last_name end as last_name,
  case when c.show_worker_contact_info then w.phone     end as phone,
  case when c.show_worker_contact_info then w.email::text end as email,
  w.years_experience,
  cr.name                 as craft_name,
  lv.name                 as level_name,
  w.home_city, w.home_state
from placements p
join customers c on c.id = p.customer_id
join workers   w on w.id = p.worker_id
join requisition_lines rl on rl.id = p.requisition_line_id
join crafts cr on cr.id = rl.craft_id
join levels lv on lv.id = rl.level_id
where p.is_customer_visible = true
  -- tenant guard: this view bypasses RLS, so it filters itself
  and (is_agency() or p.customer_id = auth_customer_id());

-- Effective credential requirements for a line (header union line).
-- Aggregate ACROSS the union, not after it: a plain UNION of two pre-aggregated
-- selects dedupes whole rows, so a header "required" plus a line "preferred"
-- would emit two contradictory rows for the same credential.
create or replace view line_effective_requirements
with (security_invoker = true) as
with unioned as (
  select l.id as requisition_line_id, l.customer_id, rr.credential_id,
         rr.is_required, rr.state_code
    from requisition_lines l
    join requisition_requirements rr on rr.requisition_id = l.requisition_id
  union all
  select lr.requisition_line_id, l.customer_id, lr.credential_id,
         lr.is_required, lr.state_code
    from requisition_line_requirements lr
    join requisition_lines l on l.id = lr.requisition_line_id
)
select requisition_line_id,
       customer_id,
       credential_id,
       bool_or(is_required) as is_required,   -- required wins over preferred
       min(state_code)      as state_code
  from unioned
 group by requisition_line_id, customer_id, credential_id;

-- Credentials expiring in the next 60 days for workers on active placements.
-- Internal view: reads `workers`, which customers have no policy on, so with
-- security_invoker = true a customer session correctly returns zero rows.
-- DISTINCT ON prevents one expiring card from being listed once per active
-- placement the worker happens to hold.
create or replace view credential_expiration_alerts
with (security_invoker = true) as
select distinct on (wc.id)
  w.id as worker_id,
  w.first_name || ' ' || w.last_name as worker_name,
  cd.code as credential_code,
  cd.name as credential_name,
  wc.expiration_date,
  (wc.expiration_date - current_date) as days_remaining,
  p.id as placement_id,
  p.customer_id,
  p.requisition_id
from worker_credentials wc
join workers w      on w.id = wc.worker_id
join credentials cd on cd.id = wc.credential_id
left join placements p on p.worker_id = w.id
     and p.stage in ('confirmed','started','onboarding','customer_approved')
where wc.state = 'verified'
  and wc.expiration_date is not null
  and wc.expiration_date <= current_date + interval '60 days'
order by wc.id, p.scheduled_start_date nulls last;


-- =====================================================================
-- 14. TRIGGERS
-- =====================================================================

create or replace function touch_updated_at() returns trigger
language plpgsql as $fn$
begin new.updated_at = now(); return new; end $fn$;

do $blk$
declare t text;
begin
  foreach t in array array[
    'customers','app_users','sites','requisitions','requisition_lines',
    'workers','worker_credentials','placements'
  ] loop
    execute format(
      'create trigger trg_%1$s_touch before update on %1$s
       for each row execute function touch_updated_at()', t);
  end loop;
end $blk$;

-- Denormalized tenant columns are the backbone of RLS here, and on
-- customer-writable tables they are also client-settable. Pin them to the
-- parent requisition so a row can never be re-parented into another tenant.
create or replace function pin_customer_from_requisition() returns trigger
language plpgsql as $fn$
begin
  select customer_id into new.customer_id from requisitions where id = new.requisition_id;
  return new;
end $fn$;

create trigger trg_req_lines_pin_customer
before insert or update of requisition_id, customer_id on requisition_lines
for each row execute function pin_customer_from_requisition();

create trigger trg_req_attachments_pin_customer
before insert or update of requisition_id, customer_id on requisition_attachments
for each row execute function pin_customer_from_requisition();

create trigger trg_req_comments_pin_customer
before insert or update of requisition_id, customer_id on requisition_comments
for each row execute function pin_customer_from_requisition();

-- sites.default_credential_ids is a uuid[]; Postgres has no FK on array
-- elements, so a deleted credential would leave a dangling id that silently
-- drops off the request form.
create or replace function check_site_default_credentials() returns trigger
language plpgsql as $fn$
begin
  if exists (
    select 1 from unnest(new.default_credential_ids) as id
     where not exists (select 1 from credentials c where c.id = id)
  ) then
    raise exception 'sites.default_credential_ids contains unknown credential id';
  end if;
  return new;
end $fn$;

create trigger trg_sites_default_credentials
before insert or update of default_credential_ids on sites
for each row execute function check_site_default_credentials();

-- Keep requisition_lines.filled_count and status in sync with placements.
-- NOTE: 'onboarding' and 'customer_approved' are NOT counted as filled — a slot
-- is filled only once the worker is cleared and scheduled. If ops wants the
-- dashboard to show badging-in-progress as filled, add them here.
create or replace function recalc_line_fill() returns trigger
language plpgsql as $fn$
declare
  -- NOT coalesce(new.…, old.…): in PL/pgSQL, OLD is unassigned during INSERT
  -- and NEW is unassigned during DELETE, so referencing the wrong one is an
  -- error rather than a null. Branch on TG_OP instead.
  v_line uuid := case tg_op when 'DELETE' then old.requisition_line_id
                            else new.requisition_line_id end;
  v_filled int;
  v_qty int;
begin
  if v_line is null then
    return null;
  end if;

  select count(*) into v_filled
    from placements
   where requisition_line_id = v_line
     and stage in ('confirmed','started','completed');

  select quantity into v_qty from requisition_lines where id = v_line;

  update requisition_lines
     set filled_count = v_filled,
         status = case
                    when status in ('cancelled','closed') then status
                    when v_filled >= v_qty then 'filled'
                    when v_filled > 0      then 'partially_filled'
                    else 'open'
                  end
   where id = v_line;

  return null;
end $fn$;

create trigger trg_placements_fill
after insert or update of stage or delete on placements
for each row execute function recalc_line_fill();

-- Log every stage change and flip customer visibility at the right moment.
create or replace function log_placement_stage() returns trigger
language plpgsql as $fn$
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_changed_at = now();

    -- Visibility is sticky once earned, but it is only EARNED by entering a
    -- stage that implies the customer has actually seen this candidate.
    -- Do NOT use `new.stage >= 'submitted_to_customer'`: 'withdrawn' and
    -- 'removed' sort after it in the enum but can happen while the candidate
    -- is still internal-only.
    if old.is_customer_visible
       or new.stage = any (placement_customer_visible_stages()) then
      new.is_customer_visible = true;
    end if;

    if new.stage = 'submitted_to_customer' and new.submitted_at is null then
      new.submitted_at = now();
    end if;

    insert into placement_events (placement_id, from_stage, to_stage, actor_id, actor_type)
    values (new.id, old.stage, new.stage, auth_user_id(),
            nullif(auth_user_type(), '')::user_type);
  end if;
  return new;
end $fn$;

create trigger trg_placement_stage
before update on placements
for each row execute function log_placement_stage();

-- Requisition number generator: {CUSTOMER_SLUG}-{YYYY}-{NNNN}
-- Per-customer, per-year counter rather than one global sequence, so ACME's
-- first requisition of 2027 is ACME-2027-0001 and not ACME-2027-0873.
-- The year comes from the operating timezone, not the server's: a req entered
-- at 6pm CST on Dec 31 belongs to that year.
create table req_number_counters (
  customer_id uuid not null references customers(id) on delete cascade,
  year        int  not null,
  last_value  int  not null default 0,
  primary key (customer_id, year)
);
alter table req_number_counters enable row level security;
create policy req_counters_agency on req_number_counters for all
  using (is_agency()) with check (is_agency());

create or replace function assign_req_number() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_slug text; v_year int; v_n int;
begin
  if new.req_number is null then
    select upper(slug) into v_slug from customers where id = new.customer_id;
    v_year := extract(year from (now() at time zone 'America/Chicago'))::int;

    insert into req_number_counters (customer_id, year, last_value)
    values (new.customer_id, v_year, 1)
    on conflict (customer_id, year)
      do update set last_value = req_number_counters.last_value + 1
    returning last_value into v_n;

    new.req_number := v_slug || '-' || v_year::text || '-' || lpad(v_n::text, 4, '0');
  end if;
  return new;
end $fn$;
-- Trade-off: this serializes concurrent inserts per (customer, year) and rolls
-- the number back on abort — no gaps, at the cost of a brief row lock. That is
-- the right trade for a customer-facing document number.

create trigger trg_req_number
before insert on requisitions
for each row execute function assign_req_number();


-- =====================================================================
-- 15. SECURITY DEFINER RPCs
-- =====================================================================
-- The tables above are deliberately not directly writable for these paths.
-- Everything a customer user is allowed to *do* (as opposed to read) that
-- touches agency-owned rows goes through one of these.

-- Customer approves or declines a candidate they have been shown.
create or replace function customer_decide_placement(
  p_placement_id uuid,
  p_approve      boolean,
  p_reason       text default null
) returns placements
language plpgsql security definer set search_path = public as $fn$
declare v_p placements; v_uid uuid := auth_user_id();
begin
  select * into v_p from placements where id = p_placement_id;
  if not found then
    raise exception 'placement not found';
  end if;

  -- Caller must belong to this tenant (or be agency acting on their behalf),
  -- and the candidate must actually have been submitted to them.
  if not (is_agency() or (v_p.customer_id = auth_customer_id() and v_p.is_customer_visible)) then
    raise exception 'not authorized for this placement';
  end if;

  if v_p.stage not in ('submitted_to_customer','customer_reviewing') then
    raise exception 'placement is not awaiting a customer decision (stage: %)', v_p.stage;
  end if;

  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'a decline reason is required';
  end if;

  update placements
     set stage                = case when p_approve then 'customer_approved'
                                     else 'customer_declined' end,
         customer_decision_at = now(),
         customer_decision_by = v_uid,
         decline_reason       = case when p_approve then null else p_reason end
   where id = p_placement_id
   returning * into v_p;

  return v_p;
end $fn$;

revoke all on function customer_decide_placement(uuid, boolean, text) from public;

-- System-generated notifications, including for users other than the caller.
create or replace function emit_notification(
  p_user_id     uuid,
  p_event_key   text,
  p_title       text,
  p_body        text default null,
  p_link_path   text default null,
  p_entity_type text default null,
  p_entity_id   uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_customer uuid;
begin
  select customer_id into v_customer from app_users where id = p_user_id;
  insert into notifications (user_id, customer_id, event_key, title, body,
                             link_path, entity_type, entity_id)
  values (p_user_id, v_customer, p_event_key, p_title, p_body,
          p_link_path, p_entity_type, p_entity_id)
  returning id into v_id;
  return v_id;
end $fn$;

revoke all on function emit_notification(uuid, text, text, text, text, text, uuid) from public;


-- =====================================================================
-- 16. FORCE RLS  (enable once your seed/migration role is sorted)
-- =====================================================================
-- RLS does NOT apply to a table's owner unless FORCE is set. If any application
-- path connects as the owning role, every policy above is decoration.
-- Uncomment after confirming your migration/seed role is BYPASSRLS or has
-- explicit policies, otherwise backfills will start failing.
--
-- do $blk$
-- declare t text;
-- begin
--   foreach t in array array[
--     'customers','custom_domains','app_users','user_site_access','sites',
--     'site_contacts','craft_level_rates','credentials','customer_credentials',
--     'requisitions','requisition_lines','requisition_requirements',
--     'requisition_line_requirements','requisition_attachments',
--     'requisition_comments','placements','placement_events','workers',
--     'worker_credentials','worker_crafts','worker_customer_clearances',
--     'notifications','notification_preferences','email_log','audit_log',
--     'integration_sync_runs','integration_entity_map','integration_outbox'
--   ] loop
--     execute format('alter table %I force row level security', t);
--   end loop;
-- end $blk$;

-- =====================================================================
-- SOURCE: supabase/migrations/20260906120000_custom_access_token_hook.sql
-- =====================================================================

-- =====================================================================
-- CUSTOM ACCESS TOKEN HOOK
-- =====================================================================
-- Every RLS policy in this database reads:
--     request.jwt.claims -> 'app_metadata' ->> 'user_type'   (and customer_id)
--
-- Supabase does NOT populate those by default. This hook runs whenever an
-- access token is minted and copies the authoritative values out of app_users
-- into the token's app_metadata claim.
--
-- Until this hook is BOTH installed here AND enabled in the dashboard
-- (Authentication -> Hooks -> Customize Access Token (JWT) Claims), every
-- policy evaluates against a null user_type and returns zero rows.
--
-- SECURITY: the client can never influence these values. They are read
-- server-side from app_users at token-mint time. A user editing their own
-- app_metadata through the client API cannot affect what this writes, because
-- the hook overwrites those keys on every token issuance.
-- =====================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
-- Pinned explicitly: this executes as supabase_auth_admin, whose search_path
-- is not guaranteed to include public.
set search_path = public
as $fn$
declare
  v_claims jsonb;
  v_meta   jsonb;
  v_user   record;
begin
  select user_type, customer_id, customer_role, agency_role, is_active
    into v_user
    from public.app_users
   where id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_meta   := coalesce(v_claims -> 'app_metadata', '{}'::jsonb);

  if found and v_user.is_active then
    v_meta := v_meta || jsonb_build_object(
      'user_type',     v_user.user_type,
      'customer_id',   v_user.customer_id,
      'customer_role', v_user.customer_role,
      'agency_role',   v_user.agency_role
    );
  else
    -- No app_users row, or the account is deactivated: strip the claims
    -- entirely so the token authenticates but authorizes nothing. Every
    -- policy then sees a null user_type and returns no rows.
    v_meta := v_meta - 'user_type' - 'customer_id' - 'customer_role' - 'agency_role';
  end if;

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_meta);
  return jsonb_set(event, '{claims}', v_claims);
end $fn$;

-- The hook executes as supabase_auth_admin, which is outside the normal
-- application roles and has no access to public by default.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on table public.app_users to supabase_auth_admin;

-- app_users has RLS enabled, so the grant alone is not enough — the auth admin
-- needs a policy of its own. Scoped to SELECT only.
-- Postgres has no CREATE POLICY IF NOT EXISTS, so drop first to stay rerunnable.
drop policy if exists app_users_auth_admin_read on public.app_users;
create policy app_users_auth_admin_read on public.app_users
  as permissive for select
  to supabase_auth_admin
  using (true);

-- No application role may call the hook directly.
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- =====================================================================
-- SOURCE: supabase/migrations/20260906130000_fill_progress_and_rate_visibility.sql
-- =====================================================================

-- =====================================================================
-- FILL PROGRESS DETAIL + ROLE-SCOPED RATE VISIBILITY
-- =====================================================================
-- Two product decisions made concrete:
--
--  1. A slot is "filled" only when the worker is cleared and scheduled, but
--     the customer should still see how many are working through badging.
--     So filled_count keeps its strict meaning and onboarding_count is added
--     alongside it, rather than loosening what "filled" means.
--
--  2. Bill rates are visible to customer_admin and approver, not to every
--     user at the customer. show_bill_rates remains the company-level switch;
--     role is now an additional gate on top of it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Onboarding count alongside the strict fill count
-- ---------------------------------------------------------------------

alter table requisition_lines
  add column if not exists onboarding_count int not null default 0;

comment on column requisition_lines.filled_count is
  'Workers cleared and scheduled (confirmed/started/completed). Strict.';
comment on column requisition_lines.onboarding_count is
  'Workers accepted but not yet cleared (customer_approved/onboarding). '
  'Shown next to filled_count so progress is visible without overstating readiness.';

create or replace function recalc_line_fill() returns trigger
language plpgsql as $fn$
declare
  -- NOT coalesce(new.…, old.…): in PL/pgSQL, OLD is unassigned during INSERT
  -- and NEW is unassigned during DELETE, so referencing the wrong one is an
  -- error rather than a null. Branch on TG_OP instead.
  v_line uuid := case tg_op when 'DELETE' then old.requisition_line_id
                            else new.requisition_line_id end;
  v_filled     int;
  v_onboarding int;
  v_qty        int;
begin
  if v_line is null then
    return null;
  end if;

  select
    count(*) filter (where stage in ('confirmed','started','completed')),
    count(*) filter (where stage in ('customer_approved','onboarding'))
    into v_filled, v_onboarding
    from placements
   where requisition_line_id = v_line;

  select quantity into v_qty from requisition_lines where id = v_line;

  update requisition_lines
     set filled_count     = v_filled,
         onboarding_count = v_onboarding,
         status = case
                    when status in ('cancelled','closed') then status
                    when v_filled >= v_qty then 'filled'
                    when v_filled > 0      then 'partially_filled'
                    else 'open'
                  end
   where id = v_line;

  return null;
end $fn$;

-- Surface it on the dashboard rollup too.
-- CREATE OR REPLACE VIEW can only append columns at the end — inserting
-- total_onboarding mid-list fails with "cannot change name of view column".
-- Nothing depends on this view, so drop and recreate to keep a sane order.
drop view if exists requisition_fill_summary;

create view requisition_fill_summary
with (security_invoker = true) as
select
  r.id as requisition_id,
  r.customer_id,
  coalesce(sum(l.quantity), 0)                       as total_requested,
  coalesce(sum(l.filled_count), 0)                   as total_filled,
  coalesce(sum(l.onboarding_count), 0)               as total_onboarding,
  coalesce(sum(l.quantity) - sum(l.filled_count), 0) as total_open,
  count(l.id) filter (where l.status = 'open')       as open_lines,
  round(100.0 * coalesce(sum(l.filled_count), 0)
        / nullif(sum(l.quantity), 0), 1)             as pct_filled
from requisitions r
left join requisition_lines l
       on l.requisition_id = r.id and l.status <> 'cancelled'
where r.deleted_at is null
group by r.id, r.customer_id;

-- ---------------------------------------------------------------------
-- 2. Rate visibility: company switch AND role
-- ---------------------------------------------------------------------

create or replace function can_see_rates() returns boolean
language sql stable
set search_path = public
as $fn$
  select
    is_agency()
    or exists (
      select 1 from customers c
       where c.id = auth_customer_id()
         and c.show_bill_rates
         and auth_customer_role() in ('customer_admin','approver')
    );
$fn$;

drop policy if exists rates_read on craft_level_rates;
create policy rates_read on craft_level_rates for select
  using (
    (craft_level_rates.customer_id is null
     or craft_level_rates.customer_id = auth_customer_id()
     or is_agency())
    and can_see_rates()
  );

-- RLS is row-level, so it cannot mask a single column. requisition_lines.bill_rate
-- is therefore exposed through a view that nulls it for callers who may not see
-- rates. The app reads this view instead of the table for any customer-facing
-- screen; the underlying table stays available to agency tooling.
create or replace view requisition_lines_visible
with (security_invoker = true) as
select
  l.id,
  l.requisition_id,
  l.customer_id,
  l.line_number,
  l.craft_id,
  l.level_id,
  l.quantity,
  l.filled_count,
  l.onboarding_count,
  l.status,
  l.start_date,
  l.end_date,
  l.hours_per_day,
  l.days_per_week,
  l.per_diem_rate,
  l.notes,
  case when can_see_rates() then l.bill_rate end       as bill_rate,
  -- target_pay_rate is what we intend to pay the worker. That is never a
  -- customer's business, at any role.
  case when is_agency() then l.target_pay_rate end     as target_pay_rate,
  c.name  as craft_name,
  c.code  as craft_code,
  lv.name as level_name,
  lv.code as level_code,
  lv.rank as level_rank
from requisition_lines l
join crafts c  on c.id = l.craft_id
join levels lv on lv.id = l.level_id;

-- =====================================================================
-- SOURCE: supabase/migrations/20260908120000_update_own_profile.sql
-- =====================================================================

-- =====================================================================
-- SELF-SERVICE PROFILE UPDATES
-- =====================================================================
-- app_users is writable by agency staff and by a customer_admin within their
-- own tenant. Everyone else — approvers, requesters, viewers — cannot edit
-- their own row, so they cannot correct their own name or phone number.
--
-- The obvious fix is a policy like `using (id = auth_user_id())`, and it is
-- wrong: RLS filters rows, not columns. Such a policy would also let any user
-- set their own customer_role to customer_admin, or move themselves to another
-- tenant. There is no WITH CHECK that prevents it, because the row would still
-- belong to them afterwards.
--
-- So the write goes through a definer function that touches exactly two
-- columns and always for the caller's own id.
-- =====================================================================

create or replace function update_own_profile(
  p_full_name text,
  p_phone     text
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth_user_id();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'A name is required';
  end if;

  update app_users
     set full_name = trim(p_full_name),
         phone     = nullif(trim(p_phone), '')
   where id = v_uid;
end $fn$;

-- Callable by any signed-in user; it can only ever write their own row.
revoke execute on function update_own_profile(text, text) from public, anon;
grant execute on function update_own_profile(text, text) to authenticated;

-- =====================================================================
-- SOURCE: supabase/migrations/20260908130000_customer_onsite_offsite.sql
-- =====================================================================

-- =====================================================================
-- CUSTOMER-SIDE ON SITE / OFF SITE
-- =====================================================================
-- The customer knows before anyone else when a worker actually walked through
-- the gate, and when they stopped. Letting them record it directly is both
-- more accurate and less work than relaying it.
--
-- placements is agency-write-only by policy, so this goes through definer
-- functions rather than loosening that. Each verifies the caller owns the
-- tenant AND that the placement was actually submitted to them — a customer
-- must not be able to touch someone they were never shown.
-- =====================================================================

/**
 * Mark a worker as on site.
 *
 * Only from the stages where it makes sense: approved, badging, or cleared.
 * Someone still awaiting review has not been agreed to yet, and someone
 * already started does not need starting again.
 */
create or replace function customer_mark_on_site(p_placement_id uuid)
returns placements
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_p placements;
begin
  select * into v_p from placements where id = p_placement_id;
  if not found then
    raise exception 'placement not found';
  end if;

  if not (
    is_agency()
    or (v_p.customer_id = auth_customer_id() and v_p.is_customer_visible)
  ) then
    raise exception 'not authorized for this placement';
  end if;

  if v_p.stage not in ('customer_approved', 'onboarding', 'confirmed') then
    raise exception 'This worker is not ready to be marked on site (currently %)', v_p.stage;
  end if;

  update placements
     set stage             = 'started',
         actual_start_date = coalesce(actual_start_date, current_date)
   where id = p_placement_id
   returning * into v_p;

  return v_p;
end $fn$;

/**
 * Mark a worker off site, with a reason.
 *
 * The reason is required and stored verbatim: why someone left is the single
 * most useful thing to know later, and a blank field would make the record
 * worthless. ROF and transfer are the two that recur; anything else is typed.
 */
create or replace function customer_mark_off_site(
  p_placement_id uuid,
  p_reason       text
)
returns placements
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_p placements;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  select * into v_p from placements where id = p_placement_id;
  if not found then
    raise exception 'placement not found';
  end if;

  if not (
    is_agency()
    or (v_p.customer_id = auth_customer_id() and v_p.is_customer_visible)
  ) then
    raise exception 'not authorized for this placement';
  end if;

  if v_p.stage <> 'started' then
    raise exception 'This worker is not on site (currently %)', v_p.stage;
  end if;

  update placements
     set stage           = 'ended_early',
         actual_end_date = current_date,
         end_reason      = trim(p_reason)
   where id = p_placement_id
   returning * into v_p;

  return v_p;
end $fn$;

revoke execute on function customer_mark_on_site(uuid) from public, anon;
revoke execute on function customer_mark_off_site(uuid, text) from public, anon;
grant execute on function customer_mark_on_site(uuid) to authenticated;
grant execute on function customer_mark_off_site(uuid, text) to authenticated;

-- =====================================================================
-- SOURCE: supabase/seed.sql
-- =====================================================================

-- =====================================================================
-- SEED — global reference data
-- Safe to re-run: every insert is ON CONFLICT DO NOTHING.
-- This is catalog data, not test data. Tenant/test fixtures belong in
-- supabase/fixtures/ so they never reach production.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Crafts. Trim or extend to match what US Trades actually places.
-- ---------------------------------------------------------------------
insert into crafts (code, name, category, sort_order) values
  ('PIPEFITTER',    'Pipefitter',            'Mechanical',  10),
  ('WELDER',        'Welder',                'Mechanical',  20),
  ('BOILERMAKER',   'Boilermaker',           'Mechanical',  30),
  ('MILLWRIGHT',    'Millwright',            'Mechanical',  40),
  ('RIGGER',        'Rigger',                'Mechanical',  50),
  ('ELECTRICIAN',   'Electrician',           'Electrical',  60),
  ('INSTRUMENT',    'Instrument Technician', 'Electrical',  70),
  ('SCAFFOLD',      'Scaffold Builder',      'Civil',       80),
  ('INSULATOR',     'Insulator',             'Civil',       90),
  ('CARPENTER',     'Carpenter',             'Civil',      100),
  ('IRONWORKER',    'Ironworker',            'Civil',      110),
  ('PAINTER',       'Painter / Blaster',     'Civil',      120),
  ('LABORER',       'General Laborer',       'Support',    130),
  ('OPERATOR',      'Equipment Operator',    'Support',    140),
  ('FIREWATCH',     'Fire Watch / Hole Watch','Support',   150),
  ('QC_INSPECTOR',  'QA/QC Inspector',       'Quality',    160),
  ('SAFETY_TECH',   'Safety Technician',     'Safety',     170)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Levels. `rank` drives sorting and "does this worker meet the ask" logic,
-- so leave gaps between values to allow inserts later.
-- ---------------------------------------------------------------------
insert into levels (code, name, rank) values
  ('APPRENTICE',      'Apprentice',       10),
  ('HELPER',          'Helper',           20),
  ('JOURNEYMAN',      'Journeyman',       30),
  ('LEAD',            'Lead',             40),
  ('FOREMAN',         'Foreman',          50),
  ('GENERAL_FOREMAN', 'General Foreman',  60),
  ('SUPERINTENDENT',  'Superintendent',   70)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Global credential catalog (customer_id is null = available to all tenants).
-- Tenant-specific credentials are added per customer at onboarding.
-- ---------------------------------------------------------------------
insert into credentials
  (code, name, short_label, kind, issuing_body, has_expiration,
   default_valid_days, requires_document, requires_number, requires_state,
   verification, sort_order)
values
  ('TWIC', 'Transportation Worker Identification Credential', 'TWIC Card',
   'card', 'TSA', true, 1825, true, true, false, 'document_upload', 10),

  ('DISA', 'DISA Consortium Membership / Drug Screen', 'DISA',
   'screening', 'DISA Global Solutions', true, 365, false, true, false,
   'third_party_lookup', 20),

  ('OSHA_10', 'OSHA 10-Hour Construction', 'OSHA 10',
   'training', 'OSHA', false, null, true, true, false, 'document_upload', 30),

  ('OSHA_30', 'OSHA 30-Hour Construction', 'OSHA 30',
   'training', 'OSHA', false, null, true, true, false, 'document_upload', 40),

  ('NCCER', 'NCCER Craft Certification', 'NCCER',
   'certification', 'NCCER', false, null, true, true, false,
   'third_party_lookup', 50),

  ('TWIC_ESCORT', 'TWIC Escort Trained', 'TWIC Escort',
   'training', null, true, 365, true, false, false, 'agency_verified', 60),

  ('BASIC_PLUS', 'Basic Plus Safety Council', 'Basic Plus',
   'training', 'Safety Council', true, 365, true, true, false,
   'document_upload', 70),

  ('CONFINED_SPACE', 'Confined Space Entry', 'Confined Space',
   'training', null, true, 365, true, false, false, 'document_upload', 80),

  ('FALL_PROTECTION', 'Fall Protection', 'Fall Protection',
   'training', null, true, 365, true, false, false, 'document_upload', 90),

  ('RESPIRATOR_FIT', 'Respirator Fit Test', 'Fit Test',
   'medical', null, true, 365, true, false, false, 'document_upload', 100),

  ('PHYSICAL', 'DOT / Site Physical', 'Physical',
   'medical', null, true, 730, true, false, false, 'document_upload', 110),

  ('BACKGROUND', 'Background Check', 'Background',
   'screening', null, true, 365, false, false, false, 'third_party_lookup', 120),

  ('STATE_LICENSE', 'State Trade License', 'State License',
   'license', null, true, null, true, true, true, 'document_upload', 130),

  ('DRIVERS_LICENSE', 'Driver License', 'Driver License',
   'license', null, true, null, true, true, true, 'document_upload', 140),

  ('CDL', 'Commercial Driver License', 'CDL',
   'license', null, true, null, true, true, true, 'document_upload', 150),

  ('WELD_CERT', 'Welder Qualification / WPS', 'Weld Cert',
   'certification', null, true, 180, true, true, false, 'agency_verified', 160),

  ('CRANE_CERT', 'NCCCO Crane Operator', 'NCCCO',
   'certification', 'NCCCO', true, 1825, true, true, false,
   'third_party_lookup', 170),

  ('H2S', 'H2S Awareness', 'H2S',
   'training', null, true, 365, true, false, false, 'document_upload', 180)
on conflict do nothing;

-- =====================================================================
-- FIRST AGENCY LOGIN
-- =====================================================================
-- Create the auth account first (Authentication -> Users -> Add user, with
-- Auto Confirm User ticked), then run this with that user's id and email.
-- The email is read from auth.users so the two cannot drift apart.
--
--   insert into app_users (id, email, full_name, user_type, agency_role)
--   select u.id, u.email, 'Your Name', 'agency', 'super_admin'
--     from auth.users u
--    where u.id = 'PASTE-THE-AUTH-USER-ID-HERE'
--   on conflict (id) do nothing;
--
-- Sign in, and create every customer and login from the agency console.
-- =====================================================================
