-- =====================================================================
-- CUSTOMER JOB LOG
-- =====================================================================
-- The customer's own jobs, replacing the spreadsheet they keep alongside this
-- portal. Their numbering, their end clients, their project managers.
--
-- Deliberately NOT the same thing as a requisition. A job is the customer's
-- work — it exists whether or not they ever ask us for people, and one job may
-- produce several requests over months. requisitions.customer_job_id links the
-- two so a job number travels with the request instead of being copied into an
-- email.
--
-- Deliberately NOT the same thing as a site either. Their "site name" here is
-- free text describing where that job is, which may or may not correspond to a
-- site row we staff. Forcing the two together would mean a job could not be
-- logged until someone created a matching site.
-- =====================================================================

create table customer_jobs (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references customers(id) on delete cascade,

  job_number         text not null,
  date_created       date,
  status             text not null default 'Pending',

  -- Their client, not ours. On a job for Energy Transfer, M&D is our customer
  -- and Energy Transfer is theirs.
  end_customer       text,
  description        text,

  site_name          text,
  location           text,
  gps_coordinates    text,

  project_manager    text,
  site_contact_name  text,
  site_contact_phone text,

  per_diem_rate      numeric(10,2),
  twic_required      boolean not null default false,
  notes              text,

  -- Optional bridge to a site we actually staff. Null is normal and fine.
  site_id            uuid references sites(id) on delete set null,

  created_by         uuid references app_users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint customer_jobs_status_check
    check (status in ('Pending', 'Active', 'On Hold', 'Complete', 'Cancelled')),
  unique (customer_id, job_number)
);

create index on customer_jobs (customer_id, status);
create index on customer_jobs (customer_id, job_number);

create trigger trg_customer_jobs_touch
before update on customer_jobs
for each row execute function touch_updated_at();

alter table customer_jobs enable row level security;

-- Both sides read it: that is the point — a job number visible to us without
-- anyone emailing a spreadsheet.
create policy customer_jobs_read on customer_jobs for select
  using (can_access_customer(customer_id) and deleted_at is null);

-- Viewers do not write. Everyone else at the customer does, and so do we.
create policy customer_jobs_write on customer_jobs for all
  using (
    is_agency()
    or (customer_id = auth_customer_id()
        and auth_customer_role() in ('customer_admin', 'approver', 'requester'))
  )
  with check (
    is_agency()
    or (customer_id = auth_customer_id()
        and auth_customer_role() in ('customer_admin', 'approver', 'requester'))
  );

-- ---------------------------------------------------------------------
-- Link a request to the job it belongs to
-- ---------------------------------------------------------------------
alter table requisitions
  add column if not exists customer_job_id uuid references customer_jobs(id) on delete set null;

create index on requisitions (customer_job_id);
