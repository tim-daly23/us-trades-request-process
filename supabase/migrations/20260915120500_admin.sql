-- =====================================================================
-- Admin console support
--
-- Two things here: a leak to close, and the reads the roster needs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. workers_needing_training_contact was readable by every worker.
--
-- 20260915120200 created it as a plain view — which in Postgres runs with
-- the owner's privileges, bypassing RLS on `workers` — and then granted
-- SELECT to `authenticated`. Any signed-in worker could therefore list other
-- workers' names and employment status. Same mistake as the unfiltered
-- v_clearance in the original design, made again one migration later.
--
-- Recreated with the admin check inside it. A definer view that reaches past
-- RLS has to do its own scoping; there is nowhere else for it to happen.
-- ---------------------------------------------------------------------
create or replace view workers_needing_training_contact as
select
  w.id            as worker_id,
  w.first_name,
  w.last_name,
  w.status,
  q.course_id,
  q.customer_id
from training_enrollment_queue q
join workers w on w.id = q.worker_id
where q.processed_at is null
  and coalesce(nullif(trim(w.email::text), ''), nullif(trim(w.phone), '')) is null
  and is_training_admin();

-- ---------------------------------------------------------------------
-- 2. f_admin_roster()
--
-- Everything the roster shows, in one read.
--
-- It has to be definer for the same reason f_my_assigned_courses does: the
-- customer's name lives in the manpower portal's `customers` table, whose
-- policy checks a JWT claim only staff have. A US Trades training admin is
-- not necessarily an app_users row, so the join would silently return
-- nothing — the failure mode that made a worker's course page come up empty.
--
-- Gated on is_training_admin() in the WHERE clause rather than raising, so a
-- non-admin gets zero rows rather than an error that confirms the function
-- exists and does something interesting.
-- ---------------------------------------------------------------------
create or replace function f_admin_roster()
returns table (
  person_id              uuid,
  full_name              text,
  email                  text,
  phone                  text,
  crew                   text,
  employer               text,
  start_date             date,
  preferred_lang         text,
  active                 boolean,
  worker_id              uuid,
  course_id              uuid,
  course_slug            text,
  customer_id            uuid,
  customer_display_name  text,
  due_date               date,
  seconds_watched        integer,
  duration_seconds       integer,
  watch_ratio            numeric,
  video_complete         boolean,
  requires_rewatch       boolean,
  attempt_count          bigint,
  best_score             integer,
  last_score             integer,
  passed_at              timestamptz,
  in_person_completed_on date,
  in_person_has_evidence boolean,
  last_worked_on         date,
  expires_on             date,
  lapsed                 boolean,
  cleared                boolean,
  cleared_basis          text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.full_name, p.email, p.phone, p.crew, p.employer, p.start_date,
    p.preferred_lang, p.active, p.worker_id,
    tc.course_id, c.slug, tc.customer_id, cu.display_name, tc.due_date,
    tc.seconds_watched, tc.duration_seconds, tc.watch_ratio,
    tc.video_complete, tc.requires_rewatch,
    tc.attempt_count, tc.best_score, tc.last_score, tc.passed_at,
    tc.in_person_completed_on, tc.in_person_has_evidence,
    tc.last_worked_on, tc.expires_on, tc.lapsed,
    tc.cleared, tc.cleared_basis
  from f_training_clearance_all() tc
  join people    p  on p.id  = tc.person_id
  join courses   c  on c.id  = tc.course_id
  join customers cu on cu.id = tc.customer_id
  where is_training_admin()
  order by p.full_name;
$$;

revoke all on function f_admin_roster() from public, anon;
grant execute on function f_admin_roster() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Counters for the roster header, so the page does not pull the whole
--    table just to count it.
--
--    The detail page filters f_admin_roster() by person_id rather than having
--    its own function: attempts, watch_progress and prior_completions are
--    already readable by an admin under RLS, so the roster row is the only
--    thing it cannot get directly.
-- ---------------------------------------------------------------------
create or replace function f_admin_summary()
returns table (
  people_total        bigint,
  cleared_total       bigint,
  lapsed_total        bigint,
  in_person_total     bigint,
  never_started       bigint,
  awaiting_check      bigint,
  pending_enrollment  bigint,
  missing_contact     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)                                             as people_total,
    count(*) filter (where r.cleared)                    as cleared_total,
    count(*) filter (where r.lapsed)                     as lapsed_total,
    count(*) filter (where r.cleared_basis = 'in_person') as in_person_total,
    count(*) filter (where r.seconds_watched = 0 and not r.cleared) as never_started,
    count(*) filter (where r.video_complete and not r.cleared)      as awaiting_check,
    (select count(*) from training_enrollment_queue q
      where q.processed_at is null and is_training_admin()),
    (select count(*) from workers_needing_training_contact)
  from f_admin_roster() r;
$$;

revoke all on function f_admin_summary() from public, anon;
grant execute on function f_admin_summary() to authenticated;
