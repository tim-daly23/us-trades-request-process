-- =====================================================================
-- INTERNAL TEAM MEMBERS, SCOPED TO THE CUSTOMERS THEY ARE ASSIGNED
-- =====================================================================
-- Until now "agency" meant "sees everything". That was fine while the only
-- staff account was the owner's. The moment a second recruiter exists it is
-- wrong: they should see the customers they run, and not the rest.
--
-- The change is deliberately made in the database rather than in the app.
-- Every agency screen reads through RLS, so scoping can_access_customer()
-- scopes the whole portal at once — including any screen written later that
-- forgets to filter, and including anyone hitting the REST API directly with
-- their own token.
--
-- The model:
--   super_admin        — every customer, always. Creates staff and assigns them.
--   any other role     — exactly the customers assigned in the table below.
--
-- What is NOT scoped, on purpose:
--   * the worker roster. Workers belong to US Trades, not to a customer, and
--     a recruiter sourcing for one job needs to see who is on the bench for
--     every other. Placing a worker is still gated, because placements carry
--     a customer_id.
--   * crafts, levels and the global credential catalogue — reference data.
-- =====================================================================

create table if not exists agency_customer_assignments (
  app_user_id  uuid not null references app_users(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  assigned_by  uuid references app_users(id),
  assigned_at  timestamptz not null default now(),
  primary key (app_user_id, customer_id)
);

create index if not exists agency_customer_assignments_customer_idx
  on agency_customer_assignments (customer_id);

comment on table agency_customer_assignments is
  'Which US Trades staff may reach which customer. super_admin ignores this table and reaches all of them.';

alter table agency_customer_assignments enable row level security;


-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function auth_agency_role() returns text
language sql stable as $fn$
  select nullif(jwt_claims() -> 'app_metadata' ->> 'agency_role', '');
$fn$;

-- The unrestricted tier. Kept to a single role rather than a list: "who can
-- see every customer" is a question that should have an obvious answer.
create or replace function is_agency_admin() returns boolean
language sql stable as $fn$
  select auth_user_type() = 'agency' and auth_agency_role() = 'super_admin';
$fn$;

-- SECURITY DEFINER because this is called from the policy ON the assignments
-- table's own siblings and must not re-enter RLS to answer.
create or replace function can_access_customer(target uuid) returns boolean
language sql stable
security definer
set search_path = public
as $fn$
  select case
    when target is null then false
    when auth_user_type() = 'agency' then
      is_agency_admin()
      or exists (
        select 1 from agency_customer_assignments a
         where a.app_user_id = auth_user_id()
           and a.customer_id = target
      )
    else auth_customer_id() is not null and auth_customer_id() = target
  end;
$fn$;

comment on function can_access_customer(uuid) is
  'True when the caller may reach this tenant: their own company for a customer user, an assigned (or any, for super_admin) company for staff.';


-- ---------------------------------------------------------------------
-- Who may see and change the assignments themselves
-- ---------------------------------------------------------------------

drop policy if exists agency_assignments_read on agency_customer_assignments;
create policy agency_assignments_read on agency_customer_assignments for select
  using (is_agency_admin() or app_user_id = auth_user_id());

drop policy if exists agency_assignments_write on agency_customer_assignments;
create policy agency_assignments_write on agency_customer_assignments for all
  using (is_agency_admin()) with check (is_agency_admin());


-- =====================================================================
-- BACKFILL — before any policy starts enforcing the new rule
-- =====================================================================
-- Everyone who is staff today already had access to every customer. Write
-- that down as explicit assignments so this migration takes nothing away
-- from anyone; new restrictions apply to people added from here on.
insert into agency_customer_assignments (app_user_id, customer_id)
select u.id, c.id
  from app_users u
 cross join customers c
 where u.user_type = 'agency'
on conflict do nothing;

-- If no super_admin exists, nobody could assign anyone and the portal would
-- have locked itself. The founding account becomes the admin.
do $$
begin
  if not exists (
    select 1 from app_users
     where user_type = 'agency' and agency_role = 'super_admin'
  ) then
    update app_users
       set agency_role = 'super_admin'
     where id = (
       select id from app_users
        where user_type = 'agency'
        order by created_at
        limit 1
     );
  end if;
end $$;


-- =====================================================================
-- REWRITE EVERY POLICY THAT SAID "is_agency()" ABOUT A TENANT ROW
-- =====================================================================
-- is_agency() keeps its meaning — "is US Trades staff" — and is still the
-- right test for things that are about staff-vs-customer rather than about
-- which company a row belongs to (internal comments, pay rates as a column).
-- Anywhere it stood in for "and therefore may reach this customer", it is
-- replaced by can_access_customer().

-- --- tenant root -----------------------------------------------------
drop policy if exists customers_write on customers;
-- Creating a customer cannot be assignment-scoped: the assignment does not
-- exist yet. So it is the admin's job, and the admin then delegates.
create policy customers_insert on customers for insert
  with check (is_agency_admin());
create policy customers_update on customers for update
  using (can_access_customer(id) and is_agency())
  with check (can_access_customer(id) and is_agency());
create policy customers_delete on customers for delete
  using (is_agency_admin());

drop policy if exists domains_write on custom_domains;
create policy domains_write on custom_domains for all
  using (is_agency() and can_access_customer(customer_id))
  with check (is_agency() and can_access_customer(customer_id));

-- --- users -----------------------------------------------------------
-- Staff can see each other (the team page needs it). Customer contacts are
-- visible only for companies the caller is on.
drop policy if exists users_read on app_users;
create policy users_read on app_users for select
  using (
    (user_type = 'agency' and is_agency())
    or (user_type = 'customer' and can_access_customer(customer_id))
  );

-- Writing a STAFF row is admin-only. This closes a hole that predates
-- assignments: a plain `using (is_agency())` let any staff member update any
-- app_users row, their own included, and so hand themselves any agency_role
-- they liked. Changing your own name and phone still works — that goes
-- through update_own_profile(), which writes those two columns and nothing else.
drop policy if exists users_write on app_users;
create policy users_write on app_users for all
  using (
    (user_type = 'agency' and is_agency_admin())
    or (user_type = 'customer' and (
          (is_agency() and can_access_customer(customer_id))
          or (customer_id = auth_customer_id()
              and auth_customer_role() = 'customer_admin')
       ))
  )
  with check (
    (user_type = 'agency' and is_agency_admin() and customer_id is null)
    or (user_type = 'customer' and (
          (is_agency() and can_access_customer(customer_id))
          or (customer_id = auth_customer_id() and agency_role is null)
       ))
  );

-- --- rates -----------------------------------------------------------
-- Global rows (customer_id is null) are the standard rate card: every staff
-- member reads them, only an admin changes them.
drop policy if exists rates_read on craft_level_rates;
create policy rates_read on craft_level_rates for select
  using (
    (craft_level_rates.customer_id is null
     or can_access_customer(craft_level_rates.customer_id))
    and can_see_rates()
  );

drop policy if exists rates_write on craft_level_rates;
create policy rates_write on craft_level_rates for all
  using (
    case when customer_id is null then is_agency_admin()
         else is_agency() and can_access_customer(customer_id) end
  )
  with check (
    case when customer_id is null then is_agency_admin()
         else is_agency() and can_access_customer(customer_id) end
  );

-- --- credentials -----------------------------------------------------
drop policy if exists credentials_write on credentials;
create policy credentials_write on credentials for all
  using (
    case when customer_id is null then is_agency_admin()
         else is_agency() and can_access_customer(customer_id) end
  )
  with check (
    case when customer_id is null then is_agency_admin()
         else is_agency() and can_access_customer(customer_id) end
  );

drop policy if exists customer_credentials_write on customer_credentials;
create policy customer_credentials_write on customer_credentials for all
  using (is_agency() and can_access_customer(customer_id))
  with check (is_agency() and can_access_customer(customer_id));

-- --- requisitions ----------------------------------------------------
drop policy if exists req_update on requisitions;
create policy req_update on requisitions for update
  using (
    (is_agency() and can_access_customer(customer_id))
    or (customer_id = auth_customer_id()
        and status in ('draft','pending_approval','submitted'))
  )
  with check (can_access_customer(customer_id));

drop policy if exists req_delete on requisitions;
create policy req_delete on requisitions for delete
  using (
    (is_agency() and can_access_customer(customer_id))
    or (customer_id = auth_customer_id() and status = 'draft')
  );

drop policy if exists req_lines_write on requisition_lines;
create policy req_lines_write on requisition_lines for all
  using (
    (is_agency() and can_access_customer(customer_id))
    or exists (select 1 from requisitions r
                where r.id = requisition_id
                  and r.customer_id = auth_customer_id()
                  and r.status in ('draft','pending_approval','submitted'))
  )
  with check (
    (is_agency() and can_access_customer(customer_id))
    or exists (select 1 from requisitions r
                where r.id = requisition_id
                  and r.customer_id = auth_customer_id()
                  and r.status in ('draft','pending_approval','submitted'))
  );

drop policy if exists req_reqs_write on requisition_requirements;
create policy req_reqs_write on requisition_requirements for all
  using (exists (select 1 from requisitions r
                 where r.id = requisition_id
                   and ((is_agency() and can_access_customer(r.customer_id))
                        or (r.customer_id = auth_customer_id()
                            and r.status in ('draft','pending_approval','submitted')))))
  with check (exists (select 1 from requisitions r
                 where r.id = requisition_id
                   and ((is_agency() and can_access_customer(r.customer_id))
                        or (r.customer_id = auth_customer_id()
                            and r.status in ('draft','pending_approval','submitted')))));

drop policy if exists req_line_reqs_write on requisition_line_requirements;
create policy req_line_reqs_write on requisition_line_requirements for all
  using (exists (select 1 from requisition_lines l
                 join requisitions r on r.id = l.requisition_id
                 where l.id = requisition_line_id
                   and ((is_agency() and can_access_customer(r.customer_id))
                        or (r.customer_id = auth_customer_id()
                            and r.status in ('draft','pending_approval','submitted')))))
  with check (exists (select 1 from requisition_lines l
                 join requisitions r on r.id = l.requisition_id
                 where l.id = requisition_line_id
                   and ((is_agency() and can_access_customer(r.customer_id))
                        or (r.customer_id = auth_customer_id()
                            and r.status in ('draft','pending_approval','submitted')))));

drop policy if exists req_comments_delete on requisition_comments;
create policy req_comments_delete on requisition_comments for delete
  using (
    (is_agency() and can_access_customer(customer_id))
    or author_id = auth_user_id()
  );

-- --- placements ------------------------------------------------------
drop policy if exists placements_read on placements;
create policy placements_read on placements for select
  using (
    (is_agency() and can_access_customer(customer_id))
    or (customer_id = auth_customer_id() and is_customer_visible = true)
  );

drop policy if exists placements_write on placements;
create policy placements_write on placements for all
  using (is_agency() and can_access_customer(customer_id))
  with check (is_agency() and can_access_customer(customer_id));

drop policy if exists placement_events_read on placement_events;
create policy placement_events_read on placement_events for select
  using (exists (select 1 from placements p
                 where p.id = placement_id
                   and ((is_agency() and can_access_customer(p.customer_id))
                        or (p.customer_id = auth_customer_id()
                            and p.is_customer_visible))));

drop policy if exists placement_events_write on placement_events;
create policy placement_events_write on placement_events for all
  using (exists (select 1 from placements p
                 where p.id = placement_id
                   and is_agency() and can_access_customer(p.customer_id)))
  with check (exists (select 1 from placements p
                 where p.id = placement_id
                   and is_agency() and can_access_customer(p.customer_id)));

-- --- clearances ------------------------------------------------------
drop policy if exists clearances_write on worker_customer_clearances;
create policy clearances_write on worker_customer_clearances for all
  using (is_agency() and can_access_customer(customer_id))
  with check (is_agency() and can_access_customer(customer_id));

-- --- job log ---------------------------------------------------------
drop policy if exists customer_jobs_write on customer_jobs;
create policy customer_jobs_write on customer_jobs for all
  using (
    (is_agency() and can_access_customer(customer_id))
    or (customer_id = auth_customer_id()
        and auth_customer_role() in ('customer_admin', 'approver', 'requester'))
  )
  with check (
    (is_agency() and can_access_customer(customer_id))
    or (customer_id = auth_customer_id()
        and auth_customer_role() in ('customer_admin', 'approver', 'requester'))
  );

-- --- audit -----------------------------------------------------------
-- Rows with no customer_id are platform-level events; only an admin reads those.
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select
  using (
    case when customer_id is null then is_agency_admin()
         else can_access_customer(customer_id) end
  );


-- =====================================================================
-- The definer view has to re-state the rule, because it bypasses RLS
-- =====================================================================
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
  and can_access_customer(p.customer_id);


-- =====================================================================
-- SECURITY DEFINER RPCs carry their own authorisation, so they need it too
-- =====================================================================
-- Each of these ran `is_agency() or <caller is this tenant>`. The first half
-- becomes the assignment check; the customer half is unchanged.

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

  if not (
    (is_agency() and can_access_customer(v_p.customer_id))
    or (v_p.customer_id = auth_customer_id() and v_p.is_customer_visible)
  ) then
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

create or replace function set_request_job(
  p_requisition_id uuid,
  p_job_id         uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_customer uuid;
  v_job_customer uuid;
begin
  select customer_id into v_customer
    from requisitions where id = p_requisition_id;
  if v_customer is null then
    raise exception 'request not found';
  end if;

  if not can_access_customer(v_customer) then
    raise exception 'not authorized for this request';
  end if;

  if p_job_id is not null then
    select customer_id into v_job_customer
      from customer_jobs where id = p_job_id and deleted_at is null;
    if v_job_customer is null then
      raise exception 'job not found';
    end if;
    if v_job_customer <> v_customer then
      raise exception 'that job belongs to a different customer';
    end if;
  end if;

  update requisitions
     set customer_job_id = p_job_id
   where id = p_requisition_id;
end $fn$;

-- The three placement RPCs share one authorisation shape; expressed once so
-- it cannot drift between them.
create or replace function may_act_on_placement(p placements) returns boolean
language sql stable
set search_path = public
as $fn$
  select (is_agency() and can_access_customer(p.customer_id))
      or (p.customer_id = auth_customer_id() and p.is_customer_visible);
$fn$;

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

  if not may_act_on_placement(v_p) then
    raise exception 'not authorized for this placement';
  end if;

  if v_p.stage not in ('customer_approved', 'onboarding', 'confirmed') then
    raise exception 'This worker is not ready to be marked on site (currently %)', v_p.stage;
  end if;

  update placements
     set stage             = 'started',
         actual_start_date = coalesce(actual_start_date, scheduled_start_date, current_date)
   where id = p_placement_id
   returning * into v_p;

  return v_p;
end $fn$;

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

  if not may_act_on_placement(v_p) then
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

-- NB: the parameter is p_start, not p_start_date. CREATE OR REPLACE cannot
-- rename an input parameter, and the app calls it by name.
create or replace function customer_set_placement_start(
  p_placement_id uuid,
  p_start        date
)
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

  if not may_act_on_placement(v_p) then
    raise exception 'not authorized for this placement';
  end if;

  if v_p.stage in ('completed', 'ended_early', 'no_show', 'withdrawn', 'removed') then
    raise exception 'This placement has already finished';
  end if;

  if v_p.stage = 'started' then
    update placements set actual_start_date = p_start
     where id = p_placement_id returning * into v_p;
  else
    update placements set scheduled_start_date = p_start
     where id = p_placement_id returning * into v_p;
  end if;

  return v_p;
end $fn$;

revoke execute on function may_act_on_placement(placements) from public, anon;
grant execute on function may_act_on_placement(placements) to authenticated;
revoke execute on function is_agency_admin() from public, anon;
grant execute on function is_agency_admin() to authenticated;
revoke execute on function auth_agency_role() from public, anon;
grant execute on function auth_agency_role() to authenticated;

grant select, insert, update, delete on agency_customer_assignments to authenticated;
