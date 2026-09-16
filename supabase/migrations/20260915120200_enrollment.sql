-- =====================================================================
-- Enrollment: turning a placement into a training assignment
--
-- The obvious implementation — a trigger on `placements` that inserts into
-- `people` and `assignments` — cannot work, and it is worth being explicit
-- about why rather than discovering it in production:
--
--   `people.id` references `auth.users(id)`. A worker in the Manpower Portal
--   has no auth user; workers are data there, not logins. Postgres cannot
--   create a Supabase auth user, so a trigger cannot create the `people` row
--   it would need. Only the Auth Admin API (service role, from the server)
--   can, because it owns password-less identity, email confirmation and the
--   rest of it.
--
-- So the trigger does the part SQL can do — decide WHO needs enrolling and
-- when — and leaves the identity creation to a drain job that calls the Admin
-- API. The queue makes that boundary explicit and auditable, and means a
-- failed invite is a row to retry rather than a silently missing assignment.
-- =====================================================================

create table training_enrollment_queue (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null references workers (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  placement_id  uuid references placements (id) on delete set null,
  customer_id   uuid not null references customers (id) on delete cascade,

  due_date      date,
  queued_at     timestamptz not null default now(),

  processed_at  timestamptz,
  person_id     uuid references people (id),
  error         text,
  attempts      integer not null default 0,

  unique (worker_id, course_id)
);

create index training_enrollment_pending_idx
  on training_enrollment_queue (queued_at)
  where processed_at is null;

alter table training_enrollment_queue enable row level security;

create policy enrollment_admin_all on training_enrollment_queue
  for all to authenticated
  using (is_training_admin()) with check (is_training_admin());

-- =====================================================================
-- enqueue_training_for_placement()
--
-- Fires when a placement first reaches a stage where the worker is being
-- prepared to go on site. 'onboarding' is the right moment, not 'started':
-- onboarding is where badging, DISA and the safety council already happen, so
-- the orientation belongs alongside them — and it gives the worker time to sit
-- the 33 minutes before their first shift rather than on it.
--
-- Deliberately not fired on worker creation. The course belongs to a customer
-- and clearance means "cleared for THAT customer's sites"; assigning M&D's
-- orientation to a worker headed elsewhere would put them on M&D's roster for
-- no reason. This is the same trap v_customer_roster's own WHERE clause exists
-- to avoid.
-- =====================================================================
create or replace function enqueue_training_for_placement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses%rowtype;
begin
  if new.stage not in ('onboarding', 'confirmed', 'started') then
    return new;
  end if;

  -- Only act on the transition into those stages, not on every later update.
  if tg_op = 'UPDATE' and old.stage in ('onboarding', 'confirmed', 'started') then
    return new;
  end if;

  select * into v_course
  from courses
  where customer_id = new.customer_id and active
  limit 1;

  if v_course.id is null then
    return new;   -- this customer has no orientation course; nothing to do
  end if;

  -- Already has a training profile: assign directly, no identity to create.
  if exists (select 1 from people p where p.worker_id = new.worker_id) then
    insert into assignments (person_id, course_id, due_date)
    select p.id, v_course.id, new.scheduled_start_date
    from people p
    where p.worker_id = new.worker_id
    on conflict (person_id, course_id) do nothing;
    return new;
  end if;

  insert into training_enrollment_queue
    (worker_id, course_id, placement_id, customer_id, due_date)
  values
    (new.worker_id, v_course.id, new.id, new.customer_id, new.scheduled_start_date)
  on conflict (worker_id, course_id) do nothing;

  return new;
end;
$$;

create trigger placements_enqueue_training
  after insert or update of stage on placements
  for each row
  execute function enqueue_training_for_placement();

-- =====================================================================
-- workers_needing_training_contact
--
-- A worker signs in by magic link or SMS code, so a worker with neither an
-- email nor a phone cannot be enrolled at all. Run this before any backfill:
-- it is cheaper to find them now than to discover it when someone cannot get
-- on site.
-- =====================================================================
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
  and coalesce(nullif(trim(w.email::text), ''), nullif(trim(w.phone), '')) is null;

-- =====================================================================
-- record_prior_completion()
--
-- The backfill entry point. Creates the assignment if it is missing — a
-- prior completion with no assignment would leave the worker invisible on the
-- customer roster, since clearance is derived FROM assignments — and writes
-- the audit trail.
--
-- Admin only, and the caller is recorded. There is no update path and no
-- delete path, deliberately.
-- =====================================================================
create or replace function record_prior_completion(
  p_person_id      uuid,
  p_course_id      uuid,
  p_completed_on   date,
  p_last_worked_on date default null,
  p_evidence_path  text default null,
  p_notes          text default null
)
returns prior_completions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row   prior_completions;
begin
  if not is_training_admin() then
    raise exception 'admin only';
  end if;

  if p_completed_on > current_date then
    raise exception 'completion date is in the future';
  end if;

  insert into assignments (person_id, course_id)
  values (p_person_id, p_course_id)
  on conflict (person_id, course_id) do nothing;

  insert into prior_completions
    (person_id, course_id, completed_on, method, last_worked_on,
     evidence_path, recorded_by, notes)
  values
    (p_person_id, p_course_id, p_completed_on, 'in_person', p_last_worked_on,
     p_evidence_path, v_actor, p_notes)
  returning * into v_row;

  insert into training_audit_log (actor_id, action, entity, entity_id, detail)
  values (v_actor, 'prior_completion.record', 'prior_completions', v_row.id::text,
          jsonb_build_object(
            'person_id',      p_person_id,
            'course_id',      p_course_id,
            'completed_on',   p_completed_on,
            'last_worked_on', p_last_worked_on,
            'has_evidence',   p_evidence_path is not null
          ));

  return v_row;
end;
$$;

revoke all on function record_prior_completion(uuid, uuid, date, date, text, text) from public;
grant execute on function record_prior_completion(uuid, uuid, date, date, text, text) to authenticated;
grant select on workers_needing_training_contact to authenticated;
