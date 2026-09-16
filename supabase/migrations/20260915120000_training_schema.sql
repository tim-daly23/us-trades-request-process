-- =====================================================================
-- Training schema, MERGED variant
--
-- Target: the Manpower Portal database (project ref lqpctvjfdeimldgnhtuz),
-- NOT a standalone training project.
--
-- Relationship to supabase/migrations/0001_init.sql:
--   0001_init.sql is the standalone design. It CANNOT be applied to the
--   Manpower Portal database — it creates `customers` and `audit_log`, both of
--   which already exist there with different shapes. This file is the version
--   that can. In the merged deployment 0001_init.sql becomes reference only;
--   it is left untouched so the original design and its test suite stay
--   readable.
--
-- Differences from 0001_init.sql, all deliberate:
--   1. No `customers` table. `courses.customer_id` references the Manpower
--      Portal's existing `customers`, whose display column is `display_name`.
--   2. `audit_log` -> `training_audit_log`. The portal's `audit_log.actor_id`
--      references `app_users(id)`; a worker has no app_users row, so writing
--      there from submit_attempt() would fail the foreign key and take every
--      knowledge-check submission down with it.
--   3. `people` gains `worker_id`, linking a training profile to the employee
--      record in `workers`.
--   4. `people` gains `lang_chosen_at`, so "never asked" is expressible. The
--      cookie workaround in the app (src/lib/lang-prompt.ts) can be deleted.
--   5. record_heartbeat() no longer applies slack to the elapsed-time arm, and
--      rejects heartbeats that arrive too close together. See the note there.
--   6. Column-level UPDATE privileges on `people`, so the self-update policy
--      cannot be used to grant yourself a role.
--   7. v_clearance is security_invoker, so it is filtered by the RLS on the
--      tables underneath rather than being readable in full by anyone.
--
-- Clearance itself is unchanged in principle: still derived, never stored.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums. `app_role` and `attempt_result` do not collide with anything in
-- the Manpower Portal schema (checked against its user_type, agency_role,
-- customer_role, worker_status and friends).
-- ---------------------------------------------------------------------
do $$ begin
  create type app_role as enum ('employee', 'admin', 'client_viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attempt_result as enum ('pass', 'fail');
exception when duplicate_object then null; end $$;

do $$ begin
  create type training_completion_method as enum ('in_person');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- people — the training profile. One row per auth user who takes training.
--
-- This sits alongside app_users, it does not replace it. They serve different
-- populations: app_users is agency and customer staff, who sign in to the
-- Manpower Portal; people is workers, who until now never signed in anywhere.
-- A US Trades admin who needs both simply has a row in each.
-- ---------------------------------------------------------------------
create table people (
  id             uuid primary key references auth.users (id) on delete cascade,
  worker_id      uuid unique references workers (id) on delete set null,
  full_name      text not null,
  email          text,
  phone          text,
  preferred_lang text not null default 'en' check (preferred_lang in ('en', 'es')),
  -- Null means the language question has never been asked. Distinguishing that
  -- from "asked, chose English" is why this column exists.
  lang_chosen_at timestamptz,
  crew           text,
  customer_id    uuid references customers (id),   -- site the worker is stationed at
  employer       text not null default 'US Trades LLC',
  role           app_role not null default 'employee',
  start_date     date,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index people_customer_idx on people (customer_id) where active;
create index people_role_idx on people (role);
create index people_worker_idx on people (worker_id);

-- Which customers a client_viewer may see. Explicit, not inferred.
create table viewer_scopes (
  person_id   uuid not null references people (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  primary key (person_id, customer_id)
);

-- ---------------------------------------------------------------------
-- Courses. customer_id points at the Manpower Portal's customers table.
-- ---------------------------------------------------------------------
create table courses (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references customers (id),
  slug             text not null unique,
  title_en         text not null,
  title_es         text not null,
  description_en   text,
  description_es   text,
  -- Cloudflare Stream UIDs. Spanish is a separate dubbed file, not a subtitle track.
  video_uid_en     text,
  video_uid_es     text,
  duration_seconds integer not null check (duration_seconds > 0),
  pass_percent     integer not null default 80 check (pass_percent between 1 and 100),
  min_watch_ratio  numeric(4,3) not null default 0.980 check (min_watch_ratio between 0 and 1),
  -- How long a completion stands before the worker must retake, measured from
  -- their last day worked AT THIS COURSE'S CUSTOMER. Null means never expires.
  lapse_after      interval not null default interval '5 years',
  version          integer not null default 1,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table questions (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  position      integer not null,
  prompt_en     text not null,
  prompt_es     text not null,
  choices_en    jsonb not null,
  choices_es    jsonb not null,
  correct_index integer not null,
  active        boolean not null default true,
  unique (course_id, position),
  constraint choices_are_arrays check (
    jsonb_typeof(choices_en) = 'array' and jsonb_typeof(choices_es) = 'array'
  ),
  constraint choices_same_length check (
    jsonb_array_length(choices_en) = jsonb_array_length(choices_es)
  ),
  constraint correct_index_in_range check (
    correct_index >= 0 and correct_index < jsonb_array_length(choices_en)
  )
);

create table assignments (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people (id) on delete cascade,
  course_id   uuid not null references courses (id) on delete cascade,
  due_date    date,
  assigned_at timestamptz not null default now(),
  unique (person_id, course_id)
);

-- Server-written only. See record_heartbeat().
create table watch_progress (
  person_id         uuid not null references people (id) on delete cascade,
  course_id         uuid not null references courses (id) on delete cascade,
  lang              text not null check (lang in ('en', 'es')),
  furthest_second   integer not null default 0 check (furthest_second >= 0),
  seconds_watched   integer not null default 0 check (seconds_watched >= 0),
  first_started_at  timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  completed_at      timestamptz,
  primary key (person_id, course_id)
);

-- Append-only. Never updated, never deleted.
create table attempts (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid not null references people (id) on delete cascade,
  course_id      uuid not null references courses (id),
  course_version integer not null,
  lang           text not null check (lang in ('en', 'es')),
  answers        jsonb not null,
  correct_count  integer not null check (correct_count >= 0),
  total_count    integer not null check (total_count > 0),
  score_percent  integer not null check (score_percent between 0 and 100),
  result         attempt_result not null,
  acknowledged   boolean not null default false,
  submitted_at   timestamptz not null default now()
);

create index attempts_person_course_idx on attempts (person_id, course_id, submitted_at desc);

-- ---------------------------------------------------------------------
-- Training audit log. Separate from the Manpower Portal's audit_log, whose
-- actor_id references app_users — a foreign key no worker can satisfy.
-- ---------------------------------------------------------------------
create table training_audit_log (
  id        bigserial primary key,
  actor_id  uuid references people (id),
  action    text not null,
  entity    text not null,
  entity_id text,
  detail    jsonb,
  at        timestamptz not null default now()
);

create index training_audit_log_at_idx on training_audit_log (at desc);

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function training_role_of(uid uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from people where id = uid;
$$;

create or replace function is_training_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(training_role_of(auth.uid()) = 'admin', false);
$$;

-- =====================================================================
-- Derived clearance — portal-measured only.
--
-- Deliberately unchanged in meaning from 0001_init.sql so the original
-- reasoning and its tests still apply. In-person completions and the lapse
-- rule are layered on top in the next migration, not folded in here: this
-- view answers "what did the portal measure", and nothing else.
--
-- security_invoker means the RLS on assignments, attempts and watch_progress
-- applies to whoever queries it, instead of the view owner bypassing it.
-- =====================================================================
create or replace view v_clearance
with (security_invoker = true)
as
select
  a.person_id,
  a.course_id,
  c.customer_id,
  coalesce(w.seconds_watched, 0)                       as seconds_watched,
  c.duration_seconds,
  coalesce(w.seconds_watched, 0)::numeric
    / c.duration_seconds                               as watch_ratio,
  (coalesce(w.seconds_watched, 0)::numeric
    / c.duration_seconds) >= c.min_watch_ratio         as video_complete,
  best.score_percent                                   as first_pass_score,
  high.score_percent                                   as best_score,
  last.score_percent                                   as last_score,
  coalesce(tries.n, 0)                                 as attempt_count,
  best.submitted_at                                    as passed_at,
  -- The MOST RECENT pass, which is a different question from the first one.
  -- passed_at is what the certificate cites; latest_pass_at is what decides
  -- whether the clearance is still current under the lapse rule. Using the
  -- first pass for that would mean a returning worker's fresh pass never
  -- counted, because their earliest pass stays stuck in the past forever.
  recent.submitted_at                                  as latest_pass_at,
  a.due_date,
  (
    (coalesce(w.seconds_watched, 0)::numeric / c.duration_seconds) >= c.min_watch_ratio
    and best.id is not null
  )                                                    as cleared
from assignments a
join courses c on c.id = a.course_id
left join watch_progress w
  on w.person_id = a.person_id and w.course_id = a.course_id
-- Earliest pass: this is what passed_at means, and what the certificate cites.
left join lateral (
  select t.id, t.score_percent, t.submitted_at
  from attempts t
  where t.person_id = a.person_id
    and t.course_id = a.course_id
    and t.result = 'pass'
  order by t.submitted_at asc
  limit 1
) best on true
left join lateral (
  select t.submitted_at
  from attempts t
  where t.person_id = a.person_id
    and t.course_id = a.course_id
    and t.result = 'pass'
  order by t.submitted_at desc
  limit 1
) recent on true
-- Highest score. In 0001_init.sql `best_score` was the FIRST passing score,
-- which is not what the name says and not what a roster column should show.
left join lateral (
  select max(t.score_percent) as score_percent
  from attempts t
  where t.person_id = a.person_id and t.course_id = a.course_id
) high on true
left join lateral (
  select t.score_percent
  from attempts t
  where t.person_id = a.person_id and t.course_id = a.course_id
  order by t.submitted_at desc
  limit 1
) last on true
left join lateral (
  select count(*) as n
  from attempts t
  where t.person_id = a.person_id and t.course_id = a.course_id
) tries on true;

-- =====================================================================
-- Row level security
-- =====================================================================
alter table people             enable row level security;
alter table viewer_scopes      enable row level security;
alter table courses            enable row level security;
alter table questions          enable row level security;
alter table assignments        enable row level security;
alter table watch_progress     enable row level security;
alter table attempts           enable row level security;
alter table training_audit_log enable row level security;

-- people ---------------------------------------------------------------
create policy people_self_read on people
  for select to authenticated
  using (id = auth.uid());

create policy people_admin_all on people
  for all to authenticated
  using (is_training_admin()) with check (is_training_admin());

-- Deliberately no policy for client_viewer: they read v_customer_roster.

create policy people_self_update on people
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- RLS restricts rows, not columns, and Supabase grants UPDATE on every column
-- to `authenticated` by default. Without the two statements below, the policy
-- above lets any worker run `update people set role = 'admin' where id =
-- auth.uid()` and take over the whole schema.
revoke update on people from authenticated;
grant update (preferred_lang, lang_chosen_at) on people to authenticated;

-- courses / questions --------------------------------------------------
create policy courses_read_assigned on courses
  for select to authenticated
  using (
    is_training_admin()
    or exists (
      select 1 from assignments a
      where a.course_id = courses.id and a.person_id = auth.uid()
    )
  );

create policy courses_admin_write on courses
  for all to authenticated
  using (is_training_admin()) with check (is_training_admin());

create policy questions_read_assigned on questions
  for select to authenticated
  using (
    is_training_admin()
    or exists (
      select 1 from assignments a
      where a.course_id = questions.course_id and a.person_id = auth.uid()
    )
  );

create policy questions_admin_write on questions
  for all to authenticated
  using (is_training_admin()) with check (is_training_admin());

-- The answer key is a column on a row the taker is allowed to read, and RLS
-- cannot hide a column. Revoking it at the privilege level is the only way to
-- stop a browser querying `select correct_index from questions` with the
-- taker's own token. The app never selects it; grading is server-side.
revoke select on questions from authenticated;
grant select (id, course_id, position, prompt_en, prompt_es, choices_en, choices_es, active)
  on questions to authenticated;

-- assignments ----------------------------------------------------------
create policy assignments_self_read on assignments
  for select to authenticated
  using (person_id = auth.uid() or is_training_admin());

create policy assignments_admin_write on assignments
  for all to authenticated
  using (is_training_admin()) with check (is_training_admin());

-- viewer_scopes --------------------------------------------------------
create policy viewer_scopes_self_read on viewer_scopes
  for select to authenticated
  using (person_id = auth.uid() or is_training_admin());

create policy viewer_scopes_admin_write on viewer_scopes
  for all to authenticated
  using (is_training_admin()) with check (is_training_admin());

-- watch_progress: readable by self/admin, WRITABLE BY NOBODY -----------
create policy watch_progress_self_read on watch_progress
  for select to authenticated
  using (person_id = auth.uid() or is_training_admin());
-- No insert/update policy on purpose. record_heartbeat() is the only writer.

-- attempts: readable by self/admin, WRITABLE BY NOBODY -----------------
create policy attempts_self_read on attempts
  for select to authenticated
  using (person_id = auth.uid() or is_training_admin());
-- No insert policy on purpose. submit_attempt() is the only writer.

-- training_audit_log ---------------------------------------------------
create policy training_audit_admin_read on training_audit_log
  for select to authenticated using (is_training_admin());

-- =====================================================================
-- record_heartbeat()
--
-- The player calls this every ~15s with its current position.
--
-- The rate limit is the whole point, so it is worth being explicit about how
-- it works here, because the earlier version got it wrong:
--
--   grant = least( elapsed, forward_movement + slack )
--
-- Slack is on the MOVEMENT arm only. In 0001_init.sql it was on both, which
-- meant `least(elapsed + 2, 0 + 2)` = 2 whenever elapsed was near zero — so
-- every call credited 2 seconds no matter how fast the calls arrived, and
-- ~1000 scripted calls cleared a 33-minute video. With slack on one arm,
-- spamming the endpoint credits nothing, because no real time has passed.
--
-- The minimum interval is belt and braces: it caps the damage from any future
-- mistake in the arithmetic to one grant per interval.
-- =====================================================================
create or replace function record_heartbeat(
  p_course_id uuid,
  p_lang      text,
  p_position  integer
)
returns watch_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person   uuid := auth.uid();
  v_dur      integer;
  v_ratio    numeric;
  v_row      watch_progress;
  v_elapsed  numeric;
  v_grant    integer;
  slack      constant numeric := 2;  -- tolerance for jitter in the 15s cadence
  min_gap    constant numeric := 5;  -- reject anything faster than this
begin
  if v_person is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from assignments a
    where a.person_id = v_person and a.course_id = p_course_id
  ) then
    raise exception 'course not assigned to this person';
  end if;

  select duration_seconds, min_watch_ratio
    into v_dur, v_ratio
  from courses where id = p_course_id;

  if v_dur is null then
    raise exception 'unknown course';
  end if;

  p_position := greatest(0, least(p_position, v_dur));

  insert into watch_progress (person_id, course_id, lang, furthest_second,
                              seconds_watched, last_heartbeat_at)
  values (v_person, p_course_id, p_lang, p_position, 0, now())
  on conflict (person_id, course_id) do nothing;

  select * into v_row
  from watch_progress
  where person_id = v_person and course_id = p_course_id
  for update;

  v_elapsed := extract(epoch from (now() - coalesce(v_row.last_heartbeat_at, now())));

  -- Too soon: record the position, credit nothing, do not move the clock.
  if v_elapsed > 0 and v_elapsed < min_gap then
    update watch_progress w
       set furthest_second = greatest(w.furthest_second, p_position)
     where w.person_id = v_person and w.course_id = p_course_id
     returning * into v_row;
    return v_row;
  end if;

  v_grant := floor(
    least(
      v_elapsed,
      greatest(0, p_position - v_row.furthest_second) + slack
    )
  )::integer;
  v_grant := greatest(0, v_grant);

  update watch_progress w
     set lang              = p_lang,
         furthest_second   = greatest(w.furthest_second, p_position),
         seconds_watched   = least(v_dur, w.seconds_watched + v_grant),
         last_heartbeat_at = now(),
         completed_at      = case
                               when w.completed_at is not null then w.completed_at
                               when least(v_dur, w.seconds_watched + v_grant)::numeric / v_dur >= v_ratio
                                 then now()
                               else null
                             end
   where w.person_id = v_person and w.course_id = p_course_id
   returning * into v_row;

  return v_row;
end;
$$;

-- =====================================================================
-- submit_attempt()
--
-- Grades server-side. The client never sees correct_index and never decides
-- pass/fail. Refuses outright if the video is not complete.
--
-- Unchanged from 0001_init.sql except for the audit target.
-- =====================================================================
create or replace function submit_attempt(
  p_course_id    uuid,
  p_lang         text,
  p_answers      jsonb,
  p_acknowledged boolean
)
returns attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person   uuid := auth.uid();
  v_course   courses%rowtype;
  v_total    integer;
  v_correct  integer;
  v_score    integer;
  v_complete boolean;
  v_row      attempts;
begin
  if v_person is null then
    raise exception 'not authenticated';
  end if;

  if not coalesce(p_acknowledged, false) then
    raise exception 'acknowledgment required';
  end if;

  select * into v_course from courses where id = p_course_id and active;
  if v_course.id is null then
    raise exception 'unknown or inactive course';
  end if;

  if not exists (
    select 1 from assignments a
    where a.person_id = v_person and a.course_id = p_course_id
  ) then
    raise exception 'course not assigned to this person';
  end if;

  -- The gate. Not negotiable from the client.
  select coalesce(w.seconds_watched, 0)::numeric / v_course.duration_seconds
           >= v_course.min_watch_ratio
    into v_complete
  from (select 1) _
  left join watch_progress w
    on w.person_id = v_person and w.course_id = p_course_id;

  if not coalesce(v_complete, false) then
    raise exception 'video not completed';
  end if;

  select count(*) into v_total
  from questions q where q.course_id = p_course_id and q.active;

  if v_total = 0 then
    raise exception 'course has no questions';
  end if;

  if (select count(*) from jsonb_object_keys(p_answers)) <> v_total then
    raise exception 'all questions must be answered';
  end if;

  select count(*) into v_correct
  from questions q
  where q.course_id = p_course_id
    and q.active
    and (p_answers ->> q.id::text)::integer = q.correct_index;

  v_score := round(v_correct::numeric * 100 / v_total);

  insert into attempts (person_id, course_id, course_version, lang, answers,
                        correct_count, total_count, score_percent, result, acknowledged)
  values (v_person, p_course_id, v_course.version, p_lang, p_answers,
          v_correct, v_total, v_score,
          case when v_score >= v_course.pass_percent then 'pass' else 'fail' end::attempt_result,
          true)
  returning * into v_row;

  insert into training_audit_log (actor_id, action, entity, entity_id, detail)
  values (v_person, 'attempt.submit', 'attempts', v_row.id::text,
          jsonb_build_object('score', v_score, 'result', v_row.result, 'lang', p_lang));

  return v_row;
end;
$$;

-- =====================================================================
-- Grants
-- =====================================================================
revoke all on function record_heartbeat(uuid, text, integer) from public;
revoke all on function submit_attempt(uuid, text, jsonb, boolean) from public;
grant execute on function record_heartbeat(uuid, text, integer) to authenticated;
grant execute on function submit_attempt(uuid, text, jsonb, boolean) to authenticated;
grant select on v_clearance to authenticated;
