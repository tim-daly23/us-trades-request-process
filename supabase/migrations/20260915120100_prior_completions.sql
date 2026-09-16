-- =====================================================================
-- Prior completions and effective clearance
--
-- Two facts the portal has to represent that the original design did not:
--
--   1. Most of the existing workforce already sat this orientation in person,
--      some of it years ago. They are being entered into a new system, not
--      newly hired. Making them retake it would be wrong, and manufacturing
--      a watch_progress row and a passing attempt for them would be worse:
--      that writes a record saying somebody watched 33 minutes of video on a
--      day they did not, and `attempts` is append-only so it could never be
--      taken back. An in-person completion is a real fact of a different kind
--      and gets its own table, with provenance.
--
--   2. A completion stands indefinitely UNLESS the worker has been off that
--      customer's projects for five years, at which point they retake. The
--      clock is per customer, measured from their last day actually on site
--      for that customer — so a pipefitter working steadily elsewhere still
--      lapses at M&D, which is the intent.
--
-- Clearance stays derived. Nothing here stores a `cleared` boolean.
--
-- One honest caveat: `prior_completions` is the first route to cleared that a
-- human asserts rather than the system measures, which is exactly what
-- non-negotiable rule 4 guards against. It is justified — the training did
-- happen — but it is admin-only, append-only, audited, carries evidence where
-- evidence exists, and every view that consumes it reports the BASIS, so a
-- paper record never renders identically to a measured one.
-- =====================================================================

create table prior_completions (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references people (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,

  completed_on  date not null,
  method        training_completion_method not null default 'in_person',

  -- Last day this worker was on site FOR THIS COURSE'S CUSTOMER, as known at
  -- backfill time. Their placement history predates this system and lives in
  -- TempWorks, so it is keyed in by hand. Once real placements accumulate the
  -- computed value takes over — see last_worked_for_customer().
  last_worked_on date,

  -- Scan of a sign-in sheet or certificate, in storage. Null is allowed and
  -- means exactly what it looks like: no document backs this record.
  evidence_path text,

  recorded_by   uuid not null references people (id),
  recorded_at   timestamptz not null default now(),
  notes         text,

  constraint completed_on_not_future check (completed_on <= current_date),
  unique (person_id, course_id)
);

create index prior_completions_course_idx on prior_completions (course_id);

alter table prior_completions enable row level security;

create policy prior_completions_self_read on prior_completions
  for select to authenticated
  using (person_id = auth.uid() or is_training_admin());

-- Admins insert; nobody updates or deletes. Append-only, like attempts.
create policy prior_completions_admin_insert on prior_completions
  for insert to authenticated
  with check (is_training_admin() and recorded_by = auth.uid());

-- =====================================================================
-- last_worked_for_customer()
--
-- The reset condition. A placement counts only once it reached 'started' —
-- badged, scheduled or approved but never turned up does not reset the clock.
--
-- A placement that is 'started' with no actual_end_date means they are on site
-- now, so the answer is today.
-- =====================================================================
create or replace function last_worked_for_customer(
  p_worker_id   uuid,
  p_customer_id uuid
)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select max(
    case
      when p.stage = 'started' and p.actual_end_date is null then current_date
      else coalesce(p.actual_end_date, p.actual_start_date)
    end
  )
  from placements p
  where p.worker_id = p_worker_id
    and p.customer_id = p_customer_id
    and p.stage in ('started', 'completed', 'ended_early');
$$;

-- =====================================================================
-- f_training_clearance() — the one definition of "is this person cleared".
--
-- Why a function and not just a view: the roster and the worker's own pages
-- need the same answer through two different privilege routes. A
-- `security_invoker` view gets the worker's own rows right, but nesting one
-- inside `v_customer_roster` (which must run as definer, because client_viewer
-- has no grant on the base tables) makes the inner view evaluate as the
-- *viewer*, and the roster comes back empty. Tested: that is exactly what
-- happened.
--
-- Two copies of the logic, one per route, would drift. So the logic lives here
-- once, as SECURITY DEFINER, and each consumer applies its own scoping:
--
--   v_training_clearance  — filtered to the caller (or an admin)
--   v_customer_roster     — filtered by viewer_scopes, columns narrowed
--
-- Nothing grants EXECUTE on this function to `authenticated`, so it is not a
-- back door: a worker cannot call it directly to read the whole company.
--
-- The lapse is an EXPIRY DATE ON THE EVIDENCE, not a flag on the person.
-- Evidence counts if the expiry has not arrived, or if it was earned after it.
-- Modelling it as a flag deadlocks: `lapsed` depends on last_worked_on, which
-- retaking does not change, so a returning worker could never clear again and
-- could not work until they did.
--
-- The expiry applies to the WATCH as well as the pass. Otherwise a worker back
-- after five years still has video_complete = true from the original viewing,
-- walks past step 1 and sits the check without seeing current safety content.
-- =====================================================================
create or replace function f_training_clearance_all()
returns table (
  person_id              uuid,
  course_id              uuid,
  customer_id            uuid,
  seconds_watched        integer,
  duration_seconds       integer,
  watch_ratio            numeric,
  best_score             integer,
  last_score             integer,
  attempt_count          bigint,
  passed_at              timestamptz,
  due_date               date,
  in_person_completed_on date,
  in_person_has_evidence boolean,
  last_worked_on         date,
  expires_on             date,
  lapsed                 boolean,
  video_complete         boolean,
  requires_rewatch       boolean,
  cleared_basis          text,
  cleared                boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cl.person_id,
    cl.course_id,
    cl.customer_id,
    cl.seconds_watched,
    cl.duration_seconds,
    cl.watch_ratio,
    cl.best_score,
    cl.last_score,
    cl.attempt_count,
    cl.passed_at,
    cl.due_date,

    pc.completed_on                as in_person_completed_on,
    pc.evidence_path is not null   as in_person_has_evidence,

    e.last_worked_on,
    e.expires_on,
    (e.expires_on is not null and current_date > e.expires_on) as lapsed,

    (cl.video_complete and v.watch_is_current)     as video_complete,
    (cl.video_complete and not v.watch_is_current) as requires_rewatch,

    case
      when v.portal_is_current    then 'portal'
      when v.in_person_is_current then 'in_person'
      else null
    end                                            as cleared_basis,

    (v.portal_is_current or v.in_person_is_current) as cleared

  from v_clearance cl
  join courses c on c.id = cl.course_id
  join people  p on p.id = cl.person_id
  left join prior_completions pc
    on pc.person_id = cl.person_id and pc.course_id = cl.course_id
  left join watch_progress w
    on w.person_id = cl.person_id and w.course_id = cl.course_id
  cross join lateral (
    select
      lw.d as last_worked_on,
      (lw.d + c.lapse_after)::date as expires_on
    from (
      select coalesce(
        last_worked_for_customer(p.worker_id, cl.customer_id),
        pc.last_worked_on
      ) as d
    ) lw
  ) e
  cross join lateral (
    select
      -- Currency of the portal pass is judged on the LATEST pass, not the
      -- first. The first is what the certificate cites and never moves.
      (cl.cleared and (
         e.expires_on is null
         or current_date <= e.expires_on
         or cl.latest_pass_at::date > e.expires_on
      )) as portal_is_current,
      (pc.id is not null and (
         e.expires_on is null
         or current_date <= e.expires_on
         or pc.completed_on > e.expires_on
      )) as in_person_is_current,
      (
         e.expires_on is null
         or current_date <= e.expires_on
         or w.completed_at::date > e.expires_on
      ) as watch_is_current
  ) v
$$;

-- Not callable by anyone but the two wrappers below. Postgres checks function
-- EXECUTE against the CALLER even inside a definer view — unlike table
-- privileges, which are checked against the view owner — so granting this to
-- `authenticated` would hand every worker the whole company's clearance in one
-- call. Inside a SECURITY DEFINER function, current_user is the owner, so the
-- wrappers can reach it and nobody else can.
revoke all on function f_training_clearance_all() from public, authenticated, anon;

-- ---------------------------------------------------------------------
-- What a worker (or an admin) may read about themselves.
-- ---------------------------------------------------------------------
create or replace function f_training_clearance_self()
returns table (
  person_id              uuid,
  course_id              uuid,
  customer_id            uuid,
  seconds_watched        integer,
  duration_seconds       integer,
  watch_ratio            numeric,
  best_score             integer,
  last_score             integer,
  attempt_count          bigint,
  passed_at              timestamptz,
  due_date               date,
  in_person_completed_on date,
  in_person_has_evidence boolean,
  last_worked_on         date,
  expires_on             date,
  lapsed                 boolean,
  video_complete         boolean,
  requires_rewatch       boolean,
  cleared_basis          text,
  cleared                boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select * from f_training_clearance_all() t
  where t.person_id = auth.uid() or is_training_admin();
$$;

grant execute on function f_training_clearance_self() to authenticated;

create or replace view v_training_clearance as
select * from f_training_clearance_self();

grant select on v_training_clearance to authenticated;

-- =====================================================================
-- v_customer_roster — the only thing a customer's safety manager may read.
--
-- No email, no phone, no attempt history, no other customers' crews. Runs as
-- definer so client_viewer needs no grant on the base tables.
--
-- Changed from 0001_init.sql: reports cleared_basis, the expiry and the lapse,
-- so "cleared" is never ambiguous about whether it came from a measured portal
-- pass or a keyed-in paper record.
-- =====================================================================
-- The column list here IS the privacy boundary, so it is deliberately short.
-- No email, no phone, no attempt_count, no last_score, no answers. What Bert
-- gets is what CLAUDE.md says he gets: name, crew, language, start date, watch
-- progress, best score, cleared status and date — plus the basis and expiry,
-- which are new and which he needs in order to read "cleared" correctly.
create or replace function f_customer_roster()
returns table (
  person_id              uuid,
  full_name              text,
  crew                   text,
  preferred_lang         text,
  start_date             date,
  course_id              uuid,
  watch_ratio            numeric,
  video_complete         boolean,
  best_score             integer,
  cleared                boolean,
  cleared_basis          text,
  in_person_completed_on date,
  last_worked_on         date,
  expires_on             date,
  lapsed                 boolean,
  passed_at              timestamptz,
  due_date               date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.full_name, p.crew, p.preferred_lang, p.start_date,
    tc.course_id, tc.watch_ratio, tc.video_complete, tc.best_score,
    tc.cleared, tc.cleared_basis, tc.in_person_completed_on,
    tc.last_worked_on, tc.expires_on, tc.lapsed, tc.passed_at, tc.due_date
  from people p
  join f_training_clearance_all() tc on tc.person_id = p.id
  where p.active
    and p.role = 'employee'
    -- The worker must be stationed at the customer's site, not merely assigned
    -- a course the customer happens to own.
    and p.customer_id = tc.customer_id
    and exists (
      select 1
      from viewer_scopes vs
      where vs.person_id = auth.uid()
        and vs.customer_id = p.customer_id
    );
$$;

grant execute on function f_customer_roster() to authenticated;

create or replace view v_customer_roster
with (security_barrier = true)
as
select * from f_customer_roster();

grant select on v_customer_roster to authenticated;

-- =====================================================================
-- begin_retake()
--
-- `record_heartbeat()` never lowers seconds_watched and never clears
-- completed_at, which is right for normal use — it is what stops someone
-- scrubbing their own progress. But it means a worker whose watch has expired
-- can never earn a new one: seconds_watched is already at the cap and
-- completed_at still holds its original date, so rewatching credits nothing.
--
-- This is the one sanctioned reset, and it is narrow: it fires only when the
-- view says the watch has actually expired, only for the caller's own row, and
-- it clears progress rather than granting any. The old attempts stay where
-- they are — `attempts` is append-only and this does not touch it.
-- =====================================================================
create or replace function begin_retake(p_course_id uuid)
returns watch_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person uuid := auth.uid();
  v_needed boolean;
  v_row    watch_progress;
begin
  if v_person is null then
    raise exception 'not authenticated';
  end if;

  select tc.requires_rewatch into v_needed
  from v_training_clearance tc
  where tc.person_id = v_person and tc.course_id = p_course_id;

  if not coalesce(v_needed, false) then
    select * into v_row from watch_progress
    where person_id = v_person and course_id = p_course_id;
    return v_row;
  end if;

  update watch_progress w
     set seconds_watched   = 0,
         furthest_second   = 0,
         completed_at      = null,
         first_started_at  = now(),
         last_heartbeat_at = null
   where w.person_id = v_person and w.course_id = p_course_id
   returning * into v_row;

  insert into training_audit_log (actor_id, action, entity, entity_id, detail)
  values (v_person, 'watch.retake_reset', 'watch_progress', p_course_id::text,
          jsonb_build_object('reason', 'watch expired under lapse rule'));

  return v_row;
end;
$$;

revoke all on function begin_retake(uuid) from public;
grant execute on function begin_retake(uuid) to authenticated;
